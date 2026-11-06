// ===================================================================
//  sound: everything is synthesized (no files). A crowd murmur during
//  matches, a short stadium tune in the menus.
// ===================================================================
const Sound = (() => {
  let ac = null, master = null, sfxBus = null, bgmBus = null, noiseBuf = null, crowdG = null, crowdF = null;
  const st = { sfx: true, bgm: true };
  try { const v = JSON.parse(localStorage.getItem('gottsun-sound') || '{}'); if (v.sfx === false) st.sfx = false; if (v.bgm === false) st.bgm = false; } catch (e) {}

  // iPhones mute Web Audio on the silent switch unless the page says it plays media
  let silentEl = null;
  function silentWav() {
    const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
    let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  function playAsMedia() {
    try { const as = navigator.audioSession; if (as && 'type' in as) { if (as.type !== 'playback') as.type = 'playback'; return; } } catch (e) {}
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios) return;
    try {
      if (!silentEl) { silentEl = document.createElement('audio'); silentEl.src = silentWav(); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); }
      if (silentEl.paused) { const p = silentEl.play(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) {}
  }
  function ensure() {
    try {
      playAsMedia();
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ac = new AC();
        master = ac.createGain(); master.gain.value = 0.85; master.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.gain.value = st.sfx ? 0.7 : 0; sfxBus.connect(master);
        bgmBus = ac.createGain(); bgmBus.gain.value = st.bgm ? 0.22 : 0; bgmBus.connect(master);
        const len = Math.floor(ac.sampleRate * 1.5);
        noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // the crowd: a quiet murmur that swells
        const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        crowdF = ac.createBiquadFilter(); crowdF.type = 'bandpass'; crowdF.frequency.value = 650; crowdF.Q.value = 0.6;
        crowdG = ac.createGain(); crowdG.gain.value = 0;
        src.connect(crowdF); crowdF.connect(crowdG); crowdG.connect(sfxBus); src.start();
        crowdG.gain.value = S._crowdBase || 0;
        if (bgmOn) { bgmT = ac.currentTime + 0.1; bgmStep = 0; clearTimeout(bgmTimer); sched(); }
      }
      if (ac.state !== 'running') {
        const p = ac.resume(); if (p && p.catch) p.catch(() => {});
        try { const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0); } catch (e) {}
      }
      return true;
    } catch (e) { return false; }
  }
  const unlock = () => { if (!ac || ac.state !== 'running' || (silentEl && silentEl.paused)) ensure(); };
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) window.addEventListener(ev, unlock, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ac && ac.state !== 'running') { try { ac.resume().catch(() => {}); } catch (e) {} } });

  function tone(o) {
    if (!ac || !st.sfx && !o.bgm) return;
    const t0 = ac.currentTime + (o.at || 0), d = o.d || 0.1;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + (o.glide || d));
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibD || o.f * 0.03; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + d + 0.05); }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v || 0.2, t0 + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(o.bgm ? bgmBus : sfxBus);
    osc.start(t0); osc.stop(t0 + d + 0.05);
  }
  function noise(o) {
    if (!ac || !st.sfx) return;
    const t0 = ac.currentTime + (o.at || 0), d = o.d || 0.1;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t0); f.Q.value = o.q || 1;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v || 0.2, t0 + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + d + 0.05);
  }
  const lim = {};
  function rate(k, gap) { const now = ac ? ac.currentTime : 0; if (lim[k] && now - lim[k] < gap) return false; lim[k] = now; return true; }

  const S = {
    kick(v) { const k = clamp((v || 1200) / 1500, 0.4, 1.2); tone({ f: 150, f2: 45, d: 0.16, v: 0.5 * k, type: 'sine' }); noise({ f: 2400, d: 0.05, v: 0.22 * k, q: 0.8 }); },
    head(v) { if (!rate('head', 0.05)) return; const k = clamp((v || 600) / 900, 0.3, 1); tone({ f: 260, f2: 520, d: 0.12, v: 0.22 * k, type: 'triangle', glide: 0.05 }); tone({ f: 110, f2: 60, d: 0.1, v: 0.3 * k }); },
    bounce(v) { if (!rate('bounce', 0.04)) return; const k = clamp((v || 300) / 900, 0.15, 1); tone({ f: 95, f2: 55, d: 0.09, v: 0.3 * k }); },
    post() { if (!rate('post', 0.08)) return; tone({ f: 620, d: 0.35, v: 0.16, type: 'square' }); tone({ f: 935, d: 0.28, v: 0.1, type: 'triangle' }); noise({ f: 3000, d: 0.06, v: 0.12 }); },
    whistle(n) {
      const blow = (at, d) => { tone({ f: 2900, d, v: 0.14, type: 'sine', vib: 38, vibD: 160, at, a: 0.01 }); tone({ f: 3500, d, v: 0.05, type: 'sine', vib: 38, vibD: 160, at, a: 0.01 }); };
      if (n === 3) { blow(0, 0.35); blow(0.45, 0.35); blow(0.9, 0.9); }
      else if (n === 2) { blow(0, 0.3); blow(0.4, 0.7); }
      else blow(0, n === 1 ? 0.28 : 0.5);
    },
    goal() {
      for (const [f, at] of [[262, 0], [330, 0], [392, 0], [523, 0.22]]) tone({ f, d: 1.1, v: 0.09, type: 'sawtooth', at, a: 0.04 });
      noise({ ft: 'lowpass', f: 700, f2: 1500, d: 2.6, v: 0.32, a: 0.25 });
      noise({ ft: 'bandpass', f: 1800, d: 1.6, v: 0.08, a: 0.2, at: 0.2 });
      this.crowdSwell(1);
    },
    count(n) { tone({ f: n ? 880 : 1320, d: n ? 0.14 : 0.35, v: 0.18, type: 'square' }); },
    super(kind) { tone({ f: 220, f2: 1400, d: 0.45, v: 0.12, type: 'sawtooth' }); for (let i = 0; i < 4; i++) tone({ f: 1200 + i * 300, d: 0.15, v: 0.06, at: 0.1 + i * 0.06 }); },
    shot(kind) {
      if (kind === 'fire') noise({ ft: 'bandpass', f: 400, f2: 2600, d: 0.6, v: 0.35, q: 0.7 });
      else if (kind === 'ice') { for (let i = 0; i < 5; i++) tone({ f: 1800 + i * 260, d: 0.2, v: 0.07, at: i * 0.04 }); }
      else if (kind === 'rocket') { noise({ ft: 'lowpass', f: 900, f2: 300, d: 1.1, v: 0.3 }); tone({ f: 90, f2: 160, d: 0.8, v: 0.12, type: 'sawtooth' }); }
      else if (kind === 'ghost') tone({ f: 520, f2: 760, d: 0.9, v: 0.1, vib: 7, vibD: 30 });
      else if (kind === 'clone') { noise({ f: 900, d: 0.25, v: 0.2 }); tone({ f: 700, d: 0.1, v: 0.08, at: 0.05 }); tone({ f: 1050, d: 0.1, v: 0.08, at: 0.12 }); }
    },
    bolt() { noise({ ft: 'lowpass', f: 5000, f2: 160, d: 0.9, v: 0.45 }); tone({ f: 60, f2: 30, d: 0.6, v: 0.3, type: 'sawtooth' }); },
    giant() { tone({ f: 140, f2: 340, d: 0.5, v: 0.22, type: 'triangle', vib: 12, vibD: 20 }); },
    wind() { noise({ ft: 'bandpass', f: 300, f2: 1100, d: 1.6, v: 0.3, q: 0.5, a: 0.2 }); },
    dazzle() { for (let i = 0; i < 6; i++) tone({ f: 1400 + i * 380, d: 0.18, v: 0.06, at: i * 0.035, type: 'triangle' }); tone({ f: 300, f2: 2400, d: 0.35, v: 0.06, type: 'sine' }); },
    stretch() { tone({ f: 260, f2: 1300, d: 0.7, v: 0.12, type: 'sine', vib: 6, vibD: 25 }); tone({ f: 520, f2: 2000, d: 0.5, v: 0.05, type: 'triangle', at: 0.15 }); },
    cheers() { for (const [f, at] of [[2093, 0], [2637, 0.05], [3136, 0.1]]) tone({ f, d: 0.25, v: 0.07, at, type: 'triangle' }); tone({ f: 523, d: 0.2, v: 0.08, at: 0.2, type: 'square' }); tone({ f: 659, d: 0.3, v: 0.08, at: 0.32, type: 'square' }); },
    hic() { if (!rate('hic', 0.2)) return; tone({ f: 420, f2: 900, d: 0.12, v: 0.1, type: 'triangle' }); },
    boil() { noise({ ft: 'bandpass', f: 700, f2: 2400, d: 0.6, v: 0.25, q: 0.8 }); tone({ f: 200, f2: 900, d: 0.45, v: 0.12, type: 'sawtooth' }); },
    sizzle() { if (!rate('sizzle', 0.08)) return; noise({ ft: 'highpass', f: 2500, d: 0.25, v: 0.18 }); tone({ f: 500, f2: 1400, d: 0.15, v: 0.06, type: 'triangle' }); },
    flex() { tone({ f: 180, f2: 420, d: 0.25, v: 0.16, type: 'square' }); tone({ f: 523, d: 0.18, v: 0.08, type: 'triangle', at: 0.12 }); tone({ f: 784, d: 0.3, v: 0.08, type: 'triangle', at: 0.22 }); },
    punch() { noise({ ft: 'lowpass', f: 1400, f2: 200, d: 0.22, v: 0.42 }); tone({ f: 160, f2: 55, d: 0.25, v: 0.3, type: 'square' }); },
    hit(big) { noise({ ft: 'bandpass', f: big ? 900 : 1300, d: 0.1, v: big ? 0.35 : 0.25, q: 1.2 }); tone({ f: big ? 220 : 330, f2: big ? 80 : 140, d: 0.14, v: 0.18, type: 'square' }); },
    ko() { for (let i = 0; i < 4; i++) tone({ f: 1320 - i * 180, d: 0.12, v: 0.08, at: i * 0.11, type: 'triangle' }); tone({ f: 200, f2: 70, d: 0.5, v: 0.18, type: 'sawtooth' }); },
    slip() { tone({ f: 900, f2: 380, d: 0.4, v: 0.09, vib: 9, vibD: 40 }); },
    ramen() {
      if (!rate('ramen', 0.15)) return;
      tone({ f: 523, d: 0.12, v: 0.1, type: 'triangle' }); tone({ f: 659, d: 0.12, v: 0.1, type: 'triangle', at: 0.09 });
      tone({ f: 784, d: 0.25, v: 0.1, type: 'triangle', at: 0.18 }); noise({ ft: 'lowpass', f: 1200, f2: 600, d: 0.5, v: 0.08, at: 0.05 });
    },
    freeze() { noise({ f: 4200, d: 0.12, v: 0.2 }); for (let i = 0; i < 4; i++) tone({ f: 2200 - i * 220, d: 0.12, v: 0.06, at: 0.04 + i * 0.05 }); },
    knock() { tone({ f: 300, f2: 90, d: 0.25, v: 0.25, type: 'square' }); },
    poof() { if (!rate('poof', 0.05)) return; noise({ f: 700, d: 0.2, v: 0.15, q: 0.7 }); },
    itemIn() { tone({ f: 660, f2: 990, d: 0.12, v: 0.08 }); },
    item() { for (const [f, at] of [[784, 0], [988, 0.07], [1175, 0.14], [1568, 0.21]]) tone({ f, d: 0.16, v: 0.1, at, type: 'triangle' }); },
    clash() { noise({ f: 2600, d: 0.08, v: 0.25 }); tone({ f: 420, d: 0.1, v: 0.12, type: 'square' }); },
    swing() { if (!rate('swing', 0.06)) return; noise({ ft: 'highpass', f: 1800, d: 0.07, v: 0.05 }); },
    jump() { if (!rate('jump', 0.05)) return; tone({ f: 380, f2: 640, d: 0.08, v: 0.05, type: 'triangle' }); },
    land() { if (!rate('land', 0.05)) return; tone({ f: 120, f2: 70, d: 0.06, v: 0.1 }); },
    fizzle() { tone({ f: 500, f2: 180, d: 0.3, v: 0.08, type: 'triangle' }); },
    click() { tone({ f: 900, d: 0.04, v: 0.08, type: 'square' }); },
    join() { tone({ f: 660, d: 0.08, v: 0.12, type: 'square' }); tone({ f: 990, d: 0.12, v: 0.12, type: 'square', at: 0.08 }); },
    nope() { tone({ f: 200, d: 0.12, v: 0.12, type: 'square' }); },
    endWin() { for (const [f, at] of [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]]) tone({ f, d: 0.3, v: 0.12, at, type: 'square' }); },
    crowdSwell(k) {
      if (!ac || !crowdG) return;
      const t = ac.currentTime;
      crowdG.gain.cancelScheduledValues(t);
      crowdG.gain.setValueAtTime(crowdG.gain.value, t);
      crowdG.gain.linearRampToValueAtTime(0.06 + 0.3 * k, t + 0.25);
      crowdG.gain.linearRampToValueAtTime(this._crowdBase || 0, t + 2.8);
    },
    crowd(on) {
      this._crowdBase = on ? 0.05 : 0;
      if (!ac || !crowdG) return;
      const t = ac.currentTime;
      crowdG.gain.cancelScheduledValues(t); crowdG.gain.setValueAtTime(crowdG.gain.value, t);
      crowdG.gain.linearRampToValueAtTime(this._crowdBase, t + 0.6);
    },
  };

  // ---- the menu tune: a short stadium chant over a marching beat ----
  let bgmOn = false, bgmT = 0, bgmStep = 0, bgmTimer = 0;
  const BPM = 132, STEP = 60 / BPM / 2;
  const MEL = [76, 0, 76, 79, 0, 76, 74, 72, 74, 0, 74, 76, 74, 72, 71, 0, 72, 0, 72, 76, 0, 72, 71, 69, 71, 0, 74, 72, 71, 69, 67, 0];
  const BASS = [48, 48, 55, 55, 50, 50, 55, 55, 45, 45, 52, 52, 43, 43, 50, 50];
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function sched() {
    if (!bgmOn || !ac) return;
    while (bgmT < ac.currentTime + 0.25) {
      const at = bgmT - ac.currentTime, i = bgmStep % 32;
      const m = MEL[i];
      if (m) tone({ f: midi(m), d: STEP * 0.9, v: 0.18, type: 'square', at: Math.max(0, at), bgm: true, a: 0.01 });
      if (i % 2 === 0) tone({ f: midi(BASS[(i >> 1) % 16]), d: STEP * 1.6, v: 0.26, type: 'triangle', at: Math.max(0, at), bgm: true });
      if (i % 4 === 0 && st.bgm) { const t0 = ac.currentTime + Math.max(0, at); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12); g.gain.setValueAtTime(0.5, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14); o.connect(g); g.connect(bgmBus); o.start(t0); o.stop(t0 + 0.16); }
      if (i % 4 === 2 && st.bgm) { const t0 = ac.currentTime + Math.max(0, at), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 2500; g.gain.setValueAtTime(0.3, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09); s.connect(f); f.connect(g); g.connect(bgmBus); s.start(t0, Math.random()); s.stop(t0 + 0.1); }
      bgmT += STEP; bgmStep++;
    }
    bgmTimer = setTimeout(sched, 90);
  }
  return {
    ensure, sfx: S,
    play(name, a) { if (!ac || !st.sfx) return; const f = S[name]; if (f) try { f.call(S, a); } catch (e) {} },
    bgm(on) {
      if (on === bgmOn) return;
      bgmOn = on; clearTimeout(bgmTimer);
      if (on && ac) { bgmT = ac.currentTime + 0.05; bgmStep = 0; sched(); }
    },
    kickBgm() { if (bgmOn && ac && !bgmTimer) { bgmT = ac.currentTime + 0.05; sched(); } else if (bgmOn && ac) { clearTimeout(bgmTimer); bgmT = Math.max(bgmT, ac.currentTime + 0.05); sched(); } },
    crowd(on) { S.crowd(on); },
    get state() { return { sfx: st.sfx, bgm: st.bgm }; },
    set(k, v) {
      st[k] = v;
      try { localStorage.setItem('gottsun-sound', JSON.stringify(st)); } catch (e) {}
      if (ac) { sfxBus.gain.value = st.sfx ? 0.7 : 0; bgmBus.gain.value = st.bgm ? 0.22 : 0; }
    },
  };
})();
