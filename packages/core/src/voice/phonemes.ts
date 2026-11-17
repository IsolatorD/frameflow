// Texto → fonemas para Kokoro, replicando lo que hace la librería de Python (misaki + phonemizer)
// sobre eSpeak NG. eSpeak (GPL-3.0) corre en el proceso principal; aquí solo va la parte pura:
// separar y recolocar la puntuación, unir los fonemas compuestos y adaptar los símbolos a Kokoro.

/** Signos que se conservan alrededor de los fonemas (los mismos que phonemizer). */
export const PUNCTUATION = ';:,.!?¡¿—…"«»“”(){}[]';
const MARKS_RE = new RegExp(`(\\s*[${PUNCTUATION.replace(/[\\\]^-]/g, "\\$&")}]+\\s*)+`, "g");

export type Mark = { mark: string; position: "B" | "E" | "I" | "A" };

/** Separa el texto en trozos sin puntuación y recuerda dónde iba cada signo. */
export function preservePunctuation(line: string): { chunks: string[]; marks: Mark[] } {
	const matches = [...line.matchAll(MARKS_RE)].map((m) => m[0]);
	if (matches.length === 0) return { chunks: [line], marks: [] };
	if (matches.length === 1 && matches[0] === line)
		return { chunks: [], marks: [{ mark: line, position: "A" }] };
	const marks: Mark[] = matches.map((mark, i) => ({
		mark,
		position:
			i === 0 && line.startsWith(mark)
				? "B"
				: i === matches.length - 1 && line.endsWith(mark)
					? "E"
					: "I",
	}));
	const chunks: string[] = [];
	let rest = line;
	for (const { mark } of marks) {
		const at = rest.indexOf(mark);
		chunks.push(rest.slice(0, at));
		rest = rest.slice(at + mark.length);
	}
	chunks.push(rest);
	return { chunks: chunks.filter(Boolean), marks };
}

/**
 * Recoloca la puntuación entre los trozos ya fonemizados (cada uno termina en espacio, como
 * phonemizer con `strip=False`). Copia de `Punctuation.restore` de phonemizer.
 */
export function restorePunctuation(phonemized: string[], marks: Mark[]): string {
	const text = [...phonemized];
	let pending = [...marks];
	const out: string[] = [];
	while (text.length || pending.length) {
		if (!pending.length) {
			for (const line of text) out.push(line.endsWith(" ") ? line : `${line} `);
			text.length = 0;
		} else if (!text.length) {
			out.push(pending.map((m) => m.mark).join(""));
			pending = [];
		} else {
			const current = pending[0] as Mark;
			pending = pending.slice(1);
			const mark = current.mark;
			if (text[0]?.endsWith(" ")) text[0] = text[0].slice(0, -1);
			if (current.position === "B") {
				text[0] = mark + text[0];
			} else if (current.position === "E") {
				out.push(text[0] + mark + (mark.endsWith(" ") ? "" : " "));
				text.shift();
			} else if (current.position === "A") {
				out.push(mark + (mark.endsWith(" ") ? "" : " "));
			} else if (text.length === 1) {
				text[0] = text[0] + mark;
			} else {
				const first = text.shift() as string;
				text[0] = first + mark + text[0];
			}
		}
	}
	return out.join("");
}

/**
 * eSpeak devuelve los fonemas separados por "_" y las palabras por espacios. phonemizer (con
 * `tie="^"`) los pide unidos y marca con "^" los compuestos (t^ʃ): aquí se reproduce eso.
 */
export function joinEspeakPhonemes(raw: string): string {
	return raw
		.replace(/\|/g, " ")
		.trim()
		.split(/\s+/)
		.map((word) =>
			word
				.split("_")
				.filter(Boolean)
				.map((unit) => {
					// Letras de un mismo fonema → unidas con "^" (las marcas de acento/duración no cuentan).
					let result = "";
					let prevLetter = false;
					for (const ch of unit) {
						const letter = /\p{L}/u.test(ch) && !/[ˈˌːˑ]/.test(ch);
						if (letter && prevLetter) result += "^";
						result += ch;
						if (letter) prevLetter = true;
					}
					return result;
				})
				.join(""),
		)
		.join(" ");
}

/** Sustituciones de misaki (`EspeakG2P`) para idiomas que no son el inglés. */
const E2M_GENERIC: [string, string][] = (
	[
		["a^ɪ", "I"],
		["a^ʊ", "W"],
		["d^z", "ʣ"],
		["d^ʒ", "ʤ"],
		["e^ɪ", "A"],
		["o^ʊ", "O"],
		["ə^ʊ", "Q"],
		["s^s", "S"],
		["t^s", "ʦ"],
		["t^ʃ", "ʧ"],
		["ɔ^ɪ", "Y"],
	] as [string, string][]
).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/** Sustituciones de misaki (`EspeakFallback`) para el inglés (las más largas primero). */
const E2M_ENGLISH: [string, string][] = (
	[
		["ʔˌn̩", "ʔn"],
		["ʔn̩", "ʔn"],
		["a^ɪ", "I"],
		["a^ʊ", "W"],
		["d^ʒ", "ʤ"],
		["e^ɪ", "A"],
		["e", "A"],
		["t^ʃ", "ʧ"],
		["ɔ^ɪ", "Y"],
		["ə^l", "ᵊl"],
		["ʲo", "jo"],
		["ʲə", "jə"],
		["ʲ", ""],
		["ɚ", "əɹ"],
		["r", "ɹ"],
		["x", "k"],
		["ç", "k"],
		["ɐ", "ə"],
		["ɬ", "l"],
		["̃", ""],
	] as [string, string][]
).sort(([a], [b]) => b.length - a.length);

const replaceAll = (text: string, pairs: [string, string][]) =>
	pairs.reduce((acc, [from, to]) => acc.split(from).join(to), text);

/** Fonemas unidos (con "^") → símbolos del vocabulario de Kokoro, como misaki. */
export function toKokoroPhonemes(tied: string, language: string): string {
	let ps = tied.trim();
	if (language.startsWith("en")) {
		ps = replaceAll(ps, E2M_ENGLISH);
		ps = ps.replace(/(\S)̩/gu, "ᵊ$1").replace(/̩/gu, "");
		if (language === "en-gb") {
			ps = ps.replace(/e\^ə/g, "ɛː").replace(/iə/g, "ɪə").replace(/ə\^ʊ/g, "Q");
		} else {
			ps = ps
				.replace(/o\^ʊ/g, "O")
				.replace(/ɜːɹ/g, "ɜɹ")
				.replace(/ɜː/g, "ɜɹ")
				.replace(/ɪə/g, "iə")
				.replace(/ː/g, "");
		}
		ps = ps.replace(/o/g, "ɔ").replace(/ɾ/g, "T").replace(/ʔ/g, "t");
		return ps.replace(/\^/g, "");
	}
	ps = replaceAll(ps, E2M_GENERIC);
	return ps.replace(/\^/g, "").replace(/-/g, "");
}

/** Variante de eSpeak para cada idioma/voz de Kokoro (la inicial de la voz marca el acento). */
export function espeakLanguage(language: string, voiceId: string): string {
	const prefix = voiceId[0];
	if (prefix === "b") return "en-gb";
	if (prefix === "a") return "en-us";
	if (language.startsWith("en")) return "en-us";
	return language;
}

/** Prepara un texto para eSpeak: trozos sin puntuación (lo que hay que fonemizar) y los signos. */
export function espeakChunks(text: string): { chunks: string[]; marks: Mark[] } {
	// Como misaki: comillas angulares → curvas y paréntesis → angulares (y de vuelta al final).
	const prepared = text
		.replace(/«/g, "\u201c")
		.replace(/»/g, "\u201d")
		.replace(/\(/g, "«")
		.replace(/\)/g, "»");
	return preservePunctuation(prepared);
}

/** Salida en bruto de eSpeak para cada trozo (fonemas separados por "_") → fonemas para Kokoro. */
export function fromEspeak(raw: readonly string[], marks: Mark[], language: string): string {
	const phonemized = raw.map((r) => `${r.trim() ? joinEspeakPhonemes(r) : ""} `);
	const joined = restorePunctuation(phonemized, marks);
	return toKokoroPhonemes(joined, language).replace(/«/g, "(").replace(/»/g, ")").trim();
}

/**
 * Texto → fonemas para Kokoro. `phonemize` llama a eSpeak con un trozo de texto sin puntuación y
 * devuelve su salida en bruto (fonemas separados por "_").
 */
export function textToPhonemes(
	text: string,
	language: string,
	phonemize: (chunk: string) => string,
): string {
	const { chunks, marks } = espeakChunks(text);
	return fromEspeak(
		chunks.map((c) => (c.trim() ? phonemize(c) : "")),
		marks,
		language,
	);
}
