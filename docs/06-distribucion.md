# Distribución y actualizaciones

> 2026-11-17 · `apps/desktop/electron-builder.yml`, `.github/workflows/release.yml`,
> `apps/desktop/src/main/services/updates.ts`.

## Publicar una versión

1. Subir la versión en `apps/desktop/package.json` (semver: 0.1.0 → 0.2.0).
2. Commit, etiqueta y push:

   ```bash
   git commit -am "Versión 0.2.0"
   git tag v0.2.0
   git push && git push --tags
   ```

3. GitHub Actions (`release.yml`):
   - comprueba que la etiqueta coincide con la versión;
   - crea la release como **borrador**;
   - compila en macOS (Apple Silicon), Windows y Linux, pasa los tests y sube los instaladores;
   - **publica** la release solo cuando están todos.

   Las novedades se generan a partir de los commits; se pueden editar en GitHub.

| Sistema | Instalador                             | Se actualiza desde la app            |
| ------- | -------------------------------------- | ------------------------------------ |
| macOS   | `.dmg` (y `.zip` para el actualizador) | No todavía: avisa y abre la descarga |
| Windows | `.exe` (NSIS, por usuario)             | Sí                                   |
| Linux   | `.AppImage`                            | Sí                                   |

Local (solo el sistema actual): `pnpm --filter @frameflow/desktop dist` → `apps/desktop/dist/`.

## Cómo se actualiza la app

- Al abrir (a los 15 s) y cada 6 horas mira la última release publicada en GitHub (`latest*.yml`).
- Si hay versión nueva, aparece un aviso en la barra lateral y en Ajustes → Acerca de (con las
  novedades). **Nunca descarga sin que el usuario lo pida.**
- Windows/Linux: "Actualizar" descarga en segundo plano (solo lo que cambió) y luego "Reiniciar y
  actualizar". Si hay un video generándose, espera a que termine. Si no se reinicia, se instala al
  cerrar la app.
- macOS: sin firma de Apple la app no puede reemplazarse a sí misma, así que "Descargar" abre la
  página de la versión.

## Datos del usuario

Las actualizaciones solo reemplazan la app. Los datos (`~/Frameflow`) se conservan: base de datos,
proyectos, claves cifradas, Ollama y modelos descargados.

- Antes de aplicar migraciones a una base con datos se hace una copia en `~/Frameflow/backups/` (se
  conservan las 5 últimas).
- Si una versión antigua abre datos migrados por una más nueva, avisa y se cierra **sin tocarlos**.
- Las migraciones deben ser siempre hacia delante y conservar los datos.

## La app instalada

- La composición de Remotion va ya empaquetada (`scripts/bundle-remotion.mjs` →
  `resources/remotion-bundle`); en desarrollo se empaqueta al vuelo.
- Lo que se ejecuta como proceso o binario nativo va fuera del `.asar` (`asarUnpack`): eSpeak, ONNX
  Runtime, libsql y el compositor de Remotion.
- La primera vez que renderiza, Remotion descarga su Chrome sin interfaz (~460 MB descomprimido) a
  `~/Frameflow/runtime/remotion/`. El modelo de voz (92 MB) y Ollama (si hace falta) también se
  descargan la primera vez.
- Prueba de la app empaquetada: `SMOKE_PACKAGED=1 SMOKE_FULL=1 node apps/desktop/scripts/smoke.mjs`
  (tras `pnpm dist`).

## macOS sin cuenta de desarrollador

La app se firma **ad-hoc** (sin cuenta de Apple ni notarización). Sin esa firma, macOS diría que la
app descargada está "dañada". Al abrirla por primera vez aparece el aviso de desarrollador no
verificado:

- macOS 15 o posterior: Ajustes del Sistema → Privacidad y seguridad → "Abrir igualmente".
- Versiones anteriores: clic derecho sobre la app → Abrir.

Con la cuenta de Apple (99 $/año) se firmaría y notarizaría en la CI. Desaparecería ese aviso y se
activaría la actualización automática en Mac (`canInstall` en `updates.ts`).

## Pendiente

- Mac con Intel: no se compila todavía (la CI usa Apple Silicon).
- Windows sin firma de código: SmartScreen avisa en la primera instalación ("Más información" →
  "Ejecutar de todas formas").
- Linux con tarjeta AMD: Ollama gestionado usa el paquete con soporte de NVIDIA.
