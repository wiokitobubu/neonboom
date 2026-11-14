/* ==========================================================================
   NEON BOOM — AdMob (Google Mobile Ads) through @capacitor-community/admob.
     · a banner fixed at the bottom of the screen
     · one interstitial every 2 finished runs, never right after launch
     · a rewarded "Continue" at game over (and later: the rewarded shop)
     · Google's consent form (GDPR / US states) before any ad is requested
   In a desktop browser nothing is shown, except the rewarded flow, which is
   simulated so it can be tested. Add ?ads to the address to simulate all of it.
   IDs and options: js/ads-config.js
   ========================================================================== */
(function (NB) {
  'use strict';

  var CFG = NB.ADS_CONFIG || {}, N = NB.native;
  var EV = {
    bannerSize: 'bannerAdSizeChanged', bannerFail: 'bannerAdFailedToLoad',
    interDismissed: 'interstitialAdDismissed', interFailShow: 'interstitialAdFailedToShow',
    rewardEarned: 'onRewardedVideoAdReward', rewardDismissed: 'onRewardedVideoAdDismissed', rewardFailShow: 'onRewardedVideoAdFailedToShow'
  };

  var A = null;                                   // the native AdMob plugin
  var st = NB.store.get('ads', null) || { runs: 0 };
  var lastFull = Date.now();                      // no full-screen ad in the first minute
  var inter = { loaded: false, loading: false, retry: 0, done: null };
  var reward = { loaded: false, loading: null, retry: 0, earned: false, done: null };
  var bannerTimer = 0;

  function saveSt() { NB.store.set('ads', st); }
  function warn(what, e) { console.warn('[ads] ' + what + ': ' + (e && (e.message || e.code) || e)); }
  function once(fn) { var done = false; return function () { if (done) return; done = true; if (fn) fn.apply(null, arguments); }; }
  function testing() { return !!CFG.TEST_MODE; }

  var ads = NB.ads = {
    mode: 'web',             // native (the Android app) | sim (browser + ?ads) | web (browser)
    ready: false,            // SDK initialised and allowed to request ads
    privacyRequired: false,  // the player must be able to reopen the consent choices
    busy: false,             // a full-screen ad is on screen
    bannerH: 0
  };
  if (N.isNative && N.plugin('AdMob')) ads.mode = 'native';
  else if (/[?&]ads\b/.test(location.search)) ads.mode = 'sim';

  /* ---------------- banner ---------------- */
  function setBanner(h) {
    h = Math.max(0, Math.round(h || 0));
    if (h === ads.bannerH) return;
    ads.bannerH = h;
    document.documentElement.style.setProperty('--banner-h', h + 'px');
    NB.bus.emit('banner', h);
  }
  function showBanner() {
    if (!ads.ready) return;
    A.showBanner({ adId: CFG.BANNER, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: testing() })
      .catch(function (e) { warn('banner', e); retryBanner(); });
  }
  function retryBanner() {
    if (bannerTimer) return;
    bannerTimer = setTimeout(function () {
      bannerTimer = 0;
      A.removeBanner().catch(function () {}).then(showBanner);
    }, 45000);
  }

  /* ---------------- full-screen helpers ---------------- */
  function enterFull() { ads.busy = true; lastFull = Date.now(); NB.audio.suspend(); }
  function leaveFull() { ads.busy = false; lastFull = Date.now(); if (!document.hidden) NB.audio.resume(); }
  function backoff(n) { return Math.min(300, 15 * Math.pow(2, n)) * 1000; } // 30 s, 60 s, 2 min… max 5 min

  /* ---------------- interstitial ---------------- */
  function loadInter() {
    if (!ads.ready || inter.loaded || inter.loading) return;
    inter.loading = true;
    A.prepareInterstitial({ adId: CFG.INTERSTITIAL, isTesting: testing(), immersiveMode: true })
      .then(function () { inter.loaded = true; inter.retry = 0; })
      .catch(function (e) { warn('interstitial load', e); inter.retry++; setTimeout(loadInter, backoff(inter.retry)); })
      .then(function () { inter.loading = false; });
  }
  function finishInter() {
    var d = inter.done; inter.done = null;
    if (ads.busy) leaveFull();
    setTimeout(loadInter, 1500);
    if (d) d();
  }

  /* ---------------- rewarded ---------------- */
  function loadReward() {
    if (!ads.ready) return Promise.resolve(false);
    if (reward.loaded) return Promise.resolve(true);
    if (reward.loading) return reward.loading;
    reward.loading = A.prepareRewardVideoAd({ adId: CFG.REWARDED, isTesting: testing(), immersiveMode: true })
      .then(function () { reward.loaded = true; reward.retry = 0; return true; })
      .catch(function (e) { warn('rewarded load', e); reward.retry++; setTimeout(loadReward, backoff(reward.retry)); return false; })
      .then(function (ok) { reward.loading = null; return ok; });
    return reward.loading;
  }
  function finishReward() {
    var d = reward.done; reward.done = null;
    if (ads.busy) leaveFull();
    setTimeout(loadReward, 1500);
    if (d) d(!!reward.earned);
  }

  /* ---------------- consent (Google UMP) ---------------- */
  function gatherConsent() {
    var opts = {};
    if (CFG.TEST_DEVICE_IDS && CFG.TEST_DEVICE_IDS.length) opts.testDeviceIdentifiers = CFG.TEST_DEVICE_IDS;
    return A.requestConsentInfo(opts)
      .then(function (info) {
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') return A.showConsentForm();
        return info;
      })
      .then(function (info) {
        ads.privacyRequired = !!info && info.privacyOptionsRequirementStatus === 'REQUIRED';
        NB.bus.emit('adsPrivacy', ads.privacyRequired);
        return !info || info.canRequestAds !== false;
      })
      .catch(function (e) { warn('consent', e); return true; });
  }

  /* ---------------- simulation (browser only) ---------------- */
  function simAd(kind, ms, cb) {
    var el = document.createElement('div');
    el.className = 'ad-sim';
    el.innerHTML = '<div class="ad-sim-card"><small>' + (kind === 'rewarded' ? 'REWARDED VIDEO' : 'INTERSTITIAL') + ' · SIMULATED</small>' +
      '<b>Your ad plays here</b><p>Real Google ads run only in the Android app.</p><i><em></em></i></div>';
    document.body.appendChild(el);
    enterFull();
    var bar = el.querySelector('em');
    bar.style.transitionDuration = ms + 'ms';
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('show'); bar.style.transform = 'scaleX(1)'; }); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
      leaveFull();
      cb();
    }, ms + 150);
  }

  function waitUi(on) {
    var el = document.getElementById('adWait');
    if (!el && on) {
      el = document.createElement('div'); el.id = 'adWait'; el.className = 'ad-wait';
      el.innerHTML = '<i></i><b>LOADING AD</b>';
      document.body.appendChild(el);
    }
    if (el) el.classList.toggle('show', !!on);
  }
  function noAd() {
    NB.ui.toast('<small>NO AD AVAILABLE</small><b>TRY AGAIN IN A MOMENT</b>', { ms: 2600 });
  }

  /* ================= public API ================= */
  ads.init = function () {
    if (ads.mode === 'sim') {
      ads.ready = true;
      var slot = document.getElementById('adSlot');
      if (slot) { slot.classList.add('sim'); slot.textContent = 'BANNER AD · SIMULATED'; }
      setBanner(56);
      return;
    }
    if (ads.mode !== 'native') return;
    A = N.plugin('AdMob');
    N.on('AdMob', EV.bannerSize, function (s) { setBanner(s && s.height); });
    N.on('AdMob', EV.bannerFail, function (e) { warn('banner load', e); setBanner(0); retryBanner(); });
    N.on('AdMob', EV.interDismissed, finishInter);
    N.on('AdMob', EV.interFailShow, finishInter);
    N.on('AdMob', EV.rewardEarned, function () { reward.earned = true; });
    N.on('AdMob', EV.rewardDismissed, function () { setTimeout(finishReward, 400); });
    N.on('AdMob', EV.rewardFailShow, finishReward);

    gatherConsent().then(function (ok) {
      if (!ok) return null;
      return A.initialize({
        initializeForTesting: testing(),
        testingDevices: CFG.TEST_DEVICE_IDS || [],
        maxAdContentRating: CFG.MAX_AD_RATING || 'ParentalGuidance',
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false
      }).then(function () {
        ads.ready = true;
        ads.syncVolume();
        showBanner();
        loadReward();
        loadInter();
      });
    }).catch(function (e) { warn('init', e); });
  };

  /* Called when the player leaves the game-over screen. Runs cb() after the
     interstitial (if one is due), or straight away. */
  ads.betweenRuns = function (cb) {
    var done = once(cb);
    st.runs = (st.runs || 0) + 1; saveSt();
    var due = st.runs >= (CFG.INTERSTITIAL_EVERY || 2) &&
      Date.now() - lastFull >= (CFG.INTERSTITIAL_MIN_GAP || 60) * 1000 && !ads.busy;
    if (!due || ads.mode === 'web') return done();
    if (ads.mode === 'sim') { st.runs = 0; saveSt(); return simAd('interstitial', 1600, done); }
    if (!ads.ready || !inter.loaded) { loadInter(); return done(); }
    st.runs = 0; saveSt();
    inter.loaded = false; inter.done = done;
    enterFull();
    A.showInterstitial().catch(function (e) { warn('interstitial show', e); finishInter(); });
  };

  /* Shows a rewarded ad. Resolves true only if the player earned the reward. */
  ads.rewarded = function (placement) {
    return new Promise(function (resolve) {
      if (ads.busy) return resolve(false);
      if (ads.mode !== 'native') return simAd('rewarded', ads.mode === 'sim' ? 2600 : 1500, function () { resolve(true); });
      if (!ads.ready) { noAd(); return resolve(false); }
      function go() {
        reward.loaded = false; reward.earned = false;
        reward.done = once(resolve);
        enterFull();
        A.showRewardVideoAd()
          .then(function () { reward.earned = true; })
          .catch(function (e) { warn('rewarded show (' + placement + ')', e); finishReward(); });
      }
      if (reward.loaded) return go();
      waitUi(true);
      var timer = setTimeout(function () { timer = 0; waitUi(false); noAd(); resolve(false); }, 9000);
      loadReward().then(function (ok) {
        if (!timer) return;
        clearTimeout(timer); waitUi(false);
        if (ok) go(); else { noAd(); resolve(false); }
      });
    });
  };

  /* Safety net: if the "ad closed" event is ever lost, release the game once
     the app is back on screen, so the player is never stuck. */
  function watchdog() {
    if (!ads.busy || ads.mode !== 'native') return;
    setTimeout(function () {
      if (!ads.busy) return;
      if (inter.done) finishInter(); else if (reward.done) finishReward(); else leaveFull();
    }, 2500);
  }
  N.on('App', 'resume', watchdog);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) watchdog(); });

  /* A rewarded ad this run replaces the next interstitial. */
  ads.noteReward = function () { st.runs = 0; saveSt(); };

  /* The settings screen shows "Privacy & ad choices" when this is true. */
  ads.privacyOptions = function () {
    if (ads.mode !== 'native' || !A) return;
    A.showPrivacyOptionsForm().catch(function (e) { warn('privacy options', e); });
  };

  /* Tells Google the app is muted, so video ads respect it. */
  ads.syncVolume = function () {
    if (ads.mode !== 'native' || !ads.ready) return;
    var s = NB.profile.settings;
    A.setApplicationMuted({ muted: !s.sfx && !s.music }).catch(function () {});
  };
})(window.NB);
