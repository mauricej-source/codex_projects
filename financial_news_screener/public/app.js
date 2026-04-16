const POLL_INTERVAL_MS = 15 * 60 * 1000;

const statusEl = document.getElementById("status");
const lastRefreshEl = document.getElementById("lastRefresh");
const matchCountEl = document.getElementById("matchCount");
const summaryEl = document.getElementById("summary");
const messageEl = document.getElementById("message");
const keywordChipsEl = document.getElementById("keywordChips");
const tableBodyEl = document.getElementById("newsTableBody");
const refreshButtonEl = document.getElementById("refreshButton");
const resetButtonEl = document.getElementById("resetButton");
const keywordInputEl = document.getElementById("keywordInput");
const applyKeywordsButtonEl = document.getElementById("applyKeywordsButton");
const tickerFilterInputEl = document.getElementById("tickerFilterInput");
const ageDaysInputEl = document.getElementById("ageDaysInput");
const primaryGroupSelectEl = document.getElementById("primaryGroupSelect");
const secondaryGroupSelectEl = document.getElementById("secondaryGroupSelect");
const sortButtonEls = Array.from(document.querySelectorAll(".sort-button"));
const feedSelectEl = document.getElementById("feedSelect");
const feedSelectButtonEl = document.getElementById("feedSelectButton");
const feedSelectMenuEl = document.getElementById("feedSelectMenu");
const feedOptionsEl = document.getElementById("feedOptions");
const selectAllFeedsButtonEl = document.getElementById("selectAllFeedsButton");
const clearFeedsButtonEl = document.getElementById("clearFeedsButton");
const toggleTopPanelButtonEl = document.getElementById("toggleTopPanelButton");
const topCardEl = document.querySelector(".top-card");

const DEFAULT_KEYWORDS =
  "strategic|partnership|collaboration|MOU|accelerated|growth|artificial|intelligence|trump|IPO";
const FEED_SEPARATOR = "|";
const KEYWORDS_STORAGE_KEY = "news-scanner.keywords";
const TOP_PANEL_COLLAPSED_STORAGE_KEY = "news-scanner.top-panel-collapsed";
const AGE_DAYS_STORAGE_KEY = "news-scanner.age-days";
const TICKER_FILTER_STORAGE_KEY = "news-scanner.ticker-filter";
const DEFAULT_AGE_DAYS = 14;
const DEFAULT_GROUPING = {
  primary: "none",
  secondary: "none",
};
let currentKeywordString = DEFAULT_KEYWORDS;
let currentItems = [];
let allKeywords = DEFAULT_KEYWORDS.split("|");
let activeKeywords = [...allKeywords];
let availableFeeds = [];
let defaultFeedIds = [];
let activeFeedIds = [];
let currentSort = {
  key: "timeReported",
  direction: "desc",
};
let currentGrouping = { ...DEFAULT_GROUPING };
let currentAgeDays = DEFAULT_AGE_DAYS;
let currentTickerFilter = "";

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderKeywords(keywords) {
  keywordInputEl.value = allKeywords.join("|");
  keywordChipsEl.innerHTML = keywords
    .map(
      (keyword) => `
        <button
          class="chip ${activeKeywords.includes(keyword) ? "" : "is-disabled"}"
          type="button"
          data-keyword="${keyword}"
        >
          ${keyword}
        </button>
      `
    )
    .join("");

  Array.from(keywordChipsEl.querySelectorAll(".chip")).forEach((button) => {
    button.addEventListener("click", () => {
      const keyword = button.dataset.keyword;
      if (!keyword) return;

      if (activeKeywords.includes(keyword)) {
        activeKeywords = activeKeywords.filter((item) => item !== keyword);
      } else {
        activeKeywords = [...activeKeywords, keyword];
      }

      if (!activeKeywords.length) {
        activeKeywords = [...allKeywords];
      }

      currentKeywordString = activeKeywords.join("|");
      loadNews();
    });
  });
}

function getFeedButtonLabel() {
  if (!availableFeeds.length) return "Loading feeds...";
  if (activeFeedIds.length === availableFeeds.length) return "All News Feeds";
  if (activeFeedIds.length === 1) {
    return availableFeeds.find((feed) => feed.id === activeFeedIds[0])?.name || "1 Feed Selected";
  }

  return `${activeFeedIds.length} Feeds Selected`;
}

function updateFeedButtonLabel() {
  feedSelectButtonEl.textContent = getFeedButtonLabel();
}

function renderFeedOptions() {
  feedOptionsEl.innerHTML = availableFeeds
    .map(
      (feed) => `
        <label class="feed-option">
          <input type="checkbox" value="${feed.id}" ${
            activeFeedIds.includes(feed.id) ? "checked" : ""
          } />
          <span>
            <strong>${feed.name}</strong>
            <small>${feed.description}</small>
          </span>
        </label>
      `
    )
    .join("");

  Array.from(feedOptionsEl.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
    input.addEventListener("change", () => {
      const nextFeedIds = Array.from(
        feedOptionsEl.querySelectorAll('input[type="checkbox"]:checked')
      ).map((element) => element.value);

      activeFeedIds = nextFeedIds.length ? nextFeedIds : availableFeeds.map((feed) => feed.id);
      renderFeedOptions();
      updateFeedButtonLabel();
      loadNews();
    });
  });
}

function closeFeedMenu() {
  feedSelectMenuEl.hidden = true;
  feedSelectButtonEl.setAttribute("aria-expanded", "false");
}

function openFeedMenu() {
  feedSelectMenuEl.hidden = false;
  feedSelectButtonEl.setAttribute("aria-expanded", "true");
}

async function loadFeeds() {
  const response = await fetch("/api/feeds", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Feed request failed with status ${response.status}`);
  }

  const data = await response.json();
  availableFeeds = Array.isArray(data.feeds) ? data.feeds : [];
  defaultFeedIds = Array.isArray(data.defaultFeedIds)
    ? data.defaultFeedIds
    : availableFeeds.map((feed) => feed.id);
  activeFeedIds = [...defaultFeedIds];
  renderFeedOptions();
  updateFeedButtonLabel();
}

function compareValues(left, right, key) {
  if (key === "timeReported") {
    return new Date(left[key]).getTime() - new Date(right[key]).getTime();
  }

  return String(left[key] || "").localeCompare(String(right[key] || ""), undefined, {
    sensitivity: "base",
  });
}

function getSortedItems(items) {
  const sorted = [...items].sort((left, right) => compareValues(left, right, currentSort.key));
  return currentSort.direction === "asc" ? sorted : sorted.reverse();
}

function getGroupValue(item, groupKey) {
  if (groupKey === "none") return "";
  const value = item[groupKey];
  return String(value || "N/A");
}

function getGroupLabel(groupKey) {
  const labels = {
    keyword: "Keyword",
    providerName: "News Feed",
    source: "News Source",
    ticker: "Ticker",
  };

  return labels[groupKey] || groupKey;
}

function groupItems(items, groupKeys) {
  if (!groupKeys.length) {
    return getSortedItems(items);
  }

  const [currentGroupKey, ...remainingGroupKeys] = groupKeys;
  const groupedItems = new Map();

  getSortedItems(items).forEach((item) => {
    const groupValue = getGroupValue(item, currentGroupKey);

    if (!groupedItems.has(groupValue)) {
      groupedItems.set(groupValue, []);
    }

    groupedItems.get(groupValue).push(item);
  });

  return Array.from(groupedItems.entries())
    .sort((left, right) => left[0].localeCompare(right[0], undefined, { sensitivity: "base" }))
    .map(([value, groupedGroupItems]) => ({
      type: "group",
      key: currentGroupKey,
      value,
      items: groupItems(groupedGroupItems, remainingGroupKeys),
    }));
}

function renderDataRow(item) {
  return `
    <tr>
      <td data-label="Keyword"><span class="keyword-pill">${item.keyword}</span></td>
      <td data-label="News Feed">${item.providerName || "N/A"}</td>
      <td data-label="News Source">${item.source}</td>
      <td data-label="News Title">${item.headline || "N/A"}</td>
      <td data-label="Time Reported" class="mono">${formatTimestamp(item.timeReported)}</td>
      <td data-label="Stock Ticker Symbol" class="mono ${(item.tickers || []).length ? "" : "muted-cell"}">${
        (item.tickers || []).length ? item.tickers.join(", ") : "N/A"
      }</td>
      <td data-label="News Link"><a href="${item.articleUrl}" target="_blank" rel="noreferrer">Open Article</a></td>
      <td data-label="Technical Chart">${
        (item.finvizUrls || []).length
          ? item.finvizUrls
              .map((url, index) => {
                const label = (item.tickers || [])[index] || `Chart ${index + 1}`;
                return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
              })
              .join(" | ")
          : `<span class="muted-cell">N/A</span>`
      }</td>
    </tr>
  `;
}

function renderGroupedRows(items, level = 0) {
  return items
    .map((item) => {
      if (item?.type !== "group") {
        return renderDataRow(item);
      }

      const levelClass = level === 0 ? "group-row-primary" : "group-row-secondary";
      return `
        <tr class="group-row ${levelClass}">
          <td colspan="8">${getGroupLabel(item.key)}: ${item.value}</td>
        </tr>
        ${renderGroupedRows(item.items, level + 1)}
      `;
    })
    .join("");
}

function renderSortState() {
  sortButtonEls.forEach((button) => {
    button.classList.remove("is-active", "is-active-desc");
    if (button.dataset.sortKey !== currentSort.key) return;
    button.classList.add(currentSort.direction === "asc" ? "is-active" : "is-active-desc");
  });
}

function renderRows(items) {
  const visibleItems = getVisibleItems(items);

  if (!visibleItems.length) {
    tableBodyEl.innerHTML = "";
    messageEl.textContent = currentTickerFilter
      ? `No recent stories matched ticker filter "${currentTickerFilter}".`
      : "No recent stories matched the configured keywords.";
    return;
  }

  messageEl.textContent = "";
  const groupingKeys = [currentGrouping.primary, currentGrouping.secondary].filter(
    (groupKey, index, array) => groupKey !== "none" && array.indexOf(groupKey) === index
  );
  tableBodyEl.innerHTML = renderGroupedRows(groupItems(visibleItems, groupingKeys));
}

function normalizeKeywordInput(value) {
  return value
    .split("|")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .join("|");
}

function readStoredKeywords() {
  try {
    return normalizeKeywordInput(window.localStorage.getItem(KEYWORDS_STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

function persistKeywords(keywordString) {
  try {
    window.localStorage.setItem(KEYWORDS_STORAGE_KEY, keywordString);
  } catch {
    // Ignore storage failures and keep the session state in memory.
  }
}

function clearStoredValue(storageKey) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures and keep the session state in memory.
  }
}

function initializeKeywords() {
  const storedKeywords = readStoredKeywords();
  const initialKeywordString = storedKeywords || DEFAULT_KEYWORDS;

  currentKeywordString = initialKeywordString;
  allKeywords = initialKeywordString.split("|").filter(Boolean);
  activeKeywords = [...allKeywords];
  keywordInputEl.value = initialKeywordString;
}

function normalizeAgeDays(value) {
  const normalized = Number.parseInt(String(value || "").trim(), 10);
  if (Number.isNaN(normalized) || normalized < 1) {
    return DEFAULT_AGE_DAYS;
  }

  return normalized;
}

function readStoredAgeDays() {
  try {
    return normalizeAgeDays(window.localStorage.getItem(AGE_DAYS_STORAGE_KEY) || DEFAULT_AGE_DAYS);
  } catch {
    return DEFAULT_AGE_DAYS;
  }
}

function persistAgeDays(ageDays) {
  try {
    window.localStorage.setItem(AGE_DAYS_STORAGE_KEY, String(ageDays));
  } catch {
    // Ignore storage failures and keep the session state in memory.
  }
}

function initializeAgeDays() {
  currentAgeDays = readStoredAgeDays();
  ageDaysInputEl.value = String(currentAgeDays);
}

function normalizeTickerFilter(value) {
  return String(value || "").trim().toUpperCase();
}

function readStoredTickerFilter() {
  try {
    return normalizeTickerFilter(window.localStorage.getItem(TICKER_FILTER_STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

function persistTickerFilter(value) {
  try {
    window.localStorage.setItem(TICKER_FILTER_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures and keep the session state in memory.
  }
}

function initializeTickerFilter() {
  currentTickerFilter = readStoredTickerFilter();
  tickerFilterInputEl.value = currentTickerFilter;
}

function getVisibleItems(items) {
  if (!currentTickerFilter) {
    return items;
  }

  return items.filter((item) => {
    const primaryTicker = String(item.ticker || "").toUpperCase();
    const allTickers = Array.isArray(item.tickers)
      ? item.tickers.map((ticker) => String(ticker || "").toUpperCase())
      : [];

    return (
      primaryTicker.includes(currentTickerFilter) ||
      allTickers.some((ticker) => ticker.includes(currentTickerFilter))
    );
  });
}

function readStoredTopPanelState() {
  try {
    return window.localStorage.getItem(TOP_PANEL_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistTopPanelState(isCollapsed) {
  try {
    window.localStorage.setItem(TOP_PANEL_COLLAPSED_STORAGE_KEY, String(isCollapsed));
  } catch {
    // Ignore storage failures and keep the session state in memory.
  }
}

function setTopPanelCollapsed(isCollapsed) {
  topCardEl.classList.toggle("is-collapsed", isCollapsed);
  toggleTopPanelButtonEl.textContent = isCollapsed ? "Expand Top Panel" : "Collapse Top Panel";
  toggleTopPanelButtonEl.setAttribute("aria-expanded", String(!isCollapsed));
}

function initializeTopPanel() {
  setTopPanelCollapsed(readStoredTopPanelState());
}

function syncGroupingControls() {
  primaryGroupSelectEl.value = currentGrouping.primary;
  secondaryGroupSelectEl.value = currentGrouping.secondary;
}

function updateGroupingFromControls() {
  const primary = primaryGroupSelectEl.value;
  let secondary = secondaryGroupSelectEl.value;

  if (secondary === primary) {
    secondary = "none";
    secondaryGroupSelectEl.value = secondary;
  }

  currentGrouping = { primary, secondary };
  renderRows(currentItems);
}

function applyAgeDaysFromInput() {
  currentAgeDays = normalizeAgeDays(ageDaysInputEl.value);
  ageDaysInputEl.value = String(currentAgeDays);
  persistAgeDays(currentAgeDays);
  loadNews();
}

function applyTickerFilterFromInput() {
  currentTickerFilter = normalizeTickerFilter(tickerFilterInputEl.value);
  tickerFilterInputEl.value = currentTickerFilter;
  persistTickerFilter(currentTickerFilter);
  renderRows(currentItems);
}

function applyKeywordsFromInput() {
  const normalized = normalizeKeywordInput(keywordInputEl.value || "");
  const nextKeywordString = normalized || DEFAULT_KEYWORDS;

  persistKeywords(nextKeywordString);
  keywordInputEl.value = nextKeywordString;
  allKeywords = nextKeywordString.split("|").filter(Boolean);
  activeKeywords = [...allKeywords];
  currentKeywordString = nextKeywordString;
  loadNews();
}

function resetPageState() {
  clearStoredValue(KEYWORDS_STORAGE_KEY);
  clearStoredValue(AGE_DAYS_STORAGE_KEY);
  clearStoredValue(TICKER_FILTER_STORAGE_KEY);
  clearStoredValue(TOP_PANEL_COLLAPSED_STORAGE_KEY);

  currentKeywordString = DEFAULT_KEYWORDS;
  allKeywords = DEFAULT_KEYWORDS.split("|").filter(Boolean);
  activeKeywords = [...allKeywords];
  keywordInputEl.value = currentKeywordString;

  currentAgeDays = DEFAULT_AGE_DAYS;
  ageDaysInputEl.value = String(currentAgeDays);

  currentTickerFilter = "";
  tickerFilterInputEl.value = "";

  currentGrouping = { ...DEFAULT_GROUPING };
  syncGroupingControls();

  currentSort = {
    key: "timeReported",
    direction: "desc",
  };
  renderSortState();

  activeFeedIds = [...defaultFeedIds];
  renderFeedOptions();
  updateFeedButtonLabel();
  closeFeedMenu();

  setTopPanelCollapsed(false);
  loadNews();
}

async function loadNews() {
  statusEl.textContent = "Refreshing";
  messageEl.textContent = "Loading latest financial news...";
  refreshButtonEl.disabled = true;
  applyKeywordsButtonEl.disabled = true;

  try {
    const query = new URLSearchParams();
    if (currentKeywordString) {
      query.set("keywords", currentKeywordString);
    }
    query.set("ageDays", String(currentAgeDays));
    if (activeFeedIds.length) {
      query.set("feeds", activeFeedIds.join(FEED_SEPARATOR));
    }

    const response = await fetch(`/api/news?${query.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    renderKeywords(allKeywords);
    currentKeywordString = activeKeywords.join("|") || DEFAULT_KEYWORDS;
    currentItems = data.items || [];
    renderSortState();
    renderRows(currentItems);

    statusEl.textContent = data.errors?.length ? "Partial" : "Live";
    lastRefreshEl.textContent = formatTimestamp(data.fetchedAt);
    matchCountEl.textContent = String(data.total || 0);
    const activeAgeDays = Number(data.ageDays) || currentAgeDays;
    summaryEl.textContent = data.errors?.length
      ? `Loaded ${data.total || 0} results from ${data.feedIds?.length || activeFeedIds.length} feeds over the last ${activeAgeDays} day${activeAgeDays === 1 ? "" : "s"}. Some feed requests failed.`
      : `Loaded ${data.total || 0} results from the last ${activeAgeDays} day${activeAgeDays === 1 ? "" : "s"}, sorted by the latest time reported.`;
  } catch (error) {
    statusEl.textContent = "Error";
    summaryEl.textContent = "Unable to refresh at the moment.";
    messageEl.textContent = error instanceof Error ? error.message : String(error);
    tableBodyEl.innerHTML = "";
  } finally {
    refreshButtonEl.disabled = false;
    applyKeywordsButtonEl.disabled = false;
  }
}

refreshButtonEl.addEventListener("click", loadNews);
resetButtonEl.addEventListener("click", resetPageState);
applyKeywordsButtonEl.addEventListener("click", applyKeywordsFromInput);
keywordInputEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyKeywordsFromInput();
});
sortButtonEls.forEach((button) => {
  button.addEventListener("click", () => {
    const nextKey = button.dataset.sortKey;
    if (!nextKey) return;

    if (currentSort.key === nextKey) {
      currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
    } else {
      currentSort.key = nextKey;
      currentSort.direction = "asc";
    }

    renderSortState();
    renderRows(currentItems);
  });
});

feedSelectButtonEl.addEventListener("click", () => {
  if (feedSelectMenuEl.hidden) {
    openFeedMenu();
    return;
  }

  closeFeedMenu();
});

selectAllFeedsButtonEl.addEventListener("click", () => {
  activeFeedIds = availableFeeds.map((feed) => feed.id);
  renderFeedOptions();
  updateFeedButtonLabel();
  loadNews();
});

clearFeedsButtonEl.addEventListener("click", () => {
  activeFeedIds = [...defaultFeedIds];
  renderFeedOptions();
  updateFeedButtonLabel();
  loadNews();
});

primaryGroupSelectEl.addEventListener("change", updateGroupingFromControls);
secondaryGroupSelectEl.addEventListener("change", updateGroupingFromControls);
ageDaysInputEl.addEventListener("change", applyAgeDaysFromInput);
ageDaysInputEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyAgeDaysFromInput();
});
tickerFilterInputEl.addEventListener("change", applyTickerFilterFromInput);
tickerFilterInputEl.addEventListener("input", applyTickerFilterFromInput);
tickerFilterInputEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyTickerFilterFromInput();
});

toggleTopPanelButtonEl.addEventListener("click", () => {
  const isCollapsed = !topCardEl.classList.contains("is-collapsed");
  setTopPanelCollapsed(isCollapsed);
  persistTopPanelState(isCollapsed);
});

document.addEventListener("click", (event) => {
  if (!feedSelectEl.contains(event.target)) {
    closeFeedMenu();
  }
});

initializeKeywords();
initializeAgeDays();
initializeTickerFilter();
initializeTopPanel();
syncGroupingControls();
renderSortState();
loadFeeds()
  .then(loadNews)
  .catch((error) => {
    statusEl.textContent = "Error";
    summaryEl.textContent = "Unable to load feed configuration.";
    messageEl.textContent = error instanceof Error ? error.message : String(error);
  });
setInterval(loadNews, POLL_INTERVAL_MS);
