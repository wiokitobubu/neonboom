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
      again: function () {
        ui.close('over');
        game.purge();
        setTimeout(function () { game.newGame(); }, 380);
      },
      overHome: function () { ui.close('over'); game.purge(); game.toIdle(); ui.showHome(); }
    };

    ui.init(game, actions);

    NB.bus.on('gameOver', function (sum) {
      var p = NB.profile;
      p.games++;
      p.merges += sum.merges;
      p.booms += sum.booms;
      if (sum.maxTier > p.maxTier) p.maxTier = sum.maxTier;
      sum.newBest = sum.score > p.best && sum.score > 0;
      if (sum.score > p.best) p.best = sum.score;
      NB.saveProfile();
      ui.showOver(sum, NB.league.record(sum.score));
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

    // background / foreground (phone lock, app switch)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (game.state === 'playing') actions.pause();
        game.save();
        NB.audio.suspend();
      } else {
        NB.audio.resume();
      }
    });
    window.addEventListener('pagehide', function () { game.save(); });

    // Android hardware back button (Capacitor App plugin, Step 5)
    var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.addListener) App.addListener('backButton', function () { ui.back(); });

    ui.showHome();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ui.drawChain(); NB.paintIcon($('nextCanvas'), game.next); });

    NB.app = { game: game, actions: actions };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.NB);
