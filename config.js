// ============================================================
//  config.js — Master Configuration (V5.1)
// ============================================================

global.botConfig = {
  // ── EKONOMI ──
  startingBalance: 5000,
  dailyAmount: 1000,
  taxPercent: 5,
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
  cryptoPriceIntervalMs: 600000,

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
  quizReward: { min: 200, max: 500 },

  // ── KEAMANAN ──
  commandCooldownMs: 1500,
  rateLimitMax: 6,
  rateLimitWindowMs: 3000,
  rateLimitBanMs: 3600000,

  // ── PESAN SISTEM ──
  msg: {
    noBalance:   "❌ Koin tidak cukup.",
    debtBlocked: "🏦 Akses kasino ditolak. Lunasi utangmu dulu!",
    huntZonk:    "🍂 Tidak menemukan apa-apa. Coba lagi nanti.",
    quizFull:    "🛑 Kuis hari ini sudah habis.",
    quizLocked:  "⏳ Ada kuis yang sedang berjalan. Jawab dulu!",
    onCooldown:  (w) => `⏳ Sabar dulu *${w} detik* lagi.`,
  }
};

module.exports = global.botConfig;