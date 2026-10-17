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
```

## Website (GitHub Pages)

Every change merged into `main` is tested, built and published automatically to **https://meeshoving.github.io/MyCoins/** by `.github/workflows/pages.yml`.

One-time setup: in the repository on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

On the website, coins you add or edit are saved in that browser, so your phone and your computer each keep their own copy. Use **Settings → Export JSON backup** and **Import JSON…** to move a collection between them. The website starts from the example coins in `data/coins.json`.

## Adding a coin

**In the app:** click **Add coin**, fill in the form and save. Open a coin and click **Edit coin** to change or delete it.

**By hand:** edit `data/coins.json`. Each entry looks like this:

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

Images can be web URLs or photos picked in the form. Photos are shrunk and stored inside `coins.json`. Without an image the app draws a placeholder face with the coin's name and year.

### Where edits are saved

| How you run the app | Saved to |
| --- | --- |
| `npm run dev` | `data/coins.json` directly (the previous version is kept as `data/coins.backup.json`) |
| A built copy (`npm run build`) in a browser | That browser's local storage, starting from the bundled `coins.json` |

**Settings → Data** lets you export the whole collection as a JSON backup and import one again.

## Prices

The price badge in the header shows **Live**, **Stale** (live prices couldn't be refreshed, so the last good ones are shown) or **Manual**. It also shows when prices were last updated.

- **Default source:** [gold-api.com](https://gold-api.com). It's free and needs no key. Prices are in USD per troy ounce and are converted to your currency with European Central Bank rates from [frankfurter.dev](https://frankfurter.dev).
- **Optional:** [metals.dev](https://metals.dev) has a free tier with a key. Copy `.env.example` to `.env`, set `VITE_METALS_DEV_API_KEY`, then pick metals.dev in **Settings → Spot prices**. `.env` is git-ignored.
- **Manual:** choose "Manual prices only" in Settings and type your own prices per troy ounce. These manual prices are also the fallback whenever a live source can't be reached.

Prices refresh automatically every 15 minutes by default (you can change this in Settings). Click the refresh icon in the header to refresh at any time. The last prices are cached, so the app opens instantly.

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
data/coins.json            your collection (seed data, editable by hand)
src/domain/                types, valuation maths, Dutch/era classification, validation (+ tests)
src/prices/                swappable spot-price providers (+ tests)
src/storage/               where coins are saved (dev file API, localStorage)
src/hooks/                 React state for settings, prices, coins, routing
src/components/dashboard/  overview, hero totals, charts
src/components/coins/      collection grid/table, coin detail, add/edit form
src/components/viewer/     3D coin viewer (three.js)
src/components/settings/   settings page
vite-plugins/              dev-server API that writes data/coins.json
```

## Desktop and phone later

The app uses relative asset paths and hash URLs (`#/coins/…`), both of which work inside Tauri and Capacitor. Saving goes through the `CoinStore` interface in `src/storage/coinStore.ts`. Wrapping the app means adding one more store there that uses the wrapper's file storage. No other code changes.
