const ApiError = require("../../utils/ApiError");
const { CALL_STATUS, CALL_PARTICIPANT_STATUS, MAX_CALL_PARTICIPANTS } = require("./chat.constants");

const callRepo = require("./call.repository");
const chatRepo = require("./chat.repository");
const chatService = require("./chat.service");

// How long an unanswered call rings before it becomes a missed call.
const RING_TIMEOUT_MS = 45 * 1000;
// A call still "ringing" this long after it started is a leftover
// (e.g. server restarted mid-ring) and must not block new calls.
const STALE_RINGING_MS = RING_TIMEOUT_MS + 15 * 1000;

const PENDING_STATUSES = [CALL_PARTICIPANT_STATUS.INVITED, CALL_PARTICIPANT_STATUS.RINGING];
const ACTIVE_STATUSES = [CALL_STATUS.RINGING, CALL_STATUS.ONGOING];

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

// The moment someone OTHER than the caller first joined — i.e. when
// the call was actually answered. null = nobody ever picked up.
const answeredAt = (call) => {
  const times = call.participants
    .filter((p) => p.userId !== call.startedById && p.joinedAt)
    .map((p) => new Date(p.joinedAt).getTime());
  return times.length ? Math.min(...times) : null;
};

const countJoined = (call) =>
  call.participants.filter((p) => p.status === CALL_PARTICIPANT_STATUS.JOINED).length;

const hasPending = (call) => call.participants.some((p) => PENDING_STATUSES.includes(p.status));

/**
 * Finishes a call: closes every open participant row, sets the final
 * status and posts the WhatsApp-style log line ("Video call · 5m 32s",
 * "Missed voice call", "Declined video call") into the conversation.
 */
const endCallInternal = async (call, requestedStatus) => {
  const answered = answeredAt(call);

  await callRepo.markRemainingParticipantsMissed(call.id);
  await callRepo.closeAnyOpenJoins(call.id);

  const finalStatus = answered
    ? CALL_STATUS.ENDED
    : requestedStatus === CALL_STATUS.DECLINED
    ? CALL_STATUS.DECLINED
    : CALL_STATUS.MISSED;

  await callRepo.updateCallStatus(call.id, finalStatus, { endedAt: new Date() });

  const kind = call.type === "VIDEO" ? "video" : "voice";
  let body;
  if (answered) {
    body = `${call.type === "VIDEO" ? "Video" : "Voice"} call · ${formatDuration(Date.now() - answered)}`;
  } else if (finalStatus === CALL_STATUS.DECLINED) {
    body = `Declined ${kind} call`;
  } else {
    body = `Missed ${kind} call`;
  }

  const message = await chatService.createSystemMessage(call.conversationId, call.startedById, body);
  return { message, status: finalStatus };
};

const endedResult = (call, { message, status }) => ({
  callId: call.id,
  conversationId: call.conversationId,
  ended: true,
  status,
  message,
  participantIds: call.participants.map((p) => p.userId),
});

/**
 * Starts a call for every current participant of the conversation
 * (minus the caller). Throws if the conversation already has a live
 * call — join that one instead.
 */
const initiateCallService = async (conversationId, callerId, type) => {
  await chatService.assertParticipant(conversationId, callerId);
  const conversation = await chatRepo.findConversationById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const existing = await callRepo.findActiveCallForConversation(conversationId);
  if (existing) {
    const age = Date.now() - new Date(existing.startedAt).getTime();
    const stale =
      countJoined(existing) === 0 ||
      (existing.status === CALL_STATUS.RINGING && age > STALE_RINGING_MS);

    if (!stale) {
      throw new ApiError(409, "There is already an active call in this chat");
    }
    // Leftover from a crash/restart — close it so it can't block calls forever.
    await endCallInternal(existing, CALL_STATUS.MISSED);
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
    conversationName: conversation.name,
    isGroup: conversation.type === "GROUP",
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

  if (!ACTIVE_STATUSES.includes(call.status)) {
    throw new ApiError(410, "This call has already ended");
  }

  await callRepo.updateParticipantStatus(callId, userId, CALL_PARTICIPANT_STATUS.JOINED, {
    joinedAt: new Date(),
  });

  if (call.status === CALL_STATUS.RINGING) {
    await callRepo.updateCallStatus(callId, CALL_STATUS.ONGOING);
  }

  // Everyone already in the call before this join — they are the ones
  // who send a WebRTC offer to the newcomer.
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
  const { call } = await assertCallParticipant(callId, userId);
  const base = { callId, conversationId: call.conversationId, ended: false, message: null, participantIds: [] };

  if (!ACTIVE_STATUSES.includes(call.status)) return base;

  await callRepo.updateParticipantStatus(callId, userId, CALL_PARTICIPANT_STATUS.DECLINED);

  const fresh = await callRepo.findCallById(callId);

  // Nobody left to answer and at most the caller is in the room: the
  // call is over (this was the bug where a declined 1:1 call left the
  // caller staring at an empty screen forever).
  if (!hasPending(fresh) && countJoined(fresh) <= 1) {
    return endedResult(fresh, await endCallInternal(fresh, CALL_STATUS.DECLINED));
  }

  return base;
};

/**
 * A participant leaving. The call ends when nobody is left in it, or
 * when only one person remains and nobody else is still ringing —
 * a call with yourself alone in it is pointless.
 */
const leaveCallService = async (callId, userId) => {
  const { call } = await assertCallParticipant(callId, userId);
  const base = { callId, conversationId: call.conversationId, ended: false, message: null, participantIds: [] };

  if (!ACTIVE_STATUSES.includes(call.status)) return base;

  await callRepo.updateParticipantStatus(callId, userId, CALL_PARTICIPANT_STATUS.LEFT, {
    leftAt: new Date(),
  });

  const fresh = await callRepo.findCallById(callId);
  const joined = countJoined(fresh);

  if (joined === 0 || (joined === 1 && !hasPending(fresh))) {
    return endedResult(fresh, await endCallInternal(fresh, CALL_STATUS.ENDED));
  }

  return base;
};

/**
 * Called by a timer ~45s after a call starts. If nobody has picked up
 * by then, the call becomes a missed call (and stops blocking new calls).
 * Returns null when the call was already answered/ended.
 */
const missUnansweredCallService = async (callId) => {
  const call = await callRepo.findCallById(callId);
  if (!call || call.status !== CALL_STATUS.RINGING) return null;

  return endedResult(call, await endCallInternal(call, CALL_STATUS.MISSED));
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
  RING_TIMEOUT_MS,
  initiateCallService,
  assertCallParticipant,
  acceptCallService,
  declineCallService,
  leaveCallService,
  missUnansweredCallService,
  getCallHistoryService,
};