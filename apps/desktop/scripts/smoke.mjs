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

	// Volver al listado desde la barra lateral.
	await page.getByRole("button", { name: "Todos los proyectos" }).click();
	await page.getByRole("heading", { level: 1, name: "Proyectos" }).waitFor();
	await page.screenshot({ path: join(shots, "6-listado.png") });

	if (errors.length) throw new Error(`Errores en la consola:\n${errors.join("\n")}`);
	console.log(`OK: proyecto creado y panel navegable. Capturas en ${shots}`);
} finally {
	await app.close();
	rmSync(home, { recursive: true, force: true });
}
