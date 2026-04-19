(function () {
  function normalizeCsvText(rawText) {
    return rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  }

  function parseCsv(csvText) {
    const normalized = normalizeCsvText(csvText);
    if (!normalized) {
      throw new Error("No CSV content found.");
    }

    const lines = normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error("CSV must include a header and at least one data row.");
    }

    const rows = [];

    for (let index = 1; index < lines.length; index += 1) {
      const parts = lines[index].split(",").map((part) => part.trim().replace(/^"|"$/g, ""));

      if (parts.length < 7) {
        continue;
      }

      const mainBalls = parts.slice(1, 6).map(Number);
      const powerball = Number(parts[6]);

      if (mainBalls.some((value) => Number.isNaN(value)) || Number.isNaN(powerball)) {
        continue;
      }

      rows.push({
        date: parts[0],
        mainBalls,
        powerball
      });
    }

    if (!rows.length) {
      throw new Error("No valid draw rows were found after parsing.");
    }

    return rows;
  }

  function spreadsheetToCsvText(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const [firstSheetName] = workbook.SheetNames;

    if (!firstSheetName) {
      throw new Error("The spreadsheet does not contain any worksheets.");
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const csvText = XLSX.utils.sheet_to_csv(worksheet, { FS: ",", RS: "\n" });

    if (!csvText.trim()) {
      throw new Error("The first worksheet is empty.");
    }

    return csvText;
  }

  window.PowerballParser = {
    normalizeCsvText,
    parseCsv,
    spreadsheetToCsvText
  };
})();
