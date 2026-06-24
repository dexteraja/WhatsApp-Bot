// ============================================================
//  games.js — Game Core (V5.1 Fixed)
// ============================================================
require("./config");
const cfg = global.botConfig;
const db  = require("./db");
const { checkSpecificCooldown } = require("./security");

const rand   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const tag    = (jid) => `@${jid.split("@")[0]}`;
const num    = (n)   => n.toLocaleString();

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
  const p       = db.getPlayer(jid);
  const wasIns  = p.insurance.active && Date.now() < (p.insurance.expires_at || 0);
  db.deductBalance(jid, bet);  // ✓ saves correctly, handles insurance
  const tax = Math.floor(bet * (cfg.taxPercent / 100));
  db.addCashPool(chatId, tax);
  p.stats.losses++;
  db.savePlayers();
  const insNote = wasIns && !p.insurance.active ? "\n🛡️ *Asuransi cair!* Saldo dipulihkan." : "";
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
  // Simpan session ke player (persisten ke disk)
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
    p.game_session.status = null;
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
  const data  = p.game_session.data;
  p.game_session.status = null;
  while (handTotal(data.dealerHand) < 17) data.dealerHand.push(drawCard());
  const pT = handTotal(data.playerHand);
  const dT = handTotal(data.dealerHand);
  const text = (
    `♠️ *Blackjack — Hasil*\n` +
    `Kartumu : ${data.playerHand.join(", ")} _(${pT})_\n` +
    `Dealer  : ${data.dealerHand.join(", ")} _(${dT})_`
  );
  if (dT > 21 || pT > dT)
    return processWin(jid, data.bet, cfg.multipliers.blackjack, data.chatId, text);
  if (pT === dT) { db.addBalance(jid, data.bet); return `${text}\n⚖️ Seri! Taruhan kembali.`; }
  return processLose(jid, data.bet, data.chatId, text);
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
  {q:"K-O-M-P-U-T-E-R",a:"komputer"},{q:"R-U-M-A-H",a:"rumah"},
  {q:"M-A-T-A-H-A-R-I",a:"matahari"},{q:"P-E-R-P-U-S-T-A-K-A-A-N",a:"perpustakaan"},
  {q:"S-E-K-O-L-A-H",a:"sekolah"},{q:"T-E-L-E-V-I-S-I",a:"televisi"},
  {q:"P-E-S-A-W-A-T",a:"pesawat"},{q:"M-E-R-D-E-K-A",a:"merdeka"},
  {q:"B-A-H-A-S-A",a:"bahasa"},{q:"M-U-S-I-K",a:"musik"},
  {q:"G-A-M-B-A-R",a:"gambar"},{q:"C-A-H-A-Y-A",a:"cahaya"},
  {q:"S-U-A-R-A",a:"suara"},{q:"T-A-N-A-H",a:"tanah"},
  {q:"H-U-J-A-N",a:"hujan"},{q:"B-U-L-A-N",a:"bulan"},
  {q:"S-U-N-G-A-I",a:"sungai"},{q:"L-A-U-T",a:"laut"},
  {q:"A-N-G-I-N",a:"angin"},{q:"A-P-I",a:"api"},
  {q:"T-E-M-A-N",a:"teman"},{q:"B-A-N-G-S-A",a:"bangsa"},
  {q:"R-A-K-Y-A-T",a:"rakyat"},{q:"N-E-G-A-R-A",a:"negara"},
  {q:"B-U-D-A-Y-A",a:"budaya"},{q:"C-I-N-T-A",a:"cinta"},
  {q:"D-A-M-A-I",a:"damai"},{q:"S-E-H-A-T",a:"sehat"},
  {q:"J-A-L-A-N",a:"jalan"},{q:"K-A-M-A-R",a:"kamar"},
  {q:"B-U-K-U",a:"buku"},{q:"M-A-T-A",a:"mata"},
  {q:"T-A-N-G-A-N",a:"tangan"},{q:"B-E-R-I-T-A",a:"berita"},
  {q:"P-E-T-A",a:"peta"},{q:"R-U-A-N-G",a:"ruang"},
  {q:"G-E-L-A-S",a:"gelas"},{q:"K-I-T-A-B",a:"kitab"},
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

module.exports = {
  // Kasino (12)
  cmdSlot, cmdCoinFlip, cmdTebakAngka, cmdRanjau, cmdDadu, cmdRolet,
  cmdHiLo, cmdSpin, cmdBalapKuda, cmdTebakKoin, cmdJackpotGanda, cmdBomberman,
  // PVP / Logika (3)
  cmdSuit, cmdBlackjackStart, cmdBlackjackHit, cmdBlackjackStand, cmdTebakOperasi,
  // Trivia (7)
  cmdKuis, cmdTebakHewan, cmdTebakBendera, cmdSusunKata, cmdMatematika, cmdTebakIbukota, cmdTebakLirik,
  // RPG (5)
  cmdHunt, cmdMancing, cmdGacha, cmdJual, cmdEkspedisi,
  // Jawab kuis
  cmdJawabKuis
};