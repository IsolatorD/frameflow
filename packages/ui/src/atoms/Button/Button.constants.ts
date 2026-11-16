import type { ButtonVariant } from "./ButtonInterface";

export const BUTTON_BASE =
	"inline-flex items-center justify-center gap-2 rounded-lg px-4 h-9 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:opacity-50 disabled:cursor-not-allowed";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
	primary: "bg-violet-500 text-white hover:bg-violet-400",
	secondary: "bg-white/5 text-zinc-100 ring-1 ring-white/10 hover:bg-white/10",
	ghost: "text-zinc-300 hover:bg-white/5 hover:text-zinc-100",
};
