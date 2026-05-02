(function () {
  const state = window.PowerballState.createInitialState();
  const elements = window.PowerballUI.getElements();

  function getRequestedTicketCount() {
    return Math.max(1, Math.min(50, Number(elements.ticketCount.value) || 10));
  }

  function getStrategyMode() {
    return elements.strategyMode.value || "mix";
  }

  function getMaxSum() {
    return Math.max(130, Number(elements.sumLimit.value) || 200);
  }

  function rebuildTickets() {
    const requestedCount = getRequestedTicketCount();
    const tickets = window.PowerballTickets.generateTickets(state.categories, requestedCount, getStrategyMode(), {
      maxSum: getMaxSum()
    });
    window.PowerballUI.renderTickets(elements, tickets, requestedCount);
  }

  function rebuildDrawHistory() {
    window.PowerballUI.renderDrawHistory(elements, state.rows, state.categories);
  }

  function processData(csvOverride) {
    const csvText = typeof csvOverride === "string" ? csvOverride : elements.csvInput.value;

    try {
      window.PowerballState.resetState(state);
      window.PowerballUI.clearDashboard(elements);

      const rows = window.PowerballParser.parseCsv(csvText);
      window.PowerballCalculations.updateDerivedState(state, rows);

      const requestedCount = getRequestedTicketCount();
      const tickets = window.PowerballTickets.generateTickets(state.categories, requestedCount, getStrategyMode(), {
        maxSum: getMaxSum()
      });

      window.PowerballUI.renderDashboard(elements, state, tickets, requestedCount);
      window.PowerballUI.setFeedback(elements, `Processed ${rows.length} draws. Gap, overdue, ticket, and frequency views are now live.`, "success");
    } catch (error) {
      window.PowerballState.resetState(state);
      window.PowerballUI.clearDashboard(elements);
      window.PowerballUI.setFeedback(elements, error.message || "Unable to process the supplied CSV data.", "error");
    }
  }

  function handleFileSelection(event) {
    const [file] = event.target.files;
    if (!file) {
      return;
    }

    const reader = new FileReader();
    const lowerName = file.name.toLowerCase();
    const isSpreadsheet = lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx");

    reader.onload = () => {
      try {
        const csvText = isSpreadsheet
          ? window.PowerballParser.spreadsheetToCsvText(reader.result)
          : String(reader.result || "");

        elements.csvInput.value = csvText;
        processData(csvText);
      } catch (error) {
        window.PowerballUI.setFeedback(elements, error.message || "The selected file could not be parsed.", "error");
      }
    };

    reader.onerror = () => {
      window.PowerballUI.setFeedback(elements, "The selected file could not be read.", "error");
    };

    if (isSpreadsheet) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  function handlePaste() {
    window.setTimeout(() => {
      processData(elements.csvInput.value);
    }, 0);
  }

  function handleTicketCountChange() {
    if (!state.rows.length) {
      return;
    }

    rebuildTickets();
    window.PowerballUI.setFeedback(elements, `Rebuilt tickets using the current ${state.rows.length}-draw dataset.`, "success");
  }

  function setPanelCollapsed(button, collapsed) {
    const targetId = button.getAttribute("data-collapse-target");
    const target = document.getElementById(targetId);
    const caret = button.querySelector("[data-caret]");

    if (!target) {
      return;
    }

    target.classList.toggle("hidden", collapsed);
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");

    if (caret) {
      caret.textContent = collapsed ? "▸" : "▾";
    }
  }

  function bindCollapseToggles() {
    const collapseButtons = document.querySelectorAll("[data-collapse-target]");

    collapseButtons.forEach((button) => {
      const defaultCollapsed = button.getAttribute("data-collapsed-default") === "true";
      setPanelCollapsed(button, defaultCollapsed);
      button.addEventListener("click", () => {
        const isExpanded = button.getAttribute("aria-expanded") === "true";
        setPanelCollapsed(button, isExpanded);
      });
    });
  }

  function bindEvents() {
    elements.fileInput.addEventListener("change", handleFileSelection);
    elements.csvInput.addEventListener("paste", handlePaste);
    elements.processBtn.addEventListener("click", () => processData());
    elements.ticketCount.addEventListener("change", handleTicketCountChange);
    elements.sumLimit.addEventListener("change", handleTicketCountChange);
    elements.strategyMode.addEventListener("change", handleTicketCountChange);
    if (elements.drawHistoryFilter) {
      elements.drawHistoryFilter.addEventListener("change", () => {
        if (!state.rows.length) {
          return;
        }

        rebuildDrawHistory();
      });
    }
    bindCollapseToggles();
  }

  function init() {
    window.PowerballUI.clearDashboard(elements);
    bindEvents();
  }

  init();
})();
