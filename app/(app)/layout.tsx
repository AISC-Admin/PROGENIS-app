import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { AppProvider } from "@/components/client";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const me = { id: user.id, name: user.name, role: user.role, color: user.color };
  const storage = !process.env.BLOB_READ_WRITE_TOKEN ? "local" : process.env.BLOB_ACCESS === "public" ? "public" : "private";
  return (
    <AppProvider me={me} storage={storage}>
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-1 w-full">{children}</main>
        <footer className="border-t border-line px-4 sm:px-6 py-4 text-[11px] font-mono text-ink-soft flex flex-wrap gap-x-6 gap-y-1 justify-between">
          <span>
            © {new Date().getFullYear()} {BRAND.legalName} — Registre n° {BRAND.registry} · TVA {BRAND.vat}
          </span>
          <span>
            {BRAND.address} · {BRAND.phone}
          </span>
        </footer>
      </div>
    </AppProvider>
  );
}
