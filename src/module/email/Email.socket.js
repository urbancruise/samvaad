const { setEmitter, dispatchDueScheduledEmails } = require("./Email.service");

/**
 * REFACTORED: this used to create its own `new Server(httpServer)`,
 * which conflicted with the chat module also needing a Socket.io
 * instance on the same httpServer. Auth (JWT) and room-joining
 * (`user:{id}`) are now handled once, centrally, in src/socket/index.js
 * — this function just wires the email module's realtime emitter and
 * starts the scheduled-send dispatcher against that shared `io`.
 *
 * Called from src/socket/index.js's createSocketServer(), not from
 * server.js directly anymore.
 */
const initEmailSocket = (io) => {
  setEmitter((userId, event, payload) => {
    io?.to(`user:${userId}`).emit(event, payload);
  });

  setInterval(() => {
    dispatchDueScheduledEmails().catch((err) =>
      console.error("Error dispatching scheduled emails:", err)
    );
  }, 30000);
};

module.exports = { initEmailSocket };