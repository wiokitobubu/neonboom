# Google Play listing: copy and paste

Everything Play Console asks for, ready to paste. The step-by-step guide is [../PLAY_STORE.md](../PLAY_STORE.md).

## Main store listing (Grow users → Store presence → Main store listing)

**App name** (30 characters max). This one is 23:

```
Neon Boom: Merge Puzzle
```

**Short description** (80 max). This one is 78:

```
Drop and merge glowing cores. Reach the Singularity and set off the NEON BOOM!
```

**Full description** (4,000 max):

```
Drop glowing energy cores into the reactor. When two identical cores touch, they fuse into the next, bigger one. Plan your drops, build chains and climb all the way from a tiny Spark to the mighty Singularity. Fuse two Singularities and set off the NEON BOOM.

Easy to learn, hard to put down: slide one finger to aim, release to drop. But watch the overload line. Let the reactor fill up and it blows.

★ REAL PHYSICS
Cores roll, bounce, stack and collide. No two runs play the same.

★ ELEVEN NEON CORES
Spark, Ion, Photon, Quark, Pulsar, Plasma, Nebula, Comet, Planet, Quasar and the Singularity, each one crafted in glowing neon.

★ COMBO CHAINS
Merge fast to keep the chain alive and multiply every point, up to ×3.

★ THE NEON LEAGUE
A new weekly ranking every Monday against AI rivals. Finish in the top 5 to move up from Bronze to Silver, Gold, Diamond and Neon.

★ SECOND CHANCES
Overloaded? Watch a short video to stabilise the reactor and keep your run alive.

★ SYNTHWAVE SOUNDTRACK
Music and sound effects are generated live and react to your game, with satisfying haptics on every merge.

★ PLAYS OFFLINE, SAVES AUTOMATICALLY
No account, no sign-up. Close the app at any time and continue later exactly where you left off.

A relaxing yet competitive merge puzzle with a futuristic look. Can you reach the Singularity?

Neon Boom contains ads. The league rivals are simulated AI players.
```

**Graphics** (all in this `store/` folder):

| Play Console field | File | Size |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512 |
| Feature graphic | `feature-graphic.png` | 1024 × 500 |
| Phone screenshots (upload all 5, in order) | `screenshots/01-merge.png` … `05-overload.png` | 1080 × 1920 |

Tablet screenshots are optional. Leave them empty.

**Category**: App or game: **Game** · Category: **Puzzle**
**Tags** (Store settings): Puzzle, Casual, Merge, Physics, Offline (pick what is offered)
**Contact details**: your e-mail (required, shown publicly) · Website: `https://wiokitobubu.github.io/neonboom/`

## Release notes for version 1.0.0

```
Welcome to Neon Boom!
• Eleven neon cores to discover, from Spark to Singularity
• Combo chains up to ×3
• The weekly Neon League
• Continue after an overload
```

## App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | `https://wiokitobubu.github.io/neonboom/privacy.html` (turn GitHub Pages on first: PLAY_STORE.md, part 6) |
| Ads | **Yes, my app contains ads** |
| App access | **All functionality is available without special access** |
| Content rating | Fill the questionnaire: category **Game**. Violence, fear, sexuality, language, drugs, gambling: **No** to all. Users interact or share content: **No**. Shares location: **No**. Digital purchases: **No**. Expected result: Everyone / PEGI 3 |
| Target audience | **13–15, 16–17 and 18+** (do not tick under 13: it would bring the app under the stricter Families rules). "Could the app unintentionally appeal to children?" **No** |
| News app | No |
| Data safety | See the next table |
| Government app | No |
| Financial features | My app doesn't provide any financial features |
| Health | My app does not have any health features |
| Advertising ID | **Yes**, purpose: **Advertising or marketing** (Google Mobile Ads uses it) |

### Data safety form

Overview questions:

- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data is deleted? **No.** There is no account, and game data stays on the phone.

Data types: tick these, and **nothing else**. The game itself sends nothing; all of these come from the Google Mobile Ads SDK.

| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Location → **Approximate location** | Yes | Yes | Required | Advertising or marketing · Fraud prevention, security and compliance |
| App activity → **App interactions** | Yes | Yes | Required | Advertising or marketing · Analytics |
| App info and performance → **Crash logs** | Yes | Yes | Required | Analytics |
| App info and performance → **Diagnostics** | Yes | Yes | Required | Analytics |
| Device or other IDs → **Device or other IDs** | Yes | Yes | Required | Advertising or marketing · Analytics · Fraud prevention, security and compliance |

"Is this data processed ephemerally?" **No** for each. Google keeps its official list here; check it once before you submit, since Google updates it from time to time: https://developers.google.com/admob/android/privacy/play-data-disclosure

## AdMob

- App: Android, name **Neon Boom**. Link it to the Play listing once the app is live (AdMob → Apps → App settings → *App store details*).
- Ad units to create: **Banner** (adaptive), **Interstitial**, **Rewarded** (reward: 1 × "Continue").
- Privacy & messaging: create and **publish** a **European regulations (GDPR)** message, and a **US state regulations** message. The game already shows them through Google's consent tool and offers *Settings → Privacy & ad choices*.
- Ad content rating ceiling used by the game: **PG** (set in `www/js/ads-config.js`).
