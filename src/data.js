'use strict';
// ===================================================================
//  ゴッツンサッカー — data: the field, the characters, their supers, items
//  (no DOM here: data.js + engine.js + ai.js also run in Node for tests)
// ===================================================================

const GAME_VER = 1;
const NET_V = 1;

// ---- the field, in world units (the canvas scales this to the screen) ----
const W = 1600;            // wall to wall
const H = 800;             // ceiling (y = 0) to the bottom of the picture
const GROUND = 720;        // the grass line players stand on
const GOAL_D = 112;        // depth of each goal: the goal line is x = GOAL_D / x = W - GOAL_D
const GOAL_H = 268;        // opening height, grass to the underside of the crossbar
const GOAL_H_BIG = 360;    // while the でかゴール item is in force
const GOAL_H_SMALL = 186;  // while the ちびゴール item is in force
const BAR_T = 16;          // crossbar thickness
const BAR_OUT = 16;        // the crossbar reaches this far past the goal line
const HEAD_R = 48;         // head radius at scale 1
const PIVOT = 0.66;        // hip pivot, below the head centre, in head radii
const LEG = 34;            // hip to the centre of the shoe
const FOOT_R = 14;         // the shoe, as a circle
const BALL_R = 23;
const BALL_R_BIG = 39;     // でかボール

const DT = 1 / 60;         // simulation step
const SUB = 4;             // ball sub-steps per step
const G_PLAYER = 2550;     // gravity on players
const G_BALL = 1450;       // gravity on the ball (a little floaty)
const BALL_MAX = 2100;

const KICK_FWD = 0.10;     // seconds the shoe swings forward (the part that can hit)
const KICK_BACK = 0.14;    // seconds it takes to come back
const KICK_GRACE = 0.035;  // a hit still counts this long after the swing reached the top

const SUPER_ARM_T = 6;     // an armed super (next touch) waits this long, then fizzles
const GAUGE_RATE = 1 / 24; // super gauge per second
const GAUGE_TOUCH = 0.05;  // ... per touch of the ball
const GAUGE_CONCEDE = 0.18;// ... for the team that let a goal in

const TEAM_COL = [
  { main: '#E5322D', deep: '#A11C19', light: '#FF8A7A', name: 'あか', en: 'RED' },
  { main: '#2D6BE5', deep: '#173F9A', light: '#86AEFF', name: 'あお', en: 'BLUE' },
];

// stat (1..5) to physics: wide steps, so every character plays differently
const spdOf = s => 300 + 52 * s;        // run speed, px/s: 352 .. 560
const jmpOf = s => 830 + 72 * s;        // take-off speed: 902 .. 1190 (jump 160 .. 278 px)
const kckOf = s => 920 + 125 * s;       // kick speed: 1045 .. 1545

// ---- characters (all original) ----
// size: head size (1 = normal). A big head blocks and heads more, a small one is quick and light.
// body: the same as pips for the menus. look: what art.js draws on the head. sup: the super (SUPERS)
const CHARS = [
  { id: 'rekka', name: 'レッカ', type: 'バランス型', size: 1.0, body: 3, spd: 3, jmp: 3, kck: 3, sup: 'fire', mass: 1,
    skin: '#FFD3B0', hair: '#E8361E', hair2: '#FFB21E', look: 'spiky', blurb: 'なんでもこなす。必殺の火の玉でゴールをねらう' },
  { id: 'yukimi', name: 'ユキミ', type: 'テクニック型', size: 0.93, body: 2, spd: 3, jmp: 4, kck: 3, sup: 'ice', mass: 0.9,
    skin: '#FFE2D2', hair: '#BFE6FF', hair2: '#FFFFFF', look: 'bob', blurb: '小がらで身軽。ジャンプもキックもそこそこ' },
  { id: 'gorou', name: 'ゴロウ', type: 'パワー型', size: 1.07, body: 4, spd: 2, jmp: 2, kck: 5, sup: 'thunder', mass: 1.3,
    skin: '#F2C79A', hair: '#5B4A7A', hair2: '#FFD21E', look: 'cloud', blurb: 'キックはいちばん強い。でも足はおそい' },
  { id: 'kagemaru', name: 'カゲマル', type: 'スピード型', size: 0.9, body: 2, spd: 5, jmp: 3, kck: 3, sup: 'clone', mass: 0.85,
    skin: '#F5CDA8', hair: '#2B3245', hair2: '#C8CED9', look: 'ninja', blurb: 'だれよりも速い。体が小さく、キックは弱め' },
  { id: 'dosukoi', name: 'ドスコイ', type: '巨漢', size: 1.18, body: 5, spd: 1, jmp: 1, kck: 4, sup: 'giant', mass: 1.8,
    skin: '#F8CFA6', hair: '#1E1E24', hair2: '#1E1E24', look: 'sumo', blurb: '頭がいちばん大きく、ゴール前のかべ。とてもおそい' },
  { id: 'popo', name: 'ポポ', type: 'ジャンプ型', size: 0.85, body: 1, spd: 4, jmp: 5, kck: 2, sup: 'ghost', mass: 0.7, floaty: 0.84,
    skin: '#EEF0FF', hair: '#C7B8FF', hair2: '#FF8FB8', look: 'ghost', blurb: 'いちばん小さく、ふわっと高くとぶ。キックは弱い' },
  { id: 'robota', name: 'ロボ太', type: '守備型', size: 1.1, body: 4, spd: 2, jmp: 3, kck: 3, sup: 'rocket', mass: 1.5,
    skin: '#B9C6D6', hair: '#6F8196', hair2: '#45E0FF', look: 'robot', blurb: '大きくて重い。当たり負けしない守りの名人' },
  { id: 'fuuta', name: 'フウタ', type: 'スピード＆ジャンプ', size: 0.94, body: 2, spd: 4, jmp: 4, kck: 3, sup: 'wind', mass: 0.9,
    skin: '#FFD8B8', hair: '#39B36B', hair2: '#9CF0B8', look: 'wind', blurb: '速さとジャンプのいいとこどり。キックは軽め' },
  { id: 'sakashita', name: '坂下', type: 'クセ者', size: 1.04, body: 3, spd: 3, jmp: 3, kck: 4, sup: 'dazzle', mass: 1,
    skin: '#F3CFAE', hair: '#1D1A21', hair2: '#3B3542', look: 'shades', blurb: 'まんまるサングラスの、つかみどころのない男。キックは強め' },
  { id: 'murohashi', name: '室橋', type: '司令塔', size: 1.0, body: 3, spd: 4, jmp: 3, kck: 3, sup: 'ramen', mass: 1,
    skin: '#F6D3B6', hair: '#1A1A1F', hair2: '#34343D', look: 'center', blurb: 'センターパートのクールな司令塔。チームを元気にする' },
];
const CHAR_IDX = Object.fromEntries(CHARS.map((c, i) => [c.id, i]));

// armed: the super waits for this player's next touch of the ball. instant: happens at once
const SUPERS = {
  fire:    { name: 'ばくねつシュート', icon: '🔥', armed: true,  desc: '次にさわったボールが火の玉になって、まっすぐ相手ゴールへ。当たった相手はふっとぶ' },
  ice:     { name: 'こちこちシュート', icon: '❄️', armed: true,  desc: '次にさわったボールが氷の玉に。最初に当たった相手がこおって動けなくなる' },
  thunder: { name: 'かみなりドーン',   icon: '⚡', armed: false, desc: '相手チーム全員にカミナリ。しばらくしびれて動けない' },
  clone:   { name: 'ぶんしんボール',   icon: '🥷', armed: true,  desc: '次にさわったボールが3つにふえる。本物は1つだけ' },
  giant:   { name: 'でかでかヘッド',   icon: '💪', armed: false, desc: '8秒間、頭がでっかくなる。ゴールをふさげる' },
  ghost:   { name: 'きえるボール',     icon: '👻', armed: true,  desc: '次にさわったボールが、しばらくほとんど見えなくなる。最初に来た相手の体はすりぬける（キックなら止められる）' },
  rocket:  { name: 'ロケットボール',   icon: '🚀', armed: true,  desc: '次にさわったボールが、相手ゴールを追いかけて飛んでいく' },
  wind:    { name: 'おおかぜ',         icon: '🌀', armed: false, desc: '相手ゴールに向かって大風。相手はおしもどされ、ボールは流される' },
  dazzle:  { name: 'ギラギラサングラス', icon: '😎', armed: false, desc: 'サングラスがピカッ！ 相手チームの左右が4秒間あべこべになる' },
  ramen:   { name: '替え玉パワー',     icon: '🍜', armed: false, desc: 'ラーメンで元気いっぱい！ 味方全員が6秒間、速く高くなりキックも強くなる。味方のゲージもたまる' },
};

// items drop in bubbles; a head or the ball pops them (the ball gives it to whoever touched it last)
const ITEMS = {
  bigball:   { icon: '🏐', name: 'でかボール',   desc: 'ボールが大きくなる', t: 9 },
  smallgoal: { icon: '🛡️', name: 'ちびゴール',   desc: '自分のゴールが小さくなる', t: 9 },
  biggoal:   { icon: '🥅', name: 'でかゴール',   desc: '相手のゴールが大きくなる', t: 9 },
  big:       { icon: '🍄', name: 'でかあたま',   desc: '自分の頭が大きくなる', t: 9 },
  tiny:      { icon: '🐜', name: 'ちびあたま',   desc: '相手の頭が小さくなる', t: 8 },
  dash:      { icon: '👟', name: 'ダッシュ',     desc: '足が速く、ジャンプが高くなる', t: 8 },
  freeze:    { icon: '🧊', name: 'こおりつけ',   desc: '相手がこおる', t: 1.8 },
  charge:    { icon: '🔋', name: 'パワー満タン', desc: 'スーパーゲージが満タン', t: 0 },
  float:     { icon: '🎈', name: 'ふわふわ',     desc: 'ボールがふわふわになる', t: 8 },
};
const ITEM_KEYS = Object.keys(ITEMS);

const STADIUMS = {
  day:    { name: 'ひる',   sky: ['#5DB8FF', '#BEE6FF'], grass: ['#53B848', '#47A63D'], stand: '#3B4A63', light: 0 },
  sunset: { name: 'ゆうがた', sky: ['#FF7E5F', '#FFD08A'], grass: ['#4FA544', '#3F9137'], stand: '#3E3550', light: 0.35 },
  night:  { name: 'よる',   sky: ['#0B1638', '#28407A'], grass: ['#3E9E46', '#33893B'], stand: '#1B2033', light: 1 },
};
const STADIUM_KEYS = Object.keys(STADIUMS);

const CPU_LV = {
  easy:   { name: 'よわい', react: 0.30, err: 46, jumpErr: 0.14, kickRange: 0.75, superUse: 0.35, speed: 0.86, fooled: 0.75, adapt: 1.5, spot: 0.25 },
  normal: { name: 'ふつう', react: 0.16, err: 22, jumpErr: 0.07, kickRange: 0.92, superUse: 0.8, speed: 0.96, fooled: 0.6, adapt: 0.9, spot: 0.4 },
  hard:   { name: 'つよい', react: 0.07, err: 8,  jumpErr: 0.02, kickRange: 1.0,  superUse: 1, speed: 1, fooled: 0.45, adapt: 0.55, spot: 0.55 },
};

// ---- small helpers ----
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sign = v => v < 0 ? -1 : 1;
const TAU = Math.PI * 2;
// seeded random (mulberry32), so a match can be replayed in tests
function mkRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
