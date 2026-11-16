export interface StatCardProps {
	label: string;
	/** null = aún sin datos; se muestra un guion. */
	value: string | null;
	hint?: string;
}
