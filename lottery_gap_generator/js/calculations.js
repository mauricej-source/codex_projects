(function () {
  function calculateGaps(rows, maxNumber, selector) {
    const gaps = [];

    for (let number = 1; number <= maxNumber; number += 1) {
      let gap = rows.length;

      for (let index = 0; index < rows.length; index += 1) {
        const values = selector(rows[index]);
        if (values.includes(number)) {
          gap = index;
          break;
        }
      }

      gaps.push({ number, gap });
    }

    return gaps;
  }

  function calculateFrequency(rows) {
    const mainFrequency = Array.from({ length: 69 }, (_, index) => ({ number: index + 1, count: 0 }));
    const powerballFrequency = Array.from({ length: 26 }, (_, index) => ({ number: index + 1, count: 0 }));

    rows.forEach((row) => {
      row.mainBalls.forEach((ball) => {
        if (ball >= 1 && ball <= 69) {
          mainFrequency[ball - 1].count += 1;
        }
      });

      if (row.powerball >= 1 && row.powerball <= 26) {
        powerballFrequency[row.powerball - 1].count += 1;
      }
    });

    return { mainFrequency, powerballFrequency };
  }

  function categorizeMainNumbers(mainGaps) {
    const ordered = [...mainGaps].sort((a, b) => a.gap - b.gap || a.number - b.number);
    return {
      hot: ordered.slice(0, 20).map((item) => item.number),
      warm: ordered.slice(20, ordered.length - 20).map((item) => item.number),
      cold: ordered.slice(ordered.length - 20).map((item) => item.number)
    };
  }

  function categorizePowerballs(powerballGaps) {
    const ordered = [...powerballGaps].sort((a, b) => a.gap - b.gap || a.number - b.number);
    const hotCount = 8;
    const coldCount = 8;
    return {
      hot: ordered.slice(0, hotCount).map((item) => item.number),
      warm: ordered.slice(hotCount, ordered.length - coldCount).map((item) => item.number),
      cold: ordered.slice(ordered.length - coldCount).map((item) => item.number)
    };
  }

  function updateDerivedState(state, rows) {
    state.rows = rows;
    state.mainGaps = calculateGaps(rows, 69, (row) => row.mainBalls);
    state.powerballGaps = calculateGaps(rows, 26, (row) => [row.powerball]);

    const frequencies = calculateFrequency(rows);
    state.mainFrequency = frequencies.mainFrequency;
    state.powerballFrequency = frequencies.powerballFrequency;
    state.categories.main = categorizeMainNumbers(state.mainGaps);
    state.categories.powerball = categorizePowerballs(state.powerballGaps);
  }

  window.PowerballCalculations = {
    calculateGaps,
    calculateFrequency,
    categorizeMainNumbers,
    categorizePowerballs,
    updateDerivedState
  };
})();
