// ===================================================================
//  ui: screens, the match loop, the lobbies, and the link between phones
// ===================================================================
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SITE = 'https://ftkr12.github.io/gottsun/';

// ---------- saved choices ----------
const pref = (() => { try { return JSON.parse(localStorage.getItem('gottsun-pref') || '{}') || {}; } catch (e) { return {}; } })();
function savePref() { try { localStorage.setItem('gottsun-pref', JSON.stringify(pref)); } catch (e) {} }
const rules = Object.assign({ mode: 'normal', time: 90, items: true, stadium: 'auto', lv: 'normal', fill: true }, pref.rules || {});
if (!GAME_MODES[rules.mode]) rules.mode = 'normal';
function saveRules() { pref.rules = rules; savePref(); }

// ---------- screens ----------
const UI = { screen: 'title', prev: [] };
function show(name) {
  for (const s of $$('.screen')) s.hidden = s.id !== 'scr-' + name;
  UI.screen = name;
  const inMatch = !!M.G && M.mode !== 'demo';
  $('#hud').hidden = !(inMatch && (name === 'game'));
  document.documentElement.classList.toggle('playing', inMatch && name === 'game');
  Input.capture = inMatch && name === 'game';
  updateTouch();
  const sc = $('#scr-' + name);
  if (sc) { const f = sc.querySelector('[data-autofocus]'); if (f && !Touch.on) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) {} }, 30); }
  const menus = name !== 'game' && name !== 'pause' && name !== 'result' && name !== 'rejoin';
  Sound.bgm(menus || name === 'result');
  Sound.crowd(inMatch && (name === 'game' || name === 'pause'));
  if (name === 'title' && window.Updater && Updater.pending) { Updater.pending = false; Updater.check(); }
}
let toastT = 0;
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2200); }

// ---------- the canvas ----------
const cv = $('#cv'), ctx = cv.getContext('2d');
let DPR = Math.min(2, window.devicePixelRatio || 1);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  const portrait = h > w * 1.05;
  const touchShown = !$('#touch').hidden;
  const btn = layoutTouch(w, h, portrait);
  if (touchShown && portrait) {
    // the field sits in the middle of the space above the buttons
    const fieldH = w * H / W, room = h - (btn * 2 + 40);
    const oy = Math.max(0, (room - fieldH) / 2);
    computeView(w, fieldH, DPR, oy);
    V.ch = h; V.y0 = -V.oy / V.s; V.y1 = (h - V.oy) / V.s;
    const r = $('#rotate'); r.style.top = Math.round(oy + fieldH + 12) + 'px'; r.style.bottom = 'auto';
  } else if (touchShown) {
    const band = btn + 22, sc = Math.min(w / W, (h - band) / GROUND);
    computeView(w, h, DPR, (h - band) - GROUND * sc, sc);
    const r = $('#rotate'); r.style.top = ''; r.style.bottom = '';
  } else { computeView(w, h, DPR); const r = $('#rotate'); r.style.top = ''; r.style.bottom = ''; }
  $('#rotate').hidden = !(touchShown && portrait);
}
function layoutTouch(w, h, portrait) {
  const t = $('#touch');
  let btn = clamp(Math.min(w, h) * 0.18, 58, 92);
  if (portrait) btn = clamp(w * 0.21, 64, 100);
  t.style.setProperty('--btn', btn + 'px');
  t.style.setProperty('--pad-w', Math.round(btn * 2.3) + 'px');
  return btn;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- the match ----------
const M = { G: null, mode: '', devs: {}, paused: false, acc: 0, lastEv: 0, snapSeq: 0, endShown: false, setup: null, mine: [], label: {}, resultT: 0, peerOf: {} };

function startMatch(setup, mode, opt) {
  opt = opt || {};
  fxReset();
  const G = newMatch(setup);
  M.G = G; M.mode = mode; M.setup = setup; M.paused = false; M.acc = 0; M.lastEv = 0; M.snapSeq = 0; M.endShown = false;
  M.devs = {}; M.mine = []; M.label = {}; M.peerOf = {};
  const lv = setup.lv || 'normal';
  G.players.forEach((p, i) => {
    const sp = setup.players[i];
    p.cpu = mkCpu(sp.lv || lv, (setup.seed || 1) * 7 + i * 131);
    if (mode === 'guest') { p.owned = i === opt.myIdx; if (p.owned) { M.devs[i] = 'any'; M.mine.push(i); } }
    else if (sp.ctrl === 'local') { M.devs[i] = sp.dev || 'any'; M.mine.push(i); }
    else if (sp.ctrl === 'remote') { p.owned = false; M.peerOf[i] = sp.peer; }
    M.label[i] = sp.name || CHARS[p.char].name;
  });
  if (mode === 'guest') { NetSync.reset(); NetSync.epoch = opt.sync ? -1 : G.epoch; NetSync.adopt = !!opt.sync; }
  if (mode !== 'demo') show('game');
  updateTouch(); resize();
  return G;
}
function stopMatch() { M.G = null; M.mode = ''; M.paused = false; fxReset(); updateTouch(); }

function demoStart() {
  const chars = CHARS.map((_, i) => i).sort(() => Math.random() - 0.5);
  const players = [0, 1, 2, 3].map(i => ({ name: CHARS[chars[i]].name, char: chars[i], team: i % 2, ctrl: 'cpu' }));
  const G = startMatch({ players, time: 9999, items: true, ot: false, stadium: STADIUM_KEYS[(Math.random() * 3) | 0], seed: (Math.random() * 1e9) | 0, lv: 'normal' }, 'demo');
  G.phase = 'play'; G.phaseT = 0; dropBall(G);
}

let lastNow = performance.now(), frameErrs = 0;
function frame(now) {
  try { frameBody(now); } catch (e) { if (frameErrs++ < 5) console.error(e); }
  requestAnimationFrame(frame);
}
function frameBody(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
  pollPads();
  if (UI.screen === 'local') localTick();
  else padMenus();
  const G = M.G;
  if (G) {
    if (M.mode === 'guest') guestFrame(dt); else hostFrame(dt);
    fxUpdate(M.paused ? 0 : dt, G);
    render(now / 1000);
    if (M.mode !== 'demo') updateTouchState();
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0E2A1C'; ctx.fillRect(0, 0, cv.width, cv.height);
  }
}

function hostQuiet() {
  const G = M.G, now = performance.now();
  for (const pr of Net.peers) {
    if (pr.idx < 0 || !G.players[pr.idx]) continue;
    const p = G.players[pr.idx];
    if (p.owned || p.away) continue;
    if (now - (pr.heardAt || now) > 2500) {
      p.softAway = true; p.away = true; p.owned = true; p.ctrl = 'cpu';
      if (!p.cpu) p.cpu = mkCpu(Net.lobbyRules.lv || 'normal', 77);
      toast(`${M.label[pr.idx]} の通信がとぎれています。CPUが代わりにプレーします`, 2600);
      renderNetbar();
    }
  }
}
function hostFrame(dt) {
  const G = M.G;
  if (M.mode === 'host') hostQuiet();
  if (M.paused) return;
  M.acc += dt;
  let n = 0;
  while (M.acc >= DT && n < 5) {
    if (M.mode === 'host') for (const pr of Net.peers) if (pr.idx >= 0 && G.players[pr.idx] && !G.players[pr.idx].owned) hostPlaceRemote(G, G.players[pr.idx], pr.pose, pr.rtt || 60);
    const inputs = G.players.map(p => {
      if (!p.owned) return null;
      if (p.ctrl === 'cpu' || p.away || M.devs[p.i] === undefined) return aiInput(G, p);
      return inputFor(M.devs[p.i]);
    });
    step(G, inputs);
    if (n === 0) consumeInput();
    M.acc -= DT; n++;
    handleEvents(G);
    if (M.mode === 'host' && G.tick % 2 === 0) Net.hostSnap();
  }
  if (n >= 5) M.acc = 0;
  if (M.mode === 'demo' && G.phase === 'goal' && G.phaseT > 2.4) { resetPositions(G); G.phase = 'play'; G.phaseT = 0; dropBall(G); }
  if (M.mode === 'demo' && G.phase === 'kickoff') { G.phase = 'play'; dropBall(G); }
  if (G.phase === 'end' && !M.endShown && G.phaseT > 2.6 && M.mode !== 'demo') { M.endShown = true; finishMatch(); }
}

function guestFrame(dt) {
  const G = M.G;
  guestExtrapolate(G, dt);
  M.acc += dt;
  let n = 0;
  const me = G.players[M.mine[0]];
  while (M.acc >= DT && n < 5) {
    G.t += DT;
    if (me) {
      tickTimers(G, me, DT);
      const live = (G.phase === 'play' || G.phase === 'goal') && !M.paused;
      stepPlayer(G, me, live ? inputFor('any') : null, DT);
      separatePlayers(G);
      if (n === 0) consumeInput();
      Net.guestPose(me);
    }
    M.acc -= DT; n++;
  }
  if (n >= 5) M.acc = 0;
  // this phone's own sounds and sparks (jumps, swings, its own super)
  for (const e of G.evs) { if (e.id <= M.lastEv) continue; M.lastEv = e.id; onEvent(e, false); }
}

function handleEvents(G) {
  for (const e of G.evs) { if (e.id <= M.lastEv) continue; M.lastEv = e.id; onEvent(e, false); }
}

const CONFETTI = ['#FFD740', '#FF5A5A', '#5AA0FF', '#FFFFFF', '#6BE38A', '#FF9F40'];
function onEvent(e, remote) {
  const G = M.G; if (!G) return;
  const demo = M.mode === 'demo';
  const S = (name, a) => { if (!demo) Sound.play(name, a); };
  const P = e.p >= 0 ? G.players[e.p] : null;
  switch (e.k) {
    case 'kick': ring(e.x, e.y, e.h ? '#FFE36B' : '#FFFFFF', 12, 64, 0.28, 6); puff(e.x, e.y, 7, '#FFFFFF', 320, 0, 5, 0.3); if (e.h) S('head', 900); S('kick', e.v); if (e.v > 1350) FX.shake = Math.max(FX.shake, 0.25); break;
    case 'dazzle': if (P) { puff(P.x, P.y - P.r * 0.3, 8, '#FFF6A0', 260, 40, 7, 0.5, 'star'); if (!FX.flash) { FX.flash = 0.8; FX.flashCol = '#FFFFFF'; } S('dazzle'); } break;
    case 'head': ring(e.x, e.y, 'rgba(255,255,255,.8)', 10, 46, 0.22, 4); S('head', e.v); break;
    case 'bounce': S('bounce', e.v); if (e.v > 650 && e.y > GROUND - 40) puff(e.x, GROUND - 2, 5, 'rgba(230,240,210,.8)', 160, 60, 6, 0.35); break;
    case 'post': S('post'); puff(e.x, e.y, 6, '#FFF6C0', 260, 0, 4, 0.25); FX.shake = Math.max(FX.shake, 0.2); break;
    case 'goal': {
      FX.shake = 1; FX.flash = 0.9; FX.flashCol = '#FFFFFF';
      const gx = e.team === 0 ? W - 70 : 70;
      for (let i = 0; i < 90; i++) puff(gx, 520, 1, CONFETTI[i % CONFETTI.length], 750, 420, 13, 2.6, 'confetti');
      if (!demo) Sound.play('goal');
      break;
    }
    case 'whistle': if (!demo) Sound.play('whistle', e.n); break;
    case 'count': if (!demo) { Sound.play('count', e.n); if (e.n === 0) FX.banner = { text: 'キックオフ！', t: 0, max: 1.1, col: '#1B2030', size: 64 }; } break;
    case 'super': {
      if (!P) break;
      const sp = SUPERS[e.s];
      FX.banner = { text: sp.icon + ' ' + sp.name, sub: M.label[P.i] || P.name, t: 0, max: 1.5, col: TEAM_COL[P.team].deep, dir: P.team ? -1 : 1, size: 56 };
      ring(P.x, P.y, superColor(e.s), 20, 170, 0.5, 10);
      S('super', e.s);
      if (e.s === 'giant') S('giant'); if (e.s === 'wind') S('wind'); if (e.s === 'stretch') S('stretch');
      break;
    }
    case 'shot': if (P) { ring(G.ball.x, G.ball.y, superColor(e.s), 16, 110, 0.4, 8); S('shot', e.s); FX.shake = Math.max(FX.shake, 0.3); } break;
    case 'bolt': if (P) { bolt(P.x); FX.flash = 0.7; FX.flashCol = '#FFF8C0'; puff(P.x, P.y - P.r, 8, '#FFE14D', 260, 0, 7, 0.4, 'star'); S('bolt'); } break;
    case 'ramen': if (P) { floatText(P.x, P.y - P.r - 46, '🍜 元気！', '#FFE1B0', 30, 1.2); puff(P.x, P.y - P.r * 0.6, 10, '#FFFFFF', 120, 40, 10, 0.9, 'smoke'); puff(P.x, P.y, 8, '#FFB347', 260, 30, 6, 0.5, 'star'); S('ramen'); } break;
    case 'event': { const evd = EVENTS[e.ek]; if (evd) { FX.banner = { text: evd.text, sub: 'イベント発生！', t: 0, max: 1.8, col: '#7A3FC2', dir: 1, size: 54 }; S('event'); } break; }
    case 'present': if (P) { floatText(P.x, P.y - P.r - 54, 'では、始めます。', '#CFE3FF', 32, 1.2); FX.flash = 0.35; FX.flashCol = '#DDEBFF'; S('present'); } break;
    case 'meteor': puff(e.x, e.y, 9, '#DFF4FF', 320, 80, 7, 0.45, 'star'); ring(e.x, e.y, 'rgba(160,220,255,.9)', 10, 70, 0.3, 6); S('meteor'); break;
    case 'cheers': if (P) { P._cheersT = G.t; floatText(P.x, P.y - P.r - 54, 'のめのめ〜！', '#FFE7A8', 40, 1.2); ring(P.x, P.y, '#F0A928', 30, 170, 0.45, 10); S('cheers'); } break;
    case 'drunk': if (P) { floatText(P.x, P.y - P.r - 40, '🍺 ヒック', '#FFE7A8', 30, 1.0); puff(P.x, P.y - P.r * 0.5, 10, '#FFF6D0', 160, 60, 7, 0.6); S('hic'); } break;
    case 'boil': if (P) { floatText(P.x, P.y - P.r - 50, 'ボッ！', '#FFB0A0', 42, 0.9); ring(P.x, P.y, '#FF4A3A', 30, 170, 0.45, 10); puff(P.x, P.y - P.r, 12, 'rgba(255,255,255,.9)', 160, 120, 12, 0.8, 'smoke'); S('boil'); } break;
    case 'sizzle': ring(e.x, e.y, '#FF6A2A', 12, 70, 0.3, 7); puff(e.x, e.y, 8, '#FFB347', 300, 40, 7, 0.4, 'flame'); S('sizzle'); break;
    case 'flex': if (P) { floatText(P.x, P.y - P.r - 50, 'ムキッ！', '#FFE1B0', 40, 1.0); ring(P.x, P.y, '#FFB07A', 30, 160, 0.45, 9); S('flex'); } break;
    case 'punch': floatText(e.x, e.y - 40, 'ドン！', '#FFFFFF', 38, 0.7); puff(e.x, e.y, 10, '#FFE9A0', 360, 0, 7, 0.35, 'star'); ring(e.x, e.y, '#FFB07A', 14, 80, 0.3, 7); FX.shake = Math.max(FX.shake, 0.22); S('punch'); break;
    case 'hit': if (P) { floatText(e.x, e.y - 30, e.how === 'punch' ? 'バキッ！' : e.how === 'burn' ? 'あちっ！' : e.how === 'meteor' ? 'ドカッ' : 'ゴツッ', e.how === 'burn' ? '#FFC2A8' : '#FFFFFF', e.how === 'punch' ? 34 : 28, 0.6); puff(e.x, e.y, 6, '#FFE14D', 260, 40, 6, 0.35, 'star'); P.hitAt = G.t; S('hit', e.how === 'punch' ? 1 : 0); } break;
    case 'ko': if (P) { floatText(P.x, P.y - P.r - 60, 'ダウン！', '#FF8A8A', 42, 1.4); puff(P.x, P.y - P.r, 12, '#FFE14D', 300, 80, 9, 0.7, 'star'); FX.shake = Math.max(FX.shake, 0.3); S('ko'); } break;
    case 'slip': if (P) { floatText(e.x, e.y - 46, 'すりぬけ！', '#E6DDFF', 30, 0.9); puff(e.x, e.y, 10, '#D9CCFF', 220, 20, 7, 0.5); S('slip'); } break;
    case 'freeze': if (P) { puff(P.x, P.y, 14, '#DFF7FF', 300, 60, 8, 0.6, 'snow'); S('freeze'); } break;
    case 'knock': if (P) { puff(P.x, P.y - P.r, 6, '#FFE14D', 240, 60, 8, 0.5, 'star'); S('knock'); } break;
    case 'poof': puff(e.x, e.y, 9, 'rgba(235,235,245,.85)', 120, 40, 14, 0.5, 'smoke'); S('poof'); break;
    case 'itemIn': S('itemIn'); break;
    case 'item': if (P) { floatText(P.x, P.y - P.r - 40, ITEMS[e.it].icon + ' ' + ITEMS[e.it].name, '#FFFFFF', 30, 1.4); puff(P.x, P.y, 10, '#FFF3A0', 260, 40, 6, 0.5, 'star'); S('item'); } break;
    case 'clash': floatText(e.x, e.y - 40, 'バチッ', '#FFE14D', 36, 0.7); puff(e.x, e.y, 8, '#FFF6C0', 300, 0, 5, 0.3); S('clash'); break;
    case 'swing': if (P && M.mine.includes(P.i)) S('swing'); break;
    case 'jump': if (P && M.mine.includes(P.i)) S('jump'); break;
    case 'land': if (P) { if (e.v > 900) puff(P.x, GROUND - 2, 4, 'rgba(230,240,210,.7)', 120, 40, 6, 0.3); if (M.mine.includes(P.i)) S('land'); } break;
    case 'fizzle': if (P && M.mine.includes(P.i)) S('fizzle'); break;
    case 'end': if (!demo) { Sound.play('endWin'); Sound.sfx.crowdSwell(0.8); } break;
  }
}

function render(t) {
  const G = M.G, demo = M.mode === 'demo';
  const tags = demo ? null : G.players.map(p => ({ tag: true, me: M.mine.includes(p.i) && M.mine.length < G.players.length, label: M.label[p.i] }));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (BG.cv && (BG.cv.width !== cv.width || BG.cv.height !== cv.height)) BG.key = '';
  drawMatch(ctx, G, t, tags, { hud: !demo });
  if (M.paused && UI.screen === 'game') { worldTransform(ctx); outlined(ctx, '一時停止中', W / 2, 330, 64, '#FFFFFF', 11); }
  // the buttons, while the countdown runs (keyboard players)
  if (G.phase === 'countdown' && !demo) {
    worldTransform(ctx);
    const keys = !Touch.on && (M.mode === 'solo' || M.mode === 'guest' || M.mode === 'host');
    const y0 = keys ? 446 : 474, hh = keys ? 92 : 52;
    rrect(ctx, W / 2 - 440, y0, 880, hh, 26); ctx.fillStyle = 'rgba(16,22,40,.78)'; ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (keys) {
      ctx.font = `800 24px ${FONT_UI}`;
      ctx.fillText('←→ / A D：うごく　↑ / W：ジャンプ　↓ / S / スペース：キック　E / X：スーパー', W / 2, y0 + 28);
    }
    ctx.font = `800 22px ${FONT_UI}`; ctx.fillStyle = '#FFE58A';
    ctx.fillText('けり分け：前＋キック＝低いシュート　キックだけ＝ふつう　後ろ＋キック＝高いループ', W / 2, y0 + hh - 26);
  }
}

function finishMatch() {
  const sum = matchSummary(M.G);
  sum.labels = M.G.players.map(p => M.label[p.i]);
  if (M.mode === 'host') Net.broadcast({ t: 'res', sum });
  showResult(sum);
}

function showResult(sum) {
  const s = sum.score;
  $('#res-score').innerHTML = `<span class="r">${s[0]}</span><span class="sep">－</span><span class="b">${s[1]}</span>`;
  $('#res-win').textContent = sum.win < 0 ? 'ひきわけ！' : `${TEAM_COL[sum.win].name}チームのかち！${sum.ot ? '（Vゴール）' : ''}`;
  $('#res-win').style.color = sum.win < 0 ? '#FFFFFF' : TEAM_COL[sum.win].light;
  const rows = sum.players.map(p => `<tr><td><span class="dot" style="background:${TEAM_COL[p.team].main}"></span>${esc(sum.labels ? sum.labels[p.i] : p.name)}${p.i === sum.mvp ? '<span class="mvp">MVP</span>' : ''}</td><td>${esc(CHARS[p.char].name)}</td><td>${p.goals}${p.own ? `<small>（OG ${p.own}）</small>` : ''}</td><td>${p.shots}</td><td>${p.touches}</td><td>${p.supers}</td></tr>`).join('');
  $('#res-table').innerHTML = `<thead><tr><th>選手</th><th>キャラ</th><th>ゴール</th><th>キック</th><th>タッチ</th><th>スーパー</th></tr></thead><tbody>${rows}</tbody>`;
  const guest = M.mode === 'guest';
  $('#res-wait').hidden = !guest;
  $('#r-again').hidden = guest; $('#r-pick').hidden = guest;
  $('#r-title').textContent = guest ? '抜ける' : 'タイトルへ';
  show('result');
}

// ---------- pause ----------
function canPause() { return !!M.G && M.mode !== 'demo' && (UI.screen === 'game' || UI.screen === 'pause'); }
function setPause(on, fromNet) {
  if (!M.G || M.mode === 'demo') return;
  if (M.mode === 'host' && !on) for (const pr of Net.peers) pr.heardAt = performance.now() + 1000;
  if (M.mode === 'guest' && !fromNet) { Net.send({ t: 'pzq', on: on ? 1 : 0 }); if (!on) return; }
  M.paused = on;
  if (M.mode === 'host' && !fromNet) Net.broadcast({ t: 'pz', on: on ? 1 : 0 });
  if (on) {
    const guest = M.mode === 'guest', host = M.mode === 'host';
    $('#p-resume').hidden = guest; $('#p-retry').hidden = guest || host;
    $('#p-invite').hidden = !host;
    $('#p-quit').textContent = guest ? '試合を抜ける' : '試合をやめる';
    $('#pause-note').hidden = !guest; $('#pause-note').textContent = '1台目が一時停止しています。';
    show('pause');
  } else if (UI.screen === 'pause') show('game');
}
Input.onPause = () => {
  if (UI.screen === 'rejoin') return false;
  if (!canPause()) return false;
  if (M.mode === 'guest') { if (UI.screen === 'game') Net.send({ t: 'pzq', on: 1 }); return true; }
  setPause(!M.paused); return true;
};
$('#b-pause').addEventListener('click', () => { Sound.play('click'); if (M.mode === 'guest') Net.send({ t: 'pzq', on: 1 }); else setPause(true); });
$('#p-resume').addEventListener('click', () => { Sound.play('click'); setPause(false); });
$('#p-retry').addEventListener('click', () => { Sound.play('click'); const s = Object.assign({}, M.setup, { seed: (Math.random() * 1e9) | 0 }); startMatch(s, M.mode); });
$('#p-quit').addEventListener('click', () => {
  Sound.play('click');
  if (M.mode === 'host' && !confirm('試合をやめて、みんなを待合室にもどしますか？')) return;
  if (M.mode === 'host') { Net.backToLobby(); return; }
  if (M.mode === 'guest') { Net.guestLeave(); stopMatch(); toTitle(); return; }
  stopMatch(); toTitle();
});
$('#p-invite').addEventListener('click', () => { Sound.play('click'); openRejoin(); });

// ---------- touch controls ----------
function localUsesTouch() {
  if (!M.G || M.mode === 'demo') return false;
  return M.mine.some(i => M.devs[i] === 'touch' || M.devs[i] === 'any');
}
function updateTouch() {
  const on = Touch.on && localUsesTouch() && (UI.screen === 'game');
  const t = $('#touch');
  if (t.hidden === !on) return;
  t.hidden = !on;
  resize();
}
function updateTouchState() {
  if ($('#touch').hidden) return;
  const p = M.G.players[M.mine[0]]; if (!p) return;
  const b = $('#t-super');
  b.classList.toggle('full', p.gauge >= 1 && !p.armed);
  b.classList.toggle('armed', p.armed > 0);
}
window.UIHook = { touchOn() { updateTouch(); } };

// ---------- full screen (where the browser allows it) ----------
const fsOk = !!(document.documentElement.requestFullscreen) && !/iP(hone|od)/.test(navigator.userAgent);
$('#b-full').hidden = !fsOk;
$('#b-full').addEventListener('click', () => {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else { const p = document.documentElement.requestFullscreen(); if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); }
  } catch (e) {}
});

// ---------- character picker ----------
function buildPick(root, get, set, opts) {
  root.innerHTML = '';
  CHARS.forEach((ch, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.c = i;
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    drawPortrait(c, i, 0);
    b.appendChild(c);
    b.appendChild(document.createTextNode(ch.name));
    b.addEventListener('click', () => { Sound.play('click'); set(i); markPick(root, get()); if (opts && opts.info) charInfo(opts.info, get()); });
    root.appendChild(b);
  });
  markPick(root, get());
  if (opts && opts.info) charInfo(opts.info, get());
}
function markPick(root, v) { for (const b of root.querySelectorAll('button')) b.setAttribute('aria-pressed', String(+b.dataset.c === v)); }
function pips(n) { let s = '<span class="pips">'; for (let i = 1; i <= 5; i++) s += `<i class="${i <= n ? 'on' : ''}"></i>`; return s + '</span>'; }
function charInfo(el, ci) {
  const ch = CHARS[ci], sp = SUPERS[ch.sup];
  el.innerHTML = `<div class="nm">${esc(ch.name)}<span class="ctype">${esc(ch.type)}</span><small style="font:700 13px var(--font-ui);margin-left:10px;color:var(--chalk-soft)">${esc(ch.blurb)}</small></div>
    <div class="stats"><span>はやさ ${pips(ch.spd)}</span><span>ジャンプ ${pips(ch.jmp)}</span><span>キック ${pips(ch.kck)}</span><span>からだ ${pips(ch.body)}</span></div><div></div>
    <div class="sup">${sp.icon} <b>${esc(sp.name)}</b>　${esc(sp.desc)}</div>`;
}

// ---------- the rules row (time, items, stadium, CPU) ----------
function buildRules(root, opt) {
  opt = opt || {};
  const R = opt.get ? opt.get() : rules;
  const row = (label, key, vals) => `<div class="opt"><span class="opt-k">${label}</span><div class="seg" data-k="${key}">${vals.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${String(R[key]) === String(v)}"${opt.readonly ? ' disabled' : ''}>${t}</button>`).join('')}</div></div>`;
  let html = row('モード', 'mode', GAME_MODE_KEYS.map(k => [k, GAME_MODES[k].icon + ' ' + GAME_MODES[k].name]));
  html += `<p class="mode-desc">${esc((GAME_MODES[R.mode] || GAME_MODES.normal).desc)}</p>`;
  html += row('試合時間', 'time', [[60, '60秒'], [90, '90秒'], [120, '2分'], [180, '3分']]);
  html += row('アイテム', 'items', [[true, 'あり'], [false, 'なし']]);
  html += row('スタジアム', 'stadium', [['auto', 'おまかせ'], ['day', 'ひる'], ['sunset', 'ゆうがた'], ['night', 'よる']]);
  if (opt.cpu) html += row('CPUの強さ', 'lv', [['easy', 'よわい'], ['normal', 'ふつう'], ['hard', 'つよい']]);
  if (opt.fill) html += row('人数', 'fill', [[true, 'CPUで2対2にそろえる'], [false, 'いる人だけ']]);
  root.innerHTML = html;
  if (opt.readonly) return;
  for (const seg of root.querySelectorAll('.seg')) {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      Sound.play('click');
      const k = seg.dataset.k; let v = b.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
      const tgt = opt.get ? opt.get() : rules;
      tgt[k] = v;
      if (!opt.get) saveRules();
      for (const x of seg.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      if (k === 'mode') { const d = root.querySelector('.mode-desc'); if (d) d.textContent = (GAME_MODES[v] || GAME_MODES.normal).desc; }
      if (opt.change) opt.change();
    });
  }
}
function pickStadium(v, mode) { if (v === 'auto' && mode === 'moon') return 'night'; return v === 'auto' || !STADIUMS[v] ? STADIUM_KEYS[(Math.random() * STADIUM_KEYS.length) | 0] : v; }
function seg(id, get, set) {
  const root = $(id);
  const mark = () => { for (const b of root.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === String(get()))); };
  root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Sound.play('click'); set(b.dataset.v); mark(); });
  mark();
}

// ---------- title ----------
function toTitle() { if (!M.G || M.mode !== 'demo') demoStart(); show('title'); }
$('#b-solo').addEventListener('click', () => { Sound.play('click'); openSolo(); });
$('#b-multi').addEventListener('click', () => { Sound.play('click'); show('multi'); });
$('#b-howto').addEventListener('click', () => { Sound.play('click'); openHowto(); });
for (const b of $$('[data-back]')) b.addEventListener('click', () => { Sound.play('click'); if (UI.screen === 'local') LL.slots = []; show(UI.screen === 'local' || UI.screen === 'p2p' ? 'multi' : 'title'); if (UI.screen === 'multi' && false) return; });
// back from 'multi' goes to the title
$('#scr-multi [data-back]').addEventListener('click', () => show('title'));
function soundChips() {
  const s = Sound.state;
  $('#b-sfx').setAttribute('aria-pressed', String(s.sfx)); $('#b-bgm').setAttribute('aria-pressed', String(s.bgm));
}
$('#b-sfx').addEventListener('click', () => { Sound.set('sfx', !Sound.state.sfx); soundChips(); Sound.play('click'); });
$('#b-bgm').addEventListener('click', () => { Sound.set('bgm', !Sound.state.bgm); soundChips(); Sound.ensure(); Sound.bgm(false); Sound.bgm(true); });
soundChips();

// ---------- solo ----------
const solo = { char: pref.soloChar != null ? pref.soloChar : 0, size: pref.soloSize || 1 };
function openSolo() {
  buildPick($('#solo-pick'), () => solo.char, v => { solo.char = v; pref.soloChar = v; savePref(); }, { info: $('#solo-info') });
  buildRules($('#solo-rules'));
  show('solo');
}
seg('#solo-size', () => solo.size, v => { solo.size = +v; pref.soloSize = solo.size; savePref(); });
seg('#solo-lv', () => rules.lv, v => { rules.lv = v; saveRules(); });
$('#solo-go').addEventListener('click', () => {
  Sound.ensure(); Sound.play('click');
  const others = CHARS.map((_, i) => i).filter(c => c !== solo.char).sort(() => Math.random() - 0.5);
  const players = [{ name: 'あなた', char: solo.char, team: 0, ctrl: 'local', dev: 'any' }];
  if (solo.size === 2) players.push({ name: CHARS[others[2]].name, char: others[2], team: 0, ctrl: 'cpu' });
  players.push({ name: CHARS[others[0]].name, char: others[0], team: 1, ctrl: 'cpu' });
  if (solo.size === 2) players.push({ name: CHARS[others[1]].name, char: others[1], team: 1, ctrl: 'cpu' });
  startMatch({ players, mode: rules.mode, time: rules.time, items: rules.items, ot: true, stadium: pickStadium(rules.stadium, rules.mode), seed: (Math.random() * 1e9) | 0, lv: rules.lv }, 'solo');
});

// ---------- how to ----------
function openHowto() {
  const ul = $('#how-roster');
  if (!ul.children.length) {
    CHARS.forEach((ch, i) => {
      const li = document.createElement('li'), c = document.createElement('canvas'); c.width = 104; c.height = 104; drawPortrait(c, i, 0);
      li.appendChild(c);
      const sp = SUPERS[ch.sup];
      li.insertAdjacentHTML('beforeend', `<b>${esc(ch.name)}（${esc(ch.type)}）　${sp.icon} ${esc(sp.name)}</b><span>${esc(ch.blurb)}。${esc(sp.desc)}</span>`);
      ul.appendChild(li);
    });
    $('#how-modes').innerHTML = GAME_MODE_KEYS.map(k => `<li><b>${GAME_MODES[k].icon} ${esc(GAME_MODES[k].name)}</b>${esc(GAME_MODES[k].desc)}</li>`).join('');
    $('#how-items').innerHTML = ITEM_KEYS.map(k => `<li><b>${ITEMS[k].icon} ${esc(ITEMS[k].name)}</b>${esc(ITEMS[k].desc)}</li>`).join('');
  }
  show('howto');
}

// ---------- results ----------
$('#r-again').addEventListener('click', () => {
  Sound.play('click');
  if (M.mode === 'host') { Net.hostStart(true); return; }
  const s = Object.assign({}, M.setup, { seed: (Math.random() * 1e9) | 0, stadium: M.setup.stadium });
  startMatch(s, M.mode);
});
$('#r-pick').addEventListener('click', () => {
  Sound.play('click');
  if (M.mode === 'host') { Net.backToLobby(); return; }
  const mode = M.mode; stopMatch(); demoStart();
  if (mode === 'local') openLocal(true); else openSolo();
});
$('#r-title').addEventListener('click', () => {
  Sound.play('click');
  if (M.mode === 'host') { if (!confirm('みんなとの接続を切って、タイトルにもどりますか？')) return; Net.hostEnd(); }
  if (M.mode === 'guest') Net.guestLeave();
  stopMatch(); toTitle();
});

// ---------- menus with a gamepad: A presses the main button ----------
function padMenus() {
  const pr = takeMenuPresses(false);
  if (!pr.length) return;
  for (const { dev, e } of pr) {
    if (!/^pad/.test(dev)) continue;
    if (e.start && canPause()) { if (M.mode === 'guest') Net.send({ t: 'pzq', on: 1 }); else setPause(!M.paused); return; }
    if (UI.screen === 'game') continue;
    if (e.j || e.k) {
      const sc = $('#scr-' + UI.screen);
      if (!sc || sc.hidden) continue;
      const btn = document.activeElement && sc.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON' ? document.activeElement : sc.querySelector('[data-autofocus]:not([hidden])') || sc.querySelector('.btn-main:not([hidden]):not(:disabled)');
      if (btn) btn.click();
    }
  }
}

// ===================================================================
//  この画面で: whoever presses their kick button joins
// ===================================================================
const LL = { slots: [], allReadyT: 0 };
function devLabel(d) { return DEV_NAME[d] || (/^pad\d$/.test(d) ? 'ゲームパッド' + (+d[3] + 1) : d); }
function devShort(d) { return devLabel(d).replace(/（.*/, ''); }
function teamCount(t) { return LL.slots.filter(s => s.team === t).length; }
function freeChar() { const used = new Set(LL.slots.map(s => s.char)); for (let i = 0; i < CHARS.length; i++) if (!used.has(i)) return i; return 0; }
const NC = CHARS.length;
function openLocal(keep) {
  if (!keep) LL.slots = [];
  LL.slots.forEach(s => { s.ready = false; });
  buildRules($('#local-rules'), { cpu: true, fill: true });
  renderLocal();
  show('local');
}
$('#m-local').addEventListener('click', () => { Sound.play('click'); Sound.ensure(); openLocal(); });
function localJoin(dev) {
  if (LL.slots.length >= 4) { Sound.play('nope'); return; }
  const team = teamCount(0) <= teamCount(1) ? 0 : 1;
  const ch = pref.devChar && pref.devChar[dev] != null && !LL.slots.some(s => s.char === pref.devChar[dev]) ? pref.devChar[dev] : freeChar();
  const n = LL.slots.filter(s => !s.cpu).length + 1;
  LL.slots.push({ dev, char: ch, team, ready: false, cpu: false, name: n + 'P' });
  Sound.play('join');
  renderLocal();
}
function localSlotOf(dev) { return LL.slots.find(s => s.dev === dev && !s.cpu); }
function localTick() {
  const pr = takeMenuPresses(true);
  for (const { dev, e } of pr) {
    if (e.start) { localGo(); continue; }
    const s = localSlotOf(dev);
    if (!s) { if (e.k || e.j) localJoin(dev); continue; }
    if (e.l) { s.char = (s.char + NC - 1) % NC; s.ready = false; Sound.play('click'); }
    if (e.r) { s.char = (s.char + 1) % NC; s.ready = false; Sound.play('click'); }
    if (e.j) { const t = 1 - s.team; if (teamCount(t) < 3) { s.team = t; s.ready = false; Sound.play('click'); } }
    if (e.k) { s.ready = !s.ready; Sound.play(s.ready ? 'join' : 'click'); }
    if (e.s) { if (s.ready) s.ready = false; else LL.slots.splice(LL.slots.indexOf(s), 1); Sound.play('click'); }
    renderLocal();
  }
  // everyone who joined said OK: start
  const humans = LL.slots.filter(s => !s.cpu);
  if (humans.length && humans.every(s => s.ready) && localPlayable()) {
    if (!LL.allReadyT) { LL.allReadyT = performance.now(); $('#local-hint').textContent = '全員OK！ まもなくキックオフ…'; }
    else if (performance.now() - LL.allReadyT > 1100) { LL.allReadyT = 0; localGo(); }
  } else if (LL.allReadyT) { LL.allReadyT = 0; renderLocal(); }
}
function localPlayers() {
  const ps = LL.slots.map(s => ({ name: s.cpu ? CHARS[s.char].name : s.name, char: s.char, team: s.team, ctrl: s.cpu ? 'cpu' : 'local', dev: s.dev }));
  if (rules.fill) {
    const used = new Set(ps.map(p => p.char));
    for (let t = 0; t < 2; t++) {
      while (ps.filter(p => p.team === t).length < 2 && ps.length < 4) {
        let c = 0; while (used.has(c) && c < CHARS.length - 1) c++; used.add(c);
        ps.push({ name: CHARS[c].name, char: c, team: t, ctrl: 'cpu' });
      }
    }
  }
  // the engine wants each team's players listed in order
  return ps.sort((a, b) => a.team - b.team);
}
function localPlayable() {
  const ps = localPlayers();
  return ps.some(p => p.ctrl === 'local') && ps.some(p => p.team === 0) && ps.some(p => p.team === 1);
}
function localGo() {
  if (UI.screen !== 'local' || !localPlayable()) { Sound.play('nope'); return; }
  pref.devChar = pref.devChar || {};
  for (const s of LL.slots) if (!s.cpu) pref.devChar[s.dev] = s.char;
  savePref();
  Sound.ensure();
  startMatch({ players: localPlayers(), mode: rules.mode, time: rules.time, items: rules.items, ot: true, stadium: pickStadium(rules.stadium, rules.mode), seed: (Math.random() * 1e9) | 0, lv: rules.lv }, 'local');
}
$('#local-go').addEventListener('click', () => { Sound.play('click'); localGo(); });

function slotHTML(s, i, host) {
  const ch = CHARS[s.char], sp = SUPERS[ch.sup];
  return `<div class="slot${s.ready ? ' ready' : ''}" data-i="${i}">
    <canvas class="mag" width="116" height="116" data-c="${s.char}" data-t="${s.team}"></canvas>
    <div class="who"><b>${esc(s.name)}${s.cpu ? '<span class="tag-cpu">CPU</span>' : ''}${s.ready ? ' ✓' : ''}</b><span>${esc(ch.name)} ${sp.icon}</span><span>${esc(s.sub || '')}</span></div>
    <div class="ctl">${host ? `<button type="button" data-a="prev" aria-label="前のキャラ">◀</button><button type="button" data-a="next" aria-label="次のキャラ">▶</button><button type="button" data-a="team" aria-label="チームをかえる">⇄</button>${s.removable !== false ? '<button type="button" data-a="del" aria-label="外す">×</button>' : ''}` : ''}</div>
  </div>`;
}
function emptyHTML(team, label, btn) {
  return `<div class="slot empty"><span class="mag">＋</span><div class="who"><span>${esc(label)}</span>${btn ? `<div class="ctl" style="margin-top:6px"><button type="button" data-a="cpu" data-t="${team}">CPUを入れる</button>${btn === 'touch' ? `<button type="button" data-a="touch" data-t="${team}">タッチで参加</button>` : ''}</div>` : ''}</div></div>`;
}
function fieldHTML(slots, opt) {
  let html = '';
  for (let t = 0; t < 2; t++) {
    const mine = slots.map((s, i) => [s, i]).filter(([s]) => s.team === t);
    html += `<div class="half ${t ? 'blue' : 'red'}"><div class="half-h">${TEAM_COL[t].name}チーム</div>`;
    html += mine.map(([s, i]) => slotHTML(s, i, opt.edit)).join('');
    if (opt.empty && mine.length < 2) html += emptyHTML(t, opt.emptyLabel(t), opt.emptyBtn);
    html += '</div>';
  }
  return html;
}
function paintMagnets(root) { for (const c of root.querySelectorAll('canvas.mag')) drawPortrait(c, +c.dataset.c, +c.dataset.t); }
function renderLocal() {
  const f = $('#local-field');
  LL.slots.forEach(s => { s.sub = s.cpu ? '' : devShort(s.dev); });
  const canTouch = Touch.on && !LL.slots.some(s => s.dev === 'touch');
  f.innerHTML = fieldHTML(LL.slots, { edit: true, empty: LL.slots.length < 4, emptyLabel: () => 'あいている席', emptyBtn: canTouch ? 'touch' : 'cpu' });
  paintMagnets(f);
  const joined = new Set(LL.slots.map(s => s.dev));
  const keyHelp = [['kb1', 'S'], ['kb2', '↓'], ['kb3', 'G'], ['kb4', 'K']].filter(([d]) => !joined.has(d)).map(([d, k]) => `<span><b>${k}</b> ${esc(devLabel(d).replace(/（.*/, ''))}</span>`);
  if (Pads.n) keyHelp.push(`<span><b>A</b> ゲームパッド（${Pads.n}台）</span>`);
  $('#local-keys').innerHTML = keyHelp.length ? `<span>参加するボタン：</span>${keyHelp.join('')}<span>参加したら ◀▶ でキャラ、ジャンプでチーム、キックでOK、スーパーで外れる</span>` : '';
  if (!LL.allReadyT) $('#local-hint').textContent = LL.slots.length ? '全員がキックボタン（OK）を押すか、「キックオフ！」で始まります。' : '参加する人は、自分のキックボタンを押してください。';
  $('#local-go').disabled = !localPlayable();
}
$('#local-field').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  Sound.play('click');
  const a = b.dataset.a;
  if (a === 'cpu') { if (LL.slots.length < 4) { const t = +b.dataset.t; LL.slots.push({ dev: 'cpu' + Math.random(), char: freeChar(), team: t, ready: true, cpu: true, name: 'CPU' }); } renderLocal(); return; }
  if (a === 'touch') { if (!localSlotOf('touch') && LL.slots.length < 4) { localJoin('touch'); const s = localSlotOf('touch'); if (s) { s.team = +b.dataset.t; s.ready = true; } } renderLocal(); return; }
  const slot = b.closest('.slot'); if (!slot) return;
  const s = LL.slots[+slot.dataset.i]; if (!s) return;
  if (a === 'prev') s.char = (s.char + NC - 1) % NC;
  if (a === 'next') s.char = (s.char + 1) % NC;
  if (a === 'team') { const t = 1 - s.team; if (teamCount(t) < 3) s.team = t; }
  if (a === 'del') LL.slots.splice(LL.slots.indexOf(s), 1);
  if (s.cpu) s.ready = true;
  renderLocal();
});

// ===================================================================
//  合言葉で: the host and up to three friends
// ===================================================================
const Net = {
  role: '', peers: [], invite: null, link: null, members: [], you: -1, verErr: '', guestFail: '', sameHint: false,
  lobbyRules: null, seats: [], reconnecting: false, nextId: 1, pingT: 0,
  myName() { const v = ($('#my-name').value || '').trim(); return v || pref.name || 'ゲスト'; },
  token() { if (!pref.token) { pref.token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); savePref(); } return pref.token; },
  myChar() { return pref.netChar != null ? pref.netChar : 0; },
  broadcast(obj) { for (const pr of this.peers) if (pr.link.open) pr.link.send(obj); },
  send(obj) { if (this.link) this.link.send(obj); },
  inMatch() { return M.mode === 'host' && !!M.G; },
  // ----- host -----
  hostBegin() {
    this.role = 'host'; this.peers = []; this.invite = null; this.seats = []; this.verErr = '';
    this.hostChar = this.myChar(); this.hostTeam = 0;
    this.lobbyRules = Object.assign({}, rules);
    this.hostInvite();
    renderP2P();
  },
  hostInvite() {
    this.verErr = '';
    if (this.invite) { this.invite.h = {}; this.invite.end(''); }
    if (!this.inMatch() && this.peers.length >= 3) { this.invite = null; renderP2P(); return; }
    const link = this.invite = new Link({
      change: () => { renderP2P(); renderRejoin(); },
      open: l => this.hostOnOpen(l),
      msg: (m, l) => this.hostOnMsg(m, l),
      close: (l, why, wasOpen) => this.hostOnClose(l, why, wasOpen),
    });
    link.offer();
  },
  hostOnOpen(link) {
    if (link === this.invite) {
      this.invite = null;
      this.peers.push({ link, id: this.nextId++, name: '…', token: '', ok: false, char: 0, team: 1, idx: -1, pose: null, rtt: 60 });
      $('#pp-answer-in').value = ''; const ra = $('#rj-answer-in'); if (ra) ra.value = '';
    }
    renderP2P(); renderRejoin();
  },
  hostOnMsg(m, link) {
    const pr = this.peers.find(p => p.link === link);
    if (!pr) return;
    if (m.t === 'p') {
      if (!M.G || pr.idx < 0) return;
      const now = performance.now();
      pr.heardAt = now;
      const p = M.G.players[pr.idx];
      if (p && p.softAway) {
        // back from a quiet spell: the CPU had the seat, so the phone takes over from where it is now
        p.softAway = false; p.away = false; p.owned = false; p.ctrl = 'remote'; p._netKs = m.ks; p._netSs = m.ss;
        pr.ignoreUntil = now + 350; pr.pose = null;
        link.send({ t: 'adopt', x: r0(p.x), y: r2(p.y), vx: r0(p.vx), vy: r0(p.vy), g: p.ground ? 1 : 0 });
        renderNetbar();
        return;
      }
      if (pr.ignoreUntil && now < pr.ignoreUntil) return;
      if (m.ep === M.G.epoch) { pr.pose = m; pr.pose.at = now; if (m.rt) pr.rtt = clamp(m.rt, 5, 400); }
      return;
    }
    if (m.t === 'pi') { link.sendRt({ t: 'po', c: m.c }); return; }
    if (m.t === 'hello') {
      pr.name = String(m.name || 'ゲスト').slice(0, 8) || 'ゲスト'; pr.token = String(m.token || ''); pr.char = clamp(m.char | 0, 0, CHARS.length - 1);
      if (m.v !== NET_V) {
        link.send({ t: 'ver', v: NET_V });
        this.verErr = pr.name;
        this.peers.splice(this.peers.indexOf(pr), 1);
        setTimeout(() => { link.h = {}; link.end(''); }, 600);
        renderP2P(); renderRejoin(); return;
      }
      if (this.inMatch()) {
        // coming back: the same phone (or the same name) gets its seat again
        const holder = x => this.peers.find(q => q !== pr && q.idx === x.idx);
        const free = x => { const h = holder(x); return !h || !h.link.open || (M.G.players[x.idx] && M.G.players[x.idx].away); };
        const seat = this.seats.find(x => x.token && x.token === pr.token && free(x)) || this.seats.find(x => x.name === pr.name && free(x));
        if (!seat) { link.send({ t: 'full' }); link.h = {}; setTimeout(() => link.end(''), 300); this.peers.splice(this.peers.indexOf(pr), 1); renderRejoin(); return; }
        const old = holder(seat);
        if (old) { old.link.h = {}; old.link.end(''); this.peers.splice(this.peers.indexOf(old), 1); }
        pr.ok = true; pr.idx = seat.idx; pr.team = seat.team; pr.char = seat.char; seat.token = pr.token; pr.heardAt = performance.now();
        if (M.setup.players[pr.idx]) M.setup.players[pr.idx].peer = pr.id;
        const p = M.G.players[pr.idx];
        p.owned = false; p.away = false; p.softAway = false; p.ctrl = 'remote'; p._netKs = undefined; p._netSs = undefined;
        link.send({ t: 'start', setup: M.setup, idx: pr.idx, v: NET_V, sync: 1 });
        toast(`${M.label[pr.idx]} がもどってきました`);
        renderNetbar(); renderRejoin();
        if (!this.peers.some(q => !q.ok) && !M.G.players.some(q => q.away)) closeRejoin();
        return;
      }
      pr.ok = true;
      pr.team = this.members.length ? (this.peers.filter(q => q.ok && q !== pr).length % 2 === 0 ? 1 : 0) : 1;
      this.hostLobby(); renderP2P();
      return;
    }
    if (m.t === 'pick' && !this.inMatch()) { pr.char = clamp(m.char | 0, 0, CHARS.length - 1); this.hostLobby(); renderP2P(); return; }
    if (m.t === 'name' && !this.inMatch()) { pr.name = String(m.name || 'ゲスト').slice(0, 8) || 'ゲスト'; this.hostLobby(); renderP2P(); return; }
    if (m.t === 'pzq' && this.inMatch()) { if (m.on && !M.paused) setPause(true); return; }
  },
  hostOnClose(link, why, wasOpen) {
    const i = this.peers.findIndex(p => p.link === link);
    if (i >= 0) {
      const pr = this.peers[i];
      this.peers.splice(i, 1);
      if (this.inMatch() && pr.idx >= 0) {
        const p = M.G.players[pr.idx];
        if (p && (!p.owned || p.softAway)) {
          p.owned = true; p.away = true; p.softAway = false; p.ctrl = 'cpu';
          if (!p.cpu) p.cpu = mkCpu(this.lobbyRules.lv || 'normal', 99);
          toast(`${M.label[pr.idx]} との接続が切れました。CPUが代わりにプレーします`, 3200);
        }
        renderNetbar();
      } else if (!this.inMatch()) this.hostLobby();
    }
    if (link === this.invite) this.invite = null;
    renderP2P(); renderRejoin();
  },
  members_() {
    const ms = [{ id: 0, name: this.myName(), char: this.hostChar, team: this.hostTeam, host: true }];
    for (const p of this.peers) if (p.ok) ms.push({ id: p.id, name: p.name, char: p.char, team: p.team });
    return ms;
  },
  hostLobby() {
    this.members = this.members_();
    this.peers.forEach(p => { if (p.ok) p.link.send({ t: 'lobby', members: this.members, rules: this.lobbyRules, you: p.id, inMatch: this.inMatch() }); });
  },
  hostPlayers() {
    const ms = this.members_();
    const ps = ms.map(m => ({ name: m.name, char: m.char, team: m.team, ctrl: m.host ? 'local' : 'remote', dev: 'any', peer: m.id }));
    if (this.lobbyRules.fill) {
      const used = new Set(ps.map(p => p.char));
      for (let t = 0; t < 2; t++) while (ps.filter(p => p.team === t).length < 2 && ps.length < 4) {
        let c = 0; while (used.has(c) && c < CHARS.length - 1) c++; used.add(c);
        ps.push({ name: CHARS[c].name + '（CPU）', char: c, team: t, ctrl: 'cpu' });
      }
    }
    return ps.sort((a, b) => a.team - b.team);
  },
  hostCanStart() {
    const ps = this.hostPlayers();
    return this.peers.some(p => p.ok && p.link.open) && ps.some(p => p.team === 0) && ps.some(p => p.team === 1);
  },
  hostStart(again) {
    if (!again && !this.hostCanStart()) return false;
    if (this.invite) { this.invite.h = {}; this.invite.end(''); this.invite = null; }
    const R = this.lobbyRules;
    const players = again && M.setup ? M.setup.players : this.hostPlayers();
    const setup = { players, mode: R.mode || 'normal', time: R.time, items: R.items, ot: true, stadium: again && M.setup ? M.setup.stadium : pickStadium(R.stadium, R.mode), seed: (Math.random() * 1e9) | 0, lv: R.lv };
    pref.name = this.myName(); savePref();
    Sound.ensure();
    startMatch(setup, 'host');
    this.seats = [];
    for (const pr of this.peers) {
      pr.idx = players.findIndex(p => p.ctrl === 'remote' && p.peer === pr.id);
      pr.pose = null; pr.heardAt = performance.now() + 1500; pr.ignoreUntil = 0;
      if (pr.idx >= 0) {
        this.seats.push({ token: pr.token, name: pr.name, idx: pr.idx, team: players[pr.idx].team, char: players[pr.idx].char });
        pr.link.send({ t: 'start', setup, idx: pr.idx, v: NET_V });
      }
    }
    // a friend who was in the last match but is gone now: the CPU plays for them
    M.G.players.forEach((p, i) => { if (setup.players[i].ctrl === 'remote' && !this.peers.some(pr => pr.idx === i)) { p.owned = true; p.away = true; p.ctrl = 'cpu'; } });
    this.hostLobby();
    renderNetbar();
    return true;
  },
  hostSnap() {
    if (!M.G) return;
    const s = encodeSnap(M.G, ++M.snapSeq);
    for (const pr of this.peers) if (pr.ok && pr.idx >= 0 && pr.link.open) pr.link.sendRt(s);
  },
  backToLobby() {
    stopMatch(); demoStart();
    this.seats = [];
    for (const pr of this.peers) pr.idx = -1;
    this.hostLobby();
    for (const pr of this.peers) if (pr.ok) pr.link.send({ t: 'back' });
    renderP2P(); show('p2p');
  },
  hostEnd() {
    this.broadcast({ t: 'end' });
    for (const p of this.peers) { p.link.h = {}; p.link.end(''); }
    if (this.invite) { this.invite.h = {}; this.invite.end(''); }
    this.peers = []; this.invite = null; this.role = ''; this.seats = [];
  },
  // ----- guest -----
  guestBegin() { this.role = 'guest'; this.link = null; this.members = []; this.verErr = ''; this.guestFail = ''; this.sameHint = false; renderP2P(); },
  guestReply(text) {
    const cur = this.link, key = p2pCodeKey(text);
    if (cur && !cur.ended && !cur.open && cur.offerKey && (!key || cur.offerKey === key)) { this.sameHint = key ? 'same' : 'bad'; renderP2P(); renderRejoin(); return; }
    this.verErr = ''; this.guestFail = ''; this.sameHint = false;
    if (this.link) { this.link.h = {}; this.link.end(''); }
    const link = this.link = new Link({
      change: () => { renderP2P(); renderRejoin(); },
      open: l => { l.send({ t: 'hello', name: this.myName(), v: NET_V, token: this.token(), char: this.myChar() }); pref.name = this.myName(); savePref(); renderP2P(); renderRejoin(); },
      msg: m => this.guestOnMsg(m),
      close: (l, why, wasOpen) => this.guestOnClose(l, why, wasOpen),
    });
    link.answer(text);
  },
  guestOnMsg(m) {
    if (m.t === 's') { if (M.mode === 'guest' && M.G) guestApplySnap(M.G, m, M.mine[0], onEvent); return; }
    if (m.t === 'po') { const r = performance.now() - m.c; NetSync.rtt = NetSync.rtt * 0.7 + clamp(r, 1, 500) * 0.3; return; }
    if (m.t === 'lobby') { this.members = m.members || []; this.you = m.you; this.lobbyRules = m.rules; if (UI.screen === 'p2p') renderP2P(); return; }
    if (m.t === 'ver' || (m.t === 'start' && m.v !== NET_V)) {
      const l = this.link; this.link = null; if (l) { l.h = {}; l.end(''); }
      this.verErr = 'x'; this.members = []; renderP2P();
      setTimeout(() => alert('1台目とページの版がちがいます。両方のスマホでページを再読み込み（更新）してから、もう一度つないでください。'), 50);
      return;
    }
    if (m.t === 'start') {
      this.reconnecting = false; closeRejoin();
      startMatch(m.setup, 'guest', { myIdx: m.idx, sync: !!m.sync });
      renderNetbar();
      return;
    }
    if (m.t === 'pz') { if (M.mode === 'guest') setPause(!!m.on, true); return; }
    if (m.t === 'adopt') { const me = M.G && M.G.players[M.mine[0]]; if (me && M.mode === 'guest') { me.x = m.x; me.y = m.y; me.vx = m.vx; me.vy = m.vy; me.ground = !!m.g; } return; }
    if (m.t === 'res') { if (M.mode === 'guest') { M.endShown = true; showResult(m.sum); } return; }
    if (m.t === 'back') { if (M.mode === 'guest') { stopMatch(); demoStart(); } renderP2P(); show('p2p'); return; }
    if (m.t === 'full') { this.guestOnClose(this.link, 'full', true); return; }
    if (m.t === 'end') { this.guestOnClose(this.link, 'end', true); return; }
  },
  guestOnClose(link, why, wasOpen) {
    if (link && link !== this.link) return;
    this.link = null;
    this.guestFail = !wasOpen && why && why !== 'end' && why !== 'full' ? why : '';
    if (M.mode === 'guest' && M.G && why !== 'end' && why !== 'full') {
      // the match goes on at the host; this phone waits for a fresh code
      this.reconnecting = true;
      renderNetbar();
      openRejoin();
      return;
    }
    if (M.mode === 'guest' || why === 'end' || why === 'full') {
      this.reconnecting = false; closeRejoin();
      if (M.mode === 'guest') stopMatch();
      this.members = []; this.role = '';
      toTitle();
      setTimeout(() => alert(why === 'end' ? '1台目がゲームを終了しました。' : why === 'full' ? 'この試合に あなたの席はありませんでした。' : '1台目との接続が切れました。'), 50);
      return;
    }
    this.members = [];
    if (UI.screen === 'p2p') renderP2P();
    renderRejoin();
  },
  guestPose(me) {
    const l = this.link; if (!l || !l.open || !M.G) return;
    l.sendRt({ t: 'p', ep: NetSync.epoch, x: r0(me.x), y: r2(me.y), vx: r0(me.vx), vy: r0(me.vy), g: me.ground ? 1 : 0, ks: me.kick.seq, kt: r3(me.kick.t), kd: me.kick.dir | 0, ss: me.superSeq, sc: r2(me.scale), lk: r3(me.legK || 1), rt: r0(NetSync.rtt) });
    const now = performance.now();
    if (now - this.pingT > 1000) { this.pingT = now; l.sendRt({ t: 'pi', c: now }); }
  },
  guestLeave() { if (this.link) { this.link.h = {}; this.link.end(''); } this.link = null; this.role = ''; this.members = []; this.reconnecting = false; },
};

// ---------- the p2p screen ----------
function openP2P() {
  $('#my-name').value = pref.name || '';
  const where = p2pWhere();
  if (where !== 'web' || !p2pOk()) {
    Net.role = '';
    renderP2P(where === 'claude' ? 'nortc_claude' : where === 'file' ? 'nortc_file' : 'nortc');
  } else renderP2P();
  show('p2p');
}
$('#m-p2p').addEventListener('click', () => { Sound.play('click'); openP2P(); });
$('#pp-host-go').addEventListener('click', () => { Sound.play('click'); Net.hostBegin(); });
$('#pp-guest-go').addEventListener('click', () => { Sound.play('click'); Net.guestBegin(); });
$('#pp-link').addEventListener('click', () => { Sound.play('click'); if (Net.invite) Net.invite.accept($('#pp-answer-in').value); });
$('#pp-newcode').addEventListener('click', () => { Sound.play('click'); $('#pp-answer-in').value = ''; Net.hostInvite(); });
$('#pp-more').addEventListener('click', () => { Sound.play('click'); $('#pp-answer-in').value = ''; Net.hostInvite(); renderP2P(); });
$('#pp-reply').addEventListener('click', () => { Sound.play('click'); Net.guestReply($('#pp-offer-in').value); });
$('#pp-start').addEventListener('click', () => { Sound.play('click'); Net.hostStart(); });
$('#pp-back').addEventListener('click', () => {
  Sound.play('click');
  if ((Net.role === 'host' && Net.peers.length) || (Net.role === 'guest' && Net.link && Net.link.open)) { if (!confirm('接続を切って もどりますか？')) return; }
  if (Net.role === 'host') Net.hostEnd(); else if (Net.role === 'guest') Net.guestLeave();
  Net.role = '';
  show('multi');
});
$('#pp-answer-in').addEventListener('input', () => { if (Net.invite && Net.invite.err) { Net.invite.err = ''; renderP2P(); } });
$('#pp-offer-in').addEventListener('input', () => { if (Net.link && Net.link.err) { Net.link.err = ''; renderP2P(); } Net.sameHint = false; });
$('#my-name').addEventListener('change', () => {
  pref.name = Net.myName(); savePref();
  if (Net.role === 'host') { Net.hostLobby(); renderP2P(); }
  if (Net.role === 'guest' && Net.link && Net.link.open) Net.send({ t: 'name', name: Net.myName() });
});
function copyBtn(btnSel, areaSel) {
  $(btnSel).addEventListener('click', async () => {
    Sound.play('click');
    const v = $(areaSel).value; if (!v) return;
    try { await navigator.clipboard.writeText(v); toast('コピーしました'); }
    catch (e) { const a = $(areaSel); a.focus(); a.select(); try { document.execCommand('copy'); toast('コピーしました'); } catch (er) { toast('長押ししてコピーしてください'); } }
  });
}
function shareBtn(btnSel, areaSel, who) {
  const b = $(btnSel);
  b.hidden = typeof navigator.share !== 'function';
  b.addEventListener('click', () => {
    Sound.play('click');
    const v = $(areaSel).value; if (!v) return;
    const text = who === 'host' ? `ゴッツンサッカーでいっしょに遊ぼう！\n${SITE} を開いて「みんなで あそぶ」→「スマホをつなぐ」→「2台目以降」で、この合言葉を貼ってね。\n\n${v}` : `返事の合言葉です。1台目の②に貼ってね。\n\n${v}`;
    navigator.share({ text }).catch(() => {});
  });
}
copyBtn('#pp-offer-copy', '#pp-offer'); copyBtn('#pp-answer-copy', '#pp-answer');
shareBtn('#pp-offer-share', '#pp-offer', 'host'); shareBtn('#pp-answer-share', '#pp-answer', 'guest');

function setStatus(el, msg, state) { el.hidden = !msg; el.textContent = msg || ''; el.dataset.state = state || ''; }
function renderP2P(errKey) {
  const role = Net.role, st = $('#pp-status');
  $('#pp-pickrole').hidden = !!role;
  $('#pp-host').hidden = role !== 'host';
  $('#pp-guest').hidden = role !== 'guest';
  $('#pp-site').hidden = true;
  if (errKey) { setStatus(st, P2P_ERR[errKey], 'bad'); $('#pp-pickrole').hidden = true; $('#pp-lobby').hidden = true; $('#pp-start').hidden = true; if (errKey !== 'nortc') { $('#pp-site').hidden = false; $('#pp-site').innerHTML = `<a href="${SITE}" target="_blank" rel="noopener">${SITE.replace('https://', '')}</a>`; } return; }
  let msg = '', state = '';
  if (role === 'host') {
    const inv = Net.invite, ready = Net.peers.filter(p => p.ok);
    $('#pp-invite').hidden = !inv;
    $('#pp-more').hidden = !!inv || ready.length >= 3;
    if (inv) {
      $('#pp-invite-h').textContent = ready.length ? `① ${ready.length + 2}人目に、この合言葉を送る` : '① この合言葉を相手に送る';
      $('#pp-offer').value = inv.state === 'offer' || inv.state === 'linking' || inv.state === 'failed' ? inv.code : '';
      const s = inv.state;
      msg = inv.err ? P2P_ERR[inv.err] || '' : P2P_MSG[s] || '';
      state = inv.err || s === 'failed' ? 'bad' : '';
      if (s === 'error') msg = P2P_ERR[inv.err] || P2P_ERR.make;
    } else if (ready.length) { msg = ready.length >= 3 ? '4人そろいました。' : `${ready.length + 1}人がつながっています。もっとさそうときは「もう1人さそう」。`; state = 'ok'; }
    if (Net.verErr) { msg = `${Net.verErr} さんのページが、このページと別の版でした。両方のページを再読み込み（更新）してから、合言葉を作り直してください。`; state = 'bad'; }
    $('#pp-lobby').hidden = !ready.length;
    $('#pp-start').hidden = false;
    $('#pp-start').disabled = !Net.hostCanStart();
    $('#pp-wait').hidden = true;
    if (ready.length) renderP2PLobby(true);
  } else if (role === 'guest') {
    const l = Net.link, stt = l ? l.state : 'idle';
    $('#pp-reply-wrap').hidden = !!(l && l.open);
    $('#pp-reply-box').hidden = !(l && (stt === 'answer' || stt === 'failed') && l.code);
    $('#pp-answer').value = l && l.code ? l.code : '';
    if (l) { msg = l.err ? P2P_ERR[l.err] || '' : P2P_MSG[stt] || ''; state = l.err || stt === 'failed' ? 'bad' : stt === 'open' ? 'ok' : ''; }
    if (Net.sameHint && stt === 'answer') msg = Net.sameHint === 'bad' ? P2P_ERR.badcode : SAME_CODE_MSG;
    if (!l && Net.guestFail) { msg = GUEST_FAIL_MSG; state = 'bad'; }
    if (!l && Net.verErr) { msg = '1台目とページの版がちがいました。このページを再読み込み（更新）してから、もう一度つないでください。'; state = 'bad'; }
    const inLobby = !!(l && l.open && Net.members.length);
    $('#pp-lobby').hidden = !inLobby;
    $('#pp-start').hidden = true;
    $('#pp-wait').hidden = !inLobby;
    if (inLobby) { renderP2PLobby(false); msg = 'つながりました！ キャラクターをえらんで待っていてください。'; state = 'ok'; }
  } else { $('#pp-lobby').hidden = true; $('#pp-start').hidden = true; }
  setStatus(st, msg, state);
}
function renderP2PLobby(isHost) {
  const ms = isHost ? Net.members_() : Net.members;
  const slots = ms.map(m => ({ name: m.name + (m.host ? '（1台目）' : ''), char: m.char, team: m.team, ready: false, cpu: false, sub: m.host ? '' : (isHost ? 'つながっています' : (m.id === Net.you ? 'あなた' : '')), removable: false, mid: m.id }));
  if (isHost && Net.lobbyRules.fill) {
    const used = new Set(ms.map(m => m.char));
    for (let t = 0; t < 2; t++) {
      let n = slots.filter(s => s.team === t).length;
      while (n < 2 && slots.length < 4) { let c = 0; while (used.has(c) && c < CHARS.length - 1) c++; used.add(c); slots.push({ name: 'CPU', char: c, team: t, cpu: true, removable: false, sub: '（あいている席）', mid: -1 }); n++; }
    }
  }
  const f = $('#pp-field');
  f.innerHTML = fieldHTML(slots, { edit: false, empty: false });
  // the host moves people between the teams by tapping their magnet
  if (isHost) {
    f.querySelectorAll('.slot').forEach(el => {
      const s = slots[+el.dataset.i]; if (!s || s.cpu) return;
      const b = el.querySelector('.ctl');
      b.innerHTML = '<button type="button" aria-label="チームをかえる">⇄</button>';
      b.querySelector('button').addEventListener('click', () => {
        Sound.play('click');
        if (s.mid === 0) Net.hostTeam = 1 - Net.hostTeam;
        else { const pr = Net.peers.find(p => p.id === s.mid); if (pr) pr.team = 1 - pr.team; }
        Net.hostLobby(); renderP2P();
      });
    });
  }
  paintMagnets(f);
  const get = () => isHost ? Net.hostChar : Net.myChar();
  const set = v => {
    pref.netChar = v; savePref();
    if (isHost) { Net.hostChar = v; Net.hostLobby(); renderP2P(); }
    else { Net.send({ t: 'pick', char: v }); }
  };
  const pick = $('#pp-pick');
  if (!pick.children.length || pick.dataset.role !== (isHost ? 'h' : 'g')) { buildPick(pick, get, set, { info: $('#pp-info') }); pick.dataset.role = isHost ? 'h' : 'g'; }
  else { markPick(pick, get()); charInfo($('#pp-info'), get()); }
  const rr = $('#pp-rules');
  buildRules(rr, isHost ? { get: () => Net.lobbyRules, cpu: true, fill: true, change: () => { Net.hostLobby(); renderP2P(); } } : { get: () => Net.lobbyRules || rules, cpu: true, fill: true, readonly: true });
}

// ---------- coming back after a lost link ----------
function openRejoin() {
  if (M.mode === 'host' && !Net.invite) Net.hostInvite();
  renderRejoin();
  show('rejoin');
}
function closeRejoin() { if (UI.screen === 'rejoin') show(M.G && M.mode !== 'demo' ? (M.paused ? 'pause' : 'game') : 'title'); }
$('#rj-close').addEventListener('click', () => { Sound.play('click'); if (M.mode === 'guest' && Net.reconnecting) { if (!confirm('つなぎ直さずに、試合を抜けますか？')) return; Net.guestLeave(); stopMatch(); toTitle(); return; } closeRejoin(); });
function renderRejoin() {
  if (UI.screen !== 'rejoin') return;
  const body = $('#rj-body');
  let html = '';
  if (M.mode === 'host') {
    const away = M.G ? M.G.players.filter(p => p.away).map(p => M.label[p.i]) : [];
    const inv = Net.invite;
    html += `<p class="hint">${away.length ? esc(away.join('、')) + ' の席が空いています（CPUが代わりにプレー中）。' : ''}この合言葉を送って、相手の「つなぎ直す」に貼ってもらいます。</p>`;
    html += `<textarea class="code" id="rj-offer" readonly rows="3">${inv && inv.code ? esc(inv.code) : ''}</textarea><div class="btn-row"><button class="btn btn-sub" id="rj-copy" type="button">コピー</button></div>`;
    html += `<h3>相手から届いた返事を貼る</h3><textarea class="code in" id="rj-answer-in" rows="2" placeholder="ここに貼る"></textarea><div class="btn-row"><button class="btn btn-main" id="rj-link" type="button">つなぐ</button><button class="btn btn-sub" id="rj-new" type="button">合言葉を作り直す</button></div>`;
    const msg = inv ? (inv.err ? P2P_ERR[inv.err] : P2P_MSG[inv.state]) : '';
    if (msg) html += `<p class="status">${esc(msg)}</p>`;
  } else {
    const l = Net.link, stt = l ? l.state : 'idle';
    html += `<p class="hint">1台目との接続が切れました。試合は1台目で続いています（CPUが代わりにプレー中）。1台目に「合言葉で呼びもどす」を押してもらい、届いた合言葉を貼ってください。</p>`;
    html += `<textarea class="code in" id="rj-offer-in" rows="2" placeholder="ここに貼る"></textarea><button class="btn btn-main" id="rj-reply" type="button">返事の合言葉を作る</button>`;
    if (l && l.code && !l.open) html += `<h3>この返事を1台目に送る</h3><textarea class="code" id="rj-answer" readonly rows="3">${esc(l.code)}</textarea><div class="btn-row"><button class="btn btn-sub" id="rj-copy2" type="button">コピー</button></div>`;
    const msg = l ? (l.err ? P2P_ERR[l.err] : P2P_MSG[stt]) : Net.guestFail ? GUEST_FAIL_MSG : '';
    if (msg) html += `<p class="status">${esc(msg)}</p>`;
  }
  const keepOffer = $('#rj-offer-in') ? $('#rj-offer-in').value : '', keepAns = $('#rj-answer-in') ? $('#rj-answer-in').value : '';
  body.innerHTML = html;
  if ($('#rj-offer-in')) $('#rj-offer-in').value = keepOffer;
  if ($('#rj-answer-in')) $('#rj-answer-in').value = keepAns;
  const cp = (b, a) => { const x = $(b); if (x) x.onclick = async () => { Sound.play('click'); try { await navigator.clipboard.writeText($(a).value); toast('コピーしました'); } catch (e) { $(a).select(); try { document.execCommand('copy'); toast('コピーしました'); } catch (er) {} } }; };
  cp('#rj-copy', '#rj-offer'); cp('#rj-copy2', '#rj-answer');
  if ($('#rj-link')) $('#rj-link').onclick = () => { Sound.play('click'); if (Net.invite) Net.invite.accept($('#rj-answer-in').value); };
  if ($('#rj-new')) $('#rj-new').onclick = () => { Sound.play('click'); Net.hostInvite(); renderRejoin(); };
  if ($('#rj-reply')) $('#rj-reply').onclick = () => { Sound.play('click'); Net.role = 'guest'; Net.guestReply($('#rj-offer-in').value); };
}
function renderNetbar() {
  const bar = $('#netbar');
  let html = '';
  if (M.mode === 'host' && M.G) {
    const away = M.G.players.filter(p => p.away).map(p => M.label[p.i]);
    if (away.length) html = `<span>📵 ${esc(away.join('、'))}：CPUが代わりにプレー中</span><button class="btn btn-sub" id="nb-rc" type="button">呼びもどす</button>`;
  } else if (M.mode === 'guest' && Net.reconnecting) html = `<span>📵 1台目との接続が切れました</span><button class="btn btn-sub" id="nb-rc" type="button">つなぎ直す</button>`;
  bar.hidden = !html || UI.screen !== 'game';
  if (bar.innerHTML !== html) { bar.innerHTML = html; const b = $('#nb-rc'); if (b) b.onclick = () => { Sound.play('click'); openRejoin(); }; }
}
setInterval(() => { if (M.G && M.mode !== 'demo') renderNetbar(); else $('#netbar').hidden = true; }, 1000);

// ---------- a newer version on the site: take it by itself ----------
// phones keep an open page (and the site's page) for a long time, so look now and then and reload on the title screen
var BUILD_ID = '__BUILD__';
var Updater = {
  busy: false, pending: false,
  safe() {
    const idle = !M.G || M.mode === 'demo';
    const linked = Net.peers.length > 0 || !!(Net.link && Net.link.open);
    return idle && !linked && (UI.screen === 'title' || UI.screen === 'howto');
  },
  check() {
    if (this.busy || !/^https?:$/.test(location.protocol) || BUILD_ID.indexOf('__') === 0) return;
    this.busy = true;
    fetch(location.href.split('#')[0], { cache: 'reload' }).then(r => (r.ok ? r.text() : '')).then(t => {
      this.busy = false;
      const m = /name="gottsun-build" content="([0-9a-f]+)"/.exec(t);
      if (!m || m[1] === BUILD_ID) return;
      let tried = ''; try { tried = sessionStorage.getItem('gottsun-upd') || ''; } catch (e) {}
      if (tried === m[1]) return;                       // reloaded for this one already: no loops
      if (!this.safe()) { this.pending = true; return; } // after the match, back on the title screen
      try { sessionStorage.setItem('gottsun-upd', m[1]); } catch (e) {}
      location.reload();
    }).catch(() => { this.busy = false; });
  },
};

// ---------- start ----------
// the stadium's lettering is drawn once; draw it again when the web font has arrived
try { if (document.fonts) { document.fonts.ready.then(() => { BG.key = ''; }); document.fonts.addEventListener('loadingdone', () => { BG.key = ''; }); } } catch (e) {}
resize();
demoStart();
show('title');
requestAnimationFrame(frame);
setTimeout(() => Updater.check(), 1200);
window.addEventListener('pageshow', () => resize());
// a page that was asleep comes back with a stale clock
document.addEventListener('visibilitychange', () => {
  lastNow = performance.now(); M.acc = 0;
  // this page was asleep, not the friends
  if (!document.hidden) for (const pr of Net.peers) pr.heardAt = performance.now() + 500;
  if (!document.hidden) Updater.check();
});
