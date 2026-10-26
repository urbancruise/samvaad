/**
 * Lets REST controllers/services push realtime events without having
 * access to the `io` instance directly (same idea as setEmitter in
 * Email.service.js). src/socket/index.js calls setIo(io) once on boot.
 */
let ioInstance = null;

const setIo = (io) => {
  ioInstance = io;
};

const emitToUser = (userId, event, payload) => {
  ioInstance?.to(`user:${userId}`).emit(event, payload);
};

const emitToUsers = (userIds, event, payload) => {
  [...new Set(userIds)].forEach((id) => emitToUser(id, event, payload));
};

const emitToRoom = (room, event, payload) => {
  ioInstance?.to(room).emit(event, payload);
};

// Removes every socket of a user from a room — used when someone is
// removed from a group so they stop receiving that room's messages.
const removeUserFromRoom = (userId, room) => {
  ioInstance?.in(`user:${userId}`).socketsLeave(room);
};

module.exports = { setIo, emitToUser, emitToUsers, emitToRoom, removeUserFromRoom };