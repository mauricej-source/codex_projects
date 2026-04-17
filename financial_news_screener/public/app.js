const POLL_INTERVAL_MS = 15 * 60 * 1000;

const statusEl = document.getElementById("status");
const lastRefreshEl = document.getElementById("lastRefresh");
const matchCountEl = document.getElementById("matchCount");
const messageEl = document.getElementById("message");
const loadingOverlayEl = document.getElementById("loadingOverlay");
const keywordChipsEl = document.getElementById("keywordChips");
const tableBodyEl = document.getElementById("newsTableBody");
const researchCardEl = document.getElementById("researchCard");
const researchTableBodyEl = document.getElementById("researchTableBody");
const mainTableEl = tableBodyEl.closest("table");
const researchTableEl = researchTableBodyEl.closest("table");
const resultsCardEl = document.querySelector(".table-card");
const refreshButtonEl = document.getElementById("refreshButton");
const loadPricesButtonEl = document.getElementById("loadPricesButton");
const resetButtonEl = document.getElementById("resetButton");
const keywordInputEl = document.getElementById("keywordInput");
const applyKeywordsButtonEl = document.getElementById("applyKeywordsButton");
const tickerFilterInputEl = document.getElementById("tickerFilterInput");
const ageDaysInputEl = document.getElementById("ageDaysInput");
const primaryGroupSelectEl = document.getElementById("primaryGroupSelect");
const secondaryGroupSelectEl = document.getElementById("secondaryGroupSelect");
const minPriceInputEl = document.getElementById("minPriceInput");
const maxPriceInputEl = document.getElementById("maxPriceInput");
const feedSelectEl = document.getElementById("feedSelect");
const feedSelectButtonEl = document.getElementById("feedSelectButton");
const feedSelectMenuEl = document.getElementById("feedSelectMenu");
const feedOptionsEl = document.getElementById("feedOptions");
const selectAllFeedsButtonEl = document.getElementById("selectAllFeedsButton");
const clearFeedsButtonEl = document.getElementById("clearFeedsButton");
const toggleTopPanelButtonEl = document.getElementById("toggleTopPanelButton");
const toggleResultsPanelButtonEl = document.getElementById("toggleResultsPanelButton");
const toggleResearchPanelButtonEl = document.getElementById("toggleResearchPanelButton");
const topCardEl = document.querySelector(".top-card");

const DEFAULT_KEYWORDS =
  "strategic|partnership|collaboration|MOU|accelerated|growth|artificial|intelligence|trump|IPO";
const FEED_SEPARATOR = "|";
const KEYWORDS_STORAGE_KEY = "news-scanner.keywords";
const TOP_PANEL_COLLAPSED_STORAGE_KEY = "news-scanner.top-panel-collapsed";
const RESULTS_PANEL_COLLAPSED_STORAGE_KEY = "news-scanner.results-panel-collapsed";
const RESEARCH_PANEL_COLLAPSED_STORAGE_KEY = "news-scanner.research-panel-collapsed";
const AGE_DAYS_STORAGE_KEY = "news-scanner.age-days";
const TICKER_FILTER_STORAGE_KEY = "news-scanner.ticker-filter";
const PRICE_RANGE_STORAGE_KEY = "news-scanner.price-range";
const DEFAULT_AGE_DAYS = 14;
const DEFAULT_PRICE_RANGE = {
  min: 0,
  max: 10,
};
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
const DEFAULT_SORT = {
  key: "timeReported",
  direction: "desc",
};
let currentSort = {
  main: { ...DEFAULT_SORT },
  research: { ...DEFAULT_SORT },
};
let currentGrouping = { ...DEFAULT_GROUPING };
let currentAgeDays = DEFAULT_AGE_DAYS;
let currentTickerFilter = "";
let currentPriceRange = { ...DEFAULT_PRICE_RANGE };
let currentIncludePrices = false;
let pendingLoadCount = 0;

function getPanelToggleSymbol(isCollapsed) {
  return isCollapsed ? "˅" : "˄";
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function beginPageLoading() {
  pendingLoadCount += 1;
  loadingOverlayEl.hidden = false;
}

function updateLoadPricesButton() {
  loadPricesButtonEl.textContent = "Get Prices";
}

function endPageLoading() {
  pendingLoadCount = Math.max(0, pendingLoadCount - 1);
  if (!pendingLoadCount) {
    loadingOverlayEl.hidden = true;
  }
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

      renderKeywords(allKeywords);
      renderRows(currentItems);
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
  beginPageLoading();
  const response = await fetch("/api/feeds", { cache: "no-store" });
  if (!response.ok) {
    endPageLoading();
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
  endPageLoading();
}

function compareValues(left, right, key) {
  if (key === "timeReported") {
    return new Date(left[key]).getTime() - new Date(right[key]).getTime();
  }

  if (key === "stockPrice") {
    const leftPrice =
      typeof left.stockPrice === "number" ? left.stockPrice : Number.NEGATIVE_INFINITY;
    const rightPrice =
      typeof right.stockPrice === "number" ? right.stockPrice : Number.NEGATIVE_INFINITY;
    return leftPrice - rightPrice;
  }

  return String(left[key] || "").localeCompare(String(right[key] || ""), undefined, {
    sensitivity: "base",
  });
}

function getSortedItems(items, sortState) {
  const sorted = [...items].sort((left, right) => compareValues(left, right, sortState.key));
  return sortState.direction === "asc" ? sorted : sorted.reverse();
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

function groupItems(items, groupKeys, sortState) {
  if (!groupKeys.length) {
    return getSortedItems(items, sortState);
  }

  const [currentGroupKey, ...remainingGroupKeys] = groupKeys;
  const groupedItems = new Map();

  getSortedItems(items, sortState).forEach((item) => {
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
      items: groupItems(groupedGroupItems, remainingGroupKeys, sortState),
    }));
}

function renderDataRow(item) {
  const stockPriceDisplay =
    typeof item.stockPrice === "number"
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(item.stockPrice)
      : "N/A";

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
      <td data-label="Stock Price" class="mono ${stockPriceDisplay === "N/A" ? "muted-cell" : ""}">${stockPriceDisplay}</td>
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
          <td colspan="9">${getGroupLabel(item.key)}: ${item.value}</td>
        </tr>
        ${renderGroupedRows(item.items, level + 1)}
      `;
    })
    .join("");
}

function renderSortState(tableType) {
  const sortState = currentSort[tableType];
  const tableEl = tableType === "research" ? researchTableEl : mainTableEl;
  Array.from(tableEl.querySelectorAll(".sort-button")).forEach((button) => {
    button.classList.remove("is-active", "is-active-desc");
    if (button.dataset.sortKey !== sortState.key) return;
    button.classList.add(sortState.direction === "asc" ? "is-active" : "is-active-desc");
  });
}

function renderRows(items) {
  const tickerVisibleItems = getVisibleItems(items);
  const resolvedItems = tickerVisibleItems.filter((item) => (item.tickers || []).length);
  const researchItems = tickerVisibleItems.filter((item) => !(item.tickers || []).length);
  const visibleItems = getPriceFilteredItems(getKeywordFilteredItems(resolvedItems));

  if (!visibleItems.length) {
    tableBodyEl.innerHTML = "";
    if (researchItems.length) {
      messageEl.textContent = "No resolved tickers matched the active filters. Unresolved matches are listed below.";
    } else if (activeKeywords.length !== allKeywords.length) {
      messageEl.textContent = "No resolved tickers matched the active keyword chip filters.";
    } else if (!currentIncludePrices) {
      messageEl.textContent = "No resolved tickers are available yet for the current news selection.";
    } else if (currentTickerFilter) {
      messageEl.textContent = `No recent stories matched ticker filter "${currentTickerFilter}".`;
    } else if (currentPriceRange.min !== null || currentPriceRange.max !== null) {
      const minLabel =
        currentPriceRange.min !== null ? `$${currentPriceRange.min.toFixed(2)}` : "$0.00";
      const maxLabel =
        currentPriceRange.max !== null ? `$${currentPriceRange.max.toFixed(2)}` : "up";
      messageEl.textContent = `No recent stories matched price range ${minLabel}-${maxLabel}.`;
    } else {
      messageEl.textContent = "No recent stories matched the configured keywords.";
    }
  } else {
    messageEl.textContent = "";
    const groupingKeys = [currentGrouping.primary, currentGrouping.secondary].filter(
      (groupKey, index, array) => groupKey !== "none" && array.indexOf(groupKey) === index
    );
    tableBodyEl.innerHTML = renderGroupedRows(groupItems(visibleItems, groupingKeys, currentSort.main));
  }

  if (!researchItems.length) {
    researchCardEl.hidden = true;
    researchTableBodyEl.innerHTML = "";
    return;
  }

  researchCardEl.hidden = false;
  researchTableBodyEl.innerHTML = renderGroupedRows(getResearchGroupedItems(researchItems));
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

function normalizePriceBound(value) {
  const normalized = Number.parseFloat(String(value || "").trim());
  if (Number.isNaN(normalized) || normalized < 0) {
    return null;
  }

  return normalized;
}

function formatPriceBound(value) {
  return typeof value === "number" ? String(value) : "";
}

function normalizePriceRange(minValue, maxValue) {
  let min = normalizePriceBound(minValue);
  let max = normalizePriceBound(maxValue);

  if (typeof min === "number" && typeof max === "number" && min > max) {
    [min, max] = [max, min];
  }

  return { min, max };
}

function readStoredPriceRange() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRICE_RANGE_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_PRICE_RANGE };
    }

    return normalizePriceRange(parsed.min, parsed.max);
  } catch {
    return { ...DEFAULT_PRICE_RANGE };
  }
}

function persistPriceRange(priceRange) {
  try {
    window.localStorage.setItem(PRICE_RANGE_STORAGE_KEY, JSON.stringify(priceRange));
  } catch {
    // Ignore storage failures and keep the session state in memory.
  }
}

function syncPriceRangeInputs() {
  minPriceInputEl.value = formatPriceBound(currentPriceRange.min);
  maxPriceInputEl.value = formatPriceBound(currentPriceRange.max);
}

function initializePriceRange() {
  currentPriceRange = readStoredPriceRange();
  syncPriceRangeInputs();
}

function getVisibleItems(items) {
  return items.filter((item) => {
    const primaryTicker = String(item.ticker || "").toUpperCase();
    const allTickers = Array.isArray(item.tickers)
      ? item.tickers.map((ticker) => String(ticker || "").toUpperCase())
      : [];

    const matchesTicker =
      !currentTickerFilter ||
      primaryTicker.includes(currentTickerFilter) ||
      allTickers.some((ticker) => ticker.includes(currentTickerFilter));

    if (!matchesTicker) {
      return false;
    }

    return true;
  });
}

function getPriceFilteredItems(items) {
  return items.filter((item) => {
    if (!currentIncludePrices) {
      return true;
    }

    if (currentPriceRange.min === null && currentPriceRange.max === null) {
      return true;
    }

    if (typeof item.stockPrice !== "number") {
      return false;
    }

    if (typeof currentPriceRange.min === "number" && item.stockPrice < currentPriceRange.min) {
      return false;
    }

    if (typeof currentPriceRange.max === "number" && item.stockPrice > currentPriceRange.max) {
      return false;
    }

    return true;
  });
}

function getKeywordFilteredItems(items) {
  if (activeKeywords.length === allKeywords.length) {
    return items;
  }

  const activeKeywordSet = new Set(activeKeywords.map((keyword) => keyword.toLowerCase()));
  return items.filter((item) => activeKeywordSet.has(String(item.keyword || "").toLowerCase()));
}

function getResearchGroupedItems(items) {
  const groupingKeys = [currentGrouping.primary, currentGrouping.secondary].filter(
    (groupKey, index, array) =>
      groupKey !== "none" && groupKey !== "ticker" && array.indexOf(groupKey) === index
  );

  return groupItems(items, groupingKeys, currentSort.research);
}

function readStoredTopPanelState() {
  return readStoredCollapsedState(TOP_PANEL_COLLAPSED_STORAGE_KEY);
}

function readStoredCollapsedState(storageKey) {
  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function persistCollapsedState(storageKey, isCollapsed) {
  try {
    window.localStorage.setItem(storageKey, String(isCollapsed));
  } catch {
    // Ignore storage failures and keep the session state in memory.
  }
}

function persistTopPanelState(isCollapsed) {
  persistCollapsedState(TOP_PANEL_COLLAPSED_STORAGE_KEY, isCollapsed);
}

function setTopPanelCollapsed(isCollapsed) {
  topCardEl.classList.toggle("is-collapsed", isCollapsed);
  toggleTopPanelButtonEl.textContent = getPanelToggleSymbol(isCollapsed);
  toggleTopPanelButtonEl.setAttribute(
    "aria-label",
    isCollapsed ? "Expand Top Panel" : "Collapse Top Panel"
  );
  toggleTopPanelButtonEl.setAttribute(
    "title",
    isCollapsed ? "Expand Top Panel" : "Collapse Top Panel"
  );
  toggleTopPanelButtonEl.setAttribute("aria-expanded", String(!isCollapsed));
}

function initializeTopPanel() {
  setTopPanelCollapsed(readStoredTopPanelState());
}

function setTablePanelCollapsed(cardEl, buttonEl, isCollapsed, labels) {
  cardEl.classList.toggle("is-collapsed", isCollapsed);
  buttonEl.textContent = getPanelToggleSymbol(isCollapsed);
  buttonEl.setAttribute("aria-label", isCollapsed ? labels.expand : labels.collapse);
  buttonEl.setAttribute("title", isCollapsed ? labels.expand : labels.collapse);
  buttonEl.setAttribute("aria-expanded", String(!isCollapsed));
}

function initializeTablePanels() {
  setTablePanelCollapsed(
    resultsCardEl,
    toggleResultsPanelButtonEl,
    readStoredCollapsedState(RESULTS_PANEL_COLLAPSED_STORAGE_KEY),
    {
      collapse: "Collapse Latest Results",
      expand: "Expand Latest Results",
    }
  );
  setTablePanelCollapsed(
    researchCardEl,
    toggleResearchPanelButtonEl,
    readStoredCollapsedState(RESEARCH_PANEL_COLLAPSED_STORAGE_KEY),
    {
      collapse: "Collapse Requires Research",
      expand: "Expand Requires Research",
    }
  );
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

function applyPriceRangeFromInputs() {
  currentPriceRange = normalizePriceRange(minPriceInputEl.value, maxPriceInputEl.value);
  syncPriceRangeInputs();
  persistPriceRange(currentPriceRange);

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
  clearStoredValue(PRICE_RANGE_STORAGE_KEY);
  clearStoredValue(TOP_PANEL_COLLAPSED_STORAGE_KEY);
  clearStoredValue(RESULTS_PANEL_COLLAPSED_STORAGE_KEY);
  clearStoredValue(RESEARCH_PANEL_COLLAPSED_STORAGE_KEY);

  currentKeywordString = DEFAULT_KEYWORDS;
  allKeywords = DEFAULT_KEYWORDS.split("|").filter(Boolean);
  activeKeywords = [...allKeywords];
  keywordInputEl.value = currentKeywordString;

  currentAgeDays = DEFAULT_AGE_DAYS;
  ageDaysInputEl.value = String(currentAgeDays);

  currentTickerFilter = "";
  tickerFilterInputEl.value = "";

  currentPriceRange = { ...DEFAULT_PRICE_RANGE };
  syncPriceRangeInputs();

  currentIncludePrices = false;
  updateLoadPricesButton();

  currentGrouping = { ...DEFAULT_GROUPING };
  syncGroupingControls();

  currentSort = {
    main: { ...DEFAULT_SORT },
    research: { ...DEFAULT_SORT },
  };
  renderSortState("main");
  renderSortState("research");

  activeFeedIds = [...defaultFeedIds];
  renderFeedOptions();
  updateFeedButtonLabel();
  closeFeedMenu();

  setTopPanelCollapsed(false);
  setTablePanelCollapsed(resultsCardEl, toggleResultsPanelButtonEl, false, {
    collapse: "Collapse Latest Results",
    expand: "Expand Latest Results",
  });
  setTablePanelCollapsed(researchCardEl, toggleResearchPanelButtonEl, false, {
    collapse: "Collapse Requires Research",
    expand: "Expand Requires Research",
  });
  loadNews();
}

async function loadNews() {
  beginPageLoading();
  statusEl.textContent = "Refreshing";
  messageEl.textContent = "Loading latest financial news...";
  refreshButtonEl.disabled = true;
  loadPricesButtonEl.disabled = true;
  resetButtonEl.disabled = true;
  applyKeywordsButtonEl.disabled = true;

  try {
    const query = new URLSearchParams();
    if (currentKeywordString) {
      query.set("keywords", currentKeywordString);
    }
    query.set("ageDays", String(currentAgeDays));
    query.set("includePrices", currentIncludePrices ? "true" : "false");
    if (activeFeedIds.length) {
      query.set("feeds", activeFeedIds.join(FEED_SEPARATOR));
    }

    const response = await fetch(`/api/news?${query.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    renderKeywords(allKeywords);
    currentKeywordString = allKeywords.join("|") || DEFAULT_KEYWORDS;
    currentItems = data.items || [];
    const visibleCount = getPriceFilteredItems(
      getKeywordFilteredItems(getVisibleItems(currentItems).filter((item) => (item.tickers || []).length))
    ).length;
    renderSortState("main");
    renderSortState("research");
    renderRows(currentItems);

    statusEl.textContent = data.errors?.length ? "Partial" : "Live";
    lastRefreshEl.textContent = formatTimestamp(data.fetchedAt);
    matchCountEl.textContent = String(visibleCount);
  } catch (error) {
    statusEl.textContent = "Error";
    messageEl.textContent = error instanceof Error ? error.message : String(error);
    tableBodyEl.innerHTML = "";
    researchCardEl.hidden = true;
    researchTableBodyEl.innerHTML = "";
  } finally {
    refreshButtonEl.disabled = false;
    loadPricesButtonEl.disabled = false;
    resetButtonEl.disabled = false;
    applyKeywordsButtonEl.disabled = false;
    endPageLoading();
  }
}

refreshButtonEl.addEventListener("click", loadNews);
loadPricesButtonEl.addEventListener("click", () => {
  currentIncludePrices = true;
  updateLoadPricesButton();
  loadNews();
});
resetButtonEl.addEventListener("click", resetPageState);
applyKeywordsButtonEl.addEventListener("click", applyKeywordsFromInput);
keywordInputEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyKeywordsFromInput();
});
Array.from(document.querySelectorAll(".sort-button")).forEach((button) => {
  button.addEventListener("click", () => {
    const nextKey = button.dataset.sortKey;
    if (!nextKey) return;
    const tableType = button.closest("table") === researchTableEl ? "research" : "main";
    const sortState = currentSort[tableType];

    if (sortState.key === nextKey) {
      sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
    } else {
      sortState.key = nextKey;
      sortState.direction = "asc";
    }

    renderSortState(tableType);
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
minPriceInputEl.addEventListener("change", applyPriceRangeFromInputs);
maxPriceInputEl.addEventListener("change", applyPriceRangeFromInputs);
minPriceInputEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyPriceRangeFromInputs();
});
maxPriceInputEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyPriceRangeFromInputs();
});

toggleTopPanelButtonEl.addEventListener("click", () => {
  const isCollapsed = !topCardEl.classList.contains("is-collapsed");
  setTopPanelCollapsed(isCollapsed);
  persistTopPanelState(isCollapsed);
});
toggleResultsPanelButtonEl.addEventListener("click", () => {
  const isCollapsed = !resultsCardEl.classList.contains("is-collapsed");
  setTablePanelCollapsed(resultsCardEl, toggleResultsPanelButtonEl, isCollapsed, {
    collapse: "Collapse Latest Results",
    expand: "Expand Latest Results",
  });
  persistCollapsedState(RESULTS_PANEL_COLLAPSED_STORAGE_KEY, isCollapsed);
});
toggleResearchPanelButtonEl.addEventListener("click", () => {
  const isCollapsed = !researchCardEl.classList.contains("is-collapsed");
  setTablePanelCollapsed(researchCardEl, toggleResearchPanelButtonEl, isCollapsed, {
    collapse: "Collapse Requires Research",
    expand: "Expand Requires Research",
  });
  persistCollapsedState(RESEARCH_PANEL_COLLAPSED_STORAGE_KEY, isCollapsed);
});

document.addEventListener("click", (event) => {
  if (!feedSelectEl.contains(event.target)) {
    closeFeedMenu();
  }
});

initializeKeywords();
initializeAgeDays();
initializeTickerFilter();
initializePriceRange();
initializeTopPanel();
initializeTablePanels();
updateLoadPricesButton();
syncGroupingControls();
renderSortState("main");
renderSortState("research");
loadFeeds()
  .then(loadNews)
  .catch((error) => {
    statusEl.textContent = "Error";
    messageEl.textContent = error instanceof Error ? error.message : String(error);
  });
setInterval(loadNews, POLL_INTERVAL_MS);
