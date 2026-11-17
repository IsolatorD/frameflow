import { rmSync } from "node:fs";

/**
 * Borra la carpeta temporal de un test. En Windows el archivo de la base de datos puede seguir
 * bloqueado un momento tras cerrarla: se reintenta y, si aun así falla, se deja (es solo limpieza;
 * el sistema vacía su carpeta temporal).
 */
export function removeTempDir(dir: string) {
	try {
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
	} catch (error) {
		if (process.platform !== "win32") throw error;
	}
}
