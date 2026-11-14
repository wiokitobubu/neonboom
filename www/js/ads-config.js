/* ==========================================================================
   NEON BOOM — AdMob settings.   >>> THE ONLY FILE TO EDIT FOR ADS <<<

   Where the IDs come from (full click-by-click guide: PLAY_STORE.md, part 4):
     admob.google.com → Apps → Add app → Android → "Neon Boom"
     Then Ad units → create three units: Banner, Interstitial, Rewarded.
     The App ID contains a "~". Ad unit IDs contain a "/".

   After you paste your IDs: run  2-sync.bat  (or  npm run sync)  so the
   App ID is also copied into the Android project.

   Until then, Google's official TEST IDs below are used. They show
   "Test Ad" banners and never pay, which is exactly right while testing.
   NEVER click your own real ads: AdMob closes accounts for that.
   ========================================================================== */
window.NB = window.NB || {};

NB.ADS_CONFIG = {
  // ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓  PASTE YOUR ADMOB IDS HERE  ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
  APP_ID:       'ca-app-pub-3940256099942544~3347511713',
  BANNER:       'ca-app-pub-3940256099942544/9214589741',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED:     'ca-app-pub-3940256099942544/5224354917',
  // ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑  PASTE YOUR ADMOB IDS HERE  ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑

  // true  = test ads only, even with your real IDs (safe for you and testers).
  // false = real ads that pay. Switch to false ONLY for the public release.
  TEST_MODE: true,

  // Optional: your phone's test-device ID (AdMob prints it in the Android
  // Studio "Logcat" the first time an ad loads). Real ads then show as test ads on it.
  TEST_DEVICE_IDS: [],

  INTERSTITIAL_EVERY: 2,       // one full-screen ad every 2 finished runs
  INTERSTITIAL_MIN_GAP: 60,    // seconds, at least, between two full-screen ads
  CONTINUES_PER_RUN: 1,        // rewarded "Continue" offers per run
  MAX_AD_RATING: 'ParentalGuidance' // General | ParentalGuidance | Teen | MatureAudience
};
