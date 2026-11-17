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

export interface AiLocalState {
	/** Ollama responde en este equipo. */
	running: boolean;
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
	onTest: () => void;
	testing: boolean;
	testResult: { ok: boolean; text: string } | null;
	/** Error al guardar proveedor o modelo. */
	error?: string;
}
