"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Button } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

const statusOptions = [
  { value: "new", label: "New", className: "bg-brand-500/10 text-brand-600 border-brand-500/20" },
  { value: "contacted", label: "Contacted", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "qualified", label: "Qualified", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  { value: "closed", label: "Closed", className: "bg-surface-2 text-text-muted border-border-subtle" },
  { value: "ignored", label: "Ignored", className: "bg-red-500/10 text-red-600 border-red-500/20" },
];

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

function statusMeta(value) {
  return statusOptions.find((item) => item.value === value) || statusOptions[0];
}

export default function CustomerLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return leads.reduce((acc, lead) => {
      acc[lead.status || "new"] = (acc[lead.status || "new"] || 0) + 1;
      return acc;
    }, {});
  }, [leads]);

  async function loadLeads() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer-leads", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load leads");
      setLeads(data.leads || []);
    } catch (err) {
      setError(err?.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, status) {
    setSavingId(id);
    setError("");
    try {
      const res = await fetch(`/api/customer-leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update lead");
      setLeads((prev) => prev.map((lead) => (lead.id === id ? data.lead : lead)));
    } catch (err) {
      setError(err?.message || "Failed to update lead");
    } finally {
      setSavingId("");
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadLeads();
    });
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-main">Customer Leads</h1>
            <p className="mt-1 text-sm text-text-muted">Requests submitted from the public landing page.</p>
          </div>
          <Button variant="outline" icon="refresh" onClick={loadLeads} loading={loading}>
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {statusOptions.map((item) => (
            <Card key={item.value} padding="sm">
              <div className="text-xs uppercase tracking-wide text-text-muted">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold text-text-main">{counts[item.value] || 0}</div>
            </Card>
          ))}
        </div>

        {error ? (
          <Card padding="sm" className="border-red-500/20 bg-red-500/5 text-red-500">
            {error}
          </Card>
        ) : null}

        <Card padding="none" elev className="overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-3 p-6 text-text-muted">
              <span className="material-symbols-outlined animate-spin text-brand-500">progress_activity</span>
              Loading leads...
            </div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-text-muted">No customer requests yet.</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {leads.map((lead) => {
                const meta = statusMeta(lead.status);
                return (
                  <div key={lead.id} className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-[1fr_220px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-text-main">{lead.name}</h2>
                        <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", meta.className)}>
                          {meta.label}
                        </span>
                        {lead.packageName ? (
                          <span className="rounded-full border border-border-subtle bg-bg px-2.5 py-1 text-xs text-text-muted">
                            {lead.packageName}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-text-muted md:grid-cols-2">
                        <Info icon="mail" value={lead.email || "No email"} />
                        <Info icon="call" value={lead.phone || "No phone"} />
                        <Info icon="business" value={lead.company || "No company"} />
                        <Info icon="schedule" value={formatDate(lead.createdAt)} />
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Mini label="Token volume" value={lead.tokenVolume || "Not specified"} />
                        <Mini label="Budget" value={lead.budget || "Not specified"} />
                        <Mini label="Source" value={lead.source || "landing"} />
                      </div>
                      {lead.message ? (
                        <div className="mt-4 rounded-[10px] border border-border-subtle bg-bg p-3 text-sm leading-6 text-text-main">
                          {lead.message}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-text-main">Status</label>
                      <select
                        value={lead.status || "new"}
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        disabled={savingId === lead.id}
                        className="h-10 rounded-[10px] border border-border-subtle bg-surface-2 px-3 text-sm text-text-main outline-none focus:border-brand-500/40 focus:ring-2 focus:ring-brand-500/20"
                      >
                        {statusOptions.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                      <a
                        href={lead.email ? `mailto:${lead.email}` : lead.phone ? `tel:${lead.phone.replace(/\s+/g, "")}` : undefined}
                        className={cn(
                          "inline-flex h-10 items-center justify-center rounded-[10px] border border-border-subtle bg-bg px-3 text-sm font-medium text-text-main transition-colors hover:border-brand-500/40 hover:text-brand-600",
                          !lead.email && !lead.phone && "pointer-events-none opacity-50"
                        )}
                      >
                        Contact
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Info({ icon, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="material-symbols-outlined text-[17px] text-text-subtle">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-text-main">{value}</div>
    </div>
  );
}
