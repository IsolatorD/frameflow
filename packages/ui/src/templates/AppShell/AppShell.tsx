import { Logo } from "../../atoms/Logo/Logo";
import type { AppShellProps } from "./AppShellInterface";

export function AppShell({ nav, title, subtitle, eyebrow, actions, children }: AppShellProps) {
	return (
		<div className="flex h-screen bg-zinc-950 text-zinc-100">
			<aside className="relative flex w-56 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-zinc-900/50 px-3 pb-4 pt-12">
				{/* pt-12 deja sitio a los botones de ventana de macOS (titleBarStyle hiddenInset) */}
				<div className="mb-6 flex items-center gap-2 px-2">
					<Logo size={28} />
					<span className="font-semibold tracking-tight">Frameflow</span>
				</div>
				<nav aria-label="Principal" className="flex flex-col gap-5">
					{nav.map((group) => (
						<div key={group.id} className="flex flex-col gap-0.5">
							{group.label ? (
								<p className="mb-1 px-2 text-xs font-medium text-zinc-500">{group.label}</p>
							) : null}
							{group.items.map((item) => (
								<button
									key={item.id}
									type="button"
									onClick={item.onSelect}
									aria-current={item.active ? "page" : undefined}
									className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
										item.active
											? "bg-white/10 text-zinc-100"
											: "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
									}`}
								>
									{item.dotColor ? (
										<span
											aria-hidden="true"
											className="size-2 shrink-0 rounded-full"
											style={{ backgroundColor: item.dotColor }}
										/>
									) : null}
									<span className="min-w-0 flex-1 truncate">{item.label}</span>
									{item.badge ? (
										<span className="rounded bg-white/5 px-1.5 text-[11px] text-zinc-500">
											{item.badge}
										</span>
									) : null}
								</button>
							))}
						</div>
					))}
				</nav>
			</aside>
			<main className="flex min-w-0 flex-1 flex-col">
				<header className="flex items-end justify-between gap-4 border-b border-white/5 px-8 pb-5 pt-10 [-webkit-app-region:drag]">
					<div className="min-w-0">
						{eyebrow ? (
							<div className="mb-1 text-xs text-zinc-500 [-webkit-app-region:no-drag]">
								{eyebrow}
							</div>
						) : null}
						<h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
						{subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
					</div>
					<div className="shrink-0 [-webkit-app-region:no-drag]">{actions}</div>
				</header>
				{/* relative: los controles sr-only (position: absolute) quedan dentro y no alargan el documento */}
				<div data-scroll-container className="relative flex-1 overflow-y-auto px-8 py-6">
					{children}
				</div>
			</main>
		</div>
	);
}
