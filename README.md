# NEON BOOM

A neon physics merge puzzle for Android. Drop energy cores into the reactor; two identical cores fuse into the next one.
Eleven cores, from **Spark** to **Singularity**. Fuse two Singularities to set off a **NEON BOOM**.

Built with HTML5 + JavaScript + Matter.js (physics). It will be packaged for Android with Capacitor and monetised with Google AdMob.

## Try it now (no install)

1. Open the `neonboom` folder, then the `www` folder.
2. Double-click `index.html`. It opens in your web browser. Google Chrome works best.
3. Drag left and right on the reactor to aim. Let go to drop.

## Build steps

| Step | What | Status |
|---|---|---|
| 1 | The game: neon design, physics, particles, synthesised sound and music, autosave, Neon League (AI rivals), touch controls | **done** |
| 2 | Events: Gold Fever (x2 points for 2 min), daily challenges, daily wheel, weekly event bar | next |
| 3 | Ad-to-Win shop: Hammer, Bomb, Evolve, 15-minute VIP mode | |
| 4 | AdMob: banner, interstitial every 2 runs, rewarded Continue, rewarded shop | |
| 5 | Android project: `package.json`, `capacitor.config.json`, one-click setup script | |
| 6 | Google Play listing: icon, privacy policy, title and descriptions | |

## Where things are

```
www/                 the whole game (Capacitor packages this folder)
  index.html         the screens
  css/style.css      the look: colours, buttons, panels, animations
  js/config.js       every game number (sizes, points, timings), easy to tune
  js/game.js         the reactor: physics, merging, overload rule, autosave
  js/render.js       the 11 cores, drawn entirely by code (no image files)
  js/fx.js           particles, shockwaves, flashes, screen shake
  js/audio.js        all sounds and the soundtrack, generated live (no audio files)
  js/league.js       the weekly Neon League against AI rivals
  js/ui.js           menus, score display, toasts, settings
  js/main.js         start-up and the flow between screens
  js/vendor/         Matter.js 0.20.0 (physics engine)
  fonts/             Orbitron + Rajdhani (bundled so the app works offline)
```
