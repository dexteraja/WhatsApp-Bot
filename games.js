// ============================================================
//  games.js — Game Core Unified (V6.0 — Full Fixed)
// ============================================================
require("./config");
const cfg = global.botConfig;
const db  = require("./db");
const { checkSpecificCooldown } = require("./security");

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const tag  = (jid) => `@${jid.split("@")[0]}`;
const num  = (n)   => n.toLocaleString();

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

function processWin(jid, bet, multi, chatId, resultText) {
  const gross = Math.floor(bet * multi);
  const tax   = Math.floor(gross * (cfg.taxPercent / 100));
  const net   = gross - tax;
  db.addBalance(jid, net);
  db.addCashPool(chatId, tax);
  const p = db.getPlayer(jid);
  p.stats.wins++;
  db.savePlayers();
  return `${resultText}\n${tag(jid)} menang *+${num(net)} koin* 🎉 (saldo: ${num(p.balance)})`;
}

function processLose(jid, bet, chatId, resultText) {
  const p      = db.getPlayer(jid);
  const wasIns = p.insurance.active && Date.now() < (p.insurance.expires_at || 0);
  const tax    = Math.floor(bet * (cfg.taxPercent / 100));
  db.addCashPool(chatId, tax);
  p.stats.losses++;
  db.savePlayers();
  const insNote = (wasIns && !p.insurance.active) ? "\n🛡️ *Asuransi cair!* Saldo dipulihkan." : "";
  return `${resultText}\n${tag(jid)} kalah *-${num(bet)} koin* 💀 (saldo: ${num(p.balance)})${insNote}`;
}

function cmdSlot(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const E = cfg.slotEmojis;
  const roll = [0,1,2].map(() => E[rand(0, E.length - 1)]);
  const line = `🎰 ${roll.join(" ")}`;

  if (roll.every(r => r === "7️⃣"))
    return processWin(jid, bet, cfg.multipliers.slotSeven, chatId, `${line}\n🚨 *MEGA JACKPOT! TRIPLE 7!*`);
  if (roll[0] === roll[1] && roll[1] === roll[2])
    return processWin(jid, bet, cfg.multipliers.slotTriple, chatId, `${line}\n🎊 *JACKPOT! Tiga seragam!*`);
  if (roll[0]===roll[1] || roll[1]===roll[2] || roll[0]===roll[2])
    return processWin(jid, bet, cfg.multipliers.slotDouble, chatId, `${line}\n✨ Double!`);
  return processLose(jid, bet, chatId, `${line}\nZonk!`);
}

function cmdCoinFlip(jid, bet, choice, chatId) {
  if (!["heads","tails"].includes(choice))
    return "❌ Pilih: *heads* atau *tails*. Contoh: *!coinflip 500 heads*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const side  = rand(0,1) === 0 ? "heads" : "tails";
  const emoji = side === "heads" ? "🪙▲" : "🪙▽";
  const text  = `${emoji} Koin jatuh: *${side.toUpperCase()}*`;
  return choice === side ? processWin(jid, bet, cfg.multipliers.coinFlip, chatId, text) : processLose(jid, bet, chatId, text);
}

function cmdTebakAngka(jid, bet, guess, chatId) {
  if (guess < 1 || guess > 10)
    return "❌ Tebak angka antara 1–10. Contoh: *!tebakangka 500 7*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const target = rand(1, 10);
  const text   = `🎯 Angka keluar: *${target}*`;
  if (guess === target) return processWin(jid, bet, cfg.multipliers.tebakAngka, chatId, `${text} — TEPAT!`);
  if (Math.abs(guess - target) === 1) {
    db.addBalance(jid, bet);
    return `${text}\n${tag(jid)} meleset tipis! Taruhan dikembalikan.`;
  }
  return processLose(jid, bet, chatId, text);
}

function cmdRanjau(jid, bet, step, chatId) {
  if (step < 1 || step > 5) return "❌ Pilih langkah 1–5. Contoh: *!ranjau 500 3*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const bomb  = rand(1, 5);
  const track = [1,2,3,4,5].map(i => i === bomb ? "💣" : (i === step ? "👟" : "⬜")).join("");
  if (step === bomb) return processLose(jid, bet, chatId, `${track}\n💥 *BOOM!* Ranjau di langkah ${step}!`);
  return processWin(jid, bet, cfg.multipliers.ranjau, chatId, `${track}\n✅ Aman! Ranjau ada di langkah ${bomb}.`);
}

function cmdDadu(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const DADU = ["","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣"];
  const p = rand(1, 6); const b = rand(1, 6);
  const text = `🎲 Kamu: ${DADU[p]} vs Bot: ${DADU[b]}`;
  if (p > b) return processWin(jid, bet, cfg.multipliers.dadu, chatId, text);
  if (p === b) { db.addBalance(jid, bet); return `${text}\n⚖️ Seri! Taruhan kembali.`; }
  return processLose(jid, bet, chatId, text);
}

function cmdRolet(jid, bet, choice, chatId) {
  if (!["merah","hitam","hijau"].includes(choice))
    return "❌ Pilih: *merah*, *hitam*, atau *hijau*. Contoh: *!rolet 500 merah*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const num2 = rand(0, 36);
  let color = "hijau";
  if (num2 !== 0) color = num2 % 2 === 0 ? "hitam" : "merah";
  const emo = { merah:"🔴", hitam:"⚫", hijau:"🟢" };
  const text = `🎡 Rolet berhenti di *${num2}* ${emo[color]}`;
  if (choice === color) return processWin(jid, bet, color === "hijau" ? cfg.multipliers.roletHijau : cfg.multipliers.rolet, chatId, text);
  return processLose(jid, bet, chatId, text);
}

function cmdHiLo(jid, bet, choice, chatId) {
  if (!["hi","lo"].includes(choice)) return "❌ Pilih: *hi* (>50) atau *lo* (≤50). Contoh: *!hilo 500 hi*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const n = rand(1, 100); const text = `📊 Angka keluar: *${n}*`;
  const isHi = n > 50;
  if ((choice==="hi" && isHi) || (choice==="lo" && !isHi)) return processWin(jid, bet, cfg.multipliers.hilo, chatId, text);
  return processLose(jid, bet, chatId, text);
}

function cmdSpin(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const zones = [
    { label: "ZONK 💀", multi: 0 }, { label: "MENANG ✅", multi: cfg.multipliers.spin },
    { label: "ZONK 💀", multi: 0 }, { label: "MENANG ✅", multi: cfg.multipliers.spin },
    { label: "ZONK 💀", multi: 0 }, { label: "JACKPOT 🌟", multi: cfg.multipliers.spinJackpot },
  ];
  const res = zones[rand(0, zones.length - 1)];
  const text = `🌀 Roda berhenti: *${res.label}*`;
  if (res.multi > 0) return processWin(jid, bet, res.multi, chatId, text);
  return processLose(jid, bet, chatId, text);
}

function cmdBalapKuda(jid, bet, kudaStr, chatId) {
  const kuda = parseInt(kudaStr);
  if (isNaN(kuda) || kuda < 1 || kuda > 4) return "❌ Pilih kuda 1–4. Contoh: *!balapkuda 500 3*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const names = ["Angin 🐎","Kilat 🐎","Badai 🐎","Petir 🐎"];
  const winner = rand(0, 3);
  const track = names.map((n, i) => `${i===winner?"🏁":" "} ${i===winner?n:n.replace("🐎","🐴")}`).join("\n");
  const text = `🏇 *Balap Selesai!*\n${track}\nPemenang: *${names[winner]}* (No.${winner+1})`;
  if (kuda - 1 === winner) return processWin(jid, bet, cfg.multipliers.balapkuda, chatId, text);
  return processLose(jid, bet, chatId, text);
}

function cmdTebakKoin(jid, bet, hand, chatId) {
  if (!["kiri","kanan"].includes(hand)) return "❌ Pilih: *kiri* atau *kanan*. Contoh: *!tebakkoin 500 kiri*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const ans = rand(0,1) === 0 ? "kiri" : "kanan";
  const anim = ans === "kiri" ? "🤜🪙 " : " 🪙🤛";
  const text = `${anim}\nKoin ada di tangan *${ans.toUpperCase()}*!`;
  if (hand === ans) return processWin(jid, bet, cfg.multipliers.tebakkoin, chatId, text);
  return processLose(jid, bet, chatId, text);
}

function cmdJackpotGanda(jid, bet, choice, chatId) {
  if (!["1","2"].includes(choice)) return "❌ Pilih bola *1* atau *2*. Contoh: *!jackpotganda 500 1*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const win = rand(1,2).toString();
  const text = `🔮 Bola 1: ${win==="1"?"⭐":"💀"} Bola 2: ${win==="2"?"⭐":"💀"}`;
  if (choice === win) return processWin(jid, bet, cfg.multipliers.jackpotGanda, chatId, `${text}\n✨ Bola yang benar!`);
  return processLose(jid, bet, chatId, `${text}\nBola kamu kosong!`);
}

function cmdBomberman(jid, bet, cell, chatId) {
  if (cell < 1 || cell > 9) return "❌ Pilih kotak 1–9. Contoh: *!bomberman 500 5*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const bombs = new Set();
  while (bombs.size < 3) bombs.add(rand(1, 9));
  const grid = Array.from({length:9}, (_,i) => {
    const n = i + 1;
    if (bombs.has(n)) return n === cell ? "💥" : "💣";
    return n === cell ? "✅" : "⬜";
  });
  const display = [grid.slice(0,3).join(" "), grid.slice(3,6).join(" "), grid.slice(6,9).join(" ")].join("\n");
  if (!bombs.has(cell)) return processWin(jid, bet, cfg.multipliers.bomberman, chatId, `💣 Bomberman\n${display}\nKotak aman!`);
  return processLose(jid, bet, chatId, `💣 Bomberman\n${display}\n*BOOM!*`);
}

function cmdSuit(jid, bet, choice, chatId) {
  const valid = ["batu","gunting","kertas"];
  if (!valid.includes(choice)) return "❌ Pilih: *batu*, *gunting*, atau *kertas*. Contoh: *!suit 500 batu*";
  const err = takeBet(jid, bet); if (err) return err;
  db.deductBalance(jid, bet);
  const emo = { batu:"🪨", gunting:"✂️", kertas:"📄" }; const b = valid[rand(0,2)];
  const text = `${emo[choice]} Kamu: *${choice}* vs Bot: *${b}* ${emo[b]}`;
  if (choice === b) { db.addBalance(jid, bet); return `${text}\n⚖️ Seri! Taruhan kembali.`; }
  const win = (choice==="batu"&&b==="gunting") || (choice==="gunting"&&b==="kertas") || (choice==="kertas"&&b==="batu");
  return win ? processWin(jid, bet, cfg.multipliers.suit, chatId, text) : processLose(jid, bet, chatId, text);
}

const BJ_VALUES = [2,3,4,5,6,7,8,9,10,10,10,10,11];
function drawCard() { return BJ_VALUES[rand(0, BJ_VALUES.length-1)]; }
function handTotal(hand) {
  let total = hand.reduce((a,b) => a+b, 0); let aces = hand.filter(c => c===11).length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function cmdBlackjackStart(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err;
  const p = db.getPlayer(jid);
  if (p.game_session.status === "playing_blackjack") return "❌ Sesi Blackjack aktif! Ketik *!hit* atau *!stand*.";
  db.deductBalance(jid, bet);
  const pH = [drawCard(), drawCard()]; const dH = [drawCard(), drawCard()];
  p.game_session = { status: "playing_blackjack", data: { bet, playerHand: pH, dealerHand: dH, chatId } };
  db.savePlayers();

  if (handTotal(pH) === 21) {
    p.game_session.status = null;
    return processWin(jid, bet, cfg.multipliers.blackjackBJ, chatId, `♠️ *NATURAL BLACKJACK!* Kartu: ${pH.join(", ")}`);
  }
  return `♠️ *Blackjack — ${tag(jid)}*\nKartumu: ${pH.join(", ")} _(${handTotal(pH)})_\nDealer: ${dH[0]}, ❓\n*!hit* ambil | *!stand* berhenti`;
}

function cmdBlackjackHit(jid) {
  const p = db.getPlayer(jid); if (p.game_session.status !== "playing_blackjack") return null;
  const data = p.game_session.data; data.playerHand.push(drawCard());
  const total = handTotal(data.playerHand);
  if (total > 21) {
    p.game_session = { status: null, data: {} }; db.savePlayers();
    return processLose(jid, data.bet, data.chatId, `💥 *Bust!* Total: ${total} (${data.playerHand.join(", ")})`);
  }
  db.savePlayers();
  return `♠️ *Hit!*\nKartumu: ${data.playerHand.join(", ")} _(${total})_\nDealer: ${data.dealerHand[0]}, ❓\n*!hit* atau *!stand*?`;
}

function cmdBlackjackStand(jid) {
  const p = db.getPlayer(jid); if (p.game_session.status !== "playing_blackjack") return null;
  const { bet, playerHand, dealerHand, chatId: bjChatId } = p.game_session.data;
  p.game_session = { status: null, data: {} }; db.savePlayers();

  while (handTotal(dealerHand) < 17) dealerHand.push(drawCard());
  const pT = handTotal(playerHand); const dT = handTotal(dealerHand);
  const text = `♠️ *Blackjack — Hasil*\nKartumu: ${playerHand.join(", ")} _(${pT})_\nDealer: ${dealerHand.join(", ")} _(${dT})_`;
  if (dT > 21 || pT > dT) return processWin(jid, bet, cfg.multipliers.blackjack, bjChatId, text);
  if (pT === dT) { db.addBalance(jid, bet); return `${text}\n⚖️ Seri! Taruhan kembali.`; }
  return processLose(jid, bet, bjChatId, text);
}

function cmdTebakOperasi(chatId, jid) {
  if (db.getActiveSession(chatId)) return cfg.msg.quizLocked;
  const ops = ["+","-","*"]; const op1 = ops[rand(0,2)], op2 = ops[rand(0,2)];
  const a = rand(1,20), b = rand(1,20), c = rand(1,10);
  const ans = new Function(`return ${a} ${op1} ${b} ${op2} ${c}`)();
  if (!Number.isInteger(ans)) return cmdTebakOperasi(chatId, jid);
  db.setActiveSession(chatId, { quiz: { a: ans.toString() }, expiresAt: Date.now() + cfg.quizTimeoutMs, askedBy: jid });
  setTimeout(() => { if (db.getActiveSession(chatId)) db.clearActiveSession(chatId); }, cfg.quizTimeoutMs);
  return `🔢 *Tebak Operasi*\nSoal: *${a} ${op1} ${b} ${op2} ${c} = ?*\nHadiah 200–500 koin 💰`;
}

// ── DATA QUIZ TRIVIA SYSTEM ──
const Q_UMUM = [{q:"Hewan gurun berpunuk?",a:"unta"}, {q:"Kereta di rel tunggal?",a:"monorel"}, {q:"Alat mengukur suhu?",a:"termometer"}];
const Q_HEWAN = [{q:"🐘",a:"gajah"},{q:"🦇",a:"kelelawar"},{q:"🐧",a:"penguin"}];
const Q_BENDERA = [{q:"🇯🇵",a:"jepang"},{q:"🇮🇩",a:"indonesia"},{q:"🇺🇸",a:"amerika serikat"}];
const Q_KATA = [{q:"O-K-U-T-M-P-R-E",a:"komputer"}, {q:"M-A-R-U-H",a:"rumah"}];
const Q_IBUKOTA = [{q:"Ibukota Jepang?",a:"tokyo"}, {q:"Ibukota Prancis?",a:"paris"}];
const Q_LIRIK = [{q:'🎵 "Tanah airku tidak ku... lupa-kan..."',a:"lupakan"}];

function makeClue(word) { return word.split("").map((c, i) => c === " " ? " " : (i % 2 === 1 ? "_" : c)).join(" ").trim(); }
function startTrivia(chatId, jid, dbArray, title) {
  if (db.getActiveSession(chatId)) return cfg.msg.quizLocked;
  const quiz = dbArray[rand(0, dbArray.length - 1)];
  db.setActiveSession(chatId, { quiz, expiresAt: Date.now() + cfg.quizTimeoutMs, askedBy: jid });
  setTimeout(() => { if (db.getActiveSession(chatId)) db.clearActiveSession(chatId); }, cfg.quizTimeoutMs);
  return `${title}\nSoal: *${quiz.q}*\nPetunjuk: _${makeClue(quiz.a)}_\nJawab cepat dalam 30 detik!`;
}

function cmdKuis(chatId, jid) { return startTrivia(chatId, jid, Q_UMUM, "🧠 *Kuis Umum*"); }
function cmdTebakHewan(chatId, jid) { return startTrivia(chatId, jid, Q_HEWAN, "🐾 *Tebak Hewan*"); }
function cmdTebakBendera(chatId, jid) { return startTrivia(chatId, jid, Q_BENDERA, "🚩 *Tebak Bendera*"); }
function cmdSusunKata(chatId, jid) { return startTrivia(chatId, jid, Q_KATA, "🔤 *Susun Kata*"); }
function cmdTebakIbukota(chatId, jid) { return startTrivia(chatId, jid, Q_IBUKOTA, "🏛️ *Tebak Ibukota*"); }
function cmdTebakLirik(chatId, jid) { return startTrivia(chatId, jid, Q_LIRIK, "🎵 *Tebak Lirik*"); }

function cmdMatematika(chatId, jid) {
  if (db.getActiveSession(chatId)) return cfg.msg.quizLocked;
  const ops = ["+","-","*"]; const op = ops[rand(0,1)]; const a = rand(10,50), b = rand(5,30);
  const ans = new Function(`return ${a} ${op} ${b}`)();
  db.setActiveSession(chatId, { quiz: { a: ans.toString() }, expiresAt: Date.now() + cfg.quizTimeoutMs, askedBy: jid });
  setTimeout(() => { if (db.getActiveSession(chatId)) db.clearActiveSession(chatId); }, cfg.quizTimeoutMs);
  return `🔢 *Kuis Matematika*\nSoal: *${a} ${op} ${b} = ?*\nJawab dalam 30 detik! Hadiah koin menanti.`;
}

function cmdJawabKuis(chatId, jid, text) {
  const session = db.getActiveSession(chatId); if (!session || Date.now() >= session.expiresAt) return null;
  if (text.toLowerCase().trim() !== session.quiz.a.toLowerCase().trim()) return null;
  db.clearActiveSession(chatId);
  const earned = db.addBalance(jid, rand(cfg.quizReward.min, cfg.quizReward.max));
  return `✅ *Benar!*\n${tag(jid)} menjawab paling cepat!\n💰 +${earned} koin masuk kantong.`;
}

function doLooting(jid, itemsArray, typeName, cooldownMs) {
  const wait = checkSpecificCooldown(jid, typeName, cooldownMs); if (wait > 0) return `⏳ Kelelahan! Istirahat *${Math.ceil(wait/60)} menit* lagi.`;
  if (Math.random() < 0.20) return `🍂 ${tag(jid)} tidak menemukan apa-apa. Coba lagi!`;
  const roll = Math.random(); let cum = 0, prize = itemsArray[0];
  for (const item of itemsArray) { cum += item.chance; if (roll <= cum) { prize = item; break; } }
  const p = db.getPlayer(jid); p.inventory.push({ name: prize.name, emoji: prize.emoji, price: prize.price });
  db.savePlayers();
  return `🎒 ${tag(jid)} dapat *${prize.emoji} ${prize.name}*!\nHarga jual: ${prize.price} koin. Ketik *!jual* untuk mencairkan koin.`;
}

function cmdHunt(jid) { return doLooting(jid, cfg.huntItems, "hunt", 900000); }
function cmdMancing(jid) { return doLooting(jid, cfg.mancingItems, "mancing", 600000); }

function cmdGacha(jid) {
  const wait = checkSpecificCooldown(jid, "gacha", 5000); if (wait > 0) return cfg.msg.onCooldown(wait);
  const p = db.getPlayer(jid); if (p.balance < cfg.gachaPrice) return `❌ Butuh *${cfg.gachaPrice} koin* untuk gacha.`;
  db.deductBalance(jid, cfg.gachaPrice);
  const roll = Math.random(); let cum = 0, prize = cfg.gachaItems[0];
  for (const item of cfg.gachaItems) { cum += item.chance; if (roll <= cum) { prize = item; break; } }
  p.inventory.push({ name: prize.name, emoji: prize.emoji, price: prize.price }); db.savePlayers();
  return `🎰 *Gacha Selesai!* Kamu dapat: *${prize.emoji} ${prize.name}* (${prize.price} koin).`;
}

function cmdJual(jid) {
  const p = db.getPlayer(jid); if (!p.inventory || p.inventory.length === 0) return "📦 Inventory kosong.";
  let earned = 0;
  const lines = p.inventory.map(item => { earned += item.price; return `${item.emoji} ${item.name} +${item.price}`; }).join("\n");
  p.inventory = []; db.addBalance(jid, earned);
  return `💰 *Semua Terjual!*\n${lines}\nTotal likuidasi: *+${earned} koin*`;
}

const EKSPEDISI_EVENTS = [
  { text:"⚔️ Ketemu peti harta di hutan!", type:"win", amount: ()=>rand(300,800) },
  { text:"🌊 Banjir dadakan! Kehilangan koin.", type:"lose", amount: ()=>rand(100,400) }
];

function cmdEkspedisi(jid) {
  const wait = checkSpecificCooldown(jid, "ekspedisi", 1800000); if (wait > 0) return `⏳ Istirahat *${Math.ceil(wait/60)} menit* lagi.`;
  const p = db.getPlayer(jid); const event = EKSPEDISI_EVENTS[rand(0, EKSPEDISI_EVENTS.length-1)]; const amount = event.amount();
  let result = `🗺️ *Ekspedisi — ${tag(jid)}*\n${event.text}\n`;
  if (event.type === "win") { db.addBalance(jid, amount); result += `💰 Dapat *+${amount} koin*`; }
  else if (event.type === "lose") { const loss = Math.min(amount, p.balance); db.deductBalance(jid, loss); result += `💸 Rugi *-${loss} koin*`; }
  return result;
}

function cmdTebakKartu(jid, bet, choice, chatId) {
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const v = rand(0, 12); const suits = ["♠️","♥️","♦️","♣️"]; const vals = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  let res = v === 6 ? "draw" : (v > 6 ? "tinggi" : "rendah");
  const text = `🃏 Kartu: *${suits[rand(0,3)]}${vals[v]}*`;
  if (res === "draw") { db.addBalance(jid, bet); return `${text}\n⚖️ Pas angka 7! Taruhan kembali.`; }
  return choice === res ? processWin(jid, bet, cfg.multipliers.tebakkartu, chatId, text) : processLose(jid, bet, chatId, text);
}

function cmdTebakWarna(jid, bet, choice, chatId) {
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const result = rand(0,1) === 0 ? "merah" : "hitam";
  const text = `${result === "merah" ? "🔴" : "⚫"} Warna kartu: *${result.toUpperCase()}*`;
  return choice === result ? processWin(jid, bet, cfg.multipliers.tebakwarna, chatId, text) : processLose(jid, bet, chatId, text);
}

function cmdDadu3(jid, bet, choice, chatId) {
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const winRate = 0.40; const isSettingWin = Math.random() < winRate;
  let d, tot, res, attempts = 0;
  do {
    d = [rand(1,6), rand(1,6), rand(1,6)]; tot = d.reduce((a,b)=>a+b, 0); res = tot >= 11 ? "besar" : "kecil"; attempts++;
    if (isSettingWin && choice === res) break; if (!isSettingWin && choice !== res) break;
  } while (attempts < 10);
  const text = `🎲 Dadu: ${d.join("-")} = *${tot}* (${res.toUpperCase()})`;
  return choice === res ? processWin(jid, bet, cfg.multipliers.dadu3, chatId, text) : processLose(jid, bet, chatId, text);
}

function cmdGanjilGenap(jid, bet, choice, chatId) {
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const n = rand(1, 100); const res = n % 2 === 0 ? "genap" : "ganjil";
  const text = `🔢 Angka: *${n}* → ${res.toUpperCase()}`;
  return choice === res ? processWin(jid, bet, cfg.multipliers.tebakganjilgenap, chatId, text) : processLose(jid, bet, chatId, text);
}

function cmdKartuPetak(jid, bet, pil, chatId) {
  const p2 = parseInt(pil); if (isNaN(p2) || p2 < 1 || p2 > 4) return "❌ Pilih kartu 1–4.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const winners = new Set(); while (winners.size < 2) winners.add(rand(1,4));
  const grid = [1,2,3,4].map(i => winners.has(i) ? (i===p2?"✅":"💰") : (i===p2?"❌":"💀")).join(" ");
  return winners.has(p2) ? processWin(jid, bet, cfg.multipliers.kartupetak, chatId, `🃏 Petak: ${grid}`) : processLose(jid, bet, chatId, `🃏 Petak: ${grid}`);
}

function cmdMembalik(jid, bet, choice, chatId) {
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const n = rand(10, 99); const rev = parseInt(n.toString().split("").reverse().join(""));
  const res = rev > n ? "lebih" : "kurang"; const text = `🔄 Angka: *${n}* → Balik: *${rev}*`;
  if (rev === n) { db.addBalance(jid, bet); return `${text}\n⚖️ Angka Kembar! Taruhan kembali.`; }
  return choice === res ? processWin(jid, bet, cfg.multipliers.membalik, chatId, text) : processLose(jid, bet, chatId, text);
}

function isPrime(n) { if (n < 2) return false; for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false; return true; }
function cmdTebakPrima(jid, bet, choice, chatId) {
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const n = rand(2, 50); const res = isPrime(n) ? "prima" : "bukan";
  const text = `🔢 Angka: *${n}* → ${isPrime(n) ? "Prima" : "Bukan Prima"}`;
  return choice === res ? processWin(jid, bet, cfg.multipliers.tebakprima, chatId, text) : processLose(jid, bet, chatId, text);
}

function cmdLemparKartu(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const p3 = drawCard(); const d2 = drawCard(); const text = `🃏 Kartumu: *${p3}* vs Dealer: *${d2}*`;
  if (p3 > d2) return processWin(jid, bet, cfg.multipliers.lemparkartu, chatId, text);
  if (p3 === d2) { db.addBalance(jid, bet); return `${text}\n⚖️ Seri! Taruhan balik.`; }
  return processLose(jid, bet, chatId, text);
}

function cmdTebakDadu(jid, bet, guess, chatId) {
  const g = parseInt(guess); if (g < 1 || g > 6) return "❌ Pilih 1–6.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const n = rand(1, 6); const text = `🎲 Dadu Keluar: *${n}*`;
  return g === n ? processWin(jid, bet, cfg.multipliers.tebakdadu, chatId, `${text} — TEPAT!`) : processLose(jid, bet, chatId, text);
}

function cmdPetarung(jid, bet, pilih, chatId) {
  const p4 = parseInt(pilih); if (isNaN(p4) || p4 < 1 || p4 > 3) return "❌ Pilih petarung 1–3.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const names = ["🗡️ Samurai","🪃 Hunter","🔮 Wizard"]; const winner = rand(0,2);
  const arena = names.map((n,i) => (i===winner ? `*${n}* 🏆` : n)).join(" vs ");
  return p4-1 === winner ? processWin(jid, bet, cfg.multipliers.petarung, chatId, `⚔️ ${arena}`) : processLose(jid, bet, chatId, `⚔️ ${arena}`);
}

function cmdLombaRenang(jid, bet, pilih, chatId) {
  const p5 = parseInt(pilih); if (isNaN(p5) || p5 < 1 || p5 > 5) return "❌ Pilih perenang 1–5.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const winner = rand(0,4);
  return p5-1 === winner ? processWin(jid, bet, cfg.multipliers.lombarenang, chatId, `🏁 Pemenang: Jalur *${winner+1}*`) : processLose(jid, bet, chatId, `🏁 Pemenang: Jalur *${winner+1}*`);
}

function cmdUndian(jid, bet, pilih, chatId) {
  const p6 = parseInt(pilih); if (isNaN(p6) || p6 < 1 || p6 > 6) return "❌ Pilih amplop 1–6.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const slot = rand(1,6);
  return p6 === slot ? processWin(jid, bet, cfg.multipliers.undian, chatId, "📬 Jackpot Terbuka! 💰") : processLose(jid, bet, chatId, `📬 Amplop kosong. Jackpot ada di No.${slot}`);
}

function cmdTembakBintang(jid, bet, pilih, chatId) {
  const p7 = parseInt(pilih); if (isNaN(p7) || p7 < 1 || p7 > 5) return "❌ Pilih bintang 1–5.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const winners = new Set(); while (winners.size < 2) winners.add(rand(1,5));
  return winners.has(p7) ? processWin(jid, bet, cfg.multipliers.tembakbintang, chatId, "🌠 Target Hancur & Berhadiah!") : processLose(jid, bet, chatId, "🌠 Bintang Redup...");
}

function cmdPindahKoin(jid, bet, choice, chatId) {
  if (!["kiri","tengah","kanan"].includes(choice)) return "❌ Pilih: kiri/tengah/kanan.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const spots = ["kiri","tengah","kanan"]; const ans = spots[rand(0,2)];
  const text = `👐 Koin bergeser ke: *${ans.toUpperCase()}*`;
  return choice === ans ? processWin(jid, bet, cfg.multipliers.pindahkoin, chatId, text) : processLose(jid, bet, chatId, text);
}

function cmdNaikTangga(jid, bet, chatId) {
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const rolls = [rand(1,6), rand(1,6), rand(1,6)]; const total = rolls.reduce((a,b)=>a+b,0);
  const text = `🪜 Lompatan tangga: ${rolls.join(" + ")} = *${total}*`;
  return total >= 10 ? processWin(jid, bet, cfg.multipliers.naiktangga, chatId, `${text}\n🏆 Sukses ke puncak!`) : processLose(jid, bet, chatId, `${text}\n😵 Tergelincir jatuh.`);
}

function cmdCuacaHari(jid, bet, choice, chatId) {
  if (!["cerah","hujan","mendung"].includes(choice)) return "❌ Pilih: cerah/hujan/mendung.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const opt = ["cerah","hujan","mendung"]; const res = opt[rand(0,2)];
  return choice === res ? processWin(jid, bet, cfg.multipliers.cuacahari, chatId, `☁️ Prakiraan: *${res.toUpperCase()}*`) : processLose(jid, bet, chatId, `☁️ Prakiraan: *${res.toUpperCase()}*`);
}

function cmdBombParty(jid, bet, pilih, chatId) {
  const p8 = parseInt(pilih); if (isNaN(p8) || p8 < 1 || p8 > 5) return "❌ Sasar bom 1–5.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const boom = rand(1,5);
  return p8 !== boom ? processWin(jid, bet, cfg.multipliers.bombparty, chatId, "🟩 Kabel dipotong... Aman!") : processLose(jid, bet, chatId, `💥 BOOM! Memicu bom No.${boom}!`);
}

function cmdTebakWaktu(jid, bet, choice, chatId) {
  if (!["am","pm"].includes(choice)) return "❌ Ketik am / pm.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);
  const res = rand(0,1) === 0 ? "am" : "pm";
  const text = `🕐 Jam Digital Menunjukkan: *${rand(1,12)}:${rand(10,59)} ${res.toUpperCase()}*`;
  return choice === res ? processWin(jid, bet, cfg.multipliers.tebakwaktu, chatId, text) : processLose(jid, bet, chatId, text);
}

// ── FIXED CODES: BACCARAT & DRAGON TIGER REALIGNMENT ──
function cmdBaccarat(jid, bet, choice, chatId) {
  if (!["player","banker","tie"].includes(choice)) return "❌ Pilih: *player*, *banker*, atau *tie*.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);

  const pScore = (rand(1,9) + rand(1,9)) % 10;
  const bScore = (rand(1,9) + rand(1,9)) % 10;
  let winner = "tie";
  if (pScore > bScore) winner = "player";
  else if (bScore > pScore) winner = "banker";

  const text = `🃏 *BACCARAT TABLE* 🃏\n• Player Score: *${pScore}*\n• Banker Score: *${bScore}*\n➡️ Hasil Akhir: *${winner.toUpperCase()}*`;
  if (choice === winner) {
    const multi = winner === "tie" ? cfg.multipliers.baccaratTie : cfg.multipliers.baccarat;
    return processWin(jid, bet, multi, chatId, text);
  }
  return processLose(jid, bet, chatId, text);
}

function cmdDragonTiger(jid, bet, choice, chatId) {
  if (!["dragon","tiger","tie"].includes(choice)) return "❌ Pilih: *dragon*, *tiger*, atau *tie*.";
  const err = takeBet(jid, bet); if (err) return err; db.deductBalance(jid, bet);

  const dCard = rand(1,13); const tCard = rand(1,13);
  const cardNames = ["","A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  let winner = "tie";
  if (dCard > tCard) winner = "dragon";
  else if (tCard > dCard) winner = "tiger";

  const text = `🐯 *DRAGON vs TIGER* 🐉\n• Dragon Card: *${cardNames[dCard]}* (${dCard})\n• Tiger Card: *${cardNames[tCard]}* (${tCard})\n➡️ Hasil Akhir: *${winner.toUpperCase()}*`;
  if (choice === winner) {
    const multi = winner === "tie" ? cfg.multipliers.dragontigerTie : cfg.multipliers.dragontiger;
    return processWin(jid, bet, multi, chatId, text);
  }
  return processLose(jid, bet, chatId, text);
}

module.exports = {
  cmdSlot, cmdCoinFlip, cmdTebakAngka, cmdRanjau, cmdDadu, cmdRolet, cmdHiLo, cmdSpin,
  cmdBalapKuda, cmdTebakKoin, cmdJackpotGanda, cmdBomberman, cmdSuit,
  cmdBlackjackStart, cmdBlackjackHit, cmdBlackjackStand, cmdTebakOperasi,
  cmdKuis, cmdTebakHewan, cmdTebakBendera, cmdSusunKata, cmdTebakIbukota, cmdTebakLirik,
  cmdMatematika, cmdJawabKuis, cmdHunt, cmdMancing, cmdGacha, cmdJual, cmdEkspedisi,
  cmdTebakKartu, cmdTebakWarna, cmdDadu3, cmdGanjilGenap, cmdKartuPetak, cmdMembalik,
  cmdTebakPrima, cmdLemparKartu, cmdTebakDadu, cmdPetarung, cmdLombaRenang, cmdUndian,
  cmdTembakBintang, cmdPindahKoin, cmdNaikTangga, cmdCuacaHari, cmdBombParty, cmdTebakWaktu,
  cmdBaccarat, cmdDragonTiger
};