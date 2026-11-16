# Frameflow — Modelo de datos (borrador v1)

> 2026-11-16. Documento para debatir; nada implementado aún.

## Principios

1. **Local primero.** Base de datos SQLite en la máquina del usuario; archivos pesados (audios, renders,
   imágenes) en disco, la BD solo guarda rutas y hashes.
2. **El storyboard es un documento JSON versionado.** No se descompone en tablas: se guarda entero y
   cada cambio (IA o editor) crea una versión nueva inmutable. Deshacer = volver a una versión.
3. **Los secretos no van en la BD.** Los tokens OAuth de las redes se guardan en el llavero del sistema
   (Keychain en macOS); la BD solo guarda una referencia.
4. **IDs UUID** desde el principio, para poder sincronizar o pasar a multiusuario algún día sin migrar IDs.
5. **Las métricas son series temporales**: se guardan "fotos" periódicas, no un único valor que se pisa.

## Mapa general

```
                 NichePreset (plantilla)
                        │ se copia al crear
                        ▼
Project ──1:1── BrandKit ──── Asset (logo, mascota, música, fuentes)
   │
   ├──1:N── Idea (temas pendientes)
   │
   ├──1:N── Video ──1:N── Variant (idioma × formato) ──1:N── StoryboardVersion
   │                          │                                   │
   │                          └──1:N── Render ◄───────────────────┘ (de qué versión sale)
   │                                     │
   ├──1:N── SocialAccount ──1:N── Publication ◄─┘ (qué render se publica, dónde)
   │              │                    │
   │              └─1:N─ AccountMetric └──1:N── PostMetric
   │
   └──1:N── Job (cola de trabajos: guion, voz, subtítulos, render, publicar, sincronizar)
```

## Entidades

### Marca y configuración

**NichePreset** — plantilla de partida (las 4 actuales + las que cree el usuario).
`id, name, tone, theme{background,text,accent,muted}, voices{lang→voiceId}, speed, defaultStyles[], builtIn`

**Project** — un canal (p. ej. _Astroinfo_).
`id, name, slug, description, presetId (de dónde partió), languages[] (es, en…), defaultFormat (9:16|16:9),
createdAt, archivedAt?`

**BrandKit** (1:1 con Project) — la identidad del canal. Se copia del preset y luego se personaliza;
cambiar el preset después no altera el proyecto.
`projectId, tone (instrucciones para la IA), theme, fontFamily, logoAssetId?, mascotAssetId?,
voices{lang→{engine: kokoro|recorded, voiceId, speed}}, captions{enabled, maxWordsPerPage, style},
introAssetId?, outroAssetId?, musicAssetId?, defaultHashtags[], ctaText (p. ej. "Síguenos para más")`

**Asset** — cualquier archivo reutilizable.
`id, projectId? (null = global), kind (image|logo|mascot|music|sfx|font|recording), path, sha256,
license, source (generated|uploaded|bundled), createdAt`

### Contenido

**Idea** — banco de temas (escritos por ti o sugeridos por la IA a partir de las estadísticas).
`id, projectId, topic, notes, source (manual|ai), status (new|used|discarded), videoId?, createdAt`

**Video** — una pieza de contenido, independiente del idioma y formato.
`id, projectId, title, topic, mode (auto|stepwise), status, createdAt, updatedAt`
Estados: `draft → scripting → ready_to_render → rendering → ready → published → archived`

**Variant** — una versión concreta del video: idioma × formato (es 9:16, en 9:16, es 16:9…).
`id, videoId, language, format, currentVersionId, sourceVariantId? (de cuál se tradujo/adaptó)`

**StoryboardVersion** — el JSON del storyboard (el contrato que ya existe en el prototipo).
`id, variantId, number, storyboard (JSON), source (ai|editor|translation), parentId?, createdAt`

**Render** — un MP4 producido.
`id, variantId, storyboardVersionId, status (queued|rendering|done|failed), path, durationSec,
sizeBytes, width, height, startedAt, finishedAt, error?`

### Distribución

**SocialAccount** — una cuenta conectada a un proyecto.
`id, projectId, platform (youtube|instagram|facebook|tiktok), externalId, handle, displayName,
language? (para canales separados por idioma), status (connected|expired|revoked),
scopes[], tokenRef (clave en el llavero), connectedAt, lastSyncAt`

**Publication** — un render publicado (o por publicar) en una cuenta.
`id, renderId, socialAccountId, mode (api|manual), status, title, caption, hashtags[],
privacy (public|private|unlisted), scheduledAt?, publishedAt?, externalPostId?, url?, error?`
Estados: `draft → scheduled → publishing → published | failed`; en modo manual:
`draft → exported → published` (pegas la URL y desde ahí se miden las estadísticas).

### Métricas

**PostMetric** — foto periódica de una publicación.
`id, publicationId, capturedAt, views, likes, comments, shares, saves, watchTimeSec,
avgViewDurationSec, retentionPct?, followersGained?, raw (JSON con lo que dé cada red)`

**AccountMetric** — foto periódica de una cuenta.
`id, socialAccountId, capturedAt, followers, totalViews, raw`

### Infraestructura

**Job** — cola de trabajos largos (en escritorio no hay servidor: la app los procesa en segundo plano).
`id, projectId, type (script|voice|captions|render|publish|sync_metrics), targetId, status
(queued|running|done|failed|cancelled), progress (0–1), payload (JSON), error?, attempts,
createdAt, startedAt?, finishedAt?`

## Archivos en disco

```
~/Frameflow/
├── frameflow.db                     SQLite
└── projects/<slug>/
    ├── assets/                      logos, mascota, música, grabaciones de voz
    ├── voice/                       caché de TTS (<hash>.wav + .words.json)
    └── renders/<video>/<variante>/  MP4 finales
```

## Ejemplo: un video de Astroinfo de principio a fin

1. Idea "¿Por qué Marte es rojo?" → crea **Video** (draft) + **Variant** es·9:16.
2. Job `script` → la IA genera **StoryboardVersion** v1 (source ai). Video → ready_to_render.
3. Retocas un texto en el editor → v2 (source editor, parent v1).
4. Job `voice` + `captions` + `render` → **Render** a partir de v2.
5. "Traducir al inglés" → **Variant** en·9:16 (sourceVariant = es) con su v1 (source translation).
6. **Publication** a YouTube (api, programada) e Instagram (api); TikTok en modo manual (exportado).
7. Job `sync_metrics` cada X horas → **PostMetric** por publicación → gráficas del panel.

## Stack propuesto para la BD

SQLite + **Drizzle ORM** (TypeScript, migraciones, tipos compartidos con el storyboard de zod).
Corre dentro del proceso principal de Electron.

## Decisiones (2026-11-16)

1. **Multi-idioma**: de inicio todas las variantes se publican en las **mismas cuentas**.
   `SocialAccount.language` queda opcional (null) para poder separar cuentas por idioma más adelante.
2. **Varias cuentas de la misma red por proyecto**: sí.
3. **Programación**: YouTube programa en su servidor; el resto requiere la app abierta a la hora indicada.
   Aceptado para empezar.
4. **Banco de ideas**: desde el inicio, en versión simple y en dos niveles:
   - **v1**: lista manual + botón "Sugerir ideas" (la IA propone N temas según el tono del proyecto,
     evitando los títulos ya hechos). Coste mínimo: reutiliza el mismo LLM del generador.
   - **v2** (cuando haya estadísticas): sugerencias basadas en qué temas/formatos rinden mejor.
5. **Música**: biblioteca **global + por proyecto** (`Asset.projectId` null = global).
