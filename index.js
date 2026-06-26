// ============================================================
//  index.js — Main Handler (V5.3 — Unified Asset & Tax System)
//  Kompatibel dengan: Baileys (@whiskeysockets/baileys)
// ============================================================
require("./config");
const cfg      = global.botConfig;
const security = require("./security");
const db       = require("./db");
const games    = require("./games");
const eco      = require("./economy");
const prop     = require("./properti");
const social   = require("./social");
const sharp    = require("sharp");
const { exec } = require("child_process");
const fs       = require("fs");

// Buat folder temp otomatis untuk pemrosesan stiker FFMPEG
if (!fs.existsSync("./temp")) fs.mkdirSync("./temp");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
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
//  FUNGSI UTILITAS, MEDIA & UNIFIED TAX LOGIC
// ──────────────────────────────────────────────────────────────
async function reply(sock, chatId, text, mentions = []) {
  try {
    return await sock.sendMessage(chatId, { text, mentions });
  } catch (err) {
    console.error("❌ Gagal kirim pesan:", err.message);
  }
}

const getRandom = (ext) => `${Date.now()}${Math.floor(Math.random() * 1000)}${ext}`;


// ── Handler: !stiker (Image / Video / GIF ke WebP) ────────────
async function cmdStiker(sock, msg, chatId, jid) {
  const directImage   = msg.message?.imageMessage;
  const directVideo   = msg.message?.videoMessage;
  const quotedCtx     = msg.message?.extendedTextMessage?.contextInfo;
  const quotedMsg     = quotedCtx?.quotedMessage;
  const quotedImage   = quotedMsg?.imageMessage;
  const quotedVideo   = quotedMsg?.videoMessage;

  const isVideo = directVideo || quotedVideo;
  const isImage = directImage || quotedImage;

  if (!isImage && !isVideo) {
    return await reply(sock, chatId, "❌ Kirim foto/video/GIF (<10 detik) dengan caption *!stiker*, atau reply media orang lain dengan *!stiker*.", [jid]);
  }

  try {
    if (isVideo) {
      const vidMsg = directVideo || quotedVideo;
      if (vidMsg.seconds > 10) {
        return await reply(sock, chatId, "❌ Durasi video/GIF maksimal 10 detik agar tidak berat!", [jid]);
      }
    }

    let buffer;
    if (directImage || directVideo) {
      buffer = await downloadMediaMessage(msg, "buffer", {}, { reuploadRequest: sock.updateMediaMessage });
    } else {
      const fakeMsg = {
        key: { remoteJid: chatId, id: quotedCtx.stanzaId, participant: quotedCtx.participant || chatId },
        message: quotedMsg,
      };
      buffer = await downloadMediaMessage(fakeMsg, "buffer", {}, { reuploadRequest: sock.updateMediaMessage });
    }

    if (!buffer || buffer.length === 0) throw new Error("Buffer kosong setelah download");

    if (isImage && !isVideo) {
      const webp = await sharp(buffer)
        .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp()
        .toBuffer();
      await sock.sendMessage(chatId, { sticker: webp }, { quoted: msg });
    } else if (isVideo) {
      const tempInput = `./temp/${getRandom('.mp4')}`;
      const tempOutput = `./temp/${getRandom('.webp')}`;
      fs.writeFileSync(tempInput, buffer);

      exec(`ffmpeg -i ${tempInput} -t 10 -vcodec libwebp -filter_complex "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,fps=15, pad=512:512:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" -loop 0 -vsync 0 -preset default ${tempOutput}`, async (err) => {
        if (err) {
          console.error(err);
          await reply(sock, chatId, "❌ Gagal mengonversi video ke stiker.", [jid]);
        } else {
          const webpBuffer = fs.readFileSync(tempOutput);
          await sock.sendMessage(chatId, { sticker: webpBuffer }, { quoted: msg });
        }
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      });
    }
  } catch (err) {
    console.error("❌ Stiker error:", err.message);
    await reply(sock, chatId, `❌ Gagal memproses media: ${err.message}`, [jid]);
  }
}

// ── Handler: !stiker2 (WebP Stiker ke Image JPG) ─────────────
async function cmdStikerToImage(sock, msg, chatId, jid) {
  const quotedCtx = msg.message?.extendedTextMessage?.contextInfo;
  const quotedMsg = quotedCtx?.quotedMessage;
  const quotedSticker = quotedMsg?.stickerMessage;

  if (!quotedSticker) {
    return await reply(sock, chatId, "❌ Reply stiker yang ingin diubah menjadi gambar dengan caption *!stiker2*.", [jid]);
  }

  try {
    const fakeMsg = {
      key: { remoteJid: chatId, id: quotedCtx.stanzaId, participant: quotedCtx.participant || chatId },
      message: quotedMsg,
    };
    
    const buffer = await downloadMediaMessage(fakeMsg, "buffer", {}, { reuploadRequest: sock.updateMediaMessage });
    if (!buffer) throw new Error("Gagal mendownload stiker.");

    const jpegBuffer = await sharp(buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } }) 
      .jpeg()
      .toBuffer();

    await sock.sendMessage(chatId, { image: jpegBuffer, caption: "🖼️ Ini gambarnya!" }, { quoted: msg });
  } catch (err) {
    console.error("❌ Stiker2 error:", err.message);
    await reply(sock, chatId, `❌ Gagal mengubah stiker: ${err.message}`, [jid]);
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
  if (!msg.message || msg.key.fromMe) return;

  const isGroup = msg.key.remoteJid.endsWith("@g.us");
  const chatId  = msg.key.remoteJid;
  const jid     = isGroup ? msg.key.participant : msg.key.remoteJid;
  if (!jid) return;

  const body = (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    ""
  ).trim();
  if (!body) return;

  const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

  const isOwner = (jid === "213147063480434@lid"); 
  const isActive = db.isGroupActive(chatId);

  if (isGroup && !isActive) {
    if (body.toLowerCase().trim() === "!botaktif" && isOwner) {
      const res = db.activateGroup(chatId);
      return await reply(sock, chatId, res, [jid]);
    }
    return; 
  }

  if (isGroup) db.registerGroupMember(chatId, jid);
  if (isGroup) social.trackActivity(chatId, jid, "msg");

  const sec = security.securityCheck(jid);
  if (!sec.ok) {
    if (sec.reason === "banned") return;
    if (sec.reason === "cooldown")
      return await reply(sock, chatId, cfg.msg.onCooldown(sec.wait));
  }

  const args    = body.split(" ");
  const command = args[0].toLowerCase();

  if (!command.startsWith("!")) {
    const res = games.cmdJawabKuis(chatId, jid, body);
    if (res) await reply(sock, chatId, res, [jid]);
    return;
  }

  if (["!hit", "!stand"].includes(command)) {
    const fn = command === "!hit" ? () => games.cmdBlackjackHit(jid) : () => games.cmdBlackjackStand(jid);
    const res = fn();
    if (res) await reply(sock, chatId, res, [jid]);
    return;
  }

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
    case "!resetkuis":
      if (isOwner) { db.resetQuizzes(); res = "✅ Reset kuis harian berhasil."; } 
      else res = "❌ Hanya owner bot yang bisa reset kuis.";
      break;  
    case "!unban": {
      if (!isOwner) { res = "❌ Khusus Owner!"; break; }
      if (!args[1]) { res = "❌ Format: *!unban [nomor_wa]*\nContoh: !unban 628xxx"; break; }
      const unbanNumber = args[1].replace(/[^0-9]/g, "");
      if (!unbanNumber) { res = "❌ Nomor tidak valid."; break; }
      const unbanTarget = `${unbanNumber}@s.whatsapp.net`;
      security.unbanUser(unbanTarget);
      res = `✅ Pengguna @${unbanNumber} telah di-unban. Mereka bisa mengirim pesan lagi.`;
      break;
    }

    // ── Media & Stiker ─────────────────────────────────────
    case "!stiker":
    case "!sticker":
    case "!s":
      await cmdStiker(sock, msg, chatId, jid);
      return; 
    case "!stiker2":
    case "!toimage":
      await cmdStikerToImage(sock, msg, chatId, jid);
      return;

    // ── Ekonomi Dasar ─────────────────────────────
    case "!saldo":       res = eco.cmdSaldo(jid); break;
    case "!daily":       res = eco.cmdDaily(jid); social.trackMisi(jid, "daily"); break;
    case "!kerja":       res = eco.cmdKerja(jid); social.trackMisi(jid, "kerja"); social.trackActivity(chatId, jid, "kerja"); break;
    case "!pinjam":      res = eco.cmdPinjam(jid, cleanBet); break;
    case "!bayarutang":  res = eco.cmdBayarUtang(jid, cleanBet); break;
    case "!asuransi":    res = eco.cmdAsuransi(jid); break;
    case "!crypto":      res = eco.cmdCrypto(); break;
    case "!buycrypto":   res = eco.cmdBuyCrypto(jid, cleanBet); break;
    case "!sellcrypto":  res = eco.cmdSellCrypto(jid, cleanBet); break;
    case "!transfer": {
      if (!args[1] || !args[2]) {
        res = "❌ Format: *!transfer [@tag] [jumlah]*\nContoh: *!transfer @628xxx 500*";
      } else {
        const transferTarget = mentionedJids[0] || args[1];
        const transferAmount = cleanNum(args[2]);
        res = eco.cmdTransfer(jid, transferTarget, transferAmount, chatId);
      }
      break;
    }
    case "!kasgrup":   res = eco.cmdKasGrup(chatId); break;
    case "!bagikasbot": {
      const isAdmin = await isGroupAdmin(sock, chatId, jid);
      res = eco.cmdBagiKas(chatId, jid, isAdmin || isOwner);
      break;
    }

    // ══════════════════════════════════════════════════
    //  PROPERTI, ASET UNIFIED & PAJAK PROGRESSIF
    // ══════════════════════════════════════════════════
    case "!pajak":
      res = eco.cmdPajak(jid); // Membaca data p.properti asli
      break;
    case "!beliaset":
    case "!beliproperti": 
      res = prop.cmdBeliProperti(jid, arg1Text); // Disatukan ke core engine properti.js
      break;
    case "!tokoaset":     res = prop.cmdTokoProperti(arg1Text); break;
    case "!jualproperti": res = prop.cmdJualProperti(jid, arg1Text); break;
    case "!asetku":       res = prop.cmdAsetku(jid); break;
    case "!klaimincome":  res = prop.cmdKlaimIncome(jid); break;
    
    // KPK
    case "!statuskpk":   res = prop.cmdStatusKPK(jid); break;
    case "!bayardenda":  res = prop.cmdBayarDenda(jid, cleanBet); break;
    case "!tebusaset":   res = prop.cmdTebusAset(jid, arg1Text); break;

    // ── Kasino (12 Games) ──────────────────────────────
    case "!slot": {
      res = games.cmdSlot(jid, cleanBet, chatId);
      if (res && res.includes("menang")) {
        social.trackMisi(jid, "slot_win");
        social.trackMisi(jid, "kasino_win");
        const winAmt = parseInt((res.match(/\+([0-9,]+) koin/) || [])[1]?.replace(/,/g,"")) || 0;
        if (winAmt > 10000) { const kpkMsg = prop.triggerKPKCheck(jid, winAmt, chatId); if (kpkMsg) res += kpkMsg; }
      }
      social.trackMisi(jid, "kasino_play");
      break;
    }
    case "!coinflip":     res = games.cmdCoinFlip(jid, cleanBet, arg2Text, chatId); social.trackMisi(jid, "kasino_play"); break;
    case "!tebakangka":   res = games.cmdTebakAngka(jid, cleanBet, cleanBet2, chatId); social.trackMisi(jid, "kasino_play"); break;
    case "!ranjau":       res = games.cmdRanjau(jid, cleanBet, cleanBet2, chatId); break;
    case "!dadu":         res = games.cmdDadu(jid, cleanBet, chatId); break;
    case "!rolet":        res = games.cmdRolet(jid, cleanBet, arg2Text, chatId); break;
    case "!hilo":         res = games.cmdHiLo(jid, cleanBet, arg2Text, chatId); break;
    case "!spin":         res = games.cmdSpin(jid, cleanBet, chatId); break;
    case "!balapkuda":    res = games.cmdBalapKuda(jid, cleanBet, args[2], chatId); break;
    case "!tebakkoin":    res = games.cmdTebakKoin(jid, cleanBet, arg2Text, chatId); break;
    case "!jackpotganda": res = games.cmdJackpotGanda(jid, cleanBet, args[2], chatId); break;
    case "!bomberman":    res = games.cmdBomberman(jid, cleanBet, cleanBet2, chatId); break;

    // ── Game Baru (23) ────────────────────────────────
    case "!tebakkartu":    res = games.cmdTebakKartu(jid, cleanBet, arg2Text, chatId); break;
    case "!tebakwarna":    res = games.cmdTebakWarna(jid, cleanBet, arg2Text, chatId); break;
    case "!dadu3":         res = games.cmdDadu3(jid, cleanBet, arg2Text, chatId); break;
    case "!ganjilgenap":   res = games.cmdGanjilGenap(jid, cleanBet, arg2Text, chatId); break;
    case "!kartupertak":   res = games.cmdKartuPetak(jid, cleanBet, cleanBet2, chatId); break;
    case "!membalik":      res = games.cmdMembalik(jid, cleanBet, arg2Text, chatId); break;
    case "!tebakprima":    res = games.cmdTebakPrima(jid, cleanBet, arg2Text, chatId); break;
    case "!lemparkartu":   res = games.cmdLemparKartu(jid, cleanBet, chatId); break;
    case "!tebakdadu":     res = games.cmdTebakDadu(jid, cleanBet, cleanBet2, chatId); break;
    case "!petarung":      res = games.cmdPetarung(jid, cleanBet, args[2], chatId); break;
    case "!lombrenang":    res = games.cmdLombaRenang(jid, cleanBet, args[2], chatId); break;
    case "!undian":        res = games.cmdUndian(jid, cleanBet, cleanBet2, chatId); break;
    case "!tembakbintang": res = games.cmdTembakBintang(jid, cleanBet, cleanBet2, chatId); break;
    case "!pindahkoin":    res = games.cmdPindahKoin(jid, cleanBet, arg2Text, chatId); break;
    case "!naiktangga":    res = games.cmdNaikTangga(jid, cleanBet, chatId); break;
    case "!cuacahari":     res = games.cmdCuacaHari(jid, cleanBet, arg2Text, chatId); break;
    case "!bombparty":     res = games.cmdBombParty(jid, cleanBet, cleanBet2, chatId); break;
    case "!tebakwaktu":    res = games.cmdTebakWaktu(jid, cleanBet, arg2Text, chatId); break;
    case "!baccarat":      res = games.cmdBaccarat(jid, cleanBet, arg2Text, chatId); break;
    case "!dragontiger":   res = games.cmdDragonTiger(jid, cleanBet, arg2Text, chatId); break;
    case "!tebakemoji":    res = games.cmdTebakEmoji(jid, cleanBet, args[2], chatId); break;
    case "!koin3":         res = games.cmdKoinSegitiga(jid, cleanBet, args[2], chatId); break;
    case "!mine":          res = games.cmdMineSweeper(jid, cleanBet, cleanBet2, chatId); break;

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

    // ══════════════════════════════════════════════════
    //  TOKO BUFF & SAHAM
    // ══════════════════════════════════════════════════
    case "!toko":        res = social.cmdToko(); break;
    case "!belibuff":    res = social.cmdBeliBuff(jid, arg1Text); break;
    case "!buffsaya":    res = social.cmdBuffSaya(jid); break;
    case "!saham":       res = social.cmdSaham(); break;
    case "!belisaham":   res = social.cmdBeliSaham(jid, arg1Text, cleanBet2); break;
    case "!jualsaham":   res = social.cmdJualSaham(jid, arg1Text, cleanBet2); break;
    case "!portofolio":  res = social.cmdPortofolio(jid); break;

    // ══════════════════════════════════════════════════
    //  RAMPOK & HADIAH
    // ══════════════════════════════════════════════════
    case "!rampok": {
      const rampokTarget = mentionedJids[0] || args[1];
      res = social.cmdRampok(jid, rampokTarget, chatId);
      if (res && res.includes("BERHASIL")) social.trackMisi(jid, "rampok_win");
      break;
    }
    case "!hadiah": {
      const hadiahTarget = mentionedJids[0] || args[1];
      const namaItem = args.slice(2).join(" ");
      res = social.cmdHadiah(jid, hadiahTarget, namaItem);
      break;
    }

    // ══════════════════════════════════════════════════
    //  LOTERE
    // ══════════════════════════════════════════════════
    case "!lotere":    res = social.cmdLotere(); break;
    case "!belitiket": {
      const qtyT = parseInt(args[1]) || 1;
      res = social.cmdBeliTiket(jid, qtyT);
      break;
    }
    case "!tiketku":   res = social.cmdTiketku(jid); break;

    // ══════════════════════════════════════════════════
    //  GUILD
    // ══════════════════════════════════════════════════
    case "!buatguild":  res = social.cmdBuatGuild(jid, args.slice(1).join(" ")); break;
    case "!gabungguild":res = social.cmdGabungGuild(jid, arg1Text); break;
    case "!keluarguild":res = social.cmdKeluarGuild(jid); break;
    case "!guild":      res = social.cmdInfoGuild(jid); break;
    case "!guildwar":   res = social.cmdGuildWar(jid, chatId); break;

    // ══════════════════════════════════════════════════
    //  MISI & REKAP
    // ══════════════════════════════════════════════════
    case "!misi":       res = social.cmdMisi(jid); break;
    case "!klaimmisi":  res = social.cmdKlaimMisi(jid, arg1Text); break;
    case "!rekap":      res = social.cmdRekap(chatId); break;

    // ══════════════════════════════════════════════════
    //  WORDLE & HANGMAN
    // ══════════════════════════════════════════════════
    case "!wordle":       res = games.cmdWordleStart(chatId, jid); break;
    case "!tebakwordle":  res = games.cmdTebakWordle(chatId, jid, args.slice(1).join("")); break;
    case "!hangman":      res = games.cmdHangmanStart(chatId, jid); break;
    case "!tebakhuruf":   res = games.cmdTebakHuruf(chatId, jid, arg1Text); break;

    // ══════════════════════════════════════════════════
    //  KASINO PREMIUM BARU
    // ══════════════════════════════════════════════════
    case "!crash": {
      const targetMulti = parseFloat(args[2]) || 2.0;
      res = games.cmdCrash(jid, cleanBet, targetMulti, chatId);
      if (res && res.includes("menang")) {
        const winAmt = parseInt((res.match(/\+([0-9,]+) koin/) || [])[1]?.replace(/,/g,"")) || 0;
        const kpkMsg = prop.triggerKPKCheck(jid, winAmt, chatId);
        if (kpkMsg) res += kpkMsg;
        social.trackMisi(jid, "kasino_win");
      }
      social.trackMisi(jid, "kasino_play");
      break;
    }
    case "!warkartu": {
      res = games.cmdWarKartu(jid, cleanBet, chatId);
      if (res && res.includes("menang")) {
        social.trackMisi(jid, "kasino_win");
        const winAmt = parseInt((res.match(/\+([0-9,]+) koin/) || [])[1]?.replace(/,/g,"")) || 0;
        const kpkMsg = prop.triggerKPKCheck(jid, winAmt, chatId);
        if (kpkMsg) res += kpkMsg;
      }
      social.trackMisi(jid, "kasino_play");
      break;
    }
    case "!sicbo": {
      res = games.cmdSicbo(jid, cleanBet, arg2Text, chatId);
      if (res && res.includes("menang")) social.trackMisi(jid, "kasino_win");
      social.trackMisi(jid, "kasino_play");
      break;
    }
    case "!pokerliar": {
      res = games.cmdPokerLiar(jid, cleanBet, chatId);
      if (res && res.includes("menang")) {
        social.trackMisi(jid, "kasino_win");
        const winAmt = parseInt((res.match(/\+([0-9,]+) koin/) || [])[1]?.replace(/,/g,"")) || 0;
        const kpkMsg = prop.triggerKPKCheck(jid, winAmt, chatId);
        if (kpkMsg) res += kpkMsg;
      }
      social.trackMisi(jid, "kasino_play");
      break;
    }
    case "!plinko": {
      res = games.cmdPlinko(jid, cleanBet, chatId);
      if (res && res.includes("menang")) social.trackMisi(jid, "kasino_win");
      social.trackMisi(jid, "kasino_play");
      break;
    }
    case "!tower":      res = games.cmdTower(jid, cleanBet, chatId); break;
    case "!towernaik":  res = games.cmdTowerNaik(jid, arg1Text); break;
    case "!towerkabur": res = games.cmdTowerKabur(jid); break;
    case "!togel": {
      const togelMode = (args[3] || "bb").toLowerCase();
      res = games.cmdTogel(jid, cleanBet, args[2], togelMode, chatId);
      if (res && res.includes("menang")) {
        social.trackMisi(jid, "kasino_win");
        const winAmt = parseInt((res.match(/\+([0-9,]+) koin/) || [])[1]?.replace(/,/g,"")) || 0;
        const kpkMsg = prop.triggerKPKCheck(jid, winAmt, chatId);
        if (kpkMsg) res += kpkMsg;
      }
      social.trackMisi(jid, "kasino_play");
      break;
    }

    default:
      return; 
  }

  if (res) {
    const mentionSet = new Set([jid, ...mentionedJids]);
    const mentionList = Array.from(mentionSet);
    await reply(sock, chatId, res, mentionList);
  }
}

// ──────────────────────────────────────────────────────────────
//  MENU UTAMA
// ──────────────────────────────────────────────────────────────
function buildMenu() {
  return (
    `🎮 *MINI GAMES HUB* — 65+ Game & Fitur Terintegrasi!\n\n` +

    `🏛️ *PROPERTI, ASET & PAJAK (FIXED)*\n` +
    `• !tokoaset — Daftar kendaraan & properti dijual\n` +
    `• !beliproperti [id] — Beli aset penambah income (Alias: !beliaset)\n` +
    `• !jualproperti [id] — Jual aset kembali (Dipotong 30%)\n` +
    `• !asetku — Lihat inventaris properti yang kamu miliki\n` +
    `• !klaimincome — Ambil semua pasif income dari asetmu\n` +
    `• !pajak — Cek rincian tagihan pajak progresif berkala\n\n` +

    `🎨 *MEDIA & STIKER PRO*\n` +
    `• !stiker — Ubah Gambar/Video/GIF (<10s) ke Stiker WebP\n` +
    `• !stiker2 — Ekstrak media stiker kembali jadi Gambar\n\n` +

    `🎰 *KASINO KLASIK (12)*\n` +
    `!slot !coinflip !tebakangka !ranjau\n` +
    `!dadu !rolet !hilo !spin\n` +
    `!balapkuda !tebakkoin !jackpotganda !bomberman\n\n` +

    `🃏 *KARTU & TEBAK (12)*\n` +
    `!tebakkartu !tebakwarna !lemparkartu\n` +
    `!baccarat !dragontiger !tebakdadu\n` +
    `!ganjilgenap !tebakprima !membalik\n` +
    `!tebakwaktu !tebakemoji !cuacahari\n\n` +

    `💣 *PILIH & HARAP (7)*\n` +
    `!kartupertak !undian !tembakbintang\n` +
    `!pindahkoin !koin3 !bombparty !mine\n\n` +

    `🎲 *DADU & ANGKA (3)*\n` +
    `!dadu3 !naiktangga !petarung\n\n` +

    `⚔️ *PVP & LOGIKA (4)*\n` +
    `!suit !blackjack (!hit/!stand)\n` +
    `!tebakoperasi !lombrenang\n\n` +

    `🧠 *TRIVIA (7)*\n` +
    `!kuis !tebakhewan !tebakbendera\n` +
    `!susunkata !mtk !tebakibukota !tebaklirik\n\n` +

    `🗺️ *RPG (5)*\n` +
    `!hunt !mancing !gacha !jual !ekspedisi\n\n` +

    `🚀 *KASINO PREMIUM (8)*\n` +
    `• !crash [bet] [multiplier] — Pesawat simulator\n` +
    `• !warkartu [bet] — Bandingkan kartu vs Dealer\n` +
    `• !sicbo [bet] [taruhan] — Tebak dadu premium\n` +
    `• !pokerliar [bet] — 5-Card Draw Poker\n` +
    `• !plinko [bet] — Jatuhkan bola keberuntungan\n` +
    `• !tower [bet] — Panjat menara bebas bom\n` +
    `• !togel [bet] [00-99] [as/bb] — Tebak angka berhadiah\n\n` +

    `🟩 *GAME SOSIAL GRUP (2)*\n` +
    `• !wordle — Tebak 5 huruf rahasia\n` +
    `• !hangman — Jangan biarkan karakter tergantung\n\n` +

    `🚔 *SISTEM REGULASI KPK*\n` +
    `• !statuskpk — Cek radar denda & penyitaan\n` +
    `• !bayardenda [nominal] — Cicil tanggungan KPK\n` +
    `• !tebusaset [id] — Ambil kembali aset sitaan\n\n` +

    `🛒 *TOKO BUFF & SAHAM GLOBAL*\n` +
    `• !toko — Akses item buff pengganda income\n` +
    `• !belibuff [id] — Aktivasi item efek khusus\n` +
    `• !buffsaya — Cek masa aktif buff\n` +
    `• !saham — Cek pergerakan bursa efek pasar\n` +
    `• !belisaham [kode] [qty] — Investasi modal\n` +
    `• !jualsaham [kode] [qty] — Cairkan lembar saham\n` +
    `• !portofolio — Cek kepemilikan modal pasar\n` +
    `• !rampok @target — Rebut paksa koin member\n` +
    `• !hadiah @target [item] — Berbagi inventaris\n\n` +

    `🎟️ *LOTERE HARIAN*\n` +
    `• !lotere — Info jackpot terkumpul\n` +
    `• !belitiket [qty] — Beli tiket lotere harian\n` +
    `• !tiketku — List tiket aktif\n\n` +

    `⚔️ *GUILD FACTION*\n` +
    `• !buatguild [nama] — Bentuk aliansi (2.000 koin)\n` +
    `• !gabungguild [id] — Masuk ke dalam markas aliansi\n` +
    `• !keluarguild — Keluar dari aliansi\n` +
    `• !guild — Dasbor profil aliansi\n` +
    `• !guildwar — Tantang aliansi lain\n\n` +

    `📋 *MISI & REKAP GRUP*\n` +
    `• !misi — List target harian/mingguan\n` +
    `• !klaimmisi [id] — Cairkan reward misi\n` +
    `• !rekap — 5 besar member teraktif hari ini\n\n` +

    `💳 *EKONOMI FINANSIAL*\n` +
    `!saldo !daily !kerja !profil !leaderboard\n` +
    `!transfer !pinjam !bayarutang !asuransi\n` +
    `!crypto !buycrypto !sellcrypto !kasgrup !bagikasbot\n\n` +

    `📌 Format Taruhan: *!game [taruhan] [pilihan]*\n` +
    `Contoh: *!crash 1000 3.5*`
  );
}

// ──────────────────────────────────────────────────────────────
startBot();
module.exports = { handleMessage };