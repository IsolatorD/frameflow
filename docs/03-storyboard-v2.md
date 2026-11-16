# Storyboard v2 — línea de tiempo

> Decisión 2026-11-16: el storyboard pasa de "escenas en fila" (v1) a **pistas con clips** (v2),
> para que el editor estilo CapCut trabaje sobre el mismo formato que genera la IA.

El storyboard es el contrato central: **la IA lo genera, el editor lo modifica y el renderer lo
convierte en video**. Código: `packages/core/src/storyboard/` (`schema.ts`, `timeline.ts`, `v1.ts`).

## Forma

```
Storyboard { version: 2, title, language, format, fps, style, tracks[] }
  style   = copia de la marca al generar { theme, fontFamily, captions }
  tracks  = pistas apiladas; las visuales se dibujan en orden (la última, encima)
    visual: clips scene | text | image | video
    audio:  clips audio (role: voice | music | sfx)
```

```
Escenas        [scene-1 ][scene-2      ][scene-3 ]
Textos         [ASTROINFO ─────────────────────── ]
CTA                                    [Síguenos]
Voz            [voice-1 ][voice-2      ][voice-3 ]   ← linkedTo su escena
Música         [─────────── música ───────────── ]
Subtítulos     (calculados de las palabras de los clips de voz)
```

## Reglas

| Regla                                                           | Por qué                                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Tiempos en **segundos** (`start`, `duration`), no en fotogramas | Cambiar los fps no rompe nada; el renderer redondea al fotograma                        |
| Ids únicos en todo el storyboard                                | El editor selecciona, enlaza y deshace por id                                           |
| Dentro de una pista los clips **no se solapan**                 | Igual que CapCut: para superponer se usa otra pista                                     |
| `linkedTo` debe apuntar a un clip existente                     | La voz se mueve junto a su escena                                                       |
| Las palabras de la voz son relativas al **archivo**             | Recortar (`trimStart`) o cortar un clip no obliga a recalcularlas                       |
| El video guarda una **copia** de la marca (`style`)             | Cambiar la marca no altera videos ya publicados; el editor podrá "aplicar marca actual" |
| Una escena puede sobrescribir colores (`theme` parcial)         | Destacar una escena sin tocar el resto                                                  |

## Tipos de clip

| Clip    | Campos clave                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `scene` | `content` (plantilla: `kinetic-text`, `stat`…), `narration`, `theme?`                                                  |
| `text`  | `text`, `style` {fontSize, fontWeight, color, background, align}; colores por nombre del tema (`"accent"`) o `#RRGGBB` |
| `image` | `src`, `fit`                                                                                                           |
| `video` | `src`, `trimStart`, `fit`, `volume`, `playbackRate`                                                                    |
| `audio` | `src`, `trimStart`, `role`, `volume`, `fadeIn`, `fadeOut`, `words?`, `linkedTo?`                                       |

Todos los visuales admiten `transform` {x, y (centro, 0–1), scale, rotation, opacity} y transiciones
`enter`/`exit` (`fade`, `slide-up`, `pop`, con `duration`).

## Operaciones (`timeline.ts`)

Funciones puras (no mutan; devuelven un storyboard nuevo → deshacer/rehacer sencillo):

- `parseStoryboard(json)` — lee v1 o v2 y devuelve v2 (migra v1 automáticamente).
- `buildFromScenes(...)` — monta pistas a partir de escenas en fila (lo usará el generador de IA:
  la IA sigue escribiendo escenas simples, no tiene que razonar sobre pistas).
- `storyboardDuration`, `captionWords`, `findClip`, `toFrames`.
- `splitClip` — la "tijera" del editor.

## Pendiente para fases siguientes

- v2 del editor: mover, recortar, duplicar, borrar clips y pistas (operaciones en `timeline.ts`).
- v3: fotogramas clave (`transform` animado), filtros, velocidad variable, máscaras.
- Rutas de recursos del proyecto: hoy `src` relativo se sirve con `staticFile`; la app de escritorio
  servirá la carpeta del proyecto.
