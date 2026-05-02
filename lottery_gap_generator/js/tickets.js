(function () {
  const STRATEGY_CONFIGS = {
    balanced: {
      label: "Balanced",
      hot: 2,
      warm: 2,
      cold: 1
    },
    hotHeavy: {
      label: "Hot-Heavy",
      hot: 4,
      warm: 1,
      cold: 0
    },
    allHot: {
      label: "All Hot",
      hot: 5,
      warm: 0,
      cold: 0
    },
    hotLight: {
      label: "Hot Light",
      hot: 3,
      warm: 2,
      cold: 0
    },
    warmLight: {
      label: "Warm Light",
      hot: 2,
      warm: 3,
      cold: 0
    },
    warmHeavy: {
      label: "Warm Heavy",
      hot: 1,
      warm: 4,
      cold: 0
    },
    allWarm: {
      label: "All Warm",
      hot: 0,
      warm: 5,
      cold: 0
    },
    lukeWarm: {
      label: "Luke Warm",
      hot: 1,
      warm: 2,
      cold: 2
    },
    warm: {
      label: "Warm",
      hot: 1,
      warm: 3,
      cold: 1
    },
    cool: {
      label: "Cool",
      hot: 0,
      warm: 4,
      cold: 1
    },
    cold: {
      label: "Cold",
      hot: 1,
      warm: 1,
      cold: 3
    },
    colder: {
      label: "Colder",
      hot: 0,
      warm: 1,
      cold: 4
    },
    coldest: {
      label: "Coldest",
      hot: 0,
      warm: 0,
      cold: 5
    },
    mix: {
      label: "Strategy Mix"
    }
  };

  function pickUniqueNumbers(pool, count) {
    const available = [...pool];
    const picks = [];

    while (available.length && picks.length < count) {
      const randomIndex = Math.floor(Math.random() * available.length);
      picks.push(available.splice(randomIndex, 1)[0]);
    }

    return picks;
  }

  function shuffle(array) {
    const cloned = [...array];
    for (let index = cloned.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
    }
    return cloned;
  }

  function buildMainNumberSet(categories, strategyConfig) {
    const { hot, warm, cold } = categories.main;

    if (hot.length < strategyConfig.hot || warm.length < strategyConfig.warm || cold.length < strategyConfig.cold) {
      return null;
    }

    const mainNumbers = [
      ...pickUniqueNumbers(hot, strategyConfig.hot),
      ...pickUniqueNumbers(warm, strategyConfig.warm),
      ...pickUniqueNumbers(cold, strategyConfig.cold)
    ];

    const uniqueMainNumbers = [...new Set(mainNumbers)];
    if (uniqueMainNumbers.length !== 5) {
      return null;
    }

    return uniqueMainNumbers.sort((a, b) => a - b);
  }

  function buildTicket(categories, strategyKey, options = {}) {
    const strategyConfig = STRATEGY_CONFIGS[strategyKey] || STRATEGY_CONFIGS.balanced;
    const powerballWarm = categories.powerball.warm;
    const maxSum = options.maxSum ?? 200;

    if (powerballWarm.length < 1) {
      return null;
    }

    const sorted = buildMainNumberSet(categories, strategyConfig);
    if (!sorted) {
      return null;
    }

    const oddCount = sorted.filter((value) => value % 2 !== 0).length;
    const evenCount = sorted.length - oddCount;
    const total = sorted.reduce((sum, value) => sum + value, 0);
    const ratioValid = (oddCount === 3 && evenCount === 2) || (oddCount === 2 && evenCount === 3);
    const sumValid = total >= 130 && total <= maxSum;

    if (!ratioValid || !sumValid) {
      return null;
    }

    return {
      mainNumbers: sorted,
      powerball: shuffle(powerballWarm)[0],
      strategy: strategyConfig.label,
      oddEven: `${oddCount}:${evenCount}`,
      sum: total
    };
  }

  function createStrategyPlan(requestedCount) {
    const cycle = ["balanced", "hotHeavy", "allHot", "hotLight", "warmHeavy"];
    const plan = [];

    for (let index = 0; index < requestedCount; index += 1) {
      plan.push(cycle[index % cycle.length]);
    }

    return plan;
  }

  function generateTickets(categories, requestedCount, strategyKey, options = {}) {
    const tickets = [];
    const usedKeys = new Set();
    const strategyPlan = strategyKey === "mix"
      ? createStrategyPlan(requestedCount)
      : Array.from({ length: requestedCount }, () => strategyKey || "balanced");

    strategyPlan.forEach((strategyKey) => {
      let attempts = 0;
      const maxAttempts = 600;

      while (attempts < maxAttempts) {
        const ticket = buildTicket(categories, strategyKey, options);
        attempts += 1;

        if (!ticket) {
          continue;
        }

        const key = `${ticket.mainNumbers.join("-")}|${ticket.powerball}`;
        if (!usedKeys.has(key)) {
          usedKeys.add(key);
          tickets.push(ticket);
          return;
        }
      }
    });

    if (tickets.length < requestedCount) {
      const fallbackStrategies = strategyKey === "mix"
        ? ["balanced", "hotHeavy", "allHot"]
        : [strategyKey || "balanced"];
      let attempts = 0;
      const maxAttempts = requestedCount * 1200;

      while (tickets.length < requestedCount && attempts < maxAttempts) {
        const strategyKey = fallbackStrategies[attempts % fallbackStrategies.length];
        const ticket = buildTicket(categories, strategyKey, options);
        attempts += 1;

        if (!ticket) {
          continue;
        }

        const key = `${ticket.mainNumbers.join("-")}|${ticket.powerball}`;
        if (!usedKeys.has(key)) {
          usedKeys.add(key);
          tickets.push(ticket);
        }
      }
    }

    return tickets;
  }

  window.PowerballTickets = {
    buildTicket,
    generateTickets,
    STRATEGY_CONFIGS
  };
})();
