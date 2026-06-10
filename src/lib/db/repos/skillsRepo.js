import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeSkillInput(data = {}) {
  const name = String(data.name || "").trim();
  const slug = String(data.slug || name).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const instructions = String(data.instructions || "").trim();
  return {
    name,
    slug,
    description: String(data.description || "").trim(),
    instructions,
    tags: normalizeList(data.tags),
    isActive: data.isActive !== false,
  };
}

function rowToSkill(row) {
  if (!row) return null;
  const data = parseJson(row.data, {});
  return {
    id: row.id,
    name: data.name || "",
    slug: data.slug || "",
    description: data.description || "",
    instructions: data.instructions || "",
    tags: normalizeList(data.tags),
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getSkills({ activeOnly = false } = {}) {
  const db = await getAdapter();
  const rows = activeOnly
    ? db.all(`SELECT * FROM skills WHERE isActive = 1 ORDER BY createdAt ASC`)
    : db.all(`SELECT * FROM skills ORDER BY createdAt ASC`);
  return rows.map(rowToSkill);
}

export async function getSkillById(id) {
  const db = await getAdapter();
  return rowToSkill(db.get(`SELECT * FROM skills WHERE id = ?`, [id]));
}

export async function getSkillBySlug(slug) {
  const db = await getAdapter();
  return rowToSkill(db.get(`SELECT * FROM skills WHERE json_extract(data, '$.slug') = ?`, [slug]));
}

export async function createSkill(data) {
  const skill = normalizeSkillInput(data);
  if (!skill.name) throw new Error("Skill name is required");
  if (!skill.slug) throw new Error("Skill slug is required");
  if (!skill.instructions) throw new Error("Skill instructions are required");
  const db = await getAdapter();
  const now = new Date().toISOString();
  const id = uuidv4();
  db.run(
    `INSERT INTO skills(id, isActive, data, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?)`,
    [id, skill.isActive ? 1 : 0, stringifyJson(skill), now, now]
  );
  return rowToSkill({ id, isActive: skill.isActive ? 1 : 0, data: stringifyJson(skill), createdAt: now, updatedAt: now });
}

export async function updateSkill(id, data) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM skills WHERE id = ?`, [id]);
  if (!row) return null;
  const current = rowToSkill(row);
  const merged = normalizeSkillInput({ ...current, ...data });
  const now = new Date().toISOString();
  db.run(`UPDATE skills SET isActive = ?, data = ?, updatedAt = ? WHERE id = ?`, [merged.isActive ? 1 : 0, stringifyJson(merged), now, id]);
  return rowToSkill({ id, isActive: merged.isActive ? 1 : 0, data: stringifyJson(merged), createdAt: current.createdAt, updatedAt: now });
}

export async function deleteSkill(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM skills WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}
