/* ==========================================================================
   NEON BOOM — configuration, tiers and small helpers
   Every tunable number of the game lives in this file.
   ========================================================================== */
window.NB = window.NB || {};

(function (NB) {
  'use strict';

  NB.VERSION = '1.0.0';

  NB.CONFIG = {
    WORLD_W: 600,          // physics world width (abstract units)
    WORLD_H: 960,          // physics world height
    WALL: 8,               // inner wall offset from the world edge
    RAIL_Y: 34,            // emitter rail height
    DROP_Y: 96,            // where the held core hangs before release
    DANGER_Y: 178,         // overload line: a settled core above it = danger
    DROP_COOLDOWN: 480,    // ms between two drops
    SPAWN_GRACE: 1300,     // ms a fresh core may sit above the line
    OVERLOAD_TIME: 2600,   // ms above the line before the reactor overloads
    COMBO_WINDOW: 1400,    // ms between merges to keep a combo alive
    COMBO_STEP: 0.25,      // +25 % score per combo level
    COMBO_MAX: 3,          // combo multiplier cap
    BOOM_POINTS: 1000,     // two Singularities merging = NEON BOOM
    SPAWN_WEIGHTS: [32, 27, 20, 13, 8], // odds of the 5 droppable tiers
    GRAVITY: 1.7,
    MAX_DPR: 2.5,          // pixel-ratio cap (battery and memory)
    AUTOSAVE_MS: 1500,
    REVIVE_CLEAR: 230,     // "Continue" wipes every core whose top is within this band below the line
    PRIVACY_URL: 'https://wiokitobubu.github.io/neonboom/privacy.html'
  };

  /* The evolution chain: 11 energy cores, from Spark to Singularity. */
  var RAW_TIERS = [
    { name: 'SPARK',       r: 20,  pts: 0,   color: '#00F0FF', glyph: 'dot' },
    { name: 'ION',         r: 27,  pts: 4,   color: '#FF2BD6', glyph: 'orbit' },
    { name: 'PHOTON',      r: 35,  pts: 10,  color: '#B8FF3B', glyph: 'tri' },
    { name: 'QUARK',       r: 44,  pts: 20,  color: '#FF8A2A', glyph: 'triad' },
    { name: 'PULSAR',      r: 54,  pts: 35,  color: '#9B6BFF', glyph: 'diamond' },
    { name: 'PLASMA',      r: 65,  pts: 55,  color: '#FF3D6E', glyph: 'hex' },
    { name: 'NEBULA',      r: 77,  pts: 80,  color: '#2BFFD0', glyph: 'spiral' },
    { name: 'COMET',       r: 90,  pts: 110, color: '#FFD640', glyph: 'star' },
    { name: 'PLANET',      r: 104, pts: 150, color: '#4C8DFF', glyph: 'planet' },
    { name: 'QUASAR',      r: 119, pts: 200, color: '#C9B8FF', glyph: 'burst' },
    { name: 'SINGULARITY', r: 136, pts: 270, color: '#FFFFFF', glyph: 'singularity' }
  ];

  /* ---------------- helpers ---------------- */
  var U = NB.util = {};
  U.TAU = Math.PI * 2;
  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(U.rand(a, b + 1)); };
  U.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  U.easeOutBack = function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  U.easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  U.fmt = function (n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  U.weightedPick = function (weights, rnd) {
    var sum = 0, i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    var x = (rnd || Math.random)() * sum;
    for (i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
    return weights.length - 1;
  };

  /* Small deterministic random generator (league rivals). */
  U.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  U.hexToRgb = function (hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgba = function (hex, a) {
    var c = U.hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };
  U.mix = function (hexA, hexB, t) {
    var a = U.hexToRgb(hexA), b = U.hexToRgb(hexB);
    var c = [0, 1, 2].map(function (i) { return Math.round(U.lerp(a[i], b[i], t)); });
    return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  };

  NB.TIERS = RAW_TIERS.map(function (t, i) {
    var last = i === RAW_TIERS.length - 1;
    return {
      index: i,
      name: t.name,
      r: t.r,
      pts: t.pts,
      color: t.color,
      glyph: t.glyph,
      light: last ? '#FFFFFF' : U.mix(t.color, '#FFFFFF', 0.62),
      deep: last ? '#07020F' : U.mix(t.color, '#05020C', 0.82),
      glow: last ? '#B98CFF' : t.color
    };
  });
  NB.MAX_TIER = NB.TIERS.length - 1;

  /* Tiny event bus so later modules (events, shop, ads) can plug in. */
  NB.bus = (function () {
    var map = {};
    return {
      on: function (name, fn) { (map[name] = map[name] || []).push(fn); },
      off: function (name, fn) { map[name] = (map[name] || []).filter(function (f) { return f !== fn; }); },
      emit: function (name, data) { (map[name] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }
    };
  })();

  /* Score modifiers: later steps register Gold Fever (x2), VIP (+25 %)… */
  NB.mods = (function () {
    var list = [];
    return {
      add: function (id, fn) { list = list.filter(function (m) { return m.id !== id; }); list.push({ id: id, fn: fn }); },
      remove: function (id) { list = list.filter(function (m) { return m.id !== id; }); },
      multiplier: function (game) {
        return list.reduce(function (m, mod) { var v = mod.fn(game); return m * (v > 0 ? v : 1); }, 1);
      }
    };
  })();
})(window.NB);
