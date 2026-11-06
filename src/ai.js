// ===================================================================
//  CPU players. aiInput(G, p) returns the buttons a CPU presses this step.
//  It re-thinks every few hundredths of a second (slower when weaker),
//  reads where the ball will be, and plays one of two roles: the one
//  nearer the ball attacks, the other one guards the goal.
// ===================================================================

function mkCpu(lv, seed) {
  return { lv: CPU_LV[lv] ? lv : 'normal', t: 0, tx: 0, role: 'att', roleT: 0, jumpAt: -1, jumpHold: 0,
           wantSuper: false, kickCool: 0, rng: mkRng(seed || 7), pts: [], aimErr: 0, stuckT: 0, lastX: 0 };
}

function aiInput(G, p) {
  const inp = { l: 0, r: 0, j: 0, jp: 0, k: 0, s: 0 };
  const c = p.cpu || (p.cpu = mkCpu('normal', p.i * 977 + 13));
  const lv = CPU_LV[c.lv];
  p.cpuSpeed = lv.speed;
  if (G.phase === 'goal') {
    // the scoring side hops for joy
    if (G.lastGoal && G.lastGoal.team === p.team && p.ground && c.rng() < 0.04) { inp.jp = 1; inp.j = 1; }
    return inp;
  }
  if (G.phase !== 'play') return inp;
  c.t -= DT; c.kickCool -= DT;
  if (c.t <= 0) {
    c.t = lv.react * (0.7 + 0.6 * c.rng());
    plan(G, p, c, lv);
  }
  // walk toward the planned spot
  const dx = c.tx - p.x, dead = 6;
  if (dx > dead) inp.r = 1; else if (dx < -dead) inp.l = 1;
  // never shove the ball toward our own goal: hop over a low ball, stop for one at head height
  const mv = inp.r - inp.l, b = G.ball;
  if (mv && mv === -p.face && !b.held) {
    const rel = (b.x - p.x) * mv;
    if (rel > -4 && rel < p.r + BALL_R + 46 && b.y > p.y - p.r - BALL_R - 6) {
      if (b.y > p.y + p.r * 0.05) { if (p.ground) { inp.jp = 1; inp.j = 1; c.jumpHold = 0.28; } }
      else if (Math.abs(b.vx) < 500 || b.vx * mv > 0) { inp.l = 0; inp.r = 0; }
    }
  }
  // a planned jump
  if (c.jumpAt >= 0 && G.t >= c.jumpAt) {
    if (p.ground) { inp.jp = 1; inp.j = 1; c.jumpHold = 0.4; }
    c.jumpAt = -1;
  }
  if (c.jumpHold > 0) { inp.j = 1; c.jumpHold -= DT; }
  // kick when the ball is (about to be) in front of the shoe
  if (c.kickCool <= 0 && kickChance(G, p, c, lv)) { inp.k = 1; c.kickCool = 0.22; }
  if (c.wantSuper && p.gauge >= 1 && !p.armed) { inp.s = 1; c.wantSuper = false; }
  return inp;
}

function jumpApex(p) {
  const ch = CHARS[p.char], v = jmpOf(ch.jmp) * jumpMul(p), g = G_PLAYER * (ch.floaty || 1);
  return { v, g, h: v * v / (2 * g) };
}
// seconds for a jump to lift the head by h (or -1 if it cannot)
function riseTime(J, h) {
  const disc = J.v * J.v - 2 * J.g * h;
  if (disc < 0) return -1;
  return (J.v - Math.sqrt(disc)) / J.g;
}

function plan(G, p, c, lv) {
  const b = G.ball, dir = p.face;
  const ownX = p.team === 0 ? GOAL_D : W - GOAL_D;
  const mates = G.players.filter(q => q.team === p.team && q !== p);
  const foes = G.players.filter(q => q.team !== p.team);
  const sp = spdOf(CHARS[p.char].spd) * speedMul(p);
  const J = jumpApex(p), sy = standY(p);
  const pts = predictBall(G, b, 2.0, 1 / 60, c.pts);
  c.aimErr = (c.rng() - 0.5) * 2 * lv.err;
  // ---- who attacks ----
  const reachT = q => Math.abs((b.x - q.face * (q.r + 30)) - q.x) / (spdOf(CHARS[q.char].spd) * speedMul(q)) + (((b.x - q.x) * q.face < 0) ? 0.45 : 0);
  if (mates.length) {
    const mine = reachT(p), best = Math.min(...mates.map(reachT));
    c.roleT -= lv.react;
    if (c.roleT <= 0) {
      const want = mine < best - (c.role === 'att' ? -0.18 : 0.18) ? 'att' : 'def';
      if (want !== c.role) { c.role = want; c.roleT = 0.6; }
    }
  } else c.role = 'solo';
  // ---- the ball's way to our goal ----
  let threat = null;
  for (const q of pts) {
    if ((q.x - ownX) * dir < 0 && q.y > GROUND - G.goalH[p.team === 0 ? 0 : 1] - BALL_R) { threat = q; break; }
    if (q.t > 1.8) break;
  }
  const ballOurHalf = (b.x - W / 2) * dir < 0;
  let role = c.role;
  if (role === 'solo') {
    // alone: go for the ball only when we get there first, otherwise guard the goal
    const myT = interceptTime(G, p, pts), foeT = Math.min(9, ...foes.map(q => interceptTime(G, q, pts)));
    const ballNear = Math.abs(b.x - p.x) < 200 && (b.x - p.x) * dir > -20;
    if (ballNear && !threat) role = 'att';
    else if (threat) role = (ballNear && (b.x - p.x) * dir > 0) ? 'att' : 'def';
    else role = myT < foeT - 0.08 ? 'att' : 'def';
  }
  if (role === 'def' && ballOurHalf && !threat) {
    // the ball is loose in our half and the attacker is far from it: go for it
    const mate = mates[0];
    if (!mate || Math.abs(b.x - p.x) < Math.abs(b.x - mate.x) - 60) role = 'att';
  }
  c.jumpAt = -1;
  if (role === 'def') planDefend(G, p, c, lv, pts, threat, ownX, sp, J, sy);
  else planAttack(G, p, c, lv, pts, sp, J, sy);
  // ---- supers ----
  c.wantSuper = false;
  if (p.gauge >= 1 && !p.armed && c.rng() < lv.superUse) {
    const kind = CHARS[p.char].sup, d = Math.hypot(b.x - p.x, b.y - p.y);
    const front = (b.x - p.x) * dir > -10;
    const foeNear = foes.some(q => Math.abs(q.x - b.x) < 240);
    const attackThird = (b.x - (W / 2 + dir * 260)) * dir > 0;
    if (SUPERS[kind].armed) c.wantSuper = d < 300 && front && role === 'att';
    else if (kind === 'thunder') c.wantSuper = foeNear && (ballOurHalf || attackThird);
    else if (kind === 'giant') c.wantSuper = (ballOurHalf && d < 420) || !!threat;
    else if (kind === 'wind') c.wantSuper = attackThird && (b.x - p.x) * dir > 0 && d < 500 || (!!threat && (b.x - p.x) * dir > -40);
  }
}

// when can q first get to a ball it can play (standing behind it), along the predicted path
function interceptTime(G, q, pts) {
  const sp = spdOf(CHARS[q.char].spd) * speedMul(q), J = jumpApex(q), sy = standY(q);
  const top = sy - q.r - J.h * 0.9;
  for (const pt of pts) {
    if (pt.y < top) continue;
    const stand = pt.x - q.face * (q.r + BALL_R * 0.35);
    const around = (pt.x - q.x) * q.face < 0 ? 0.35 : 0;
    if (Math.abs(stand - q.x) / sp + around <= pt.t + 0.04) return pt.t;
  }
  return 9;
}

function planAttack(G, p, c, lv, pts, sp, J, sy) {
  const b = G.ball, dir = p.face;
  const topReach = sy - p.r - J.h * 0.92;      // highest ball centre we can head
  let target = null;
  for (const q of pts) {
    if (q.y < topReach - BALL_R * 0.3) continue;  // too high to play then
    const stand = q.x - dir * (p.r + BALL_R * 0.35);
    const need = Math.abs(stand - p.x) / sp;
    if (need <= q.t + 0.04) { target = { q, stand }; break; }
  }
  if (!target) {
    const q = pts[Math.min(pts.length - 1, 50)];
    target = { q, stand: q.x - dir * (p.r + BALL_R) };
  }
  const q = target.q;
  // the ball is between us and our own goal: get around it without pushing it home
  const behind = (q.x - p.x) * dir < -6;
  if (behind) {
    const ownX = p.team === 0 ? GOAL_D : W - GOAL_D;
    const gap = Math.abs(b.x - p.x), low = b.y > p.y + p.r * 0.15, high = b.y < p.y - p.r - BALL_R * 2 - 30;
    const nearOwn = Math.abs(b.x - ownX) < 230;
    if (low || high) {
      // a low ball can be hopped over, a high one walked under
      c.tx = q.x - dir * (p.r + BALL_R + 80);
      if (low && p.ground && gap < p.r + BALL_R + 48 && (b.x - p.x) * dir < 0) c.jumpAt = G.t;
    } else {
      // at head height: wait on the far side for it to come down, unless it is heading for our goal
      c.tx = b.x + dir * (p.r + BALL_R + 46);
      if (nearOwn && (b.vx * dir < -200)) c.tx = q.x - dir * (p.r + BALL_R + 80);
    }
    if (nearOwn) c.tx = dir > 0 ? Math.max(c.tx, p.r * 0.9) : Math.min(c.tx, W - p.r * 0.9);
  } else {
    c.tx = target.stand + c.aimErr * 0.4;
  }
  c.tx = clamp(c.tx, p.r, W - p.r);
  // a header: the ball comes down near our head
  if (!behind) planHeader(G, p, c, lv, pts, J, sy);
  // standing still under a ball that sits on our head: walk forward
  if (Math.abs(b.x - p.x) < p.r * 0.6 && b.y < p.y - p.r && Math.abs(b.vy) < 80) c.tx = p.x + dir * 120;
}

function planHeader(G, p, c, lv, pts, J, sy) {
  const dir = p.face;
  for (const q of pts) {
    if (q.t < 0.08 || q.t > 0.75) continue;
    if (q.vy < -100) continue;                       // still going up
    const relX = (q.x - p.x) * dir;
    if (relX < -p.r * 0.6 || relX > p.r + 50) continue;
    const h = sy - q.y - p.r * 0.5;                    // how far the head must rise
    if (h < p.r * 0.6) break;                          // low enough to play on the ground
    if (h > J.h * 0.98) continue;
    const tr = riseTime(J, h);
    if (tr < 0) continue;
    let when = G.t + q.t - tr - 0.02;
    if (c.rng() < lv.jumpErr) when += (c.rng() - 0.5) * 0.2;
    if (when >= G.t - 0.02 && p.ground) { c.jumpAt = Math.max(G.t, when); c.tx = q.x - dir * (p.r * 0.55) + c.aimErr * 0.3; }
    break;
  }
}

function planDefend(G, p, c, lv, pts, threat, ownX, sp, J, sy) {
  const b = G.ball, dir = p.face;
  const dist = Math.abs(b.x - ownX);
  // stand between the ball and the goal, closer in when the ball is near
  let home = ownX + dir * clamp(20 + dist * 0.08, 30, 120);
  c.tx = home + c.aimErr * 0.3;
  if (threat) {
    // the ball is on its way into our goal: get in front of it
    let best = null;
    for (const q of pts) {
      if (q.t > threat.t + 0.05) break;
      const stand = q.x - dir * (p.r * 0.2);
      const need = Math.abs(stand - p.x) / sp;
      const headTop = sy - p.r * 1.6;
      const jumpTop = sy - p.r - J.h * 0.9;
      if (need <= q.t + 0.03 && q.y > jumpTop - BALL_R) {
        best = { q, stand };
        if (q.y > headTop) break;                  // can block it standing
      }
    }
    if (best) {
      c.tx = clamp(best.stand, ownX + dir * (p.r * 0.5), W - p.r);
      if (dir < 0) c.tx = clamp(best.stand, p.r, ownX - p.r * 0.5);
      const h = sy - best.q.y - p.r * 0.4;
      if (h > p.r * 0.7) {
        const tr = riseTime(J, Math.min(h, J.h * 0.98));
        if (tr >= 0) {
          let when = G.t + best.q.t - tr;
          if (c.rng() < lv.jumpErr) when += (c.rng() - 0.5) * 0.24;
          c.jumpAt = Math.max(G.t, when);
        }
      }
    } else c.tx = ownX + dir * 60;
  }
  c.tx = clamp(c.tx, p.r, W - p.r);
}

function kickChance(G, p, c, lv) {
  const b = G.ball;
  if (b.held || p.frz > 0 || p.stn > 0) return false;
  const dir = p.face;
  // where the ball will be a moment from now, against where the shoe sweeps
  const la = 0.05;
  const bx = b.x + b.vx * la, by = b.y + b.vy * la;
  const rel = (bx - p.x) * dir;
  const reach = (p.r + 42) * lv.kickRange;
  if (rel < -4 || rel > reach) return false;
  const [, py] = pivotOf(p);
  if (by < p.y - p.r * 0.45 || by > GROUND) return false;
  // don't blast it into our own goal from right in front of it (we always kick forward, so fine)
  if (Math.abs(by - py) > 95) return false;
  return c.rng() < 0.85;
}
