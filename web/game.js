'use strict';
/* =====================================================================
   EUCHRE - A Midwest Kitchen-Table Game                  (c) 2026 Ironite
   ===================================================================== */
const VERSION = '1.0.0';
(async function () {
  const $ = s => document.querySelector(s);
  const sleepRaw = ms => new Promise(r => setTimeout(r, ms));
  const rand = n => Math.floor(Math.random() * n);
  const pick = a => a[rand(a.length)];
  const TEST = /[?&]test/.test(location.search), AUTO = /[?&]autopilot/.test(location.search);

  /* ---------------- saved settings & record ---------------- */
  let save = { settings: { music: true, sfx: true, vol: 60, target: 10, stick: 1, speed: 'normal' },
               stats: { played: 0, won: 0, lost: 0, hands: 0, euchres: 0, euchred: 0, marches: 0, loners: 0, streak: 0, best: 0 } };
  let saveTimer = null;
  async function loadSave() {
    let data = null;
    try { const r = await fetch('api/save', { cache: 'no-store' }); if (r.ok) data = await r.json(); } catch (e) { }
    if (!data) try { data = JSON.parse(localStorage.getItem('euchre.save') || 'null'); } catch (e) { }
    if (data) { Object.assign(save.settings, data.settings || {}); Object.assign(save.stats, data.stats || {}); }
  }
  function writeSave() {
    const body = JSON.stringify(save);
    try { localStorage.setItem('euchre.save', body); } catch (e) { }
    fetch('api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => { });
  }
  function persist(now) { clearTimeout(saveTimer); if (now) writeSave(); else saveTimer = setTimeout(writeSave, 250); }
  window.addEventListener('pagehide', () => { clearTimeout(saveTimer); writeSave(); });

  /* ---------------- pacing ---------------- */
  const PACE = { relaxed: 1.35, normal: 1, brisk: 0.6 };
  let pace = 1;
  const T = k => ({ deal: 70, move: 420, play: 380, think: 650, trick: 900, bid: 700, quip: 1900, banner: 1700 }[k]) * pace * (TEST ? 0.06 : 1);

  /* ---------------- the folks at the table ---------------- */
  const PEOPLE = {
    barb: { name: 'Barb', full: 'Aunt Barb', cam: 'barb',
      order: ['Pick it up!', "I'll order that up, hon.", 'Gimme that one.'], pass: ['Pass.', 'Not for me.', 'Nope, pass.'],
      call: ['Make it {s}!', "Let's go {s}.", '{S}, please!'], alone: ["I'm goin' alone!", 'Sit back, hon. I got this.'],
      trick: ['Got it!', 'Mine!', 'Thank you very much.'], euchre: ['Euchred! Ha!', 'Gotcha!'], euchred: ['Well, shoot.', 'Ope.', 'Oh, for Pete\'s sake.'],
      partner: ['Nice one, kiddo!', "Atta way!", 'That\'s my partner!'], win: ['We did it, hon!'], lose: ['Oh well. Coffee?'] },
    dale: { name: 'Dale', full: 'Uncle Dale', cam: 'dale',
      order: ["Pick 'er up.", 'You betcha, pick it up.', "I'll take that."], pass: ['Pass.', 'Uff da. Pass.', 'Nah.'],
      call: ['{S}. Yep.', 'Make it {s}.', 'Gonna go {s}.'], alone: ['Goin\' alone, by golly!', 'Hold my coffee.'],
      trick: ['Yep.', 'There she goes.', 'Ope, that\'s mine.'], euchre: ['Euchred ya!', 'Ha! Get outta here!'], euchred: ['Dang it.', 'Well, that\'s a stinker.', 'Ope.'],
      partner: ['Nice, June.'], win: ['Good game, good game.'], lose: ['Ah, ya got us.'] },
    june: { name: 'June', full: 'Grandma June', cam: 'june',
      order: ['Order it up, dear.', "I'll take it!", 'Pick it up, sweetie.'], pass: ['Pass, dear.', 'I pass.', 'Not this time.'],
      call: ['{S}, I think.', "Let's try {s}.", '{S}!'], alone: ["I'll go it alone, dear.", 'Grandma\'s going alone.'],
      trick: ['Oh, that one\'s mine!', 'Oh, for cute!', 'Well, isn\'t that something.'], euchre: ['Oh, you got euchred, dear!', 'Euchred! Tee hee.'], euchred: ['Oh, fiddlesticks.', 'Oh, my.'],
      partner: ['Good job, Dale!'], win: ['Oh, what fun!'], lose: ['Well, good game, kids.'] }
  };
  const SEATS = ['S', 'W', 'N', 'E'];   // you, left, partner (across), right

  /* ---------------- cards ---------------- */
  const SN = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }, SC = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RK = { 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const isRed = s => s === 'H' || s === 'D';
  const sister = s => ({ S: 'C', C: 'S', H: 'D', D: 'H' }[s]);
  const label = c => RK[c.r] + SC[c.s];

  try { await Promise.all([document.fonts.load('40px "Alfa Slab One"'), document.fonts.load('40px "Bitter"'), document.fonts.load('italic 20px "Bitter"')]); } catch (e) { }
  await loadSave();
  const backURL = Art.back().toDataURL('image/png');
  const DECK = [];
  for (const s of ['S', 'H', 'D', 'C']) for (let r = 9; r <= 14; r++) DECK.push({ id: s + r, s, r });
  for (const c of DECK) {
    const el = document.createElement('div'); el.className = 'card down';
    el.innerHTML = `<div class="lift"><div class="inner"><div class="face front"></div><div class="face back" style="background-image:url(${backURL})"></div></div></div>`;
    el.querySelector('.front').appendChild(Art.face(c));
    el.addEventListener('click', () => onCardClick(c));
    el.addEventListener('mouseenter', () => { if (el.classList.contains('pick')) Sound.play('hover'); });
    c.el = el;
  }
  (() => { const l = document.querySelector('link[rel=icon]'); l.href = Art.icon(64).toDataURL(); })();

  /* ---------------- game state ---------------- */
  let players = [], dealer = 0, trump = null, maker = -1, alone = false, up = null, kitty = [], trick = [], led = null, played = new Set();
  const handLog = [];
  let score = [0, 0], tricks = [0, 0], gameId = 0, liveId = 0, finished = false, started = false, clickWait = null, Wd = 0, Ht = 0, cw = 100, ch = 140, z = 100;
  class Cancel extends Error { }
  const sleep = async ms => { const id = liveId; await sleepRaw(ms); if (id !== gameId) throw new Cancel(); };
  const team = i => i % 2;               // 0 = us (you & Barb), 1 = them (Dale & June)
  const partnerOf = i => (i + 2) % 4;

  /* ---------------- rules helpers ---------------- */
  const effT = (c, t) => (t && c.r === 11 && c.s === sister(t)) ? t : c.s;
  const eff = c => effT(c, trump);
  const isTrump = c => trump && eff(c) === trump;
  function power(c, ledSuit) {
    const e = eff(c);
    if (e === trump) { if (c.r === 11 && c.s === trump) return 200; if (c.r === 11) return 199; return 100 + c.r; }
    return e === ledSuit ? c.r : 0;
  }
  function legal(p) {
    if (!trick.length) return p.hand.slice();
    const f = p.hand.filter(c => eff(c) === led);
    return f.length ? f : p.hand.slice();
  }
  function winning() {
    let best = null;
    for (const t of trick) { const pw = power(t.card, led); if (!best || pw > best.pw) best = { p: t.p, card: t.card, pw }; }
    return best;
  }
  const active = () => players.filter(p => !p.sitOut);

  /* ---------------- computer players ---------------- */
  function trumpValue(c, t) {
    if (c.r === 11 && c.s === t) return 3.2;
    if (c.r === 11 && c.s === sister(t)) return 2.7;
    if (c.s !== t) return 0;
    return { 14: 2.0, 13: 1.6, 12: 1.3, 10: 1.1, 9: 1.0 }[c.r];
  }
  function strength(hand, t) {
    let v = 0, nt = 0; const off = {};
    for (const c of hand) { const tv = trumpValue(c, t); if (tv) { v += tv; nt++; } else { off[c.s] = (off[c.s] || 0) + 1; if (c.r === 14) v += 0.9; else if (c.r === 13) v += 0.25; } }
    for (const s of ['S', 'H', 'D', 'C']) if (s !== t && !off[s] && nt >= 2) v += 0.45;
    return { v, nt, right: hand.some(c => c.r === 11 && c.s === t), left: hand.some(c => c.r === 11 && c.s === sister(t)) };
  }
  function worstFor(hand, t) {   // the card a dealer would throw away
    const non = hand.filter(c => effT(c, t) !== t);
    if (non.length) {
      const count = s => non.filter(c => c.s === s).length;
      return non.slice().sort((a, b) => (a.r === 14) - (b.r === 14) || count(a.s) - count(b.s) || a.r - b.r)[0];
    }
    return hand.slice().sort((a, b) => trumpValue(a, t) - trumpValue(b, t))[0];
  }
  function aiBid1(p) {
    let h = p.hand.slice(), st;
    if (p.i === dealer) { h.push(up); h = h.filter(c => c !== worstFor(h, up.s)); st = strength(h, up.s); }
    else { st = strength(h, up.s); const uv = trumpValue(up, up.s); st.v += team(p.i) === team(dealer) ? uv * 0.55 : -uv * 0.55; }
    const call = st.v >= 6.1;
    return { call, alone: call && st.v >= 9.6 && st.right && st.nt >= 3 };
  }
  function aiBid2(p, stuck) {
    let best = null;
    for (const s of ['S', 'H', 'D', 'C']) { if (s === up.s) continue; const st = strength(p.hand, s); if (!best || st.v > best.st.v) best = { s, st }; }
    const call = best.st.v >= 5.8 || stuck;
    return { suit: call ? best.s : null, alone: call && best.st.v >= 9.4 && best.st.right && best.st.nt >= 3 };
  }
  const TRUMP_ORDER = t => [[11, t], [11, sister(t)], [14, t], [13, t], [12, t], [10, t], [9, t]].map(([r, s]) => s + r);
  function highestTrumpLeft(p) {
    for (const id of TRUMP_ORDER(trump)) { if (played.has(id)) continue; return p.hand.some(c => c.id === id); }
    return false;
  }
  const lowKey = c => isTrump(c) ? 1000 + power(c, led) : (c.r === 14 ? 50 : c.r);
  function aiPlay(p) {
    const L = legal(p);
    if (!trick.length) {   // leading
      const tr = L.filter(isTrump).sort((a, b) => power(b) - power(a));
      if (team(maker) === team(p.i) && tr.length) {
        if (highestTrumpLeft(p) && (tr.length >= 2 || p.i === maker)) return tr[0];
        if (p.i !== maker && maker === partnerOf(p.i)) return tr[0];      // lead trump to the partner who called it
      }
      const ace = L.find(c => !isTrump(c) && c.r === 14); if (ace) return ace;
      const off = L.filter(c => !isTrump(c)).sort((a, b) => a.r - b.r);
      return off[0] || tr[tr.length - 1];
    }
    const best = winning(), partnerWinning = team(best.p) === team(p.i);
    if (partnerWinning) return L.slice().sort((a, b) => lowKey(a) - lowKey(b))[0];
    const beats = L.filter(c => power(c, led) > best.pw).sort((a, b) => power(a, led) - power(b, led));
    if (beats.length) return beats[0];
    return L.slice().sort((a, b) => lowKey(a) - lowKey(b))[0];
  }

  /* ---------------- layout ---------------- */
  const tableEl = $('#table'), cardsEl = $('#cards'), seatsEl = $('#seats');
  function measure() {
    Wd = tableEl.clientWidth; Ht = tableEl.clientHeight;
    ch = Math.max(96, Math.min(Ht * 0.215, Wd * 0.13, 220)); cw = ch * (Art.CW / Art.CH);
    tableEl.style.setProperty('--cw', cw + 'px'); tableEl.style.setProperty('--ch', ch + 'px');
    const m = $('#mat'), ms = ch * 2.25; m.style.width = m.style.height = ms + 'px'; m.style.left = (Wd / 2 - ms / 2) + 'px'; m.style.top = (cy() - ms / 2) + 'px';
    for (const cv of [$('#props'), $('#fx')]) { cv.width = Wd; cv.height = Ht; }
    drawProps();
    $('#bid').style.bottom = (ch * 1.22 + 16) + 'px'; $('#prompt').style.bottom = (ch * 1.22 + 20) + 'px';
  }
  const cy = () => Ht * 0.47;
  function anchor(seat) {
    if (seat === 'S') return { x: Wd / 2, y: Ht - ch * 0.6 - 4 };
    if (seat === 'N') return { x: Wd / 2, y: ch * 0.58 + 4 };
    if (seat === 'W') return { x: ch * 0.6 + 6, y: cy() };
    return { x: Wd - ch * 0.6 - 6, y: cy() };
  }
  function handPos(p, i, n) {
    const a = anchor(p.seat), k = i - (n - 1) / 2;
    if (p.seat === 'S') { const sp = cw * 0.74; return { x: a.x + k * sp, y: a.y + k * k * 2.2, r: k * 4.5 }; }
    if (p.seat === 'N') { const sp = cw * 0.42; return { x: a.x - k * sp, y: a.y - k * k * 1.4, r: 180 - k * 3.5 }; }
    const sp = cw * 0.42, dir = p.seat === 'W' ? 1 : -1;
    return { x: a.x - dir * k * k * 1.4, y: a.y + dir * k * sp, r: dir * 90 + dir * k * 3.5 };
  }
  function playSpot(seat) {
    const x = Wd / 2, y = cy(), d = ch * 0.42;
    return { S: { x, y: y + d, r: -3 }, N: { x, y: y - d, r: 183 }, W: { x: x - cw * 0.9, y, r: 87 }, E: { x: x + cw * 0.9, y, r: -86 } }[seat];
  }
  function place(c, x, y, r, zi, scale = 1) {
    c.x = x; c.y = y; c.rot = r;
    c.el.style.transform = `translate(${x - cw / 2}px, ${y - ch / 2}px) rotate(${r}deg) scale(${scale})`;
    if (zi !== undefined) c.el.style.zIndex = zi;
  }
  function flip(c, upFace) { c.el.classList.toggle('down', !upFace); }
  function layoutHand(p) { p.hand.forEach((c, i) => { const q = handPos(p, i, p.hand.length); place(c, q.x, q.y, q.r, 100 + i, p.sitOut ? 0.9 : 1); }); }
  function sortHand(p) {
    const order = trump ? [trump, ...(isRed(trump) ? ['S', 'D', 'C', 'H'] : ['H', 'C', 'D', 'S']).filter(s => s !== trump)] : ['S', 'H', 'C', 'D'];
    p.hand.sort((a, b) => order.indexOf(eff(a)) - order.indexOf(eff(b)) || power(b, eff(b)) - power(a, eff(a)) || b.r - a.r);
  }
  function layoutSeats() {
    for (const p of players) {
      const a = anchor(p.seat); let x, y;
      if (p.seat === 'S') { x = Wd / 2 - cw * 2.4 - 130; y = a.y + 6; }
      else if (p.seat === 'N') { x = Wd / 2 - cw * 1.6 - 120; y = a.y - 6; }
      else if (p.seat === 'W') { p.seatEl.classList.add('left'); p.seatEl.style.left = '16px'; p.seatEl.style.top = (cy() + cw * 1.45 + 66) + 'px'; continue; }
      else { p.seatEl.classList.add('right'); p.seatEl.style.left = (Wd - 16) + 'px'; p.seatEl.style.top = (cy() + cw * 1.45 + 66) + 'px'; continue; }
      p.seatEl.style.left = Math.max(120, Math.min(Wd - 120, x)) + 'px'; p.seatEl.style.top = y + 'px';
    }
  }
  function seatInfo() {
    for (const p of players) {
      let chips = '';
      if (p.i === dealer) chips += '<span class="chip dealer">DEALER</span>';
      if (p.i === maker) chips += '<span class="chip maker">CALLED IT</span>';
      if (p.sitOut) chips += '<span class="chip sit">SITTING OUT</span>';
      p.seatEl.querySelector('.nm').innerHTML = (p.human ? 'You' : p.person.full) + chips;
      p.seatEl.querySelector('.ct').textContent = p.human ? 'Partner: Barb' : (p.i === 2 ? 'Your partner' : 'Opponent');
      p.seatEl.classList.toggle('sitting', !!p.sitOut);
    }
  }
  function setTurn(i) { for (const p of players) p.seatEl.classList.toggle('turn', p.i === i); }
  function prompt(t) { $('#prompt').textContent = t || ''; }
  let bannerT = null;
  function banner(html, blue, ms) { const b = $('#banner'); b.innerHTML = html; b.classList.toggle('blue', !!blue); b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), ms || T('banner') / (TEST ? 0.06 : 1) * (TEST ? 0.2 : 1)); }
  function say(p, kind, chance = 1, s) {
    if (!p.person || Math.random() > chance) return;
    let line = pick(p.person[kind]); if (s) line = line.replace('{s}', SN[s].toLowerCase()).replace('{S}', SN[s]);
    const b = p.seatEl.querySelector('.bubble'); b.textContent = line; b.classList.add('show');
    clearTimeout(p.sayT); p.sayT = setTimeout(() => b.classList.remove('show'), T('quip') + 500);
  }
  function showTrump() {
    const el = $('#tSuit'), sub = $('#tSub');
    if (trump) {
      el.textContent = SC[trump]; el.className = 'suit ' + (isRed(trump) ? 'red' : 'black');
      sub.textContent = `${SN[trump]} · called by ${maker === 0 ? 'you' : players[maker].person.name}${alone ? ' (alone)' : ''}`;
    } else if (up) { el.textContent = '?'; el.className = 'suit'; sub.textContent = `Up card: ${label(up)}`; }
    else { el.textContent = '–'; el.className = 'suit'; sub.textContent = 'Shuffling…'; }
  }
  function showScore() {
    $('#ptsUs').textContent = score[0]; $('#ptsThem').textContent = score[1]; $('#toWin').textContent = `· to ${save.settings.target}`;
    $('#trUs').innerHTML = tricks[0] ? '<i></i>'.repeat(tricks[0]) + ` ${tricks[0]} trick${tricks[0] > 1 ? 's' : ''}` : '';
    $('#trThem').innerHTML = tricks[1] ? '<i></i>'.repeat(tricks[1]) + ` ${tricks[1]} trick${tricks[1] > 1 ? 's' : ''}` : '';
  }

  /* ---------------- props & effects ---------------- */
  const fxc = $('#fx').getContext('2d'), parts = [];
  const mugImg = Art.mug(260), cornImg = Art.popcorn(300);
  let steamT = 0;
  function drawProps() {
    const c = $('#props').getContext('2d'); c.clearRect(0, 0, Wd, Ht);
    const ms = Math.min(150, ch * 0.95), ps = Math.min(190, ch * 1.2);
    c.drawImage(mugImg, 14, Ht - ms - 8, ms, ms);
    c.drawImage(cornImg, Wd - ps - 10, Ht - ps * 0.86, ps, ps);
  }
  function burst(x, y, kind, n) {
    for (let i = 0; i < n; i++) {
      if (kind === 'pop') { const a = -Math.PI / 2 + (Math.random() - .5) * 2.2, v = 3 + Math.random() * 6; parts.push({ k: 'pop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, d: 0.009, s: 5 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - .5) * .3 }); }
      else if (kind === 'spark') { const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 4; parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 1, d: 0.02 + Math.random() * 0.02, s: 2 + Math.random() * 3, rot: 0 }); }
      else if (kind === 'confetti') { parts.push({ k: 'conf', x: Math.random() * Wd, y: -20 - Math.random() * Ht * 0.5, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 2.5, life: 1, d: 0.003, s: 6 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - .5) * .25, col: pick(['#a3302a', '#e8c35a', '#2f4f7a', '#44703c', '#fff7e4', '#c4752a']) }); }
    }
  }
  let lastT = performance.now();
  function frame(t) {
    const dt = Math.min(50, t - lastT), f = dt / 16.7; lastT = t;
    fxc.clearRect(0, 0, Wd, Ht);
    // coffee steam
    steamT += dt; const ms = Math.min(150, ch * 0.95), sx = 14 + ms * 0.5, sy = Ht - ms - 8 + ms * 0.26;
    fxc.save(); fxc.strokeStyle = 'rgba(255,255,255,.5)'; fxc.lineWidth = 3; fxc.lineCap = 'round';
    for (let j = 0; j < 3; j++) { fxc.globalAlpha = 0.25 + 0.15 * Math.sin(steamT / 600 + j); fxc.beginPath(); for (let k = 0; k < 14; k++) { const yy = sy - k * 4.5, xx = sx + (j - 1) * 12 + Math.sin(steamT / 500 + k * 0.5 + j * 2) * 6; k ? fxc.lineTo(xx, yy) : fxc.moveTo(xx, yy); } fxc.stroke(); }
    fxc.restore();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx * f; p.y += p.vy * f; p.life -= p.d * f;
      if (p.k === 'pop') { p.vy += 0.25 * f; p.rot += p.vr * f; fxc.save(); fxc.translate(p.x, p.y); fxc.rotate(p.rot); fxc.globalAlpha = Math.min(1, p.life * 2); fxc.fillStyle = '#fbf6e8'; fxc.beginPath(); for (let j = 0; j < 4; j++) { const b = j / 4 * 6.28; fxc.arc(Math.cos(b) * p.s * .5, Math.sin(b) * p.s * .4, p.s * 0.55, 0, 6.28); } fxc.fill(); fxc.fillStyle = '#f0cf6a'; fxc.beginPath(); fxc.arc(0, 0, p.s * 0.3, 0, 6.28); fxc.fill(); fxc.restore(); if (p.y > Ht + 20) p.life = 0; }
      else if (p.k === 'spark') { p.vy += 0.05 * f; fxc.globalAlpha = Math.max(0, p.life); fxc.fillStyle = '#ffd862'; fxc.beginPath(); fxc.arc(p.x, p.y, p.s, 0, 6.28); fxc.fill(); fxc.globalAlpha = 1; }
      else if (p.k === 'conf') { p.vx += Math.sin(t / 300 + i) * 0.03; p.rot += p.vr * f; fxc.save(); fxc.translate(p.x, p.y); fxc.rotate(p.rot); fxc.fillStyle = p.col; fxc.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); fxc.restore(); if (p.y > Ht + 20) p.life = 0; }
      if (p.life <= 0) parts.splice(i, 1);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------------- human input ---------------- */
  function onCardClick(c) { if (clickWait && clickWait.ok.includes(c)) { const w = clickWait; clickWait = null; w.done(c); } }
  function chooseCard(cards, all, text) {
    prompt(text);
    for (const c of all) { c.el.classList.toggle('pick', cards.includes(c)); c.el.classList.toggle('dim', !cards.includes(c)); }
    return new Promise(res => { clickWait = { ok: cards, done: c => { for (const x of all) x.el.classList.remove('pick', 'dim'); prompt(''); Sound.unlock(); res(c); } }; });
  }
  function ask(q, buttons, toggle) {
    const box = $('#bid'), btns = $('#bidBtns'); $('#bidQ').innerHTML = q; btns.innerHTML = ''; box.classList.remove('hidden');
    let lone = false;
    return new Promise(res => {
      for (const b of buttons) {
        const el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.innerHTML = b.html;
        el.onclick = () => { Sound.play('tick'); box.classList.add('hidden'); res({ v: b.v, alone: lone }); };
        btns.appendChild(el);
      }
      if (toggle) {
        const t = document.createElement('button'); t.className = 'toggle'; t.innerHTML = '☐ Go alone';
        t.onclick = () => { lone = !lone; t.classList.toggle('on', lone); t.innerHTML = (lone ? '☑' : '☐') + ' Go alone'; Sound.play('tick'); };
        btns.appendChild(t);
      }
    });
  }

  /* ---------------- dealing & bidding ---------------- */
  function makeTable() {
    seatsEl.innerHTML = '';
    players = SEATS.map((seat, i) => ({ i, seat, human: i === 0, person: i === 0 ? null : PEOPLE[['', 'dale', 'barb', 'june'][i]], hand: [] }));
    for (const p of players) {
      const el = document.createElement('div'); el.className = 'seat' + (p.seat === 'N' ? ' top' : '');
      el.innerHTML = `<div class="bubble"></div><div class="who"><div class="nm"></div><div class="ct"></div></div>`;
      if (!p.human) { const cam = Art.cameo(p.person.cam, 150); cam.className = 'cam'; el.prepend(cam); }
      seatsEl.appendChild(el); p.seatEl = el;
    }
  }

  async function newGame() {
    gameId++; liveId = gameId; finished = false; started = true; pace = PACE[save.settings.speed] || 1;
    $('#result').classList.add('hidden'); $('#bid').classList.add('hidden'); clickWait = null;
    makeTable(); measure(); layoutSeats();
    cardsEl.innerHTML = ''; for (const c of DECK) { c.el.className = 'card down instant'; cardsEl.appendChild(c.el); }
    score = [0, 0]; tricks = [0, 0]; dealer = rand(4); trump = null; maker = -1; up = null;
    showScore(); showTrump(); seatInfo();
    try {
      while (Math.max(...score) < save.settings.target) {
        await playHand();
        dealer = (dealer + 1) % 4;
      }
      await endGame();
    } catch (e) { if (!(e instanceof Cancel)) console.error(e); }
  }

  async function playHand() {
    trump = null; maker = -1; alone = false; up = null; kitty = []; trick = []; led = null; played = new Set(); tricks = [0, 0];
    for (const p of players) { p.hand = []; p.sitOut = false; }
    seatInfo(); showScore(); showTrump(); setTurn(-1);
    // gather & shuffle
    const deck = DECK.slice(); for (let i = deck.length - 1; i > 0; i--) { const j = rand(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const d = anchor(players[dealer].seat), sx = (d.x + Wd / 2) / 2, sy = (d.y + cy()) / 2;
    deck.forEach((c, i) => { c.el.className = 'card down fast'; place(c, sx + i * 0.2, sy - i * 0.3, (Math.random() - .5) * 4, 20 + i); });
    Sound.play('shuffle'); prompt(`${dealer === 0 ? 'You deal' : players[dealer].person.name + ' deals'}…`);
    await sleep(T('move') * 1.6);
    // deal 3-2 / 2-3, starting left of the dealer
    let k = 0;
    for (const round of [[3, 2, 3, 2], [2, 3, 2, 3]]) for (let j = 0; j < 4; j++) {
      const p = players[(dealer + 1 + j) % 4];
      for (let n = 0; n < round[j]; n++) { const c = deck[k++]; p.hand.push(c); if (p.human) flip(c, true); }
      if (p.human) sortHand(p); layoutHand(p); Sound.play('deal'); await sleep(T('deal') * 1.6);
    }
    kitty = deck.slice(20); up = kitty[0];
    kitty.forEach((c, i) => place(c, Wd / 2 - cw * 0.12 + i * 1.5, cy() - i * 1.5, -6, 40 + i));
    await sleep(T('move'));
    flip(up, true); place(up, Wd / 2 + cw * 0.18, cy() + 4, 4, 60); Sound.play('flip');
    deck.forEach(c => c.el.classList.remove('fast'));
    showTrump(); prompt('');
    await sleep(T('move'));
    if (!(await bidding())) { banner('Misdeal!<small>Everybody passed. Next dealer.</small>', true); await sleep(T('banner')); return; }
    await playTricks();
  }

  async function bidding() {
    // round one: order up the turned card
    for (let j = 1; j <= 4; j++) {
      const i = (dealer + j) % 4, p = players[i]; setTurn(i);
      let r;
      if (p.human && !AUTO) {
        const dealing = i === dealer;
        r = await ask(`${dealing ? 'Pick up' : 'Order up'} the <b>${label(up)}</b>? <small>${SN[up.s]} would be trump${dealing ? '' : ` and ${players[dealer].human ? 'you' : players[dealer].person.name} picks it up`}.</small>`,
          [{ html: dealing ? 'Pick it up' : 'Order it up', v: true }, { html: 'Pass', v: false, cls: 'pass' }], true);
        r = { call: r.v, alone: r.v && r.alone };
      } else { await sleep(T('bid')); r = aiBid1(p); }
      if (r.call) {
        if (!p.human) say(p, r.alone ? 'alone' : 'order'); else Sound.play('tick');
        await makeTrump(i, up.s, r.alone, true);
        return true;
      }
      if (!p.human) say(p, 'pass', 0.8); Sound.play('pass');
    }
    // turn it down
    flip(up, false); place(up, up.x - cw * 0.3, up.y - 4, -6, 44); Sound.play('flip'); showTrump();
    $('#tSub').textContent = `${SN[up.s]} turned down`;
    await sleep(T('move'));
    // round two: name a suit
    for (let j = 1; j <= 4; j++) {
      const i = (dealer + j) % 4, p = players[i], stuck = i === dealer && +save.settings.stick === 1; setTurn(i);
      let r;
      if (p.human && !AUTO) {
        const suits = ['S', 'H', 'D', 'C'].filter(s => s !== up.s);
        const b = suits.map(s => ({ html: `${SC[s]}<span class="s">${SN[s]}</span>`, v: s, cls: 'suit' + (isRed(s) ? ' red' : '') }));
        if (!stuck) b.push({ html: 'Pass', v: null, cls: 'pass' });
        r = await ask(stuck ? 'Stuck! <small>The dealer has to name trump.</small>' : `Name trump <small>(anything but ${SN[up.s]})</small>`, b, true);
        r = { suit: r.v, alone: !!r.v && r.alone };
      } else { await sleep(T('bid')); r = aiBid2(p, stuck); }
      if (r.suit) { if (!p.human) say(p, r.alone ? 'alone' : 'call', 1, r.suit); await makeTrump(i, r.suit, r.alone, false); return true; }
      if (!p.human) say(p, 'pass', 0.8); Sound.play('pass');
    }
    return false;
  }

  async function makeTrump(i, s, lone, pickup) {
    trump = s; maker = i; alone = !!lone; setTurn(-1);
    const who = i === 0 ? 'You' : players[i].person.name;
    Sound.play(alone ? 'alone' : 'trump');
    banner(`${SC[s]} ${SN[s]}!<small>${who} ${pickup ? (i === dealer ? 'picked it up' : 'ordered it up') : 'called it'}${alone ? ' — going alone!' : ''}</small>`, team(i) === 0);
    if (alone) { players[partnerOf(i)].sitOut = true; save.stats.loners += i === 0 ? 1 : 0; }
    seatInfo(); showTrump();
    await sleep(T('banner') * 0.8);
    const dp = players[dealer];
    if (pickup && !dp.sitOut) {
      // the dealer picks up the turned card and throws one away
      dp.hand.push(up); if (dp.human) { flip(up, true); sortHand(dp); } else flip(up, false);
      layoutHand(dp); Sound.play('slide'); await sleep(T('move'));
      let out;
      if (dp.human && !AUTO) out = await chooseCard(dp.hand, dp.hand, 'Pick a card to discard');
      else { await sleep(T('think')); out = worstFor(dp.hand, trump); }
      dp.hand = dp.hand.filter(c => c !== out); flip(out, false); place(out, Wd / 2 - cw * 0.1, cy() - 6, -8, 45);
      Sound.play('slide'); layoutHand(dp); await sleep(T('move'));
    } else if (pickup) { flip(up, false); }
    // tidy the kitty off to the dealer's side
    const a = anchor(dp.seat), kx = Wd / 2 + (a.x - Wd / 2) * 0.42 + (dp.seat === 'N' || dp.seat === 'S' ? cw * 1.6 : 0), ky = cy() + (a.y - cy()) * 0.42;
    DECK.filter(c => !players.some(p => p.hand.includes(c))).forEach((c, n) => { flip(c, false); place(c, kx + n, ky - n, 12, 30 + n, 0.62); });
    for (const p of players) { if (p.sitOut) { p.hand.forEach(c => c.el.classList.add('out')); } sortHand(p); layoutHand(p); }
    await sleep(T('move'));
  }

  /* ---------------- tricks ---------------- */
  async function playTricks() {
    let leader = (dealer + 1) % 4; if (players[leader].sitOut) leader = (leader + 1) % 4;
    for (let t = 0; t < 5; t++) {
      trick = []; led = null;
      for (let j = 0; j < 4; j++) {
        const i = (leader + j) % 4, p = players[i]; if (p.sitOut) continue;
        setTurn(i);
        let c;
        if (p.human && !AUTO) c = await chooseCard(legal(p), p.hand, trick.length ? (legal(p).length < p.hand.length ? `Follow suit: ${SN[led]}` : `Your play — can't follow ${SN[led]}`) : 'Your lead');
        else { await sleep(T('think') * (0.7 + Math.random() * 0.5)); c = aiPlay(p); }
        if (!legal(p).includes(c)) console.error('ILLEGAL PLAY', p.i, c.id);
        p.hand = p.hand.filter(x => x !== c); trick.push({ p: i, card: c }); played.add(c.id);
        if (!led) led = eff(c);
        const s = playSpot(p.seat); flip(c, true); place(c, s.x, s.y, s.r + (Math.random() - .5) * 8, 300 + trick.length);
        Sound.play('play'); layoutHand(p);
        await sleep(T('play'));
      }
      setTurn(-1);
      const w = winning(); leader = w.p; tricks[team(w.p)]++;
      w.card.el.classList.add('win'); Sound.play('trick'); burst(w.card.x, w.card.y, 'spark', 12);
      if (!players[w.p].human && Math.random() < 0.3) say(players[w.p], 'trick');
      if (w.p === 2 && Math.random() < 0.25) say(players[2], 'trick');
      await sleep(T('trick'));
      // sweep the trick to the winner
      const a = anchor(players[w.p].seat), tx = Wd / 2 + (a.x - Wd / 2) * 0.62, ty = cy() + (a.y - cy()) * 0.62;
      trick.forEach(({ card }, n) => { card.el.classList.remove('win'); flip(card, false); place(card, tx + (tricks[team(w.p)] - 1) * 6 + n, ty - n, (players[w.p].seat === 'W' || players[w.p].seat === 'E') ? 90 : 0, 20 + n, 0.55); });
      Sound.play('sweep'); showScore();
      await sleep(T('move'));
    }
    await scoreHand();
  }

  async function scoreHand() {
    const mt = team(maker), made = tricks[mt];
    let pts, who, msg, big = false;
    if (made >= 3) {
      pts = made === 5 ? (alone ? 4 : 2) : 1; who = mt;
      if (made === 5) { msg = alone ? 'Lone March!' : 'March!'; big = true; Sound.play('march'); if (mt === 0) save.stats.marches++; }
      else { msg = `${mt === 0 ? 'We' : 'They'} made it`; Sound.play('point'); }
    } else {
      pts = 2; who = 1 - mt; msg = 'Euchred!'; big = true; Sound.play('euchred');
      if (who === 0) save.stats.euchres++; else save.stats.euchred++;
      const def = players.filter(p => team(p.i) === who && !p.human), mk = players.filter(p => team(p.i) === mt && !p.human);
      if (def.length) say(pick(def), 'euchre'); if (mk.length) setTimeout(() => say(pick(mk), 'euchred'), 700);
    }
    score[who] += pts; if (who === 0) save.stats.hands++;
    handLog.push({ dealer, trump, maker, alone, tricks: tricks.slice(), pts, who });
    banner(`${msg}<small>${who === 0 ? 'Us' : 'Them'} +${pts} point${pts > 1 ? 's' : ''}</small>`, who === 0, T('banner') * 1.4);
    if (who === 0) burst(Wd / 2, cy(), 'pop', big ? 60 : 24);
    showScore(); persist();
    await sleep(T('banner') * 1.5);
  }

  async function endGame() {
    finished = true; setTurn(-1); prompt('');
    const won = score[0] > score[1], st = save.stats;
    st.played++; if (won) { st.won++; st.streak++; st.best = Math.max(st.best, st.streak); } else { st.lost++; st.streak = 0; }
    persist(true); showStats();
    if (won) { Sound.play('win'); burst(0, 0, 'confetti', 160); burst(Wd / 2, Ht * 0.8, 'pop', 80); say(players[2], 'win'); }
    else { Sound.play('lose'); say(players[1], 'win'); say(players[2], 'lose'); }
    await sleep(1400 * (TEST ? 0.1 : 1));
    $('#rKick').textContent = won ? 'Winner winner, hotdish dinner' : 'Better luck next time';
    $('#rTitle').textContent = won ? 'You Won!' : 'They Got Ya!';
    $('#rSub').textContent = won ? 'You and Barb take the game.' : 'Dale and June take this one.';
    $('#rFinal').innerHTML = `<div class="us">Us<b>${score[0]}</b></div><div class="them">Them<b>${score[1]}</b></div>`;
    $('#rRecord').textContent = recordText();
    $('#result').classList.remove('hidden');
  }

  /* ---------------- menus ---------------- */
  function recordText() {
    const s = save.stats; if (!s.played) return 'No games played yet.';
    return `Games: ${s.played} · Won: ${s.won} · Lost: ${s.lost} · Euchres: ${s.euchres} · Marches: ${s.marches} · Best streak: ${s.best}`;
  }
  function showStats() { $('#sPlayed').textContent = save.stats.played; $('#sWon').textContent = save.stats.won; $('#sEuchres').textContent = save.stats.euchres; $('#record').textContent = recordText(); }
  function syncToggles() {
    $('#bMusic').classList.toggle('off', !save.settings.music); $('#bSfx').classList.toggle('off', !save.settings.sfx); $('#vol').value = save.settings.vol;
    document.querySelectorAll('#optTarget button').forEach(b => b.classList.toggle('on', +b.dataset.v === +save.settings.target));
    document.querySelectorAll('#optStick button').forEach(b => b.classList.toggle('on', +b.dataset.v === +save.settings.stick));
    document.querySelectorAll('#optSpeed button').forEach(b => b.classList.toggle('on', b.dataset.v === save.settings.speed));
  }
  function startAudio() { Sound.unlock(); Sound.setVolume(save.settings.vol / 100); Sound.setSfx(save.settings.sfx); if (save.settings.music) Sound.startMusic(); }
  for (const [id, key, num] of [['#optTarget', 'target', true], ['#optStick', 'stick', true], ['#optSpeed', 'speed', false]])
    document.querySelectorAll(id + ' button').forEach(b => b.onclick = () => { save.settings[key] = num ? +b.dataset.v : b.dataset.v; syncToggles(); persist(); Sound.play('tick'); });
  const go = () => { $('#title').classList.add('hidden'); startAudio(); newGame(); };
  $('#bStart').onclick = go; $('#bNew').onclick = go; $('#bAgain').onclick = () => { Sound.play('tick'); newGame(); };
  $('#bToMenu').onclick = $('#bMenu').onclick = () => { $('#result').classList.add('hidden'); $('#title').classList.remove('hidden'); syncToggles(); showStats(); };
  $('#bRules').onclick = $('#bHow').onclick = () => $('#rules').classList.remove('hidden');
  $('#bCredits').onclick = () => { $('#credits').classList.remove('hidden'); loadChangelog(); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.veil').classList.add('hidden'));
  $('#bMusic').onclick = () => { save.settings.music = !save.settings.music; Sound.setMusic(save.settings.music); syncToggles(); persist(); };
  $('#bSfx').onclick = () => { save.settings.sfx = !save.settings.sfx; Sound.setSfx(save.settings.sfx); syncToggles(); persist(); Sound.play('tick'); };
  $('#vol').oninput = e => { save.settings.vol = +e.target.value; Sound.setVolume(save.settings.vol / 100); persist(); };
  document.addEventListener('keydown', e => {
    if (e.key === 'F2') { e.preventDefault(); go(); }
    else if (e.key === 'm' || e.key === 'M') $('#bMusic').click();
    else if (e.key === 'Escape') document.querySelectorAll('#rules,#credits').forEach(v => v.classList.add('hidden'));
  });
  document.addEventListener('contextmenu', e => e.preventDefault());
  setInterval(() => { $('#now').textContent = save.settings.music && started ? `♫  ${Sound.tuneName()}` : ''; }, 1000);
  async function loadChangelog() {
    let md = ''; try { md = await (await fetch('CHANGELOG.md', { cache: 'no-store' })).text(); } catch (e) { }
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    let html = '', inList = false;
    for (const line of md.split(/\r?\n/)) {
      let m;
      if ((m = line.match(/^## (.*)/))) { if (inList) { html += '</ul>'; inList = false; } html += `<h4>${esc(m[1].replace(/[\[\]]/g, ''))}</h4>`; }
      else if ((m = line.match(/^### (.*)/))) { if (inList) { html += '</ul>'; inList = false; } html += `<h5>${esc(m[1])}</h5>`; }
      else if ((m = line.match(/^- (.*)/))) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${esc(m[1])}</li>`; }
    }
    $('#changelog').innerHTML = html + (inList ? '</ul>' : '') || '<p class="muted">No changes recorded.</p>';
  }
  $('#tuneList').textContent = Sound.tunes.map(t => `“${t}”`).join(', ');
  $('#ver').textContent = 'v' + VERSION; document.title = `Euchre ${VERSION}`;
  // title card: a fan of bowers, and the folks you're playing with
  (() => {
    const f = $('#titleFan'), show = ['D11', 'H11', 'S14', 'C13', 'H12'];
    show.forEach((id, i) => { const cv = Art.face(DECK.find(c => c.id === id)); cv.style.transform = `translateX(-50%) rotate(${(i - 2) * 13}deg)`; cv.style.zIndex = i === 1 ? 9 : i; if (i === 1) cv.style.bottom = '12px'; f.appendChild(cv); });
    const folks = $('#folks');
    folks.innerHTML = '';
    const add = (who, txt) => { const d = document.createElement('div'); d.className = 'f'; d.appendChild(Art.cameo(who, 116)); d.insertAdjacentHTML('beforeend', `<span>${txt}</span>`); folks.appendChild(d); };
    add('barb', 'Partner: Aunt Barb'); folks.insertAdjacentHTML('beforeend', '<div class="vs">vs</div>'); add('dale', 'Uncle Dale'); add('june', 'Grandma June');
  })();

  window.addEventListener('resize', () => { measure(); for (const p of players) layoutHand(p); layoutSeats(); });
  setInterval(() => fetch('api/ping').catch(() => { }), 15000); fetch('api/ping').catch(() => { });
  measure(); syncToggles(); showStats(); showScore(); showTrump();

  // hooks for the automated checks
  window.__eu = { get players() { return players; }, get finished() { return finished; }, get waiting() { return clickWait ? 'card' : (!$('#bid').classList.contains('hidden') ? 'bid' : null); },
    get score() { return score; }, handLog, get stats() { return save.stats; }, get trump() { return trump; }, legalFor: () => legal(players[0]) };
})();
