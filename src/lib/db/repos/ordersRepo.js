import { nanoid } from "nanoid";
import { getAdapter } from "../driver.js";

function rowToOrder(row) {
  if (!row) return null;
  return {
    ...row,
    paymentData: row.paymentData ? JSON.parse(row.paymentData) : null,
  };
}

export async function getOrders({ apiKeyId = null, status = null, limit = 100, offset = 0 } = {}) {
  const db = await getAdapter();
  let sql = "SELECT * FROM orders WHERE 1=1";
  const params = [];
  if (apiKeyId) {
    sql += " AND apiKeyId = ?";
    params.push(apiKeyId);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  return db.all(sql, params).map(rowToOrder);
}

export async function getOrderById(id) {
  const db = await getAdapter();
  return rowToOrder(db.get("SELECT * FROM orders WHERE id = ?", [id]));
}

export async function createOrder(data) {
  const db = await getAdapter();
  const id = nanoid();
  const now = new Date().toISOString();
  const {
    apiKeyId, packageId, packageName, tokenAmount, price,
    currency = "VND", status = "pending", paymentMethod = null,
    paymentTransactionId = null, paymentData = null,
  } = data;

  db.run(
    `INSERT INTO orders (id, apiKeyId, packageId, packageName, tokenAmount, price, currency, status, paymentMethod, paymentTransactionId, paymentData, createdAt, updatedAt, completedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, apiKeyId, packageId, packageName, tokenAmount, price, currency, status, paymentMethod, paymentTransactionId, paymentData ? JSON.stringify(paymentData) : null, now, now, null]
  );
  return getOrderById(id);
}

export async function updateOrderStatus(id, status, additionalData = {}) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get("SELECT * FROM orders WHERE id = ?", [id]);
    if (!row) throw new Error("Order not found");
    const now = new Date().toISOString();
    const completedAt = (status === "completed" || status === "success") ? now : row.completedAt;

    db.run(
      `UPDATE orders SET status = ?, paymentTransactionId = ?, paymentData = ?, updatedAt = ?, completedAt = ? WHERE id = ?`,
      [
        status,
        additionalData.paymentTransactionId || row.paymentTransactionId || null,
        additionalData.paymentData ? JSON.stringify(additionalData.paymentData) : row.paymentData,
        now,
        completedAt,
        id,
      ]
    );

    result = rowToOrder({
      ...row,
      status,
      paymentTransactionId: additionalData.paymentTransactionId || row.paymentTransactionId || null,
      paymentData: additionalData.paymentData ? JSON.stringify(additionalData.paymentData) : row.paymentData,
      updatedAt: now,
      completedAt,
    });
  });
  return result;
}

export async function completeOrderAndGrantTokens(id, additionalData = {}) {
  const db = await getAdapter();
  let result = null;

  db.transaction(() => {
    const orderRow = db.get("SELECT * FROM orders WHERE id = ?", [id]);
    if (!orderRow) throw new Error("Order not found");

    const alreadyCompleted = orderRow.status === "completed" || orderRow.status === "success";
    const apiKeyRow = db.get("SELECT * FROM apiKeys WHERE id = ?", [orderRow.apiKeyId]);
    if (!apiKeyRow) throw new Error("API key not found");

    const now = new Date().toISOString();
    const nextPaymentTx = additionalData.paymentTransactionId || orderRow.paymentTransactionId || null;
    const nextPaymentData = additionalData.paymentData ? JSON.stringify(additionalData.paymentData) : orderRow.paymentData;
    const nextCompletedAt = alreadyCompleted ? orderRow.completedAt : now;

    db.run(
      `UPDATE orders SET status = ?, paymentTransactionId = ?, paymentData = ?, updatedAt = ?, completedAt = ? WHERE id = ?`,
      ["completed", nextPaymentTx, nextPaymentData, now, nextCompletedAt, id]
    );

    let grantedTokens = 0;
    if (!alreadyCompleted) {
      const currentPurchased = Number(apiKeyRow.purchasedTokenLimit || 0);
      grantedTokens = Number(orderRow.tokenAmount || 0);
      db.run(
        `UPDATE apiKeys SET purchasedTokenLimit = ?, purchasedExpiresAt = ?, updatedAt = ? WHERE id = ?`,
        [currentPurchased + grantedTokens, apiKeyRow.expiresAt || null, now, orderRow.apiKeyId]
      );
    }

    const updatedOrderRow = db.get("SELECT * FROM orders WHERE id = ?", [id]);
    const updatedApiKeyRow = db.get("SELECT * FROM apiKeys WHERE id = ?", [orderRow.apiKeyId]);
    result = {
      order: rowToOrder(updatedOrderRow),
      apiKey: updatedApiKeyRow,
      grantedTokens,
      alreadyCompleted,
    };
  });

  return result;
}

export async function revokeOrderPurchasedTokens(id, additionalData = {}) {
  const db = await getAdapter();
  let result = null;

  db.transaction(() => {
    const orderRow = db.get("SELECT * FROM orders WHERE id = ?", [id]);
    if (!orderRow) throw new Error("Order not found");

    const apiKeyRow = db.get("SELECT * FROM apiKeys WHERE id = ?", [orderRow.apiKeyId]);
    if (!apiKeyRow) throw new Error("API key not found");

    const alreadyRevoked = orderRow.status === "failed" || orderRow.status === "cancelled" || orderRow.status === "refunded";
    const shouldRevokeTokens = (orderRow.status === "completed" || orderRow.status === "success") && !alreadyRevoked;
    const now = new Date().toISOString();
    const reason = additionalData.reason || "admin-revoke";
    const existingPaymentData = rowToOrder(orderRow)?.paymentData || {};
    const nextPaymentData = JSON.stringify({
      ...existingPaymentData,
      revoke: { reason, at: now, tokens: shouldRevokeTokens ? Number(orderRow.tokenAmount || 0) : 0 },
    });

    let revokedTokens = 0;
    if (shouldRevokeTokens) {
      const orderTokens = Number(orderRow.tokenAmount || 0);
      const currentPurchasedLimit = Number(apiKeyRow.purchasedTokenLimit || 0);
      revokedTokens = Math.min(orderTokens, currentPurchasedLimit);
      const nextPurchasedLimit = Math.max(0, currentPurchasedLimit - revokedTokens);
      db.run(
        `UPDATE apiKeys SET purchasedTokenLimit = ?, updatedAt = ? WHERE id = ?`,
        [nextPurchasedLimit, now, orderRow.apiKeyId]
      );
    }

    db.run(
      `UPDATE orders SET status = ?, paymentData = ?, updatedAt = ? WHERE id = ?`,
      ["failed", nextPaymentData, now, id]
    );

    result = {
      order: rowToOrder(db.get("SELECT * FROM orders WHERE id = ?", [id])),
      apiKey: db.get("SELECT * FROM apiKeys WHERE id = ?", [orderRow.apiKeyId]),
      revokedTokens,
      alreadyRevoked,
    };
  });

  return result;
}

export async function getOrderStats(apiKeyId) {
  const db = await getAdapter();
  return db.get(
    `SELECT COUNT(*) as totalOrders,
            SUM(CASE WHEN status = 'completed' OR status = 'success' THEN 1 ELSE 0 END) as completedOrders,
            SUM(CASE WHEN status = 'completed' OR status = 'success' THEN tokenAmount ELSE 0 END) as totalTokensPurchased,
            SUM(CASE WHEN status = 'completed' OR status = 'success' THEN price ELSE 0 END) as totalSpent
     FROM orders WHERE apiKeyId = ?`,
    [apiKeyId]
  );
}

export async function deleteOrder(id) {
  const db = await getAdapter();
  const res = db.run("DELETE FROM orders WHERE id = ?", [id]);
  return (res?.changes ?? 0) > 0;
}
