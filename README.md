# Frameflow

Estudio de escritorio para crear y gestionar canales de videos animados cortos: cada **proyecto es un
canal** con su marca, sus videos, sus cuentas sociales y sus estadísticas.

Documentación de diseño: [docs/01-vision.md](docs/01-vision.md) · [docs/02-modelo-de-datos.md](docs/02-modelo-de-datos.md) · [docs/03-storyboard-v2.md](docs/03-storyboard-v2.md)

## Estructura

```
apps/
  desktop/              App Electron (main: BD e IPC · preload: puente · renderer: React)
packages/
  core/                 Dominio puro: storyboard v2, guion + IA, presets, proyectos, videos
  db/                   SQLite con Drizzle (libsql): esquema, migraciones, repositorios
  ui/                   Componentes React (atoms → molecules → organisms → templates)
  renderer-remotion/    Motor de render: storyboard → MP4 con Remotion (también la vista previa)
  tts/                  Servicio de voz en Python (uv): Kokoro + Whisper para tiempos por palabra
prototype/              Prototipo original (voz Kokoro, Whisper, generador IA); referencia
```

Reglas:

- La interfaz no toca la BD: llama a `services/` → IPC → proceso principal. Los componentes solo usan hooks.
- `packages/ui` es presentación pura (sin datos), reutilizable por una futura app web.
- Una carpeta por componente/hook/service: `Nombre/Nombre.tsx`, `NombreInterface.d.ts`, `Nombre.constants.ts`.

## Desarrollo

```bash
nvm use            # Node 24
pnpm install
pnpm dev           # abre la app (datos en ~/Frameflow; FRAMEFLOW_HOME para otra carpeta)
pnpm test          # tests de core y db
pnpm typecheck
pnpm --filter @frameflow/desktop smoke   # compila, abre la app y recorre proyecto → marca → video (capturas en test-results/)
SMOKE_FULL=1 pnpm --filter @frameflow/desktop smoke   # además genera voz real y el MP4 (tarda minutos)
SMOKE_AI=1 pnpm --filter @frameflow/desktop smoke     # además prueba el modo automático con la IA real
FRAMEFLOW_LIVE_AI=1 pnpm --filter @frameflow/core exec vitest run ai.live   # guion con el modelo real
pnpm --filter @frameflow/db generate     # nueva migración tras cambiar packages/db/src/schema.ts
```

### Requisitos para generar videos

- **Voz:** `brew install uv espeak-ng`. La primera vez, uv instala el entorno de `packages/tts` y Kokoro
  descarga su modelo (unos minutos); después se reutiliza.
- **Modo automático (IA):** Ollama en marcha con el modelo de `FRAMEFLOW_MODEL`
  (por defecto `hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M`). Sin él, la app ofrece solo el modo paso a paso.
- Los videos se guardan en `~/Frameflow/projects/<canal>/videos/<id>/` (voz y `renders/v<versión>.mp4`).
