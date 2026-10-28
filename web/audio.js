'use strict';
/* =====================================================================
   EUCHRE - music and sound effects, synthesized live (all original).
   Tunes: "Friday Night Polka" (accordion & tuba), "County Fair Two-Step"
          (banjo & guitar), "Lake Effect Waltz" (accordion).
   ===================================================================== */
const Sound = (() => {
  let ctx = null, master, music, sfx, verb, musicOn = true, sfxOn = true, volume = 0.6;
  let noiseBuf = null, playing = false, tuneIdx = 0, timer = null;
  const ksCache = new Map();

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
      verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.1, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.5); }
      verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.16; verb.connect(wet); wet.connect(master);
      music = ctx.createGain(); music.gain.value = musicOn ? 0.5 : 0; music.connect(master); music.connect(verb);
      sfx = ctx.createGain(); sfx.gain.value = sfxOn ? 0.9 : 0; sfx.connect(master); sfx.connect(verb);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------- instruments ---------- */
  function accordion(t, m, dur, vel = 0.5, out = music) {
    const f = hz(m), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(5200, f * 6); lp.Q.value = 0.7;
    const end = t + Math.max(0.08, dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.13, t + 0.025); g.gain.setValueAtTime(vel * 0.12, end - 0.05); g.gain.linearRampToValueAtTime(0, end + 0.06);
    const trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 6.2; tg.gain.value = vel * 0.025; trem.connect(tg); tg.connect(g.gain);
    lp.connect(g); g.connect(out);
    for (const [type, det, amp] of [['sawtooth', -7, 0.6], ['sawtooth', 8, 0.6], ['square', 0, 0.35]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = det; og.gain.value = amp;
      o.connect(og); og.connect(lp); o.start(t); o.stop(end + 0.1);
    }
    trem.start(t); trem.stop(end + 0.1);
  }
  function tuba(t, m, dur, vel = 0.5, out = music) {
    const f = hz(m), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 2, t); lp.frequency.linearRampToValueAtTime(f * 5, t + 0.05); lp.frequency.linearRampToValueAtTime(f * 3, t + dur);
    const end = t + Math.max(0.12, dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.42, t + 0.03); g.gain.exponentialRampToValueAtTime(vel * 0.2, end); g.gain.linearRampToValueAtTime(0, end + 0.05);
    lp.connect(g); g.connect(out);
    for (const [type, mult, amp] of [['sawtooth', 1, 0.45], ['triangle', 1, 0.8], ['sine', 0.5, 0.25]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mult; og.gain.value = amp; o.connect(og); og.connect(lp); o.start(t); o.stop(end + 0.1);
    }
  }
  // Karplus-Strong plucked string (banjo / guitar)
  function ksBuffer(m, bright) {
    const key = m + ':' + bright; if (ksCache.has(key)) return ksCache.get(key);
    const sr = ctx.sampleRate, f = hz(m), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * (bright ? 1.1 : 1.6));
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    const decay = bright ? 0.992 : 0.996; let idx = 0;
    for (let i = 0; i < len; i++) { const a = ring[idx], b = ring[(idx + 1) % N]; d[i] = a; ring[idx] = decay * 0.5 * (a + b); idx = (idx + 1) % N; }
    ksCache.set(key, buf); return buf;
  }
  function pluck(t, m, vel = 0.5, bright = true, out = music) {
    const src = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
    src.buffer = ksBuffer(m, bright); hp.type = bright ? 'peaking' : 'lowpass'; hp.frequency.value = bright ? 2800 : 2400; if (bright) hp.gain.value = 6;
    g.gain.value = vel * (bright ? 0.5 : 0.32); src.connect(hp); hp.connect(g); g.connect(out); src.start(t);
  }
  function noise(t, dur, freq, q, vel, out = sfx, type = 'bandpass') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(out); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  /* ---------- tunes ---------- */
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = n => { const m = n.match(/^([A-G])([#b]?)(-?\d)$/); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
  const parse = str => str.trim().split(/\s+/).filter(x => x !== '|').map(t => { const [n, d] = t.split(':'); return [n === 'r' ? null : midi(n), +d]; });
  function chord(name) {
    const m = name.match(/^([A-G])([#b]?)(m?)(7?)$/); const pc = (NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    const iv = m[3] ? [0, 3, 7] : [0, 4, 7]; if (m[4]) iv.push(10);
    return { bass: 36 + ((pc - 36) % 12 + 12) % 12, fifth: 36 + ((pc + 7 - 36) % 12 + 12) % 12, tones: iv.map(i => 55 + ((pc + i - 55) % 12 + 12) % 12).sort((a, b) => a - b) };
  }
  const TUNES = [
    { name: 'Friday Night Polka', bpm: 122, beats: 2, style: 'polka',
      chords: 'F F C7 C7 C7 C7 F F F F Bb Bb F C7 F F',
      mel: `A4:.5 C5:.5 F5:.5 A5:.5 | G5:.5 F5:.5 C5:1 | E5:.5 G5:.5 Bb5:.5 G5:.5 | E5:.5 C5:.5 G4:1 |
            G4:.5 Bb4:.5 E5:.5 G5:.5 | F5:.5 E5:.5 D5:.5 C5:.5 | A4:.5 C5:.5 F5:.5 E5:.5 | F5:1.5 r:.5 |
            C5:.5 C5:.25 D5:.25 C5:.5 A4:.5 | F5:.5 E5:.5 F5:1 | D5:.5 F5:.5 Bb5:.5 F5:.5 | D5:.5 Bb4:.5 D5:1 |
            C5:.5 F5:.5 A5:.5 F5:.5 | G5:.5 E5:.5 C5:.5 Bb4:.5 | A4:.5 C5:.5 F5:.5 A5:.5 | F5:1 r:1` },
    { name: 'County Fair Two-Step', bpm: 104, beats: 2, style: 'twostep',
      chords: 'G G C G G G D D G G C C G D G G',
      mel: `G4:.5 B4:.5 D5:.5 B4:.5 | G5:.5 F#5:.5 G5:1 | E5:.5 G5:.5 E5:.5 C5:.5 | D5:.5 B4:.5 G4:1 |
            B4:.5 D5:.5 G5:.5 D5:.5 | B4:.5 A4:.5 G4:.5 B4:.5 | A4:.5 D5:.5 F#5:.5 D5:.5 | A5:1 r:1 |
            G5:.5 F#5:.5 E5:.5 D5:.5 | B4:.5 D5:.5 G4:1 | C5:.5 E5:.5 G5:.5 E5:.5 | C6:1 G5:1 |
            B4:.5 D5:.5 G5:.5 B5:.5 | A5:.5 F#5:.5 D5:.5 C5:.5 | B4:.5 G4:.5 D5:.5 B4:.5 | G4:1.5 r:.5` },
    { name: 'Lake Effect Waltz', bpm: 112, beats: 3, style: 'waltz',
      chords: 'C C G7 G7 G7 G7 C C C C F F C G7 C C',
      mel: `E5:2 G5:1 | C6:2 B5:1 | A5:1 G5:1 F5:1 | D5:3 | D5:2 F5:1 | B5:2 A5:1 | G5:1 E5:1 C5:1 | G5:3 |
            E5:2 G5:1 | C6:2 E6:1 | D6:1 C6:1 A5:1 | F5:3 | E5:1 G5:1 C6:1 | B5:2 D6:1 | C6:1 G5:1 E5:1 | C5:3` }
  ];

  function buildQueue(tune) {
    const spb = 60 / tune.bpm, ev = [], chords = tune.chords.split(' ');
    let t = 0;
    const lead = tune.style === 'twostep' ? 'banjo' : 'acc';
    for (const [m, d] of parse(tune.mel)) { if (m !== null) ev.push({ t, m: m - (tune.style === 'waltz' ? 12 : 0), d: d * spb * 0.92, v: 0.7, i: lead }); t += d * spb; }
    const bar = tune.beats * spb;
    chords.forEach((cn, n) => {
      const c = chord(cn), b0 = n * bar;
      if (tune.style === 'polka') {
        for (let k = 0; k < 2; k++) { ev.push({ t: b0 + k * spb, m: k ? c.fifth : c.bass, d: spb * 0.4, v: 0.55, i: 'tuba' }); for (const x of c.tones) ev.push({ t: b0 + k * spb + spb / 2, m: x, d: spb * 0.3, v: 0.32, i: 'acc' }); }
      } else if (tune.style === 'twostep') {
        for (let k = 0; k < 2; k++) { ev.push({ t: b0 + k * spb, m: (k ? c.fifth : c.bass) + 12, d: spb * 0.5, v: 0.7, i: 'bass' }); c.tones.forEach((x, j) => ev.push({ t: b0 + k * spb + spb / 2 + j * 0.012, m: x, d: spb, v: 0.42, i: 'gtr' })); }
      } else {
        ev.push({ t: b0, m: c.bass, d: spb * 0.8, v: 0.4, i: 'tuba' }); for (const k of [1, 2]) for (const x of c.tones) ev.push({ t: b0 + k * spb, m: x, d: spb * 0.6, v: 0.22, i: 'acc' });
      }
    });
    ev.sort((a, b) => a.t - b.t);
    return { ev, len: chords.length * bar };
  }
  let cur = null, startAt = 0, qi = 0;
  function schedule() {
    if (!playing || !ctx) return;
    const ahead = ctx.currentTime + 0.3;
    while (cur && qi < cur.ev.length && startAt + cur.ev[qi].t < ahead) {
      const e = cur.ev[qi++], t = Math.max(ctx.currentTime, startAt + e.t);
      if (e.i === 'acc') accordion(t, e.m, e.d, e.v);
      else if (e.i === 'tuba') tuba(t, e.m, e.d, e.v);
      else if (e.i === 'banjo') pluck(t, e.m, e.v, true);
      else if (e.i === 'gtr') pluck(t, e.m - 12, e.v, false);
      else if (e.i === 'bass') pluck(t, e.m - 12, e.v, false);
    }
    if (cur && qi >= cur.ev.length && ctx.currentTime > startAt + cur.len - 0.2) { tuneIdx = (tuneIdx + 1) % TUNES.length; startTune(startAt + cur.len + 1.4); }
  }
  function startTune(at) { cur = buildQueue(TUNES[tuneIdx]); qi = 0; startAt = at; }

  /* ---------- sound effects ---------- */
  const fx = {
    slide() { const t = ctx.currentTime; noise(t, 0.14, 2600, 0.7, 0.3); noise(t + 0.02, 0.07, 5200, 1.2, 0.1); },
    play() { const t = ctx.currentTime; noise(t, 0.05, 1800, 1.4, 0.55); noise(t, 0.12, 300, 1, 0.35, sfx, 'lowpass'); },  // card snapped onto the table
    flip() { const t = ctx.currentTime; noise(t, 0.05, 3800, 1.5, 0.3, sfx, 'highpass'); },
    shuffle() { const t = ctx.currentTime; for (let i = 0; i < 16; i++) noise(t + i * 0.042 + Math.random() * 0.01, 0.06, 2200 + Math.random() * 1600, 1, 0.14); noise(t + 0.75, 0.12, 900, 1, 0.3); },
    deal() { noise(ctx.currentTime, 0.09, 3000, 0.9, 0.2); },
    sweep() { const t = ctx.currentTime; noise(t, 0.28, 1400, 0.5, 0.22); noise(t + 0.05, 0.22, 2400, 0.6, 0.12); },
    pass() { noise(ctx.currentTime, 0.04, 1200, 4, 0.25); noise(ctx.currentTime + 0.09, 0.04, 1200, 4, 0.2); },   // knock-knock on the table
    tick() { noise(ctx.currentTime, 0.03, 4200, 2, 0.15, sfx, 'highpass'); },
    hover() { noise(ctx.currentTime, 0.04, 3200, 3, 0.05); },
    trump() { const t = ctx.currentTime; for (const m of [65, 69, 72]) accordion(t, m, 0.5, 0.6, sfx); tuba(t, 41, 0.5, 0.6, sfx); },
    alone() { const t = ctx.currentTime; [60, 64, 67, 72].forEach((m, i) => accordion(t + i * 0.09, m, 0.7 - i * 0.09, 0.6, sfx)); tuba(t, 36, 0.8, 0.7, sfx); },
    trick() { const t = ctx.currentTime; pluck(t, 76, 0.5, true, sfx); pluck(t + 0.07, 79, 0.45, true, sfx); },
    point() { const t = ctx.currentTime; [72, 76, 79, 84].forEach((m, i) => pluck(t + i * 0.07, m, 0.5, true, sfx)); },
    euchred() {   // the tuba says "wah wah"
      const t = ctx.currentTime;
      [[46, 0, 0.3], [45, 0.34, 0.3], [44, 0.68, 0.3], [43, 1.02, 0.9]].forEach(([m, dt, d]) => tuba(t + dt, m, d, 0.8, sfx));
    },
    march() { const t = ctx.currentTime; [65, 69, 72, 77].forEach((m, i) => accordion(t + i * 0.1, m, 0.4, 0.65, sfx)); for (const m of [65, 69, 72, 77]) accordion(t + 0.45, m, 0.8, 0.5, sfx); tuba(t + 0.45, 41, 0.8, 0.7, sfx); },
    win() {
      const t = ctx.currentTime, mel = [72, 72, 74, 76, 77, 79, 84];
      mel.forEach((m, i) => { accordion(t + i * 0.12, m, 0.18, 0.7, sfx); tuba(t + i * 0.12, i % 2 ? 43 : 36, 0.12, 0.6, sfx); });
      for (const m of [72, 76, 79, 84]) accordion(t + 0.9, m, 1.2, 0.5, sfx); tuba(t + 0.9, 36, 1.2, 0.7, sfx);
    },
    lose() { const t = ctx.currentTime; [[55, 0], [54, 0.4], [53, 0.8], [52, 1.2]].forEach(([m, dt], i) => accordion(t + dt, m, i === 3 ? 1.1 : 0.34, 0.6, sfx)); tuba(t + 1.2, 28, 1.1, 0.7, sfx); }
  };

  return {
    unlock() { ensure(); },
    play(name) { if (!sfxOn || !ensure()) return; try { fx[name] && fx[name](); } catch (e) { } },
    startMusic() { if (!ensure() || playing) return; playing = true; startTune(ctx.currentTime + 0.3); clearInterval(timer); timer = setInterval(schedule, 60); },
    setMusic(on) { musicOn = on; if (!ctx) { if (on) this.startMusic(); return; } music.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.15); if (on) this.startMusic(); },
    setSfx(on) { sfxOn = on; if (ctx) sfx.gain.value = on ? 0.9 : 0; },
    setVolume(v) { volume = v; if (ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    tuneName() { return TUNES[tuneIdx].name; },
    tunes: TUNES.map(t => t.name)
  };
})();
