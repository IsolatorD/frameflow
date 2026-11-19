import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { encodeWav16, SFX, type SfxKind, synthSfx } from "@frameflow/core/audio/sfx";
import type { Storyboard } from "@frameflow/core/storyboard";

/**
 * Escribe los efectos de sonido en la carpeta del proyecto (si faltan), para que la vista previa y
 * el render los encuentren como cualquier otro audio del proyecto. Pesan unos pocos KB.
 */
export function ensureSfxFiles(projectDir: string) {
	for (const kind of Object.keys(SFX) as SfxKind[]) {
		const path = join(projectDir, SFX[kind].file);
		if (existsSync(path)) continue;
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, encodeWav16(synthSfx(kind)));
	}
}

export const usesSfx = (sb: Storyboard) =>
	sb.tracks.some((t) => t.kind === "audio" && t.clips.some((c) => c.role === "sfx"));
