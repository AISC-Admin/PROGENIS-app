"use client";
import { useState } from "react";
import { api, Avatar, fmtDate, Modal, RoleBadge, timeAgo, useApp, usePolling } from "../client";
import { BRAND } from "@/lib/brand";

type Member = {
  id: number;
  name: string;
  email: string | null;
  role: "manager" | "editeur" | "visionneur";
  color: string;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
};
type Activity = { id: number; action: string; details: string; created_at: string; user_name: string | null; user_color: string | null };

const ROLE_HELP = {
  manager: "Tous les droits + gestion des accès",
  editeur: "Crée et modifie cartes, messages, projet",
  visionneur: "Consultation uniquement",
};

export default function AccessManager() {
  const { me, toast } = useApp();
  const { data: members, reload } = usePolling<Member[]>("/api/users", 20000);
  const { data: activity } = usePolling<Activity[]>("/api/activity", 20000);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "editeur" });
  const [revealed, setRevealed] = useState<{ name: string; code: string } | null>(null);

  async function create() {
    try {
      const r = await api<{ user: Member; code: string }>("/api/users", "POST", form);
      setAdding(false);
      setForm({ name: "", email: "", role: "editeur" });
      setRevealed({ name: r.user.name, code: r.code });
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function patch(m: Member, body: Partial<Member>) {
    try {
      await api(`/api/users/${m.id}`, "PATCH", body);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function regenerate(m: Member) {
    if (!confirm(`Générer un nouveau code pour ${m.name} ? L'ancien code ne fonctionnera plus et ses sessions seront fermées.`)) return;
    try {
      const r = await api<{ code: string }>(`/api/users/${m.id}/code`, "POST");
      setRevealed({ name: m.name, code: r.code });
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  const active = (members ?? []).filter((m) => m.active);
  const inactive = (members ?? []).filter((m) => !m.active);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1">04 — Accès</p>
          <h1 className="text-3xl">Gestion des participants</h1>
          <p className="text-sm text-ink-soft mt-1">
            Créez les accès, choisissez qui est <strong>éditeur</strong> ou <strong>visionneur</strong>, et régénérez les codes si besoin.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Ajouter un participant
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-amber/40 bg-amber-tint px-4 py-3 text-sm">
        <strong>Sécurité :</strong> le premier compte manager se connecte avec le code défini dans Vercel
        (<code className="font-mono text-xs">MANAGER_BOOTSTRAP_CODE</code>). Vous pouvez le garder ou le remplacer à tout moment avec
        « Nouveau code » sur votre ligne. Après 8 codes erronés, une adresse est bloquée 15 minutes.
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {(["manager", "editeur", "visionneur"] as const).map((r) => (
          <div key={r} className="card p-4">
            <div className="flex items-center justify-between">
              <RoleBadge role={r} />
              <span className="serif text-2xl text-moss">{active.filter((m) => m.role === r).length}</span>
            </div>
            <p className="text-xs text-ink-soft mt-2">{ROLE_HELP[r]}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto mb-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-line">
              {["Participant", "Rôle", "Dernière connexion", "Code d'accès", "Statut"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...active, ...inactive].map((m) => (
              <tr key={m.id} className={m.active ? "" : "opacity-50"}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} color={m.color} size={32} />
                    <div className="min-w-0">
                      <input
                        className="bg-transparent font-medium outline-none border-b border-transparent focus:border-moss w-full"
                        defaultValue={m.name}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== m.name && patch(m, { name: e.target.value })}
                      />
                      <input
                        className="bg-transparent text-xs text-ink-soft outline-none border-b border-transparent focus:border-moss w-full"
                        placeholder="email (facultatif)"
                        defaultValue={m.email ?? ""}
                        onBlur={(e) => e.target.value !== (m.email ?? "") && patch(m, { email: e.target.value })}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select className="field !py-1 !w-36" value={m.role} onChange={(e) => patch(m, { role: e.target.value as Member["role"] })}>
                    <option value="manager">Manager</option>
                    <option value="editeur">Éditeur</option>
                    <option value="visionneur">Visionneur</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-ink-soft text-xs whitespace-nowrap">
                  {m.last_login_at ? timeAgo(m.last_login_at) : "jamais"}
                  <div className="font-mono text-[10px]">créé le {fmtDate(m.created_at)}</div>
                </td>
                <td className="px-4 py-3">
                  <button className="btn btn-ghost btn-sm" onClick={() => regenerate(m)}>
                    Nouveau code
                  </button>
                </td>
                <td className="px-4 py-3">
                  {m.id === me.id ? (
                    <span className="text-xs text-ink-soft">vous</span>
                  ) : (
                    <button className={`btn btn-sm ${m.active ? "btn-danger" : "btn-ghost"}`} onClick={() => patch(m, { active: !m.active })}>
                      {m.active ? "Désactiver" : "Réactiver"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl mb-3">Journal d&apos;activité</h2>
      <ul className="card divide-y divide-line text-sm max-h-[420px] overflow-y-auto">
        {(activity ?? []).map((a) => (
          <li key={a.id} className="px-4 py-2 flex items-center gap-3">
            <Avatar name={a.user_name ?? "?"} color={a.user_color ?? "#888"} size={22} />
            <span className="flex-1 min-w-0">
              <strong className="font-medium">{a.user_name ?? "—"}</strong> · {a.action}
              {a.details && <span className="text-ink-soft"> — {a.details}</span>}
            </span>
            <span className="text-xs text-ink-soft font-mono whitespace-nowrap">{fmtDate(a.created_at, true)}</span>
          </li>
        ))}
        {activity && activity.length === 0 && <li className="px-4 py-3 text-ink-soft">Aucune activité.</li>}
      </ul>

      <Modal open={adding} onClose={() => setAdding(false)} title="Nouveau participant">
        <div className="space-y-3">
          <div>
            <label className="lbl">Nom</label>
            <input className="field" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Prénom Nom" />
          </div>
          <div>
            <label className="lbl">Email (facultatif)</label>
            <input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="lbl">Rôle</label>
            <div className="grid grid-cols-3 gap-2">
              {(["editeur", "visionneur", "manager"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setForm({ ...form, role: r })}
                  className={`rounded-lg border p-2.5 text-left ${form.role === r ? "border-moss bg-moss-tint" : "border-line"}`}
                >
                  <RoleBadge role={r} />
                  <span className="block text-[11px] text-ink-soft mt-1.5 leading-snug">{ROLE_HELP[r]}</span>
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary w-full" disabled={!form.name.trim()} onClick={create}>
            Créer l&apos;accès et générer le code
          </button>
        </div>
      </Modal>

      <Modal open={!!revealed} onClose={() => setRevealed(null)} title="Code d'accès généré">
        {revealed && (
          <div className="space-y-4">
            <p className="text-sm">
              Transmettez ce code à <strong>{revealed.name}</strong>. Pour des raisons de sécurité, il n&apos;est affiché{" "}
              <strong>qu&apos;une seule fois</strong> (il est stocké chiffré).
            </p>
            <div className="rounded-lg bg-paper-3 border border-line p-4 text-center font-mono text-2xl tracking-[0.2em] select-all">{revealed.code}</div>
            <div className="flex gap-2">
              <button
                className="btn btn-primary flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Bonjour ${revealed.name},\n\nVoici votre accès à l'espace projet ${BRAND.legalName} :\n${window.location.origin}/login\nCode d'accès : ${revealed.code}\n\nMerci de ne pas le partager.`,
                  );
                  toast("Message d'invitation copié");
                }}
              >
                Copier l&apos;invitation
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  navigator.clipboard.writeText(revealed.code);
                  toast("Code copié");
                }}
              >
                Copier le code
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
