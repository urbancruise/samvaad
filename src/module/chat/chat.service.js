const { mysqlDb } = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { sendNotification } = require("../notifications/notification.service");
const {
  CONVERSATION_TYPE,
  PARTICIPANT_ROLE,
  MESSAGE_TYPE,
  SEARCH_RESULT_LIMIT,
} = require("./chat.constants");

const repo = require("./chat.repository");

// ---- MySQL user hydration -------------------------------------------------
// Postgres chat rows only carry MySQL user ids (cross-database, no
// relation — same convention as the rest of this schema). Batch-fetch
// the display info the frontend needs whenever we return chat data.

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  officeEmail: true,
  username: true,
};

const mapUser = (u) =>
  u && {
    id: u.id,
    fullName: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
    email: u.officeEmail,
    username: u.username,
  };

const hydrateUsers = async (ids) => {
  const uniqueIds = [...new Set(ids)].filter((id) => id !== undefined && id !== null);
  if (uniqueIds.length === 0) return {};

  const users = await mysqlDb.users.findMany({
    where: { id: { in: uniqueIds } },
    select: USER_SELECT,
  });

  return Object.fromEntries(users.map((u) => [u.id, mapUser(u)]));
};

const shapeMessage = (message, userMap) => ({
  id: message.id,
  conversationId: message.conversationId,
  type: message.type,
  body: message.deletedAt ? null : message.body,
  isDeleted: Boolean(message.deletedAt),
  isEdited: message.isEdited,
  editedAt: message.editedAt,
  sender: userMap[message.senderId] ?? { id: message.senderId, fullName: "Unknown" },
  replyTo: message.replyTo
    ? {
        id: message.replyTo.id,
        body: message.replyTo.deletedAt ? null : message.replyTo.body,
        isDeleted: Boolean(message.replyTo.deletedAt),
        sender: userMap[message.replyTo.senderId] ?? { id: message.replyTo.senderId, fullName: "Unknown" },
        attachments: message.replyTo.attachments ?? [],
      }
    : null,
  mentions: message.mentions,
  attachments: message.attachments ?? [],
  reactions: (message.reactions ?? []).map((r) => ({
    emoji: r.emoji,
    user: userMap[r.userId] ?? { id: r.userId, fullName: "Unknown" },
  })),
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

// ---- Permission helpers -----------------------------------------------

const assertParticipant = async (conversationId, userId) => {
  const participant = await repo.findParticipant(conversationId, userId);
  if (!participant || participant.leftAt) {
    throw new ApiError(403, "You are not part of this conversation");
  }
  return participant;
};

const assertGroupAdmin = (participant) => {
  if (![PARTICIPANT_ROLE.OWNER, PARTICIPANT_ROLE.ADMIN].includes(participant.role)) {
    throw new ApiError(403, "Only group admins can do this");
  }
};

// ---- Conversations ------------------------------------------------------

const createConversationService = async (userId, data) => {
  if (data.type === CONVERSATION_TYPE.DIRECT) {
    const otherUserId = data.participantIds[0];
    if (otherUserId === userId) {
      throw new ApiError(400, "Cannot start a direct conversation with yourself");
    }

    const existing = await repo.findDirectConversationBetween(userId, otherUserId);
    if (existing) return existing;
  }

  return repo.createConversation({ ...data, createdById: userId });
};

const getUserConversationsService = async (userId) => {
  const conversations = await repo.findUserConversations(userId);

  const allUserIds = conversations.flatMap((c) => [
    ...c.participants.map((p) => p.userId),
    ...c.messages.map((m) => m.senderId),
  ]);
  const userMap = await hydrateUsers(allUserIds);

  return Promise.all(
    conversations.map(async (c) => {
      const me = c.participants.find((p) => p.userId === userId);
      const unreadCount = await repo.countUnread(c.id, userId, me?.lastReadAt);
      const lastMessage = c.messages[0];

      return {
        id: c.id,
        type: c.type,
        name: c.name,
        avatarUrl: c.avatarUrl,
        participants: c.participants.map((p) => ({
          ...userMap[p.userId],
          role: p.role,
          isMuted: p.isMuted,
        })),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              type: lastMessage.type,
              body: lastMessage.deletedAt ? null : lastMessage.body,
              isDeleted: Boolean(lastMessage.deletedAt),
              sender: userMap[lastMessage.senderId],
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount,
        lastMessageAt: c.lastMessageAt,
      };
    })
  );
};

const getConversationService = async (conversationId, userId) => {
  await assertParticipant(conversationId, userId);

  const conversation = await repo.findConversationById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const userMap = await hydrateUsers(conversation.participants.map((p) => p.userId));

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    avatarUrl: conversation.avatarUrl,
    participants: conversation.participants.map((p) => ({
      ...userMap[p.userId],
      role: p.role,
      isMuted: p.isMuted,
    })),
    createdAt: conversation.createdAt,
  };
};

const updateConversationService = async (conversationId, userId, data) => {
  const participant = await assertParticipant(conversationId, userId);
  assertGroupAdmin(participant);

  return repo.updateConversation(conversationId, data);
};

const addParticipantsService = async (conversationId, userId, participantIds) => {
  const participant = await assertParticipant(conversationId, userId);
  const conversation = await repo.findConversationById(conversationId);

  if (conversation.type !== CONVERSATION_TYPE.GROUP) {
    throw new ApiError(400, "Cannot add participants to a direct conversation");
  }
  assertGroupAdmin(participant);

  await repo.addParticipants(conversationId, participantIds);

  for (const addedId of participantIds) {
    await sendNotification({
      userId: addedId,
      title: "Added to group",
      message: `You were added to "${conversation.name}"`,
      type: "CHAT_GROUP_ADDED",
      link: `/chat/${conversationId}`,
    });
  }

  return getConversationService(conversationId, userId);
};

const removeParticipantService = async (conversationId, userId, targetUserId) => {
  const participant = await assertParticipant(conversationId, userId);

  // Members can remove themselves ("leave group"); removing someone
  // else requires admin/owner.
  if (Number(targetUserId) !== Number(userId)) {
    assertGroupAdmin(participant);
  }

  return repo.removeParticipant(conversationId, Number(targetUserId));
};

// ---- Messages -------------------------------------------------------------

const sendMessageService = async (conversationId, senderId, data) => {
  await assertParticipant(conversationId, senderId);

  if (data.replyToId) {
    const replyTarget = await repo.findMessageById(data.replyToId);
    if (!replyTarget || replyTarget.conversationId !== conversationId) {
      throw new ApiError(400, "Cannot reply to a message outside this conversation");
    }
  }

  const message = await repo.createMessage({ conversationId, senderId, ...data });
  await repo.touchConversation(conversationId, message.createdAt);

  const userMap = await hydrateUsers([
    senderId,
    ...data.mentions,
    ...(message.replyTo ? [message.replyTo.senderId] : []),
  ]);

  for (const mentionedId of data.mentions) {
    if (mentionedId === senderId) continue;
    await sendNotification({
      userId: mentionedId,
      title: "You were mentioned",
      message: `${userMap[senderId]?.fullName ?? "Someone"} mentioned you in a chat`,
      type: "CHAT_MENTION",
      link: `/chat/${conversationId}`,
    });
  }

  return shapeMessage(message, userMap);
};

const getMessagesService = async (conversationId, userId, { before, limit }) => {
  await assertParticipant(conversationId, userId);

  const messages = await repo.findMessages(conversationId, { before, limit });
  const userMap = await hydrateUsers(
    messages.flatMap((m) => [m.senderId, ...(m.replyTo ? [m.replyTo.senderId] : [])])
  );

  // repo returns newest-first for pagination; reverse for chronological display
  return messages.reverse().map((m) => shapeMessage(m, userMap));
};

const editMessageService = async (messageId, userId, body) => {
  const message = await repo.findMessageById(messageId);
  if (!message) throw new ApiError(404, "Message not found");
  if (Number(message.senderId) !== Number(userId)) {
    throw new ApiError(403, "Only the sender can edit this message");
  }
  if (message.deletedAt) throw new ApiError(400, "Cannot edit a deleted message");

  const updated = await repo.editMessage(messageId, body);
  const userMap = await hydrateUsers([userId]);
  return shapeMessage({ ...updated, attachments: message.attachments, reactions: message.reactions }, userMap);
};

const deleteMessageService = async (messageId, userId) => {
  const message = await repo.findMessageById(messageId);
  if (!message) throw new ApiError(404, "Message not found");
  if (Number(message.senderId) !== Number(userId)) {
    throw new ApiError(403, "Only the sender can delete this message");
  }

  await repo.softDeleteMessage(messageId);
  return { id: messageId, conversationId: message.conversationId };
};

const markReadService = async (conversationId, userId, messageId) => {
  await assertParticipant(conversationId, userId);
  return repo.markRead(conversationId, userId, messageId);
};

const toggleReactionService = async (messageId, userId, emoji) => {
  const message = await repo.findMessageById(messageId);
  if (!message) throw new ApiError(404, "Message not found");

  await assertParticipant(message.conversationId, userId);

  const result = await repo.toggleReaction(messageId, userId, emoji);
  return { conversationId: message.conversationId, messageId, emoji, userId, added: result.added };
};

const searchMessagesService = async (userId, query) => {
  const messages = await repo.searchMessages(userId, query, SEARCH_RESULT_LIMIT);
  const userMap = await hydrateUsers(messages.map((m) => m.senderId));

  return messages.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    conversationName: m.conversation.name,
    conversationType: m.conversation.type,
    body: m.body,
    sender: userMap[m.senderId],
    createdAt: m.createdAt,
  }));
};

// Used by call.service.js to drop a CALL_LOG system message into the
// conversation when a call ends.
const createSystemMessage = async (conversationId, senderId, body) => {
  const message = await repo.createMessage({
    conversationId,
    senderId,
    type: MESSAGE_TYPE.CALL_LOG,
    body,
    replyToId: undefined,
    mentions: [],
    attachments: [],
  });
  await repo.touchConversation(conversationId, message.createdAt);

  const userMap = await hydrateUsers([senderId]);
  return shapeMessage(message, userMap);
};

/**
 * Org-wide directory of people the current user can start a chat
 * with. Chat is intentionally NOT restricted to direct
 * reports/managers (unlike task/goal assignment) — it's meant to work
 * like WhatsApp, where you can message anyone in the org.
 */
const getDirectoryService = async (currentUserId) => {
  const users = await mysqlDb.users.findMany({
    where: { is_active: true, id: { not: currentUserId } },
    select: USER_SELECT,
    orderBy: { firstName: "asc" },
  });

  return users.map(mapUser);
};

module.exports = {
  createConversationService,
  getDirectoryService,
  getUserConversationsService,
  getConversationService,
  updateConversationService,
  addParticipantsService,
  removeParticipantService,
  sendMessageService,
  getMessagesService,
  editMessageService,
  deleteMessageService,
  markReadService,
  toggleReactionService,
  searchMessagesService,
  createSystemMessage,
  assertParticipant,
  hydrateUsers,
};