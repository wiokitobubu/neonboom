/* ==========================================================================
   NEON BOOM — all sound is synthesised live with the Web Audio API.
   No audio files: sound effects + a procedural synthwave soundtrack.
   ========================================================================== */
(function (NB) {
  'use strict';

  var A = NB.audio = {};
  var ctx = null, master, comp, sfxBus, musicBus, musicFilter, arpBus, delay, delayFb, reverbIn;
  var noiseBuf = null;
  var sfxOn = true, musicOn = true, musicRunning = false;
  var timer = null, nextTime = 0, step = 0, mode = 'menu';

  // Pentatonic minor on A: gives every merge a note that sounds good with the others.
  var PENTA = [0, 3, 5, 7, 10];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function pentaNote(i, base) {
    var oct = Math.floor(i / PENTA.length), deg = i % PENTA.length;
    return mtof((base || 57) + oct * 12 + PENTA[deg]);
  }

  function makeNoise(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function makeImpulse(seconds, decay) {
    var len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  A.init = function () {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; }

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(comp); comp.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);

    var reverb = ctx.createConvolver(); reverb.buffer = makeImpulse(1.6, 2.6); // shorter tail: ~1/3 less audio CPU on phones
    reverbIn = ctx.createGain(); reverbIn.gain.value = 0.32;
    reverbIn.connect(reverb); reverb.connect(master);

    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 900; musicFilter.Q.value = 0.6;
    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    musicBus.connect(musicFilter); musicFilter.connect(master);
    var musicVerb = ctx.createGain(); musicVerb.gain.value = 0.35; musicFilter.connect(musicVerb); musicVerb.connect(reverbIn);

    // Arp goes through a dotted-eighth delay: the classic synthwave shimmer.
    arpBus = ctx.createGain(); arpBus.gain.value = 1;
    delay = ctx.createDelay(1.5); delay.delayTime.value = (60 / 96) * 0.75;
    delayFb = ctx.createGain(); delayFb.gain.value = 0.38;
    var delayTone = ctx.createBiquadFilter(); delayTone.type = 'lowpass'; delayTone.frequency.value = 2400;
    arpBus.connect(musicBus); arpBus.connect(delay); delay.connect(delayTone); delayTone.connect(delayFb); delayFb.connect(delay); delayTone.connect(musicBus);

    noiseBuf = makeNoise(2);
    return true;
  };

  A.unlock = function () {
    if (!A.init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (musicOn && !musicRunning) startMusic();
  };
  A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  A.setSfx = function (on) {
    sfxOn = !!on;
    if (sfxBus) sfxBus.gain.setTargetAtTime(sfxOn ? 1 : 0, ctx.currentTime, 0.02);
  };
  A.setMusic = function (on) {
    musicOn = !!on;
    if (!ctx) return;
    if (musicOn) { if (!musicRunning) startMusic(); }
    else stopMusic();
  };
  A.setMode = function (m) {
    mode = m;
    if (!ctx) return;
    var f = m === 'game' ? 5200 : m === 'over' ? 420 : 950;
    musicFilter.frequency.setTargetAtTime(f, ctx.currentTime, m === 'over' ? 0.25 : 0.6);
  };

  /* ---------------- voices ---------------- */
  function tone(o) {
    var now = ctx.currentTime + (o.t || 0), dur = o.dur || 0.2, att = o.a || 0.005;
    var osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, now);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), now + (o.glide || dur));
    if (o.detune) osc.detune.value = o.detune;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, now + att);
    if (o.hold) g.gain.setValueAtTime(o.vol || 0.2, now + att + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    var node = osc;
    if (o.filter) {
      var fl = ctx.createBiquadFilter();
      fl.type = o.filter.type || 'lowpass';
      fl.frequency.setValueAtTime(o.filter.f, now);
      if (o.filter.f2) fl.frequency.exponentialRampToValueAtTime(o.filter.f2, now + dur);
      fl.Q.value = o.filter.q || 0.8;
      osc.connect(fl); node = fl;
    }
    node.connect(g);
    g.connect(o.bus || sfxBus);
    if (o.rev) { var s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(reverbIn); }
    osc.start(now); osc.stop(now + dur + 0.05);
  }
  function noise(o) {
    var now = ctx.currentTime + (o.t || 0), dur = o.dur || 0.2;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf;
    var fl = ctx.createBiquadFilter();
    fl.type = (o.filter && o.filter.type) || 'lowpass';
    fl.frequency.setValueAtTime((o.filter && o.filter.f) || 2000, now);
    if (o.filter && o.filter.f2) fl.frequency.exponentialRampToValueAtTime(o.filter.f2, now + dur);
    fl.Q.value = (o.filter && o.filter.q) || 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.1, now + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(fl); fl.connect(g); g.connect(o.bus || sfxBus);
    if (o.rev) { var s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(reverbIn); }
    src.start(now, Math.random() * 1.2); src.stop(now + dur + 0.05);
  }

  /* ---------------- sound effects ---------------- */
  var SFX = {
    drop: function (p) {
      var tier = (p && p.tier) || 0;
      tone({ type: 'sine', f: 420 - tier * 38, f2: 120, dur: 0.16, vol: 0.22 });
      noise({ dur: 0.04, vol: 0.05, filter: { type: 'highpass', f: 3500 } });
    },
    merge: function (p) {
      var tier = p.tier || 1, combo = Math.min(6, (p.combo || 1) - 1);
      var f = pentaNote(tier + combo, 57);
      tone({ type: 'sine', f: f * 0.5, f2: f, glide: 0.06, dur: 0.12, vol: 0.18 });
      tone({ type: 'triangle', f: f, dur: 0.42, vol: 0.2, rev: 0.35 });
      tone({ type: 'sine', f: f * 2, dur: 0.6, vol: 0.08, rev: 0.4, t: 0.01 });
      if (tier >= 5) {
        tone({ type: 'sawtooth', f: f, dur: 0.8, vol: 0.05, detune: 9, filter: { f: 3200, f2: 500 }, rev: 0.5 });
        tone({ type: 'sawtooth', f: f, dur: 0.8, vol: 0.05, detune: -9, filter: { f: 3200, f2: 500 }, rev: 0.5 });
        tone({ type: 'sine', f: 90, f2: 45, dur: 0.35, vol: 0.28 });
      }
    },
    combo: function (p) {
      var n = Math.min(8, p.combo || 2);
      for (var i = 0; i < 3; i++) tone({ type: 'square', f: pentaNote(n + i * 2, 69), dur: 0.12, vol: 0.045, t: i * 0.055, filter: { f: 2800 }, rev: 0.3 });
    },
    boom: function () {
      noise({ dur: 1.8, vol: 0.55, a: 0.005, filter: { type: 'lowpass', f: 7000, f2: 120 }, rev: 0.5 });
      tone({ type: 'sine', f: 120, f2: 26, dur: 1.5, vol: 0.75 });
      tone({ type: 'sawtooth', f: mtof(45), dur: 1.6, vol: 0.12, filter: { f: 4000, f2: 200 }, rev: 0.6 });
      tone({ type: 'sawtooth', f: mtof(52), dur: 1.6, vol: 0.1, filter: { f: 4000, f2: 200 }, rev: 0.6 });
      [0, 3, 7, 12, 15, 19].forEach(function (s, i) { tone({ type: 'triangle', f: mtof(69 + s), dur: 0.5, vol: 0.06, t: 0.35 + i * 0.07, rev: 0.6 }); });
    },
    warn: function () {
      tone({ type: 'square', f: 880, dur: 0.07, vol: 0.05, filter: { f: 2400 } });
      tone({ type: 'square', f: 660, dur: 0.07, vol: 0.05, t: 0.09, filter: { f: 2400 } });
    },
    over: function () {
      tone({ type: 'sawtooth', f: 440, f2: 50, dur: 1.4, vol: 0.2, filter: { f: 3000, f2: 150 }, rev: 0.5 });
      tone({ type: 'sawtooth', f: 445, f2: 52, dur: 1.4, vol: 0.15, filter: { f: 3000, f2: 150 } });
      noise({ dur: 0.9, vol: 0.2, filter: { type: 'bandpass', f: 1800, f2: 200, q: 1.2 } });
      tone({ type: 'sine', f: 70, f2: 30, dur: 1.0, vol: 0.4 });
    },
    click: function () { tone({ type: 'sine', f: 1500, f2: 900, dur: 0.06, vol: 0.09 }); },
    open: function () { noise({ dur: 0.28, vol: 0.07, filter: { type: 'bandpass', f: 500, f2: 3500, q: 1.5 } }); },
    start: function () {
      noise({ dur: 0.6, vol: 0.09, filter: { type: 'bandpass', f: 300, f2: 5000, q: 2 }, rev: 0.4 });
      tone({ type: 'sine', f: 220, f2: 880, dur: 0.5, vol: 0.12, rev: 0.4 });
    },
    unlock: function () {
      [0, 4, 7, 12, 16].forEach(function (s, i) {
        tone({ type: 'triangle', f: mtof(72 + s), dur: 0.35, vol: 0.08, t: i * 0.07, rev: 0.5 });
        tone({ type: 'sine', f: mtof(84 + s), dur: 0.3, vol: 0.03, t: i * 0.07 + 0.02 });
      });
    },
    best: function () {
      [0, 7, 12, 19].forEach(function (s, i) { tone({ type: 'square', f: mtof(64 + s), dur: 0.2, vol: 0.05, t: i * 0.08, filter: { f: 3000 }, rev: 0.4 }); });
    },
    pop: function (p) { tone({ type: 'sine', f: 300 + (p && p.i || 0) * 40, f2: 900, dur: 0.08, vol: 0.06 }); }
  };

  A.play = function (name, params) {
    if (!ctx || !sfxOn || ctx.state !== 'running' || !SFX[name]) return;
    try { SFX[name](params || {}); } catch (e) { /* never break the game for a sound */ }
  };

  /* ---------------- procedural soundtrack: 96 BPM synthwave ---------------- */
  var BPM = 96, SIXTEENTH = 60 / BPM / 4;
  var CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am  F  C  G
  var BASS = [45, 41, 48, 43];
  var ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3];

  function scheduleStep(s, time) {
    var bar = Math.floor(s / 16) % 4, i = s % 16, chord = CHORDS[bar];
    var t = time - ctx.currentTime, inGame = mode === 'game';

    if (i === 0) { // pad
      chord.forEach(function (n) {
        [-7, 7].forEach(function (d) {
          tone({ type: 'sawtooth', f: mtof(n), detune: d, t: t, a: 0.5, hold: SIXTEENTH * 12, dur: SIXTEENTH * 16 + 0.6, vol: 0.022, bus: musicBus, filter: { f: 1100, q: 0.5 } });
        });
      });
    }
    if (i % 2 === 0) { // bass
      var root = BASS[bar] + ((i === 6 || i === 14) ? 12 : 0);
      tone({ type: 'sawtooth', f: mtof(root), t: t, dur: SIXTEENTH * 1.7, vol: inGame ? 0.075 : 0.045, bus: musicBus, filter: { f: 700, f2: 260, q: 2 } });
    }
    var notes = chord.map(function (n) { return n + 12; }).concat([chord[0] + 24, chord[1] + 24]);
    tone({ type: 'triangle', f: mtof(notes[ARP[i]]), t: t, dur: SIXTEENTH * 1.4, vol: 0.04, bus: arpBus });
    if (inGame) {
      if (i % 8 === 0) tone({ type: 'sine', f: 140, f2: 42, glide: 0.12, t: t, dur: 0.3, vol: 0.32, bus: musicBus });
      if (i % 4 === 2) noise({ t: t, dur: 0.035, vol: 0.022, filter: { type: 'highpass', f: 7500 }, bus: musicBus });
      if (i === 4 || i === 12) noise({ t: t, dur: 0.16, vol: 0.05, filter: { type: 'bandpass', f: 1800, q: 0.9 }, bus: musicBus });
    }
  }
  function scheduler() {
    if (!ctx || ctx.state !== 'running') return;
    if (nextTime < ctx.currentTime - 0.25) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.14) {
      scheduleStep(step, nextTime);
      nextTime += SIXTEENTH; step++;
    }
  }
  function startMusic() {
    if (!ctx || musicRunning) return;
    musicRunning = true;
    nextTime = ctx.currentTime + 0.08; step = 0;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0.55, ctx.currentTime, 0.8);
    A.setMode(mode);
    timer = setInterval(scheduler, 30);
  }
  function stopMusic() {
    if (!musicRunning) return;
    musicRunning = false;
    clearInterval(timer); timer = null;
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  }

  A.applySettings = function (s) { A.setSfx(s.sfx); A.setMusic(s.music); };
  sfxOn = NB.profile.settings.sfx; musicOn = NB.profile.settings.music;
})(window.NB);
