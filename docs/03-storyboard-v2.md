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

## Editar sin perder trabajo (editor v1)

`assembleStoryboard` (en `core/script`) vuelve a montar el video desde el guion **conservando** lo
editado del storyboard anterior:

- Cada escena tiene un **id estable** (`scene-N`); su voz es `voice-<id>` y va unida a ella.
- La voz de una escena se conserva mientras sus palabras coincidan con la narración actual;
  "Generar voz" solo sintetiza las escenas nuevas o cambiadas.
- Ajustes por escena (`settings` del guion): acento y fondo propios, transiciones de entrada y salida,
  pausa extra. Se guardan en el clip (`theme`, `enter`, `exit`, `extraTime`) y se leen de vuelta.
- Ajustes del video (`applyVideoSettings`): subtítulos, llamada a la acción (por encima de la franja
  de subtítulos) y música de fondo, que cubre todo el video y se reajusta si cambia la duración.
- La música en bucle se repite con varias `<Sequence>` en el renderer, no con `loop` de Remotion:
  con `loop`, los fundidos se reiniciaban en cada vuelta.

## Editor v2

- **Línea de tiempo editable** (`core/script/edit.ts`, `applyTimelineEdit`):
  - recortar una escena por la derecha = pausa extra tras la voz (nunca corta la voz; máx. +5 s);
  - arrastrar una escena = reordenarla (va donde cae su centro);
  - mover/recortar la llamada a la acción (1–10 s); su hueco hasta el final se conserva al editar.
  - Teclado: flechas para mover, Alt+flechas para recortar, Mayús = pasos de 1 s.
- **Subtítulos** (`updateCaptions`): cada palabra puede mostrarse distinto a como se dice
  (`display`, p. ej. "8 min" por "ocho minutos") y sus tiempos se corrigen a mano. Los tiempos
  son relativos al audio de la voz, ordenados y dentro de él. Se conservan al editar otras escenas.
- **Deshacer/rehacer** (⌘Z / ⇧⌘Z): cada cambio es una versión; deshacer restaura la anterior
  como versión nueva, así que el historial nunca pierde nada.

## Editor v3 — capas libres

`core/script/overlays.ts` (`applyOverlayOp`): textos, imágenes y videos encima del video, en
pistas `track-overlay-N` ("Capa N"). Las demás pistas las genera el guion y no se tocan.

- **Añadir** en la posición del cabezal: va a la primera capa donde cabe; si se solapa con todo,
  se crea una capa nueva encima. Los videos entran silenciados y con su duración (máx. 10 s).
- **Editar** (inspector): texto, tamaño, color/fondo del tema, alineación; encaje de imagen/video;
  volumen y punto de inicio del clip; posición, escala, opacidad, rotación; transiciones.
  La vista previa muestra el borrador antes de aplicarlo.
- **Mover/recortar** en la línea de tiempo sin pisar a sus vecinas de capa ni salir del video.
- **Duplicar** (⌘D) justo a continuación y **eliminar** (⌫); una capa vacía desaparece.
- Al editar el guion, las capas se conservan; si el video se acorta, se recortan con él.
- Los archivos se copian al proyecto (`assets/images`, `assets/video`).
- **Sobre la vista previa** (pestaña Capas): cada capa visible tiene un recuadro medido del DOM del
  reproductor (`data-clip-id` / `data-clip-box` en el renderer). Arrastrar la mueve, la esquina la
  escala, se pega al centro con guías, y las flechas la desplazan (Mayús = 5 %). Edita el mismo
  borrador que el inspector y se guarda al soltar (o al dejar de pulsar flechas).

## Fotogramas clave

- Cada capa visual puede tener `keyframes: [{ at, transform, easing }]` (`at` en segundos desde el
  inicio del clip). `transformAt` (`core/storyboard/keyframes.ts`) interpola posición, escala, giro
  y opacidad con la curva de cada fotograma (`ease` suave, `ease-in` acelerar, `ease-out` frenar,
  `linear`; la curva es la del tramo que llega a ese fotograma); antes del primero y después del
  último se mantiene.
  Si hay fotogramas, mandan sobre `transform`. El renderer la evalúa en cada fotograma.
- En el editor (pestaña Capas → "Animar con fotogramas clave"): el inspector y la vista previa
  muestran la capa en el instante del cabezal; cambiar posición/escala/giro/opacidad ahí (deslizadores,
  arrastre o flechas) crea o ajusta el fotograma de ese instante. La lista permite saltar a cada
  fotograma, quitarlo o elegir su curva ("Curva hasta este fotograma"), y la línea de tiempo los
  marca con rombos.
- Recortar una capa descarta los fotogramas que quedan fuera; moverla los conserva (son relativos).

## Pendiente para fases siguientes

- Fotogramas clave en escenas.
- v3: fotogramas clave (`transform` animado), filtros, velocidad variable, máscaras.
- Rutas de recursos del proyecto: hoy `src` relativo se sirve con `staticFile`; la app de escritorio
  servirá la carpeta del proyecto.
