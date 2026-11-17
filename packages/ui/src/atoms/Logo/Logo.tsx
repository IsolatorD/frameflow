import { LOGO_FRAME, LOGO_FRAMES, LOGO_PLATE, LOGO_PLAY } from "./Logo.constants";
import type { LogoProps } from "./LogoInterface";

/** Icono de Frameflow: tres fotogramas en flujo con un play en el delantero. */
export function Logo({ size = 28, title, className = "" }: LogoProps) {
	return (
		<svg
			viewBox="0 0 140 140"
			width={size}
			height={size}
			className={className}
			role={title ? "img" : undefined}
			aria-label={title}
			aria-hidden={title ? undefined : true}
		>
			<rect width="140" height="140" rx="32" fill={LOGO_PLATE} />
			{LOGO_FRAMES.map((frame) => (
				<rect key={frame.x} x={frame.x} y={frame.y} {...LOGO_FRAME} fill={frame.fill} />
			))}
			<polygon
				points={LOGO_PLAY}
				fill={LOGO_PLATE}
				stroke={LOGO_PLATE}
				strokeWidth={5}
				strokeLinejoin="round"
			/>
		</svg>
	);
}
