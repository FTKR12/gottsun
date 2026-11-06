// ===================================================================
//  art: the stadium, the eight heads, the ball, effects and the HUD.
//  Everything is drawn in world units (W x H); V maps them to the screen.
// ===================================================================

const OUT = '#1B2030';
const FONT_SIGN = '"Dela Gothic One","Hiragino Sans","Yu Gothic","Meiryo",sans-serif';
const FONT_UI = '"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo",sans-serif';
const V = { s: 1, ox: 0, oy: 0, dpr: 1, cw: 1, ch: 1, x0: 0, x1: W, y0: 0, y1: H };

function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); }
function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function fillOut(c, col, lw) { c.fillStyle = col; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hexRGB(a), B = hexRGB(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
function mixHex(a, b, t) { const A = hexRGB(a), B = hexRGB(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function rgba(h, a) { const A = hexRGB(h); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }
function outlined(c, str, x, y, size, fill, lw, font, align) {
  c.font = `${size}px ${font || FONT_SIGN}`; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = lw == null ? size * 0.18 : lw; c.strokeStyle = OUT; c.strokeText(str, x, y);
  c.fillStyle = fill; c.fillText(str, x, y);
}

// ---------------- the view ----------------
function computeView(cw, ch, dpr, oy, scale) {
  const s = scale || Math.min(cw / W, ch / H);
  V.s = s; V.dpr = dpr; V.cw = cw; V.ch = ch;
  V.ox = (cw - W * s) / 2;
  V.oy = oy != null ? oy : (ch - H * s) / 2;
  V.x0 = -V.ox / s; V.x1 = (cw - V.ox) / s; V.y0 = -V.oy / s; V.y1 = (ch - V.oy) / s;
}
function worldTransform(c, sx, sy) {
  c.setTransform(V.dpr * V.s, 0, 0, V.dpr * V.s, V.dpr * (V.ox + (sx || 0) * V.s), V.dpr * (V.oy + (sy || 0) * V.s));
}

// ---------------- the stadium (drawn once per size into a canvas) ----------------
const SPONSORS = ['むさしの森珈琲'];
const BG = { cv: null, key: '', crowd: null };

function stadiumCanvas(stKey) {
  const key = [stKey, V.cw, V.ch, V.dpr, V.s.toFixed(4), V.oy.toFixed(1)].join('|');
  if (BG.key === key && BG.cv) return BG.cv;
  const cv = BG.cv || (BG.cv = document.createElement('canvas'));
  cv.width = Math.max(1, Math.round(V.cw * V.dpr)); cv.height = Math.max(1, Math.round(V.ch * V.dpr));
  const c = cv.getContext('2d');
  worldTransform(c);
  drawStadium(c, STADIUMS[stKey] || STADIUMS.day, stKey);
  BG.key = key;
  return cv;
}

function drawStadium(c, S, stKey) {
  const x0 = V.x0 - 2, x1 = V.x1 + 2, y0 = V.y0 - 2, y1 = V.y1 + 2;
  const rnd = mkRng(4242);
  // sky
  const g = c.createLinearGradient(0, y0, 0, 420);
  g.addColorStop(0, S.sky[0]); g.addColorStop(1, S.sky[1]);
  c.fillStyle = g; c.fillRect(x0, y0, x1 - x0, 430 - y0);
  if (stKey === 'night') {
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`; circ(c, x0 + rnd() * (x1 - x0), y0 + rnd() * (200 - y0), 0.8 + rnd() * 1.6); c.fill(); }
    c.fillStyle = '#FFF6D8'; circ(c, 1290, 70, 34); c.fill();
    c.fillStyle = S.sky[0]; circ(c, 1304, 62, 30); c.fill();
  } else {
    const sunY = stKey === 'sunset' ? 150 : 70, sunX = stKey === 'sunset' ? 1180 : 260;
    const sg = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 150);
    sg.addColorStop(0, stKey === 'sunset' ? 'rgba(255,240,180,.95)' : 'rgba(255,255,230,.95)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sg; circ(c, sunX, sunY, 150); c.fill();
    c.fillStyle = stKey === 'sunset' ? '#FFE3A0' : '#FFFBE0'; circ(c, sunX, sunY, 36); c.fill();
    for (let i = 0; i < 6; i++) {
      const cx = x0 + rnd() * (x1 - x0), cy = 40 + rnd() * 110, sc = 0.7 + rnd() * 0.8;
      c.fillStyle = stKey === 'sunset' ? 'rgba(255,214,190,.85)' : 'rgba(255,255,255,.9)';
      for (let k = 0; k < 5; k++) { circ(c, cx + (k - 2) * 26 * sc, cy + Math.abs(k - 2) * 7 * sc, (26 - Math.abs(k - 2) * 5) * sc); c.fill(); }
    }
  }
  // the stands: roof, upper tier, lower tier
  const standTop = 150, mid = 410, standBot = 560, ab = 560, ah = 34, farTop = ab + ah;
  c.fillStyle = mix(S.stand, '#000000', 0.25);
  c.fillRect(x0, standTop - 26, x1 - x0, 26);
  c.fillStyle = S.light ? '#FFF7C4' : '#DDE6F2';
  for (let x = Math.floor(x0 / 80) * 80; x < x1; x += 80) { rrect(c, x + 22, standTop - 19, 36, 9, 4); c.fill(); }
  const tg = c.createLinearGradient(0, standTop, 0, standBot);
  tg.addColorStop(0, mix(S.stand, '#000000', 0.2)); tg.addColorStop(1, mix(S.stand, '#FFFFFF', 0.06));
  c.fillStyle = tg; c.fillRect(x0, standTop, x1 - x0, standBot - standTop);
  crowd(c, rnd, x0, x1, standTop + 10, mid - 18, S, 0.62);
  c.fillStyle = mix(S.stand, '#000000', 0.35); c.fillRect(x0, mid - 16, x1 - x0, 18);
  c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(x0, mid - 16, x1 - x0, 3);
  crowd(c, rnd, x0, x1, mid + 8, standBot - 4, S, 0.5);
  // banners hung on the railing
  const banners = ['らぴす', 'さちえ', 'いててて', 'やすお❤️'];
  banners.forEach((txt, i) => {
    const bx = 190 + i * 370, col = TEAM_COL[i < 2 ? 0 : 1];
    c.save(); c.translate(bx, mid - 34);
    c.fillStyle = i % 2 ? '#F4F6FA' : col.main;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(170, 0); c.lineTo(165, 40); c.lineTo(5, 40); c.closePath(); c.fill();
    c.fillStyle = i % 2 ? col.main : '#FFFFFF';
    c.font = `26px ${FONT_SIGN}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 85, 21, 156);
    c.restore();
  });
  // floodlight towers
  if (S.light > 0) {
    for (const tx of [90, W - 90]) {
      c.fillStyle = '#2A3148'; c.fillRect(tx - 5, 0, 10, standTop);
      c.fillStyle = '#3A4361'; rrect(c, tx - 56, -6, 112, 54, 6); c.fill();
      c.fillStyle = '#FFFBE3';
      for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { circ(c, tx - 39 + k * 26, 8 + r * 22, 9); c.fill(); }
      const lg = c.createRadialGradient(tx, 20, 10, tx, 20, 260);
      lg.addColorStop(0, `rgba(255,250,220,${0.35 * S.light})`); lg.addColorStop(1, 'rgba(255,250,220,0)');
      c.fillStyle = lg; circ(c, tx, 20, 260); c.fill();
    }
  }
  // advertising boards, muted so the players stand out
  const cols = ['#EEF1F6', '#2C7A52'];
  for (let i = Math.floor((x0 - 40) / 200); i * 200 < x1; i++) {
    const k = ((i % cols.length) + cols.length) % cols.length, bx = i * 200, col = mix(cols[k], S.stand, S.light ? 0.3 : 0.12);
    c.fillStyle = col; c.fillRect(bx, ab, 200, ah);
    c.fillStyle = cols[k] === '#EEF1F6' || cols[k] === '#E9B93A' ? 'rgba(27,32,48,.85)' : 'rgba(255,255,255,.92)';
    c.font = `19px ${FONT_SIGN}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(SPONSORS[((i % SPONSORS.length) + SPONSORS.length) % SPONSORS.length], bx + 100, ab + ah / 2 + 1, 180);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(bx + 198, ab, 2, ah);
  }
  // the far side of the pitch, behind the players
  const rows = 6;
  let yy = farTop;
  for (let r = 0; r < rows; r++) {
    const hgt = (GROUND - farTop) * (0.08 + r * 0.04) / (0.08 * rows + 0.04 * rows * (rows - 1) / 2);
    c.fillStyle = r % 2 ? S.grass[0] : S.grass[1];
    c.fillRect(x0, yy, x1 - x0, hgt + 1); yy += hgt;
  }
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x0, farTop, x1 - x0, 6);
  c.strokeStyle = 'rgba(255,255,255,.78)'; c.lineWidth = 3; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(GOAL_D - 30, farTop + 6); c.lineTo(W - GOAL_D + 30, farTop + 6); c.stroke();
  ell(c, W / 2, (farTop + GROUND) / 2 + 6, 170, 40); c.stroke();
  c.beginPath(); c.moveTo(W / 2 - 4, farTop + 6); c.lineTo(W / 2 + 4, GROUND); c.stroke();
  for (const side of [0, 1]) {
    const d = side ? -1 : 1, gx = side ? W - GOAL_D : GOAL_D;
    c.beginPath(); c.moveTo(gx - d * 30, farTop + 6); c.lineTo(gx + d * 6, GROUND); c.stroke();
    c.beginPath(); c.moveTo(gx + d * 170, farTop + 26); c.lineTo(gx + d * 280, farTop + 26); c.lineTo(gx + d * 300, GROUND); c.stroke();
    c.beginPath(); c.moveTo(gx + d * 60, farTop + 56); c.lineTo(gx + d * 110, farTop + 56); c.lineTo(gx + d * 118, GROUND); c.stroke();
  }
  // near grass
  for (let i = Math.floor(x0 / 100) - 1; i * 100 < x1 + 100; i++) {
    c.fillStyle = i % 2 ? mix(S.grass[0], '#000000', 0.08) : mix(S.grass[1], '#000000', 0.08);
    c.beginPath(); c.moveTo(i * 100, GROUND); c.lineTo(i * 100 + 100, GROUND); c.lineTo(i * 100 + 100 + (i * 100 + 50 - W / 2) * 0.25, y1); c.lineTo(i * 100 + (i * 100 - 50 - W / 2) * 0.25, y1); c.closePath(); c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(x0, GROUND + 2, x1 - x0, 3);
  const sh = c.createLinearGradient(0, GROUND, 0, y1);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.22)');
  c.fillStyle = sh; c.fillRect(x0, GROUND, x1 - x0, y1 - GROUND);
  if (S.light) { c.fillStyle = `rgba(10,20,60,${0.16 * S.light})`; c.fillRect(x0, y0, x1 - x0, y1 - y0); }
}

function crowd(c, rnd, x0, x1, top, bot, S, fade) {
  // soft and low in contrast: a sea of supporters, not a picture to read
  const skins = ['#F6CFAE', '#E8B98C', '#C9935F', '#A8714A'];
  const hairs = ['#2B1E16', '#4A3424', '#1B1B22', '#7A4B2A'];
  const tone = S.light ? mix(S.stand, '#000000', 0.2) : S.stand;
  for (let y = top; y < bot; y += 14) {
    const off = ((y / 14) | 0) % 2 ? 6 : 0;
    const depth = fade * (0.85 + 0.3 * (1 - (y - top) / (bot - top)));
    for (let x = Math.floor(x0 / 12) * 12 + off; x < x1; x += 12) {
      if (rnd() < 0.1) continue;
      const left = x < W / 2, r = rnd();
      let shirt;
      if (r < 0.7) shirt = TEAM_COL[left ? 0 : 1][rnd() < 0.6 ? 'main' : 'light'];
      else if (r < 0.88) shirt = '#F2F4F8'; else shirt = '#E9B93A';
      const jy = y + (rnd() - 0.5) * 2;
      c.fillStyle = mix(shirt, tone, depth); rrect(c, x - 5.5, jy + 3, 11, 10, 4); c.fill();
      c.fillStyle = mix(skins[(rnd() * 4) | 0], tone, depth * 0.85); circ(c, x, jy, 4.6); c.fill();
      c.fillStyle = mix(hairs[(rnd() * 4) | 0], tone, depth * 0.7); c.beginPath(); c.arc(x, jy - 1, 4.6, Math.PI, TAU); c.fill();
    }
  }
}

// ---------------- goals ----------------
function drawGoalBack(c, G) {
  for (let side = 0; side < 2; side++) {
    const [x0, y0, x1] = barRect(G, side), bot = GROUND;
    const top = y0 + BAR_T, gx0 = side ? W - GOAL_D : 0, gx1 = side ? W : GOAL_D;
    c.save();
    c.beginPath(); c.rect(gx0, top, gx1 - gx0, bot - top); c.clip();
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(gx0, top, gx1 - gx0, bot - top);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.6;
    for (let k = -20; k < 30; k++) {
      c.beginPath(); c.moveTo(gx0 + k * 18, top); c.lineTo(gx0 + k * 18 + (bot - top), bot); c.stroke();
      c.beginPath(); c.moveTo(gx0 + k * 18, top); c.lineTo(gx0 + k * 18 - (bot - top), bot); c.stroke();
    }
    c.restore();
    // far post
    const px = side ? W - GOAL_D - 3 : GOAL_D - 5;
    c.fillStyle = 'rgba(235,240,248,.9)'; c.fillRect(px, top, 8, bot - top);
  }
}
function drawGoalFront(c, G) {
  for (let side = 0; side < 2; side++) {
    const [x0, y0, x1, y1] = barRect(G, side);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x0, y1, x1 - x0, 5);
    rrect(c, x0 - 2, y0, x1 - x0 + 4, y1 - y0, 6); fillOut(c, '#FFFFFF', 3);
    c.fillStyle = 'rgba(30,40,60,.15)'; c.fillRect(x0, y0 + (y1 - y0) * 0.6, x1 - x0, (y1 - y0) * 0.4);
    // near post
    const px = side ? W - GOAL_D - BAR_OUT + 2 : GOAL_D + BAR_OUT - 10;
    rrect(c, px, y1 - 2, 8, GROUND - y1 + 4, 3); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill();
    const fx = G.goalFx && G.goalFx[side];
    if (fx && fx.t > 0) {
      const big = fx.k === 'big';
      outlined(c, `${big ? 'でかゴール' : 'ちびゴール'} ${Math.ceil(fx.t)}`, side ? W - 100 : 100, y0 - 22, 22, big ? '#FFD740' : '#9EF0C0', 5, FONT_UI);
    }
  }
}

// ---------------- the ball ----------------
function drawBallShape(c, x, y, rot, alpha, tint, rad) {
  const R = rad || BALL_R;
  c.save(); c.globalAlpha = alpha; c.translate(x, y);
  const g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, tint || '#DCE3EE');
  circ(c, 0, 0, R); c.fillStyle = g; c.fill();
  c.save(); circ(c, 0, 0, R); c.clip(); c.rotate(rot);
  c.fillStyle = '#20263A';
  pent(c, 0, 0, R * 0.36);
  for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - Math.PI / 2; pent(c, Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, R * 0.3); }
  c.strokeStyle = '#20263A'; c.lineWidth = 1.6;
  for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - Math.PI / 2; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.36, Math.sin(a) * R * 0.36); c.lineTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7); c.stroke(); }
  c.restore();
  circ(c, 0, 0, R); c.lineWidth = 2.6; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, -R * 0.38, -R * 0.45, R * 0.26, R * 0.15, -0.6); c.fill();
  c.restore();
}
function pent(c, x, y, r) {
  c.beginPath();
  for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - Math.PI / 2; c[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath(); c.fill();
}
function drawShadow(c, x, y, w, k) {
  const h = clamp((GROUND - y) / 500, 0, 1);
  c.fillStyle = `rgba(0,0,0,${0.28 * (1 - h * 0.7) * (k == null ? 1 : k)})`;
  ell(c, x, GROUND + 3, w * (1 - h * 0.45), 7 * (1 - h * 0.4)); c.fill();
}
function drawBall(c, b, t, view) {
  const mode = b.mode && b.modeT > 0 ? b.mode : '';
  const BALL_R = b.r || 23;
  if (mode === 'ghost') {
    const a = 0.13 + 0.07 * Math.sin(t * 22);
    drawShadow(c, b.x, b.y, BALL_R, 0.3);
    drawBallShape(c, b.x, b.y, b.rot, a, null, BALL_R);
    c.strokeStyle = `rgba(210,200,255,${0.3 + 0.12 * Math.sin(t * 9)})`; c.lineWidth = 2.5;
    circ(c, b.x, b.y, BALL_R + 4 + 3 * Math.sin(t * 13)); c.stroke();
    return;
  }
  drawShadow(c, b.x, b.y, BALL_R);
  if (b.heatT > 0 && !mode) {
    const k = Math.min(1, b.heatT / 0.3), g = c.createRadialGradient(b.x, b.y, BALL_R * 0.5, b.x, b.y, BALL_R * 2.2);
    g.addColorStop(0, `rgba(255,120,40,${0.75 * k})`); g.addColorStop(1, 'rgba(255,80,30,0)');
    c.fillStyle = g; circ(c, b.x, b.y, BALL_R * 2.2); c.fill();
    if (Math.random() < 0.6) puff(b.x - b.vx * 0.015, b.y - b.vy * 0.015, 1, '#FF8A3D', 40, 20, 9, 0.35, 'flame');
  }
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 900 && !mode) {
    const k = clamp((sp - 900) / 900, 0, 1) * 0.45, ux = b.vx / sp, uy = b.vy / sp;
    const g = c.createLinearGradient(b.x, b.y, b.x - ux * 120, b.y - uy * 120);
    g.addColorStop(0, `rgba(255,255,255,${k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = g; c.lineWidth = BALL_R * 1.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - ux * 120, b.y - uy * 120); c.stroke();
  }
  if (mode === 'fire') {
    const g = c.createRadialGradient(b.x, b.y, 5, b.x, b.y, BALL_R * 2.6);
    g.addColorStop(0, 'rgba(255,240,120,.95)'); g.addColorStop(0.45, 'rgba(255,120,20,.55)'); g.addColorStop(1, 'rgba(255,60,0,0)');
    c.fillStyle = g; circ(c, b.x, b.y, BALL_R * 2.6); c.fill();
    drawBallShape(c, b.x, b.y, b.rot, 1, '#FFB347', BALL_R);
  } else if (mode === 'ice') {
    const g = c.createRadialGradient(b.x, b.y, 5, b.x, b.y, BALL_R * 2.2);
    g.addColorStop(0, 'rgba(220,250,255,.9)'); g.addColorStop(1, 'rgba(120,200,255,0)');
    c.fillStyle = g; circ(c, b.x, b.y, BALL_R * 2.2); c.fill();
    drawBallShape(c, b.x, b.y, b.rot, 1, '#9EDCFF', BALL_R);
  } else if (mode === 'rocket') {
    const a = Math.atan2(b.vy, b.vx);
    c.save(); c.translate(b.x, b.y); c.rotate(a);
    const fl = 26 + Math.random() * 14;
    c.fillStyle = 'rgba(255,170,40,.9)';
    c.beginPath(); c.moveTo(-BALL_R * 0.7, -10); c.lineTo(-BALL_R - fl, 0); c.lineTo(-BALL_R * 0.7, 10); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,250,200,.95)';
    c.beginPath(); c.moveTo(-BALL_R * 0.7, -5); c.lineTo(-BALL_R - fl * 0.5, 0); c.lineTo(-BALL_R * 0.7, 5); c.closePath(); c.fill();
    c.fillStyle = '#C9D3E0'; c.beginPath(); c.moveTo(-6, -BALL_R - 6); c.lineTo(-18, -BALL_R + 6); c.lineTo(-4, -BALL_R + 6); c.closePath(); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.moveTo(-6, BALL_R + 6); c.lineTo(-18, BALL_R - 6); c.lineTo(-4, BALL_R - 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
    drawBallShape(c, b.x, b.y, b.rot, 1, '#FFD0D0', BALL_R);
  } else drawBallShape(c, b.x, b.y, b.rot, 1, null, BALL_R);
  // a ball above the top of the screen: show where it is
  if (b.y < V.y0 + BALL_R) {
    c.fillStyle = '#FFD740';
    c.beginPath(); c.moveTo(b.x, V.y0 + 6); c.lineTo(b.x - 12, V.y0 + 26); c.lineTo(b.x + 12, V.y0 + 26); c.closePath(); c.fill();
  }
}

// ---------------- the heads ----------------
// unit space: head radius 1, facing +x. lw = outline width in units
function drawPlayer(c, p, G, t, opt) {
  const ch = CHARS[p.char], r = p.r, team = TEAM_COL[p.team];
  const b = G.ball;
  // shadow
  drawShadow(c, p.x, p.y + footOff(p), r * 0.9);
  // the shoe, behind the head when resting, in front while kicking
  const kt = p.kick.t;
  const [fx, fy, fa] = footAt(p, kt);
  const kicking = kt >= 0;
  if (ch.limbs) drawLimbs(c, p, ch, G, t, fx, fy, kicking);
  if (p.muscle > 0) drawMuscleArm(c, p, ch, t, 'back');
  if (!kicking) drawShoe(c, fx, fy, fa, p.face, team, p.scale);
  c.save();
  c.translate(p.x, p.y);
  // squash on landing, stretch while rising
  let sx = 1, sy = 1;
  if (p.landT > 0) { const k = p.landT / 0.18; sx = 1 + 0.12 * k; sy = 1 - 0.1 * k; }
  else if (!p.ground) { const k = clamp(-p.vy / 1200, -0.4, 1); sx = 1 - 0.05 * k; sy = 1 + 0.06 * k; }
  c.scale(r * p.face * sx, r * sy);
  const lw = 0.065 / Math.max(0.6, p.scale);
  // effects behind the head
  if (p.armed > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 12);
    const col = superColor(ch.sup);
    const g = c.createRadialGradient(0, 0, 0.8, 0, 0, 1.7 + pulse * 0.15);
    g.addColorStop(0, rgba(col, 0.6)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; circ(c, 0, 0, 1.85); c.fill();
  }
  if (p.giant > 0) { c.fillStyle = 'rgba(255,200,60,.18)'; circ(c, 0, 0, 1.25 + 0.05 * Math.sin(t * 8)); c.fill(); }
  // 替え玉パワー: a warm glow
  if (p.pow > 0) {
    const g = c.createRadialGradient(0, 0, 0.85, 0, 0, 1.5 + 0.06 * Math.sin(t * 10));
    g.addColorStop(0, 'rgba(255,179,71,.45)'); g.addColorStop(1, 'rgba(255,179,71,0)');
    c.fillStyle = g; circ(c, 0, 0, 1.6); c.fill();
  }
  // eyes look at the ball (in unit space, mirrored)
  let lx = (b.x - p.x) * p.face, ly = b.y - p.y;
  const ld = Math.hypot(lx, ly) || 1; lx /= ld; ly /= ld;
  const mood = moodOf(p, G, t);
  // まっかっかヘッド: the face goes bright red, and steam comes off the top
  let chd = ch;
  if (p.hot > 0) {
    const hk = clamp(Math.min((HOT_T - p.hot) / 0.25, p.hot / 0.4), 0, 1);
    chd = Object.assign({}, ch, { skin: mixHex(ch.skin, '#FF3B2F', 0.8 * hk) });
    const g = c.createRadialGradient(0, 0, 0.9, 0, 0, 1.6 + 0.08 * Math.sin(t * 14));
    g.addColorStop(0, `rgba(255,90,40,${0.45 * hk})`); g.addColorStop(1, 'rgba(255,90,40,0)');
    c.fillStyle = g; circ(c, 0, 0, 1.7); c.fill();
    if (t - (p._steamT || -9) > 0.09) { p._steamT = t; puff(p.x + (Math.random() - 0.5) * r * 0.8, p.y - r * 0.95, 1, 'rgba(255,255,255,.85)', 60, 90, 11 * Math.sqrt(p.scale), 0.7, 'smoke'); }
  }
  drawHead(c, chd, p, lw, t, lx, ly, mood);
  // just got kicked: a red flash
  const hf = 0.3 - (G.t - (p.hitAt == null ? -9 : p.hitAt));
  if (hf > 0) { c.fillStyle = `rgba(255,70,70,${Math.min(0.55, hf * 1.8)})`; circ(c, 0, 0, 1); c.fill(); }
  c.restore();
  if (kicking) drawShoe(c, fx, fy, fa, p.face, team, p.scale);
  if (p.muscle > 0) drawMuscleArm(c, p, ch, t, 'front');
  // frozen: an ice block over everything
  if (p.frz > 0) {
    const a = Math.min(1, p.frz * 3);
    c.save(); c.globalAlpha = 0.78 * a;
    rrect(c, p.x - r * 1.18, p.y - r * 1.2, r * 2.36, r * 1.2 + footOff(p) + 4, 14);
    const g = c.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
    g.addColorStop(0, 'rgba(225,248,255,.9)'); g.addColorStop(1, 'rgba(120,200,255,.75)');
    c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = '#E8FBFF'; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(p.x - r * 0.8, p.y - r * 0.9); c.lineTo(p.x - r * 0.35, p.y - r * 0.9); c.stroke();
    c.beginPath(); c.moveTo(p.x - r * 0.9, p.y - r * 0.6); c.lineTo(p.x - r * 0.75, p.y - r * 0.6); c.stroke();
    c.restore();
  }
  // stunned: stars going round
  if (p.stn > 0) {
    for (let k = 0; k < 3; k++) {
      const a = t * 6 + k * TAU / 3, sx2 = p.x + Math.cos(a) * r * 0.9, sy2 = p.y - r * 1.05 + Math.sin(a) * r * 0.22;
      starShape(c, sx2, sy2, 10, 4.5, a); fillOut(c, '#FFE14D', 2);
    }
  }
  if (p.conf > 0) {
    const bob = Math.sin(t * 8) * 4;
    outlined(c, '⇄', p.x + p.face * r * 0.95, p.y - r * 0.95 + bob, 34, '#FFF27A', 6, FONT_UI);
  }
  if (p.dash > 0 && Math.abs(p.vx) > 150) {
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3;
    for (let k = 0; k < 3; k++) { const yy = p.y - r * 0.4 + k * r * 0.45, d = -sign(p.vx); c.beginPath(); c.moveTo(p.x + d * r * 1.1, yy); c.lineTo(p.x + d * (r * 1.1 + 34), yy); c.stroke(); }
  }
  if (opt && opt.tag) drawTag(c, p, opt, t);
}

function superColor(k) {
  return { fire: '#FF6A1A', ice: '#6CD3FF', thunder: '#FFD21E', clone: '#B07BFF', giant: '#FFB21E', ghost: '#C9B8FF', rocket: '#FF4D6D', wind: '#5EE39A', dazzle: '#FFF27A', ramen: '#FFB347', stretch: '#FFC94D', muscle: '#FF9A6B', hot: '#FF4A3A' }[k] || '#FFFFFF';
}

function moodOf(p, G, t) {
  if (p.stn > 0) return 'dizzy';
  if (p.frz > 0) return 'cold';
  if (G.phase === 'goal' && G.lastGoal) return G.lastGoal.team === p.team ? 'joy' : 'sad';
  if (G.phase === 'end' && G.result) return G.result.win === p.team ? 'joy' : G.result.win < 0 ? 'calm' : 'sad';
  if (p.kick.t >= 0 && p.kick.t < 0.2) return 'yell';
  if (p.armed > 0) return 'fierce';
  if (!p.ground && p.vy < -200) return 'up';
  // blink now and then
  const bl = (t * 0.9 + p.i * 0.37) % 4;
  if (bl < 0.09) return 'blink';
  return 'calm';
}

// ムキムキうで (world space): the back arm flexing behind the head, the front one guarding or punching
function drawMuscleArm(c, p, ch, t, part) {
  const r = p.r, f = p.face, age = MUSCLE_T - p.muscle;
  const g = clamp(Math.min(age / 0.25, p.muscle / 0.3), 0, 1);
  if (g <= 0.02) return;
  const flex = age < 0.8;
  const X = (u, v) => [p.x + f * u * r, p.y + v * r];
  let S, E, F;
  if (part === 'back') {
    S = X(-0.55, 0.62);
    if (flex) { E = X(-1.62, 0.4); F = X(-1.56, -0.5); }
    else { E = X(-1.48, 0.52); F = X(-1.4, -0.3 + Math.sin(t * 6) * 0.05); }
  } else {
    S = X(0.5, 0.68);
    F = fistAt(p, p.kick.t);
    if (flex) E = X(1.62, 0.42);
    else {
      const ext = clamp(((F[0] - p.x) * f / r - 1.26) / 0.95, 0, 1);   // the elbow straightens as it punches
      E = X(1.12 + 0.28 * ext, 1.02 - 0.5 * ext);
    }
  }
  const skin = part === 'back' ? mix(ch.skin, '#7A5040', 0.16) : ch.skin;
  const w1 = 0.64 * r * g, w2 = 0.5 * r * g, fr = FIST_R * r * (0.6 + 0.4 * g);
  const ux = E[0] - S[0], uy = E[1] - S[1], ul = Math.hypot(ux, uy) || 1;
  let nx = -uy / ul, ny = ux / ul; if (ny > 0) { nx = -nx; ny = -ny; }
  const pump = flex ? 1 + 0.1 * Math.sin(t * 20) : 1;
  const bx = S[0] + ux * 0.52 + nx * w1 * 0.34, by = S[1] + uy * 0.52 + ny * w1 * 0.34, rot = Math.atan2(uy, ux);
  const brx = ul * 0.42 * pump, bry = w1 * 0.72 * pump;
  const seg = (A, B) => { c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  // outlines first, then the skin over them, so it reads as one arm
  c.strokeStyle = OUT; c.fillStyle = OUT;
  c.lineWidth = w1 + 5; seg(S, E);
  c.lineWidth = w2 + 5; seg(E, F);
  ell(c, bx, by, brx + 2.5, bry + 2.5, rot); c.fill();
  circ(c, F[0], F[1], fr + 2.5); c.fill();
  c.strokeStyle = skin; c.fillStyle = skin;
  c.lineWidth = w1; seg(S, E);
  c.lineWidth = w2; seg(E, F);
  ell(c, bx, by, brx, bry, rot); c.fill();
  circ(c, F[0], F[1], fr); c.fill();
  // the muscle line, a shine and the knuckles
  c.strokeStyle = 'rgba(130,70,50,.5)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(bx - nx * bry * 0.15, by - ny * bry * 0.15, brx * 0.6, bry * 0.5, rot, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.45)'; ell(c, bx + nx * bry * 0.45 - ux / ul * brx * 0.2, by + ny * bry * 0.45 - uy / ul * brx * 0.2, brx * 0.32, bry * 0.16, rot); c.fill();
  c.strokeStyle = 'rgba(130,70,50,.55)'; c.lineWidth = 1.8;
  const kx = F[0] + f * fr * 0.45;
  for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(kx, F[1] + k * fr * 0.36 - fr * 0.12); c.lineTo(kx + f * fr * 0.3, F[1] + k * fr * 0.36 - fr * 0.12); c.stroke(); }
  if (flex) {
    c.fillStyle = 'rgba(255,255,255,.9)';
    starShape(c, bx + nx * bry * 1.4, by + ny * bry * 1.4, 7, 2.6, t * 4); c.fill();
  }
}

// ゆうき: long arms in rolled-up white sleeves, one long leg, and an apron (world space)
function drawLimbs(c, p, ch, G, t, fx, fy, kicking) {
  const r = p.r, k = Math.sqrt(p.scale), f = p.face, mood = moodOf(p, G, t);
  const grow = Math.sqrt((p.legK || 1) / (ch.leg || 1));       // the arms stretch with the super too
  const A = r * 1.3 * grow;
  const run = clamp(Math.abs(p.vx) / 320, 0, 1), sw = Math.sin(t * 13 + p.i) * 0.75 * run * (p.ground ? 1 : 0.3);
  // arm angles from straight down, + toward the face
  let af, ab;
  if (p.frz > 0) { af = 0.3; ab = -0.3; }
  else if (mood === 'joy') { af = 2.2 + Math.sin(t * 11) * 0.22; ab = -2.2 - Math.sin(t * 11 + 1) * 0.22; }
  else if (mood === 'dizzy') { af = Math.sin(t * 9) * 1.9; ab = Math.cos(t * 8) * 1.9; }
  else if (mood === 'sad') { af = 0.05; ab = -0.05; }
  else if (kicking) { const u = Math.min(1, p.kick.t / KICK_FWD); af = 0.2 - 1.1 * u; ab = -0.2 + 1.3 * u; }
  else if (!p.ground) { const up = clamp(-p.vy / 700, -0.3, 1); af = 0.5 + 1.6 * up; ab = -0.5 - 1.6 * up; }
  else { const idle = Math.sin(t * 2.1 + p.i) * 0.05; af = 0.16 + sw + idle; ab = -0.18 - sw - idle; }
  const dirv = a => [f * Math.sin(a), Math.cos(a)];
  const w = 8.5 * k;
  const arm = (sx, sy, ang, back) => {
    const x0 = p.x + f * sx * r, y0 = p.y + sy * r;
    const [ux, uy] = dirv(ang - 0.14), [vx, vy] = dirv(ang + 0.26);
    const ex = x0 + ux * A * 0.5, ey = y0 + uy * A * 0.5, hx = ex + vx * A * 0.5, hy = ey + vy * A * 0.5;
    const skin = back ? mix(ch.skin, '#7A5A48', 0.18) : ch.skin, shirt = back ? '#DCDCD3' : '#F7F7F1';
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = OUT; c.lineWidth = w + 5;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
    c.strokeStyle = skin; c.lineWidth = w;
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(hx, hy); c.stroke();
    c.strokeStyle = shirt;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex, ey); c.lineTo(ex + (hx - ex) * 0.22, ey + (hy - ey) * 0.22); c.stroke();
    if (!back) {
      // a thin dark band on the wrist
      const bx = ex + (hx - ex) * 0.78, by = ey + (hy - ey) * 0.78, nx = -(hy - ey), ny = hx - ex, nd = Math.hypot(nx, ny) || 1;
      c.strokeStyle = '#1E1E24'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(bx + nx / nd * w * 0.5, by + ny / nd * w * 0.5); c.lineTo(bx - nx / nd * w * 0.5, by - ny / nd * w * 0.5); c.stroke();
    }
    circ(c, hx, hy, w * 0.7); fillOut(c, skin, 2.4);
  };
  arm(-0.44, 0.74, ab, true);
  // the leg, from the hip to the shoe
  const [hx, hy] = pivotOf(p);
  c.lineCap = 'round';
  c.strokeStyle = OUT; c.lineWidth = 13 * k + 5;
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(fx, fy); c.stroke();
  c.strokeStyle = '#2B2B33'; c.lineWidth = 13 * k;
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(fx, fy); c.stroke();
  // the apron, hanging from the waist (its top is hidden by the head)
  const L = legLen(p), top = p.y + r * 0.55, bot = p.y + r + Math.min(L * 0.2, r * 0.42);
  const sway = clamp(-p.vx * f / 900, -0.25, 0.25) * r;
  c.beginPath();
  c.moveTo(hx - f * r * 0.5, top); c.lineTo(hx + f * r * 0.56, top);
  c.lineTo(hx + f * r * 0.62 + sway, bot); c.lineTo(hx - f * r * 0.58 + sway, bot); c.closePath();
  fillOut(c, '#CDB88B', 3);
  c.strokeStyle = 'rgba(110,90,50,.55)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(hx + f * r * 0.04 + sway * 0.6, p.y + r * 1.02); c.lineTo(hx + f * r * 0.04 + sway, bot - 1); c.stroke();
  arm(0.36, 0.82, af, false);
}

function drawHead(c, ch, p, lw, t, lx, ly, mood) {
  const look = ch.look;
  // --- behind the head ---
  if (look === 'spiky') {
    const g = c.createLinearGradient(0, -1.6, 0, 0);
    g.addColorStop(0, ch.hair2); g.addColorStop(1, ch.hair);
    c.beginPath();
    const n = 7;
    for (let k = 0; k <= n * 2; k++) {
      const a = Math.PI * 1.02 + (k / (n * 2)) * Math.PI * 1.02, rr = k % 2 ? 1.0 : 1.5 - Math.abs(k - n) * 0.03;
      const wob = k % 2 ? 0 : Math.sin(t * 7 + k) * 0.04;
      c.lineTo(Math.cos(a) * (rr + wob) - 0.08, Math.sin(a) * (rr + wob) + 0.02);
    }
    c.closePath(); fillOut(c, g, lw);
  } else if (look === 'bob') {
    c.beginPath(); c.moveTo(0.92, -0.3); c.bezierCurveTo(1.05, -1.25, -0.95, -1.45, -1.12, -0.35);
    c.bezierCurveTo(-1.2, 0.2, -1.12, 0.66, -0.78, 0.74); c.quadraticCurveTo(-0.5, 0.78, -0.3, 0.6); c.lineTo(0.2, -0.2); c.closePath();
    fillOut(c, ch.hair, lw);
  } else if (look === 'cloud') {
    c.fillStyle = ch.hair;
    const pts = [[-0.95, -0.25, 0.36], [-0.8, -0.7, 0.4], [-0.4, -0.98, 0.42], [0.1, -1.05, 0.42], [0.55, -0.88, 0.38], [0.85, -0.55, 0.3]];
    for (const [x, y, rr] of pts) { circ(c, x, y, rr); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); }
    for (const [x, y, rr] of pts) { circ(c, x, y, rr - lw / 2); c.fill(); }
    // horns
    for (const [x, y, a] of [[-0.35, -1.32, -0.3], [0.38, -1.3, 0.3]]) {
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); c.moveTo(-0.12, 0.12); c.lineTo(0, -0.3); c.lineTo(0.12, 0.12); c.closePath(); fillOut(c, ch.hair2, lw * 0.8);
      c.restore();
    }
  } else if (look === 'ninja') {
    const fl = Math.sin(t * 9) * 0.12 - clamp(p.vx * p.face / 900, -0.4, 0.4) * 0.3;
    for (const [dy, len] of [[-0.05, 0.9], [0.18, 0.75]]) {
      c.beginPath(); c.moveTo(-0.85, -0.38 + dy * 0.3); c.quadraticCurveTo(-1.25, -0.3 + dy + fl, -0.85 - len, -0.1 + dy + fl * 1.8);
      c.lineTo(-0.82 - len * 0.9, 0.04 + dy + fl * 1.6); c.quadraticCurveTo(-1.2, -0.12 + dy + fl, -0.85, -0.22 + dy * 0.3); c.closePath();
      fillOut(c, '#C9312C', lw * 0.8);
    }
  } else if (look === 'ghost') {
    const wv = Math.sin(t * 5) * 0.08;
    c.beginPath(); c.moveTo(-0.55, 0.65); c.quadraticCurveTo(-1.1, 0.9 + wv, -1.45, 0.55 + wv);
    c.quadraticCurveTo(-1.3, 1.05 + wv, -0.95, 1.05); c.quadraticCurveTo(-0.6, 1.1, -0.2, 0.9); c.closePath();
    fillOut(c, ch.skin, lw);
  } else if (look === 'wind') {
    const g = c.createLinearGradient(0.6, -1, -1.6, 0);
    g.addColorStop(0, ch.hair); g.addColorStop(1, ch.hair2);
    const fl = Math.sin(t * 8) * 0.06 + clamp(Math.abs(p.vx) / 500, 0, 1) * 0.15;
    c.beginPath(); c.moveTo(0.7, -0.75);
    c.quadraticCurveTo(0.1, -1.35, -0.7, -1.05);
    c.lineTo(-1.55 - fl, -0.95); c.lineTo(-1.0, -0.62); c.lineTo(-1.62 - fl, -0.45); c.lineTo(-0.98, -0.25);
    c.lineTo(-1.45 - fl, 0.05); c.lineTo(-0.85, 0.15); c.closePath();
    fillOut(c, g, lw);
  } else if (look === 'shades') {
    // a shaggy, wavy mop down past the ears, the ends flicking out
    c.beginPath();
    c.moveTo(0.92, 0.16);
    c.quadraticCurveTo(1.2, 0.34, 1.14, 0.02);
    c.quadraticCurveTo(1.2, -0.42, 0.9, -0.8);
    c.quadraticCurveTo(0.74, -1.16, 0.3, -1.14);
    c.quadraticCurveTo(0.02, -1.34, -0.32, -1.16);
    c.quadraticCurveTo(-0.8, -1.12, -0.98, -0.78);
    c.quadraticCurveTo(-1.3, -0.48, -1.16, -0.1);
    c.quadraticCurveTo(-1.28, 0.3, -1.1, 0.56);
    c.quadraticCurveTo(-1.22, 0.82, -1.36, 0.8);
    c.quadraticCurveTo(-1.02, 0.98, -0.74, 0.64);
    c.lineTo(-0.3, 0.3); c.lineTo(0.6, 0.0); c.closePath();
    fillOut(c, ch.hair, lw);
    c.strokeStyle = ch.hair2; c.lineWidth = lw * 0.9; c.lineCap = 'round';
    for (const [x0, y0, x1, y1, x2, y2] of [[-1.16, -0.05, -0.98, 0.22, -1.1, 0.5], [-0.92, -0.72, -0.66, -0.6, -0.74, -0.3], [-0.36, -1.08, -0.1, -0.94, 0.12, -1.06], [0.62, -1.0, 0.86, -0.86, 0.98, -0.6]]) {
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x1, y1, x2, y2); c.stroke();
    }
  } else if (look === 'curtain') {
    // sleek black hair, parted in the middle, the sides grown down past the cheeks
    c.beginPath();
    c.moveTo(1.0, 0.36);
    c.quadraticCurveTo(1.16, -0.3, 0.88, -0.82);
    c.quadraticCurveTo(0.52, -1.2, 0.02, -1.17);
    c.quadraticCurveTo(-0.62, -1.18, -0.98, -0.72);
    c.quadraticCurveTo(-1.21, -0.3, -1.15, 0.22);
    c.quadraticCurveTo(-1.1, 0.52, -0.84, 0.64);
    c.lineTo(-0.3, 0.3); c.lineTo(0.7, 0.1); c.closePath();
    fillOut(c, ch.hair, lw);
    c.strokeStyle = ch.hair2; c.lineWidth = lw * 1.1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-0.6, -1.0); c.quadraticCurveTo(-0.98, -0.68, -1.02, -0.2); c.stroke();
  } else if (look === 'longhair') {
    // long, straight, bleached hair down to the jaw, dark at the roots
    c.beginPath();
    c.moveTo(1.02, 0.66);
    c.quadraticCurveTo(1.18, 0.02, 1.02, -0.58);
    c.quadraticCurveTo(0.8, -1.18, 0.22, -1.17);
    c.quadraticCurveTo(-0.5, -1.3, -0.96, -0.86);
    c.quadraticCurveTo(-1.26, -0.4, -1.22, 0.3);
    c.lineTo(-1.18, 1.0);
    c.quadraticCurveTo(-0.92, 1.08, -0.62, 0.98);
    c.lineTo(-0.3, 0.3); c.lineTo(0.7, 0.2); c.closePath();
    fillOut(c, longHairFill(c, ch), lw);
    c.strokeStyle = mix(ch.hair, '#7A5A30', 0.35); c.lineWidth = lw * 0.8; c.lineCap = 'round';
    for (const [x0, y0, x1, y1] of [[-0.98, -0.5, -1.02, 0.86], [-0.8, -0.2, -0.82, 0.92], [0.98, -0.2, 0.96, 0.5]]) {
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 - 0.06, (y0 + y1) / 2, x1, y1); c.stroke();
    }
  } else if (look === 'center') {
    // sleek, full black hair over the ears and down the nape
    c.beginPath();
    c.moveTo(0.96, -0.16);
    c.quadraticCurveTo(1.14, -0.86, 0.5, -1.13);
    c.quadraticCurveTo(-0.24, -1.34, -0.84, -0.95);
    c.quadraticCurveTo(-1.24, -0.55, -1.18, -0.02);
    c.quadraticCurveTo(-1.17, 0.42, -0.9, 0.64);
    c.quadraticCurveTo(-0.72, 0.74, -0.6, 0.6);
    c.lineTo(-0.3, 0.3); c.lineTo(0.6, 0.0); c.closePath();
    fillOut(c, ch.hair, lw);
    c.strokeStyle = ch.hair2; c.lineWidth = lw * 1.1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-0.62, -0.98); c.quadraticCurveTo(-1.0, -0.62, -1.02, -0.18); c.stroke();
    c.beginPath(); c.moveTo(-0.98, 0.12); c.quadraticCurveTo(-1.0, 0.36, -0.84, 0.52); c.stroke();
  } else if (look === 'robot') {
    c.strokeStyle = OUT; c.lineWidth = lw * 1.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-0.25, -0.95); c.lineTo(-0.38, -1.42); c.stroke();
    const glow = 0.6 + 0.4 * Math.sin(t * 6);
    c.fillStyle = rgba(ch.hair2, 0.35 * glow); circ(c, -0.38, -1.5, 0.24); c.fill();
    circ(c, -0.38, -1.5, 0.12); fillOut(c, ch.hair2, lw * 0.8);
  }
  // --- the face ---
  if (look === 'robot') {
    const g = c.createLinearGradient(-0.6, -1, 0.6, 1);
    g.addColorStop(0, '#E4EBF4'); g.addColorStop(1, ch.skin);
    circ(c, 0, 0, 1); fillOut(c, g, lw);
  } else {
    circ(c, 0, 0, 1); fillOut(c, ch.skin, lw);
    // a little roundness
    const g = c.createRadialGradient(-0.35, -0.45, 0.1, 0, 0, 1.05);
    g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.10)');
    circ(c, 0, 0, 1 - lw / 2); c.fillStyle = g; c.fill();
  }
  // --- over the face ---
  c.save(); circ(c, 0, 0, 1 - lw * 0.45); c.clip();
  if (look === 'spiky') {
    c.beginPath(); c.moveTo(-1.1, -1.2); c.lineTo(1.1, -1.2); c.lineTo(1.1, -0.55);
    for (let k = 0; k <= 6; k++) c.lineTo(1.0 - k * 0.36, k % 2 ? -0.4 : -0.62);
    c.lineTo(-1.1, -0.2); c.closePath(); c.fillStyle = ch.hair; c.fill();
    c.fillStyle = '#FFFFFF'; c.fillRect(-1.1, -0.5, 2.2, 0.17);
    c.fillStyle = '#E5322D'; circ(c, 0.55, -0.41, 0.07); c.fill();
  } else if (look === 'bob') {
    c.beginPath(); c.moveTo(-1.1, -1.2); c.lineTo(1.1, -1.2); c.lineTo(1.1, -0.42);
    c.quadraticCurveTo(0.85, -0.3, 0.7, -0.44); c.quadraticCurveTo(0.5, -0.28, 0.28, -0.42); c.quadraticCurveTo(0.05, -0.26, -0.2, -0.42);
    c.quadraticCurveTo(-0.42, -0.1, -0.5, 0.45); c.lineTo(-1.1, 0.6); c.closePath(); c.fillStyle = ch.hair; c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; ell(c, 0.1, -0.72, 0.4, 0.08, -0.15); c.fill();
  } else if (look === 'cloud') {
    c.fillStyle = ch.hair; c.fillRect(-1.1, -1.2, 2.2, 0.52);
  } else if (look === 'ninja') {
    c.fillStyle = ch.hair; c.fillRect(-1.2, -1.2, 2.4, 2.4);
    c.fillStyle = ch.skin; rrect(c, -0.2, -0.36, 1.4, 0.5, 0.2); c.fill();
    c.fillStyle = mix(ch.hair, '#000000', 0.3); c.fillRect(-1.2, 0.14, 2.4, 0.05);
  } else if (look === 'sumo') {
    c.beginPath(); c.moveTo(-1.1, -1.2); c.lineTo(0.9, -1.2); c.lineTo(0.9, -0.66); c.quadraticCurveTo(0.35, -0.72, -0.2, -0.55);
    c.quadraticCurveTo(-0.55, -0.4, -0.62, -0.05); c.lineTo(-0.66, 0.22); c.lineTo(-1.1, 0.3); c.closePath(); c.fillStyle = ch.hair; c.fill();
    c.fillStyle = 'rgba(255,255,255,.22)'; ell(c, -0.25, -0.82, 0.42, 0.07, -0.3); c.fill();
  } else if (look === 'ghost') {
    c.fillStyle = 'rgba(200,190,255,.25)'; ell(c, -0.5, 0.5, 0.7, 0.6); c.fill();
  } else if (look === 'robot') {
    c.strokeStyle = 'rgba(40,50,70,.35)'; c.lineWidth = lw * 0.7;
    c.beginPath(); c.moveTo(-1, 0.32); c.lineTo(1, 0.32); c.stroke();
    c.fillStyle = '#1F2A3C'; rrect(c, -0.18, -0.4, 1.3, 0.48, 0.2); c.fill();
  } else if (look === 'shades') {
    // shaggy bangs
    c.beginPath(); c.moveTo(-1.1, -1.2); c.lineTo(1.1, -1.2); c.lineTo(1.1, -0.46);
    c.quadraticCurveTo(0.92, -0.32, 0.8, -0.5); c.quadraticCurveTo(0.62, -0.66, 0.46, -0.42); c.quadraticCurveTo(0.26, -0.28, 0.1, -0.5);
    c.quadraticCurveTo(-0.08, -0.64, -0.26, -0.38); c.quadraticCurveTo(-0.42, -0.1, -0.5, 0.35); c.lineTo(-1.1, 0.55); c.closePath();
    c.fillStyle = ch.hair; c.fill();
    c.strokeStyle = ch.hair2; c.lineWidth = lw * 0.8;
    c.beginPath(); c.moveTo(-0.45, -0.95); c.quadraticCurveTo(-0.2, -0.72, -0.02, -0.86); c.stroke();
    c.beginPath(); c.moveTo(0.22, -0.98); c.quadraticCurveTo(0.46, -0.76, 0.64, -0.9); c.stroke();
  } else if (look === 'curtain') {
    // heavy curtain bangs from a middle part, reaching the cheeks on both sides
    c.beginPath(); c.moveTo(-1.1, -1.2); c.lineTo(1.1, -1.2); c.lineTo(1.1, 0.22); c.lineTo(0.95, 0.26);
    c.quadraticCurveTo(0.92, -0.1, 0.82, -0.36);
    c.quadraticCurveTo(0.62, -0.64, 0.4, -0.84);
    c.quadraticCurveTo(0.22, -0.6, -0.02, -0.44);
    c.quadraticCurveTo(-0.24, -0.3, -0.34, -0.1);
    c.quadraticCurveTo(-0.42, 0.12, -0.4, 0.34);
    c.quadraticCurveTo(-0.5, 0.44, -0.62, 0.42);
    c.lineTo(-1.1, 0.62); c.closePath();
    c.fillStyle = ch.hair; c.fill();
    c.strokeStyle = ch.hair2; c.lineWidth = lw * 1.1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0.28, -0.98); c.quadraticCurveTo(0.08, -0.7, -0.22, -0.46); c.stroke();
    c.beginPath(); c.moveTo(0.54, -0.98); c.quadraticCurveTo(0.74, -0.7, 0.86, -0.3); c.stroke();
  } else if (look === 'longhair') {
    // parted in the middle; straight curtains frame the face down to the jaw on both sides
    c.beginPath(); c.moveTo(-1.1, -1.2); c.lineTo(1.1, -1.2); c.lineTo(1.1, 0.75); c.lineTo(0.93, 0.75);
    c.quadraticCurveTo(0.9, 0.05, 0.86, -0.34);
    c.quadraticCurveTo(0.66, -0.62, 0.42, -0.9);
    c.quadraticCurveTo(0.24, -0.62, 0.0, -0.46);
    c.quadraticCurveTo(-0.22, -0.3, -0.38, -0.24);
    c.quadraticCurveTo(-0.5, 0.16, -0.52, 0.86);
    c.lineTo(-1.1, 0.95); c.closePath();
    c.fillStyle = longHairFill(c, ch); c.fill();
    c.strokeStyle = mix(ch.hair, '#7A5A30', 0.35); c.lineWidth = lw * 0.8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0.3, -0.96); c.quadraticCurveTo(0.1, -0.66, -0.2, -0.5); c.stroke();
    c.beginPath(); c.moveTo(0.56, -0.96); c.quadraticCurveTo(0.74, -0.66, 0.86, -0.1); c.stroke();
    c.beginPath(); c.moveTo(-0.46, -0.3); c.quadraticCurveTo(-0.6, 0.2, -0.62, 0.84); c.stroke();
  } else if (look === 'center') {
    // curtain bangs: parted in the middle of the forehead, falling to both sides
    c.beginPath(); c.moveTo(-1.1, -1.2); c.lineTo(1.1, -1.2); c.lineTo(1.1, -0.34);
    c.quadraticCurveTo(0.94, -0.26, 0.82, -0.4);
    c.quadraticCurveTo(0.6, -0.6, 0.41, -0.86);
    c.quadraticCurveTo(0.27, -0.6, 0.06, -0.44);
    c.quadraticCurveTo(-0.14, -0.3, -0.32, -0.34);
    c.quadraticCurveTo(-0.52, -0.1, -0.58, 0.42);
    c.lineTo(-1.1, 0.62); c.closePath();
    c.fillStyle = ch.hair; c.fill();
    // the shine on each side of the part
    c.strokeStyle = ch.hair2; c.lineWidth = lw * 1.1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0.3, -0.98); c.quadraticCurveTo(0.12, -0.66, -0.16, -0.56); c.stroke();
    c.beginPath(); c.moveTo(0.54, -0.98); c.quadraticCurveTo(0.7, -0.72, 0.9, -0.6); c.stroke();
    c.beginPath(); c.moveTo(-0.5, -0.72); c.quadraticCurveTo(-0.62, -0.4, -0.66, 0.0); c.stroke();
  } else if (look === 'wind') {
    c.beginPath(); c.moveTo(-1.1, -1.2); c.lineTo(1.1, -1.2); c.lineTo(1.1, -0.62);
    c.quadraticCurveTo(0.7, -0.48, 0.4, -0.6); c.quadraticCurveTo(0.05, -0.42, -0.3, -0.55); c.lineTo(-1.1, -0.1); c.closePath();
    c.fillStyle = ch.hair; c.fill();
    // goggles strap
    c.fillStyle = '#3A3F55'; c.fillRect(-1.1, -0.78, 2.2, 0.12);
  }
  c.restore();
  // re-outline over the clipped parts
  circ(c, 0, 0, 1); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke();
  // --- accessories on top ---
  if (look === 'bob') {
    // earmuff + snowflake pin
    c.lineWidth = lw * 1.6; c.strokeStyle = '#FF9DBB'; c.beginPath(); c.arc(-0.12, 0.1, 1.08, -2.75, -1.35); c.stroke();
    circ(c, -0.86, -0.12, 0.3); fillOut(c, '#FFFFFF', lw * 0.8);
    c.fillStyle = 'rgba(255,157,187,.55)'; circ(c, -0.86, -0.12, 0.16); c.fill();
    starShape(c, 0.62, -0.62, 0.15, 0.06, t * 0.5); fillOut(c, '#FFFFFF', lw * 0.6);
  } else if (look === 'sumo') {
    c.save(); c.translate(0.08, -1.02); c.rotate(-0.12);
    c.beginPath(); c.moveTo(-0.5, 0.08); c.quadraticCurveTo(-0.3, -0.24, 0.12, -0.2); c.quadraticCurveTo(0.6, -0.18, 0.62, 0.02);
    c.quadraticCurveTo(0.4, 0.12, 0.1, 0.04); c.quadraticCurveTo(-0.2, 0.0, -0.5, 0.08); c.closePath(); fillOut(c, ch.hair, lw);
    c.fillStyle = '#FFFFFF'; c.fillRect(-0.16, -0.2, 0.09, 0.22);
    c.restore();
    // round cheeks
    c.strokeStyle = 'rgba(160,90,60,.35)'; c.lineWidth = lw * 0.8; c.beginPath(); c.arc(0.45, 0.62, 0.32, 0.3, 2.6); c.stroke();
  } else if (look === 'ninja') {
    c.fillStyle = '#9AA3B5'; rrect(c, -0.95, -0.66, 1.92, 0.24, 0.08); c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = OUT; c.stroke();
    rrect(c, 0.25, -0.72, 0.5, 0.36, 0.06); fillOut(c, '#DCE2EC', lw * 0.7);
    c.strokeStyle = '#5B6478'; c.lineWidth = lw * 0.6; c.beginPath(); c.arc(0.5, -0.54, 0.09, 0, 5); c.stroke();
  } else if (look === 'ghost') {
    c.strokeStyle = OUT; c.lineWidth = lw; c.beginPath(); c.moveTo(0.05, -0.98); c.quadraticCurveTo(0.2, -1.4, 0.45, -1.2); c.quadraticCurveTo(0.6, -1.05, 0.4, -1.0); c.stroke();
  } else if (look === 'wind') {
    for (const [x, y] of [[0.25, -0.64], [0.66, -0.62]]) { circ(c, x, y, 0.19); fillOut(c, '#FF9F2E', lw * 0.8); circ(c, x, y, 0.11); c.fillStyle = '#9FE6FF'; c.fill(); }
    c.fillStyle = 'rgba(160,90,40,.55)';
    for (const [x, y] of [[0.42, 0.22], [0.55, 0.28], [0.36, 0.33]]) { circ(c, x, y, 0.035); c.fill(); }
  } else if (look === 'cloud') {
    // a small bolt in the hair
    c.save(); c.translate(-0.55, -0.85); c.scale(0.5, 0.5);
    c.beginPath(); c.moveTo(0.1, -0.5); c.lineTo(-0.25, 0.05); c.lineTo(0.02, 0.05); c.lineTo(-0.15, 0.5); c.lineTo(0.3, -0.12); c.lineTo(0.02, -0.12); c.closePath();
    fillOut(c, ch.hair2, lw * 1.4); c.restore();
  } else if (look === 'robot') {
    c.fillStyle = '#7D8DA3'; for (const [x, y] of [[-0.75, 0.05], [-0.62, 0.55], [0.85, 0.5]]) { circ(c, x, y, 0.06); c.fill(); }
  }
  drawFace(c, ch, look, lw, t, lx, ly, mood, p.hot > 0);
  if (look === 'shades') drawShades(c, lw, t, lx, ly, mood);
}

function drawFace(c, ch, look, lw, t, lx, ly, mood, hot) {
  const eyes = look === 'ninja' ? [[0.2, -0.12], [0.66, -0.12]] : [[0.16, -0.1], [0.62, -0.1]];
  const robot = look === 'robot';
  if (look === 'shades') { drawShadesFace(c, lw, mood); return; }
  if (look === 'center') { drawCenterFace(c, lw, t, lx, ly, mood); return; }
  if (look === 'longhair') { drawLongFace(c, lw, t, lx, ly, mood); return; }
  if (look === 'curtain') { drawTomoFace(c, lw, t, lx, ly, mood, hot); return; }
  // cheeks
  if (look === 'bob' || look === 'ghost' || look === 'sumo') {
    c.fillStyle = look === 'sumo' ? 'rgba(255,120,120,.45)' : 'rgba(255,140,170,.5)';
    ell(c, 0.72, 0.26, 0.16, 0.1); c.fill(); if (look === 'sumo') { ell(c, 0.05, 0.3, 0.18, 0.12); c.fill(); }
  }
  // eyes
  for (let i = 0; i < 2; i++) {
    const [ex, ey] = eyes[i], back = i === 0, sz = back ? 0.92 : 1;
    if (robot) {
      const on = mood === 'dizzy' ? '#FF6B6B' : mood === 'cold' ? '#9EDCFF' : '#45E0FF';
      c.fillStyle = on;
      if (mood === 'blink') { c.fillRect(ex - 0.12, ey - 0.02, 0.26, 0.05); continue; }
      rrect(c, ex - 0.11 + lx * 0.06, ey - 0.09 + ly * 0.04, 0.24, 0.18 * (mood === 'joy' ? 0.5 : 1), 0.05); c.fill();
      continue;
    }
    if (mood === 'blink' || mood === 'joy') {
      c.strokeStyle = OUT; c.lineWidth = lw * 1.1; c.lineCap = 'round';
      c.beginPath();
      if (mood === 'joy') c.arc(ex, ey + 0.06, 0.13 * sz, Math.PI * 1.1, Math.PI * 1.9); else { c.moveTo(ex - 0.14, ey + 0.02); c.lineTo(ex + 0.14, ey + 0.02); }
      c.stroke(); continue;
    }
    if (mood === 'dizzy') {
      c.strokeStyle = OUT; c.lineWidth = lw * 0.9; c.beginPath();
      for (let k = 0; k < 18; k++) { const a = k * 0.7 + t * 9, rr = 0.02 + k * 0.008; c.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); }
      c.stroke(); continue;
    }
    const narrow = look === 'ninja' || look === 'sumo' ? 0.72 : 1;
    const ry = (mood === 'up' ? 0.25 : mood === 'sad' ? 0.17 : mood === 'cold' ? 0.12 : 0.22) * sz * narrow, rx = 0.17 * sz;
    if (look === 'ghost') {
      ell(c, ex, ey, rx * 1.05, ry * 1.15); c.fillStyle = '#1B2030'; c.fill();
      c.fillStyle = '#FFFFFF'; circ(c, ex - 0.05 + lx * 0.04, ey - 0.07, 0.06); c.fill();
      continue;
    }
    ell(c, ex, ey, rx, ry); fillOut(c, '#FFFFFF', lw * 0.7);
    const px = ex + lx * rx * 0.45, py = ey + ly * ry * 0.4;
    c.fillStyle = look === 'bob' ? '#3B6FB5' : look === 'wind' ? '#2F7A4B' : '#1B2030';
    circ(c, px, py, 0.095 * sz); c.fill();
    c.fillStyle = '#FFFFFF'; circ(c, px - 0.03, py - 0.035, 0.03); c.fill();
    if (mood === 'cold') { c.fillStyle = 'rgba(120,200,255,.5)'; ell(c, ex, ey - ry * 0.4, rx, ry * 0.6); c.fill(); }
  }
  // brows
  if (!robot && look !== 'ghost') {
    c.strokeStyle = look === 'bob' ? '#7FA7C9' : look === 'cloud' ? '#2B2140' : OUT;
    c.lineWidth = lw * (look === 'cloud' || look === 'sumo' ? 2.2 : 1.3); c.lineCap = 'round';
    const fierce = mood === 'fierce' || mood === 'yell' || look === 'spiky' || look === 'ninja';
    const sad = mood === 'sad' || mood === 'cold';
    for (const [ex, ey] of eyes) {
      c.beginPath();
      if (sad) { c.moveTo(ex - 0.14, ey - 0.3); c.lineTo(ex + 0.14, ey - 0.36); }
      else if (fierce) { c.moveTo(ex - 0.15, ey - 0.38); c.lineTo(ex + 0.13, ey - 0.29); }
      else { c.moveTo(ex - 0.14, ey - 0.34); c.quadraticCurveTo(ex, ey - 0.4, ex + 0.14, ey - 0.33); }
      c.stroke();
    }
  }
  // mouth
  if (look === 'ninja') return;
  const mx = 0.5, my = robot ? 0.52 : 0.45;
  c.strokeStyle = OUT; c.lineWidth = lw; c.lineCap = 'round';
  if (look === 'cloud') {
    // a mustache over everything
    c.fillStyle = '#2B2140';
    c.beginPath(); c.moveTo(0.18, 0.32); c.quadraticCurveTo(0.45, 0.18, 0.62, 0.26); c.quadraticCurveTo(0.85, 0.18, 1.0, 0.34);
    c.quadraticCurveTo(0.8, 0.38, 0.62, 0.34); c.quadraticCurveTo(0.4, 0.42, 0.18, 0.32); c.fill();
  }
  if (robot) {
    c.strokeStyle = '#5A6A82'; c.lineWidth = lw * 0.8;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(0.3 + k * 0.16, my - 0.06); c.lineTo(0.3 + k * 0.16, my + 0.06); c.stroke(); }
    return;
  }
  if (mood === 'yell' || mood === 'up' || mood === 'dizzy') {
    ell(c, mx, my + 0.02, 0.13, mood === 'yell' ? 0.14 : 0.1); fillOut(c, '#7A2430', lw * 0.8);
    if (mood === 'yell') { c.fillStyle = '#FF8E9E'; ell(c, mx, my + 0.08, 0.07, 0.04); c.fill(); }
  } else if (mood === 'joy') {
    c.beginPath(); c.moveTo(mx - 0.2, my - 0.04); c.quadraticCurveTo(mx, my + 0.28, mx + 0.22, my - 0.06); c.closePath(); fillOut(c, '#7A2430', lw * 0.8);
  } else if (mood === 'sad' || mood === 'cold') {
    c.beginPath(); c.moveTo(mx - 0.14, my + 0.08); c.quadraticCurveTo(mx, my - 0.06, mx + 0.15, my + 0.08); c.stroke();
    if (mood === 'cold') { c.beginPath(); c.moveTo(mx - 0.12, my + 0.12); c.lineTo(mx + 0.12, my + 0.12); c.stroke(); }
  } else if (mood === 'fierce') {
    c.beginPath(); c.moveTo(mx - 0.16, my); c.lineTo(mx + 0.16, my - 0.02); c.stroke();
  } else {
    c.beginPath(); c.moveTo(mx - 0.15, my - 0.01); c.quadraticCurveTo(mx, my + 0.11, mx + 0.16, my - 0.03); c.stroke();
    if (look === 'ghost') { c.fillStyle = '#FF7FA8'; ell(c, mx + 0.03, my + 0.1, 0.07, 0.09); c.fill(); }
  }
}

function drawShadesFace(c, lw, mood) {
  // brows peeking over the frames
  c.strokeStyle = OUT; c.lineWidth = lw * 1.7; c.lineCap = 'round';
  const lift = mood === 'up' || mood === 'yell' ? -0.06 : mood === 'sad' || mood === 'cold' ? 0.03 : 0;
  for (const [ex, ey] of [[0.13, -0.08], [0.67, -0.08]]) {
    c.beginPath(); c.moveTo(ex - 0.15, ey - 0.4 + lift); c.quadraticCurveTo(ex, ey - 0.48 + lift, ex + 0.15, ey - 0.41 + lift); c.stroke();
  }
  // nose
  c.lineWidth = lw * 0.8;
  c.beginPath(); c.moveTo(0.44, 0.1); c.quadraticCurveTo(0.53, 0.22, 0.42, 0.25); c.stroke();
  // the half-open mouth, top teeth showing
  const mx = 0.48, my = 0.48;
  const open = mood === 'yell' || mood === 'up' || mood === 'dizzy' ? 0.2 : mood === 'joy' ? 0.15 : mood === 'sad' ? 0.06 : 0.1;
  c.save();
  c.beginPath(); c.moveTo(mx - 0.21, my - 0.02); c.quadraticCurveTo(mx, my - 0.08, mx + 0.21, my - 0.03);
  if (mood === 'joy') c.quadraticCurveTo(mx + 0.06, my + open * 2.1, mx - 0.21, my - 0.02);
  else c.quadraticCurveTo(mx + 0.04, my + open * 1.6, mx - 0.21, my - 0.02);
  c.closePath();
  c.fillStyle = '#5A2230'; c.fill();
  c.clip();
  c.fillStyle = '#FFFFFF'; c.fillRect(mx - 0.24, my - 0.09, 0.48, 0.075 + open * 0.15);
  c.strokeStyle = 'rgba(90,34,48,.5)'; c.lineWidth = lw * 0.4;
  for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(mx + k * 0.08, my - 0.08); c.lineTo(mx + k * 0.08, my + 0.0); c.stroke(); }
  c.restore();
  c.beginPath(); c.moveTo(mx - 0.21, my - 0.02); c.quadraticCurveTo(mx, my - 0.08, mx + 0.21, my - 0.03);
  if (mood === 'joy') c.quadraticCurveTo(mx + 0.06, my + open * 2.1, mx - 0.21, my - 0.02);
  else c.quadraticCurveTo(mx + 0.04, my + open * 1.6, mx - 0.21, my - 0.02);
  c.closePath(); c.lineWidth = lw * 0.8; c.strokeStyle = OUT; c.stroke();
}
// ともひろ: kind, smiling eyes and a pressed-lip smile (and a squeezed-up red face when hot)
function drawTomoFace(c, lw, t, lx, ly, mood, hot) {
  const eyes = [[0.17, -0.05, 0.9], [0.63, -0.05, 1]];
  c.lineCap = 'round'; c.lineJoin = 'round';
  // round cheeks
  c.fillStyle = hot ? 'rgba(190,20,20,.35)' : 'rgba(255,130,120,.3)';
  ell(c, 0.74, 0.26, 0.17, 0.11); c.fill(); ell(c, 0.06, 0.3, 0.17, 0.11); c.fill();
  for (const [ex, ey, sz] of eyes) {
    if (hot) {
      // squeezed shut: > <
      c.strokeStyle = OUT; c.lineWidth = lw * 1.3; c.beginPath();
      const d = ex < 0.4 ? 1 : -1;
      c.moveTo(ex - 0.12 * d, ey - 0.09); c.lineTo(ex + 0.1 * d, ey); c.lineTo(ex - 0.12 * d, ey + 0.09); c.stroke();
      continue;
    }
    if (mood === 'blink' || mood === 'joy') {
      c.strokeStyle = OUT; c.lineWidth = lw * 1.2; c.beginPath();
      c.arc(ex, ey + 0.07, 0.13 * sz, Math.PI * 1.12, Math.PI * 1.88); c.stroke(); continue;
    }
    if (mood === 'dizzy') {
      c.strokeStyle = OUT; c.lineWidth = lw * 0.9; c.beginPath();
      for (let k = 0; k < 18; k++) { const a = k * 0.7 + t * 9, rr = 0.02 + k * 0.008; c.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); }
      c.stroke(); continue;
    }
    // smiling eyes: the lower lid pushed up by the cheek
    const open = (mood === 'up' || mood === 'yell' ? 0.16 : mood === 'sad' ? 0.1 : 0.12) * sz, rx = 0.15 * sz;
    const lift = mood === 'sad' || mood === 'up' || mood === 'yell' ? 0 : 0.05;
    c.save();
    c.beginPath(); c.moveTo(ex - rx, ey + 0.01); c.quadraticCurveTo(ex, ey - open * 1.5, ex + rx, ey);
    c.quadraticCurveTo(ex, ey + open * (0.9 - lift * 6), ex - rx, ey + 0.01); c.closePath();
    c.fillStyle = '#FFFFFF'; c.fill(); c.clip();
    const px = ex + lx * rx * 0.4, py = ey - 0.01 + ly * 0.03;
    c.fillStyle = '#2A1C16'; circ(c, px, py, 0.095 * sz); c.fill();
    c.fillStyle = '#FFFFFF'; circ(c, px - 0.03, py - 0.035, 0.026); c.fill();
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = lw * 1.3;
    c.beginPath(); c.moveTo(ex - rx - 0.02, ey + 0.02); c.quadraticCurveTo(ex, ey - open * 1.55, ex + rx + 0.02, ey); c.stroke();
    if (lift) { c.lineWidth = lw * 0.6; c.beginPath(); c.moveTo(ex - rx * 0.7, ey + 0.06); c.quadraticCurveTo(ex, ey + 0.02, ex + rx * 0.7, ey + 0.05); c.stroke(); }
  }
  // soft brows
  c.strokeStyle = 'rgba(23,23,28,.9)'; c.lineWidth = lw * 1.2;
  for (const [ex, ey] of eyes) {
    c.beginPath();
    if (mood === 'sad' || hot) { c.moveTo(ex - 0.13, ey - 0.26); c.lineTo(ex + 0.13, ey - 0.32); }
    else { c.moveTo(ex - 0.13, ey - 0.29); c.quadraticCurveTo(ex, ey - 0.35, ex + 0.14, ey - 0.3); }
    c.stroke();
  }
  // nose
  c.lineWidth = lw * 0.8; c.strokeStyle = OUT;
  c.beginPath(); c.moveTo(0.45, 0.1); c.quadraticCurveTo(0.55, 0.22, 0.44, 0.25); c.stroke();
  const mx = 0.47, my = 0.46;
  c.lineWidth = lw;
  if (hot) {
    // a wobbly, flustered mouth, and shy lines on the cheeks
    c.beginPath(); c.moveTo(mx - 0.13, my + 0.02);
    for (let k = 1; k <= 6; k++) c.lineTo(mx - 0.13 + k * 0.045, my + 0.02 + (k % 2 ? -0.03 : 0.03));
    c.stroke();
    c.strokeStyle = 'rgba(140,0,0,.55)'; c.lineWidth = lw * 0.7;
    for (const [x, y] of [[0.66, 0.2], [0.74, 0.2], [0.82, 0.2], [0.0, 0.24], [0.08, 0.24]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 0.04, y + 0.1); c.stroke(); }
  } else if (mood === 'yell' || mood === 'up' || mood === 'dizzy') {
    ell(c, mx, my + 0.02, 0.11, mood === 'yell' ? 0.13 : 0.09); fillOut(c, '#7A2430', lw * 0.8);
  } else if (mood === 'joy') {
    c.beginPath(); c.moveTo(mx - 0.2, my - 0.04); c.quadraticCurveTo(mx, my + 0.26, mx + 0.22, my - 0.06); c.closePath(); fillOut(c, '#7A2430', lw * 0.8);
  } else if (mood === 'sad' || mood === 'cold') {
    c.beginPath(); c.moveTo(mx - 0.13, my + 0.07); c.quadraticCurveTo(mx, my - 0.03, mx + 0.14, my + 0.06); c.stroke();
  } else {
    // lips pressed together in a wide smile, little dimples at the corners
    c.beginPath(); c.moveTo(mx - 0.18, my - 0.03); c.quadraticCurveTo(mx, my + 0.08, mx + 0.19, my - 0.04); c.stroke();
    c.lineWidth = lw * 0.6;
    c.beginPath(); c.moveTo(mx - 0.08, my + 0.07); c.quadraticCurveTo(mx, my + 0.1, mx + 0.08, my + 0.07); c.stroke();
    c.beginPath(); c.arc(mx - 0.2, my - 0.02, 0.03, -0.6, 1.4); c.stroke();
    c.beginPath(); c.arc(mx + 0.21, my - 0.03, 0.03, 1.7, 3.8); c.stroke();
  }
}
// bleached hair, darker at the roots
function longHairFill(c, ch) {
  const g = c.createLinearGradient(0, -1.3, 0, 1.0);
  g.addColorStop(0, ch.hair2); g.addColorStop(0.2, mix(ch.hair2, ch.hair, 0.6)); g.addColorStop(0.34, ch.hair); g.addColorStop(1, mix(ch.hair, '#FFF4D0', 0.35));
  return g;
}
// ゆうき: half-lidded eyes looking down a little, and a small pout
function drawLongFace(c, lw, t, lx, ly, mood) {
  const eyes = [[0.15, -0.05, 0.9], [0.62, -0.05, 1]];
  c.lineCap = 'round';
  for (const [ex, ey, sz] of eyes) {
    if (mood === 'blink' || mood === 'joy') {
      c.strokeStyle = OUT; c.lineWidth = lw * 1.2; c.beginPath();
      if (mood === 'joy') c.arc(ex, ey + 0.07, 0.13 * sz, Math.PI * 1.12, Math.PI * 1.88); else { c.moveTo(ex - 0.15, ey + 0.03); c.quadraticCurveTo(ex, ey + 0.07, ex + 0.15, ey + 0.02); }
      c.stroke(); continue;
    }
    if (mood === 'dizzy') {
      c.strokeStyle = OUT; c.lineWidth = lw * 0.9; c.beginPath();
      for (let k = 0; k < 18; k++) { const a = k * 0.7 + t * 9, rr = 0.02 + k * 0.008; c.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); }
      c.stroke(); continue;
    }
    const open = (mood === 'up' || mood === 'yell' ? 0.17 : mood === 'sad' || mood === 'cold' ? 0.09 : 0.12) * sz, rx = 0.16 * sz;
    c.save();
    c.beginPath(); c.moveTo(ex - rx, ey); c.quadraticCurveTo(ex, ey - open * 1.15, ex + rx, ey - 0.005);
    c.quadraticCurveTo(ex, ey + open * 1.3, ex - rx, ey); c.closePath();
    c.fillStyle = '#FFFFFF'; c.fill(); c.clip();
    const px = ex + lx * rx * 0.4, py = ey + 0.035 + ly * 0.03;
    c.fillStyle = '#3A2A22'; circ(c, px, py, 0.1 * sz); c.fill();
    c.fillStyle = '#120C0A'; circ(c, px, py, 0.05 * sz); c.fill();
    c.fillStyle = '#FFFFFF'; circ(c, px - 0.035, py - 0.04, 0.026); c.fill();
    c.restore();
    // a flat, heavy upper lid
    c.strokeStyle = OUT; c.lineWidth = lw * 1.5;
    c.beginPath(); c.moveTo(ex - rx - 0.02, ey + 0.01); c.quadraticCurveTo(ex, ey - open * 1.2, ex + rx + 0.03, ey - 0.02); c.stroke();
    if (mood === 'cold') { c.fillStyle = 'rgba(120,200,255,.45)'; ell(c, ex, ey, rx, open); c.fill(); }
  }
  // thin, relaxed brows (half under the bangs)
  c.strokeStyle = 'rgba(110,78,48,.9)'; c.lineWidth = lw * 1.0;
  for (const [ex, ey] of eyes) {
    c.beginPath();
    if (mood === 'sad' || mood === 'cold') { c.moveTo(ex - 0.13, ey - 0.27); c.lineTo(ex + 0.13, ey - 0.33); }
    else if (mood === 'fierce') { c.moveTo(ex - 0.14, ey - 0.33); c.lineTo(ex + 0.13, ey - 0.26); }
    else { c.moveTo(ex - 0.13, ey - 0.3); c.quadraticCurveTo(ex, ey - 0.34, ex + 0.14, ey - 0.31); }
    c.stroke();
  }
  // nose
  c.lineWidth = lw * 0.8; c.strokeStyle = OUT;
  c.beginPath(); c.moveTo(0.45, 0.1); c.quadraticCurveTo(0.54, 0.23, 0.43, 0.26); c.stroke();
  const mx = 0.47, my = 0.47;
  c.lineWidth = lw;
  if (mood === 'yell' || mood === 'up' || mood === 'dizzy') {
    ell(c, mx, my + 0.02, 0.11, mood === 'yell' ? 0.13 : 0.09); fillOut(c, '#7A2430', lw * 0.8);
  } else if (mood === 'joy') {
    c.beginPath(); c.moveTo(mx - 0.2, my - 0.05); c.quadraticCurveTo(mx, my + 0.24, mx + 0.21, my - 0.07); c.closePath(); fillOut(c, '#7A2430', lw * 0.8);
  } else if (mood === 'sad' || mood === 'cold') {
    c.beginPath(); c.moveTo(mx - 0.12, my + 0.07); c.quadraticCurveTo(mx, my - 0.03, mx + 0.13, my + 0.06); c.stroke();
  } else {
    // a small pout: lips pressed together, the lower lip pushed out a little
    c.beginPath(); c.moveTo(mx - 0.1, my + 0.01); c.quadraticCurveTo(mx, my - 0.035, mx + 0.11, my + 0.0); c.stroke();
    c.fillStyle = 'rgba(205,120,120,.55)'; ell(c, mx + 0.005, my + 0.045, 0.075, 0.035); c.fill();
    c.lineWidth = lw * 0.6; c.beginPath(); c.arc(mx + 0.005, my + 0.02, 0.07, 0.35, Math.PI - 0.35); c.stroke();
  }
}
// 室橋: narrow, sleepy eyes under heavy lids, and a sly half smile
function drawCenterFace(c, lw, t, lx, ly, mood) {
  const eyes = [[0.15, -0.06, 0.9], [0.63, -0.06, 1]];
  c.lineCap = 'round';
  for (const [ex, ey, sz] of eyes) {
    if (mood === 'blink' || mood === 'joy') {
      c.strokeStyle = OUT; c.lineWidth = lw * 1.2; c.beginPath();
      if (mood === 'joy') c.arc(ex, ey + 0.07, 0.13 * sz, Math.PI * 1.12, Math.PI * 1.88); else { c.moveTo(ex - 0.15, ey + 0.02); c.quadraticCurveTo(ex, ey + 0.06, ex + 0.15, ey + 0.01); }
      c.stroke(); continue;
    }
    if (mood === 'dizzy') {
      c.strokeStyle = OUT; c.lineWidth = lw * 0.9; c.beginPath();
      for (let k = 0; k < 18; k++) { const a = k * 0.7 + t * 9, rr = 0.02 + k * 0.008; c.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); }
      c.stroke(); continue;
    }
    // how open: a slit most of the time, wider when surprised or yelling
    const open = (mood === 'up' || mood === 'yell' ? 0.14 : mood === 'sad' || mood === 'cold' ? 0.07 : mood === 'fierce' ? 0.075 : 0.095) * sz, rx = 0.165 * sz;
    c.save();
    c.beginPath(); c.moveTo(ex - rx, ey); c.quadraticCurveTo(ex, ey - open * 1.5, ex + rx, ey - 0.01);
    c.quadraticCurveTo(ex, ey + open * 1.1, ex - rx, ey); c.closePath();
    c.fillStyle = '#FFFFFF'; c.fill(); c.clip();
    c.fillStyle = '#17181E'; circ(c, ex + lx * rx * 0.42, ey + 0.01 + ly * 0.02, 0.09 * sz); c.fill();
    c.fillStyle = '#FFFFFF'; circ(c, ex + lx * rx * 0.42 - 0.03, ey - 0.03, 0.025); c.fill();
    c.restore();
    // the heavy upper lid
    c.strokeStyle = OUT; c.lineWidth = lw * 1.7;
    c.beginPath(); c.moveTo(ex - rx - 0.02, ey + 0.01); c.quadraticCurveTo(ex, ey - open * 1.55, ex + rx + 0.03, ey - 0.03); c.stroke();
    c.lineWidth = lw * 0.6; c.beginPath(); c.moveTo(ex - rx * 0.6, ey + open * 0.95); c.quadraticCurveTo(ex, ey + open * 1.2, ex + rx * 0.7, ey + open * 0.8); c.stroke();
    if (mood === 'cold') { c.fillStyle = 'rgba(120,200,255,.45)'; ell(c, ex, ey, rx, open); c.fill(); }
  }
  // faint, low brows (mostly under the bangs)
  c.strokeStyle = 'rgba(26,26,31,.85)'; c.lineWidth = lw * 1.2;
  const bl = mood === 'up' || mood === 'yell' ? -0.05 : mood === 'sad' ? 0.03 : 0;
  for (const [ex, ey] of eyes) {
    c.beginPath();
    if (mood === 'sad' || mood === 'cold') { c.moveTo(ex - 0.13, ey - 0.25 + bl); c.lineTo(ex + 0.13, ey - 0.31 + bl); }
    else if (mood === 'fierce') { c.moveTo(ex - 0.14, ey - 0.32); c.lineTo(ex + 0.13, ey - 0.25); }
    else { c.moveTo(ex - 0.13, ey - 0.27 + bl); c.quadraticCurveTo(ex, ey - 0.31 + bl, ex + 0.14, ey - 0.27 + bl); }
    c.stroke();
  }
  // nose
  c.lineWidth = lw * 0.8; c.strokeStyle = OUT;
  c.beginPath(); c.moveTo(0.45, 0.1); c.quadraticCurveTo(0.54, 0.22, 0.43, 0.25); c.stroke();
  // mouth
  const mx = 0.47, my = 0.46;
  c.lineWidth = lw;
  if (mood === 'yell' || mood === 'up' || mood === 'dizzy') {
    ell(c, mx, my + 0.02, 0.12, mood === 'yell' ? 0.13 : 0.09); fillOut(c, '#7A2430', lw * 0.8);
  } else if (mood === 'joy') {
    // the big toothy grin from the photo
    c.beginPath(); c.moveTo(mx - 0.22, my - 0.06); c.quadraticCurveTo(mx, my + 0.26, mx + 0.24, my - 0.1); c.closePath();
    c.fillStyle = '#7A2430'; c.fill();
    c.save(); c.clip(); c.fillStyle = '#FFFFFF'; c.fillRect(mx - 0.25, my - 0.12, 0.5, 0.1); c.restore();
    c.strokeStyle = OUT; c.lineWidth = lw * 0.8; c.stroke();
  } else if (mood === 'sad' || mood === 'cold') {
    c.beginPath(); c.moveTo(mx - 0.13, my + 0.07); c.quadraticCurveTo(mx, my - 0.04, mx + 0.14, my + 0.06); c.stroke();
  } else {
    // a smirk: flat on one side, the far corner tucked up
    c.beginPath(); c.moveTo(mx - 0.15, my + 0.02); c.quadraticCurveTo(mx + 0.02, my + 0.08, mx + 0.15, my - 0.04);
    c.quadraticCurveTo(mx + 0.2, my - 0.08, mx + 0.22, my - 0.1); c.stroke();
    c.lineWidth = lw * 0.6; c.beginPath(); c.moveTo(mx + 0.19, my - 0.13); c.quadraticCurveTo(mx + 0.25, my - 0.08, mx + 0.22, my - 0.03); c.stroke();
  }
}
// round white sunglasses: the shine follows the ball
function drawShades(c, lw, t, lx, ly, mood) {
  const frame = '#F7F7F2';
  c.lineCap = 'round';
  c.strokeStyle = OUT; c.lineWidth = lw * 3.2; c.beginPath(); c.moveTo(-0.14, -0.12); c.lineTo(-0.7, -0.04); c.stroke();
  c.strokeStyle = frame; c.lineWidth = lw * 1.8; c.stroke();
  for (const [x, y] of [[0.13, -0.08], [0.67, -0.08]]) {
    circ(c, x, y, 0.31); fillOut(c, frame, lw);
    circ(c, x, y, 0.215); c.fillStyle = mood === 'cold' ? '#5E7E9E' : '#262A35'; c.fill();
    c.lineWidth = lw * 0.6; c.strokeStyle = 'rgba(27,32,48,.6)'; c.stroke();
    if (mood === 'dizzy') {
      c.strokeStyle = '#FFFFFF'; c.lineWidth = lw * 0.8; c.beginPath();
      for (let k = 0; k < 16; k++) { const a = k * 0.75 + t * 9, rr = 0.02 + k * 0.009; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      c.stroke();
    } else if (mood === 'joy') {
      c.strokeStyle = '#FFFFFF'; c.lineWidth = lw * 1.1; c.beginPath(); c.arc(x, y + 0.05, 0.09, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else {
      c.fillStyle = 'rgba(255,255,255,.6)'; ell(c, x - 0.06 + lx * 0.05, y - 0.07 + ly * 0.04, 0.075, 0.042, -0.6); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, x + 0.07 + lx * 0.03, y + 0.06, 0.025); c.fill();
    }
  }
  c.fillStyle = frame; rrect(c, 0.38, -0.13, 0.06, 0.06, 0.02); c.fill();
}

function starShape(c, x, y, R, r, rot) {
  c.beginPath();
  for (let k = 0; k < 10; k++) { const a = rot + k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? r : R; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}

function drawShoe(c, x, y, a, face, team, scale) {
  const k = Math.sqrt(scale) * 1.22;
  c.save(); c.translate(x, y + 2); c.scale(face * k, k);
  c.rotate(-(a - REST_A) * 0.85);
  // boot: toe to the front (+x)
  c.beginPath();
  c.moveTo(-15, -11); c.quadraticCurveTo(-4, -15, 4, -9); c.quadraticCurveTo(18, -9, 22, 2); c.quadraticCurveTo(22, 11, 10, 11);
  c.lineTo(-15, 11); c.quadraticCurveTo(-20, 0, -15, -11); c.closePath();
  fillOut(c, team.main, 2.6);
  c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.4;
  for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-8 + k * 6, -6); c.lineTo(-4 + k * 6, 4); c.stroke(); }
  c.fillStyle = '#1B2030'; c.fillRect(-15, 9, 34, 4);
  for (let k = 0; k < 4; k++) c.fillRect(-12 + k * 8, 12, 3, 3);
  c.restore();
}

function drawTag(c, p, opt, t) {
  const team = TEAM_COL[p.team], y = p.y - p.r - 30 - (p.stn > 0 ? 14 : 0);
  const name = opt.label || p.name;
  c.font = `20px ${FONT_UI}`; c.font = `800 20px ${FONT_UI}`;
  const w = Math.max(54, c.measureText(name).width + 24);
  const full = p.gauge >= 1 && !p.armed;
  c.save();
  if (full) { const k = 0.5 + 0.5 * Math.sin(t * 10); c.shadowColor = '#FFD740'; c.shadowBlur = 10 + k * 10; }
  rrect(c, p.x - w / 2, y - 16, w, 30, 15); c.fillStyle = team.main; c.fill();
  c.restore();
  rrect(c, p.x - w / 2, y - 16, w, 30, 15); c.lineWidth = 2.5; c.strokeStyle = full ? '#FFD740' : 'rgba(255,255,255,.9)'; c.stroke();
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, p.x, y - 2);
  // the super gauge as a strip along the bottom of the tag
  const gw = w - 18;
  c.fillStyle = 'rgba(0,0,0,.35)'; rrect(c, p.x - gw / 2, y + 7, gw, 5, 2.5); c.fill();
  c.fillStyle = p.armed > 0 ? superColor(CHARS[p.char].sup) : full ? '#FFD740' : '#FFFFFF';
  rrect(c, p.x - gw / 2, y + 7, gw * (p.armed > 0 ? p.armed / SUPER_ARM_T : p.gauge), 5, 2.5); c.fill();
  // health (only once it has been knocked about)
  let my = 0;
  if (p.hp < 0.995 || (p.hp <= 0 && p.stn > 0)) {
    const hw = Math.max(46, w - 10), hy = y - 27, hp = clamp(p.hp, 0, 1);
    rrect(c, p.x - hw / 2 - 2, hy - 2, hw + 4, 10, 5); c.fillStyle = 'rgba(16,22,40,.85)'; c.fill();
    if (hp > 0) { rrect(c, p.x - hw / 2, hy, hw * hp, 6, 3); c.fillStyle = hp > 0.6 ? '#5BE37A' : hp > 0.3 ? '#FFD740' : '#FF5A5A'; c.fill(); }
    my = 12;
  }
  if (opt.me) {
    c.fillStyle = '#FFD740';
    c.beginPath(); c.moveTo(p.x - 9, y - 26 - my); c.lineTo(p.x + 9, y - 26 - my); c.lineTo(p.x, y - 16 - my); c.closePath(); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
  }
}

// a character's face for menus (onto a small canvas)
function drawPortrait(cv, ci, team, mood) {
  const c = cv.getContext('2d'), n = cv.width;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, n, n);
  const fake = { i: 0, char: ci, team: team || 0, face: 1, x: 0, y: 0, vx: 0, vy: 0, r: 1, scale: 1, ground: true, kick: { t: -1 }, armed: 0, giant: 0, frz: 0, stn: 0, gauge: 0 };
  c.save(); c.translate(n * 0.52, n * 0.56); c.scale(n * 0.3, n * 0.3);
  drawHead(c, CHARS[ci], fake, 0.075, 1.3, 0.7, 0.2, mood || 'calm');
  c.restore();
}

// ---------------- effects ----------------
const FX = { parts: [], rings: [], bolts: [], texts: [], shake: 0, flash: 0, flashCol: '#FFFFFF', banner: null, windT: 0 };
function fxReset() { FX.parts.length = 0; FX.rings.length = 0; FX.bolts.length = 0; FX.texts.length = 0; FX.shake = 0; FX.flash = 0; FX.banner = null; }
function puff(x, y, n, col, sp, up, size, life, kind) {
  for (let i = 0; i < n && FX.parts.length < 420; i++) {
    const a = Math.random() * TAU, v = sp * (0.3 + Math.random() * 0.7);
    FX.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up || 0), life: (life || 0.5) * (0.6 + Math.random() * 0.6), max: life || 0.5, size: (size || 6) * (0.6 + Math.random() * 0.8), col, kind: kind || 'dot', rot: Math.random() * TAU, g: kind === 'confetti' ? 300 : kind === 'flame' || kind === 'smoke' ? -120 : 500 });
  }
}
function ring(x, y, col, r0, r1, life, w) { FX.rings.push({ x, y, col, r0, r1, life, max: life, w: w || 6 }); }
function floatText(x, y, str, col, size, life) { FX.texts.push({ x, y, str, col, size: size || 30, life: life || 1, max: life || 1 }); }
function bolt(x) {
  const pts = []; let y = V.y0, xx = x + (Math.random() - 0.5) * 120;
  while (y < GROUND) { pts.push([xx, y]); y += 40 + Math.random() * 40; xx += (Math.random() - 0.5) * 70; }
  pts.push([x, GROUND - 60]);
  FX.bolts.push({ pts, life: 0.35, max: 0.35 });
}
function fxUpdate(dt, G) {
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    p.life -= dt; if (p.life <= 0) { FX.parts.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 6;
    if (p.kind === 'confetti') { p.vx *= 1 - 1.2 * dt; if (p.vy > 220) p.vy = 220; }
    if (p.kind === 'dot' && p.y > GROUND) { p.y = GROUND; p.vy *= -0.3; }
  }
  for (let i = FX.rings.length - 1; i >= 0; i--) { FX.rings[i].life -= dt; if (FX.rings[i].life <= 0) FX.rings.splice(i, 1); }
  for (let i = FX.bolts.length - 1; i >= 0; i--) { FX.bolts[i].life -= dt; if (FX.bolts[i].life <= 0) FX.bolts.splice(i, 1); }
  for (let i = FX.texts.length - 1; i >= 0; i--) { const t = FX.texts[i]; t.life -= dt; t.y -= 40 * dt; if (t.life <= 0) FX.texts.splice(i, 1); }
  FX.shake = Math.max(0, FX.shake - dt * 2.5);
  FX.flash = Math.max(0, FX.flash - dt * 3);
  if (FX.banner) { FX.banner.t += dt; if (FX.banner.t > FX.banner.max) FX.banner = null; }
  // trails behind super balls
  if (G && G.ball && G.ball.mode && G.ball.modeT > 0 && Math.random() < 0.9) {
    const b = G.ball, m = b.mode;
    if (m === 'fire') puff(b.x, b.y, 2, Math.random() < 0.5 ? '#FFB020' : '#FF5A1A', 60, 0, 14, 0.4, 'flame');
    else if (m === 'ice') puff(b.x, b.y, 1, '#E8FBFF', 40, 0, 7, 0.5, 'snow');
    else if (m === 'rocket') puff(b.x - b.vx * 0.02, b.y - b.vy * 0.02, 1, 'rgba(230,230,240,.8)', 30, 0, 12, 0.5, 'smoke');
  }
  if (G && G.wind && G.wind.t > 0 && Math.random() < 0.8) {
    const d = G.wind.team === 0 ? 1 : -1;
    FX.parts.push({ x: d > 0 ? V.x0 : V.x1, y: 120 + Math.random() * 560, vx: d * (1300 + Math.random() * 500), vy: 0, life: 1.3, max: 1.3, size: 60 + Math.random() * 90, col: 'rgba(255,255,255,.55)', kind: 'streak', rot: 0, g: 0 });
  }
}
function fxDraw(c) {
  for (const p of FX.parts) {
    const k = p.life / p.max;
    if (p.kind === 'streak') { c.strokeStyle = p.col; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - sign(p.vx) * p.size, p.y); c.stroke(); continue; }
    c.globalAlpha = p.kind === 'confetti' ? Math.min(1, k * 3) : k;
    c.fillStyle = p.col;
    if (p.kind === 'confetti') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); c.restore(); }
    else if (p.kind === 'star') { starShape(c, p.x, p.y, p.size, p.size * 0.45, p.rot); c.fill(); }
    else if (p.kind === 'snow') { starShape(c, p.x, p.y, p.size, p.size * 0.35, p.rot); c.fill(); }
    else { circ(c, p.x, p.y, p.size * (p.kind === 'smoke' || p.kind === 'flame' ? (1.6 - k * 0.6) : 1)); c.fill(); }
  }
  c.globalAlpha = 1;
  for (const r of FX.rings) {
    const k = 1 - r.life / r.max;
    c.strokeStyle = r.col; c.globalAlpha = 1 - k; c.lineWidth = r.w * (1 - k * 0.6);
    circ(c, r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k))); c.stroke();
  }
  c.globalAlpha = 1;
  for (const bt of FX.bolts) {
    const k = bt.life / bt.max;
    c.strokeStyle = `rgba(255,240,120,${k})`; c.lineWidth = 12; c.lineJoin = 'round';
    c.beginPath(); bt.pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y)); c.stroke();
    c.strokeStyle = `rgba(255,255,255,${k})`; c.lineWidth = 4; c.stroke();
  }
  for (const t of FX.texts) {
    const k = t.life / t.max;
    c.globalAlpha = Math.min(1, k * 2.5);
    outlined(c, t.str, t.x, t.y, t.size, t.col, t.size * 0.2, FONT_SIGN);
  }
  c.globalAlpha = 1;
}

// ---------------- HUD ----------------
function fmtClock(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
function drawHUD(c, G, t) {
  const cx = W / 2, y = 14 + Math.max(0, V.y0) * 0;
  const w = 380, h = 74;
  c.save();
  rrect(c, cx - w / 2, y, w, h, 18); c.fillStyle = 'rgba(16,22,40,.82)'; c.fill();
  c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.25)'; c.stroke();
  for (let k = 0; k < 2; k++) {
    const col = TEAM_COL[k], bx = k ? cx + 70 : cx - 170;
    rrect(c, bx, y + 10, 100, h - 20, 12); c.fillStyle = col.main; c.fill();
    outlined(c, String(G.score[k]), bx + 50, y + h / 2 + 2, 44, '#FFFFFF', 7);
  }
  const low = G.phase === 'play' && G.clock <= 10 && !G.ot;
  const clk = G.ot ? 'Vゴール' : fmtClock(G.clock);
  c.font = `${G.ot ? 22 : 34}px ${FONT_SIGN}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = low ? (Math.floor(t * 4) % 2 ? '#FF6B6B' : '#FFFFFF') : '#FFE36B';
  c.fillText(clk, cx, y + h / 2 + 1);
  if (G.ot) { c.font = `16px ${FONT_UI}`; c.fillStyle = '#FFFFFF'; c.fillText(fmtClock(G.clock), cx, y + h - 12); }
  c.restore();
}

function drawOverlays(c, G, t) {
  const cx = W / 2, cy = 300;
  if (G.phase === 'countdown') {
    const n = 3 - Math.floor(G.phaseT), f = G.phaseT % 1;
    if (n >= 1) outlined(c, String(n), cx, cy, 160 * (1.25 - f * 0.25), '#FFFFFF', 22);
  } else if (G.phase === 'play' && G.phaseT < 0.9 && G.t > 3.2 && !G._afterGoal) {
    // (kick-off text is shown by the banner)
  }
  if (G.phase === 'kickoff') outlined(c, 'レディ…', cx, cy, 72, '#FFFFFF', 12);
  if (G.phase === 'goal' && G.lastGoal) {
    const k = Math.min(1, G.phaseT * 4), col = TEAM_COL[G.lastGoal.team];
    c.save(); c.translate(cx, cy - 20); const zs = 0.6 + 0.4 * k + Math.sin(G.phaseT * 8) * 0.02; c.scale(zs, zs); c.rotate(-0.04);
    outlined(c, 'ゴール！！', 0, 0, 150, col.light, 26);
    c.restore();
    const sc = G.lastGoal.p >= 0 ? G.players[G.lastGoal.p] : null;
    if (sc && G.phaseT > 0.25) {
      const txt = G.lastGoal.own ? `${sc.name} のオウンゴール…` : `${sc.name} のゴール！`;
      outlined(c, txt, cx, cy + 105, 42, '#FFFFFF', 8);
    }
  }
  if (G.phase === 'otintro') {
    outlined(c, 'タイムアップ！ 同点', cx, cy - 50, 64, '#FFFFFF', 11);
    outlined(c, 'Vゴールで決着！', cx, cy + 40, 88, '#FFD740', 15);
  }
  if (G.phase === 'end') {
    const k = Math.min(1, G.phaseT * 3);
    c.save(); c.translate(cx, cy); c.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
    outlined(c, 'タイムアップ！', 0, -30, 120, '#FFFFFF', 20);
    if (G.result) {
      const w = G.result.win;
      outlined(c, w < 0 ? 'ひきわけ' : `${TEAM_COL[w].name}チームのかち！`, 0, 90, 64, w < 0 ? '#FFFFFF' : TEAM_COL[w].light, 11);
    }
    c.restore();
  }
  if (FX.banner) {
    const B = FX.banner, k = B.t < 0.2 ? B.t / 0.2 : B.t > B.max - 0.25 ? (B.max - B.t) / 0.25 : 1;
    c.save(); c.globalAlpha = clamp(k, 0, 1);
    const by = B.y || 190;
    c.fillStyle = rgba(B.col || '#1B2030', 0.88);
    c.beginPath(); c.moveTo(V.x0, by - 46); c.lineTo(V.x1, by - 58); c.lineTo(V.x1, by + 46); c.lineTo(V.x0, by + 58); c.closePath(); c.fill();
    const slide = (1 - clamp(k, 0, 1)) * 120 * (B.dir || 1);
    outlined(c, B.text, cx + slide, by, B.size || 60, B.fg || '#FFFFFF', 10);
    if (B.sub) outlined(c, B.sub, cx + slide, by + 44, 24, '#FFFFFF', 5, FONT_UI);
    c.restore();
  }
  if (FX.flash > 0) { c.fillStyle = rgba(FX.flashCol, FX.flash * 0.5); c.fillRect(V.x0, V.y0, V.x1 - V.x0, V.y1 - V.y0); }
}

// items floating in bubbles
function drawItems(c, G, t) {
  for (const it of G.items) {
    const y = it.y + Math.sin(it.t * 3) * 8, fade = it.t > 11 ? (Math.floor(it.t * 8) % 2 ? 0.4 : 1) : 1;
    c.save(); c.globalAlpha = fade;
    const g = c.createRadialGradient(it.x - 10, y - 12, 4, it.x, y, 32);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.7, 'rgba(190,230,255,.45)'); g.addColorStop(1, 'rgba(160,210,255,.7)');
    circ(c, it.x, y, 30); c.fillStyle = g; c.fill(); c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,255,255,.95)'; c.stroke();
    c.font = `32px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(ITEMS[it.k].icon, it.x, y + 2);
    c.restore();
  }
}
function drawFakes(c, G) {
  for (const f of G.fakes) { const r = f.r || G.ball.r || BALL_R; drawShadow(c, f.x, f.y, r); drawBallShape(c, f.x, f.y, f.rot, 1, null, r); }
}

// one whole frame of the match
function drawMatch(c, G, t, tags, opts) {
  const cv = stadiumCanvas(G.setup.stadium || 'day');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(cv, 0, 0);
  let sx = 0, sy = 0;
  if (FX.shake > 0) { sx = (Math.random() - 0.5) * FX.shake * 24; sy = (Math.random() - 0.5) * FX.shake * 24; }
  worldTransform(c, sx, sy);
  drawGoalBack(c, G);
  drawItems(c, G, t);
  for (const p of G.players) drawPlayer(c, p, G, t, tags ? tags[p.i] : null);
  drawFakes(c, G);
  drawBall(c, G.ball, t);
  drawGoalFront(c, G);
  fxDraw(c);
  worldTransform(c);
  if (!opts || opts.hud !== false) { drawHUD(c, G, t); drawOverlays(c, G, t); }
}
