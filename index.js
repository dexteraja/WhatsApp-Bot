// ============================================================
//  index.js — Main Handler (V5 | Hard Activation Gate)
//  Kompatibel dengan: Baileys (@whiskeysockets/baileys)
// ============================================================
require("./config");
const cfg      = global.botConfig;
const security = require("./security");
const db       = require("./db");
const games    = require("./games");
const eco      = require("./economy");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is Active!'));
app.listen(port, () => console.log(`HTTP Server berjalan di port ${port}`));

// ──────────────────────────────────────────────────────────────
//  KONEKSI BOT
// ──────────────────────────────────────────────────────────────
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  // ── Pairing Code jika belum terdaftar ─────────────────────
  if (!sock.authState.creds.registered) {
    const nomorHPBot = "6282226872521"; // ⚠️ GANTI NOMOR DI SINI
    console.log(`\n==================================================`);
    console.log(`⏳ Meminta kode pairing untuk nomor: ${nomorHPBot}`);
    console.log(`==================================================\n`);
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(nomorHPBot);
        console.log(`\n🔑 KODE PAIRING:`);
        console.log(`👉  ${code}  👈`);
        console.log(`\nMasukkan kode 8 digit di atas pada menu Perangkat Tertaut!\n`);
      } catch (err) {
        console.log("❌ Gagal mendapatkan kode pairing:", err.message);
      }
    }, 3000);
  }

  sock.ev.on("creds.update", saveCreds);

  // ── Event: Koneksi ────────────────────────────────────────
  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Koneksi terputus. Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("\n✅ BOT ONLINE DAN SIAP! 🎉\n");
    }
  });

  // ── Event: Pesan Masuk ────────────────────────────────────
  sock.ev.on("messages.upsert", ({ messages }) => {
    for (const m of messages) {
      handleMessage(sock, m).catch(err => console.error("❌ Handler Error:", err));
    }
  });
}

// ──────────────────────────────────────────────────────────────
//  FUNGSI UTILITAS
// ──────────────────────────────────────────────────────────────
async function reply(sock, chatId, text, mentions = []) {
  try {
    return await sock.sendMessage(chatId, { text, mentions });
  } catch (err) {
    console.error("❌ Gagal kirim pesan:", err.message);
  }
}

async function isGroupAdmin(sock, groupId, jid) {
  try {
    const meta = await sock.groupMetadata(groupId);
    return meta.participants.some(
      p => p.id === jid && ["admin", "superadmin"].includes(p.admin)
    );
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
//  HANDLE PESAN UTAMA
// ──────────────────────────────────────────────────────────────
async function handleMessage(sock, msg) {
  // Abaikan pesan dari bot sendiri
  if (!msg.message || msg.key.fromMe) return;

  const isGroup = msg.key.remoteJid.endsWith("@g.us");
  const chatId  = msg.key.remoteJid;
  const jid     = isGroup ? msg.key.participant : msg.key.remoteJid;
  if (!jid) return;

  const body = (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text || ""
  ).trim();
  if (!body) return;

  // ═══════════════════════════════════════════════════════
  //  HARD GATE: Jika grup dan belum diaktifkan →
  //  BOT TIDAK AKAN MERESPON APAPUN, termasuk command
  //  KECUALI: !botaktif dari Owner (agar bisa diaktifkan)
  // ═══════════════════════════════════════════════════════
 const isOwner = (jid === "213147063480434@lid");
const isActive = db.isGroupActive(chatId);

  if (isGroup && !isActive) {
    // Hanya izinkan !botaktif dari Owner — sisanya diabaikan total
    if (body.toLowerCase().trim() === "!botaktif" && isOwner) {
      const res = db.activateGroup(chatId);
      return await reply(sock, chatId, res, [jid]);
    }
    return; // Diam total, tidak ada respons apapun
  }

  // ═══════════════════════════════════════════════════════
  //  GRUP AKTIF (atau private chat) — proses normal
  // ═══════════════════════════════════════════════════════
  if (isGroup) db.registerGroupMember(chatId, jid);

  // Cek security (spam / cooldown)
  const sec = security.securityCheck(jid);
  if (!sec.ok) {
    if (sec.reason === "banned") return;
    if (sec.reason === "cooldown")
      return await reply(sock, chatId, cfg.msg.onCooldown(sec.wait));
  }

  const args    = body.split(" ");
  const command = args[0].toLowerCase();

  // ── Jawaban kuis (non-command) ─────────────────────────
  if (!command.startsWith("!")) {
    const res = games.cmdJawabKuis(chatId, jid, body);
    if (res) await reply(sock, chatId, res, [jid]);
    return;
  }

  // ── Shortcut multi-turn Blackjack ──────────────────────
  if (["!hit", "!stand"].includes(command)) {
    const fn = command === "!hit"
      ? () => games.cmdBlackjackHit(jid)
      : () => games.cmdBlackjackStand(jid);
    const res = fn();
    if (res) await reply(sock, chatId, res, [jid]);
    return;
  }

  // ── Parse argumen ──────────────────────────────────────
  const cleanNum  = (s) => (s ? parseInt(s.replace(/[^0-9]/g, ""), 10) : 0);
  const cleanBet  = cleanNum(args[1]);
  const cleanBet2 = cleanNum(args[2]);
  const arg2Text  = (args[2] || "").toLowerCase();
  const arg1Text  = (args[1] || "").toLowerCase();

  let res = null;

  switch (command) {

    // ── Owner Commands ─────────────────────────────────
    case "!botaktif":
      if (isOwner) res = db.activateGroup(chatId);
      else res = "❌ Hanya owner bot yang bisa mengaktifkan.";
      break;
    case "!botmati":
      if (isOwner) res = db.deactivateGroup(chatId);
      else res = "❌ Hanya owner bot yang bisa menonaktifkan.";
      break;

    // ── Owner Commands (Debug / Maintenance) ─────────────
    case "!resetkuis":
      if (isOwner) {
        db.resetQuizzes();
        res = "✅ Reset kuis harian berhasil.";
      } else res = "❌ Hanya owner bot yang bisa reset kuis.";
      break;  
    
    case "!unban":
  if (!isOwner) return reply(sock, chatId, "❌ Khusus Owner!");
  const target = args[1].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
  // Panggil fungsi untuk menghapus dari blacklist
  security.unbanUser(target); 
  reply(sock, chatId, `✅ Pengguna ${target} telah di-unban.`);
  break;

    // ── Ekonomi ────────────────────────────────────────
    case "!saldo":       res = eco.cmdSaldo(jid); break;
    case "!daily":       res = eco.cmdDaily(jid); break;
    case "!pinjam":      res = eco.cmdPinjam(jid, cleanBet); break;
    case "!bayarutang":  res = eco.cmdBayarUtang(jid, cleanBet); break;
    case "!asuransi":    res = eco.cmdAsuransi(jid); break;
    case "!crypto":      res = eco.cmdCrypto(); break;
    case "!buycrypto":   res = eco.cmdBuyCrypto(jid, cleanBet); break;
    case "!sellcrypto":  res = eco.cmdSellCrypto(jid, cleanBet); break;
    case "!transfer": {
      if (!args[1] || !args[2]) {
        res = "❌ Format: *!transfer [nomor_wa] [jumlah]*\nContoh: *!transfer 628xxx 500*";
      } else {
        const toJid = args[1].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        res = eco.cmdTransfer(jid, toJid, cleanBet2, chatId);
      }
      break;
    }
    case "!kasgrup":   res = eco.cmdKasGrup(chatId); break;
    case "!bagikasbot": {
      const isAdmin = await isGroupAdmin(sock, chatId, jid);
      res = eco.cmdBagiKas(chatId, jid, isAdmin || isOwner);
      break;
    }

    // ── Kasino (12 Games) ──────────────────────────────
    case "!slot":         res = games.cmdSlot(jid, cleanBet, chatId); break;
    case "!coinflip":     res = games.cmdCoinFlip(jid, cleanBet, arg2Text, chatId); break;
    case "!tebakangka":   res = games.cmdTebakAngka(jid, cleanBet, cleanBet2, chatId); break;
    case "!ranjau":       res = games.cmdRanjau(jid, cleanBet, cleanBet2, chatId); break;
    case "!dadu":         res = games.cmdDadu(jid, cleanBet, chatId); break;
    case "!rolet":        res = games.cmdRolet(jid, cleanBet, arg2Text, chatId); break;
    case "!hilo":         res = games.cmdHiLo(jid, cleanBet, arg2Text, chatId); break;
    case "!spin":         res = games.cmdSpin(jid, cleanBet, chatId); break;
    case "!balapkuda":    res = games.cmdBalapKuda(jid, cleanBet, args[2], chatId); break;
    case "!tebakkoin":    res = games.cmdTebakKoin(jid, cleanBet, arg2Text, chatId); break;
    case "!jackpotganda": res = games.cmdJackpotGanda(jid, cleanBet, args[2], chatId); break;
    case "!bomberman":    res = games.cmdBomberman(jid, cleanBet, cleanBet2, chatId); break;

    // ── PVP & Logika (3 Games) ─────────────────────────
    case "!suit":       res = games.cmdSuit(jid, cleanBet, arg2Text, chatId); break;
    case "!blackjack":  res = games.cmdBlackjackStart(jid, cleanBet, chatId); break;
    case "!tebakoperasi": res = games.cmdTebakOperasi(chatId, jid); break;

    // ── Trivia (7 Games) ───────────────────────────────
    case "!kuis":          res = games.cmdKuis(chatId, jid); break;
    case "!tebakhewan":    res = games.cmdTebakHewan(chatId, jid); break;
    case "!tebakbendera":  res = games.cmdTebakBendera(chatId, jid); break;
    case "!susunkata":     res = games.cmdSusunKata(chatId, jid); break;
    case "!mtk":           res = games.cmdMatematika(chatId, jid); break;
    case "!tebakibukota":  res = games.cmdTebakIbukota(chatId, jid); break;
    case "!tebaklirik":    res = games.cmdTebakLirik(chatId, jid); break;

    // ── RPG (5 Games) ──────────────────────────────────
    case "!hunt":       res = games.cmdHunt(jid); break;
    case "!mancing":    res = games.cmdMancing(jid); break;
    case "!gacha":      res = games.cmdGacha(jid); break;
    case "!jual":       res = games.cmdJual(jid); break;
    case "!ekspedisi":  res = games.cmdEkspedisi(jid); break;

    // ── Menu ───────────────────────────────────────────
    case "!menu":
    case "!help":
      res = buildMenu();
      break;

    default:
      return; // Command tidak dikenali → diam
  }

  // ── Kirim respons ──────────────────────────────────────
  if (res) {
    // Ekstrak mentions dari tag @nomor dalam pesan
    const mentionList = (res.match(/@\d+/g) || [])
      .map(v => v.replace("@", "") + "@s.whatsapp.net")
      .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate

    if (mentionList.length === 0) mentionList.push(jid);
    await reply(sock, chatId, res, mentionList);
  }
}

// ──────────────────────────────────────────────────────────────
//  MENU UTAMA
// ──────────────────────────────────────────────────────────────
function buildMenu() {
  return (
    `╔══════════════════════╗\n` +
    `║  🎮 *MINI GAMES HUB*  ║\n` +
    `║    ✨ 26 Command!✨   ║\n` +
    `╚══════════════════════╝\n\n` +

    `🎰 *KASINO (12 Games)*\n` +
    `• !slot • !coinflip • !tebakangka\n` +
    `• !ranjau • !dadu • !rolet\n` +
    `• !hilo • !spin • !balapkuda\n` +
    `• !tebakkoin • !jackpotganda • !bomberman\n\n` +

    `⚔️ *PVP & LOGIKA (3 Games)*\n` +
    `• !suit • !blackjack (!hit / !stand)\n` +
    `• !tebakoperasi\n\n` +

    `🧠 *TRIVIA (7 Games)*\n` +
    `• !kuis • !tebakhewan • !tebakbendera\n` +
    `• !susunkata • !mtk\n` +
    `• !tebakibukota • !tebaklirik\n\n` +

    `🗺️ *RPG (5 Games)*\n` +
    `• !hunt • !mancing • !gacha\n` +
    `• !jual • !ekspedisi\n\n` +

    `💳 *EKONOMI*\n` +
    `• !saldo • !daily • !transfer\n` +
    `• !pinjam • !bayarutang • !asuransi\n` +
    `• !crypto • !buycrypto • !sellcrypto\n` +
    `• !kasgrup • !bagikasbot\n\n` +

    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 Format: *!game [taruhan] [pilihan]*\n` +
    `💡 Contoh: *!coinflip 500 heads*\n` +
    `           *!blackjack 1000*\n` +
    `           *!bomberman 300 5*`
  );
}

// ──────────────────────────────────────────────────────────────
startBot();
module.exports = { handleMessage };