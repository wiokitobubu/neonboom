/* ==========================================================================
   NEON LEAGUE — a weekly league against simulated AI rivals.
   Rivals are generated on the device (no server) and are always labelled
   "AI" in the interface: competitive pressure without misleading players
   (Google Play's Deceptive Behavior policy).
   ========================================================================== */
(function (NB) {
  'use strict';

  var U = NB.util;
  var DAY = 864e5;
  var SIZE = 30, PROMOTE = 5, DEMOTE = 5;

  var DIVISIONS = [
    { name: 'BRONZE',  color: '#FF9A5A', base: 1400 },
    { name: 'SILVER',  color: '#C9D6FF', base: 3000 },
    { name: 'GOLD',    color: '#FFD640', base: 5200 },
    { name: 'DIAMOND', color: '#3FF3FF', base: 8200 },
    { name: 'NEON',    color: '#FF2BD6', base: 12000 }
  ];
  var NAMES = [
    'NovaByte', 'Kairo_X', 'PixelWitch', 'ZeroGrav', 'Lumen', 'VoltRider', 'Neonix', 'Glitchy',
    'Q-Bit', 'Synthia', 'Arcadia', 'ByteRunner', 'Hexa', 'Vortex99', 'Echo-7', 'Mirage', 'Cipher',
    'Starling', 'Flux', 'Nyx', 'Halo', 'Kova', 'Zephyr', 'Polaris', 'Mako', 'Riven', 'Aether',
    'Juno', 'Krypt', 'Lyra', 'Nebulon', 'Onyx', 'Pyra', 'Sable', 'Talon', 'Ultra_V', 'Wraith',
    'Xeno', 'Yuki_9', 'Zenith', 'Axiom', 'Blitz', 'Comet_K', 'Drift', 'Ember', 'Fable', 'Ghost_88'
  ];
  var AVATAR_COLORS = ['#00F0FF', '#FF2BD6', '#B8FF3B', '#FF8A2A', '#9B6BFF', '#FF3D6E', '#2BFFD0', '#FFD640', '#4C8DFF'];

  function weekStart(now) {
    var d = new Date(now), back = (d.getDay() + 6) % 7; // Monday = 0
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  }
  function info(now) {
    now = now || Date.now();
    var s = weekStart(now), e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
    var days = Math.floor(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()) / DAY);
    return { id: Math.floor((days + 3) / 7), start: s.getTime(), end: e.getTime(), frac: U.clamp((now - s.getTime()) / (e.getTime() - s.getTime()), 0, 1) };
  }
  function gauss(rnd) {
    var u = Math.max(1e-9, rnd()), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(U.TAU * v);
  }

  var cache = { key: '', list: null };

  function rivals(weekId, division, frac) {
    var key = weekId + ':' + division + ':' + Math.floor(frac * 2000) + ':' + NB.profile.best + ':' + NB.profile.league.weekBest;
    if (cache.key === key) return cache.list;
    var p = NB.profile, rnd = U.rng(U.hash(weekId + ':' + division + ':' + p.seed));
    var div = DIVISIONS[division];
    var skill = Math.max(600, p.best);
    var base = div.base * 0.65 + U.clamp(skill, div.base * 0.5, div.base * 1.8) * 0.35;
    var names = NAMES.slice();
    for (var i = names.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = names[i]; names[i] = names[j]; names[j] = t; }

    var list = [];
    for (var n = 0; n < SIZE - 1; n++) {
      var target = base * Math.exp(gauss(rnd) * 0.42);
      var activity = 0.55 + rnd() * 1.0, startAt = rnd() * 0.3;
      var prog = (frac - startAt) / (1 - startAt), score = 0;
      if (prog > 0) score = target * (0.35 + 0.65 * Math.pow(Math.min(1, prog), activity));
      list.push({ name: names[n], score: Math.round(score / 2) * 2, target: target, ai: true, color: AVATAR_COLORS[U.hash(names[n]) % AVATAR_COLORS.length] });
    }
    // One "pacer" rival keeps a small lead over your weekly best, up to a ceiling.
    var wb = p.league.weekBest;
    if (wb > 0) {
      var pacer = list[0];
      var chase = wb + 40 + Math.round(wb * 0.035 / 2) * 2;
      pacer.score = Math.max(pacer.score, Math.min(Math.round(pacer.target * 1.5), chase));
    }
    cache = { key: key, list: list };
    return list;
  }

  function build(weekId, division, frac, yourScore) {
    var list = rivals(weekId, division, frac).map(function (r) { return { name: r.name, score: r.score, ai: true, color: r.color }; });
    list.push({ name: NB.profile.name, score: yourScore, you: true, color: '#00F0FF' });
    list.sort(function (a, b) { return b.score - a.score || (a.you ? -1 : b.you ? 1 : 0); });
    var you = 0;
    list.forEach(function (r, i) { r.rank = i + 1; if (r.you) you = i + 1; });
    return { list: list, you: you };
  }

  var league = NB.league = { DIVISIONS: DIVISIONS, SIZE: SIZE, PROMOTE: PROMOTE, DEMOTE: DEMOTE, info: info };

  /* Closes last week if needed. Returns a result object once, or null. */
  league.rollover = function () {
    var lg = NB.profile.league, now = info();
    if (lg.weekId === now.id) return null;
    var result = null;
    if (lg.weekId && lg.weekBest > 0) {
      var fin = build(lg.weekId, lg.division, 1, lg.weekBest), from = lg.division, to = from;
      if (fin.you <= PROMOTE) to = Math.min(DIVISIONS.length - 1, from + 1);
      else if (fin.you > SIZE - DEMOTE) to = Math.max(0, from - 1);
      lg.division = to;
      result = { rank: fin.you, from: from, to: to };
      lg.lastResult = result;
    }
    lg.weekId = now.id; lg.weekBest = 0;
    NB.saveProfile();
    return result;
  };

  league.standings = function (liveScore) {
    league.rollover();
    var lg = NB.profile.league, now = info();
    var s = build(now.id, lg.division, now.frac, Math.max(lg.weekBest, liveScore || 0));
    s.info = now; s.division = lg.division; s.div = DIVISIONS[lg.division];
    return s;
  };

  league.rankFor = function (score) { return league.standings(score).you; };

  /* Called at game over. */
  league.record = function (score) {
    var before = league.standings(0).you;
    var lg = NB.profile.league;
    if (score > lg.weekBest) { lg.weekBest = score; NB.saveProfile(); }
    var after = league.standings(0);
    var me = after.list[after.you - 1], ahead = after.you > 1 ? after.list[after.you - 2] : null;
    return {
      before: before, after: after.you, total: after.list.length,
      ahead: ahead ? { name: ahead.name, gap: ahead.score - me.score } : null
    };
  };

  league.timeLeft = function () {
    var ms = Math.max(0, info().end - Date.now());
    var d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    return d > 0 ? d + 'd ' + ('0' + h).slice(-2) + 'h' : ('0' + h).slice(-2) + 'h ' + ('0' + m).slice(-2) + 'm';
  };
})(window.NB);
