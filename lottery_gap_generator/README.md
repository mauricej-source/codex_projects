# Project Title

Lottery Gap Strategy Dashboard

# Project Description

Lottery Gap Strategy Dashboard is a single-page web application for analyzing historical Powerball draw data in the browser. It accepts CSV, XLS, and XLSX inputs, calculates live gap values for main balls and Powerballs, generates strategy-based tickets, surfaces overdue numbers, and visualizes number frequency with a bar chart.

# Project Application Page Behavior

- The top `Strategy Center` panel summarizes the application and current dashboard status.
- The `Data Input / File Upload` panel accepts `.csv`, `.xls`, and `.xlsx` files and also supports pasted CSV text.
- The `Data Input / File Upload` panel includes `Number of Tickets` with a default value of `20`.
- The `Data Input / File Upload` panel includes a `Strategy Mode` selector with `Balanced`, `Hot-Heavy`, `All Hot`, and `Strategy Mix`.
- Selecting a file processes the data automatically.
- Clicking `Process Data` manually processes the current textarea contents.
- `Feature 1 / Strategic Tickets` generates tickets using the selected strategy mode and current gap-derived hot, warm, and cold groupings.
- `Feature 2 / Overdue Deep Dive` shows the most overdue main balls and Powerballs side by side inside a single horizontal panel.
- `Feature 3 / Number Frequency Analysis` renders a Chart.js bar chart for main-ball frequency and lists the current Hot, Warm, and Cold main-ball groups above the chart.
- The `How Lottery Gap Analysis Works` reference panel documents the gap logic, grouping rules, strategy modes, and Powerball selection rules.
- All major content panels support collapse and expand behavior.
- The `How Lottery Gap Analysis Works` panel starts collapsed by default.
- All calculations run locally in the browser; there is no backend service.

# Technology Stack Built Upon

- HTML5
- Tailwind CSS via CDN
- JavaScript
- Chart.js via CDN
- SheetJS (`xlsx`) via CDN for Excel parsing
- Browser FileReader API

# How to Build and Run the Project

This project currently does not require a build step.

## Local Run

1. Open [index.html](C:/ws_openai_ws/lottery_gap_generator/index.html) in a browser.
2. Upload a supported input file from [input/PowerBall_WinningNumbers.xlsx](C:/ws_openai_ws/lottery_gap_generator/input/PowerBall_WinningNumbers.xlsx) or paste CSV data into the textarea.
3. Set the ticket count and choose a strategy mode.
4. Review the generated tickets, overdue tables, chart, and reference guidance panel.

## Project Structure

- [index.html](C:/ws_openai_ws/lottery_gap_generator/index.html): page structure and Tailwind-based layout
- [js/app.js](C:/ws_openai_ws/lottery_gap_generator/js/app.js): event wiring and application controller
- [js/parser.js](C:/ws_openai_ws/lottery_gap_generator/js/parser.js): CSV and spreadsheet parsing
- [js/calculations.js](C:/ws_openai_ws/lottery_gap_generator/js/calculations.js): gap, frequency, and category calculations
- [js/tickets.js](C:/ws_openai_ws/lottery_gap_generator/js/tickets.js): strategic ticket generation
- [js/ui.js](C:/ws_openai_ws/lottery_gap_generator/js/ui.js): DOM rendering helpers
- [js/chart.js](C:/ws_openai_ws/lottery_gap_generator/js/chart.js): Chart.js rendering lifecycle
- [js/state.js](C:/ws_openai_ws/lottery_gap_generator/js/state.js): shared application state helpers

# References or Materials That Will Help the Engineer

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [SheetJS Documentation](https://docs.sheetjs.com/)
- [MDN FileReader API](https://developer.mozilla.org/en-US/docs/Web/API/FileReader)
- [MDN HTML Drag and File Inputs](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file)

## Domain Notes

- Main ball gap logic is based on numbers `1-69`.
- Powerball gap logic is based on numbers `1-26`.
- Main-ball categories are based entirely on calculated gap values.
- `Hot` main balls are the `20` numbers with the smallest gaps.
- `Cold` main balls are the `20` numbers with the largest gaps.
- `Warm` main balls are the `29` numbers between those two groups.
- Powerball categories use an `8 Hot / 10 Warm / 8 Cold` split.
- `Balanced` mode uses `2 Hot + 2 Warm + 1 Cold`.
- `Hot-Heavy` mode uses `4 Hot + 1 Warm`.
- `All Hot` mode uses `5 Hot`.
- `Strategy Mix` rotates ticket generation across `Balanced`, `Hot-Heavy`, and `All Hot`.
- Powerball selection uses the warm Powerball group.
- Ticket filtering currently requires an odd/even ratio of `3:2` or `2:3`.
- Ticket filtering currently requires the main-ball sum to be between `130` and `200`.
