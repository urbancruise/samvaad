const router = require("express").Router();
const multer = require("multer"); // npm install multer, if not already present
const path = require("path");
const crypto = require("crypto");

const auth = require("../../middlewares/auth.middleware");

const {
  createDraft,
  autosaveDraft,
  sendEmail,
  replyToEmail,
  listFolder,
  getUnreadCount,
  getThread,
  setFlag,
  moveToFolder,
  permanentDelete,
  bulkAction,
  attachFile,
  searchRecipients,
  getLabels,
  createLabel,
  deleteLabel,
  getSignature,
  upsertSignature,
} = require("./Email.controller");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../../../uploads/email")),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString("hex");
    cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, 
});

router.use(auth);

router.get("/recipients/search", searchRecipients);
router.get("/labels", getLabels);
router.post("/labels", createLabel);
router.delete("/labels/:labelId", deleteLabel);
router.get("/signature", getSignature);
router.put("/signature", upsertSignature);

router.post("/draft", createDraft);
router.put("/draft/:emailId", autosaveDraft);
router.post("/send", sendEmail);
router.post("/:emailId/reply", replyToEmail);
router.post("/:emailId/attachments", upload.single("file"), attachFile);

router.get("/unread-count", getUnreadCount);
router.get("/folder/:folder", listFolder);

router.get("/thread/:threadId", getThread);

router.patch("/:emailId/flags", setFlag);
router.patch("/:emailId/move", moveToFolder);
router.delete("/:emailId", permanentDelete);

router.post("/bulk", bulkAction);

module.exports = router;