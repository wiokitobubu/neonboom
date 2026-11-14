/* ==========================================================================
   NEON BOOM — local save (profile, settings, in-progress run)
   ========================================================================== */
(function (NB) {
  'use strict';

  var PREFIX = 'neonboom.';

  NB.store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
    },
    del: function (key) {
      try { window.localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    }
  };

  function defaults() {
    return {
      v: 1,
      name: 'PILOT',
      seed: Math.floor(Math.random() * 1e9),
      best: 0,
      games: 0,
      merges: 0,
      booms: 0,
      maxTier: 0,
      discovered: [true].concat(new Array(NB.TIERS.length - 1).fill(false)),
      tutorialDone: false,
      settings: { sfx: true, music: true, haptics: true },
      league: { weekId: 0, weekBest: 0, division: 0, lastResult: null }
    };
  }

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    Object.keys(base).forEach(function (k) {
      if (!(k in saved)) return;
      var b = base[k], s = saved[k];
      if (b && typeof b === 'object' && !Array.isArray(b)) base[k] = merge(b, s);
      else if (Array.isArray(b) && Array.isArray(s)) base[k] = b.map(function (v, i) { return i < s.length ? s[i] : v; });
      else if (typeof s === typeof b) base[k] = s;
    });
    return base;
  }

  NB.profile = merge(defaults(), NB.store.get('profile', null));
  NB.saveProfile = function () { NB.store.set('profile', NB.profile); };
  NB.resetProfile = function () {
    NB.store.del('profile');
    NB.store.del('run');
    NB.profile = defaults();
    NB.saveProfile();
  };
  NB.saveProfile();
})(window.NB);
