import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToKey(row) {
  if (!row) return null;
  const tokenLimit = Number(row.tokenLimit || 0);
  const resetHours = Number(row.resetHours || 0);
  const usedTokens = Number(row.usedTokens || 0);
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
    cycleStartedAt,
    resetAt,
    expiresAt: row.expiresAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || null,
  };
}

function getKeyStatus(apiKey) {
  if (!apiKey) return "not_found";
  if (!apiKey.isActive) return "inactive";
  if (apiKey.expiresAt && Date.now() >= new Date(apiKey.expiresAt).getTime()) return "expired";
  if (apiKey.tokenLimit > 0 && apiKey.usedTokens >= apiKey.tokenLimit) return "quota_exceeded";
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
    resetHours: toNonNegativeInt(options.resetHours),
    usedTokens: 0,
    cycleStartedAt: null,
    expiresAt: normalizeDate(options.expiresAt),
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, tokenLimit, resetHours, usedTokens, cycleStartedAt, expiresAt, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.tokenLimit, apiKey.resetHours, apiKey.usedTokens, apiKey.cycleStartedAt, apiKey.expiresAt, apiKey.createdAt, apiKey.updatedAt]
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
    const expiresAt = normalizeDate(merged.expiresAt);
    const usedTokens = data.resetUsage ? 0 : toNonNegativeInt(merged.usedTokens);
    const cycleStartedAt = data.resetUsage
      ? null
      : normalizeDate(merged.cycleStartedAt);
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, tokenLimit = ?, resetHours = ?, usedTokens = ?, cycleStartedAt = ?, expiresAt = ?, updatedAt = ? WHERE id = ?`,
      [merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0, tokenLimit, resetHours, usedTokens, cycleStartedAt, expiresAt, now, id]
    );
    result = rowToKey({
      ...merged,
      tokenLimit,
      resetHours,
      usedTokens,
      cycleStartedAt,
      expiresAt,
      updatedAt: now,
    });
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
    usage: {
      totalTokens: usedTokens,
      tokenLimit,
      remainingTokens: tokenLimit > 0 ? Math.max(0, tokenLimit - usedTokens) : null,
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
    const nextUsed = Number(row.usedTokens || 0) + amount;
    db.run(`UPDATE apiKeys SET usedTokens = ?, updatedAt = ? WHERE id = ?`, [nextUsed, now, row.id]);
    result = rowToKey({ ...row, usedTokens: nextUsed, updatedAt: now });
  });
  return result;
}
