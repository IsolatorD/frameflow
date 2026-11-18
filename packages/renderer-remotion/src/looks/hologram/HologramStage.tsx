import type { Storyboard } from "@frameflow/core/storyboard";
import { loadFont as loadRajdhani } from "@remotion/google-fonts/Rajdhani";
import { loadFont as loadShareTechMono } from "@remotion/google-fonts/ShareTechMono";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { type HoloModelId, holoModel, isHoloModelId, modelRadius } from "./models";
import { type Camera, drawPad, drawScanPlane, Holo, type HoloModel } from "./vendor/holo.js";
import * as U from "./vendor/hud.js";

// Estilo "Holograma": coreografía propia de Frameflow sobre el motor de hologram-hud de
// Lemo-Opuscar (vendor/, MIT). Un canvas que se redibuja en cada fotograma (determinista: solo
// depende del segundo t), con las escenas del storyboard como guion:
//   · al empezar, el modelo se "escanea" de abajo arriba sobre el proyector;
//   · escena de cifra → recuadro que fija una parte del modelo + línea guía + tarjeta con el
//     número rodando hasta su valor;
//   · escena de texto → panel con las líneas apareciendo como en una consola;
//   · al cambiar de escena, un destello de "glitch".
// Los subtítulos, las capas y la llamada a la acción van encima, como en el resto de estilos.

const ui = loadRajdhani("normal", {
	weights: ["400", "500", "600"],
	subsets: ["latin", "latin-ext"],
});
const mono = loadShareTechMono("normal", { weights: ["400"], subsets: ["latin"] });
U.FONT.ui = ui.fontFamily;
U.FONT.mono = mono.fontFamily;

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const sine = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);
const eo = (k: number) => 1 - (1 - k) ** 3;

/** Tono (0–360) de un color #RRGGBB, o null si es gris. */
export function hueOf(hex: string): number | null {
	const m = /^#([0-9a-f]{6})$/i.exec(hex);
	if (!m) return null;
	const n = Number.parseInt(m[1] as string, 16);
	const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [
		number,
		number,
		number,
	];
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	if (max - min < 0.08) return null;
	const d = max - min;
	const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return Math.round((h * 60 + 360) % 360);
}

type Scene = {
	start: number;
	end: number;
	content:
		| { type: "kinetic-text"; lines: { text: string; emphasis?: boolean }[] }
		| { type: "stat"; value: number; label: string; suffix?: string };
};

const scenesOf = (storyboard: Storyboard): Scene[] =>
	storyboard.tracks
		.filter((t) => t.kind === "visual" && !t.hidden)
		.flatMap((t) => t.clips as readonly { type: string }[])
		.filter(
			(c): c is { type: "scene"; start: number; duration: number; content: Scene["content"] } =>
				c.type === "scene",
		)
		.map((c) => ({ start: c.start, end: c.start + c.duration, content: c.content }))
		.sort((a, b) => a.start - b.start);

const formatValue = (value: number, language: string) =>
	value.toLocaleString(language === "en" ? "en-US" : "es-ES", { maximumFractionDigits: 2 });

export const HologramStage = ({
	storyboard,
	options,
}: {
	storyboard: Storyboard;
	options: Record<string, string>;
}) => {
	const frame = useCurrentFrame();
	const { width: W, height: H, fps } = useVideoConfig();
	const canvas = useRef<HTMLCanvasElement>(null);
	const holo = useMemo(() => new Holo(W, H), [W, H]);
	const modelId: HoloModelId = isHoloModelId(options.model) ? options.model : "planet";
	const model = useMemo(() => holoModel(modelId), [modelId]);
	const radius = useMemo(() => modelRadius(model), [model]);
	const scenes = useMemo(() => scenesOf(storyboard), [storyboard]);
	const { accent, background } = storyboard.style.theme;

	useLayoutEffect(() => {
		const ctx = canvas.current?.getContext("2d");
		if (!ctx) return;
		const hue = hueOf(accent) ?? 190;
		// Énfasis: ámbar sobre tonos fríos (como el original); si no, el complementario.
		const emphasis = hue >= 150 && hue <= 260 ? 38 : (hue + 180) % 360;
		const T = U.theme(hue, emphasis);
		drawFrame(ctx, {
			t: frame / fps,
			W,
			H,
			T,
			holo,
			model,
			radius,
			scenes,
			title: storyboard.title,
			language: storyboard.language,
		});
	}, [
		frame,
		fps,
		W,
		H,
		holo,
		model,
		radius,
		scenes,
		accent,
		storyboard.title,
		storyboard.language,
	]);

	return (
		<AbsoluteFill style={{ backgroundColor: background }}>
			<canvas ref={canvas} width={W} height={H} style={{ width: "100%", height: "100%" }} />
		</AbsoluteFill>
	);
};

function drawFrame(
	ctx: CanvasRenderingContext2D,
	s: {
		t: number;
		W: number;
		H: number;
		T: U.HudTheme;
		holo: Holo;
		model: HoloModel;
		/** Radio envolvente del modelo (para que la cámara lo encuadre entero). */
		radius: number;
		scenes: Scene[];
		title: string;
		language: string;
	},
) {
	const { t, W, H, T, holo, model, scenes } = s;
	const portrait = H > W;
	const frame24 = Math.round(t * 24);
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, W, H);

	// ---- Cámara: el modelo gira despacio; en vertical, arriba (deja sitio a tarjetas y subtítulos).
	const top = model.ymax;
	// Distancia para que la esfera envolvente quepa en la zona del modelo: en vertical, casi todo el
	// ancho y ~40 % del alto (debajo van tarjetas y subtítulos); en horizontal, la mitad izquierda.
	const foc = H / 2 / Math.tan(0.3);
	const fitW = (W / 2 / foc) * (portrait ? 0.86 : 0.62);
	const fitH = (H / 2 / foc) * (portrait ? 0.36 : 0.75);
	const dist = (s.radius * 1.05) / Math.min(fitW, fitH);
	const cam: Camera = {
		target: [0, top * 0.5, 0],
		yaw: 0.55 + Math.sin(t * 0.12) * 0.25,
		pitch: 0.18 + Math.sin(t * 0.09) * 0.05,
		dist,
		fov: 0.6,
		cx: (portrait ? 0.5 : 0.36) * W,
		cy: (portrait ? 0.3 : 0.48) * H,
		roll: 0,
	};
	const spin = t * 0.22;

	// ---- Escena activa
	const index = scenes.findIndex((sc) => t >= sc.start && t < sc.end);
	const scene = index >= 0 ? scenes[index] : undefined;
	const k = scene ? t - scene.start : 0;
	const out = scene ? 1 - seg(t, scene.end - 0.35, scene.end - 0.05) : 0;
	const parts = model.parts.map((p) => p.id);
	const part = parts[Math.max(0, index) % parts.length] as string;
	const statScene = scene?.content.type === "stat";

	// Escaneo inicial y ola de luz en las escenas de texto
	const scan =
		t < 2.7 ? { y: lerp(0.15, 1.12, sine(seg(t, -0.3, 2.6))) * top, band: 0.07 * top } : null;
	const wave =
		scene && !statScene && k < 1.6
			? { y: lerp(-0.1, 1.25, seg(k, 0, 1.5)) * top, w: 0.06 * top }
			: null;
	const focusK = statScene ? seg(k, 0, 0.3) * out : 0;

	// ---- Fondo, proyector, haz y modelo
	U.background(ctx, W, H, T, {
		px: -cam.yaw * 260,
		py: cam.pitch * 300,
		cx: cam.cx,
		cy: (cam.cy ?? 0) + 40,
	});
	drawPad(ctx, cam, W, H, { hue: T.hue, rot: t * 0.12 + spin, alpha: clamp(0.25 + t * 0.5) });
	const solid = clamp((t - 2.4) / 0.6) * 0.35;
	const info = holo.draw(ctx, model, cam, {
		hue: T.hue,
		spin,
		scan,
		wave,
		solid,
		focus: focusK > 0 ? part : undefined,
		dim: lerp(1, 0.18, focusK),
		explode: statScene ? { [part]: eo(seg(k, 0.1, 0.6)) * out } : undefined,
		scanOffset: t * 24,
		lineWidth: portrait ? 1.6 : 1.3,
	});
	if (scan && scan.y < 1.1 * top)
		drawScanPlane(ctx, cam, W, H, scan.y, {
			hue: T.hue,
			r: 1.0,
			rot: t * 0.3,
			alpha: 1 - seg(t, 2.35, 2.7),
		});

	// ---- Interfaz de la escena
	const pad = portrait ? 90 : 0;
	const cardX = portrait ? pad + 22 : W * 0.6;
	const cardY = portrait ? H * 0.5 : H * 0.3;
	const cardW = portrait ? W - 2 * (pad + 22) : W * 0.34;
	if (scene && scene.content.type === "stat") {
		const c = scene.content;
		const bb = info.bbox[part];
		const tag = `TGT ${String(index + 1).padStart(2, "0")} · LOCK`;
		if (bb) U.targetBox(ctx, T, bb, seg(k, 0, 0.22), { alpha: out, flash: k < 0.12, tag, pad: 22 });
		const anchor = info.anchor[part];
		if (anchor) {
			const elbow: [number, number] = portrait
				? [anchor[0], lerp(anchor[1], cardY - 30, 0.6)]
				: [lerp(anchor[0], cardX - 30, 0.55), cardY];
			U.leader(
				ctx,
				T,
				anchor,
				elbow,
				portrait ? [elbow[0], cardY - 12] : [cardX - 12, cardY],
				seg(k, 0.15, 0.55),
				{
					alpha: out,
					pulse: k > 1.1 ? seg(k, 1.1, 1.6) : 0,
				},
			);
		}
		U.specCard(
			ctx,
			T,
			cardX,
			cardY,
			{ label: c.label, value: formatValue(c.value, s.language), unit: c.suffix ?? "" },
			{
				reveal: seg(k, 0.25, 0.65),
				roll: seg(k, 0.45, 1.15),
				detail: 0,
				frame: frame24,
				flash: k >= 1.15 && k < 1.25,
			},
			{
				index: String(index + 1).padStart(2, "0"),
				alpha: out,
				w: cardW,
				big: portrait ? 170 : 136,
			},
		);
	} else if (scene && scene.content.type === "kinetic-text") {
		textPanel(ctx, T, scene.content.lines, {
			x: cardX,
			y: cardY,
			w: cardW,
			k,
			out,
			frame: frame24,
			size: portrait ? 76 : 58,
			index,
		});
	}

	// ---- Marco del visor, viñeta y glitch al cambiar de escena
	U.chrome(ctx, W, H, T, {
		tl: `${s.title.toUpperCase().slice(0, portrait ? 26 : 48)}  //  SCAN`,
		tr: `SCN ${String(Math.max(1, index + 1)).padStart(2, "0")}/${String(scenes.length).padStart(2, "0")}`,
		bl: `HOLO.${String(frame24).padStart(4, "0")}`,
		br: `${(cam.yaw * 57.3).toFixed(1)}°  ·  ${(cam.pitch * 57.3).toFixed(1)}°`,
		px: -cam.yaw * 200,
	});
	U.vignette(ctx, W, H, 0.5);
	if (scene && index > 0 && k < 0.12) U.glitch(ctx, W, H, 1 - k / 0.12, frame24 * 7.3);
}

/** Panel de texto: placa translúcida y líneas que aparecen "decodificándose" una tras otra. */
function textPanel(
	ctx: CanvasRenderingContext2D,
	T: U.HudTheme,
	lines: readonly { text: string; emphasis?: boolean }[],
	o: {
		x: number;
		y: number;
		w: number;
		k: number;
		out: number;
		frame: number;
		size: number;
		index: number;
	},
) {
	const reveal = seg(o.k, 0.1, 0.45);
	if (reveal <= 0 || o.out <= 0) return;
	ctx.save();
	// Medir cada línea (reduciendo la letra si no cabe) para dimensionar la placa.
	const sizes = lines.map((l) =>
		U.fitFont(ctx, l.text.toUpperCase(), l.emphasis ? 600 : 500, o.size, U.FONT.ui, o.w, 28),
	);
	const h = 54 + sizes.reduce((acc, s) => acc + s * 1.12, 0);
	U.plate(ctx, T, o.x - 22, o.y - 20, (o.w + 44) * eo(reveal), h + 24, o.out * clamp(reveal * 2));
	ctx.globalCompositeOperation = "lighter";
	ctx.strokeStyle = T.line(0.9 * o.out);
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(o.x, o.y);
	ctx.lineTo(o.x + o.w * eo(reveal), o.y);
	ctx.stroke();
	ctx.font = `20px ${U.FONT.mono}`;
	ctx.fillStyle = T.dim(0.95 * o.out);
	ctx.textBaseline = "alphabetic";
	ctx.textAlign = "left";
	ctx.fillText(`LOG ${String(o.index + 1).padStart(2, "0")}`, o.x, o.y + 32);
	let y = o.y + 48;
	lines.forEach((line, i) => {
		const size = sizes[i] as number;
		y += size * 1.0;
		const k = seg(o.k, 0.3 + i * 0.25, 0.75 + i * 0.25);
		if (k <= 0) {
			y += size * 0.12;
			return;
		}
		ctx.font = `${line.emphasis ? 600 : 500} ${size}px ${U.FONT.ui}`;
		ctx.letterSpacing = "2px";
		ctx.fillStyle = line.emphasis ? T.acc(o.out) : T.hi(0.95 * o.out);
		ctx.fillText(U.rollText(line.text.toUpperCase(), k, o.frame, 5 + i), o.x, y);
		ctx.letterSpacing = "0px";
		y += size * 0.12;
	});
	ctx.restore();
}
