const ApiError = require("../../utils/ApiError");
const { CALL_STATUS, CALL_PARTICIPANT_STATUS, MAX_CALL_PARTICIPANTS } = require("./chat.constants");

const callRepo = require("./call.repository");
const chatRepo = require("./chat.repository");
const chatService = require("./chat.service");

const formatDuration = (ms) => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

/**
 * Starts a call for every current participant of the conversation
 * (minus the caller). Throws if the conversation already has an
 * active call — join that one instead (see joinCallService).
 */
const initiateCallService = async (conversationId, callerId, type) => {
  const conversation = await chatService.assertParticipant(conversationId, callerId)
    .then(() => chatRepo.findConversationById(conversationId));

  if (!conversation) throw new ApiError(404, "Conversation not found");

  const existing = await callRepo.findActiveCallForConversation(conversationId);
  if (existing) {
    // NOTE: if ApiError supports a 3rd "extra data" argument in your
    // codebase, pass { callId: existing.id } here so the frontend can
    // offer "join the existing call" instead of just an error toast —
    // adjust once you confirm ApiError's signature.
    throw new ApiError(409, `This conversation already has an active call (${existing.id})`);
  }

  const invitedUserIds = conversation.participants
    .map((p) => p.userId)
    .filter((id) => id !== callerId);

  if (invitedUserIds.length + 1 > MAX_CALL_PARTICIPANTS) {
    throw new ApiError(
      400,
      `Group calls are limited to ${MAX_CALL_PARTICIPANTS} participants (P2P mesh limit).`
    );
  }

  const call = await callRepo.createCall({ conversationId, type, startedById: callerId, invitedUserIds });
  const userMap = await chatService.hydrateUsers([callerId, ...invitedUserIds]);

  return {
    id: call.id,
    conversationId,
    type: call.type,
    status: call.status,
    startedBy: userMap[callerId],
    participants: call.participants.map((p) => ({ ...userMap[p.userId], status: p.status })),
    startedAt: call.startedAt,
  };
};

const assertCallParticipant = async (callId, userId) => {
  const call = await callRepo.findCallById(callId);
  if (!call) throw new ApiError(404, "Call not found");

  const participant = call.participants.find((p) => p.userId === userId);
  if (!participant) throw new ApiError(403, "You were not invited to this call");

  return { call, participant };
};

const acceptCallService = async (callId, userId) => {
  const { call } = await assertCallParticipant(callId, userId);

  await callRepo.updateParticipantStatus(callId, userId, CALL_PARTICIPANT_STATUS.JOINED, {
    joinedAt: new Date(),
  });

  if (call.status === CALL_STATUS.RINGING) {
    await callRepo.updateCallStatus(callId, CALL_STATUS.ONGOING);
  }

  // Everyone already in the call before this join — the frontend uses
  // this list to know who it should originate a WebRTC offer to.
  const alreadyJoined = call.participants.filter(
    (p) => p.status === CALL_PARTICIPANT_STATUS.JOINED && p.userId !== userId
  );
  const userMap = await chatService.hydrateUsers(alreadyJoined.map((p) => p.userId));

  return {
    callId,
    conversationId: call.conversationId,
    existingParticipants: alreadyJoined.map((p) => userMap[p.userId]),
  };
};

const declineCallService = async (callId, userId) => {
  await assertCallParticipant(callId, userId);
  await callRepo.updateParticipantStatus(callId, userId, CALL_PARTICIPANT_STATUS.DECLINED);

  const call = await callRepo.findCallById(callId);
  const stillPending = call.participants.some((p) =>
    [CALL_PARTICIPANT_STATUS.INVITED, CALL_PARTICIPANT_STATUS.RINGING].includes(p.status)
  );
  const stillJoined = call.participants.some((p) => p.status === CALL_PARTICIPANT_STATUS.JOINED);

  if (!stillPending && !stillJoined) {
    await endCallInternal(call, CALL_STATUS.DECLINED);
  }

  return { callId, conversationId: call.conversationId };
};

/**
 * A participant leaving. If they were the last one in the room, the
 * call is ended and a CALL_LOG message is posted to the chat.
 */
const leaveCallService = async (callId, userId) => {
  const { call } = await assertCallParticipant(callId, userId);

  await callRepo.updateParticipantStatus(callId, userId, CALL_PARTICIPANT_STATUS.LEFT, {
    leftAt: new Date(),
  });

  const refreshed = await callRepo.findCallById(callId);
  const stillJoined = refreshed.participants.some((p) => p.status === CALL_PARTICIPANT_STATUS.JOINED);

  let ended = false;
  if (!stillJoined) {
    await endCallInternal(refreshed, CALL_STATUS.ENDED);
    ended = true;
  }

  return { callId, conversationId: call.conversationId, ended };
};

const endCallInternal = async (call, finalStatus) => {
  await callRepo.markRemainingParticipantsMissed(call.id);
  await callRepo.closeAnyOpenJoins(call.id);
  await callRepo.updateCallStatus(call.id, finalStatus, { endedAt: new Date() });

  const joinedCount = call.participants.filter((p) => p.status === CALL_PARTICIPANT_STATUS.JOINED).length;
  const durationMs = new Date() - new Date(call.startedAt);

  let logBody;
  if (finalStatus === CALL_STATUS.DECLINED || joinedCount <= 1) {
    logBody = `Missed ${call.type.toLowerCase()} call`;
  } else {
    logBody = `${call.type === "VIDEO" ? "Video" : "Audio"} call · ${formatDuration(durationMs)}`;
  }

  return chatService.createSystemMessage(call.conversationId, call.startedById, logBody);
};

const getCallHistoryService = async (userId, { page = 1, limit = 30 } = {}) => {
  const calls = await callRepo.findCallHistory(userId, { page, limit });
  const allUserIds = calls.flatMap((c) => c.participants.map((p) => p.userId));
  const userMap = await chatService.hydrateUsers(allUserIds);

  return calls.map((c) => ({
    id: c.id,
    conversationId: c.conversationId,
    conversationName: c.conversation.name,
    type: c.type,
    status: c.status,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    participants: c.participants.map((p) => ({ ...userMap[p.userId], status: p.status })),
  }));
};

module.exports = {
  initiateCallService,
  assertCallParticipant,
  acceptCallService,
  declineCallService,
  leaveCallService,
  getCallHistoryService,
};