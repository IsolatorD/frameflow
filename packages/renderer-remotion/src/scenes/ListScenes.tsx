import type {
	ChartContent,
	CompareContent,
	StepsContent,
	Theme,
	TimelineContent,
} from "@frameflow/core/storyboard";
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame, STAGGER_SECONDS } from "./SceneFrame";

// Escenas con varios elementos (pasos, línea de tiempo, comparación y gráfico) en el estilo
// Libre: colores del tema, un elemento detrás de otro. Los demás estilos visuales las dibujan
// encima de su fondo, sobre una placa (`plate`).

type Props<T> = { content: T; theme: Theme; plate?: boolean };

/** Avance de la entrada del elemento i (con un pequeño rebote). */
function useEnter() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	return (i: number, delay = 0.25) =>
		spring({
			frame: frame - (delay + i * STAGGER_SECONDS) * fps,
			fps,
			config: { damping: 13, mass: 0.6 },
		});
}

const rise = (k: number, px = 50): CSSProperties => ({
	opacity: Math.min(1, k),
	transform: `translateY(${(1 - k) * px}px)`,
});

function Title({ text, theme, k }: { text?: string; theme: Theme; k: number }) {
	if (!text) return null;
	return (
		<div
			style={{
				...rise(k, 30),
				color: theme.accent,
				fontSize: 56,
				fontWeight: 800,
				letterSpacing: 1,
				marginBottom: 44,
				textAlign: "center",
			}}
		>
			{text}
		</div>
	);
}

function Column({ children, gap = 34 }: { children: ReactNode; gap?: number }) {
	return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}

export function Steps({ content, theme, plate }: Props<StepsContent>) {
	const enter = useEnter();
	const big = content.items.length <= 3;
	return (
		<SceneFrame theme={theme} plate={plate}>
			<Title text={content.title} theme={theme} k={enter(0, 0)} />
			<Column>
				{content.items.map((item, i) => {
					const k = enter(i);
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: los elementos son fijos durante el render; la posición es su identidad
							key={`${i}-${item}`}
							style={{ ...rise(k), display: "flex", alignItems: "center", gap: 36 }}
						>
							<div
								style={{
									flexShrink: 0,
									width: big ? 120 : 96,
									height: big ? 120 : 96,
									borderRadius: "50%",
									background: theme.accent,
									color: theme.background,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: big ? 64 : 52,
									fontWeight: 900,
									transform: `scale(${0.5 + 0.5 * Math.min(1, k)})`,
								}}
							>
								{i + 1}
							</div>
							<div
								style={{
									color: theme.text,
									fontSize: big ? 68 : 56,
									fontWeight: 700,
									lineHeight: 1.1,
								}}
							>
								{item}
							</div>
						</div>
					);
				})}
			</Column>
		</SceneFrame>
	);
}

export function Timeline({ content, theme, plate }: Props<TimelineContent>) {
	const enter = useEnter();
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const n = content.events.length;
	// La línea crece de arriba abajo al ritmo de los hitos.
	const line = interpolate(frame, [0.2 * fps, (0.25 + n * STAGGER_SECONDS) * fps], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: Easing.out(Easing.cubic),
	});
	return (
		<SceneFrame theme={theme} plate={plate}>
			<Title text={content.title} theme={theme} k={enter(0, 0)} />
			<div style={{ position: "relative", paddingLeft: 70 }}>
				<div
					style={{
						position: "absolute",
						left: 22,
						top: 20,
						bottom: 20,
						width: 8,
						borderRadius: 4,
						background: `color-mix(in srgb, ${theme.muted} 40%, transparent)`,
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: 22,
						top: 20,
						width: 8,
						height: `calc((100% - 40px) * ${line})`,
						borderRadius: 4,
						background: theme.accent,
					}}
				/>
				<Column gap={44}>
					{content.events.map((e, i) => {
						const k = enter(i);
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: los elementos son fijos durante el render; la posición es su identidad
							<div key={`${i}-${e.when}`} style={{ ...rise(k), position: "relative" }}>
								<div
									style={{
										position: "absolute",
										left: -62,
										top: 14,
										width: 36,
										height: 36,
										borderRadius: "50%",
										background: theme.accent,
										border: `8px solid ${theme.background}`,
										transform: `scale(${Math.min(1, k)})`,
									}}
								/>
								<div style={{ color: theme.accent, fontSize: 60, fontWeight: 900, lineHeight: 1 }}>
									{e.when}
								</div>
								<div
									style={{
										color: theme.text,
										fontSize: 52,
										fontWeight: 600,
										lineHeight: 1.15,
										marginTop: 8,
									}}
								>
									{e.label}
								</div>
							</div>
						);
					})}
				</Column>
			</div>
		</SceneFrame>
	);
}

export function Compare({ content, theme, plate }: Props<CompareContent>) {
	const enter = useEnter();
	const vs = enter(1, 0.45);
	return (
		<SceneFrame theme={theme} plate={plate}>
			<Title text={content.title} theme={theme} k={enter(0, 0)} />
			<div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: 28 }}>
				{content.items.map((item, i) => {
					const k = enter(i * 2);
					const side = i === 0 ? -1 : 1;
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: los elementos son fijos durante el render; la posición es su identidad
							key={`${i}-${item.label}`}
							style={{
								flex: 1,
								opacity: Math.min(1, k),
								transform: `translateX(${(1 - k) * side * 80}px)`,
								borderRadius: 32,
								padding: "44px 28px",
								background:
									i === 0
										? `color-mix(in srgb, ${theme.text} 10%, transparent)`
										: `color-mix(in srgb, ${theme.accent} 22%, transparent)`,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								gap: 18,
								textAlign: "center",
							}}
						>
							<div style={{ color: theme.text, fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>
								{item.label}
							</div>
							{item.detail ? (
								<div
									style={{ color: theme.accent, fontSize: 46, fontWeight: 700, lineHeight: 1.15 }}
								>
									{item.detail}
								</div>
							) : null}
						</div>
					);
				})}
			</div>
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					marginTop: -24,
					transform: `scale(${Math.min(1.2, vs)})`,
					opacity: Math.min(1, vs),
				}}
			>
				<div
					style={{
						background: theme.accent,
						color: theme.background,
						fontSize: 44,
						fontWeight: 900,
						padding: "12px 30px",
						borderRadius: 999,
					}}
				>
					VS
				</div>
			</div>
		</SceneFrame>
	);
}

const formatNumber = (n: number) =>
	n.toLocaleString("es-ES", { maximumFractionDigits: n < 10 ? 2 : n < 100 ? 1 : 0 });

export function Chart({ content, theme, plate }: Props<ChartContent>) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const enter = useEnter();
	const max = Math.max(...content.bars.map((b) => b.value), 1e-9);
	const suffix = content.suffix ?? "";
	return (
		<SceneFrame theme={theme} plate={plate}>
			<Title text={content.title} theme={theme} k={enter(0, 0)} />
			<Column gap={30}>
				{content.bars.map((bar, i) => {
					const start = (0.25 + i * STAGGER_SECONDS) * fps;
					const grow = interpolate(frame, [start, start + 0.8 * fps], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
						easing: Easing.out(Easing.cubic),
					});
					const top = bar.value === max;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: los elementos son fijos durante el render; la posición es su identidad
						<div key={`${i}-${bar.label}`} style={{ opacity: Math.min(1, grow * 3) }}>
							<div style={{ color: theme.text, fontSize: 46, fontWeight: 700, marginBottom: 10 }}>
								{bar.label}
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
								<div
									style={{
										height: 64,
										width: `${Math.max(2, (bar.value / max) * 78 * grow)}%`,
										borderRadius: 16,
										background: top
											? theme.accent
											: `color-mix(in srgb, ${theme.accent} 45%, ${theme.muted})`,
									}}
								/>
								<div
									style={{
										color: top ? theme.accent : theme.text,
										fontSize: 50,
										fontWeight: 900,
										whiteSpace: "nowrap",
									}}
								>
									{formatNumber(bar.value * grow)}
									{suffix}
								</div>
							</div>
						</div>
					);
				})}
			</Column>
		</SceneFrame>
	);
}
