// ============================================================
//  security.js — Anti-Spam, Rate Limiter, Blacklist (V5)
// ============================================================
require("./config");
const cfg = global.botConfig;

const blacklist        = new Map();
const commandLog       = new Map();
const lastCommand      = new Map();
const specificCooldowns = new Map();

function isBanned(jid) {
  if (!blacklist.has(jid)) return false;
  if (Date.now() >= blacklist.get(jid)) { blacklist.delete(jid); return false; }
  return true;
}

function banUser(jid) {
  blacklist.set(jid, Date.now() + cfg.rateLimitBanMs);
}

function checkRateLimit(jid) {
  const now = Date.now();
  const log = (commandLog.get(jid) || []).filter(t => now - t < cfg.rateLimitWindowMs);
  log.push(now);
  commandLog.set(jid, log);
  if (log.length > cfg.rateLimitMax) { banUser(jid); return false; }
  return true;
}

function checkCommandCooldown(jid) {
  const last    = lastCommand.get(jid) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < cfg.commandCooldownMs) {
    return Math.ceil((cfg.commandCooldownMs - elapsed) / 1000);
  }
  lastCommand.set(jid, Date.now());
  return 0;
}

function checkSpecificCooldown(jid, key, durationMs) {
  const k       = `${jid}:${key}`;
  const last    = specificCooldowns.get(k) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < durationMs) return Math.ceil((durationMs - elapsed) / 1000);
  specificCooldowns.set(k, Date.now());
  return 0;
}

function securityCheck(jid) {
  if (isBanned(jid)) return { ok: false, reason: "banned" };
  if (!checkRateLimit(jid)) return { ok: false, reason: "banned" };
  const wait = checkCommandCooldown(jid);
  if (wait > 0) return { ok: false, reason: "cooldown", wait };
  return { ok: true };
}

// FIX BUGS: Tambahkan fungsi unbanUser yang sebelumnya dipanggil di index.js tapi tidak ada di sini.
// Tanpa ini, !unban akan crash dengan "security.unbanUser is not a function".
function unbanUser(jid) {
  blacklist.delete(jid);
  commandLog.delete(jid);
  lastCommand.delete(jid);
}

module.exports = { checkSpecificCooldown, securityCheck, unbanUser };