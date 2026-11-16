import type { ReactNode } from "react";

export interface DialogProps {
	title: string;
	description?: string;
	onClose: () => void;
	children: ReactNode;
}
