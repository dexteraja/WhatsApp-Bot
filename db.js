// ============================================================
//  db.js — Persistent JSON Database Architecture (OPTIMIZED)
// ============================================================
require("./config");
const cfg = global.botConfig;
const fs  = require("fs"); 

const PLAYERS_FILE   = "./database_players.json";
const GROUPS_FILE    = "./database_groups.json";
const WHITELIST_FILE = "./database_whitelist.json";

function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`[DB ERROR] Gagal membaca file ${filePath}:`, e);
  }
  return {};
}

// ── SISTEM ANTI-LAG (DEBOUNCER) ────────────────────────────
// Daripada memblokir event loop dengan writeFileSync setiap detik, 
// kita hanya menandai file yang perlu disimpan dan menyimpannya secara asinkron.
const dirtyFiles = new Set();

function saveJSON(filePath, data) {
  dirtyFiles.add(filePath);
}

// Auto-Save background worker tiap 3 detik
setInterval(() => {
  if (dirtyFiles.has(PLAYERS_FILE)) {
    fs.writeFile(PLAYERS_FILE, JSON.stringify(players, null, 2), "utf8", () => {});
    dirtyFiles.delete(PLAYERS_FILE);
  }
  if (dirtyFiles.has(GROUPS_FILE)) {
    fs.writeFile(GROUPS_FILE, JSON.stringify(groupData, null, 2), "utf8", () => {});
    dirtyFiles.delete(GROUPS_FILE);
  }
  if (dirtyFiles.has(WHITELIST_FILE)) {
    fs.writeFile(WHITELIST_FILE, JSON.stringify(Array.from(whitelist), null, 2), "utf8", () => {});
    dirtyFiles.delete(WHITELIST_FILE);
  }
}, 3000);

// ── INISIALISASI DATA ────────────────────────────────────────

const players    = loadJSON(PLAYERS_FILE);
const groupData  = loadJSON(GROUPS_FILE);
const rawWhitelist = loadJSON(WHITELIST_FILE);
const whitelist    = new Set(Array.isArray(rawWhitelist) ? rawWhitelist : []);

let cryptoPrice       = cfg.cryptoInitialPrice;
let playedQuizzesToday = new Set();
const activeSessions  = {}; 

function savePlayers() { saveJSON(PLAYERS_FILE, players); }
function saveWhitelist() { saveJSON(WHITELIST_FILE, Array.from(whitelist)); }

// ── GRUP WHITELIST ───────────────────────────────────────────
function activateGroup(chatId) {
  whitelist.add(chatId);
  saveWhitelist(); 
  return `✅ Bot telah *diaktifkan* di grup ini!\nKetik *!menu* untuk melihat daftar game.`;
}

function deactivateGroup(chatId) {
  whitelist.delete(chatId);
  saveWhitelist(); 
  return `🛑 Bot telah *dinonaktifkan* di grup ini.`;
}

function isGroupActive(chatId) {
  if (!chatId.endsWith("@g.us")) return true; 
  return whitelist.has(chatId);
}

// ── PLAYER ──────────────────────────────────────────────────
function getPlayer(jid) {
  if (!players[jid]) {
    players[jid] = {
      jid,
      balance:        cfg.startingBalance,
      inventory:      [],
      crypto_balance: 0,
      has_debt:       false,
      debt_amount:    0,
      insurance:      { active: false },
      stats:          { wins: 0, losses: 0 }, 
      game_session:   { status: null, data: {} } 
    };
    savePlayers(); 
  }
  
  if (!players[jid].stats) players[jid].stats = { wins: 0, losses: 0 };
  if (!players[jid].game_session) players[jid].game_session = { status: null, data: {} };
  
  return players[jid];
}

function addBalance(jid, amount) {
  const p = getPlayer(jid);
  p.balance += amount;
  savePlayers(); 
  return amount;
}

function deductBalance(jid, amount) {
  const p = getPlayer(jid);
  // FIX BUGS: Clamp potongan agar saldo TIDAK PERNAH turun di bawah 0
  const actualDeduct = Math.min(amount, p.balance);
  p.balance = Math.max(0, p.balance - actualDeduct);

  // FIX BUGS: Jika saldo menjadi 0 dan asuransi aktif, pulihkan otomatis ke insurancePayoutAmount
  if (
    p.balance === 0 &&
    p.insurance &&
    p.insurance.active &&
    Date.now() < (p.insurance.expires_at || 0)
  ) {
    p.balance = cfg.insurancePayoutAmount;
    p.insurance.active = false;
    p.insurance.expires_at = null;
  }

  savePlayers();
  return actualDeduct; // FIX BUGS: Kembalikan jumlah aktual yang dipotong, bukan amount asli
}

function getLeaderboard(limit = 10) {
  return Object.values(players)
    .sort((a, b) => {
      const asetA = a.balance + (a.crypto_balance || 0) * cryptoPrice;
      const asetB = b.balance + (b.crypto_balance || 0) * cryptoPrice;
      return asetB - asetA;
    })
    .slice(0, limit);
}

// ── GROUP KAS ───────────────────────────────────────────────
function getGroup(chatId) {
  if (!groupData[chatId]) {
    groupData[chatId] = { chatId, cash_pool: 0, members: [] };
    saveJSON(GROUPS_FILE, groupData); 
  }
  return groupData[chatId];
}

function addCashPool(chatId, amount) {
  const g = getGroup(chatId);
  g.cash_pool += amount;
  saveJSON(GROUPS_FILE, groupData); 
}

function clearCashPool(chatId) {
  const g = getGroup(chatId);
  g.cash_pool = 0;
  saveJSON(GROUPS_FILE, groupData); 
}

function registerGroupMember(chatId, jid) {
  const g = getGroup(chatId);
  if (!g.members.includes(jid)) {
    g.members.push(jid);
    saveJSON(GROUPS_FILE, groupData); 
  }
}

// ── CRYPTO ───────────────────────────────────────────────────
function getCryptoPrice() { return cryptoPrice; }
function tickCryptoPrice() {
  const fluctuation = (Math.random() * 2 - 1) * cfg.cryptoPriceFluctuation;
  cryptoPrice = Math.max(1, Math.round(cryptoPrice * (1 + fluctuation)));
}
setInterval(tickCryptoPrice, cfg.cryptoPriceIntervalMs);

// ── QUIZ ─────────────────────────────────────────────────────
function isQuizPlayed(id) { return playedQuizzesToday.has(id); }
function markQuizPlayed(id) { playedQuizzesToday.add(id); }
function quizCount() { return playedQuizzesToday.size; }
function resetQuizzes() { playedQuizzesToday.clear(); }

// ── SESSION AKTIF ────────────────────────────────────────────
function setActiveSession(chatId, data) { activeSessions[chatId] = data; }
function getActiveSession(chatId) { return activeSessions[chatId] || null; }
function clearActiveSession(chatId) { delete activeSessions[chatId]; }

function scheduleMidnightReset() {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  setTimeout(() => { resetQuizzes(); scheduleMidnightReset(); }, next - now);
}
scheduleMidnightReset();

module.exports = {
  getPlayer, addBalance, deductBalance, savePlayers, getLeaderboard, 
  getGroup, addCashPool, clearCashPool, 
  registerGroupMember,                  
  registerMember: registerGroupMember,  
  activateGroup, deactivateGroup, isGroupActive,
  getCryptoPrice,
  isQuizPlayed, markQuizPlayed, quizCount, resetQuizzes,
  setActiveSession, getActiveSession, clearActiveSession,
  saveJSON, PLAYERS_FILE 
};