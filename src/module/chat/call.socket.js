const callService = require("./call.service");
const { initiateCallSchema } = require("./chat.validation");

/**
 * P2P mesh signaling convention: when a new participant accepts a call,
 * EXISTING participants are the ones who initiate the WebRTC offer to
 * them (not the other way around) — this avoids both sides racing to
 * send an offer at once ("glare"). The joiner just waits for offers
 * from everyone in `existingParticipants` and answers each.
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
          type,
          caller: call.startedBy,
        });
      });

      ack?.({ ok: true, call });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("call:accept", async ({ callId }, ack) => {
    try {
      const { existingParticipants } = await callService.acceptCallService(callId, userId);
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
      await callService.declineCallService(callId, userId);
      io.to(`call:${callId}`).emit("call:user-declined", { callId, userId });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("call:leave", async ({ callId }, ack) => {
    try {
      const { ended } = await callService.leaveCallService(callId, userId);
      socket.to(`call:${callId}`).emit("call:user-left", { callId, userId, ended });
      socket.leave(`call:${callId}`);
      socket.data.activeCallId = null;

      if (ended) {
        io.to(`call:${callId}`).emit("call:ended", { callId });
      }
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ---- WebRTC signaling relay (pairwise) ----
  // Server never touches media — just relays SDP/ICE between the two
  // browsers named in the payload. `toUserId` targets their personal
  // `user:{id}` room so it reaches them on whichever tab/device they
  // accepted the call from.

  socket.on("webrtc:offer", ({ callId, toUserId, sdp }) => {
    io.to(`user:${toUserId}`).emit("webrtc:offer", { callId, fromUserId: userId, sdp });
  });

  socket.on("webrtc:answer", ({ callId, toUserId, sdp }) => {
    io.to(`user:${toUserId}`).emit("webrtc:answer", { callId, fromUserId: userId, sdp });
  });

  socket.on("webrtc:ice-candidate", ({ callId, toUserId, candidate }) => {
    io.to(`user:${toUserId}`).emit("webrtc:ice-candidate", { callId, fromUserId: userId, candidate });
  });
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
    const { ended } = await callService.leaveCallService(callId, socket.user.id);
    io.to(`call:${callId}`).emit("call:user-left", { callId, userId: socket.user.id, ended });
    if (ended) {
      io.to(`call:${callId}`).emit("call:ended", { callId });
    }
  } catch (err) {
    // Call may already be ended/cleaned up — safe to ignore.
    console.error(`Error in handleCallDisconnect for call ${callId}:`, err.message);
  }
};

module.exports = registerCallHandlers;
module.exports.handleCallDisconnect = handleCallDisconnect;