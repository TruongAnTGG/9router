"use client";

import { useMemo, useState } from "react";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  packageName: "",
  tokenVolume: "",
  budget: "",
  message: "",
};

export default function LeadForm({ plans = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const planOptions = useMemo(() => plans.filter((plan) => plan?.name), [plans]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const res = await fetch("/api/public/customer-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit request");

      setForm(emptyForm);
      setStatus({ type: "success", message: "Request sent. We will contact you soon." });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Failed to submit request" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[18px] border border-white/10 bg-white/[0.035] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-[#E56A4A]/12 text-[#F4B59C]">
          <span className="material-symbols-outlined">assignment</span>
        </div>
        <div>
          <h3 className="font-semibold">Request token supply</h3>
          <p className="text-sm text-white/50">Leave your details and package need.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" value={form.name} onChange={(value) => updateField("name", value)} required />
        <Field label="Company" value={form.company} onChange={(value) => updateField("company", value)} />
        <Field label="Email" type="email" value={form.email} onChange={(value) => updateField("email", value)} />
        <Field label="Phone / Zalo" value={form.phone} onChange={(value) => updateField("phone", value)} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-white/72">Package</span>
          <select
            value={form.packageName}
            onChange={(e) => updateField("packageName", e.target.value)}
            className="h-11 rounded-xl border border-white/10 bg-[#101214] px-3 text-white outline-none transition-colors focus:border-[#E56A4A]/60"
          >
            <option value="">Select package</option>
            {planOptions.map((plan) => (
              <option key={plan.name} value={plan.name}>{plan.name}</option>
            ))}
            <option value="Custom">Custom volume</option>
          </select>
        </label>
        <Field label="Token volume" placeholder="1M / 5M / custom" value={form.tokenVolume} onChange={(value) => updateField("tokenVolume", value)} />
        <Field label="Budget" placeholder="$..." value={form.budget} onChange={(value) => updateField("budget", value)} />
      </div>

      <label className="mt-3 flex flex-col gap-1.5 text-sm">
        <span className="text-white/72">Message</span>
        <textarea
          rows={4}
          value={form.message}
          onChange={(e) => updateField("message", e.target.value)}
          placeholder="Use case, expected monthly tokens, preferred contact time..."
          className="resize-y rounded-xl border border-white/10 bg-[#101214] px-3 py-3 text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#E56A4A]/60"
        />
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#E56A4A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#cc5236] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send request"}
        </button>
        {status.message ? (
          <p className={`text-sm ${status.type === "error" ? "text-red-300" : "text-green-300"}`}>{status.message}</p>
        ) : (
          <p className="text-sm text-white/42">Name and email or phone are required.</p>
        )}
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", required = false }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-white/72">{label}{required ? <span className="text-[#F4B59C]"> *</span> : null}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-11 rounded-xl border border-white/10 bg-[#101214] px-3 text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#E56A4A]/60"
      />
    </label>
  );
}

