import { Button } from "@frameflow/ui/src/atoms/Button/Button";
import { EmptyState } from "@frameflow/ui/src/molecules/EmptyState/EmptyState";
import { PlatformTile } from "@frameflow/ui/src/molecules/PlatformTile/PlatformTile";
import { Section } from "@frameflow/ui/src/molecules/Section/Section";
import { StatCard } from "@frameflow/ui/src/molecules/StatCard/StatCard";
import { BrandSummary } from "@frameflow/ui/src/organisms/BrandSummary/BrandSummary";
import { AppShell } from "@frameflow/ui/src/templates/AppShell/AppShell";
import { useNavigate, useParams } from "react-router";
import { UpdateBanner } from "../../components/UpdateBanner/UpdateBanner";
import { usePresets } from "../../hooks/usePresets/usePresets";
import { useProject } from "../../hooks/useProject/useProject";
import { useProjects } from "../../hooks/useProjects/useProjects";
import { footerNav, projectsNavGroup } from "../../utils/navigation/navigation";
import { projectPath } from "../../utils/router/router";
import { BrandSection } from "./BrandSection/BrandSection";
import { GenerateSection } from "./GenerateSection/GenerateSection";
import { LibrarySection } from "./LibrarySection/LibrarySection";
import {
	brandSummaryProps,
	findSection,
	platformTiles,
	SECTIONS,
	type SectionId,
} from "./ProjectPage.constants";

export function ProjectPage() {
	const { projectId, section: sectionParam } = useParams();
	const navigate = useNavigate();
	const project = useProject(projectId);
	const projects = useProjects();
	const presets = usePresets();
	const section = findSection(sectionParam);

	const goTo = (id: SectionId) => projectId && navigate(projectPath(projectId, id));
	const projectsGroup = projectsNavGroup(projects.data ?? [], navigate, projectId);

	if (project.isPending || project.error || !project.data) {
		const message = project.isPending
			? "Cargando…"
			: project.error
				? `No se pudo cargar el proyecto: ${project.error.message}`
				: "Este proyecto no existe.";
		return (
			<AppShell
				footer={footerNav(navigate)}
				notice={<UpdateBanner />}
				nav={[projectsGroup]}
				title="Proyecto"
			>
				<p role={project.isPending ? undefined : "alert"} className="text-sm text-zinc-400">
					{message}
				</p>
			</AppShell>
		);
	}

	const data = project.data;
	const presetLabel = presets.data?.find((p) => p.id === data.presetId)?.label ?? data.presetId;

	return (
		<AppShell
			footer={footerNav(navigate)}
			notice={<UpdateBanner />}
			nav={[
				projectsGroup,
				{
					id: "sections",
					label: data.name,
					items: SECTIONS.map((s) => ({
						id: s.id,
						label: s.label,
						active: s.id === section.id,
						badge: s.upcoming ? "Pronto" : undefined,
						onSelect: () => goTo(s.id),
					})),
				},
			]}
			eyebrow={section.id === "overview" ? presetLabel : data.name}
			title={section.id === "overview" ? data.name : section.label}
			subtitle={section.id === "overview" ? data.description || undefined : undefined}
			actions={
				section.id === "generate" ? null : (
					<Button onClick={() => goTo("generate")}>Generar video</Button>
				)
			}
		>
			{section.upcoming ? (
				<EmptyState title="Esta sección llega pronto" description={section.upcoming} />
			) : section.id === "brand" ? (
				<BrandSection key={data.id} project={data} />
			) : section.id === "generate" ? (
				<GenerateSection key={data.id} project={data} />
			) : section.id === "library" ? (
				<LibrarySection projectId={data.id} />
			) : (
				<div className="flex flex-col gap-5">
					<div className="grid grid-cols-4 gap-3">
						<StatCard label="Vistas (30 días)" value={null} hint="Conecta una cuenta" />
						<StatCard label="Seguidores nuevos" value={null} hint="Conecta una cuenta" />
						<StatCard label="Videos publicados" value={null} hint="Aún no hay videos" />
						<StatCard label="Retención media" value={null} hint="Conecta una cuenta" />
					</div>

					<div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
						<Section
							title="Videos recientes"
							description="Lo último que generaste para el canal."
							action={
								<Button variant="ghost" onClick={() => goTo("library")}>
									Ver todos
								</Button>
							}
						>
							<LibrarySection projectId={data.id} limit={4} />
						</Section>

						<Section
							title="Cuentas"
							description="Las redes del canal."
							action={
								<Button variant="ghost" onClick={() => goTo("accounts")}>
									Ver todas
								</Button>
							}
						>
							<div className="flex flex-col gap-2">
								{platformTiles().map(({ id, ...tile }) => (
									<PlatformTile key={id} {...tile} />
								))}
							</div>
						</Section>
					</div>

					<Section
						title="Marca y estilo"
						description="La identidad que comparten todos los videos del canal."
						action={
							<Button variant="ghost" onClick={() => goTo("brand")}>
								Editar
							</Button>
						}
					>
						<BrandSummary {...brandSummaryProps(data)} />
					</Section>
				</div>
			)}
		</AppShell>
	);
}
