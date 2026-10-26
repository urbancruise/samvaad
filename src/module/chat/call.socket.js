const callService = require("./call.service");
const { initiateCallSchema } = require("./chat.validation");

// callId -> timeout handle for the "nobody answered" timer
const ringTimers = new Map();

const clearRingTimer = (callId) => {
  const timer = ringTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    ringTimers.delete(callId);
  }
};

/**
 * Tells every person on the call (caller, invitees, anyone still
 * ringing) that it is over — goes to their personal `user:{id}` room,
 * so a still-ringing incoming-call popup closes too — and pushes the
 * "Video call · 5m 32s" / "Missed call" line into the chat live.
 */
const broadcastEnded = (io, result) => {
  clearRingTimer(result.callId);

  result.participantIds.forEach((id) => {
    io.to(`user:${id}`).emit("call:ended", { callId: result.callId, status: result.status });
  });

  if (result.message) {
    io.to(`conversation:${result.conversationId}`).emit("message:new", result.message);
    result.participantIds.forEach((id) => {
      io.to(`user:${id}`).emit("conversation:updated", {
        conversationId: result.conversationId,
        lastMessage: result.message,
      });
    });
  }
};

/**
 * P2P mesh signaling convention: when a new participant accepts a call,
 * EXISTING participants are the ones who initiate the WebRTC offer to
 * them (not the other way around) — this avoids both sides racing to
 * send an offer at once ("glare"). The joiner just waits for offers
 * from everyone already in the call and answers each.
 */
const registerCallHandlers = (io, socket) => {
  const userId = socket.user.id;

  socket.on("call:initiate", async (payload, ack) => {
    try {
      const { conversationId, type } = initiateCallSchema.parse(payload);
      const call = await callService.initiateCallService(conversationId, userId, type);

      socket.join(`call:${call.id}`);
      socket.data.activeCallId = call.id;

      call.participants.forEach((p) => {
        if (p.id === userId) return;
        io.to(`user:${p.id}`).emit("call:incoming", {
          callId: call.id,
          conversationId,
          conversationName: call.conversationName,
          isGroup: call.isGroup,
          type,
          caller: call.startedBy,
        });
      });

      // Nobody picked up in time -> missed call. Without this a call to
      // an offline person rang forever and blocked every later call.
      ringTimers.set(
        call.id,
        setTimeout(async () => {
          ringTimers.delete(call.id);
          try {
            const result = await callService.missUnansweredCallService(call.id);
            if (result) broadcastEnded(io, result);
          } catch (err) {
            console.error(`Error ending unanswered call ${call.id}:`, err.message);
          }
        }, callService.RING_TIMEOUT_MS)
      );

      ack?.({ ok: true, call });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("call:accept", async ({ callId }, ack) => {
    try {
      const { existingParticipants } = await callService.acceptCallService(callId, userId);
      clearRingTimer(callId);
      socket.join(`call:${callId}`);
      socket.data.activeCallId = callId;

      ack?.({ ok: true, existingParticipants });

      // Existing participants each initiate an offer to this new joiner.
      socket.to(`call:${callId}`).emit("call:user-joined", { callId, userId });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("call:decline", async ({ callId }, ack) => {
    try {
      const result = await callService.declineCallService(callId, userId);
      io.to(`call:${callId}`).emit("call:user-declined", { callId, userId });
      if (result.ended) broadcastEnded(io, result);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("call:leave", async ({ callId }, ack) => {
    try {
      const result = await callService.leaveCallService(callId, userId);

      socket.to(`call:${callId}`).emit("call:user-left", { callId, userId });
      socket.leave(`call:${callId}`);
      socket.data.activeCallId = null;

      if (result.ended) broadcastEnded(io, result);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ---- WebRTC signaling relay (pairwise) ----
  // The server never touches media — it only relays SDP/ICE between the
  // two browsers named in the payload, and only for a call the sender is
  // actually in.
  const relay = (event) => (payload) => {
    const { callId, toUserId, ...rest } = payload || {};
    if (!callId || !toUserId || socket.data.activeCallId !== callId) return;
    io.to(`user:${toUserId}`).emit(event, { callId, fromUserId: userId, ...rest });
  };

  socket.on("webrtc:offer", relay("webrtc:offer"));
  socket.on("webrtc:answer", relay("webrtc:answer"));
  socket.on("webrtc:ice-candidate", relay("webrtc:ice-candidate"));
};

/**
 * Best-effort cleanup for a socket that disconnects mid-call (closed
 * tab, dead network, lid closed) without ever emitting call:leave.
 * Called from socket/index.js's disconnect handler.
 */
const handleCallDisconnect = async (io, socket) => {
  const callId = socket.data?.activeCallId;
  if (!callId) return;

  try {
    const result = await callService.leaveCallService(callId, socket.user.id);
    io.to(`call:${callId}`).emit("call:user-left", { callId, userId: socket.user.id });
    if (result.ended) broadcastEnded(io, result);
  } catch (err) {
    // Call may already be ended/cleaned up — safe to ignore.
    console.error(`Error in handleCallDisconnect for call ${callId}:`, err.message);
  }
};

module.exports = registerCallHandlers;
module.exports.handleCallDisconnect = handleCallDisconnect;