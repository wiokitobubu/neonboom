/* ==========================================================================
   NEON BOOM — the reactor: physics (Matter.js), merging, overload rule,
   rendering, input and autosave.
   ========================================================================== */
(function (NB) {
  'use strict';

  var M = window.Matter, C = NB.CONFIG, T = NB.TIERS, U = NB.util;
  var W = C.WORLD_W, H = C.WORLD_H, L = C.WALL, R = W - C.WALL, FLOOR = H - C.WALL;
  var FM = 40; // glow margin around the chamber, world units
  var MOTE_COLORS = ['#00F0FF', '#FF2BD6', '#9B6BFF', '#2BFFD0'];

  function Game(canvas, stage) {
    var self = this;
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.stage = stage;
    this.engine = M.Engine.create({ enableSleeping: false });
    this.engine.gravity.y = 1;
    this.engine.gravity.scale = 0.001 * C.GRAVITY;
    this.engine.positionIterations = 10;
    this.engine.velocityIterations = 8;
    this.world = this.engine.world;

    this.fx = new NB.FX();
    this.orbs = []; this.queue = []; this.uid = 0;
    this.state = 'idle';                 // idle | playing | paused | over
    this.clock = 0; this.timeScale = 1; this.targetScale = 1;
    this.aimX = W / 2; this.aimShown = W / 2; this.aiming = false;
    this.cur = 0; this.next = 0; this.readyAt = 0;
    this.danger = 0; this.near = false; this.warnAt = 0;
    this.dirty = false; this.lastSave = 0;
    this.k = 0; this.sprites = null; this.frameCv = null;
    this.resetRun();

    this.motes = [];
    for (var i = 0; i < 26; i++) this.motes.push(this.newMote(true));

    this.buildWalls();
    M.Events.on(this.engine, 'collisionStart', function (e) { self.onPairs(e.pairs); });
    M.Events.on(this.engine, 'collisionActive', function (e) { self.onPairs(e.pairs); });

    this.bindInput();
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(stage);
    window.addEventListener('resize', function () { self.resize(); });

    this.last = performance.now();
    this._frame = function (t) { self.frame(t); };
    requestAnimationFrame(this._frame);
  }

  var G = Game.prototype;

  G.resetRun = function () {
    this.score = 0; this.merges = 0; this.drops = 0; this.booms = 0; this.maxTier = 0;
    this.combo = 0; this.lastMergeAt = -1e9; this.bestBeaten = false;
    this.danger = 0; this.near = false;
    this.revives = 0;                             // rewarded "Continue" used this run
    this.rec = { games: 0, merges: 0, booms: 0 }; // what this run already added to the profile stats
  };

  G.buildWalls = function () {
    var th = 400, o = { isStatic: true, friction: 0.15, restitution: 0.05, label: 'wall' };
    M.Composite.add(this.world, [
      M.Bodies.rectangle(L - th / 2, H / 2, th, H * 4, o),
      M.Bodies.rectangle(R + th / 2, H / 2, th, H * 4, o),
      M.Bodies.rectangle(W / 2, FLOOR + th / 2, W * 3, th, o)
    ]);
  };

  /* ---------------- sizing ---------------- */
  G.resize = function () {
    var rect = this.stage.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;
    var dpr = Math.min(C.MAX_DPR, window.devicePixelRatio || 1);
    var cw = Math.round(rect.width * dpr), ch = Math.round(rect.height * dpr);
    if (cw === this.canvas.width && ch === this.canvas.height && this.sprites) return;
    this.dpr = dpr;
    this.canvas.width = cw; this.canvas.height = ch;
    this.canvas.style.width = rect.width + 'px'; this.canvas.style.height = rect.height + 'px';
    var padX = 14, padY = 6;
    this.scale = Math.min((rect.width - padX * 2) / W, (rect.height - padY * 2) / H);
    this.ox = (rect.width - W * this.scale) / 2;
    this.oy = rect.height - H * this.scale - padY; // anchored to the bottom: spare room goes to the top
    var k = dpr * this.scale;
    if (!this.sprites || Math.abs(k - this.sprites.ps) / k > 0.08) this.sprites = new NB.SpriteSet(k);
    this.k = k;
    this.buildFrame();
    NB.bus.emit('layout', { scale: this.scale, ox: this.ox, oy: this.oy });
  };

  /* The chamber is static art: baked once per size. */
  G.buildFrame = function () {
    var k = this.k, cv = document.createElement('canvas');
    cv.width = Math.ceil((W + FM * 2) * k); cv.height = Math.ceil((H + FM * 2) * k);
    var c = cv.getContext('2d');
    c.setTransform(k, 0, 0, k, FM * k, FM * k);

    var g = c.createLinearGradient(0, 0, 0, FLOOR);
    g.addColorStop(0, 'rgba(12,7,34,0)'); g.addColorStop(0.22, 'rgba(14,8,40,0.38)'); g.addColorStop(1, 'rgba(24,10,62,0.72)');
    c.fillStyle = g; c.fillRect(L, 0, R - L, FLOOR);

    var fg = c.createRadialGradient(W / 2, FLOOR, 0, W / 2, FLOOR, W * 0.62);
    fg.addColorStop(0, 'rgba(255,43,214,0.24)'); fg.addColorStop(1, 'rgba(255,43,214,0)');
    c.fillStyle = fg; c.fillRect(L, FLOOR - W * 0.62, R - L, W * 0.62);

    // holographic grid, fading upward
    c.save();
    c.beginPath(); c.rect(L, 0, R - L, FLOOR); c.clip();
    c.lineWidth = 1;
    for (var x = L + 48; x < R; x += 48) {
      var vg = c.createLinearGradient(0, 0, 0, FLOOR);
      vg.addColorStop(0, 'rgba(130,110,255,0)'); vg.addColorStop(1, 'rgba(130,110,255,0.13)');
      c.strokeStyle = vg; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, FLOOR); c.stroke();
    }
    for (var y = FLOOR - 48; y > 0; y -= 48) {
      c.strokeStyle = 'rgba(130,110,255,' + (0.13 * (y / FLOOR)).toFixed(3) + ')';
      c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke();
    }
    c.restore();

    // neon walls
    var wg = c.createLinearGradient(0, 0, 0, H);
    wg.addColorStop(0, 'rgba(0,240,255,0.15)'); wg.addColorStop(0.12, '#00F0FF'); wg.addColorStop(0.55, '#9B6BFF'); wg.addColorStop(1, '#FF2BD6');
    c.beginPath();
    c.moveTo(L, 46); c.lineTo(L, FLOOR - 22); c.quadraticCurveTo(L, FLOOR, L + 22, FLOOR);
    c.lineTo(R - 22, FLOOR); c.quadraticCurveTo(R, FLOOR, R, FLOOR - 22); c.lineTo(R, 46);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.shadowColor = '#9B6BFF'; c.shadowBlur = 24 * k; c.strokeStyle = wg; c.lineWidth = 5; c.stroke();
    c.shadowColor = '#FFFFFF'; c.shadowBlur = 5 * k; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.stroke();
    c.shadowBlur = 0;

    // tick marks on the walls
    c.strokeStyle = 'rgba(190,180,255,0.32)'; c.lineWidth = 1.5;
    for (var ty = FLOOR - 48; ty > 90; ty -= 48) {
      c.beginPath(); c.moveTo(L + 4, ty); c.lineTo(L + 12, ty); c.moveTo(R - 4, ty); c.lineTo(R - 12, ty); c.stroke();
    }
    // floor emitters
    for (var fx = L + 60; fx < R - 40; fx += 80) {
      c.fillStyle = 'rgba(255,120,240,0.5)';
      c.fillRect(fx, FLOOR + 6, 22, 3);
    }
    this.frameCv = cv;
  };

  /* ---------------- bodies ---------------- */
  G.makeOrb = function (tier, x, y, pop) {
    var t = T[tier];
    var b = M.Bodies.circle(x, y, t.r, {
      restitution: 0.12, friction: 0.06, frictionStatic: 0.25, frictionAir: 0.006,
      density: 0.0011, slop: 0.04, label: 'orb'
    });
    b.nb = { tier: tier, born: this.clock, merging: false, over: false, popAt: pop ? performance.now() : 0, id: ++this.uid };
    M.Composite.add(this.world, b);
    this.orbs.push(b);
    return b;
  };
  G.removeOrb = function (b) {
    M.Composite.remove(this.world, b);
    var i = this.orbs.indexOf(b);
    if (i >= 0) this.orbs.splice(i, 1);
  };
  G.removeAll = function () {
    for (var i = 0; i < this.orbs.length; i++) M.Composite.remove(this.world, this.orbs[i]);
    this.orbs.length = 0; this.queue.length = 0;
  };

  G.onPairs = function (pairs) {
    if (this.state !== 'playing') return;
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i].bodyA, b = pairs[i].bodyB;
      if (!a.nb || !b.nb || a.nb.merging || b.nb.merging || a.nb.tier !== b.nb.tier) continue;
      a.nb.merging = b.nb.merging = true;
      this.queue.push([a, b]);
    }
  };
  G.flushMerges = function () {
    while (this.queue.length) { var p = this.queue.shift(); this.merge(p[0], p[1]); }
  };

  G.comboMult = function () { return Math.min(C.COMBO_MAX, 1 + (this.combo - 1) * C.COMBO_STEP); };
  G.multiplier = function () { return this.comboMult() * NB.mods.multiplier(this); };

  G.merge = function (a, b) {
    var tier = a.nb.tier;
    var mid = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
    var vx = (a.velocity.x + b.velocity.x) * 0.25, vy = (a.velocity.y + b.velocity.y) * 0.25;
    this.fx.ghost(tier, { x: a.position.x, y: a.position.y }, a.angle, mid);
    this.fx.ghost(tier, { x: b.position.x, y: b.position.y }, b.angle, mid);
    this.removeOrb(a); this.removeOrb(b);

    this.combo = (this.clock - this.lastMergeAt < C.COMBO_WINDOW) ? this.combo + 1 : 1;
    this.lastMergeAt = this.clock;
    this.merges++;
    var mult = this.multiplier(), pts, nt;

    if (tier === NB.MAX_TIER) {
      // two Singularities: NEON BOOM
      nt = tier;
      pts = Math.round(C.BOOM_POINTS * mult);
      this.booms++;
      this.fx.boom(mid.x, mid.y);
      this.fx.text(mid.x, mid.y - 40, 'NEON BOOM!', '#FFFFFF', 64, 1600);
      this.addScore(pts, mid.x, mid.y + 30, '#FFD640');
      this.timeScale = 0.18; this.targetScale = 1;
      NB.audio.play('boom'); NB.haptic('heavy');
      NB.bus.emit('boom', { points: pts });
    } else {
      nt = tier + 1;
      var r = T[nt].r;
      var x = U.clamp(mid.x, L + r + 0.5, R - r - 0.5), y = Math.min(mid.y, FLOOR - r - 0.5);
      var o = this.makeOrb(nt, x, y, true);
      M.Body.setVelocity(o, { x: vx, y: vy - 0.6 });
      pts = Math.round(T[nt].pts * mult);
      this.addScore(pts, x, y, T[nt].color);
      this.fx.merge(x, y, nt, this.combo);
      NB.audio.play('merge', { tier: nt, combo: this.combo });
      NB.haptic(nt >= 6 ? 'medium' : 'light');
      if (this.combo >= 2) { NB.audio.play('combo', { combo: this.combo }); NB.bus.emit('combo', { combo: this.combo, mult: this.comboMult() }); }
      if (nt > this.maxTier) this.maxTier = nt;
      if (nt > NB.profile.maxTier) NB.profile.maxTier = nt;
      if (!NB.profile.discovered[nt]) {
        NB.profile.discovered[nt] = true;
        NB.saveProfile();
        NB.audio.play('unlock');
        NB.bus.emit('discover', nt);
      }
    }
    this.dirty = true;
    NB.bus.emit('merge', { tier: tier, newTier: nt, points: pts, combo: this.combo });
  };

  G.addScore = function (pts, x, y, color) {
    this.score += pts;
    this.fx.text(x, y - 10, '+' + U.fmt(pts), color || '#FFFFFF', pts >= 200 ? 44 : pts >= 60 ? 38 : 32);
    NB.bus.emit('score', { score: this.score, delta: pts });
    if (!this.bestBeaten && NB.profile.best > 0 && this.score > NB.profile.best) {
      this.bestBeaten = true;
      NB.audio.play('best');
      NB.bus.emit('newBest', this.score);
    }
  };

  G.rollSpawn = function () {
    var cap = Math.min(4, Math.max(2, this.maxTier));
    return U.weightedPick(C.SPAWN_WEIGHTS.slice(0, cap + 1));
  };

  G.heldX = function () {
    var r = T[this.cur].r;
    return U.clamp(this.aimShown, L + r + 1, R - r - 1);
  };

  G.drop = function () {
    if (this.state !== 'playing' || this.clock < this.readyAt) return false;
    var tier = this.cur, r = T[tier].r;
    var x = U.clamp(this.aimX, L + r + 1, R - r - 1);
    this.aimShown = this.aimX;
    var o = this.makeOrb(tier, x, C.DROP_Y, false);
    M.Body.setVelocity(o, { x: 0, y: 2.2 });
    this.cur = this.next; this.next = this.rollSpawn();
    this.readyAt = this.clock + C.DROP_COOLDOWN;
    this.drops++; this.dirty = true;
    NB.audio.play('drop', { tier: tier }); NB.haptic('light');
    NB.bus.emit('drop', { tier: tier, next: this.next });
    return true;
  };

  /* Where a dropped core would first touch, for the aiming laser. */
  G.landingY = function (x) {
    var y = FLOOR;
    for (var i = 0; i < this.orbs.length; i++) {
      var o = this.orbs[i], br = o.circleRadius, dx = Math.abs(o.position.x - x);
      if (dx < br) {
        var yy = o.position.y - Math.sqrt(br * br - dx * dx);
        if (yy < y && yy > C.DROP_Y) y = yy;
      }
    }
    return y;
  };

  /* ---------------- overload rule ---------------- */
  G.checkDanger = function (dt) {
    var over = false, near = false;
    for (var i = 0; i < this.orbs.length; i++) {
      var o = this.orbs[i];
      if (o.nb.merging) continue;
      var top = o.position.y - o.circleRadius, aged = this.clock - o.nb.born > C.SPAWN_GRACE;
      o.nb.over = aged && top < C.DANGER_Y;
      if (o.nb.over) over = true;
      else if (aged && top < C.DANGER_Y + 70) near = true;
      if (o.position.y > H + 300) { this.removeOrb(o); i--; }
    }
    this.danger = over ? this.danger + dt : Math.max(0, this.danger - dt * 2);
    this.near = near || over;
    if (over && this.clock >= this.warnAt) {
      NB.audio.play('warn'); NB.haptic('light');
      this.warnAt = this.clock + 520;
    }
    if (this.danger >= C.OVERLOAD_TIME) this.overload();
  };

  G.overload = function () {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.aiming = false;
    this.targetScale = 0.03;
    this.fx.flash('#FF3D6E', 0.5); this.fx.shake(14);
    NB.audio.play('over'); NB.audio.setMode('over'); NB.haptic('heavy');
    NB.store.del('run');
    NB.bus.emit('gameOver', {
      score: this.score, merges: this.merges, drops: this.drops,
      maxTier: this.maxTier, booms: this.booms, bestBeaten: this.bestBeaten, revives: this.revives
    });
  };

  /* Rewarded "Continue": a stabilising shockwave wipes every core near the
     top of the reactor, then the run goes on. */
  G.revive = function () {
    if (this.state !== 'over') return false;
    var self = this, limit = C.DANGER_Y + C.REVIVE_CLEAR, removed = 0;
    this.orbs.slice().forEach(function (o) {
      if (o.nb.merging || o.position.y - o.circleRadius >= limit) return;
      var t = T[o.nb.tier];
      self.fx.burst(o.position.x, o.position.y, t.color, 14 + o.nb.tier * 2, 0.36, 12, 750, { spread: t.r * 0.6 });
      self.fx.ring(o.position.x, o.position.y, t.r * 0.6, t.r * 1.9, t.color, 3, 420, 0);
      self.removeOrb(o); removed++;
    });
    this.orbs.forEach(function (o) { o.nb.born = self.clock; o.nb.over = false; });
    this.revives++;
    this.danger = 0; this.near = false; this.warnAt = 0; this.combo = 0;
    this.state = 'playing'; this.targetScale = 1;
    this.readyAt = this.clock + 650;
    this.fx.ring(W / 2, limit, 30, W * 0.75, '#2BFFD0', 6, 900, 0);
    this.fx.flash('#2BFFD0', 0.32); this.fx.shake(8);
    this.fx.text(W / 2, limit + 70, 'REACTOR STABILISED', '#2BFFD0', 30, 1500);
    NB.audio.setMode('game'); NB.audio.play('unlock'); NB.haptic('medium');
    this.dirty = true; this.save();
    NB.bus.emit('revive', { removed: removed });
    return true;
  };

  /* ---------------- run lifecycle ---------------- */
  G.purge = function () {
    var self = this;
    this.orbs.forEach(function (o) {
      var t = T[o.nb.tier];
      self.fx.burst(o.position.x, o.position.y, t.color, 8 + o.nb.tier * 2, 0.28, 10, 600, { spread: t.r * 0.5 });
    });
    if (this.orbs.length) { this.fx.flash('#9B6BFF', 0.22); NB.audio.play('open'); }
    this.removeAll();
  };

  G.newGame = function () {
    this.removeAll();
    this.resetRun();
    this.timeScale = this.targetScale = 1;
    this.cur = this.rollSpawn(); this.next = this.rollSpawn();
    this.readyAt = this.clock + 250;
    this.aimX = this.aimShown = W / 2;
    this.state = 'playing';
    this.dirty = true;
    NB.audio.play('start'); NB.audio.setMode('game');
    NB.bus.emit('gameStart', { restored: false });
    NB.bus.emit('score', { score: 0, delta: 0 });
    NB.bus.emit('drop', { tier: null, next: this.next });
    this.save();
  };

  G.pause = function () {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.aiming = false;
    this.save();
    NB.audio.setMode('menu');
  };
  G.resume = function () {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.last = performance.now();
    NB.audio.setMode('game');
  };
  G.toIdle = function () { this.state = 'idle'; this.aiming = false; };

  G.serialize = function () {
    function r2(v) { return Math.round(v * 100) / 100; }
    return {
      v: 1, score: this.score, merges: this.merges, drops: this.drops, booms: this.booms,
      maxTier: this.maxTier, cur: this.cur, next: this.next, bestBeaten: this.bestBeaten,
      rv: this.revives, rec: this.rec,
      orbs: this.orbs.filter(function (o) { return !o.nb.merging; }).map(function (o) {
        return { t: o.nb.tier, x: r2(o.position.x), y: r2(o.position.y), a: r2(o.angle), vx: r2(o.velocity.x), vy: r2(o.velocity.y), av: r2(o.angularVelocity) };
      })
    };
  };
  G.save = function () {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    NB.store.set('run', this.serialize());
    this.dirty = false;
  };
  G.restore = function (d) {
    if (!d || d.v !== 1 || !Array.isArray(d.orbs)) return false;
    this.removeAll();
    this.resetRun();
    this.score = d.score || 0; this.merges = d.merges || 0; this.drops = d.drops || 0;
    this.booms = d.booms || 0; this.maxTier = d.maxTier || 0; this.bestBeaten = !!d.bestBeaten;
    this.revives = d.rv | 0;
    if (d.rec) this.rec = { games: d.rec.games | 0, merges: d.rec.merges | 0, booms: d.rec.booms | 0 };
    this.cur = U.clamp(d.cur | 0, 0, 4); this.next = U.clamp(d.next | 0, 0, 4);
    var self = this;
    d.orbs.forEach(function (o) {
      if (o.t < 0 || o.t > NB.MAX_TIER) return;
      var b = self.makeOrb(o.t, U.clamp(o.x, L + T[o.t].r, R - T[o.t].r), Math.min(o.y, FLOOR - T[o.t].r), false);
      M.Body.setAngle(b, o.a || 0);
      M.Body.setVelocity(b, { x: o.vx || 0, y: o.vy || 0 });
      M.Body.setAngularVelocity(b, o.av || 0);
    });
    this.timeScale = this.targetScale = 1;
    this.readyAt = this.clock + 300;
    this.state = 'playing';
    NB.audio.setMode('game');
    NB.bus.emit('gameStart', { restored: true });
    NB.bus.emit('score', { score: this.score, delta: 0 });
    NB.bus.emit('drop', { tier: null, next: this.next });
    return true;
  };

  /* ---------------- input ---------------- */
  G.bindInput = function () {
    var self = this, st = this.stage;
    function aim(e) {
      var rect = self.canvas.getBoundingClientRect();
      self.aimX = U.clamp((e.clientX - rect.left - self.ox) / self.scale, L, R);
    }
    st.addEventListener('pointerdown', function (e) {
      NB.audio.unlock();
      if (self.state !== 'playing') return;
      self.aiming = true; aim(e);
      if (st.setPointerCapture) { try { st.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      e.preventDefault();
    });
    st.addEventListener('pointermove', function (e) {
      if (self.state !== 'playing') return;
      if (self.aiming || e.pointerType === 'mouse') aim(e);
    });
    st.addEventListener('pointerup', function (e) {
      if (!self.aiming) return;
      self.aiming = false;
      if (self.state !== 'playing') return;
      aim(e); self.drop();
    });
    st.addEventListener('pointercancel', function () { self.aiming = false; });
    st.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('keydown', function (e) {
      if (self.state !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a') { self.aimX = U.clamp(self.aimX - 18, L, R); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'd') { self.aimX = U.clamp(self.aimX + 18, L, R); e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') { NB.audio.unlock(); self.drop(); e.preventDefault(); }
    });
  };

  /* ---------------- loop ---------------- */
  G.newMote = function (anywhere) {
    return {
      x: U.rand(L + 12, R - 12), y: anywhere ? U.rand(C.DANGER_Y, FLOOR) : FLOOR - 4,
      v: U.rand(0.008, 0.022), s: U.rand(2.5, 6), a: U.rand(0.25, 0.6), ph: U.rand(0, U.TAU),
      spr: NB.glowDot(MOTE_COLORS[U.randInt(0, MOTE_COLORS.length - 1)])
    };
  };
  G.updateMotes = function (dt) {
    for (var i = 0; i < this.motes.length; i++) {
      var m = this.motes[i];
      m.y -= m.v * dt; m.x += Math.sin(m.ph + m.y * 0.015) * 0.02 * dt;
      if (m.y < C.DANGER_Y - 30) this.motes[i] = this.newMote(false);
    }
  };

  G.frame = function (t) {
    requestAnimationFrame(this._frame);
    var dt = Math.min(50, Math.max(0, t - this.last));
    this.last = t;
    this.timeScale += (this.targetScale - this.timeScale) * Math.min(1, dt / 260);

    if ((this.state === 'playing' || this.state === 'over') && dt > 0 && this.timeScale > 0.005) {
      var n = Math.max(1, Math.ceil(dt / 16.67)), sub = dt / n;
      for (var i = 0; i < n; i++) {
        var sdt = sub * this.timeScale;
        M.Engine.update(this.engine, sdt);
        this.clock += sdt;
        this.flushMerges();
        if (this.state === 'playing') this.checkDanger(sdt);
      }
    }
    if (this.state !== 'paused') { this.fx.update(dt); this.updateMotes(dt); }
    this.aimShown += (this.aimX - this.aimShown) * Math.min(1, dt / 40);

    if (this.state !== 'idle' || this.fx.parts.length || this.fx.rings.length) this.render(t);
    if (this.state === 'playing' && this.dirty && t - this.lastSave > C.AUTOSAVE_MS) { this.save(); this.lastSave = t; }
  };

  G.render = function (now) {
    var ctx = this.ctx, k = this.k, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.frameCv) return;
    var bx = this.ox * dpr + this.fx.sx * k, by = this.oy * dpr + this.fx.sy * k;
    this.bx = bx; this.by = by;
    ctx.setTransform(k, 0, 0, k, bx, by);
    ctx.drawImage(this.frameCv, -FM, -FM, W + FM * 2, H + FM * 2);
    this.drawMotes(ctx);
    this.drawDanger(ctx, now);
    if (this.state === 'playing' || this.state === 'paused') this.drawLauncher(ctx, now);
    this.fx.drawUnder(ctx, this.sprites);
    this.drawOrbs(ctx, now);
    ctx.setTransform(k, 0, 0, k, bx, by);
    this.fx.drawOver(ctx, W, H);
    this.drawCountdown(ctx);
  };

  G.drawMotes = function (ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < this.motes.length; i++) {
      var m = this.motes[i], fade = U.clamp((m.y - C.DANGER_Y + 30) / 220, 0, 1);
      ctx.globalAlpha = m.a * fade;
      ctx.drawImage(m.spr, m.x - m.s, m.y - m.s, m.s * 2, m.s * 2);
    }
    ctx.restore();
  };

  G.drawDanger = function (ctx, now) {
    var lvl = this.danger / C.OVERLOAD_TIME, y = C.DANGER_Y;
    var color = lvl > 0 ? '#FF3D6E' : this.near ? '#FF8A2A' : '#FF2BD6';
    var a = lvl > 0 ? 0.65 + 0.35 * Math.sin(now / 70) : this.near ? 0.5 + 0.25 * Math.sin(now / 160) : 0.28;
    ctx.save();
    if (lvl > 0) {
      var top = 46, g = ctx.createLinearGradient(0, top, 0, y + 200);
      g.addColorStop(0, U.rgba('#FF3D6E', 0));
      g.addColorStop(0.35, U.rgba('#FF3D6E', 0.3 * Math.min(1, lvl * 1.6)));
      g.addColorStop(1, U.rgba('#FF3D6E', 0));
      ctx.fillStyle = g; ctx.fillRect(L + 2, top, R - L - 4, y + 200 - top);
    }
    ctx.globalAlpha = a * 0.3; ctx.strokeStyle = color; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(L + 4, y); ctx.lineTo(R - 4, y); ctx.stroke();
    ctx.globalAlpha = a; ctx.lineWidth = 2.5;
    ctx.setLineDash([16, 10]); ctx.lineDashOffset = -now * 0.02;
    ctx.beginPath(); ctx.moveTo(L + 4, y); ctx.lineTo(R - 4, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = Math.min(1, a + 0.2);
    ctx.fillStyle = color; ctx.font = '700 17px Rajdhani, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('OVERLOAD LIMIT', R - 14, y - 6);
    ctx.restore();
  };

  /* Countdown drawn above the cores so nothing can hide it. */
  G.drawCountdown = function (ctx) {
    if (this.danger <= 0 || this.state !== 'playing') return;
    var secs = Math.max(0, (C.OVERLOAD_TIME - this.danger) / 1000);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 34px Orbitron, sans-serif';
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(20,2,10,0.85)';
    ctx.strokeText(secs.toFixed(1), W / 2, C.DANGER_Y + 46);
    ctx.shadowColor = '#FF3D6E'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(secs.toFixed(1), W / 2, C.DANGER_Y + 46);
    ctx.restore();
  };

  G.drawLauncher = function (ctx, now) {
    var t = T[this.cur], r = t.r, x = this.heldX(), ry = C.RAIL_Y;
    var q = U.clamp(1 - (this.readyAt - this.clock) / C.DROP_COOLDOWN, 0, 1);
    var ready = q >= 1;
    ctx.save();
    // rail
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(L + 18, ry); ctx.lineTo(R - 18, ry); ctx.stroke();
    ctx.globalAlpha = 0.35;
    for (var dx = L + 30; dx < R - 20; dx += 36) { ctx.fillStyle = '#00F0FF'; ctx.fillRect(dx - 1, ry - 1, 2, 2); }

    // aiming laser
    var hy = this.landingY(x), top = C.DROP_Y + r;
    if (hy > top + 4 && ready) {
      ctx.globalAlpha = 0.18; ctx.strokeStyle = t.color; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, hy); ctx.stroke();
      ctx.globalAlpha = 0.75; ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]); ctx.lineDashOffset = -now * 0.08;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, hy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.9; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, hy, 14 + 3 * Math.sin(now / 150), 5, 0, 0, U.TAU); ctx.stroke();
    }

    // tractor beam
    var bg = ctx.createLinearGradient(0, ry, 0, C.DROP_Y + r);
    bg.addColorStop(0, U.rgba(t.color, 0.35)); bg.addColorStop(1, U.rgba(t.color, 0));
    ctx.globalAlpha = 0.9 * q; ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(x - 8, ry + 6); ctx.lineTo(x + 8, ry + 6); ctx.lineTo(x + r * 0.9, C.DROP_Y); ctx.lineTo(x - r * 0.9, C.DROP_Y); ctx.closePath(); ctx.fill();

    // emitter head
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    var glow = NB.glowDot('#00F0FF');
    ctx.drawImage(glow, x - 30, ry - 30, 60, 60);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0B0820'; ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 20, ry - 9); ctx.lineTo(x + 20, ry - 9); ctx.lineTo(x + 11, ry + 7); ctx.lineTo(x - 11, ry + 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = ready ? '#FFFFFF' : U.rgba('#00F0FF', 0.6);
    ctx.fillRect(x - 6, ry - 2, 12 * (ready ? 1 : q), 3);
    ctx.restore();

    // held core
    var s = q < 1 ? U.easeOutBack(q) * 0.999 : 1, bob = Math.sin(now / 380) * 2.5;
    if (s > 0.02) {
      var h = r * NB.SPRITE_PAD * s, k = this.k, ang = now / 1800;
      var cy = C.DROP_Y + bob, ca = Math.cos(ang), sa = Math.sin(ang);
      ctx.setTransform(k * ca, k * sa, -k * sa, k * ca, this.bx + x * k, this.by + cy * k);
      ctx.drawImage(this.sprites.core[this.cur], -h, -h, h * 2, h * 2);
      ctx.setTransform(k, 0, 0, k, this.bx, this.by);
      ctx.drawImage(this.sprites.gloss[this.cur], x - r * s, cy - r * s, r * 2 * s, r * 2 * s);
    }
  };

  G.drawOrbs = function (ctx, now) {
    var k = this.k, bx = this.bx, by = this.by, spr = this.sprites;
    for (var i = 0; i < this.orbs.length; i++) {
      var o = this.orbs[i], t = o.nb.tier, r = T[t].r, s = 1;
      if (o.nb.popAt) {
        var q = (now - o.nb.popAt) / 280;
        if (q < 1) s = 0.55 + 0.45 * U.easeOutBack(Math.max(0, q)); else o.nb.popAt = 0;
      }
      var x = o.position.x, y = o.position.y, h = r * NB.SPRITE_PAD * s;
      var ca = Math.cos(o.angle), sa = Math.sin(o.angle);
      ctx.setTransform(k * ca, k * sa, -k * sa, k * ca, bx + x * k, by + y * k);
      ctx.drawImage(spr.core[t], -h, -h, h * 2, h * 2);
      ctx.setTransform(k, 0, 0, k, bx, by);
      ctx.drawImage(spr.gloss[t], x - r * s, y - r * s, r * 2 * s, r * 2 * s);
      if (o.nb.over) {
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now / 80);
        ctx.strokeStyle = '#FF3D6E'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, r + 5, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  };

  NB.Game = Game;
})(window.NB);
