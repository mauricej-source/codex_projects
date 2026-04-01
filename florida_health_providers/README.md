# Florida Health Plan Comparison

Single-page React application for comparing private individual health insurance providers in Florida using data derived from `C:\ws_codex_fproject\floridaProviders.xlsx`.

## Run locally

1. Install dependencies:
   `npm install`
2. Start the dev server:
   `npm run dev`
3. Open the local URL printed by Vite in your browser.

## Build for production

`npm run build`

## Notes

- The app uses local mock data in `src/data/providers.js`.
- Provider selections persist in `localStorage`.
- Premium values reflect the workbook's average silver premium field.
