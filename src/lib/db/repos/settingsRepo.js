import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const DEFAULT_MITM_ROUTER_BASE = "http://localhost:20128";

const DEFAULT_LANDING_PRICING_PLANS = [
  {
    name: "100K Tokens",
    price: "$19",
    period: "/pack",
    description: "Starter token package for testing and small apps.",
    badge: "",
    highlighted: false,
    cta: "Buy tokens",
    features: ["100K AI tokens", "API key included", "Usage check page", "Basic support"],
  },
  {
    name: "1M Tokens",
    price: "$59",
    period: "/pack",
    description: "Best value for teams and customer-facing apps.",
    badge: "Popular",
    highlighted: true,
    cta: "Buy package",
    features: ["1M AI tokens", "Customer API key", "Live quota page", "Priority support"],
  },
  {
    name: "Custom Supply",
    price: "Custom",
    period: "",
    description: "Bulk token supply for agencies, SaaS, and resellers.",
    badge: "Enterprise",
    highlighted: false,
    cta: "Request quote",
    features: ["Bulk token volume", "Custom quota rules", "Dedicated integration", "SLA options"],
  },
];

const DEFAULT_SETTINGS = {
  cloudEnabled: false,
  tunnelEnabled: false,
  tunnelUrl: "",
  tunnelProvider: "cloudflare",
  tailscaleEnabled: false,
  tailscaleUrl: "",
  stickyRoundRobinLimit: 3,
  providerStrategies: {},
  comboStrategy: "fallback",
  comboStickyRoundRobinLimit: 1,
  comboStrategies: {},
  requireLogin: true,
  tunnelDashboardAccess: true,
  authMode: "password",
  oidcIssuerUrl: "",
  oidcClientId: "",
  oidcClientSecret: "",
  oidcScopes: "openid profile email",
  oidcLoginLabel: "Sign in with OIDC",
  enableObservability: true,
  observabilityMaxRecords: 1000,
  observabilityBatchSize: 20,
  observabilityFlushIntervalMs: 5000,
  observabilityMaxJsonSize: 5,
  outboundProxyEnabled: false,
  outboundProxyUrl: "",
  outboundNoProxy: "",
  mitmRouterBaseUrl: DEFAULT_MITM_ROUTER_BASE,
  dnsToolEnabled: {},
  rtkEnabled: true,
  cavemanEnabled: false,
  cavemanLevel: "full",
  landingContactName: "",
  landingContactEmail: "",
  landingContactPhone: "",
  landingContactZalo: "",
  landingContactTelegram: "",
  landingContactUrl: "",
  landingContactCtaLabel: "Contact sales",
  landingPricingPlans: DEFAULT_LANDING_PRICING_PLANS,
  paymentBankEnabled: false,
  paymentBankCode: "",
  paymentBankAccountNumber: "",
  paymentBankAccountName: "",
  paymentBankNotePrefix: "9ROUTER",
};

async function readRaw() {
  const db = await getAdapter();
  const row = db.get(`SELECT data FROM settings WHERE id = 1`);
  return row ? parseJson(row.data, {}) : {};
}

// Merge raw settings with defaults; backward-compat for missing keys
function mergeWithDefaults(raw) {
  const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  for (const [key, defVal] of Object.entries(DEFAULT_SETTINGS)) {
    if (merged[key] === undefined) {
      if (
        key === "outboundProxyEnabled" &&
        typeof merged.outboundProxyUrl === "string" &&
        merged.outboundProxyUrl.trim()
      ) {
        merged[key] = true;
      } else {
        merged[key] = defVal;
      }
    }
  }
  return merged;
}

export async function getSettings() {
  const raw = await readRaw();
  return mergeWithDefaults(raw);
}

// Atomic read-merge-write inside transaction (prevents losing concurrent updates)
export async function updateSettings(updates) {
  const db = await getAdapter();
  let next;
  db.transaction(() => {
    const row = db.get(`SELECT data FROM settings WHERE id = 1`);
    const current = row ? parseJson(row.data, {}) : {};
    next = { ...current, ...updates };
    db.run(
      `INSERT INTO settings(id, data) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      [stringifyJson(next)]
    );
  });
  return mergeWithDefaults(next);
}

export async function isCloudEnabled() {
  const settings = await getSettings();
  return settings.cloudEnabled === true;
}

export async function getCloudUrl() {
  const settings = await getSettings();
  return (
    settings.cloudUrl ||
    process.env.CLOUD_URL ||
    process.env.NEXT_PUBLIC_CLOUD_URL ||
    ""
  );
}

export async function exportSettings() {
  return await readRaw();
}
