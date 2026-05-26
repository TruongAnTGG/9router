import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

const VALID_STATUSES = new Set(["new", "contacted", "qualified", "closed", "ignored"]);

function clean(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function rowToLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    company: row.company || "",
    packageName: row.packageName || "",
    tokenVolume: row.tokenVolume || "",
    budget: row.budget || "",
    message: row.message || "",
    status: row.status || "new",
    source: row.source || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || null,
  };
}

export async function createCustomerLead(input = {}) {
  const name = clean(input.name, 160);
  const email = clean(input.email, 240);
  const phone = clean(input.phone, 80);
  const company = clean(input.company, 180);
  const packageName = clean(input.packageName, 180);
  const tokenVolume = clean(input.tokenVolume, 120);
  const budget = clean(input.budget, 120);
  const message = clean(input.message, 2000);
  const source = clean(input.source || "landing", 120);

  if (!name) throw new Error("Name is required");
  if (!email && !phone) throw new Error("Email or phone is required");

  const db = await getAdapter();
  const now = new Date().toISOString();
  const lead = {
    id: uuidv4(),
    name,
    email,
    phone,
    company,
    packageName,
    tokenVolume,
    budget,
    message,
    status: "new",
    source,
    createdAt: now,
    updatedAt: now,
  };

  db.run(
    `INSERT INTO customerLeads(id, name, email, phone, company, packageName, tokenVolume, budget, message, status, source, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [lead.id, lead.name, lead.email, lead.phone, lead.company, lead.packageName, lead.tokenVolume, lead.budget, lead.message, lead.status, lead.source, lead.createdAt, lead.updatedAt]
  );

  return lead;
}

export async function getCustomerLeads(options = {}) {
  const db = await getAdapter();
  const status = clean(options.status, 40);
  const limit = Math.min(Math.max(Number.parseInt(options.limit || "200", 10) || 200, 1), 500);

  const rows = status && VALID_STATUSES.has(status)
    ? db.all(`SELECT * FROM customerLeads WHERE status = ? ORDER BY createdAt DESC LIMIT ?`, [status, limit])
    : db.all(`SELECT * FROM customerLeads ORDER BY createdAt DESC LIMIT ?`, [limit]);

  return rows.map(rowToLead);
}

export async function updateCustomerLeadStatus(id, status) {
  const nextStatus = clean(status, 40);
  if (!VALID_STATUSES.has(nextStatus)) throw new Error("Invalid lead status");

  const db = await getAdapter();
  const now = new Date().toISOString();
  const result = db.run(`UPDATE customerLeads SET status = ?, updatedAt = ? WHERE id = ?`, [nextStatus, now, id]);
  if ((result?.changes ?? 0) === 0) return null;
  return rowToLead(db.get(`SELECT * FROM customerLeads WHERE id = ?`, [id]));
}

