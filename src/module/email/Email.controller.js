const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");

const {
  createDraftService,
  autosaveDraftService,
  sendEmailService,
  replyToEmailService,
  listFolderService,
  getUnreadCountService,
  getThreadService,
  setFlagService,
  moveToFolderService,
  permanentDeleteService,
  bulkActionService,
  attachFileService,
  searchRecipientsService,
  getLabelsService,
  createLabelService,
  deleteLabelService,
  getSignatureService,
  upsertSignatureService,
} = require("./Email.service");

const createDraft = asyncHandler(async (req, res) => {
  const draft = await createDraftService(req.user.id, req.body);
  return res.status(201).json(new ApiResponse(201, draft, "Draft created"));
});

const autosaveDraft = asyncHandler(async (req, res) => {
  const draft = await autosaveDraftService(req.params.emailId, req.user.id, req.body);
  return res.status(200).json(new ApiResponse(200, draft, "Draft saved"));
});

const sendEmail = asyncHandler(async (req, res) => {
  const email = await sendEmailService(req.user.id, req.body);
  return res.status(200).json(new ApiResponse(200, email, "Email sent"));
});

const replyToEmail = asyncHandler(async (req, res) => {
  const email = await replyToEmailService(req.user.id, req.params.emailId, req.body);
  return res.status(200).json(new ApiResponse(200, email, "Reply sent"));
});

const listFolder = asyncHandler(async (req, res) => {
  const { search, label, sortBy, order, page, limit } = req.query;
  const result = await listFolderService(req.user.id, req.params.folder.toUpperCase(), {
    search,
    label,
    sortBy,
    order,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  return res.status(200).json(new ApiResponse(200, result, "Folder fetched"));
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await getUnreadCountService(req.user.id);
  return res.status(200).json(new ApiResponse(200, { count }, "Unread count fetched"));
});

const getThread = asyncHandler(async (req, res) => {
  const emails = await getThreadService(req.params.threadId, req.user.id);
  return res.status(200).json(new ApiResponse(200, emails, "Thread fetched"));
});

const setFlag = asyncHandler(async (req, res) => {
  await setFlagService(req.params.emailId, req.user.id, req.body);
  return res.status(200).json(new ApiResponse(200, null, "Updated"));
});

const moveToFolder = asyncHandler(async (req, res) => {
  await moveToFolderService(req.params.emailId, req.user.id, req.body.folder?.toUpperCase());
  return res.status(200).json(new ApiResponse(200, null, "Moved"));
});

const permanentDelete = asyncHandler(async (req, res) => {
  await permanentDeleteService(req.params.emailId, req.user.id);
  return res.status(200).json(new ApiResponse(200, null, "Deleted permanently"));
});

const bulkAction = asyncHandler(async (req, res) => {
  const { emailIds, action } = req.body;
  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    throw new ApiError(400, "emailIds must be a non-empty array.");
  }
  await bulkActionService(req.user.id, emailIds, action);
  return res.status(200).json(new ApiResponse(200, null, "Bulk action applied"));
});

const attachFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded.");
  const attachment = await attachFileService(req.params.emailId, req.user.id, req.file);
  return res.status(201).json(new ApiResponse(201, attachment, "File attached"));
});

const searchRecipients = asyncHandler(async (req, res) => {
  const results = await searchRecipientsService(req.query.q || "");
  return res.status(200).json(new ApiResponse(200, results, "Recipients found"));
});

const getLabels = asyncHandler(async (req, res) => {
  const labels = await getLabelsService(req.user.id);
  return res.status(200).json(new ApiResponse(200, labels, "Labels fetched"));
});

const createLabel = asyncHandler(async (req, res) => {
  const label = await createLabelService(req.user.id, req.body.name, req.body.color);
  return res.status(201).json(new ApiResponse(201, label, "Label created"));
});

const deleteLabel = asyncHandler(async (req, res) => {
  await deleteLabelService(req.user.id, req.params.labelId);
  return res.status(200).json(new ApiResponse(200, null, "Label deleted"));
});

const getSignature = asyncHandler(async (req, res) => {
  const sig = await getSignatureService(req.user.id);
  return res.status(200).json(new ApiResponse(200, sig, "Signature fetched"));
});

const upsertSignature = asyncHandler(async (req, res) => {
  const sig = await upsertSignatureService(req.user.id, req.body.content, req.body.isAutoAppend);
  return res.status(200).json(new ApiResponse(200, sig, "Signature saved"));
});

module.exports = {
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
};