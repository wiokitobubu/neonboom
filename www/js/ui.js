/* ==========================================================================
   NEON BOOM — interface: screens, HUD, toasts, league, settings, hero.
   ========================================================================== */
(function (NB) {
  'use strict';

  var U = NB.util, T = NB.TIERS, C = NB.CONFIG;
  function $(id) { return document.getElementById(id); }

  /* Vibration: Capacitor Haptics on the phone, navigator.vibrate elsewhere. */
  NB.haptic = function (kind) {
    if (!NB.profile.settings.haptics) return;
    var style = kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT';
    var ms = kind === 'heavy' ? 40 : kind === 'medium' ? 18 : 8;
    try {
      if (NB.native.isNative) NB.native.vibrate(style);
      else if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  };

  var SCREENS = { home: 'screenHome', pause: 'screenPause', over: 'screenOver', league: 'screenLeague', settings: 'screenSettings', confirm: 'screenConfirm' };
  var ui = NB.ui = { stack: ['home'], scoreShown: 0, scoreTarget: 0, liveRank: 0 };

  function on(id, fn) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('click', function (e) {
      NB.audio.unlock(); NB.audio.play('click'); NB.haptic('light');
      fn(e);
    });
  }
  function bump(el, cls) {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  ui.init = function (game, actions) {
    ui.game = game; ui.actions = actions;
    ui.el = {
      app: $('app'), score: $('scoreValue'), best: $('bestValue'), next: $('nextCanvas'), chain: $('chainCanvas'),
      comboPop: $('comboPop'), chipCombo: $('chipCombo'), chipComboText: $('chipComboText'), comboBar: $('comboBar'),
      chipLeague: $('chipLeague'), chipLeagueText: $('chipLeagueText'), tutorial: $('tutorial'), toasts: $('toasts')
    };

    on('btnPlay', actions.playPrimary);
    on('btnNewRun', actions.newRun);
    on('btnPause', actions.pause);
    on('btnResume', actions.resume);
    on('btnRestart', actions.restart);
    on('btnPauseSettings', function () { ui.open('settings'); });
    on('btnPauseHome', actions.pauseHome);
    on('btnAgain', actions.again);
    on('btnOverHome', actions.overHome);
    on('btnContinue', actions.continueRun);
    on('btnPolicy', function () { NB.native.openUrl(C.PRIVACY_URL); });
    on('btnAdChoices', function () { NB.ads.privacyOptions(); });
    NB.bus.on('adsPrivacy', function (req) { $('btnAdChoices').hidden = !req; });
    on('chipLeague', function () { actions.pause(); ui.openLeague(); });
    on('homeLeague', function () { ui.openLeague(); });
    on('homeSettings', function () { ui.open('settings'); });
    on('confirmNo', function () { ui.close('confirm'); });
    on('confirmYes', function () { ui.close('confirm'); var cb = ui._confirm; ui._confirm = null; if (cb) cb(); });
    on('btnReset', function () {
      ui.confirm('RESET PROGRESS?', 'Best score, league division and discovered cores will be erased.', 'RESET', function () {
        NB.resetProfile(); window.location.reload();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
      b.addEventListener('click', function () { NB.audio.play('click'); ui.close(); });
    });
    ['league', 'settings'].forEach(function (name) {
      $(SCREENS[name]).addEventListener('click', function (e) { if (e.target === e.currentTarget) ui.close(name); });
    });

    // settings
    Array.prototype.forEach.call(document.querySelectorAll('.toggle'), function (btn) {
      var key = btn.getAttribute('data-setting');
      function sync() { var v = !!NB.profile.settings[key]; btn.classList.toggle('on', v); btn.setAttribute('aria-pressed', v ? 'true' : 'false'); }
      sync();
      btn.addEventListener('click', function () {
        NB.audio.unlock();
        NB.profile.settings[key] = !NB.profile.settings[key];
        NB.saveProfile();
        NB.audio.applySettings(NB.profile.settings);
        NB.ads.syncVolume();
        NB.audio.play('click');
        if (key === 'haptics') NB.haptic('medium');
        sync();
      });
    });
    var name = $('nameInput');
    name.value = NB.profile.name;
    function saveName() {
      var v = name.value.toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 12) || 'PILOT';
      name.value = v; NB.profile.name = v; NB.saveProfile();
    }
    name.addEventListener('change', saveName);
    name.addEventListener('blur', saveName);
    name.addEventListener('keydown', function (e) { if (e.key === 'Enter') name.blur(); e.stopPropagation(); });
    $('versionText').textContent = NB.VERSION;

    // game events
    NB.bus.on('score', function (d) {
      ui.scoreTarget = d.score;
      if (d.delta > 0) bump(ui.el.score, 'bump');
      ui.el.best.textContent = U.fmt(Math.max(NB.profile.best, d.score));
      if (d.delta > 0) ui.updateLeagueChip(true);
    });
    NB.bus.on('drop', function (d) {
      NB.paintIcon(ui.el.next, ui.game.next);
      bump(ui.el.next, 'swap');
      if (d.tier != null && !NB.profile.tutorialDone) {
        NB.profile.tutorialDone = true; NB.saveProfile();
        ui.el.tutorial.classList.remove('show');
      }
    });
    NB.bus.on('combo', function (d) { ui.combo(d.combo, d.mult); });
    NB.bus.on('discover', function (tier) {
      ui.toast('<small>NEW CORE UNLOCKED</small><b>' + T[tier].name + '</b>', { icon: tier, kind: 'unlock' });
      ui.drawChain();
    });
    NB.bus.on('newBest', function () { ui.toast('<small>RECORD BROKEN</small><b>NEW BEST SCORE</b>', { kind: 'gold' }); });
    NB.bus.on('boom', function (d) { ui.toast('<small>CHAIN COMPLETE</small><b>NEON BOOM +' + U.fmt(d.points) + '</b>', { kind: 'gold' }); });
    NB.bus.on('merge', function (d) { if (d.newTier === ui.game.maxTier && d.newTier > (ui._chainMax || 0)) { ui._chainMax = d.newTier; ui.drawChain(); } });
    NB.bus.on('gameStart', function (d) {
      ui.scoreShown = d.restored ? ui.game.score : 0;
      ui.scoreTarget = ui.game.score;
      ui.el.best.textContent = U.fmt(Math.max(NB.profile.best, ui.game.score));
      ui._chainMax = ui.game.maxTier;
      ui.liveRank = 0;
      ui.updateLeagueChip(false);
      ui.drawChain();
      ui.el.chipCombo.classList.remove('show');
      ui.el.tutorial.classList.toggle('show', !NB.profile.tutorialDone);
    });
    NB.bus.on('layout', function () { NB.paintIcon(ui.el.next, ui.game.next); ui.drawChain(); });
    if (window.ResizeObserver) new ResizeObserver(function () { ui.drawChain(); }).observe(ui.el.chain);

    ui.loop();
  };

  /* ---------------- screens ---------------- */
  ui.top = function () { return ui.stack[ui.stack.length - 1]; };
  ui.isOpen = function (name) { return ui.stack.indexOf(name) >= 0; };
  ui.open = function (name, silent) {
    var el = $(SCREENS[name]);
    ui.stack = ui.stack.filter(function (n) { return n !== name; });
    ui.stack.push(name);
    el.classList.add('show');
    if (!silent && name !== 'home') NB.audio.play('open');
  };
  ui.close = function (name) {
    name = name || ui.top();
    if (!name) return;
    $(SCREENS[name]).classList.remove('show');
    ui.stack = ui.stack.filter(function (n) { return n !== name; });
  };
  ui.closeAll = function () { Object.keys(SCREENS).forEach(function (n) { $(SCREENS[n]).classList.remove('show'); }); ui.stack = []; };

  ui.back = function () {
    var top = ui.top();
    if (top === 'confirm' || top === 'league' || top === 'settings') return ui.close(top);
    if (top === 'pause') return ui.actions.resume();
    if (top === 'over') return ui.actions.overHome();
    if (top === 'home') { NB.native.exit(); return; }
    if (ui.game.state === 'playing') ui.actions.pause();
  };

  ui.confirm = function (title, text, okLabel, cb) {
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmYes').querySelector('span').textContent = okLabel || 'CONFIRM';
    ui._confirm = cb;
    ui.open('confirm');
  };

  ui.showHome = function () {
    ui.closeAll();
    ui.el.app.classList.add('is-home'); ui.el.app.classList.remove('is-playing');
    ui.open('home', true);
    ui.refreshHome();
    ui.hero.start();
    NB.audio.setMode('menu');
  };
  ui.hideHome = function () {
    ui.close('home');
    ui.el.app.classList.remove('is-home'); ui.el.app.classList.add('is-playing');
    ui.hero.stop();
  };
  ui.refreshHome = function () {
    var run = NB.store.get('run', null), has = !!(run && run.orbs && (run.orbs.length || run.score));
    $('btnPlayText').innerHTML = has ? 'CONTINUE <small>' + U.fmt(run.score || 0) + '</small>' : 'PLAY';
    $('btnNewRun').style.display = has ? '' : 'none';
    $('homeBest').textContent = U.fmt(NB.profile.best);
    $('homeCore').textContent = T[NB.profile.maxTier].name;
    $('homeRuns').textContent = U.fmt(NB.profile.games);
    var st = NB.league.standings(0);
    $('homeLeagueText').textContent = st.div.name + ' · #' + st.you;
  };

  /* ---------------- HUD ---------------- */
  ui.loop = function () {
    requestAnimationFrame(ui.loop);
    var d = ui.scoreTarget - ui.scoreShown;
    ui.scoreShown = Math.abs(d) < 0.5 ? ui.scoreTarget : ui.scoreShown + d * 0.16;
    var v = Math.round(ui.scoreShown);
    if (v !== ui._shown) { ui._shown = v; ui.el.score.textContent = U.fmt(v); }
  };

  ui.updateLeagueChip = function (live) {
    var st = NB.league.standings(ui.game.score);
    ui.el.chipLeagueText.textContent = '#' + st.you + ' ' + st.div.name;
    ui.el.chipLeague.style.setProperty('--div', st.div.color);
    if (live && ui.liveRank && st.you < ui.liveRank) {
      bump(ui.el.chipLeague, 'flash');
      ui.toast('<small>NEON LEAGUE</small><b>RANK UP · #' + st.you + '</b>', { kind: 'rank', ms: 1600 });
    }
    ui.liveRank = st.you;
  };

  ui.combo = function (n, mult) {
    var el = ui.el.comboPop;
    el.innerHTML = '<span class="cp-k">COMBO</span><span class="cp-x">×' + n + '</span>';
    el.className = 'combo-pop lvl' + Math.min(5, n);
    void el.offsetWidth;
    el.classList.add('show');
    ui.el.chipComboText.textContent = 'SCORE ×' + (+mult.toFixed(2));
    ui.el.chipCombo.classList.add('show');
    var bar = ui.el.comboBar;
    bar.style.animation = 'none'; void bar.offsetWidth;
    bar.style.animation = 'drain ' + C.COMBO_WINDOW + 'ms linear forwards';
    clearTimeout(ui._comboT);
    ui._comboT = setTimeout(function () { ui.el.chipCombo.classList.remove('show'); }, C.COMBO_WINDOW + 120);
  };

  ui.toast = function (html, opts) {
    opts = opts || {};
    var box = ui.el.toasts;
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    var el = document.createElement('div');
    el.className = 'toast ' + (opts.kind || '');
    el.innerHTML = (opts.icon != null ? '<canvas class="toast-icon"></canvas>' : '<i class="toast-dot"></i>') + '<div class="toast-body">' + html + '</div>';
    box.appendChild(el);
    if (opts.icon != null) NB.paintIcon(el.querySelector('canvas'), opts.icon);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show'); el.classList.add('hide');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
    }, opts.ms || 2600);
  };

  /* Evolution chain along the bottom. */
  ui.drawChain = function () {
    var cv = ui.el.chain, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(C.MAX_DPR, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var n = T.length, gap = 5;
    var wts = T.map(function (t, i) { return 0.55 + 0.45 * i / (n - 1); });
    var sum = wts.reduce(function (a, b) { return a + b; }, 0);
    var unit = Math.min((w - 24 - gap * (n - 1)) / (2 * sum), (h * 0.34) / wts[n - 1]);
    var total = 2 * unit * sum + gap * (n - 1), x = (w - total) / 2, cy = h / 2;
    var runMax = ui.game && ui.game.state !== 'idle' ? ui.game.maxTier : -1;
    for (var i = 0; i < n; i++) {
      var r = unit * wts[i], cx = x + r;
      if (NB.profile.discovered[i]) {
        ctx.save(); ctx.translate(cx, cy);
        ctx.globalAlpha = i <= runMax || runMax < 0 ? 1 : 0.55;
        NB.drawCore(ctx, i, r, dpr); NB.drawGloss(ctx, r);
        ctx.restore();
        if (i === runMax) {
          ctx.beginPath(); ctx.arc(cx, cy, r + 3.5, 0, U.TAU);
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4; ctx.stroke();
        }
      } else {
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.88, 0, U.TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill();
        ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(180,170,255,0.38)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(200,190,255,0.55)'; ctx.font = '700 ' + Math.round(r * 0.95) + 'px Rajdhani, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', cx, cy + 1);
        ctx.restore();
      }
      x += r * 2 + gap;
    }
  };

  /* ---------------- league ---------------- */
  ui.openLeague = function () {
    var g = ui.game, live = (g.state === 'playing' || g.state === 'paused') ? g.score : 0;
    var st = NB.league.standings(live), lg = NB.league;
    var divEl = $('lgDivision');
    divEl.textContent = st.div.name + ' DIVISION';
    divEl.style.setProperty('--div', st.div.color);
    $('lgTime').textContent = lg.timeLeft();
    var total = st.list.length;
    var html = st.list.map(function (r) {
      var zone = r.rank <= lg.PROMOTE ? ' zone-up' : (st.division > 0 && r.rank > total - lg.DEMOTE ? ' zone-down' : '');
      var medal = r.rank <= 3 ? ' medal m' + r.rank : '';
      return '<li class="lg-row' + (r.you ? ' is-you' : '') + zone + '">' +
        '<span class="lg-rank' + medal + '">' + r.rank + '</span>' +
        '<span class="lg-av" style="--c:' + r.color + '">' + r.name.charAt(0) + '</span>' +
        '<span class="lg-name">' + r.name + (r.you ? ' <i class="tag-you">YOU</i>' : ' <i class="tag-ai">AI</i>') + '</span>' +
        '<span class="lg-score">' + U.fmt(r.score) + '</span></li>';
    }).join('');
    var list = $('lgList');
    list.innerHTML = html;
    ui.open('league');
    requestAnimationFrame(function () {
      var me = list.querySelector('.is-you');
      if (me) list.scrollTop = me.offsetTop - list.clientHeight / 2 + me.clientHeight / 2;
    });
  };

  /* ---------------- game over ---------------- */
  /* "Continue" button: shown once per run, pulses while the ad loads. */
  ui.setContinue = function (offer) {
    var acts = $('overActions'), again = $('btnAgain');
    $('btnContinue').hidden = !offer;
    acts.classList.toggle('has-continue', !!offer);
    again.classList.toggle('btn-primary', !offer);
    again.classList.toggle('btn-ghost', !!offer);
    ui.continueBusy(false);
  };
  ui.continueBusy = function (on) {
    var b = $('btnContinue');
    b.disabled = !!on;
    b.classList.toggle('loading', !!on);
  };

  ui.showOver = function (sum, lr, canContinue) {
    ui.setContinue(canContinue);
    setTimeout(function () {
      $('overBest').textContent = U.fmt(NB.profile.best);
      $('overCore').textContent = T[sum.maxTier].name;
      $('overMerges').textContent = U.fmt(sum.merges);
      $('overRank').textContent = '#' + lr.after;
      $('overBadge').classList.toggle('show', !!sum.newBest);
      var msg;
      if (lr.after < lr.before) msg = 'You climbed <b>' + (lr.before - lr.after) + '</b> place' + (lr.before - lr.after > 1 ? 's' : '') + ' to <b>#' + lr.after + '</b> in the Neon League';
      else if (lr.ahead) msg = '<b>' + lr.ahead.name + '</b> <i class="tag-ai">AI</i> is only <b>' + U.fmt(lr.ahead.gap) + '</b> pts ahead of you';
      else msg = 'You are <b>#1</b> in the Neon League';
      $('overMsg').innerHTML = msg;
      ui.open('over');
      var el = $('overScore'), t0 = performance.now(), target = sum.score;
      (function tick(t) {
        var q = Math.min(1, (t - t0) / 1100);
        el.textContent = U.fmt(target * U.easeOutCubic(q));
        if (q < 1) requestAnimationFrame(tick);
      })(t0);
    }, 950);
  };

  /* ---------------- home hero animation ---------------- */
  ui.hero = {
    running: false, sprites: null, ps: 0,
    start: function () {
      if (this.running) return;
      this.running = true;
      var self = this;
      (function loop(t) {
        if (!self.running) return;
        self.draw(t);
        requestAnimationFrame(loop);
      })(performance.now());
    },
    stop: function () { this.running = false; },
    draw: function (t) {
      var cv = $('heroCanvas'), w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      var dpr = Math.min(C.MAX_DPR, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      var R0 = Math.min(w * 0.5, h) * 0.34, ps = dpr * R0 / T[NB.MAX_TIER].r;
      if (!this.sprites || Math.abs(ps - this.ps) / ps > 0.1) { this.sprites = new NB.SpriteSet(ps); this.ps = ps; }
      var ctx = cv.getContext('2d'), spr = this.sprites;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2, rx = Math.min(w * 0.46, R0 * 2.5), ry = rx * 0.3, tilt = -0.22;
      var ct = Math.cos(tilt), stt = Math.sin(tilt);

      ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
      ctx.strokeStyle = 'rgba(155,107,255,0.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, U.TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,240,255,0.16)';
      ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, U.TAU); ctx.stroke();
      ctx.restore();

      var orb = [];
      for (var i = 0; i < 7; i++) {
        var ring = i % 2 ? 0.72 : 1, ang = t * 0.00028 * (i % 2 ? -1.25 : 1) + i * U.TAU / 7;
        var ex = Math.cos(ang) * rx * ring, ey = Math.sin(ang) * ry * ring;
        orb.push({ tier: i, x: cx + ex * ct - ey * stt, y: cy + ex * stt + ey * ct, depth: Math.sin(ang), rot: t * 0.0006 * (i + 1) });
      }
      orb.sort(function (a, b) { return a.depth - b.depth; });
      function drawOrb(o) {
        var d = R0 * (0.15 + 0.035 * o.tier) * (0.78 + 0.22 * (o.depth + 1) / 2), hh = d * NB.SPRITE_PAD;
        ctx.save(); ctx.globalAlpha = 0.55 + 0.45 * (o.depth + 1) / 2;
        ctx.translate(o.x, o.y); ctx.rotate(o.rot);
        ctx.drawImage(spr.core[o.tier], -hh, -hh, hh * 2, hh * 2);
        ctx.restore();
      }
      orb.forEach(function (o) { if (o.depth < 0) drawOrb(o); });
      var pulse = 1 + Math.sin(t / 700) * 0.018, H0 = R0 * NB.SPRITE_PAD * pulse;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.00018);
      ctx.drawImage(spr.core[NB.MAX_TIER], -H0, -H0, H0 * 2, H0 * 2);
      ctx.restore();
      ctx.drawImage(spr.gloss[NB.MAX_TIER], cx - R0 * pulse, cy - R0 * pulse, R0 * 2 * pulse, R0 * 2 * pulse);
      orb.forEach(function (o) { if (o.depth >= 0) drawOrb(o); });
    }
  };
})(window.NB);
