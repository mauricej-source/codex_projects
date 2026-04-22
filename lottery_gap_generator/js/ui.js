(function () {
  function getElements() {
    return {
      fileInput: document.getElementById("csv-file"),
      csvInput: document.getElementById("csv-input"),
      processBtn: document.getElementById("process-btn"),
      ticketCount: document.getElementById("ticket-count"),
      strategyMode: document.getElementById("strategy-mode"),
      drawCount: document.getElementById("draw-count"),
      statusPill: document.getElementById("status-pill"),
      feedback: document.getElementById("feedback"),
      ticketsOutput: document.getElementById("tickets-output"),
      ticketBadge: document.getElementById("ticket-badge"),
      mainOverdueTable: document.getElementById("main-overdue-table"),
      powerballOverdueTable: document.getElementById("powerball-overdue-table"),
      drawHistoryTable: document.getElementById("draw-history-table"),
      drawHistoryFilter: document.getElementById("draw-history-filter"),
      frequencyCategorySummary: document.getElementById("frequency-category-summary"),
      chartCanvas: document.getElementById("frequency-chart")
    };
  }

  function buildEmptyRows(message, columns) {
    return `<tr><td colspan="${columns}" class="px-4 py-6 text-center text-slate-500">${message}</td></tr>`;
  }

  function setFeedback(elements, message, tone = "neutral") {
    const toneClassMap = {
      neutral: "text-slate-400 border-slate-800",
      success: "text-emerald-300 border-emerald-500/20",
      error: "text-rose-300 border-rose-500/20"
    };

    if (elements.feedback) {
      elements.feedback.className = `min-h-12 rounded-2xl bg-slate-900/70 px-4 py-3 text-sm ${toneClassMap[tone] || toneClassMap.neutral}`;
      elements.feedback.textContent = message;
    }
    elements.statusPill.textContent = tone === "success" ? "Live" : tone === "error" ? "Error" : "Waiting for data";
  }

  function clearDashboard(elements) {
    elements.drawCount.textContent = "0";
    elements.ticketBadge.textContent = "0 ready";
    elements.ticketsOutput.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-500">
        No tickets generated yet.
      </div>
    `;
    elements.mainOverdueTable.innerHTML = buildEmptyRows("No overdue data available.", 2);
    elements.powerballOverdueTable.innerHTML = buildEmptyRows("No overdue data available.", 2);
    elements.drawHistoryTable.innerHTML = buildEmptyRows("No draw history available.", 3);
    if (elements.drawHistoryFilter) {
      elements.drawHistoryFilter.value = "all";
    }
    elements.frequencyCategorySummary.innerHTML = `
      <div>Hot: --</div>
      <div>Warm: --</div>
      <div>Cold: --</div>
    `;
    window.PowerballChart.destroyFrequencyChart();
  }

  function renderFrequencyCategorySummary(elements, categories) {
    const hot = [...categories.main.hot].sort((a, b) => a - b).join(", ");
    const warm = [...categories.main.warm].sort((a, b) => a - b).join(", ");
    const cold = [...categories.main.cold].sort((a, b) => a - b).join(", ");

    elements.frequencyCategorySummary.innerHTML = `
      <div><span class="font-medium text-emerald-300">Hot:</span> ${hot}</div>
      <div><span class="font-medium text-emerald-300">Warm:</span> ${warm}</div>
      <div><span class="font-medium text-emerald-300">Cold:</span> ${cold}</div>
    `;
  }

  function getDrawPattern(row, categories) {
    const membershipCounts = row.mainBalls.reduce((counts, number) => {
      if (categories.main.hot.includes(number)) {
        counts.hot += 1;
      } else if (categories.main.warm.includes(number)) {
        counts.warm += 1;
      } else if (categories.main.cold.includes(number)) {
        counts.cold += 1;
      }

      return counts;
    }, { hot: 0, warm: 0, cold: 0 });

    return {
      counts: membershipCounts,
      label: `${membershipCounts.hot} Hot + ${membershipCounts.warm} Warm + ${membershipCounts.cold} Cold`
    };
  }

  function determineDrawStrategy(row, categories) {
    const pattern = getDrawPattern(row, categories);
    const { counts } = pattern;

    if (counts.hot === 5) {
      return {
        strategy: "All Hot",
        pattern: pattern.label
      };
    }

    if (counts.hot === 4 && counts.warm === 1) {
      return {
        strategy: "Hot-Heavy",
        pattern: pattern.label
      };
    }

    if (counts.hot === 2 && counts.warm === 2 && counts.cold === 1) {
      return {
        strategy: "Balanced",
        pattern: pattern.label
      };
    }

    if (counts.hot === 3 && counts.warm === 2) {
      return {
        strategy: "Hot Light",
        pattern: pattern.label
      };
    }

    if (counts.hot === 0 && counts.warm === 5) {
      return {
        strategy: "All Warm",
        pattern: pattern.label
      };
    }

    if (counts.hot === 1 && counts.warm === 4) {
      return {
        strategy: "Warm Heavy",
        pattern: pattern.label
      };
    }

    if (counts.hot === 2 && counts.warm === 3) {
      return {
        strategy: "Warm Light",
        pattern: pattern.label
      };
    }

    if (counts.hot === 1 && counts.warm === 2 && counts.cold === 2) {
      return {
        strategy: "Luke Warm",
        pattern: pattern.label
      };
    }

    if (counts.hot === 1 && counts.warm === 3 && counts.cold === 1) {
      return {
        strategy: "Warm",
        pattern: pattern.label
      };
    }

    if (counts.hot === 0 && counts.warm === 4 && counts.cold === 1) {
      return {
        strategy: "Cool",
        pattern: pattern.label
      };
    }

    if (counts.hot === 1 && counts.warm === 1 && counts.cold === 3) {
      return {
        strategy: "Cold",
        pattern: pattern.label
      };
    }

    if (counts.hot === 0 && counts.warm === 0 && counts.cold === 5) {
      return {
        strategy: "Coldest",
        pattern: pattern.label
      };
    }

    if (counts.hot === 0 && counts.warm === 1 && counts.cold === 4) {
      return {
        strategy: "Colder",
        pattern: pattern.label
      };
    }

    return {
      strategy: "Mixed Draw",
      pattern: pattern.label
    };
  }

  function renderDrawHistory(elements, rows, categories) {
    if (!rows.length) {
      elements.drawHistoryTable.innerHTML = buildEmptyRows("No draw history available.", 3);
      return;
    }

    const selectedStrategy = elements.drawHistoryFilter ? elements.drawHistoryFilter.value : "all";
    const classifiedRows = rows.map((row) => ({
      row,
      classification: determineDrawStrategy(row, categories)
    }));
    const filteredRows = selectedStrategy === "all"
      ? classifiedRows
      : classifiedRows.filter((item) => item.classification.strategy === selectedStrategy);

    if (!filteredRows.length) {
      elements.drawHistoryTable.innerHTML = buildEmptyRows("No draw history rows match the selected strategy.", 3);
      return;
    }

    elements.drawHistoryTable.innerHTML = filteredRows.map(({ row, classification }) => {
      const ballNumbers = `${row.mainBalls.join(", ")} | PB ${row.powerball}`;

      return `
        <tr>
          <td class="px-4 py-3 text-emerald-300">
            <div>${classification.strategy}</div>
            <div class="text-xs text-slate-400">${classification.pattern}</div>
          </td>
          <td class="px-4 py-3 text-slate-200">${row.date}</td>
          <td class="px-4 py-3 text-slate-300">${ballNumbers}</td>
        </tr>
      `;
    }).join("");
  }

  function renderTickets(elements, tickets, requestedCount) {
    elements.ticketBadge.textContent = `${tickets.length} ready`;

    if (!tickets.length) {
      elements.ticketsOutput.innerHTML = `
        <div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          No valid tickets were generated from the current gap distribution. Try a lower ticket count or a different dataset.
        </div>
      `;
      return;
    }

    elements.ticketsOutput.innerHTML = tickets.map((ticket, index) => `
      <div class="rounded-2xl border border-emerald-300 p-4 shadow-[0_0_12px_rgba(134,233,182,0.32)]" style="background-color: #86e9b6;">
        <div class="mb-3 flex items-center justify-between gap-3">
          <span class="text-xs uppercase tracking-[0.22em] text-slate-900">Ticket ${index + 1}</span>
          <span class="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-950" style="background-color: rgba(255, 255, 255, 0.35);">${ticket.oddEven} odd/even</span>
        </div>
        <div class="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-800">${ticket.strategy}</div>
        <div class="flex flex-wrap items-center gap-2">
          ${ticket.mainNumbers.map((number) => `
            <span class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 text-sm font-semibold text-slate-950" style="background-color: rgba(255, 255, 255, 0.28);">
              ${number}
            </span>
          `).join("")}
          <span class="ml-1 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-slate-700 px-3 text-sm font-semibold text-slate-950" style="background-color: rgba(255, 255, 255, 0.45);">
            PB ${ticket.powerball}
          </span>
        </div>
        <div class="mt-3 text-xs text-slate-900">Sum ${ticket.sum} • Generated under ${requestedCount}-ticket request</div>
      </div>
    `).join("");
  }

  function renderOverdueTables(elements, mainGaps, powerballGaps) {
    const mainRows = [...mainGaps]
      .sort((a, b) => b.gap - a.gap || a.number - b.number)
      .slice(0, 10);

    const powerballRows = [...powerballGaps]
      .sort((a, b) => b.gap - a.gap || a.number - b.number)
      .slice(0, 5);

    elements.mainOverdueTable.innerHTML = mainRows.map((item) => `
      <tr>
        <td class="px-4 py-3 text-slate-200">${item.number}</td>
        <td class="px-4 py-3 text-emerald-300">${item.gap}</td>
      </tr>
    `).join("");

    elements.powerballOverdueTable.innerHTML = powerballRows.map((item) => `
      <tr>
        <td class="px-4 py-3 text-slate-200">${item.number}</td>
        <td class="px-4 py-3 text-emerald-300">${item.gap}</td>
      </tr>
    `).join("");
  }

  function renderDashboard(elements, state, tickets, requestedCount) {
    renderTickets(elements, tickets, requestedCount);
    renderOverdueTables(elements, state.mainGaps, state.powerballGaps);
    renderDrawHistory(elements, state.rows, state.categories);
    renderFrequencyCategorySummary(elements, state.categories);
    window.PowerballChart.renderFrequencyChart(elements.chartCanvas, state.mainFrequency);
    elements.drawCount.textContent = String(state.rows.length);
  }

  window.PowerballUI = {
    getElements,
    setFeedback,
    clearDashboard,
    renderDrawHistory,
    renderTickets,
    renderOverdueTables,
    renderDashboard
  };
})();
