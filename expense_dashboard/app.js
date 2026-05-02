const requiredHeaders = ["Date", "Category", "Vendor", "Subtotal", "Tax", "Total", "Gratuity", "Receipt Link"];
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" });

const state = {
  rows: [],
  filtered: [],
  grain: "year",
  period: "all",
  query: "",
  chart: null,
  compareA: "",
  compareB: "",
};

const els = {
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  browseButton: document.getElementById("browseButton"),
  sampleButton: document.getElementById("sampleButton"),
  fileStatus: document.getElementById("fileStatus"),
  dashboard: document.getElementById("dashboard"),
  periodSelect: document.getElementById("periodSelect"),
  searchInput: document.getElementById("searchInput"),
  expenseRows: document.getElementById("expenseRows"),
  grandTotal: document.getElementById("grandTotal"),
  rowCount: document.getElementById("rowCount"),
  kpiTotal: document.getElementById("kpiTotal"),
  kpiCount: document.getElementById("kpiCount"),
  kpiAverage: document.getElementById("kpiAverage"),
  kpiCategory: document.getElementById("kpiCategory"),
  detailTitle: document.getElementById("detailTitle"),
  detailPercent: document.getElementById("detailPercent"),
  vendorBreakdown: document.getElementById("vendorBreakdown"),
  detailTotal: document.getElementById("detailTotal"),
  compareMonthA: document.getElementById("compareMonthA"),
  compareMonthB: document.getElementById("compareMonthB"),
  compareALabel: document.getElementById("compareALabel"),
  compareBLabel: document.getElementById("compareBLabel"),
  compareATotal: document.getElementById("compareATotal"),
  compareBTotal: document.getElementById("compareBTotal"),
  compareDelta: document.getElementById("compareDelta"),
  compareAHeader: document.getElementById("compareAHeader"),
  compareBHeader: document.getElementById("compareBHeader"),
  comparisonRows: document.getElementById("comparisonRows"),
};

const palette = [
  "#22c7b8", "#f5b84b", "#5aa7ff", "#ef6f8e", "#9bdb70", "#b495ff",
  "#f28f45", "#4dd4f0", "#ffcf5c", "#6ee7a8", "#ff7a70", "#a6b7ff",
];

function normalizeHeader(value) {
  return String(value || "").trim();
}

function parseExcelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    return new Date(utcValue * 1000);
  }
  if (typeof value === "string") {
    const cleaned = value.trim();
    const parsed = new Date(cleaned);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "").replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function getISOWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return { year: target.getUTCFullYear(), week };
}

function periodKey(row, grain = state.grain) {
  const d = row.date;
  const year = d.getFullYear();
  if (grain === "year") return `${year}`;
  if (grain === "quarter") return `${year} Q${Math.floor(d.getMonth() / 3) + 1}`;
  if (grain === "month") return `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const iso = getISOWeek(d);
  return `${iso.year} W${String(iso.week).padStart(2, "0")}`;
}

function periodSortValue(key) {
  const weekMatch = key.match(/^(\d{4}) W(\d{2})$/);
  if (weekMatch) return Number(weekMatch[1]) * 100 + Number(weekMatch[2]);
  const quarterMatch = key.match(/^(\d{4}) Q(\d)$/);
  if (quarterMatch) return Number(quarterMatch[1]) * 10 + Number(quarterMatch[2]);
  if (/^\d{4}-\d{2}$/.test(key)) return Number(key.replace("-", ""));
  return Number(key) || 0;
}

function periodLabel(key) {
  if (state.grain === "month" && /^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return key;
}

function monthKey(row) {
  return periodKey(row, "month");
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function parseWorkbook(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  const header = rows[0].map(normalizeHeader);
  const missing = requiredHeaders.filter((name) => !header.includes(name));
  if (missing.length) {
    throw new Error(`Missing required header${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }
  const indexes = Object.fromEntries(requiredHeaders.map((name) => [name, header.indexOf(name)]));

  return rows.slice(1).map((cells, index) => {
    const date = parseExcelDate(cells[indexes.Date]);
    if (!date) return null;
    const category = String(cells[indexes.Category] || "Uncategorized").trim() || "Uncategorized";
    const vendor = String(cells[indexes.Vendor] || "Unknown Vendor").trim() || "Unknown Vendor";
    return {
      id: index + 2,
      date,
      category,
      vendor,
      subtotal: toNumber(cells[indexes.Subtotal]),
      tax: toNumber(cells[indexes.Tax]),
      total: toNumber(cells[indexes.Total]),
      gratuity: toNumber(cells[indexes.Gratuity]),
      receipt: String(cells[indexes["Receipt Link"]] || "").trim(),
    };
  }).filter(Boolean).sort((a, b) => b.date - a.date);
}

async function readFile(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  loadRows(parseWorkbook(workbook), file.name);
}

async function loadSample() {
  const response = await fetch("./input/ExpenseTracker.xlsx");
  if (!response.ok) throw new Error("Could not load the sample workbook from ./input/ExpenseTracker.xlsx");
  const data = await response.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  loadRows(parseWorkbook(workbook), "ExpenseTracker.xlsx");
}

function loadRows(rows, filename) {
  state.rows = rows;
  state.grain = "year";
  state.period = "all";
  state.query = "";
  els.searchInput.value = "";
  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.grain === state.grain);
  });
  els.fileStatus.querySelector("span").textContent = `${filename} - ${rows.length.toLocaleString()} rows`;
  els.dashboard.classList.remove("hidden");
  populatePeriods();
  populateComparisonMonths();
  render();
}

function populatePeriods() {
  const periods = [...new Set(state.rows.map((row) => periodKey(row)))].sort((a, b) => periodSortValue(b) - periodSortValue(a));
  els.periodSelect.innerHTML = `<option value="all">All ${state.grain}s</option>` + periods.map((key) => (
    `<option value="${key}">${periodLabel(key)}</option>`
  )).join("");
  els.periodSelect.value = state.period;
}

function populateComparisonMonths() {
  const months = [...new Set(state.rows.map(monthKey))].sort((a, b) => periodSortValue(b) - periodSortValue(a));
  const options = months.map((key) => `<option value="${key}">${monthLabel(key)}</option>`).join("");
  els.compareMonthA.innerHTML = options;
  els.compareMonthB.innerHTML = options;
  state.compareA = months[0] || "";
  state.compareB = months[1] || months[0] || "";
  els.compareMonthA.value = state.compareA;
  els.compareMonthB.value = state.compareB;
}

function applyFilters() {
  const query = state.query.toLowerCase();
  state.filtered = state.rows.filter((row) => {
    const periodMatches = state.period === "all" || periodKey(row) === state.period;
    const queryMatches = !query || row.vendor.toLowerCase().includes(query) || row.category.toLowerCase().includes(query);
    return periodMatches && queryMatches;
  });
}

function aggregateByCategory(rows) {
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.category, (map.get(row.category) || 0) + row.total);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function aggregateVendors(category) {
  const map = new Map();
  state.filtered.filter((row) => row.category === category).forEach((row) => {
    map.set(row.vendor, (map.get(row.vendor) || 0) + row.total);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function render() {
  applyFilters();
  renderKpis();
  renderTable();
  renderChart();
  renderComparison();
  resetDetail();
  if (window.lucide) window.lucide.createIcons();
}

function renderKpis() {
  const total = state.filtered.reduce((sum, row) => sum + row.total, 0);
  const count = state.filtered.length;
  const categories = aggregateByCategory(state.filtered);
  els.kpiTotal.textContent = currency.format(total);
  els.kpiCount.textContent = count.toLocaleString();
  els.kpiAverage.textContent = currency.format(count ? total / count : 0);
  els.kpiCategory.textContent = categories[0]?.[0] || "-";
  els.grandTotal.textContent = currency.format(total);
  els.rowCount.textContent = `${count.toLocaleString()} row${count === 1 ? "" : "s"}`;
}

function renderTable() {
  const rows = state.filtered.slice(0, 500);
  if (!rows.length) {
    els.expenseRows.innerHTML = `<tr><td class="empty-row" colspan="8">No transactions match the active filters.</td></tr>`;
    return;
  }
  els.expenseRows.innerHTML = rows.map((row) => {
    const receipt = row.receipt ? `<a href="${row.receipt}" target="_blank" rel="noreferrer">Open</a>` : "";
    return `
      <tr>
        <td>${shortDate.format(row.date)}</td>
        <td>${escapeHtml(row.category)}</td>
        <td>${escapeHtml(row.vendor)}</td>
        <td>${currency.format(row.subtotal)}</td>
        <td>${currency.format(row.tax)}</td>
        <td>${currency.format(row.gratuity)}</td>
        <td>${currency.format(row.total)}</td>
        <td>${receipt}</td>
      </tr>
    `;
  }).join("");
}

function renderChart() {
  const categories = aggregateByCategory(state.filtered);
  const labels = categories.map(([label]) => label);
  const values = categories.map(([, value]) => value);
  const ctx = document.getElementById("expenseChart");
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, index) => palette[index % palette.length]),
        borderColor: "#07111f",
        borderWidth: 2,
        hoverOffset: 14,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#d9e7f7", boxWidth: 14, padding: 14 },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${currency.format(context.parsed)}`,
          },
        },
      },
      onHover: (_event, elements) => {
        if (elements.length) {
          const index = elements[0].index;
          renderDetail(labels[index], values[index]);
        }
      },
    },
  });
}

function totalRows(rows) {
  return rows.reduce((sum, row) => sum + row.total, 0);
}

function categoryTotals(rows) {
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.category, (map.get(row.category) || 0) + row.total);
  });
  return map;
}

function renderComparison() {
  if (!state.compareA || !state.compareB) {
    els.comparisonRows.innerHTML = `<tr><td class="empty-row" colspan="5">Load a workbook with dated transactions to compare months.</td></tr>`;
    return;
  }

  const rowsA = state.rows.filter((row) => monthKey(row) === state.compareA);
  const rowsB = state.rows.filter((row) => monthKey(row) === state.compareB);
  const totalA = totalRows(rowsA);
  const totalB = totalRows(rowsB);
  const delta = totalA - totalB;
  const labelA = monthLabel(state.compareA);
  const labelB = monthLabel(state.compareB);
  const totalsA = categoryTotals(rowsA);
  const totalsB = categoryTotals(rowsB);
  const categories = [...new Set([...totalsA.keys(), ...totalsB.keys()])];

  els.compareALabel.textContent = labelA;
  els.compareBLabel.textContent = labelB;
  els.compareATotal.textContent = currency.format(totalA);
  els.compareBTotal.textContent = currency.format(totalB);
  els.compareDelta.textContent = `${delta >= 0 ? "+" : ""}${currency.format(delta)}`;
  els.compareDelta.classList.toggle("delta-up", delta > 0);
  els.compareDelta.classList.toggle("delta-down", delta < 0);
  els.compareAHeader.textContent = labelA;
  els.compareBHeader.textContent = labelB;

  const comparison = categories.map((category) => {
    const valueA = totalsA.get(category) || 0;
    const valueB = totalsB.get(category) || 0;
    const change = valueB ? ((valueA - valueB) / valueB) * 100 : valueA ? 100 : 0;
    return { category, valueA, valueB, difference: valueA - valueB, change };
  }).sort((a, b) => b.difference - a.difference);

  if (!comparison.length) {
    els.comparisonRows.innerHTML = `<tr><td class="empty-row" colspan="5">No expenses found for the selected months.</td></tr>`;
    return;
  }

  els.comparisonRows.innerHTML = comparison.map((row) => `
    <tr>
      <td>${escapeHtml(row.category)}</td>
      <td>${currency.format(row.valueA)}</td>
      <td>${currency.format(row.valueB)}</td>
      <td class="${row.difference > 0 ? "delta-up" : row.difference < 0 ? "delta-down" : ""}">
        ${row.difference >= 0 ? "+" : ""}${currency.format(row.difference)}
      </td>
      <td class="${row.change > 0 ? "delta-up" : row.change < 0 ? "delta-down" : ""}">
        ${row.change >= 0 ? "+" : ""}${row.change.toFixed(1)}%
      </td>
    </tr>
  `).join("");
}

function renderDetail(category, amount) {
  const total = state.filtered.reduce((sum, row) => sum + row.total, 0);
  const percent = total ? (amount / total) * 100 : 0;
  const vendors = aggregateVendors(category);
  els.detailTitle.textContent = category;
  els.detailPercent.textContent = `${currency.format(amount)} represents ${percent.toFixed(1)}% of filtered spend.`;
  els.vendorBreakdown.innerHTML = vendors.map(([vendor, value]) => `
    <div class="vendor-row">
      <span>${escapeHtml(vendor)}</span>
      <strong>${currency.format(value)}</strong>
    </div>
  `).join("");
  if (vendors.length > 1) {
    els.detailTotal.classList.remove("hidden");
    els.detailTotal.innerHTML = `
      <span>Overall Total</span>
      <strong>${currency.format(amount)}</strong>
    `;
  } else {
    els.detailTotal.classList.add("hidden");
    els.detailTotal.innerHTML = "";
  }
}

function resetDetail() {
  els.detailTitle.textContent = "Select a slice";
  els.detailPercent.textContent = "Hover over the pie chart to see the vendor breakdown for that category.";
  els.vendorBreakdown.innerHTML = "";
  els.detailTotal.classList.add("hidden");
  els.detailTotal.innerHTML = "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

els.browseButton.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) readFile(file).catch(showError);
});

els.sampleButton.addEventListener("click", () => loadSample().catch(showError));

["dragenter", "dragover"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
  });
});

els.dropZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) readFile(file).catch(showError);
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.grain = button.dataset.grain;
    state.period = "all";
    document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("active", item === button));
    populatePeriods();
    render();
  });
});

els.periodSelect.addEventListener("change", () => {
  state.period = els.periodSelect.value;
  render();
});

els.compareMonthA.addEventListener("change", () => {
  state.compareA = els.compareMonthA.value;
  renderComparison();
});

els.compareMonthB.addEventListener("change", () => {
  state.compareB = els.compareMonthB.value;
  renderComparison();
});

els.searchInput.addEventListener("input", () => {
  state.query = els.searchInput.value.trim();
  render();
});

function showError(error) {
  els.fileStatus.querySelector("span").textContent = error.message || "Unable to read file";
  els.fileStatus.style.color = "var(--danger)";
}

if (window.lucide) window.lucide.createIcons();
