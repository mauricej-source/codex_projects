# Financial News Scanner

Single-page financial news application that monitors live news results for configurable keywords and displays matched articles in a sortable table with ticker symbols and Finviz chart links.

## Application Summary

The application has two parts:

- A Node/Express backend that searches live news feeds, normalizes the results, and performs best-effort stock ticker extraction.
- A single-page frontend that displays the latest results in a searchable, sortable, refreshable table.

## Current Features

- Fetches live news using Google News RSS search feeds for each active keyword
- Combines all feed results into one normalized dataset
- Sorts news by `Time Reported` descending by default
- Allows column sorting directly from the table headers
- Extracts and displays:
  - `Keyword`
  - `News Source`
  - `News Title`
  - `Time Reported`
  - `Stock Ticker Symbol`
  - `News Link`
  - `Technical Chart`
- Builds Finviz chart links for detected ticker symbols
- Refreshes automatically every 15 minutes
- Supports manual refresh from the page

## Single-Page Behavior Enhancements

The single-page UI was enhanced beyond the original version:

- The keyword list is editable from a textbox on the page instead of being only environment-driven
- Keywords entered in the textbox remain visible as the master keyword list
- Each keyword is also rendered as a clickable chip/button
- Clicking a keyword chip enables or disables that keyword from the live search criteria
- Disabling a keyword immediately refreshes the result set
- Re-enabling a keyword immediately adds it back to the search criteria
- The textbox and chip/button states are intentionally separate:
  - textbox = full configured keyword list
  - chips = active/inactive search toggles
- Table columns are sortable by clicking the column headers

## Ticker Symbol Logic

Ticker extraction is best-effort and uses several strategies:

- Direct parsing from article title/snippet/body when symbols appear in known patterns
- Supported patterns include examples such as:
  - `[NASDAQ: VERI]`
  - `(NYSE: U)`
  - `nCino (NCNO)`
  - `$NVDA`
- Company-name lookup when the headline contains a company name but not an explicit ticker
- Support for multiple detected ticker symbols in a single headline
- Support for multiple Finviz chart links in a single table row when multiple symbols are found

Examples of enhanced ticker handling:

- `Solana attracts tokenized equities as Galaxy enables DeFi lending`
  - can produce multiple tickers and multiple Finviz links
- `Unity Shares Surge as Strategic 'Reset' Excises Legacy Ad Business to Fuel AI Growth`
  - can resolve `Unity` to ticker `U`
- `Royalty Pharma veteran Kristin Stafford takes CFO post at Zymeworks`
  - can resolve `Zymeworks` to ticker `ZYME`

Because financial headlines are inconsistent and ticker formatting is not standardized, some rows may still return `N/A`. This is expected behavior when there is not enough reliable context to identify a symbol safely.

## Styling Updates Implemented

The page styling was refined during the build:

- Single-page dashboard presentation with a custom color palette
- Styled hero header and metadata card
- Styled keyword editor and toggle chips
- Reduced corner radius on main cards and textbox
- Custom page title and intro styling
- Button and chip styling aligned to the chosen accent colors

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables if needed:

```bash
copy .env.example .env
```

3. Start the app:

```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

- `PORT`: server port, default `3000`
- `KEYWORDS`: default server-side keyword list separated by `|`
- `CACHE_TTL_MS`: backend cache lifetime in milliseconds, default `900000` (15 minutes)
- `MAX_ITEM_AGE_DAYS`: recent-news window for filtering feed items, default `14`

## Notes

- The app currently uses Google News RSS search feeds, so it works without a paid news API key
- Some article links may resolve through Google News redirect URLs depending on the source feed
- Finviz links are generated only when a ticker can be identified
- Deployment was attempted, but platform authentication was required in this session
