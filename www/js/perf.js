/* ==========================================================================
   NEON BOOM — performance: keeps the game smooth on every phone.

   · 60 fps cap on 90/120/144 Hz screens: a steady 60 looks smoother than a
     120 that keeps missing frames, and it halves the work.
   · Three quality levels (render resolution, particles, background motes).
     The phone measures its own frame pacing while you play and steps down
     a level when it drops frames. The level is remembered for next time.
   · Settings → PERFORMANCE MODE forces the lightest level.
   · Tap the version number in Settings 5 times: a live FPS meter appears.
   ========================================================================== */
(function (NB) {
  'use strict';

  var LEVELS = [
    { name: 'LOW', res: 1.25, parts: 150, motes: 0 },
    { name: 'MEDIUM', res: 1.6, parts: 300, motes: 12 },
    { name: 'HIGH', res: 2, parts: 520, motes: 26 }
  ];
  var TOP = LEVELS.length - 1;
  var WINDOW = 90;          // frames per verdict (about 1.5 s)
  var SLOW = 1.45;          // a frame is "late" beyond 1.45 × its budget
  var LATE_SHARE = 0.1;     // more than 10 % late frames…
  var BAD_WINDOWS = 2;      // …twice in a row = one level down

  function clampLevel(v) { return Math.max(0, Math.min(TOP, v | 0)); }
  function firstLevel() {
    // first launch: a hint from the hardware, then the phone's own measurements decide
    var mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    if (mem <= 2 || cores <= 2) return 0;
    if (mem <= 3 || cores <= 4) return 1;
    return TOP;
  }

  var saved = NB.store.get('gfx', null);
  var P = NB.perf = {
    LEVELS: LEVELS,
    auto: true,             // the governor may lower the level
    noCap: false,           // tests only: render every display frame
    autoLevel: clampLevel(saved && saved.level != null ? saved.level : firstLevel()),
    vsync: 1000 / 60,       // measured display frame interval, ms
    hz: 60,
    skip: false,            // true on ≥ 100 Hz screens: render every 2nd display frame
    workMs: 0               // smoothed JS time of one game frame
  };

  P.forced = function () { return !!(NB.profile && NB.profile.settings && NB.profile.settings.perf); };
  P.level = function () { return P.forced() ? 0 : P.autoLevel; };
  P.q = function () { return LEVELS[P.level()]; };
  P.res = function () { return Math.min(P.q().res, window.devicePixelRatio || 1); };

  function applyClass() {
    var de = document.documentElement;
    LEVELS.forEach(function (l, i) { de.classList.toggle('gfx-' + l.name.toLowerCase(), i === P.level()); });
  }
  function changed() {
    applyClass();
    holdUntil = performance.now() + 2500;
    win.length = 0; bad = 0;
    NB.bus.emit('quality', P.q());
  }

  /* Settings toggle. */
  P.applySetting = function () {
    if (!P.forced()) { P.autoLevel = Math.max(P.autoLevel, firstLevel()); NB.store.set('gfx', { level: P.autoLevel }); }
    changed();
  };

  /* ---------------- display refresh detection ---------------- */
  var seen = [], detectUntil = 0;
  function detect(t, raw) {
    if (detectUntil === 0) detectUntil = t + 2500;
    if (t > detectUntil) return;
    if (raw > 2 && raw < 40) seen.push(raw);
    if (seen.length >= 30) {
      var s = seen.slice().sort(function (a, b) { return a - b; });
      P.vsync = s[Math.floor(s.length * 0.3)];
      P.hz = Math.round(1000 / P.vsync);
      P.skip = P.vsync < 10.5;
    }
  }

  /* A frame gate. Each animation loop gets its own: returns true when this
     display frame should be drawn. The game's loop (primary) also measures the screen. */
  P.gate = function (primary) {
    var last = 0, prev = 0;
    return function (t) {
      if (typeof t !== 'number') return true;
      if (primary) { detect(t, t - prev); prev = t; }
      if (P.skip && !P.noCap && t - last < P.vsync * 1.5) return false;
      last = t;
      return true;
    };
  };

  /* ---------------- the governor ---------------- */
  var win = [], bad = 0, holdUntil = 0;
  P.sample = function (interval, playing, work) {
    P.workMs += (work - P.workMs) * 0.05;
    if (!playing || !P.auto || P.forced() || document.hidden) { win.length = 0; return; }
    var now = performance.now();
    if (now < holdUntil || interval > 250) return;
    win.push(interval);
    if (win.length < WINDOW) return;
    var budget = P.vsync * (P.skip && !P.noCap ? 2 : 1), late = 0;
    for (var i = 0; i < win.length; i++) if (win[i] > budget * SLOW) late++;
    var share = late / win.length;
    win.length = 0;
    if (share > LATE_SHARE) bad++; else bad = 0;
    if (bad >= BAD_WINDOWS && P.autoLevel > 0) {
      P.autoLevel--;
      NB.store.set('gfx', { level: P.autoLevel });
      console.info('[perf] ' + Math.round(share * 100) + '% late frames → quality ' + LEVELS[P.autoLevel].name);
      changed();
    }
  };
  P.hold = function (ms) { holdUntil = performance.now() + (ms || 2500); win.length = 0; };

  /* ---------------- background: still while playing ---------------- */
  // Animated background layers are redrawn every frame by the phone's GPU.
  // During a run they freeze exactly where they are (no visible jump).
  P.freezeBg = function (on) {
    Array.prototype.forEach.call(document.querySelectorAll('.bg-stars, .bg-aurora'), function (el) {
      if (on) {
        if (el.classList.contains('frozen')) return;
        var cs = getComputedStyle(el), a = el.getAnimations ? el.getAnimations()[0] : null;
        el._nbAt = a && a.currentTime != null ? a.currentTime : 0; // where the drift was
        el.style.transform = cs.transform === 'none' ? '' : cs.transform;
        el.style.opacity = cs.opacity;
        el.classList.add('frozen');
      } else {
        if (!el.classList.contains('frozen')) return;
        el.classList.remove('frozen');
        el.style.transform = ''; el.style.opacity = '';
        el.style.animationDelay = el._nbAt ? -el._nbAt + 'ms' : ''; // resume from the same point: no jump
      }
    });
    P.hold(3000); // a run just started or ended: let the phone settle before judging it
  };

  /* ---------------- FPS meter (Settings: tap the version 5 times) ---------------- */
  var meter = null, frames = 0, meterT = 0;
  P.count = function (t) {
    if (!meter) return;
    frames++;
    if (t - meterT >= 500) {
      var fps = frames * 1000 / (t - meterT);
      meter.textContent = Math.round(fps) + ' FPS · ' + P.workMs.toFixed(1) + ' ms · ' + P.q().name +
        ' · ' + P.res().toFixed(2) + 'x · ' + P.hz + ' Hz' + (P.forced() ? ' · PERF MODE' : '');
      frames = 0; meterT = t;
    }
  };
  P.toggleMeter = function () {
    if (meter) { meter.parentNode.removeChild(meter); meter = null; return false; }
    meter = document.createElement('div');
    meter.className = 'fps-meter';
    meter.textContent = '… FPS';
    document.body.appendChild(meter);
    meterT = performance.now(); frames = 0;
    return true;
  };

  applyClass();
})(window.NB);
