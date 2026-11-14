/* ==========================================================================
   NEON BOOM — procedural art. Every core is drawn by code (no images),
   then baked once into sprites so the game stays smooth on any phone.
   ========================================================================== */
(function (NB) {
  'use strict';

  var U = NB.util, TAU = U.TAU, T = NB.TIERS;

  function poly(ctx, n, r, rot) {
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var a = rot + (i / n) * TAU;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function star(ctx, n, ro, ri, rot) {
    ctx.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var a = rot + (i / (n * 2)) * TAU, r = i % 2 ? ri : ro;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function disc(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

  /* Neon-tube stroke: coloured glow + hot white core. */
  function neon(ctx, color, w, blur, bs) {
    ctx.shadowColor = color; ctx.shadowBlur = blur * bs;
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
    ctx.shadowBlur = blur * 0.4 * bs;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = w * 0.38; ctx.stroke();
  }

  function glyph(ctx, t, r, bs) {
    var g = r * 0.5, c = t.color, w = Math.max(1, r * 0.075);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (t.glyph) {
      case 'dot':
        ctx.shadowColor = c; ctx.shadowBlur = r * 0.6 * bs;
        ctx.fillStyle = '#FFFFFF'; disc(ctx, 0, 0, g * 0.42); ctx.fill();
        disc(ctx, 0, 0, g * 0.95); neon(ctx, c, w * 0.7, r * 0.3, bs);
        break;
      case 'orbit':
        ctx.save(); ctx.scale(1, 0.42); disc(ctx, 0, 0, g * 1.05); ctx.restore(); neon(ctx, c, w * 0.8, r * 0.3, bs);
        ctx.save(); ctx.rotate(Math.PI / 2); ctx.scale(1, 0.42); disc(ctx, 0, 0, g * 1.05); ctx.restore(); neon(ctx, c, w * 0.8, r * 0.3, bs);
        ctx.shadowBlur = r * 0.5 * bs; ctx.fillStyle = '#FFFFFF'; disc(ctx, 0, 0, g * 0.26); ctx.fill();
        break;
      case 'tri':
        poly(ctx, 3, g * 1.05, -Math.PI / 2); neon(ctx, c, w, r * 0.3, bs);
        poly(ctx, 3, g * 0.42, Math.PI / 2); neon(ctx, c, w * 0.6, r * 0.2, bs);
        break;
      case 'triad':
        disc(ctx, 0, 0, g * 0.95); neon(ctx, c, w * 0.6, r * 0.25, bs);
        for (var i = 0; i < 3; i++) {
          var a = -Math.PI / 2 + i * TAU / 3;
          ctx.shadowColor = c; ctx.shadowBlur = r * 0.4 * bs; ctx.fillStyle = '#FFFFFF';
          disc(ctx, Math.cos(a) * g * 0.55, Math.sin(a) * g * 0.55, g * 0.22); ctx.fill();
        }
        break;
      case 'diamond':
        poly(ctx, 4, g * 1.0, 0); neon(ctx, c, w, r * 0.3, bs);
        ctx.beginPath(); ctx.moveTo(-g * 1.35, 0); ctx.lineTo(-g * 0.55, 0); ctx.moveTo(g * 0.55, 0); ctx.lineTo(g * 1.35, 0);
        neon(ctx, c, w * 0.6, r * 0.25, bs);
        ctx.shadowBlur = r * 0.4 * bs; ctx.fillStyle = '#FFFFFF'; poly(ctx, 4, g * 0.3, 0); ctx.fill();
        break;
      case 'hex':
        poly(ctx, 6, g * 1.05, Math.PI / 6); neon(ctx, c, w, r * 0.3, bs);
        poly(ctx, 6, g * 0.55, 0); neon(ctx, c, w * 0.7, r * 0.2, bs);
        ctx.shadowBlur = r * 0.35 * bs; ctx.fillStyle = '#FFFFFF'; disc(ctx, 0, 0, g * 0.14); ctx.fill();
        break;
      case 'spiral':
        ctx.beginPath();
        for (var s = 0; s <= 90; s++) {
          var k = s / 90, ang = k * TAU * 2.25, rr = g * 0.08 + g * 1.0 * k;
          if (s === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        neon(ctx, c, w * 0.9, r * 0.3, bs);
        break;
      case 'star':
        star(ctx, 5, g * 1.1, g * 0.46, -Math.PI / 2); neon(ctx, c, w, r * 0.3, bs);
        ctx.shadowBlur = r * 0.35 * bs; ctx.fillStyle = '#FFFFFF'; disc(ctx, 0, 0, g * 0.16); ctx.fill();
        break;
      case 'planet':
        disc(ctx, 0, 0, g * 0.62); neon(ctx, c, w, r * 0.3, bs);
        ctx.save(); ctx.rotate(-0.42); ctx.scale(1, 0.3);
        ctx.beginPath(); ctx.arc(0, 0, g * 1.25, Math.PI * 0.08, Math.PI * 0.92, true); ctx.restore();
        neon(ctx, c, w * 0.8, r * 0.25, bs);
        break;
      case 'burst':
        star(ctx, 8, g * 1.15, g * 0.5, -Math.PI / 2); neon(ctx, c, w * 0.9, r * 0.3, bs);
        disc(ctx, 0, 0, g * 0.3); neon(ctx, c, w * 0.7, r * 0.25, bs);
        break;
      case 'singularity':
        // event horizon: a black core inside a white-hot accretion ring
        ctx.shadowBlur = 0;
        var bh = ctx.createRadialGradient(0, 0, 0, 0, 0, g * 1.05);
        bh.addColorStop(0, '#000000'); bh.addColorStop(0.72, '#05010B'); bh.addColorStop(0.86, 'rgba(255,255,255,0.85)'); bh.addColorStop(1, 'rgba(185,140,255,0)');
        ctx.fillStyle = bh; disc(ctx, 0, 0, g * 1.05); ctx.fill();
        ctx.save(); ctx.rotate(0.35); ctx.scale(1, 0.26); disc(ctx, 0, 0, g * 1.45); ctx.restore();
        neon(ctx, '#FF4FD8', w * 0.7, r * 0.25, bs);
        ctx.save(); ctx.rotate(-0.6); ctx.scale(1, 0.22); disc(ctx, 0, 0, g * 1.3); ctx.restore();
        neon(ctx, '#3FF3FF', w * 0.55, r * 0.2, bs);
        break;
    }
    ctx.shadowBlur = 0;
  }

  /* Draws one core centred at (0,0) with radius r. bs = pixels per unit (for blur). */
  NB.drawCore = function (ctx, tier, r, bs) {
    var t = T[tier], c = t.color, last = tier === NB.MAX_TIER;
    bs = bs || 1;
    ctx.save();

    // outer halo
    var halo = ctx.createRadialGradient(0, 0, r * 0.75, 0, 0, r * 1.45);
    halo.addColorStop(0, U.rgba(t.glow, 0.42)); halo.addColorStop(0.4, U.rgba(t.glow, 0.13)); halo.addColorStop(1, U.rgba(t.glow, 0));
    ctx.fillStyle = halo; disc(ctx, 0, 0, r * 1.45); ctx.fill();

    // glass body
    var body = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.05, 0, 0, r);
    if (last) {
      body.addColorStop(0, '#2A1B4A'); body.addColorStop(0.6, '#0D0620'); body.addColorStop(1, '#030108');
    } else {
      body.addColorStop(0, U.rgba(t.light, 0.62)); body.addColorStop(0.42, U.rgba(c, 0.34)); body.addColorStop(0.85, U.rgba(t.deep, 0.92)); body.addColorStop(1, U.rgba(t.deep, 0.98));
    }
    ctx.fillStyle = body; disc(ctx, 0, 0, r * 0.95); ctx.fill();

    // inner energy fog
    var fog = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.8);
    fog.addColorStop(0, U.rgba(t.glow, last ? 0.35 : 0.28)); fog.addColorStop(1, U.rgba(t.glow, 0));
    ctx.fillStyle = fog; disc(ctx, 0, 0, r * 0.8); ctx.fill();

    // rim
    disc(ctx, 0, 0, r * 0.92);
    if (last && ctx.createConicGradient) {
      var cg = ctx.createConicGradient(0, 0, 0);
      ['#FF2BD6', '#9B6BFF', '#00F0FF', '#2BFFD0', '#FFD640', '#FF8A2A', '#FF2BD6'].forEach(function (col, i, arr) { cg.addColorStop(i / (arr.length - 1), col); });
      ctx.shadowColor = '#B98CFF'; ctx.shadowBlur = r * 0.3 * bs;
      ctx.strokeStyle = cg; ctx.lineWidth = r * 0.1; ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = r * 0.025; ctx.stroke();
    } else {
      neon(ctx, c, Math.max(1.2, r * 0.085), r * 0.32, bs);
    }

    // tick marks on the rim: gives a "machined" futuristic look
    ctx.shadowBlur = 0;
    ctx.strokeStyle = U.rgba(t.light, 0.55); ctx.lineWidth = Math.max(0.6, r * 0.018);
    var ticks = 6 + tier;
    for (var i = 0; i < ticks; i++) {
      var a = (i / ticks) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
      ctx.lineTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84);
      ctx.stroke();
    }

    glyph(ctx, t, r, bs);
    ctx.restore();
  };

  /* Glossy highlight that does NOT rotate with the core (fixed light source). */
  NB.drawGloss = function (ctx, r) {
    ctx.save();
    ctx.translate(-r * 0.32, -r * 0.42); ctx.rotate(-0.55); ctx.scale(1, 0.5);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0.42)'); g.addColorStop(0.55, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; disc(ctx, 0, 0, r * 0.5); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.86, Math.PI * 0.15, Math.PI * 0.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = r * 0.04; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  };

  NB.SPRITE_PAD = 1.5; // sprite half-size = r * SPRITE_PAD

  /* Bakes all tiers at a given pixel density. */
  NB.SpriteSet = function (ps) {
    this.ps = ps; this.core = []; this.gloss = [];
    for (var i = 0; i < T.length; i++) {
      var r = T[i].r, half = r * NB.SPRITE_PAD, size = Math.max(8, Math.ceil(half * 2 * ps));
      var cv = document.createElement('canvas'); cv.width = cv.height = size;
      var c = cv.getContext('2d');
      c.translate(size / 2, size / 2); c.scale(size / (half * 2), size / (half * 2));
      NB.drawCore(c, i, r, ps);
      this.core.push(cv);

      var gs = Math.max(4, Math.ceil(r * 2 * ps));
      var gv = document.createElement('canvas'); gv.width = gv.height = gs;
      var gc = gv.getContext('2d');
      gc.translate(gs / 2, gs / 2); gc.scale(gs / (r * 2), gs / (r * 2));
      NB.drawGloss(gc, r);
      this.gloss.push(gv);
    }
  };

  /* Soft additive glow dot, cached per colour (particles, motes). */
  var dotCache = {};
  NB.glowDot = function (color) {
    if (dotCache[color]) return dotCache[color];
    var s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    var c = cv.getContext('2d'), g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, U.rgba(color, 0.95)); g.addColorStop(0.45, U.rgba(color, 0.35)); g.addColorStop(1, U.rgba(color, 0));
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    dotCache[color] = cv;
    return cv;
  };

  /* Draws a core icon into a small DOM canvas (NEXT preview, chain, menus). */
  NB.paintIcon = function (canvas, tier, opts) {
    opts = opts || {};
    var dpr = Math.min(NB.CONFIG.MAX_DPR, window.devicePixelRatio || 1);
    var w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (tier == null) return;
    var r = Math.min(w, h) / 2 / NB.SPRITE_PAD * (opts.scale || 1), k = dpr;
    ctx.setTransform(k, 0, 0, k, (w / 2) * k, (h / 2) * k);
    NB.drawCore(ctx, tier, r, k);
    NB.drawGloss(ctx, r);
  };
})(window.NB);
