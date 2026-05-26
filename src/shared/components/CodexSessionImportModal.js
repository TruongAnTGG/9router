"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import Modal from "./Modal";
import Button from "./Button";

export default function CodexSessionImportModal({ isOpen, onSuccess, onClose }) {
  const [sessionText, setSessionText] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    const value = sessionText.trim();
    if (!value) {
      setError("Paste a ChatGPT session JSON or Codex OAuth token JSON");
      return;
    }

    setImporting(true);
    setError("");

    try {
      let payload;
      try {
        payload = JSON.parse(value);
      } catch {
        payload = { session: value };
      }

      const res = await fetch("/api/oauth/codex/import-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setSessionText("");
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title="Import Codex Session" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            Session imports are access-token only unless the JSON includes refresh_token. Access-only connections expire when the token expires.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Session JSON</label>
          <textarea
            value={sessionText}
            onChange={(e) => setSessionText(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder='{"accessToken":"...","user":{"email":"..."},"account":{"id":"...","planType":"..."}}'
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleImport} fullWidth disabled={importing || !sessionText.trim()}>
            {importing ? "Importing..." : "Import"}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth disabled={importing}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

CodexSessionImportModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
