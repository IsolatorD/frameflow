import {
	Easing,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import type { StatScene, Theme } from "../storyboard/schema";
import { SceneFrame } from "./SceneFrame";

export const Stat = ({ scene, theme }: { scene: StatScene; theme: Theme }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const count = interpolate(frame, [0, fps * 1.2], [0, scene.value], {
		extrapolateRight: "clamp",
		easing: Easing.out(Easing.cubic),
	});
	const pop = spring({ frame, fps, config: { damping: 10 } });
	const labelIn = spring({ frame: frame - fps * 0.9, fps });
	const ring = interpolate(frame, [0, fps * 1.2], [0, 1], {
		extrapolateRight: "clamp",
		easing: Easing.out(Easing.cubic),
	});
	const radius = 300;
	const circumference = 2 * Math.PI * radius;

	return (
		<SceneFrame theme={theme}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				<div
					style={{
						position: "relative",
						width: 720,
						height: 720,
						transform: `scale(${pop})`,
					}}
				>
					<svg width={720} height={720} style={{ position: "absolute" }}>
						<title>Progreso</title>
						<circle
							cx={360}
							cy={360}
							r={radius}
							fill="none"
							stroke={theme.muted}
							strokeOpacity={0.25}
							strokeWidth={28}
						/>
						<circle
							cx={360}
							cy={360}
							r={radius}
							fill="none"
							stroke={theme.accent}
							strokeWidth={28}
							strokeLinecap="round"
							strokeDasharray={circumference}
							strokeDashoffset={circumference * (1 - ring)}
							transform="rotate(-90 360 360)"
						/>
					</svg>
					<div
						style={{
							position: "absolute",
							inset: 0,
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
							color: theme.accent,
							fontSize: 220,
							fontWeight: 800,
						}}
					>
						{Math.round(count)}
						<span style={{ fontSize: 90, marginLeft: 10 }}>{scene.suffix}</span>
					</div>
				</div>
				<div
					style={{
						marginTop: 60,
						color: theme.text,
						fontSize: 72,
						fontWeight: 600,
						textAlign: "center",
						opacity: labelIn,
						transform: `translateY(${(1 - labelIn) * 40}px)`,
					}}
				>
					{scene.label}
				</div>
			</div>
		</SceneFrame>
	);
};
