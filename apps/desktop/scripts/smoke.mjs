// Prueba de humo de la app compilada: abre Electron con una carpeta de datos temporal,
// crea un proyecto desde la interfaz y guarda capturas en test-results/.
// Uso: pnpm smoke   (compila y ejecuta)
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const app = await electron.launch({
	args: [appDir],
	cwd: appDir,
	env: { ...process.env, FRAMEFLOW_HOME: home, FRAMEFLOW_TEST_MUSIC: testMusic },
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
	await page.getByLabel("Texto").fill("Suscríbete a Astroinfo");
	await page.getByRole("button", { name: "+ Añadir música" }).click();
	await page.getByText("♪ test-music.wav").waitFor();
	await page.getByLabel("Volumen").fill("0.3");
	await page.getByRole("button", { name: "Guardar ajustes" }).click();
	await page.getByText(/versión 4/).waitFor();
	await page.getByRole("button", { name: /♪ test-music\.wav/ }).waitFor(); // clip en la línea de tiempo
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

	// Prueba completa (voz real con Kokoro + render MP4): solo con SMOKE_FULL=1, tarda minutos.
	if (process.env.SMOKE_FULL) {
		await page.getByRole("button", { name: "Generar voz" }).click();
		await page.getByText("Voz al día en todas las escenas").waitFor({ timeout: 600_000 });

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

	// Volver al listado desde la barra lateral.
	await page.getByRole("button", { name: "Todos los proyectos" }).click();
	await page.getByRole("heading", { level: 1, name: "Proyectos" }).waitFor();
	await page.screenshot({ path: join(shots, "6-listado.png") });

	if (errors.length) throw new Error(`Errores en la consola:\n${errors.join("\n")}`);
	console.log(`OK: proyecto creado y panel navegable. Capturas en ${shots}`);
} finally {
	await app.close();
	// SMOKE_KEEP=1 conserva la carpeta de datos (BD, voces, MP4) para inspeccionarla.
	if (process.env.SMOKE_KEEP) console.log(`Datos conservados en ${home}`);
	else rmSync(home, { recursive: true, force: true });
}
