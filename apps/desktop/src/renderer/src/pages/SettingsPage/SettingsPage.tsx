import {
	AI_PROVIDERS,
	type AiProviderId,
	type AiSettings,
	isCloudProvider,
	keyWarning,
	modelLabel,
	PROVIDERS,
} from "@frameflow/core/ai/catalog";
import { AiSettingsPanel } from "@frameflow/ui/src/organisms/AiSettingsPanel/AiSettingsPanel";
import type { AiProviderOption } from "@frameflow/ui/src/organisms/AiSettingsPanel/AiSettingsPanelInterface";
import { AppShell } from "@frameflow/ui/src/templates/AppShell/AppShell";
import { useNavigate } from "react-router";
import {
	useAiSettings,
	useSaveAiSettings,
	useSetAiKey,
	useTestAi,
} from "../../hooks/useAiSettings/useAiSettings";
import { useProjects } from "../../hooks/useProjects/useProjects";
import { footerNav, projectsNavGroup } from "../../utils/navigation/navigation";

const PROVIDER_OPTIONS: AiProviderOption[] = AI_PROVIDERS.map((id) => ({
	id,
	label: PROVIDERS[id].label,
	description: PROVIDERS[id].description,
	cloud: isCloudProvider(id),
	keyUrl: PROVIDERS[id].keyUrl,
	models: PROVIDERS[id].models,
}));

/** Ollama lista los modelos con ":latest" cuando no llevan etiqueta. */
const normalizeOllama = (name: string) => name.replace(/:latest$/, "");

/** Ajustes de la app. Por ahora: la IA que escribe los guiones. */
export function SettingsPage() {
	const navigate = useNavigate();
	const projects = useProjects();
	const view = useAiSettings();
	const save = useSaveAiSettings();
	const setKey = useSetAiKey();
	const test = useTestAi();

	const data = view.data;
	const settings = data?.settings;
	const provider = settings?.provider ?? "ollama";
	const model = settings?.models[provider] ?? "";

	const update = (next: AiSettings) => {
		test.reset();
		save.mutate(next);
	};

	return (
		<AppShell
			nav={[projectsNavGroup(projects.data ?? [], navigate, null)]}
			footer={footerNav(navigate, true)}
			title="Ajustes"
			subtitle="Inteligencia artificial para escribir los guiones."
		>
			{view.isPending ? (
				<p className="text-sm text-zinc-400">Cargando…</p>
			) : !data || !settings ? (
				<p role="alert" className="text-sm text-red-300">
					No se pudieron cargar los ajustes: {view.error?.message}
				</p>
			) : (
				<AiSettingsPanel
					providers={PROVIDER_OPTIONS}
					provider={provider}
					model={model}
					onProviderChange={(id) => update({ ...settings, provider: id as AiProviderId })}
					onModelChange={(next) =>
						update({ ...settings, models: { ...settings.models, [provider]: next } })
					}
					local={{
						running: data.ollamaModels !== null,
						installed: (data.ollamaModels ?? []).map(normalizeOllama),
						recommendation:
							data.recommendation.kind === "model"
								? { model: data.recommendation.model, text: data.recommendation.reason }
								: { text: data.recommendation.reason },
					}}
					apiKey={isCloudProvider(provider) ? data.keys[provider] : null}
					keyStorage={data.keyStorage}
					keyWarning={(key) => (isCloudProvider(provider) ? keyWarning(provider, key) : null)}
					onSaveKey={(key) => {
						if (!isCloudProvider(provider)) return;
						test.reset();
						setKey.mutate({ provider, key });
					}}
					onRemoveKey={() => {
						if (!isCloudProvider(provider)) return;
						test.reset();
						setKey.mutate({ provider, key: null });
					}}
					keySaving={setKey.isPending}
					keyError={setKey.error?.message}
					onTest={() => test.mutate({ provider, model })}
					testing={test.isPending}
					testResult={
						test.data
							? test.data.available
								? {
										ok: true,
										text: isCloudProvider(provider)
											? `Todo listo: la clave funciona y ${modelLabel(provider, model)} está disponible.`
											: `Todo listo: Ollama está en marcha y ${modelLabel(provider, model)} está descargado.`,
									}
								: { ok: false, text: test.data.reason }
							: test.error
								? { ok: false, text: test.error.message }
								: null
					}
					error={save.error?.message}
				/>
			)}
		</AppShell>
	);
}
