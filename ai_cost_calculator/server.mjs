import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const apiPort = Number(process.env.API_PORT ?? 5177);
const webPort = Number(process.env.WEB_PORT ?? 5176);
const authSecret = process.env.AUTH_SECRET ?? "local-dev-auth-secret-change-before-production";
const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-admin";
const paypalMode = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
const paypalBaseUrl = paypalMode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const dataFile = path.join(__dirname, "data", "market-data.json");
const distDir = path.join(__dirname, "dist");
const pendingRefreshes = new Map();
let awsPricingCache = null;
const liteLlmPricingUrl =
  process.env.LITELLM_PRICING_URL ?? "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const azureRetailPricesUrl = process.env.AZURE_RETAIL_PRICES_URL ?? "https://prices.azure.com/api/retail/prices";
const azureRetailRegion = process.env.AZURE_RETAIL_REGION ?? "eastus";
const awsEc2PricingUrl =
  process.env.AWS_EC2_PRICING_URL ?? "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.json";
const awsRegionLabel = process.env.AWS_REGION_LABEL ?? "US East (N. Virginia)";
const gcpBillingCatalogUrl = process.env.GCP_BILLING_CATALOG_URL ?? "https://cloudbilling.googleapis.com/v1/services/6F81-5844-456A/skus";
const gcpRegion = process.env.GCP_REGION ?? "us-central1";
const baseTierAmounts = {
  1: "5.00",
  2: "10.00",
};

const litellmModelAliases = {
  "gpt-5": ["gpt-5"],
  "gpt-5-mini": ["gpt-5-mini"],
  "gpt-5-nano": ["gpt-5-nano"],
  "gpt-4.1": ["gpt-4.1"],
  "gpt-4.1-mini": ["gpt-4.1-mini"],
  "gpt-4.1-nano": ["gpt-4.1-nano"],
  o3: ["o3"],
  "o4-mini": ["o4-mini"],
  "claude-4-opus": ["claude-opus-4-20250514", "anthropic/claude-opus-4-20250514"],
  "claude-4-sonnet": ["claude-sonnet-4-20250514", "anthropic/claude-sonnet-4-20250514"],
  "claude-3.7-sonnet": ["claude-3-7-sonnet-20250219", "anthropic/claude-3-7-sonnet-20250219"],
  "claude-3.5-haiku": ["claude-3-5-haiku-20241022", "anthropic/claude-3-5-haiku-20241022"],
  "gemini-2.5-pro": ["gemini/gemini-2.5-pro", "vertex_ai/gemini-2.5-pro"],
  "gemini-2.5-flash": ["gemini/gemini-2.5-flash", "vertex_ai/gemini-2.5-flash"],
  "gemini-2.0-flash": ["gemini/gemini-2.0-flash", "vertex_ai/gemini-2.0-flash"],
  "deepseek-v3": ["deepseek/deepseek-chat", "deepseek/deepseek-v3"],
  "deepseek-r1": ["deepseek/deepseek-reasoner", "deepseek/deepseek-r1"],
  "llama-4-maverick": [
    "meta_llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    "together_ai/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    "deepinfra/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
  ],
  "llama-4-scout": [
    "meta_llama/Llama-4-Scout-17B-16E-Instruct-FP8",
    "together_ai/meta-llama/Llama-4-Scout-17B-16E-Instruct",
    "deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct",
  ],
  "llama-3.3-70b": ["groq/llama-3.3-70b-versatile", "together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  "mistral-large-2": ["mistral/mistral-large-latest", "mistral/mistral-large-2411"],
  "mistral-small-3": ["mistral/mistral-small-latest"],
  codestral: ["mistral/codestral-latest", "codestral/codestral-latest"],
  "grok-3": ["xai/grok-3", "xai/grok-3-latest"],
  "grok-3-mini": ["xai/grok-3-mini", "xai/grok-3-mini-latest"],
  "command-a": ["command-a-03-2025", "vercel_ai_gateway/cohere/command-a"],
  "command-r-plus": ["command-r-plus", "cohere/command-r-plus"],
  "command-r": ["command-r", "cohere/command-r"],
  "jamba-1.5-large": ["jamba-1.5-large", "ai21.jamba-1-5-large-v1:0"],
  "jamba-1.5-mini": ["jamba-1.5-mini", "ai21.jamba-1-5-mini-v1:0"],
  "qwen3-235b": ["dashscope/qwen3-max", "openrouter/qwen/qwen3-235b-a22b"],
  "qwen3-32b": ["dashscope/qwen3-32b", "openrouter/qwen/qwen3-32b"],
};

const azureGpuMappings = {
  "h100-80gb": { armSkuName: "Standard_NC40ads_H100_v5", gpuCount: 1, note: "Azure East US NC40ads H100 v5 Linux VM" },
  "a100-80gb": { armSkuName: "Standard_NC24ads_A100_v4", gpuCount: 1, note: "Azure East US NC24ads A100 v4 Linux VM" },
};

const awsGpuMappings = {
  "h100-80gb": { instanceType: "p5.48xlarge", gpuCount: 8, note: "AWS us-east-1 p5.48xlarge Linux on-demand VM" },
  "h200-141gb": { instanceType: "p5en.48xlarge", gpuCount: 8, note: "AWS us-east-1 p5en.48xlarge Linux on-demand VM" },
  "b200-192gb": { instanceType: "p6-b200.48xlarge", gpuCount: 8, note: "AWS us-east-1 p6-b200.48xlarge Linux on-demand VM" },
  "a100-80gb": { instanceType: "p4de.24xlarge", gpuCount: 8, note: "AWS us-east-1 p4de.24xlarge Linux on-demand VM" },
  "l40s-48gb": { instanceType: "g6e.xlarge", gpuCount: 1, note: "AWS us-east-1 g6e.xlarge Linux on-demand VM" },
  "a10g-24gb": { instanceType: "g5.xlarge", gpuCount: 1, note: "AWS us-east-1 g5.xlarge Linux on-demand VM" },
};

const gcpGpuMappings = {
  "h100-80gb": { pattern: /\bh100\b/i, note: `GCP ${gcpRegion} H100 accelerator SKU` },
  "h200-141gb": { pattern: /\bh200\b/i, note: `GCP ${gcpRegion} H200 accelerator SKU` },
  "a100-80gb": { pattern: /\ba100\b/i, note: `GCP ${gcpRegion} A100 accelerator SKU` },
  "l4-24gb": { pattern: /\bl4\b/i, note: `GCP ${gcpRegion} L4 accelerator SKU` },
};

function resolveTierPayment(tier, currentTier = 0) {
  if (!baseTierAmounts[tier]) return null;
  if (currentTier >= tier) return { amount: "0.00", alreadyUnlocked: true };
  if (tier === 2 && currentTier === 1) return { amount: "5.00", alreadyUnlocked: false, upgrade: true };
  return { amount: baseTierAmounts[tier], alreadyUnlocked: false, upgrade: false };
}

app.use(express.json({ limit: "128kb" }));

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie ?? "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
  return cookies[name];
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", authSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verify(token) {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", authSecret).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

function requireAdmin(request, response, next) {
  const payload = verify(readCookie(request, "admin_session"));
  if (!payload?.admin) {
    response.status(401).json({ error: "Admin sign-on required." });
    return;
  }
  next();
}

async function loadMarketData() {
  const raw = await fs.readFile(dataFile, "utf8");
  return JSON.parse(raw);
}

function validateMarketData(candidate) {
  if (!candidate || !Array.isArray(candidate.gpus) || !Array.isArray(candidate.apis)) {
    throw new Error("Market data must include gpus and apis arrays.");
  }
  return {
    version: String(candidate.version ?? "local"),
    last_updated: String(candidate.last_updated ?? new Date().toISOString().slice(0, 10)),
    tco_multiplier: Number(candidate.tco_multiplier ?? 1.15),
    gpus: candidate.gpus.map((gpu, index) => {
      const hardwareCost = Number(gpu.hardware_cost ?? gpu.buy ?? 0);
      const rentOnDemand = Number(gpu.rent_on_demand ?? gpu.rent ?? 0);
      const rentSpot = Number(gpu.rent_spot ?? rentOnDemand);
      if (!gpu.model || hardwareCost < 0 || rentOnDemand < 0 || rentSpot < 0) {
        throw new Error("Each GPU needs a model, hardware cost, on-demand rent, and spot rent.");
      }
      return {
        id: String(gpu.id ?? `gpu-${index}`),
        model: String(gpu.model),
        category: String(gpu.category ?? "Uncategorized"),
        vram_gb: Number(gpu.vram_gb ?? 0),
        hardware_cost: hardwareCost,
        rent_on_demand: rentOnDemand,
        rent_spot: rentSpot,
      };
    }),
    apis: candidate.apis.map((api, index) => {
      if (!api.model || !api.tier || Number(api.input) < 0 || Number(api.output) < 0) {
        throw new Error("Each API needs a model, tier, input price, and output price.");
      }
      return {
        id: String(api.id ?? `api-${index}`),
        provider: String(api.provider ?? "Unknown"),
        model: String(api.model),
        tier: String(api.tier),
        input: Number(api.input),
        output: Number(api.output),
      };
    }),
  };
}

function keyedById(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function priceChange(label, before, after, changes) {
  if (Number(before) !== Number(after)) {
    changes.push({ field: label, before, after });
  }
}

function diffMarketData(current, next) {
  const gpuCurrent = keyedById(current.gpus);
  const gpuNext = keyedById(next.gpus);
  const apiCurrent = keyedById(current.apis);
  const apiNext = keyedById(next.apis);
  const changes = [];

  for (const [id, nextGpu] of gpuNext) {
    const currentGpu = gpuCurrent.get(id);
    if (!currentGpu) {
      changes.push({ type: "added", group: "GPU", id, model: nextGpu.model, changes: [] });
      continue;
    }
    const rowChanges = [];
    priceChange("hardware_cost", currentGpu.hardware_cost, nextGpu.hardware_cost, rowChanges);
    priceChange("rent_on_demand", currentGpu.rent_on_demand, nextGpu.rent_on_demand, rowChanges);
    priceChange("rent_spot", currentGpu.rent_spot, nextGpu.rent_spot, rowChanges);
    priceChange("vram_gb", currentGpu.vram_gb, nextGpu.vram_gb, rowChanges);
    if (currentGpu.category !== nextGpu.category) {
      rowChanges.push({ field: "category", before: currentGpu.category, after: nextGpu.category });
    }
    if (rowChanges.length) {
      changes.push({ type: "changed", group: "GPU", id, model: nextGpu.model, changes: rowChanges });
    }
  }

  for (const [id, currentGpu] of gpuCurrent) {
    if (!gpuNext.has(id)) {
      changes.push({ type: "removed", group: "GPU", id, model: currentGpu.model, changes: [] });
    }
  }

  for (const [id, nextApi] of apiNext) {
    const currentApi = apiCurrent.get(id);
    if (!currentApi) {
      changes.push({ type: "added", group: "API", id, model: nextApi.model, changes: [] });
      continue;
    }
    const rowChanges = [];
    priceChange("input", currentApi.input, nextApi.input, rowChanges);
    priceChange("output", currentApi.output, nextApi.output, rowChanges);
    if (currentApi.tier !== nextApi.tier) {
      rowChanges.push({ field: "tier", before: currentApi.tier, after: nextApi.tier });
    }
    if (currentApi.provider !== nextApi.provider) {
      rowChanges.push({ field: "provider", before: currentApi.provider, after: nextApi.provider });
    }
    if (rowChanges.length) {
      changes.push({ type: "changed", group: "API", id, model: nextApi.model, changes: rowChanges });
    }
  }

  for (const [id, currentApi] of apiCurrent) {
    if (!apiNext.has(id)) {
      changes.push({ type: "removed", group: "API", id, model: currentApi.model, changes: [] });
    }
  }

  if (current.tco_multiplier !== next.tco_multiplier) {
    changes.push({
      type: "changed",
      group: "Config",
      id: "tco_multiplier",
      model: "Ownership multiplier",
      changes: [{ field: "tco_multiplier", before: current.tco_multiplier, after: next.tco_multiplier }],
    });
  }

  return changes;
}

function roundPrice(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function toPerMillionTokenPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? roundPrice(numeric * 1_000_000) : null;
}

function simpleModelKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function findLiteLlmModel(api, pricing) {
  const aliases = [
    ...(litellmModelAliases[api.id] ?? []),
    api.id,
    simpleModelKey(api.model),
    simpleModelKey(`${api.provider}-${api.model}`),
  ];
  for (const alias of aliases) {
    if (pricing[alias]) return { key: alias, row: pricing[alias] };
  }
  return { key: "", row: null };
}

async function fetchLiteLlmApiPricing(currentApis) {
  const sourceResponse = await fetch(liteLlmPricingUrl, { headers: { Accept: "application/json" } });
  if (!sourceResponse.ok) {
    throw new Error(`LiteLLM pricing source returned ${sourceResponse.status}.`);
  }

  const pricing = await sourceResponse.json();
  const notes = [];
  let updated = 0;
  const apis = currentApis.map((api) => {
    const match = findLiteLlmModel(api, pricing);
    const input = toPerMillionTokenPrice(match.row?.input_cost_per_token);
    const output = toPerMillionTokenPrice(match.row?.output_cost_per_token);
    if (input === null || output === null) {
      notes.push(`API unchanged: ${api.model} was not mapped in LiteLLM.`);
      return api;
    }
    updated += 1;
    return { ...api, input, output };
  });

  return {
    apis,
    notes,
    source: {
      label: "LiteLLM model pricing",
      url: liteLlmPricingUrl,
      updated,
      total: currentApis.length,
    },
  };
}

function offerRecord({ provider, gpuId, rentOnDemand = null, rentSpot = null, note }) {
  return {
    provider,
    gpuId,
    rent_on_demand: rentOnDemand === null ? null : roundPrice(rentOnDemand),
    rent_spot: rentSpot === null ? null : roundPrice(rentSpot),
    note,
  };
}

function mergeGpuOffers(currentGpus, offerGroups) {
  const offersByGpu = new Map();
  for (const group of offerGroups) {
    for (const offer of group.offers) {
      offersByGpu.set(offer.gpuId, [...(offersByGpu.get(offer.gpuId) ?? []), offer]);
    }
  }

  const notes = [];
  const gpus = currentGpus.map((gpu) => {
    const offers = offersByGpu.get(gpu.id) ?? [];
    const onDemandOffers = offers.filter((offer) => Number.isFinite(offer.rent_on_demand));
    const spotOffers = offers.filter((offer) => Number.isFinite(offer.rent_spot));
    if (!onDemandOffers.length && !spotOffers.length) return gpu;

    const bestOnDemand = onDemandOffers.sort((a, b) => a.rent_on_demand - b.rent_on_demand)[0];
    const bestSpot = spotOffers.sort((a, b) => a.rent_spot - b.rent_spot)[0];
    if (bestOnDemand) notes.push(`GPU benchmark: ${gpu.model} on-demand uses ${bestOnDemand.provider} at $${bestOnDemand.rent_on_demand}/hr.`);
    if (bestSpot) notes.push(`GPU benchmark: ${gpu.model} spot uses ${bestSpot.provider} at $${bestSpot.rent_spot}/hr.`);

    return {
      ...gpu,
      rent_on_demand: bestOnDemand?.rent_on_demand ?? gpu.rent_on_demand,
      rent_spot: bestSpot?.rent_spot ?? gpu.rent_spot,
    };
  });

  return { gpus, notes };
}

function buildAzureRetailUrl(armSkuName) {
  const filter = [
    "serviceName eq 'Virtual Machines'",
    "priceType eq 'Consumption'",
    `armSkuName eq '${armSkuName}'`,
    `armRegionName eq '${azureRetailRegion}'`,
  ].join(" and ");
  const url = new URL(azureRetailPricesUrl);
  url.searchParams.set("$filter", filter);
  return url.toString();
}

function pickAzureHourlyPrices(items, gpuCount) {
  const linuxHourlyItems = items.filter((item) => {
    const productName = String(item.productName ?? "").toLowerCase();
    const unitOfMeasure = String(item.unitOfMeasure ?? "").toLowerCase();
    const price = Number(item.retailPrice);
    return unitOfMeasure === "1 hour" && Number.isFinite(price) && price > 0 && !productName.includes("windows");
  });
  const onDemand = linuxHourlyItems
    .filter((item) => !String(item.skuName ?? "").toLowerCase().includes("spot") && !String(item.skuName ?? "").toLowerCase().includes("low priority"))
    .map((item) => Number(item.retailPrice) / gpuCount)
    .sort((a, b) => a - b)[0];
  const spot = linuxHourlyItems
    .filter((item) => String(item.skuName ?? "").toLowerCase().includes("spot"))
    .map((item) => Number(item.retailPrice) / gpuCount)
    .sort((a, b) => a - b)[0];

  return {
    rent_on_demand: Number.isFinite(onDemand) ? roundPrice(onDemand) : null,
    rent_spot: Number.isFinite(spot) ? roundPrice(spot) : null,
  };
}

async function fetchAzureGpuOffers(currentGpus) {
  const notes = [];
  let updated = 0;
  const offers = [];

  for (const gpu of currentGpus) {
    const mapping = azureGpuMappings[gpu.id];
    if (!mapping) {
      notes.push(`GPU unchanged: ${gpu.model} has no Azure SKU mapping yet.`);
      continue;
    }

    const sourceUrl = buildAzureRetailUrl(mapping.armSkuName);
    const sourceResponse = await fetch(sourceUrl, { headers: { Accept: "application/json" } });
    if (!sourceResponse.ok) {
      notes.push(`GPU unchanged: ${gpu.model} Azure lookup returned ${sourceResponse.status}.`);
      continue;
    }

    const body = await sourceResponse.json();
    const prices = pickAzureHourlyPrices(body.Items ?? [], mapping.gpuCount);
    if (prices.rent_on_demand === null && prices.rent_spot === null) {
      notes.push(`GPU unchanged: ${gpu.model} Azure lookup had no Linux hourly prices.`);
      continue;
    }

    updated += 1;
    notes.push(`GPU mapped: ${gpu.model} uses ${mapping.note}.`);
    offers.push(offerRecord({ provider: "Azure", gpuId: gpu.id, rentOnDemand: prices.rent_on_demand, rentSpot: prices.rent_spot, note: mapping.note }));
  }

  return {
    offers,
    notes,
    source: {
      label: `Azure Retail Prices (${azureRetailRegion})`,
      url: azureRetailPricesUrl,
      updated,
      total: currentGpus.length,
    },
  };
}

function pickAwsProducts(products, instanceType) {
  return Object.values(products).filter((product) => {
    const attributes = product.attributes ?? {};
    return (
      attributes.instanceType === instanceType &&
      attributes.operatingSystem === "Linux" &&
      attributes.tenancy === "Shared" &&
      attributes.preInstalledSw === "NA" &&
      attributes.capacitystatus === "Used" &&
      String(attributes.operation ?? "").startsWith("RunInstances")
    );
  });
}

function pickAwsHourlyPrice(terms, sku) {
  const skuTerms = terms?.OnDemand?.[sku] ?? {};
  for (const term of Object.values(skuTerms)) {
    for (const dimension of Object.values(term.priceDimensions ?? {})) {
      const price = Number(dimension.pricePerUnit?.USD);
      if (dimension.unit === "Hrs" && Number.isFinite(price) && price > 0) return price;
    }
  }
  return null;
}

async function fetchAwsGpuOffers(currentGpus) {
  const notes = [];
  const offers = [];
  const mappedGpus = currentGpus.filter((gpu) => awsGpuMappings[gpu.id]);
  if (!mappedGpus.length) {
    return {
      offers,
      notes: ["AWS unchanged: no GPU SKU mappings are configured."],
      source: { label: `AWS EC2 Price List (${awsRegionLabel})`, url: awsEc2PricingUrl, updated: 0, total: currentGpus.length },
    };
  }

  try {
    if (!awsPricingCache || awsPricingCache.url !== awsEc2PricingUrl || awsPricingCache.expires < Date.now()) {
      const sourceResponse = await fetch(awsEc2PricingUrl, { headers: { Accept: "application/json" } });
      if (!sourceResponse.ok) {
        throw new Error(`AWS EC2 pricing source returned ${sourceResponse.status}.`);
      }
      awsPricingCache = { url: awsEc2PricingUrl, body: await sourceResponse.json(), expires: Date.now() + 1000 * 60 * 60 };
    }
    const body = awsPricingCache.body;
    let updated = 0;

    for (const gpu of currentGpus) {
      const mapping = awsGpuMappings[gpu.id];
      if (!mapping) {
        notes.push(`GPU unchanged: ${gpu.model} has no AWS instance mapping yet.`);
        continue;
      }
      const products = pickAwsProducts(body.products ?? {}, mapping.instanceType);
      const hourlyPrice = products.map((product) => pickAwsHourlyPrice(body.terms, product.sku)).find((price) => Number.isFinite(price) && price > 0) ?? null;
      if (!hourlyPrice) {
        notes.push(`GPU unchanged: ${gpu.model} AWS lookup found no Linux on-demand price for ${mapping.instanceType}.`);
        continue;
      }
      updated += 1;
      notes.push(`GPU mapped: ${gpu.model} uses ${mapping.note}. AWS Spot is not included in the public bulk price file.`);
      offers.push(offerRecord({ provider: "AWS", gpuId: gpu.id, rentOnDemand: hourlyPrice / mapping.gpuCount, note: mapping.note }));
    }

    return {
      offers,
      notes,
      source: { label: `AWS EC2 Price List (${awsRegionLabel})`, url: awsEc2PricingUrl, updated, total: currentGpus.length },
    };
  } catch (error) {
    return {
      offers,
      notes: [`AWS unchanged: ${error instanceof Error ? error.message : "Could not load EC2 pricing."}`],
      source: { label: `AWS EC2 Price List (${awsRegionLabel})`, url: awsEc2PricingUrl, updated: 0, total: currentGpus.length },
    };
  }
}

function gcpHourlyPrice(sku) {
  const rate = sku.pricingInfo?.[0]?.pricingExpression?.tieredRates?.[0]?.unitPrice;
  if (!rate) return null;
  const units = Number(rate.units ?? 0);
  const nanos = Number(rate.nanos ?? 0);
  const price = units + nanos / 1_000_000_000;
  return Number.isFinite(price) && price > 0 ? price : null;
}

function pickGcpSku(skus, mapping) {
  return skus
    .filter((sku) => {
      const description = String(sku.description ?? "");
      const resourceGroup = String(sku.category?.resourceGroup ?? "").toLowerCase();
      const usageType = String(sku.category?.usageType ?? "").toLowerCase();
      const regions = sku.serviceRegions ?? [];
      return (
        mapping.pattern.test(description) &&
        resourceGroup.includes("gpu") &&
        usageType === "on-demand" &&
        regions.includes(gcpRegion) &&
        gcpHourlyPrice(sku) !== null
      );
    })
    .sort((a, b) => gcpHourlyPrice(a) - gcpHourlyPrice(b))[0];
}

async function fetchGcpGpuOffers(currentGpus) {
  const apiKey = process.env.GCP_BILLING_API_KEY;
  const notes = [];
  const offers = [];
  if (!apiKey) {
    return {
      offers,
      notes: ["GCP unchanged: set GCP_BILLING_API_KEY to enable Cloud Billing Catalog pricing."],
      source: { label: `GCP Cloud Billing Catalog (${gcpRegion})`, url: gcpBillingCatalogUrl, updated: 0, total: currentGpus.length },
    };
  }

  try {
    const skus = [];
    let pageToken = "";
    do {
      const url = new URL(gcpBillingCatalogUrl);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("currencyCode", "USD");
      url.searchParams.set("pageSize", "5000");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const sourceResponse = await fetch(url, { headers: { Accept: "application/json" } });
      if (!sourceResponse.ok) {
        throw new Error(`GCP catalog source returned ${sourceResponse.status}.`);
      }
      const body = await sourceResponse.json();
      skus.push(...(body.skus ?? []));
      pageToken = body.nextPageToken ?? "";
    } while (pageToken);

    let updated = 0;
    for (const gpu of currentGpus) {
      const mapping = gcpGpuMappings[gpu.id];
      if (!mapping) {
        notes.push(`GPU unchanged: ${gpu.model} has no GCP accelerator mapping yet.`);
        continue;
      }
      const sku = pickGcpSku(skus, mapping);
      const hourlyPrice = sku ? gcpHourlyPrice(sku) : null;
      if (!hourlyPrice) {
        notes.push(`GPU unchanged: ${gpu.model} GCP lookup found no ${gcpRegion} on-demand accelerator price.`);
        continue;
      }
      updated += 1;
      notes.push(`GPU mapped: ${gpu.model} uses ${mapping.note}. GCP Spot is not included in this first pass.`);
      offers.push(offerRecord({ provider: "GCP", gpuId: gpu.id, rentOnDemand: hourlyPrice, note: mapping.note }));
    }

    return {
      offers,
      notes,
      source: { label: `GCP Cloud Billing Catalog (${gcpRegion})`, url: gcpBillingCatalogUrl, updated, total: currentGpus.length },
    };
  } catch (error) {
    return {
      offers,
      notes: [`GCP unchanged: ${error instanceof Error ? error.message : "Could not load Cloud Billing Catalog pricing."}`],
      source: { label: `GCP Cloud Billing Catalog (${gcpRegion})`, url: gcpBillingCatalogUrl, updated: 0, total: currentGpus.length },
    };
  }
}

async function buildLiveMarketData(current) {
  const [apiRefresh, azureRefresh, awsRefresh, gcpRefresh] = await Promise.all([
    fetchLiteLlmApiPricing(current.apis),
    fetchAzureGpuOffers(current.gpus),
    fetchAwsGpuOffers(current.gpus),
    fetchGcpGpuOffers(current.gpus),
  ]);
  const gpuRefresh = mergeGpuOffers(current.gpus, [azureRefresh, awsRefresh, gcpRefresh]);
  const today = new Date().toISOString().slice(0, 10);
  return {
    candidate: validateMarketData({
      ...current,
      version: `live-${today}`,
      last_updated: today,
      gpus: gpuRefresh.gpus,
      apis: apiRefresh.apis,
    }),
    sources: [apiRefresh.source, azureRefresh.source, awsRefresh.source, gcpRefresh.source],
    notes: [...apiRefresh.notes, ...azureRefresh.notes, ...awsRefresh.notes, ...gcpRefresh.notes, ...gpuRefresh.notes],
  };
}

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error("PayPal authentication failed.");
  }
  const body = await response.json();
  return body.access_token;
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/market-data", async (_request, response) => {
  response.json(await loadMarketData());
});

app.get("/api/paypal/config", (_request, response) => {
  response.json({
    clientId: process.env.PAYPAL_CLIENT_ID ?? null,
    mode: paypalMode,
    serverVerified: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    devMockPayments: process.env.ENABLE_DEV_MOCK_PAYMENTS !== "false",
  });
});

app.post("/api/admin/login", (request, response) => {
  const password = String(request.body?.password ?? "");
  if (password !== adminPassword) {
    response.status(401).json({ error: "Invalid admin password." });
    return;
  }
  const token = sign({ admin: true, exp: Date.now() + 1000 * 60 * 60 * 8 });
  response.setHeader("Set-Cookie", `admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
  response.json({ ok: true });
});

app.post("/api/admin/logout", (_request, response) => {
  response.setHeader("Set-Cookie", "admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  response.json({ ok: true });
});

app.get("/api/admin/session", (request, response) => {
  response.json({ authenticated: Boolean(verify(readCookie(request, "admin_session"))?.admin) });
});

app.get("/api/admin/market-data", requireAdmin, async (_request, response) => {
  response.json(await loadMarketData());
});

app.put("/api/admin/market-data", requireAdmin, async (request, response) => {
  try {
    const nextData = validateMarketData(request.body);
    await fs.writeFile(dataFile, `${JSON.stringify(nextData, null, 2)}\n`, "utf8");
    response.json(nextData);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Invalid market data." });
  }
});

app.post("/api/admin/market-data/refresh", requireAdmin, async (_request, response) => {
  try {
    const current = await loadMarketData();
    let candidate;
    let sourceUrl = process.env.MARKET_REFRESH_URL || "Built-in live sources";
    let sources = [];
    let notes = [];

    if (process.env.MARKET_REFRESH_URL) {
      const sourceResponse = await fetch(process.env.MARKET_REFRESH_URL, { headers: { Accept: "application/json" } });
      if (!sourceResponse.ok) {
        response.status(502).json({ error: `Refresh source returned ${sourceResponse.status}.` });
        return;
      }
      candidate = validateMarketData(await sourceResponse.json());
      sources = [{ label: "Custom market data JSON", url: process.env.MARKET_REFRESH_URL, updated: candidate.gpus.length + candidate.apis.length, total: candidate.gpus.length + candidate.apis.length }];
    } else {
      const liveRefresh = await buildLiveMarketData(current);
      candidate = liveRefresh.candidate;
      sources = liveRefresh.sources;
      notes = liveRefresh.notes;
    }

    const diff = diffMarketData(current, candidate);
    const refreshId = crypto.randomUUID();
    pendingRefreshes.set(refreshId, { candidate, expires: Date.now() + 1000 * 60 * 20 });
    response.json({
      refreshId,
      sourceUrl,
      sources,
      notes,
      diff,
      summary: {
        changes: diff.length,
        gpus: candidate.gpus.length,
        apis: candidate.apis.length,
        version: candidate.version,
        last_updated: candidate.last_updated,
      },
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Could not refresh market data." });
  }
});

app.post("/api/admin/market-data/refresh/apply", requireAdmin, async (request, response) => {
  const refreshId = String(request.body?.refreshId ?? "");
  const pending = pendingRefreshes.get(refreshId);
  if (!pending || pending.expires < Date.now()) {
    response.status(404).json({ error: "Refresh preview expired. Fetch fresh data again." });
    return;
  }
  await fs.writeFile(dataFile, `${JSON.stringify(pending.candidate, null, 2)}\n`, "utf8");
  pendingRefreshes.delete(refreshId);
  response.json(pending.candidate);
});

app.post("/api/paypal/create-order", async (request, response) => {
  const tier = Number(request.body?.tier);
  const currentTier = Number(request.body?.currentTier ?? 0);
  const payment = resolveTierPayment(tier, currentTier);
  if (!payment) {
    response.status(400).json({ error: "Unknown report tier." });
    return;
  }
  if (payment.alreadyUnlocked) {
    response.status(400).json({ error: "This report tier is already unlocked." });
    return;
  }
  const amount = payment.amount;

  const accessToken = await getPayPalAccessToken();
  if (!accessToken) {
    response.json({ id: `mock-tier-${tier}-${amount}-${Date.now()}`, tier, amount, mock: true, upgrade: payment.upgrade });
    return;
  }

  const paypalResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: amount }, custom_id: `tier-${tier}` }],
    }),
  });
  const body = await paypalResponse.json();
  response.status(paypalResponse.status).json({ ...body, tier });
});

app.post("/api/paypal/capture-order", async (request, response) => {
  const tier = Number(request.body?.tier);
  const currentTier = Number(request.body?.currentTier ?? 0);
  const orderId = String(request.body?.orderId ?? "");
  const payment = resolveTierPayment(tier, currentTier);
  if (!payment || !orderId) {
    response.status(400).json({ error: "Order id and valid tier are required." });
    return;
  }
  if (payment.alreadyUnlocked) {
    response.json({ unlockedTier: currentTier, verified: true, alreadyUnlocked: true });
    return;
  }
  const amount = payment.amount;

  const accessToken = await getPayPalAccessToken();
  if (!accessToken || orderId.startsWith("mock-tier-")) {
    response.json({ unlockedTier: tier, verified: false, mock: true });
    return;
  }

  const paypalResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const body = await paypalResponse.json();
  const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
  const paid = body.status === "COMPLETED" && capture?.amount?.currency_code === "USD" && capture?.amount?.value === amount;

  if (!paid) {
    response.status(402).json({ error: "Payment was not verified.", paypal: body });
    return;
  }
  response.json({ unlockedTier: tier, verified: true });
});

app.use(express.static(distDir));
app.use(async (_request, response) => {
  try {
    await fs.access(path.join(distDir, "index.html"));
    response.sendFile(path.join(distDir, "index.html"));
  } catch {
    response.status(404).send(`Build the frontend with npm run build, or use Vite on http://127.0.0.1:${webPort}/.`);
  }
});

app.listen(apiPort, "127.0.0.1", () => {
  console.log(`API server listening on http://127.0.0.1:${apiPort}`);
});
