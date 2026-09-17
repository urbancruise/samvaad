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

const initiateCallService = async (conversationId, callerId, type) => {
  const conversation = await chatService.assertParticipant(conversationId, callerId)
    .then(() => chatRepo.findConversationById(conversationId));

  if (!conversation) throw new ApiError(404, "Conversation not found");

  const existing = await callRepo.findActiveCallForConversation(conversationId);

  if (existing) {
    const isExistingParticipant = existing.participants.some((p) => p.userId === callerId);

    /**
     * FIX: previously this always threw 409, even when the "active
     * call" was stuck because of a dropped connection / crashed tab
     * and the requester is one of its rightful participants. That
     * left conversations permanently unable to start a new call until
     * someone manually cleared the DB row — and the frontend had no
     * way to recover, it just errored silently (uncaught rejection).
     *
     * If the caller is already a participant of the stuck/active
     * call, treat this exactly like rejoining it (same mechanics as
     * acceptCallService) instead of failing.
     */
    if (isExistingParticipant) {
      await callRepo.updateParticipantStatus(existing.id, callerId, CALL_PARTICIPANT_STATUS.JOINED, {
        joinedAt: new Date(),
      });

      if (existing.status === CALL_STATUS.RINGING) {
        await callRepo.updateCallStatus(existing.id, CALL_STATUS.ONGOING);
      }

      const refreshed = await callRepo.findCallById(existing.id);
      const userMap = await chatService.hydrateUsers(refreshed.participants.map((p) => p.userId));

      return {
        id: refreshed.id,
        conversationId,
        type: refreshed.type,
        status: refreshed.status,
        startedBy: userMap[refreshed.startedById],
        participants: refreshed.participants.map((p) => ({ ...userMap[p.userId], status: p.status })),
        startedAt: refreshed.startedAt,
        rejoined: true, // lets the frontend know this wasn't a fresh call
      };
    }

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

  /**
   * FIX: this used to count participants whose CURRENT status is
   * JOINED — but by the time endCallInternal runs, everyone who was
   * on the call has already been transitioned to LEFT (that's what
   * triggers ending the call). That count is therefore always 0,
   * which meant EVERY completed call — no matter how long — was
   * logged as "Missed call" instead of showing its real duration.
   *
   * Use `joinedAt` instead: it's set once when a participant actually
   * joins and is never cleared when they later leave, so it reliably
   * answers "did this person actually connect at some point?" rather
   * than "are they currently connected?".
   *
   * NOTE: this assumes `joinedAt` persists after a participant leaves
   * (i.e. it's a separate historical field from `status`, matching
   * how `leftAt` is tracked alongside status elsewhere in this file).
   * If your schema clears `joinedAt` on leave, this needs a small
   * adjustment — worth a quick check against call.repository.js /
   * the Prisma schema for the CallParticipant model.
   */
  const everJoinedCount = call.participants.filter((p) => p.joinedAt).length;
  const durationMs = new Date() - new Date(call.startedAt);

  let logBody;
  if (finalStatus === CALL_STATUS.DECLINED || everJoinedCount <= 1) {
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

const sweepStaleCallsService = async (maxAgeMs = 4 * 60 * 60 * 1000) => {
  const staleCalls = await callRepo.findStaleActiveCalls(maxAgeMs);

  const results = [];
  for (const call of staleCalls) {
    try {
      await endCallInternal(call, CALL_STATUS.ENDED);
      results.push({ callId: call.id, conversationId: call.conversationId, ok: true });
    } catch (err) {
      // One bad row shouldn't block the rest of the sweep.
      console.error(`Failed to sweep stale call ${call.id}:`, err.message);
      results.push({ callId: call.id, ok: false, error: err.message });
    }
  }

  return results;
};

module.exports = {
  initiateCallService,
  assertCallParticipant,
  acceptCallService,
  declineCallService,
  leaveCallService,
  getCallHistoryService,
  sweepStaleCallsService
};