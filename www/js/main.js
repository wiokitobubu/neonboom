/* ==========================================================================
   NEON BOOM — boot and game flow.
   ========================================================================== */
(function (NB) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function boot() {
    var game = new NB.Game($('gameCanvas'), $('stage'));
    var ui = NB.ui;

    function hasRun(run) { return !!(run && run.orbs && (run.orbs.length || run.score)); }
    function start() { ui.hideHome(); game.newGame(); }

    var actions = {
      playPrimary: function () {
        var run = NB.store.get('run', null);
        if (hasRun(run)) { ui.hideHome(); if (!game.restore(run)) game.newGame(); }
        else start();
      },
      newRun: function () { NB.store.del('run'); start(); },
      pause: function () {
        if (game.state !== 'playing') return;
        game.pause();
        ui.open('pause');
      },
      resume: function () { ui.close('pause'); game.resume(); },
      restart: function () {
        ui.confirm('RESTART RUN?', 'Your current run will be lost.', 'RESTART', function () {
          ui.close('pause');
          NB.store.del('run');
          game.toIdle(); game.purge();
          setTimeout(function () { game.newGame(); }, 350);
        });
      },
      pauseHome: function () { game.save(); game.toIdle(); ui.showHome(); },
      // Leaving the game-over screen: an interstitial may play first (every 2 runs).
      again: function () {
        if (leaving) return;
        leaving = true;
        NB.ads.betweenRuns(function () {
          leaving = false;
          ui.close('over');
          game.purge();
          setTimeout(function () { game.newGame(); }, 380);
        });
      },
      overHome: function () {
        if (leaving) return;
        leaving = true;
        NB.ads.betweenRuns(function () {
          leaving = false;
          ui.close('over'); game.purge(); game.toIdle(); ui.showHome();
        });
      },
      // Rewarded ad → the run goes on.
      continueRun: function () {
        if (leaving || game.state !== 'over') return;
        leaving = true;
        ui.continueBusy(true);
        NB.ads.rewarded('continue').then(function (ok) {
          leaving = false;
          ui.continueBusy(false);
          if (!ok || game.state !== 'over') return;
          NB.ads.noteReward();
          ui.close('over');
          setTimeout(function () { game.revive(); }, 260);
        });
      }
    };
    var leaving = false;

    ui.init(game, actions);

    // Stats are added per run, as differences, so a continued run is never counted twice.
    NB.bus.on('gameOver', function (sum) {
      var p = NB.profile, rec = game.rec;
      if (!rec.games) { p.games++; rec.games = 1; }
      p.merges += Math.max(0, sum.merges - rec.merges); rec.merges = sum.merges;
      p.booms += Math.max(0, sum.booms - rec.booms); rec.booms = sum.booms;
      if (sum.maxTier > p.maxTier) p.maxTier = sum.maxTier;
      sum.newBest = sum.score > p.best && sum.score > 0;
      if (sum.score > p.best) p.best = sum.score;
      NB.saveProfile();
      var canContinue = sum.revives < (NB.ADS_CONFIG.CONTINUES_PER_RUN || 0) && game.drops >= 3;
      ui.showOver(sum, NB.league.record(sum.score), canContinue);
    });

    // league week rollover result
    var res = NB.league.rollover() || NB.profile.league.lastResult;
    if (res && !res.shown) {
      var D = NB.league.DIVISIONS;
      setTimeout(function () {
        var txt = res.to > res.from ? 'PROMOTED TO ' + D[res.to].name : res.to < res.from ? 'DOWN TO ' + D[res.to].name : 'STAYED IN ' + D[res.to].name;
        ui.toast('<small>LAST WEEK · #' + res.rank + '</small><b>' + txt + '</b>', { kind: 'rank', ms: 3600 });
      }, 900);
      res.shown = true;
      NB.profile.league.lastResult = res;
      NB.saveProfile();
    }

    // audio needs one user gesture first (browser rule)
    document.addEventListener('pointerdown', function () { NB.audio.unlock(); }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { ui.back(); e.preventDefault(); }
    });

    // background / foreground (phone lock, app switch, full-screen ads)
    function toBackground() {
      if (game.state === 'playing' && !NB.ads.busy) actions.pause();
      game.save();
      NB.audio.suspend();
    }
    function toForeground() { if (!NB.ads.busy) NB.audio.resume(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) toBackground(); else toForeground(); });
    window.addEventListener('pagehide', function () { game.save(); });
    NB.native.on('App', 'pause', toBackground);
    NB.native.on('App', 'resume', toForeground);

    // Android back button / back gesture
    NB.native.on('App', 'backButton', function () { if (!NB.ads.busy) ui.back(); });

    ui.showHome();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ui.drawChain(); NB.paintIcon($('nextCanvas'), game.next); });

    NB.app = { game: game, actions: actions };

    // The native splash fades out once the first frame is on screen, then ads start.
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      NB.native.hideSplash();
      setTimeout(NB.ads.init, 400);
    }); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.NB);
