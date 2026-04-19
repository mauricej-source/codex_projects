(function () {
  let frequencyChart = null;

  function destroyFrequencyChart() {
    if (frequencyChart) {
      frequencyChart.destroy();
      frequencyChart = null;
    }
  }

  function renderFrequencyChart(canvas, mainFrequency) {
    const labels = mainFrequency.map((item) => item.number);
    const values = mainFrequency.map((item) => item.count);
    const topFive = new Set(
      [...mainFrequency]
        .sort((a, b) => b.count - a.count || a.number - b.number)
        .slice(0, 5)
        .map((item) => item.number)
    );

    const colors = labels.map((number) => (
      topFive.has(number) ? "rgba(250, 204, 21, 0.9)" : "rgba(59, 130, 246, 0.72)"
    ));

    destroyFrequencyChart();

    frequencyChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Appearances",
          data: values,
          backgroundColor: colors,
          borderRadius: 5,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "Number Frequency Analysis",
            color: "#a7f3d0",
            font: {
              size: 16,
              weight: "600"
            }
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.96)",
            titleColor: "#ecfeff",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(148, 163, 184, 0.2)",
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: {
              color: "#94a3b8",
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 18
            },
            grid: {
              color: "rgba(51, 65, 85, 0.35)"
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#94a3b8",
              precision: 0
            },
            grid: {
              color: "rgba(51, 65, 85, 0.35)"
            }
          }
        }
      }
    });
  }

  window.PowerballChart = {
    destroyFrequencyChart,
    renderFrequencyChart
  };
})();
