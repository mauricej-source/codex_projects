(function () {
  function createInitialState() {
    return {
      rows: [],
      mainGaps: [],
      powerballGaps: [],
      mainFrequency: [],
      powerballFrequency: [],
      categories: {
        main: { hot: [], warm: [], cold: [] },
        powerball: { hot: [], warm: [], cold: [] }
      }
    };
  }

  function resetState(state) {
    Object.assign(state, createInitialState());
  }

  window.PowerballState = {
    createInitialState,
    resetState
  };
})();
