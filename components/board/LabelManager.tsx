"use client";
import { useState } from "react";
import { api, Modal, useApp } from "../client";
import { type Label, LABEL_COLORS } from "./helpers";

export default function LabelManager({ labels, onClose, reload }: { labels: Label[]; onClose: () => void; reload: () => void }) {
  const { toast } = useApp();
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[3]);

  async function run(p: Promise<unknown>) {
    try {
      await p;
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  return (
    <Modal open onClose={onClose} title="Étiquettes du tableau">
      <p className="text-sm text-ink-soft mb-4">
        Comme sur Trello, les étiquettes de couleur classent les cartes (thème, équipe, urgence…). Une carte peut en porter plusieurs.
      </p>
      <ul className="space-y-2 mb-5">
        {labels.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <ColorPicker value={l.color} onChange={(c) => run(api(`/api/labels/${l.id}`, "PATCH", { color: c }))} />
            <input
              className="field !py-1 flex-1"
              defaultValue={l.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== l.name && run(api(`/api/labels/${l.id}`, "PATCH", { name: e.target.value }))}
            />
            <button
              className="btn btn-danger btn-sm"
              onClick={() => confirm(`Supprimer l'étiquette « ${l.name} » ?`) && run(api(`/api/labels/${l.id}`, "DELETE"))}
            >
              Suppr.
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-line pt-4">
        <ColorPicker value={color} onChange={setColor} />
        <input className="field !py-1 flex-1" placeholder="Nouvelle étiquette" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn btn-primary btn-sm"
          disabled={!name.trim()}
          onClick={() => {
            run(api("/api/labels", "POST", { name, color }));
            setName("");
          }}
        >
          Ajouter
        </button>
      </div>
    </Modal>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="w-8 h-8 rounded-md border border-line" style={{ background: value }} onClick={() => setOpen(!open)} aria-label="Couleur" />
      {open && (
        <div className="absolute z-10 top-9 left-0 card p-2 grid grid-cols-6 gap-1.5 w-48 shadow-lg">
          {LABEL_COLORS.map((c) => (
            <button
              key={c}
              className="w-6 h-6 rounded"
              style={{ background: c, outline: c === value ? "2px solid var(--ink)" : "none", outlineOffset: 1 }}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
