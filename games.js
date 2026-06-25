// ============================================================
//  games.js — Game Core Unified (V6.0)
//  Merged: Original games.js + game2.js (Wordle, Hangman, Kasino Premium)
// ============================================================
require("./config");
const cfg = global.botConfig;
const db  = require("./db");
const { checkSpecificCooldown } = require("./security");

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const tag  = (jid) => `@${jid.split("@")[0]}`;
const num  = (n)   => n.toLocaleString();

// ══════════════════════════════════════════════════════════════
//  HELPER UMUM
// ══════════════════════════════════════════════════════════════
function takeBet(jid, bet) {
  if (!Number.isInteger(bet) || bet <= 0)
    return "❌ Taruhan harus angka bulat positif.";
  const wait = checkSpecificCooldown(jid, "casino", cfg.casinoCooldownMs);
  if (wait > 0) return cfg.msg.onCooldown(wait);
  const p = db.getPlayer(jid);
  if (p.has_debt) return cfg.msg.debtBlocked;
  if (p.balance < bet) return `${cfg.msg.noBalance} Saldo kamu: *${p.balance} koin*.`;
  return null;
}

// FIX UTAMA: Dulu saveJSON(PLAYERS_FILE, p) → hanya simpan 1 player, korup database!
// Sekarang addBalance/deductBalance sudah otomatis savePlayers() yang benar.
function processWin(jid, bet, multi, chatId, resultText) {
  const gross = Math.floor(bet * multi);
  const tax   = Math.floor(gross * (cfg.taxPercent / 100));
  const net   = gross - tax;
  db.addBalance(jid, net);   // ✓ saves correctly via savePlayers()
  db.addCashPool(chatId, tax);
  const p = db.getPlayer(jid);
  p.stats.wins++;
  db.savePlayers();
  return `${resultText}\n${tag(jid)} menang *+${num(net)} koin* 🎉 (saldo: ${num(p.balance)})`;
}

function processLose(jid, bet, chatId, resultText) {
  // FIX BUGS: Taruhan (bet) sudah di-deductBalance() SEBELUM game dimulai di setiap cmdXxx.
  // processLose hanya mengurus pajak kas, stat loss, dan asuransi — TIDAK boleh deduct lagi.
  const p      = db.getPlayer(jid);
  const wasIns = p.insurance.active && Date.now() < (p.insurance.expires_at || 0);
  // FIX BUGS: Pajak diambil dari kas grup berdasarkan bet, bukan memotong saldo player lagi
  const tax    = Math.floor(bet * (cfg.taxPercent / 100));
  db.addCashPool(chatId, tax);
  p.stats.losses++;
  db.savePlayers();
  // FIX BUGS: Deteksi apakah asuransi cair setelah deductBalance (sudah dilakukan db.js)
  const insNote = (wasIns && !p.insurance.active) ? "\n🛡️ *Asuransi cair!* Saldo dipulihkan." : "";
  // FIX BUGS: Saldo yang ditampilkan diambil SETELAH semua proses, dijamin tidak negatif
  return `${resultText}\n${tag(jid)} kalah *-${num(bet)} koin* 💀 (saldo: ${num(p.balance)})${insNote}`;
}

// ══════════════════════════════════════════════════════════════
//  1. KASINO — 12 GAMES
// ══════════════════════════════════════════════════════════════

// ── 1a. SLOT MACHINE ──────────────────────────────────────────
function cmdSlot(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const E    = cfg.slotEmojis;
  const roll = [0,1,2].map(() => E[rand(0, E.length - 1)]);
  const line = `🎰 ${roll.join(" ")}`;

  if (roll.every(r => r === "7️⃣"))
    return processWin(jid, bet, cfg.multipliers.slotSeven, chatId,
      `${line}\n🚨 *MEGA JACKPOT! TRIPLE 7!*`);
  if (roll[0] === roll[1] && roll[1] === roll[2])
    return processWin(jid, bet, cfg.multipliers.slotTriple, chatId,
      `${line}\n🎊 *JACKPOT! Tiga seragam!*`);
  if (roll[0]===roll[1] || roll[1]===roll[2] || roll[0]===roll[2])
    return processWin(jid, bet, cfg.multipliers.slotDouble, chatId,
      `${line}\n✨ Double!`);
  return processLose(jid, bet, chatId, `${line}\nZonk!`);
}

// ── 1b. COIN FLIP ─────────────────────────────────────────────
function cmdCoinFlip(jid, bet, choice, chatId) {
  if (!["heads","tails"].includes(choice))
    return "❌ Pilih: *heads* atau *tails*. Contoh: *!coinflip 500 heads*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const side  = rand(0,1) === 0 ? "heads" : "tails";
  const emoji = side === "heads" ? "🪙▲" : "🪙▽";
  const text  = `${emoji} Koin jatuh: *${side.toUpperCase()}*`;
  return choice === side
    ? processWin(jid, bet, cfg.multipliers.coinFlip, chatId, text)
    : processLose(jid, bet, chatId, text);
}

// ── 1c. TEBAK ANGKA ───────────────────────────────────────────
function cmdTebakAngka(jid, bet, guess, chatId) {
  if (guess < 1 || guess > 10)
    return "❌ Tebak angka antara 1–10. Contoh: *!tebakangka 500 7*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const target = rand(1, 10);
  const text   = `🎯 Angka keluar: *${target}*`;
  if (guess === target)
    return processWin(jid, bet, cfg.multipliers.tebakAngka, chatId, `${text} — TEPAT!`);
  if (Math.abs(guess - target) === 1) {
    db.addBalance(jid, bet);
    return `${text}\n${tag(jid)} meleset tipis! Taruhan dikembalikan.`;
  }
  return processLose(jid, bet, chatId, text);
}

// ── 1d. RANJAU ────────────────────────────────────────────────
function cmdRanjau(jid, bet, step, chatId) {
  if (step < 1 || step > 5)
    return "❌ Pilih langkah 1–5. Contoh: *!ranjau 500 3*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const bomb  = rand(1, 5);
  const track = [1,2,3,4,5].map(i =>
    i === bomb ? "💣" : (i === step ? "👟" : "⬜")
  ).join("");
  if (step === bomb)
    return processLose(jid, bet, chatId, `${track}\n💥 *BOOM!* Ranjau di langkah ${step}!`);
  return processWin(jid, bet, cfg.multipliers.ranjau, chatId,
    `${track}\n✅ Aman! Ranjau ada di langkah ${bomb}.`);
}

// ── 1e. DADU ──────────────────────────────────────────────────
function cmdDadu(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const DADU = ["","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣"];
  const p    = rand(1, 6);
  const b    = rand(1, 6);
  const text = `🎲 Kamu: ${DADU[p]}  vs  Bot: ${DADU[b]}`;
  if (p > b) return processWin(jid, bet, cfg.multipliers.dadu, chatId, text);
  if (p === b) { db.addBalance(jid, bet); return `${text}\n⚖️ Seri! Taruhan kembali.`; }
  return processLose(jid, bet, chatId, text);
}

// ── 1f. ROLET ─────────────────────────────────────────────────
function cmdRolet(jid, bet, choice, chatId) {
  if (!["merah","hitam","hijau"].includes(choice))
    return "❌ Pilih: *merah*, *hitam*, atau *hijau*. Contoh: *!rolet 500 merah*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const num2  = rand(0, 36);
  let color   = "hijau";
  if (num2 !== 0) color = num2 % 2 === 0 ? "hitam" : "merah";
  const emo   = { merah:"🔴", hitam:"⚫", hijau:"🟢" };
  const text  = `🎡 Rolet berhenti di *${num2}* ${emo[color]}`;
  if (choice === color)
    return processWin(jid, bet, color === "hijau" ? cfg.multipliers.roletHijau : cfg.multipliers.rolet, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// ── 1g. HI-LO ─────────────────────────────────────────────────
function cmdHiLo(jid, bet, choice, chatId) {
  if (!["hi","lo"].includes(choice))
    return "❌ Pilih: *hi* (>50) atau *lo* (≤50). Contoh: *!hilo 500 hi*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const n    = rand(1, 100);
  const text = `📊 Angka keluar: *${n}*`;
  const isHi = n > 50;
  if ((choice==="hi" && isHi) || (choice==="lo" && !isHi))
    return processWin(jid, bet, cfg.multipliers.hilo, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// ── 1h. SPIN ──────────────────────────────────────────────────
function cmdSpin(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const zones = [
    { label: "ZONK 💀",      multi: 0 },
    { label: "MENANG ✅",    multi: cfg.multipliers.spin },
    { label: "ZONK 💀",      multi: 0 },
    { label: "ZONK 💀",      multi: 0 },
        { label: "ZONK 💀",      multi: 0 },
    { label: "ZONK 💀",      multi: 0 },
        { label: "ZONK 💀",      multi: 0 },
    { label: "ZONK 💀",      multi: 0 },
        { label: "ZONK 💀",      multi: 0 },
    { label: "ZONK 💀",      multi: 0 },
        { label: "ZONK 💀",      multi: 0 },
    { label: "ZONK 💀",      multi: 0 },
        { label: "ZONK 💀",      multi: 0 },
    { label: "ZONK 💀",      multi: 0 },
        { label: "ZONK 💀",      multi: 0 },
    { label: "ZONK 💀",      multi: 0 },
        { label: "ZONK 💀",      multi: 0 },
    { label: "ZONK 💀",      multi: 0 },
    { label: "MENANG ✅",    multi: cfg.multipliers.spin },
     { label: "MENANG ✅",    multi: cfg.multipliers.spin },
      { label: "MENANG ✅",    multi: cfg.multipliers.spin },
    { label: "JACKPOT 🌟",   multi: cfg.multipliers.spinJackpot },
  ];
  const res  = zones[rand(0, zones.length - 1)];
  const text = `🌀 Roda berhenti: *${res.label}*`;
  if (res.multi > 0) return processWin(jid, bet, res.multi, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// ── 1i. BALAP KUDA ────────────────────────────────────────────
function cmdBalapKuda(jid, bet, kudaStr, chatId) {
  const kuda = parseInt(kudaStr);
  if (isNaN(kuda) || kuda < 1 || kuda > 4)
    return "❌ Pilih kuda 1–4. Contoh: *!balapkuda 500 3*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const names  = ["Angin 🐎","Kilat 🐎","Badai 🐎","Petir 🐎"];
  const winner = rand(0, 3);
  const track  = names.map((n, i) => `${i===winner?"🏁":"  "} ${i===winner?n:n.replace("🐎","🐴")}`).join("\n");
  const text   = `🏇 *Balap Selesai!*\n${track}\nPemenang: *${names[winner]}* (No.${winner+1})`;
  if (kuda - 1 === winner) return processWin(jid, bet, cfg.multipliers.balapkuda, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// ── 1j. TEBAK KOIN ────────────────────────────────────────────
function cmdTebakKoin(jid, bet, hand, chatId) {
  if (!["kiri","kanan"].includes(hand))
    return "❌ Pilih: *kiri* atau *kanan*. Contoh: *!tebakkoin 500 kiri*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const ans  = rand(0,1) === 0 ? "kiri" : "kanan";
  const anim = ans === "kiri" ? "🤜🪙    " : "    🪙🤛";
  const text = `${anim}\nKoin ada di tangan *${ans.toUpperCase()}*!`;
  if (hand === ans) return processWin(jid, bet, cfg.multipliers.tebakkoin, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// ── 1k. JACKPOT GANDA ─────────────────────────────────────────
function cmdJackpotGanda(jid, bet, choice, chatId) {
  if (!["1","2"].includes(choice))
    return "❌ Pilih bola *1* atau *2*. Contoh: *!jackpotganda 500 1*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const win  = rand(1,2).toString();
  const text = `🔮 Bola 1: ${win==="1"?"⭐":"💀"}  Bola 2: ${win==="2"?"⭐":"💀"}`;
  if (choice === win)
    return processWin(jid, bet, cfg.multipliers.jackpotGanda, chatId, `${text}\n✨ Bola yang benar!`);
  return processLose(jid, bet, chatId, `${text}\nBola kamu kosong!`);
}

// ── 1l. BOMBERMAN ─────────────────────────────────────────────
function cmdBomberman(jid, bet, cell, chatId) {
  if (cell < 1 || cell > 9)
    return "❌ Pilih kotak 1–9. Contoh: *!bomberman 500 5*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const bombs = new Set();
  while (bombs.size < 3) bombs.add(rand(1, 9));
  const grid = Array.from({length:9}, (_,i) => {
    const n = i + 1;
    if (bombs.has(n)) return n === cell ? "💥" : "💣";
    return n === cell ? "✅" : "⬜";
  });
  const display = [
    grid.slice(0,3).join(" "),
    grid.slice(3,6).join(" "),
    grid.slice(6,9).join(" ")
  ].join("\n");
  if (!bombs.has(cell))
    return processWin(jid, bet, cfg.multipliers.bomberman, chatId, `💣 Bomberman\n${display}\nKotak aman!`);
  return processLose(jid, bet, chatId, `💣 Bomberman\n${display}\n*BOOM!*`);
}

// ══════════════════════════════════════════════════════════════
//  2. PVP & LOGIKA — 3 GAMES
// ══════════════════════════════════════════════════════════════

// ── 2a. SUIT ──────────────────────────────────────────────────
function cmdSuit(jid, bet, choice, chatId) {
  const valid = ["batu","gunting","kertas"];
  if (!valid.includes(choice))
    return "❌ Pilih: *batu*, *gunting*, atau *kertas*. Contoh: *!suit 500 batu*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const emo = { batu:"🪨", gunting:"✂️", kertas:"📄" };
  const b   = valid[rand(0,2)];
  const text = `${emo[choice]} Kamu: *${choice}*  vs  Bot: *${b}* ${emo[b]}`;
  if (choice === b) { db.addBalance(jid, bet); return `${text}\n⚖️ Seri! Taruhan kembali.`; }
  const win = (choice==="batu"&&b==="gunting") || (choice==="gunting"&&b==="kertas") || (choice==="kertas"&&b==="batu");
  return win
    ? processWin(jid, bet, cfg.multipliers.suit, chatId, text)
    : processLose(jid, bet, chatId, text);
}

// ── 2b. BLACKJACK ─────────────────────────────────────────────
const BJ_VALUES = [2,3,4,5,6,7,8,9,10,10,10,10,11];

function drawCard()  { return BJ_VALUES[rand(0, BJ_VALUES.length-1)]; }
function handTotal(hand) {
  let total = hand.reduce((a,b) => a+b, 0);
  let aces  = hand.filter(c => c===11).length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function cmdBlackjackStart(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  const p   = db.getPlayer(jid);
  if (p.game_session.status === "playing_blackjack")
    return "❌ Masih ada sesi Blackjack aktif! Ketik *!hit* atau *!stand*.";
  db.deductBalance(jid, bet);
  const pH = [drawCard(), drawCard()];
  const dH = [drawCard(), drawCard()];
  p.game_session = { status: "playing_blackjack", data: { bet, playerHand: pH, dealerHand: dH, chatId } };
  db.savePlayers();

  const pTotal = handTotal(pH);
  if (pTotal === 21) {
    p.game_session.status = null;
    return processWin(jid, bet, cfg.multipliers.blackjackBJ, chatId,
      `♠️ *NATURAL BLACKJACK!* 21 dari 2 kartu!\nKartu: ${pH.join(", ")}`);
  }
  return (
    `♠️ *Blackjack — ${tag(jid)}*\n` +
    `Kartumu  : ${pH.join(", ")} _(${pTotal})_\n` +
    `Dealer   : ${dH[0]}, ❓\n` +
    `*!hit* ambil kartu | *!stand* berhenti`
  );
}

function cmdBlackjackHit(jid) {
  const p = db.getPlayer(jid);
  if (p.game_session.status !== "playing_blackjack") return null;
  const data = p.game_session.data;
  data.playerHand.push(drawCard());
  const total = handTotal(data.playerHand);
  if (total > 21) {
    // FIX BUGS: Clear session dulu dan save agar tidak bisa di-hit lagi setelah bust
    p.game_session = { status: null, data: {} };
    db.savePlayers();
    // FIX BUGS: Bet sudah dipotong saat !blackjack — processLose TIDAK deduct lagi (hanya stat + kas)
    return processLose(jid, data.bet, data.chatId,
      `💥 *Bust!* Total: ${total} (${data.playerHand.join(", ")})`);
  }
  db.savePlayers();
  return (
    `♠️ *Hit!*\n` +
    `Kartumu: ${data.playerHand.join(", ")} _(${total})_\n` +
    `Dealer : ${data.dealerHand[0]}, ❓\n` +
    `*!hit* lagi atau *!stand*?`
  );
}

function cmdBlackjackStand(jid) {
  const p = db.getPlayer(jid);
  if (p.game_session.status !== "playing_blackjack") return null;
  const data = p.game_session.data;
  // FIX BUGS: Salin data dulu sebelum clear session, agar tidak hilang saat direferensi
  const { bet, playerHand, dealerHand, chatId: bjChatId } = data;
  // FIX BUGS: Clear session penuh sebelum resolve agar tidak bisa !stand dua kali
  p.game_session = { status: null, data: {} };
  db.savePlayers();

  while (handTotal(dealerHand) < 17) dealerHand.push(drawCard());
  const pT = handTotal(playerHand);
  const dT = handTotal(dealerHand);
  const text = (
    `♠️ *Blackjack — Hasil*\n` +
    `Kartumu : ${playerHand.join(", ")} _(${pT})_\n` +
    `Dealer  : ${dealerHand.join(", ")} _(${dT})_`
  );
  if (dT > 21 || pT > dT)
    return processWin(jid, bet, cfg.multipliers.blackjack, bjChatId, text);
  // FIX BUGS: Seri — kembalikan bet, tidak ada pajak
  if (pT === dT) { db.addBalance(jid, bet); return `${text}\n⚖️ Seri! Taruhan kembali.`; }
  // FIX BUGS: Kalah — bet sudah dipotong di awal; processLose hanya catat stat & kas
  return processLose(jid, bet, bjChatId, text);
}

// ── 2c. TEBAK OPERASI ─────────────────────────────────────────
function cmdTebakOperasi(chatId, jid) {
  if (db.getActiveSession(chatId)) return cfg.msg.quizLocked;
  const ops = ["+","-","*"];
  const op1 = ops[rand(0,2)], op2 = ops[rand(0,2)];
  const a = rand(1,20), b = rand(1,20), c = rand(1,10);
  // eslint-disable-next-line no-new-func
  const ans = new Function(`return ${a} ${op1} ${b} ${op2} ${c}`)();
  if (!Number.isInteger(ans)) return cmdTebakOperasi(chatId, jid);
  db.setActiveSession(chatId, { quiz: { a: ans.toString() }, expiresAt: Date.now() + cfg.quizTimeoutMs, askedBy: jid });
  setTimeout(() => { if (db.getActiveSession(chatId)) db.clearActiveSession(chatId); }, cfg.quizTimeoutMs);
  return (
    `🔢 *Tebak Operasi*\n` +
    `Soal: *${a} ${op1} ${b} ${op2} ${c} = ?*\n` +
    `Jawab sekarang! 30 detik. Hadiah 200–500 koin 💰`
  );
}

// ══════════════════════════════════════════════════════════════
//  3. TRIVIA — 7 GAMES
// ══════════════════════════════════════════════════════════════
const Q_UMUM = [
  {q:"Hewan gurun berpunuk?",a:"unta"},
  {q:"Kereta di rel tunggal?",a:"monorel"},
  {q:"Alat mengukur suhu?",a:"termometer"},
  {q:"Benda langit mengelilingi matahari?",a:"planet"},
  {q:"Ibukota Indonesia?",a:"jakarta"},
  {q:"Lambang kimia air?",a:"h2o"},
  {q:"Organ memompa darah?",a:"jantung"},
  {q:"Hewan tercepat di darat?",a:"cheetah"},
  {q:"Benua terbesar?",a:"asia"},
  {q:"Gunung tertinggi di dunia?",a:"everest"},
  {q:"Pusat tata surya kita?",a:"matahari"},
  {q:"Bahasa pemrograman web paling dasar?",a:"html"},
  {q:"Alat melihat benda jauh di langit?",a:"teleskop"},
  {q:"Makanan khas Jepang dari nasi dan ikan?",a:"sushi"},
  {q:"Air membeku menjadi?",a:"es"},
  {q:"Negara asal pizza?",a:"italia"},
  {q:"Pemain sepak bola menjaga gawang?",a:"kiper"},
  {q:"Laut terbesar di dunia?",a:"pasifik"},
  {q:"Planet merah?",a:"mars"},
  {q:"Hewan yang menghasilkan madu?",a:"lebah"},
  {q:"Bulan paling pendek?",a:"februari"},
  {q:"Hewan berkantong?",a:"kanguru"},
  {q:"Mata uang Jepang?",a:"yen"},
  {q:"Hewan yang bisa berubah warna?",a:"bunglon"},
  {q:"Sungai terpanjang di dunia?",a:"nil"},
  {q:"Pulau terbesar di Indonesia?",a:"kalimantan"},
  {q:"Negara dengan Menara Eiffel?",a:"prancis"},
  {q:"Zat pernapasan makhluk hidup?",a:"oksigen"},
  {q:"Hewan berkaki delapan?",a:"laba laba"},
  {q:"Planet terbesar di tata surya?",a:"jupiter"},
  {q:"Bunga nasional Indonesia?",a:"melati"},
  {q:"Penemu lampu pijar?",a:"edison"},
  {q:"Satuan kuat arus listrik?",a:"ampere"},
  {q:"Lapisan bumi tempat kita tinggal?",a:"kerak"},
  {q:"Bahasa persatuan Indonesia?",a:"bahasa indonesia"},
  {q:"Presiden pertama Indonesia?",a:"soekarno"},
  {q:"Hari kemerdekaan Indonesia?",a:"17 agustus"},
  {q:"Pancasila terdiri dari berapa sila?",a:"5"},
  {q:"Danau terbesar di Indonesia?",a:"toba"},
  {q:"Alat musik tradisional Jawa?",a:"gamelan"},
  {q:"Tarian tradisional Bali?",a:"kecak"},
  {q:"Mata uang Indonesia?",a:"rupiah"},
  {q:"Gas yang membuat balon terbang?",a:"helium"},
  {q:"Warna bendera Indonesia bagian atas?",a:"merah"},
  {q:"Mamalia terbesar di bumi?",a:"paus biru"},
  {q:"Negara tirai bambu?",a:"china"},
  {q:"Benua terkecil?",a:"australia"},
  {q:"Ibukota Malaysia?",a:"kuala lumpur"},
  {q:"Organ untuk bernapas pada manusia?",a:"paru paru"},
  {q:"Planet terdekat dari matahari?",a:"merkurius"},
  {q:"Burung lambang negara Indonesia?",a:"garuda"},
  {q:"Bahan utama pembuatan cokelat?",a:"kakao"},
  {q:"Mata uang Amerika Serikat?",a:"dolar"},
  {q:"Alat penunjuk arah mata angin?",a:"kompas"},
  {q:"Suhu air mendidih dalam Celcius?",a:"100"},
  {q:"Hewan purba yang sudah punah?",a:"dinosaurus"},
  {q:"Benua tempat Piramida berada?",a:"afrika"},
  {q:"Kain tradisional asli Indonesia?",a:"batik"},
  {q:"Presiden kedua Indonesia?",a:"soeharto"},
  {q:"Lagu kebangsaan Indonesia?",a:"indonesia raya"},
  {q:"Gunung tertinggi di Jawa?",a:"semeru"},
  {q:"Selat antara Jawa dan Sumatra?",a:"sunda"},
  {q:"Seni bela diri asli Indonesia?",a:"pencak silat"},
  {q:"Singkatan NKRI?",a:"nkri"},
  {q:"Hewan reptil terbesar di Indonesia?",a:"komodo"},
  {q:"Pencipta lagu Indonesia Raya?",a:"wr supratman"},
  {q:"Jumlah warna pada pelangi?",a:"7"},
  {q:"Negara terkecil di dunia?",a:"vatikan"},
  {q:"Penemu benua Amerika?",a:"columbus"},
  {q:"Planet yang punya cincin paling besar?",a:"saturnus"},
  {q:"Hari Kartini diperingati bulan?",a:"april"},
  {q:"Ibukota Inggris?",a:"london"},
  {q:"Alat untuk mengukur gempa?",a:"seismograf"},
  {q:"Proses pembuatan makanan oleh tumbuhan?",a:"fotosintesis"},
  {q:"Seni melipat kertas dari Jepang?",a:"origami"},
  {q:"Tari tradisional dari Aceh?",a:"saman"},
  {q:"Ibukota Jawa Barat?",a:"bandung"},
  {q:"Monas singkatan dari?",a:"monumen nasional"},
  {q:"Hewan yang memakan tumbuhan?",a:"herbivora"},
  {q:"Hewan yang memakan daging?",a:"karnivora"},
  {q:"Hewan yang memakan segala?",a:"omnivora"},
  {q:"Negara kincir angin?",a:"belanda"},
  {q:"Ibukota Arab Saudi?",a:"riyadh"},
  {q:"Candi Buddha terbesar di Indonesia?",a:"borobudur"},
  {q:"Candi Hindu terbesar di Indonesia?",a:"prambanan"},
  {q:"Alat pernapasan pada ikan?",a:"insang"},
  {q:"Ibukota Korea Selatan?",a:"seoul"},
  {q:"Penemu gaya gravitasi?",a:"newton"},
  {q:"Cabang olahraga menggunakan raket dan kok?",a:"bulu tangkis"},
  {q:"Pulau di Indonesia dijuluki Pulau Dewata?",a:"bali"},
  {q:"Bumi berputar pada porosnya disebut?",a:"rotasi"},
  {q:"Bumi mengelilingi matahari disebut?",a:"revolusi"},
  {q:"Satu abad sama dengan berapa tahun?",a:"100"},
  {q:"Gas paling banyak di atmosfer bumi?",a:"nitrogen"},
  {q:"Garam dapur rumus kimianya?",a:"nacl"},
  {q:"Ilmuwan penemu teori relativitas?",a:"einstein"},
  {q:"Kota suci Islam tempat Ka'bah berada?",a:"mekkah"},
  {q:"Ibukota Australia?",a:"canberra"},
  {q:"Patung Liberty ada di kota?",a:"new york"},
  {q:"Sungai terpanjang di Jawa?",a:"bengawan solo"},
  {q:"Suku asli Jakarta?",a:"betawi"},
  {q:"Makanan khas Palembang dari ikan?",a:"pempek"},
  {q:"Makanan khas Yogya dari nangka muda?",a:"gudeg"},
  {q:"Rumah adat Papua?",a:"honai"},
  {q:"Senjata tradisional Jawa?",a:"keris"},
  {q:"Wakil Presiden pertama Indonesia?",a:"mohammad hatta"},
  {q:"Bapak Pendidikan Nasional?",a:"ki hajar dewantara"},
  {q:"Hari Pahlawan diperingati tanggal?",a:"10 november"},
  {q:"Sumpah Pemuda tanggal?",a:"28 oktober"},
  {q:"Lambang sila pertama Pancasila?",a:"bintang"},
  {q:"Ibukota Thailand?",a:"bangkok"},
  {q:"Negara dijuluki Negeri Sakura?",a:"jepang"},
  {q:"Kanal terkenal di Mesir?",a:"suez"},
  {q:"Tembok raksasa ada di?",a:"china"},
  {q:"Hewan yang hidup di dua alam?",a:"amfibi"},
  {q:"Indera manusia untuk mengecap?",a:"lidah"},
  {q:"Penyakit demam berdarah disebarkan nyamuk?",a:"aedes aegypti"},
  {q:"Simbiosis saling menguntungkan?",a:"mutualisme"},
  {q:"Gas buangan hasil pernapasan manusia?",a:"karbondioksida"},
  {q:"Ilmu yang mempelajari cuaca?",a:"meteorologi"},
  {q:"Benda penarik logam besi?",a:"magnet"},
  {q:"Warna campuran merah dan kuning?",a:"oranye"},
  {q:"Warna campuran biru dan kuning?",a:"hijau"},
  {q:"Sistem penunjuk lokasi global berbasis satelit?",a:"gps"},
  {q:"Browser buatan Google?",a:"chrome"},
  {q:"Pendiri Microsoft?",a:"bill gates"},
];

const Q_HEWAN = [
  {q:"🐘",a:"gajah"},{q:"🦇",a:"kelelawar"},{q:"🐧",a:"penguin"},
  {q:"🐅",a:"harimau"},{q:"🐢",a:"kura kura"},{q:"🦁",a:"singa"},
  {q:"🐬",a:"lumba lumba"},{q:"🦉",a:"burung hantu"},{q:"🦒",a:"jerapah"},
  {q:"🐍",a:"ular"},{q:"🐙",a:"gurita"},{q:"🦀",a:"kepiting"},
  {q:"🐒",a:"monyet"},{q:"🐑",a:"domba"},{q:"🐎",a:"kuda"},
  {q:"🐄",a:"sapi"},{q:"🐖",a:"babi"},{q:"🐐",a:"kambing"},
  {q:"🐪",a:"unta"},{q:"🦋",a:"kupu kupu"},{q:"🐝",a:"lebah"},
  {q:"🐜",a:"semut"},{q:"🦈",a:"hiu"},{q:"🐋",a:"paus"},
  {q:"🦘",a:"kanguru"},{q:"🐻",a:"beruang"},{q:"🦊",a:"rubah"},
  {q:"🐶",a:"anjing"},{q:"🐱",a:"kucing"},{q:"🐔",a:"ayam"},
  {q:"🦆",a:"bebek"},{q:"🦢",a:"angsa"},{q:"🦩",a:"flamingo"},
  {q:"🦚",a:"merak"},{q:"🦜",a:"kakatua"},{q:"🦎",a:"kadal"},
  {q:"🐊",a:"buaya"},{q:"🦓",a:"zebra"},{q:"🦔",a:"landak"},
  {q:"🦥",a:"kungkang"},{q:"🦦",a:"berang berang"},{q:"🦭",a:"anjing laut"},
  {q:"🐓",a:"ayam jantan"},{q:"🦃",a:"kalkun"},{q:"🦅",a:"elang"},
];

const Q_BENDERA = [
  {q:"🇯🇵",a:"jepang"},{q:"🇨🇦",a:"kanada"},{q:"🇧🇷",a:"brasil"},
  {q:"🇮🇩",a:"indonesia"},{q:"🇺🇸",a:"amerika serikat"},{q:"🇬🇧",a:"inggris"},
  {q:"🇫🇷",a:"prancis"},{q:"🇩🇪",a:"jerman"},{q:"🇮🇹",a:"italia"},
  {q:"🇪🇸",a:"spanyol"},{q:"🇰🇷",a:"korea selatan"},{q:"🇨🇳",a:"cina"},
  {q:"🇮🇳",a:"india"},{q:"🇷🇺",a:"rusia"},{q:"🇦🇺",a:"australia"},
  {q:"🇳🇿",a:"selandia baru"},{q:"🇹🇭",a:"thailand"},{q:"🇻🇳",a:"vietnam"},
  {q:"🇲🇾",a:"malaysia"},{q:"🇸🇬",a:"singapura"},{q:"🇵🇭",a:"filipina"},
  {q:"🇸🇦",a:"arab saudi"},{q:"🇹🇷",a:"turki"},{q:"🇳🇱",a:"belanda"},
  {q:"🇧🇪",a:"belgia"},{q:"🇨🇭",a:"swiss"},{q:"🇸🇪",a:"swedia"},
  {q:"🇳🇴",a:"norwegia"},{q:"🇩🇰",a:"denmark"},{q:"🇫🇮",a:"finlandia"},
  {q:"🇵🇱",a:"polandia"},{q:"🇬🇷",a:"yunani"},{q:"🇵🇹",a:"portugal"},
  {q:"🇦🇷",a:"argentina"},{q:"🇨🇱",a:"chile"},{q:"🇲🇽",a:"meksiko"},
  {q:"🇿🇦",a:"afrika selatan"},{q:"🇪🇬",a:"mesir"},{q:"🇳🇬",a:"nigeria"},
  {q:"🇰🇪",a:"kenya"},{q:"🇦🇪",a:"uni emirat arab"},{q:"🇶🇦",a:"qatar"},
  {q:"🇺🇦",a:"ukraina"},{q:"🇵🇰",a:"pakistan"},{q:"🇨🇴",a:"kolombia"},
  {q:"🇮🇷",a:"iran"},{q:"🇯🇴",a:"yordania"},
];

const Q_KATA = [
  {q:"O-K-U-T-M-P-R-E",a:"komputer"},
  {q:"M-A-R-U-H",a:"rumah"},
  {q:"R-I-H-A-A-M-A-T",a:"matahari"},
  {q:"A-S-P-K-A-A-P-U-T-R-A-N-E-R",a:"perpustakaan"},
  {q:"L-H-A-K-O-E-S",a:"sekolah"},
  {q:"I-E-L-T-I-S-V-E",a:"televisi"},
  {q:"A-P-S-E-W-A-T",a:"pesawat"},
  {q:"K-E-A-R-D-M-E",a:"merdeka"},
  {q:"A-H-S-B-A-A",a:"bahasa"},
  {q:"I-S-K-M-U",a:"musik"},
  {q:"R-A-B-A-M-G",a:"gambar"},
  {q:"Y-A-C-H-A-A",a:"cahaya"},
  {q:"R-A-A-U-S",a:"suara"},
  {q:"A-H-T-A-N",a:"tanah"},
  {q:"A-H-U-J-N",a:"hujan"},
  {q:"L-A-N-U-B",a:"bulan"},
  {q:"I-A-N-U-S-G",a:"sungai"},
  {q:"U-L-T-A",a:"laut"},
  {q:"N-I-A-G-N",a:"angin"},
  {q:"P-I-A",a:"api"},
  {q:"M-E-A-T-N",a:"teman"},
  {q:"A-G-A-B-N-S",a:"bangsa"},
  {q:"Y-T-A-R-K-A",a:"rakyat"},
  {q:"A-N-R-G-E-A",a:"negara"},
  {q:"A-U-A-B-Y-D",a:"budaya"},
  {q:"A-C-I-T-N",a:"cinta"},
  {q:"A-M-D-I-A",a:"damai"},
  {q:"T-S-E-H-A",a:"sehat"},
  {q:"N-A-L-A-J",a:"jalan"},
  {q:"R-M-A-A-K",a:"kamar"},
  {q:"K-B-U-U",a:"buku"},
  {q:"T-M-A-A",a:"mata"},
  {q:"N-G-A-T-A-N",a:"tangan"},
  {q:"R-T-I-B-A-E",a:"berita"},
  {q:"A-P-E-T",a:"peta"},
  {q:"A-G-U-R-N",a:"ruang"},
  {q:"S-A-G-E-L",a:"gelas"},
  {q:"A-T-K-B-I",a:"kitab"},

  {q:"N-I-T-E-R-N-E-T",a:"internet"},
  {q:"R-G-A-M-O-R-P",a:"program"},
  {q:"A-I-K-P-L-A-S-I",a:"aplikasi"},
  {q:"T-B-O-R-O",a:"robot"},
  {q:"M-E-T-I-S-S",a:"sistem"},
  {q:"A-T-D-A",a:"data"},
  {q:"R-E-V-R-E-S",a:"server"},
  {q:"R-E-T-N-I-N-G",a:"integer"},
  {q:"R-A-J-I-N-G-N",a:"jaringan"},
  {q:"B-E-W-E-S-T-I",a:"website"},
  {q:"A-M-E-R-K",a:"kamera"},
  {q:"R-O-T-K-Y-E",a:"keyboard"},
  {q:"R-I-T-N-R-P-E",a:"printer"},
  {q:"T-I-N-O-R-M",a:"monitor"},
  {q:"K-E-S-U-T-I-T-R",a:"router"},
  {q:"P-A-T-L-O",a:"laptop"},
  {q:"O-S-E-L-N-P",a:"ponsel"},
  {q:"R-A-D-I-O",a:"radio"},
  {q:"A-S-I-N-E-M",a:"mesin"},
  {q:"L-I-B-O-M",a:"mobil"},
  {q:"A-E-R-T-K",a:"kereta"},
  {q:"A-L-P-E-K-A",a:"kepala"},
  {q:"N-G-A-T-U-N-G",a:"gunting"},
  {q:"A-E-J-M",a:"meja"},
  {q:"I-R-S-K-U",a:"kursi"},
  {q:"N-D-E-J-E-LA",a:"jendela"},
  {q:"A-I-N-T-P",a:"pantai"},
  {q:"A-U-N-G-G-N",a:"gunung"},
  {q:"A-H-T-U",a:"hutan"},
  {q:"A-W-A-S-H",a:"sawah"},
  {q:"A-N-K-A-I-K",a:"ikan"},
  {q:"J-A-G-A-H",a:"gajah"},
  {q:"A-M-A-C-H",a:"macan"},
  {q:"A-G-R-U-D",a:"garuda"},
  {q:"A-Y-A-B",a:"bayi"},
  {q:"U-R-G-U",a:"guru"},
  {q:"T-E-D-K-O-R",a:"dokter"},
  {q:"I-S-L-O-P-I",a:"polisi"},
  {q:"T-E-R-I-N-M-E",a:"menteri"},
  {q:"D-E-N-S-I-O-N-I-A",a:"indonesia"}
];

const Q_IBUKOTA = [
  {q:"Ibukota Jepang?",a:"tokyo"},
  {q:"Ibukota Prancis?",a:"paris"},
  {q:"Ibukota Amerika Serikat?",a:"washington"},
  {q:"Ibukota Australia?",a:"canberra"},
  {q:"Ibukota Inggris?",a:"london"},
  {q:"Ibukota Jerman?",a:"berlin"},
  {q:"Ibukota Brasil?",a:"brasilia"},
  {q:"Ibukota Rusia?",a:"moskow"},
  {q:"Ibukota China?",a:"beijing"},
  {q:"Ibukota India?",a:"new delhi"},
  {q:"Ibukota Malaysia?",a:"kuala lumpur"},
  {q:"Ibukota Thailand?",a:"bangkok"},
  {q:"Ibukota Mesir?",a:"kairo"},
  {q:"Ibukota Korea Selatan?",a:"seoul"},
  {q:"Ibukota Italia?",a:"roma"},
  {q:"Ibukota Spanyol?",a:"madrid"},
  {q:"Ibukota Turki?",a:"ankara"},
  {q:"Ibukota Arab Saudi?",a:"riyadh"},
  {q:"Ibukota Filipina?",a:"manila"},
  {q:"Ibukota Vietnam?",a:"hanoi"},
  {q:"Ibukota Meksiko?",a:"meksiko city"},
  {q:"Ibukota Kanada?",a:"ottawa"},
  {q:"Ibukota Argentina?",a:"buenos aires"},
  {q:"Ibukota Belanda?",a:"amsterdam"},
  {q:"Ibukota Swedia?",a:"stockholm"},
  {q:"Ibukota Norwegia?",a:"oslo"},
  {q:"Ibukota Swiss?",a:"bern"},
  {q:"Ibukota Polandia?",a:"warsawa"},
  {q:"Ibukota Yunani?",a:"athena"},
  {q:"Ibukota Portugal?",a:"lisbon"},
  {q:"Ibukota Ukraina?",a:"kyiv"},
  {q:"Ibukota Jawa Barat?",a:"bandung"},
  {q:"Ibukota Jawa Tengah?",a:"semarang"},
  {q:"Ibukota Jawa Timur?",a:"surabaya"},
  {q:"Ibukota Kalimantan Timur?",a:"samarinda"},
  {q:"Ibukota Sulawesi Selatan?",a:"makassar"},
];

const Q_LIRIK = [
  {q:'🎵 "Tanah airku tidak ku... lupa-kan..."',a:"lupakan"},
  {q:'🎵 "Garuda di dadaku, garuda ke... banggaanku..."',a:"kebanggaanku"},
  {q:'🎵 "Halo-halo Bandung, ibukota... Periangan..."',a:"periangan"},
  {q:'🎵 "Balonku ada lima, rupa-rupa... warnanya..."',a:"warnanya"},
  {q:'🎵 "Burung kakak tua, hinggap di... jendela..."',a:"jendela"},
  {q:'🎵 "Naik-naik ke puncak... gunung, tinggi-tinggi sekali..."',a:"gunung"},
  {q:'🎵 "Pelangi-pelangi, alangkah... indahmu..."',a:"indahmu"},
  {q:'🎵 "Satu-satu aku sayang... ibu..."',a:"ibu"},
  {q:'🎵 "Indonesia tanah airku, tanah tumpah... darahku..."',a:"darahku"},
  {q:'🎵 "Dari sabang sampai... Merauke..."',a:"merauke"},
  {q:'🎵 "Rasa sayange, rasa... sayang-sayange..."',a:"sayang"},
  {q:'🎵 "Gundul-gundul pacul... cul, gembelengan..."',a:"cul"},
  {q:'🎵 "Ampar-ampar pisang, pisangku belum... masak..."',a:"masak"},
  {q:'🎵 "Ibu kita Kartini, putri sejati... Indonesia..."',a:"indonesia"},
  {q:'🎵 "Ayo kita menabung, tuk hari depan yang... cerah..."',a:"cerah"},
];

// ── TRIVIA HELPER ─────────────────────────────────────────────
function makeClue(word) {
  return word.split("").map((c, i) => c === " " ? "  " : (i % 2 === 1 ? "_" : c)).join(" ").trim();
}

function startTrivia(chatId, jid, dbArray, title) {
  if (db.getActiveSession(chatId)) return cfg.msg.quizLocked;
  const quiz = dbArray[rand(0, dbArray.length - 1)];
  db.setActiveSession(chatId, { quiz, expiresAt: Date.now() + cfg.quizTimeoutMs, askedBy: jid });
  setTimeout(() => { if (db.getActiveSession(chatId)) db.clearActiveSession(chatId); }, cfg.quizTimeoutMs);
  return (
    `${title}\nSoal: *${quiz.q}*\nPetunjuk: _${makeClue(quiz.a)}_\nJawab dalam 30 detik! Hadiah 200–500 koin 💰`
  );
}

function cmdKuis(chatId, jid)         { return startTrivia(chatId, jid, Q_UMUM,    "🧠 *Kuis Umum*");      }
function cmdTebakHewan(chatId, jid)   { return startTrivia(chatId, jid, Q_HEWAN,   "🐾 *Tebak Hewan*");    }
function cmdTebakBendera(chatId, jid) { return startTrivia(chatId, jid, Q_BENDERA, "🚩 *Tebak Bendera*");  }
function cmdSusunKata(chatId, jid)    { return startTrivia(chatId, jid, Q_KATA,    "🔤 *Susun Kata*");     }
function cmdTebakIbukota(chatId, jid) { return startTrivia(chatId, jid, Q_IBUKOTA, "🏛️ *Tebak Ibukota*"); }
function cmdTebakLirik(chatId, jid)   { return startTrivia(chatId, jid, Q_LIRIK,   "🎵 *Tebak Lirik*");   }

function cmdMatematika(chatId, jid) {
  if (db.getActiveSession(chatId)) return cfg.msg.quizLocked;
  const ops = ["+","-","*"];
  const op  = ops[rand(0,1)];
  const a   = rand(10,50), b = rand(5,30);
  // eslint-disable-next-line no-new-func
  const ans = new Function(`return ${a} ${op} ${b}`)();
  db.setActiveSession(chatId, { quiz: { a: ans.toString() }, expiresAt: Date.now() + cfg.quizTimeoutMs, askedBy: jid });
  setTimeout(() => { if (db.getActiveSession(chatId)) db.clearActiveSession(chatId); }, cfg.quizTimeoutMs);
  return `🔢 *Kuis Matematika*\nSoal: *${a} ${op} ${b} = ?*\nJawab dalam 30 detik! Hadiah 200–500 koin 💰`;
}

function cmdJawabKuis(chatId, jid, text) {
  const session = db.getActiveSession(chatId);
  if (!session || Date.now() >= session.expiresAt) return null;
  if (text.toLowerCase().trim() !== session.quiz.a.toLowerCase().trim()) return null;
  db.clearActiveSession(chatId);
  const earned = db.addBalance(jid, rand(cfg.quizReward.min, cfg.quizReward.max));
  return (
    `✅ *Benar!*\n${tag(jid)} menjawab paling cepat!\n` +
    `💰 +${earned} koin → Saldo: ${db.getPlayer(jid).balance} koin`
  );
}

// ══════════════════════════════════════════════════════════════
//  4. RPG — 5 GAMES
// ══════════════════════════════════════════════════════════════

// FIX: Dulu inventory.push tidak disimpan ke file!
function doLooting(jid, itemsArray, typeName, cooldownMs) {
  const wait = checkSpecificCooldown(jid, typeName, cooldownMs);
  if (wait > 0) return `⏳ Kelelahan! Istirahat *${Math.ceil(wait/60)} menit* lagi.`;
  if (Math.random() < 0.20) return `🍂 ${tag(jid)} tidak menemukan apa-apa. Coba lagi!`;
  const roll = Math.random(); let cum = 0, prize = itemsArray[0];
  for (const item of itemsArray) { cum += item.chance; if (roll <= cum) { prize = item; break; } }
  const p = db.getPlayer(jid);
  p.inventory.push({ name: prize.name, emoji: prize.emoji, price: prize.price });
  db.savePlayers(); // ✓ Fix: save inventory
  return (
    `🎒 ${tag(jid)} dapat *${prize.emoji} ${prize.name}*!\n` +
    `Harga jual: ${prize.price} koin. Ketik *!jual* untuk jual semua.`
  );
}

function cmdHunt(jid)    { return doLooting(jid, cfg.huntItems,    "hunt",    900000); }
function cmdMancing(jid) { return doLooting(jid, cfg.mancingItems, "mancing", 600000); }

function cmdGacha(jid) {
  const wait = checkSpecificCooldown(jid, "gacha", 5000);
  if (wait > 0) return cfg.msg.onCooldown(wait);
  const p = db.getPlayer(jid);
  if (p.balance < cfg.gachaPrice) return `❌ Butuh *${cfg.gachaPrice} koin* untuk gacha.`;
  db.deductBalance(jid, cfg.gachaPrice);
  const roll = Math.random(); let cum = 0, prize = cfg.gachaItems[0];
  for (const item of cfg.gachaItems) { cum += item.chance; if (roll <= cum) { prize = item; break; } }
  p.inventory.push({ name: prize.name, emoji: prize.emoji, price: prize.price });
  db.savePlayers(); // ✓ Fix: save inventory
  const stars = prize.chance <= 0.05 ? "⭐⭐⭐⭐⭐" : prize.chance <= 0.15 ? "⭐⭐⭐⭐" : prize.chance <= 0.30 ? "⭐⭐⭐" : "⭐";
  return `🎰 *Gacha!* ${stars}\n${tag(jid)} dapat: *${prize.emoji} ${prize.name}*\nHarga jual: ${prize.price} koin`;
}

function cmdJual(jid) {
  const p = db.getPlayer(jid);
  if (!p.inventory || p.inventory.length === 0)
    return "📦 Inventory kosong. Coba !hunt, !mancing, atau !gacha dulu.";
  let earned = 0;
  const lines = p.inventory.map(item => {
    const price = typeof item === "object" ? item.price : 0;
    earned += price;
    return `${typeof item === "object" ? item.emoji+" "+item.name : item} +${price}`;
  }).join("\n");
  p.inventory = [];
  db.addBalance(jid, earned); // saves + handles debt
  return `💰 *Semua Terjual!*\n${lines}\nTotal: *+${earned} koin*\nSaldo: ${db.getPlayer(jid).balance} koin`;
}

const EKSPEDISI_EVENTS = [
  { text:"⚔️ Ketemu peti harta di hutan!",     type:"win",  amount: ()=>rand(300,800)  },
  { text:"🌊 Banjir dadakan! Kehilangan koin.", type:"lose", amount: ()=>rand(100,400)  },
  { text:"🧙 Penyihir baik kasih koin ajaib!",  type:"win",  amount: ()=>rand(200,600)  },
  { text:"🐍 Dikejar ular! Kabur tapi rugi.",   type:"lose", amount: ()=>rand(50,200)   },
  { text:"💎 Nemu batu permata tersembunyi!",   type:"win",  amount: ()=>rand(500,1500) },
  { text:"🏚️ Terjebak di gua. Nihil.",          type:"none", amount: ()=>0             },
  { text:"🎁 Petani desa kasih hadiah!",        type:"win",  amount: ()=>rand(150,400)  },
  { text:"🔥 Kebakaran hutan! Rugi lumayan.",   type:"lose", amount: ()=>rand(200,500)  },
  { text:"🌟 Hari hoki! Bonus gede!",           type:"win",  amount: ()=>rand(800,2000) },
  { text:"😴 Kamu ketiduran. Gak dapet apa-apa.",type:"none",amount: ()=>0             },
];

function cmdEkspedisi(jid) {
  const wait = checkSpecificCooldown(jid, "ekspedisi", 1800000);
  if (wait > 0) return `⏳ Masih kelelahan! Istirahat *${Math.ceil(wait/60)} menit* lagi.`;
  const p      = db.getPlayer(jid);
  const event  = EKSPEDISI_EVENTS[rand(0, EKSPEDISI_EVENTS.length-1)];
  const amount = event.amount();
  let result = `🗺️ *Ekspedisi — ${tag(jid)}*\n${event.text}\n`;
  if (event.type === "win") {
    db.addBalance(jid, amount);
    result += `💰 Dapat *+${amount} koin* → Saldo: ${db.getPlayer(jid).balance} koin`;
  } else if (event.type === "lose") {
    const loss = Math.min(amount, p.balance);
    db.deductBalance(jid, loss);
    result += `💸 Kehilangan *-${loss} koin* → Saldo: ${db.getPlayer(jid).balance} koin`;
  } else {
    result += `💳 Saldo tidak berubah: ${p.balance} koin`;
  }
  return result;
}

// ══════════════════════════════════════════════════════════════
//  5. GAME BARU — G1 s/d G23
// ══════════════════════════════════════════════════════════════

// G1. TEBAK KARTU — tebak apakah kartu lebih tinggi atau rendah dari 7
function cmdTebakKartu(jid, bet, choice, chatId) {
  if (!["tinggi","rendah"].includes(choice))
    return "❌ Pilih *tinggi* (>7) atau *rendah* (<7). Contoh: !tebakkartu 500 tinggi";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const suits = ["♠️","♥️","♦️","♣️"];
  const vals  = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const v     = rand(0, 12);
  const card  = `${suits[rand(0,3)]}${vals[v]}`;
  let result;
  if      (v === 6)  result = "draw";
  else if (v > 6)    result = "tinggi";
  else               result = "rendah";
  const text = `🃏 Kartu keluar: *${card}*`;
  if (result === "draw") { db.addBalance(jid, bet); return `${text}\n⚖️ Tepat 7! Taruhan kembali.`; }
  if (result === choice) return processWin(jid, bet, cfg.multipliers.tebakkartu, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G2. TEBAK WARNA — tebak warna kartu (merah/hitam)
function cmdTebakWarna(jid, bet, choice, chatId) {
  if (!["merah","hitam"].includes(choice))
    return "❌ Pilih *merah* atau *hitam*. Contoh: !tebakwarna 500 merah";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const result = rand(0,1) === 0 ? "merah" : "hitam";
  const emo    = result === "merah" ? "🔴" : "⚫";
  const text   = `${emo} Warna kartu: *${result.toUpperCase()}*`;
  if (result === choice) return processWin(jid, bet, cfg.multipliers.tebakwarna, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G3. DADU 3 — lempar 3 dadu, menang jika total ≥ 11
function cmdDadu3(jid, bet, choice, chatId) {
  if (!["besar","kecil"].includes(choice))
    return "❌ Pilih *besar* (≥11) atau *kecil* (≤10). Contoh: !dadu3 500 besar";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const D    = ["","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣"];
  const d    = [rand(1,6), rand(1,6), rand(1,6)];
  const tot  = d.reduce((a,b) => a+b, 0);
  const res  = tot >= 11 ? "besar" : "kecil";
  const text = `🎲 Dadu: ${d.map(x=>D[x]).join(" ")} = *${tot}* (${res.toUpperCase()})`;
  if (choice === res) return processWin(jid, bet, cfg.multipliers.dadu3, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G4. GANJIL GENAP
function cmdGanjilGenap(jid, bet, choice, chatId) {
  if (!["ganjil","genap"].includes(choice))
    return "❌ Pilih *ganjil* atau *genap*. Contoh: !ganjilgenap 500 ganjil";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const n    = rand(1, 100);
  const res  = n % 2 === 0 ? "genap" : "ganjil";
  const text = `🔢 Angka keluar: *${n}* → ${res.toUpperCase()}`;
  if (choice === res) return processWin(jid, bet, cfg.multipliers.tebakganjilgenap, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G5. KARTU PETAK — pilih 1 dari 4 kartu, 2 kartu menang
function cmdKartuPetak(jid, bet, pil, chatId) {
  const p2 = parseInt(pil);
  if (isNaN(p2) || p2 < 1 || p2 > 4)
    return "❌ Pilih kartu 1–4. Contoh: !kartupertak 500 2";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const winners = new Set();
  while (winners.size < 2) winners.add(rand(1,4));
  const grid = [1,2,3,4].map(i => winners.has(i) ? (i===p2?"✅":"💰") : (i===p2?"❌":"💀")).join(" ");
  const text = `🃏 Petak: ${grid}`;
  if (winners.has(p2)) return processWin(jid, bet, cfg.multipliers.kartupetak, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G6. MEMBALIK — bot pilih angka, kamu tebak apakah hasil balik > asli
function cmdMembalik(jid, bet, choice, chatId) {
  if (!["lebih","kurang"].includes(choice))
    return "❌ Pilih *lebih* (balik > asli) atau *kurang*. Contoh: !membalik 500 lebih";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const n    = rand(10, 99);
  const rev  = parseInt(n.toString().split("").reverse().join(""));
  const res  = rev > n ? "lebih" : "kurang";
  const text = `🔄 Angka: *${n}* → Balik: *${rev}*`;
  if (rev === n)              { db.addBalance(jid, bet); return `${text}\n⚖️ Sama! Taruhan kembali.`; }
  if (choice === res)         return processWin(jid, bet, cfg.multipliers.membalik, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G7. TEBAK ANGKA PRIMA — apakah angka random adalah bilangan prima?
function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
  return true;
}
function cmdTebakPrima(jid, bet, choice, chatId) {
  if (!["prima","bukan"].includes(choice))
    return "❌ Pilih *prima* atau *bukan*. Contoh: !tebakprima 500 prima";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const n    = rand(2, 50);
  const res  = isPrime(n) ? "prima" : "bukan";
  const text = `🔢 Angka: *${n}* → ${isPrime(n) ? "Bilangan Prima ✨" : "Bukan Prima"}`;
  if (choice === res) return processWin(jid, bet, cfg.multipliers.tebakprima, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G8. LEMPAR KARTU — adu nilai kartu vs dealer, nilai lebih tinggi menang
function cmdLemparKartu(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const vals = [2,3,4,5,6,7,8,9,10,10,10,10,11];
  const p3   = vals[rand(0, vals.length-1)];
  const d2   = vals[rand(0, vals.length-1)];
  const text = `🃏 Kartumu: *${p3}*  vs  Dealer: *${d2}*`;
  if (p3 > d2) return processWin(jid, bet, cfg.multipliers.lemparkartu, chatId, text);
  if (p3 === d2) { db.addBalance(jid, bet); return `${text}\n⚖️ Seri! Taruhan balik.`; }
  return processLose(jid, bet, chatId, text);
}

// G9. TEBAK MUKA DADU — tebak angka tepat satu dadu (1–6), bayar 6x
function cmdTebakDadu(jid, bet, guess, chatId) {
  if (guess < 1 || guess > 6)
    return "❌ Tebak angka 1–6. Contoh: !tebakdadu 500 4";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const D    = ["","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣"];
  const n    = rand(1, 6);
  const text = `🎲 Dadu: ${D[n]}`;
  if (guess === n) return processWin(jid, bet, cfg.multipliers.tebakdadu, chatId, `${text} — TEPAT!`);
  return processLose(jid, bet, chatId, text);
}

// G10. PETARUNG — pilih petarung 1/2/3, salah satu menang acak
function cmdPetarung(jid, bet, pilih, chatId) {
  const p4 = parseInt(pilih);
  if (isNaN(p4) || p4 < 1 || p4 > 3)
    return "❌ Pilih petarung 1–3. Contoh: !petarung 500 2";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const names  = ["🗡️ Samurai","🪃 Hunter","🔮 Wizard"];
  const winner = rand(0,2);
  const arena  = names.map((n,i) => (i===winner ? `*${n}* 🏆` : n)).join("  vs  ");
  const text   = `⚔️ ${arena}`;
  if (p4-1 === winner) return processWin(jid, bet, cfg.multipliers.petarung, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G11. LOMBA RENANG — pilih perenang 1–5
function cmdLombaRenang(jid, bet, pilih, chatId) {
  const p5 = parseInt(pilih);
  if (isNaN(p5) || p5 < 1 || p5 > 5)
    return "❌ Pilih perenang 1–5. Contoh: !lombrenang 500 3";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const emojis = ["🏊","🏊‍♂️","🏊‍♀️","🐬","🦈"];
  const winner = rand(0,4);
  const track  = emojis.map((e,i) => i===winner ? `${e}🥇` : e).join(" ");
  const text   = `🏁 ${track}\nPemenang: *Perenang ${winner+1}*`;
  if (p5-1 === winner) return processWin(jid, bet, cfg.multipliers.lombarenang, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G12. UNDIAN — pilih amplop 1–6, satu berisi jackpot
function cmdUndian(jid, bet, pilih, chatId) {
  const p6 = parseInt(pilih);
  if (isNaN(p6) || p6 < 1 || p6 > 6)
    return "❌ Pilih amplop 1–6. Contoh: !undian 500 4";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const jackpotSlot = rand(1,6);
  const display = [1,2,3,4,5,6].map(i => i===jackpotSlot ? "💰" : (i===p6 ? "📭" : "📬")).join(" ");
  const text = `📬 Amplop: ${display}`;
  if (p6 === jackpotSlot) return processWin(jid, bet, cfg.multipliers.undian, chatId, `${text}\n💰 *JACKPOT!*`);
  return processLose(jid, bet, chatId, text);
}

// G13. TEMBAK BINTANG — pilih bintang 1–5, 2 dari 5 berhadiah
function cmdTembakBintang(jid, bet, pilih, chatId) {
  const p7 = parseInt(pilih);
  if (isNaN(p7) || p7 < 1 || p7 > 5)
    return "❌ Pilih bintang 1–5. Contoh: !tembakbintang 500 3";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const winners2 = new Set();
  while (winners2.size < 2) winners2.add(rand(1,5));
  const display = [1,2,3,4,5].map(i => winners2.has(i) ? (i===p7?"⭐":"🌟") : (i===p7?"💨":"☆")).join(" ");
  const text    = `🌠 ${display}`;
  if (winners2.has(p7)) return processWin(jid, bet, cfg.multipliers.tembakbintang, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G14. PINDAH KOIN — pilih tangan yang berisi koin setelah dikocok 3x
function cmdPindahKoin(jid, bet, choice, chatId) {
  if (!["kiri","tengah","kanan"].includes(choice))
    return "❌ Pilih *kiri*, *tengah*, atau *kanan*. Contoh: !pindahkoin 500 tengah";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const spots = ["kiri","tengah","kanan"];
  const ans   = spots[rand(0,2)];
  const display = spots.map(s => s===ans ? (s===choice?"🪙✅":"🪙") : (s===choice?"🫳❌":"🫳")).join("  ");
  const text  = `👐 ${display}\nKoin ada di: *${ans.toUpperCase()}*`;
  if (choice === ans) return processWin(jid, bet, cfg.multipliers.pindahkoin, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G15. NAIK TANGGA — lempar dadu, mulai dari 1, menang jika ≥ 10 dalam 3 giliran
function cmdNaikTangga(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const D    = ["","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣"];
  const rolls = [rand(1,6), rand(1,6), rand(1,6)];
  const total = rolls.reduce((a,b)=>a+b,0);
  const track = rolls.map(r=>D[r]).join(" + ");
  const text  = `🪜 Dadu: ${track} = *${total}*\n${total>=10?"🏆 Sampai puncak!":"😵 Terjatuh di tangga..."}`;
  if (total >= 10) return processWin(jid, bet, cfg.multipliers.naiktangga, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G16. CUACA HARI INI — tebak cuaca random (cerah/hujan/mendung)
function cmdCuacaHari(jid, bet, choice, chatId) {
  if (!["cerah","hujan","mendung"].includes(choice))
    return "❌ Pilih *cerah*, *hujan*, atau *mendung*. Contoh: !cuacahari 500 cerah";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const options = ["cerah","hujan","mendung"];
  const emos    = { cerah:"☀️", hujan:"🌧️", mendung:"☁️" };
  const result  = options[rand(0,2)];
  const text    = `${emos[result]} Cuaca hari ini: *${result.toUpperCase()}*`;
  if (choice === result) return processWin(jid, bet, cfg.multipliers.cuacahari, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G17. BOMB PARTY — pilih 1 dari 5 bom, 1 meledak sisanya aman
function cmdBombParty(jid, bet, pilih, chatId) {
  const p8 = parseInt(pilih);
  if (isNaN(p8) || p8 < 1 || p8 > 5)
    return "❌ Pilih bom 1–5. Contoh: !bombparty 500 2";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const boom  = rand(1,5);
  const grid2 = [1,2,3,4,5].map(i => i===boom ? (i===p8?"💥":"💣") : (i===p8?"✅":"🟩")).join(" ");
  const text  = `💣 ${grid2}`;
  if (p8 !== boom) return processWin(jid, bet, cfg.multipliers.bombparty, chatId, `${text}\n✅ Selamat! Bom ada di ${boom}.`);
  return processLose(jid, bet, chatId, `${text}\n💥 BOOM! Kamu kena bom ${boom}!`);
}

// G18. TEBAK WAKTU — tebak AM atau PM dari jam acak yang ditampilkan
function cmdTebakWaktu(jid, bet, choice, chatId) {
  if (!["am","pm"].includes(choice))
    return "❌ Pilih *am* atau *pm*. Contoh: !tebakwaktu 500 pm";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const h    = rand(1,12);
  const m    = rand(0,59).toString().padStart(2,"0");
  const res  = rand(0,1) === 0 ? "am" : "pm";
  const text = `🕐 Jam *${h}:${m} ${res.toUpperCase()}*`;
  if (choice === res) return processWin(jid, bet, cfg.multipliers.tebakwaktu, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G19. BACCARAT — player vs banker, tebak siapa yang menang
function cmdBaccarat(jid, bet, choice, chatId) {
  if (!["player","banker","tie"].includes(choice))
    return "❌ Pilih *player*, *banker*, atau *tie*. Contoh: !baccarat 500 player";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const bacVals = [0,1,2,3,4,5,6,7,8,9,0,0,0];
  const calcHand = () => {
    const h = [bacVals[rand(0,12)], bacVals[rand(0,12)]];
    return h.reduce((a,b)=>a+b,0) % 10;
  };
  const pScore = calcHand();
  const bScore = calcHand();
  let res;
  if      (pScore > bScore) res = "player";
  else if (bScore > pScore) res = "banker";
  else                      res = "tie";
  const text = `🎴 *Baccarat*\nPlayer: *${pScore}*  vs  Banker: *${bScore}*\nHasil: *${res.toUpperCase()}*`;
  if (choice === "tie" && res === "tie") return processWin(jid, bet, cfg.multipliers.baccaratTie, chatId, text);
  if (choice === res && res !== "tie")   return processWin(jid, bet, cfg.multipliers.baccarat,    chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G20. DRAGON TIGER — dragon vs tiger, kartu lebih tinggi menang
function cmdDragonTiger(jid, bet, choice, chatId) {
  if (!["dragon","tiger","tie"].includes(choice))
    return "❌ Pilih *dragon*, *tiger*, atau *tie*. Contoh: !dragontiger 500 dragon";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const dtVals = [1,2,3,4,5,6,7,8,9,10,11,12,13];
  const d3 = dtVals[rand(0,12)];
  const t  = dtVals[rand(0,12)];
  let res2;
  if      (d3 > t) res2 = "dragon";
  else if (t > d3) res2 = "tiger";
  else             res2 = "tie";
  const text = `🐉 Dragon: *${d3}*  vs  Tiger: *${t}* 🐯\nHasil: *${res2.toUpperCase()}*`;
  if (choice === "tie" && res2 === "tie") return processWin(jid, bet, cfg.multipliers.dragontigerTie, chatId, text);
  if (choice === res2 && res2 !== "tie")  return processWin(jid, bet, cfg.multipliers.dragontiger,    chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G21. TEBAK EMOJI — tebak dari 4 emoji mana yang berbeda
function cmdTebakEmoji(jid, bet, choice, chatId) {
  const p9 = parseInt(choice);
  if (isNaN(p9) || p9 < 1 || p9 > 4)
    return "❌ Pilih posisi 1–4. Contoh: !tebakemoji 500 3";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const pool   = ["🍎","🍊","🍋","🍇","🍓","🍑","🍍","🥝"];
  const main   = pool[rand(0,7)];
  let odd      = pool[rand(0,7)];
  while (odd === main) odd = pool[rand(0,7)];
  const oddPos = rand(0,3);
  const row    = [0,1,2,3].map(i => i===oddPos ? odd : main);
  const display = row.map((e,i) => `${i+1}.${e}`).join("  ");
  const text   = `🎯 ${display}\nYang beda: posisi *${oddPos+1}*`;
  if (p9-1 === oddPos) return processWin(jid, bet, cfg.multipliers.tebakemoji || 2.5, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G22. KOIN SEGITIGA — pilih 1 dari 3, hanya 1 yang berisi koin
function cmdKoinSegitiga(jid, bet, choice, chatId) {
  const pa = parseInt(choice);
  if (isNaN(pa) || pa < 1 || pa > 3)
    return "❌ Pilih 1, 2, atau 3. Contoh: !koin3 500 2";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const ans2 = rand(1,3);
  const row2 = [1,2,3].map(i => i===ans2 ? (i===pa?"🪙✅":"🪙") : (i===pa?"🫙❌":"🫙")).join("  ");
  const text = `🫙 ${row2}\nKoin ada di: *${ans2}*`;
  if (pa === ans2) return processWin(jid, bet, 3.0, chatId, text);
  return processLose(jid, bet, chatId, text);
}

// G23. MINESWEEPER MINI — grid 3x3, pilih kotak, 2 bom tersembunyi
function cmdMineSweeper(jid, bet, cell2, chatId) {
  if (cell2 < 1 || cell2 > 9)
    return "❌ Pilih kotak 1–9. Contoh: !mine 500 7";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const bombs2 = new Set();
  while (bombs2.size < 2) bombs2.add(rand(1,9));
  const multi  = bombs2.size === 2 ? 3.0 : 2.5;
  const grid3  = Array.from({length:9}, (_,i) => {
    const n = i+1;
    if (bombs2.has(n)) return n===cell2 ? "💥" : "💣";
    return n===cell2 ? "🟢" : "⬜";
  });
  const display2 = [
    grid3.slice(0,3).join(" "),
    grid3.slice(3,6).join(" "),
    grid3.slice(6,9).join(" ")
  ].join("\n");
  if (!bombs2.has(cell2)) return processWin(jid, bet, multi, chatId, `💎 Mine Mini\n${display2}\n✅ Aman, bro!`);
  return processLose(jid, bet, chatId, `💎 Mine Mini\n${display2}\n💥 Kena ranjau!`);
}

// ══════════════════════════════════════════════════════════════
//  6. WORDLE — tebak kata 5 huruf (per grup, multiplayer)
// ══════════════════════════════════════════════════════════════
const KATA_WORDLE = [
  "MAKAN","MINUM","TIDUR","JALAN","KERJA","BESAR","KECIL","MERAH","HITAM","PUTIH",
  "HIJAU","BIRU","KUNING","LAUT","BUKIT","SUNGAI","ANGIN","HUJAN","PANAS","DINGIN",
  "MALAM","SIANG","FAJAR","SENJA","BULAN","BINTANG","MATAHARI","GUNUNG","PANTAI","HUTAN",
  "RUMAH","PINTU","JENDELA","LANGIT","AWAN","BEBAS","DAMAI","KUAT","BERANI","PINTAR",
  "SABAR","SOPAN","SETIA","JUJUR","RAJIN","CERIA","BAHAGIA","CANTIK","TAMPAN","GAGAH",
];

const wordleGames = {}; // { chatId: { kata, tries, guesses, active, starter } }
const WORDLE_MAX_TRIES = 6;

function cmdWordleStart(chatId, jid) {
  if (wordleGames[chatId]?.active)
    return `🟩 Wordle sedang berjalan! Tebak dulu. Format: *!tebakwordle [kata]*\nSisa nyawa: ${WORDLE_MAX_TRIES - wordleGames[chatId].tries}`;

  const kata = KATA_WORDLE[rand(0, KATA_WORDLE.length - 1)];
  wordleGames[chatId] = { kata, tries: 0, guesses: [], active: true, starter: jid };

  setTimeout(() => {
    if (wordleGames[chatId]?.active) wordleGames[chatId].active = false;
  }, 10 * 60 * 1000);

  return (
    `🟩🟨⬜ *WORDLE DIMULAI!*\n` +
    `Tebak kata *5 huruf* dalam ${WORDLE_MAX_TRIES} kesempatan!\n` +
    `Format: *!tebakwordle [kata]*\n\n` +
    `🟩 = huruf & posisi benar\n🟨 = huruf benar, posisi salah\n⬜ = huruf tidak ada\n\n` +
    `⏰ Timeout: 10 menit`
  );
}

function cmdTebakWordle(chatId, jid, tebakanRaw) {
  const game = wordleGames[chatId];
  if (!game || !game.active) return `❌ Belum ada Wordle aktif. Mulai dengan *!wordle*`;

  const tebakan = tebakanRaw.toUpperCase().trim();
  if (tebakan.length !== 5) return `❌ Kata harus *5 huruf*. Kamu mengirim ${tebakan.length} huruf.`;
  if (!/^[A-Z]+$/.test(tebakan)) return `❌ Hanya huruf alfabet.`;

  const result  = evaluateWordle(tebakan, game.kata);
  const row     = result.map(r => r.emoji).join("");

  game.tries++;
  game.guesses.push({ tebakan, row, jid });

  const history = game.guesses.map(g => `${g.row} ${g.tebakan} (@${g.jid.split("@")[0]})`).join("\n");

  if (tebakan === game.kata) {
    game.active = false;
    const reward = Math.max(100, 500 - (game.tries - 1) * 80);
    db.addBalance(jid, reward);
    db.savePlayers();
    return `${history}\n\n🎉 *BENAR! ${tag(jid)} menebak dalam ${game.tries} percobaan!*\n+${reward} koin hadiah!`;
  }

  if (game.tries >= WORDLE_MAX_TRIES) {
    game.active = false;
    return `${history}\n\n💀 *GAME OVER!* Kata yang benar: *${game.kata}*`;
  }

  return `${history}\n\n🟩 Sisa percobaan: *${WORDLE_MAX_TRIES - game.tries}*`;
}

function evaluateWordle(guess, answer) {
  const result    = Array(5).fill(null);
  const answerArr = answer.split("");
  const guessArr  = guess.split("");
  const usedIdx   = Array(5).fill(false);

  // Pass 1: benar posisi
  guessArr.forEach((ch, i) => {
    if (ch === answerArr[i]) {
      result[i] = { letter: ch, emoji: "🟩" };
      usedIdx[i] = true;
    }
  });

  // Pass 2: ada di kata, posisi salah
  guessArr.forEach((ch, i) => {
    if (result[i]) return;
    const foundIdx = answerArr.findIndex((ac, ai) => ac === ch && !usedIdx[ai]);
    if (foundIdx !== -1) {
      result[i] = { letter: ch, emoji: "🟨" };
      usedIdx[foundIdx] = true;
    } else {
      result[i] = { letter: ch, emoji: "⬜" };
    }
  });

  return result;
}

// ══════════════════════════════════════════════════════════════
//  7. HANGMAN — tebak kata dengan nyawa terbatas
// ══════════════════════════════════════════════════════════════
const KATA_HANGMAN = [
  { kata: "MERDEKA",      petunjuk: "Kebebasan suatu bangsa" },
  { kata: "PANCASILA",    petunjuk: "Dasar negara Indonesia" },
  { kata: "KERETA",       petunjuk: "Transportasi di atas rel" },
  { kata: "GARUDA",       petunjuk: "Lambang negara Indonesia" },
  { kata: "WAYANG",       petunjuk: "Seni pertunjukan Jawa" },
  { kata: "BATIK",        petunjuk: "Kain bermotif khas Indonesia" },
  { kata: "RENDANG",      petunjuk: "Makanan khas Minang" },
  { kata: "SATE",         petunjuk: "Makanan tusuk dibakar" },
  { kata: "ANGKOT",       petunjuk: "Transportasi umum kota" },
  { kata: "OJOL",         petunjuk: "Ojek digital" },
  { kata: "GADO",         petunjuk: "Makanan sayur dengan bumbu kacang, namanya: GADO-..." },
  { kata: "JENGKOL",      petunjuk: "Biji berbau tajam yang digoreng/direbus" },
  { kata: "RUPIAH",       petunjuk: "Mata uang Indonesia" },
  { kata: "SAWAH",        petunjuk: "Tempat menanam padi" },
  { kata: "NELAYAN",      petunjuk: "Profesi pencari ikan di laut" },
];

const hangmanGames = {}; // { chatId: { kata, display, nyawa, salah, active } }
const HANGMAN_NYAWA = 7;

const HANGMAN_PICS = [
  "  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========",
  "  +---+\n  |   |\n [X]  |\n /|\\  |\n / \\  |\n      |\n=========",
];

function cmdHangmanStart(chatId, jid) {
  if (hangmanGames[chatId]?.active)
    return `😰 Hangman sedang berjalan! Tebak huruf: *!tebakhuruf [huruf]*\nNyawa: ${"❤️".repeat(hangmanGames[chatId].nyawa)}`;

  const item    = KATA_HANGMAN[rand(0, KATA_HANGMAN.length - 1)];
  const display = item.kata.split("").map(c => c === " " ? " " : "_").join(" ");

  hangmanGames[chatId] = {
    kata: item.kata, petunjuk: item.petunjuk,
    display: item.kata.split("").map(c => c === " " ? " " : "_"),
    nyawa: HANGMAN_NYAWA, salah: [], active: true, starter: jid,
    guessedLetters: new Set()
  };

  setTimeout(() => {
    if (hangmanGames[chatId]?.active) hangmanGames[chatId].active = false;
  }, 10 * 60 * 1000);

  return (
    `😨 *HANGMAN DIMULAI!*\n` +
    `💡 Petunjuk: ${item.petunjuk}\n\n` +
    `\`\`\`${HANGMAN_PICS[0]}\`\`\`\n\n` +
    `Kata: *${display}*\n` +
    `❤️ Nyawa: ${HANGMAN_NYAWA}\n\n` +
    `Format: *!tebakhuruf [huruf]*`
  );
}

function cmdTebakHuruf(chatId, jid, hurufRaw) {
  const game = hangmanGames[chatId];
  if (!game || !game.active) return `❌ Belum ada Hangman aktif. Mulai: *!hangman*`;

  const huruf = hurufRaw.toUpperCase().trim();
  if (huruf.length !== 1 || !/^[A-Z]$/.test(huruf)) return `❌ Masukkan satu huruf alfabet.`;
  if (game.guessedLetters.has(huruf)) return `❌ Huruf *${huruf}* sudah pernah ditebak.`;

  game.guessedLetters.add(huruf);
  const adaDiKata = game.kata.includes(huruf);

  if (adaDiKata) {
    game.kata.split("").forEach((c, i) => {
      if (c === huruf) game.display[i] = huruf;
    });
  } else {
    game.nyawa--;
    game.salah.push(huruf);
  }

  const displayStr = game.display.join(" ");
  const salahStr   = game.salah.length > 0 ? `❌ Salah: ${game.salah.join(", ")}` : "";
  const picIdx     = Math.min(HANGMAN_NYAWA - game.nyawa, 7);

  if (!game.display.includes("_")) {
    game.active = false;
    const reward = game.nyawa * 100;
    db.addBalance(jid, reward);
    db.savePlayers();
    return (
      `\`\`\`${HANGMAN_PICS[picIdx]}\`\`\`\n\n` +
      `✅ *${tag(jid)} menebak huruf terakhir!*\nKata: *${game.kata}*\n` +
      `❤️ Sisa nyawa: ${game.nyawa} | +${reward} koin!`
    );
  }

  if (game.nyawa <= 0) {
    game.active = false;
    return (
      `\`\`\`${HANGMAN_PICS[7]}\`\`\`\n\n` +
      `💀 *GAME OVER!* Kata yang benar: *${game.kata}*`
    );
  }

  const status = adaDiKata ? `✅ Huruf *${huruf}* ada!` : `❌ Huruf *${huruf}* tidak ada!`;
  return (
    `\`\`\`${HANGMAN_PICS[picIdx]}\`\`\`\n\n` +
    `${status}\nKata: *${displayStr}*\n` +
    `❤️ Nyawa: ${"❤️".repeat(game.nyawa)}${"🖤".repeat(HANGMAN_NYAWA - game.nyawa)}\n` +
    `${salahStr}`
  );
}

// ══════════════════════════════════════════════════════════════
//  8. KASINO PREMIUM — P1 s/d P7
// ══════════════════════════════════════════════════════════════

// P1. CRASH — taruhan kapan pesawat crash (multiplier naik terus, bisa crash kapan saja)
function cmdCrash(jid, bet, target, chatId) {
  if (isNaN(target) || target < 1.1 || target > 20.0)
    return "❌ Target multiplier 1.1–20.0. Contoh: *!crash 500 2.5*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);

  const crashPoint   = parseFloat((1 / (1 - Math.random()) * 0.97).toFixed(2));
  const displayCrash = Math.min(crashPoint, 99.99);

  if (target <= displayCrash) {
    const net = Math.floor(bet * target * (1 - cfg.taxPercent / 100));
    db.addBalance(jid, net);
    db.addCashPool(chatId, Math.floor(bet * target * cfg.taxPercent / 100));
    const p = db.getPlayer(jid);
    p.stats.wins++;
    db.savePlayers();
    return `🚀 *CRASH!*\n✈️ Pesawat crash di: *${displayCrash.toFixed(2)}x*\nTarget kamu: *${target.toFixed(2)}x* — SELAMAT!\n+${net.toLocaleString()} koin | Saldo: ${num(p.balance)}`;
  }

  const p = db.getPlayer(jid);
  p.stats.losses++;
  db.savePlayers();
  return `🚀 *CRASH!*\n✈️ Pesawat crash di: *${displayCrash.toFixed(2)}x*\nTarget kamu: *${target.toFixed(2)}x* — KAMU TERLAMBAT!\n-${num(bet)} koin | Saldo: ${num(p.balance)}`;
}

// P2. WAR KARTU — kamu vs dealer, kartu tertinggi menang
function cmdWarKartu(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);

  const KARTU  = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const SUITS  = ["♠","♥","♦","♣"];
  const drawC  = () => `${KARTU[rand(0, KARTU.length-1)]}${SUITS[rand(0, SUITS.length-1)]}`;
  const rankC  = (c) => KARTU.findIndex(k => c.startsWith(k));

  const playerCard = drawC();
  const dealerCard = drawC();
  const pr = rankC(playerCard), dr = rankC(dealerCard);

  const text = `⚔️ *WAR KARTU*\nKamu: *${playerCard}* vs Dealer: *${dealerCard}*`;

  if (pr > dr) return processWin(jid, bet, 2.0, chatId, `${text}\n🏆 KAMU MENANG!`);
  if (pr < dr) return processLose(jid, bet, chatId, `${text}\n💀 Dealer menang.`);
  db.addBalance(jid, bet);
  return `${text}\n🤝 *SERI! Bet dikembalikan.*`;
}

// P3. SICBO — 3 dadu, tebak kombinasi (besar/kecil/triple/double)
function cmdSicbo(jid, bet, pilihan, chatId) {
  const valid = ["besar","kecil","triple","double"];
  if (!valid.includes(pilihan))
    return `❌ Pilihan: *besar* (11-17) | *kecil* (4-10) | *triple* | *double*\nContoh: *!sicbo 500 besar*`;

  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);

  const dadu    = [rand(1,6), rand(1,6), rand(1,6)];
  const total   = dadu.reduce((a,b) => a+b, 0);
  const isTriple = dadu[0]===dadu[1] && dadu[1]===dadu[2];
  const isDouble = !isTriple && (dadu[0]===dadu[1] || dadu[1]===dadu[2] || dadu[0]===dadu[2]);
  const isBesar  = total >= 11 && !isTriple;
  const isKecil  = total <= 10 && !isTriple;

  const text = `🎲 *SIC BO*\n🎲 ${dadu.join(" | ")} = *${total}*`;

  let menang = false, multi = 2.0;
  if (pilihan === "besar"  && isBesar)  { menang = true; multi = 2.0; }
  if (pilihan === "kecil"  && isKecil)  { menang = true; multi = 2.0; }
  if (pilihan === "triple" && isTriple) { menang = true; multi = 10.0; }
  if (pilihan === "double" && isDouble) { menang = true; multi = 3.0; }

  return menang
    ? processWin(jid, bet, multi, chatId, `${text}\n✅ Tebakan *${pilihan}* BENAR!`)
    : processLose(jid, bet, chatId, `${text}\n❌ Bukan *${pilihan}*.`);
}

// P4. POKER LIAR — dapat 5 kartu, bayaran berdasarkan kombinasi
function cmdPokerLiar(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);

  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const SUITS = ["♠","♥","♦","♣"];

  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ r, s, v: RANKS.indexOf(r) });
  deck.sort(() => Math.random() - 0.5);
  const hand    = deck.slice(0, 5);
  const handStr = hand.map(c => `${c.r}${c.s}`).join(" ");

  const counts = {}, suitCounts = {};
  hand.forEach(c => {
    counts[c.v]     = (counts[c.v]     || 0) + 1;
    suitCounts[c.s] = (suitCounts[c.s] || 0) + 1;
  });

  const vals       = Object.values(counts).sort((a,b) => b-a);
  const isFlush    = Object.values(suitCounts).some(v => v === 5);
  const sortedVals = hand.map(c => c.v).sort((a,b) => a-b);
  const isStraight = sortedVals[4] - sortedVals[0] === 4 && vals[0] === 1;

  let combo = "High Card", multi = 0;
  if (vals[0] === 2 && vals[1] !== 2) { combo = "One Pair";        multi = 1.5; }
  if (vals[0] === 2 && vals[1] === 2) { combo = "Two Pair";        multi = 2.0; }
  if (vals[0] === 3 && vals[1] === 1) { combo = "Three of a Kind"; multi = 3.0; }
  if (isStraight && !isFlush)         { combo = "Straight";         multi = 4.0; }
  if (isFlush && !isStraight)         { combo = "Flush";            multi = 5.0; }
  if (vals[0] === 3 && vals[1] === 2) { combo = "Full House";      multi = 7.0; }
  if (vals[0] === 4)                  { combo = "Four of a Kind";  multi = 15.0; }
  if (isStraight && isFlush)          { combo = "Straight Flush";  multi = 25.0; }

  const text = `🃏 *POKER LIAR*\nKartu: *${handStr}*\n\n💡 Kombinasi: *${combo}*`;

  return multi > 0
    ? processWin(jid, bet, multi, chatId, `${text}`)
    : processLose(jid, bet, chatId, `${text}\n💀 High Card tidak menang.`);
}

// P5. PLINKO — jatuhkan bola, dapet multiplier random
function cmdPlinko(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);

  const SLOTS   = [10.0, 3.0, 1.5, 0.5, 0.2, 0.5, 1.5, 3.0, 10.0];
  const WEIGHTS = [  1,   4,   8,  12,  20,  12,   8,   4,   1];

  let totalW = WEIGHTS.reduce((a,b) => a+b, 0);
  let r = Math.random() * totalW;
  let idx = 0;
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i]; if (r <= 0) { idx = i; break; }
  }

  const multi   = SLOTS[idx];
  const display = SLOTS.map((v, i) => i === idx ? `[${v}x]` : `${v}x`).join(" ");

  return multi >= 1.0
    ? processWin(jid, bet, multi, chatId, `🔵 *PLINKO!*\n${display}\n🏆 Bola jatuh di *${multi}x*!`)
    : processLose(jid, bet, chatId, `🔵 *PLINKO!*\n${display}\n💔 Bola jatuh di *${multi}x*...`);
}

// P6. TOWER — pilih kotak aman dari 3 baris, multiplier naik
const towerSessions = {}; // { jid: { level, bet, chatId, multi, currentBomb } }

function cmdTower(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  if (towerSessions[jid]) return `🏰 Kamu sedang di dalam tower! Pilih: *!towernaik [1/2/3]* atau *!towerkabur*`;
  db.deductBalance(jid, bet);
  towerSessions[jid] = { level: 0, bet, chatId, multi: 1.0, currentBomb: null };
  return generateTowerFloor(jid);
}

function generateTowerFloor(jid) {
  const s = towerSessions[jid];
  if (!s) return `❌ Tidak ada sesi tower aktif.`;
  s.level++;
  s.multi = parseFloat((s.multi * 1.5).toFixed(2));
  s.currentBomb = rand(1, 3);
  return (
    `🏰 *TOWER — Level ${s.level}*\nMultiplier jika naik: *${s.multi}x*\n\n` +
    `[1] [2] [3] — satu kotak bom!\n\n` +
    `📌 Pilih kotak: *!towernaik [1/2/3]*\n📌 Ambil kemenangan: *!towerkabur*`
  );
}

function cmdTowerNaik(jid, pilihan) {
  const s = towerSessions[jid];
  if (!s) return `❌ Tidak ada sesi Tower aktif. Mulai: *!tower [bet]*`;

  const p = parseInt(pilihan);
  if (isNaN(p) || p < 1 || p > 3) return `❌ Pilih 1, 2, atau 3.`;

  if (p === s.currentBomb) {
    delete towerSessions[jid];
    const p2 = db.getPlayer(jid);
    p2.stats.losses++;
    db.savePlayers();
    return `💥 *BOM! Level ${s.level}, Kotak ${p} berisi BOM!*\n-${num(s.bet)} koin. Saldo: ${num(p2.balance)}`;
  }

  if (s.level >= 8) {
    const gross = Math.floor(s.bet * s.multi);
    const tax   = Math.floor(gross * cfg.taxPercent / 100);
    const net   = gross - tax;
    db.addBalance(jid, net);
    db.addCashPool(s.chatId, tax);
    const p2 = db.getPlayer(jid);
    p2.stats.wins++;
    db.savePlayers();
    delete towerSessions[jid];
    return `🏆 *TOWER CLEARED! Level MAX!*\n+${num(net)} koin | Saldo: ${num(p2.balance)}`;
  }

  return generateTowerFloor(jid);
}

function cmdTowerKabur(jid) {
  const s = towerSessions[jid];
  if (!s) return `❌ Tidak ada sesi Tower.`;

  if (s.level === 0) {
    delete towerSessions[jid];
    db.addBalance(jid, s.bet);
    return `🏃 Kabur dari Tower. Bet dikembalikan.`;
  }

  const gross = Math.floor(s.bet * s.multi);
  const tax   = Math.floor(gross * cfg.taxPercent / 100);
  const net   = gross - tax;
  db.addBalance(jid, net);
  db.addCashPool(s.chatId, tax);
  const p = db.getPlayer(jid);
  p.stats.wins++;
  db.savePlayers();
  delete towerSessions[jid];
  return `🏃 *Kabur dari Tower di Level ${s.level}!*\n+${num(net)} koin (${s.multi}x)\nSaldo: ${num(p.balance)}`;
}

// P7. TOGEL MINI — tebak 2 angka (00-99), bonus combo (tebak persis urutan)
function cmdTogel(jid, bet, tebakanRaw, mode, chatId) {
  const tebakan = String(tebakanRaw).padStart(2, "0");
  if (!/^\d{2}$/.test(tebakan)) return `❌ Tebak angka 00–99. Contoh: *!togel 500 07 as* (as=persis, bb=bebas)`;
  if (!["as","bb"].includes(mode)) return `❌ Mode: *as* (persis) atau *bb* (bebas urutan). Contoh: *!togel 500 07 as*`;

  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);

  const result   = String(rand(0, 99)).padStart(2, "0");
  const [r1, r2] = result.split("");
  const [t1, t2] = tebakan.split("");

  const exactMatch = tebakan === result;
  const freeMatch  = (t1===r1 && t2===r2) || (t1===r2 && t2===r1);

  const text = `🔢 *TOGEL MINI*\nAngka keluar: *${result}* | Tebakanmu: *${tebakan}* (${mode.toUpperCase()})`;

  if (mode === "as" && exactMatch) return processWin(jid, bet, 70.0, chatId, `${text}\n🎯 PERSIS BANGET!`);
  if (mode === "bb" && freeMatch)  return processWin(jid, bet, 10.0, chatId, `${text}\n✅ Dua angka benar!`);
  return processLose(jid, bet, chatId, `${text}\n❌ Tidak cocok.`);
}

// ══════════════════════════════════════════════════════════════
//  EXPORT
// ══════════════════════════════════════════════════════════════
module.exports = {
  // Kasino Dasar (12)
  cmdSlot, cmdCoinFlip, cmdTebakAngka, cmdRanjau, cmdDadu, cmdRolet,
  cmdHiLo, cmdSpin, cmdBalapKuda, cmdTebakKoin, cmdJackpotGanda, cmdBomberman,
  // PVP / Logika (3)
  cmdSuit, cmdBlackjackStart, cmdBlackjackHit, cmdBlackjackStand, cmdTebakOperasi,
  // Trivia (7)
  cmdKuis, cmdTebakHewan, cmdTebakBendera, cmdSusunKata, cmdMatematika, cmdTebakIbukota, cmdTebakLirik,
  // RPG (5)
  cmdHunt, cmdMancing, cmdGacha, cmdJual, cmdEkspedisi,
  // Game Baru G1–G23 (23)
  cmdTebakKartu, cmdTebakWarna, cmdDadu3, cmdGanjilGenap, cmdKartuPetak,
  cmdMembalik, cmdTebakPrima, cmdLemparKartu, cmdTebakDadu, cmdPetarung,
  cmdLombaRenang, cmdUndian, cmdTembakBintang, cmdPindahKoin, cmdNaikTangga,
  cmdCuacaHari, cmdBombParty, cmdTebakWaktu, cmdBaccarat, cmdDragonTiger,
  cmdTebakEmoji, cmdKoinSegitiga, cmdMineSweeper,
  // Jawab kuis
  cmdJawabKuis,
  // Wordle (2)
  cmdWordleStart, cmdTebakWordle,
  // Hangman (2)
  cmdHangmanStart, cmdTebakHuruf,
  // Kasino Premium P1–P7 (9)
  cmdCrash, cmdWarKartu, cmdSicbo, cmdPokerLiar, cmdPlinko,
  cmdTower, cmdTowerNaik, cmdTowerKabur, cmdTogel,
};