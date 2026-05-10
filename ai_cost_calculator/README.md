# AI UNIT Calculator

## Project Title: AI UNIT Calculator

## Project Description

AI UNIT Calculator is a strategic cost-planning web application for comparing AI infrastructure paths: cloud GPU rental, hardware ownership, and public API consumption.

The application estimates total cost of ownership for AI workloads using configurable GPU, API model, pricing, utilization, token volume, project term, and report-tier assumptions. It is intended for scenario planning, executive review, and early-stage infrastructure strategy.

The calculator supports:

- GPU infrastructure breakeven analysis.
- Public API monthly burn estimation.
- Cloud rental versus hardware ownership comparisons.
- Public API versus self-hosted infrastructure roadmap reporting.
- Admin-managed market data with guarded live refreshes.
- Tiered paid PDF report export using PayPal.

Pricing outputs and generated reports are planning estimates, not binding quotes.

## Application Behavior

The public calculator runs as a single-page React application with three primary cost paths:

- Cloud GPU rental uses the selected GPU hourly rental rate, daily utilization, and project term.
- Hardware ownership uses `hardware_cost * tco_multiplier` to account for ownership overhead such as power, cooling, space, maintenance, and operational burden.
- Public API usage uses average input tokens, average output tokens, daily request volume, and per-model token pricing.

Important calculation rules:

- GPU breakeven day is calculated as `hardware_cost / (hourly rental rate * daily utilization hours)`.
- Rental defaults to on-demand pricing and can be toggled to spot pricing.
- API input token cost applies a 50% prompt-caching assumption.
- API models tagged as `Frontier Reasoning` add a 20% hidden output-token overhead.
- The crossover chart shows cumulative rental, ownership, and API cost over the project term.

The Admin console provides:

- Admin sign-on.
- Editable GPU and API model tables.
- PayPal configuration visibility.
- Guarded fresh-data refresh with source cards, review notes, and a diff table.
- Manual review before refreshed data is applied.

The report export workflow provides:

- Tier 1: GPU Executive PDF.
- Tier 2: Full Strategic Roadmap PDF.
- Tier 2 includes Tier 1-level infrastructure context plus API versus self-hosted comparison.
- PayPal-backed report unlocks through server-side order creation and capture verification.
- Local mock payments only when PayPal credentials are missing and development mock payments are enabled.

## Application Help - Describe what is provided

The Help page explains how users should estimate the values used by the calculator.

It includes:

- GPU Infrastructure Engine Help for selecting GPU model, daily utilization, on-demand versus spot pricing, and hardware cost.
- Public API Engine Help for estimating average input tokens, average output tokens, and daily request volume.
- Prompt-caching and reasoning-overhead explanations.
- A Quick Estimator that converts active users, requests per user, context size, user-message size, and response size into calculator-ready values.
- An `Apply to Calculator` action that copies estimated API usage values back to the main page.

Each page includes a footer footnote explaining that pricing data is approximate, retrieved from configured public/vendor sources, and should be confirmed directly with vendors when final or binding numbers are required.

## Project Stack of Technology

- React
- TypeScript
- Tailwind CSS
- Vite
- Express
- Chart.js
- jsPDF
- html2canvas
- PayPal Checkout REST APIs
- dotenv
- Node.js

Data is stored locally in `data/market-data.json` and served through the Express API.

## How to Build & Run the Project

Install dependencies:

```bash
npm install
```

Run the local development servers:

```bash
npm run dev
```

The public app runs at:

```text
http://127.0.0.1:5176/
```

The API server runs at:

```text
http://127.0.0.1:5177/
```

The Admin console is available at:

```text
http://127.0.0.1:5176/admin
```

The Help page is available at:

```text
http://127.0.0.1:5176/help
```

Build the production frontend:

```bash
npm run build
```

Run the production preview server:

```bash
npm run preview
```

Recommended local environment values:

```bash
ADMIN_PASSWORD=replace-with-a-long-admin-password
AUTH_SECRET=replace-with-a-long-random-secret
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your-paypal-rest-app-client-id
PAYPAL_CLIENT_SECRET=your-paypal-rest-app-client-secret
MARKET_REFRESH_URL=
LITELLM_PRICING_URL=https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
AZURE_RETAIL_PRICES_URL=https://prices.azure.com/api/retail/prices
AZURE_RETAIL_REGION=eastus
AWS_EC2_PRICING_URL=https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.json
AWS_REGION_LABEL=US East (N. Virginia)
GCP_BILLING_CATALOG_URL=https://cloudbilling.googleapis.com/v1/services/6F81-5844-456A/skus
GCP_REGION=us-central1
GCP_BILLING_API_KEY=
ENABLE_DEV_MOCK_PAYMENTS=true
API_PORT=5177
WEB_PORT=5176
```

For public deployment, use host-managed environment variables. Do not commit `.env` secrets to the repository.

Recommended Render settings:

```text
Build Command: npm install && npm run build
Start Command: npm run preview
```

Recommended Render production environment values:

```bash
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_CLIENT_SECRET=your_live_paypal_secret
ENABLE_DEV_MOCK_PAYMENTS=false
ADMIN_PASSWORD=your_admin_password
AUTH_SECRET=a_long_random_secret_value
API_PORT=10000
WEB_PORT=10000
```

## Reference Materials Required to Understand the Project

These references are useful for understanding the external pricing, payment, charting, and PDF integrations:

- LiteLLM model pricing JSON: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
- Azure Retail Prices API: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices
- AWS Price List Bulk API: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-the-aws-price-list-bulk-api-fetching-price-list-files-manually.html
- Google Cloud Billing Catalog API: https://docs.cloud.google.com/billing/v1/how-tos/catalog-api
- PayPal Orders API: https://developer.paypal.com/docs/api/orders/v2/
- Render Web Services: https://render.com/docs/web-services
- Chart.js documentation: https://www.chartjs.org/docs/latest/
- jsPDF documentation: https://github.com/parallax/jsPDF
- html2canvas documentation: https://html2canvas.hertzen.com/

## Lets Not Forget

Market data is stored in `data/market-data.json` and can be edited from `/admin`. The public calculator loads it from `/api/market-data`.

The calculator is data-driven:

- API model options are grouped by each model's `tier`.
- GPU options are grouped by `category` and display `vram_gb`.
- PDF reports include `version` and `last_updated` from the JSON footer.

Fresh data behavior:

- `Fetch Fresh Data` pulls API model prices from LiteLLM and mapped GPU rental prices from Azure Retail Prices, AWS EC2 Price List, and GCP Cloud Billing Catalog.
- Nothing is saved until `Apply Reviewed Data` is clicked.
- GPU cloud prices require explicit SKU mapping because cloud vendors report VM or accelerator SKUs rather than generic GPU model prices.
- Azure and AWS are available without local credentials.
- GCP requires `GCP_BILLING_API_KEY`; without it, GCP appears in the Admin refresh sources with `updated: 0`.
- Hardware purchase prices remain admin-reviewed.
- When multiple cloud providers return prices for the same GPU, the guarded refresh chooses the lowest available on-demand benchmark and the lowest available spot benchmark, then lists the provider choice in the review notes.

To bypass the built-in live sources and use a fully normalized custom JSON feed, set:

```bash
MARKET_REFRESH_URL=https://example.com/ai-unit-calculator-market-data.json
```

PayPal behavior:

- Use `PAYPAL_MODE=sandbox` for testing.
- Use `PAYPAL_MODE=live` only when ready to receive real payments.
- The PayPal client ID can be public.
- The PayPal client secret must stay server-side.
- Report unlocks go through `POST /api/paypal/create-order` and `POST /api/paypal/capture-order`.
- If PayPal credentials are missing, local development uses mock orders so the tier unlock flow can be tested.
- Set `ENABLE_DEV_MOCK_PAYMENTS=false` to disable local mock payment unlocks.
- Keep mock payments disabled in public deployments unless the route is otherwise protected.

SEO behavior:

- `index.html` includes title, description, keyword, canonical, Open Graph, Twitter, robots, and SoftwareApplication structured-data metadata.
- `public/robots.txt` and `public/sitemap.xml` are included for crawler discovery.
- The current canonical production URL is `https://aiunitcalculator.ai`.
- Update `index.html`, `public/robots.txt`, and `public/sitemap.xml` if the final public URL changes.
- Technical SEO improves discoverability, but top Google placement also depends on content quality, search demand, backlinks, page speed, domain authority, and ongoing publishing.

Hostname follow-up:

- Register or acquire `aiunitcalculator.ai`.
- Configure DNS for the selected hosting provider.
- Enable HTTPS for `https://aiunitcalculator.ai`.
- Verify the domain in Google Search Console after deployment.
- Submit `https://aiunitcalculator.ai/sitemap.xml` in Google Search Console.
