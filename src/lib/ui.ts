/**
 * Design system tokens for HRCube (see AGENTS.md).
 * Prefer these helpers over one-off class strings so pages stay consistent.
 */
import { cn } from "./utils";

// ─── Motion (motion/react) ───────────────────────────────────────────────────

/** Standard ease-out used for mount / route transitions. */
export const easeOut = { duration: 0.2, ease: "easeOut" as const };

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: easeOut,
};

export const fadeSlideUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: easeOut,
};

/** Parent for staggered page sections. */
export const pageContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

/** Child items: subtle fade + 10px rise (no bounce). */
export const pageItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: easeOut,
  },
};

/** List row / card enter-exit. */
export const listItemMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: easeOut,
};

// ─── Layout shells ───────────────────────────────────────────────────────────

export const pageShell =
  "space-y-6 md:space-y-8 max-w-[1200px] mx-auto p-4 sm:p-0 pb-12";

export const pageShellWide =
  "space-y-6 md:space-y-8 max-w-[1400px] mx-auto p-4 sm:p-0 pb-12";

export const pageHeaderBar =
  "flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5 md:pb-6";

export const pageTitle = "text-xl font-bold tracking-tight text-slate-900";

export const pageDescription = "text-sm text-slate-500 mt-1 leading-relaxed";

// ─── Surfaces ────────────────────────────────────────────────────────────────

/** Primary card / panel on the grid background. */
export const card =
  "bg-white border border-slate-200 rounded-xl";

export const cardHeader =
  "px-5 py-4 border-b border-slate-100 bg-slate-50";

export const cardBody = "p-4 sm:p-5 md:p-6";

// ─── Controls ────────────────────────────────────────────────────────────────

export const focusRing =
  "focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900";

export const input = cn(
  "w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-colors",
  focusRing,
);

export const inputCompact = cn(
  "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-colors",
  focusRing,
);

export const select = cn(input, "cursor-pointer");

export const label = "block text-sm font-medium text-slate-700";

export const labelUpper =
  "block text-[11px] font-bold text-slate-500 uppercase tracking-wider";

export const btnPrimary = cn(
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-slate-900 rounded-lg",
  "hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none",
);

export const btnSecondary = cn(
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg",
  "hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50",
);

export const btnDanger = cn(
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-red-600 rounded-lg",
  "hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50",
);

export const btnGhost = cn(
  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg",
  "hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all",
);

/** Segmented / chip toggle (print type, settings tabs). */
export function chip(active: boolean, opts?: { muted?: boolean }) {
  return cn(
    "px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors border active:scale-[0.98]",
    active
      ? "bg-slate-900 text-white border-slate-900"
      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
    opts?.muted && !active && "opacity-60",
  );
}

export function navTab(active: boolean) {
  return cn(
    "snap-center flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap active:scale-[0.98]",
    active
      ? "bg-slate-50 text-slate-900 border border-slate-200"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent",
  );
}

// ─── Status badges ───────────────────────────────────────────────────────────

export function statusBadge(status: string | undefined | null) {
  const s = (status || "").toUpperCase();
  const base =
    "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border whitespace-nowrap";
  if (s === "PNS") return cn(base, "bg-slate-900 text-white border-slate-900");
  if (s === "CPNS") return cn(base, "bg-sky-50 text-sky-700 border-sky-100");
  if (s === "PPPK") return cn(base, "bg-indigo-50 text-indigo-700 border-indigo-100");
  if (s === "PPPKPW") return cn(base, "bg-violet-50 text-violet-700 border-violet-100");
  if (s === "HONORER") return cn(base, "bg-amber-50 text-amber-700 border-amber-100");
  return cn(base, "bg-slate-50 text-slate-600 border-slate-200");
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export const alertSuccess =
  "p-4 rounded-xl text-sm font-medium flex items-center gap-3 bg-emerald-50 text-emerald-700 border border-emerald-100";

export const alertError =
  "p-4 rounded-xl text-sm font-medium flex items-center gap-3 bg-red-50 text-red-700 border border-red-100";

export const emptyIconWrap =
  "w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mb-4 border border-slate-100";

export const sectionRule =
  "space-y-6 pt-8 sm:pt-10 mt-6 sm:mt-8 border-t border-slate-200";

export const sectionTitle =
  "text-sm border-l-2 pl-3 border-slate-900 font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2";
