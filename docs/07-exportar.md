# Exportar para redes (fase 1)

> 2026-11-17 · `packages/core/src/publish/` (parte pura), `apps/desktop/src/main/services/publish.ts`,
> pestaña **Publicar** del video.

Primera fase del plan de redes (docs/01-vision.md): sin conectar cuentas. Frameflow prepara el texto
de cada red y una carpeta lista para subir a mano. Lo publicado queda registrado para enlazar sus
estadísticas cuando lleguen las cuentas (fases 2–4).

## Qué hace

- **Texto por red** (YouTube Shorts, Instagram Reels, TikTok, Facebook Reels):
  - parte del título del video, la primera frase de la narración (el gancho), la llamada a la
    acción y los hashtags de la marca;
  - es editable y se guarda solo.
- **"Mejorar textos con IA"**: la IA elegida en Ajustes reescribe el texto de las cuatro redes de
  una vez, con un gancho distinto, sin inventar datos y con hashtags del tema.
- **Comprobaciones en vivo**: límites de cada red (título, texto con hashtags, número de hashtags),
  duración, formato (vertical) y si el MP4 está al día con la última edición. Con errores no se
  puede exportar.
- **Exportar** → `~/Frameflow/projects/<canal>/exports/<video>/<red>/` con:
  - el **MP4** (enlace duro al render: no ocupa más disco);
  - **portada.jpg** (un fotograma del inicio, con el gancho en pantalla);
  - **texto.txt** con lo que hay que pegar.

  Además: "Mostrar carpeta", "Abrir la página de subida" de la red y "Copiar texto".
- **"Ya lo publiqué"**: se pega el enlace del post y queda como publicado (se puede deshacer).

## Límites usados (revisados el 2026-11-17)

Cuando las fuentes no coinciden se usa el valor más prudente, que también vale para publicar por API.

| Red             | Título | Texto (con hashtags)                                             | Hashtags (recomendados / máx.) | Duración                            |
| --------------- | ------ | ---------------------------------------------------------------- | ------------------------------ | ----------------------------------- |
| YouTube Shorts  | 100    | 5000 (se ven ~100)                                               | 3 / 15                         | 3 min                               |
| Instagram Reels | —      | 2200 (se ven ~125)                                               | 5 / 30                         | 3 min                               |
| TikTok          | —      | 2200 (la app admite 4000; por API, 2200)                         | 5 / 30                         | 10 min                              |
| Facebook Reels  | —      | 2200 (Meta no publica un límite oficial; se usa el de Instagram) | 3 / 30                         | sin límite en la app (90 s por API) |

Fuentes: guías de límites de 2026 (Kompozy, bundle.social, Socialync, deploy.social, typecount,
sociality.io). Están en `PUBLISH_TARGETS` de `core/publish`: si una red cambia algo, se toca solo ahí.

## Datos

`publications` (migración 0002): en modo `manual` la cuenta es opcional y se guardan la red
(`platform`), la carpeta exportada (`export_path`) y `updated_at`. Hay una publicación manual por
video y red. Estados: `draft` → `exported` → `published`.

## Pruebas

- `packages/core/src/publish/publish.test.ts`: textos, límites y limpieza de la respuesta de la IA.
- `packages/db`: repositorio de publicaciones y migración que conserva las publicaciones existentes.
- `SMOKE_FULL=1 pnpm --filter @frameflow/desktop smoke`: editar, errores que bloquean, exportar
  (comprueba MP4, portada y texto), publicado y texto propio de cada red.
- `FRAMEFLOW_LIVE_AI=1 pnpm --filter @frameflow/core exec vitest run publish.live`: textos con el
  modelo real.
