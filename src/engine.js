// ===================================================================
//  engine: one match. Pure state + step(), no DOM.
//  The host page (or the only page) runs step() 60 times a second.
//  A player is "owned" by the page that moves it: on the host that is its
//  own players and the CPUs; a joined phone owns its own player(s) and the
//  host just places them where that phone says (see net.js).
// ===================================================================

const REST_A = 0.16;        // shoe angle at rest (radians from straight down, forward +)
const TOP_A = 2.05;         // shoe angle at the top of a kick

function newMatch(setup) {
  const seed = setup.seed || ((Math.random() * 1e9) | 0);
  const rules = Object.assign({ ballSpeed: 1, ballGrav: 1, grav: 1, width: 1600, headMul: 1, events: false, itemRate: 1 }, GAME_MODES[setup.mode] || {});
  W = rules.width;
  const G = {
    setup, seed, rules, rng: mkRng(seed), t: 0, tick: 0,
    phase: 'countdown', phaseT: 0,
    clock: setup.time || 90, ot: false, result: null,
    score: [0, 0], players: [], ball: null, fakes: [], items: [], meteors: [], meteorSeq: 0,
    itemT: 9, itemSeq: 0, fakeSeq: 0,
    goalH: [GOAL_H, GOAL_H], goalFx: [{ k: '', t: 0 }, { k: '', t: 0 }], floatT: 0, bigBallT: 0,
    wind: { team: -1, t: 0 },
    extra: [], extraSeq: 0, eventT: 6, lastEvent: '', iceT: 0, lowGravT: 0, rainT: 0, rainAcc: 0,
    evs: [], evSeq: 0, epoch: 0, lastGoal: null, idleT: 0, barT: 0,
    goalsLog: [],
  };
  const per = [0, 0];
  setup.players.forEach((sp, i) => {
    const team = sp.team ? 1 : 0;
    const p = mkPlayer(i, sp, team, per[team]++);
    p.headMul = rules.headMul;
    G.players.push(p);
  });
  G.teamSize = per;
  G.ball = newBall(W / 2, 210);
  resetPositions(G, true);
  ev(G, 'whistle', { n: 0 });
  return G;
}

function mkPlayer(i, sp, team, slot) {
  const ch = CHARS[sp.char] ? sp.char : 0;
  return {
    i, team, slot, char: ch, name: sp.name || CHARS[ch].name, ctrl: sp.ctrl || 'cpu', owned: true,
    face: team === 0 ? 1 : -1,
    x: 0, y: 0, vx: 0, vy: 0, ground: true, scale: 1, r: HEAD_R,
    kick: { t: -1, seq: 0, hit: false, dir: 0 }, jumpBuf: 0, coyote: 0, landT: 0,
    gauge: 0.25, armed: 0, superSeq: 0,
    frz: 0, stn: 0, big: 0, tiny: 0, dash: 0, giant: 0, conf: 0, pow: 0, stretch: 0, legK: 1, muscle: 0, hot: 0, drunk: 0, present: 0, giftT: 0, giftAmt: 0, giftShow: 0, coinT: 0,
    hp: 1, hurtT: -9, burnT: -9, meteorT: -9,
    lastTouchT: -9, blink: 0,
    stats: { goals: 0, own: 0, touches: 0, shots: 0, supers: 0, items: 0 },
    cpu: null, away: false,
  };
}

function newBall(x, y) {
  return { x, y, vx: 0, vy: 0, r: BALL_R, rot: 0, av: 0, scrum: 0, scrumX: 0, mode: '', modeT: 0, modeTeam: -1, pierce: 0, hitMask: 0, ghostP: -1,
           last: -1, lastTeam: -1, touchT: -9, restT: 0, held: true, prevX: x, prevY: y,
           teamLast: [-1, -1], teamLastT: [-9, -9], launchT: -9, kickT: -9, kickTeam: -1, kickVx: 0, kickVy: 0, heatT: 0 };
}
// gravity for players and for the ball, with the mode and the events
function gravK(G) { return (G.rules ? G.rules.grav : 1) * (G.lowGravT > 0 ? 0.55 : 1); }
function playerGrav(G, p) { return G_PLAYER * (CHARS[p.char].floaty || 1) * gravK(G); }
function ballSpeedK(G) { return G.rules ? G.rules.ballSpeed : 1; }

function ev(G, k, o) {
  const e = Object.assign({ id: ++G.evSeq, k, t: G.t }, o || {});
  G.evs.push(e);
  if (G.evs.length > 80) G.evs.splice(0, G.evs.length - 80);
  return e;
}

// ---------- geometry helpers ----------
// hip to shoe: longer for the long-legged, and longer still while stretched
function targetLeg(p) { return (CHARS[p.char].leg || 1) * (p.stretch > 0 ? 1.5 : 1); }
function legLen(p) { return LEG * Math.sqrt(p.scale) * (p.legK || 1); }
function footOff(p) { return PIVOT * p.r + legLen(p) * Math.cos(REST_A) + FOOT_R; }
function standY(p) { return GROUND - footOff(p); }
function barRect(G, side) {
  const top = GROUND - G.goalH[side] - BAR_T;
  return side === 0 ? [0, top, GOAL_D + BAR_OUT, top + BAR_T] : [W - GOAL_D - BAR_OUT, top, W, top + BAR_T];
}
function kickAngleAt(kt) {
  if (kt < 0) return REST_A;
  if (kt < KICK_FWD) { const u = kt / KICK_FWD; return REST_A + (TOP_A - REST_A) * (1 - (1 - u) * (1 - u)); }
  const u = Math.min(1, (kt - KICK_FWD) / KICK_BACK);
  return TOP_A + (REST_A - TOP_A) * (u * u * (3 - 2 * u));
}
function kickOmega(kt) {
  if (kt < 0 || kt > KICK_FWD + KICK_BACK) return 0;
  const h = 0.004;
  return (kickAngleAt(kt + h) - kickAngleAt(Math.max(0, kt - h))) / (kt > h ? 2 * h : h + kt);
}
function pivotOf(p) { return [p.x + p.face * 6 * p.scale, p.y + PIVOT * p.r]; }
function footAt(p, kt) {
  const a = kickAngleAt(kt), L = legLen(p);
  const [px, py] = pivotOf(p);
  return [px + p.face * Math.sin(a) * L, py + Math.cos(a) * L, a];
}
function circRect(cx, cy, r, x0, y0, x1, y1) {
  const qx = clamp(cx, x0, x1), qy = clamp(cy, y0, y1);
  const dx = cx - qx, dy = cy - qy, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) { const d = Math.sqrt(d2); return { nx: dx / d, ny: dy / d, pen: r - d }; }
  const l = cx - x0, rr = x1 - cx, t = cy - y0, b = y1 - cy, m = Math.min(l, rr, t, b);
  if (m === t) return { nx: 0, ny: -1, pen: r + t };
  if (m === b) return { nx: 0, ny: 1, pen: r + b };
  if (m === l) return { nx: -1, ny: 0, pen: r + l };
  return { nx: 1, ny: 0, pen: r + rr };
}
function speedMul(p) { return (p.dash > 0 ? 1.32 : 1) * (p.giant > 0 ? 0.92 : 1) * (p.cpuSpeed || 1); }
function jumpMul(p) { return (p.dash > 0 ? 1.12 : 1) * (p.giant > 0 ? 0.95 : 1); }
function massOf(p) { return Math.sqrt(CHARS[p.char].mass) * p.scale * (p.muscle > 0 ? 2 : 1); }
// ムキムキうで: where the front fist is. A short flex first, then guarding the chin, punching out with the kick
function fistAt(p, kt) {
  const r = p.r;
  if (MUSCLE_T - p.muscle < 0.8) return [p.x + p.face * r * 1.5, p.y - r * 0.42];
  let ext = 0;
  if (kt >= 0) ext = kt < KICK_FWD ? kt / KICK_FWD : Math.max(0, 1 - (kt - KICK_FWD) / KICK_BACK);
  const e = ext * ext * (3 - 2 * ext);
  return [p.x + p.face * r * (1.26 + 0.95 * e), p.y + r * (0.36 - 0.1 * e)];
}
function targetScale(p) {
  let s = (CHARS[p.char].size || 1) * (p.headMul || 1);
  if (p.big > 0) s *= 1.45;
  if (p.giant > 0) s *= 1.6;
  if (p.tiny > 0) s *= 0.64;
  return clamp(s, 0.48, 2.6);
}
// the crossbar moves (でかゴール / ちびゴール). A ball resting above the old crossbar, behind the
// goal line, is lifted onto the new one instead of suddenly being inside the goal
function setGoalH(G, side, h) {
  const old = G.goalH[side];
  if (old === h) return;
  G.goalH[side] = h;
  if (h <= old) return;
  const top = GROUND - h - BAR_T;
  const lift = b => {
    const r = b.r || BALL_R;
    const behind = side === 0 ? b.x < GOAL_D + BAR_OUT + r : b.x > W - GOAL_D - BAR_OUT - r;
    if (behind && b.y < GROUND - old && b.y > top - r) { b.y = top - r - 1; if (b.vy > -80) b.vy = -80; }
  };
  lift(G.ball);
  for (const f of G.fakes) lift(f);
}
function setBallR(G, r) { G.ball.r = r; for (const f of G.fakes) f.r = r; for (const xb of G.extra) xb.r = r; }
function startX(G, p) {
  const n = G.teamSize[p.team];
  const xs = n <= 1 ? [470] : n === 2 ? [560, 300] : n === 3 ? [620, 440, 260] : [640, 500, 360, 230];
  const x = xs[Math.min(p.slot, xs.length - 1)];
  return p.team === 0 ? x : W - x;
}
function placeAtStart(G, p) {
  p.x = startX(G, p); p.vx = 0; p.vy = 0; p.ground = true;
  p.scale = targetScale(p); p.r = HEAD_R * p.scale; p.legK = targetLeg(p); p.y = standY(p);
  p.kick.t = -1; p.frz = 0; p.stn = 0; p.conf = 0; p.jumpBuf = 0; p.hp = 1; p.hurtT = -9;
}

function resetPositions(G, first) {
  G.epoch++;
  for (const p of G.players) placeAtStart(G, p);
  const b = G.ball;
  b.x = W / 2; b.y = 200; b.vx = 0; b.vy = 0; b.av = 0; b.mode = ''; b.modeT = 0; b.held = true; b.restT = 0;
  b.last = -1; b.lastTeam = -1; b.prevX = b.x; b.prevY = b.y;
  b.teamLast = [-1, -1]; b.teamLastT = [-9, -9];
  G.fakes.length = 0; G.meteors.length = 0; G.extra.length = 0; G.rainT = 0;
  G.wind.t = 0;
  if (!first) ev(G, 'reset', { ep: G.epoch });
}

function dropBall(G) {
  const b = G.ball;
  b.held = false; b.x = W / 2; b.y = 200;
  b.vx = (G.rng() - 0.5) * 90; b.vy = 0; b.touchT = G.t;
  G.idleT = 0;
}

// ---------- the step ----------
// inputs[i] = { l, r, j, jp, k, s } for players this page owns (l/r/j held; jp/k/s pressed this step)
function step(G, inputs) {
  G.t += DT; G.tick++;
  G.phaseT += DT;
  phaseLogic(G);
  const live = G.phase === 'play' || G.phase === 'goal';
  for (const p of G.players) {
    tickTimers(G, p, DT);
    if (p.owned) stepPlayer(G, p, live ? inputs[p.i] : null, DT);
    else advanceKick(p, DT);
  }
  separatePlayers(G);
  hitPlayers(G);
  stepMeteors(G, DT);
  stepGifts(G, DT);
  if (!G.ball.held) {
    for (let s = 0; s < SUB; s++) ballSub(G, DT / SUB, s);
    stepFakes(G, DT);
  } else {
    const b = G.ball; b.y = 200 + Math.sin(G.t * 4) * 6; b.x = W / 2; b.vx = 0; b.vy = 0; b.prevX = b.x; b.prevY = b.y;
  }
  if (G.phase === 'play') { stepItems(G, DT); stuckCheck(G, DT); }
  if (G.wind.t > 0) G.wind.t -= DT;
  if (G.floatT > 0) G.floatT -= DT;
  for (let side = 0; side < 2; side++) {
    const fx = G.goalFx[side];
    if (fx.t > 0) { fx.t -= DT; if (fx.t <= 0) { fx.t = 0; fx.k = ''; setGoalH(G, side, GOAL_H); } }
  }
  if (G.ball.heatT > 0) G.ball.heatT -= DT;
  if (G.iceT > 0) G.iceT -= DT;
  if (G.lowGravT > 0) G.lowGravT -= DT;
  if (G.phase === 'play') stepEvents(G, DT);
  stepExtra(G, DT);
  if (G.bigBallT > 0) { G.bigBallT -= DT; if (G.bigBallT <= 0) { G.bigBallT = 0; setBallR(G, BALL_R); } }
}

function phaseLogic(G) {
  if (G.phase === 'countdown') {
    const n = 3 - Math.floor(G.phaseT);
    if (n !== G._cnt && n >= 1 && n <= 3) { G._cnt = n; ev(G, 'count', { n }); }
    if (G.phaseT >= 3) { setPhase(G, 'play'); dropBall(G); ev(G, 'whistle', { n: 1 }); ev(G, 'count', { n: 0 }); }
  } else if (G.phase === 'kickoff') {
    if (G.phaseT >= 1.1) { setPhase(G, 'play'); dropBall(G); ev(G, 'whistle', { n: 1 }); }
  } else if (G.phase === 'play') {
    G.clock -= DT;
    if (G.clock <= 0) {
      G.clock = 0;
      const tie = G.score[0] === G.score[1];
      if (tie && G.setup.ot && !G.ot) { setPhase(G, 'otintro'); ev(G, 'whistle', { n: 2 }); ev(G, 'otintro'); }
      else endMatch(G);
    }
  } else if (G.phase === 'goal') {
    if (G.phaseT >= 2.5) {
      if (G.ot) endMatch(G);
      else { resetPositions(G); setPhase(G, 'kickoff'); }
    }
  } else if (G.phase === 'otintro') {
    if (G.phaseT >= 2.2) { G.ot = true; G.clock = 60; resetPositions(G); setPhase(G, 'kickoff'); }
  }
}
function setPhase(G, ph) { G.phase = ph; G.phaseT = 0; }
function endMatch(G) {
  setPhase(G, 'end');
  const s = G.score;
  G.result = { win: s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1, score: s.slice() };
  ev(G, 'whistle', { n: 3 }); ev(G, 'end', { win: G.result.win });
}

function tickTimers(G, p, dt) {
  if (p.frz > 0) p.frz = Math.max(0, p.frz - dt);
  if (p.stn > 0) p.stn = Math.max(0, p.stn - dt);
  if (p.big > 0) p.big = Math.max(0, p.big - dt);
  if (p.tiny > 0) p.tiny = Math.max(0, p.tiny - dt);
  if (p.dash > 0) p.dash = Math.max(0, p.dash - dt);
  if (p.giant > 0) p.giant = Math.max(0, p.giant - dt);
  if (p.conf > 0) p.conf = Math.max(0, p.conf - dt);
  if (p.pow > 0) p.pow = Math.max(0, p.pow - dt);
  if (p.stretch > 0) p.stretch = Math.max(0, p.stretch - dt);
  if (p.muscle > 0) p.muscle = Math.max(0, p.muscle - dt);
  if (p.hot > 0) p.hot = Math.max(0, p.hot - dt);
  if (p.drunk > 0) p.drunk = Math.max(0, p.drunk - dt);
  if (p.present > 0) p.present = Math.max(0, p.present - dt);
  if (p.giftShow > 0) p.giftShow = Math.max(0, p.giftShow - dt);
  if (p.coinT > 0) p.coinT = Math.max(0, p.coinT - dt);
  // health: full again after a knock-down, and slowly back when left alone for a while
  if (p.hp < 1) {
    if (p.hp <= 0 && p.stn <= 0) p.hp = 1;
    else if (p.hp > 0 && G.t - p.hurtT > 3) p.hp = Math.min(1, p.hp + 0.07 * dt);
  }
  if (p.armed > 0) { p.armed -= dt; if (p.armed <= 0) { p.armed = 0; ev(G, 'fizzle', { p: p.i }); } }
  if (G.phase === 'play' && !p.armed && p.gauge < 1) p.gauge = Math.min(1, p.gauge + GAUGE_RATE * dt);
}

function advanceKick(p, dt) {
  if (p.kick.t >= 0) { p.kick.t += dt; if (p.kick.t > KICK_FWD + KICK_BACK) p.kick.t = -1; }
}

function stepPlayer(G, p, inp, dt) {
  const ch = CHARS[p.char];
  // head size eases toward its target (items, the giant super)
  const ts = targetScale(p);
  if (Math.abs(ts - p.scale) > 0.001) {
    const before = footOff(p);
    p.scale += clamp(ts - p.scale, -3 * dt, 3 * dt);
    p.r = HEAD_R * p.scale;
    if (p.ground) p.y += before - footOff(p);
  }
  // legs ease to their length too (the stretch super), feet staying on the grass
  const tl = targetLeg(p);
  if (Math.abs(tl - p.legK) > 0.001) {
    const before = footOff(p);
    p.legK += clamp(tl - p.legK, -2.6 * dt, 2.6 * dt);
    if (p.ground) p.y += before - footOff(p);
  }
  const off = !inp || p.frz > 0 || p.stn > 0;
  let mx = 0;
  if (!off) mx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  if (p.conf > 0) mx = -mx;          // dazzled: left and right are swapped
  if (p.frz > 0) { if (p.ground) p.vx *= 0.5; }
  else {
    let want = mx * spdOf(ch.spd) * speedMul(p);
    // tipsy (のめのめ攻撃): slower, and weaving about whatever you press
    if (p.drunk > 0 && !off) want = want * 0.75 + Math.sin(G.t * 2.6 + p.i * 1.7) * 230 + Math.sin(G.t * 6.3 + p.i) * 80;
    // the wind pushes the other team back toward their own goal
    if (G.wind.t > 0 && p.team !== G.wind.team) want += (G.wind.team === 0 ? 1 : -1) * 300;
    let acc = p.ground ? (mx ? 5600 : 6200) : (mx ? 3300 : 900);
    if (G.iceT > 0 && p.ground) acc = mx ? 1300 : 260;          // a frozen pitch: slippery
    p.vx += clamp(want - p.vx, -acc * dt, acc * dt);
  }
  // jump (a short buffer, and a moment of grace after walking off a ledge)
  if (!off && inp.jp) p.jumpBuf = 0.12;
  if (p.jumpBuf > 0) {
    if (!off && (p.ground || p.coyote > 0)) {
      p.vy = -jmpOf(ch.jmp) * jumpMul(p) * (p.drunk > 0 ? 0.86 : 1);
      p.ground = false; p.coyote = 0; p.jumpBuf = 0;
      ev(G, 'jump', { p: p.i });
    } else p.jumpBuf -= dt;
  }
  let g = playerGrav(G, p);
  if (p.vy < 0 && !(inp && inp.j && !off)) g *= 1.75;
  const wasGround = p.ground;
  p.vy += g * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.ground = false;
  solidsForPlayer(G, p);
  if (p.ground) p.coyote = 0.08; else if (wasGround) p.coyote = 0.08; else p.coyote = Math.max(0, p.coyote - dt);
  if (p.ground && !wasGround && p.vyBefore > 500) { ev(G, 'land', { p: p.i, v: p.vyBefore }); p.landT = 0.18; }
  p.vyBefore = p.vy;
  if (p.landT > 0) p.landT -= dt;
  // kick
  advanceKick(p, dt);
  if (!off && inp.k && (p.kick.t < 0 || p.kick.t > KICK_FWD + KICK_BACK * 0.55)) {
    // the direction held when the button goes down picks the shot (+1 toward the other goal)
    p.kick.t = 0; p.kick.seq++; p.kick.hit = false; p.kick.dir = mx * p.face;
    ev(G, 'swing', { p: p.i });
  }
  // super
  if (!off && inp.s) trySuper(G, p);
}

function solidsForPlayer(G, p) {
  const r = p.r, fo = footOff(p);
  // grass
  if (p.y + fo >= GROUND) { p.y = GROUND - fo; if (p.vy > 0) { p.vyBefore = p.vy; p.vy = 0; } p.ground = true; }
  // ceiling and walls
  if (p.y - r < 0) { p.y = r; if (p.vy < 0) p.vy = 0; }
  if (p.x - r < 0) { p.x = r; if (p.vx < 0) p.vx = 0; }
  if (p.x + r > W) { p.x = W - r; if (p.vx > 0) p.vx = 0; }
  // crossbars: stand on top, bump the head from below or the side
  for (let side = 0; side < 2; side++) {
    const [x0, y0, x1, y1] = barRect(G, side);
    const feet = p.y + fo;
    if (p.x > x0 - r * 0.5 && p.x < x1 + r * 0.5 && feet >= y0 && feet - p.vy * DT * 1.5 <= y0 + 2 && p.vy >= 0) {
      p.y = y0 - fo; p.vyBefore = p.vy; p.vy = 0; p.ground = true;
      continue;
    }
    const c = circRect(p.x, p.y, r, x0, y0, x1, y1);
    if (c) {
      p.x += c.nx * c.pen; p.y += c.ny * c.pen;
      const vn = p.vx * c.nx + p.vy * c.ny;
      if (vn < 0) { p.vx -= vn * c.nx; p.vy -= vn * c.ny; }
      if (c.ny < -0.7) p.ground = true;
    }
  }
}

// heads push each other apart; a player only moves if this page owns it
function separatePlayers(G) {
  const P = G.players;
  for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
    const p = P[a], q = P[b];
    if (!p.owned && !q.owned) continue;
    const dx = q.x - p.x, dy = q.y - p.y, rr = p.r + q.r, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 0.01, nx = d2 > 1e-6 ? dx / d : 1, ny = d2 > 1e-6 ? dy / d : 0, pen = rr - d;
    const mp = massOf(p), mq = massOf(q);
    let wp = p.owned ? (q.owned ? mq / (mp + mq) : 1) : 0, wq = q.owned ? (p.owned ? mp / (mp + mq) : 1) : 0;
    p.x -= nx * pen * wp; p.y -= ny * pen * wp;
    q.x += nx * pen * wq; q.y += ny * pen * wq;
    const rv = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
    if (rv < 0) {
      if (wp > 0) { p.vx += rv * nx * wp; p.vy += rv * ny * wp; }
      if (wq > 0) { q.vx -= rv * nx * wq; q.vy -= rv * ny * wq; }
    }
    // landing on someone's head: you can jump off it
    if (ny > 0.6 && wp > 0) { p.ground = true; p.coyote = 0.08; }
    if (ny < -0.6 && wq > 0) { q.ground = true; q.coyote = 0.08; }
    if (wp > 0) { p.x = clamp(p.x, p.r, W - p.r); }
    if (wq > 0) { q.x = clamp(q.x, q.r, W - q.r); }
  }
}

// ---------- supers ----------
function trySuper(G, p) {
  if (p.gauge < 1 || p.armed > 0 || G.phase !== 'play') return false;
  const kind = CHARS[p.char].sup;
  p.gauge = 0; p.stats.supers++; p.superSeq++;
  ev(G, 'super', { p: p.i, s: kind });
  if (SUPERS[kind].armed) { p.armed = SUPER_ARM_T; return true; }
  const foes = G.players.filter(q => q.team !== p.team);
  if (kind === 'thunder') {
    for (const q of foes) { q.stn = Math.max(q.stn, 1.4); q.armed = 0; ev(G, 'bolt', { p: q.i }); }
  } else if (kind === 'giant') {
    p.giant = 8;
  } else if (kind === 'stretch') {
    p.stretch = 7;
  } else if (kind === 'gift') {
    // the amount is decided now (and shown when the card is open)
    const r = G.rng();
    p.giftAmt = r < 0.3 ? 1000 : r < 0.6 ? 3000 : r < 0.85 ? 5000 : 10000;
    p.giftT = GIFT_T;
    ev(G, 'gift', { p: p.i, amt: p.giftAmt });
  } else if (kind === 'slide') {
    p.present = PRESENT_T; p.meteorAcc = 0;
    ev(G, 'present', { p: p.i });
  } else if (kind === 'drink') {
    ev(G, 'cheers', { p: p.i });
    for (const q of foes) { q.drunk = Math.max(q.drunk, DRUNK_T); ev(G, 'drunk', { p: q.i, by: p.i }); }
  } else if (kind === 'hot') {
    p.hot = HOT_T;
    ev(G, 'boil', { p: p.i });
  } else if (kind === 'muscle') {
    p.muscle = MUSCLE_T;
    ev(G, 'flex', { p: p.i });
  } else if (kind === 'wind') {
    G.wind.team = p.team; G.wind.t = 2.6;
  } else if (kind === 'ramen') {
    for (const q of G.players) if (q.team === p.team) {
      q.dash = Math.max(q.dash, 6); q.pow = Math.max(q.pow, 6);
      if (q !== p && !q.armed) q.gauge = Math.min(1, q.gauge + 0.45);
      ev(G, 'ramen', { p: q.i });
    }
  } else if (kind === 'dazzle') {
    for (const q of foes) { q.conf = Math.max(q.conf, 4); ev(G, 'dazzle', { p: q.i }); }
  }
  return true;
}

function goalTarget(G, team) {
  // the middle of the goal mouth this team attacks
  const side = 1 - team;
  return [side === 1 ? W - GOAL_D * 0.35 : GOAL_D * 0.35, GROUND - G.goalH[side] * 0.5];
}

function superShot(G, p) {
  const b = G.ball, kind = CHARS[p.char].sup;
  p.armed = 0;
  ev(G, 'shot', { p: p.i, s: kind });
  const [tx, ty] = goalTarget(G, p.team);
  b.modeTeam = p.team; b.hitMask = 0; b.pierce = 0; b.ghostP = -1; b.launchT = G.t;
  if (kind === 'fire') {
    aimBall(b, tx, ty, 1850 * ballSpeedK(G));
    b.mode = 'fire'; b.modeT = 1.05; b.pierce = 1;
  } else if (kind === 'ice') {
    forwardish(b, p.face, 1.15, 950 * ballSpeedK(G));
    b.mode = 'ice'; b.modeT = 3.2;
  } else if (kind === 'ghost') {
    forwardish(b, p.face, 1.08, 900 * ballSpeedK(G));
    b.mode = 'ghost'; b.modeT = 2.7;
  } else if (kind === 'rocket') {
    const sp = 1350 * ballSpeedK(G), d = Math.hypot(b.vx, b.vy) || 1;
    let vx = b.vx / d, vy = b.vy / d;
    if (vx * p.face < 0.2) { vx = p.face * 0.6; vy = -0.8; }
    b.vx = vx * sp; b.vy = vy * sp;
    b.mode = 'rocket'; b.modeT = 1.7;
  } else if (kind === 'clone') {
    forwardish(b, p.face, 1.05, 850 * ballSpeedK(G));
    const sp = Math.hypot(b.vx, b.vy), ang = Math.atan2(b.vy, b.vx);
    const angs = [ang - 0.27, ang + 0.27];
    const real = Math.floor(G.rng() * 3);   // which of the three paths the real ball takes
    const all = [ang, angs[0], angs[1]];
    const ra = all[real];
    b.vx = Math.cos(ra) * sp; b.vy = Math.sin(ra) * sp;
    for (let i = 0; i < 3; i++) {
      if (i === real) continue;
      G.fakes.push({ id: ++G.fakeSeq, x: b.x, y: b.y, r: b.r, vx: Math.cos(all[i]) * sp, vy: Math.sin(all[i]) * sp, rot: b.rot, av: b.av, life: 3.2 });
    }
    b.mode = 'clone'; b.modeT = 3.2;
  }
}
function aimBall(b, tx, ty, sp) {
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
  b.vx = dx / d * sp; b.vy = dy / d * sp;
}
// keep the ball going forward at least this fast
function forwardish(b, face, mul, minSp) {
  b.vx *= mul; b.vy *= mul;
  if (b.vx * face < 300) b.vx = face * Math.max(300, Math.abs(b.vx));
  const sp = Math.hypot(b.vx, b.vy);
  if (sp < minSp) { b.vx *= minSp / sp; b.vy *= minSp / sp; }
}

// ---------- the ball ----------
function ballGravity(G) { return G_BALL * (G.floatT > 0 ? 0.42 : 1) * (G.rules ? G.rules.ballGrav : 1) * (G.lowGravT > 0 ? 0.5 : 1); }

function ballSub(G, dt, s) {
  ballSubFor(G, G.ball, dt, s);
  for (let i = G.extra.length - 1; i >= 0; i--) if (G.extra[i]) ballSubFor(G, G.extra[i], dt, s);
}
function ballSubFor(G, b, dt, s) {
  const main = b === G.ball;
  b.prevX = b.x; b.prevY = b.y;
  const noGrav = (b.mode === 'fire' || b.mode === 'rocket') && b.modeT > 0;
  if (!noGrav) b.vy += ballGravity(G) * dt;
  if (G.wind.t > 0) {
    const wd = G.wind.team === 0 ? 1 : -1;
    if (b.vx * wd < 950) b.vx += wd * 640 * dt;
    b.vy -= 150 * dt;
  }
  if (b.mode === 'rocket' && b.modeT > 0) {
    const [tx, ty] = goalTarget(G, b.modeTeam);
    const want = Math.atan2(ty - b.y, tx - b.x), cur = Math.atan2(b.vy, b.vx);
    let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    const a = cur + clamp(d, -3.4 * dt, 3.4 * dt), sp = 1350 * ballSpeedK(G);
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
  }
  b.vx *= 1 - 0.1 * dt;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (main && b.modeT > 0) { b.modeT -= dt; if (b.modeT <= 0) endMode(G); }
  // the world
  const hit = ballStatics(G, b, dt, true);
  if (main && hit && (b.mode === 'fire' || b.mode === 'rocket')) endMode(G);
  // players
  for (const p of G.players) ballVsPlayer(G, b, p, dt, s);
  // speed limit
  const sp = Math.hypot(b.vx, b.vy);
  const max = (b.mode === 'fire' ? 2000 : BALL_MAX) * ballSpeedK(G);
  if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
  b.rot += b.av * dt;
  if (G.phase === 'play' || G.phase === 'goal') goalCheck(G, b);
}
function endMode(G) {
  const b = G.ball;
  if (b.mode === 'clone') { b.mode = ''; return; }
  b.mode = ''; b.modeT = 0; b.pierce = 0; b.ghostP = -1;
}

// walls, grass, ceiling, crossbars. Returns the hardest impact speed (0 if none)
function ballStatics(G, b, dt, loud) {
  let hard = 0;
  const R = b.r || BALL_R;
  if (b.y + R > GROUND) {
    b.y = GROUND - R;
    if (b.vy > 0) {
      const v = b.vy; hard = Math.max(hard, v);
      b.vy = v < 70 ? 0 : -v * 0.66;
      b.vx *= 0.97;
    }
    b.vx *= Math.exp(-(G.iceT > 0 ? 0.08 : 0.55) * dt);
    b.av = b.vx / R;
  }
  if (b.y - R < 0) { b.y = R; if (b.vy < 0) { hard = Math.max(hard, -b.vy); b.vy = -b.vy * 0.6; } }
  // the end walls (stands above the goals, the net inside them) soak up a lot of the ball's speed
  if (b.x - R < 0) { b.x = R; if (b.vx < 0) { hard = Math.max(hard, -b.vx); b.vx = -b.vx * 0.42; b.vy *= 0.85; } }
  if (b.x + R > W) { b.x = W - R; if (b.vx > 0) { hard = Math.max(hard, b.vx); b.vx = -b.vx * 0.42; b.vy *= 0.85; } }
  for (let side = 0; side < 2; side++) {
    const [x0, y0, x1, y1] = barRect(G, side);
    const c = circRect(b.x, b.y, R, x0, y0, x1, y1);
    if (!c) continue;
    b.x += c.nx * c.pen; b.y += c.ny * c.pen;
    const vn = b.vx * c.nx + b.vy * c.ny;
    if (vn < 0) {
      b.vx -= 1.62 * vn * c.nx; b.vy -= 1.62 * vn * c.ny;
      const tx = -c.ny, ty = c.nx, vt = b.vx * tx + b.vy * ty;
      b.vx -= vt * 0.08 * tx; b.vy -= vt * 0.08 * ty;
      if (-vn > 120 && loud && G.t - (G._postT || 0) > 0.12) { G._postT = G.t; ev(G, 'post', { v: -vn | 0, x: b.x | 0, y: b.y | 0 }); }
      hard = Math.max(hard, -vn);
    }
  }
  if (loud && hard > 140 && G.t - (G._bounceT || 0) > 0.06) { G._bounceT = G.t; ev(G, 'bounce', { v: hard | 0, x: b.x | 0, y: b.y | 0 }); }
  return hard > 60;
}

function ballVsPlayer(G, b, p, dt, s) {
  // the fireball goes through the shooter's own team
  if (b.mode === 'fire' && b.modeT > 0 && p.team === b.modeTeam) return;
  const R = b.r;
  // shoe position partway through this step
  const kt = p.kick.t >= 0 ? Math.max(0, p.kick.t - DT + (s + 1) * DT / SUB) : -1;
  const [fx, fy, fa] = footAt(p, kt);
  // a kick (forgiving): the shoe sweeps near the ball, or the ball is against the head (a header shot)
  if (kt >= 0 && kt <= KICK_FWD + KICK_GRACE && !p.kick.hit && p.frz <= 0 && p.stn <= 0) {
    const dx = b.x - fx, dy = b.y - fy, reach = FOOT_R + R + 22 * Math.sqrt(p.scale);
    if (dx * dx + dy * dy < reach * reach && (b.x - p.x) * p.face > -p.r * 0.5) { kickBall(G, b, p, false); return; }
    const hx = b.x - p.x, hy = b.y - p.y, hr = p.r + R + 16;
    if (hx * hx + hy * hy < hr * hr && hx * p.face > -p.r * 0.6) { kickBall(G, b, p, true); return; }
  }
  // ムキムキうで: the punch (with the kick button), or the arm in the way
  if (p.muscle > 0 && p.frz <= 0 && p.stn <= 0) {
    const [qx, qy] = fistAt(p, kt), rr = FIST_R * p.r + R, dx = b.x - qx, dy = b.y - qy, d2 = dx * dx + dy * dy;
    if (kt >= 0 && kt <= KICK_FWD + KICK_GRACE && !p.kick.hit && d2 < (rr + 14) * (rr + 14)) { punchBall(G, b, p); return; }
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d;
      b.x = qx + nx * rr; b.y = qy + ny * rr;
      const rvx = b.vx - p.vx, rvy = b.vy - p.vy, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        b.vx -= 1.55 * vn * nx; b.vy -= 1.55 * vn * ny; b.vx += p.face * 160;
        b.lastKind = 'head'; touchBall(G, b, p, false);
        if (-vn > 260) ev(G, 'head', { p: p.i, v: -vn | 0, x: b.x | 0, y: b.y | 0 });
      }
      return;
    }
  }
  // the ghost ball slips through the first player of the other side it comes to (only a kick stops it)
  if (b.mode === 'ghost' && b.modeT > 0 && p.team !== b.modeTeam) {
    if (b.ghostP < 0 && Math.abs(b.x - p.x) < p.r + R + 20 && b.y > p.y - p.r - R - 20) {
      b.ghostP = p.i; ev(G, 'slip', { p: p.i, x: b.x | 0, y: b.y | 0 });
    }
    if (b.ghostP === p.i) return;
  }
  let touched = false;
  // body: from the middle of the head down to the shoe, so the ball cannot wedge under the head
  {
    const cr = p.r * 0.52, y0 = p.y + p.r * 0.3, y1 = Math.max(y0, p.y + footOff(p) - cr);
    const qy = clamp(b.y, y0, y1), dx = b.x - p.x, dy = b.y - qy, rr = cr + R, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 0.01, nx = d2 > 1e-6 ? dx / d : p.face, ny = d2 > 1e-6 ? dy / d : 0;
      b.x = p.x + nx * rr; b.y = qy + ny * rr;
      const rvx = b.vx - p.vx, rvy = b.vy - p.vy * 0.6, vn = rvx * nx + rvy * ny;
      if (vn < 0) { b.vx -= 1.32 * vn * nx; b.vy -= 1.32 * vn * ny; touched = true; b.lastKind = 'body'; }
    }
  }
  // head
  {
    const dx = b.x - p.x, dy = b.y - p.y, rr = p.r + R, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d;
      b.x = p.x + nx * rr; b.y = p.y + ny * rr;
      const pvx = p.vx * 0.8, pvy = p.vy * 0.55;
      const rvx = b.vx - pvx, rvy = b.vy - pvy, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const e = 0.5, k = (1 + e) * 0.8;
        b.vx = pvx + rvx - k * vn * nx; b.vy = pvy + rvy - k * vn * ny;
        // a header sends it forward
        if (!p.ground && ny < 0.3) { b.vx += p.face * 120; b.vy -= 40; }
        else if (ny < -0.2) b.vx += p.face * 50;
        const hs = Math.hypot(b.vx, b.vy), cap = 1120 * (p.scale > 1.2 ? 1.1 : 1) * ballSpeedK(G);
        if (hs > cap && !b.mode) { b.vx *= cap / hs; b.vy *= cap / hs; }
        // まっかっかヘッド: the red-hot head sends it off forward like a rocket
        if (p.hot > 0 && !b.mode) {
          const a = 0.16 + clamp(-ny, -0.4, 1) * 0.34 + (G.rng() - 0.5) * 0.08, hsp = 1420 * ballSpeedK(G);
          b.vx = p.face * Math.cos(a) * hsp; b.vy = -Math.sin(a) * hsp;
          b.heatT = 0.8;
          if (G.t - (p.sizzleT || -9) > 0.15) { p.sizzleT = G.t; ev(G, 'sizzle', { p: p.i, x: b.x | 0, y: b.y | 0 }); }
        }
        b.av = (b.vx - pvx) / R * 0.5;
        if (-vn > 200 && G.t - p.lastTouchT > 0.12) ev(G, 'head', { p: p.i, v: -vn | 0, x: b.x | 0, y: b.y | 0 });
        touched = true; b.lastKind = 'head';
      }
    }
  }
  // shoe
  {
    const dx = b.x - fx, dy = b.y - fy, rr = FOOT_R + R, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d;
      b.x = fx + nx * rr; b.y = fy + ny * rr;
      const w = kickOmega(kt), L = legLen(p);
      const fvx = p.vx + p.face * Math.cos(fa) * L * w, fvy = p.vy - Math.sin(fa) * L * w;
      const rvx = b.vx - fvx, rvy = b.vy - fvy, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        b.vx = fvx + rvx - 1.35 * vn * nx; b.vy = fvy + rvy - 1.35 * vn * ny;
        touched = true; b.lastKind = 'foot';
      }
    }
  }
  if (touched) touchBall(G, b, p, false);
}

function kickBall(G, b, p, head) {
  const ch = CHARS[p.char];
  p.kick.hit = true;
  // one button, steered by the direction held when it was pressed:
  //   toward the other goal: a low, hard drive (in the air: smashed down)
  //   nothing: a normal shot      toward our own goal: a high lob
  const dir = p.kick.dir || 0;
  let a, spMul = 1;
  if (dir > 0 && !p.ground && b.y > p.y - p.r * 0.3) { a = -0.3; spMul = 1.08; }
  else if (dir > 0) { a = 0.1; spMul = 1.06; }
  else if (dir < 0) { a = 0.98; spMul = 0.86; }
  else a = 0.42;
  if (head) a -= 0.06;
  // a ball that is high up goes up a little more
  const [, py] = pivotOf(p);
  a += clamp((py - b.y) * 0.0025, -0.04, 0.14);
  // just a touch of luck, so two players kicking face to face do not lock up
  a += (G.rng() - 0.5) * (p.drunk > 0 ? 0.9 : 0.08);
  const near = Math.abs(b.x - b.scrumX) < 170 && G.t - b.kickT < 0.7 && b.kickTeam !== p.team;
  b.scrum = near ? b.scrum + 1 : 0; b.scrumX = b.x;
  if (b.scrum >= 3) { a = 0.95 + G.rng() * 0.4; b.scrum = 0; }
  const sp = kckOf(ch.kck) * spMul * (head ? (p.hot > 0 ? 1.18 : 0.92) : 1) * (p.big > 0 || p.giant > 0 ? 1.06 : 1) * (p.tiny > 0 ? 0.9 : 1) * (p.pow > 0 ? 1.15 : 1) * (0.96 + G.rng() * 0.08);
  b.vx = p.face * Math.cos(a) * sp * ballSpeedK(G) + p.vx * 0.25;
  b.vy = -Math.sin(a) * sp * ballSpeedK(G) + Math.min(0, p.vy) * (head ? 0.2 : 0.1);
  b.av = -p.face * 14;
  // two players of opposite sides kicking it at the same moment: it flies off, mostly upward
  if (G.t - b.kickT < 0.1 && b.kickTeam !== p.team) {
    const ang = -Math.PI / 2 + (G.rng() - 0.5) * 1.7, csp = (720 + G.rng() * 420) * ballSpeedK(G);
    b.vx = Math.cos(ang) * csp; b.vy = Math.sin(ang) * csp;
    ev(G, 'clash', { x: b.x | 0, y: b.y | 0 });
  }
  if (head && p.hot > 0) b.heatT = 0.8;
  b.kickT = G.t; b.kickTeam = p.team; b.kickVx = b.vx; b.kickVy = b.vy;
  // out of the shoe (or off the head), so it does not touch it again at once
  if (head) {
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1, need = p.r + b.r + 1;
    if (d < need) { b.x = p.x + dx / d * need; b.y = p.y + dy / d * need; }
  } else {
    const [fx2, fy2] = footAt(p, p.kick.t);
    const dx = b.x - fx2, dy = b.y - fy2, d = Math.hypot(dx, dy) || 1, need = FOOT_R + b.r + 1;
    if (d < need) { b.x = fx2 + dx / d * need; b.y = fy2 + dy / d * need; }
  }
  p.stats.shots++; b.lastKind = head ? 'head' : 'kick';
  ev(G, 'kick', { p: p.i, v: sp | 0, x: b.x | 0, y: b.y | 0, h: head ? 1 : 0 });
  touchBall(G, b, p, true);
}

// a muscle punch: hard and nearly flat (the held direction still steers it)
function punchBall(G, b, p) {
  p.kick.hit = true;
  const dir = p.kick.dir || 0;
  let a = dir < 0 ? 0.8 : dir > 0 ? 0.04 : 0.22;
  a += (G.rng() - 0.5) * 0.06;
  const sp = kckOf(CHARS[p.char].kck) * 1.16 * (p.pow > 0 ? 1.15 : 1) * (0.97 + G.rng() * 0.06) * ballSpeedK(G);
  b.vx = p.face * Math.cos(a) * sp + p.vx * 0.2; b.vy = -Math.sin(a) * sp;
  b.av = -p.face * 18;
  b.kickT = G.t; b.kickTeam = p.team; b.kickVx = b.vx; b.kickVy = b.vy;
  const [qx, qy] = fistAt(p, p.kick.t), need = FIST_R * p.r + b.r + 1, dx = b.x - qx, dy = b.y - qy, d = Math.hypot(dx, dy) || 1;
  if (d < need) { b.x = qx + dx / d * need; b.y = qy + dy / d * need; }
  p.stats.shots++; b.lastKind = 'kick';
  ev(G, 'punch', { p: p.i, x: b.x | 0, y: b.y | 0 });
  touchBall(G, b, p, true);
}

// ---------- kicking (or punching) someone on the other side hurts ----------
function hitPlayers(G) {
  if (G.phase !== 'play') return;
  // まっかっかヘッド: bumping into the red-hot head burns
  for (const p of G.players) {
    if (p.hot <= 0) continue;
    for (const q of G.players) {
      if (q.team === p.team || q.stn > 0 || G.t - q.burnT < 0.7) continue;
      if (Math.hypot(q.x - p.x, q.y - p.y) < p.r + q.r + 6) { q.burnT = G.t; hurt(G, p, q, 'burn', (p.x + q.x) / 2, (p.y + q.y) / 2); }
    }
  }
  for (const p of G.players) {
    const kt = p.kick.t;
    if (kt < 0 || kt > KICK_FWD + KICK_GRACE || p.frz > 0 || p.stn > 0) continue;
    if (p.kick.pseq !== p.kick.seq) { p.kick.pseq = p.kick.seq; p.kick.pmask = 0; }
    const [fx, fy] = footAt(p, kt), fist = p.muscle > 0 ? fistAt(p, kt) : null;
    for (const q of G.players) {
      if (q.team === p.team || q.stn > 0 || (p.kick.pmask & (1 << q.i))) continue;
      const how = touchesPlayer(q, fx, fy, FOOT_R + 4) ? 'kick' : fist && touchesPlayer(q, fist[0], fist[1], FIST_R * p.r) ? 'punch' : '';
      if (!how) continue;
      p.kick.pmask |= 1 << q.i;
      hurt(G, p, q, how, how === 'kick' ? fx : fist[0], how === 'kick' ? fy : fist[1]);
    }
  }
}
function touchesPlayer(q, x, y, rad) {
  let dx = x - q.x, dy = y - q.y, rr = q.r + rad;
  if (dx * dx + dy * dy < rr * rr) return true;
  const cr = q.r * 0.52, y0 = q.y + q.r * 0.3, y1 = Math.max(y0, q.y + footOff(q) - cr), qy = clamp(y, y0, y1);
  dx = x - q.x; dy = y - qy; rr = cr + rad;
  return dx * dx + dy * dy < rr * rr;
}
function hurt(G, p, q, how, x, y) {
  let dmg;
  if (how === 'burn') dmg = 0.15;
  else if (how === 'meteor') dmg = 0.16;
  else {
    dmg = 0.2 + 0.02 * CHARS[p.char].kck;          // four or five kicks
    if (how === 'punch') dmg *= 1.8; else if (p.muscle > 0) dmg *= 1.3;
    if (p.pow > 0) dmg *= 1.2;
    if (p.big > 0 || p.giant > 0) dmg *= 1.2;
  }
  q.hp = Math.max(0, q.hp - dmg); q.hurtT = G.t;
  const dir = how === 'meteor' ? (Math.sign(q.x - x) || 1) : (Math.sign(q.x - p.x) || p.face);
  ev(G, 'hit', { p: q.i, by: p ? p.i : -1, x: x | 0, y: y | 0, how, hp: Math.round(q.hp * 100) / 100 });
  if (q.hp <= 0) {
    q.stn = Math.max(q.stn, HIT_STUN); q.armed = 0;
    bump(G, q, dir, 520, -380);
    ev(G, 'ko', { p: q.i, by: p ? p.i : -1 });
  } else if (how === 'punch') bump(G, q, dir, 460, -300);
  else if (how === 'burn') bump(G, q, dir, 420, -280);
  else if (how === 'meteor') bump(G, q, dir, 300, -300);
  else bump(G, q, dir, 280, -150);
}
// 冷徹プレゼン: shooting stars rain down on the other side (simulated where the match is run)
function stepMeteors(G, dt) {
  for (const p of G.players) {
    if (p.present <= 0) continue;
    const age = PRESENT_T - p.present;
    if (age < 0.9 || age > 4.0 || G.phase !== 'play') continue;
    p.meteorAcc = (p.meteorAcc || 0) + dt;
    while (p.meteorAcc >= 0.15) {
      p.meteorAcc -= 0.15;
      const foes = G.players.filter(q => q.team !== p.team);
      const half = p.team === 0 ? W / 2 + G.rng() * W / 2 : G.rng() * W / 2;
      const aim = foes.length && G.rng() < 0.7 ? foes[Math.floor(G.rng() * foes.length)].x + (G.rng() - 0.5) * 320 : half;
      const tx = clamp(aim, 30, W - 30), dir = G.rng() < 0.5 ? -1 : 1;
      const sp = 950 + G.rng() * 250, ang = 1.15 + G.rng() * 0.15, vx = dir * Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
      const tt = (GROUND + 40) / vy;
      G.meteors.push({ id: ++G.meteorSeq, x: tx - vx * tt, y: -40, vx, vy, team: p.team, by: p.i });
    }
  }
  // the event's shower falls anywhere, on anyone
  if (G.rainT > 0) {
    G.rainT -= dt; G.rainAcc += dt;
    while (G.rainAcc >= 0.17) {
      G.rainAcc -= 0.17;
      const tx = 60 + G.rng() * (W - 120), dir = G.rng() < 0.5 ? -1 : 1;
      const sp = 950 + G.rng() * 250, ang = 1.15 + G.rng() * 0.15, vx = dir * Math.cos(ang) * sp, vy = Math.sin(ang) * sp, tt = (GROUND + 40) / vy;
      G.meteors.push({ id: ++G.meteorSeq, x: tx - vx * tt, y: -40, vx, vy, team: -1, by: -1 });
    }
  }
  for (let i = G.meteors.length - 1; i >= 0; i--) {
    const m = G.meteors[i];
    m.x += m.vx * dt; m.y += m.vy * dt;
    let boom = m.y >= GROUND - 8;
    if (!boom) for (const q of G.players) if (q.team !== m.team && touchesPlayer(q, m.x, m.y, 16)) { boom = true; break; }
    if (!boom) continue;
    const by = G.players[m.by] || null;
    if (m.coin) ev(G, 'coin', { x: m.x | 0, y: Math.min(m.y, GROUND - 8) | 0 });
    for (const q of G.players) {
      if (q.team === m.team || q.stn > 0 || G.t - q.meteorT < 0.45) continue;
      if (touchesPlayer(q, m.x, m.y, 44)) { q.meteorT = G.t; hurt(G, by, q, 'meteor', m.x, m.y); }
    }
    ev(G, 'meteor', { x: m.x | 0, y: Math.min(m.y, GROUND - 8) | 0 });
    G.meteors.splice(i, 1);
  }
}

// ---------- ラピス: the gift card ----------
function stepGifts(G, dt) {
  for (const p of G.players) {
    if (p.giftT > 0) {
      p.giftT -= dt;
      if (p.giftT <= 0) { p.giftT = 0; applyGift(G, p, p.giftAmt); }
    }
    // ¥10,000: money rains on the other side
    if (p.coinT > 0 && G.phase === 'play') {
      p.coinAcc = (p.coinAcc || 0) + dt;
      while (p.coinAcc >= 0.14) {
        p.coinAcc -= 0.14;
        const foes = G.players.filter(q => q.team !== p.team);
        const half = p.team === 0 ? W / 2 + G.rng() * W / 2 : G.rng() * W / 2;
        const aim = foes.length && G.rng() < 0.7 ? foes[Math.floor(G.rng() * foes.length)].x + (G.rng() - 0.5) * 300 : half;
        const tx = clamp(aim, 30, W - 30), vy = 900 + G.rng() * 200, vx = (G.rng() - 0.5) * 240, tt = (GROUND + 40) / vy;
        G.meteors.push({ id: ++G.meteorSeq, x: tx - vx * tt, y: -40, vx, vy, team: p.team, by: p.i, coin: 1 });
      }
    }
  }
}
function applyGift(G, p, amt) {
  const mates = G.players.filter(q => q.team === p.team), foes = G.players.filter(q => q.team !== p.team);
  const oppSide = 1 - p.team;
  p.giftShow = 1.6;
  if (amt >= 1000) { p.dash = Math.max(p.dash, 5); p.hp = Math.min(1, p.hp + 0.3); }
  if (amt >= 3000) { p.dash = Math.max(p.dash, 7); p.pow = Math.max(p.pow, 7); p.hp = 1; }
  if (amt >= 5000) {
    for (const q of mates) { q.dash = Math.max(q.dash, 7); q.pow = Math.max(q.pow, 7); }
    G.goalFx[oppSide] = { k: 'big', t: 8 }; setGoalH(G, oppSide, GOAL_H_BIG);
  }
  if (amt >= 10000) {
    for (const q of mates) { q.dash = Math.max(q.dash, 8); q.pow = Math.max(q.pow, 8); q.hp = 1; }
    G.goalFx[oppSide] = { k: 'big', t: 10 };
    for (const q of foes) { q.stn = Math.max(q.stn, 2); q.armed = 0; ev(G, 'bolt', { p: q.i }); }
    p.coinT = 2.6; p.coinAcc = 0;
  }
  ev(G, 'giftWin', { p: p.i, amt });
}

// ---------- the イベント mode: something happens every so often ----------
function stepEvents(G, dt) {
  if (!G.rules.events) return;
  G.eventT -= dt;
  if (G.eventT > 0) return;
  G.eventT = 8 + G.rng() * 4;
  let k = EVENT_POOL[Math.floor(G.rng() * EVENT_POOL.length)];
  if (k === G.lastEvent) k = EVENT_POOL[Math.floor(G.rng() * EVENT_POOL.length)];
  G.lastEvent = k;
  applyEvent(G, k);
  ev(G, 'event', { ek: k });
}
function applyEvent(G, k) {
  if (k === 'multi') { for (const dx of [-240, 240]) spawnExtraBall(G, W / 2 + dx); }
  else if (k === 'giant') { G.bigBallT = Math.max(G.bigBallT, 8); setBallR(G, BALL_R_BIG * 1.1); }
  else if (k === 'ice') G.iceT = 8;
  else if (k === 'lowgrav') G.lowGravT = 8;
  else if (k === 'meteor') { G.rainT = 3.2; G.rainAcc = 0; }
  else if (k === 'freeze') {
    const ps = G.players.slice().sort(() => G.rng() - 0.5).slice(0, Math.max(1, Math.floor(G.players.length / 2)));
    for (const p of ps) { p.frz = Math.max(p.frz, 1.8); p.armed = 0; ev(G, 'freeze', { p: p.i }); }
  }
  else if (k === 'bighead') for (const p of G.players) { p.big = Math.max(p.big, 7); p.tiny = 0; }
  else if (k === 'tiny') for (const p of G.players) { p.tiny = Math.max(p.tiny, 6); p.big = 0; }
  else if (k === 'biggoal') for (let side = 0; side < 2; side++) { G.goalFx[side] = { k: 'big', t: 8 }; setGoalH(G, side, GOAL_H_BIG); }
  else if (k === 'wind') { G.wind.team = G.rng() < 0.5 ? 0 : 1; G.wind.t = 3; }
}
// more balls: real ones, any of them scores
function spawnExtraBall(G, x) {
  const b = newBall(x, 120);
  b.held = false; b.extra = true; b.id = ++G.extraSeq; b.life = 14; b.r = G.ball.r;
  b.vx = (G.rng() - 0.5) * 300; b.vy = 0;
  G.extra.push(b);
  ev(G, 'poof', { x: b.x | 0, y: b.y | 0 });
}
function stepExtra(G, dt) {
  for (let i = G.extra.length - 1; i >= 0; i--) {
    const b = G.extra[i];
    b.life -= dt;
    if (b.life <= 0) { ev(G, 'poof', { x: b.x | 0, y: b.y | 0 }); G.extra.splice(i, 1); }
  }
}

// a push for someone who got hit (a joined phone moves its own player, so it is told too)
function bump(G, q, dir, vx, vy) {
  if (q.owned) { q.vx = dir * vx; q.vy = vy; q.ground = false; }
  ev(G, 'bump', { p: q.i, vx: dir * vx, vy, ep: G.epoch });
}

function touchBall(G, b, p, kicked) {
  const fresh = G.t - p.lastTouchT > 0.18;
  p.lastTouchT = G.t;
  b.touchT = G.t; G.idleT = 0;
  if (b.mode && b.modeT > 0) {
    if (b.modeTeam !== p.team) {
      // a super ball hitting someone on the other side
      const bit = 1 << p.i;
      if (b.mode === 'fire' && !(b.hitMask & bit)) {
        b.hitMask |= bit;
        knock(G, p, b.vx > 0 ? 1 : -1, 1.0);
        if (b.pierce > 0) {
          // it keeps flying through: undo the bounce
          b.pierce--;
          const [tx, ty] = goalTarget(G, b.modeTeam);
          aimBall(b, tx, ty, 1650 * ballSpeedK(G));
          b.x += b.vx * 0.012; b.y += b.vy * 0.012;
          return;
        }
        endMode(G);
      } else if (b.mode === 'ice') {
        p.frz = Math.max(p.frz, 2.5); p.armed = 0;
        ev(G, 'freeze', { p: p.i });
        endMode(G);
      } else if (b.mode === 'rocket') endMode(G);
    } else if (b.mode === 'rocket' && G.t - b.launchT > 0.3) endMode(G);
  }
  if (fresh) {
    p.stats.touches++;
    if (!p.armed && p.gauge < 1 && G.phase === 'play') p.gauge = Math.min(1, p.gauge + GAUGE_TOUCH);
  }
  b.last = p.i; b.lastTeam = p.team; b.touchX = b.x; b.touchVx = b.vx;
  b.teamLast[p.team] = p.i; b.teamLastT[p.team] = G.t;
  if (p.armed > 0 && G.phase === 'play' && b === G.ball) superShot(G, p);
}

function knock(G, p, dir, stun) {
  const vx = dir * 650, vy = -420;
  if (p.owned) { p.vx = vx; p.vy = vy; p.ground = false; }
  p.stn = Math.max(p.stn, stun); p.armed = 0;
  ev(G, 'knock', { p: p.i, vx, vy, ep: G.epoch });
}

function goalCheck(G, b) {
  b = b || G.ball;
  if (G.phase !== 'play') return;
  let side = -1;
  if (b.x + b.r < GOAL_D && b.y > GROUND - G.goalH[0]) side = 0;
  else if (b.x - b.r > W - GOAL_D && b.y > GROUND - G.goalH[1]) side = 1;
  if (side < 0) return;
  const team = 1 - side;                 // the team that scores
  G.score[team]++;
  let sc = b.last >= 0 ? G.players[b.last] : null;
  // a defender's touch on its way in: the goal is the shooter's, if they touched it just before
  if (sc && sc.team !== team && b.teamLast[team] >= 0 && G.t - b.teamLastT[team] < 1.6) sc = G.players[b.teamLast[team]];
  const own = !!sc && sc.team !== team;
  if (sc) { if (own) sc.stats.own++; else sc.stats.goals++; }
  G.lastGoal = { team, p: sc ? sc.i : -1, own, t: G.t, mode: b.mode };
  if (b !== G.ball) G.lastGoal.extra = 1;
  G.goalsLog.push({ team, p: sc ? sc.i : -1, own, clock: Math.ceil(G.clock), ot: G.ot, kind: b.lastKind, mode: b.mode, fromX: b.touchX | 0, role: sc && sc.cpu ? sc.cpu.role : '' });
  for (const q of G.players) if (q.team === side && q.gauge < 1 && !q.armed) q.gauge = Math.min(1, q.gauge + GAUGE_CONCEDE);
  endMode(G);
  setPhase(G, 'goal');
  ev(G, 'goal', { team, p: sc ? sc.i : -1, own, sc: G.score.slice() });
}

// ---------- the clone super's decoys ----------
function stepFakes(G, dt) {
  for (let i = G.fakes.length - 1; i >= 0; i--) {
    const f = G.fakes[i];
    let gone = false;
    for (let s = 0; s < SUB && !gone; s++) {
      const h = dt / SUB;
      f.vy += ballGravity(G) * h; f.vx *= 1 - 0.1 * h;
      f.x += f.vx * h; f.y += f.vy * h; f.rot += f.av * h;
      ballStatics(G, f, h, false);
      const fr = f.r || BALL_R;
      if (f.x + fr < GOAL_D && f.y > GROUND - G.goalH[0] || f.x - fr > W - GOAL_D && f.y > GROUND - G.goalH[1]) gone = true;
      for (const p of G.players) {
        const dx = f.x - p.x, dy = f.y - p.y, rr = p.r + fr;
        if (dx * dx + dy * dy < rr * rr) { gone = true; break; }
        const [fx, fy] = footAt(p, p.kick.t);
        const ex = f.x - fx, ey = f.y - fy, r2 = FOOT_R + fr + 4;
        if (ex * ex + ey * ey < r2 * r2) { gone = true; break; }
      }
    }
    f.life -= dt;
    if (gone || f.life <= 0) { ev(G, 'poof', { x: f.x | 0, y: f.y | 0 }); G.fakes.splice(i, 1); }
  }
}

// ---------- items ----------
function stepItems(G, dt) {
  if (G.setup.items) {
    G.itemT -= dt;
    if (G.itemT <= 0 && G.items.length < 2) {
      G.itemT = (7 + G.rng() * 5) / (G.rules.itemRate || 1);
      const k = ITEM_KEYS[Math.floor(G.rng() * ITEM_KEYS.length)];
      const x = 360 + G.rng() * (W - 720);
      G.items.push({ id: ++G.itemSeq, k, x, y: -40, t: 0, hy: 250 + G.rng() * 210 });
      ev(G, 'itemIn', { it: k });
    }
  }
  const b = G.ball;
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i];
    it.t += dt;
    if (it.y < it.hy) it.y = Math.min(it.hy, it.y + 120 * dt);
    const iy = it.y + Math.sin(it.t * 3) * 8;
    let who = null, popped = false;
    for (const p of G.players) {
      const dx = p.x - it.x, dy = p.y - iy, rr = p.r + 30;
      if (dx * dx + dy * dy < rr * rr) { who = p; popped = true; break; }
    }
    if (!popped && !b.held) {
      const dx = b.x - it.x, dy = b.y - iy, rr = b.r + 30;
      if (dx * dx + dy * dy < rr * rr) { popped = true; if (b.last >= 0 && G.t - b.touchT < 5) who = G.players[b.last]; }
    }
    if (popped) {
      G.items.splice(i, 1);
      if (who) giveItem(G, who, it.k); else ev(G, 'poof', { x: it.x | 0, y: iy | 0 });
      continue;
    }
    if (it.t > 13) { G.items.splice(i, 1); ev(G, 'poof', { x: it.x | 0, y: iy | 0 }); }
  }
}
function giveItem(G, p, k) {
  const foes = G.players.filter(q => q.team !== p.team);
  const d = ITEMS[k].t;
  p.stats.items++;
  if (k === 'big') p.big = d;
  else if (k === 'tiny') for (const q of foes) q.tiny = d;
  else if (k === 'dash') p.dash = d;
  else if (k === 'freeze') for (const q of foes) { q.frz = Math.max(q.frz, d); q.armed = 0; ev(G, 'freeze', { p: q.i }); }
  else if (k === 'charge') { if (!p.armed) p.gauge = 1; }
  else if (k === 'biggoal') { const side = 1 - p.team; G.goalFx[side] = { k: 'big', t: d }; setGoalH(G, side, GOAL_H_BIG); }
  else if (k === 'smallgoal') { const side = p.team; G.goalFx[side] = { k: 'small', t: d }; setGoalH(G, side, GOAL_H_SMALL); }
  else if (k === 'bigball') { G.bigBallT = d; setBallR(G, BALL_R_BIG); }
  else if (k === 'float') G.floatT = d;
  ev(G, 'item', { p: p.i, it: k });
}

// a ball nobody can reach any more gets a little push
function stuckCheck(G, dt) {
  const b = G.ball;
  const sp = Math.hypot(b.vx, b.vy);
  // resting on top of a crossbar
  const onBar = (b.x < GOAL_D + BAR_OUT + 4 && b.y < GROUND - G.goalH[0] - BAR_T) || (b.x > W - GOAL_D - BAR_OUT - 4 && b.y < GROUND - G.goalH[1] - BAR_T);
  if (onBar && sp < 120) G.barT += dt; else G.barT = 0;
  if (G.barT > 1.4) { G.barT = 0; b.vx = (b.x < W / 2 ? 1 : -1) * 260; b.vy = -260; ev(G, 'nudge'); }
  // nobody touched it for a long while and it is barely moving
  G.idleT += dt;
  if (G.idleT > 9 && sp < 40) { G.idleT = 0; b.vy = -700; b.vx = (G.rng() - 0.5) * 300; ev(G, 'nudge'); }
}

// ---------- a little prediction: where the ball goes if nobody touches it ----------
// (used by the CPU, and by joined phones to show the ball "now")
function predictBall(G, b0, T, step, out) {
  const b = { x: b0.x, y: b0.y, vx: b0.vx, vy: b0.vy, r: b0.r || BALL_R, rot: 0, av: 0, mode: b0.mode, modeT: b0.modeT };
  const pts = out || [];
  pts.length = 0;
  const h = step || 1 / 60, n = Math.ceil(T / h), sub = 2;
  const g = ballGravity(G);
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < sub; s++) {
      const dt = h / sub;
      const noGrav = (b.mode === 'fire' || b.mode === 'rocket') && b.modeT > 0;
      if (!noGrav) b.vy += g * dt;
      b.vx *= 1 - 0.1 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.modeT > 0) b.modeT -= dt;
      ballStatics(G, b, dt, false);
    }
    pts.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, t: (i + 1) * h });
  }
  return pts;
}

// ---------- what a match looks like at the end ----------
function matchSummary(G) {
  const ps = G.players.map(p => ({ i: p.i, name: p.name, char: p.char, team: p.team, ...p.stats }));
  let mvp = -1, best = -1;
  for (const p of ps) {
    const sc = p.goals * 10 + p.touches * 0.2 + p.supers * 0.5 - p.own * 4 + (G.result && p.team === G.result.win ? 3 : 0);
    if (sc > best) { best = sc; mvp = p.i; }
  }
  return { score: G.score.slice(), win: G.result ? G.result.win : -1, ot: G.ot, players: ps, mvp, goals: G.goalsLog.slice() };
}
