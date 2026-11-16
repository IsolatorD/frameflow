import type { Language } from "@frameflow/core/project";
import { Button } from "@frameflow/ui/src/atoms/Button/Button";
import { Dialog } from "@frameflow/ui/src/molecules/Dialog/Dialog";
import { CreateProjectForm } from "@frameflow/ui/src/organisms/CreateProjectForm/CreateProjectForm";
import { ProjectGrid } from "@frameflow/ui/src/organisms/ProjectGrid/ProjectGrid";
import { AppShell } from "@frameflow/ui/src/templates/AppShell/AppShell";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateProject } from "../../hooks/useCreateProject/useCreateProject";
import { usePresets } from "../../hooks/usePresets/usePresets";
import { useProjects } from "../../hooks/useProjects/useProjects";
import { projectsNavGroup } from "../../utils/navigation/navigation";
import { projectPath } from "../../utils/router/router";
import { toGridItem, toPresetOption } from "./ProjectsPage.constants";

export function ProjectsPage() {
	const navigate = useNavigate();
	const projects = useProjects();
	const presets = usePresets();
	const createProject = useCreateProject();
	const [creating, setCreating] = useState(false);

	const openCreate = () => {
		createProject.reset();
		setCreating(true);
	};

	const presetList = presets.data ?? [];
	const loading = projects.isPending || presets.isPending;
	const loadError = projects.error ?? presets.error;

	return (
		<AppShell
			nav={[projectsNavGroup(projects.data ?? [], navigate)]}
			title="Proyectos"
			subtitle="Cada proyecto es un canal con su marca, contenido y cuentas."
			actions={
				projects.data && projects.data.length > 0 ? (
					<Button onClick={openCreate}>Nuevo proyecto</Button>
				) : null
			}
		>
			{loading ? (
				<p className="text-sm text-zinc-400">Cargando…</p>
			) : loadError ? (
				<p role="alert" className="text-sm text-red-300">
					No se pudieron cargar los proyectos: {loadError.message}
				</p>
			) : (
				<ProjectGrid
					projects={(projects.data ?? []).map((p) => toGridItem(p, presetList))}
					onOpen={(id) => navigate(projectPath(id))}
					onCreate={openCreate}
				/>
			)}

			{creating ? (
				<Dialog
					title="Nuevo proyecto"
					description="Un proyecto es un canal. Podrás conectar sus redes y personalizar su marca después."
					onClose={() => setCreating(false)}
				>
					<CreateProjectForm
						presets={presetList.map(toPresetOption)}
						submitting={createProject.isPending}
						serverError={createProject.error?.message}
						onCancel={() => setCreating(false)}
						onSubmit={(values) =>
							createProject.mutate(
								{ ...values, languages: values.languages as Language[] },
								// Al crear, se entra directamente al panel del nuevo canal.
								{ onSuccess: (created) => navigate(projectPath(created.id)) },
							)
						}
					/>
				</Dialog>
			) : null}
		</AppShell>
	);
}
