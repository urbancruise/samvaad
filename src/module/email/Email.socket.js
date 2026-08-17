const { Server } = require("socket.io"); // npm install socket.io, if not already present
const jwt = require("jsonwebtoken");

const { setEmitter, dispatchDueScheduledEmails } = require("./Email.service");

let io = null;

const initEmailSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "https://sambaad-frontend.vercel.app"],
      credentials: true,
    },
  });

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
    socket.join(`user:${socket.userId}`);

    socket.on("disconnect", () => {
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