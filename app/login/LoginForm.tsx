"use client";
import { useState } from "react";

export default function LoginForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Connexion impossible");
      window.location.href = "/taches";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="lbl" htmlFor="code">
          Code d&apos;accès
        </label>
        <input
          id="code"
          className="field font-mono tracking-[0.15em] uppercase text-base"
          placeholder="PRG-XXXX-XXXX"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-danger bg-danger-tint rounded-md px-3 py-2">{error}</p>}
      <button className="btn btn-primary w-full py-3" disabled={busy || code.trim().length < 4}>
        {busy ? "Vérification…" : "Entrer dans l'espace"}
      </button>
    </form>
  );
}
