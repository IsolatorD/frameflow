// Genera los iconos de la app a partir de brand/frameflow-icon-macos.svg:
//   resources/icon.png  (1024 px, lo usa la app en desarrollo: Dock y ventana)
//   build/icon.icns     (todas las resoluciones de macOS, para empaquetar)
// Renderiza con el Chrome headless que ya descarga Remotion (sin dependencias nuevas).
// Uso: pnpm icons
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const appDir = join(import.meta.dirname, "..");
const svg = readFileSync(join(appDir, "../../brand/frameflow-icon-macos.svg"), "utf8");
const chrome = join(
	appDir,
	"node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell",
);
if (!existsSync(chrome)) {
	throw new Error(
		`No encuentro Chrome headless en ${chrome}. Renderiza un video una vez para que Remotion lo descargue.`,
	);
}

// Tamaños del iconset de macOS: nombre → píxeles.
const ICONSET = {
	"icon_16x16.png": 16,
	"icon_16x16@2x.png": 32,
	"icon_32x32.png": 32,
	"icon_32x32@2x.png": 64,
	"icon_128x128.png": 128,
	"icon_128x128@2x.png": 256,
	"icon_256x256.png": 256,
	"icon_256x256@2x.png": 512,
	"icon_512x512.png": 512,
	"icon_512x512@2x.png": 1024,
};

const browser = await chromium.launch({ executablePath: chrome });
try {
	const page = await browser.newPage();
	const render = async (size, path) => {
		await page.setViewportSize({ width: size, height: size });
		await page.setContent(
			`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
		);
		await page.locator("svg").screenshot({ path, omitBackground: true });
	};

	mkdirSync(join(appDir, "resources"), { recursive: true });
	await render(1024, join(appDir, "resources/icon.png"));

	const iconset = join(appDir, "build/icon.iconset");
	rmSync(iconset, { recursive: true, force: true });
	mkdirSync(iconset, { recursive: true });
	for (const [name, size] of Object.entries(ICONSET)) await render(size, join(iconset, name));
	execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(appDir, "build/icon.icns")]);
	rmSync(iconset, { recursive: true, force: true });
	console.log("Iconos listos: resources/icon.png y build/icon.icns");
} finally {
	await browser.close();
}
