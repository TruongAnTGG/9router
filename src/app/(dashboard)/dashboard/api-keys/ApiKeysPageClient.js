"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, Input, Modal, CardSkeleton, Toggle, ConfirmModal, Select } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const CLI_TOOL_OPTIONS = [
  { value: "openai", label: "OpenAI-compatible tools" },
  { value: "claude", label: "Claude Code" },
  { value: "codex", label: "Codex CLI" },
  { value: "all", label: "All configs" },
];

export default function ApiKeysPageClient() {
  const [keys, setKeys] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requireApiKey, setRequireApiKey] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyTokenLimit, setNewKeyTokenLimit] = useState("");
  const [newKeyResetHours, setNewKeyResetHours] = useState("");
  const [newKeyExpiresAt, setNewKeyExpiresAt] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  const [editKeyName, setEditKeyName] = useState("");
  const [editKeyTokenLimit, setEditKeyTokenLimit] = useState("");
  const [editKeyResetHours, setEditKeyResetHours] = useState("");
  const [editKeyExpiresAt, setEditKeyExpiresAt] = useState("");
  const [editKeyResetUsage, setEditKeyResetUsage] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);
  const [createdKeyMeta, setCreatedKeyMeta] = useState(null);
  const [isNewKeyConfig, setIsNewKeyConfig] = useState(false);
  const [selectedCliTool, setSelectedCliTool] = useState("openai");
  const [selectedConfigModel, setSelectedConfigModel] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [clientBaseUrl] = useState(() => {
    if (typeof window !== "undefined") return window.location.origin;
    return "http://localhost:20128";
  });
  const { copied, copy } = useCopyToClipboard();

  const activeKeys = useMemo(() => keys.filter((key) => key.isActive !== false), [keys]);
  const limitedKeys = useMemo(() => keys.filter((key) => Number(key.tokenLimit || 0) > 0), [keys]);
  const expiringKeys = useMemo(() => {
    const now = currentTime;
    const soon = now + 7 * 24 * 60 * 60 * 1000;
    return keys.filter((key) => {
      if (!key.expiresAt) return false;
      const expiresAt = new Date(key.expiresAt).getTime();
      return expiresAt >= now && expiresAt <= soon;
    });
  }, [currentTime, keys]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, settingsRes, combosRes] = await Promise.all([
        fetch("/api/keys", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/combos", { cache: "no-store" }),
      ]);
      if (keysRes.ok) {
        const data = await keysRes.json();
        setKeys(data.keys || []);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setRequireApiKey(data.requireApiKey || false);
      }
      if (combosRes.ok) {
        const data = await combosRes.json();
        setCombos((data.combos || []).filter((combo) => !combo.kind));
      }
    } catch (error) {
      console.log("Error loading API keys:", error);
    } finally {
      setCurrentTime(Date.now());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPage();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPage]);

  const handleRequireApiKey = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireApiKey: value }),
      });
      if (res.ok) setRequireApiKey(value);
    } catch (error) {
      console.log("Error updating requireApiKey:", error);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          tokenLimit: newKeyTokenLimit,
          resetHours: newKeyResetHours,
          expiresAt: newKeyExpiresAt,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setCreatedKey(data.key);
        setCreatedKeyMeta({ id: data.id, name: data.name });
        setIsNewKeyConfig(true);
        await loadPage();
        resetCreateForm();
        setShowAddModal(false);
      }
    } catch (error) {
      console.log("Error creating key:", error);
    }
  };

  const resetCreateForm = () => {
    setNewKeyName("");
    setNewKeyTokenLimit("");
    setNewKeyResetHours("");
    setNewKeyExpiresAt("");
  };

  const openEditKey = (key) => {
    setEditingKey(key);
    setEditKeyName(key.name || "");
    setEditKeyTokenLimit(key.tokenLimit ? String(key.tokenLimit) : "");
    setEditKeyResetHours(key.resetHours ? String(key.resetHours) : "");
    setEditKeyExpiresAt(key.expiresAt ? toDateTimeLocal(key.expiresAt) : "");
    setEditKeyResetUsage(false);
  };

  const closeEditKey = () => {
    setEditingKey(null);
    setEditKeyName("");
    setEditKeyTokenLimit("");
    setEditKeyResetHours("");
    setEditKeyExpiresAt("");
    setEditKeyResetUsage(false);
  };

  const handleUpdateKey = async () => {
    if (!editingKey || !editKeyName.trim()) return;
    try {
      const res = await fetch(`/api/keys/${editingKey.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editKeyName,
          tokenLimit: editKeyTokenLimit,
          resetHours: editKeyResetHours,
          expiresAt: editKeyExpiresAt,
          resetUsage: editKeyResetUsage,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setKeys((prev) => prev.map((key) => key.id === editingKey.id ? data.key : key));
        closeEditKey();
      }
    } catch (error) {
      console.log("Error updating key:", error);
    }
  };

  const handleDeleteKey = async (id) => {
    setConfirmState({
      title: "Delete API Key",
      message: "Delete this API key?",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
          if (res.ok) {
            setKeys((prev) => prev.filter((key) => key.id !== id));
          }
        } catch (error) {
          console.log("Error deleting key:", error);
        }
      },
    });
  };

  const handleToggleKey = async (id, isActive) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setKeys((prev) => prev.map((key) => key.id === id ? { ...key, isActive } : key));
      }
    } catch (error) {
      console.log("Error toggling key:", error);
    }
  };

  const toDateTimeLocal = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const formatTokens = (value) => Number(value || 0).toLocaleString();

  const quotaPercent = (key) => {
    if (!key.tokenLimit) return 0;
    return Math.min(100, Math.round((Number(key.usedTokens || 0) / Number(key.tokenLimit)) * 100));
  };

  const apiBaseUrl = useMemo(() => withV1(clientBaseUrl), [clientBaseUrl]);
  const apiKeyCheckBaseUrl = useMemo(() => `${trimTrailingSlash(clientBaseUrl)}/api-key-check`, [clientBaseUrl]);

  const buildApiKeyCheckUrl = useCallback((keyValue) => {
    return `${apiKeyCheckBaseUrl}?key=${encodeURIComponent(keyValue || "")}`;
  }, [apiKeyCheckBaseUrl]);

  const modelOptions = useMemo(() => combos.map((combo) => ({
    value: combo.name,
    label: combo.name,
  })), [combos]);

  const selectedModelForConfig = selectedConfigModel || modelOptions[0]?.value || "provider/model-id";

  const createdKeyConfigs = useMemo(() => {
    if (!createdKey) return [];
    return buildCliConfigSnippets(createdKey, apiBaseUrl, selectedModelForConfig, selectedCliTool);
  }, [apiBaseUrl, createdKey, selectedCliTool, selectedModelForConfig]);

  const createdKeyBundle = useMemo(() => {
    if (!createdKey) return "";
    return buildCliConfigBundle(createdKey, apiBaseUrl, createdKeyMeta, selectedModelForConfig, selectedCliTool, buildApiKeyCheckUrl(createdKey));
  }, [apiBaseUrl, buildApiKeyCheckUrl, createdKey, createdKeyMeta, selectedCliTool, selectedModelForConfig]);

  const createdKeyCheckUrl = useMemo(() => {
    if (!createdKey) return "";
    return buildApiKeyCheckUrl(createdKey);
  }, [buildApiKeyCheckUrl, createdKey]);

  const createdKeyCheckUrlDisplay = useMemo(() => {
    if (!createdKeyCheckUrl) return "";
    return maskKeyInCheckUrl(createdKeyCheckUrl);
  }, [createdKeyCheckUrl]);

  const exportCreatedKeyBundle = () => {
    if (!createdKeyBundle || typeof window === "undefined") return;
    const blob = new Blob([createdKeyBundle], { type: "application/json;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (createdKeyMeta?.name || "9router-api-key").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    link.href = url;
    link.download = `${safeName || "9router-api-key"}-cli-config.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const openConfigForKey = (key) => {
    setCreatedKey(key.key);
    setCreatedKeyMeta({ id: key.id, name: key.name });
    setIsNewKeyConfig(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard icon="vpn_key" label="Active Keys" value={activeKeys.length} hint={`${keys.length} total`} />
        <MetricCard icon="speed" label="Quota Managed" value={limitedKeys.length} hint="Keys with token limits" />
        <MetricCard icon="event_busy" label="Expiring Soon" value={expiringKeys.length} hint="Next 7 days" />
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[22px]">shield_lock</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">API Access Policy</h2>
              <p className="text-sm text-text-muted">
                Require clients to send a valid LakeToken API key before requests reach your providers.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
            <span className="text-sm font-medium">{requireApiKey ? "Required" : "Optional"}</span>
            <Toggle checked={requireApiKey} onChange={() => handleRequireApiKey(!requireApiKey)} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">vpn_key</span>
              API Keys
            </h2>
            <p className="mt-1 text-sm text-text-muted">Create client keys, pause access, and enforce token budgets.</p>
          </div>
          <Button icon="add" onClick={() => setShowAddModal(true)}>
            Create Key
          </Button>
        </div>

        {keys.length === 0 ? (
          <div className="text-center py-14">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <span className="material-symbols-outlined text-[32px]">vpn_key</span>
            </div>
            <p className="text-text-main font-medium mb-1">No API keys yet</p>
            <p className="text-sm text-text-muted mb-4">Create your first API key to protect external access.</p>
            <Button icon="add" onClick={() => setShowAddModal(true)}>
              Create Key
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {keys.map((key) => (
              <div
                key={key.id}
                className={`group flex flex-col gap-4 border-b border-black/[0.03] py-4 last:border-b-0 dark:border-white/[0.03] lg:flex-row lg:items-start lg:justify-between ${key.isActive === false ? "opacity-60" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[20px]">vpn_key</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-semibold text-text-main">{key.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${key.isActive === false ? "bg-orange-500/10 text-orange-500" : "bg-green-500/10 text-green-600 dark:text-green-400"}`}>
                          {key.isActive === false ? "Paused" : "Active"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        Key value is hidden. Use copy or setup actions to configure clients.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 max-w-2xl">
                    <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                      <span>
                        Tokens {formatTokens(key.usedTokens)}
                        {key.tokenLimit > 0 ? ` / ${formatTokens(key.tokenLimit)}` : " / Unlimited"}
                      </span>
                      {key.tokenLimit > 0 && <span>{quotaPercent(key)}%</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${key.tokenLimit > 0 && quotaPercent(key) >= 100 ? "bg-red-500" : "bg-primary"}`}
                        style={{ width: key.tokenLimit > 0 ? `${quotaPercent(key)}%` : "0%" }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted mt-1">
                      <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                      <span>Reset: {key.resetHours > 0 ? `${key.resetHours}h${key.resetAt ? `, ${new Date(key.resetAt).toLocaleString()}` : ""}` : "Manual"}</span>
                      <span>Expires: {key.expiresAt ? new Date(key.expiresAt).toLocaleString() : "Never"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <button
                    onClick={() => copy(key.key, key.id)}
                    className="flex size-9 items-center justify-center rounded-full text-text-muted transition-all hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                    title="Copy key"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {copied === key.id ? "check" : "content_copy"}
                    </span>
                  </button>
                  <button
                    onClick={() => copy(buildApiKeyCheckUrl(key.key), `check_link_${key.id}`)}
                    className="flex size-9 items-center justify-center rounded-full text-text-muted transition-all hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                    title="Copy customer check link"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {copied === `check_link_${key.id}` ? "check" : "link"}
                    </span>
                  </button>
                  <button
                    onClick={() => openConfigForKey(key)}
                    className="flex h-9 items-center gap-2 rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary transition-all hover:bg-primary/15"
                    title="View CLI config"
                  >
                    <span className="material-symbols-outlined text-[18px]">terminal</span>
                    CLI setup
                  </button>
                  <button
                    onClick={() => openEditKey(key)}
                    className="flex size-9 items-center justify-center rounded-full text-text-muted transition-all hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                    title="Edit quota"
                  >
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                  </button>
                  <Toggle
                    size="sm"
                    checked={key.isActive ?? true}
                    onChange={(checked) => {
                      if (key.isActive && !checked) {
                        setConfirmState({
                          title: "Pause API Key",
                          message: `Pause API key "${key.name}"?\n\nThis key will stop working immediately but can be resumed later.`,
                          onConfirm: async () => {
                            setConfirmState(null);
                            handleToggleKey(key.id, checked);
                          },
                        });
                      } else {
                        handleToggleKey(key.id, checked);
                      }
                    }}
                    title={key.isActive ? "Pause key" : "Resume key"}
                  />
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="flex size-9 items-center justify-center rounded-full text-red-500 transition-all hover:bg-red-500/10"
                    title="Delete key"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={showAddModal}
        title="Create API Key"
        onClose={() => {
          setShowAddModal(false);
          resetCreateForm();
        }}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Production Key"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Token limit"
              type="number"
              min="0"
              value={newKeyTokenLimit}
              onChange={(e) => setNewKeyTokenLimit(e.target.value)}
              placeholder="0 = unlimited"
              hint="Total input + output tokens per cycle"
            />
            <Input
              label="Reset cycle (hours)"
              type="number"
              min="0"
              value={newKeyResetHours}
              onChange={(e) => setNewKeyResetHours(e.target.value)}
              placeholder="0 = manual"
              hint="Example: 24 for daily quota"
            />
          </div>
          <Input
            label="Expires at"
            type="datetime-local"
            value={newKeyExpiresAt}
            onChange={(e) => setNewKeyExpiresAt(e.target.value)}
            hint="Leave empty for no expiration"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreateKey} fullWidth disabled={!newKeyName.trim()}>
              Create
            </Button>
            <Button
              onClick={() => {
                setShowAddModal(false);
                resetCreateForm();
              }}
              variant="ghost"
              fullWidth
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!editingKey} title="Edit API Key" onClose={closeEditKey}>
        <div className="flex flex-col gap-4">
          <Input label="Key Name" value={editKeyName} onChange={(e) => setEditKeyName(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Token limit"
              type="number"
              min="0"
              value={editKeyTokenLimit}
              onChange={(e) => setEditKeyTokenLimit(e.target.value)}
              placeholder="0 = unlimited"
              hint="Total input + output tokens per cycle"
            />
            <Input
              label="Reset cycle (hours)"
              type="number"
              min="0"
              value={editKeyResetHours}
              onChange={(e) => setEditKeyResetHours(e.target.value)}
              placeholder="0 = manual"
              hint="Example: 24 for daily quota"
            />
          </div>
          <Input
            label="Expires at"
            type="datetime-local"
            value={editKeyExpiresAt}
            onChange={(e) => setEditKeyExpiresAt(e.target.value)}
            hint="Leave empty for no expiration"
          />
          {editingKey && (
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-text-muted">Current usage</span>
                <span className="font-mono">
                  {formatTokens(editingKey.usedTokens)}{editingKey.tokenLimit > 0 ? ` / ${formatTokens(editingKey.tokenLimit)}` : " / Unlimited"}
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editKeyResetUsage}
                  onChange={(e) => setEditKeyResetUsage(e.target.checked)}
                  className="h-4 w-4"
                />
                Reset used tokens after saving
              </label>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleUpdateKey} fullWidth disabled={!editKeyName.trim()}>
              Save
            </Button>
            <Button onClick={closeEditKey} variant="ghost" fullWidth>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!createdKey}
        title={isNewKeyConfig ? "API Key Created" : "API Key Config"}
        size="full"
        className="max-w-6xl"
        onClose={() => {
          setCreatedKey(null);
          setCreatedKeyMeta(null);
          setIsNewKeyConfig(false);
        }}
      >
        <div className="flex flex-col gap-4">
          {isNewKeyConfig && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2 font-medium">
                Save this key now.
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                This is the only time you will see this key. Store it securely.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <Input
                value={createdKey || ""}
                readOnly
                type={isNewKeyConfig ? "text" : "password"}
                className="min-w-0 font-mono text-sm"
                inputClassName="min-w-0 overflow-hidden text-ellipsis"
                hint={isNewKeyConfig ? "Shown once after creation." : "Hidden on screen. Copy still uses the real key."}
              />
            </div>
            <Button
              variant="secondary"
              icon={copied === "created_key" ? "check" : "content_copy"}
              onClick={() => copy(createdKey, "created_key")}
              className="w-full sm:w-auto"
            >
              {copied === "created_key" ? "Copied!" : "Copy"}
            </Button>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-surface-2 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-text-main">Customer check link</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Send this link to a customer so they can inspect usage, quota, reset time, cost, and expiry without typing the key.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={copied === "created_check_link" ? "check" : "link"}
                onClick={() => copy(createdKeyCheckUrl, "created_check_link")}
              >
                {copied === "created_check_link" ? "Copied" : "Copy Link"}
              </Button>
            </div>
            <code className="mt-3 block max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs leading-relaxed text-text-main">
              {createdKeyCheckUrlDisplay}
            </code>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-surface-2 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-text-main">CLI tool config</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Copy the values needed by OpenAI-compatible tools, Claude Code, Codex, Cline, Roo, Continue, and similar clients.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={copied === "created_config_bundle" ? "check" : "content_copy"}
                  onClick={() => copy(createdKeyBundle, "created_config_bundle")}
                >
                  {copied === "created_config_bundle" ? "Copied" : "Copy All"}
                </Button>
                <Button size="sm" variant="outline" icon="download" onClick={exportCreatedKeyBundle}>
                  Export
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <ConfigField
                label="Base URL"
                value={apiBaseUrl}
                copied={copied === "created_base_url"}
                onCopy={() => copy(apiBaseUrl, "created_base_url")}
              />
              <ConfigField
                label="API Key"
                value={createdKey || ""}
                displayValue={isNewKeyConfig ? createdKey || "" : "hidden"}
                copied={copied === "created_config_key"}
                onCopy={() => copy(createdKey || "", "created_config_key")}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="CLI tool"
                value={selectedCliTool}
                onChange={(e) => setSelectedCliTool(e.target.value)}
                options={CLI_TOOL_OPTIONS}
              />
              <Select
                label="Model"
                value={modelOptions.length ? selectedModelForConfig : ""}
                onChange={(e) => setSelectedConfigModel(e.target.value)}
                placeholder={modelOptions.length ? "Select combo model" : "No combos yet"}
                options={modelOptions}
                disabled={modelOptions.length === 0}
                hint="Uses combo names as model IDs"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {createdKeyConfigs.map((item) => (
                <ConfigSnippet
                  key={item.id}
                  title={item.title}
                  filename={item.filename}
                  content={item.content}
                  copied={copied === `created_config_${item.id}`}
                  onCopy={() => copy(item.content, `created_config_${item.id}`)}
                />
              ))}
            </div>
          </div>
          <Button
            onClick={() => {
              setCreatedKey(null);
              setCreatedKeyMeta(null);
              setIsNewKeyConfig(false);
            }}
            fullWidth
          >
            Done
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
    </div>
  );
}

function trimTrailingSlash(baseUrl) {
  return String(baseUrl || "http://localhost:20128").replace(/\/+$/, "");
}

function withV1(baseUrl) {
  const trimmed = trimTrailingSlash(baseUrl);
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function maskKeyInCheckUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("key")) parsed.searchParams.set("key", "hidden");
    return parsed.toString();
  } catch {
    return String(url || "").replace(/([?&]key=)[^&]+/, "$1hidden");
  }
}

function buildCliConfigSnippets(apiKey, baseUrl, model, cliTool) {
  const claudeSettings = {
    hasCompletedOnboarding: true,
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      API_TIMEOUT_MS: "600000",
      ANTHROPIC_MODEL: model,
    },
  };

  const codexConfig = `# LakeToken Configuration for Codex CLI
model = "${model}"
model_provider = "9router"

[model_providers.9router]
name = "LakeToken"
base_url = "${baseUrl}"
wire_api = "responses"

[agents.subagent]
model = "${model}"
`;

  const shellEnv = [
    `export OPENAI_BASE_URL="${baseUrl}"`,
    `export OPENAI_API_KEY="${apiKey}"`,
    `export OPENAI_MODEL="${model}"`,
    `export ANTHROPIC_BASE_URL="${baseUrl}"`,
    `export ANTHROPIC_AUTH_TOKEN="${apiKey}"`,
    `export ANTHROPIC_MODEL="${model}"`,
    `export API_TIMEOUT_MS="600000"`,
  ].join("\n");

  const openAiTerminal = [
    "mkdir -p ~/.9router",
    `printf '%s\\n' '${escapeSingleQuoted(shellEnv)}' > ~/.9router/cli-env.sh`,
    "printf '\\n# LakeToken API config\\nsource ~/.9router/cli-env.sh\\n' >> ~/.zshrc",
    "printf '\\n# LakeToken API config\\nsource ~/.9router/cli-env.sh\\n' >> ~/.bashrc",
    "source ~/.9router/cli-env.sh",
  ].join("\n");

  const claudeTerminal = [
    "mkdir -p ~/.claude",
    `cat > ~/.claude/settings.json <<'EOF'\n${JSON.stringify(claudeSettings, null, 2)}\nEOF`,
  ].join("\n");

  const codexAuth = JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: apiKey }, null, 2);
  const codexTerminal = [
    "mkdir -p ~/.codex",
    `cat > ~/.codex/config.toml <<'EOF'\n${codexConfig}EOF`,
    `cat > ~/.codex/auth.json <<'EOF'\n${codexAuth}\nEOF`,
  ].join("\n");

  const snippets = [
    {
      id: "shell",
      title: "Shell env",
      filename: "~/.bashrc or ~/.zshrc",
      tool: "openai",
      content: shellEnv,
    },
    {
      id: "terminal_openai",
      title: "Terminal command",
      filename: "OpenAI-compatible env setup",
      tool: "openai",
      content: openAiTerminal,
    },
    {
      id: "claude",
      title: "Claude Code",
      filename: "~/.claude/settings.json",
      tool: "claude",
      content: JSON.stringify(claudeSettings, null, 2),
    },
    {
      id: "terminal_claude",
      title: "Terminal command",
      filename: "Claude Code setup",
      tool: "claude",
      content: claudeTerminal,
    },
    {
      id: "codex_config",
      title: "Codex config",
      filename: "~/.codex/config.toml",
      tool: "codex",
      content: codexConfig,
    },
    {
      id: "codex_auth",
      title: "Codex auth",
      filename: "~/.codex/auth.json",
      tool: "codex",
      content: codexAuth,
    },
    {
      id: "terminal_codex",
      title: "Terminal command",
      filename: "Codex CLI setup",
      tool: "codex",
      content: codexTerminal,
    },
  ];

  if (cliTool === "all") return snippets;
  return snippets.filter((snippet) => snippet.tool === cliTool);
}

function buildCliConfigBundle(apiKey, baseUrl, meta, model, cliTool, checkUrl = "") {
  const snippets = buildCliConfigSnippets(apiKey, baseUrl, model, cliTool);
  return JSON.stringify({
    name: meta?.name || "",
    id: meta?.id || "",
    baseUrl,
    apiKey,
    checkUrl,
    model,
    cliTool,
    openaiCompatible: {
      OPENAI_BASE_URL: baseUrl,
      OPENAI_API_KEY: apiKey,
      OPENAI_MODEL: model,
    },
    anthropicCompatible: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_MODEL: model,
      API_TIMEOUT_MS: "600000",
    },
    files: snippets.reduce((acc, item) => {
      acc[item.filename] = item.content;
      return acc;
    }, {}),
  }, null, 2);
}

function escapeSingleQuoted(value) {
  return String(value).replace(/'/g, "'\\''");
}

function ConfigField({ label, value, displayValue, copied, onCopy }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center">
      <div className="w-24 shrink-0 text-xs font-medium uppercase text-text-muted">{label}</div>
      <code className="min-w-0 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-secondary px-3 py-2 font-mono text-xs leading-relaxed text-text-main">
        {displayValue ?? value}
      </code>
      <Button size="sm" variant="ghost" icon={copied ? "check" : "content_copy"} onClick={onCopy} className="w-full sm:w-auto">
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function ConfigSnippet({ title, filename, content, copied, onCopy }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-bg-secondary">
      <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-main">{title}</p>
          <p className="break-words text-[11px] leading-relaxed text-text-muted">{filename}</p>
        </div>
        <Button size="sm" variant="ghost" icon={copied ? "check" : "content_copy"} onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-[420px] max-w-full overflow-auto p-3">
        <code className="whitespace-pre-wrap break-words text-xs leading-relaxed text-text-main">{content}</code>
      </pre>
    </div>
  );
}

function MetricCard({ icon, label, value, hint }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-text-main">{value}</p>
          <p className="mt-1 text-xs text-text-muted">{hint}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
      </div>
    </Card>
  );
}
