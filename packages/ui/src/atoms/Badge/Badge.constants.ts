import type { BadgeTone } from "./BadgeInterface";

export const BADGE_TONES: Record<BadgeTone, string> = {
	neutral: "bg-white/5 text-zinc-300 ring-white/10",
	info: "bg-violet-500/15 text-violet-200 ring-violet-400/40",
	success: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40",
	warning: "bg-amber-400/15 text-amber-200 ring-amber-400/40",
	danger: "bg-red-500/15 text-red-200 ring-red-400/40",
};
