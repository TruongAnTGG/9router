"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Modal, Toggle } from "@/shared/components";

export default function TokenPackagesPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", tokenAmount: "", price: "", currency: "VND", isActive: true, displayOrder: "0", description: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/token-packages", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setPackages(data.packages || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", tokenAmount: "", price: "", currency: "VND", isActive: true, displayOrder: "0", description: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      tokenAmount: String(item.tokenAmount || ""),
      price: String(item.price || ""),
      currency: item.currency || "VND",
      isActive: item.isActive !== false,
      displayOrder: String(item.displayOrder || 0),
      description: item.description || "",
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.tokenAmount || !form.price) return;
    const payload = {
      ...form,
      tokenAmount: Number(form.tokenAmount),
      price: Number(form.price),
      displayOrder: Number(form.displayOrder || 0),
    };
    const url = editing ? `/api/admin/token-packages/${editing.id}` : "/api/admin/token-packages";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowModal(false);
      await loadData();
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete token package?")) return;
    const res = await fetch(`/api/admin/token-packages/${id}`, { method: "DELETE" });
    if (res.ok) setPackages((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Token Packages</h1>
          <p className="text-sm text-text-muted mt-1">Admin cấu hình gói mua thêm token</p>
        </div>
        <Button icon="add" onClick={openCreate}>Add Package</Button>
      </div>

      <Card>
        {loading ? <p className="text-sm text-text-muted">Loading...</p> : (
          <div className="space-y-3">
            {packages.length === 0 ? <p className="text-sm text-text-muted">No packages</p> : packages.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-text-muted">{Number(item.tokenAmount || 0).toLocaleString()} tokens • {Number(item.price || 0).toLocaleString()} {item.currency || "VND"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => openEdit(item)}>Edit</Button>
                    <Button variant="ghost" onClick={() => remove(item.id)}>Delete</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Token Package" : "Add Token Package"}>
        <div className="space-y-3">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Token Amount" type="number" value={form.tokenAmount} onChange={(e) => setForm((f) => ({ ...f, tokenAmount: e.target.value }))} />
          <Input label="Price" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          <Input label="Currency" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
          <Input label="Display Order" type="number" value={form.displayOrder} onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))} />
          <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="flex items-center justify-between">
            <span className="text-sm">Active</span>
            <Toggle checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
          </div>
          <div className="flex justify-end">
            <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
