// ===================================================================
//  合言葉 (passphrase) link — the same scheme as てんてこまいキッチン and
//  ガタゴト列島鉄道: the host makes an "offer" code, the friend pastes it and
//  makes a "reply" code, the host pastes that, and the two browsers are
//  linked directly over WebRTC. No server carries the game. The host does
//  this once per friend, so up to four phones can play.
//
//  Each link has two channels: "gt" (reliable: lobby, start, results) and
//  "rt" (unordered, no resends: the 30-per-second picture of the match and
//  the friends' own moves, where a late message is worse than a lost one).
//
//  Who moves what: the host runs the match. A friend's phone moves its own
//  player itself (so it answers the buttons at once) and tells the host
//  where it is; the host puts that player there and works out the ball.
// ===================================================================

const P2P_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
const RTC = () => window.RTCPeerConnection || window.webkitRTCPeerConnection;
const p2pOk = () => typeof RTC() === 'function';
function p2pWhere() {
  if (window.claude || /(^|\.)claude(usercontent)?\.(ai|com)$/.test(location.hostname)) return 'claude';
  if (location.protocol === 'file:') return 'file';
  return 'web';
}

// ---------- the codes ----------
function b64u(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const CODE_TAG = 'GZ1';
async function p2pEncode(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === 'function') {
    try {
      const st = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return CODE_TAG + 'z' + b64u(new Uint8Array(await new Response(st).arrayBuffer()));
    } catch (e) {}
  }
  return CODE_TAG + 'r' + b64u(new TextEncoder().encode(json));
}
async function p2pDecode(text) {
  const m = String(text || '').replace(/\s+/g, '').match(new RegExp(CODE_TAG + '([zr])([A-Za-z0-9_-]{20,})'));
  if (!m) return null;
  try {
    let json;
    if (m[1] === 'z') {
      if (typeof DecompressionStream !== 'function') return { bad: 'old' };
      const st = new Blob([unb64u(m[2])]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      json = await new Response(st).text();
    } else json = new TextDecoder().decode(unb64u(m[2]));
    const o = JSON.parse(json);
    if (!o || (o.t !== 'o' && o.t !== 'a') || typeof o.s !== 'string' || o.s.indexOf('v=0') !== 0) return null;
    return o;
  } catch (e) { return null; }
}
function p2pCodeKey(text) {
  const m = String(text || '').replace(/\s+/g, '').match(new RegExp(CODE_TAG + '[zr][A-Za-z0-9_-]{20,}'));
  return m ? m[0] : '';
}
function p2pGathered(pc, ms) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') { res(); return; }
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', chk); res(); }
    function chk() { if (pc.iceGatheringState === 'complete') done(); }
    pc.addEventListener('icegatheringstatechange', chk);
  });
}
function sdpCandidates(desc) {
  const out = [];
  if (!desc || !desc.sdp) return out;
  const lines = desc.sdp.split(/\r?\n/), mids = [];
  let idx = -1;
  for (const ln of lines) { if (ln.startsWith('m=')) idx++; else if (ln.startsWith('a=mid:') && idx >= 0) mids[idx] = ln.slice(6).trim(); }
  idx = -1;
  for (const ln of lines) {
    if (ln.startsWith('m=')) idx++;
    else if (ln.startsWith('a=candidate:') && idx >= 0) out.push({ candidate: ln.slice(2).trim(), sdpMid: mids[idx] === undefined ? null : mids[idx], sdpMLineIndex: idx });
  }
  return out;
}

// ---------- one link = one friend ----------
const CHUNK = 12000;
const QUIET_MS = 45000;
const DISCONNECT_GRACE = 40000;
const LINK_WAIT_MS = 120000;
const ANSWER_WAIT_MS = 900000;
const KNOCK_MS = 5000;
class Link {
  constructor(handlers) {
    this.h = handlers || {};
    this.pc = null; this.dc = null; this.rt = null; this.state = 'idle'; this.code = ''; this.nocand = false;
    this.open = false; this.ended = false; this.lastRx = 0; this.beat = 0; this.timer = 0;
    this.parts = {}; this.seq = 0; this.knockT = 0;
    this.onVis = () => { if (!document.hidden) this.lastRx = performance.now(); };
    this.onVisKnock = () => { if (!document.hidden) this.knockNow(); };
  }
  set(state, err) { this.state = state; this.err = err || ''; if (this.h.change) this.h.change(this); }
  newPc() {
    const pc = this.pc = new (RTC())({ iceServers: P2P_ICE });
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      const s = pc.connectionState;
      if (!this.open) return;
      if (s === 'failed') this.end('failed');
      else if (s === 'closed') this.end('closed');
      else if (s === 'disconnected') setTimeout(() => { if (this.pc === pc && pc.connectionState === 'disconnected') this.end('lost'); }, DISCONNECT_GRACE);
    };
    return pc;
  }
  knock() {
    clearInterval(this.knockT);
    document.removeEventListener('visibilitychange', this.onVisKnock);
    this.knockCands = this.pc ? sdpCandidates(this.pc.remoteDescription) : [];
    this.knocks = 0;
    this.knockT = setInterval(() => this.knockNow(), KNOCK_MS);
    document.addEventListener('visibilitychange', this.onVisKnock);
  }
  knockNow() {
    const pc = this.pc;
    if (!pc || this.open || this.ended) { this.stopKnock(); return; }
    const n = ++this.knocks;
    for (const c of this.knockCands || []) {
      const cand = c.candidate.replace(/^candidate:(\S+)/, (m, f) => `candidate:${f.slice(0, 20)}k${n}`);
      try { pc.addIceCandidate({ candidate: cand, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex }).catch(() => {}); } catch (e) {}
    }
  }
  stopKnock() { clearInterval(this.knockT); this.knockT = 0; document.removeEventListener('visibilitychange', this.onVisKnock); }
  wire(dc) {
    this.dc = dc;
    dc.onopen = () => { if (this.dc !== dc) return; clearTimeout(this.timer); this.setOpen(true); };
    dc.onclose = () => { if (this.dc === dc) this.end('closed'); };
    dc.onmessage = e => {
      if (this.dc !== dc || typeof e.data !== 'string') return;
      this.lastRx = performance.now();
      let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      if (!m || typeof m !== 'object' || m.t === 'k') return;
      if (m.t === 'ch') {
        const p = this.parts[m.id] = this.parts[m.id] || { n: m.n, got: 0, d: new Array(m.n) };
        if (p.d[m.i] === undefined) { p.d[m.i] = m.d; p.got++; }
        if (p.got < p.n) return;
        delete this.parts[m.id];
        try { m = JSON.parse(p.d.join('')); } catch (er) { return; }
      }
      if (this.h.msg) this.h.msg(m, this);
    };
  }
  wireRt(ch) {
    this.rt = ch;
    ch.onmessage = e => {
      if (this.rt !== ch || typeof e.data !== 'string') return;
      this.lastRx = performance.now();
      let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      if (m && typeof m === 'object' && this.h.msg) this.h.msg(m, this);
    };
  }
  setOpen(v) {
    if (this.ended || this.open === v) return;
    this.open = v;
    if (v) {
      this.stopKnock(); clearTimeout(this.timer);
      this.lastRx = performance.now();
      this.set('open');
      document.addEventListener('visibilitychange', this.onVis);
      this.beat = setInterval(() => {
        if (!this.open) return;
        if (document.hidden) { this.lastRx = performance.now(); return; }
        this.send({ t: 'k' });
        if (performance.now() - this.lastRx > QUIET_MS) this.end('timeout');
      }, 3000);
      if (this.h.open) this.h.open(this);
    }
  }
  send(obj) {
    if (!this.open || !this.dc || this.dc.readyState !== 'open') return false;
    try {
      const str = JSON.stringify(obj);
      if (str.length <= CHUNK) { this.dc.send(str); return true; }
      const id = ++this.seq, n = Math.ceil(str.length / CHUNK);
      for (let i = 0; i < n; i++) this.dc.send(JSON.stringify({ t: 'ch', id, i, n, d: str.slice(i * CHUNK, (i + 1) * CHUNK) }));
      return true;
    } catch (e) { return false; }
  }
  // fast lane: falls back to the reliable channel until it is open
  sendRt(obj) {
    if (!this.open) return false;
    const ch = this.rt && this.rt.readyState === 'open' ? this.rt : null;
    if (!ch) return this.send(obj);
    try { if (ch.bufferedAmount > 256 * 1024) return false; ch.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
  }
  async offer() {
    if (!p2pOk()) { this.set('error', 'nortc'); return; }
    this.set('making');
    try {
      const pc = this.newPc();
      this.wire(pc.createDataChannel('gt', { ordered: true }));
      this.wireRt(pc.createDataChannel('rt', { ordered: false, maxRetransmits: 0 }));
      await pc.setLocalDescription(await pc.createOffer());
      await p2pGathered(pc, 4000);
      if (this.pc !== pc) return;
      const sdp = pc.localDescription.sdp;
      this.nocand = !/a=candidate/.test(sdp);
      this.code = await p2pEncode({ t: 'o', s: sdp });
      if (this.pc !== pc) return;
      this.set('offer');
    } catch (e) { console.error(e); this.set('error', 'make'); }
  }
  async accept(text) {
    if (!this.pc || (this.state !== 'offer' && this.state !== 'error')) return;
    const d = await p2pDecode(text);
    if (!d) { this.set('offer', 'badcode'); return; }
    if (d.bad) { this.set('offer', 'oldbrowser'); return; }
    if (d.t !== 'a') { this.set('offer', 'notanswer'); return; }
    const pc = this.pc;
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: d.s });
      if (this.pc !== pc) return;
      if (this.state !== 'open') this.set('linking');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { if (this.pc === pc && this.state === 'linking') this.end('failed'); }, LINK_WAIT_MS);
      this.knock();
    } catch (e) { if (this.pc === pc) this.set('offer', 'stale'); }
  }
  async answer(text) {
    if (!p2pOk()) { this.set('error', 'nortc'); return; }
    const d = await p2pDecode(text);
    if (!d) { this.set('idle', 'badcode'); return; }
    if (d.bad) { this.set('idle', 'oldbrowser'); return; }
    if (d.t !== 'o') { this.set('idle', 'notoffer'); return; }
    this.offerKey = p2pCodeKey(text);
    this.set('making');
    try {
      const pc = this.newPc();
      pc.ondatachannel = e => { if (this.pc !== pc) return; if (e.channel.label === 'rt') this.wireRt(e.channel); else this.wire(e.channel); };
      await pc.setRemoteDescription({ type: 'offer', sdp: d.s });
      await pc.setLocalDescription(await pc.createAnswer());
      await p2pGathered(pc, 4000);
      if (this.pc !== pc) return;
      const sdp = pc.localDescription.sdp;
      this.nocand = !/a=candidate/.test(sdp);
      this.code = await p2pEncode({ t: 'a', s: sdp });
      if (this.pc !== pc) return;
      if (this.state !== 'open') this.set('answer');
      this.timer = setTimeout(() => { if (this.pc === pc && this.state === 'answer') this.end('failed'); }, ANSWER_WAIT_MS);
      if (this.state !== 'open') this.knock();
    } catch (e) { console.error(e); this.set('idle', 'badcode'); }
  }
  end(why) {
    if (this.ended) return;
    const wasOpen = this.open;
    this.ended = true;
    clearTimeout(this.timer); clearInterval(this.beat); this.stopKnock();
    document.removeEventListener('visibilitychange', this.onVis);
    this.open = false;
    try { if (this.dc) this.dc.close(); } catch (e) {}
    try { if (this.rt) this.rt.close(); } catch (e) {}
    try { if (this.pc) this.pc.close(); } catch (e) {}
    this.pc = null; this.dc = null; this.rt = null;
    if (why) {
      if (wasOpen) this.set('closed');
      else if (this.state === 'linking' || this.state === 'answer' || this.state === 'offer' || this.state === 'making') this.set('failed');
    }
    if (this.h.close) this.h.close(this, why, wasOpen);
  }
}

const P2P_ERR = {
  badcode: '合言葉が読み取れませんでした。届いた文をまるごとコピーして、もう一度貼ってください。',
  notanswer: 'これは1台目の合言葉です。相手が作った「返事の合言葉」を貼ってください。',
  notoffer: 'これは返事の合言葉です。1台目が作った合言葉を貼ってください。',
  oldbrowser: 'このブラウザでは合言葉を読めません。ブラウザを新しくしてください。',
  stale: 'この返事は、前に作った合言葉への返事です。いま①に出ている合言葉を送り直して、返事をもらい直してください。',
  make: '合言葉を作れませんでした。ページを読み込み直してください。',
  nortc: 'このブラウザでは、じかにつなぐ機能が使えません。Safari か Chrome で開いてください。LINE などのアプリの中のブラウザでは使えないことがあります。',
  nortc_claude: 'Claude のページの中では、安全のため、じかにつなぐ機能が止められています。GitHub Pages などに置いたゲームのアドレスを Safari か Chrome で開いてください。',
  nortc_file: 'この開き方では、じかにつなぐ機能が使えません。スマホではファイルを直接開かずに、GitHub Pages などに置いたゲームのアドレスを Safari か Chrome で開いてください。',
};
const P2P_MSG = {
  making: '合言葉を作っています…（数秒かかります）',
  offer: '①の合言葉をコピーして、LINE などで相手に送ってください。相手から返事の合言葉が届いたら、②に貼って「つなぐ」を押します。',
  linking: 'つないでいます…（相手のスマホで、このゲームのページを開いてもらってください。LINE の画面のままだと つながりません）',
  answer: '②の返事をコピーして、1台目に送ってください。送ったら、このページにもどって開いたまま待っていてください。1台目が貼ると、自動でつながります。',
  open: 'つながりました！',
  failed: 'つながりませんでした。合言葉を作り直して、相手に送り直してください。相手には、返事を送ったあと このゲームのページを開いたまま待ってもらいます（同じ Wi‑Fi だと つながりやすくなります）。',
  closed: '接続が切れました。',
};
const SAME_CODE_MSG = 'この合言葉への返事は、②にもうできています。それを1台目に送って、このページを開いたまま待ってください。1台目から新しい合言葉が届いたときは、①に貼りかえてから押してください。';
const GUEST_FAIL_MSG = '1台目とつながりませんでした。1台目で合言葉を作り直してもらい、新しい合言葉を①に貼って、もう一度「返事の合言葉を作る」を押してください。返事を送ったら、このページを開いたまま待ってください。';

// ---------- the match over the link: compact pictures ----------
const PH = { countdown: 0, kickoff: 1, play: 2, goal: 3, otintro: 4, end: 5 };
const PH_NAME = Object.keys(PH);
const MODES = ['', 'fire', 'ice', 'ghost', 'rocket', 'clone'];
const r0 = v => Math.round(v), r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const NET_SKIP_EV = new Set(['jump', 'land']);

function encodeSnap(G, seq) {
  const b = G.ball;
  return {
    t: 's', q: seq, T: r3(G.t), ph: PH[G.phase], pt: r2(G.phaseT), ck: r2(G.clock), ot: G.ot ? 1 : 0, sc: G.score, ep: G.epoch,
    b: [r0(b.x), r0(b.y), r0(b.vx), r0(b.vy), r2(b.rot), b.held ? 1 : 0, Math.max(0, MODES.indexOf(b.mode)), r2(b.modeT), b.modeTeam, b.last],
    f: G.fakes.map(f => [f.id, r0(f.x), r0(f.y), r0(f.vx), r0(f.vy)]),
    p: G.players.map(p => [r0(p.x), r0(p.y), r0(p.vx), r0(p.vy), p.ground ? 1 : 0, p.kick.t >= 0 ? r3(p.kick.t) : -1, p.kick.seq,
      r2(p.gauge), r2(p.armed), r2(p.frz), r2(p.stn), r2(p.big), r2(p.tiny), r2(p.dash), r2(p.giant), r2(p.scale), p.away ? 1 : 0, r2(p.landT || 0)]),
    it: G.items.map(i => [i.id, ITEM_KEYS.indexOf(i.k), r0(i.x), r0(i.y), r2(i.t)]),
    gh: G.goalH, gb: [r2(G.goalBigT[0]), r2(G.goalBigT[1])], fl: r2(G.floatT), wd: [G.wind.team, r2(G.wind.t)],
    lg: G.lastGoal ? [G.lastGoal.team, G.lastGoal.p, G.lastGoal.own ? 1 : 0] : null,
    ev: G.evs.filter(e => G.t - e.t < 0.6 && !NET_SKIP_EV.has(e.k)),
  };
}

const NetSync = {
  snap: null, snapAt: 0, lastQ: -1, lastHostEv: 0, rtt: 60, pingAt: 0,
  disp: [], ballErr: [0, 0], ballDisp: null, epoch: 0,
  reset() { this.snap = null; this.lastQ = -1; this.lastHostEv = 0; this.disp = []; this.ballErr = [0, 0]; this.ballDisp = null; this.epoch = 0; this.adopt = false; },
};

// a joined phone: take in the host's picture of the match
function guestApplySnap(G, s, myIdx, onEvent) {
  if (s.q <= NetSync.lastQ) return;
  NetSync.lastQ = s.q;
  NetSync.snap = s; NetSync.snapAt = performance.now();
  const prevPhase = G.phase;
  G.phase = PH_NAME[s.ph] || 'play'; G.phaseT = s.pt; G.clock = s.ck; G.ot = !!s.ot; G.score = s.sc;
  G.goalH = s.gh; G.goalBigT = s.gb; G.floatT = s.fl; G.wind.team = s.wd[0]; G.wind.t = s.wd[1];
  if (s.lg) G.lastGoal = { team: s.lg[0], p: s.lg[1], own: !!s.lg[2] };
  if (G.phase === 'end' && !G.result) { const sc = G.score; G.result = { win: sc[0] > sc[1] ? 0 : sc[1] > sc[0] ? 1 : -1, score: sc.slice() }; }
  // items and the clone decoys simply follow
  G.items = s.it.map(a => ({ id: a[0], k: ITEM_KEYS[a[1]] || 'big', x: a[2], y: a[3], t: a[4] }));
  // players: effects for everyone; positions only for the ones this phone does not move
  s.p.forEach((a, i) => {
    const p = G.players[i]; if (!p) return;
    p.gauge = a[7]; p.armed = a[8]; p.frz = a[9]; p.stn = a[10]; p.big = a[11]; p.tiny = a[12]; p.dash = a[13]; p.giant = a[14]; p.away = !!a[16];
    if (p.i !== myIdx) {
      p.scale = a[15]; p.r = HEAD_R * p.scale; p.landT = a[17];
      if (a[5] >= 0) { if (p.kick.seq !== a[6] || p.kick.t < 0) { p.kick.seq = a[6]; p.kick.t = a[5]; } } else p.kick.t = -1;
    }
  });
  // events since last time
  for (const e of s.ev) {
    if (e.id <= NetSync.lastHostEv) continue;
    NetSync.lastHostEv = e.id;
    if (e.k === 'reset') { NetSync.epoch = e.ep; for (const p of G.players) if (p.owned) placeAtStart(G, p); NetSync.ballErr = [0, 0]; NetSync.disp = []; }
    if (e.k === 'knock') { const p = G.players[e.p]; if (p && p.owned && e.ep === NetSync.epoch) { p.vx = e.vx; p.vy = e.vy; p.ground = false; } }
    // own jumps, swings and supers were already shown here
    if ((e.k === 'super' || e.k === 'swing') && G.players[e.p] && G.players[e.p].owned) continue;
    onEvent(e, true);
  }
  // a reset the events did not carry (or the first picture after joining mid-match)
  if (s.ep !== NetSync.epoch) {
    NetSync.epoch = s.ep;
    for (const p of G.players) if (p.owned) {
      if (NetSync.adopt) { const a = s.p[p.i]; p.x = a[0]; p.y = a[1]; p.vx = a[2]; p.vy = a[3]; p.ground = !!a[4]; }
      else placeAtStart(G, p);
    }
  }
  NetSync.adopt = false;
}

// each frame on a joined phone: where things are "now" (the picture is a little old)
function guestExtrapolate(G, dtFrame) {
  const s = NetSync.snap; if (!s) return;
  const age = clamp((performance.now() - NetSync.snapAt) / 1000 + NetSync.rtt / 2000, 0, 0.25);
  const decay = Math.exp(-dtFrame * 12);
  s.p.forEach((a, i) => {
    const p = G.players[i]; if (!p || p.owned) return;
    let x = a[0] + a[2] * age, y = a[1] + a[3] * age, vy = a[3];
    if (!a[4]) { y += 0.5 * G_PLAYER * age * age; vy += G_PLAYER * age; }
    const sy = standY(p); if (y > sy) { y = sy; vy = 0; }
    x = clamp(x, p.r, W - p.r);
    const d = NetSync.disp[i] || (NetSync.disp[i] = { ex: 0, ey: 0, px: x, py: y, q: -1 });
    // a new picture: keep drawing where it was, and let the difference fade
    if (d.q !== s.q) { if (d.q >= 0) { d.ex = d.px - x; d.ey = d.py - y; if (Math.hypot(d.ex, d.ey) > 260) { d.ex = 0; d.ey = 0; } } d.q = s.q; }
    d.ex *= decay; d.ey *= decay;
    p.x = x + d.ex; p.y = y + d.ey; p.vx = a[2]; p.vy = vy; p.ground = !!a[4] && Math.abs(p.y - sy) < 2;
    d.px = p.x; d.py = p.y;
    if (p.kick.t >= 0) { p.kick.t += dtFrame; if (p.kick.t > KICK_FWD + KICK_BACK) p.kick.t = -1; }
  });
  // the fakes
  G.fakes = s.f.map(a => ({ id: a[0], x: a[1] + a[3] * age, y: a[2] + a[4] * age, vx: a[3], vy: a[4], rot: 0, av: 0 }));
  // the ball: run it forward from the picture, bouncing off the walls and off this phone's own player
  const sb = s.b, b = G.ball;
  b.held = !!sb[5]; b.mode = MODES[sb[6]] || ''; b.modeT = Math.max(0, sb[7] - age); b.modeTeam = sb[8]; b.last = sb[9];
  let px, py, vx = sb[2], vy = sb[3];
  if (b.held) { px = sb[0]; py = sb[1]; }
  else {
    const fb = { x: sb[0], y: sb[1], vx, vy, rot: 0, av: 0 };
    const n = Math.ceil(age / (1 / 240)), h = n ? age / n : 0;
    const noGrav = (b.mode === 'fire' || b.mode === 'rocket') && b.modeT > 0;
    for (let k = 0; k < n; k++) {
      if (!noGrav) fb.vy += ballGravity(G) * h;
      fb.x += fb.vx * h; fb.y += fb.vy * h;
      ballStatics(G, fb, h, false);
      for (const p of G.players) if (p.owned) predictBounce(fb, p);
    }
    px = fb.x; py = fb.y; vx = fb.vx; vy = fb.vy;
  }
  const bd = NetSync.ballDisp || (NetSync.ballDisp = { q: -1, px, py });
  if (bd.q !== s.q) {
    if (bd.q >= 0) { NetSync.ballErr[0] = bd.px - px; NetSync.ballErr[1] = bd.py - py; if (Math.hypot(NetSync.ballErr[0], NetSync.ballErr[1]) > 220) NetSync.ballErr = [0, 0]; }
    bd.q = s.q;
  }
  NetSync.ballErr[0] *= decay; NetSync.ballErr[1] *= decay;
  b.prevX = b.x; b.prevY = b.y;
  b.x = px + NetSync.ballErr[0]; b.y = py + NetSync.ballErr[1]; b.vx = vx; b.vy = vy;
  b.rot = (b.rot || 0) + (b.y + BALL_R >= GROUND - 1 ? b.vx / BALL_R : (b.av || 0)) * dtFrame;
  bd.px = b.x; bd.py = b.y;
}
// the ball against a head and body, without any of the rules (only to draw it on a joined phone).
// Only a ball coming in fast is bounced here; a slow or resting one is left where the host says,
// because the host saw this player a few hundredths of a second ago, a little elsewhere.
function predictBounce(b, p) {
  const R = BALL_R;
  const cr = p.r * 0.52, y0 = p.y + p.r * 0.3, y1 = Math.max(y0, p.y + footOff(p) - cr);
  const qy = clamp(b.y, y0, y1);
  for (const [cx, cy, rr, e] of [[p.x, qy, cr + R, 0.32], [p.x, p.y, p.r + R, 0.5]]) {
    const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d;
    const rvx = b.vx - p.vx, rvy = b.vy - p.vy * 0.6, vn = rvx * nx + rvy * ny;
    if (vn > -220) continue;
    const pen = Math.min(rr - d, 10);
    b.x += nx * pen; b.y += ny * pen;
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
  }
}

// the host: a friend's player goes where that phone said it is (moved on to "now")
function hostPlaceRemote(G, p, pose, rttMs) {
  if (!pose) return;
  const age = clamp((performance.now() - pose.at) / 1000 + rttMs / 2000, 0, 0.2);
  p.scale = pose.sc; p.r = HEAD_R * p.scale;
  let x = pose.x + pose.vx * age, y = pose.y + pose.vy * age, vy = pose.vy;
  if (!pose.g) { y += 0.5 * G_PLAYER * age * age; vy += G_PLAYER * age; }
  const sy = standY(p); if (y > sy) { y = sy; vy = 0; }
  p.x = clamp(x, p.r, W - p.r); p.y = y; p.vx = pose.vx; p.vy = vy; p.ground = !!pose.g;
  if (pose.ks !== p._netKs) {
    p._netKs = pose.ks;
    if (pose.kt >= 0 && pose.kt < KICK_FWD + KICK_BACK) { p.kick.seq = pose.ks; p.kick.t = clamp(pose.kt + age, 0, KICK_FWD * 0.85); p.kick.hit = false; }
  }
  if (pose.ss !== p._netSs) {
    const more = (pose.ss | 0) - (p._netSs | 0);
    p._netSs = pose.ss;
    if (more > 0 && p.gauge >= 1 && !p.armed) trySuper(G, p);
  }
}
