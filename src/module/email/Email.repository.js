const { postgresDb, mysqlDb } = require("../../config/db");

const formatName = (u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();

// Batched — one query for every user id involved in a page of results,
// instead of one query per email (the same N+1 pattern fixed earlier
// in the Rating module).
const hydrateUsers = async (userIds) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean).map(Number))];
  if (uniqueIds.length === 0) return new Map();

  const users = await mysqlDb.users.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, firstName: true, lastName: true, officeEmail: true, username: true },
  });

  return new Map(users.map((u) => [u.id, { id: u.id, fullName: formatName(u), email: u.officeEmail, username: u.username }]));
};

const findUsersForRecipientSearch = async (query) => {
  return mysqlDb.users.findMany({
    where: {
      is_active: true,
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { username: { contains: query, mode: "insensitive" } },
        { officeEmail: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, officeEmail: true, username: true },
    take: 10,
  });
};

// ---------- Threads ----------

const createThread = async (subject) => {
  return postgresDb.emailThread.create({ data: { subject } });
};

const touchThread = async (threadId) => {
  return postgresDb.emailThread.update({
    where: { id: threadId },
    data: { lastActivityAt: new Date() },
  });
};

// ---------- Emails ----------

const createEmail = async ({ threadId, fromId, subject, bodyHtml, bodyText, isDraft, scheduledAt, sentAt, inReplyToId, pendingRecipients }) => {
  return postgresDb.email.create({
    data: { threadId, fromId, subject, bodyHtml, bodyText, isDraft, scheduledAt, sentAt, inReplyToId, pendingRecipients },
  });
};

const clearPendingRecipients = async (emailId) => {
  return postgresDb.email.update({
    where: { id: emailId },
    data: { pendingRecipients: null },
  });
};

const updateEmailContent = async (emailId, { subject, bodyHtml, bodyText }) => {
  return postgresDb.email.update({
    where: { id: emailId },
    data: { subject, bodyHtml, bodyText },
  });
};

const finalizeEmailSend = async (emailId, sentAt) => {
  return postgresDb.email.update({
    where: { id: emailId },
    data: { isDraft: false, sentAt },
  });
};

const findEmailById = async (emailId) => {
  return postgresDb.email.findUnique({
    where: { id: emailId },
    include: { attachments: true, recipients: true },
  });
};

const findDueScheduledEmails = async () => {
  return postgresDb.email.findMany({
    where: { isDraft: false, sentAt: null, scheduledAt: { lte: new Date() } },
    include: { recipients: { where: { type: "SENDER" } } },
  });
};

// ---------- Recipients (per-user mailbox rows) ----------

const createRecipientRow = async ({ emailId, userId, type, folder, isRead }) => {
  return postgresDb.emailRecipient.create({
    data: { emailId, userId, type, folder, isRead: isRead ?? false },
  });
};

const upsertSenderRow = async (emailId, userId, folder) => {
  return postgresDb.emailRecipient.upsert({
    where: { emailId_userId_type: { emailId, userId, type: "SENDER" } },
    update: { folder },
    create: { emailId, userId, type: "SENDER", folder, isRead: true },
  });
};

const findRecipientRow = async (emailId, userId) => {
  // A user may only ever have ONE row per email in practice (they're
  // either the sender or a single TO/CC/BCC recipient), but query
  // broadly and take the first match to be safe.
  return postgresDb.emailRecipient.findFirst({
    where: { emailId, userId },
  });
};

const listByFolder = async (userId, folder, { search, label, sortBy = "createdAt", order = "desc", page = 1, limit = 25 }) => {
  const isVirtual = folder === "STARRED" || folder === "IMPORTANT";

  const where = {
    userId,
    ...(isVirtual
      ? { deletedAt: null, ...(folder === "STARRED" ? { isStarred: true } : { isImportant: true }) }
      : { folder, ...(folder === "TRASH" ? {} : { deletedAt: null }) }),
  };

  if (label) where.labels = { has: label };

  if (search) {
    where.email = {
      OR: [
        { subject: { contains: search, mode: "insensitive" } },
        { bodyText: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const [rows, total] = await Promise.all([
    postgresDb.emailRecipient.findMany({
      where,
      include: {
        email: { include: { attachments: true } },
      },
      orderBy: { email: { [sortBy]: order } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    postgresDb.emailRecipient.count({ where }),
  ]);

  return { rows, total };
};

const countUnread = async (userId, folder = "INBOX") => {
  return postgresDb.emailRecipient.count({
    where: { userId, folder, isRead: false, deletedAt: null },
  });
};

const getThreadEmails = async (threadId, userId) => {
  // Full conversation — every email in the thread the user has ANY
  // visibility into (as sender or a recipient), regardless of which
  // folder that particular email currently sits in for them.
  return postgresDb.email.findMany({
    where: {
      threadId,
      recipients: { some: { userId } },
    },
    include: {
      attachments: true,
      recipients: { where: { userId } },
    },
    orderBy: { createdAt: "asc" },
  });
};

const updateRecipientFlags = async (emailId, userId, patch) => {
  return postgresDb.emailRecipient.updateMany({
    where: { emailId, userId },
    data: patch,
  });
};

const bulkUpdateRecipientFlags = async (emailIds, userId, patch) => {
  return postgresDb.emailRecipient.updateMany({
    where: { emailId: { in: emailIds }, userId },
    data: patch,
  });
};

const hardDeleteRecipientRow = async (emailId, userId) => {
  return postgresDb.emailRecipient.deleteMany({ where: { emailId, userId } });
};

// ---------- Attachments ----------

const createAttachment = async ({ emailId, fileName, fileUrl, fileSize, mimeType }) => {
  return postgresDb.emailAttachment.create({
    data: { emailId, fileName, fileUrl, fileSize, mimeType },
  });
};

// ---------- Labels ----------

const getLabelsForUser = async (userId) => {
  return postgresDb.emailLabel.findMany({ where: { userId }, orderBy: { name: "asc" } });
};

const createLabel = async (userId, name, color) => {
  return postgresDb.emailLabel.create({ data: { userId, name, color } });
};

const deleteLabel = async (userId, labelId) => {
  return postgresDb.emailLabel.deleteMany({ where: { id: labelId, userId } });
};

// ---------- Signature ----------

const getSignature = async (userId) => {
  return postgresDb.emailSignature.findUnique({ where: { userId } });
};

const upsertSignature = async (userId, content, isAutoAppend) => {
  return postgresDb.emailSignature.upsert({
    where: { userId },
    update: { content, isAutoAppend },
    create: { userId, content, isAutoAppend },
  });
};

module.exports = {
  formatName,
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
};