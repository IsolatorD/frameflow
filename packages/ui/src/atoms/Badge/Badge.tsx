import { BADGE_TONES } from "./Badge.constants";
import type { BadgeProps } from "./BadgeInterface";

export function Badge({ tone = "neutral", children }: BadgeProps) {
	return (
		<span
			className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium ring-1 ${BADGE_TONES[tone]}`}
		>
			{children}
		</span>
	);
}
