"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { cn } from "@/shared/utils/cn";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CUSTOMER_API_KEY_STORAGE = "9router.customerApiKey";

function getStoredApiKey() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(CUSTOMER_API_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

function saveStoredApiKey(apiKey) {
  if (typeof window === "undefined" || !apiKey) return;
  try {
    window.localStorage.setItem(CUSTOMER_API_KEY_STORAGE, apiKey);
  } catch {
    // localStorage can be disabled in private or locked-down browsers.
  }
}

function clearStoredApiKey() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CUSTOMER_API_KEY_STORAGE);
  } catch {
    // Ignore storage failures; the page can still work from the link key.
  }
}

function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

function formatDaysUntil(value) {
  if (!value) return { value: "∞", label: "No expiry" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { value: "?", label: "Invalid expiry" };
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return { value: "0", label: "Expired" };
  const days = Math.ceil(diffMs / 86400000);
  return { value: days.toLocaleString(), label: days === 1 ? "day left" : "days left" };
}

function getDaysRemaining(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
}

function getMsRemaining(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, date.getTime() - Date.now());
}

function formatHoursRemaining(ms) {
  if (ms == null) return "Manual";
  if (ms <= 0) return "0h";
  if (ms < 3600000) return "<1h";
  return `${Math.ceil(ms / 3600000).toLocaleString()}h`;
}

function statusMeta(status) {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-green-500/10 text-green-600 border-green-500/20", icon: "check_circle" };
    case "inactive":
      return { label: "Paused", className: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: "pause_circle" };
    case "expired":
      return { label: "Expired", className: "bg-red-500/10 text-red-600 border-red-500/20", icon: "error" };
    case "quota_exceeded":
      return { label: "Quota exceeded", className: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: "warning" };
    default:
      return { label: "Not found", className: "bg-slate-500/10 text-slate-600 border-slate-500/20", icon: "help" };
  }
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border-subtle py-3 text-sm last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <div className="text-text-muted">{label}</div>
      <div className="min-w-0 overflow-wrap-anywhere font-medium text-text-main">{value}</div>
    </div>
  );
}

function StatCard({ icon, label, value, hint, tone = "default" }) {
  const toneClass = {
    default: "bg-brand-500/10 text-brand-500",
    cost: "bg-green-500/10 text-green-600",
    warning: "bg-amber-500/10 text-amber-600",
    muted: "bg-surface-2 text-text-muted",
  }[tone];

  return (
    <div className="min-w-0 rounded-[12px] border border-border-subtle bg-bg p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-[10px]", toneClass)}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase text-text-muted">{label}</div>
          <div className="mt-1 overflow-wrap-anywhere text-xl font-semibold leading-snug text-text-main">{value}</div>
          {hint ? <div className="mt-1 overflow-wrap-anywhere text-xs leading-relaxed text-text-muted">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

function DonutMetric({ icon, label, value, subvalue, hint, percent, tone = "default" }) {
  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safePercent / 100) * circumference;
  const strokeClass = {
    default: "text-brand-500",
    success: "text-green-500",
    warning: "text-amber-500",
    danger: "text-red-500",
  }[tone];

  return (
    <div className="min-w-0 rounded-[12px] border border-border-subtle bg-bg p-4">
      <div className="flex min-w-0 flex-col items-center text-center">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-main">
          <span className="material-symbols-outlined text-[18px] text-text-muted">{icon}</span>
          {label}
        </div>
        <div className="relative flex size-36 shrink-0 items-center justify-center">
          <svg viewBox="0 0 140 140" className="-rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-surface-3" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={strokeClass}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="max-w-[96px] overflow-wrap-anywhere text-2xl font-semibold leading-tight text-text-main">{value}</span>
            {subvalue ? <span className="mt-1 max-w-[92px] overflow-wrap-anywhere text-xs font-medium leading-tight text-text-muted">{subvalue}</span> : null}
          </div>
        </div>
        {hint ? <div className="mt-3 min-h-8 overflow-wrap-anywhere text-xs leading-relaxed text-text-muted">{hint}</div> : null}
      </div>
    </div>
  );
}

function UsageOverview({ result, quotaPercent, totalTokens, tokenLimit, remainingTokens, promptTokens, completionTokens, requestCount }) {
  const remainingTone = tokenLimit > 0 && Number(remainingTokens || 0) <= tokenLimit * 0.2 ? "warning" : "default";

  return (
    <Card padding="sm" elev className="min-w-0 overflow-hidden sm:p-6">
      <div className="mb-5 flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-500/10 text-brand-500">
          <span className="material-symbols-outlined text-[20px]">query_stats</span>
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-text-main">Usage breakdown</h3>
          <p className="mt-1 text-sm text-text-muted">Current cycle token, cost, and request details.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon="payments"
          label="Cost this cycle"
          value={currencyFormatter.format(Number(result?.usage?.cost || 0))}
          hint={tokenLimit > 0 ? `${quotaPercent ?? 0}% quota used` : "Current cycle"}
          tone="cost"
        />
        <StatCard
          icon="speed"
          label="Tokens left"
          value={tokenLimit > 0 && remainingTokens != null ? Number(remainingTokens).toLocaleString() : "Unlimited"}
          hint={tokenLimit > 0 ? `Limit ${tokenLimit.toLocaleString()}` : "No fixed limit"}
          tone={remainingTone}
        />
        <StatCard
          icon="query_stats"
          label="Tokens spent"
          value={totalTokens.toLocaleString()}
          hint={tokenLimit > 0 ? `of ${tokenLimit.toLocaleString()}` : "No fixed limit"}
        />
        <StatCard
          icon="login"
          label="Input tokens"
          value={promptTokens.toLocaleString()}
          hint="Prompt usage"
        />
        <StatCard
          icon="logout"
          label="Output tokens"
          value={completionTokens.toLocaleString()}
          hint="Completion usage"
        />
        <StatCard
          icon="manage_history"
          label="Requests made"
          value={requestCount.toLocaleString()}
          hint="This cycle"
          tone="muted"
        />
      </div>
    </Card>
  );
}

function KeySummaryCard({ keyName, message, meta, loadedFromStorage, isActive, quotaPercent, tokenLimit, totalTokens, remainingTokens, daysLeft, expiresAtValue, expiresAt, resetHours, resetAt }) {
  const safeQuotaPercent = tokenLimit > 0 ? Math.min(100, Math.max(0, Number(quotaPercent) || 0)) : 0;
  const daysRemaining = getDaysRemaining(expiresAt);
  const cycleDays = 30;
  const cyclePercent = daysRemaining == null ? 0 : Math.min(100, Math.max(0, Math.round(((cycleDays - Math.min(cycleDays, daysRemaining)) / cycleDays) * 100)));
  const cycleTone = daysRemaining != null && daysRemaining <= 3 ? "danger" : daysRemaining != null && daysRemaining <= 7 ? "warning" : "success";
  const quotaTone = safeQuotaPercent >= 100 ? "danger" : safeQuotaPercent >= 80 ? "warning" : "default";
  const quotaRemainingPercent = tokenLimit > 0 ? Math.max(0, 100 - safeQuotaPercent) : 100;
  const remainingLabel = tokenLimit > 0 && remainingTokens != null ? Number(remainingTokens).toLocaleString() : "Unlimited";
  const resetRemainingMs = getMsRemaining(resetAt);
  const resetCycleMs = resetHours > 0 ? resetHours * 3600000 : 0;
  const resetPercent = resetCycleMs > 0 && resetRemainingMs != null
    ? Math.min(100, Math.max(0, Math.round((resetRemainingMs / resetCycleMs) * 100)))
    : 0;
  const resetTone = resetPercent <= 10 ? "danger" : resetPercent <= 25 ? "warning" : "success";

  return (
    <Card padding="sm" elev className="min-w-0 overflow-hidden sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="overflow-wrap-anywhere text-2xl font-semibold leading-tight text-text-main">{keyName}</h2>
            <p className="mt-2 overflow-wrap-anywhere text-sm leading-relaxed text-text-muted">{message}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium", meta.className)}>
              <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
              {meta.label}
            </span>
            {loadedFromStorage ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-sm text-text-muted">
                <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                Saved in browser
              </span>
            ) : null}
            {isActive === false ? (
              <span className="rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-sm text-text-muted">
                Disabled
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <DonutMetric
            icon="restart_alt"
            label="Next reset"
            value={formatHoursRemaining(resetRemainingMs)}
            subvalue={resetHours > 0 ? "left" : ""}
            hint={resetAt && resetHours > 0 ? `of ${resetHours}h cycle, resets ${formatDateTime(resetAt)}` : "No automatic reset"}
            percent={resetHours > 0 ? resetPercent : 0}
            tone={resetTone}
          />
          <DonutMetric
            icon="speed"
            label="Quota remaining"
            value={tokenLimit > 0 ? `${quotaRemainingPercent}%` : "Unlimited"}
            subvalue={tokenLimit > 0 ? "left" : ""}
            hint={tokenLimit > 0 ? `${remainingLabel} tokens left of ${tokenLimit.toLocaleString()}` : "No fixed token limit"}
            percent={tokenLimit > 0 ? quotaRemainingPercent : 100}
            tone={quotaTone}
          />
          <DonutMetric
            icon="event_available"
            label="Time remaining"
            value={String(daysLeft.value)}
            subvalue={daysLeft.label}
            hint={`30-day cycle, expires ${expiresAtValue}`}
            percent={cyclePercent}
            tone={cycleTone}
          />
        </div>
      </div>
    </Card>
  );
}

function buildCliSetup(apiKey, baseUrl, model) {
  const codexConfig = `model = "${model}"
model_provider = "9router"

[model_providers.9router]
name = "LakeToken"
base_url = "${baseUrl}"
wire_api = "responses"
`;

  const claudeSettings = JSON.stringify({
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      API_TIMEOUT_MS: "600000",
      ANTHROPIC_MODEL: model,
    },
  }, null, 2);

  return [
    {
      id: "openai",
      icon: "terminal",
      title: "OpenAI env",
      subtitle: "For OpenAI SDKs, shell-based CLIs, Cline, Roo, and similar clients",
      display: `export OPENAI_BASE_URL="${baseUrl}"
export OPENAI_API_KEY="<hidden>"
export OPENAI_MODEL="${model}"`,
      copy: `export OPENAI_BASE_URL="${baseUrl}"
export OPENAI_API_KEY="${apiKey}"
export OPENAI_MODEL="${model}"`,
    },
    {
      id: "claude",
      icon: "code_blocks",
      title: "Claude Code",
      subtitle: "Save to ~/.claude/settings.json",
      display: JSON.stringify({
        env: {
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_AUTH_TOKEN: "<hidden>",
          API_TIMEOUT_MS: "600000",
          ANTHROPIC_MODEL: model,
        },
      }, null, 2),
      copy: claudeSettings,
    },
    {
      id: "codex",
      icon: "data_object",
      title: "Codex CLI",
      subtitle: "Use config.toml plus auth.json",
      display: `${codexConfig}
# ~/.codex/auth.json
{ "auth_mode": "apikey", "OPENAI_API_KEY": "<hidden>" }`,
      copy: `${codexConfig}
# ~/.codex/auth.json
${JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: apiKey }, null, 2)}`,
    },
    {
      id: "cline-roo",
      icon: "extension",
      title: "Cline / Roo",
      subtitle: "Choose OpenAI Compatible provider in the extension settings",
      display: `Provider: OpenAI Compatible
Base URL: ${baseUrl}
API Key: <hidden>
Model ID: ${model}`,
      copy: `Provider: OpenAI Compatible
Base URL: ${baseUrl}
API Key: ${apiKey}
Model ID: ${model}`,
    },
    {
      id: "continue",
      icon: "integration_instructions",
      title: "Continue",
      subtitle: "Add to Continue config as an OpenAI-compatible model",
      display: JSON.stringify({
        models: [{
          title: "LakeToken",
          provider: "openai",
          model,
          apiBase: baseUrl,
          apiKey: "<hidden>",
        }],
      }, null, 2),
      copy: JSON.stringify({
        models: [{
          title: "LakeToken",
          provider: "openai",
          model,
          apiBase: baseUrl,
          apiKey,
        }],
      }, null, 2),
    },
  ];
}

function CliSetupCard({ apiKey, baseUrl, model }) {
  const { copied, copy } = useCopyToClipboard();
  const items = useMemo(() => buildCliSetup(apiKey, baseUrl, model), [apiKey, baseUrl, model]);

  return (
    <Card padding="sm" elev className="min-w-0 overflow-hidden sm:p-6 lg:sticky lg:top-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
            <span className="material-symbols-outlined text-[20px]">integration_instructions</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-text-main">CLI setup</h3>
            <p className="mt-1 text-sm text-text-muted">
              Copy a ready-to-use config. The real key is included only in copied values and stays hidden on screen.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => (
          <div key={item.id} className="min-w-0 overflow-hidden rounded-[12px] border border-border-subtle bg-bg">
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-main">{item.title}</div>
                  <div className="mt-0.5 overflow-wrap-anywhere text-xs leading-relaxed text-text-muted">{item.subtitle}</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={copied === item.id ? "check" : "content_copy"}
                onClick={() => copy(item.copy, item.id)}
                className="size-9 shrink-0 rounded-full px-0"
                title={copied === item.id ? "Copied" : "Copy config"}
              >
                <span className="sr-only">{copied === item.id ? "Copied" : "Copy"}</span>
              </Button>
            </div>
            <pre className="max-h-44 max-w-full overflow-auto p-3 text-xs leading-relaxed">
              <code className="whitespace-pre-wrap break-words text-text-main">{item.display}</code>
            </pre>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function ApiKeyCheckClient() {
  const [apiKey, setApiKey] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);

  const meta = useMemo(() => statusMeta(result?.status), [result?.status]);

  const checkApiKey = useCallback(async (rawValue, options = {}) => {
    const value = String(rawValue || "").trim();
    if (!value) {
      setError("Paste an API key first.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/public/api-key/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to inspect key");
      }
      setResult(data);
      if (data?.status && data.status !== "not_found") {
        saveStoredApiKey(value);
      } else if (options.fromStorage) {
        clearStoredApiKey();
      }
    } catch (err) {
      setResult(null);
      setError(err?.message || "Failed to inspect key");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const keyFromUrl = new URLSearchParams(window.location.search).get("key");
    const storedKey = getStoredApiKey();
    const keyToUse = keyFromUrl || storedKey;
    queueMicrotask(() => {
      setApiKey(keyToUse || "");
      setLoadedFromStorage(!keyFromUrl && !!storedKey);
      setUrlReady(true);
      if (keyToUse) {
        checkApiKey(keyToUse, { fromStorage: !keyFromUrl && !!storedKey });
      }
      if (keyFromUrl) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    });
  }, [checkApiKey]);

  const forgetSavedKey = useCallback(() => {
    clearStoredApiKey();
    setApiKey("");
    setResult(null);
    setError("");
    setLoadedFromStorage(false);
  }, []);

  const keyName = result?.status === "not_found" ? "Key not found" : result?.key?.name || "Unnamed key";
  const totalTokens = Number(result?.usage?.totalTokens || 0);
  const tokenLimit = Number(result?.usage?.tokenLimit || 0);
  const remainingTokens = result?.usage?.remainingTokens;
  const quotaPercent = result?.usage?.quotaPercent;
  const resetAt = result?.cycle?.resetAt;
  const resetHours = Number(result?.cycle?.resetHours || 0);
  const expiresAtValue = result?.status === "not_found" ? "N/A" : formatDateTime(result?.expiresAt);
  const daysLeft = useMemo(() => {
    if (result?.status === "not_found") return { value: "N/A", label: "Not available" };
    return formatDaysUntil(result?.expiresAt);
  }, [result?.expiresAt, result?.status]);
  const promptTokens = Number(result?.usage?.promptTokens || 0);
  const completionTokens = Number(result?.usage?.completionTokens || 0);
  const requestCount = Number(result?.usage?.requestCount || 0);
  const lifetimeRequestCount = Number(result?.usage?.lifetimeRequestCount || 0);
  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "http://localhost:20128/v1";
    return `${window.location.origin.replace(/\/+$/, "")}/v1`;
  }, []);
  const configModel = result?.suggestedModel || "provider/model-id";

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-500/10 text-brand-500">
              <span className="material-symbols-outlined text-[22px]">vpn_key</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-text-main sm:text-3xl">API key status</h1>
              <p className="mt-1 max-w-2xl text-sm text-text-muted">Balance, expiry, usage, and setup values for this key.</p>
            </div>
          </div>
          {loadedFromStorage && apiKey ? (
            <Button variant="secondary" icon="logout" onClick={forgetSavedKey} className="w-full sm:w-auto">
              Forget saved key
            </Button>
          ) : null}
        </div>

        {!urlReady ? (
          <Card padding="sm" elev className="sm:p-6 lg:p-8">
            <div className="flex items-center gap-3 text-text-muted">
              <span className="material-symbols-outlined animate-spin text-brand-500">progress_activity</span>
              Loading customer link...
            </div>
          </Card>
        ) : null}

        {urlReady && !apiKey ? (
          <Card padding="sm" elev className="sm:p-6 lg:p-8">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-amber-500/10 text-amber-600">
                <span className="material-symbols-outlined">link_off</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text-main">No saved API key</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Open the customer check link once. This browser will remember the key for later checks.
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {loading ? (
          <Card padding="sm" elev className="sm:p-6 lg:p-8">
            <div className="flex items-center gap-3 text-text-muted">
              <span className="material-symbols-outlined animate-spin text-brand-500">progress_activity</span>
                  Updating key status...
            </div>
          </Card>
        ) : null}

        {error ? (
          <Card padding="sm" elev className="sm:p-6 lg:p-8">
            <div className="flex min-w-0 items-center gap-3 text-red-500">
              <span className="material-symbols-outlined">error</span>
              <span className="min-w-0 overflow-wrap-anywhere">{error}</span>
            </div>
          </Card>
        ) : null}

        {result ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <KeySummaryCard
                keyName={keyName}
                message={result?.message}
                meta={meta}
                loadedFromStorage={loadedFromStorage}
                isActive={result?.key?.isActive}
                quotaPercent={quotaPercent}
                tokenLimit={tokenLimit}
                totalTokens={totalTokens}
                remainingTokens={remainingTokens}
                daysLeft={daysLeft}
                expiresAtValue={expiresAtValue}
                expiresAt={result?.expiresAt}
                resetHours={resetHours}
                resetAt={resetAt}
              />

              {result?.status !== "not_found" ? (
                <>
                  <UsageOverview
                    result={result}
                    quotaPercent={quotaPercent}
                    totalTokens={totalTokens}
                    tokenLimit={tokenLimit}
                    remainingTokens={remainingTokens}
                    promptTokens={promptTokens}
                    completionTokens={completionTokens}
                    requestCount={requestCount}
                  />

                  <Card padding="sm" elev className="sm:p-6 lg:p-8">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-bg text-text-muted">
                        <span className="material-symbols-outlined">list_alt</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-main">Account details</h3>
                      </div>
                    </div>
                    <div className="rounded-[8px] border border-border-subtle bg-bg px-4">
                      <DetailRow label="Status" value={meta.label} />
                      <DetailRow label="Quota limit" value={tokenLimit > 0 ? tokenLimit.toLocaleString() : "Unlimited"} />
                      <DetailRow label="Quota used" value={totalTokens.toLocaleString()} />
                      <DetailRow label="Quota remaining" value={tokenLimit > 0 && remainingTokens != null ? Number(remainingTokens).toLocaleString() : "Unlimited"} />
                      <DetailRow label="Requests this cycle" value={requestCount.toLocaleString()} />
                      <DetailRow label="All-time requests" value={lifetimeRequestCount.toLocaleString()} />
                      <DetailRow label="Reset cycle" value={resetHours > 0 ? `${resetHours} hour${resetHours === 1 ? "" : "s"}` : "Manual"} />
                      <DetailRow label="Current cycle started" value={formatDateTime(result?.key?.cycleStartedAt)} />
                      <DetailRow label="Next reset" value={resetAt ? formatDateTime(resetAt) : "Manual"} />
                      <DetailRow label="Last used" value={formatDateTime(result?.usage?.lastUsedAt)} />
                      <DetailRow label="Expires at" value={expiresAtValue} />
                    </div>
                  </Card>
                </>
              ) : null}
            </div>

            {result?.status !== "not_found" ? (
              <aside className="min-w-0">
                <CliSetupCard apiKey={apiKey} baseUrl={baseUrl} model={configModel} />
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
