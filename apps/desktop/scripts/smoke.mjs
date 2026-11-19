// Prueba de humo de la app compilada: abre Electron con una carpeta de datos temporal,
// crea un proyecto desde la interfaz y guarda capturas en test-results/.
// Uso: pnpm smoke   (compila y ejecuta)
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { _electron as electron } from "playwright-core";

const appDir = join(import.meta.dirname, "..");
const shots = join(appDir, "test-results");
mkdirSync(shots, { recursive: true });
const home = mkdtempSync(join(tmpdir(), "frameflow-smoke-"));

// Música de prueba: 3 s de un tono suave (WAV PCM 16 bits). El diálogo nativo de archivos no se
// puede pulsar desde Playwright, así que la app lo toma de FRAMEFLOW_TEST_MUSIC.
const testMusic = join(home, "test-music.wav");
{
	const rate = 22050;
	const samples = rate * 3;
	const wav = Buffer.alloc(44 + samples * 2);
	wav.write("RIFF", 0);
	wav.writeUInt32LE(36 + samples * 2, 4);
	wav.write("WAVEfmt ", 8);
	wav.writeUInt32LE(16, 16);
	wav.writeUInt16LE(1, 20);
	wav.writeUInt16LE(1, 22);
	wav.writeUInt32LE(rate, 24);
	wav.writeUInt32LE(rate * 2, 28);
	wav.writeUInt16LE(2, 32);
	wav.writeUInt16LE(16, 34);
	wav.write("data", 36);
	wav.writeUInt32LE(samples * 2, 40);
	for (let i = 0; i < samples; i++) {
		wav.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 8000), 44 + i * 2);
	}
	writeFileSync(testMusic, wav);
}

// Imagen de prueba: PNG de 200×120, mitad rosa y mitad amarilla (para reconocerla en el video).
const testImage = join(home, "test-image.png");
{
	const crcTable = Array.from({ length: 256 }, (_, n) => {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		return c >>> 0;
	});
	const crc = (buf) => {
		let c = 0xffffffff;
		for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	};
	const chunk = (type, data) => {
		const out = Buffer.alloc(12 + data.length);
		out.writeUInt32BE(data.length, 0);
		out.write(type, 4);
		data.copy(out, 8);
		out.writeUInt32BE(crc(Buffer.concat([Buffer.from(type), data])), 8 + data.length);
		return out;
	};
	const [w, h] = [200, 120];
	const raw = Buffer.alloc((w * 3 + 1) * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const o = y * (w * 3 + 1) + 1 + x * 3;
			[raw[o], raw[o + 1], raw[o + 2]] = x < w / 2 ? [255, 0, 170] : [255, 220, 0];
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	writeFileSync(
		testImage,
		Buffer.concat([
			Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
			chunk("IHDR", ihdr),
			chunk("IDAT", deflateSync(raw)),
			chunk("IEND", Buffer.alloc(0)),
		]),
	);
}

// Ollama simulado (salvo con SMOKE_AI, que usa el real): sin modelos al empezar; las descargas
// avanzan en segundos, la primera del 8B se corta una vez ("EOF") para probar el reintento, y la
// del 14B va lenta para poder cancelarla.
// SMOKE_RUNTIME=1: ignora el Ollama del sistema y descarga el de verdad desde la app (red real).
const realRuntime = Boolean(process.env.SMOKE_RUNTIME);
// Respuesta de la IA simulada a «Revisar guion».
const FAKE_REVIEW = {
	verdict: "El gancho promete una respuesta, pero el cierre no la da.",
	keep: ["La pregunta del principio"],
	suggestions: [
		{
			scene: 1,
			aspect: "gancho",
			quote: "",
			problem: "La primera frase no plantea una pregunta concreta.",
			change: "Empieza con la pregunta que el video va a responder.",
			narration: "¿Por qué el cielo es azul y no blanco como la luz del Sol?",
			lines: ["¿Azul o blanco?"],
			emphasis: 0,
		},
		{
			scene: 0,
			aspect: "cierre",
			quote: "",
			problem: "El final no resume la respuesta.",
			change: "Cierra con la explicación en una frase.",
			narration: "",
			lines: [],
			emphasis: -1,
		},
	],
};
const fakeOllama = process.env.SMOKE_AI || realRuntime ? null : await startFakeOllama();
// Servidor de actualizaciones simulado: anuncia la versión 99.0.0 (no se descarga nada).
const fakeUpdates = await startFakeUpdates();

// SMOKE_PACKAGED=1: abre la app ya empaquetada (pnpm dist) en vez de la de desarrollo.
const packagedApp = {
	darwin: `dist/mac-${process.arch}/Frameflow.app/Contents/MacOS/Frameflow`,
	win32: "dist/win-unpacked/Frameflow.exe",
	linux: "dist/linux-unpacked/frameflow",
}[process.platform];
const app = await electron.launch({
	...(process.env.SMOKE_PACKAGED
		? { executablePath: join(appDir, packagedApp), args: [] }
		: { args: [appDir] }),
	cwd: process.env.SMOKE_PACKAGED ? "/" : appDir,
	env: {
		...process.env,
		FRAMEFLOW_HOME: home,
		FRAMEFLOW_TEST_MUSIC: testMusic,
		FRAMEFLOW_TEST_MEDIA: testImage,
		...(fakeOllama ? { OLLAMA_URL: fakeOllama.url } : {}),
		...(realRuntime ? { FRAMEFLOW_IGNORE_SYSTEM_OLLAMA: "1" } : {}),
		FRAMEFLOW_UPDATE_URL: fakeUpdates.url,
		FRAMEFLOW_FAKE_MIC: "1",
	},
});
const errors = [];
const expect = (ok, message) => {
	if (!ok) throw new Error(message);
};
try {
	const page = await app.firstWindow();
	page.on("pageerror", (e) => errors.push(String(e)));
	page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
	await page.setViewportSize({ width: 1280, height: 820 });

	await page.getByText("Crea tu primer canal").waitFor();
	await page.screenshot({ path: join(shots, "1-vacio.png") });

	await page.getByRole("button", { name: "Nuevo proyecto" }).click();
	await page.getByRole("button", { name: "Crear proyecto" }).click();
	await page.getByText("El nombre necesita al menos 2 caracteres").waitFor();
	await page.screenshot({ path: join(shots, "2-validacion.png") });

	await page.getByLabel("Nombre del canal").fill("Astroinfo");
	await page.getByLabel("Descripción").fill("Astronomía, datos curiosos y noticias del espacio");
	await page.getByText("Ciencia", { exact: true }).click(); // la tarjeta (label), como un usuario
	if (!(await page.getByRole("radio", { name: /Ciencia/ }).isChecked())) {
		throw new Error("La tarjeta Ciencia no quedó seleccionada");
	}
	await page.getByRole("button", { name: "Inglés" }).click();
	await page.screenshot({ path: join(shots, "3-formulario.png") });
	await page.getByRole("button", { name: "Crear proyecto" }).click();

	// Al crear, la app entra directamente al panel del proyecto.
	await page.getByRole("dialog").waitFor({ state: "detached" });
	await page.getByRole("heading", { level: 1, name: "Astroinfo" }).waitFor();
	await page.getByText("Alex (hombre)").waitFor(); // voz del preset Ciencia en español
	await page.screenshot({ path: join(shots, "4-panel-proyecto.png"), fullPage: true });

	// Una sección pendiente muestra qué hará.
	await page.getByRole("button", { name: /Calendario/ }).click();
	await page.getByText("Esta sección llega pronto").waitFor();
	const current = await page.locator('nav [aria-current="page"]').allTextContents();
	if (!current.some((t) => t.startsWith("Calendario")) || current.some((t) => t === "Panel")) {
		throw new Error(`Menú lateral: sección activa incorrecta (${current.join(", ")})`);
	}
	await page.waitForTimeout(300); // deja terminar la transición de colores antes de la captura
	await page.screenshot({ path: join(shots, "5-seccion-pronto.png") });

	// Marca y estilo: editar, validar, avisos, proteger la salida y guardar.
	await page.getByRole("button", { name: /Marca y estilo/ }).click();
	const save = page.getByRole("button", { name: "Guardar cambios" });
	const status = page.getByRole("status");
	const accent = page.getByLabel("Acento", { exact: true });
	const captionWords = page.getByTestId("preview-captions").locator("span");
	await save.waitFor();
	expect(await save.isDisabled(), "Guardar debería empezar desactivado");
	expect((await captionWords.count()) === 4, "La vista previa debería mostrar 4 palabras");

	// Colores desde una referencia (la imagen de prueba, rosa y amarilla): se proponen y se usan;
	// luego se dejan como estaban para el resto de la prueba.
	const colorKeys = ["background", "text", "accent", "muted"];
	const colorsBefore = await Promise.all(
		colorKeys.map((k) => page.locator(`#brand-color-${k}`).inputValue()),
	);
	await page.getByLabel("Elegir una imagen o un video de referencia").setInputFiles(testImage);
	await page.getByRole("button", { name: "Usar estos colores" }).waitFor();
	await page.getByRole("img", { name: /^Paleta de la referencia/ }).waitFor();
	await page.screenshot({ path: join(shots, "7a-colores-referencia.png") });
	await page.getByRole("button", { name: "Usar estos colores" }).click();
	const colorsAfter = await Promise.all(
		colorKeys.map((k) => page.locator(`#brand-color-${k}`).inputValue()),
	);
	expect(colorsAfter[0] !== colorsBefore[0], "El fondo debería tomar un color de la referencia");
	await status.getByText("Cambios sin guardar").waitFor();
	for (const [i, k] of colorKeys.entries())
		await page.locator(`#brand-color-${k}`).fill(colorsBefore[i]);

	await accent.fill("#12");
	await page.getByText("Usa 6 dígitos hexadecimales").waitFor();
	expect(await save.isDisabled(), "Un color inválido no debe poder guardarse");
	await accent.fill("#0A4A3E"); // casi el mismo verde del fondo
	await page.getByText("El acento apenas se distingue del fondo").waitFor();
	await accent.fill("#FF6B6B");
	await page.getByText("El acento apenas se distingue del fondo").waitFor({ state: "detached" });

	await page.getByLabel("Palabras en pantalla a la vez").fill("3");
	expect((await captionWords.count()) === 3, "La vista previa debería mostrar 3 palabras");
	await page.getByLabel("Llamada a la acción").fill("Síguenos para más datos del espacio");
	await page.getByLabel("Hashtags por defecto").fill("astronomía, espacio #Astronomía");
	// Estilo visual del proyecto: Holograma con el modelo del satélite (lo heredan los videos nuevos).
	await page.getByText("Holograma", { exact: true }).click();
	await page.locator("#brand-option-model").selectOption("satellite");
	await page.getByText(/Basado en «hologram-hud» de Lemo-Opuscar/).waitFor();
	await status.getByText("Cambios sin guardar").waitFor();

	// Salir con cambios pide confirmación; "Seguir editando" mantiene el borrador.
	await page.getByRole("button", { name: "Panel", exact: true }).click();
	await page.getByRole("dialog", { name: "Tienes cambios sin guardar" }).waitFor();
	await page.getByRole("button", { name: "Seguir editando" }).click();
	expect((await accent.inputValue()) === "#FF6B6B", "El borrador se perdió");
	await page.screenshot({ path: join(shots, "7-marca-editando.png") });

	await save.click();
	await status.getByText("Guardado").waitFor();
	const normalized = await page.getByLabel("Hashtags por defecto").inputValue();
	expect(normalized === "#astronomía #espacio", `Hashtags sin normalizar: "${normalized}"`);
	await page.waitForTimeout(300);
	await page.screenshot({ path: join(shots, "8-marca-guardada.png") });

	// Ya guardado, el panel sale sin preguntar y muestra la marca nueva.
	await page.getByRole("button", { name: "Panel", exact: true }).click();
	await page.getByRole("heading", { level: 1, name: "Astroinfo" }).waitFor();
	await page.locator('[title="Acento: #FF6B6B"]').waitFor();
	await page.getByRole("button", { name: /Marca y estilo/ }).click();
	const tags = await page.getByLabel("Hashtags por defecto").inputValue();
	expect(tags === "#astronomía #espacio", `Hashtags guardados inesperados: "${tags}"`);

	// Generar video (paso a paso): crear, editar el guion, guardar y ver la vista previa.
	await page
		.getByRole("button", { name: /^Generar video/ })
		.first()
		.click();
	await page.getByLabel("¿De qué trata el video?").fill("Por qué el cielo es azul");
	await page.getByText("Paso a paso", { exact: true }).click();
	await page.screenshot({ path: join(shots, "9-nuevo-video.png") });
	await page.getByRole("button", { name: "Crear video" }).click();
	await page.getByRole("heading", { level: 1, name: "Por qué el cielo es azul" }).waitFor();
	await page.getByRole("button", { name: "Generar voz" }).waitFor();

	const narration2 = page.getByLabel("Narración").nth(1);
	await narration2.fill("La luz del Sol se dispersa en el aire, y el azul se dispersa mucho más.");
	await page.getByLabel("Explicación").fill("más dispersión del azul");
	expect(
		await page.getByRole("button", { name: "Generar voz" }).isDisabled(),
		"Sin guardar no debería poder generar voz",
	);
	await page.getByRole("button", { name: "Guardar guion" }).click();
	await page.getByText(/versión 2/).waitFor();
	expect(
		!(await page.getByRole("button", { name: "Generar voz" }).isDisabled()),
		"Tras guardar debería poder generar voz",
	);
	await page.waitForTimeout(800); // deja pintar el primer fotograma de la vista previa
	await page.screenshot({ path: join(shots, "10-video-guion.png") });

	// Editor: estilo de la escena 1 (colores propios, sin fundido de salida, pausa de 1 s).
	await page.getByText("Estilo de la escena").first().click();
	await page.getByText("Colores propios", { exact: true }).first().click();
	await page.getByLabel("Acento", { exact: true }).first().fill("#FF00AA");
	await page.getByLabel("Salida").first().selectOption("none");
	await page.getByLabel("Pausa después de la voz").first().fill("1");
	await page.getByRole("button", { name: "Guardar guion" }).click();
	await page.getByText(/versión 3/).waitFor();
	await page.getByText("Estilo de la escena").first().click(); // las tarjetas se recrean al guardar
	expect(
		await page
			.getByRole("switch", { name: /Colores propios/ })
			.first()
			.isChecked(),
		"Los colores propios de la escena no se conservaron al guardar",
	);

	// Línea de tiempo: pulsar el clip de la escena 3 la resalta en el editor.
	await page.locator("[data-scroll-container]").evaluate((el) => el.scrollTo({ top: 0 }));
	await page.waitForTimeout(300);
	await page.screenshot({ path: join(shots, "10b-linea-de-tiempo.png") });
	// El documento nunca debe ser más alto que la ventana (si no, la app entera se desplaza).
	const doc = await page.evaluate(() => {
		const el = document.scrollingElement;
		return el ? { top: el.scrollTop, height: el.scrollHeight, view: el.clientHeight } : null;
	});
	expect(
		doc && doc.top === 0 && doc.height <= doc.view,
		`El documento se desplaza: ${JSON.stringify(doc)}`,
	);
	await page.getByRole("button", { name: /^3 · / }).click();
	await page.locator("fieldset.ring-violet-400", { hasText: "Escena 3" }).waitFor();
	await page.waitForTimeout(700); // termina el desplazamiento suave hasta la escena
	await page.screenshot({ path: join(shots, "11-linea-de-tiempo.png") });

	// Ajustes del video: llamada a la acción y música de fondo.
	await page.getByRole("tab", { name: /Ajustes del video/ }).click();
	// El video heredó el estilo del proyecto, y la vista previa lo dibuja (un canvas).
	expect(
		await page.getByRole("radio", { name: /^Holograma/ }).isChecked(),
		"El video debería heredar el estilo Holograma del proyecto",
	);
	expect(
		(await page.locator("#video-option-model").inputValue()) === "satellite",
		"El video debería heredar el modelo del satélite",
	);
	await page.getByText(/El del proyecto es «Holograma · Satélite»/).waitFor();
	expect(
		(await page.locator("canvas").count()) > 0,
		"La vista previa debería dibujar el holograma",
	);
	await page.screenshot({ path: join(shots, "11a-holograma.png") });
	// El catálogo ofrece Pictogramas con su opción de color…
	await page.getByText("Pictogramas", { exact: true }).click();
	await page.locator("#video-option-color").waitFor();
	expect(
		(await page.locator("#video-option-color").inputValue()) === "cycle",
		"Pictogramas debería cambiar de color en cada escena por defecto",
	);
	// Y se cambia, solo para este video, al estilo "Viaje de escala" (se guarda con los ajustes).
	await page.getByText("Viaje de escala", { exact: true }).click();
	await page.locator("#video-option-journey").waitFor();
	expect(
		(await page.locator("#video-option-journey").inputValue()) === "in",
		"El viaje debería empezar por defecto en el cosmos",
	);
	await page.locator("#video-cta").fill("Suscríbete a Astroinfo");
	await page.getByRole("button", { name: "+ Añadir música" }).click();
	await page.getByText("♪ test-music.wav").waitFor();
	await page.getByLabel("Volumen").fill("0.3");
	await page.getByRole("button", { name: "Guardar ajustes" }).click();
	await page.getByText(/versión 4/).waitFor();
	await page.getByRole("button", { name: /♪ test-music\.wav/ }).waitFor(); // clip en la línea de tiempo
	await page.locator('[data-look="scale-zoom"]').first().waitFor();
	await page.screenshot({ path: join(shots, "11a-viaje-de-escala.png") });
	await page.waitForTimeout(500);
	await page.screenshot({ path: join(shots, "11b-editor-ajustes.png") });
	await page.getByRole("tab", { name: /Guion y escenas/ }).click();

	// Editor v2 — línea de tiempo: recortar con teclado, arrastrar con el ratón, deshacer/rehacer.
	const versionText = async () =>
		(await page
			.getByText(/versión \d+/)
			.first()
			.textContent()) ?? "";
	const waitVersionAfter = async (before) => {
		const n = Number(/versión (\d+)/.exec(before)?.[1]);
		await page.getByText(new RegExp(`versión ${n + 1}\\b`)).waitFor();
	};
	const clip = (pattern) => page.getByRole("button", { name: pattern }).first();
	const dragBy = async (locator, dx, fromRight = false) => {
		const box = await locator.boundingBox();
		if (!box) throw new Error("Clip sin caja");
		const x = fromRight ? box.x + box.width - 3 : box.x + box.width / 2;
		const y = box.y + box.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + dx / 2, y, { steps: 5 });
		await page.mouse.move(x + dx, y, { steps: 5 });
		await page.mouse.up();
	};

	let before = await versionText();
	await clip(/^2 · /).focus();
	await page.keyboard.press("Alt+Shift+ArrowRight"); // +1 s de pausa tras la voz
	await waitVersionAfter(before);

	before = await versionText();
	await dragBy(clip(/Suscríbete a Astroinfo/), -60); // la llamada a la acción, antes
	await waitVersionAfter(before);

	before = await versionText();
	const firstBox = await clip(/^1 · /).boundingBox();
	const thirdBox = await clip(/^3 · /).boundingBox();
	await dragBy(clip(/^3 · /), (firstBox?.x ?? 0) - (thirdBox?.x ?? 0) - 10); // la escena 3, al principio
	await waitVersionAfter(before);
	await clip(/^1 · Frase final/).waitFor();
	await page.screenshot({ path: join(shots, "11c-escena-movida.png") });

	before = await versionText();
	await page.getByRole("button", { name: "Deshacer" }).click();
	await waitVersionAfter(before);
	await clip(/^1 · ¿Sabías/).waitFor(); // vuelve el orden original
	before = await versionText();
	await page.getByRole("button", { name: "Rehacer" }).click();
	await waitVersionAfter(before);
	await clip(/^1 · Frase final/).waitFor();
	before = await versionText();
	await page.keyboard.press("Meta+z"); // atajo de teclado
	await waitVersionAfter(before);
	await clip(/^1 · ¿Sabías/).waitFor();

	// Editor v3 — capas libres: texto e imagen encima del video, editar, arrastrar, duplicar, borrar.
	await page.getByRole("tab", { name: /^Capas/ }).click();
	before = await versionText();
	await page.getByRole("button", { name: "+ Texto" }).click();
	await waitVersionAfter(before);
	await page.getByLabel("Contenido").fill("¡Increíble!");
	await page.getByLabel("Vertical").fill("0.15");
	await page.getByRole("tab", { name: /^Capas\s*●/ }).waitFor(); // borrador sin aplicar
	before = await versionText();
	await page.getByRole("button", { name: "Aplicar" }).click();
	await waitVersionAfter(before);
	before = await versionText();
	await page.getByRole("button", { name: "+ Imagen o video" }).click();
	await waitVersionAfter(before);
	await page
		.getByRole("button", { name: /test-image\.png/ })
		.first()
		.waitFor();

	before = await versionText();
	await dragBy(clip(/^¡Increíble!/), 40); // el texto, un poco más tarde
	await waitVersionAfter(before);

	await clip(/^test-image\.png/).click(); // selecciona la imagen en la línea de tiempo
	before = await versionText();
	await page.keyboard.press("Meta+d");
	await waitVersionAfter(before);
	expect(
		(await page.locator('button[title^="test-image.png"]').count()) === 2,
		"⌘D debería duplicar la imagen",
	);
	before = await versionText();
	await page.keyboard.press("Backspace"); // borra la copia (queda seleccionada al duplicar)
	await waitVersionAfter(before);
	expect(
		(await page.locator('button[title^="test-image.png"]').count()) === 1,
		"⌫ debería borrar la copia",
	);

	// Mover y escalar la capa de texto arrastrando sobre la vista previa.
	await clip(/^¡Increíble!/).click(); // la selecciona y lleva el cabezal a su inicio
	const box = page.locator('[data-preview-box="text-1"]');
	await box.waitFor();
	const output = (id) => page.locator(`output[for="${id}"]`).textContent();
	const xBefore = await output("overlay-x");
	before = await versionText();
	await dragBy(box, -50);
	await waitVersionAfter(before);
	const xAfter = await output("overlay-x");
	expect(
		xAfter !== xBefore,
		`Arrastrar en la vista previa no movió la capa (${xBefore} → ${xAfter})`,
	);

	const scaleBefore = await output("overlay-scale");
	before = await versionText();
	const handle = box.locator("[data-scale-handle]");
	const hb = await handle.boundingBox();
	if (!hb) throw new Error("Falta el tirador de escala");
	await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
	await page.mouse.down();
	await page.mouse.move(hb.x + 30, hb.y + 30, { steps: 6 });
	await page.mouse.up();
	await waitVersionAfter(before);
	expect((await output("overlay-scale")) !== scaleBefore, "El tirador no cambió la escala");

	// Arrastrar cerca del centro la pega exactamente al 50 %.
	const preview = await page.locator('[data-preview-box="text-1"]').evaluate((el) => {
		const r = el.parentElement?.getBoundingClientRect();
		return r ? r.width : 0;
	});
	const xNow = Number.parseInt((await output("overlay-x")) ?? "50", 10) / 100;
	before = await versionText();
	await dragBy(box, (0.5 - xNow) * preview + 3); // 3 px de más: el ajuste al centro lo corrige
	await waitVersionAfter(before);
	expect(
		(await output("overlay-x")) === "50%",
		`No se pegó al centro: ${await output("overlay-x")}`,
	);
	expect(
		(await page.locator(".bg-violet-400\\/80").count()) === 0,
		"Las guías de centro deben desaparecer al soltar",
	);

	// Fotogramas clave: animar el texto de una posición a otra y comprobar que interpola.
	const seekTo = async (seconds) => {
		await page.getByLabel("Posición en el video").fill(String(seconds));
		await page.waitForTimeout(300);
	};
	const textTitle = (await clip(/^¡Increíble!/).getAttribute("title")) ?? "";
	const [, mm, ss] = /· (\d+):(\d+)/.exec(textTitle) ?? [];
	const textStart = Number(mm) * 60 + Number(ss) + 0.2; // dentro de la capa, aunque empiece en x,y s
	await seekTo(textStart);
	await page.getByText("Animar con fotogramas clave", { exact: true }).click();
	before = await versionText();
	await page.getByRole("button", { name: "Aplicar" }).click();
	await waitVersionAfter(before);
	await page.getByRole("list", { name: "Fotogramas clave" }).getByRole("button").first().waitFor();
	const xStart = await output("overlay-x");

	await seekTo(textStart + 1.5);
	before = await versionText();
	await dragBy(box, 80); // en este instante: crea el segundo fotograma
	await waitVersionAfter(before);
	expect(
		(await page.getByRole("list", { name: "Fotogramas clave" }).getByRole("button").count()) === 2,
		"Arrastrar en otro instante debería crear un segundo fotograma",
	);
	expect(
		(await clip(/^¡Increíble!/)
			.locator("[data-keyframe-marker]")
			.count()) === 2,
		"La línea de tiempo debería marcar los dos fotogramas",
	);
	const xEnd = await output("overlay-x");
	await seekTo(textStart + 0.75);
	const xMid = await output("overlay-x");
	const pctOf = (v) => Number.parseInt(v ?? "0", 10);
	expect(
		pctOf(xMid) > Math.min(pctOf(xStart), pctOf(xEnd)) &&
			pctOf(xMid) < Math.max(pctOf(xStart), pctOf(xEnd)),
		`A mitad de camino debería interpolar: ${xStart} → ${xMid} → ${xEnd}`,
	);
	await page.screenshot({ path: join(shots, "11e-fotogramas-clave.png") });

	// Curva: con "Lineal" en el segundo fotograma, a una fracción p del tramo la capa está en p.
	const keyframeChips = page.getByRole("list", { name: "Fotogramas clave" }).getByRole("button");
	const ruler = page.getByLabel("Posición en el video");
	await keyframeChips.nth(0).click();
	await page.waitForTimeout(300);
	const t1 = Number(await ruler.inputValue());
	await keyframeChips.nth(1).click();
	await page.waitForTimeout(300);
	const t2 = Number(await ruler.inputValue());
	await page.getByLabel("Curva hasta este fotograma").selectOption("linear");
	before = await versionText();
	await page.getByRole("button", { name: "Aplicar" }).click();
	await waitVersionAfter(before);
	await seekTo(t1 + 0.2 * (t2 - t1));
	const p = (Number(await ruler.inputValue()) - t1) / (t2 - t1); // la regla redondea a décimas
	const expectedLinear = pctOf(xStart) + p * (pctOf(xEnd) - pctOf(xStart));
	const xLinear = pctOf(await output("overlay-x"));
	expect(
		Math.abs(xLinear - expectedLinear) <= 2,
		`Con curva lineal, a ${Math.round(p * 100)} % del tramo se esperaba ≈${expectedLinear.toFixed(1)} % y hay ${xLinear} %`,
	);
	await keyframeChips.nth(1).click();
	expect(
		(await page.getByLabel("Curva hasta este fotograma").inputValue()) === "linear",
		"La curva elegida no se guardó",
	);

	await page.locator("[data-scroll-container]").evaluate((el) => el.scrollTo({ top: 0 }));
	await page.waitForTimeout(500);
	await page.screenshot({ path: join(shots, "11d-capas.png") });
	await page.getByRole("tab", { name: /Guion y escenas/ }).click();

	// Voz grabada (micrófono simulado: un tono): grabar, escuchar la toma y cerrar sin usarla.
	await page.getByRole("button", { name: "Grabar la voz de la escena 1" }).click();
	const recordDialog = page.getByRole("dialog", { name: "Grabar la voz de la escena 1" });
	await recordDialog.getByRole("button", { name: "Grabar", exact: true }).click();
	await recordDialog.getByRole("button", { name: "Detener" }).waitFor();
	await page.waitForTimeout(1500);
	await recordDialog.getByRole("button", { name: "Detener" }).click();
	await recordDialog.getByRole("button", { name: "Usar esta toma" }).waitFor();
	expect((await recordDialog.locator("audio").count()) === 1, "Debería poder escucharse la toma");
	await page.screenshot({ path: join(shots, "11c-grabar-voz.png") });
	await page.keyboard.press("Escape");
	await recordDialog.waitFor({ state: "detached" });

	// Publicar: sin MP4 todavía, la pestaña explica qué falta.
	await page.getByRole("tab", { name: "Publicar" }).click();
	await page.getByText("Primero crea el video").waitFor();
	await page.getByRole("tab", { name: /Guion y escenas/ }).click();

	// Prueba completa (voz real con Kokoro + render MP4): solo con SMOKE_FULL=1, tarda minutos.
	if (process.env.SMOKE_FULL) {
		// Voz grabada en la escena 1 (con Whisper real); el resto, sintética: se combinan.
		await page.getByRole("button", { name: "Grabar la voz de la escena 1" }).click();
		const take = page.getByRole("dialog", { name: "Grabar la voz de la escena 1" });
		await take.getByRole("button", { name: "Grabar", exact: true }).click();
		await page.waitForTimeout(2000);
		await take.getByRole("button", { name: "Detener" }).click();
		await take.getByRole("button", { name: "Usar esta toma" }).click();
		await take.waitFor({ state: "detached", timeout: 30_000 });
		await page.getByText("Voz grabada", { exact: true }).waitFor({ timeout: 900_000 });
		await page.getByRole("button", { name: /^Generar voz/ }).click();
		await page.getByText("Voz al día en todas las escenas").waitFor({ timeout: 600_000 });
		expect(
			(await page.getByText("Voz grabada", { exact: true }).count()) === 1,
			"La escena 1 debería conservar su voz grabada",
		);

		// Cambiar una escena solo invalida su voz: las demás se conservan.
		await page
			.getByLabel("Narración")
			.nth(1)
			.fill("El azul se dispersa más que el rojo, y por eso domina el cielo.");
		await page.getByRole("button", { name: "Guardar guion" }).click();
		await page.getByRole("button", { name: "Generar voz de 1 escena" }).waitFor();
		expect(
			(await page.getByText("Sin voz", { exact: true }).count()) === 1,
			"Solo la escena 2 debería quedar sin voz",
		);
		await page.screenshot({ path: join(shots, "12-una-escena-sin-voz.png") });
		await page.getByRole("button", { name: "Generar voz de 1 escena" }).click();
		await page.getByText("Voz al día en todas las escenas").waitFor({ timeout: 600_000 });

		// Subtítulos: lo que se muestra puede diferir de lo que se dice; los tiempos se validan.
		await page.getByRole("tab", { name: /Subtítulos/ }).click();
		await page
			.getByLabel(/Texto en pantalla para/)
			.first()
			.fill("¿¿SABÍAS");
		const firstEnd = page.getByLabel(/^Fin de/).first();
		const savedEnd = await firstEnd.inputValue();
		await firstEnd.fill("0");
		await page.getByText(/el final debe ser posterior al inicio/).waitFor();
		expect(
			await page.getByRole("button", { name: "Guardar subtítulos" }).isDisabled(),
			"Tiempos inválidos no deben guardarse",
		);
		await firstEnd.fill(savedEnd);
		before = await versionText();
		await page.getByRole("button", { name: "Guardar subtítulos" }).click();
		await waitVersionAfter(before);
		expect(
			(await page
				.getByLabel(/Texto en pantalla para/)
				.first()
				.inputValue()) === "¿¿SABÍAS",
			"El texto del subtítulo no se guardó",
		);
		expect(
			await page.getByText("Voz al día en todas las escenas").isVisible(),
			"Corregir subtítulos no debe invalidar la voz",
		);
		await page.screenshot({ path: join(shots, "12b-subtitulos.png") });
		await page.getByRole("tab", { name: /Guion y escenas/ }).click();

		await page.getByRole("button", { name: "Crear video (MP4)" }).click();
		await page.getByRole("button", { name: "Ver video" }).waitFor({ timeout: 600_000 });
		await page.waitForTimeout(500);
		await page.screenshot({ path: join(shots, "12-video-listo.png") });

		// Publicar: texto de cada red, comprobaciones, exportar (MP4 + portada + texto) y publicado.
		await page.getByRole("tab", { name: "Publicar" }).click();
		const ytTitle = page.getByLabel("Título", { exact: true });
		await ytTitle.waitFor();
		expect((await ytTitle.inputValue()).length > 0, "YouTube debería traer el título del video");
		await ytTitle.fill("x".repeat(110));
		await page.getByText(/El título tiene 110 caracteres/).waitFor();
		expect(
			await page.getByRole("button", { name: "Exportar" }).isDisabled(),
			"Con errores no se debe poder exportar",
		);
		await ytTitle.fill("Por qué el cielo es azul");
		await page.getByLabel("Hashtags").fill("#ciencia #cielo azul");
		await page.getByText(/^3 · se recomiendan 3 o menos/).waitFor();
		await page.getByRole("button", { name: "Exportar" }).click();
		await page.getByRole("button", { name: "Mostrar carpeta" }).waitFor({ timeout: 300_000 });
		const exportDir = join(home, "projects/astroinfo/exports/por-que-el-cielo-es-azul/youtube");
		for (const file of ["por-que-el-cielo-es-azul.mp4", "portada.jpg", "texto.txt"])
			expect(existsSync(join(exportDir, file)), `Falta ${file} en la exportación`);
		const notes = readFileSync(join(exportDir, "texto.txt"), "utf8");
		expect(notes.includes("#ciencia #cielo #azul"), `texto.txt sin los hashtags:\n${notes}`);
		await page.screenshot({ path: join(shots, "19-publicar.png") });
		await page
			.getByLabel("¿Ya lo publicaste? Pega el enlace")
			.fill("https://youtube.com/shorts/abc");
		await page.getByRole("button", { name: "Marcar como publicado" }).click();
		await page.getByText("Publicado", { exact: true }).waitFor();
		// Las demás redes conservan su propio texto.
		await page.getByRole("tab", { name: /TikTok/ }).click();
		expect(
			(await page.locator("#publish-caption-tiktok").inputValue()).length > 0,
			"TikTok debería traer su texto",
		);
		await page.getByRole("tab", { name: /Guion y escenas/ }).click();
	}

	// Modo automático con IA real (guion → voz → MP4 sin pararse): solo con SMOKE_AI=1.
	if (process.env.SMOKE_AI) {
		await page
			.getByRole("button", { name: /^Generar video/ })
			.first()
			.click();
		await page.getByLabel("¿De qué trata el video?").fill("Por qué Marte es rojo");
		await page.getByLabel("Duración aproximada").fill("30");
		await page.getByText("Automático con IA", { exact: true }).click();
		await page.getByRole("button", { name: "Crear video" }).click();
		await page
			.getByText(/escribiendo el guion/i)
			.first()
			.waitFor();
		await page.screenshot({ path: join(shots, "14-auto-guion.png") });
		await page.getByRole("button", { name: "Ver video" }).waitFor({ timeout: 900_000 });
		await page.waitForTimeout(800);
		await page.screenshot({ path: join(shots, "15-auto-listo.png") });
	}

	// La biblioteca lista el video.
	await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
	await page.getByRole("button", { name: /Por qué el cielo es azul/ }).waitFor();
	if (process.env.SMOKE_AI) await page.getByRole("button", { name: /Marte/ }).waitFor();
	await page.screenshot({ path: join(shots, "13-biblioteca.png") });

	// Ajustes de IA: elegir proveedor, guardar una clave (cifrada), cambiar de modelo y volver.
	// No llama a ningún servicio en la nube: la clave es de prueba y no se pulsa "Probar" en ellos.
	const aiFile = (name) => {
		const file = join(home, name);
		return existsSync(file) ? readFileSync(file, "utf8") : "";
	};
	// La pantalla cambia al instante (optimista) y el archivo se escribe justo después: se espera.
	const fileHas = async (name, text, present, message) => {
		for (let i = 0; i < 30 && aiFile(name).includes(text) !== present; i++)
			await page.waitForTimeout(100);
		expect(aiFile(name).includes(text) === present, message);
	};
	await page
		.getByRole("navigation", { name: "Aplicación" })
		.getByRole("button", { name: "Ajustes" })
		.click();
	await page.getByRole("heading", { level: 1, name: "Ajustes" }).waitFor();
	expect(
		await page.getByRole("radio", { name: /En este equipo/ }).isChecked(),
		"Ollama debería ser el proveedor por defecto",
	);
	await page.getByText(/Para tu equipo:/).waitFor();
	// Actualizaciones: aviso en la barra lateral y novedades en "Acerca de".
	await page.getByRole("region", { name: "Actualización disponible" }).first().waitFor();
	await page.getByText("Frameflow 99.0.0 disponible").first().waitFor();
	await page.getByText("Novedades de prueba: todo más rápido.").waitFor();
	await page.getByText(/^Versión 0\./).waitFor();
	await page.screenshot({ path: join(shots, "18-actualizacion.png"), fullPage: true });
	if (realRuntime) {
		// Sin Ollama: un clic descarga Ollama (verificado) y prepara el modelo.
		await page.getByText("Preparar la IA en este equipo").waitFor();
		await page.screenshot({ path: join(shots, "16r-ajustes-preparar.png") });
		await page.getByRole("button", { name: "Descargar y preparar" }).click();
		await page.getByRole("progressbar", { name: /Descargar Ollama/ }).waitFor();
		await page.screenshot({ path: join(shots, "16r-ajustes-ollama.png") });
		await page.getByText(/Listo: .* está descargado y preparado/).waitFor({ timeout: 900_000 });
		await page.getByText("Usando el Ollama que descargó Frameflow").waitFor();
	}
	// El modelo por defecto es el recomendado para este equipo (14B con 16 GB, 8B con menos).
	const modelSelect = page.getByLabel("Modelo", { exact: true });
	const LOCAL_MODELS = {
		"hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M": "Qwen3 8B",
		"hf.co/unsloth/Qwen3-14B-GGUF:Q4_K_M": "Qwen3 14B",
	};
	const firstModel = await modelSelect.inputValue();
	const firstLabel = LOCAL_MODELS[firstModel];
	expect(firstLabel, `Modelo por defecto inesperado: ${firstModel}`);
	const recommended = page.getByRole("button", { name: "Usar el recomendado" });
	expect(!(await recommended.isVisible()), "El modelo por defecto debería ser el recomendado");
	if (fakeOllama) {
		// El modelo no está: se ofrece descargarlo; el botón es la confirmación.
		await page.getByText(`${firstLabel} aún no está descargado`).waitFor();
		await page.screenshot({ path: join(shots, "16a-ajustes-descargar.png") });
		await page.getByRole("button", { name: `Descargar ${firstLabel}` }).click();
		await page.getByRole("progressbar", { name: `Descargar ${firstLabel}` }).waitFor();
		// La primera descarga se corta: aviso de reintento y sigue sola.
		await page.getByText(/Se cortó la conexión; reintentando/).waitFor({ timeout: 15_000 });
		await page.screenshot({ path: join(shots, "16b-ajustes-descargando.png") });
		await page
			.getByText(`Listo: ${firstLabel} está descargado y preparado.`)
			.waitFor({ timeout: 30_000 });
		await page.getByText("Usando el Ollama instalado en tu equipo.").waitFor();
	}
	await page.getByRole("button", { name: "Probar conexión" }).click();
	await page
		.getByRole("status")
		.filter({ hasText: /Todo listo/ })
		.waitFor();
	await page.screenshot({ path: join(shots, "16-ajustes-local.png") });
	if (fakeOllama) {
		// Otro modelo: cancelar a medias conserva lo descargado y permite continuar.
		const [otherModel, otherLabel] = Object.entries(LOCAL_MODELS).find(([id]) => id !== firstModel);
		await modelSelect.selectOption(otherModel);
		await fileHas("ai-settings.json", otherModel, true, "No se guardó el modelo elegido");
		await page.getByRole("button", { name: `Descargar ${otherLabel}` }).waitFor();
		const noSpace = await page.getByText(/Libera espacio antes de descargar/).isVisible();
		if (noSpace)
			console.log(
				"Aviso: sin espacio en disco para la descarga simulada; se omite la cancelación.",
			);
	}
	if (fakeOllama && !(await page.getByText(/Libera espacio antes de descargar/).isVisible())) {
		const [, otherLabel] = Object.entries(LOCAL_MODELS).find(([id]) => id !== firstModel);
		await page.getByRole("button", { name: `Descargar ${otherLabel}` }).click();
		await page.getByRole("progressbar", { name: `Descargar ${otherLabel}` }).waitFor();
		await page.getByRole("button", { name: "Cancelar" }).click();
		await page.getByText("Descarga cancelada. Lo descargado se conserva.").waitFor();
		await page.getByRole("button", { name: "Cerrar" }).click();
		await page.getByRole("button", { name: `Descargar ${otherLabel}` }).waitFor();
		// El atajo vuelve al recomendado (ya descargado).
		if (await recommended.isVisible()) {
			await recommended.click();
			await page.getByText("Usando el Ollama instalado en tu equipo.").waitFor();
			await fileHas("ai-settings.json", firstModel, true, "No se aplicó el recomendado");
		}
	}

	await page.getByText("Claude (Anthropic)", { exact: true }).click();
	await page.getByLabel("Clave de API", { exact: true }).waitFor();
	await fileHas("ai-settings.json", '"anthropic"', true, "No se guardó el proveedor");
	expect(
		(await page.getByRole("button", { name: "Probar conexión" }).count()) === 0,
		"Sin clave no se debería poder probar",
	);
	await page.getByLabel("Clave de API", { exact: true }).fill("clave-mal-copiada-1234");
	await page.getByText(/suelen empezar por "sk-ant-"/).waitFor();
	const fakeKey = "sk-ant-smoke-test-key-0000";
	await page.getByLabel("Clave de API", { exact: true }).fill(fakeKey);
	await page.getByRole("button", { name: "Guardar clave" }).click();
	await page.getByText("…0000").waitFor();
	const keys = aiFile("ai-keys.json");
	expect(keys.includes('"anthropic"'), "La clave no se guardó");
	expect(!keys.includes(fakeKey) && !keys.includes("smoke-test"), "La clave se guardó sin cifrar");

	await page.getByLabel("Modelo", { exact: true }).selectOption("claude-haiku-5-5");
	await page.getByText("El más rápido y económico.").waitFor();
	await page
		.getByLabel("Modelo", { exact: true })
		.selectOption({ label: "Otro modelo (escribir su ID)…" });
	await page.getByLabel("ID del modelo").fill("claude-modelo-propio");
	await page.getByRole("button", { name: "Usar" }).click();
	await page.getByText("En uso.").waitFor();
	await fileHas("ai-settings.json", "claude-modelo-propio", true, "No se guardó el modelo propio");
	await page.screenshot({ path: join(shots, "17-ajustes-claude.png") });

	// El formulario de video usa la IA elegida y lleva a Ajustes.
	await page.getByRole("button", { name: "Astroinfo" }).click();
	await page
		.getByRole("button", { name: /^Generar video/ })
		.first()
		.click();
	await page.getByText("Usa claude-modelo-propio").waitFor();
	await page.getByRole("button", { name: "Cambiar la IA" }).click();
	await page.getByRole("heading", { level: 1, name: "Ajustes" }).waitFor();

	await page.getByRole("button", { name: "Quitar" }).click();
	await page.getByRole("button", { name: "Guardar clave" }).waitFor();
	await fileHas("ai-keys.json", '"anthropic"', false, "La clave no se borró");
	await page.getByText("En este equipo (Ollama)", { exact: true }).click();
	await page.getByText(/Para tu equipo:/).waitFor();
	await fileHas("ai-settings.json", '"provider": "ollama"', true, "No se volvió a Ollama");

	// «Revisar guion» con la IA local (simulada): veredicto, propuestas y aplicar una.
	if (fakeOllama) {
		await page.getByRole("button", { name: "Astroinfo" }).click();
		await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
		await page.getByRole("button", { name: /Por qué el cielo es azul/ }).click();
		await page.getByRole("heading", { level: 1, name: "Por qué el cielo es azul" }).waitFor();
		await page.getByRole("button", { name: "Revisar guion", exact: true }).click();
		await page.getByText(FAKE_REVIEW.verdict).waitFor({ timeout: 30_000 });
		await page.getByText("Lo que funciona").waitFor();
		expect(
			(await page.getByRole("button", { name: /^Aplicar la propuesta/ }).count()) === 1,
			"Solo la propuesta con narración debería poder aplicarse",
		);
		await page.screenshot({ path: join(shots, "11f-revisar-guion.png") });
		await page.getByRole("button", { name: "Aplicar la propuesta para Escena 1" }).click();
		await page.getByText("Aplicada", { exact: true }).first().waitFor();
		const firstNarration = page.locator("textarea").first();
		await firstNarration.waitFor();
		expect(
			(await firstNarration.inputValue()) === FAKE_REVIEW.suggestions[0].narration,
			"La narración de la escena 1 debería ser la propuesta",
		);
		await page.getByRole("button", { name: "Cerrar" }).first().click();
		await page.getByRole("button", { name: "Revisar guion", exact: true }).waitFor();
	}

	// Volver al listado desde la barra lateral.
	await page.getByRole("button", { name: "Todos los proyectos" }).click();
	await page.getByRole("heading", { level: 1, name: "Proyectos" }).waitFor();
	await page.screenshot({ path: join(shots, "6-listado.png") });

	if (errors.length) throw new Error(`Errores en la consola:\n${errors.join("\n")}`);
	console.log(`OK: proyecto creado y panel navegable. Capturas en ${shots}`);
} catch (error) {
	// Captura del momento del fallo (y errores de consola) para ver qué pasó.
	const page = await app.firstWindow().catch(() => null);
	await page?.screenshot({ path: join(shots, "fallo.png") }).catch(() => undefined);
	if (errors.length) console.error(`Errores en la consola:\n${errors.join("\n")}`);
	throw error;
} finally {
	await app.close();
	fakeOllama?.close();
	fakeUpdates.close();
	// SMOKE_KEEP=1 conserva la carpeta de datos (BD, voces, MP4) para inspeccionarla.
	if (process.env.SMOKE_KEEP) console.log(`Datos conservados en ${home}`);
	else rmSync(home, { recursive: true, force: true });
}

async function startFakeOllama() {
	const installed = new Set();
	let cutOnce = true;
	let pulls = 0;
	const server = createServer(async (req, res) => {
		if (req.url === "/api/version") return json(res, { version: "0.0.0-smoke" });
		if (req.url === "/api/tags")
			return json(res, { models: [...installed].map((name) => ({ name })) });
		if (req.url === "/api/pull" && req.method === "POST") {
			let body = "";
			for await (const chunk of req) body += chunk;
			const { model } = JSON.parse(body);
			pulls++;
			const slow = pulls > 1; // la primera rápida (con un corte), las siguientes lentas
			res.writeHead(200, { "content-type": "application/x-ndjson" });
			const line = (data) => res.write(`${JSON.stringify(data)}\n`);
			line({ status: "pulling manifest" });
			const total = 5 * 1024 ** 3;
			for (let i = 1; i <= 10; i++) {
				if (res.destroyed) return;
				await new Promise((r) => setTimeout(r, slow ? 800 : 120));
				line({ status: "pulling a1", digest: "sha256:a1", total, completed: (total * i) / 10 });
				if (i === 4 && cutOnce && !slow) {
					cutOnce = false;
					line({ error: "max retries exceeded: EOF" });
					return res.end();
				}
			}
			installed.add(model);
			line({ status: "success" });
			return res.end();
		}
		if (req.url === "/api/chat" && req.method === "POST") {
			let body = "";
			for await (const chunk of req) body += chunk;
			const { messages } = JSON.parse(body);
			// Solo la revisión de guion (el modo automático con IA se prueba con SMOKE_AI y el real).
			if (!messages[0]?.content.includes("editor exigente")) return res.writeHead(404).end();
			return json(res, { message: { content: JSON.stringify(FAKE_REVIEW) } });
		}
		res.writeHead(404).end();
	});
	await new Promise((r) => server.listen(0, "127.0.0.1", r));
	return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

function json(res, data) {
	res.writeHead(200, { "content-type": "application/json" });
	res.end(JSON.stringify(data));
}

async function startFakeUpdates() {
	const feed = { darwin: "latest-mac.yml", win32: "latest.yml", linux: "latest-linux.yml" }[
		process.platform
	];
	const file = "Frameflow-99.0.0.zip";
	const yml = `version: 99.0.0
files:
  - url: ${file}
    sha512: ${"A".repeat(86)}==
    size: 1
path: ${file}
sha512: ${"A".repeat(86)}==
releaseDate: '2026-11-17T00:00:00.000Z'
releaseNotes: 'Novedades de prueba: todo más rápido.'
`;
	const server = createServer((req, res) => {
		if (req.url?.startsWith(`/${feed}`)) {
			res.writeHead(200, { "content-type": "text/yaml" });
			return res.end(yml);
		}
		res.writeHead(404).end();
	});
	await new Promise((r) => server.listen(0, "127.0.0.1", r));
	return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
