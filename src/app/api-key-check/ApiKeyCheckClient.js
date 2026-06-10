"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Button from "@/shared/components/Button";
import Card from "@/shared/components/Card";
import Modal from "@/shared/components/Modal";
import Select from "@/shared/components/Select";
import { cn } from "@/shared/utils/cn";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CUSTOMER_API_KEY_STORAGE = "laketoken.customerApiKey";

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

function ModelSelectionControl({ combo, onSelect, saving }) {
  if (!combo?.name || !Array.isArray(combo.models) || combo.models.length === 0) return null;

  return (
    <Select
      value={combo.selectedModel || ""}
      onChange={(e) => onSelect(e.target.value)}
      placeholder="Select model"
      options={combo.models.map((model) => ({ value: model, label: model }))}
      disabled={saving}
      className="mt-2 gap-1"
      selectClassName="h-10 rounded-[8px] py-2 pl-3 pr-8 text-sm"
    />
  );
}

function MetricTile({ icon, label, value, hint, children }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-border-subtle bg-bg px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="material-symbols-outlined shrink-0 text-[21px] text-text-muted">{icon}</span>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase text-text-muted">{label}</div>
          <div className="mt-0.5 overflow-wrap-anywhere text-sm font-semibold leading-snug text-text-main">{value}</div>
          {hint ? <div className="mt-0.5 overflow-wrap-anywhere text-xs text-text-muted">{hint}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function CircleMetric({ label, value, subvalue, percent, size = "lg", tone = "brand" }) {
  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safePercent / 100) * circumference;
  const toneClass = {
    brand: "text-brand-500",
    success: "text-green-500",
    warning: "text-amber-500",
    danger: "text-red-500",
  }[tone];
  const boxClass = size === "lg" ? "size-56" : "size-32";
  const valueClass = size === "lg" ? "text-4xl sm:text-5xl" : "text-xl";

  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", boxClass)}>
      <svg viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-bg" />
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
          className={toneClass}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <div className="text-[11px] font-semibold uppercase text-text-muted">{label}</div>
        <div className={cn("mt-1 max-w-full overflow-wrap-anywhere font-semibold leading-none text-text-main", valueClass)}>{value}</div>
        {subvalue ? <div className="mt-2 max-w-full overflow-wrap-anywhere text-xs leading-snug text-text-muted">{subvalue}</div> : null}
      </div>
    </div>
  );
}

function IpadStatusView({
  keyName,
  message,
  meta,
  loadedFromStorage,
  isActive,
  tokenLimit,
  totalTokens,
  remainingTokens,
  purchasedRemaining,
  purchasedTokenLimit,
  usedPurchasedTokens,
  daysLeft,
  expiresAtValue,
  resetHours,
  resetAt,
  combo,
  modelSaving,
  onSelectModel,
  onShowDetails,
  onShowCliGuide,
  onShowBuyTokens,
}) {
  const baseRemaining = tokenLimit > 0 && remainingTokens != null ? Number(remainingTokens) : null;
  const extraRemaining = Number(purchasedRemaining || 0);
  const totalCapacity = tokenLimit > 0 ? tokenLimit + Number(purchasedTokenLimit || 0) : 0;
  const totalUsed = Number(totalTokens || 0) + Number(usedPurchasedTokens || 0);
  const totalRemaining = tokenLimit > 0 && baseRemaining != null ? baseRemaining + extraRemaining : null;
  const baseUsedPercent = tokenLimit > 0 ? Math.min(100, Math.max(0, Math.round((Number(totalTokens || 0) / tokenLimit) * 100))) : 0;
  const extraUsedPercent = Number(purchasedTokenLimit || 0) > 0
    ? Math.min(100, Math.max(0, Math.round((Number(usedPurchasedTokens || 0) / Number(purchasedTokenLimit || 0)) * 100)))
    : 0;
  const quotaPercent = totalCapacity > 0 ? Math.min(100, Math.max(0, Math.round((totalUsed / totalCapacity) * 100))) : 0;
  const quotaRemainingPercent = totalCapacity > 0 ? Math.max(0, 100 - quotaPercent) : 100;
  const remainingLabel = totalRemaining != null ? Number(totalRemaining).toLocaleString() : "Unlimited";
  const safeQuotaPercent = totalCapacity > 0 ? Math.min(100, Math.max(0, Number(quotaPercent) || 0)) : 0;
  const resetRemainingMs = getMsRemaining(resetAt);
  const resetCycleMs = resetHours > 0 ? resetHours * 3600000 : 0;
  const resetRemainingPercent = resetCycleMs > 0 && resetRemainingMs != null
    ? Math.min(100, Math.max(0, Math.round((resetRemainingMs / resetCycleMs) * 100)))
    : 0;
  const resetTone = resetRemainingPercent <= 10 ? "danger" : resetRemainingPercent <= 25 ? "warning" : "success";
  const daysNumber = Number(String(daysLeft.value).replace(/,/g, ""));
  const expiryRemainingPercent = Number.isFinite(daysNumber)
    ? Math.min(100, Math.max(0, Math.round((Math.min(daysNumber, 30) / 30) * 100)))
    : 100;
  const expiryTone = Number.isFinite(daysNumber) && daysNumber <= 3 ? "danger" : Number.isFinite(daysNumber) && daysNumber <= 7 ? "warning" : "success";
  const quotaTone = safeQuotaPercent >= 100 ? "danger" : safeQuotaPercent >= 80 ? "warning" : "brand";

  return (
    <section className="mx-auto w-full max-w-[860px] rounded-[34px] border border-black/10 bg-neutral-900 p-2.5 shadow-2xl shadow-black/20 dark:border-white/10">
      <div className="min-h-[640px] overflow-hidden rounded-[26px] border border-border-subtle bg-bg">
        <div className="flex min-h-[640px] flex-col p-5 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", meta.className)}>
                  <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
                  {meta.label}
                </span>
                {loadedFromStorage ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
                    <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                    Saved
                  </span>
                ) : null}
                {isActive === false ? (
                  <span className="rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
                    Disabled
                  </span>
                ) : null}
              </div>
              <h1 className="overflow-wrap-anywhere text-2xl font-semibold leading-tight text-text-main sm:text-3xl">{keyName}</h1>
              <p className="mt-1 max-w-xl overflow-wrap-anywhere text-sm text-text-muted">{message}</p>
            </div>
            <div className="hidden size-3 shrink-0 rounded-full bg-neutral-700 sm:block" aria-hidden="true" />
          </div>

          <div className="rounded-[22px] border border-border-subtle bg-surface-2 p-5 sm:p-6">
            <div className="flex flex-col items-center gap-5 md:flex-row md:justify-between">
              <CircleMetric
                label="Quota left"
                value={totalCapacity > 0 ? `${quotaRemainingPercent}%` : "∞"}
                subvalue={totalCapacity > 0 ? `${remainingLabel} tokens` : "Unlimited capacity"}
                percent={quotaRemainingPercent}
                tone={quotaTone}
              />
              <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] border border-border-subtle bg-bg px-4 py-3">
                  <div className="text-xs font-medium uppercase text-text-muted">Quota gói</div>
                  <div className="mt-1 overflow-wrap-anywhere text-2xl font-semibold text-text-main">
                    {tokenLimit > 0 && baseRemaining != null ? baseRemaining.toLocaleString() : "Unlimited"}
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    {tokenLimit > 0 ? `${Number(totalTokens || 0).toLocaleString()} used / ${tokenLimit.toLocaleString()} tokens` : "No fixed package quota"}
                  </div>
                  {tokenLimit > 0 ? (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className={cn("h-full rounded-full", baseUsedPercent >= 100 ? "bg-red-500" : baseUsedPercent >= 80 ? "bg-amber-500" : "bg-brand-500")} style={{ width: `${baseUsedPercent}%` }} />
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[16px] border border-border-subtle bg-bg px-4 py-3">
                  <div className="text-xs font-medium uppercase text-text-muted">Quota mua thêm</div>
                  <div className="mt-1 overflow-wrap-anywhere text-2xl font-semibold text-text-main">{extraRemaining.toLocaleString()}</div>
                  <div className="mt-1 text-xs text-text-muted">
                    {Number(purchasedTokenLimit || 0) > 0
                      ? `${Number(usedPurchasedTokens || 0).toLocaleString()} used / ${Number(purchasedTokenLimit || 0).toLocaleString()} tokens`
                      : "No purchased quota yet"}
                  </div>
                  {Number(purchasedTokenLimit || 0) > 0 ? (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className={cn("h-full rounded-full", extraUsedPercent >= 100 ? "bg-red-500" : extraUsedPercent >= 80 ? "bg-amber-500" : "bg-green-500")} style={{ width: `${extraUsedPercent}%` }} />
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[16px] border border-border-subtle bg-bg px-4 py-3 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase text-text-muted">
                    <span>Tổng quota khả dụng</span>
                    <span>{totalCapacity > 0 ? `${quotaRemainingPercent}% left` : "Unlimited"}</span>
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    {totalCapacity > 0 ? `${remainingLabel} còn lại / ${totalCapacity.toLocaleString()} tokens` : "Unlimited capacity"}
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={cn("h-full rounded-full", safeQuotaPercent >= 100 ? "bg-red-500" : safeQuotaPercent >= 80 ? "bg-amber-500" : "bg-brand-500")}
                      style={{ width: `${safeQuotaPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex min-w-0 items-center justify-center rounded-[14px] border border-border-subtle bg-bg p-3">
              <CircleMetric
                label="Reset"
                value={formatHoursRemaining(resetRemainingMs)}
                subvalue={resetAt && resetHours > 0 ? "left" : "Manual"}
                percent={resetHours > 0 ? resetRemainingPercent : 0}
                tone={resetTone}
                size="sm"
              />
            </div>
            <div className="flex min-w-0 items-center justify-center rounded-[14px] border border-border-subtle bg-bg p-3">
              <CircleMetric
                label="Expires"
                value={String(daysLeft.value)}
                subvalue={daysLeft.label === "No expiry" ? "No expiry" : daysLeft.label}
                percent={expiryRemainingPercent}
                tone={expiryTone}
                size="sm"
              />
            </div>
            <MetricTile icon="model_training" label="Active model" value={combo?.selectedModel || "Not selected"} hint={combo?.name || "No combo"}>
              <ModelSelectionControl combo={combo} onSelect={onSelectModel} saving={modelSaving} />
            </MetricTile>
          </div>

          <div className="mt-4 flex flex-1 flex-col justify-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
               <Button variant="secondary" icon="terminal" onClick={onShowCliGuide} className="w-full sm:w-auto">
                 CLI setup
               </Button>
               <Button variant="ghost" icon="list_alt" onClick={onShowDetails} className="w-full sm:w-auto">
                 Details
               </Button>
               <Button variant="secondary" icon="shopping_cart" onClick={onShowBuyTokens} className="w-full sm:w-auto">
                 Buy Tokens
               </Button>
              </div>
              <div className="text-center text-xs text-text-muted sm:text-right">
                API key is hidden on this device.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildCliGuideSnippets({ apiKey, baseUrl, model }) {
  const codexConfig = `model = "${model}"
model_provider = "laketoken"

[model_providers.laketoken]
name = "LakeToken"
base_url = "${baseUrl}"
wire_api = "responses"
`;

  const codexAuth = JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: apiKey }, null, 2);
  const claudeSettings = JSON.stringify({
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_MODEL: model,
      API_TIMEOUT_MS: "600000",
    },
  }, null, 2);

  return [
    {
      id: "openai_env",
      title: "OpenAI-compatible",
      filename: "Shell environment",
      content: [
        `export OPENAI_BASE_URL="${baseUrl}"`,
        `export OPENAI_API_KEY="${apiKey}"`,
        `export OPENAI_MODEL="${model}"`,
      ].join("\n"),
    },
    {
      id: "claude_code",
      title: "Claude Code",
      filename: "~/.claude/settings.json",
      content: claudeSettings,
    },
    {
      id: "codex_config",
      title: "Codex CLI config",
      filename: "~/.codex/config.toml",
      content: codexConfig,
    },
    {
      id: "codex_auth",
      title: "Codex CLI auth",
      filename: "~/.codex/auth.json",
      content: codexAuth,
    },
    {
      id: "cline_roo",
      title: "Cline / Roo",
      filename: "OpenAI Compatible provider",
      content: [
        "Provider: OpenAI Compatible",
        `Base URL: ${baseUrl}`,
        `API Key: ${apiKey}`,
        `Model ID: ${model}`,
      ].join("\n"),
    },
  ];
}

function CliGuideModal({ isOpen, onClose, snippets, copied, onCopy }) {
  return (
    <Modal isOpen={isOpen} title="CLI setup" onClose={onClose} size="full" className="max-w-5xl">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {snippets.map((item) => (
          <div key={item.id} className="min-w-0 overflow-hidden rounded-[12px] border border-border-subtle bg-bg">
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-main">{item.title}</div>
                <div className="mt-0.5 overflow-wrap-anywhere text-xs text-text-muted">{item.filename}</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={copied === item.id ? "check" : "content_copy"}
                onClick={() => onCopy(item.content, item.id)}
                className="shrink-0"
              >
                {copied === item.id ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-72 max-w-full overflow-auto p-3 text-xs leading-relaxed">
              <code className="whitespace-pre-wrap break-words text-text-main">{item.content}</code>
            </pre>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function ApiKeyCheckClient() {
  const [apiKey, setApiKey] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showCliGuide, setShowCliGuide] = useState(false);
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [tokenPackages, setTokenPackages] = useState([]);
  const [buyingPkgId, setBuyingPkgId] = useState(null);
  const [buyResult, setBuyResult] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [copied, setCopied] = useState(null);
  const copy = useCallback((text, id = "default") => {
    const write = async () => {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
    };
    write();
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

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

  const selectModel = useCallback(async (selectedModel) => {
    const value = String(apiKey || "").trim();
    if (!value || !selectedModel) return;

    setModelSaving(true);
    setError("");
    try {
      const res = await fetch("/api/public/api-key/selected-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value, selectedModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update selected model");
      setResult(data);
    } catch (err) {
      setError(err?.message || "Failed to update selected model");
    } finally {
      setModelSaving(false);
    }
  }, [apiKey]);

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
  const purchasedTokenLimit = Number(result?.usage?.purchasedTokenLimit || 0);
  const usedPurchasedTokens = Number(result?.usage?.usedPurchasedTokens || 0);
  const purchasedRemaining = Number(result?.usage?.purchasedRemaining || 0);
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
  const cliModel = result?.combo?.selectedModel || result?.suggestedModel || result?.combo?.name || "provider/model-id";
  const cliSnippets = useMemo(() => buildCliGuideSnippets({ apiKey, baseUrl, model: cliModel }), [apiKey, baseUrl, cliModel]);
  const loadTokenPackages = useCallback(async () => {
    try {
      const res = await fetch("/api/public/token-packages", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTokenPackages(data.packages || []);
      }
    } catch {}
  }, []);

  const handleBuyPackage = useCallback(async (pkg) => {
    const value = String(apiKey || "").trim();
    if (!value) return;
    setBuyingPkgId(pkg.id);
    setBuyResult(null);
    setPendingOrder(null);
    try {
      const res = await fetch("/api/public/token-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value, packageId: pkg.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Purchase failed");
      setPendingOrder({ order: data.order, payment: data.payment });
      setBuyResult({ success: true, message: data.message || "Order created. Pay by QR, then wait for admin confirmation." });
    } catch (err) {
      setBuyResult({ success: false, message: err?.message || "Purchase failed" });
    } finally {
      setBuyingPkgId(null);
    }
  }, [apiKey]);

  const openBuyTokens = useCallback(() => {
    setBuyResult(null);
    setPendingOrder(null);
    loadTokenPackages();
    setShowBuyTokens(true);
  }, [loadTokenPackages]);
  return (
    <main className="min-h-screen bg-surface-2">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[860px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="material-symbols-outlined text-[22px] text-brand-500">vpn_key</span>
            <h1 className="truncate text-base font-semibold text-text-main sm:text-lg">API key status</h1>
          </div>
          {loadedFromStorage && apiKey ? (
            <Button variant="ghost" icon="logout" onClick={forgetSavedKey} className="shrink-0">
              Forget
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

        {result?.status !== "not_found" ? (
          <IpadStatusView
            keyName={keyName}
            message={result?.message}
            meta={meta}
            loadedFromStorage={loadedFromStorage}
            isActive={result?.key?.isActive}
            tokenLimit={tokenLimit}
            totalTokens={totalTokens}
            remainingTokens={remainingTokens}
            purchasedRemaining={purchasedRemaining}
            purchasedTokenLimit={purchasedTokenLimit}
            usedPurchasedTokens={usedPurchasedTokens}
            daysLeft={daysLeft}
            expiresAtValue={expiresAtValue}
            resetHours={resetHours}
            resetAt={resetAt}
            combo={result?.combo}
            modelSaving={modelSaving}
            onSelectModel={selectModel}
            onShowDetails={() => setShowDetails(true)}
            onShowCliGuide={() => setShowCliGuide(true)}
            onShowBuyTokens={openBuyTokens}
          />
        ) : result ? (
          <Card padding="sm" elev className="mx-auto w-full max-w-[860px] sm:p-6 lg:p-8">
            <div className="flex min-w-0 items-center gap-3 text-text-muted">
              <span className="material-symbols-outlined">help</span>
              <span className="min-w-0 overflow-wrap-anywhere">{result?.message || "Key not found"}</span>
            </div>
          </Card>
        ) : null}

        <Modal isOpen={showDetails} title="Account details" onClose={() => setShowDetails(false)}>
          <div className="rounded-[8px] border border-border-subtle bg-bg px-4">
            <DetailRow label="Status" value={meta.label} />
            <DetailRow label="Package quota limit" value={tokenLimit > 0 ? tokenLimit.toLocaleString() : "Unlimited"} />
            <DetailRow label="Package quota used" value={totalTokens.toLocaleString()} />
            <DetailRow label="Package quota left" value={tokenLimit > 0 && remainingTokens != null ? Number(remainingTokens).toLocaleString() : "Unlimited"} />
            <DetailRow label="Purchased quota limit" value={purchasedTokenLimit.toLocaleString()} />
            <DetailRow label="Purchased quota used" value={usedPurchasedTokens.toLocaleString()} />
            <DetailRow label="Purchased quota left" value={purchasedRemaining.toLocaleString()} />
            <DetailRow label="Requests this cycle" value={requestCount.toLocaleString()} />
            <DetailRow label="All-time requests" value={lifetimeRequestCount.toLocaleString()} />
            <DetailRow label="Combo package" value={result?.combo?.name || "None"} />
            <DetailRow label="Active model" value={result?.combo?.selectedModel || result?.suggestedModel || "Not selected"} />
            <DetailRow label="Reset cycle" value={resetHours > 0 ? `${resetHours} hour${resetHours === 1 ? "" : "s"}` : "Manual"} />
            <DetailRow label="Current cycle started" value={formatDateTime(result?.key?.cycleStartedAt)} />
            <DetailRow label="Next reset" value={resetAt ? formatDateTime(resetAt) : "Manual"} />
            <DetailRow label="Last used" value={formatDateTime(result?.usage?.lastUsedAt)} />
            <DetailRow label="Expires at" value={expiresAtValue} />
          </div>
        </Modal>
        <CliGuideModal
          isOpen={showCliGuide}
          onClose={() => setShowCliGuide(false)}
          snippets={cliSnippets}
          copied={copied}
          onCopy={copy}
        />

        <Modal isOpen={showBuyTokens} title="Buy Extra Tokens" onClose={() => setShowBuyTokens(false)}>
          {buyResult ? (
            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 mb-4 ${buyResult.success ? "border-amber-500/30 bg-amber-500/10 text-amber-600" : "border-red-500/30 bg-red-500/10 text-red-600"}`}>
              <span className="material-symbols-outlined text-[20px]">{buyResult.success ? "qr_code" : "error"}</span>
              <span className="text-sm font-medium">{buyResult.message}</span>
            </div>
          ) : null}
          {pendingOrder?.order ? (
            <div className="mb-4 grid grid-cols-1 gap-4 rounded-[12px] border border-border-subtle bg-bg p-4 sm:grid-cols-[180px_1fr]">
              <div className="rounded-xl bg-white p-3">
                {pendingOrder.payment?.qrUrl ? (
                  <Image src={pendingOrder.payment.qrUrl} alt="Payment QR code" width={156} height={156} unoptimized className="h-auto w-full" />
                ) : (
                  <div className="grid aspect-square place-items-center text-center text-sm text-slate-500">Payment QR not configured</div>
                )}
              </div>
              <div className="space-y-2 text-sm text-text-main">
                <p className="font-semibold">Scan QR to pay</p>
                <p><span className="text-text-muted">Order:</span> <span className="font-mono">{pendingOrder.order.id}</span></p>
                <p><span className="text-text-muted">Package:</span> {pendingOrder.order.packageName}</p>
                <p><span className="text-text-muted">Amount:</span> {Number(pendingOrder.order.price || 0).toLocaleString()} {pendingOrder.order.currency || "VND"}</p>
                <p><span className="text-text-muted">Transfer note:</span> <span className="font-mono">{pendingOrder.payment?.transferNote || pendingOrder.order.id}</span></p>
                <p className="text-xs text-text-muted">Tokens are added only after payment is received and admin completes the order.</p>
              </div>
            </div>
          ) : null}
          {tokenPackages.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">No packages available</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {tokenPackages.map((pkg) => (
                <div key={pkg.id} className="rounded-[12px] border border-border-subtle bg-bg p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-main">{pkg.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">{pkg.description || "Token package"}</p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">{Number(pkg.tokenAmount || 0).toLocaleString()}</span> tokens
                      <span className="mx-2 text-text-muted">•</span>
                      <span className="font-medium">{Number(pkg.price || 0).toLocaleString()} {pkg.currency || "VND"}</span>
                    </p>
                  </div>
                  <Button
                    icon="shopping_cart"
                    onClick={() => handleBuyPackage(pkg)}
                    disabled={buyingPkgId === pkg.id}
                    className="shrink-0"
                  >
                    {buyingPkgId === pkg.id ? "Buying..." : "Buy"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </main>
  );
}
