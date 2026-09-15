const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { MESSAGE_PAGE_SIZE } = require("./chat.constants");

const {
  createConversationSchema,
  updateConversationSchema,
  addParticipantsSchema,
  sendMessageSchema,
  editMessageSchema,
  reactionSchema,
  markReadSchema,
} = require("./chat.validation");

const service = require("./chat.service");

const createConversation = asyncHandler(async (req, res) => {
  const data = createConversationSchema.parse(req.body);
  const conversation = await service.createConversationService(req.user.id, data);
  return res.status(201).json(new ApiResponse(201, conversation, "Conversation ready"));
});

const getConversations = asyncHandler(async (req, res) => {
  const conversations = await service.getUserConversationsService(req.user.id);
  return res.status(200).json(new ApiResponse(200, conversations, "Conversations fetched"));
});

const getDirectory = asyncHandler(async (req, res) => {
  const directory = await service.getDirectoryService(req.user.id);
  return res.status(200).json(new ApiResponse(200, directory, "Directory fetched"));
});

const getConversation = asyncHandler(async (req, res) => {
  const conversation = await service.getConversationService(req.params.conversationId, req.user.id);
  return res.status(200).json(new ApiResponse(200, conversation, "Conversation fetched"));
});

const updateConversation = asyncHandler(async (req, res) => {
  const data = updateConversationSchema.parse(req.body);
  const conversation = await service.updateConversationService(req.params.conversationId, req.user.id, data);
  return res.status(200).json(new ApiResponse(200, conversation, "Conversation updated"));
});

const addParticipants = asyncHandler(async (req, res) => {
  const { participantIds } = addParticipantsSchema.parse(req.body);
  const conversation = await service.addParticipantsService(req.params.conversationId, req.user.id, participantIds);
  return res.status(200).json(new ApiResponse(200, conversation, "Participants added"));
});

const removeParticipant = asyncHandler(async (req, res) => {
  await service.removeParticipantService(req.params.conversationId, req.user.id, req.params.userId);
  return res.status(200).json(new ApiResponse(200, null, "Participant removed"));
});

const sendMessage = asyncHandler(async (req, res) => {
  const data = sendMessageSchema.parse(req.body);
  const message = await service.sendMessageService(req.params.conversationId, req.user.id, data);
  return res.status(201).json(new ApiResponse(201, message, "Message sent"));
});

const getMessages = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || MESSAGE_PAGE_SIZE;
  const before = req.query.before || undefined;
  const messages = await service.getMessagesService(req.params.conversationId, req.user.id, { before, limit });
  return res.status(200).json(new ApiResponse(200, messages, "Messages fetched"));
});

const editMessage = asyncHandler(async (req, res) => {
  const { body } = editMessageSchema.parse(req.body);
  const message = await service.editMessageService(req.params.messageId, req.user.id, body);
  return res.status(200).json(new ApiResponse(200, message, "Message edited"));
});

const deleteMessage = asyncHandler(async (req, res) => {
  const result = await service.deleteMessageService(req.params.messageId, req.user.id);
  return res.status(200).json(new ApiResponse(200, result, "Message deleted"));
});

const markRead = asyncHandler(async (req, res) => {
  const { messageId } = markReadSchema.parse(req.body);
  await service.markReadService(req.params.conversationId, req.user.id, messageId);
  return res.status(200).json(new ApiResponse(200, null, "Marked as read"));
});

const toggleReaction = asyncHandler(async (req, res) => {
  const { emoji } = reactionSchema.parse(req.body);
  const result = await service.toggleReactionService(req.params.messageId, req.user.id, emoji);
  return res.status(200).json(new ApiResponse(200, result, "Reaction updated"));
});

const searchMessages = asyncHandler(async (req, res) => {
  const query = (req.query.q || "").trim();
  if (!query) {
    return res.status(200).json(new ApiResponse(200, [], "Search results fetched"));
  }
  const results = await service.searchMessagesService(req.user.id, query);
  return res.status(200).json(new ApiResponse(200, results, "Search results fetched"));
});

// File itself is handled by multer middleware in chat.routes.js —
// this just echoes back the stored file's public info for the
// frontend to attach to a subsequent sendMessage call.
const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(new ApiResponse(400, null, "No file uploaded"));
  }

  const fileInfo = {
    fileName: req.file.originalname,
    fileUrl: `/uploads/chat/${req.file.filename}`,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
  };

  return res.status(201).json(new ApiResponse(201, fileInfo, "File uploaded"));
});

module.exports = {
  createConversation,
  getDirectory,
  getConversations,
  getConversation,
  updateConversation,
  addParticipants,
  removeParticipant,
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  markRead,
  toggleReaction,
  searchMessages,
  uploadAttachment,
};