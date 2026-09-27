"use client";
import { useState } from "react";
import { THREAD_CATEGORIES, categoryColor } from "@/lib/shared";

export function CategoryChip({ name, small, count }: { name: string; small?: boolean; count?: number }) {
  const color = categoryColor(name);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${small ? "text-[11px] px-2 py-[1px]" : "text-xs px-2.5 py-0.5"}`}
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 45%, transparent)` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {name}
      {!!count && <span className="font-mono opacity-75">{count}</span>}
    </span>
  );
}

/** Sélection de catégorie : les 7 catégories fixes (+ catégories personnalisées existantes, + « Autre »). */
export function CategoryPicker({ value, onChange, extra = [] }: { value: string; onChange: (v: string) => void; extra?: string[] }) {
  const fixed = THREAD_CATEGORIES.map((c) => c.name);
  const others = extra.filter((c) => !fixed.some((f) => f.toLowerCase() === c.toLowerCase()));
  const all = [...fixed, ...others];
  const [custom, setCustom] = useState(!all.includes(value));
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {all.map((c) => {
          const color = categoryColor(c);
          const on = !custom && value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCustom(false);
                onChange(c);
              }}
              className="text-xs font-medium px-2.5 py-1 rounded-full border transition-colors"
              style={on ? { background: color, borderColor: color, color: "#fff" } : { borderColor: "var(--line)", color }}
            >
              {c}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setCustom(true);
            onChange("");
          }}
          className={`text-xs px-2.5 py-1 rounded-full border ${custom ? "border-ink text-ink" : "border-dashed border-line text-ink-soft"}`}
        >
          + Autre…
        </button>
      </div>
      {custom && (
        <input className="field !py-1.5 mt-2" autoFocus placeholder="Nom de la nouvelle catégorie" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
