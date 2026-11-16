import type { ReactNode } from "react";

export interface SectionProps {
	title: string;
	description?: string;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
}
