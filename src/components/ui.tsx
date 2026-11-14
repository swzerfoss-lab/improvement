import type { ReactNode } from "react";
import { TIERS } from "@/engine/tiers";
import type { TierId } from "@/engine/types";

export type BtnVariant = "primary" | "accent" | "secondary" | "danger";

const BTN_BASE =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-zinc-950 text-white hover:bg-zinc-800",
  accent: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
  secondary: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};

export const btn = (variant: BtnVariant = "primary") =>
  `${BTN_BASE} ${BTN_VARIANTS[variant]}`;

export const input =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

export const label = "block text-sm font-medium text-zinc-800";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-zinc-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const TIER_STYLES: Record<TierId, string> = {
  1: "bg-sky-100 text-sky-900",
  2: "bg-amber-100 text-amber-900",
  3: "bg-fuchsia-100 text-fuchsia-900",
};

export function TierBadge({ tier }: { tier: TierId }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_STYLES[tier]}`}>
      {TIERS[tier].name}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "bg-zinc-100 text-zinc-700",
    good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-900",
    bad: "bg-red-100 text-red-800",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-zinc-100"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-zinc-900"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

export const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
