// Runs CPU-vs-CPU matches headless: node test/sim.js [matches] [lvA] [lvB] [teamSize]
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = ['data.js', 'engine.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(src + '\n;this.API = { newMatch, step, aiInput, mkCpu, matchSummary, CHARS, W, GROUND, GOAL_D };', ctx);
const A = ctx.API;

const N = +process.argv[2] || 20, lvA = process.argv[3] || 'normal', lvB = process.argv[4] || 'normal', ts = +process.argv[5] || 2;
const tot = { goals: 0, own: 0, draws: 0, win0: 0, win1: 0, supers: 0, items: 0, nudges: 0, kicks: 0, heads: 0, maxIdle: 0, byChar: {}, superKinds: {}, shots: {} };
const charGoals = {};
let nan = 0;
for (let m = 0; m < N; m++) {
  const players = [];
  for (let t = 0; t < 2; t++) for (let k = 0; k < ts; k++) players.push({ name: 'p' + t + k, char: (m * 3 + t * 5 + k * 2) % 8, team: t, ctrl: 'cpu' });
  const G = A.newMatch({ players, time: 90, items: true, ot: false, seed: 1000 + m });
  G.players.forEach((p, i) => { p.cpu = A.mkCpu(p.team === 0 ? lvA : lvB, 50 + i * 31 + m); });
  let steps = 0, lastEv = 0, idle = 0, maxIdle = 0;
  while (G.phase !== 'end' && steps < 60 * 400) {
    const inputs = G.players.map(p => A.aiInput(G, p));
    A.step(G, inputs); steps++;
    for (const e of G.evs) {
      if (e.id <= lastEv) continue; lastEv = e.id;
      if (e.k === 'nudge') tot.nudges++;
      if (e.k === 'kick') tot.kicks++;
      if (e.k === 'head') tot.heads++;
      if (e.k === 'super') tot.superKinds[e.s] = (tot.superKinds[e.s] || 0) + 1;
      if (e.k === 'shot') tot.shots[e.s] = (tot.shots[e.s] || 0) + 1;
    }
    const b = G.ball;
    if (!isFinite(b.x) || !isFinite(b.y) || G.players.some(p => !isFinite(p.x) || !isFinite(p.y))) { nan++; break; }
    if (G.phase === 'play') { if (Math.hypot(b.vx, b.vy) < 30) idle++; else idle = 0; maxIdle = Math.max(maxIdle, idle); }
  }
  const S = A.matchSummary(G);
  tot.goals += S.score[0] + S.score[1];
  if (S.win < 0) tot.draws++; else if (S.win === 0) tot.win0++; else tot.win1++;
  for (const p of S.players) {
    tot.own += p.own; tot.supers += p.supers; tot.items += p.items;
    const nm = A.CHARS[p.char].name;
    charGoals[nm] = charGoals[nm] || { goals: 0, games: 0 };
    charGoals[nm].goals += p.goals; charGoals[nm].games++;
  }
  tot.maxIdle = Math.max(tot.maxIdle, maxIdle / 60);
  if (N <= 12) console.log(`match ${m}: ${S.score[0]}-${S.score[1]}  steps ${steps}  maxIdle ${(maxIdle / 60).toFixed(1)}s  goals: ${S.goals.map(g => (g.own ? 'OG ' : '') + (g.p >= 0 ? A.CHARS[G.players[g.p].char].name : '?')).join(', ')}`);
}
console.log(`${N} matches ${ts}v${ts} ${lvA} vs ${lvB}: goals/match ${(tot.goals / N).toFixed(2)}  own ${tot.own}  wins ${tot.win0}/${tot.win1} draws ${tot.draws}`);
console.log(`kicks/match ${(tot.kicks / N).toFixed(0)}  heads/match ${(tot.heads / N).toFixed(0)}  supers/match ${(tot.supers / N).toFixed(1)}  items/match ${(tot.items / N).toFixed(1)}  nudges ${tot.nudges}  maxIdle ${tot.maxIdle.toFixed(1)}s  nan ${nan}`);
console.log('supers', JSON.stringify(tot.superKinds), 'shots', JSON.stringify(tot.shots));
console.log('goals per game by char', Object.entries(charGoals).map(([k, v]) => k + ' ' + (v.goals / v.games).toFixed(2)).join('  '));
