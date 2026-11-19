import { resolveVisualStyle, VISUAL_STYLES } from "@frameflow/core/look";
import {
	brandThemeWarnings,
	normalizeHashtags,
	type ProjectWithBrand,
	SPEED_RANGE,
	WORDS_PER_PAGE_RANGE,
} from "@frameflow/core/project";
import { Button } from "@frameflow/ui/src/atoms/Button/Button";
import { Dialog } from "@frameflow/ui/src/molecules/Dialog/Dialog";
import { BrandKitEditor } from "@frameflow/ui/src/organisms/BrandKitEditor/BrandKitEditor";
import { useMemo, useState } from "react";
import { useBlocker } from "react-router";
import { useUpdateBrandKit } from "../../../hooks/useUpdateBrandKit/useUpdateBrandKit";
import { paletteFromFile } from "../../../utils/referencePalette/referencePalette";
import { editorLanguages, fontOptions } from "./BrandSection.constants";

/** Sección "Marca y estilo": editor del BrandKit + aviso si sales con cambios sin guardar. */
export function BrandSection({ project }: { project: ProjectWithBrand }) {
	const update = useUpdateBrandKit(project.id);
	const [dirty, setDirty] = useState(false);
	const blocker = useBlocker(dirty);
	// Marcas guardadas antes de los estilos visuales no traen el campo: "Libre".
	const value = useMemo(
		() => ({ ...project.brandKit, visualStyle: resolveVisualStyle(project.brandKit.visualStyle) }),
		[project.brandKit],
	);

	return (
		<>
			<BrandKitEditor
				value={value}
				visualStyles={VISUAL_STYLES}
				languages={editorLanguages(project)}
				fontOptions={fontOptions(project.brandKit.fontFamily)}
				speedRange={SPEED_RANGE}
				wordsPerPageRange={WORDS_PER_PAGE_RANGE}
				parseHashtags={normalizeHashtags}
				getWarnings={brandThemeWarnings}
				readReference={paletteFromFile}
				onSave={(draft) => update.mutate(draft)}
				onDirtyChange={setDirty}
				saving={update.isPending}
				serverError={update.error?.message}
				saved={update.isSuccess}
			/>
			{blocker.state === "blocked" ? (
				<Dialog
					title="Tienes cambios sin guardar"
					description="Si sales ahora, se perderán los cambios de la marca."
					onClose={() => blocker.reset()}
				>
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={() => blocker.proceed()}>
							Salir sin guardar
						</Button>
						<Button onClick={() => blocker.reset()}>Seguir editando</Button>
					</div>
				</Dialog>
			) : null}
		</>
	);
}
