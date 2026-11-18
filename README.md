# Frameflow

Estudio de escritorio para crear y gestionar canales de videos animados cortos: cada **proyecto es un
canal** con su marca, sus videos, sus cuentas sociales y sus estadísticas.

Documentación de diseño: [docs/01-vision.md](docs/01-vision.md) · [docs/02-modelo-de-datos.md](docs/02-modelo-de-datos.md) · [docs/03-storyboard-v2.md](docs/03-storyboard-v2.md) · [docs/04-guion-ia.md](docs/04-guion-ia.md) · [docs/05-voz.md](docs/05-voz.md) · [docs/06-distribucion.md](docs/06-distribucion.md) · [docs/07-exportar.md](docs/07-exportar.md) · [docs/08-estilos.md](docs/08-estilos.md) · [docs/09-voz-grabada.md](docs/09-voz-grabada.md) · [docs/10-hoja-de-ruta.md](docs/10-hoja-de-ruta.md)

## Estructura

```
apps/
  desktop/              App Electron (main: BD e IPC · preload: puente · renderer: React)
packages/
  core/                 Dominio puro: storyboard v2, guion + IA, voz (fonemas, tiempos), publicar, presets, proyectos, videos
  db/                   SQLite con Drizzle (libsql): esquema, migraciones, repositorios
  ui/                   Componentes React (atoms → molecules → organisms → templates)
  renderer-remotion/    Motor de render: storyboard → MP4 con Remotion (también la vista previa)
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
SMOKE_RUNTIME=1 pnpm --filter @frameflow/desktop smoke  # ignora tu Ollama y descarga el de la app desde Ajustes (red real)
FRAMEFLOW_LIVE_RUNTIME=1 pnpm exec vitest run apps/desktop/src/main/services/localAi   # lo mismo, sin interfaz
FRAMEFLOW_LIVE_AI=1 pnpm --filter @frameflow/core exec vitest run ai.live   # guion con el modelo real
pnpm --filter @frameflow/db generate     # nueva migración tras cambiar packages/db/src/schema.ts
pnpm --filter @frameflow/desktop dist   # instalador para este sistema (apps/desktop/dist/); publicar: docs/06-distribucion.md
```

### Requisitos para generar videos

- **Voz:** nada que instalar. Kokoro corre dentro de la app (Node + ONNX Runtime); la primera vez
  descarga su modelo (92 MB) y lo verifica. Ver `docs/05-voz.md`.
- **Voz grabada (opcional):** tu propia voz, escena por escena, con el micrófono o importando un
  audio. La primera vez descarga Whisper (77 MB) para sincronizar los subtítulos. Ver
  `docs/09-voz-grabada.md`.
- **Modo automático (IA):** se elige en **Ajustes**: Ollama en este equipo (Qwen3 8B o 14B; si no
  tienes Ollama, la app lo descarga con un clic) o
  Claude, OpenAI o Gemini con tu clave de API (ver `docs/04-guion-ia.md`). Por defecto usa el modelo local recomendado para el
  equipo (14B con 16 GB de RAM o más); `FRAMEFLOW_MODEL` lo fija (también en las pruebas con IA real). Sin IA lista, la app ofrece solo el modo paso a paso.
- Los videos se guardan en `~/Frameflow/projects/<canal>/videos/<id>/` (voz y `renders/v<versión>.mp4`).

## Licencia

GPL-3.0 (ver `LICENSE`): eSpeak NG, que convierte el texto en fonemas para la voz, es GPL-3.0.
Kokoro (modelo de voz) es Apache-2.0; Remotion tiene su propia licencia. Detalles en `docs/05-voz.md`.
El estilo Holograma usa el motor de «hologram-hud» de [Lemo-Opuscar](https://github.com/lemomo-ai/lemo-opuscar)
(Lemomo · LemoLab, código MIT; ver `docs/08-estilos.md`), igual que el Viaje de escala («flat-space-explainer»).
