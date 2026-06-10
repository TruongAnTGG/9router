import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function normalizeSkillIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function rowToKey(row) {
  if (!row) return null;
  const tokenLimit = Number(row.tokenLimit || 0);
  const resetHours = Number(row.resetHours || 0);
  const usedTokens = Number(row.usedTokens || 0);
  const purchasedTokenLimit = Number(row.purchasedTokenLimit || 0);
  const usedPurchasedTokens = Number(row.usedPurchasedTokens || 0);
  const purchasedExpiresAt = row.purchasedExpiresAt || null;
  const cycleStartedAt = row.cycleStartedAt || null;
  const resetAt = resetHours > 0 && cycleStartedAt
    ? new Date(new Date(cycleStartedAt).getTime() + resetHours * 60 * 60 * 1000).toISOString()
    : null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    tokenLimit,
    resetHours,
    usedTokens,
    purchasedTokenLimit,
    usedPurchasedTokens,
    purchasedExpiresAt,
    cycleStartedAt,
    resetAt,
    comboName: row.comboName || null,
    selectedModel: row.selectedModel || null,
    skillIds: normalizeSkillIds(parseJson(row.skillIds, [])),
    expiresAt: row.expiresAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || null,
  };
}

function getKeyStatus(apiKey) {
  if (!apiKey) return "not_found";
  if (!apiKey.isActive) return "inactive";
  if (apiKey.expiresAt && Date.now() >= new Date(apiKey.expiresAt).getTime()) return "expired";
  const baseRemaining = Math.max(0, Number(apiKey.tokenLimit || 0) - Number(apiKey.usedTokens || 0));
  const purchasedValid = !apiKey.purchasedExpiresAt || Date.now() < new Date(apiKey.purchasedExpiresAt).getTime();
  const purchasedRemaining = purchasedValid
    ? Math.max(0, Number(apiKey.purchasedTokenLimit || 0) - Number(apiKey.usedPurchasedTokens || 0))
    : 0;
  if (baseRemaining <= 0 && purchasedRemaining <= 0) return "quota_exceeded";
  return "active";
}

function toNonNegativeInt(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function totalTokens(tokens) {
  if (!tokens || typeof tokens !== "object") return 0;
  return (tokens.prompt_tokens || tokens.input_tokens || 0) +
    (tokens.completion_tokens || tokens.output_tokens || 0) +
    (tokens.reasoning_tokens || 0);
}

function shouldResetCycle(row, nowMs = Date.now()) {
  const resetHours = Number(row?.resetHours || 0);
  if (resetHours <= 0) return false;
  const started = row?.cycleStartedAt;
  if (!started) return false;
  const startedMs = new Date(started).getTime();
  if (Number.isNaN(startedMs)) return false;
  return nowMs >= startedMs + resetHours * 60 * 60 * 1000;
}

function resetCycleIfNeeded(db, row, { startNewCycle = false } = {}) {
  if (!row || !shouldResetCycle(row)) return row;
  const now = new Date().toISOString();
  const cycleStartedAt = startNewCycle ? now : null;
  db.run(`UPDATE apiKeys SET usedTokens = 0, cycleStartedAt = ?, updatedAt = ? WHERE id = ?`, [cycleStartedAt, now, row.id]);
  return { ...row, usedTokens: 0, cycleStartedAt, updatedAt: now };
}

function startCycleForApiCallIfNeeded(db, row) {
  if (!row) return row;
  row = resetCycleIfNeeded(db, row, { startNewCycle: true });
  const resetHours = Number(row.resetHours || 0);
  if (resetHours <= 0 || row.cycleStartedAt) return row;
  const now = new Date().toISOString();
  db.run(`UPDATE apiKeys SET cycleStartedAt = ?, updatedAt = ? WHERE id = ?`, [now, now, row.id]);
  return { ...row, cycleStartedAt: now, updatedAt: now };
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map((row) => rowToKey(resetCycleIfNeeded(db, row)));
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(resetCycleIfNeeded(db, row));
}

export async function createApiKey(name, machineId, options = {}) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const now = new Date().toISOString();
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    tokenLimit: toNonNegativeInt(options.tokenLimit),
    purchasedTokenLimit: 0,
    usedPurchasedTokens: 0,
    purchasedExpiresAt: null,
    resetHours: toNonNegativeInt(options.resetHours),
    usedTokens: 0,
    cycleStartedAt: null,
    comboName: normalizeOptionalString(options.comboName),
    selectedModel: normalizeOptionalString(options.selectedModel),
    skillIds: normalizeSkillIds(options.skillIds),
    expiresAt: normalizeDate(options.expiresAt),
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, tokenLimit, resetHours, usedTokens, purchasedTokenLimit, usedPurchasedTokens, purchasedExpiresAt, cycleStartedAt, comboName, selectedModel, skillIds, expiresAt, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.tokenLimit, apiKey.resetHours, apiKey.usedTokens, apiKey.purchasedTokenLimit, apiKey.usedPurchasedTokens, apiKey.purchasedExpiresAt, apiKey.cycleStartedAt, apiKey.comboName, apiKey.selectedModel, stringifyJson(apiKey.skillIds), apiKey.expiresAt, apiKey.createdAt, apiKey.updatedAt]
  );
  return rowToKey(apiKey);
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const current = rowToKey(resetCycleIfNeeded(db, row));
    const merged = { ...current, ...data };
    const now = new Date().toISOString();
    const tokenLimit = toNonNegativeInt(merged.tokenLimit);
    const resetHours = toNonNegativeInt(merged.resetHours);
    const purchasedTokenLimit = toNonNegativeInt(merged.purchasedTokenLimit);
    const usedPurchasedTokens = data.resetPurchasedUsage ? 0 : toNonNegativeInt(merged.usedPurchasedTokens);
    const purchasedExpiresAt = normalizeDate(merged.purchasedExpiresAt);
    const expiresAt = normalizeDate(merged.expiresAt);
    const comboName = normalizeOptionalString(merged.comboName);
    const selectedModel = normalizeOptionalString(merged.selectedModel);
    const skillIds = normalizeSkillIds(merged.skillIds);
    const usedTokens = data.resetUsage ? 0 : toNonNegativeInt(merged.usedTokens);
    const cycleStartedAt = data.resetUsage
      ? null
      : normalizeDate(merged.cycleStartedAt);
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, tokenLimit = ?, resetHours = ?, usedTokens = ?, purchasedTokenLimit = ?, usedPurchasedTokens = ?, purchasedExpiresAt = ?, cycleStartedAt = ?, comboName = ?, selectedModel = ?, skillIds = ?, expiresAt = ?, updatedAt = ? WHERE id = ?`,
      [merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0, tokenLimit, resetHours, usedTokens, purchasedTokenLimit, usedPurchasedTokens, purchasedExpiresAt, cycleStartedAt, comboName, selectedModel, stringifyJson(skillIds), expiresAt, now, id]
    );
    result = rowToKey({
      ...merged,
      tokenLimit,
      resetHours,
      usedTokens,
      purchasedTokenLimit,
      usedPurchasedTokens,
      purchasedExpiresAt,
      cycleStartedAt,
      comboName,
      selectedModel,
      skillIds,
      expiresAt,
      updatedAt: now,
    });
  });
  return result;
}

function normalizeOptionalString(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export async function updateApiKeySelectedModelByKey(key, selectedModel) {
  const normalizedKey = typeof key === "string" ? key.trim() : "";
  const normalizedModel = normalizeOptionalString(selectedModel);
  if (!normalizedKey) {
    return { ok: false, status: "not_found", message: "API key is required" };
  }

  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    let row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [normalizedKey]);
    if (!row) {
      result = { ok: false, status: "not_found", message: "Invalid API key" };
      return;
    }
    row = resetCycleIfNeeded(db, row);
    const apiKey = rowToKey(row);
    const status = getKeyStatus(apiKey);
    if (status !== "active") {
      result = { ok: false, status, message: "API key is not active", key: apiKey };
      return;
    }
    if (!apiKey.comboName) {
      result = { ok: false, status: "no_combo", message: "This API key is not assigned to a combo", key: apiKey };
      return;
    }

    const comboRow = db.get(`SELECT * FROM combos WHERE name = ?`, [apiKey.comboName]);
    let models = [];
    try {
      models = comboRow?.models ? JSON.parse(comboRow.models) : [];
    } catch {
      models = [];
    }
    if (!models.includes(normalizedModel)) {
      result = { ok: false, status: "invalid_model", message: "Selected model is not available for this API key", key: apiKey };
      return;
    }

    const now = new Date().toISOString();
    db.run(`UPDATE apiKeys SET selectedModel = ?, updatedAt = ? WHERE id = ?`, [normalizedModel, now, apiKey.id]);
    result = { ok: true, key: rowToKey({ ...row, selectedModel: normalizedModel, updatedAt: now }) };
  });
  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const result = await validateApiKeyDetailed(key);
  return result.valid;
}

export async function validateApiKeyDetailed(key) {
  const db = await getAdapter();
  let row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return { valid: false, reason: "not_found", message: "Invalid API key" };
  row = startCycleForApiCallIfNeeded(db, row);
  const apiKey = rowToKey(row);
  const status = getKeyStatus(apiKey);
  if (status !== "active") {
    const messages = {
      inactive: "API key is paused",
      expired: "API key has expired",
      quota_exceeded: "API key token quota exceeded",
    };
    return { valid: false, reason: status, message: messages[status], key: apiKey };
  }
  return { valid: true, key: apiKey };
}

export async function getApiKeyUsageSummaryByKey(key) {
  const normalized = typeof key === "string" ? key.trim() : "";
  if (!normalized) {
    return { valid: false, status: "not_found", message: "API key is required" };
  }

  const db = await getAdapter();
  let row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [normalized]);
  if (!row) {
    return { valid: false, status: "not_found", message: "Invalid API key" };
  }

  row = resetCycleIfNeeded(db, row);
  const apiKey = rowToKey(row);
  const status = getKeyStatus(apiKey);
  const cycleUsageRow = apiKey.cycleStartedAt
    ? db.get(
      `SELECT
        COUNT(*) AS requestCount,
        MAX(timestamp) AS lastUsedAt,
        COALESCE(SUM(promptTokens), 0) AS promptTokens,
        COALESCE(SUM(completionTokens), 0) AS completionTokens,
        COALESCE(SUM(cost), 0) AS cost
      FROM usageHistory
      WHERE apiKey = ? AND timestamp >= ?`,
      [normalized, apiKey.cycleStartedAt]
    ) || {}
    : {};
  const lifetimeUsageRow = db.get(
    `SELECT
      COUNT(*) AS requestCount,
      MAX(timestamp) AS lastUsedAt,
      COALESCE(SUM(cost), 0) AS cost
    FROM usageHistory WHERE apiKey = ?`,
    [normalized]
  ) || {};

  const tokenLimit = Number(apiKey.tokenLimit || 0);
  const usedTokens = Number(apiKey.usedTokens || 0);
  const purchasedTokenLimit = Number(apiKey.purchasedTokenLimit || 0);
  const usedPurchasedTokens = Number(apiKey.usedPurchasedTokens || 0);
  const purchasedValid = !apiKey.purchasedExpiresAt || Date.now() < new Date(apiKey.purchasedExpiresAt).getTime();
  const purchasedRemaining = purchasedValid ? Math.max(0, purchasedTokenLimit - usedPurchasedTokens) : 0;
  const resetAtMs = apiKey.resetAt ? new Date(apiKey.resetAt).getTime() : null;
  const resetInMs = resetAtMs ? Math.max(0, resetAtMs - Date.now()) : null;

  return {
    valid: status === "active",
    status,
    message:
      status === "active" ? "API key is active" :
      status === "inactive" ? "API key is paused" :
      status === "expired" ? "API key has expired" :
      status === "quota_exceeded" ? "API key token quota exceeded" :
      "Invalid API key",
    key: apiKey,
    combo: apiKey.comboName ? {
      name: apiKey.comboName,
      models: (() => {
        const comboRow = db.get(`SELECT models FROM combos WHERE name = ?`, [apiKey.comboName]);
        try { return comboRow?.models ? JSON.parse(comboRow.models) : []; } catch { return []; }
      })(),
      selectedModel: apiKey.selectedModel,
    } : null,
    suggestedModel: apiKey.selectedModel || apiKey.comboName || null,
    usage: {
      totalTokens: usedTokens,
      tokenLimit,
      remainingTokens: tokenLimit > 0 ? Math.max(0, tokenLimit - usedTokens) : null,
      purchasedTokenLimit,
      usedPurchasedTokens,
      purchasedRemaining,
      purchasedExpiresAt: apiKey.purchasedExpiresAt,
      quotaPercent: tokenLimit > 0 ? Math.min(100, Math.round((usedTokens / tokenLimit) * 100)) : null,
      promptTokens: Number(cycleUsageRow.promptTokens || 0),
      completionTokens: Number(cycleUsageRow.completionTokens || 0),
      requestCount: Number(cycleUsageRow.requestCount || 0),
      lastUsedAt: cycleUsageRow.lastUsedAt || lifetimeUsageRow.lastUsedAt || null,
      cost: Number(cycleUsageRow.cost || 0),
      lifetimeCost: Number(lifetimeUsageRow.cost || 0),
      lifetimeRequestCount: Number(lifetimeUsageRow.requestCount || 0),
    },
    cycle: {
      resetHours: Number(apiKey.resetHours || 0),
      cycleStartedAt: apiKey.cycleStartedAt,
      resetAt: apiKey.resetAt,
      resetInMs,
    },
    expiresAt: apiKey.expiresAt,
  };
}

export async function recordApiKeyUsage(key, tokens) {
  const amount = totalTokens(tokens);
  if (!key || amount <= 0) return null;
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    let row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
    if (!row) return;
    row = startCycleForApiCallIfNeeded(db, row);
    const now = new Date().toISOString();
    const baseLimit = Number(row.tokenLimit || 0);
    const baseUsed = Number(row.usedTokens || 0);
    const baseRemaining = Math.max(0, baseLimit - baseUsed);

    const purchasedLimit = Number(row.purchasedTokenLimit || 0);
    const purchasedUsed = Number(row.usedPurchasedTokens || 0);
    const purchasedValid = !row.purchasedExpiresAt || Date.now() < new Date(row.purchasedExpiresAt).getTime();
    const purchasedRemaining = purchasedValid ? Math.max(0, purchasedLimit - purchasedUsed) : 0;

    const useFromBase = Math.min(amount, baseRemaining);
    const useFromPurchased = Math.min(amount - useFromBase, purchasedRemaining);

    const nextUsed = baseUsed + useFromBase;
    const nextUsedPurchased = purchasedUsed + useFromPurchased;

    db.run(`UPDATE apiKeys SET usedTokens = ?, usedPurchasedTokens = ?, updatedAt = ? WHERE id = ?`, [nextUsed, nextUsedPurchased, now, row.id]);
    result = rowToKey({ ...row, usedTokens: nextUsed, usedPurchasedTokens: nextUsedPurchased, updatedAt: now });
  });
  return result;
}
