import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  CreditCard,
  Download,
  FileText,
  Home,
  HelpCircle,
  KeyRound,
  Lock,
  LogIn,
  Plus,
  Save,
  Send,
  Server,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  TrendingUp,
  Unlock,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type GpuModel = {
  id: string;
  model: string;
  category: string;
  vram_gb: number;
  hardware_cost: number;
  rent_on_demand: number;
  rent_spot: number;
};
type ApiModel = {
  id: string;
  provider: string;
  model: string;
  tier: string;
  input: number;
  output: number;
};
type MarketData = {
  version: string;
  last_updated: string;
  tco_multiplier: number;
  gpus: GpuModel[];
  apis: ApiModel[];
};
type PayPalConfig = { clientId: string | null; mode: "sandbox" | "live"; serverVerified: boolean; devMockPayments: boolean };
type RefreshChange = {
  type: "added" | "removed" | "changed";
  group: string;
  id: string;
  model: string;
  changes: { field: string; before: string | number; after: string | number }[];
};
type RefreshPreview = {
  refreshId: string;
  sourceUrl: string;
  sources?: { label: string; url: string; updated: number; total: number }[];
  notes?: string[];
  diff: RefreshChange[];
  summary: { changes: number; gpus: number; apis: number; version: string; last_updated: string };
};
type Tier = 0 | 1 | 2;
type Metrics = {
  clampedHours: number;
  dailyRental: number;
  monthlyRental: number;
  ownerTco: number;
  breakevenDay: number;
  monthlyInputCost: number;
  monthlyOutputCost: number;
  monthlyApi: number;
  termMonths: number;
  termRental: number;
  termApi: number;
  tokenVolume: number;
  verdict: string;
  hiddenTokenOverhead: number;
};

const FALLBACK_MARKET_DATA: MarketData = {
  version: "fallback",
  last_updated: "2026-05-06",
  tco_multiplier: 1.15,
  gpus: [
    { id: "h100-80gb", model: "H100", category: "Datacenter", vram_gb: 80, hardware_cost: 25000, rent_on_demand: 3, rent_spot: 1.8 },
    { id: "b200-192gb", model: "B200", category: "Datacenter", vram_gb: 192, hardware_cost: 35000, rent_on_demand: 6.5, rent_spot: 3.9 },
  ],
  apis: [
    { id: "gpt-5", provider: "OpenAI", model: "GPT-5", tier: "Frontier Reasoning", input: 2.5, output: 15 },
    { id: "llama-4-maverick", provider: "Meta Cloud", model: "Llama 4 Maverick", tier: "Performance", input: 0.6, output: 0.9 },
  ],
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value > 1000 ? 0 : 2,
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return body as T;
}

export default function App() {
  const [marketData, setMarketData] = useState<MarketData>(FALLBACK_MARKET_DATA);
  const [paypalConfig, setPayPalConfig] = useState<PayPalConfig>({ clientId: null, mode: "sandbox", serverVerified: false, devMockPayments: true });
  const [loadError, setLoadError] = useState("");
  const isAdminRoute = window.location.pathname === "/admin";
  const isHelpRoute = window.location.pathname === "/help";

  const refreshConfig = useCallback(async () => {
    try {
      const [nextMarketData, nextPayPalConfig] = await Promise.all([
        fetchJson<MarketData>("/api/market-data"),
        fetchJson<PayPalConfig>("/api/paypal/config"),
      ]);
      setMarketData(nextMarketData);
      setPayPalConfig(nextPayPalConfig);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load server configuration.");
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  if (isAdminRoute) {
    return <AdminApp initialData={marketData} paypalConfig={paypalConfig} onRefresh={refreshConfig} />;
  }

  if (isHelpRoute) {
    return <HelpPage />;
  }

  return <CalculatorApp marketData={marketData} paypalConfig={paypalConfig} loadError={loadError} />;
}

function CalculatorApp({
  marketData,
  paypalConfig,
  loadError,
}: {
  marketData: MarketData;
  paypalConfig: PayPalConfig;
  loadError: string;
}) {
  const [gpuId, setGpuId] = useState(marketData.gpus[0]?.id ?? "");
  const selectedGpu = marketData.gpus.find((gpu) => gpu.id === gpuId) ?? marketData.gpus[0] ?? FALLBACK_MARKET_DATA.gpus[0];
  const [useSpotPricing, setUseSpotPricing] = useState(false);
  const hourlyRate = useSpotPricing ? selectedGpu.rent_spot : selectedGpu.rent_on_demand;
  const purchasePrice = selectedGpu.hardware_cost;
  const [dailyHours, setDailyHours] = useState(10);
  const [projectMonths, setProjectMonths] = useState(18);
  const [apiId, setApiId] = useState(marketData.apis[0]?.id ?? "");
  const selectedApi = marketData.apis.find((api) => api.id === apiId) ?? marketData.apis[0] ?? FALLBACK_MARKET_DATA.apis[0];
  const [inputTokens, setInputTokens] = useState(2200);
  const [outputTokens, setOutputTokens] = useState(650);
  const [dailyRequests, setDailyRequests] = useState(18000);
  const [unlockedTier, setUnlockedTier] = useState<Tier>(0);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [reportTier, setReportTier] = useState<1 | 2>(2);
  const [previewTier, setPreviewTier] = useState<1 | 2>(1);
  const [reportExamplesOpen, setReportExamplesOpen] = useState(false);
  const [exampleRefreshKey, setExampleRefreshKey] = useState(0);
  const reportRef = useRef<HTMLDivElement | null>(null);

  function selectReportExample(tier: 1 | 2) {
    setPreviewTier(tier);
    setReportExamplesOpen(true);
    setExampleRefreshKey((key) => key + 1);
  }

  useEffect(() => {
    const rawEstimate = window.localStorage.getItem("ai-unit-calculator-estimate");
    if (!rawEstimate) return;
    try {
      const estimate = JSON.parse(rawEstimate) as { inputTokens?: number; outputTokens?: number; dailyRequests?: number };
      if (typeof estimate.inputTokens === "number") setInputTokens(estimate.inputTokens);
      if (typeof estimate.outputTokens === "number") setOutputTokens(estimate.outputTokens);
      if (typeof estimate.dailyRequests === "number") setDailyRequests(estimate.dailyRequests);
      setPaymentStatus("Usage estimate applied from Help.");
    } finally {
      window.localStorage.removeItem("ai-unit-calculator-estimate");
    }
  }, []);

  useEffect(() => {
    if (!marketData.gpus.some((gpu) => gpu.id === gpuId)) {
      setGpuId(marketData.gpus[0]?.id ?? "");
    }
    if (!marketData.apis.some((api) => api.id === apiId)) {
      setApiId(marketData.apis[0]?.id ?? "");
    }
  }, [apiId, gpuId, marketData]);

  const metrics = useMemo<Metrics>(() => {
    const clampedHours = Math.max(0, Math.min(24, dailyHours));
    const dailyRental = hourlyRate * clampedHours;
    const monthlyRental = dailyRental * 30;
    const ownerTco = purchasePrice * marketData.tco_multiplier;
    const breakevenDay = dailyRental > 0 ? purchasePrice / dailyRental : Infinity;
    const hiddenTokenOverhead = selectedApi.tier === "Frontier Reasoning" ? 0.2 : 0;
    const monthlyInputCost = ((inputTokens * 0.5 * dailyRequests * 30) / 1_000_000) * selectedApi.input;
    const monthlyOutputCost = ((outputTokens * (1 + hiddenTokenOverhead) * dailyRequests * 30) / 1_000_000) * selectedApi.output;
    const monthlyApi = monthlyInputCost + monthlyOutputCost;
    const termMonths = Math.max(1, projectMonths);
    const termRental = monthlyRental * termMonths;
    const termApi = monthlyApi * termMonths;
    const tokenVolume = (inputTokens + outputTokens) * dailyRequests * 30;
    const verdict =
      tokenVolume > 5_000_000_000
        ? "High token volume favors dedicated infrastructure once utilization is stable."
        : tokenVolume > 750_000_000
          ? "Hybrid deployment is likely optimal: reserve infrastructure for steady workloads and APIs for burst."
          : "Public API consumption remains strategically flexible at this volume.";

    return {
      clampedHours,
      dailyRental,
      monthlyRental,
      ownerTco,
      breakevenDay,
      monthlyInputCost,
      monthlyOutputCost,
      monthlyApi,
      termMonths,
      termRental,
      termApi,
      tokenVolume,
      verdict,
      hiddenTokenOverhead,
    };
  }, [dailyHours, hourlyRate, inputTokens, outputTokens, dailyRequests, selectedApi, purchasePrice, projectMonths, marketData.tco_multiplier]);

  const chartData = useMemo(() => {
    const months = Array.from({ length: metrics.termMonths }, (_, index) => `M${index + 1}`);
    return {
      labels: months,
      datasets: [
        {
          label: "Cloud GPU Rental",
          data: months.map((_, index) => metrics.monthlyRental * (index + 1)),
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.18)",
          tension: 0.32,
          fill: true,
        },
        {
          label: "Hardware Ownership",
          data: months.map(() => metrics.ownerTco),
          borderColor: "#22d3ee",
          backgroundColor: "rgba(34, 211, 238, 0.16)",
          tension: 0.2,
        },
        {
          label: "Public API",
          data: months.map((_, index) => metrics.monthlyApi * (index + 1)),
          borderColor: "#308e57",
          backgroundColor: "rgba(48, 142, 87, 0.18)",
          tension: 0.32,
        },
      ],
    };
  }, [metrics]);

  async function generatePDF(tier: 1 | 2) {
    if (!reportRef.current) return;
    setReportTier(tier);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
    const pageWidth = 8.5;
    const pageHeight = 11;
    const imageHeight = Math.min(pageHeight, (canvas.height * pageWidth) / canvas.width);
    pdf.addImage(image, "PNG", 0, 0, pageWidth, imageHeight);
    pdf.save(tier === 1 ? "gpu-executive-breakeven.pdf" : "ai-strategic-roadmap.pdf");
  }

  return (
    <main className="home-page min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <a
                className="admin-gear-button"
                href="/admin"
                title="Admin"
                aria-label="Admin"
              >
                <Settings size={15} />
              </a>
              <p className="header-console-subtitle text-sm font-bold uppercase tracking-[0.18em] text-cyanline">Strategic Total Cost of Ownership Console</p>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">AI Unit Calculator</h1>
          </div>
          <div className="header-stat-readouts grid grid-cols-3 gap-3 text-right">
            <Stat label="Breakeven" value={Number.isFinite(metrics.breakevenDay) ? `${Math.ceil(metrics.breakevenDay)} days` : "N/A"} />
            <Stat label="API Burn" value={currency(metrics.monthlyApi)} />
            <Stat label="Owned Total Cost" value={currency(metrics.ownerTco)} />
          </div>
        </header>

        {loadError ? (
          <div className="flex items-center gap-3 rounded-md border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            <AlertTriangle size={18} />
            {loadError}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Panel className="engine-panel" icon={<Server size={19} />} title="GPU Infrastructure Engine" action={<PanelHelpLink />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <GpuSelectField label="GPU Model" value={gpuId} gpus={marketData.gpus} onChange={setGpuId} />
              <Field label="Daily Utilization" value={dailyHours} min={0} max={24} onChange={setDailyHours} suffix="hrs" />
              <Field label="Project Term" value={projectMonths} min={1} max={60} onChange={setProjectMonths} suffix="months" />
              <label className="flex h-full min-h-11 items-center gap-3 rounded-md border border-white/10 bg-slate-950/45 px-3">
                <input className="size-4 accent-cyanline" type="checkbox" checked={useSpotPricing} onChange={(event) => setUseSpotPricing(event.target.checked)} />
                <span className="text-sm font-semibold text-white">Use spot pricing</span>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <Badge>{selectedGpu.category}</Badge>
              <Badge>{selectedGpu.vram_gb} GB VRAM</Badge>
              <Badge>{useSpotPricing ? "Spot" : "On-demand"} {currency(hourlyRate)}/hr</Badge>
              <Badge>{marketData.tco_multiplier}x ownership multiplier</Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Monthly rental" value={currency(metrics.monthlyRental)} />
              <Metric label="Ownership buffer" value={currency(metrics.ownerTco - purchasePrice)} />
              <Metric label="Term rental" value={currency(metrics.termRental)} />
            </div>
          </Panel>

          <Panel className="engine-panel" icon={<Cpu size={19} />} title="Public API Engine" action={<PanelHelpLink />}>
            <div className="grid gap-4">
              <TieredModelSelect label="Model Selection" value={apiId} models={marketData.apis} onChange={setApiId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Avg Input Tokens" value={inputTokens} min={0} step={100} onChange={setInputTokens} />
                <Field label="Avg Output Tokens" value={outputTokens} min={0} step={50} onChange={setOutputTokens} />
              </div>
              <Field label="Daily Request Volume" value={dailyRequests} min={0} step={1000} onChange={setDailyRequests} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <Badge>{selectedApi.provider}</Badge>
              <Badge>{selectedApi.tier}</Badge>
              {metrics.hiddenTokenOverhead > 0 ? <Badge>20% hidden output-token overhead</Badge> : null}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Metric label="Cached input cost" value={currency(metrics.monthlyInputCost)} />
              <Metric label="Output cost" value={currency(metrics.monthlyOutputCost)} />
            </div>
          </Panel>
        </section>

        <section className="grid gap-6">
          <Panel className="crossover-panel" icon={<TrendingUp size={19} />} title="Crossover Visualization">
            <div className="h-[380px]">
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  plugins: {
                    legend: { labels: { color: "#e5eef8", boxWidth: 12, boxHeight: 12 } },
                    tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${currency(Number(item.raw))}` } },
                  },
                  scales: {
                    x: { grid: { color: "rgba(229, 238, 248, 0.13)" }, ticks: { color: "#cbd5e1" } },
                    y: {
                      grid: { color: "rgba(229, 238, 248, 0.13)" },
                      ticks: { color: "#cbd5e1", callback: (value) => currency(Number(value)) },
                    },
                  },
                }}
              />
            </div>
          </Panel>

          <Panel className="report-export-panel" icon={<FileText size={19} />} title="Report Export">
            <div className="report-tier-panel grid gap-4 rounded-md border border-white/10 bg-slate-950/35 p-4 xl:grid-cols-[1fr_1fr_0.9fr]">
              <div>
                <ReportPreviewCard
                  tier="Tier 1"
                  title="GPU Executive PDF"
                  price="$5.00"
                  sections={["Breakeven day", "Rental vs ownership cost", "GPU category and VRAM", "Ownership multiplier assumptions"]}
                  selected={previewTier === 1}
                  onClick={() => selectReportExample(1)}
                />
              </div>
              <div>
                <ReportPreviewCard
                  tier="Tier 2"
                  title="Full Strategic Roadmap PDF"
                  price="$10.00"
                  sections={["API vs self-hosted comparison", "Scalability verdict", "Token volume assumptions", "GPU and API source metadata"]}
                  selected={previewTier === 2}
                  onClick={() => selectReportExample(2)}
                />
              </div>
              <div className="grid gap-3">
                    <div className="current-tier-card rounded-md border border-white/10 bg-slate-950/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Current Tier</p>
                      <p className="text-xs text-slate-400">Unlocked tier {unlockedTier}</p>
                    </div>
                      <div className="grid size-9 place-items-center rounded-md border border-cyanline/30 bg-cyanline/10 text-cyanline">
                        <KeyRound size={18} />
                      </div>
                  </div>
                  <div className="mb-3 grid gap-2">
                    <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
                      <input
                        className="size-4 accent-cyanline"
                        type="radio"
                        name="report-tier"
                        checked={previewTier === 1}
                        onChange={() => selectReportExample(1)}
                      />
                      Tier 1: GPU Executive
                    </label>
                    <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
                      <input
                        className="size-4 accent-cyanline"
                        type="radio"
                        name="report-tier"
                        checked={previewTier === 2}
                        onChange={() => selectReportExample(2)}
                      />
                      Tier 2: Full Roadmap
                    </label>
                  </div>
                  {paypalConfig.devMockPayments && !paypalConfig.serverVerified ? (
                    <div className="dev-payment-note mb-3 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                      Dev mock payments are enabled for local report testing. Set real PayPal credentials before publishing.
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    <PayPalTierButton
                      key={`${previewTier}-${unlockedTier}`}
                      tier={previewTier}
                      currentTier={unlockedTier}
                      paypalConfig={paypalConfig}
                      onStatus={setPaymentStatus}
                      onApprove={(tier) => setUnlockedTier(Math.max(unlockedTier, tier) as Tier)}
                    />
                    <button
                      className={`flex h-12 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition enabled:hover:bg-opacity-25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900 disabled:text-slate-500 ${
                        previewTier === 1
                          ? "border-cyanline/40 bg-cyanline/15 text-cyan-100 enabled:hover:bg-cyanline"
                          : "border-limecheck/40 bg-limecheck/15 text-lime-100 enabled:hover:bg-limecheck"
                      }`}
                      disabled={unlockedTier < previewTier}
                      onClick={() => generatePDF(previewTier)}
                    >
                      {unlockedTier < previewTier ? <Lock size={16} /> : <Download size={16} />}
                      {previewTier === 1 ? "Export GPU PDF" : "Export Roadmap"}
                    </button>
                  </div>
                  {paymentStatus ? <p className="mt-3 text-xs text-slate-400">{paymentStatus}</p> : null}
                </div>
              </div>
            </div>
            <ReportExampleViewer
              tier={previewTier}
              open={reportExamplesOpen}
              refreshKey={exampleRefreshKey}
              onToggle={() => setReportExamplesOpen(!reportExamplesOpen)}
            />
          </Panel>
        </section>

        <PricingFootnote />
      </div>

      <ReportTemplate
        reportRef={reportRef}
        reportTier={reportTier}
        selectedGpu={selectedGpu}
        selectedApi={selectedApi}
        marketData={marketData}
        pricingMode={useSpotPricing ? "Spot" : "On-demand"}
        metrics={metrics}
        purchasePrice={purchasePrice}
        hourlyRate={hourlyRate}
        dailyRequests={dailyRequests}
      />
    </main>
  );
}

function AdminApp({
  initialData,
  paypalConfig,
  onRefresh,
}: {
  initialData: MarketData;
  paypalConfig: PayPalConfig;
  onRefresh: () => Promise<void>;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [marketData, setMarketData] = useState<MarketData>(initialData);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [refreshPreview, setRefreshPreview] = useState<RefreshPreview | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setMarketData(initialData);
  }, [initialData]);

  useEffect(() => {
    fetchJson<{ authenticated: boolean }>("/api/admin/session")
      .then((session) => setAuthenticated(session.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  async function login() {
    setError("");
    try {
      await fetchJson("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      const data = await fetchJson<MarketData>("/api/admin/market-data");
      setMarketData(data);
      setAuthenticated(true);
      setPassword("");
      setStatus("Signed in.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign-on failed.");
    }
  }

  async function save() {
    setError("");
    setStatus("");
    try {
      const saved = await fetchJson<MarketData>("/api/admin/market-data", { method: "PUT", body: JSON.stringify(marketData) });
      setMarketData(saved);
      await onRefresh();
      setStatus("Market data saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    }
  }

  async function fetchFreshData() {
    setError("");
    setStatus("Fetching fresh market data...");
    setRefreshPreview(null);
    setIsRefreshing(true);
    try {
      const preview = await fetchJson<RefreshPreview>("/api/admin/market-data/refresh", { method: "POST" });
      setRefreshPreview(preview);
      setStatus(preview.diff.length ? "Fresh data preview ready for review." : "Fresh data matches current values.");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Refresh failed.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function applyFreshData() {
    if (!refreshPreview) return;
    setError("");
    setStatus("");
    try {
      const saved = await fetchJson<MarketData>("/api/admin/market-data/refresh/apply", {
        method: "POST",
        body: JSON.stringify({ refreshId: refreshPreview.refreshId }),
      });
      setMarketData(saved);
      setRefreshPreview(null);
      await onRefresh();
      setStatus("Fresh market data applied.");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Apply failed.");
    }
  }

  async function logout() {
    await fetchJson("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
  }

  if (!authenticated) {
    return (
    <main className="admin-page grid min-h-screen place-items-center px-4 py-10 text-slate-100">
        <section className="auth-panel w-full max-w-md rounded-lg border border-white/10 bg-panel/90 p-6 shadow-glow">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md border border-cyanline/30 bg-cyanline/10 text-cyanline">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Admin Sign-On</h1>
              <p className="text-sm text-slate-400">Manage model values and payment configuration.</p>
            </div>
          </div>
          <a
            className="mb-5 flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.08]"
            href="/"
          >
            <Home size={16} />
            Home
          </a>
          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Admin Password</span>
            <input
              className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-cyanline/70"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void login();
              }}
            />
          </label>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <button
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-cyanline px-4 text-sm font-bold text-slate-950 hover:bg-cyan-200"
            onClick={login}
          >
            <LogIn size={17} />
            Sign On
          </button>
          <div className="mt-5">
            <PricingFootnote compact />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-cyanline">Private Console</p>
            <h1 className="text-3xl font-semibold text-white">Administration</h1>
          </div>
          <div className="flex gap-3">
            <a className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]" href="/">
              <Home size={16} />
              Home
            </a>
            <button className="flex h-10 items-center justify-center rounded-md border border-white/10 px-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]" onClick={logout}>
              Sign Out
            </button>
          </div>
        </header>

        <section className="grid gap-6">
          <Panel className="admin-panel" icon={<Settings size={19} />} title="Market Data">
            <div className="grid gap-6">
              <div className="paypal-config-panel rounded-md border border-white/10 bg-slate-950/45 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Fresh Data Guardrails</p>
                    <p className="admin-guardrail-copy mt-1 text-sm text-slate-400">Fetch from the configured source, review every delta, then apply only after cross-checking.</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="flex h-11 items-center justify-center gap-2 rounded-md border border-cyanline/40 bg-cyanline/15 px-4 text-sm font-semibold text-cyan-100 hover:bg-cyanline/25 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isRefreshing}
                      onClick={fetchFreshData}
                      type="button"
                    >
                      <Sparkles size={17} />
                      {isRefreshing ? "Fetching..." : "Fetch Fresh Data"}
                    </button>
                    <button className="flex h-11 items-center justify-center gap-2 rounded-md bg-cyanline px-4 text-sm font-bold text-slate-950 hover:bg-cyan-200" onClick={save}>
                      <Save size={17} />
                      Save Market Data
                    </button>
                  </div>
                </div>
                {(status || error) && !refreshPreview ? (
                  <div className="mt-3">
                    {status ? <p className="admin-status-message text-sm text-lime-300">{status}</p> : null}
                    {error ? <p className="text-sm text-rose-300">{error}</p> : null}
                  </div>
                ) : null}
                {refreshPreview ? (
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-2 rounded-md border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300 sm:grid-cols-4">
                      <ConfigRow label="Version" value={refreshPreview.summary.version} />
                      <ConfigRow label="Last Updated" value={refreshPreview.summary.last_updated} />
                      <ConfigRow label="GPUs" value={String(refreshPreview.summary.gpus)} />
                      <ConfigRow label="API Models" value={String(refreshPreview.summary.apis)} />
                    </div>
                    {refreshPreview.sources?.length ? (
                      <div className="grid gap-3 rounded-md border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300 md:grid-cols-2">
                        {refreshPreview.sources.map((source) => (
                          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3" key={`${source.label}-${source.url}`}>
                            <p className="font-semibold text-white">{source.label}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              Updated {source.updated} of {source.total} tracked rows
                            </p>
                            <a className="mt-2 block truncate text-xs font-semibold text-cyanline hover:text-cyan-200" href={source.url} target="_blank" rel="noreferrer">
                              {source.url}
                            </a>
                            {source.label.includes("GCP") && source.updated === 0 ? (
                              <p className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/10 px-2.5 py-2 text-xs leading-5 text-amber-100">
                                GCP pricing requires `GCP_BILLING_API_KEY` in the server environment before the Cloud Billing Catalog can be consumed.
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {refreshPreview.notes?.length ? (
                      <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                        <p className="mb-2 font-semibold">Review notes</p>
                        <ul className="grid max-h-36 gap-1 overflow-auto">
                          {refreshPreview.notes.slice(0, 12).map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                        {refreshPreview.notes.length > 12 ? <p className="mt-2 text-amber-200/80">Showing 12 of {refreshPreview.notes.length} notes.</p> : null}
                      </div>
                    ) : null}
                    <RefreshDiffTable changes={refreshPreview.diff} />
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        className="flex h-11 items-center justify-center gap-2 rounded-md bg-limecheck px-4 text-sm font-bold text-slate-950 hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!refreshPreview.diff.length}
                        onClick={applyFreshData}
                      >
                        <Save size={17} />
                        Apply Reviewed Data
                      </button>
                      <button
                        className="h-11 rounded-md border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"
                        onClick={() => setRefreshPreview(null)}
                      >
                        Discard Preview
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-8">
                <AdminTable
                  title="GPU Models"
                  columns={[
                    { key: "id", label: "ID" },
                    { key: "model", label: "Model" },
                    { key: "category", label: "Category" },
                    { key: "vram_gb", label: "VRAM GB" },
                    { key: "hardware_cost", label: "Hardware Cost" },
                    { key: "rent_on_demand", label: "On-Demand Rent" },
                    { key: "rent_spot", label: "Spot Rent" },
                  ]}
                  rows={marketData.gpus}
                  onRowsChange={(gpus) => setMarketData({ ...marketData, gpus: gpus as GpuModel[] })}
                  newRow={{ id: "new-gpu", model: "New GPU", category: "Inference", vram_gb: 0, hardware_cost: 0, rent_on_demand: 0, rent_spot: 0 }}
                />
                <AdminTable
                  title="API Models"
                  columns={[
                    { key: "id", label: "ID" },
                    { key: "provider", label: "Provider" },
                    { key: "model", label: "Model" },
                    { key: "tier", label: "Tier" },
                    { key: "input", label: "Input / 1M" },
                    { key: "output", label: "Output / 1M" },
                  ]}
                  rows={marketData.apis}
                  onRowsChange={(apis) => setMarketData({ ...marketData, apis: apis as ApiModel[] })}
                  newRow={{ id: "new-api", provider: "Provider", model: "New API", tier: "Value", input: 0, output: 0 }}
                />
              </div>
              <div className="rounded-md border border-white/10 bg-slate-950/45 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-md border border-cyanline/30 bg-cyanline/10 text-cyanline">
                    <CreditCard size={18} />
                  </div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">PayPal Configuration</h3>
                </div>
                <div className="grid gap-4 text-sm text-slate-300 xl:grid-cols-[0.75fr_1fr_1fr]">
                  <div className="grid gap-3">
              <ConfigRow className="paypal-muted-row" label="Mode" value={paypalConfig.mode} />
              <ConfigRow className="paypal-muted-row" label="Client ID" value={paypalConfig.clientId ? `${paypalConfig.clientId.slice(0, 10)}...` : "Not set"} />
              <ConfigRow className="paypal-muted-row" label="Server Verification" value={paypalConfig.serverVerified ? "Configured" : "Missing credentials"} />
              <ConfigRow className="paypal-muted-row" label="Dev Mock Payments" value={paypalConfig.devMockPayments ? "Enabled" : "Disabled"} />
                  </div>
                  <div className="rounded-md border border-white/10 bg-slate-950/45 p-4">
                    <p className="font-semibold text-white">To receive report money</p>
                    <p className="paypal-instructions mt-2 leading-6 text-slate-400">
                      Create a PayPal Business REST app, then set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in the hosting environment. Use
                      `PAYPAL_MODE=sandbox` for testing and `PAYPAL_MODE=live` for real payments.
                    </p>
                  </div>
                  <div
                    className="paypal-secret-note rounded-md border p-4"
                    style={{ backgroundColor: "#a7ada9", borderColor: "rgba(42, 37, 29, 0.22)", color: "#000000" }}
                  >
                    The client ID can be public. The client secret must stay server-side. The app now captures orders through `/api/paypal/capture-order`
                    before unlocking reports.
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </section>
        <PricingFootnote />
      </div>
      {isRefreshing ? (
        <div className="refresh-overlay" role="status" aria-live="polite" aria-label="Fetching fresh market data">
          <div className="refresh-loader-stack">
            <div className="propeller-loader" aria-hidden="true">
              <div className="propeller-rotor">
                <span />
                <span />
                <span />
              </div>
            </div>
            <p>Fetching fresh market data...</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function HelpPage() {
  const [activeUsers, setActiveUsers] = useState(300);
  const [requestsPerUser, setRequestsPerUser] = useState(60);
  const [contextTokens, setContextTokens] = useState(2000);
  const [userMessageTokens, setUserMessageTokens] = useState(200);
  const [responseTokens, setResponseTokens] = useState(650);
  const estimatedInputTokens = contextTokens + userMessageTokens;
  const estimatedDailyRequests = activeUsers * requestsPerUser;
  const estimatedMonthlyTokens = (estimatedInputTokens + responseTokens) * estimatedDailyRequests * 30;

  function applyEstimateToCalculator() {
    window.localStorage.setItem(
      "ai-unit-calculator-estimate",
      JSON.stringify({
        inputTokens: estimatedInputTokens,
        outputTokens: responseTokens,
        dailyRequests: estimatedDailyRequests,
      }),
    );
    window.location.href = "/";
  }

  return (
    <main className="help-page min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyanline">Help</p>
            <h1 className="text-3xl font-semibold text-white">How to Estimate Usage</h1>
          </div>
          <div className="flex gap-3">
            <a className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]" href="/">
              <Home size={16} />
              Home
            </a>
            <a className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]" href="/admin">
              <Settings size={16} />
              Admin
            </a>
          </div>
        </header>

        <Panel className="engine-panel" icon={<Server size={19} />} title="GPU Infrastructure Engine Help">
          <div className="grid gap-5 md:grid-cols-2">
            <HelpCard
              title="GPU Model"
              body="Choose the GPU that best matches the workload profile. VRAM matters for model size and context length; category helps distinguish training, inference, and workstation-style assumptions."
              example="Example: a 70B model may require a high-VRAM datacenter GPU, while smaller inference workloads may fit on L4 or A10G-class hardware."
            />
            <HelpCard
              title="Daily Utilization"
              body="Daily utilization is how many hours per day the GPU is expected to run paid or productive workloads. Higher utilization makes ownership breakeven faster."
              example="Example: 10 hours/day means the GPU is used for about 300 billable hours in a 30-day month."
            />
            <HelpCard
              title="On-Demand vs Spot"
              body="On-demand pricing is more stable and available. Spot pricing is cheaper but can be interrupted or unavailable, so it is better for fault-tolerant batch jobs."
              example="Example: use on-demand for production inference, but spot for resumable training, batch evaluation, or offline processing."
            />
            <HelpCard
              title="Hardware Cost"
              body="Hardware cost is the purchase price used for ownership analysis. The app multiplies it by the configured ownership multiplier to account for power, cooling, space, maintenance, and operational overhead."
              example="Example: $25,000 hardware cost x 1.15 ownership multiplier = $28,750 ownership cost basis."
            />
          </div>
          <div className="mt-5 rounded-md border border-cyanline/20 bg-cyanline/10 p-4 text-sm leading-6 text-cyan-100">
            Breakeven day is calculated as hardware cost divided by daily rental cost. Daily rental cost is hourly rental rate multiplied by daily utilization hours.
          </div>
        </Panel>

        <Panel className="engine-panel" icon={<Cpu size={19} />} title="Public API Engine">
          <div className="grid gap-8">
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Public API Engine Help</h2>
              <div className="grid gap-5 md:grid-cols-3">
                <HelpCard
                  title="Avg Input Tokens"
                  body="Average input tokens are everything sent to the model: system instructions, the user request, chat history, retrieved context, and pasted documents."
                  example="Example: 300 system + 100 user + 1,800 context = 2,200 input tokens."
                />
                <HelpCard
                  title="Avg Output Tokens"
                  body="Average output tokens are the model's response length. Short answers are often 100-300 tokens, detailed answers 600-1,200, and generated reports can exceed 2,000."
                  example="Example: a moderately detailed answer may average 650 output tokens."
                />
                <HelpCard
                  title="Daily Request Volume"
                  body="Daily request volume is the number of model calls made per day across all users, jobs, agents, automations, and background workflows."
                  example="Example: 300 users x 60 AI requests per user = 18,000 daily requests."
                />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-300">
                  <p className="font-semibold text-white">Prompt caching assumption</p>
                  <p className="mt-2">The calculator applies a 50% discount to input tokens to simulate repeated context, cached prompts, or common instruction blocks.</p>
                </div>
                <div className="rounded-md border border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-300">
                  <p className="font-semibold text-white">Reasoning tier overhead</p>
                  <p className="mt-2">Models tagged as Frontier Reasoning add a 20% hidden output-token overhead to represent extra reasoning tokens used behind the scenes.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Quick Estimator</h2>
              <div className="grid gap-5 text-sm text-slate-300">
                <div className="grid gap-3 rounded-md border border-white/10 bg-slate-950/45 p-4">
                  <p className="font-semibold text-white">Token shortcuts</p>
                  <p>1 token is roughly 3-4 English characters. About 750 words is roughly 1,000 tokens.</p>
                  <p>For document-heavy apps, retrieved context usually dominates input cost.</p>
                </div>
                <div className="grid gap-3 rounded-md border border-white/10 bg-slate-950/45 p-4">
                  <p className="font-semibold text-white">Request volume formula</p>
                  <code className="estimator-formula rounded-md bg-slate-950 p-3" style={{ color: "#e1e1e1" }}>
                    daily requests = active users per day x AI requests per user per day
                  </code>
                  <p>For backend agents, use workflow runs per day x model calls per workflow.</p>
                </div>
                <div className="grid gap-3 rounded-md border border-white/10 bg-slate-950/45 p-4">
                  <p className="font-semibold text-white">Common starting assumptions</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Metric label="Light assistant" value="500 in / 200 out" />
                    <Metric label="RAG assistant" value="2,500 in / 700 out" />
                    <Metric label="Report generator" value="6,000 in / 2,000 out" />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Estimator Panel</h2>
              <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Active Users Per Day" value={activeUsers} min={0} step={10} onChange={setActiveUsers} />
                  <Field label="Requests Per User Per Day" value={requestsPerUser} min={0} step={1} onChange={setRequestsPerUser} />
                  <Field label="System / Context Tokens" value={contextTokens} min={0} step={100} onChange={setContextTokens} />
                  <Field label="Avg User Message Tokens" value={userMessageTokens} min={0} step={25} onChange={setUserMessageTokens} />
                  <Field label="Avg Response Tokens" value={responseTokens} min={0} step={50} onChange={setResponseTokens} />
                </div>
                <div className="grid gap-3">
                  <Metric label="Avg Input Tokens" value={number(estimatedInputTokens)} />
                  <Metric label="Avg Output Tokens" value={number(responseTokens)} />
                  <Metric label="Daily Request Volume" value={number(estimatedDailyRequests)} />
                  <Metric label="Monthly Token Volume" value={number(estimatedMonthlyTokens)} />
                  <button
                    className="apply-calculator-button flex h-11 items-center justify-center gap-2 rounded-md bg-cyanline px-4 text-sm font-bold text-slate-950 hover:bg-cyan-200"
                    onClick={applyEstimateToCalculator}
                  >
                    <Send size={17} />
                    Apply to Calculator
                  </button>
                </div>
              </div>
              <div className="mt-5 rounded-md border border-cyanline/20 bg-cyanline/10 p-4 text-sm leading-6 text-cyan-100">
                Use these outputs as the values for the Public API Engine on the main page. This panel is meant for scenario planning, so users can test conservative, expected, and high-adoption assumptions before exporting a report.
              </div>
            </section>
          </div>
        </Panel>
        <PricingFootnote />
      </div>
    </main>
  );
}

function PricingFootnote({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={`pricing-footer rounded-lg border border-white/10 bg-slate-950/45 text-slate-300 shadow-glow ${
        compact ? "p-4 text-xs leading-5" : "p-5 text-sm leading-6"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-amber-200" size={compact ? 15 : 17} />
        <p>
          Pricing data is retrieved from configured public/vendor pricing sources and should be treated as an approximate market representation, generally
          intended to reflect recent values within the last week or five business days when those sources are available. Calculator outputs and generated
          reports are estimates for planning purposes only. For binding, final, or resolute pricing, confirm terms directly with the appropriate vendor or
          vendor representative.
        </p>
      </div>
      <p className="mt-4 text-center text-xs font-semibold text-slate-500">© 2026, TrippintheCurl or its affiliates. All Rights Reserved. Made with OpenAI CodeX and a little love.</p>
      <nav className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4 text-xs font-semibold">
        <a className="footer-social-link" href="https://www.linkedin.com/in/maurice-johnson-80085/" target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        <span className="footer-social-separator">|</span>
        <a className="footer-social-link" href="https://www.trippinthecurl.com/contact" target="_blank" rel="noreferrer">
          Contact Us
        </a>
        <span className="footer-social-separator">|</span>
        <a className="footer-social-link" href="https://www.trippinthecurl.com/" target="_blank" rel="noreferrer">
          Personal Website
        </a>
      </nav>
    </footer>
  );
}

function HelpCard({ title, body, example }: { title: string; body: string; example: string }) {
  return (
    <section className="help-card rounded-lg border border-white/10 bg-panel/88 p-5 shadow-glow">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
      <p className="help-callout mt-4 rounded-md border border-cyanline/20 bg-cyanline/10 p-3 text-sm leading-6 text-cyan-100">{example}</p>
    </section>
  );
}

function PayPalTierButton({
  tier,
  currentTier,
  paypalConfig,
  onApprove,
  onStatus,
}: {
  tier: Tier;
  currentTier: Tier;
  paypalConfig: PayPalConfig;
  onApprove: (tier: Tier) => void;
  onStatus: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const usePayPalSdk = Boolean(paypalConfig.clientId && paypalConfig.serverVerified);
  const alreadyUnlocked = currentTier >= tier;
  const amount = tier === 2 && currentTier === 1 ? "5.00" : tier === 2 ? "10.00" : "5.00";
  const label = alreadyUnlocked ? "Unlocked" : tier === 2 && currentTier === 1 ? "Upgrade" : "Unlock";

  const captureOrder = useCallback(
    async (orderId: string) => {
      const result = await fetchJson<{ unlockedTier: Tier; verified: boolean; mock?: boolean }>("/api/paypal/capture-order", {
        method: "POST",
        body: JSON.stringify({ orderId, tier, currentTier }),
      });
      onApprove(result.unlockedTier);
      onStatus(result.verified ? `Verified PayPal payment for tier ${tier}.` : `Local mock payment approved for tier ${tier}.`);
    },
    [currentTier, onApprove, onStatus, tier],
  );

  useEffect(() => {
    if (!usePayPalSdk || !paypalConfig.clientId || !containerRef.current) return;
    if (alreadyUnlocked) return;

    const scriptId = "paypal-js-sdk";
    const renderButtons = () => {
      if (!window.paypal || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      window.paypal
        .Buttons({
          style: { layout: "vertical", color: "gold", shape: "rect", label: "pay" },
          createOrder: async () => {
            const order = await fetchJson<{ id: string }>("/api/paypal/create-order", {
              method: "POST",
              body: JSON.stringify({ tier, currentTier }),
            });
            return order.id;
          },
          onApprove: async (data) => {
            await captureOrder(data.orderID);
          },
        })
        .render(containerRef.current);
    };

    if (document.getElementById(scriptId)) {
      renderButtons();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&currency=USD`;
    script.addEventListener("load", renderButtons);
    document.body.appendChild(script);
  }, [alreadyUnlocked, captureOrder, currentTier, paypalConfig.clientId, tier, usePayPalSdk]);

  if (alreadyUnlocked) {
    return (
      <button
        className="flex h-12 w-full cursor-default items-center justify-center gap-2 rounded-md border border-limecheck/40 bg-limecheck/15 px-3 text-xs font-bold text-lime-100"
        disabled
        type="button"
      >
        <Unlock size={16} />
        Unlocked
      </button>
    );
  }

  if (usePayPalSdk) {
    return <div ref={containerRef} className="min-h-12" />;
  }

  return (
    <button
      className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-amber-300/40 bg-amber-300 px-3 text-xs font-bold text-slate-950 transition hover:bg-amber-200"
      onClick={async () => {
        onStatus("Creating local mock order...");
        const order = await fetchJson<{ id: string }>("/api/paypal/create-order", { method: "POST", body: JSON.stringify({ tier, currentTier }) });
        await captureOrder(order.id);
      }}
    >
      <Unlock size={17} />
      {label} - ${amount}
    </button>
  );
}

function AdminTable<T extends Record<string, string | number>>({
  title,
  columns,
  rows,
  onRowsChange,
  newRow,
}: {
  title: string;
  columns: { key: keyof T; label: string }[];
  rows: T[];
  onRowsChange: (rows: T[]) => void;
  newRow: T;
}) {
  function updateRow(index: number, key: keyof T, value: string) {
    const nextRows = rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const current = row[key];
      return { ...row, [key]: typeof current === "number" ? Number(value) : value };
    });
    onRowsChange(nextRows);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h3>
        <button
          className="grid size-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
          title={`Add ${title}`}
          onClick={() => onRowsChange([...rows, newRow])}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="w-full overflow-x-auto rounded-md border border-white/10">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {columns.map((column) => (
                <th className="px-3 py-3" key={String(column.key)}>
                  {column.label}
                </th>
              ))}
              <th className="w-12 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-t border-white/10" key={`${title}-${index}`}>
                {columns.map((column) => (
                  <td className="p-2" key={String(column.key)}>
                    <input
                      className="h-10 w-full rounded-md border border-cyanline/40 bg-cyanline/25 px-3 text-white outline-none focus:border-cyanline/80"
                      type={typeof row[column.key] === "number" ? "number" : "text"}
                      step="0.01"
                      value={row[column.key]}
                      onChange={(event) => updateRow(index, column.key, event.target.value)}
                    />
                  </td>
                ))}
                <td className="p-2">
                  <button
                    className="grid size-10 place-items-center rounded-md border border-white/10 text-slate-400 hover:border-rose-300/40 hover:text-rose-200"
                    title={`Remove ${title} row`}
                    onClick={() => onRowsChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RefreshDiffTable({ changes }: { changes: RefreshChange[] }) {
  if (!changes.length) {
    return <p className="rounded-md border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-400">No differences found between current and fetched data.</p>;
  }

  return (
    <div className="max-h-80 overflow-auto rounded-md border border-white/10">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-3">Type</th>
            <th className="px-3 py-3">Group</th>
            <th className="px-3 py-3">Model</th>
            <th className="px-3 py-3">Delta</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr className="border-t border-white/10" key={`${change.group}-${change.id}-${change.type}`}>
              <td className="px-3 py-3 font-semibold text-white">{change.type}</td>
              <td className="px-3 py-3 text-slate-300">{change.group}</td>
              <td className="px-3 py-3 text-slate-300">{change.model}</td>
              <td className="px-3 py-3 text-slate-400">
                {change.changes.length
                  ? change.changes.map((delta) => `${delta.field}: ${delta.before} -> ${delta.after}`).join("; ")
                  : change.type === "added"
                    ? "New entry"
                    : "Removed entry"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupBy<T>(items: T[], getGroup: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const group = getGroup(item) || "Other";
    groups[group] = [...(groups[group] ?? []), item];
    return groups;
  }, {});
}

function TieredModelSelect({ label, value, models, onChange }: { label: string; value: string; models: ApiModel[]; onChange: (value: string) => void }) {
  const grouped = groupBy(models, (model) => model.tier);
  return (
    <label className="grid gap-2">
      <span className="form-field-label text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <select
        className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-cyanline/70"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {Object.entries(grouped).map(([tier, modelsInTier]) => (
          <optgroup key={tier} label={tier}>
            {modelsInTier.map((model) => (
              <option key={model.id} value={model.id}>
                {model.provider} - {model.model}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function GpuSelectField({ label, value, gpus, onChange }: { label: string; value: string; gpus: GpuModel[]; onChange: (value: string) => void }) {
  const grouped = groupBy(gpus, (gpu) => gpu.category);
  return (
    <label className="grid gap-2">
      <span className="form-field-label text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <select
        className="h-11 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-cyanline/70"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {Object.entries(grouped).map(([category, gpusInCategory]) => (
          <optgroup key={category} label={category}>
            {gpusInCategory.map((gpu) => (
              <option key={gpu.id} value={gpu.id}>
                {gpu.model} - {gpu.vram_gb} GB VRAM
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="engine-badge rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1">{children}</span>;
}

function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="form-field-label text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex items-center rounded-md border border-white/10 bg-slate-950/60 px-3 focus-within:border-cyanline/70">
        <input
          className="h-11 w-full bg-transparent text-sm text-white outline-none"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <span className="ml-2 text-xs text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

function Panel({ title, icon, action, children, className = "" }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-white/10 bg-panel/88 p-5 shadow-glow backdrop-blur ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md border border-cyanline/30 bg-cyanline/10 text-cyanline">{icon}</div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelHelpLink() {
  return (
    <a
      className="header-icon-button"
      href="/help"
      title="Help"
      aria-label="Help"
    >
      <HelpCircle size={15} />
    </a>
  );
}

function ReportPreviewCard({
  tier,
  title,
  price,
  sections,
  selected,
  onClick,
}: {
  tier: string;
  title: string;
  price: string;
  sections: string[];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full overflow-hidden rounded-md border text-left transition ${
        selected ? "border-cyanline/70 bg-cyanline/10" : "border-white/10 bg-slate-950/45 hover:border-white/20 hover:bg-white/[0.04]"
      }`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyanline">{tier}</p>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-xs font-bold text-amber-100">{price}</span>
      </div>
      <div className="grid gap-3 p-4">
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 h-2 w-2/3 rounded bg-slate-500/50" />
          <div className="mb-2 h-2 w-full rounded bg-slate-600/40" />
          <div className="h-2 w-4/5 rounded bg-slate-600/30" />
        </div>
        <ul className="grid gap-1.5 text-xs text-slate-300">
          {sections.map((section) => (
            <li className="flex items-center gap-2" key={section}>
              <span className="size-1.5 rounded-full bg-cyanline" />
              {section}
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

function ReportExampleViewer({ tier, open, refreshKey, onToggle }: { tier: 1 | 2; open: boolean; refreshKey: number; onToggle: () => void }) {
  const example =
    tier === 1
      ? {
          title: "GPU Executive PDF Example",
          src: "/report-examples/gpu-executive-breakeven.pdf",
        }
      : {
          title: "Full Strategic Roadmap PDF Example",
          src: "/report-examples/ai-strategic-roadmap.pdf",
        };

  return (
    <div className="report-panel mt-4 overflow-hidden rounded-md border border-white/10 bg-slate-950/35">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected Example</p>
          <h3 className="text-sm font-semibold text-white">{example.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {open ? (
            <a className="text-xs font-semibold text-cyanline hover:text-cyan-200" href={example.src} target="_blank" rel="noreferrer">
              Open PDF
            </a>
          ) : null}
          <button
            className="grid size-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
            onClick={onToggle}
            type="button"
            aria-label={open ? "Collapse selected example" : "Expand selected example"}
            title={open ? "Collapse selected example" : "Expand selected example"}
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {open ? (
        <iframe
          className="h-[520px] w-full bg-white"
          key={`${tier}-${refreshKey}`}
          src={`${example.src}?refresh=${refreshKey}#toolbar=0&navpanes=0`}
          title={example.title}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="truncate text-xs text-slate-400">{label}</p>
      <p className="truncate text-sm font-semibold text-white sm:text-base">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card rounded-md border border-white/10 bg-slate-950/45 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ConfigRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-md border border-white/10 bg-slate-950/45 px-3 py-3 ${className}`}>
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

const ReportTemplate = function ReportTemplate({
  reportRef,
  reportTier,
  selectedGpu,
  selectedApi,
  marketData,
  pricingMode,
  metrics,
  purchasePrice,
  hourlyRate,
  dailyRequests,
}: {
  reportRef: RefObject<HTMLDivElement | null>;
  reportTier: 1 | 2;
  selectedGpu: GpuModel;
  selectedApi: ApiModel;
  marketData: MarketData;
  pricingMode: string;
  metrics: Metrics;
  purchasePrice: number;
  hourlyRate: number;
  dailyRequests: number;
}) {
  return (
    <div ref={reportRef} className="report-capture p-8">
      <div className="border-b-4 border-slate-900 pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">AI Unit Calculator</p>
        <h2 className="mt-1 text-3xl font-bold text-slate-950">
          {reportTier === 1 ? "GPU Executive Breakeven Report" : "Full Strategic Roadmap Report"}
        </h2>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <PdfMetric label="GPU Target" value={selectedGpu.model} />
        <PdfMetric label="Breakeven Day" value={Number.isFinite(metrics.breakevenDay) ? `${Math.ceil(metrics.breakevenDay)} days` : "N/A"} />
        <PdfMetric label="Ownership Total Cost" value={currency(metrics.ownerTco)} />
      </div>
      <div className={reportTier === 1 ? "mt-5 grid grid-cols-1 gap-5" : "mt-5 grid grid-cols-2 gap-5"}>
        <div>
          <h3 className="text-lg font-bold text-slate-950">Infrastructure Breakeven Analysis</h3>
          <table className="mt-2 w-full border-collapse text-left text-xs">
            <tbody>
              <PdfRow label="Purchase price" value={currency(purchasePrice)} />
              <PdfRow label="Hourly rental rate" value={`${currency(hourlyRate)} / hr (${pricingMode})`} />
              <PdfRow label="Monthly rental equivalent" value={currency(metrics.monthlyRental)} />
              <PdfRow label="Electricity/cooling buffer" value={currency(metrics.ownerTco - purchasePrice)} />
              <PdfRow label="Term rental cost" value={currency(metrics.termRental)} />
            </tbody>
          </table>
        </div>
        {reportTier === 2 ? (
          <div>
            <h3 className="text-lg font-bold text-slate-950">API vs Self-Hosted Comparison</h3>
            <table className="mt-2 w-full border-collapse text-left text-xs">
              <tbody>
                <PdfRow label="API model" value={selectedApi.model} />
                <PdfRow label="Reasoning overhead" value={metrics.hiddenTokenOverhead > 0 ? "20% output-token overhead applied" : "None"} />
                <PdfRow label="Daily requests" value={number(dailyRequests)} />
                <PdfRow label="Monthly API burn" value={currency(metrics.monthlyApi)} />
                <PdfRow label="Project API cost" value={currency(metrics.termApi)} />
                <PdfRow label="Monthly token volume" value={number(metrics.tokenVolume)} />
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <div className="mt-5">
        <h3 className="text-lg font-bold text-slate-950">{reportTier === 1 ? "Infrastructure Source Metadata" : "Source Model Metadata"}</h3>
        <div className={reportTier === 1 ? "mt-2 grid grid-cols-1 gap-4" : "mt-2 grid grid-cols-2 gap-5"}>
          <table className="w-full border-collapse text-left text-xs">
            <tbody>
              <PdfRow label="GPU category" value={selectedGpu.category} />
              <PdfRow label="GPU VRAM" value={`${selectedGpu.vram_gb} GB`} />
              <PdfRow label="Hardware cost basis" value={currency(selectedGpu.hardware_cost)} />
              <PdfRow label="On-demand rental" value={`${currency(selectedGpu.rent_on_demand)} / hr`} />
              <PdfRow label="Spot rental" value={`${currency(selectedGpu.rent_spot)} / hr`} />
            </tbody>
          </table>
          {reportTier === 2 ? (
            <table className="w-full border-collapse text-left text-xs">
              <tbody>
                <PdfRow label="API provider" value={selectedApi.provider} />
                <PdfRow label="API tier" value={selectedApi.tier} />
                <PdfRow label="Input price" value={`${currency(selectedApi.input)} / 1M tokens`} />
                <PdfRow label="Output price" value={`${currency(selectedApi.output)} / 1M tokens`} />
                <PdfRow label="Prompt cache assumption" value="50% input-token discount" />
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
      {reportTier === 2 ? (
        <div className="mt-5 rounded-lg bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Scalability Verdict</p>
          <p className="mt-2 text-base font-semibold leading-tight">{metrics.verdict}</p>
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Executive Infrastructure Summary</p>
          <p className="mt-2 text-base font-semibold leading-tight">
            Ownership reaches breakeven after {Number.isFinite(metrics.breakevenDay) ? `${Math.ceil(metrics.breakevenDay)} days` : "an undefined period"} at the selected utilization and rental mode.
          </p>
        </div>
      )}
      <div className="mt-5 flex justify-between border-t border-slate-200 pt-3 text-xs font-semibold text-slate-500">
        <span>Pricing data version: {marketData.version}</span>
        <span>Last updated: {marketData.last_updated}</span>
      </div>
    </div>
  );
};

function PdfMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function PdfRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-slate-200">
      <th className="py-1.5 pr-3 font-semibold text-slate-600">{label}</th>
      <td className="py-1.5 font-bold text-slate-950">{value}</td>
    </tr>
  );
}
