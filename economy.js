// ============================================================
//  economy.js — Financial Logic (VALIDATION FIXED)
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
  const earned = db.addBalance(jid, cfg.dailyAmount);
  const saldo  = db.getPlayer(jid).balance;
  const debtMsg = p.has_debt ? `\n🏦 Cicilan utang dipotong. Diterima bersih: *+${earned} koin*` : "";
  return `🎁 *Daily Claim!*\n+${cfg.dailyAmount} koin masuk ke saldo.${debtMsg}\n💳 Sekarang: *${saldo} koin*`;
}

const WORK_SCENES = [
  { text: "ngojek seharian", emoji: "🛵" },
  { text: "jaga warung tetangga", emoji: "🏪" },
  { text: "bantuin pindahan barang", emoji: "📦" },
  { text: "jualan gorengan di pinggir jalan", emoji: "🍟" },
  { text: "dapet job freelance desain logo", emoji: "🎨" },
  { text: "livestream sendirian tapi ada yang nonton", emoji: "🎮" },
  { text: "jualan pulsa dadakan", emoji: "📱" },
  { text: "compile tugas adik kelas atas nama manusiawi", emoji: "💻" },
  { text: "jagain parkiran mall 6 jam", emoji: "🅿️" },
  { text: "jadi kurir paket satu kecamatan", emoji: "📬" },
  { text: "bantu tetangga masang wifi", emoji: "📡" },
  { text: "jadi MC acara RT dadakan", emoji: "🎤" },
];

function cmdKerja(jid) {
  const p = db.getPlayer(jid);
  if (p.last_work) {
    const diff = Date.now() - new Date(p.last_work).getTime();
    if (diff < cfg.workCooldownMs) {
      const rem  = cfg.workCooldownMs - diff;
      const h    = Math.floor(rem / 3600000);
      const m    = Math.ceil((rem % 3600000) / 60000);
      return `😴 Masih capek! Bisa kerja lagi *${h}j ${m}m* lagi.`;
    }
  }
  const scene  = WORK_SCENES[Math.floor(Math.random() * WORK_SCENES.length)];
  const reward = Math.floor(Math.random() * (cfg.workReward.max - cfg.workReward.min + 1)) + cfg.workReward.min;
  p.last_work  = new Date().toISOString();
  const earned = db.addBalance(jid, reward);
  return `${scene.emoji} Kamu *${scene.text}* dan dapat *+${earned} koin*!\n💳 Saldo: ${db.getPlayer(jid).balance} koin`;
}

function cmdSaldo(jid) {
  const p      = db.getPlayer(jid);
  const stats  = p.stats;
  const total  = (stats.wins || 0) + (stats.losses || 0);
  const wr     = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
  const insAktif = p.insurance.active && Date.now() < (p.insurance.expires_at || 0);
  const insInfo  = insAktif ? `✅ s/d ${new Date(p.insurance.expires_at).toLocaleDateString("id-ID")}` : "❌ Tidak aktif";
  const cryptoVal = p.crypto_balance > 0 ? ` (≈${(p.crypto_balance * db.getCryptoPrice()).toLocaleString()} koin)` : "";

  return `💳 *Saldo @${jid.split("@")[0]}*\nKoin: *${p.balance.toLocaleString()}*\n` +
    (p.has_debt ? `Utang: ${p.debt_amount.toLocaleString()} koin ⚠️\n` : "") +
    `${cfg.cryptoName}: ${p.crypto_balance}${cryptoVal}\nAsuransi: ${insInfo}\n` +
    `Inventory: ${p.inventory.length} item | W/L: ${stats.wins}/${stats.losses} (${wr}%)`;
}

function cmdProfil(jid) {
  const p      = db.getPlayer(jid);
  const stats  = p.stats;
  const total  = (stats.wins || 0) + (stats.losses || 0);
  const wr     = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
  const aset   = p.balance + (p.crypto_balance || 0) * db.getCryptoPrice();

  let rank = "🥉 Pemula";
  if      (aset >= 100000) rank = "💎 Sultan";
  else if (aset >=  50000) rank = "🏆 Jutawan";
  else if (aset >=  20000) rank = "🥇 Kaya Raya";
  else if (aset >=  10000) rank = "🥈 Menengah Atas";
  else if (aset >=   5000) rank = "🥉 Cukupan";
  else                     rank = "💀 Bokek";

  return `👤 *Profil @${jid.split("@")[0]}*\nRank: ${rank}\nTotal aset: *${Math.floor(aset).toLocaleString()} koin*\n\n` +
    `💰 Saldo: ${p.balance.toLocaleString()} koin\n📈 ${cfg.cryptoName}: ${p.crypto_balance} koin\n` +
    `📦 Inventory: ${p.inventory.length} item\n` +
    (p.has_debt ? `⚠️ Utang: ${p.debt_amount.toLocaleString()} koin\n` : "") +
    `\n🎮 Total game: ${total}\nMenang: ${stats.wins} | Kalah: ${stats.losses} | WR: ${wr}%`;
}

function cmdLeaderboard() {
  const top    = db.getLeaderboard(10);
  const medals = ["🥇", "🥈", "🥉"];
  const rows   = top.map((p, i) => {
    const tag   = `@${p.jid.split("@")[0]}`;
    const aset  = Math.floor(p.balance + (p.crypto_balance || 0) * db.getCryptoPrice());
    const prefix = medals[i] || `${i + 1}.`;
    return `${prefix} ${tag} — *${aset.toLocaleString()} koin*`;
  }).join("\n");
  return `🏆 *Top 10 Terkaya*\n${rows}`;
}

function cmdPinjam(jid, amount) {
  const p = db.getPlayer(jid);
  if (p.has_debt) return `❌ Masih punya utang *${p.debt_amount.toLocaleString()} koin*. Lunasi dulu!`;
  if (!Number.isInteger(amount) || amount <= 0 || amount > cfg.debtMaxLoan)
    return `❌ Pinjaman tidak valid. Maksimal *${cfg.debtMaxLoan} koin*.`;
  p.has_debt    = true;
  p.debt_amount = amount;
  p.balance    += amount;
  db.savePlayers();
  return `🏦 *Pinjaman Cair!*\n+${amount} koin masuk ke saldo.\nSetiap pemasukan dipotong *${cfg.debtIncomeDeductPercent}%* sampai lunas.\n⚠️ Kasino dikunci sampai utang lunas.`;
}

function cmdBayarUtang(jid, amount) {
  const p = db.getPlayer(jid);
  if (!p.has_debt) return "❌ Kamu tidak punya utang.";
  if (!Number.isInteger(amount) || amount <= 0 || amount > p.balance)
    return "❌ Nominal tidak valid atau saldo kurang.";
  const pay      = Math.min(amount, p.debt_amount);
  p.balance     -= pay;
  p.debt_amount -= pay;
  if (p.debt_amount <= 0) { p.has_debt = false; p.debt_amount = 0; }
  db.savePlayers();
  return p.has_debt
    ? `🏦 Bayar *-${pay} koin*. Sisa utang: *${p.debt_amount} koin*.`
    : `🎉 *Utang Lunas!* Kasino kembali terbuka. Saldo: *${p.balance} koin*.`;
}

function cmdAsuransi(jid) {
  const p = db.getPlayer(jid);
  if (p.insurance.active && Date.now() < (p.insurance.expires_at || 0))
    return `❌ Asuransi masih aktif s/d ${new Date(p.insurance.expires_at).toLocaleDateString("id-ID")}.`;
  if (p.balance < cfg.insurancePremium) return cfg.msg.noBalance;
  p.balance            -= cfg.insurancePremium;
  p.insurance.active    = true;
  p.insurance.expires_at = Date.now() + (cfg.insuranceDurationDays * 86400000);
  db.savePlayers();
  return `🛡️ *Asuransi Aktif!*\n-${cfg.insurancePremium} koin untuk ${cfg.insuranceDurationDays} hari.\nJika saldo habis, otomatis dipulihkan ke *${cfg.insurancePayoutAmount} koin*.`;
}

function cmdCrypto() {
  return `📈 *Bursa ${cfg.cryptoName}*\nHarga: *${db.getCryptoPrice().toLocaleString()} koin* per koin\nBerfluktuasi otomatis tiap 10 menit.\n\n• !buycrypto [qty] — beli\n• !sellcrypto [qty] — jual`;
}

function cmdBuyCrypto(jid, qty) {
  if (!Number.isInteger(qty) || qty <= 0) return "❌ Masukkan jumlah yang valid.";
  const price = db.getCryptoPrice();
  const cost  = qty * price;
  const p     = db.getPlayer(jid);
  if (p.balance < cost) return `❌ Butuh *${cost.toLocaleString()} koin* untuk ${qty} ${cfg.cryptoName}.`;
  p.balance        -= cost;
  p.crypto_balance += qty;
  db.savePlayers();
  return `🛒 Beli *${qty} ${cfg.cryptoName}* @ ${price} koin\nTotal: -${cost.toLocaleString()} koin\n💳 Saldo: ${p.balance.toLocaleString()} koin`;
}

function cmdSellCrypto(jid, qty) {
  const p = db.getPlayer(jid);
  if (!Number.isInteger(qty) || qty <= 0 || p.crypto_balance < qty)
    return `❌ Kamu hanya punya *${p.crypto_balance} ${cfg.cryptoName}*.`;
  const price = db.getCryptoPrice();
  p.crypto_balance -= qty;
  db.savePlayers();
  const earned = db.addBalance(jid, qty * price);
  return `💰 Jual *${qty} ${cfg.cryptoName}* @ ${price} koin\nDiterima: *+${earned.toLocaleString()} koin*\n💳 Saldo: ${db.getPlayer(jid).balance.toLocaleString()} koin`;
}

function cmdTransfer(jid, toJidRaw, amount, chatId) {
  // Normalisasi target JID — handle @s.whatsapp.net, @lid, @g.us, teks @628xxx
  let toNumber = String(toJidRaw)
    .replace(/@[^@]+$/i, "")  // hapus domain apapun
    .replace(/[^0-9]/g, "");  // sisakan digit saja
  const toJid = `${toNumber}@s.whatsapp.net`;

  // Normalisasi JID pengirim agar konsisten
  const fromNumber = String(jid)
    .replace(/@[^@]+$/i, "")
    .replace(/[^0-9]/g, "");
  const fromJid = `${fromNumber}@s.whatsapp.net`;

  // Validasi nomor tujuan — minimal 9 digit, maks 15 digit (standar E.164)
  if (!toNumber || toNumber.length < 9 || toNumber.length > 15)
    return "❌ Nomor tujuan tidak valid. Gunakan format: *628xxxxxxxxxx*";

  // Validasi nominal — harus integer positif
  if (!Number.isInteger(amount) || amount <= 0)
    return "❌ Nominal transfer harus angka bulat lebih dari 0.";

  // Cegah transfer ke diri sendiri
  if (fromNumber === toNumber) return "❌ Tidak bisa transfer ke diri sendiri.";

  const from = db.getPlayer(fromJid);
  const tax  = Math.floor(amount * (cfg.transferTaxPercent / 100));
  const total = amount + tax;

  // Cek saldo mencukupi termasuk pajak sebelum deduct apapun
  if (from.balance < total)
    return `❌ Butuh *${total.toLocaleString()} koin* (transfer ${amount.toLocaleString()} + pajak ${tax.toLocaleString()}). Saldo kamu: *${from.balance.toLocaleString()} koin*.`;

  // Atomic — deduct pengirim, kredit penerima, kas grup
  from.balance -= total;
  db.savePlayers();
  db.addBalance(toJid, amount);
  db.addCashPool(chatId, tax);

  return (
    `💸 *Transfer Berhasil!*\n` +
    `Ke: @${toNumber}\n` +
    `Nominal: *${amount.toLocaleString()} koin*\n` +
    `Pajak: *${tax.toLocaleString()} koin* → Kas Grup\n` +
    `💳 Saldo sisa: *${from.balance.toLocaleString()} koin*`
  );
}

function cmdKasGrup(chatId) {
  const g = db.getGroup(chatId);
  return `🏦 *Kas Grup*\nTerkumpul: *${g.cash_pool.toLocaleString()} koin*\nMember: ${g.members.length} orang\nDiisi dari pajak transfer & kasino. Admin bisa gunakan *!bagikasbot* untuk bagi rata.`;
}

function cmdBagiKas(chatId, requesterJid, isAdmin) {
  if (!isAdmin) return "❌ Hanya *Admin Grup* yang bisa membagi kas!";
  const g = db.getGroup(chatId);
  if (g.cash_pool === 0) return "🏦 Kas masih kosong.";
  if (g.members.length === 0) return "❌ Belum ada member terdaftar.";
  const share = Math.floor(g.cash_pool / g.members.length);
  if (share === 0) return "❌ Kas terlalu sedikit untuk dibagi.";
  for (const m of g.members) db.addBalance(m, share);
  db.clearCashPool(chatId);
  return `🎉 *Kas Dibagi!*\n${g.members.length} member masing-masing dapat *+${share} koin*.`;
}

module.exports = {
  cmdDaily, cmdKerja, cmdSaldo, cmdProfil, cmdLeaderboard, cmdPinjam, cmdBayarUtang, cmdAsuransi,
  cmdCrypto, cmdBuyCrypto, cmdSellCrypto, cmdTransfer, cmdKasGrup, cmdBagiKas
};