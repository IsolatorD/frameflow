export interface ProgressBarProps {
	/** 0–1; null = progreso desconocido (barra animada). */
	value: number | null;
	label: string;
}
