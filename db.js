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

const dirtyFiles = new Set();

function saveJSON(filePath, data) {
  dirtyFiles.add(filePath);
}

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

const players    = loadJSON(PLAYERS_FILE);
const groupData  = loadJSON(GROUPS_FILE);
const rawWhitelist = loadJSON(WHITELIST_FILE);
const whitelist    = new Set(Array.isArray(rawWhitelist) ? rawWhitelist : []);

let cryptoPrice       = cfg.cryptoInitialPrice || 1000;
let playedQuizzesToday = new Set();
const activeSessions  = {}; 

function savePlayers() { saveJSON(PLAYERS_FILE, players); }
function saveWhitelist() { saveJSON(WHITELIST_FILE, Array.from(whitelist)); }

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

function getPlayer(jid) {
  // 1. Jika user belum terdaftar sama sekali di database, buat template baru
  if (!players[jid]) {
    players[jid] = {
      jid,
      balance:        cfg.startingBalance || 5000,
      inventory:      [],
      properti:       [], 
      crypto_balance: 0,
      has_debt:       false,
      debt_amount:    0,
      insurance:      { active: false },
      stats:          { wins: 0, losses: 0 }, 
      game_session:   { status: null, data: {} },
      last_tax_paid:  Date.now()
    };
    savePlayers(); 
  }
  
  // 2. KUNCI AMAN: Jangan pernah timpa data lama jika sudah ada!
  // Cukup pastikan struktur array properti dan inventory tersedia jika undefined
  if (!players[jid].properti) players[jid].properti = [];
  if (!players[jid].inventory) players[jid].inventory = [];
  if (!players[jid].stats) players[jid].stats = { wins: 0, losses: 0 };
  if (!players[jid].game_session) players[jid].game_session = { status: null, data: {} };
  if (!players[jid].last_tax_paid) players[jid].last_tax_paid = Date.now();
  
  // 3. SAFE PARSING: Jika saldo tidak sengaja tersimpan sebagai string, ubah ke Number secara aman
  if (typeof players[jid].balance === "string") {
    players[jid].balance = parseInt(players[jid].balance, 10) || 0;
  }
  
  // Jika karena suatu hal nilainya benar-benar NaN atau tidak ada, baru gunakan fallback
  if (players[jid].balance === undefined || isNaN(players[jid].balance)) {
    players[jid].balance = cfg.startingBalance || 5000;
  }
  
  return players[jid];
}

function addBalance(jid, amount) {
  const p = getPlayer(jid);
  // Pastikan nilai penambah adalah integer bersih
  const validAmount = parseInt(amount, 10);
  if (isNaN(validAmount)) return 0;

  p.balance += validAmount;
  savePlayers(); 
  return validAmount;
}

function deductBalance(jid, amount) {
  const p = getPlayer(jid);
  const validAmount = parseInt(amount, 10);
  if (isNaN(validAmount)) return 0;

  const actualDeduct = Math.min(validAmount, p.balance);
  p.balance = Math.max(0, p.balance - actualDeduct);

  if (
    p.balance === 0 &&
    p.insurance &&
    p.insurance.active &&
    Date.now() < (p.insurance.expires_at || 0)
  ) {
    p.balance = cfg.insurancePayoutAmount || 1500;
    p.insurance.active = false;
    p.insurance.expires_at = null;
  }

  savePlayers();
  return actualDeduct;
}

function addBalance(jid, amount) {
  const p = getPlayer(jid);
  if (isNaN(p.balance)) p.balance = cfg.startingBalance || 5000;
  p.balance += amount;
  savePlayers(); 
  return amount;
}

function deductBalance(jid, amount) {
  const p = getPlayer(jid);
  if (isNaN(p.balance)) p.balance = cfg.startingBalance || 5000;
  const actualDeduct = Math.min(amount, p.balance);
  p.balance = Math.max(0, p.balance - actualDeduct);

  if (
    p.balance === 0 &&
    p.insurance &&
    p.insurance.active &&
    Date.now() < (p.insurance.expires_at || 0)
  ) {
    p.balance = cfg.insurancePayoutAmount || 1500;
    p.insurance.active = false;
    p.insurance.expires_at = null;
  }

  savePlayers();
  return actualDeduct;
}

function getLeaderboard(limit = 10) {
  return Object.values(players)
    .sort((a, b) => {
      let wealthA = (a.balance || 0) + ((a.crypto_balance || 0) * cryptoPrice);
      (a.properti || []).forEach(item => {
        const id = typeof item === 'string' ? item.toLowerCase() : (item.id ? item.id.toLowerCase() : "");
        const match = cfg.assets.find(as => as.id.toLowerCase() === id);
        if (match) wealthA += (match.price || 0);
      });

      let wealthB = (b.balance || 0) + ((b.crypto_balance || 0) * cryptoPrice);
      (b.properti || []).forEach(item => {
        const id = typeof item === 'string' ? item.toLowerCase() : (item.id ? item.id.toLowerCase() : "");
        const match = cfg.assets.find(as => as.id.toLowerCase() === id);
        if (match) wealthB += (match.price || 0);
      });

      return wealthB - wealthA;
    })
    .slice(0, limit);
}

function getGroup(chatId) {
  if (!groupData[chatId]) {
    groupData[chatId] = { chatId, cash_pool: 0, members: [] };
    saveJSON(GROUPS_FILE, groupData); 
  }
  return groupData[chatId];
}

function addCashPool(chatId, amount) {
  const g = getGroup(chatId);
  g.cash_pool = (g.cash_pool || 0) + amount;
  saveJSON(GROUPS_FILE, groupData); 
}

function clearCashPool(chatId) {
  const g = getGroup(chatId);
  g.cash_pool = 0;
  saveJSON(GROUPS_FILE, groupData); 
}

function registerGroupMember(chatId, jid) {
  const g = getGroup(chatId);
  if (!g.members) g.members = [];
  if (!g.members.includes(jid)) {
    g.members.push(jid);
    saveJSON(GROUPS_FILE, groupData); 
  }
}

// ── SISTEM PAJAK BACKGROUND LOOP (SINKRON DENGAN PROPERTI.JS) ──
setInterval(() => {
  const now = Date.now();

  for (const jid in players) {
    const p = players[jid];
    if (!p.last_tax_paid) p.last_tax_paid = now;
    
    const interval = (cfg && cfg.taxSystem && cfg.taxSystem.intervalMs) || 86400000;

    if (now - p.last_tax_paid >= interval) {
      let totalWealth = (p.balance || 0) + ((p.crypto_balance || 0) * cryptoPrice);
      let assetTax = 0;

      // Membaca array properti secara sinkron
      if (p.properti && Array.isArray(p.properti)) {
        for (const item of p.properti) {
          const cleanId = typeof item === 'string' ? item.toLowerCase() : (item.id ? item.id.toLowerCase() : "");
          const assetInfo = cfg.assets ? cfg.assets.find(a => a.id.toLowerCase() === cleanId) : null;
          
          if (cleanId === "lamborghini_aventador" || (assetInfo && assetInfo.name?.toLowerCase() === "lamborghini aventador")) {
            if (assetInfo) totalWealth += (assetInfo.price || 0);
            assetTax += 80000000; // Ketetapan Pajak Lamborghini Aventador 80 Juta
          } else if (assetInfo) {
            totalWealth += (assetInfo.price || 0);
            assetTax += (assetInfo.tax || 0);
          }
        }
      }

      let incomeTaxRate = 0;
      if (cfg && cfg.taxSystem && Array.isArray(cfg.taxSystem.brackets)) {
        for (const bracket of cfg.taxSystem.brackets) {
          if (totalWealth >= bracket.minWealth) {
            incomeTaxRate = bracket.rate;
            break;
          }
        }
      }

      const incomeTaxAmount = Math.floor(totalWealth * incomeTaxRate);
      const totalTax = incomeTaxAmount + assetTax;

      if (totalTax > 0) {
        p.balance = Math.max(0, (p.balance || 0) - totalTax);
      }
      
      p.last_tax_paid = now;
      dirtyFiles.add(PLAYERS_FILE);
    }
  }
}, 60 * 60 * 1000);

function getCryptoPrice() { return cryptoPrice; }
function tickCryptoPrice() {
  const fluctuation = (Math.random() * 2 - 1) * (cfg.cryptoPriceFluctuation || 0.05);
  cryptoPrice = Math.max(1, Math.round(cryptoPrice * (1 + fluctuation)));
}
setInterval(tickCryptoPrice, cfg.cryptoPriceIntervalMs || 600000);

function isQuizPlayed(id) { return playedQuizzesToday.has(id); }
function markQuizPlayed(id) { playedQuizzesToday.add(id); }
function quizCount() { return playedQuizzesToday.size; }
function resetQuizzes() { playedQuizzesToday.clear(); }

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
  saveJSON, PLAYERS_FILE, players
};