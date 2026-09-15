const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const registerChatHandlers = require("../module/chat/chat.socket");
const registerCallHandlers = require("../module/chat/call.socket");
const { handleCallDisconnect } = require("../module/chat/call.socket");
const { initEmailSocket } = require("../module/email/Email.socket");

// userId -> Set<socketId> — supports multiple tabs/devices per user
// without flip-flopping presence on every tab close.
const onlineUsers = new Map();

// Same origin list Email.socket.js and app.js's CORS config used —
// kept in one place now instead of duplicated across files.
const CORS_ORIGINS = ["http://localhost:3000", "https://sambaad-frontend.vercel.app"];

const parseCookie = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
};

/**
 * Same JWT verification used by both auth.middleware.js and the old
 * Email.socket.js, now registered exactly once for the whole app
 * instead of per-module.
 */
const socketAuth = (socket, next) => {
  try {
    const tokenFromAuth = socket.handshake.auth?.token;
    const tokenFromCookie = parseCookie(socket.handshake.headers?.cookie, "accessToken");
    const token = tokenFromAuth || tokenFromCookie;

    if (!token) return next(new Error("Unauthorized"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    socket.userId = decoded.id; // kept for backward compat — old Email.socket.js referenced socket.userId
    next();
  } catch (err) {
    next(new Error("Unauthorized"));
  }
};

/**
 * Creates the ONE Socket.io server for the whole app and wires every
 * module's handlers onto it. Call this once from server.js:
 *
 *   const { createSocketServer } = require("./socket");
 *   createSocketServer(httpServer);
 */
const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: CORS_ORIGINS, credentials: true },
  });

  io.use(socketAuth);

  io.on("connection", (socket) => {
    const userId = socket.user.id;

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    socket.join(`user:${userId}`);

    if (onlineUsers.get(userId).size === 1) {
      // NOTE: broadcasts to everyone. If this ever needs to scale,
      // scope it to only the conversations each viewer shares with
      // `userId` instead of a global emit.
      io.emit("presence:update", { userId, online: true });
    }

    registerChatHandlers(io, socket);
    registerCallHandlers(io, socket);

    socket.on("disconnect", async () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit("presence:update", { userId, online: false });
        }
      }

      await handleCallDisconnect(io, socket);
    });
  });

  // Email module no longer creates its own Server — it just registers
  // its emitter + scheduled-send dispatcher against this shared io.
  initEmailSocket(io);

  return io;
};

module.exports = { createSocketServer, onlineUsers };