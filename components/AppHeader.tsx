"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { Avatar, RoleBadge, useApp } from "./client";

const TABS = [
  { href: "/taches", label: "Tâches", n: "01" },
  { href: "/reflexion", label: "Réflexion", n: "02" },
  { href: "/projet", label: "Projet", n: "03" },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    setTheme(attr ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("progenis-theme", next);
    } catch {}
    setTheme(next);
  };
  return (
    <button
      onClick={toggle}
      className="w-8 h-8 rounded-md border flex items-center justify-center hover:opacity-80"
      style={{ borderColor: "rgba(255,255,255,0.16)", color: "var(--header-soft)" }}
      title={theme === "dark" ? "Thème clair" : "Thème sombre"}
      aria-label="Changer de thème"
    >
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  );
}

export default function AppHeader() {
  const { me } = useApp();
  const path = usePathname();
  const tabs = me.role === "manager" ? [...TABS, { href: "/gestion", label: "Accès", n: "04" }] : TABS;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40" style={{ background: "var(--header-bg)", color: "var(--header-ink)" }}>
      <div className="px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link href="/taches" className="flex items-center gap-2.5 shrink-0">
          <span className="logo-mark w-7" style={{ color: "#7fb96a" }} />
          <span className="leading-none hidden sm:block">
            <span className="serif text-[17px] block">{BRAND.name}</span>
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase" style={{ color: "var(--header-soft)" }}>
              {BRAND.suffix}
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto mx-auto">
          {tabs.map((t) => {
            const active = path === t.href || path.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className="px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium flex items-baseline gap-1.5 transition-colors whitespace-nowrap"
                style={{
                  background: active ? "rgba(127,185,106,0.16)" : "transparent",
                  color: active ? "#bfe0a8" : "var(--header-soft)",
                }}
              >
                <span className="font-mono text-[10px] opacity-70 hidden sm:inline">{t.n}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <Avatar name={me.name} color={me.color} size={28} />
            <div className="leading-tight">
              <div className="text-[13px]">{me.name}</div>
              <RoleBadge role={me.role} />
            </div>
          </div>
          <ThemeToggle />
          <button
            onClick={logout}
            className="font-mono text-[11px] px-2.5 h-8 rounded-md border hover:opacity-80"
            style={{ borderColor: "rgba(255,255,255,0.16)", color: "var(--header-soft)" }}
          >
            Quitter
          </button>
        </div>
      </div>
    </header>
  );
}
