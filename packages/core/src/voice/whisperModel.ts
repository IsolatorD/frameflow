// Whisper (base, con tiempos por palabra) en ONNX para los subtítulos de la voz GRABADA: la voz
// sintética saca los tiempos del propio Kokoro. Variante cuantizada (~77 MB): en las pruebas da los
// mismos tiempos que la completa. Revisión fijada y SHA-256 para verificar la descarga.

export const WHISPER_REPO = "onnx-community/whisper-base_timestamped";
export const WHISPER_REVISION = "608c49e61301901684bc36cac8f74b95ff6b5a8e";
export const WHISPER_SAMPLE_RATE = 16_000;

export const WHISPER_FILES: readonly { file: string; sizeBytes: number; sha256: string }[] = [
	{
		file: "config.json",
		sizeBytes: 2243,
		sha256: "f4d0608f7d918166da7edb3e188de5ef1bfe70d9802e785d271fd88111e9cf4b",
	},
	{
		file: "generation_config.json",
		sizeBytes: 3832,
		sha256: "61070cf8de25b1e9256e8e102ded49d8d24a8369ed36ef84fdf21549e68125a0",
	},
	{
		file: "preprocessor_config.json",
		sizeBytes: 339,
		sha256: "a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d",
	},
	{
		file: "tokenizer.json",
		sizeBytes: 2480466,
		sha256: "27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566",
	},
	{
		file: "tokenizer_config.json",
		sizeBytes: 282682,
		sha256: "2e036e4dbacfdeb7242c7d4ec4149f4a16e86026048f94d1637e3a8ee9c6a573",
	},
	{
		file: "onnx/encoder_model_quantized.onnx",
		sizeBytes: 23159167,
		sha256: "2714484ebe1bae7c1646e8eadb768bb9d415cf11763466d21f23039a29c62e6f",
	},
	{
		file: "onnx/decoder_model_merged_quantized.onnx",
		sizeBytes: 53712708,
		sha256: "cf9a8d5bcddc0917a0078135b484cedcaf44f28909cd91910abd29dced9171db",
	},
];

export const whisperUrl = (file: string) =>
	`https://huggingface.co/${WHISPER_REPO}/resolve/${WHISPER_REVISION}/${file}`;

/** Idioma de Whisper para el idioma del video ("es" → "spanish"). */
export const whisperLanguage = (language: string) =>
	({ es: "spanish", en: "english", fr: "french", it: "italian", pt: "portuguese" })[
		language.split("-")[0] as string
	] ?? "spanish";
