'use strict';
// ===================================================================
//  ゴッツンサッカー — data: the field, the characters, their supers, items
//  (no DOM here: data.js + engine.js + ai.js also run in Node for tests)
// ===================================================================

const GAME_VER = 1;
const NET_V = 2;

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
const GAUGE_CONCEDE = 0.18;
const HIT_STUN = 2.6;       // knocked down this long when the health runs out
const HOT_T = 6;           // まっかっかヘッド
const DRUNK_T = 5;
const PRESENT_T = 4.6;     // 冷徹プレゼン: the slides are up this long (the meteors fall in the middle of it)         // のめのめ攻撃: tipsy this long
const MUSCLE_T = 7;        // ムキムキうで lasts this long (the first part is the flex)
const FIST_R = 0.4;        // the muscle fist, in head radii// ... for the team that let a goal in

const TEAM_COL = [
  { main: '#E5322D', deep: '#A11C19', light: '#FF8A7A', name: 'あか', en: 'RED' },
  { main: '#2D6BE5', deep: '#173F9A', light: '#86AEFF', name: 'あお', en: 'BLUE' },
];

// stat (1..5) to physics: wide steps, so every character plays differently
const spdOf = s => 270 + 72 * s;        // run speed, px/s: 342 .. 630
const jmpOf = s => 760 + 104 * s;       // take-off speed: 864 .. 1280 (jump 146 .. 321 px)
const kckOf = s => 850 + 165 * s;       // kick speed: 1015 .. 1675

// ---- characters (all original) ----
// size: head size (1 = normal). A big head blocks and heads more, a small one is quick and light.
// body: the same as pips for the menus. look: what art.js draws on the head. sup: the super (SUPERS)
const CHARS = [
  { id: 'rekka', name: 'レッカ', type: 'バランス型', size: 1.0, body: 3, spd: 3, jmp: 3, kck: 4, sup: 'fire', mass: 1,
    skin: '#FFD3B0', hair: '#E8361E', hair2: '#FFB21E', look: 'spiky', blurb: 'なんでもこなす。必殺の火の玉でゴールをねらう' },
  { id: 'yukimi', name: 'ユキミ', type: 'テクニック型', size: 0.88, body: 2, spd: 3, jmp: 5, kck: 2, sup: 'ice', mass: 0.85,
    skin: '#FFE2D2', hair: '#BFE6FF', hair2: '#FFFFFF', look: 'bob', blurb: '小がらで身軽。ジャンプはとても高いけれど、キックは弱め' },
  { id: 'gorou', name: 'ゴロウ', type: 'パワー型', size: 1.05, body: 4, spd: 2, jmp: 1, kck: 5, sup: 'thunder', mass: 1.4,
    skin: '#F2C79A', hair: '#5B4A7A', hair2: '#FFD21E', look: 'cloud', blurb: 'キックはいちばん強い。でも足はおそく、ジャンプも低い' },
  { id: 'kagemaru', name: 'カゲマル', type: 'スピード型', size: 0.86, body: 2, spd: 5, jmp: 4, kck: 3, sup: 'clone', mass: 0.8,
    skin: '#F5CDA8', hair: '#2B3245', hair2: '#C8CED9', look: 'ninja', blurb: 'だれよりも速い。体は小さいけれど、ジャンプもそこそこ' },
  { id: 'dosukoi', name: 'ドスコイ', type: '巨漢', size: 1.28, body: 5, spd: 1, jmp: 1, kck: 3, sup: 'giant', mass: 2,
    skin: '#F8CFA6', hair: '#1E1E24', hair2: '#1E1E24', look: 'sumo', blurb: '頭がいちばん大きく、ゴール前のかべ。とてもおそい' },
  { id: 'popo', name: 'ポポ', type: 'ジャンプ型', size: 0.8, body: 1, spd: 4, jmp: 5, kck: 2, sup: 'ghost', mass: 0.7, floaty: 0.8,
    skin: '#EEF0FF', hair: '#C7B8FF', hair2: '#FF8FB8', look: 'ghost', blurb: 'いちばん小さく、ふわっと高くとぶ。キックは弱い' },
  { id: 'robota', name: 'ロボ太', type: '守備型', size: 1.14, body: 4, spd: 2, jmp: 2, kck: 3, sup: 'rocket', mass: 1.8,
    skin: '#B9C6D6', hair: '#6F8196', hair2: '#45E0FF', look: 'robot', blurb: '大きくて重い。当たり負けしない守りの名人' },
  { id: 'fuuta', name: 'フウタ', type: 'スピード＆ジャンプ', size: 0.92, body: 2, spd: 4, jmp: 4, kck: 3, sup: 'wind', mass: 0.9,
    skin: '#FFD8B8', hair: '#39B36B', hair2: '#9CF0B8', look: 'wind', blurb: '速さとジャンプのいいとこどり。キックは軽め' },
  { id: 'sakashita', name: '坂下', type: 'クセモノ', size: 1.12, body: 4, spd: 3, jmp: 2, kck: 4, sup: 'muscle', mass: 1.6,
    skin: '#F3CFAE', hair: '#1D1A21', hair2: '#3B3542', look: 'shades', blurb: '年齢不明のごつい少年' },
  { id: 'murohashi', name: '室橋', type: '冷徹パワポ', size: 1.0, body: 3, spd: 5, jmp: 3, kck: 4, sup: 'slide', mass: 1,
    skin: '#F6D3B6', hair: '#1A1A1F', hair2: '#34343D', look: 'center', blurb: 'いじり方をミスるとキレるので要注意' },
  { id: 'yuuki', name: 'ゆうき', type: 'クール', size: 0.95, leg: 2.7, limbs: true, body: 3, spd: 3, jmp: 1, kck: 3, sup: 'stretch', mass: 0.9,
    skin: '#F4D5BC', hair: '#E3C07A', hair2: '#6E4E30', look: 'longhair', blurb: '金髪でクールな手足長男' },
  { id: 'kitahara', name: '北原', type: 'タマル', size: 1.04, body: 3, spd: 3, jmp: 3, kck: 3, sup: 'hot', mass: 1.1,
    skin: '#F2CDAE', hair: '#17171C', hair2: '#3A3A44', look: 'curtain', blurb: '実は器用で何でも無難にこなせるタイプ' },
  { id: 'masato', name: 'まさと', type: 'イケメン', size: 1.0, body: 3, spd: 4, jmp: 3, kck: 3, sup: 'drink', mass: 1, beer: true,
    skin: '#F3D2B8', hair: '#141418', hair2: '#383842', look: 'masato', blurb: 'テニサーの長。お酒を手にすると。。。' },
];
const CHAR_IDX = Object.fromEntries(CHARS.map((c, i) => [c.id, i]));

// armed: the super waits for this player's next touch of the ball. instant: happens at once
const SUPERS = {
  fire:    { name: 'ばくねつシュート', icon: '🔥', armed: true,  desc: '次にさわったボールが火の玉になって、まっすぐ相手ゴールへ。当たった相手はふっとぶ' },
  ice:     { name: 'こちこちシュート', icon: '❄️', armed: true,  desc: '次にさわったボールが氷の玉に。最初に当たった相手がこおって動けなくなる' },
  thunder: { name: 'かみなりドーン',   icon: '⚡', armed: false, desc: '相手チーム全員にカミナリ。しばらくしびれて動けない' },
  clone:   { name: 'ぶんしんボール',   icon: '🥷', armed: true,  desc: '次にさわったボールが3つにふえる。本物は1つだけ' },
  giant:   { name: 'でかでかヘッド',   icon: '🗿', armed: false, desc: '8秒間、頭がでっかくなる。ゴールをふさげる' },
  ghost:   { name: 'きえるボール',     icon: '👻', armed: true,  desc: '次にさわったボールが、しばらくほとんど見えなくなる。最初に来た相手の体はすりぬける（キックなら止められる）' },
  rocket:  { name: 'ロケットボール',   icon: '🚀', armed: true,  desc: '次にさわったボールが、相手ゴールを追いかけて飛んでいく' },
  wind:    { name: 'おおかぜ',         icon: '🌀', armed: false, desc: '相手ゴールに向かって大風。相手はおしもどされ、ボールは流される' },
  dazzle:  { name: 'ギラギラサングラス', icon: '😎', armed: false, desc: 'サングラスがピカッ！ 相手チームの左右が4秒間あべこべになる' },
  slide:   { name: '冷徹プレゼン',     icon: '📊', armed: false, desc: 'パワポを発動！ 冷徹な顔でスライドを見せつけると、相手チームの上に流星群がふりそそぐ' },
  drink:   { name: 'のめのめ攻撃',     icon: '🍺', armed: false, desc: '相手チーム全員にビールをのませる！ のまされた相手は5秒間よっぱらってフラフラ' },
  hot:     { name: 'まっかっかヘッド', icon: '🥵', armed: false, desc: '顔が真っ赤に！ 6秒間、頭がアツアツになって、当たったボールはロケットみたいに飛んでいく。さわった相手は「あちっ！」' },
  muscle:  { name: 'ムキムキうで',     icon: '💪', armed: false, desc: '7秒間、うでがムキムキに！ キックボタンでパンチ。ボールをはじき返し、当たった相手には大ダメージ' },
  stretch: { name: 'ぐーんとのっぽ',   icon: '🦒', armed: false, desc: '7秒間、手足がぐーんとのびて背が高くなる。高いボールにとどき、ゴール前のかべにもなる' },
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
