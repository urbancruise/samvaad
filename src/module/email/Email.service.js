const ApiError = require("../../utils/ApiError");
const { sendEmailReceivedNotification } = require("../notifications/notification.service");

const {
  hydrateUsers,
  findUsersForRecipientSearch,
  createThread,
  touchThread,
  createEmail,
  clearPendingRecipients,
  updateEmailContent,
  finalizeEmailSend,
  findEmailById,
  findDueScheduledEmails,
  createRecipientRow,
  upsertSenderRow,
  findRecipientRow,
  getToRecipientsForEmails,
  listByFolder,
  countUnread,
  getThreadEmails,
  updateRecipientFlags,
  bulkUpdateRecipientFlags,
  hardDeleteRecipientRow,
  createAttachment,
  getLabelsForUser,
  createLabel,
  deleteLabel,
  getSignature,
  upsertSignature,
} = require("./email.repository");

// Injected from email.socket.js at server startup — avoids a circular
// require between the service and the socket layer. Falls back to a
// no-op so the service still works fine if sockets aren't wired up.
let emitToUser = () => {};
const setEmitter = (fn) => {
  emitToUser = fn;
};

const stripHtml = (html) => (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// ---------- Compose / Draft ----------

const createDraftService = async (fromId, data) => {
  const thread = await createThread(data.subject || "(no subject)");

  const email = await createEmail({
    threadId: thread.id,
    fromId,
    subject: data.subject || "",
    bodyHtml: data.bodyHtml || "",
    bodyText: stripHtml(data.bodyHtml),
    isDraft: true,
    scheduledAt: null,
    sentAt: null,
    inReplyToId: null,
    pendingRecipients: null,
  });

  await upsertSenderRow(email.id, fromId, "DRAFTS");

  return { ...email, threadId: thread.id, to: data.to ?? [], cc: data.cc ?? [], bcc: data.bcc ?? [] };
};

/**
 * Auto-save — called frequently while composing. Cheap upsert, no
 * recipient resolution yet (that only happens on actual Send).
 */
const autosaveDraftService = async (emailId, userId, data) => {
  const own = await findRecipientRow(emailId, userId);
  if (!own || own.type !== "SENDER") {
    throw new ApiError(403, "You can only edit your own draft.");
  }

  return updateEmailContent(emailId, {
    subject: data.subject || "",
    bodyHtml: data.bodyHtml || "",
    bodyText: stripHtml(data.bodyHtml),
  });
};

// ---------- Send ----------

const resolveRecipientList = (list) => (Array.isArray(list) ? list.map(Number).filter(Boolean) : []);

const sendEmailService = async (fromId, data) => {
  const to = resolveRecipientList(data.to);
  const cc = resolveRecipientList(data.cc);
  const bcc = resolveRecipientList(data.bcc);

  if (to.length === 0) {
    throw new ApiError(400, "At least one recipient is required.");
  }

  let threadId = data.threadId;
  if (!threadId) {
    const thread = await createThread(data.subject || "(no subject)");
    threadId = thread.id;
  } else {
    await touchThread(threadId);
  }

  const isScheduled = Boolean(data.scheduledAt) && new Date(data.scheduledAt) > new Date();

  let email;
  if (data.emailId) {
    // Sending an existing draft
    email = await updateEmailContent(data.emailId, {
      subject: data.subject || "",
      bodyHtml: data.bodyHtml || "",
      bodyText: stripHtml(data.bodyHtml),
    });
  } else {
    email = await createEmail({
      threadId,
      fromId,
      subject: data.subject || "",
      bodyHtml: data.bodyHtml || "",
      bodyText: stripHtml(data.bodyHtml),
      isDraft: isScheduled, // scheduled emails stay "not yet sent" until dispatch
      scheduledAt: isScheduled ? new Date(data.scheduledAt) : null,
      sentAt: isScheduled ? null : new Date(),
      inReplyToId: data.inReplyToId || null,
      // Held here until dispatch time, since real EmailRecipient rows
      // (which make the email visible to recipients) shouldn't exist
      // until it's actually sent.
      pendingRecipients: isScheduled ? { to, cc, bcc } : null,
    });
  }

  if (isScheduled) {
    await upsertSenderRow(email.id, fromId, "SCHEDULED");
    return { ...email, status: "scheduled" };
  }

  await finalizeEmailSend(email.id, email.sentAt ?? new Date());
  await upsertSenderRow(email.id, fromId, "SENT");
  await fileRecipients(email.id, fromId, { to, cc, bcc }, threadId, email.subject);

  return { ...email, threadId, status: "sent" };
};

// Shared by both the immediate-send path and the scheduled dispatcher.
const fileRecipients = async (emailId, fromId, { to, cc, bcc }, threadId, subject) => {
  const allRecipients = [
    ...to.map((userId) => ({ userId, type: "TO" })),
    ...cc.map((userId) => ({ userId, type: "CC" })),
    ...bcc.map((userId) => ({ userId, type: "BCC" })),
  ];

  if (allRecipients.length === 0) return;

  // One lookup for the sender's display name, reused for every
  // recipient's notification message below.
  const fromMap = await hydrateUsers([fromId]);
  const fromName = fromMap.get(fromId)?.fullName ?? null;

  for (const r of allRecipients) {
    if (r.userId === fromId) continue; // don't double-file into your own inbox
    await createRecipientRow({ emailId, userId: r.userId, type: r.type, folder: "INBOX", isRead: false });

    // Live toast for anyone currently connected...
    emitToUser(r.userId, "email:new", { emailId, subject, threadId });

    // ...and a persistent bell entry regardless of whether they were
    // online when it arrived. Failure here shouldn't block the send.
    try {
      await sendEmailReceivedNotification({ userId: r.userId, fromName, subject, threadId });
    } catch (err) {
      console.error("Failed to create email notification:", err);
    }
  }
};

/**
 * Reply / Reply All / Forward all funnel through here — the only
 * difference is which recipient list gets computed.
 */
const replyToEmailService = async (fromId, originalEmailId, { bodyHtml, replyAll, forwardTo }) => {
  const original = await findEmailById(originalEmailId);
  if (!original) throw new ApiError(404, "Original email not found.");

  const isForward = Boolean(forwardTo);

  let to = [];
  let cc = [];

  if (isForward) {
    to = resolveRecipientList(forwardTo.to);
    cc = resolveRecipientList(forwardTo.cc);
  } else {
    // Reply: back to the original sender (unless I was the sender,
    // then reply goes to the original TO list instead).
    const originalToIds = original.recipients.filter((r) => r.type === "TO").map((r) => r.userId);
    to = original.fromId === fromId ? originalToIds : [original.fromId];

    if (replyAll) {
      const ccIds = original.recipients.filter((r) => r.type === "CC").map((r) => r.userId);
      const allToIds = original.fromId === fromId ? [] : originalToIds;
      cc = [...new Set([...ccIds, ...allToIds, original.fromId].filter((id) => id !== fromId && !to.includes(id)))];
    }
  }

  const subjectPrefix = isForward ? "Fwd: " : "Re: ";
  const subject = original.subject.startsWith(subjectPrefix) ? original.subject : `${subjectPrefix}${original.subject}`;

  const email = await sendEmailService(fromId, {
    to,
    cc,
    subject,
    bodyHtml,
    threadId: isForward ? undefined : original.threadId, // forwards start a fresh thread
    inReplyToId: isForward ? null : original.id,
  });

  // Forwards carry the original attachments along by reference.
  if (isForward && original.attachments.length > 0) {
    for (const att of original.attachments) {
      await createAttachment({
        emailId: email.id,
        fileName: att.fileName,
        fileUrl: att.fileUrl,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
      });
    }
  }

  return email;
};

// ---------- Folder listing ----------

const FOLDER_LIST = ["INBOX", "SENT", "DRAFTS", "SCHEDULED", "SPAM", "TRASH", "ARCHIVE", "STARRED", "IMPORTANT"];

const listFolderService = async (userId, folder, query) => {
  if (!FOLDER_LIST.includes(folder)) throw new ApiError(400, "Invalid folder.");

  const { rows, total } = await listByFolder(userId, folder, query);

  // In Sent/Drafts/Scheduled, "From" is always the current user
  // themself — useless to display. Real mail clients show "To: X"
  // there instead, and only fall back to "From" for folders where
  // you're the recipient (Inbox, Spam, Trash, Archive, Starred,
  // Important — any of which could hold either direction).
  const showRecipientInstead = ["SENT", "DRAFTS", "SCHEDULED"].includes(folder);

  const userIds = new Set();
  rows.forEach((r) => userIds.add(r.email.fromId));

  const emailIds = rows.map((r) => r.email.id);
  const toByEmail = showRecipientInstead ? await getToRecipientsForEmails(emailIds) : new Map();
  toByEmail.forEach((ids) => ids.forEach((id) => userIds.add(id)));

  const userMap = await hydrateUsers([...userIds]);

  const shaped = rows.map((r) => {
    let displayParty = userMap.get(r.email.fromId) ?? null;
    let displayPrefix = "";

    if (showRecipientInstead) {
      const toIds = toByEmail.get(r.email.id) ?? [];
      const toUsers = toIds.map((id) => userMap.get(id)).filter(Boolean);
      displayParty = toUsers[0] ?? null;
      displayPrefix = toUsers.length > 1 ? ` +${toUsers.length - 1}` : "";
    }

    return {
      id: r.email.id,
      threadId: r.email.threadId,
      recipientRowId: r.id,
      subject: r.email.subject,
      preview: (r.email.bodyText || "").slice(0, 140),
      from: displayParty
        ? { ...displayParty, fullName: `${displayPrefix ? "To: " : ""}${displayParty.fullName}${displayPrefix}` }
        : null,
      isRead: r.isRead,
      isStarred: r.isStarred,
      isImportant: r.isImportant,
      labels: r.labels,
      hasAttachments: r.email.attachments.length > 0,
      attachmentCount: r.email.attachments.length,
      scheduledAt: r.email.scheduledAt,
      sentAt: r.email.sentAt,
      createdAt: r.email.createdAt,
    };
  });

  return {
    emails: shaped,
    pagination: {
      page: query.page || 1,
      limit: query.limit || 25,
      total,
      totalPages: Math.ceil(total / (query.limit || 25)),
    },
  };
};

const getUnreadCountService = async (userId) => countUnread(userId, "INBOX");

// ---------- Thread / conversation view ----------

const getThreadService = async (threadId, userId) => {
  const emails = await getThreadEmails(threadId, userId);
  if (emails.length === 0) throw new ApiError(404, "Thread not found.");

  const userIds = new Set();
  emails.forEach((e) => {
    userIds.add(e.fromId);
    e.recipients.forEach((r) => userIds.add(r.userId));
  });
  const userMap = await hydrateUsers([...userIds]);

  // Mark every email in this thread as read for this user, since
  // opening the conversation view is the "reading" action.
  await Promise.all(emails.map((e) => updateRecipientFlags(e.id, userId, { isRead: true })));

  return emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    bodyHtml: e.bodyHtml,
    from: userMap.get(e.fromId) ?? null,
    attachments: e.attachments,
    sentAt: e.sentAt,
    createdAt: e.createdAt,
    myFlags: e.recipients[0] ?? null,
  }));
};

// ---------- Flags / folder moves ----------

const setFlagService = async (emailId, userId, patch) => {
  const updated = await updateRecipientFlags(emailId, userId, patch);
  if (updated.count === 0) throw new ApiError(404, "Email not found in your mailbox.");
  return true;
};

const moveToFolderService = async (emailId, userId, folder) => {
  const patch = { folder };
  patch.deletedAt = folder === "TRASH" ? new Date() : null;
  return setFlagService(emailId, userId, patch);
};

const permanentDeleteService = async (emailId, userId) => {
  const result = await hardDeleteRecipientRow(emailId, userId);
  if (result.count === 0) throw new ApiError(404, "Email not found in your mailbox.");
  return true;
};

// ---------- Bulk actions ----------

const bulkActionService = async (userId, emailIds, action) => {
  const actionMap = {
    read: { isRead: true },
    unread: { isRead: false },
    star: { isStarred: true },
    unstar: { isStarred: false },
    archive: { folder: "ARCHIVE", deletedAt: null },
    spam: { folder: "SPAM", deletedAt: null },
    trash: { folder: "TRASH", deletedAt: new Date() },
    inbox: { folder: "INBOX", deletedAt: null },
  };

  if (action === "delete") {
    return Promise.all(emailIds.map((id) => hardDeleteRecipientRow(id, userId)));
  }

  const patch = actionMap[action];
  if (!patch) throw new ApiError(400, "Invalid bulk action.");

  return bulkUpdateRecipientFlags(emailIds, userId, patch);
};

// ---------- Attachments ----------

const attachFileService = async (emailId, userId, file) => {
  const own = await findRecipientRow(emailId, userId);
  if (!own || own.type !== "SENDER") {
    throw new ApiError(403, "You can only attach files to your own draft.");
  }

  return createAttachment({
    emailId,
    fileName: file.originalname,
    fileUrl: `/uploads/email/${file.filename}`,
    fileSize: file.size,
    mimeType: file.mimetype,
  });
};

// ---------- Recipient search (for the To/CC/BCC picker) ----------

const searchRecipientsService = async (query) => {
  const users = await findUsersForRecipientSearch(query);
  return users.map((u) => ({
    id: u.id,
    fullName: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
    email: u.officeEmail,
    username: u.username,
  }));
};

// ---------- Labels ----------

const getLabelsService = (userId) => getLabelsForUser(userId);
const createLabelService = (userId, name, color) => createLabel(userId, name, color || "#64748b");
const deleteLabelService = (userId, labelId) => deleteLabel(userId, labelId);

// ---------- Signature ----------

const getSignatureService = (userId) => getSignature(userId);
const upsertSignatureService = (userId, content, isAutoAppend) => upsertSignature(userId, content, isAutoAppend ?? true);

// ---------- Scheduled dispatcher ----------

/**
 * Simple interval-based dispatcher — checks every 30s for scheduled
 * emails whose time has come and actually sends them, using the
 * pendingRecipients captured back at schedule time. For a small/
 * medium app this is fine; if volume grows, swap for a real job queue
 * (BullMQ + Redis) without changing anything else in this file.
 */
const dispatchDueScheduledEmails = async () => {
  const due = await findDueScheduledEmails();

  for (const email of due) {
    const senderRow = email.recipients[0];
    if (!senderRow) continue;

    const recipients = email.pendingRecipients || { to: [], cc: [], bcc: [] };

    await finalizeEmailSend(email.id, new Date());
    await upsertSenderRow(email.id, senderRow.userId, "SENT");
    await fileRecipients(email.id, senderRow.userId, recipients, email.threadId, email.subject);
    await clearPendingRecipients(email.id);
  }

  return due.length;
};

module.exports = {
  setEmitter,
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
  dispatchDueScheduledEmails,
};