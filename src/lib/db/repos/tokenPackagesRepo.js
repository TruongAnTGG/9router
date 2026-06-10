import { nanoid } from "nanoid";
import { getAdapter } from "../driver.js";

function rowToPackage(row) {
  if (!row) return null;
  return {
    ...row,
    isActive: row.isActive === 1 || row.isActive === true,
    features: row.features ? JSON.parse(row.features) : null,
  };
}

export async function getTokenPackages({ activeOnly = false } = {}) {
  const db = await getAdapter();
  const sql = activeOnly
    ? "SELECT * FROM tokenPackages WHERE isActive = 1 ORDER BY displayOrder ASC, createdAt DESC"
    : "SELECT * FROM tokenPackages ORDER BY displayOrder ASC, createdAt DESC";
  return db.all(sql).map(rowToPackage);
}

export async function getTokenPackageById(id) {
  const db = await getAdapter();
  const row = db.get("SELECT * FROM tokenPackages WHERE id = ?", [id]);
  return rowToPackage(row);
}

export async function createTokenPackage(data) {
  const db = await getAdapter();
  const id = nanoid();
  const now = new Date().toISOString();
  const {
    name,
    description = null,
    tokenAmount,
    price,
    currency = "VND",
    isActive = true,
    displayOrder = 0,
    features = null,
  } = data;

  db.run(
    `INSERT INTO tokenPackages (id, name, description, tokenAmount, price, currency, isActive, displayOrder, features, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description, tokenAmount, price, currency, isActive ? 1 : 0, displayOrder, features ? JSON.stringify(features) : null, now, now]
  );

  return getTokenPackageById(id);
}

export async function updateTokenPackage(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get("SELECT * FROM tokenPackages WHERE id = ?", [id]);
    if (!row) throw new Error("Token package not found");

    const existing = rowToPackage(row);
    const merged = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    db.run(
      `UPDATE tokenPackages
       SET name = ?, description = ?, tokenAmount = ?, price = ?, currency = ?, isActive = ?, displayOrder = ?, features = ?, updatedAt = ?
       WHERE id = ?`,
      [
        merged.name,
        merged.description || null,
        Number(merged.tokenAmount || 0),
        Number(merged.price || 0),
        merged.currency || "VND",
        merged.isActive ? 1 : 0,
        Number(merged.displayOrder || 0),
        merged.features ? JSON.stringify(merged.features) : null,
        merged.updatedAt,
        id,
      ]
    );

    result = rowToPackage({
      ...row,
      ...merged,
      isActive: merged.isActive ? 1 : 0,
      features: merged.features ? JSON.stringify(merged.features) : null,
    });
  });
  return result;
}

export async function deleteTokenPackage(id) {
  const db = await getAdapter();
  const res = db.run("DELETE FROM tokenPackages WHERE id = ?", [id]);
  return (res?.changes ?? 0) > 0;
}
