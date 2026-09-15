const chatService = require("./chat.service");
const { sendMessageSchema, reactionSchema } = require("./chat.validation");

const registerChatHandlers = (io, socket) => {
  const userId = socket.user.id;

  socket.on("conversation:join", async ({ conversationId }, ack) => {
    try {
      await chatService.assertParticipant(conversationId, userId);
      socket.join(`conversation:${conversationId}`);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("conversation:leave", ({ conversationId }) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on("message:send", async (payload, ack) => {
    try {
      const data = sendMessageSchema.parse(payload);
      const message = await chatService.sendMessageService(payload.conversationId, userId, data);

      io.to(`conversation:${payload.conversationId}`).emit("message:new", message);

      // Also push a lightweight "conversation updated" event to every
      // participant's personal room, so the conversation list (badge,
      // preview, reorder) updates even if they don't have this thread open.
      const conversation = await chatService.getConversationService(payload.conversationId, userId);
      conversation.participants.forEach((p) => {
        io.to(`user:${p.id}`).emit("conversation:updated", {
          conversationId: payload.conversationId,
          lastMessage: message,
        });
      });

      ack?.({ ok: true, message });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("message:typing", ({ conversationId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit("typing:update", {
      conversationId,
      userId,
      isTyping: Boolean(isTyping),
    });
  });

  socket.on("message:read", async ({ conversationId, messageId }, ack) => {
    try {
      await chatService.markReadService(conversationId, userId, messageId);
      socket.to(`conversation:${conversationId}`).emit("message:read:update", {
        conversationId,
        userId,
        messageId,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("reaction:toggle", async ({ messageId, emoji }, ack) => {
    try {
      const parsed = reactionSchema.parse({ emoji });
      const result = await chatService.toggleReactionService(messageId, userId, parsed.emoji);
      io.to(`conversation:${result.conversationId}`).emit("reaction:update", result);
      ack?.({ ok: true, result });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("message:edit", async ({ messageId, body }, ack) => {
    try {
      const message = await chatService.editMessageService(messageId, userId, body);
      io.to(`conversation:${message.conversationId}`).emit("message:updated", message);
      ack?.({ ok: true, message });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on("message:delete", async ({ messageId }, ack) => {
    try {
      const result = await chatService.deleteMessageService(messageId, userId);
      io.to(`conversation:${result.conversationId}`).emit("message:deleted", result);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });
};

module.exports = registerChatHandlers;