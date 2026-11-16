import type { IpcResult } from "../../../../shared/api";

/** Convierte un IpcResult en dato o excepción, para usarlo con TanStack Query. */
export async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
	const result = await promise;
	if (!result.ok) throw new Error(result.error);
	return result.data;
}
