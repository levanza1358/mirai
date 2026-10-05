import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt || null,
    maxRequests: row.maxRequests ?? null,
    maxTokens: row.maxTokens ?? null,
    maxCost: row.maxCost ?? null,
    requestCount: row.requestCount || 0,
    tokenCount: row.tokenCount || 0,
    costAccum: row.costAccum || 0,
    lastUsedAt: row.lastUsedAt || null,
  };
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, options = {}) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    createdAt: new Date().toISOString(),
    expiresAt: options.expiresAt || null,
    maxRequests: options.maxRequests ?? null,
    maxTokens: options.maxTokens ?? null,
    maxCost: options.maxCost ?? null,
    requestCount: 0,
    tokenCount: 0,
    costAccum: 0,
    lastUsedAt: null,
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, expiresAt, maxRequests, maxTokens, maxCost, requestCount, tokenCount, costAccum, lastUsedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt, apiKey.expiresAt, apiKey.maxRequests, apiKey.maxTokens, apiKey.maxCost, 0, 0, 0, null]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToKey(row), ...data };
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, expiresAt = ?, maxRequests = ?, maxTokens = ?, maxCost = ? WHERE id = ?`,
      [merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0, merged.expiresAt || null, merged.maxRequests ?? null, merged.maxTokens ?? null, merged.maxCost ?? null, id]
    );
    result = merged;
  });
  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT isActive, expiresAt, requestCount, tokenCount, costAccum, maxRequests, maxTokens, maxCost FROM apiKeys WHERE key = ?`, [key]);
  if (!row || !(row.isActive === 1 || row.isActive === true)) return false;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return false;
  if (row.maxRequests != null && (row.requestCount || 0) >= row.maxRequests) return false;
  if (row.maxTokens != null && (row.tokenCount || 0) >= row.maxTokens) return false;
  if (row.maxCost != null && (row.costAccum || 0) >= row.maxCost) return false;
  return true;
}

export async function incrementApiKeyUsage(key, { requests = 1, tokens = 0, cost = 0 } = {}) {
  if (!key) return;
  const db = await getAdapter();
  db.run(
    `UPDATE apiKeys SET requestCount = COALESCE(requestCount, 0) + ?, tokenCount = COALESCE(tokenCount, 0) + ?, costAccum = COALESCE(costAccum, 0) + ?, lastUsedAt = ? WHERE key = ?`,
    [requests, tokens, cost, new Date().toISOString(), key]
  );
}
