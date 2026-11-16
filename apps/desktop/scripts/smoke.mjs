// Prueba de humo de la app compilada: abre Electron con una carpeta de datos temporal,
// crea un proyecto desde la interfaz y guarda capturas en test-results/.
// Uso: pnpm smoke   (compila y ejecuta)
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "playwright-core";

const appDir = join(import.meta.dirname, "..");
const shots = join(appDir, "test-results");
mkdirSync(shots, { recursive: true });
const home = mkdtempSync(join(tmpdir(), "frameflow-smoke-"));

const app = await electron.launch({
	args: [appDir],
	cwd: appDir,
	env: { ...process.env, FRAMEFLOW_HOME: home },
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

	// Prueba completa (voz real con Kokoro + render MP4): solo con SMOKE_FULL=1, tarda minutos.
	if (process.env.SMOKE_FULL) {
		await page.getByRole("button", { name: "Generar voz" }).click();
		await page.getByRole("button", { name: "Regenerar voz" }).waitFor({ timeout: 600_000 });
		await page.screenshot({ path: join(shots, "11-video-con-voz.png") });
		await page.getByRole("button", { name: "Crear video (MP4)" }).click();
		await page.getByRole("button", { name: "Ver video" }).waitFor({ timeout: 600_000 });
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
