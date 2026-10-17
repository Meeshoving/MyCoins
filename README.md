# MyCoins

A personal portfolio app for a bullion coin collection: total value, pure silver and gold content, gain or loss, charts, and a 3D view of every coin.

Built with Vite, React, TypeScript, Tailwind CSS, Recharts and react-three-fiber. It runs as a local web app and is set up so it can later be wrapped as a desktop app (Tauri) or phone app (Capacitor) without a rewrite.

## Setup

You need [Node.js](https://nodejs.org) 22 or newer.

**On Windows, the easy way:** double-click **Start MyCoins.bat** in the project folder. The first time, it installs what the app needs, which takes a minute. Then it opens the app in your browser. Keep the black window open while you use the app, and close it to stop.

**From a terminal:**

```bash
npm install
npm run dev        # open the printed URL, usually http://localhost:5173
```

On Windows PowerShell, type `npm.cmd` instead of `npm` if you see "running scripts is disabled on this system".

Other commands:

```bash
npm test           # unit tests for the valuation maths and price providers
npm run build      # production build into dist/
npm run preview    # serve the production build
npm run history    # download the price history used by the price charts
```

## Website (GitHub Pages)

Every change merged into `main` is tested, built and published automatically to **https://meeshoving.github.io/MyCoins/** by `.github/workflows/pages.yml`.

One-time setup: in the repository on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

On the website, coins you add or edit are saved in that browser, so your phone and your computer each keep their own copy. Use **Settings → Export JSON backup** and **Import JSON…** to move a collection between them. Every visitor starts with an empty collection and only ever sees their own coins. **Try with example coins** on the empty homepage loads the samples from `data/examples.json`, and **Settings → Remove example coins** takes them out again.

## Adding a coin

**In the app:** click **Add coin**, fill in the form and save. Open a coin and click **Edit coin** to change or delete it.

**By hand (when running locally):** edit `data/coins.json`, which starts empty. `data/examples.json` has ready-made entries to copy from. Each entry looks like this:

```json
{
  "id": "nl-rijksdaalder-1938",
  "name": "Rijksdaalder Wilhelmina",
  "country": "Netherlands",
  "year": 1938,
  "mint": "Utrecht",
  "denomination": "2½ gulden",
  "metal": "silver",
  "purity": 0.72,
  "grossWeightGrams": 25,
  "quantity": 3,
  "purchasePricePerCoin": 17.5,
  "purchaseCurrency": "EUR",
  "purchaseDate": "2023-03-12",
  "collectorValuePerCoin": 22,
  "obverseImage": "https://example.com/front.jpg",
  "reverseImage": "https://example.com/back.jpg",
  "diameterMm": 38,
  "thicknessMm": 2.5,
  "mintage": 1000000,
  "grade": "VF",
  "notes": "Anything you like"
}
```

Required fields: `id`, `name`, `country`, `metal` (`silver`, `gold` or `platinum`), `purity` (a fraction such as `0.720` or `0.999`), `grossWeightGrams`, `quantity`, `purchasePricePerCoin` and `purchaseCurrency` (`EUR`, `USD`, `GBP` or `CHF`). Everything else is optional. Pure metal content is computed from weight × purity, so you never enter it yourself.

`collectorValuePerCoin` is optional. When it is set, the coin is valued at that price and the app shows its premium over melt value. When it is empty, the coin is valued at melt.

### Photos

For the most realistic look, photograph each side of the coin straight from above on a plain background, with even light and no flash glare. In the form, click **Add photo** (on a phone this can open the camera). Then drag and zoom so the coin fills the circle, and click **Use photo**. Click **Adjust** to re-crop later. The 3D view puts your photos on the coin's faces.

Photos are saved as 800 × 800 JPEGs together with the coin. You can also paste an image link instead, but some websites don't allow their images to be cropped. Without a photo, the app draws a placeholder face with the coin's name and year.

### Look up a coin in Numista

The app can fill in a coin's details and photos from the [Numista](https://en.numista.com) catalogue:

1. Create a free account on Numista and request an API key at <https://en.numista.com/api/>.
2. In MyCoins, open **Settings → Coin catalogue** and paste the key. It is saved in your browser only and never leaves it except to talk to Numista.
3. When adding a coin, type its name in **Look up in Numista**, press **Search** and pick the right result.

This fills in the name, country, denomination, metal, purity, weight, size and the Numista photos. Your quantity, price and own photos are kept. If the coin was issued over several years, enter the year of your coin yourself. Numista lets other websites show its photos but not read them, which the WebGL 3D viewer needs, and it also blocks image services that could fetch a copy. For coins with such photos, the coin page uses a simpler 3D coin built from the photos themselves (drag to turn, flip sides, auto-rotate). Your own photos, which are saved inside the app, get the full 3D view with lighting.

### Where edits are saved

| How you run the app | Saved to |
| --- | --- |
| `npm run dev` | `data/coins.json` directly (the previous version is kept as `data/coins.backup.json`) |
| The website, or any built copy | That browser's own storage (IndexedDB), starting empty |

**Settings → Data** lets you export the whole collection as a JSON backup and import one again.

## Sync between devices (sign in with Google)

When the site has a Firebase project set up, a **Sign in** button appears at the top. Signed in, your coins, photos and settings (including the Numista key) are saved to your account and show up on every device where you sign in. Without signing in, everything stays in the browser as before.

- The first time you sign in, the app offers to copy the coins already in that browser into your account.
- The account keeps a copy on each device, so the collection also opens offline and catches up when you're back online.
- **Sign out on this device** (Settings) removes the account's copy from that device and shows the browser's own coins again.

How it's built: Firebase Authentication (Google) and Cloud Firestore on the free Spark plan. Each person's data lives under `users/{their id}/`, and [`firestore.rules`](firestore.rules) lets people read and write only their own. The project details are in `src/sync/firebaseConfig.ts`. They are not secret: they only name the project, and the rules guard the data. Firebase's free plan allows 50,000 reads and 20,000 writes per day, which is far more than a personal collection needs.

Setting up your own Firebase project:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → enable **Google**. Under Settings → Authorized domains, add your site's domain (e.g. `meeshoving.github.io`).
3. **Firestore Database** → Create database (production mode). Under **Rules**, paste the contents of `firestore.rules` and click **Publish**.
4. **Project settings** → Your apps → add a **Web** app and copy its `firebaseConfig` into `src/sync/firebaseConfig.ts`.

For testing, `VITE_FIREBASE_EMULATOR=1` points the app at the local Firebase emulators (`firebase emulators:start --project demo-mycoins --only auth,firestore`).

## Prices

The price badge in the header shows **Live**, **Stale** (live prices couldn't be refreshed, so the last good ones are shown) or **Manual**. It also shows when prices were last updated.

- **Default source:** [gold-api.com](https://gold-api.com). It's free and needs no key. Prices are in USD per troy ounce and are converted to your currency with European Central Bank rates from [frankfurter.dev](https://frankfurter.dev).
- **Optional:** [metals.dev](https://metals.dev) has a free tier with a key. Copy `.env.example` to `.env`, set `VITE_METALS_DEV_API_KEY`, then pick metals.dev in **Settings → Spot prices**. `.env` is git-ignored.
- **Manual:** choose "Manual prices only" in Settings and type your own prices per troy ounce. These manual prices are also the fallback whenever a live source can't be reached.

Prices refresh automatically every 15 minutes by default (you can change this in Settings). Click the refresh icon in the header to refresh at any time. The last prices are cached, so the app opens instantly.

### Price history

Click the silver or gold price in the header (on a phone, the **Live** badge) to open the price history page. It shows silver, gold and platinum per troy ounce in your currency, from 1960 until today. Pick **1Y** to **All** (30 years is the default), type a **From** and **To** month, or drag the handles of the small chart under the graph to choose the time span yourself. The cards above the graph show the price at the end of the span, the change over the span, and the highest and lowest month.

The history is free and needs no key:

- Monthly average metal prices from the [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets) (CC BY 4.0), in US dollars.
- Monthly exchange rates from the [Federal Reserve (FRED)](https://fred.stlouisfed.org/). Euro prices before 1999 are converted through the Deutsche Mark.
- The last point of the graph is today's live spot price.

`npm run history` downloads both and writes `public/data/price-history.json` (not stored in git). The website workflow runs it before every build and once a month on the 6th, after the World Bank publishes its new figures. **Start MyCoins.bat** runs it too. If the download fails, the last file is kept and the build still succeeds.

To add another price source, implement the small `PriceProvider` interface in `src/prices/providers.ts` and add it to `PROVIDERS`.

## Valuation

All maths lives in `src/domain/valuation.ts` and is covered by unit tests:

- pure content (oz t) = gross weight (g) × purity ÷ 31.1034768
- melt value = pure content × spot price
- value = collector value if set, otherwise melt value
- gain = value − purchase price, also shown as a percentage of cost
- premium over melt = collector value − melt value

## Project layout

```
data/coins.json            your collection when running locally (starts empty)
data/examples.json         example coins visitors can load to try the app
src/domain/                types, valuation maths, Dutch/era classification, validation (+ tests)
src/prices/                swappable spot-price providers (+ tests)
src/catalog/               Numista coin catalogue lookup (+ tests)
src/history/               price history loading and range maths (+ tests)
scripts/                   downloads the price history (World Bank, FRED) at build time (+ tests)
src/sync/                  Google sign-in and syncing through Firebase (+ tests)
src/storage/               where coins are saved (dev file API, browser IndexedDB) and example coins
src/hooks/                 React state for settings, prices, coins, routing
src/components/dashboard/  overview, hero totals, charts
src/components/coins/      collection grid/table, coin detail, add/edit form
src/components/viewer/     3D coin viewer (three.js)
src/components/settings/   settings page
src/components/prices/     price history page
vite-plugins/              dev-server API that writes data/coins.json
```

## Desktop and phone later

The app uses relative asset paths and hash URLs (`#/coins/…`), both of which work inside Tauri and Capacitor. Saving goes through the `CoinStore` interface in `src/storage/coinStore.ts`. Wrapping the app means adding one more store there that uses the wrapper's file storage. No other code changes.
