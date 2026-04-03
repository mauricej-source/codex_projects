const POLL_INTERVAL_MS = 15 * 60 * 1000;

const statusEl = document.getElementById("status");
const lastRefreshEl = document.getElementById("lastRefresh");
const matchCountEl = document.getElementById("matchCount");
const summaryEl = document.getElementById("summary");
const messageEl = document.getElementById("message");
const keywordChipsEl = document.getElementById("keywordChips");
const tableBodyEl = document.getElementById("newsTableBody");
const refreshButtonEl = document.getElementById("refreshButton");
const keywordInputEl = document.getElementById("keywordInput");
const applyKeywordsButtonEl = document.getElementById("applyKeywordsButton");
const sortButtonEls = Array.from(document.querySelectorAll(".sort-button"));
const feedSelectEl = document.getElementById("feedSelect");
const feedSelectButtonEl = document.getElementById("feedSelectButton");
const feedSelectMenuEl = document.getElementById("feedSelectMenu");
const feedOptionsEl = document.getElementById("feedOptions");
const selectAllFeedsButtonEl = document.getElementById("selectAllFeedsButton");
const clearFeedsButtonEl = document.getElementById("clearFeedsButton");

const DEFAULT_KEYWORDS =
  "strategic|partnership|collaboration|MOU|accelerated|growth|artificial|intelligence|trump|IPO";
const FEED_SEPARATOR = "|";
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

function renderSortState() {
  sortButtonEls.forEach((button) => {
    button.classList.remove("is-active", "is-active-desc");
    if (button.dataset.sortKey !== currentSort.key) return;
    button.classList.add(currentSort.direction === "asc" ? "is-active" : "is-active-desc");
  });
}

function renderRows(items) {
  if (!items.length) {
    tableBodyEl.innerHTML = "";
    messageEl.textContent = "No recent stories matched the configured keywords.";
    return;
  }

  messageEl.textContent = "";
  tableBodyEl.innerHTML = getSortedItems(items)
    .map(
      (item) => `
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
      `
    )
    .join("");
}

function normalizeKeywordInput(value) {
  return value
    .split("|")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .join("|");
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
    summaryEl.textContent = data.errors?.length
      ? `Loaded ${data.total || 0} results from ${data.feedIds?.length || activeFeedIds.length} feeds. Some feed requests failed.`
      : `Loaded ${data.total || 0} results sorted by the latest time reported.`;
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
applyKeywordsButtonEl.addEventListener("click", () => {
  const normalized = normalizeKeywordInput(keywordInputEl.value || "");
  allKeywords = (normalized || DEFAULT_KEYWORDS).split("|").filter(Boolean);
  activeKeywords = [...allKeywords];
  currentKeywordString = activeKeywords.join("|");
  loadNews();
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

document.addEventListener("click", (event) => {
  if (!feedSelectEl.contains(event.target)) {
    closeFeedMenu();
  }
});

keywordInputEl.value = DEFAULT_KEYWORDS;
renderSortState();
loadFeeds()
  .then(loadNews)
  .catch((error) => {
    statusEl.textContent = "Error";
    summaryEl.textContent = "Unable to load feed configuration.";
    messageEl.textContent = error instanceof Error ? error.message : String(error);
  });
setInterval(loadNews, POLL_INTERVAL_MS);
