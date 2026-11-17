export interface AiModelOption {
	id: string;
	label: string;
	note: string;
}

export interface AiProviderOption {
	id: string;
	label: string;
	description: string;
	/** En la nube: necesita clave de API. */
	cloud: boolean;
	/** Dónde crear la clave. */
	keyUrl?: string;
	models: readonly AiModelOption[];
}

export interface AiPrepareStep {
	id: string;
	label: string;
	state: "pending" | "active" | "done";
	/** 0–1 si se conoce. */
	fraction?: number;
	/** "1,2 GB de 5 GB · 3,4 MB/s · quedan 20 min". */
	detail?: string;
}

export interface AiPrepareJob {
	/** "Qwen3 8B" o el ID del modelo. */
	modelLabel: string;
	steps: readonly AiPrepareStep[];
	status: "running" | "error" | "cancelled" | "done";
	error?: string;
	/** Aviso de reintentos tras cortes de red. */
	notice?: string;
}

export interface AiLocalState {
	/** Ollama responde en este equipo. */
	running: boolean;
	/** De dónde sale Ollama: del usuario, descargado por la app, o ninguno. */
	engine: "system" | "system-binary" | "managed" | "missing";
	/** Tamaño de la descarga de Ollama ("186 MB"); null si no hay versión para este equipo. */
	runtimeSize: string | null;
	/** Espacio libre en disco ("27 GB"). */
	freeSpace: string | null;
	/** Tamaño de descarga de cada modelo conocido ("5 GB"). */
	modelSize: (id: string) => string | null;
	/** Aviso si no hay espacio para descargar ese modelo (y Ollama si falta); null si cabe. */
	spaceWarning: (id: string) => string | null;
	job: AiPrepareJob | null;
	/** IDs de modelos ya descargados. */
	installed: readonly string[];
	/** Recomendación según el equipo (RAM, GPU). */
	recommendation: { model?: string; text: string };
}

export interface AiSettingsPanelProps {
	providers: readonly AiProviderOption[];
	provider: string;
	/** Modelo elegido del proveedor actual. */
	model: string;
	onProviderChange: (provider: string) => void;
	onModelChange: (model: string) => void;
	local: AiLocalState;
	/** Estado de la clave del proveedor actual (null si es local). Nunca la clave. */
	apiKey: { set: false } | { set: true; hint: string } | null;
	keyStorage: "secure" | "weak" | "unavailable";
	/** Aviso de formato mientras se escribe la clave (no bloquea). */
	keyWarning?: (key: string) => string | null;
	onSaveKey: (key: string) => void;
	onRemoveKey: () => void;
	keySaving: boolean;
	keyError?: string;
	/** Descarga Ollama (si falta) y el modelo. Pulsar el botón es la confirmación. */
	onPrepare: (model: string) => void;
	onCancelPrepare: () => void;
	onDismissPrepare: () => void;
	onTest: () => void;
	testing: boolean;
	testResult: { ok: boolean; text: string } | null;
	/** Error al guardar proveedor o modelo. */
	error?: string;
}
