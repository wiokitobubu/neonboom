# NEON BOOM → Google Play: the complete guide

This guide takes the game from this folder to the Google Play Store, click by click. It is written for **Windows**. On a Mac, use the `npm run …` command shown next to each `.bat` file.

**What you need**

- A Windows PC.
- An Android phone and its USB cable.
- A Google account (Gmail).
- A bank card for Google Play's one-time **US$25** fee.

**How long it takes**

| When | What |
|---|---|
| Day 1 | Play on your phone, create AdMob, open the Play developer account |
| Days 2–4 | Google verifies your identity, then you play NEON BOOM from the Play Store (internal test) |
| 14 days | Closed test with 12 testers, required by Google for new personal accounts |
| About 1 week | Google reviews the production request. Then the game is public worldwide |

> **Four golden rules**
> 1. **Back up the `keys` folder** as soon as it exists (USB stick or Google Drive). Every future update must be signed with it.
> 2. **Never click your own real ads.** Keep `TEST_MODE: true` until the public release. AdMob closes accounts for self-clicks.
> 3. **Raise the version number before every new upload** (`package.json`: 1.0.0 → 1.0.1). Google refuses the same build number twice.
> 4. **Never put the `keys` folder on GitHub.** The `.gitignore` file already blocks it.

---

## Part 1 · Play it on the PC (2 minutes)

Double-click **`0-play-in-browser.bat`**. The game opens in your browser.

To see the ad spots too, add `?ads` to the end of the address in the browser's address bar, then press Enter. The banner and full-screen ads are simulated in the browser.

## Part 2 · Install the tools (30 minutes, one time)

1. **Node.js**
   - Go to <https://nodejs.org>, click the big **LTS** button, open the file you downloaded, then click **Next** until it finishes. Keep every default.
2. **Android Studio**
   - Go to <https://developer.android.com/studio> and click **Download Android Studio**. Accept the terms, then install it with every default.
   - Open Android Studio once. The *Setup Wizard* appears: choose **Standard**, click **Next**, accept every licence (**Accept** on each line), then click **Finish**.
   - It downloads about 3 GB. Wait for **Finish** to turn blue, then close Android Studio.
3. **Restart the PC.** Windows needs this to find Node.js.

## Part 3 · Build the app and play it on your phone (15 minutes)

1. Double-click **`1-setup.bat`** (Mac: `npm run setup`).
   - A black window prints a lot of text. The first run takes a few minutes.
   - It ends with `[OK]`, then Android Studio opens on the project.
   - Wait until the progress bar at the bottom right of Android Studio disappears ("Gradle sync").
2. Turn on developer mode on the phone:
   - **Settings → About phone** (Samsung: **About phone → Software information**). Tap **Build number** 7 times until it says "You are now a developer".
   - Go to **Settings → System → Developer options** (Samsung: **Settings → Developer options**) and turn on **USB debugging**.
3. Plug the phone into the PC. On the phone, tap **Allow** when it asks "Allow USB debugging?".
4. In Android Studio, your phone's name appears in the top bar. Click the green **▶ Run** button.
   - NEON BOOM opens on the phone. The banner says **"Test Ad"**: that is normal and correct.

Every time you change the game (the `www` folder) or the ad IDs, double-click **`2-sync.bat`** (Mac: `npm run sync`), then press **▶** again in Android Studio.

## Part 4 · AdMob: create your ads (20 minutes)

1. Go to <https://admob.google.com> and click **Get started**. Sign in, choose your country and time zone, then accept the terms.
2. Create the app:
   - Click **Apps → Add app → Android**.
   - For "Is the app listed on a supported app store?", answer **No**.
   - App name: **Neon Boom** → **Add app**.
3. Copy the **App ID**. It looks like `ca-app-pub-1234567890123456~1234567890`.
4. Open the file **`www/js/ads-config.js`**: right-click it, then **Open with → Notepad**. Paste the App ID between the quotes of `APP_ID`.
5. In AdMob, click **Ad units → Add ad unit** three times. After each one, paste its ID into the same file:

   | Ad unit type | Name | Paste into |
   |---|---|---|
   | **Banner** | Bottom banner | `BANNER` |
   | **Interstitial** | Between runs | `INTERSTITIAL` |
   | **Rewarded** (reward amount **1**, item **Continue**) | Continue | `REWARDED` |

6. Leave `TEST_MODE: true`. Save the file (Ctrl + S), then double-click **`2-sync.bat`**.
7. Set up the consent message, which the law requires in Europe:
   - Go to AdMob **Privacy & messaging → European regulations → Create message**. Choose the app **Neon Boom** and the language English, keep the defaults, then click **Publish**.
   - Do the same for **US state regulations**.
   - The game already shows these messages and has a "Privacy & ad choices" button in Settings.
8. Add your payment details later, in **Payments**. AdMob pays once you have earned US$100.

## Part 5 · Google Play developer account (1 to 4 days)

1. Go to <https://play.google.com/console/signup>.
   - Choose **Yourself** (a personal account).
   - Pick a developer name. It is shown publicly on the store, for example "Neon Boom Games".
2. Pay the **US$25**.
3. Follow the verification steps:
   - your identity (a photo of an ID document),
   - your phone number and e-mail,
   - an Android device (install the **Play Console** app and sign in).
4. Wait for the e-mail saying the account is verified.

## Part 6 · Put the privacy policy online (2 minutes, one time)

Google requires a public privacy policy. It is already written: `docs/privacy.html`. To put it online:

1. Go to <https://github.com/wiokitobubu/neonboom>, then click **Settings → Pages**.
2. Under **Source**, choose **Deploy from a branch**, then **Branch: main**, folder **/docs**. Click **Save**.
3. Wait one minute, then open <https://wiokitobubu.github.io/neonboom/privacy.html>. It should show the policy.

This also publishes a small website for the game: <https://wiokitobubu.github.io/neonboom/>.

## Part 7 · Build the release file (5 minutes)

1. Double-click **`3-build-release.bat`** (Mac: `npm run release`).
2. The first time, it creates your upload key in the **`keys`** folder. **Copy that folder to a USB stick or Google Drive now.**
3. At the end, the **`release`** folder opens with two files:
   - **`NeonBoom-1.0.0.aab`**: the file for Google Play.
   - **`NeonBoom-1.0.0.apk`**: you can also copy this one to a phone and open it to install the game directly.

## Part 8 · Play it from the Play Store: internal testing (same day)

1. In Play Console, click **Create app**:
   - App name: **Neon Boom: Merge Puzzle**
   - Default language: English (United States)
   - **Game**, then **Free**
   - Tick the two declarations, then click **Create app**.
2. Add yourself as a tester:
   - In the left menu: **Test and release → Testing → Internal testing → Testers** tab.
   - Click **Create email list**, name it "Me" and add your Gmail address. Click **Save**.
   - Copy the link under **"Join on the web"**.
3. Upload the game:
   - Open the **Releases** tab and click **Create new release**.
   - If asked about *Play App Signing*, click **Continue**. Google keeps the final signing key safe for you.
   - Click **Upload** and pick **`release/NeonBoom-1.0.0.aab`**.
   - Paste the release notes from `store/LISTING.md`, click **Next**, then **Save and publish**.
4. On your phone, open the link from step 2 (with the same Gmail), tap **Accept invite**, then **Download it on Google Play**.
   - If you installed the game from Android Studio before, uninstall that copy first: it is signed differently.

You are now playing NEON BOOM from the Play Store. 🎉

## Part 9 · Store listing and App content (30 minutes)

Everything is ready to copy and paste in **[store/LISTING.md](store/LISTING.md)**: title, descriptions, images, and every answer for the forms.

1. **Grow users → Store presence → Main store listing**:
   - Paste the texts.
   - Upload `store/icon-512.png`, `store/feature-graphic.png` and the 5 files in `store/screenshots/`.
   - Click **Save**.
2. **Policy → App content**: fill in each section with the answers from `store/LISTING.md`. That covers the privacy policy link, ads, app access, content rating, target audience, data safety and advertising ID.
3. **Grow users → Store presence → Store settings**:
   - Category: **Game → Puzzle**.
   - Add your contact e-mail.

## Part 10 · Closed test: 12 testers for 14 days (required)

New personal developer accounts must run a closed test before going public: **at least 12 testers, opted in for 14 days in a row**.

1. Go to **Test and release → Testing → Closed testing** and open the **Alpha** track (or click **Create track**).
2. On the **Testers** tab, add at least 12 people (friends, family). Their Gmail addresses go in an e-mail list, or use a Google Group. Send them the **join link**.
3. On the **Releases** tab, click **Create new release**, add the same `.aab` (or **Promote release** from Internal testing), then **Send for review**.
4. Each tester opens the link, taps **Accept invite** and installs the game. Ask them to keep it installed for the whole 14 days and to play a few times. Google checks that the testers really use the app.
5. After 14 days, go to **Dashboard → Apply for production**. Answer the questions about your test honestly, then wait for Google's answer (usually a few days).

## Part 11 · Go public (production)

1. In `www/js/ads-config.js`, set **`TEST_MODE: false`**. Your real IDs are already pasted from Part 4.
2. In `package.json`, raise the version: `"version": "1.0.1"`.
3. Double-click **`3-build-release.bat`**. This gives you `release/NeonBoom-1.0.1.aab`.
4. Open **Test and release → Production**:
   - Click **Countries / regions → Add countries / regions**, select all, then **Save**.
   - Click **Create new release**, upload the new `.aab`, then **Next**.
   - Click **Save**, then **Send for review**.
5. When Google approves it, NEON BOOM is live for everyone.
6. Link AdMob to the store page: in AdMob, open **Apps → Neon Boom → App settings → Add app store details**, search "Neon Boom", then select it.

## Part 12 · Every update after that

1. Change the game.
2. Raise `version` in `package.json` (1.0.1 → 1.0.2).
3. Double-click `3-build-release.bat`.
4. Upload the new `.aab` to the same track in Play Console.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| `[X] Node.js is not installed` | Install Node.js LTS (Part 2), then **restart the PC**. |
| `Java was not found` / `Android SDK was not found` | Open Android Studio once and finish its setup wizard (Part 2). |
| Android Studio doesn't see the phone | Use a data USB cable (not a charge-only one), turn **USB debugging** off and on, and tap **Allow** on the phone. |
| "App not installed" on the phone | Uninstall the old NEON BOOM first. Copies from Android Studio, the `.apk` and Google Play are signed differently. |
| Play Console: "Version code 10000 has already been used" | Raise `version` in `package.json` and run `3-build-release.bat` again. |
| No ads appear on the phone | Normal for the first hour with new AdMob IDs. Test ads (`TEST_MODE: true`) should always appear. Check that the phone has internet. |
| Lost the `keys` folder | Play Console → **Test and release → App integrity → App signing → Request upload key reset**. |

To check everything at once: open a terminal in the project folder (on Windows, type `cmd` in the folder's address bar) and run `npm run doctor`.
