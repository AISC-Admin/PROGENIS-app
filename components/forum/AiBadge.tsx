"use client";
import { AI_PROVIDERS } from "@/lib/shared";

export function AiBadge({ provider, size = "sm" }: { provider: string; size?: "sm" | "md" }) {
  const p = AI_PROVIDERS.find((x) => x.id === provider);
  const name = p?.name ?? "Lien";
  const color = p?.color ?? "#6b7280";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold text-white shrink-0 ${
        size === "md" ? "text-[12px] px-2.5 py-0.5" : "text-[10px] px-2 py-[1px]"
      }`}
      style={{ background: color }}
    >
      <svg width={size === "md" ? 11 : 9} height={size === "md" ? 11 : 9} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
      </svg>
      {name}
    </span>
  );
}
