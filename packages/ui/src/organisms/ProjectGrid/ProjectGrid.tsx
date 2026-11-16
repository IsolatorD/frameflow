import { Button } from "../../atoms/Button/Button";
import { ProjectCard } from "../../molecules/ProjectCard/ProjectCard";
import type { ProjectGridProps } from "./ProjectGridInterface";

export function ProjectGrid({ projects, onOpen, onCreate }: ProjectGridProps) {
	if (projects.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
				<h2 className="text-lg font-medium text-zinc-100">Crea tu primer canal</h2>
				<p className="max-w-sm text-sm text-zinc-400">
					Cada proyecto es un canal: su marca, sus videos, sus cuentas y sus estadísticas, todo
					junto.
				</p>
				<Button onClick={onCreate} className="mt-2">
					Nuevo proyecto
				</Button>
			</div>
		);
	}

	return (
		<ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
			{projects.map(({ id, ...card }) => (
				<li key={id} className="flex">
					<ProjectCard {...card} onOpen={() => onOpen(id)} />
				</li>
			))}
		</ul>
	);
}
