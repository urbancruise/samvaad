const { postgresDb } = require("../../config/db");
const { CALL_STATUS, CALL_PARTICIPANT_STATUS } = require("./chat.constants");

const createCall = async ({ conversationId, type, startedById, invitedUserIds }) => {
  return postgresDb.call.create({
    data: {
      conversationId,
      type,
      startedById,
      status: CALL_STATUS.RINGING,
      participants: {
        create: [
          { userId: startedById, status: CALL_PARTICIPANT_STATUS.JOINED, joinedAt: new Date() },
          ...invitedUserIds.map((userId) => ({ userId, status: CALL_PARTICIPANT_STATUS.INVITED })),
        ],
      },
    },
    include: { participants: true },
  });
};

const findCallById = async (callId) => {
  return postgresDb.call.findUnique({
    where: { id: callId },
    include: { participants: true },
  });
};

const findActiveCallForConversation = async (conversationId) => {
  return postgresDb.call.findFirst({
    where: {
      conversationId,
      status: { in: [CALL_STATUS.RINGING, CALL_STATUS.ONGOING] },
    },
    include: { participants: true },
  });
};

/**
 * Calls stuck in RINGING/ONGOING with no corresponding `call:leave` or
 * disconnect ever recorded — crashed tab, force-quit, or a disconnect
 * event that never reached the server. Used by the periodic sweep
 * (call.cleanup.js) to force-end them so the conversation isn't
 * permanently blocked from starting a new call.
 */
const findStaleActiveCalls = async (maxAgeMs) => {
  const cutoff = new Date(Date.now() - maxAgeMs);
  return postgresDb.call.findMany({
    where: {
      status: { in: [CALL_STATUS.RINGING, CALL_STATUS.ONGOING] },
      startedAt: { lt: cutoff },
    },
    include: { participants: true },
  });
};

const updateCallStatus = async (callId, status, extra = {}) => {
  return postgresDb.call.update({
    where: { id: callId },
    data: { status, ...extra },
  });
};

const updateParticipantStatus = async (callId, userId, status, extra = {}) => {
  return postgresDb.callParticipant.update({
    where: { callId_userId: { callId, userId } },
    data: { status, ...extra },
  });
};

const markRemainingParticipantsMissed = async (callId) => {
  return postgresDb.callParticipant.updateMany({
    where: {
      callId,
      status: { in: [CALL_PARTICIPANT_STATUS.INVITED, CALL_PARTICIPANT_STATUS.RINGING] },
    },
    data: { status: CALL_PARTICIPANT_STATUS.MISSED },
  });
};

const closeAnyOpenJoins = async (callId) => {
  return postgresDb.callParticipant.updateMany({
    where: { callId, status: CALL_PARTICIPANT_STATUS.JOINED, leftAt: null },
    data: { leftAt: new Date() },
  });
};

const findCallHistory = async (userId, { page, limit }) => {
  return postgresDb.call.findMany({
    where: { participants: { some: { userId } } },
    include: { participants: true, conversation: { select: { id: true, type: true, name: true } } },
    orderBy: { startedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
};

module.exports = {
  createCall,
  findCallById,
  findActiveCallForConversation,
  findStaleActiveCalls,
  updateCallStatus,
  updateParticipantStatus,
  markRemainingParticipantsMissed,
  closeAnyOpenJoins,
  findCallHistory,
};