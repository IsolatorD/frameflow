import type { SceneSettingsDraft } from "../SceneCard/SceneCardInterface";

export interface SceneStyleFieldsProps {
	idPrefix: string;
	settings: SceneSettingsDraft;
	onChange: (settings: SceneSettingsDraft) => void;
	defaultTheme: { accent: string; background: string };
	extraTimeRange: { min: number; max: number; step: number };
}
