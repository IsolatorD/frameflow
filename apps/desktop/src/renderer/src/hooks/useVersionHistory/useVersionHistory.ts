import { useCallback, useEffect, useRef, useState } from "react";

type Pending = { kind: "undo" | "redo"; from: number } | null;

/**
 * Deshacer/rehacer sobre las versiones del video. Cada cambio guardado es una versión: deshacer
 * restaura la anterior (como versión nueva, así nada se pierde) y rehacer vuelve a la deshecha.
 * Cualquier cambio de versión que no venga de deshacer/rehacer (guardar, generar voz…) se apila
 * y vacía lo que hubiera para rehacer, como en cualquier editor.
 */
export function useVersionHistory(
	videoId: string,
	versionNumber: number | undefined,
	restore: (versionNumber: number) => Promise<unknown>,
) {
	const [undoStack, setUndoStack] = useState<number[]>([]);
	const [redoStack, setRedoStack] = useState<number[]>([]);
	const previous = useRef<number | undefined>(undefined);
	const pending = useRef<Pending>(null);

	// Otro video: historial nuevo.
	// biome-ignore lint/correctness/useExhaustiveDependencies: se reinicia solo al cambiar de video
	useEffect(() => {
		setUndoStack([]);
		setRedoStack([]);
		previous.current = undefined;
		pending.current = null;
	}, [videoId]);

	useEffect(() => {
		if (versionNumber === undefined) return;
		const before = previous.current;
		previous.current = versionNumber;
		if (before === undefined || before === versionNumber) return;
		const done = pending.current;
		pending.current = null;
		if (done?.kind === "undo") setRedoStack((s) => [...s, done.from]);
		else if (done?.kind === "redo") setUndoStack((s) => [...s, done.from]);
		else {
			setUndoStack((s) => [...s, before]);
			setRedoStack([]);
		}
	}, [versionNumber]);

	const go = useCallback(
		(kind: "undo" | "redo") => {
			const stack = kind === "undo" ? undoStack : redoStack;
			const target = stack.at(-1);
			if (target === undefined || versionNumber === undefined || pending.current) return;
			pending.current = { kind, from: versionNumber };
			const setStack = kind === "undo" ? setUndoStack : setRedoStack;
			setStack((s) => s.slice(0, -1));
			restore(target).catch(() => {
				// Si falla, la pila vuelve a como estaba.
				pending.current = null;
				setStack((s) => [...s, target]);
			});
		},
		[undoStack, redoStack, versionNumber, restore],
	);

	return {
		canUndo: undoStack.length > 0,
		canRedo: redoStack.length > 0,
		undo: () => go("undo"),
		redo: () => go("redo"),
	};
}
