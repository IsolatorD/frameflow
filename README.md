# Frameflow

Estudio de escritorio para crear y gestionar canales de videos animados cortos: cada **proyecto es un
canal** con su marca, sus videos, sus cuentas sociales y sus estadísticas.

Documentación de diseño: [docs/01-vision.md](docs/01-vision.md) · [docs/02-modelo-de-datos.md](docs/02-modelo-de-datos.md)

## Estructura

```
apps/
  desktop/              App Electron (main: BD e IPC · preload: puente · renderer: React)
packages/
  core/                 Dominio puro: storyboard (zod), presets de nicho, proyectos
  db/                   SQLite con Drizzle (libsql): esquema, migraciones, repositorios
  ui/                   Componentes React (atoms → molecules → organisms → templates)
  renderer-remotion/    Motor de render: storyboard → MP4 con Remotion
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
pnpm --filter @frameflow/desktop smoke   # compila, abre la app y crea un proyecto (capturas en test-results/)
pnpm --filter @frameflow/db generate     # nueva migración tras cambiar packages/db/src/schema.ts
```
