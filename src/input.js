// ===================================================================
//  input: four keyboard layouts, gamepads, and the touch buttons.
//  A "device" is one of kb1..kb4, pad0..pad3, touch, or any (every key).
//  inputFor(dev) gives { l, r, j, jp, k, s }: held left/right/jump and
//  what was pressed since the last consumeInput().
// ===================================================================

const KEYMAP = {
  kb1: { l: ['KeyA'], r: ['KeyD'], j: ['KeyW'], k: ['KeyS', 'Space'], s: ['KeyE', 'KeyQ'] },
  kb2: { l: ['ArrowLeft'], r: ['ArrowRight'], j: ['ArrowUp'], k: ['ArrowDown', 'Period', 'Numpad0'], s: ['Enter', 'NumpadEnter', 'ShiftRight', 'Slash', 'Numpad1'] },
  kb3: { l: ['KeyF'], r: ['KeyH'], j: ['KeyT'], k: ['KeyG'], s: ['KeyY'] },
  kb4: { l: ['KeyJ'], r: ['KeyL'], j: ['KeyI'], k: ['KeyK'], s: ['KeyO'] },
};
KEYMAP.any = {};
for (const a of ['l', 'r', 'j', 'k', 's']) KEYMAP.any[a] = [].concat(...['kb1', 'kb2', 'kb3', 'kb4'].map(d => KEYMAP[d][a]));
KEYMAP.any.k.push('KeyZ'); KEYMAP.any.s.push('KeyX', 'ShiftLeft');
const DEV_NAME = { kb1: 'キーボード1（A・D・W・S）', kb2: 'キーボード2（矢印）', kb3: 'キーボード3（F・H・T・G）', kb4: 'キーボード4（J・L・I・K）', touch: 'タッチ', any: 'キーボード' };
const GAME_CODES = new Set([].concat(...Object.values(KEYMAP.any)));

const Keys = { down: new Set(), edge: new Set() };
const Pads = { st: [], n: 0, prevBtn: [[], [], [], []], edge: [{}, {}, {}, {}], menuEdge: [{}, {}, {}, {}] };
const Touch = { on: false, l: 0, r: 0, j: 0, edge: {}, moveId: null };
const Input = { capture: false, onPause: null, onMenuKey: null };

function typingIn(e) { return e.target && /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName || ''); }
window.addEventListener('keydown', e => {
  if (typingIn(e)) return;
  if (Input.capture && GAME_CODES.has(e.code)) e.preventDefault();
  if ((e.code === 'Escape' || e.code === 'KeyP') && Input.onPause) { if (Input.onPause()) e.preventDefault(); }
  if (!e.repeat) { Keys.edge.add(e.code); if (Input.onMenuKey) Input.onMenuKey(e); }
  Keys.down.add(e.code);
});
window.addEventListener('keyup', e => { Keys.down.delete(e.code); });
window.addEventListener('blur', () => { Keys.down.clear(); Touch.l = Touch.r = Touch.j = 0; });

const anyDown = codes => codes.some(k => Keys.down.has(k));
const anyEdge = codes => codes.some(k => Keys.edge.has(k));

function pollPads() {
  let list = [];
  try { list = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(p => p && p.connected) : []; } catch (e) { list = []; }
  Pads.n = list.length;
  for (let i = 0; i < 4; i++) {
    const gp = list[i];
    if (!gp) { Pads.st[i] = null; continue; }
    const b = k => !!(gp.buttons[k] && (gp.buttons[k].pressed || gp.buttons[k].value > 0.5));
    let mx = gp.axes[0] || 0;
    if (Math.abs(mx) < 0.35) mx = 0;
    const st = {
      l: b(14) || mx < 0, r: b(15) || mx > 0,
      j: b(0) || b(12),
      k: b(2) || b(1) || b(7),
      s: b(3) || b(4) || b(5) || b(6),
      start: b(9), back: b(8),
    };
    const pv = Pads.prevBtn[i];
    for (const a of ['j', 'k', 's', 'start', 'l', 'r']) if (st[a] && !pv[a]) { Pads.edge[i][a] = true; Pads.menuEdge[i][a] = true; }
    Pads.prevBtn[i] = st;
    Pads.st[i] = st;
  }
}

function inputFor(dev) {
  const o = { l: 0, r: 0, j: 0, jp: 0, k: 0, s: 0 };
  const add = (m) => {
    if (anyDown(m.l)) o.l = 1; if (anyDown(m.r)) o.r = 1; if (anyDown(m.j)) o.j = 1;
    if (anyEdge(m.j)) o.jp = 1; if (anyEdge(m.k)) o.k = 1; if (anyEdge(m.s)) o.s = 1;
  };
  const pad = i => {
    const st = Pads.st[i]; if (!st) return;
    if (st.l) o.l = 1; if (st.r) o.r = 1; if (st.j) o.j = 1;
    const e = Pads.edge[i]; if (e.j) o.jp = 1; if (e.k) o.k = 1; if (e.s) o.s = 1;
  };
  const touch = () => {
    if (Touch.l) o.l = 1; if (Touch.r) o.r = 1; if (Touch.j) o.j = 1;
    if (Touch.edge.j) o.jp = 1; if (Touch.edge.k) o.k = 1; if (Touch.edge.s) o.s = 1;
  };
  if (KEYMAP[dev]) add(KEYMAP[dev]);
  if (dev === 'any') { for (let i = 0; i < 4; i++) pad(i); touch(); }
  else if (/^pad\d$/.test(dev)) pad(+dev[3]);
  else if (dev === 'touch') touch();
  if (o.l && o.r) { o.l = 0; o.r = 0; }
  return o;
}
function consumeInput() {
  Keys.edge.clear();
  for (let i = 0; i < 4; i++) Pads.edge[i] = {};
  Touch.edge = {};
}
// presses per device since the last call, for screens that are not the match.
// withKeys: also the keyboard layouts (the この画面で lobby); the keys' presses are then used up
function takeMenuPresses(withKeys) {
  const out = [];
  if (withKeys) {
    for (const d of ['kb1', 'kb2', 'kb3', 'kb4']) {
      const m = KEYMAP[d], e = {};
      if (anyEdge(m.k)) e.k = 1; if (anyEdge(m.j)) e.j = 1; if (anyEdge(m.s)) e.s = 1; if (anyEdge(m.l)) e.l = 1; if (anyEdge(m.r)) e.r = 1;
      if (Object.keys(e).length) out.push({ dev: d, e });
    }
    Keys.edge.clear();
  }
  for (let i = 0; i < 4; i++) {
    const me = Pads.menuEdge[i];
    if (Object.keys(me).length) out.push({ dev: 'pad' + i, e: me });
    Pads.menuEdge[i] = {};
  }
  return out;
}

// ---------- touch ----------
const touchEl = document.getElementById('touch');
function setupTouch() {
  const pad = document.getElementById('t-move'), arrows = pad.querySelectorAll('.tarrow');
  const at = e => {
    const r = pad.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    Touch.l = x < 0.5 ? 1 : 0; Touch.r = x >= 0.5 ? 1 : 0;
    arrows[0].classList.toggle('on', !!Touch.l); arrows[1].classList.toggle('on', !!Touch.r);
  };
  pad.addEventListener('pointerdown', e => { e.preventDefault(); Touch.moveId = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (er) {} at(e); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === Touch.moveId) at(e); });
  const up = e => { if (e.pointerId !== Touch.moveId) return; Touch.moveId = null; Touch.l = Touch.r = 0; arrows.forEach(a => a.classList.remove('on')); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); pad.addEventListener('lostpointercapture', up);
  const btn = (id, key) => {
    const el = document.getElementById(id);
    let pid = null;
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); pid = e.pointerId; try { el.setPointerCapture(e.pointerId); } catch (er) {}
      Touch.edge[key] = true; if (key === 'j') Touch.j = 1; el.classList.add('on');
    });
    const rel = e => { if (e.pointerId !== pid) return; pid = null; if (key === 'j') Touch.j = 0; el.classList.remove('on'); };
    el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('lostpointercapture', rel);
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  btn('t-jump', 'j'); btn('t-kick', 'k'); btn('t-super', 's');
  touchEl.addEventListener('contextmenu', e => e.preventDefault());
  // iPhones zoom on a quick second tap (or two thumbs at once) unless the touch itself is
  // cancelled; the buttons work on pointer events, which still arrive
  const hold = { passive: false };
  for (const el of [pad, ...touchEl.querySelectorAll('.tbtn'), document.getElementById('cv')]) {
    for (const ev of ['touchstart', 'touchmove', 'touchend']) el.addEventListener(ev, e => { if (e.cancelable) e.preventDefault(); }, hold);
  }
}
// no double-tap zoom and no pinch while a match is on (form fields keep their own gestures)
(() => {
  const hold = { passive: false };
  const playing = () => typeof UI !== 'undefined' && UI.screen === 'game';
  const field = t => t && t.closest && t.closest('textarea,input,select');
  let lastEnd = 0;
  document.addEventListener('touchend', e => {
    const now = performance.now();
    // (buttons keep their clicks: the page itself takes no gestures during a match)
    if (playing() && !field(e.target) && !(e.target.closest && e.target.closest('button')) && now - lastEnd < 400 && e.cancelable) e.preventDefault();
    lastEnd = now;
  }, hold);
  document.addEventListener('touchmove', e => { if ((e.touches && e.touches.length > 1 || playing()) && !field(e.target) && e.cancelable) e.preventDefault(); }, hold);
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => { if (!field(e.target)) e.preventDefault(); }, hold);
  document.addEventListener('dblclick', e => { if (!field(e.target)) e.preventDefault(); }, hold);
})();
setupTouch();
try { if (window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches) Touch.on = true; } catch (e) {}
window.addEventListener('touchstart', () => { if (!Touch.on) { Touch.on = true; if (window.UIHook) UIHook.touchOn(); } }, { passive: true, capture: true });
