"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Button, Input, Modal, CardSkeleton, ConfirmModal, Toggle } from "@/shared/components";

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  instructions: "",
  tags: "",
  isActive: true,
};

export default function SkillsPage() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [generateBrief, setGenerateBrief] = useState("");
  const [generateModel, setGenerateModel] = useState("");
  const [generateApiKey, setGenerateApiKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/skills", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setSkills(data.skills || []);
      else setError(data.error || "Failed to load skills");
    } catch (err) {
      console.log("Error loading skills:", err);
      setError("Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSkills();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSkills]);

  const openCreate = () => {
    setEditingSkill(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowModal(true);
  };

  const openEdit = (skill) => {
    setEditingSkill(skill);
    setForm({
      name: skill.name || "",
      slug: skill.slug || "",
      description: skill.description || "",
      instructions: skill.instructions || "",
      tags: (skill.tags || []).join(", "),
      isActive: skill.isActive !== false,
    });
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSkill(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  const buildPayload = () => ({
    ...form,
    tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
  });

  const saveSkill = async () => {
    if (!form.name.trim() || !form.instructions.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(editingSkill ? `/api/skills/${editingSkill.id}` : "/api/skills", {
        method: editingSkill ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save skill");
        return;
      }
      await loadSkills();
      closeModal();
    } catch (err) {
      console.log("Error saving skill:", err);
      setError("Failed to save skill");
    } finally {
      setSaving(false);
    }
  };

  const deleteSkill = (skill) => {
    setConfirmState({
      title: "Delete Skill",
      message: `Delete skill “${skill.name}”? API keys using it will no longer be able to apply it.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });
          if (res.ok) setSkills((prev) => prev.filter((item) => item.id !== skill.id));
        } catch (err) {
          console.log("Error deleting skill:", err);
        }
      },
    });
  };

  const generateSkill = async () => {
    if (!generateBrief.trim() || !generateModel.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/skills/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: generateModel, brief: generateBrief, apiKey: generateApiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate skill");
        return;
      }
      const skill = data.skill || {};
      setEditingSkill(null);
      setForm({
        name: skill.name || "",
        slug: skill.slug || "",
        description: skill.description || "",
        instructions: skill.instructions || "",
        tags: Array.isArray(skill.tags) ? skill.tags.join(", ") : "",
        isActive: true,
      });
      setShowModal(true);
    } catch (err) {
      console.log("Error generating skill:", err);
      setError("Failed to generate skill");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">extension</span>
            Skills
          </h1>
          <p className="mt-1 text-sm text-text-muted">Create reusable LLM instructions, then attach allowed skills to API keys.</p>
        </div>
        <Button icon="add" onClick={openCreate}>Create Skill</Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-text-muted">Admin brief</label>
            <textarea
              value={generateBrief}
              onChange={(e) => setGenerateBrief(e.target.value)}
              className="min-h-[96px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
              placeholder="Example: Create a support skill for Vietnamese customers. Answer briefly, ask clarifying questions when missing data, never invent policy."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
            <Input label="Generator model" value={generateModel} onChange={(e) => setGenerateModel(e.target.value)} placeholder="openai/gpt-4.1-mini" />
            <Input label="Generator API key" value={generateApiKey} onChange={(e) => setGenerateApiKey(e.target.value)} placeholder="Optional" />
            <div className="sm:col-span-2">
              <Button onClick={generateSkill} disabled={generating || !generateBrief.trim() || !generateModel.trim()} fullWidth icon="auto_awesome">
                {generating ? "Generating..." : "Generate Draft Skill"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : skills.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[32px]">extension</span>
            </div>
            <p className="font-medium text-text-main">No skills yet</p>
            <p className="mt-1 text-sm text-text-muted">Create one manually or generate a draft with LLM.</p>
            <div className="mt-4"><Button icon="add" onClick={openCreate}>Create Skill</Button></div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {skills.map((skill) => (
            <Card key={skill.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-base font-semibold text-text-main">{skill.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${skill.isActive ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-orange-500/10 text-orange-500"}`}>
                      {skill.isActive ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-text-muted">{skill.slug}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" icon="edit" onClick={() => openEdit(skill)}>Edit</Button>
                  <Button size="sm" variant="ghost" icon="delete" onClick={() => deleteSkill(skill)}>Delete</Button>
                </div>
              </div>
              {skill.description ? <p className="mt-3 text-sm text-text-muted">{skill.description}</p> : null}
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-surface-2 p-3 text-xs text-text-main whitespace-pre-wrap">{skill.instructions}</pre>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
                <span>ID: <code>{skill.id}</code></span>
                {(skill.tags || []).map((tag) => <span key={tag} className="rounded-full bg-surface-2 px-2 py-0.5">{tag}</span>)}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} title={editingSkill ? "Edit Skill" : "Create Skill"} onClose={closeModal} size="full" className="max-w-3xl">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Vietnamese Support" />
            <Input label="Slug" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="vietnamese-support" hint="Can be used as skill selector" />
          </div>
          <Input label="Description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Short purpose for admins and users" />
          <Input label="Tags" value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} placeholder="support, vietnamese" hint="Comma separated" />
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Instructions</label>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
              className="min-h-[260px] w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-text-main outline-none focus:border-primary"
              placeholder="Skill instructions injected as system message..."
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3">
            <div>
              <p className="text-sm font-medium text-text-main">Active</p>
              <p className="text-xs text-text-muted">Paused skills cannot be applied by API keys.</p>
            </div>
            <Toggle checked={form.isActive} onChange={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSkill} disabled={saving || !form.name.trim() || !form.instructions.trim()} fullWidth>{saving ? "Saving..." : "Save"}</Button>
            <Button onClick={closeModal} variant="ghost" fullWidth>Cancel</Button>
          </div>
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
