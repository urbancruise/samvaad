const { sweepStaleCallsService } = require("./call.service");

const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // check every 15 minutes
const STALE_CALL_MAX_AGE_MS = 4 * 60 * 60 * 1000; // force-end anything older than 4 hours

let sweepTimer = null;

/**
 * Starts the periodic sweep for calls stuck in RINGING/ONGOING with no
 * one actually connected (crashed tab, missed disconnect event, etc).
 * Mirrors the Email module's existing 30s-interval scheduled-send
 * checker — same "plain interval, no cron dependency" convention.
 *
 * Call this once from server.js, right after createSocketServer(httpServer):
 *
 *   const { startStaleCallSweep } = require("./module/chat/call.cleanup");
 *   startStaleCallSweep();
 */
const startStaleCallSweep = () => {
  if (sweepTimer) return; // guard against double-start on hot reload

  sweepTimer = setInterval(async () => {
    try {
      const results = await sweepStaleCallsService(STALE_CALL_MAX_AGE_MS);
      if (results.length > 0) {
        console.log(`[call.cleanup] Force-ended ${results.length} stale call(s).`);
      }
    } catch (err) {
      console.error("[call.cleanup] Sweep failed:", err.message);
    }
  }, SWEEP_INTERVAL_MS);
};

const stopStaleCallSweep = () => {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
};

module.exports = { startStaleCallSweep, stopStaleCallSweep };