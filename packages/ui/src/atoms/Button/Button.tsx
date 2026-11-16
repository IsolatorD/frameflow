import { BUTTON_BASE, BUTTON_VARIANTS } from "./Button.constants";
import type { ButtonProps } from "./ButtonInterface";

export function Button({
	variant = "primary",
	icon,
	loading = false,
	className = "",
	children,
	disabled,
	type = "button",
	...rest
}: ButtonProps) {
	return (
		<button
			type={type}
			className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
			disabled={disabled || loading}
			aria-busy={loading}
			{...rest}
		>
			{loading ? (
				<span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
			) : (
				icon
			)}
			{children}
		</button>
	);
}
