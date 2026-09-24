const callService = require("./call.service");
const { initiateCallSchema } = require("./chat.validation");

const DISCONNECT_GRACE_MS = 12000; // 12s to reconnect before we treat it as a real hangup

// key: `${callId}:${userId}` -> Timeout handle
const pendingDisconnectTimers = new Map();

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

  /**
   * NEW: fired by the client immediately after its socket reconnects
   * (see useCall.ts's "connect" listener) if it still thinks it's in
   * an active call. Cancels the pending disconnect timer below and
   * rejoins the signaling room on the new socket — the underlying
   * RTCPeerConnection carrying the actual audio/video was never
   * affected by the brief socket.io blip, so the call just keeps
   * going once signaling is reconnected.
   */
  socket.on("call:rejoin", ({ callId }, ack) => {
    const key = `${callId}:${userId}`;
    const timer = pendingDisconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      pendingDisconnectTimers.delete(key);
    }

    socket.join(`call:${callId}`);
    socket.data.activeCallId = callId;
    ack?.({ ok: true });
  });

  // ---- WebRTC signaling relay (pairwise) ----

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
 * FIX: previously ended the call THE INSTANT any socket disconnected,
 * including an ordinary websocket hiccup that had nothing to do with
 * the user actually leaving — this was ending live calls out from
 * under people mid-conversation. Now waits DISCONNECT_GRACE_MS to see
 * whether they reconnect and rejoin the call room (via "call:rejoin")
 * before actually treating it as a real hangup.
 */
const handleCallDisconnect = (io, socket) => {
  const callId = socket.data?.activeCallId;
  if (!callId) return;

  const userId = socket.user.id;
  const key = `${callId}:${userId}`;

  const timer = setTimeout(async () => {
    pendingDisconnectTimers.delete(key);

    // Did a (new) socket for this user rejoin the call room in the meantime?
    const room = io.sockets.adapter.rooms.get(`call:${callId}`);
    const stillPresent =
      room &&
      [...room].some((socketId) => io.sockets.sockets.get(socketId)?.user?.id === userId);

    if (stillPresent) return; // they reconnected in time — nothing to do

    try {
      const { ended } = await callService.leaveCallService(callId, userId);
      io.to(`call:${callId}`).emit("call:user-left", { callId, userId, ended });
      if (ended) {
        io.to(`call:${callId}`).emit("call:ended", { callId });
      }
    } catch (err) {
      console.error(`Error in handleCallDisconnect for call ${callId}:`, err.message);
    }
  }, DISCONNECT_GRACE_MS);

  pendingDisconnectTimers.set(key, timer);
};

module.exports = registerCallHandlers;
module.exports.handleCallDisconnect = handleCallDisconnect;