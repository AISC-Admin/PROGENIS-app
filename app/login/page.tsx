import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/taches");
  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Panneau identité */}
      <section
        className="relative overflow-hidden px-8 py-10 lg:px-14 lg:py-14 flex flex-col justify-between"
        style={{ background: "var(--header-bg)", color: "var(--header-ink)" }}
      >
        <div
          aria-hidden
          className="absolute -right-24 -bottom-24 w-[520px] opacity-[0.07] logo-mark"
          style={{ color: "var(--header-ink)" }}
        />
        <div className="flex items-center gap-3 relative">
          <span className="logo-mark w-10" style={{ color: "#7fb96a" }} />
          <div className="leading-tight">
            <div className="serif text-xl">{BRAND.name}</div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--header-soft)" }}>
              {BRAND.suffix}
            </div>
          </div>
        </div>

        <div className="relative my-12 max-w-xl">
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase mb-5" style={{ color: "#7fb96a" }}>
            Espace projet · accès réservé
          </p>
          <h1 className="text-4xl lg:text-5xl leading-[1.08]">
            Cultiver du matériel végétal{" "}
            <em className="font-medium" style={{ color: "#7fb96a" }}>
              sain, fidèle et robuste
            </em>
            , partout où il doit pousser.
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed" style={{ color: "var(--header-soft)" }}>
            {BRAND.description}
          </p>
        </div>

        <div className="relative font-mono text-[11px] leading-relaxed" style={{ color: "var(--header-soft)" }}>
          <div>© {new Date().getFullYear()} {BRAND.legalName} — Registre n° {BRAND.registry}, Estonie</div>
          <div>{BRAND.locations}</div>
        </div>
      </section>

      {/* Formulaire */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="eyebrow mb-3">Connexion</p>
          <h2 className="text-3xl mb-2">Bienvenue</h2>
          <p className="text-ink-soft text-sm mb-8">
            Saisissez le code d&apos;accès personnel transmis par le manager du projet.
          </p>
          <LoginForm />
          <p className="text-xs text-ink-soft mt-8 leading-relaxed">
            Code perdu ? Contactez le manager pour en générer un nouveau.
            <br />
            <a className="text-moss hover:underline" href={`mailto:${BRAND.email}`}>
              {BRAND.email}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
