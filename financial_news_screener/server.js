const express = require("express");
const Parser = require("rss-parser");

const app = express();
const parser = new Parser({
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  },
});
const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
};

const PORT = Number(process.env.PORT || 3000);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 15 * 60 * 1000);
const MAX_ITEM_AGE_DAYS = Number(process.env.MAX_ITEM_AGE_DAYS || 14);
const DEFAULT_KEYWORDS =
  "strategic|partnership|collaboration|MOU|accelerated|growth|artificial|intelligence|trump|IPO";
const FEED_SEPARATOR = "|";
const TICKER_STOPWORDS = new Set([
  "A",
  "AI",
  "AM",
  "AS",
  "AT",
  "BACK",
  "BANK",
  "BRAND",
  "CHINA",
  "DHABI",
  "FOR",
  "GROWTH",
  "HOLD",
  "ITS",
  "MARKET",
  "MOU",
  "NEWS",
  "NOW",
  "PARIS",
  "PART",
  "STOCK",
  "THE",
  "THIS",
  "TODAY",
  "TRUMP",
  "VALUE",
]);

const cache = {
  fetchedAt: 0,
  payload: null,
};
const companyLookupCache = new Map();
const COMPANY_SYMBOL_ALIASES = new Map([
  ["galaxy", "GLXY"],
  ["ncino", "NCNO"],
  ["nvidia", "NVDA"],
  ["solana", "SOLUSD"],
  ["unity", "U"],
  ["zymeworks", "ZYME"],
]);
const COMPANY_STOPWORDS = new Set([
  "AI",
  "AI Infrastructure",
  "Analysts",
  "Artificial Intelligence",
  "Bitcoin",
  "CFO",
  "Company",
  "DeFi",
  "Equities",
  "Finance",
  "Financial",
  "Fuel",
  "Growth",
  "IPO",
  "Investors",
  "Legacy",
  "Market",
  "Markets",
  "News",
  "Partnership",
  "Reset",
  "Shares",
  "Stock",
  "Stocks",
  "Strategic",
  "Surge",
  "Tokenized",
  "Wall Street",
]);
const FEED_PROVIDERS = [
  {
    id: "google-news",
    name: "Google News Search",
    description: "Keyword-targeted Google News RSS search results",
    mode: "keyword-search",
  },
  {
    id: "nasdaq-markets",
    name: "Nasdaq Markets",
    description: "Nasdaq market and company headlines",
    mode: "feed",
    url: "https://www.nasdaq.com/feed/rssoutbound?category=Markets",
  },
  {
    id: "nasdaq-ipos",
    name: "Nasdaq IPOs",
    description: "Nasdaq IPO-focused headlines",
    mode: "feed",
    url: "https://www.nasdaq.com/feed/rssoutbound?category=IPOs",
  },
  {
    id: "sec-press-releases",
    name: "SEC Press Releases",
    description: "Official SEC press releases",
    mode: "feed",
    url: "https://www.sec.gov/news/pressreleases.rss",
  },
  {
    id: "fed-press-releases",
    name: "Federal Reserve Press Releases",
    description: "Official Federal Reserve press releases",
    mode: "feed",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
  },
];
const FEED_PROVIDER_MAP = new Map(FEED_PROVIDERS.map((provider) => [provider.id, provider]));

function getKeywords() {
  return (process.env.KEYWORDS || DEFAULT_KEYWORDS)
    .split(FEED_SEPARATOR)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function getDefaultFeedIds() {
  return ["google-news", "nasdaq-markets"];
}

function escapeQuery(keyword) {
  return encodeURIComponent(`"${keyword}" stock market finance when:${MAX_ITEM_AGE_DAYS}d`);
}

function buildFeedUrl(keyword) {
  return `https://news.google.com/rss/search?q=${escapeQuery(keyword)}&hl=en-US&gl=US&ceid=US:en`;
}

async function parseFeedFromUrl(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (!response.ok) {
    throw new Error(`Status code ${response.status}`);
  }

  const xml = await response.text();
  return parser.parseString(xml);
}

function normalizeFeedIds(feedIds) {
  const requested = Array.isArray(feedIds) ? feedIds : [];
  const normalized = requested.filter((feedId) => FEED_PROVIDER_MAP.has(feedId));
  return normalized.length ? normalized : getDefaultFeedIds();
}

function normalizeSource(item) {
  if (item.source && typeof item.source === "object" && item.source.title) {
    return item.source.title.trim();
  }

  const title = item.title || "";
  const splitTitle = title.split(" - ");
  return splitTitle.length > 1 ? splitTitle.at(-1).trim() : "Unknown";
}

function normalizeFeedSource(item, provider) {
  const source = normalizeSource(item);
  return source === "Unknown" ? provider.name : source;
}

function stripSourceFromTitle(title) {
  if (!title) return "";
  const parts = title.split(" - ");
  return parts.length > 1 ? parts.slice(0, -1).join(" - ").trim() : title.trim();
}

function sanitizeTicker(candidate) {
  const normalized = String(candidate || "").toUpperCase();
  return normalized && !TICKER_STOPWORDS.has(normalized) ? normalized : null;
}

function parseTickers(text) {
  if (!text) return [];

  const patterns = [
    /\[(?:NASDAQ|NYSE|AMEX|OTC|TSX|LSE)\s*:\s*([A-Z]{1,5})\]/g,
    /\((?:NASDAQ|NYSE|AMEX|OTC|TSX|LSE)\s*:\s*([A-Z]{1,5})\)/g,
    /\b(?:NASDAQ|NYSE|AMEX|OTC|TSX|LSE)\s*[:\-]\s*([A-Z]{1,5})\b/g,
    /\b[A-Z][A-Za-z0-9&.\- ]+\s+\(([A-Z]{1,5})\)/g,
    /\(([A-Z]{1,5})\)/g,
    /\$([A-Z]{1,5})\b/g,
    /\bticker\s*[:\-]?\s*([A-Z]{1,5})\b/gi,
  ];
  const tickers = new Set();

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const ticker = sanitizeTicker(match[1]);
      if (ticker) {
        tickers.add(ticker);
      }
    }
  }

  return Array.from(tickers);
}

function buildTextBlob(item) {
  return [item.title, item.contentSnippet, item.content, item.summary]
    .filter(Boolean)
    .join(" ");
}

function findMatchedKeyword(text, keywords) {
  const normalizedText = String(text || "").toLowerCase();
  return keywords.find((keyword) => normalizedText.includes(keyword.toLowerCase())) || null;
}

function isFreshEnough(timeReported) {
  const timestamp = new Date(timeReported).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp >= Date.now() - MAX_ITEM_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function normalizeItem(item, keyword) {
  const headline = stripSourceFromTitle(item.title || "");
  const textBlob = buildTextBlob(item);
  const tickers = parseTickers(textBlob);
  const timeReported = item.isoDate || item.pubDate || new Date().toISOString();

  return {
    keyword,
    source: normalizeSource(item),
    timeReported,
    tickers,
    ticker: tickers[0] || "N/A",
    articleUrl: item.link || "",
    finvizUrls: tickers.map(
      (ticker) =>
        `https://finviz.com/quote.ashx?t=${encodeURIComponent(toFinvizTicker(ticker))}&p=d`
    ),
    finvizUrl: tickers[0]
      ? `https://finviz.com/quote.ashx?t=${encodeURIComponent(toFinvizTicker(tickers[0]))}&p=d`
      : "",
    headline,
  };
}

function normalizeProviderItem(item, keyword, provider) {
  const normalized = normalizeItem(item, keyword);
  return {
    ...normalized,
    source: normalizeFeedSource(item, provider),
    providerId: provider.id,
    providerName: provider.name,
  };
}

function cleanCompanyCandidate(value) {
  return value
    .replace(/^[^A-Za-z]+|[^A-Za-z.&'\- ]+$/g, "")
    .replace(/\b('s)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompanyName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toFinvizTicker(ticker) {
  return ticker.replace(/[^A-Z0-9.]/g, "");
}

function extractCompanyCandidates(headline) {
  if (!headline) return [];

  const candidates = new Set();
  const patterns = [
    /^([A-Z][A-Za-z0-9.&'\-]+(?:\s+[A-Z][A-Za-z0-9.&'\-]+){0,3})'s\b/,
    /^([A-Z][A-Za-z0-9.&'\-]+)\b/,
    /\bat\s+([A-Z][A-Za-z0-9.&'\-]+(?:\s+[A-Z][A-Za-z0-9.&'\-]+){0,3})$/,
    /\bas\s+([A-Z][A-Za-z0-9.&'\-]+(?:\s+[A-Z][A-Za-z0-9.&'\-]+){0,2})\b/g,
    /\band\s+([A-Z][A-Za-z0-9.&'\-]+(?:\s+[A-Z][A-Za-z0-9.&'\-]+){0,2})\b/g,
    /\bfor\s+([A-Z][A-Za-z0-9.&'\-]+(?:\s+[A-Z][A-Za-z0-9.&'\-]+){0,3})$/,
    /\bwith\s+([A-Z][A-Za-z0-9.&'\-]+(?:\s+[A-Z][A-Za-z0-9.&'\-]+){0,3})$/,
    /\benables\s+([A-Z][A-Za-z0-9.&'\-]+(?:\s+[A-Z][A-Za-z0-9.&'\-]+){0,2})\b/g,
    /\b([A-Z][A-Za-z0-9.&'\-]+(?:\s+[A-Z][A-Za-z0-9.&'\-]+){0,3})\s+\([A-Z]{1,5}\)/g,
    /\b([a-z][A-Za-z0-9.&'\-]*[A-Z][A-Za-z0-9.&'\-]*)\b/g,
  ];

  for (const pattern of patterns) {
    if (pattern.global) {
      const matches = headline.matchAll(pattern);
      for (const match of matches) {
        const candidate = cleanCompanyCandidate(match[1] || "");
        if (candidate && !COMPANY_STOPWORDS.has(candidate)) {
          candidates.add(candidate);
        }
      }
      continue;
    }

    const match = headline.match(pattern);
    if (match) {
      const candidate = cleanCompanyCandidate(match[1] || "");
      if (candidate && !COMPANY_STOPWORDS.has(candidate)) {
        candidates.add(candidate);
      }
    }
  }

  return Array.from(candidates).slice(0, 5);
}

async function lookupTickerByCompanyName(companyName) {
  const cacheKey = companyName.toLowerCase();
  if (companyLookupCache.has(cacheKey)) {
    return companyLookupCache.get(cacheKey);
  }

  if (COMPANY_SYMBOL_ALIASES.has(cacheKey)) {
    const aliasedTicker = COMPANY_SYMBOL_ALIASES.get(cacheKey);
    companyLookupCache.set(cacheKey, Promise.resolve(aliasedTicker));
    return aliasedTicker;
  }

  const lookupPromise = (async () => {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(companyName)}&quotesCount=10&newsCount=0`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Lookup failed with status ${response.status}`);
    }

    const data = await response.json();
    const quotes = Array.isArray(data.quotes) ? data.quotes : [];
    const normalizedTarget = normalizeCompanyName(companyName);
    const rankedQuotes = quotes
      .filter((quote) => {
        const symbol = String(quote.symbol || "").toUpperCase();
        const type = String(quote.quoteType || "").toUpperCase();
        return symbol && !TICKER_STOPWORDS.has(symbol) && ["EQUITY", "ETF"].includes(type);
      })
      .map((quote) => {
        const symbol = String(quote.symbol || "").toUpperCase();
        const name = String(quote.shortname || quote.longname || "");
        const normalizedName = normalizeCompanyName(name);
        let score = 0;

        if (/^[A-Z]{1,5}$/.test(symbol)) score += 3;
        if (normalizedName === normalizedTarget) score += 6;
        else if (normalizedName.startsWith(normalizedTarget)) score += 4;
        else if (normalizedName.includes(normalizedTarget)) score += 2;
        if (symbol === companyName.toUpperCase()) score += 4;
        if (String(quote.exchange || "").match(/NMS|NYQ|ASE|PCX|BTS/)) score += 1;

        return { quote, score };
      })
      .filter((entry) => entry.score >= 4)
      .sort((left, right) => right.score - left.score);

    const match = rankedQuotes.find((entry) => {
      const name = String(entry.quote.shortname || entry.quote.longname || "");
      const normalizedName = normalizeCompanyName(name);
      const symbol = String(entry.quote.symbol || "").toUpperCase();
      return normalizedName.includes(normalizedTarget) || symbol === companyName.toUpperCase();
    });

    return match?.quote?.symbol ? String(match.quote.symbol).toUpperCase() : null;
  })().catch(() => null);

  companyLookupCache.set(cacheKey, lookupPromise);
  return lookupPromise;
}

async function enrichTickersFromHeadline(item) {
  const resolvedTickers = new Set(item.tickers || []);
  const candidates = extractCompanyCandidates(item.headline);
  for (const candidate of candidates) {
    const ticker = await lookupTickerByCompanyName(candidate);
    if (ticker) {
      resolvedTickers.add(ticker);
    }
  }

  const tickers = Array.from(resolvedTickers);
  return {
    ...item,
    tickers,
    ticker: tickers[0] || "N/A",
    finvizUrls: tickers.map(
      (ticker) =>
        `https://finviz.com/quote.ashx?t=${encodeURIComponent(toFinvizTicker(ticker))}&p=d`
    ),
    finvizUrl: tickers[0]
      ? `https://finviz.com/quote.ashx?t=${encodeURIComponent(toFinvizTicker(tickers[0]))}&p=d`
      : "",
  };
}

function dedupeItems(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = `${item.headline.toLowerCase()}|${item.source.toLowerCase()}|${item.timeReported}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

async function fetchKeywordFeed(keyword) {
  const feed = await parseFeedFromUrl(buildFeedUrl(keyword));
  const items = Array.isArray(feed.items) ? feed.items : [];
  const normalizedItems = items.map((item) =>
    normalizeProviderItem(item, keyword, FEED_PROVIDER_MAP.get("google-news"))
  );
  return Promise.all(normalizedItems.map(enrichTickersFromHeadline));
}

async function fetchProviderFeed(provider, keywords) {
  const feed = await parseFeedFromUrl(provider.url);
  const items = Array.isArray(feed.items) ? feed.items : [];
  const normalizedItems = items
    .map((item) => {
      const keyword = findMatchedKeyword(
        `${stripSourceFromTitle(item.title || "")} ${buildTextBlob(item)}`,
        keywords
      );

      if (!keyword) {
        return null;
      }

      return normalizeProviderItem(item, keyword, provider);
    })
    .filter(Boolean);

  return Promise.all(normalizedItems.map(enrichTickersFromHeadline));
}

async function fetchNews() {
  const keywords = getKeywords();
  const feedIds = getDefaultFeedIds();
  return fetchNewsForKeywords(keywords, feedIds);
}

async function fetchNewsForKeywords(keywords, feedIds) {
  const providers = normalizeFeedIds(feedIds).map((feedId) => FEED_PROVIDER_MAP.get(feedId));
  const fetchJobs = [];

  providers.forEach((provider) => {
    if (provider.mode === "keyword-search") {
      keywords.forEach((keyword) => {
        fetchJobs.push({
          provider,
          keyword,
          run: () => fetchKeywordFeed(keyword),
        });
      });
      return;
    }

    fetchJobs.push({
      provider,
      keyword: null,
      run: () => fetchProviderFeed(provider, keywords),
    });
  });

  const settled = await Promise.allSettled(fetchJobs.map((job) => job.run()));
  const rows = [];
  const errors = [];

  settled.forEach((result, index) => {
    const job = fetchJobs[index];
    if (result.status === "fulfilled") {
      rows.push(...result.value);
      return;
    }

    errors.push({
      providerId: job.provider.id,
      providerName: job.provider.name,
      keyword: job.keyword,
      message: result.reason?.message || "Unknown fetch error",
    });
  });

  const normalized = dedupeItems(rows)
    .filter((item) => isFreshEnough(item.timeReported))
    .sort((a, b) => new Date(b.timeReported).getTime() - new Date(a.timeReported).getTime());

  return {
    fetchedAt: new Date().toISOString(),
    refreshIntervalMs: CACHE_TTL_MS,
    total: normalized.length,
    keywords,
    feedIds: providers.map((provider) => provider.id),
    feeds: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      description: provider.description,
    })),
    errors,
    items: normalized,
  };
}

async function getCachedNews() {
  const now = Date.now();
  if (cache.payload && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.payload;
  }

  const payload = await fetchNews();
  cache.fetchedAt = now;
  cache.payload = payload;
  return payload;
}

  app.use(express.json());
app.use(express.static("public"));

app.get("/api/feeds", (req, res) => {
  res.json({
    feeds: FEED_PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
      description: provider.description,
    })),
    defaultFeedIds: getDefaultFeedIds(),
  });
});

app.get("/api/news", async (req, res) => {
  try {
    const requestedKeywords =
      typeof req.query.keywords === "string" && req.query.keywords.trim()
        ? req.query.keywords
            .split(FEED_SEPARATOR)
            .map((keyword) => keyword.trim())
            .filter(Boolean)
        : null;
    const requestedFeedIds =
      typeof req.query.feeds === "string" && req.query.feeds.trim()
        ? req.query.feeds
            .split(FEED_SEPARATOR)
            .map((feedId) => feedId.trim())
            .filter(Boolean)
        : null;
    const payload = requestedKeywords?.length
      ? await fetchNewsForKeywords(requestedKeywords, requestedFeedIds || getDefaultFeedIds())
      : await getCachedNews();
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load financial news.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Financial news monitor running at http://localhost:${PORT}`);
});
