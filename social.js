// ============================================================
//  social.js — Guild, Misi, Lotere, Saham, Rampok, Toko Buff
// ============================================================
require("./config");
const cfg = global.botConfig;
const db  = require("./db");
const fs  = require("fs");

const GUILD_FILE   = "./database_guilds.json";
const SAHAM_FILE   = "./database_saham.json";
const LOTERE_FILE  = "./database_lotere.json";

// ══════════════════════════════════════════════════════════════
//  DB HELPER SOSIAL
// ══════════════════════════════════════════════════════════════
function loadSocial(path) {
  try {
    if (fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch(e) {}
  return {};
}
function saveSocial(path, data) {
  fs.writeFile(path, JSON.stringify(data, null, 2), "utf8", () => {});
}

let guildDB  = loadSocial(GUILD_FILE);
let sahamDB  = loadSocial(SAHAM_FILE);
let lotereDB = loadSocial(LOTERE_FILE);

// Auto-save tiap 5 detik
setInterval(() => {
  saveSocial(GUILD_FILE,  guildDB);
  saveSocial(SAHAM_FILE,  sahamDB);
  saveSocial(LOTERE_FILE, lotereDB);
}, 5000);

// ══════════════════════════════════════════════════════════════
//  TOKO BUFF — item sementara yang boost performa
// ══════════════════════════════════════════════════════════════
const BUFF_CATALOG = [
  { id: "kerja2x",   nama: "Buff Kerja 2x",      emoji: "⚡", harga: 500,  durasi: 60,   efek: "kerja_multi", nilai: 2.0    },
  { id: "lucky",     nama: "Jimat Lucky",         emoji: "🍀", harga: 800,  durasi: 30,   efek: "kasino_luck", nilai: 0.1    },
  { id: "shield",    nama: "Perisai Rampok",      emoji: "🛡️", harga: 600,  durasi: 120,  efek: "anti_rampok", nilai: 1      },
  { id: "huntpro",   nama: "Kail Pro",            emoji: "🎣", harga: 400,  durasi: 90,   efek: "hunt_rare",   nilai: 0.15   },
  { id: "vip",       nama: "VIP Pass",            emoji: "💎", harga: 2000, durasi: 1440, efek: "vip",         nilai: 1      },
  { id: "dobelin",   nama: "Dobelin Income",      emoji: "💰", harga: 1500, durasi: 120,  efek: "income_2x",   nilai: 2.0    },
];

function getBuffById(id) { return BUFF_CATALOG.find(b => b.id === id); }

function getPlayerBuffs(jid) {
  const p = db.getPlayer(jid);
  if (!p.buffs) p.buffs = [];
  // Hapus buff kadaluarsa
  p.buffs = p.buffs.filter(b => Date.now() < b.expires_at);
  return p;
}

function hasActiveBuff(jid, efek) {
  const p = getPlayerBuffs(jid);
  return p.buffs.some(b => b.efek === efek && Date.now() < b.expires_at);
}

function cmdToko(filter) {
  const items = filter ? BUFF_CATALOG.filter(b => b.id === filter) : BUFF_CATALOG;
  const rows  = BUFF_CATALOG.map(b =>
    `${b.emoji} *${b.nama}* [${b.id}]\n   💵 ${b.harga.toLocaleString()} koin | ⏱️ ${b.durasi >= 60 ? b.durasi/60 + " jam" : b.durasi + " menit"}\n   Efek: ${b.efek.replace("_"," ")}`
  ).join("\n\n");
  return `🛒 *TOKO BUFF*\n\n${rows}\n\n📌 Beli: *!belibuff [id]*\n📌 Buff aktif: *!buffsaya*`;
}

function cmdBeliBuff(jid, id) {
  const buff = getBuffById(id);
  if (!buff) return `❌ Buff tidak ditemukan. Lihat *!toko*`;
  const p = getPlayerBuffs(jid);
  if (p.balance < buff.harga) return `❌ Butuh *${buff.harga.toLocaleString()} koin*.`;
  // Cek sudah punya buff serupa aktif
  if (p.buffs.some(b => b.efek === buff.efek)) return `❌ Buff *${buff.nama}* sudah aktif.`;
  p.balance -= buff.harga;
  p.buffs.push({
    id:         buff.id,
    nama:       buff.nama,
    emoji:      buff.emoji,
    efek:       buff.efek,
    nilai:      buff.nilai,
    expires_at: Date.now() + (buff.durasi * 60 * 1000)
  });
  db.savePlayers();
  return `${buff.emoji} *Buff Aktif: ${buff.nama}!*\n-${buff.harga.toLocaleString()} koin\n⏱️ Berlaku ${buff.durasi >= 60 ? buff.durasi/60 + " jam" : buff.durasi + " menit"}\n💳 Saldo: ${p.balance.toLocaleString()} koin`;
}

function cmdBuffSaya(jid) {
  const p = getPlayerBuffs(jid);
  if (!p.buffs || p.buffs.length === 0) return `❌ Tidak ada buff aktif. Beli di *!toko*`;
  const rows = p.buffs.map(b => {
    const sisa = Math.max(0, b.expires_at - Date.now());
    const mnt  = Math.ceil(sisa / 60000);
    return `${b.emoji} *${b.nama}* — sisa ${mnt >= 60 ? Math.ceil(mnt/60) + " jam" : mnt + " menit"}`;
  }).join("\n");
  return `⚡ *BUFF AKTIFMU:*\n${rows}`;
}

// ══════════════════════════════════════════════════════════════
//  SAHAM — 5 perusahaan dengan harga fluktuatif
// ══════════════════════════════════════════════════════════════
const SAHAM_COMPANIES = [
  { id: "gocek",   nama: "PT Gocek Digital",    emoji: "📱", basePrice: 500  },
  { id: "minyak",  nama: "PT Nusantara Energi",  emoji: "⛽", basePrice: 800  },
  { id: "pangan",  nama: "CV Pangan Sejahtera",  emoji: "🌾", basePrice: 300  },
  { id: "tekno",   nama: "PT TeknoIndo Corp",    emoji: "💻", basePrice: 1200 },
  { id: "emas",    nama: "PT Tambang Emas ID",   emoji: "🪙", basePrice: 2000 },
];

// Inisialisasi harga saham
if (!sahamDB.prices) {
  sahamDB.prices = {};
  SAHAM_COMPANIES.forEach(c => { sahamDB.prices[c.id] = c.basePrice; });
}
if (!sahamDB.history) sahamDB.history = {};

// Fluktuasi tiap 15 menit
setInterval(() => {
  SAHAM_COMPANIES.forEach(c => {
    const fluk = (Math.random() * 2 - 1) * 0.12; // ±12%
    const oldPrice = sahamDB.prices[c.id] || c.basePrice;
    const newPrice = Math.max(50, Math.round(oldPrice * (1 + fluk)));
    sahamDB.prices[c.id] = newPrice;
    if (!sahamDB.history[c.id]) sahamDB.history[c.id] = [];
    sahamDB.history[c.id].push({ time: Date.now(), price: newPrice });
    if (sahamDB.history[c.id].length > 10) sahamDB.history[c.id].shift();
  });
}, 15 * 60 * 1000);

function cmdSaham() {
  const rows = SAHAM_COMPANIES.map(c => {
    const price = sahamDB.prices[c.id] || c.basePrice;
    const hist  = sahamDB.history[c.id] || [];
    const prev  = hist.length >= 2 ? hist[hist.length - 2].price : price;
    const diff  = price - prev;
    const arrow = diff > 0 ? "🟢▲" : diff < 0 ? "🔴▼" : "⚪─";
    return `${c.emoji} *${c.nama}* [${c.id}]\n   ${arrow} *${price.toLocaleString()} koin* (${diff >= 0 ? "+" : ""}${diff})`;
  }).join("\n\n");
  return `📈 *BURSA SAHAM NUSANTARA*\nUpdate tiap 15 menit\n\n${rows}\n\n📌 Beli: *!belisaham [id] [qty]*\n📌 Jual: *!jualsaham [id] [qty]*\n📌 Portofolio: *!portofolio*`;
}

function cmdBeliSaham(jid, id, qty) {
  const company = SAHAM_COMPANIES.find(c => c.id === id);
  if (!company) return `❌ Kode saham tidak valid. Lihat *!saham*`;
  if (!Number.isInteger(qty) || qty <= 0) return `❌ Jumlah tidak valid.`;

  const price = sahamDB.prices[id] || company.basePrice;
  const total = price * qty;
  const p     = db.getPlayer(jid);
  if (p.balance < total) return `❌ Butuh *${total.toLocaleString()} koin*.`;

  if (!p.saham) p.saham = {};
  p.balance     -= total;
  p.saham[id]    = (p.saham[id] || 0) + qty;
  db.savePlayers();
  return `📈 Beli *${qty} lembar ${company.emoji} ${company.nama}* @ ${price.toLocaleString()}\nTotal: *-${total.toLocaleString()} koin*\n💳 Saldo: ${p.balance.toLocaleString()} koin`;
}

function cmdJualSaham(jid, id, qty) {
  const company = SAHAM_COMPANIES.find(c => c.id === id);
  if (!company) return `❌ Kode saham tidak valid.`;
  if (!Number.isInteger(qty) || qty <= 0) return `❌ Jumlah tidak valid.`;

  const p = db.getPlayer(jid);
  if (!p.saham || !p.saham[id] || p.saham[id] < qty)
    return `❌ Saham tidak cukup. Kamu punya *${p.saham?.[id] || 0} lembar*.`;

  const price  = sahamDB.prices[id] || company.basePrice;
  const earned = price * qty;
  p.saham[id] -= qty;
  if (p.saham[id] === 0) delete p.saham[id];
  db.savePlayers();
  db.addBalance(jid, earned);
  return `📉 Jual *${qty} lembar ${company.emoji} ${company.nama}* @ ${price.toLocaleString()}\n+*${earned.toLocaleString()} koin*\n💳 Saldo: ${db.getPlayer(jid).balance.toLocaleString()} koin`;
}

function cmdPortofolio(jid) {
  const p = db.getPlayer(jid);
  if (!p.saham || Object.keys(p.saham).length === 0)
    return `📊 Belum punya saham. Beli di *!saham*`;
  let totalVal = 0;
  const rows = Object.entries(p.saham).map(([id, qty]) => {
    const company = SAHAM_COMPANIES.find(c => c.id === id);
    const price   = sahamDB.prices[id] || (company?.basePrice || 0);
    const val     = price * qty;
    totalVal += val;
    return `${company?.emoji || "📊"} *${company?.nama || id}*: ${qty} lembar × ${price.toLocaleString()} = *${val.toLocaleString()} koin*`;
  }).join("\n");
  return `📊 *PORTOFOLIO SAHAMMU*\n\n${rows}\n\n💰 Total nilai: *${totalVal.toLocaleString()} koin*`;
}

// ══════════════════════════════════════════════════════════════
//  RAMPOK — curi koin orang lain
// ══════════════════════════════════════════════════════════════
const rampokCooldowns = new Map();
const RAMPOK_CD = 30 * 60 * 1000; // 30 menit

function cmdRampok(jid, targetJid, chatId) {
  if (!targetJid) return `❌ Format: *!rampok @target*`;

  const fromNum = jid.replace(/@.+/, "").replace(/\D/g, "");
  const toNum   = targetJid.replace(/@.+/, "").replace(/\D/g, "");
  if (fromNum === toNum) return `❌ Tidak bisa rampok diri sendiri.`;

  // Cooldown
  const cdKey = `${jid}:rampok`;
  const lastR  = rampokCooldowns.get(cdKey) || 0;
  const elapsed = Date.now() - lastR;
  if (elapsed < RAMPOK_CD) {
    const sisa = Math.ceil((RAMPOK_CD - elapsed) / 60000);
    return `😤 Masih takut ketahuan! Rampok lagi *${sisa} menit* lagi.`;
  }

  const fromP = db.getPlayer(jid);
  const toP   = db.getPlayer(`${toNum}@s.whatsapp.net`);

  // Cek perisai target
  const targetHasShield = hasActiveBuff(`${toNum}@s.whatsapp.net`, "anti_rampok");
  if (targetHasShield) {
    rampokCooldowns.set(cdKey, Date.now());
    return `🛡️ *@${toNum} punya Perisai Rampok!* Kamu gagal dan kabur.\n😅 Untung tidak ketahuan...`;
  }

  // 40% chance sukses, 60% gagal
  const sukses = Math.random() < 0.40;
  rampokCooldowns.set(cdKey, Date.now());

  if (!sukses) {
    // Denda gagal: 10% saldo pelaku
    const denda = Math.floor(fromP.balance * 0.10);
    db.deductBalance(jid, denda);
    return (
      `🚓 *RAMPOK GAGAL!*\n` +
      `@${toNum} berhasil kabur dan lapor polisi!\n` +
      `Denda ketahuan: *-${denda.toLocaleString()} koin*\n` +
      `💳 Saldo: ${db.getPlayer(jid).balance.toLocaleString()} koin`
    );
  }

  // Sukses: curi 5–20% saldo target (max 5000 koin)
  const pct    = 0.05 + Math.random() * 0.15;
  const curi   = Math.min(Math.floor(toP.balance * pct), 5000);
  if (curi === 0) return `😞 @${toNum} lagi bokek, tidak ada yang bisa dicuri.`;

  db.deductBalance(`${toNum}@s.whatsapp.net`, curi);
  db.addBalance(jid, curi);

  return (
    `🦹 *RAMPOK BERHASIL!*\n` +
    `Berhasil mencuri *+${curi.toLocaleString()} koin* dari @${toNum}!\n` +
    `💳 Saldo: ${db.getPlayer(jid).balance.toLocaleString()} koin\n` +
    `⚠️ Hati-hati, KPK mengintai!`
  );
}

// ══════════════════════════════════════════════════════════════
//  HADIAH — kirim item inventory ke orang lain
// ══════════════════════════════════════════════════════════════
function cmdHadiah(jid, targetJid, namaItem) {
  if (!targetJid || !namaItem) return `❌ Format: *!hadiah @target [nama item]*`;
  const fromNum = jid.replace(/@.+/, "").replace(/\D/g, "");
  const toNum   = targetJid.replace(/@.+/, "").replace(/\D/g, "");
  if (fromNum === toNum) return `❌ Tidak bisa kirim hadiah ke diri sendiri.`;

  const fromP = db.getPlayer(jid);
  const itemIdx = fromP.inventory.findIndex(
    i => i.name.toLowerCase() === namaItem.toLowerCase()
  );
  if (itemIdx === -1) return `❌ Kamu tidak punya *${namaItem}* di inventory.`;

  const item = fromP.inventory.splice(itemIdx, 1)[0];
  const toP  = db.getPlayer(`${toNum}@s.whatsapp.net`);
  toP.inventory.push(item);
  db.savePlayers();

  return `🎁 *Hadiah Terkirim!*\nKamu kirim *${item.emoji || "📦"} ${item.name}* ke @${toNum}!\n✅ Semoga bermanfaat.`;
}

// ══════════════════════════════════════════════════════════════
//  LOTERE — beli tiket, diundi jam 20:00 WIB
// ══════════════════════════════════════════════════════════════
const TIKET_HARGA = 500;
const MAX_TIKET   = 10; // per orang per hari

function getLotereHari() {
  const today = new Date().toISOString().slice(0, 10);
  if (!lotereDB[today]) lotereDB[today] = { tiket: {}, jackpot: 0, drawn: false, pemenang: null };
  return lotereDB[today];
}

function cmdLotere() {
  const today = getLotereHari();
  const totalTiket = Object.values(today.tiket).reduce((a,b) => a + b, 0);
  return (
    `🎟️ *LOTERE HARIAN*\n\n` +
    `💰 Jackpot terkumpul: *${today.jackpot.toLocaleString()} koin*\n` +
    `🎫 Total tiket terjual: *${totalTiket}*\n` +
    `⏰ Diundi pukul *20:00 WIB*\n\n` +
    (today.drawn && today.pemenang ? `🏆 Pemenang hari ini: @${today.pemenang.split("@")[0]}\n\n` : "") +
    `📌 Beli tiket: *!belitiket [jumlah]*\n📌 Tiket saya: *!tiketku*\nHarga: ${TIKET_HARGA} koin/tiket | Max ${MAX_TIKET} tiket`
  );
}

function cmdBeliTiket(jid, qty) {
  if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_TIKET)
    return `❌ Beli 1–${MAX_TIKET} tiket sekaligus.`;
  const today = getLotereHari();
  if (today.drawn) return `❌ Lotere hari ini sudah diundi. Tunggu besok!`;

  const sudahBeli = today.tiket[jid] || 0;
  const bisa = Math.min(qty, MAX_TIKET - sudahBeli);
  if (bisa <= 0) return `❌ Kamu sudah beli *${sudahBeli} tiket* hari ini (max ${MAX_TIKET}).`;

  const total = bisa * TIKET_HARGA;
  const p     = db.getPlayer(jid);
  if (p.balance < total) return `❌ Butuh *${total.toLocaleString()} koin*.`;

  p.balance          -= total;
  today.tiket[jid]    = sudahBeli + bisa;
  today.jackpot      += total;
  db.savePlayers();

  return `🎟️ Beli *${bisa} tiket* lotere!\n-${total.toLocaleString()} koin\n🏆 Jackpot sekarang: *${today.jackpot.toLocaleString()} koin*\n💳 Saldo: ${p.balance.toLocaleString()} koin`;
}

function cmdTiketku(jid) {
  const today = getLotereHari();
  const punya = today.tiket[jid] || 0;
  return `🎟️ Tiket loteremu hari ini: *${punya} tiket*\n🏆 Jackpot: *${today.jackpot.toLocaleString()} koin*\nDiundi pukul *20:00 WIB*`;
}

// ── Undi Lotere (dipanggil otomatis jam 20:00) ──────────────
function undianLotere() {
  const today = getLotereHari();
  if (today.drawn || today.jackpot === 0) return null;

  const pool = [];
  for (const [jid, qty] of Object.entries(today.tiket)) {
    for (let i = 0; i < qty; i++) pool.push(jid);
  }
  if (pool.length === 0) { today.drawn = true; return null; }

  const winner = pool[Math.floor(Math.random() * pool.length)];
  db.addBalance(winner, today.jackpot);
  today.pemenang = winner;
  today.drawn    = true;
  db.savePlayers();

  return {
    winner,
    jackpot: today.jackpot,
    msg: `🎉🎟️ *LOTERE HARIAN DIUNDI!*\n\nPemenang: @${winner.split("@")[0]}\n🏆 Jackpot: *${today.jackpot.toLocaleString()} koin*\n\nSelamat! Jackpot masuk ke saldo pemenang.`
  };
}

// Jadwal undi jam 20:00
function scheduleUndian() {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(20, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    const result = undianLotere();
    // Result akan dipublish oleh index.js lewat broadcast
    scheduleUndian();
  }, next - now);
}
scheduleUndian();

// ══════════════════════════════════════════════════════════════
//  GUILD — kelompok member, war mingguan
// ══════════════════════════════════════════════════════════════
function cmdBuatGuild(jid, nama) {
  if (!nama || nama.length < 2 || nama.length > 20)
    return `❌ Nama guild 2–20 karakter.`;

  // Cek sudah di guild lain
  for (const g of Object.values(guildDB)) {
    if (g.anggota?.includes(jid))
      return `❌ Kamu sudah bergabung di guild *${g.nama}*. Keluar dulu dengan *!keluarguild*.`;
  }

  const id = `guild_${Date.now()}`;
  const p  = db.getPlayer(jid);
  if (p.balance < 2000) return `❌ Butuh *2000 koin* untuk buat guild.`;
  p.balance -= 2000;
  db.savePlayers();

  guildDB[id] = { id, nama, ketua: jid, anggota: [jid], kas: 0, xp: 0, war_score: 0 };
  return `⚔️ *Guild "${nama}" Dibuat!*\n-2000 koin biaya pendaftaran.\n📌 Ajak teman: *!gabungguild ${id}*`;
}

function cmdGabungGuild(jid, guildId) {
  if (!guildDB[guildId]) return `❌ Guild ID tidak ditemukan.`;
  for (const g of Object.values(guildDB)) {
    if (g.anggota?.includes(jid)) return `❌ Kamu sudah di guild *${g.nama}*.`;
  }
  if (guildDB[guildId].anggota.length >= 20) return `❌ Guild sudah penuh (max 20 anggota).`;
  guildDB[guildId].anggota.push(jid);
  return `✅ Bergabung ke guild *${guildDB[guildId].nama}*!`;
}

function cmdKeluarGuild(jid) {
  for (const [id, g] of Object.entries(guildDB)) {
    const idx = g.anggota?.indexOf(jid);
    if (idx !== -1) {
      if (g.ketua === jid && g.anggota.length > 1)
        return `❌ Kamu ketua guild. Transfer kepemimpinan dulu atau bubarkan guild.`;
      g.anggota.splice(idx, 1);
      if (g.anggota.length === 0) delete guildDB[id];
      return `✅ Kamu keluar dari guild *${g.nama}*.`;
    }
  }
  return `❌ Kamu tidak bergabung di guild manapun.`;
}

function cmdInfoGuild(jid) {
  let myGuild = null;
  for (const g of Object.values(guildDB)) {
    if (g.anggota?.includes(jid)) { myGuild = g; break; }
  }
  if (!myGuild) return `❌ Kamu belum bergabung guild. Buat: *!buatguild [nama]* | Gabung: *!gabungguild [id]*`;

  const ketua = `@${myGuild.ketua.split("@")[0]}`;
  const anggotaList = myGuild.anggota.map(a => `@${a.split("@")[0]}`).join(", ");
  return (
    `⚔️ *GUILD: ${myGuild.nama}*\n\n` +
    `👑 Ketua: ${ketua}\n` +
    `👥 Anggota (${myGuild.anggota.length}/20): ${anggotaList}\n` +
    `💰 Kas Guild: ${(myGuild.kas || 0).toLocaleString()} koin\n` +
    `⭐ XP: ${myGuild.xp || 0}\n` +
    `🏆 War Score Mingguan: ${myGuild.war_score || 0}\n\n` +
    `📌 ID Guild: \`${myGuild.id}\``
  );
}

function cmdGuildWar(jid, chatId) {
  let myGuild = null;
  for (const g of Object.values(guildDB)) {
    if (g.anggota?.includes(jid)) { myGuild = g; break; }
  }
  if (!myGuild) return `❌ Kamu belum di guild.`;

  // Cari guild musuh (random dari yang lain)
  const others = Object.values(guildDB).filter(g => g.id !== myGuild.id);
  if (others.length === 0) return `❌ Belum ada guild lain untuk diajak war.`;

  const enemy = others[Math.floor(Math.random() * others.length)];
  const myScore  = myGuild.anggota.length * (1 + Math.random() * 2);
  const enyScore = enemy.anggota.length   * (1 + Math.random() * 2);
  const menang   = myScore > enyScore;

  const reward = menang ? 1000 * myGuild.anggota.length : 0;
  if (menang) {
    myGuild.kas       = (myGuild.kas || 0) + reward;
    myGuild.war_score = (myGuild.war_score || 0) + 3;
    myGuild.xp        = (myGuild.xp || 0) + 50;
  } else {
    myGuild.war_score = Math.max(0, (myGuild.war_score || 0) - 1);
  }

  return (
    `⚔️ *GUILD WAR!*\n` +
    `${myGuild.nama} (skor: ${myScore.toFixed(0)}) vs ${enemy.nama} (skor: ${enyScore.toFixed(0)})\n\n` +
    (menang
      ? `🏆 *${myGuild.nama} MENANG!* +${reward.toLocaleString()} koin masuk kas guild!`
      : `💀 *${myGuild.nama} KALAH!* Latihan lebih keras lagi.`)
  );
}

// ══════════════════════════════════════════════════════════════
//  MISI — harian & mingguan
// ══════════════════════════════════════════════════════════════
const MISI_HARIAN = [
  { id: "h1", nama: "Menang 3x Slot",      target: 3,  reward: 500,  tipe: "slot_win"    },
  { id: "h2", nama: "Kerja 2x",            target: 2,  reward: 300,  tipe: "kerja"       },
  { id: "h3", nama: "Main Kasino 5x",      target: 5,  reward: 400,  tipe: "kasino_play" },
  { id: "h4", nama: "Klaim Daily",         target: 1,  reward: 200,  tipe: "daily"       },
  { id: "h5", nama: "Transfer ke teman",   target: 1,  reward: 350,  tipe: "transfer"    },
];
const MISI_MINGGUAN = [
  { id: "w1", nama: "Menang 20x Kasino",   target: 20, reward: 3000, tipe: "kasino_win"  },
  { id: "w2", nama: "Kumpulkan 10.000 koin",target:10000,reward:5000, tipe: "earn_total"  },
  { id: "w3", nama: "Rampok Berhasil 3x",  target: 3,  reward: 2000, tipe: "rampok_win"  },
];

function getMisiPlayer(jid) {
  const p    = db.getPlayer(jid);
  const week = `w${Math.floor(Date.now() / (7 * 86400000))}`;
  const day  = new Date().toISOString().slice(0,10);
  if (!p.misi) p.misi = {};
  if (!p.misi[day]) p.misi[day] = {};
  if (!p.misi[week]) p.misi[week] = {};
  return { p, day, week };
}

function cmdMisi(jid) {
  const { p, day, week } = getMisiPlayer(jid);

  const harianRows = MISI_HARIAN.map(m => {
    const prog = p.misi[day][m.id] || 0;
    const done = prog >= m.target;
    return `${done ? "✅" : "⬜"} ${m.nama} (${Math.min(prog, m.target)}/${m.target}) +${m.reward} koin`;
  }).join("\n");

  const mingguRows = MISI_MINGGUAN.map(m => {
    const prog = p.misi[week][m.id] || 0;
    const done = prog >= m.target;
    return `${done ? "✅" : "⬜"} ${m.nama} (${Math.min(prog, m.target).toLocaleString()}/${m.target.toLocaleString()}) +${m.reward} koin`;
  }).join("\n");

  return `📋 *MISI HARIAN*\n${harianRows}\n\n📅 *MISI MINGGUAN*\n${mingguRows}\n\n📌 Klaim: *!klaiממisi [id]* (contoh: *!klaiממisi h1*)`;
}

function cmdKlaimMisi(jid, misiId) {
  const { p, day, week } = getMisiPlayer(jid);
  const misi = [...MISI_HARIAN, ...MISI_MINGGUAN].find(m => m.id === misiId);
  if (!misi) return `❌ ID misi tidak ditemukan. Lihat *!misi*`;

  const period = misiId.startsWith("h") ? day : week;
  const prog   = p.misi[period][misi.id] || 0;
  if (prog < misi.target) return `❌ Misi belum selesai. Progress: *${Math.min(prog, misi.target)}/${misi.target}*`;

  const claimKey = `claimed_${misiId}`;
  if (p.misi[period][claimKey]) return `✅ Reward misi ini sudah diklaim.`;

  p.misi[period][claimKey] = true;
  db.addBalance(jid, misi.reward);
  db.savePlayers();

  return `🎉 *Misi "${misi.nama}" Selesai!*\n+${misi.reward.toLocaleString()} koin\n💳 Saldo: ${db.getPlayer(jid).balance.toLocaleString()} koin`;
}

// Progress tracker untuk misi (dipanggil dari index.js)
function trackMisi(jid, tipe, amount = 1) {
  const { p, day, week } = getMisiPlayer(jid);
  for (const m of MISI_HARIAN) {
    if (m.tipe === tipe) {
      p.misi[day][m.id] = (p.misi[day][m.id] || 0) + amount;
    }
  }
  for (const m of MISI_MINGGUAN) {
    if (m.tipe === tipe) {
      p.misi[week][m.id] = (p.misi[week][m.id] || 0) + amount;
    }
  }
  db.savePlayers();
}

// ══════════════════════════════════════════════════════════════
//  REKAP GRUP
// ══════════════════════════════════════════════════════════════
const groupActivity = {}; // In-memory activity log

function trackActivity(chatId, jid, tipe) {
  if (!groupActivity[chatId]) groupActivity[chatId] = {};
  const today = new Date().toISOString().slice(0,10);
  if (!groupActivity[chatId][today]) groupActivity[chatId][today] = {};
  const key = `${jid}:${tipe}`;
  groupActivity[chatId][today][key] = (groupActivity[chatId][today][key] || 0) + 1;
}

function cmdRekap(chatId) {
  const today = new Date().toISOString().slice(0,10);
  const data  = groupActivity[chatId]?.[today] || {};

  if (Object.keys(data).length === 0)
    return `📊 *Rekap Grup Hari Ini*\nBelum ada aktivitas hari ini.`;

  // Hitung aktivitas per JID
  const activityMap = {};
  for (const [key, val] of Object.entries(data)) {
    const [jid] = key.split(":");
    activityMap[jid] = (activityMap[jid] || 0) + val;
  }

  const sorted = Object.entries(activityMap).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const rows   = sorted.map(([jid, cnt], i) =>
    `${["🥇","🥈","🥉","4️⃣","5️⃣"][i]} @${jid.split("@")[0]}: *${cnt} aksi*`
  ).join("\n");

  const totalAksi = Object.values(activityMap).reduce((a,b) => a+b, 0);
  return `📊 *REKAP GRUP — ${today}*\n\n🏆 Member Teraktif:\n${rows}\n\n📈 Total aksi hari ini: *${totalAksi}*`;
}

// ══════════════════════════════════════════════════════════════
//  EXPORT
// ══════════════════════════════════════════════════════════════
module.exports = {
  // Toko Buff
  cmdToko, cmdBeliBuff, cmdBuffSaya, hasActiveBuff, getPlayerBuffs,
  // Saham
  cmdSaham, cmdBeliSaham, cmdJualSaham, cmdPortofolio,
  // Rampok
  cmdRampok,
  // Hadiah
  cmdHadiah,
  // Lotere
  cmdLotere, cmdBeliTiket, cmdTiketku, undianLotere,
  // Guild
  cmdBuatGuild, cmdGabungGuild, cmdKeluarGuild, cmdInfoGuild, cmdGuildWar,
  // Misi
  cmdMisi, cmdKlaimMisi, trackMisi,
  // Rekap
  cmdRekap, trackActivity,
};