const { Server } = require("socket.io"); // npm install socket.io, if not already present
const jwt = require("jsonwebtoken");

const { setEmitter, dispatchDueScheduledEmails } = require("./email.service");

let io = null;

/**
 * Call this once from server.js, passing the raw http.Server instance
 * (not the Express app) — Socket.io needs to attach at that level.
 *
 *   const http = require("http");
 *   const httpServer = http.createServer(app);
 *   require("./module/email/email.socket").initEmailSocket(httpServer);
 *   httpServer.listen(PORT, ...);   // instead of app.listen(...)
 */
const initEmailSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "https://sambaad-frontend.vercel.app"],
      credentials: true,
    },
  });

  // Auth handshake — same JWT your REST API already trusts, sent via
  // either an auth token in the handshake or the accessToken cookie.
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie
          ?.split("; ")
          .find((c) => c.startsWith("accessToken="))
          ?.split("=")[1];

      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Every user gets their own room — emitToUser below just targets
    // this room instead of tracking individual socket ids.
    socket.join(`user:${socket.userId}`);

    socket.on("disconnect", () => {
      // Nothing to clean up manually — rooms are per-connection.
    });
  });

  setEmitter((userId, event, payload) => {
    io?.to(`user:${userId}`).emit(event, payload);
  });


  setInterval(() => {
    dispatchDueScheduledEmails().catch((err) =>
      console.error("Error dispatching scheduled emails:", err)
    );
  }, 30000);

  return io;
};

module.exports = { initEmailSocket };