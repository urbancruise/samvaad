const { mysqlDb } = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { sendNotification } = require("../notifications/notification.service");
const { emitToUsers, emitToRoom, removeUserFromRoom } = require("../../socket/emitter");
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

// ---- Realtime helpers -----------------------------------------------------

const nameOf = (userMap, id) => userMap[id]?.fullName || "Someone";

/**
 * Tells every current participant (plus any extra ids, e.g. a user who
 * was just removed) to refetch their conversation list. Cheaper and
 * safer than trying to patch every possible change client-side.
 */
const notifyConversationChanged = async (conversationId, extraUserIds = []) => {
  const conversation = await repo.findConversationById(conversationId);
  const ids = [...(conversation?.participants.map((p) => p.userId) ?? []), ...extraUserIds];
  emitToUsers(ids, "conversation:refresh", { conversationId });
};

// Group events ("X added Y", "X renamed the group") appear in the chat
// like WhatsApp's centered grey notices.
const postSystemMessage = async (conversationId, actorId, body) => {
  // eslint-disable-next-line no-use-before-define
  const message = await createSystemMessage(conversationId, actorId, body, MESSAGE_TYPE.SYSTEM);
  emitToRoom(`conversation:${conversationId}`, "message:new", message);
  return message;
};

// ---- Conversations ------------------------------------------------------

const createConversationService = async (userId, data) => {
  if (data.type === CONVERSATION_TYPE.DIRECT) {
    const otherUserId = data.participantIds[0];
    if (otherUserId === userId) {
      throw new ApiError(400, "Cannot start a direct conversation with yourself");
    }

    const existing = await repo.findDirectConversationBetween(userId, otherUserId);
    if (existing) return getConversationService(existing.id, userId);
  }

  const created = await repo.createConversation({ ...data, createdById: userId });

  if (data.type === CONVERSATION_TYPE.GROUP) {
    const userMap = await hydrateUsers([userId]);
    await postSystemMessage(created.id, userId, `${nameOf(userMap, userId)} created group "${data.name}"`);
    // Members should see a new group immediately. A DIRECT chat is
    // deliberately NOT pushed to the other person until the first
    // message is sent (the client refetches when it sees a message for
    // a conversation it doesn't know yet) — same as WhatsApp.
    await notifyConversationChanged(created.id);
  }

  return getConversationService(created.id, userId);
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
  const conversation = await repo.findConversationById(conversationId);

  if (conversation.type !== CONVERSATION_TYPE.GROUP) {
    throw new ApiError(400, "Only group conversations can be edited");
  }
  assertGroupAdmin(participant);

  const changes = {};
  if (data.name !== undefined) changes.name = data.name.trim();
  if (data.avatarUrl !== undefined) changes.avatarUrl = data.avatarUrl;

  if (Object.keys(changes).length > 0) {
    await repo.updateConversation(conversationId, changes);
  }

  if (changes.name && changes.name !== conversation.name) {
    const userMap = await hydrateUsers([userId]);
    await postSystemMessage(
      conversationId,
      userId,
      `${nameOf(userMap, userId)} changed the group name to "${changes.name}"`
    );
  }

  await notifyConversationChanged(conversationId);
  return getConversationService(conversationId, userId);
};

const addParticipantsService = async (conversationId, userId, participantIds) => {
  const participant = await assertParticipant(conversationId, userId);
  const conversation = await repo.findConversationById(conversationId);

  if (conversation.type !== CONVERSATION_TYPE.GROUP) {
    throw new ApiError(400, "Cannot add participants to a direct conversation");
  }
  assertGroupAdmin(participant);

  // Ignore people already in the group, and ids that aren't real users.
  const alreadyIn = new Set(conversation.participants.map((p) => p.userId));
  const candidateIds = [...new Set(participantIds)].filter((id) => !alreadyIn.has(id));
  const userMap = await hydrateUsers([userId, ...candidateIds]);
  const newIds = candidateIds.filter((id) => userMap[id]);

  if (newIds.length === 0) {
    return getConversationService(conversationId, userId);
  }

  await repo.addParticipants(conversationId, newIds);

  const addedNames = newIds.map((id) => nameOf(userMap, id)).join(", ");
  await postSystemMessage(conversationId, userId, `${nameOf(userMap, userId)} added ${addedNames}`);

  for (const addedId of newIds) {
    await sendNotification({
      userId: addedId,
      title: "Added to group",
      message: `You were added to "${conversation.name}"`,
      type: "CHAT_GROUP_ADDED",
      link: "/chat",
    });
  }

  await notifyConversationChanged(conversationId);
  return getConversationService(conversationId, userId);
};

const removeParticipantService = async (conversationId, userId, targetUserId) => {
  const participant = await assertParticipant(conversationId, userId);
  const conversation = await repo.findConversationById(conversationId);

  if (conversation.type !== CONVERSATION_TYPE.GROUP) {
    throw new ApiError(400, "You can only remove people from a group");
  }

  const targetId = Number(targetUserId);
  const isSelf = targetId === Number(userId);

  // Members can remove themselves ("exit group"); removing someone
  // else requires admin/owner, and nobody can remove the owner.
  if (!isSelf) {
    assertGroupAdmin(participant);

    const target = await repo.findParticipant(conversationId, targetId);
    if (!target || target.leftAt) throw new ApiError(404, "That person is not in this group");
    if (target.role === PARTICIPANT_ROLE.OWNER) {
      throw new ApiError(403, "The group owner cannot be removed");
    }
  }

  await repo.removeParticipant(conversationId, targetId);
  removeUserFromRoom(targetId, `conversation:${conversationId}`);

  // If the owner leaves, hand ownership to the longest-standing member
  // so the group can still be managed.
  if (isSelf && participant.role === PARTICIPANT_ROLE.OWNER) {
    const successor = conversation.participants
      .filter((p) => p.userId !== targetId)
      .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))[0];
    if (successor) {
      await repo.updateParticipantRole(conversationId, successor.userId, PARTICIPANT_ROLE.OWNER);
    }
  }

  const userMap = await hydrateUsers([userId, targetId]);
  await postSystemMessage(
    conversationId,
    userId,
    isSelf
      ? `${nameOf(userMap, userId)} left`
      : `${nameOf(userMap, userId)} removed ${nameOf(userMap, targetId)}`
  );

  await notifyConversationChanged(conversationId, [targetId]);
  return { conversationId };
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
      link: "/chat",
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

// Used for group notices (type SYSTEM) and by call.service.js to drop a
// CALL_LOG entry into the conversation when a call ends.
const createSystemMessage = async (conversationId, senderId, body, type = MESSAGE_TYPE.CALL_LOG) => {
  const message = await repo.createMessage({
    conversationId,
    senderId,
    type,
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
 * Org-wide directory of people the current user can start a chat with.
 * Chat is intentionally NOT restricted to direct reports/managers
 * (unlike task/goal assignment) - it works like WhatsApp.
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