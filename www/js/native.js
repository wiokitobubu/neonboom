/* ==========================================================================
   NEON BOOM — bridge to the Android app (Capacitor).
   In a normal browser every call here quietly does nothing, so the game
   runs the same on a PC and on the phone.
   ========================================================================== */
(function (NB) {
  'use strict';

  var Cap = window.Capacitor;
  var isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  var cache = {};

  var N = NB.native = {
    isNative: isNative,
    platform: isNative && Cap.getPlatform ? Cap.getPlatform() : 'web',

    /* A native plugin by name ('App', 'Haptics', 'AdMob'…), or null. */
    plugin: function (name) {
      if (!isNative) return null;
      if (Object.prototype.hasOwnProperty.call(cache, name)) return cache[name];
      var p = null;
      try { if (Cap.isPluginAvailable(name) && Cap.registerPlugin) p = Cap.registerPlugin(name); } catch (e) { p = null; }
      cache[name] = p;
      return p;
    },

    /* Calls plugin.method(options); always returns a promise that never throws. */
    call: function (name, method, options) {
      var p = N.plugin(name);
      if (!p) return Promise.resolve(null);
      try {
        return Promise.resolve(p[method](options)).catch(function (e) {
          console.warn('[native] ' + name + '.' + method + ' failed: ' + (e && e.message || e));
          return null;
        });
      } catch (e) { return Promise.resolve(null); }
    },

    on: function (name, event, fn) {
      var p = N.plugin(name);
      if (p && p.addListener) { try { p.addListener(event, fn); } catch (e) { /* ignore */ } }
    },

    /* The native splash screen waits for the game; this lets it fade out. */
    hideSplash: function () {
      N.call('SplashScreen', 'hide', { fadeOutDuration: 300 });
    },

    exit: function () { N.call('App', 'exitApp'); },

    /* Links (privacy policy…) open in the phone's browser, never inside the game. */
    openUrl: function (url) {
      if (isNative) window.location.href = url;
      else window.open(url, '_blank', 'noopener');
    },

    /* Haptic tap on the phone: 'LIGHT' | 'MEDIUM' | 'HEAVY'. */
    vibrate: function (style) { return N.call('Haptics', 'impact', { style: style }); }
  };

  // Safety net: the splash never stays up, even if the game failed to start.
  if (isNative) window.addEventListener('load', function () { setTimeout(N.hideSplash, 3000); });
})(window.NB);
