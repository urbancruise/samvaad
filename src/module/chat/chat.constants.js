const CONVERSATION_TYPE = {
  DIRECT: "DIRECT",
  GROUP: "GROUP",
};

const PARTICIPANT_ROLE = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
};

const MESSAGE_TYPE = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  FILE: "FILE",
  AUDIO: "AUDIO",
  VIDEO: "VIDEO",
  SYSTEM: "SYSTEM",
  CALL_LOG: "CALL_LOG",
};

const CALL_TYPE = {
  AUDIO: "AUDIO",
  VIDEO: "VIDEO",
};

const CALL_STATUS = {
  RINGING: "RINGING",
  ONGOING: "ONGOING",
  ENDED: "ENDED",
  MISSED: "MISSED",
  DECLINED: "DECLINED",
};

const CALL_PARTICIPANT_STATUS = {
  INVITED: "INVITED",
  RINGING: "RINGING",
  JOINED: "JOINED",
  DECLINED: "DECLINED",
  LEFT: "LEFT",
  MISSED: "MISSED",
};

// P2P mesh means every participant opens a direct RTCPeerConnection to
// every other participant (n*(n-1)/2 total links). Keep group calls
// small — this is the ceiling past which browser CPU/bandwidth gets
// rough. Bump this only if you migrate to an SFU.
const MAX_CALL_PARTICIPANTS = 8;

const MESSAGE_PAGE_SIZE = 30;
const CONVERSATION_PAGE_SIZE = 30;
const SEARCH_RESULT_LIMIT = 30;

module.exports = {
  CONVERSATION_TYPE,
  PARTICIPANT_ROLE,
  MESSAGE_TYPE,
  CALL_TYPE,
  CALL_STATUS,
  CALL_PARTICIPANT_STATUS,
  MAX_CALL_PARTICIPANTS,
  MESSAGE_PAGE_SIZE,
  CONVERSATION_PAGE_SIZE,
  SEARCH_RESULT_LIMIT,
};