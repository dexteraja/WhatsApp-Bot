// ============================================================
//  economy.js — Financial Logic (DYNAMIC VALUATION FIXED)
// ============================================================
require("./config");
const cfg = global.botConfig;
const db  = require("./db");

function cmdDaily(jid) {
  const p = db.getPlayer(jid);
  if (p.last_daily) {
    const diff = Date.now() - new Date(p.last_daily).getTime();
    if (diff < 86400000) {
      const h = Math.ceil((86400000 - diff) / 3600000);
      return `⏳ Daily sudah diklaim. Balik lagi *${h} jam* lagi.`;
    }
  }
  p.last_daily = new Date().toISOString();
  const earned = db.addBalance(jid, cfg.dailyAmount || 1000);
  const saldo  = db.getPlayer(jid).balance;
  const debtMsg = p.has_debt ? `\n🏦 Cicilan utang dipotong. Diterima bersih: *+${earned} koin*` : "";
  return `🎁 *Daily Claim!*\n+${cfg.dailyAmount || 1000} koin masuk ke saldo.${debtMsg}\n💳 Sekarang: *${saldo} koin*`;
}

const WORK_SCENES = [
  { text: "ngojek seharian", emoji: "🛵" },
  { text: "jaga warung tetangga", emoji: "🏪" },
  { text: "bantuin pindahan barang", emoji: "📦" },
  { text: "jualan gorengan di pinggir jalan", emoji: "🍟" },
  { text: "dapet job freelance desain logo", emoji: "🎨" },
  { text: "livestream sendirian tapi ada yang nonton", emoji: "🎮" },
  { text: "jualan pulsa dadakan", emoji: "📱" },
  { text: "jagain parkiran mall 6 jam", emoji: "🅿️" },
  { text: "jadi kurir paket satu kecamatan", emoji: "📬" },
];

function cmdKerja(jid) {
  const p = db.getPlayer(jid);
  if (p.last_work) {
    const diff = Date.now() - new Date(p.last_work).getTime();
    if (diff < (cfg.workCooldownMs || 300000)) {
      const rem  = (cfg.workCooldownMs || 300000) - diff;
      const h    = Math.floor(rem / 3600000);
      const m    = Math.ceil((rem % 3600000) / 60000);
      return `😴 Masih capek! Bisa kerja lagi *${h}j ${m}m* lagi.`;
    }
  }
  const scene  = WORK_SCENES[Math.floor(Math.random() * WORK_SCENES.length)];
  const minR   = (cfg.workReward && cfg.workReward.min) ? cfg.workReward.min : 500;
  const maxR   = (cfg.workReward && cfg.workReward.max) ? cfg.workReward.max : 1500;
  const reward = Math.floor(Math.random() * (maxR - minR + 1)) + minR;
  p.last_work  = new Date().toISOString();
  const earned = db.addBalance(jid, reward);
  return `${scene.emoji} Kamu *${scene.text}* dan dapat *+${earned} koin*!\n💳 Saldo: ${db.getPlayer(jid).balance} koin`;
}

function cmdSaldo(jid) {
  const p      = db.getPlayer(jid);
  const stats  = p.stats || { wins: 0, losses: 0 };
  const total  = (stats.wins || 0) + (stats.losses || 0);
  const wr     = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
  const insAktif = p.insurance && p.insurance.active && Date.now() < (p.insurance.expires_at || 0);
  const insInfo  = insAktif ? `✅ s/d ${new Date(p.insurance.expires_at).toLocaleDateString("id-ID")}` : "❌ Tidak aktif";
  const cryptoVal = p.crypto_balance > 0 ? ` (≈${(p.crypto_balance * db.getCryptoPrice()).toLocaleString()} koin)` : "";
  const propCount = p.properti ? p.properti.length : 0;

  return `💳 *Saldo @${jid.split("@")[0]}*\nKoin: *${(p.balance || 0).toLocaleString()}*\n` +
    (p.has_debt ? `Utang: ${(p.debt_amount || 0).toLocaleString()} koin ⚠️\n` : "") +
    `${cfg.cryptoName || "Crypto"}: ${p.crypto_balance || 0}${cryptoVal}\nAsuransi: ${insInfo}\n` +
    `Inventory: ${(p.inventory || []).length} item | Properti: ${propCount} item | W/L: ${stats.wins}/${stats.losses} (${wr}%)`;
}

function cmdProfil(jid) {
  const p      = db.getPlayer(jid);
  const stats  = p.stats || { wins: 0, losses: 0 };
  const total  = (stats.wins || 0) + (stats.losses || 0);
  const wr     = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
  
  let assetWealth = 0;
  if (p.properti && Array.isArray(p.properti)) {
    p.properti.forEach(item => {
      const id = typeof item === 'string' ? item.toLowerCase() : (item.id ? item.id.toLowerCase() : "");
      const match = cfg.assets.find(as => as.id.toLowerCase() === id);
      if (match) assetWealth += (match.price || 0);
    });
  }

  const totalAset = (p.balance || 0) + ((p.crypto_balance || 0) * db.getCryptoPrice()) + assetWealth;

  let rank = "🥉 Pemula";
  if      (totalAset >= 1000000000) rank = "👑 Penguasa Bumi";
  else if (totalAset >= 100000000)  rank = "🏰 Konglomerat";
  else if (totalAset >= 1000000)    rank = "💎 Sultan";
  else if (totalAset >= 50000)      rank = "🏆 Jutawan";
  else                              rank = "💀 Bokek";

  return `👤 *Profil @${jid.split("@")[0]}*\nRank: ${rank}\nTotal Real Aset: *${Math.floor(totalAset).toLocaleString()} koin*\n\n` +
    `💰 Saldo Cash: ${(p.balance || 0).toLocaleString()} koin\n` +
    `📈 Valuation Crypto: ${((p.crypto_balance || 0) * db.getCryptoPrice()).toLocaleString()} koin\n` +
    `🏢 Valuasi Properti: ${assetWealth.toLocaleString()} koin\n` +
    `📦 Inventory: ${(p.inventory || []).length} item\n` +
    (p.has_debt ? `⚠️ Utang: ${(p.debt_amount || 0).toLocaleString()} koin\n` : "") +
    `\n🎮 Total game: ${total}\nMenang: ${stats.wins} | Kalah: ${stats.losses} | WR: ${wr}%`;
}

function cmdLeaderboard() {
  const top    = db.getLeaderboard(10);
  const medals = ["🥇", "🥈", "🥉"];
  const rows   = top.map((p, i) => {
    const tag   = `@${p.jid.split("@")[0]}`;
    
    let assetWealth = 0;
    if (p.properti && Array.isArray(p.properti)) {
      p.properti.forEach(item => {
        const id = typeof item === 'string' ? item.toLowerCase() : (item.id ? item.id.toLowerCase() : "");
        const match = cfg.assets.find(as => as.id.toLowerCase() === id);
        if (match) assetWealth += (match.price || 0);
      });
    }

    const netWorth = Math.floor((p.balance || 0) + (p.crypto_balance || 0) * db.getCryptoPrice() + assetWealth);
    const prefix = medals[i] || `${i + 1}.`;
    return `${prefix} ${tag} — *${netWorth.toLocaleString()} koin*`;
  }).join("\n");
  return `🏆 *Top 10 Terkaya*\n${rows}`;
}

function cmdPinjam(jid, amount) {
  const p = db.getPlayer(jid);
  if (p.has_debt) return `❌ Masih punya utang *${(p.debt_amount || 0).toLocaleString()} koin*. Lunasi dulu!`;
  if (!Number.isInteger(amount) || amount <= 0 || amount > (cfg.debtMaxLoan || 5000))
    return `❌ Pinjaman tidak valid. Maksimal *${(cfg.debtMaxLoan || 5000).toLocaleString()} koin*.`;
  p.has_debt    = true;
  p.debt_amount = amount;
  p.balance     = (p.balance || 0) + amount;
  db.savePlayers();
  return `🏦 *Pinjaman Cair!*\n+${amount.toLocaleString()} koin masuk ke saldo.\nSetiap pemasukan dipotong *${cfg.debtIncomeDeductPercent || 50}%* sampai lunas.\n⚠️ Kasino dikunci sampai utang lunas.`;
}

function cmdBayarUtang(jid, amount) {
  const p = db.getPlayer(jid);
  if (!p.has_debt) return "❌ Kamu tidak punya utang.";
  if (!Number.isInteger(amount) || amount <= 0 || amount > (p.balance || 0))
    return "❌ Nominal tidak valid atau saldo kurang.";
  const pay      = Math.min(amount, p.debt_amount);
  p.balance     = (p.balance || 0) - pay;
  p.debt_amount = (p.debt_amount || 0) - pay;
  if (p.debt_amount <= 0) { p.has_debt = false; p.debt_amount = 0; }
  db.savePlayers();
  return p.has_debt
    ? `🏦 Bayar *-${pay.toLocaleString()} koin*. Sisa utang: *${p.debt_amount.toLocaleString()} koin*.`
    : `🎉 *Utang Lunas!* Kasino kembali terbuka. Saldo: *${(p.balance || 0).toLocaleString()} koin*.`;
}

function cmdAsuransi(jid) {
  const p = db.getPlayer(jid);
  if (p.insurance && p.insurance.active && Date.now() < (p.insurance.expires_at || 0))
    return `❌ Asuransi masih aktif s/d ${new Date(p.insurance.expires_at).toLocaleDateString("id-ID")}.`;
  if ((p.balance || 0) < (cfg.insurancePremium || 500)) return "❌ Koin tidak cukup.";
  p.balance            = (p.balance || 0) - (cfg.insurancePremium || 500);
  if (!p.insurance) p.insurance = {};
  p.insurance.active    = true;
  p.insurance.expires_at = Date.now() + ((cfg.insuranceDurationDays || 3) * 86400000);
  db.savePlayers();
  return `🛡️ *Asuransi Aktif!*\n-${(cfg.insurancePremium || 500)} koin untuk ${cfg.insuranceDurationDays || 3} hari.\nJika saldo habis, otomatis dipulihkan ke *${cfg.insurancePayoutAmount || 1500} koin*.`;
}

function cmdCrypto() {
  return `📈 *Bursa ${cfg.cryptoName || "Crypto"}*\nHarga: *${db.getCryptoPrice().toLocaleString()} koin* per koin\nBerfluktuasi otomatis tiap 10 menit.\n\n• !buycrypto [qty] — beli\n• !sellcrypto [qty] — jual`;
}

function cmdBuyCrypto(jid, qty) {
  if (!Number.isInteger(qty) || qty <= 0) return "❌ Masukkan jumlah yang valid.";
  const price = db.getCryptoPrice();
  const cost  = qty * price;
  const p     = db.getPlayer(jid);
  if ((p.balance || 0) < cost) return `❌ Butuh *${cost.toLocaleString()} koin* untuk ${qty} ${cfg.cryptoName || "Crypto"}.`;
  p.balance        = (p.balance || 0) - cost;
  p.crypto_balance = (p.crypto_balance || 0) + qty;
  db.savePlayers();
  return `🛒 Beli *${qty} ${cfg.cryptoName || "Crypto"}* @ ${price} koin\nTotal: -${cost.toLocaleString()} koin\n💳 Saldo: ${(p.balance || 0).toLocaleString()} koin`;
}

function cmdSellCrypto(jid, qty) {
  const p = db.getPlayer(jid);
  if (!Number.isInteger(qty) || qty <= 0 || (p.crypto_balance || 0) < qty)
    return `❌ Kamu hanya punya *${p.crypto_balance || 0} ${cfg.cryptoName || "Crypto"}*.`;
  const price = db.getCryptoPrice();
  p.crypto_balance = (p.crypto_balance || 0) - qty;
  db.savePlayers();
  const earned = db.addBalance(jid, qty * price);
  return `💰 Jual *${qty} ${cfg.cryptoName || "Crypto"}* @ ${price} koin\nDiterima: *+${earned.toLocaleString()} koin*\n💳 Saldo: ${db.getPlayer(jid).balance.toLocaleString()} koin`;
}

// ── REVISI TOTAL TRANSFER SINKRON DATABASE (FIXED) ──
function cmdTransfer(jid, toJidRaw, amount, chatId) {
  // Membersihkan ID pengirim secara presisi menggunakan split wa.net
  const fromJid = jid.split(":")[0].split("@")[0] + "@s.whatsapp.net";
  
  // Ambil hanya angka numerik dari target pengiriman
  let toNumber = String(toJidRaw).replace(/@[^@]+$/i, "").replace(/[^0-9]/g, "");
  if (!toNumber || toNumber.length < 9 || toNumber.length > 15) {
    return "❌ Format nomor salah. Gunakan langsung nomor WA atau tag membernya.";
  }
  const toJid = `${toNumber}@s.whatsapp.net`;

  if (fromJid === toJid) return "❌ Transaksi ditolak. Tidak bisa transfer ke diri sendiri.";
  if (!Number.isInteger(amount) || amount <= 0) return "❌ Nominal transfer harus angka positif.";

  const from = db.getPlayer(fromJid);
  const taxPercent = cfg.transferTaxPercent !== undefined ? cfg.transferTaxPercent : 5;
  const tax  = Math.floor(amount * (taxPercent / 100));
  const total = amount + tax;

  if ((from.balance || 0) < total) {
    return `❌ Saldo Anda tidak mencukupi!\n` +
           `• Nominal: *${amount.toLocaleString()} koin*\n` +
           `• Pajak (${taxPercent}%): *${tax.toLocaleString()} koin*\n` +
           `• Total Potong: *${total.toLocaleString()} koin*\n` +
           `• Saldo saat ini: *${(from.balance || 0).toLocaleString()} koin*`;
  }

  // Melakukan modifikasi saldo langsung secara aman
  from.balance -= total;
   // Memasukkan dana ke akun tujuan
  db.addBalance(toJid, amount);
  db.addCashPool(chatId, tax);
  db.savePlayers(); 

 

  return `💸 *TRANSFER KOIN BERHASIL!* 💸\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `📤 *Pengirim:* @${fromJid.split("@")[0]}\n` +
         `📥 *Penerima:* @${toNumber}\n` +
         `💰 *Nominal:* *${amount.toLocaleString()} koin*\n` +
         `🏛️ *Pajak Transfer:* *${tax.toLocaleString()} koin* (Kas Grup)\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `💳 *Sisa Saldo:* *${from.balance.toLocaleString()} koin*`;
}

function cmdKasGrup(chatId) {
  const g = db.getGroup(chatId);
  return `🏦 *Kas Grup*\nTerkumpul: *${(g.cash_pool || 0).toLocaleString()} koin*\nMember: ${(g.members || []).length} orang\nDiisi dari pajak transfer & kasino. Admin bisa gunakan *!bagikasbot* untuk bagi rata.`;
}

function cmdBagiKas(chatId, requesterJid, isAdmin) {
  if (!isAdmin) return "❌ Hanya *Admin Grup* yang bisa membagi kas!";
  const g = db.getGroup(chatId);
  if (!g.cash_pool || g.cash_pool === 0) return "🏦 Kas masih kosong.";
  if (!g.members || g.members.length === 0) return "❌ Belum ada member terdaftar.";
  const share = Math.floor(g.cash_pool / g.members.length);
  if (share === 0) return "❌ Kas terlalu sedikit untuk dibagi.";
  for (const m of g.members) db.addBalance(m, share);
  db.clearCashPool(chatId);
  return `🎉 *Kas Dibagi!*\n${g.members.length} member masing-masing dapat *+${share.toLocaleString()} koin*.`;
}

// ── COMMAND PAJAK DIJAMIN SINKRON 100% DENGAN !ASETKU ──
function cmdPajak(jid) {
  // Pastikan JID bersih dari sub-id Termux/Multi-Device multi-session
  const cleanJid = jid.split(":")[0].split("@")[0] + "@s.whatsapp.net";
  const p = db.getPlayer(cleanJid);
  const now = Date.now();
  const interval = (cfg && cfg.taxSystem && cfg.taxSystem.intervalMs) || 86400000;
  const nextTax = interval - (now - (p.last_tax_paid || now));
  const hoursLeft = Math.max(0, Math.ceil(nextTax / 3600000));

  const cryptoPrice = db.getCryptoPrice();
  const cryptoValue = (p.crypto_balance || 0) * cryptoPrice;
  
  let assetWealth = 0;
  let assetTax = 0;
  let assetReport = [];

  // MEMBACA DARI p.properti BIAR SAMA PERSIS DENGAN !ASETKU
  if (p.properti && Array.isArray(p.properti)) {
    for (const item of p.properti) {
      const cleanAssetId = typeof item === 'string' ? item.toLowerCase() : (item.id ? item.id.toLowerCase() : "");
      let assetInfo = cfg.assets ? cfg.assets.find(a => a.id.toLowerCase() === cleanAssetId) : null;
      
      // Inject fallback aman khusus Lamborghini Aventador
      if (cleanAssetId === "lamborghini_aventador" && !assetInfo) {
        assetInfo = { id: "lamborghini_aventador", name: "Lamborghini Aventador", emoji: "🏎️", price: 12000000000, tax: 80000000 };
      }

      if (assetInfo) {
        let currentTax = (cleanAssetId === "lamborghini_aventador" || assetInfo.name?.toLowerCase() === "lamborghini aventador") 
          ? 80000000 
          : (assetInfo.tax || 0);

        assetWealth += (assetInfo.price || 0);
        assetTax += currentTax;
        assetReport.push(`  • ${assetInfo.emoji || "📦"} *${assetInfo.name}*\n    └ Valuasi: ${(assetInfo.price || 0).toLocaleString()} koin | Pajak: ${currentTax.toLocaleString()} koin`);
      }
    }
  }

  let totalWealth = (p.balance || 0) + cryptoValue + assetWealth;

  let incomeTaxRate = 0;
  if (cfg && cfg.taxSystem && Array.isArray(cfg.taxSystem.brackets)) {
    for (const bracket of cfg.taxSystem.brackets) {
      if (totalWealth >= bracket.minWealth) {
        incomeTaxRate = bracket.rate;
        break;
      }
    }
  }

  const estIncomeTax = Math.floor(totalWealth * incomeTaxRate);
  const totalEstTax = estIncomeTax + assetTax;

  return `🏛️ *DIREKTORAT JENDERAL PAJAK BOT* 🏛️\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `👤 *Wajib Pajak:* @${cleanJid.split("@")[0]}\n\n` +
         `💰 *1. RINCIAN KEKAYAAN BERSIH*\n` +
         `  • Saldo Cash: *${(p.balance || 0).toLocaleString()} koin*\n` +
         `  • Valuasi Crypto: *${cryptoValue.toLocaleString()} koin* (${p.crypto_balance || 0} ${cfg.cryptoName || "Crypto"})\n` +
         `  • Nilai Properti/Aset: *${assetWealth.toLocaleString()} koin*\n` +
         `  ➡️ *Total Kekayaan:* *${totalWealth.toLocaleString()} koin*\n\n` +
         `📋 *2. INVENTARIS ASET TETAP & MEWAH*\n` +
         (assetReport.length > 0 ? assetReport.join("\n") : "  • _Tidak memiliki aset mewah / belum ada terdaftar_") + "\n\n" +
         `📊 *3. LOGIKA & SKEMA PERHITUNGAN PAJAK*\n` +
         `  • Tarif Pajak Progresif Pokok (PPh): *${(incomeTaxRate * 100).toFixed(0)}%*\n` +
         `  • Nominal Pajak Pokok: *${estIncomeTax.toLocaleString()} koin*\n` +
         `  • Nominal Pajak Khusus Aset (PKB/PBB): *${assetTax.toLocaleString()} koin*\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `🚨 *TOTAL TAGIHAN:* *${totalEstTax.toLocaleString()} koin*\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `⏳ *Jatuh Tempo:* *${hoursLeft} jam* lagi.\n` +
         `_Sistem akan memotong saldo koin kamu secara otomatis saat jatuh tempo via Auto-Debet._`;
}

function cmdBeliAset(jid, assetId) {
  const p = db.getPlayer(jid);
  const assetInfo = cfg.assets.find(a => a.id === assetId.toLowerCase());
  
  if (!assetInfo) return `❌ Aset tidak ditemukan. Gunakan !shop untuk melihat daftar.`;
  if (p.properti.includes(assetInfo.id)) return `❌ Kamu sudah memiliki ${assetInfo.name}!`;
  if ((p.balance || 0) < assetInfo.price) return `❌ Saldo tidak cukup. Butuh *${assetInfo.price.toLocaleString()} koin*.`;

  p.balance = (p.balance || 0) - assetInfo.price;
  p.properti.push(assetInfo.id);
  db.savePlayers();

  return `🎉 Selamat! Kamu resmi membeli *${assetInfo.emoji} ${assetInfo.name}* seharga ${assetInfo.price.toLocaleString()} koin.\n⚠️ Ingat, aset ini memiliki pajak ${assetInfo.tax.toLocaleString()} koin per siklus.`;
}

module.exports = {
  cmdDaily, cmdKerja, cmdSaldo, cmdProfil, cmdLeaderboard, cmdPinjam, cmdBayarUtang, cmdAsuransi,
  cmdCrypto, cmdBuyCrypto, cmdSellCrypto, cmdTransfer, cmdKasGrup, cmdBagiKas, cmdPajak, cmdBeliAset
};