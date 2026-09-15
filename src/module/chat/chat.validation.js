const { z } = require("zod");
const {
  CONVERSATION_TYPE,
  MESSAGE_TYPE,
  CALL_TYPE,
} = require("./chat.constants");

const attachmentSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  thumbnailUrl: z.string().optional(),
});

const createConversationSchema = z
  .object({
    type: z.enum([CONVERSATION_TYPE.DIRECT, CONVERSATION_TYPE.GROUP]),
    name: z.string().min(1).max(100).optional(),
    avatarUrl: z.string().optional(),
    participantIds: z.array(z.number().int()).min(1),
  })
  .refine(
    (data) => data.type !== CONVERSATION_TYPE.GROUP || Boolean(data.name),
    { message: "Group conversations require a name", path: ["name"] }
  )
  .refine(
    (data) => data.type !== CONVERSATION_TYPE.DIRECT || data.participantIds.length === 1,
    { message: "Direct conversations need exactly one other participant", path: ["participantIds"] }
  );

const updateConversationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().optional(),
});

const addParticipantsSchema = z.object({
  participantIds: z.array(z.number().int()).min(1),
});

const sendMessageSchema = z
  .object({
    body: z.string().max(5000).optional(),
    type: z.enum(Object.values(MESSAGE_TYPE)).default(MESSAGE_TYPE.TEXT),
    replyToId: z.string().optional(),
    mentions: z.array(z.number().int()).optional().default([]),
    attachments: z.array(attachmentSchema).optional().default([]),
  })
  .refine(
    (data) => Boolean(data.body?.trim()) || data.attachments.length > 0,
    { message: "Message must have text or at least one attachment", path: ["body"] }
  );

const editMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(8),
});

const markReadSchema = z.object({
  messageId: z.string().min(1),
});

const initiateCallSchema = z.object({
  conversationId: z.string().min(1),
  type: z.enum([CALL_TYPE.AUDIO, CALL_TYPE.VIDEO]),
});

module.exports = {
  createConversationSchema,
  updateConversationSchema,
  addParticipantsSchema,
  sendMessageSchema,
  editMessageSchema,
  reactionSchema,
  markReadSchema,
  initiateCallSchema,
};