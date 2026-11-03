'use strict';
/* =====================================================================
   EUCHRE - A Midwest Kitchen-Table Game
   All card art is drawn here in code (original artwork, (c) Ironite).
   ===================================================================== */
const Art = (() => {
  const CW = 360, CH = 504;              // card canvas size (HD; CSS scales it down)
  const INK = '#2b1d14';
  const RED = '#8f1d22', BLACK = '#1e1712', GOLD = '#b8913f', GOLD2 = '#e2c27a';
  const IVORY1 = '#fbf6e8', IVORY2 = '#efe2c2';
  const SERIF = '"Bitter", Georgia, "Times New Roman", serif';
  const SC = '"Alfa Slab One", "Bitter", Georgia, serif';
  const TAU = Math.PI * 2;

  // Suit palettes for the court figures.
  const PAL = {   // barn red, pumpkin, denim, field green
    H: { coat: '#a3302a', dark: '#6e1a16', accent: '#e8c35a', ink: RED },
    D: { coat: '#c4752a', dark: '#7e4514', accent: '#f0d36a', ink: RED },
    S: { coat: '#355a8a', dark: '#1f3656', accent: '#e8c35a', ink: BLACK },
    C: { coat: '#44703c', dark: '#284422', accent: '#e8c35a', ink: BLACK }
  };

  /* ---------- small helpers ---------- */
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------- suit shapes (drawn, so they look the same on every PC) ---------- */
  function heartPath(c, x, y, s) {
    c.moveTo(x, y + s * 0.45);
    c.bezierCurveTo(x - s * 0.62, y + s * 0.02, x - s * 0.52, y - s * 0.55, x, y - s * 0.2);
    c.bezierCurveTo(x + s * 0.52, y - s * 0.55, x + s * 0.62, y + s * 0.02, x, y + s * 0.45);
  }
  function suit(c, s, x, y, size, color) {
    c.save(); c.fillStyle = color; c.beginPath();
    if (s === 'H') heartPath(c, x, y, size);
    else if (s === 'D') { c.moveTo(x, y - size * 0.5); c.quadraticCurveTo(x + size * 0.18, y - size * 0.18, x + size * 0.4, y); c.quadraticCurveTo(x + size * 0.18, y + size * 0.18, x, y + size * 0.5); c.quadraticCurveTo(x - size * 0.18, y + size * 0.18, x - size * 0.4, y); c.quadraticCurveTo(x - size * 0.18, y - size * 0.18, x, y - size * 0.5); }
    else if (s === 'S') {
      c.save(); c.translate(x, y - size * 0.08); c.rotate(Math.PI); heartPath(c, 0, 0, size * 0.9); c.restore();
      c.moveTo(x, y + size * 0.05); c.quadraticCurveTo(x - size * 0.05, y + size * 0.38, x - size * 0.24, y + size * 0.5); c.lineTo(x + size * 0.24, y + size * 0.5); c.quadraticCurveTo(x + size * 0.05, y + size * 0.38, x, y + size * 0.05);
    } else {
      const r = size * 0.205;
      c.arc(x, y - size * 0.24, r, 0, TAU); c.moveTo(x - size * 0.22 + r, y + size * 0.06); c.arc(x - size * 0.22, y + size * 0.06, r, 0, TAU);
      c.moveTo(x + size * 0.22 + r, y + size * 0.06); c.arc(x + size * 0.22, y + size * 0.06, r, 0, TAU);
      c.moveTo(x + size * 0.12, y); c.arc(x, y, size * 0.12, 0, TAU);
      c.moveTo(x, y + size * 0.02); c.quadraticCurveTo(x - size * 0.04, y + size * 0.38, x - size * 0.22, y + size * 0.5); c.lineTo(x + size * 0.22, y + size * 0.5); c.quadraticCurveTo(x + size * 0.04, y + size * 0.38, x, y + size * 0.02);
    }
    c.fill(); c.restore();
  }

  /* ---------- paper ---------- */
  function paper(c, w, h, seed, r = 22) {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, IVORY1); g.addColorStop(1, IVORY2);
    rrect(c, 1, 1, w - 2, h - 2, r); c.fillStyle = g; c.fill();
    c.save(); c.clip();
    const R = rng(seed);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(120,90,40,${R() * 0.05})`; c.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
    const v = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(120,80,30,.16)');
    c.fillStyle = v; c.fillRect(0, 0, w, h); c.restore();
    rrect(c, 1, 1, w - 2, h - 2, r); c.strokeStyle = 'rgba(70,50,30,.45)'; c.lineWidth = 2; c.stroke();
  }
  function border(c, w, h, color) {
    c.save(); c.strokeStyle = color; c.globalAlpha = 0.85;
    c.lineWidth = 2.5; rrect(c, 14, 14, w - 28, h - 28, 14); c.stroke();
    c.lineWidth = 1; rrect(c, 20, 20, w - 40, h - 40, 10); c.stroke();
    // little corner flourishes
    for (const [x, y, sx, sy] of [[20, 20, 1, 1], [w - 20, 20, -1, 1], [20, h - 20, 1, -1], [w - 20, h - 20, -1, -1]]) {
      c.beginPath(); c.moveTo(x + sx * 4, y + sy * 34); c.quadraticCurveTo(x + sx * 4, y + sy * 4, x + sx * 34, y + sy * 4); c.stroke();
    }
    c.restore();
  }
  function index(c, rank, s, color, w, h) {
    const draw = () => {
      c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.font = `${rank === '10' ? 46 : 54}px ${SERIF}`;
      c.fillText(rank, 46, 76);
      suit(c, s, 46, 104, 34, color);
    };
    draw(); c.save(); c.translate(w, h); c.rotate(Math.PI); draw(); c.restore();
  }

  /* ---------- Victorian portrait (shared by court cards, opponents and the Old Maid) ----------
     Drawn around (0,0) = bottom centre of the bust. Head is ~60px wide at scale 1. */
  function bust(c, o) {
    const skin = o.skin || '#f2d4b6', hair = o.hair || '#5a3a22';
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 2.6;
    // back hair (buns, ringlets, long hair) ---------------------------------
    c.fillStyle = hair;
    if (o.hairStyle === 'updo' || o.hairStyle === 'ringlets' || o.hairStyle === 'bun') {
      c.beginPath(); c.arc(0, -150, 17, 0, TAU); c.fill(); c.stroke();
    }
    if (o.hairStyle === 'ringlets') {
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(sx * (27 + (i % 2) * 3), -118 + i * 11, 6.5, 0, TAU); c.fill(); c.stroke(); }
    }
    // shoulders / costume ---------------------------------------------------
    c.beginPath(); c.moveTo(-80, 0); c.bezierCurveTo(-78, -42, -54, -60, -22, -64); c.lineTo(22, -64); c.bezierCurveTo(54, -60, 78, -42, 80, 0); c.closePath();
    c.fillStyle = o.coat; c.fill(); c.stroke();
    if (o.plaid) {   // flannel
      c.save(); c.clip(); c.lineWidth = 5; c.strokeStyle = o.plaid; c.globalAlpha = 0.55;
      for (let x = -84; x < 90; x += 16) { c.beginPath(); c.moveTo(x, -70); c.lineTo(x, 4); c.stroke(); }
      for (let y = -66; y < 6; y += 16) { c.beginPath(); c.moveTo(-90, y); c.lineTo(90, y); c.stroke(); }
      c.lineWidth = 1.2; c.strokeStyle = '#f5ead0'; c.globalAlpha = 0.35;
      for (let x = -76; x < 90; x += 16) { c.beginPath(); c.moveTo(x, -70); c.lineTo(x, 4); c.stroke(); }
      c.restore(); c.strokeStyle = INK; c.lineWidth = 2.6;
    }
    if (o.sleeves) for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * 62, -36, 22, 28, sx * 0.3, 0, TAU); c.fillStyle = o.coat; c.fill(); c.stroke(); c.beginPath(); c.moveTo(sx * 50, -56); c.quadraticCurveTo(sx * 64, -40, sx * 52, -14); c.strokeStyle = 'rgba(0,0,0,.25)'; c.stroke(); c.strokeStyle = INK; }
    // neck
    c.fillStyle = skin; c.beginPath(); c.moveTo(-11, -88); c.lineTo(-12, -60); c.lineTo(12, -60); c.lineTo(11, -88); c.closePath(); c.fill();
    if (o.collar === 'overalls') {
      c.fillStyle = '#f2e6c8'; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 2, -62); c.lineTo(sx * 18, -66); c.lineTo(sx * 14, -50); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = o.denim || '#3c5a8a';
      c.beginPath(); c.moveTo(-28, 0); c.lineTo(-26, -44); c.lineTo(26, -44); c.lineTo(28, 0); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#e8c35a'; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(-21, -2); c.lineTo(-20, -39); c.lineTo(20, -39); c.lineTo(21, -2); c.stroke();
      c.beginPath(); rrect(c, -12, -32, 24, 16, 2); c.stroke(); c.setLineDash([]); c.strokeStyle = INK; c.lineWidth = 2.6;
      c.fillStyle = o.denim || '#3c5a8a'; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 26, -44); c.lineTo(sx * 18, -44); c.lineTo(sx * 30, -64); c.lineTo(sx * 40, -60); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = '#d9b44a'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * 21, -40, 4, 0, TAU); c.fill(); c.stroke(); }
    } else if (o.collar === 'flannel') {
      c.fillStyle = o.dark; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 2, -60); c.lineTo(sx * 20, -66); c.lineTo(sx * 16, -46); c.closePath(); c.fill(); c.stroke(); }
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -58); c.lineTo(0, 0); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.6;
      c.fillStyle = '#efe4c8'; for (const y of [-46, -32, -18]) { c.beginPath(); c.arc(4, y, 2.6, 0, TAU); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(-36, -40, 20, 16); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.strokeRect(-36, -40, 20, 16); c.strokeStyle = INK; c.lineWidth = 2.6;
    } else if (o.collar === 'cardigan') {
      c.fillStyle = o.blouse || '#f4ecdc'; c.beginPath(); c.moveTo(-20, -64); c.lineTo(0, -18); c.lineTo(20, -64); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = o.dark; c.lineWidth = 5; c.beginPath(); c.moveTo(-21, -64); c.lineTo(-1, -16); c.moveTo(21, -64); c.lineTo(1, -16); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.6;
      c.fillStyle = o.accent; for (const y of [-12, 2]) { c.beginPath(); c.arc(0, y, 3.2, 0, TAU); c.fill(); c.stroke(); }
      if (o.pearls) { c.fillStyle = '#fffaf0'; for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + i * 0.0875); c.beginPath(); c.arc(Math.cos(a) * 18, -64 + Math.sin(a) * 18, 2.8, 0, TAU); c.fill(); c.stroke(); } }
    } else if (o.collar === 'crew') {
      c.strokeStyle = o.dark; c.lineWidth = 6; c.beginPath(); c.ellipse(0, -62, 16, 6, 0, 0, Math.PI); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.6;
      if (o.logo) { c.fillStyle = '#f6efe0'; c.font = `bold 13px ${SC}`; c.textAlign = 'center'; c.fillText(o.logo, 0, -24); }
    } else if (o.collar === 'apron') {
      c.fillStyle = '#fbf7ee'; c.beginPath(); c.moveTo(-24, 0); c.lineTo(-22, -46); c.lineTo(22, -46); c.lineTo(24, 0); c.closePath(); c.fill(); c.stroke();
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(i * 6.4, -46, 3.3, Math.PI, 0); c.fill(); c.stroke(); }
      c.strokeStyle = '#d35a5a'; c.lineWidth = 1.4; for (let y = -38; y < 0; y += 8) { c.beginPath(); c.moveTo(-20, y); c.lineTo(20, y); c.stroke(); } c.strokeStyle = INK; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(-18, -46); c.lineTo(-12, -86); c.moveTo(18, -46); c.lineTo(12, -86); c.stroke();
      c.fillStyle = o.accent; c.beginPath(); c.moveTo(-14, -62); c.lineTo(14, -62); c.lineTo(8, -54); c.lineTo(-8, -54); c.closePath(); c.fill();
    } else if (o.collar === 'cravat') {
      c.fillStyle = '#f7f1e3'; c.beginPath(); c.moveTo(-20, -64); c.lineTo(0, -16); c.lineTo(20, -64); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = o.dark; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 22, -64); c.lineTo(sx * 4, -16); c.lineTo(sx * 36, -30); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = o.accent; c.beginPath(); c.moveTo(0, -56); c.lineTo(-14, -64); c.lineTo(-14, -48); c.closePath(); c.moveTo(0, -56); c.lineTo(14, -64); c.lineTo(14, -48); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.arc(0, -56, 4, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = o.accent; for (const y of [-34, -22]) { c.beginPath(); c.arc(0, y, 2.6, 0, TAU); c.fill(); }
    } else if (o.collar === 'lace') {
      c.fillStyle = '#fbf7ee';
      c.beginPath(); c.moveTo(-24, -60); c.lineTo(-17, -92); c.lineTo(17, -92); c.lineTo(24, -60); c.closePath(); c.fill(); c.stroke();
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(i * 7, -92, 3.6, Math.PI, 0); c.fill(); c.stroke(); }
      c.strokeStyle = 'rgba(80,60,40,.35)'; c.lineWidth = 1; for (let y = -86; y < -62; y += 6) { c.beginPath(); c.moveTo(-18, y); c.lineTo(18, y); c.stroke(); }
      c.strokeStyle = INK; c.lineWidth = 2.6;
      c.fillStyle = o.accent; c.beginPath(); c.ellipse(0, -56, 9, 11, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#f3e6d6'; c.beginPath(); c.ellipse(0, -56, 5, 7, 0, 0, TAU); c.fill();
      if (o.pearls) { c.fillStyle = '#fffaf0'; for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + i * 0.0875); c.beginPath(); c.arc(Math.cos(a) * 34, -64 + Math.sin(a) * 26, 3.2, 0, TAU); c.fill(); c.stroke(); } }
    } else if (o.collar === 'buttons') {
      c.fillStyle = o.dark; c.beginPath(); c.moveTo(-20, -64); c.lineTo(20, -64); c.lineTo(18, -54); c.lineTo(-18, -54); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = o.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(-18, -58); c.lineTo(18, -58); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.6;
      c.fillStyle = o.accent; for (const y of [-42, -28, -14]) for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * 11, y, 3.6, 0, TAU); c.fill(); c.stroke(); }
      c.strokeStyle = o.accent; c.lineWidth = 2; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 40, -54); c.lineTo(sx * 58, -50); c.stroke(); } c.strokeStyle = INK; c.lineWidth = 2.6;
    } else if (o.collar === 'military') {
      c.fillStyle = o.dark; c.beginPath(); c.moveTo(-18, -64); c.lineTo(18, -64); c.lineTo(16, -52); c.lineTo(-16, -52); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = o.accent; for (const sx of [-1, 1]) { c.beginPath(); rrect(c, sx * 58 - 16, -60, 32, 10, 4); c.fill(); c.stroke(); for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(sx * 58 - 14 + i * 9, -50); c.lineTo(sx * 58 - 14 + i * 9, -42); c.strokeStyle = o.accent; c.stroke(); } c.strokeStyle = INK; }
      c.fillStyle = o.accent; for (const y of [-40, -26, -12]) { c.beginPath(); c.arc(0, y, 3.4, 0, TAU); c.fill(); c.stroke(); }
      c.fillStyle = '#d9b44a'; c.beginPath(); c.arc(-34, -30, 7, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#b02a2a'; c.fillRect(-38, -44, 8, 8);
    } else if (o.collar === 'shawl') {
      c.fillStyle = o.shawl; c.beginPath(); c.moveTo(-82, -6); c.bezierCurveTo(-74, -50, -40, -66, -18, -66); c.lineTo(0, -20); c.lineTo(18, -66); c.bezierCurveTo(40, -66, 74, -50, 82, -6); c.lineTo(40, 0); c.lineTo(0, -10); c.lineTo(-40, 0); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(60,40,60,.4)'; c.lineWidth = 1.2; for (let i = 0; i < 14; i++) { const x = -78 + i * 12; c.beginPath(); c.moveTo(x, -4 + Math.abs(x) * 0.02); c.lineTo(x - 2, 6); c.stroke(); }
      c.strokeStyle = INK; c.lineWidth = 2.6;
      c.fillStyle = '#fbf7ee'; c.beginPath(); c.moveTo(-14, -62); c.lineTo(-12, -86); c.lineTo(12, -86); c.lineTo(14, -62); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = o.accent; c.beginPath(); c.ellipse(0, -60, 7, 8, 0, 0, TAU); c.fill(); c.stroke();
    }
    // head ---------------------------------------------------------------------
    const hy = -118;
    c.fillStyle = skin;
    c.beginPath(); c.ellipse(-27, hy + 2, 5, 8, 0, 0, TAU); c.ellipse(27, hy + 2, 5, 8, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, hy, 27, 33, 0, 0, TAU); c.fill(); c.stroke();
    // front hair
    c.fillStyle = hair;
    if (o.hairStyle === 'perm') {
      for (let i = 0; i < 15; i++) { const a = Math.PI * (0.92 + i * 0.083); c.beginPath(); c.arc(Math.cos(a) * 28, hy - 6 + Math.sin(a) * 30, 9.5, 0, TAU); c.fill(); c.stroke(); }
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(sx * 30, hy + 2 + i * 10, 8, 0, TAU); c.fill(); c.stroke(); }
      for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-18 + i * 9, hy - 26, 7.5, 0, TAU); c.fill(); }
    }
    if (o.hairStyle === 'short') { c.beginPath(); c.ellipse(0, hy - 14, 28, 22, 0, Math.PI, 0); c.quadraticCurveTo(14, hy - 22, -4, hy - 18); c.quadraticCurveTo(-18, hy - 14, -28, hy - 6); c.closePath(); c.fill(); c.stroke(); }
    else if (o.hairStyle === 'updo' || o.hairStyle === 'ringlets' || o.hairStyle === 'bun') {
      c.beginPath(); c.moveTo(-29, hy + 6); c.bezierCurveTo(-34, hy - 30, -14, hy - 40, 0, hy - 36); c.bezierCurveTo(14, hy - 40, 34, hy - 30, 29, hy + 6);
      c.bezierCurveTo(22, hy - 10, 14, hy - 24, 0, hy - 22); c.bezierCurveTo(-14, hy - 24, -22, hy - 10, -29, hy + 6); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-18, hy - 26); c.quadraticCurveTo(-6, hy - 34, 6, hy - 30); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.6;
    }
    // sideburns / beard
    if (o.muttonchops) { for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 26, hy - 10); c.quadraticCurveTo(sx * 30, hy + 18, sx * 14, hy + 24); c.quadraticCurveTo(sx * 18, hy + 6, sx * 22, hy - 8); c.closePath(); c.fill(); c.stroke(); } }
    if (o.beard) { c.beginPath(); c.moveTo(-24, hy + 8); c.quadraticCurveTo(-22, hy + 46, 0, hy + 50); c.quadraticCurveTo(22, hy + 46, 24, hy + 8); c.quadraticCurveTo(12, hy + 24, 0, hy + 22); c.quadraticCurveTo(-12, hy + 24, -24, hy + 8); c.fill(); c.stroke(); }
    // face
    c.fillStyle = 'rgba(214,110,100,.28)'; c.beginPath(); c.arc(-15, hy + 9, 6.5, 0, TAU); c.arc(15, hy + 9, 6.5, 0, TAU); c.fill();
    c.fillStyle = INK;
    c.beginPath(); c.ellipse(-10, hy - 3, 2.6, o.lady ? 3.4 : 3, 0, 0, TAU); c.ellipse(10, hy - 3, 2.6, o.lady ? 3.4 : 3, 0, 0, TAU); c.fill();
    c.lineWidth = 2; c.strokeStyle = o.brow || hair;
    c.beginPath(); c.moveTo(-15, hy - 11 + (o.stern ? 2 : 0)); c.lineTo(-5, hy - 12 - (o.stern ? 0 : 1)); c.moveTo(15, hy - 11 + (o.stern ? 2 : 0)); c.lineTo(5, hy - 12 - (o.stern ? 0 : 1)); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(1, hy); c.quadraticCurveTo(-3, hy + 9, 1, hy + 11); c.stroke();
    if (o.lady) { c.fillStyle = '#b4423f'; c.beginPath(); c.ellipse(0, hy + 20, o.stern ? 5 : 6, o.stern ? 1.8 : 2.8, 0, 0, TAU); c.fill(); }
    else if (!o.mustache) { c.beginPath(); c.moveTo(-6, hy + 19); c.quadraticCurveTo(0, hy + 22, 6, hy + 19); c.stroke(); }
    if (o.mustache) {
      c.fillStyle = o.mustacheColor || hair; c.strokeStyle = INK; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(0, hy + 13); c.bezierCurveTo(-8, hy + 10, -18, hy + 14, -26, hy + 8); c.bezierCurveTo(-22, hy + 20, -8, hy + 20, 0, hy + 17);
      c.bezierCurveTo(8, hy + 20, 22, hy + 20, 26, hy + 8); c.bezierCurveTo(18, hy + 14, 8, hy + 10, 0, hy + 13); c.fill(); c.stroke();
    }
    c.lineWidth = 2.6; c.strokeStyle = INK;
    if (o.monocle) { c.strokeStyle = GOLD; c.lineWidth = 2.2; c.beginPath(); c.arc(10, hy - 3, 8, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(17, hy + 1); c.quadraticCurveTo(30, hy + 30, 22, hy + 52); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.6; }
    if (o.spectacles) { c.strokeStyle = '#6d5a48'; c.lineWidth = 2; c.beginPath(); c.arc(-10, hy - 3, 7.5, 0, TAU); c.moveTo(-2.5, hy - 3); c.arc(10, hy - 3, 7.5, Math.PI, Math.PI * 3); c.moveTo(-2.5, hy - 4); c.lineTo(2.5, hy - 4); c.moveTo(-17.5, hy - 4); c.lineTo(-26, hy - 7); c.moveTo(17.5, hy - 4); c.lineTo(26, hy - 7); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.6; }
    // hats -------------------------------------------------------------------
    if (o.hat === 'straw') {
      c.fillStyle = '#dcb866'; c.beginPath(); c.ellipse(0, hy - 30, 52, 11, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-26, hy - 31); c.bezierCurveTo(-28, hy - 72, 28, hy - 72, 26, hy - 31); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(120,80,20,.45)'; c.lineWidth = 1; for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(i * 5.5, hy - 33); c.lineTo(i * 4, hy - 64); c.stroke(); }
      for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(0, hy - 30, 50 - i * 5, 10 - i, 0, 0.1, Math.PI - 0.1); c.stroke(); }
      c.strokeStyle = INK; c.lineWidth = 2.6; c.fillStyle = o.accent2 || '#a3302a'; c.fillRect(-26, hy - 42, 52, 8); c.strokeRect(-26, hy - 42, 52, 8);
    } else if (o.hat === 'seedcap') {
      c.fillStyle = o.capColor || '#a3302a'; c.beginPath(); c.moveTo(-29, hy - 22); c.bezierCurveTo(-31, hy - 64, 31, hy - 64, 29, hy - 22); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#f6efe0'; c.beginPath(); c.moveTo(-16, hy - 26); c.bezierCurveTo(-17, hy - 56, 17, hy - 56, 16, hy - 26); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = o.capColor || '#a3302a'; c.font = `11px ${SC}`; c.textAlign = 'center'; c.fillText(o.capText || 'FEED', 0, hy - 33);
      c.beginPath(); c.arc(0, hy - 58, 3, 0, TAU); c.fill();
      c.fillStyle = o.billColor || o.capColor || '#a3302a'; c.beginPath(); c.ellipse(0, hy - 22, 34, 8, 0, 0, Math.PI); c.lineTo(-34, hy - 22); c.closePath(); c.fill(); c.stroke();
    } else if (o.hat === 'top') {
      c.fillStyle = '#1d1712'; c.beginPath(); c.moveTo(-23, hy - 30); c.lineTo(-25, hy - 86); c.quadraticCurveTo(0, hy - 92, 25, hy - 86); c.lineTo(23, hy - 30); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = o.accent2 || o.coat; c.fillRect(-23, hy - 42, 46, 9); c.strokeRect(-23, hy - 42, 46, 9);
      c.fillStyle = '#1d1712'; c.beginPath(); c.ellipse(0, hy - 30, 40, 7, 0, 0, TAU); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.15)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-14, hy - 82); c.lineTo(-13, hy - 46); c.stroke();
    } else if (o.hat === 'feather') {
      c.save(); c.translate(10, hy - 36); c.rotate(0.22);
      c.fillStyle = o.hatColor || o.dark; c.beginPath(); c.ellipse(0, 4, 30, 7, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, -4, 17, 12, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = o.accent; c.fillRect(-17, -4, 34, 5);
      c.fillStyle = '#f6efe2'; c.beginPath(); c.moveTo(10, -6); c.bezierCurveTo(30, -36, 54, -34, 52, -16); c.bezierCurveTo(40, -24, 28, -14, 10, -6); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(120,100,80,.6)'; c.lineWidth = 1; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(16 + i * 6, -10 - i * 2.5); c.lineTo(20 + i * 6, -20 - i * 2); c.stroke(); }
      c.restore();
    } else if (o.hat === 'bonnet') {
      c.fillStyle = o.hatColor || '#e9d9b8'; c.beginPath(); c.moveTo(-34, hy + 8); c.bezierCurveTo(-42, hy - 46, 42, hy - 46, 34, hy + 8); c.bezierCurveTo(26, hy - 26, -26, hy - 26, -34, hy + 8); c.fill(); c.stroke();
      c.strokeStyle = o.accent; c.lineWidth = 3; c.beginPath(); c.moveTo(-30, hy + 4); c.quadraticCurveTo(-22, hy + 30, -6, hy + 36); c.moveTo(30, hy + 4); c.quadraticCurveTo(22, hy + 30, 6, hy + 36); c.stroke();
      c.fillStyle = o.accent; c.beginPath(); c.arc(0, hy + 36, 5, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 2.6;
      c.fillStyle = '#e46b7a'; for (const [x, y] of [[-26, hy - 22], [-20, hy - 30]]) { c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); c.stroke(); }
    } else if (o.hat === 'pillbox') {
      c.fillStyle = o.coat; c.beginPath(); rrect(c, -18, hy - 52, 36, 20, 4); c.fill(); c.stroke();
      c.strokeStyle = o.accent; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-18, hy - 36); c.lineTo(18, hy - 36); c.moveTo(-18, hy - 48); c.lineTo(18, hy - 48); c.stroke();
      c.beginPath(); c.moveTo(-26, hy - 4); c.quadraticCurveTo(-20, hy + 30, 0, hy + 32); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.6;
      c.fillStyle = o.accent; c.beginPath(); c.arc(0, hy - 42, 3, 0, TAU); c.fill();
    } else if (o.hat === 'military') {
      c.fillStyle = o.coat; c.beginPath(); c.moveTo(-26, hy - 28); c.lineTo(-28, hy - 52); c.quadraticCurveTo(0, hy - 62, 28, hy - 52); c.lineTo(26, hy - 28); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#1d1712'; c.beginPath(); c.moveTo(-28, hy - 28); c.quadraticCurveTo(0, hy - 14, 30, hy - 26); c.lineTo(26, hy - 32); c.lineTo(-26, hy - 32); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = o.accent; c.lineWidth = 3; c.beginPath(); c.moveTo(-26, hy - 36); c.lineTo(26, hy - 36); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2.6;
      c.fillStyle = o.accent; c.beginPath(); c.arc(0, hy - 46, 6, 0, TAU); c.fill(); c.stroke();
    } else if (o.hat === 'lacecap') {
      c.fillStyle = '#fbf8f0'; c.beginPath(); c.ellipse(0, hy - 26, 30, 18, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      for (let i = 0; i < 11; i++) { const a = Math.PI + (i / 10) * Math.PI; c.beginPath(); c.arc(Math.cos(a) * 31, hy - 26 + Math.sin(a) * 19, 5, 0, TAU); c.fill(); c.stroke(); }
      c.fillStyle = '#c9a7c9'; c.beginPath(); c.moveTo(-24, hy - 30); c.lineTo(-34, hy - 18); c.lineTo(-28, hy - 14); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(24, hy - 30); c.lineTo(34, hy - 18); c.lineTo(28, hy - 14); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  }

  const COURT = {   // the farmer, the farm wife and the hired hand
    K: s => ({ coat: PAL[s].coat, dark: PAL[s].dark, accent: PAL[s].accent, plaid: PAL[s].dark, hair: '#9a8f84', mustache: true, mustacheColor: '#b8afa4', beard: s === 'C', hairStyle: 'short', collar: 'overalls', denim: s === 'S' ? '#24426a' : '#3c5a8a', hat: 'straw', accent2: PAL[s].coat }),
    Q: s => ({ lady: true, coat: PAL[s].coat, dark: PAL[s].dark, accent: PAL[s].accent, hair: s === 'H' ? '#8a4a24' : s === 'D' ? '#5a3a1c' : '#b9a58a', hairStyle: 'perm', collar: 'apron', sleeves: true }),
    J: s => ({ coat: PAL[s].coat, dark: PAL[s].dark, accent: PAL[s].accent, plaid: PAL[s].dark, hair: '#a0612e', hairStyle: 'short', collar: 'flannel', hat: 'seedcap', capColor: s === 'S' || s === 'C' ? '#2f4f2a' : '#a3302a', capText: { H: 'FEED', D: 'SEED', S: 'CORN', C: 'COOP' }[s] })
  };

  // what each court figure holds
  function courtProp(c, rank, o) {
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 2.4;
    const hand = (x, y) => { c.fillStyle = '#f2d4b6'; c.beginPath(); c.ellipse(x, y, 9, 8, 0, 0, TAU); c.fill(); c.stroke(); };
    if (rank === 'K') {          // pitchfork
      c.strokeStyle = '#7a5530'; c.lineWidth = 5; c.beginPath(); c.moveTo(60, 6); c.lineTo(64, -92); c.stroke();
      c.strokeStyle = '#8c949c'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(52, -92); c.lineTo(76, -92);
      for (const x of [52, 60, 68, 76]) { c.moveTo(x, -92); c.lineTo(x + (x - 64) * 0.08, -122); } c.stroke();
      c.strokeStyle = INK; c.lineWidth = 2.4; hand(60, -40);
    } else if (rank === 'Q') {   // a fresh cherry pie
      c.save(); c.translate(38, -24);
      c.fillStyle = '#c9cfd6'; c.beginPath(); c.ellipse(0, 4, 32, 9, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#d9a35a'; c.beginPath(); c.ellipse(0, 0, 28, 8, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#e8b86a'; c.beginPath(); c.ellipse(0, -2, 24, 6, 0, 0, TAU); c.fill();
      c.strokeStyle = '#b07a3a'; c.lineWidth = 2; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 8 - 6, -7); c.lineTo(i * 8 + 6, 3); c.moveTo(i * 8 + 6, -7); c.lineTo(i * 8 - 6, 3); c.stroke(); }
      c.fillStyle = '#b0202a'; for (const [x, y] of [[-12, -1], [4, -3], [14, 0], [-3, 1]]) { c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill(); }
      c.restore(); c.strokeStyle = INK; c.lineWidth = 2.4; hand(16, -22); hand(60, -22);
    } else {                     // an ear of sweet corn
      c.save(); c.translate(42, -36); c.rotate(0.5);
      c.fillStyle = '#6f9a3c'; c.beginPath(); c.moveTo(-8, 22); c.quadraticCurveTo(-22, -10, -4, -36); c.quadraticCurveTo(-6, -4, 4, 22); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#f2cf4a'; c.beginPath(); c.ellipse(4, -6, 9, 26, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = 'rgba(180,120,20,.5)'; for (let y = -26; y < 16; y += 6) for (let x = -2; x <= 8; x += 5) { c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill(); }
      c.fillStyle = '#7fa848'; c.beginPath(); c.moveTo(14, 22); c.quadraticCurveTo(26, -6, 12, -30); c.quadraticCurveTo(12, 0, 2, 22); c.closePath(); c.fill(); c.stroke();
      c.restore(); hand(34, -24);
    }
    c.restore();
  }

  function courtCard(c, rank, s) {
    const color = PAL[s].ink, w = CW, h = CH;
    const fx = 62, fy = 70, fw = w - 124, fh = h - 140;
    // frame
    c.save(); rrect(c, fx, fy, fw, fh, 10); c.fillStyle = '#f6edd6'; c.fill(); c.clip();
    // damask-like wallpaper behind the figure
    c.fillStyle = s === 'H' || s === 'D' ? 'rgba(143,29,34,.07)' : 'rgba(30,40,60,.07)';
    for (let y = fy - 10; y < fy + fh; y += 26) for (let x = fx - 10 + ((y / 26) % 2) * 13; x < fx + fw; x += 26) { c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 5, y); c.lineTo(x, y + 7); c.lineTo(x - 5, y); c.closePath(); c.fill(); }
    // one full portrait per court card
    const fit = { K: 1.66, Q: 1.72, J: 1.72 }[rank], o = COURT[rank](s);
    const glow = c.createRadialGradient(fx + fw / 2, fy + fh * 0.42, 10, fx + fw / 2, fy + fh * 0.42, fh * 0.6);
    glow.addColorStop(0, 'rgba(255,248,225,.75)'); glow.addColorStop(1, 'rgba(255,248,225,0)'); c.fillStyle = glow; c.fillRect(fx, fy, fw, fh);
    c.save(); c.translate(fx + fw / 2, fy + fh + 2); c.scale(fit, fit);
    bust(c, o); courtProp(c, rank, o);
    c.restore();
    c.restore();
    c.strokeStyle = GOLD; c.lineWidth = 3; rrect(c, fx, fy, fw, fh, 10); c.stroke();
    c.lineWidth = 1; rrect(c, fx + 5, fy + 5, fw - 10, fh - 10, 7); c.stroke();
    suit(c, s, fx + 22, fy + 26, 26, color);
    suit(c, s, fx + fw - 22, fy + 26, 26, color);
  }

  const PIPS = {
    2: [[.5, 0], [.5, 1]], 3: [[.5, 0], [.5, .5], [.5, 1]], 4: [[0, 0], [1, 0], [0, 1], [1, 1]],
    5: [[0, 0], [1, 0], [.5, .5], [0, 1], [1, 1]], 6: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1], [1, 1]],
    7: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [0, 1], [1, 1]],
    8: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [.5, .75], [0, 1], [1, 1]],
    9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [.5, .5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
    10: [[0, 0], [1, 0], [.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [.5, 5 / 6], [0, 1], [1, 1]]
  };
  function pipCard(c, n, s) {
    const color = PAL[s].ink, x0 = 112, x1 = CW - 112, y0 = 104, y1 = CH - 104;
    for (const [px, py] of PIPS[n]) {
      const x = x0 + (x1 - x0) * px, y = y0 + (y1 - y0) * py;
      if (py > 0.5) { c.save(); c.translate(x, y); c.rotate(Math.PI); suit(c, s, 0, 0, 58, color); c.restore(); }
      else suit(c, s, x, y, 58, color);
    }
  }
  function aceCard(c, s) {
    const color = PAL[s].ink, cx = CW / 2, cy = CH / 2;
    c.save(); c.strokeStyle = GOLD; c.lineWidth = 2;
    c.beginPath(); c.ellipse(cx, cy, 98, 128, 0, 0, TAU); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.ellipse(cx, cy, 104, 134, 0, 0, TAU); c.stroke();
    // filigree sprays
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, r1 = 92, r2 = 118;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r1 * 0.95, cy + Math.sin(a) * r1 * 1.25);
      c.quadraticCurveTo(cx + Math.cos(a + 0.18) * r2, cy + Math.sin(a + 0.18) * r2 * 1.22, cx + Math.cos(a + 0.3) * r1, cy + Math.sin(a + 0.3) * r1 * 1.28); c.stroke();
    }
    c.restore();
    suit(c, s, cx, cy, 130, color);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(cx - 24, cy - 28, 14, 24, -0.5, 0, TAU); c.fill();
  }

  /* ---------- the Old Maid ---------- */
  function oldMaidFigure(c, w, h) {
    // wallpaper + window glow
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e9dcc0'); g.addColorStop(1, '#d6c3a0'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,70,90,.14)'; c.lineWidth = 2;
    for (let x = 10; x < w; x += 30) { c.beginPath(); for (let y = 0; y <= h; y += 6) c.lineTo(x + Math.sin(y / 14) * 6, y); c.stroke(); }
    // portrait frame on the wall
    c.fillStyle = '#7a5a2e'; c.fillRect(w * 0.66, 30, 56, 70); c.fillStyle = '#e9e2cc'; c.fillRect(w * 0.66 + 7, 37, 42, 56);
    c.fillStyle = '#7a6a54'; c.beginPath(); c.ellipse(w * 0.66 + 28, 60, 9, 12, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(w * 0.66 + 28, 84, 15, 10, 0, Math.PI, 0); c.fill();
    // the lady herself
    c.save(); c.translate(w / 2, h - 36); c.scale(1.18, 1.18);
    bust(c, { lady: true, stern: true, skin: '#f0d2b8', hair: '#c9c4bc', brow: '#8a847a', hairStyle: 'bun', coat: '#3a2a3e', dark: '#24182a', accent: '#b7a3c9', collar: 'shawl', shawl: '#8a7a9a', hat: 'lacecap', spectacles: true });
    // teacup in hand
    c.save(); c.translate(36, -18);
    c.fillStyle = '#f2d4b6'; c.strokeStyle = INK; c.lineWidth = 2.4; c.beginPath(); c.ellipse(-4, 12, 12, 9, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#fbf8f0'; c.beginPath(); c.ellipse(0, 4, 26, 5, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-16, -16); c.lineTo(16, -16); c.quadraticCurveTo(14, 4, 0, 4); c.quadraticCurveTo(-14, 4, -16, -16); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.arc(19, -8, 6, -1.4, 1.4); c.stroke();
    c.strokeStyle = '#7b9ad0'; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, -10); c.lineTo(12, -10); c.stroke();
    c.strokeStyle = 'rgba(140,140,140,.55)'; c.lineWidth = 2; for (const dx of [-5, 4]) { c.beginPath(); c.moveTo(dx, -22); c.bezierCurveTo(dx - 6, -30, dx + 6, -36, dx, -46); c.stroke(); }
    c.restore();
    c.restore();
    // the cat
    c.save(); c.translate(52, h - 34);
    c.fillStyle = '#1f1a1e'; c.strokeStyle = '#0d0a0c'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 6, 30, 18, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(-22, -10, 14, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-33, -18); c.lineTo(-30, -34); c.lineTo(-22, -22); c.moveTo(-20, -23); c.lineTo(-12, -34); c.lineTo(-10, -18); c.fill();
    c.beginPath(); c.moveTo(26, 12); c.bezierCurveTo(50, 10, 46, -14, 34, -12); c.lineWidth = 7; c.strokeStyle = '#1f1a1e'; c.stroke();
    c.fillStyle = '#e8d24a'; c.beginPath(); c.ellipse(-27, -11, 3, 2.4, 0, 0, TAU); c.ellipse(-17, -11, 3, 2.4, 0, 0, TAU); c.fill();
    c.fillStyle = '#0d0a0c'; c.fillRect(-27.6, -13, 1.2, 4); c.fillRect(-17.6, -13, 1.2, 4);
    c.restore();
  }
  function oldMaidCard(c) {
    const w = CW, h = CH, fx = 34, fy = 40, fw = w - 68, fh = h - 128;
    c.save(); rrect(c, fx, fy, fw, fh, 12); c.clip();
    c.translate(fx, fy); oldMaidFigure(c, fw, fh); c.restore();
    c.strokeStyle = '#3a2a3e'; c.lineWidth = 4; rrect(c, fx, fy, fw, fh, 12); c.stroke();
    c.strokeStyle = GOLD; c.lineWidth = 1.5; rrect(c, fx + 6, fy + 6, fw - 12, fh - 12, 8); c.stroke();
    // ribbon banner
    const by = h - 62;
    c.fillStyle = '#3a2a3e'; c.beginPath(); c.moveTo(22, by - 24); c.lineTo(44, by - 24); c.lineTo(44, by + 24); c.lineTo(22, by + 24); c.lineTo(32, by); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(w - 22, by - 24); c.lineTo(w - 44, by - 24); c.lineTo(w - 44, by + 24); c.lineTo(w - 22, by + 24); c.lineTo(w - 32, by); c.closePath(); c.fill();
    c.fillStyle = '#5a3f5e'; c.beginPath(); rrect(c, 40, by - 28, w - 80, 56, 6); c.fill();
    c.strokeStyle = GOLD2; c.lineWidth = 1.5; rrect(c, 46, by - 22, w - 92, 44, 4); c.stroke();
    c.fillStyle = '#f6e7c6'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `34px ${SC}`; c.fillText('The Old Maid', w / 2, by + 2);
  }

  /* ---------- card back: a barn quilt on barn-red boards ---------- */
  function quiltBlock(c, cx, cy, size) {
    const h = size / 2, q = size / 4;
    c.save(); c.translate(cx, cy);
    c.fillStyle = '#f7f0de'; c.fillRect(-h, -h, size, size);
    const navy = '#2f4f7a', gold = '#e8b84a', red = '#a3302a', green = '#44703c';
    // eight-point (LeMoyne) star
    const r = h * 0.52, tip = h * 0.96, sa = Math.sin(Math.PI / 8) * r, ca = Math.cos(Math.PI / 8) * r;
    for (let i = 0; i < 8; i++) {
      c.save(); c.rotate(i * Math.PI / 4);
      c.fillStyle = i % 2 ? gold : red; c.beginPath(); c.moveTo(0, 0); c.lineTo(sa, -ca); c.lineTo(0, -tip); c.lineTo(-sa, -ca); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -tip); c.lineTo(-sa, -ca); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(43,29,20,.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(sa, -ca); c.lineTo(0, -tip); c.lineTo(-sa, -ca); c.closePath(); c.stroke();
      c.restore();
    }
    // corner triangles
    c.fillStyle = navy; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.fillRect(sx > 0 ? h - q * 0.62 : -h, sy > 0 ? h - q * 0.62 : -h, q * 0.62, q * 0.62);
    c.fillStyle = green; c.beginPath(); c.arc(0, 0, q * 0.32, 0, TAU); c.fill();
    c.strokeStyle = '#2b1d14'; c.lineWidth = 3; c.strokeRect(-h, -h, size, size);
    c.restore();
  }
  function backCard() {
    const cv = canvas(CW, CH), c = cv.getContext('2d');
    rrect(c, 1, 1, CW - 2, CH - 2, 22); c.fillStyle = '#f4ead2'; c.fill();
    rrect(c, 12, 12, CW - 24, CH - 24, 14); c.fillStyle = '#9e2b25'; c.fill();
    c.save(); c.clip();
    for (let x = 12; x < CW; x += 34) { c.fillStyle = (x / 34) % 2 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.04)'; c.fillRect(x, 0, 34, CH); c.strokeStyle = 'rgba(40,10,8,.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, CH); c.stroke(); }
    const R = rng(77); for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(40,10,8,${R() * 0.25})`; c.lineWidth = 1; const x = 12 + R() * CW, y = R() * CH; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - .5) * 3, y + 10 + R() * 30); c.stroke(); }
    // white barn-door trim
    c.strokeStyle = '#f4ead2'; c.lineWidth = 9; c.strokeRect(30, 30, CW - 60, CH - 60);
    c.beginPath(); c.moveTo(30, 30); c.lineTo(CW - 30, CH - 30); c.moveTo(CW - 30, 30); c.lineTo(30, CH - 30); c.stroke();
    c.restore();
    c.save(); c.translate(CW / 2, CH / 2); c.rotate(Math.PI / 4); quiltBlock(c, 0, 0, 150); c.restore();
    c.fillStyle = '#f4ead2'; c.font = `26px ${SC}`; c.textAlign = 'center'; c.fillText('EUCHRE', CW / 2, CH - 46);
    rrect(c, 1, 1, CW - 2, CH - 2, 22); c.strokeStyle = 'rgba(70,50,30,.45)'; c.lineWidth = 2; c.stroke();
    return cv;
  }

  /* ---------- public: a card face ---------- */
  const RANK = { 1: 'A', 14: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  function face(card) {
    const cv = canvas(CW, CH), c = cv.getContext('2d');
    paper(c, CW, CH, card.r * 7 + 'SHDC'.indexOf(card.s) * 131);
    if (card.maid) { oldMaidCard(c); return cv; }
    const color = PAL[card.s].ink;
    border(c, CW, CH, GOLD);
    const label = RANK[card.r] || String(card.r);
    index(c, label, card.s, color, CW, CH);
    if (card.r === 1 || card.r === 14) aceCard(c, card.s);
    else if (card.r > 10) courtCard(c, label, card.s);
    else pipCard(c, card.r, card.s);
    return cv;
  }

  /* ---------- opponents' cameo portraits ---------- */
  const PEOPLE = {
    barb: { lady: true, skin: '#f3d3b8', hair: '#b0642a', hairStyle: 'perm', spectacles: true, coat: '#2f7f86', dark: '#1d5257', accent: '#f0d36a', collar: 'crew', logo: 'STATE FAIR' },
    dale: { skin: '#e9bf9c', hair: '#6a4a2a', mustache: true, mustacheColor: '#5a3a22', hairStyle: 'short', coat: '#a3302a', dark: '#6e1a16', accent: '#e8c35a', plaid: '#3a1410', collar: 'flannel', hat: 'seedcap', capColor: '#2f4f2a', capText: 'FEED' },
    june: { lady: true, stern: false, skin: '#f2d5c0', hair: '#d6d2cc', hairStyle: 'perm', spectacles: true, coat: '#8f78a8', dark: '#5e4a78', accent: '#e8c35a', collar: 'cardigan', blouse: '#f6efe2', pearls: true },
    // added in 2.0: more folks who might pull up a chair
    kayla: { lady: true, skin: '#f1cfae', hair: '#4a2a16', hairStyle: 'ringlets', coat: '#d9822b', dark: '#9a5414', accent: '#f6efe0', collar: 'crew', logo: '4-H CLUB' },
    gloria: { lady: true, skin: '#c68a62', hair: '#2e1b10', hairStyle: 'bun', spectacles: true, coat: '#44703c', dark: '#2a4a26', accent: '#e8c35a', collar: 'apron', brow: '#2e1b10' },
    opal: { lady: true, skin: '#8a5a3c', hair: '#e8e4dc', hairStyle: 'updo', coat: '#7a3a4a', dark: '#4e2230', accent: '#e8c35a', collar: 'shawl', shawl: '#c77a8a', hat: 'lacecap', brow: '#cfc9be' },
    walt: { skin: '#e9c2a0', hair: '#e6e0d6', mustache: true, mustacheColor: '#ece8e0', spectacles: true, coat: '#c9b07a', dark: '#8a7448', accent: '#e8c35a', collar: 'overalls', denim: '#3c5a8a', hat: 'straw', accent2: '#2f4f7a', brow: '#d8d2c8' },
    tyler: { skin: '#f0caa6', hair: '#c9a25a', hairStyle: 'short', coat: '#5f7d4a', dark: '#3a5228', accent: '#e8c35a', collar: 'crew', logo: 'GO TEAM', hat: 'seedcap', capColor: '#2f4f7a', capText: 'SEED' },
    lars: { skin: '#f0c9a8', hair: '#b9772f', hairStyle: 'short', beard: true, mustache: true, mustacheColor: '#a8662a', coat: '#2f4f7a', dark: '#1a2e4a', accent: '#e8c35a', plaid: '#14223a', collar: 'flannel' },
    coach: { skin: '#7a4e34', hair: '#1e1410', hairStyle: 'short', mustache: true, mustacheColor: '#1e1410', coat: '#1f5a3a', dark: '#123a24', accent: '#e8c35a', collar: 'crew', logo: 'BOOSTERS', brow: '#1e1410' }
  };
  function cameo(who, size) {
    const cv = canvas(size, size), c = cv.getContext('2d'), r = size / 2;
    const g = c.createRadialGradient(r, r * 0.8, r * 0.1, r, r, r); g.addColorStop(0, '#f3e6c6'); g.addColorStop(1, '#c9b083');
    c.beginPath(); c.arc(r, r, r - 2, 0, TAU); c.fillStyle = g; c.fill();
    c.save(); c.beginPath(); c.arc(r, r, r - 7, 0, TAU); c.clip();
    c.translate(r, size * 1.02); const k = size / 190; c.scale(k, k); bust(c, PEOPLE[who]); c.restore();
    c.lineWidth = size * 0.05; c.strokeStyle = GOLD; c.beginPath(); c.arc(r, r, r - size * 0.03, 0, TAU); c.stroke();
    c.lineWidth = 1.5; c.strokeStyle = '#7a5a26'; c.beginPath(); c.arc(r, r, r - size * 0.06, 0, TAU); c.stroke();
    return cv;
  }

  /* ---------- kitchen-table props ---------- */
  function mug(size) {   // a diner coffee mug, seen from above at an angle
    const cv = canvas(size, size), c = cv.getContext('2d'), k = size / 200; c.scale(k, k);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(104, 176, 74, 16, 0, 0, TAU); c.fill();
    c.strokeStyle = '#2b1d14'; c.lineWidth = 3;
    c.fillStyle = '#f2ebde'; c.beginPath(); c.arc(160, 110, 28, -1.2, 1.2); c.lineWidth = 14; c.strokeStyle = '#e8e0d0'; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#2b1d14';
    c.beginPath(); c.moveTo(42, 64); c.lineTo(48, 164); c.quadraticCurveTo(100, 184, 152, 164); c.lineTo(158, 64); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#a3302a'; c.beginPath(); c.moveTo(45, 98); c.lineTo(155, 98); c.lineTo(153, 130); c.lineTo(47, 130); c.closePath(); c.fill();
    c.fillStyle = '#f2ebde'; c.font = `17px ${SC}`; c.textAlign = 'center'; c.fillText('EUCHRE', 100, 120);
    c.fillStyle = '#efe6d6'; c.beginPath(); c.ellipse(100, 64, 58, 15, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#4a2a16'; c.beginPath(); c.ellipse(100, 66, 50, 11, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(84, 63, 18, 3, 0, 0, TAU); c.fill();
    return cv;
  }
  function popcorn(size) {
    const cv = canvas(size, size), c = cv.getContext('2d'), k = size / 220; c.scale(k, k);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(112, 168, 96, 24, 0, 0, TAU); c.fill();
    c.strokeStyle = '#2b1d14'; c.lineWidth = 3;
    const R = rng(9);
    c.fillStyle = '#b3462e'; c.beginPath(); c.ellipse(110, 110, 96, 32, 0, 0, TAU); c.fill(); c.stroke();
    for (let i = 0; i < 70; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * 0.92, x = 110 + Math.cos(a) * 88 * d, y = 104 + Math.sin(a) * 26 * d - R() * 10;
      c.fillStyle = R() < .15 ? '#f0cf6a' : '#fbf6e8'; c.beginPath();
      for (let j = 0; j < 4; j++) { const b = j / 4 * TAU + R(); c.arc(x + Math.cos(b) * 4, y + Math.sin(b) * 3, 4 + R() * 2.5, 0, TAU); }
      c.fill(); c.strokeStyle = 'rgba(160,130,80,.35)'; c.lineWidth = 0.8; c.stroke();
    }
    c.strokeStyle = '#2b1d14'; c.lineWidth = 3;
    c.fillStyle = '#c4553a'; c.beginPath(); c.moveTo(14, 112); c.quadraticCurveTo(24, 172, 110, 176); c.quadraticCurveTo(196, 172, 206, 112); c.quadraticCurveTo(110, 150, 14, 112); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(60, 140, 20, 8, 0.4, 0, TAU); c.fill();
    return cv;
  }
  function icon(size) {
    const cv = canvas(size, size), c = cv.getContext('2d'), s = size / 512;
    c.scale(s, s);
    rrect(c, 16, 16, 480, 480, 96); c.fillStyle = '#9e2b25'; c.fill();
    c.save(); rrect(c, 16, 16, 480, 480, 96); c.clip();
    for (let x = 16; x < 512; x += 48) { c.strokeStyle = 'rgba(40,10,8,.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 512); c.stroke(); }
    c.restore();
    c.strokeStyle = '#f4ead2'; c.lineWidth = 14; rrect(c, 40, 40, 432, 432, 76); c.stroke();
    c.save(); c.translate(256, 256); c.rotate(Math.PI / 4); quiltBlock(c, 0, 0, 250); c.restore();
    return cv;
  }

  return { face, back: backCard, cameo, mug, popcorn, icon, CW, CH, PEOPLE, suit, SERIF, SC, PAL };
})();
