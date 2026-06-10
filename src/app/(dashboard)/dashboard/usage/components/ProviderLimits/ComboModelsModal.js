"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Modal, ModelSelectModal } from "@/shared/components";

function sameModels(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function ModelRow({ model, index, isFirst, isLast, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.02] px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.03]">
      <span className="w-5 shrink-0 text-center text-[10px] font-medium text-text-muted">
        {index + 1}
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-text-primary">
        {model}
      </code>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst}
        className="rounded p-1 text-text-muted transition-colors hover:bg-black/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/5"
        title="Move up"
      >
        <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast}
        className="rounded p-1 text-text-muted transition-colors hover:bg-black/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/5"
        title="Move down"
      >
        <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
        title="Remove model"
      >
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </div>
  );
}

export default function ComboModelsModal({ isOpen, onClose, activeProviders = [] }) {
  const [combos, setCombos] = useState([]);
  const [selectedComboId, setSelectedComboId] = useState("");
  const [models, setModels] = useState([]);
  const [modelAliases, setModelAliases] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoading(true);
        setError("");
        return Promise.all([
          fetch("/api/combos").then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to fetch combos")))),
          fetch("/api/models/alias").then((res) => (res.ok ? res.json() : { aliases: {} })),
        ]);
      })
      .then((result) => {
        if (cancelled || !result) return;
        const [comboData, aliasData] = result;
        const llmCombos = (comboData.combos || []).filter((combo) => !combo.kind);
        setCombos(llmCombos);
        setModelAliases(aliasData.aliases || {});

        const selectedStillExists = llmCombos.some((combo) => combo.id === selectedComboId);
        const nextCombo = selectedStillExists
          ? llmCombos.find((combo) => combo.id === selectedComboId)
          : llmCombos[0];

        setSelectedComboId(nextCombo?.id || "");
        setModels(nextCombo?.models || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load combos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCombo = useMemo(
    () => combos.find((combo) => combo.id === selectedComboId) || null,
    [combos, selectedComboId],
  );

  const dirty = selectedCombo ? !sameModels(models, selectedCombo.models || []) : false;

  const handleSelectCombo = (comboId) => {
    const combo = combos.find((item) => item.id === comboId);
    setSelectedComboId(comboId);
    setModels(combo?.models || []);
    setError("");
  };

  const handleAddModel = (model) => {
    const value = model?.value || model?.name || model;
    if (!value || models.includes(value)) return;
    setModels((prev) => [...prev, value]);
  };

  const handleDeselectModel = (model) => {
    const value = model?.value || model?.name || model;
    setModels((prev) => prev.filter((item) => item !== value));
  };

  const handleMove = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= models.length) return;
    setModels((prev) => {
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedCombo || saving) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/combos/${selectedCombo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update combo");
      }

      const updatedCombo = await res.json();
      setCombos((prev) =>
        prev.map((combo) => (combo.id === updatedCombo.id ? updatedCombo : combo)),
      );
      setModels(updatedCombo.models || []);
    } catch (err) {
      setError(err.message || "Failed to update combo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Combo Models" size="lg">
        <div className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-text-muted">
              <span className="material-symbols-outlined animate-spin text-[28px]">
                progress_activity
              </span>
            </div>
          ) : combos.length === 0 ? (
            <div className="py-10 text-center text-text-muted">
              <span className="material-symbols-outlined text-[42px] opacity-30">
                layers_clear
              </span>
              <p className="mt-2 text-sm">No combos configured</p>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Combo</label>
                <select
                  value={selectedComboId}
                  onChange={(event) => handleSelectCombo(event.target.value)}
                  className="h-9 w-full rounded-lg border border-black/10 bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary dark:border-white/10"
                >
                  {combos.map((combo) => (
                    <option key={combo.id} value={combo.id}>
                      {combo.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium">Models</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    icon="add"
                    onClick={() => setShowModelSelect(true)}
                  >
                    Add Model
                  </Button>
                </div>

                {models.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-black/10 py-8 text-center text-text-muted dark:border-white/10">
                    <span className="material-symbols-outlined text-[32px] opacity-30">layers</span>
                    <p className="mt-1 text-xs">No models selected</p>
                  </div>
                ) : (
                  <div className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto pr-1">
                    {models.map((model, index) => (
                      <ModelRow
                        key={`${model}-${index}`}
                        model={model}
                        index={index}
                        isFirst={index === 0}
                        isLast={index === models.length - 1}
                        onMoveUp={() => handleMove(index, -1)}
                        onMoveDown={() => handleMove(index, 1)}
                        onRemove={() => setModels((prev) => prev.filter((_, i) => i !== index))}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto">
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  loading={saving}
                  className="w-full sm:w-auto"
                >
                  Save Models
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ModelSelectModal
        isOpen={showModelSelect}
        onClose={() => setShowModelSelect(false)}
        onSelect={handleAddModel}
        onDeselect={handleDeselectModel}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title="Add Model to Combo"
        addedModelValues={models}
        closeOnSelect={false}
      />
    </>
  );
}
