/* ==========================================================================
   NEON BOOM — visual effects: particles, shockwaves, score pops,
   merge "ghosts", flashes and screen shake. All in world units, ms.
   ========================================================================== */
(function (NB) {
  'use strict';

  var U = NB.util, T = NB.TIERS, TAU = U.TAU;
  var RAINBOW = ['#FF2BD6', '#9B6BFF', '#00F0FF', '#2BFFD0', '#FFD640', '#FF8A2A', '#FFFFFF'];

  /* Glowing text, drawn ONCE into a small bitmap. A canvas blur (shadowBlur)
     costs a GPU pass every time it is drawn; a baked bitmap is just copied.
     o: { size, fill, glow, blur, stroke, strokeW, sheen }; k = pixels per world unit. */
  NB.bakeText = function (str, o, k) {
    var pad = Math.ceil((o.blur || 0) + (o.strokeW || 0)) + 4;
    var c = document.createElement('canvas'), x = c.getContext('2d');
    var font = '900 ' + o.size + 'px Orbitron, sans-serif';
    x.font = font;
    var w = Math.ceil(x.measureText(str).width) + pad * 2, h = Math.ceil(o.size * 1.25) + pad * 2;
    c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
    x.scale(k, k);
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (o.stroke) { x.lineWidth = o.strokeW || 6; x.lineJoin = 'round'; x.strokeStyle = o.stroke; x.strokeText(str, w / 2, h / 2); }
    if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = (o.blur || 14) * k; }
    x.fillStyle = o.fill; x.fillText(str, w / 2, h / 2);
    x.shadowBlur = 0;
    if (o.sheen) { x.fillStyle = o.sheen; x.fillText(str, w / 2, h / 2); }
    return { img: c, w: w, h: h, k: k };
  };

  function FX() {
    this.parts = []; this.rings = []; this.texts = []; this.ghosts = []; this.delayed = [];
    this.flashA = 0; this.flashColor = '#FFFFFF';
    this.shakeAmp = 0; this.sx = 0; this.sy = 0;
    this.k = 1; // canvas pixels per world unit, set by the game
  }

  FX.prototype.burst = function (x, y, color, n, speed, size, life, opts) {
    opts = opts || {};
    var spr = NB.glowDot(color), max = NB.perf.q().parts;
    for (var i = 0; i < n && this.parts.length < max; i++) {
      var a = Math.random() * TAU, v = speed * U.rand(0.25, 1);
      this.parts.push({
        x: x + Math.cos(a) * (opts.spread || 0), y: y + Math.sin(a) * (opts.spread || 0),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.lift || 0),
        life: 0, max: life * U.rand(0.55, 1.25), size: size * U.rand(0.45, 1.3),
        spr: spr, g: opts.gravity == null ? 0.0007 : opts.gravity, drag: opts.drag || 0.0028
      });
    }
  };
  FX.prototype.ring = function (x, y, r0, r1, color, width, life, delay) {
    this.rings.push({ x: x, y: y, r0: r0, r1: r1, color: color, w: width, life: -(delay || 0), max: life });
  };
  FX.prototype.text = function (x, y, str, color, size, life) {
    this.texts.push({ x: x, y: y, s: str, color: color, size: size || 34, life: 0, max: life || 900 });
  };
  FX.prototype.ghost = function (tier, from, angle, to) {
    this.ghosts.push({ tier: tier, x0: from.x, y0: from.y, x1: to.x, y1: to.y, a: angle, life: 0, max: 110 });
  };
  FX.prototype.flash = function (color, a) { this.flashColor = color; this.flashA = Math.max(this.flashA, a); };
  FX.prototype.shake = function (amp) { this.shakeAmp = Math.max(this.shakeAmp, amp); };
  FX.prototype.later = function (ms, fn) { this.delayed.push({ t: ms, fn: fn }); };

  FX.prototype.merge = function (x, y, tier, combo) {
    var t = T[tier], r = t.r, self = this;
    this.burst(x, y, t.color, 16 + tier * 4, 0.22 + tier * 0.025, 9 + tier * 1.2, 650, { spread: r * 0.4 });
    this.burst(x, y, '#FFFFFF', 6 + tier, 0.32 + tier * 0.02, 5, 380, { spread: r * 0.2 });
    this.ring(x, y, r * 0.55, r * 1.9, t.color, 5 + tier * 0.6, 420);
    if (tier >= 4) this.ring(x, y, r * 0.4, r * 2.6, '#FFFFFF', 2.5, 560, 60);
    if (tier >= 6) {
      this.shake(3 + tier * 0.9);
      this.flash(t.color, 0.12 + tier * 0.012);
      this.later(80, function () { self.burst(x, y, t.color, 24, 0.55, 12, 900, { spread: r * 0.6 }); });
    }
    if (combo >= 3) this.ring(x, y, r, r * 3.2, '#FFFFFF', 1.5, 700, 30);
  };

  FX.prototype.boom = function (x, y) {
    var self = this;
    RAINBOW.forEach(function (c, i) {
      self.burst(x, y, c, 34, 0.75 + i * 0.05, 16, 1400, { spread: 40, gravity: 0.0003, drag: 0.0018 });
    });
    for (var k = 0; k < 4; k++) this.ring(x, y, 40, 520 + k * 160, RAINBOW[k * 2 % RAINBOW.length], 14 - k * 3, 900 + k * 220, k * 120);
    this.flash('#FFFFFF', 0.85);
    this.shake(26);
    this.later(250, function () { self.burst(x, y, '#FFFFFF', 60, 1.1, 8, 1100, { spread: 120 }); });
  };

  FX.prototype.update = function (dt) {
    var i, p;
    for (i = this.delayed.length - 1; i >= 0; i--) {
      this.delayed[i].t -= dt;
      if (this.delayed[i].t <= 0) { var fn = this.delayed[i].fn; this.delayed.splice(i, 1); fn(); }
    }
    for (i = this.parts.length - 1; i >= 0; i--) {
      p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      var d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (i = this.rings.length - 1; i >= 0; i--) { this.rings[i].life += dt; if (this.rings[i].life >= this.rings[i].max) this.rings.splice(i, 1); }
    for (i = this.texts.length - 1; i >= 0; i--) { this.texts[i].life += dt; if (this.texts[i].life >= this.texts[i].max) this.texts.splice(i, 1); }
    for (i = this.ghosts.length - 1; i >= 0; i--) { this.ghosts[i].life += dt; if (this.ghosts[i].life >= this.ghosts[i].max) this.ghosts.splice(i, 1); }
    this.flashA *= Math.exp(-dt / 140);
    if (this.flashA < 0.004) this.flashA = 0;
    this.shakeAmp *= Math.exp(-dt / 120);
    if (this.shakeAmp < 0.2) this.shakeAmp = 0;
    this.sx = (Math.random() * 2 - 1) * this.shakeAmp;
    this.sy = (Math.random() * 2 - 1) * this.shakeAmp;
  };

  FX.prototype.drawUnder = function (ctx, sprites) {
    // merge ghosts: the two parents slide into each other
    for (var i = 0; i < this.ghosts.length; i++) {
      var g = this.ghosts[i], k = U.easeOutCubic(g.life / g.max), r = T[g.tier].r * NB.SPRITE_PAD * (1 - k * 0.35);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(U.lerp(g.x0, g.x1, k), U.lerp(g.y0, g.y1, k)); ctx.rotate(g.a);
      ctx.drawImage(sprites.core[g.tier], -r, -r, r * 2, r * 2);
      ctx.restore();
    }
  };

  FX.prototype.drawOver = function (ctx, W, H) {
    var i;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < this.rings.length; i++) {
      var r = this.rings[i];
      if (r.life < 0) continue;
      var k = r.life / r.max, e = U.easeOutCubic(k);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.beginPath(); ctx.arc(r.x, r.y, U.lerp(r.r0, r.r1, e), 0, TAU);
      ctx.strokeStyle = r.color; ctx.lineWidth = r.w * (1 - k * 0.7); ctx.stroke();
    }
    for (i = 0; i < this.parts.length; i++) {
      var p = this.parts[i], a = 1 - p.life / p.max, s = p.size * (0.5 + a * 0.5);
      ctx.globalAlpha = a;
      ctx.drawImage(p.spr, p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.restore();

    if (this.texts.length) {
      ctx.save();
      for (i = 0; i < this.texts.length; i++) {
        var t = this.texts[i], q = t.life / t.max;
        var pop = q < 0.18 ? U.easeOutBack(q / 0.18) : 1;
        if (!t.b || t.b.k !== this.k) {
          t.b = NB.bakeText(t.s, { size: t.size, fill: t.color, glow: t.color, blur: 14 / this.k, stroke: 'rgba(5,2,16,0.85)', strokeW: 6, sheen: 'rgba(255,255,255,0.38)' }, this.k);
        }
        ctx.globalAlpha = Math.max(0, q > 0.65 ? 1 - (q - 0.65) / 0.35 : 1);
        var y = t.y - U.easeOutCubic(q) * 70, bw = t.b.w * pop, bh = t.b.h * pop;
        if (bw > 0.5) ctx.drawImage(t.b.img, t.x - bw / 2, y - bh / 2, bw, bh);
      }
      ctx.restore();
    }

    if (this.flashA > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(-60, -60, W + 120, H + 120);
      ctx.restore();
    }
  };

  NB.FX = FX;
})(window.NB);
