import { loadFont as bebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as montserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as oswald } from "@remotion/google-fonts/Oswald";
import { loadFont as poppins } from "@remotion/google-fonts/Poppins";
import { loadFont as robotoSlab } from "@remotion/google-fonts/RobotoSlab";

// Las mismas tipografías que ofrece el catálogo de marca (core/catalog FONTS).
// Se cargan bajo demanda: solo la que usa el video.
const LOADERS: Record<string, () => { fontFamily: string }> = {
	Montserrat: () =>
		montserrat("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] }),
	Poppins: () => poppins("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] }),
	Inter: () => inter("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] }),
	"Bebas Neue": () => bebasNeue("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }),
	Oswald: () => oswald("normal", { weights: ["600", "700"], subsets: ["latin", "latin-ext"] }),
	"Roboto Slab": () =>
		robotoSlab("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] }),
};

const loaded = new Map<string, string>();

/** Devuelve el `font-family` CSS de la fuente (Montserrat si no está en el catálogo). */
export const fontFor = (family: string): string => {
	const key = family in LOADERS ? family : "Montserrat";
	let css = loaded.get(key);
	if (!css) {
		css = (LOADERS[key] as () => { fontFamily: string })().fontFamily;
		loaded.set(key, css);
	}
	return `${css}, sans-serif`;
};
