const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const auth = require("../../middlewares/auth.middleware");
const controller = require("./chat.controller");

// NOTE: assumes `multer` is already a dependency (your email module's
// uploads/email/*.avif files suggest local-disk uploads are already in
// use — mirror your existing multer config here if you have one
// centralized, rather than duplicating this block).
const uploadDir = path.join(__dirname, "../../../uploads/chat");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — adjust to taste
});

router.use(auth);

router.get("/directory", controller.getDirectory);

// Conversations
router.post("/conversations", controller.createConversation);
router.get("/conversations", controller.getConversations);
router.get("/conversations/:conversationId", controller.getConversation);
router.patch("/conversations/:conversationId", controller.updateConversation);
router.post("/conversations/:conversationId/participants", controller.addParticipants);
router.delete("/conversations/:conversationId/participants/:userId", controller.removeParticipant);
router.post("/conversations/:conversationId/read", controller.markRead);

// Messages
router.post("/conversations/:conversationId/messages", controller.sendMessage);
router.get("/conversations/:conversationId/messages", controller.getMessages);
router.patch("/messages/:messageId", controller.editMessage);
router.delete("/messages/:messageId", controller.deleteMessage);
router.post("/messages/:messageId/reactions", controller.toggleReaction);

// Search & uploads
router.get("/search", controller.searchMessages);
router.post("/upload", upload.single("file"), controller.uploadAttachment);

module.exports = router;