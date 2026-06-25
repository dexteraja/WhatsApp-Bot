// ============================================================
//  config.js — Master Configuration (V5.1)
// ============================================================

global.botConfig = {
  // ── EKONOMI ──
  startingBalance: 5000,
  dailyAmount: 1000,
  taxPercent: 6,
  transferTaxPercent: 5,
  debtMaxLoan: 5000,
  debtIncomeDeductPercent: 50,
  insurancePremium: 500,
  insuranceDurationDays: 3,
  insurancePayoutAmount: 1500,

  // ── KERJA ──
  workCooldownMs: 4 * 60 * 60 * 1000,  // 4 jam
  workReward: { min: 250, max: 600 },

  // ── CRYPTO ──
  cryptoName: "COLICOIN",
  cryptoInitialPrice: 100,
  cryptoPriceFluctuation: 0.20,
  cryptoPriceIntervalMs: 10000,

  // ── KASINO ──
  casinoCooldownMs: 3000,
  slotEmojis: ["🍒", "🍋", "💎", "🍇", "7️⃣", "🔔"],
  multipliers: {
    slotTriple:   5.0,
    slotDouble:   1.5,
    slotSeven:   10.0,
    blackjack:    2.0,
    blackjackBJ:  2.5,
    tebakAngka:   8.0,
    coinFlip:     2.0,
    suit:         2.0,
    ranjau:       1.5,
    dadu:         2.0,
    rolet:        3.0,
    roletHijau:  10.0,
    hilo:         2.0,
    spin:         2.5,
    spinJackpot:  5.0,
    balapkuda:    4.0,
    tebakkoin:    2.0,
    jackpotGanda: 3.0,
    bomberman:    2.0,
    // Game baru
    tebakkartu:   3.0,
    tebakwarna:   2.0,
    dadu3:        5.0,
    tebakganjilgenap: 2.0,
    kartupetak:   2.5,
    membalik:     3.0,
    tanggal:      6.0,
    tebakprima:   4.0,
    lemparkartu:  2.0,
    tebakdadu:    6.0,
    petarung:     2.0,
    lombarenang:  3.5,
    undian:       2.0,
    tembakbintang:3.0,
    pindahkoin:   2.0,
    naiktangga:   3.0,
    cuacahari:    2.5,
    bombparty:    4.0,
    tebakwaktu:   5.0,
    baccarat:     2.0,
    baccaratTie:  8.0,
    dragontiger:  2.0,
    dragontigerTie: 8.0,
  },

  // ── HUNT / MANCING / GACHA ──
  huntCooldownMs: 900000,
  huntItems: [
    { name: "Ayam",  emoji: "🐓", chance: 0.40, price: 100  },
    { name: "Celeng",emoji: "🐗", chance: 0.30, price: 250  },
    { name: "Rusa",  emoji: "🦌", chance: 0.20, price: 500  },
    { name: "Naga",  emoji: "🐉", chance: 0.10, price: 2000 }
  ],
  mancingItems: [
    { name: "Sepatu Bekas", emoji: "🥾", chance: 0.40, price: 10   },
    { name: "Ikan Lele",    emoji: "🐟", chance: 0.40, price: 150  },
    { name: "Ikan Mas",     emoji: "🐠", chance: 0.15, price: 400  },
    { name: "Hiu Putih",    emoji: "🦈", chance: 0.05, price: 3000 }
  ],
  gachaPrice: 1000,
  gachaItems: [
    { name: "Sampah",  emoji: "🗑️", chance: 0.50, price: 10    },
    { name: "Perak",   emoji: "🥈", chance: 0.30, price: 500   },
    { name: "Emas",    emoji: "🥇", chance: 0.15, price: 2500  },
    { name: "Berlian", emoji: "💎", chance: 0.05, price: 10000 }
  ],

  // ── TRIVIA ──
  maxQuizPerDay: 200,
  quizTimeoutMs: 30000,
  quizAnswerCooldownMs: 2000,
  quizReward: { min: 300, max: 600 },

  // ── KEAMANAN ──
  commandCooldownMs: 1000,
  rateLimitMax: 6,
  rateLimitWindowMs: 3000,
  rateLimitBanMs: 3600000,

  // ── KPK SYSTEM ──
  kpkInvestigasiThreshold: 50000,   // menang kasino > 50rb = kena radar KPK
  kpkRandomCatchChance:    0.05,    // 5% chance kena tiap transaksi besar

  // ── RAMPOK ──
  rampokCooldownMs: 30 * 60 * 1000,
  rampokSuccessChance: 0.40,
  rampokMaxCuri: 5000,

  // ── LOTERE ──
  lotereHargaTiket: 500,
  lotereMaxTiket: 10,

  // ── GUILD ──
  guildBiayaBuat: 2000,
  guildMaxAnggota: 20,

  // ── SAHAM ──
  sahamFluktuasi: 0.12,
  sahamIntervalMs: 15 * 60 * 1000,

  // ── GAME PREMIUM ──
  crashMaxMulti: 20.0,
  towerMaxLevel: 8,
  togelMaxBet:   50000,

  // ── PESAN SISTEM ──
  msg: {
    noBalance:   "❌ Koin tidak cukup.",
    debtBlocked: "🏦 Akses kasino ditolak. Lunasi utangmu dulu!",
    huntZonk:    "🍂 Tidak menemukan apa-apa. Coba lagi nanti.",
    quizFull:    "🛑 Kuis hari ini sudah habis.",
    quizLocked:  "⏳ Ada kuis yang sedang berjalan. Jawab dulu!",
    onCooldown:  (w) => `⏳ Sabar dulu *${w} detik* lagi.`,
    kpkBlocked:  "🚔 KPK memblokir transaksimu! Selesaikan kasus dulu: *!statuskpk*",
  }
};

module.exports = global.botConfig;