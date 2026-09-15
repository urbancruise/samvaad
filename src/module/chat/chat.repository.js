const { postgresDb } = require("../../config/db");
const { CONVERSATION_TYPE } = require("./chat.constants");

/**
 * Creates a conversation and its participant rows in one transaction.
 * For DIRECT conversations, `role` is irrelevant (both MEMBER); for
 * GROUP, the creator is OWNER.
 */
const createConversation = async ({ type, name, avatarUrl, createdById, participantIds }) => {
  const allParticipantIds = [...new Set([createdById, ...participantIds])];

  return postgresDb.conversation.create({
    data: {
      type,
      name: type === CONVERSATION_TYPE.GROUP ? name : null,
      avatarUrl,
      createdById,
      participants: {
        create: allParticipantIds.map((userId) => ({
          userId,
          role:
            type === CONVERSATION_TYPE.GROUP && userId === createdById
              ? "OWNER"
              : "MEMBER",
        })),
      },
    },
    include: { participants: true },
  });
};

/**
 * Finds an existing DIRECT conversation between exactly these two users,
 * if one already exists — used to avoid duplicate 1:1 threads.
 */
const findDirectConversationBetween = async (userIdA, userIdB) => {
  const candidates = await postgresDb.conversation.findMany({
    where: {
      type: CONVERSATION_TYPE.DIRECT,
      participants: {
        some: { userId: userIdA },
      },
    },
    include: { participants: true },
  });

  return (
    candidates.find(
      (c) =>
        c.participants.length === 2 &&
        c.participants.some((p) => p.userId === userIdB)
    ) || null
  );
};

const findConversationById = async (conversationId) => {
  return postgresDb.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { where: { leftAt: null } },
    },
  });
};

const findParticipant = async (conversationId, userId) => {
  return postgresDb.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
};

/**
 * All conversations a user is (still) part of, most recently active
 * first, each with its single most recent message for preview.
 */
const findUserConversations = async (userId) => {
  return postgresDb.conversation.findMany({
    where: {
      participants: { some: { userId, leftAt: null } },
    },
    include: {
      participants: { where: { leftAt: null } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });
};

const updateConversation = async (conversationId, data) => {
  return postgresDb.conversation.update({
    where: { id: conversationId },
    data,
  });
};

const addParticipants = async (conversationId, userIds) => {
  return postgresDb.conversationParticipant.createMany({
    data: userIds.map((userId) => ({ conversationId, userId, role: "MEMBER" })),
    skipDuplicates: true,
  });
};

const removeParticipant = async (conversationId, userId) => {
  return postgresDb.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { leftAt: new Date() },
  });
};

const touchConversation = async (conversationId, when = new Date()) => {
  return postgresDb.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: when },
  });
};

const createMessage = async ({ conversationId, senderId, type, body, replyToId, mentions, attachments }) => {
  return postgresDb.message.create({
    data: {
      conversationId,
      senderId,
      type,
      body,
      replyToId,
      mentions,
      attachments: attachments?.length
        ? { create: attachments }
        : undefined,
    },
    include: {
      attachments: true,
      replyTo: { include: { attachments: true } },
      reactions: true,
    },
  });
};

/**
 * Cursor-paginated message history, newest-first page, oldest-first
 * once reversed for display. `before` is a message id to page backward
 * from (older messages).
 */
const findMessages = async (conversationId, { before, limit }) => {
  const cursorClause = before ? { cursor: { id: before }, skip: 1 } : {};

  return postgresDb.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...cursorClause,
    include: {
      attachments: true,
      replyTo: { include: { attachments: true } },
      reactions: true,
    },
  });
};

const findMessageById = async (messageId) => {
  return postgresDb.message.findUnique({
    where: { id: messageId },
    include: { attachments: true, reactions: true },
  });
};

const editMessage = async (messageId, body) => {
  return postgresDb.message.update({
    where: { id: messageId },
    data: { body, isEdited: true, editedAt: new Date() },
  });
};

const softDeleteMessage = async (messageId) => {
  return postgresDb.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), body: null },
  });
};

const markRead = async (conversationId, userId, messageId) => {
  return postgresDb.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadMessageId: messageId, lastReadAt: new Date() },
  });
};

/**
 * Unread count for one participant — messages sent by others, after
 * this participant's last read point (or all of them, if never read).
 */
const countUnread = async (conversationId, userId, lastReadAt) => {
  return postgresDb.message.count({
    where: {
      conversationId,
      senderId: { not: userId },
      deletedAt: null,
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
};

const toggleReaction = async (messageId, userId, emoji) => {
  const existing = await postgresDb.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  });

  if (existing) {
    await postgresDb.messageReaction.delete({ where: { id: existing.id } });
    return { added: false };
  }

  const reaction = await postgresDb.messageReaction.create({
    data: { messageId, userId, emoji },
  });
  return { added: true, reaction };
};

const searchMessages = async (userId, query, limit) => {
  return postgresDb.message.findMany({
    where: {
      deletedAt: null,
      body: { contains: query, mode: "insensitive" },
      conversation: {
        participants: { some: { userId, leftAt: null } },
      },
    },
    include: {
      conversation: { select: { id: true, type: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

module.exports = {
  createConversation,
  findDirectConversationBetween,
  findConversationById,
  findParticipant,
  findUserConversations,
  updateConversation,
  addParticipants,
  removeParticipant,
  touchConversation,
  createMessage,
  findMessages,
  findMessageById,
  editMessage,
  softDeleteMessage,
  markRead,
  countUnread,
  toggleReaction,
  searchMessages,
};