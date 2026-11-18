# Estilos visuales (presets)

> 2026-11-17 · catálogo en `packages/core/src/look/looks.ts`; motor en
> `packages/renderer-remotion/src/looks/`.

Un **estilo visual** decide cómo se dibujan las escenas de un video. La voz, los subtítulos, las capas,
la música y la llamada a la acción funcionan igual con cualquiera.

- **Proyecto** (Marca y estilo → Estilo visual): el estilo por defecto. Los videos nuevos lo heredan.
- **Video** (Ajustes del video → Estilo visual): se puede cambiar solo para ese video o dejarlo en
  "Libre". Se guarda en el storyboard (`style.visualStyle`), así que entra en el historial y en
  deshacer/rehacer.
- **Libre**: el estilo de siempre (texto animado y cifras con los colores de la marca). Es el valor de
  los videos y proyectos anteriores a los estilos, y el que se usa si un estilo no existe en esta
  versión de la app.

## Catálogo

| Estilo          | Desde | Opciones                                                   | Origen                                               |
| --------------- | ----- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Libre           | 0.1.0 | —                                                          | Frameflow                                            |
| Holograma       | 0.2.0 | Modelo 3D: planeta, con anillos, satélite, cohete          | «hologram-hud» de Lemo-Opuscar (MIT), portado        |
| Viaje de escala | 0.3.0 | Viaje: del cosmos a lo diminuto, de lo diminuto al cosmos | «flat-space-explainer» de Lemo-Opuscar (MIT), portado |

Los estilos llegan de uno en uno con las actualizaciones de la app.

## Holograma

Un modelo 3D en wireframe gira sobre un proyector, con una interfaz de ciencia ficción:

- **Al empezar:** el modelo se escanea de abajo arriba.
- **Escena de cifra:** un recuadro fija una parte del modelo (la despliega y oscurece el resto),
  una línea guía la une con una tarjeta y el número rueda hasta su valor.
- **Escena de texto:** un panel donde las líneas aparecen "decodificándose"; las de énfasis van en
  el color de acento.
- **Al cambiar de escena:** un destello de _glitch_.

Colores: el tono principal sale del acento de la marca. El énfasis es ámbar sobre tonos fríos (como el
original) o el complementario sobre los demás. Fuentes: Rajdhani y Share Tech Mono (OFL).

En vertical, el modelo ocupa el tercio superior y las tarjetas la franja del 50 al 70 % (los
subtítulos van debajo). La cámara se ajusta al tamaño de cada modelo para que quepa entero.

### Cómo está hecho (y la licencia)

- `looks/hologram/vendor/`: `holo.js`, `hud.js` y `mkmodel.js` de Lemo-Opuscar **sin cambios**, con
  su licencia MIT (`LICENSE-lemo-opuscar.txt`) y el commit de origen. Los `.d.ts` son nuestros.
- `looks/hologram/HologramStage.tsx`: la coreografía, escrita para Frameflow. Es un canvas que
  Remotion redibuja en cada fotograma; depende solo del segundo `t`, así que la vista previa y el
  MP4 coinciden.
- `looks/hologram/models.ts`: los cuatro modelos, hechos con las primitivas de `mkmodel`.
- **No se incluye nada de la documentación de Lemo-Opuscar** (`STYLE.md` y demás, CC BY-NC 4.0).
  Solo su código, que es MIT.

## Viaje de escala

Ilustración plana (colores lisos, sin degradados) sobre un cielo nocturno. Cada escena es una
**parada** de un viaje de escala: galaxia → sistema solar → Tierra → célula → virus (y, si hay más
escenas, vuelta a la galaxia: "zoom infinito").

- **Antes de cambiar de escena:** un anillo marca la próxima parada («Próxima parada · La Tierra»),
  Orbi (una pequeña sonda cuyo ojo es un objetivo de zoom) la apunta con una línea de puntos y la
  cámara **se zambulle por el anillo** hasta la siguiente.
- **Viaje al revés** («De lo diminuto al cosmos»): la cámara se aleja parada a parada y termina en
  la galaxia.
- **Escena de texto:** etiqueta «PARADA 01 · LA GALAXIA» y titular que sube línea a línea; las
  líneas de énfasis van en amarillo.
- **Escena de cifra:** la etiqueta de la cifra y un número grande que rueda hasta su valor, con la
  unidad al lado.
- **Arriba:** el recorrido, con una marca por parada.

En vertical, la parada ocupa el tercio superior, Orbi queda a su derecha y el texto va en la franja
del 50 al 70 % (los subtítulos, debajo). En horizontal, texto a la izquierda y parada a la derecha.
Fuente: Jost (OFL). La paleta es la del original (fija, no usa los colores de la marca).

### Cómo está hecho (y la licencia)

- `looks/scale-zoom/vendor/`: `flat.js`, `heroes.js` y `orbi.js` de Lemo-Opuscar sin cambios
  salvo las líneas de `import`/`export` (para usarlos como módulos), y `objects.js` con funciones
  de dibujo copiadas tal cual de su `index.html` y `scenes.js`. Licencia MIT
  (`LICENSE-lemo-opuscar.txt`) y commit de origen en cada cabecera. Los `.d.ts` son nuestros.
- `looks/scale-zoom/stops.ts`: las cinco paradas (dibujo, dónde está la siguiente y su anillo).
- `looks/scale-zoom/ScaleZoomStage.tsx`: la coreografía, escrita para Frameflow. Es un SVG que se
  rehace en cada fotograma y depende solo del segundo `t`. La zambullida interpola el zoom en
  escala logarítmica y dibuja la parada siguiente recortada dentro del anillo.
- La película original (52 s, con su guion, voz, música y efectos) no se incluye: solo el código de
  dibujo. Nada de `STYLE.md`/`DEMO.md` (CC BY-NC).

## Añadir un estilo

1. Portar el código visual (si es de un tercero, comprobar que la licencia del **código** permite
   incluirlo y copiarlo en `looks/<estilo>/vendor/` con su licencia).
2. Escribir el escenario (`StageProps`: storyboard + opciones) y registrarlo en `looks/index.ts`.
3. Añadirlo al catálogo `VISUAL_STYLES` (nombre, descripción, crédito, versión y opciones).
4. Probar con fotogramas sueltos (`npx remotion still … --props`) en 9:16 y 16:9, y con la prueba de
   humo completa.

## Cola de estilos por portar

Elegidos por Daniel (2026-11-18) entre los ejemplos de [Lemo-Opuscar](https://github.com/lemomo-ai/lemo-opuscar).
Se portan de uno en uno, cada uno como actualización de la app. Primero los dos que más encajan con
"tips y datos curiosos"; el resto, en el orden que se decida.

| #   | Estilo                    | Carpeta en el repo     | Encaja con                | Notas                                                                                                                     |
| --- | ------------------------- | ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scale Zoom Explainer      | `flat-space-explainer` | Tips, datos curiosos      | ✅ Portado en 0.3.0 como «Viaje de escala»                                                                                  |
| 2   | Pictogram Motion          | `pictogram-motion`     | Tips, datos curiosos      | Prioridad                                                                                                                 |
| 3   | Ukiyo-e                   | `ukiyoe`               | Historias, cuentos        |                                                                                                                           |
| 4   | Shadow Puppetry           | `shadow-puppet`        | Cuentos, leyendas         |                                                                                                                           |
| 5   | Chinese Ink Wash          | `ink-wash`             | Historias, cuentos        |                                                                                                                           |
| 6   | Marker on Paper           | `marker-paper`         | Explicaciones             |                                                                                                                           |
| 7   | Sketchnote                | `sketchnote`           | Explicaciones, resúmenes  |                                                                                                                           |
| 8   | Crayon Picture Book       | `crayon-book`          | Cuentos, público infantil |                                                                                                                           |
| 9   | Watercolor Brush          | `watercolor`           | Historias, viajes         | Usa contornos de Natural Earth/world-atlas (ISC): incluir su licencia                                                     |
| 10  | 1920s Newsreel            | `newsreel`             | Historia, noticias        | La demo usa material de archivo de terceros: se alimentaría con tus capas                                                 |
| 11  | Caption News              | `caption-news`         | Noticias, datos           | La demo usa vídeos/fotos de terceros: se alimentaría con tus capas                                                        |
| 12  | Archive Light Table       | `archive-lighttable`   | Historia, documentos      | La demo usa fotos de terceros: se alimentaría con tus capas                                                               |
| 13  | Paper Pop-up Book         | `paper-popup`          | Cuentos                   |                                                                                                                           |
| 14  | Brick Toy                 | `brick-toy`            | Explicaciones, infantil   | Como "bloques de juguete" genéricos: sin nombres ni logos de marcas                                                       |
| 15  | Mascot Screencast         | `living-screencast`    | Tutoriales                | Su mascota (Clawd) y la interfaz que dibuja son de Anthropic, sin licencia: portar con otra mascota (p. ej. la del canal) |
| 16  | Scratch Film              | `scratch-film`         | Datos, ritmo rápido       |                                                                                                                           |
| 17  | 1920s Silent Film         | `silent-film`          | Historia, humor           | Revisar si la demo usa material de archivo                                                                                |
| 18  | Microgame Frenzy          | `microgame`            | Retos, datos curiosos     |                                                                                                                           |
| 19  | Comic History Cartoon     | `comic-history`        | Historia                  |                                                                                                                           |
| 20  | Manga Panels              | `manga-panels`         | Historias                 |                                                                                                                           |
| 21  | 1930s Rubber Hose Cartoon | `rubber-hose`          | Humor, cuentos            |                                                                                                                           |
| 22  | Mid-century Cartoon       | `midcentury-toon`      | Explicaciones             |                                                                                                                           |
| 23  | Instruction Manual Art    | `instruction-manual`   | Tutoriales, cómo funciona |                                                                                                                           |
| 24  | Blueprint                 | `blueprint`            | Cómo funciona, ingeniería |                                                                                                                           |
| 25  | Text Flash Cuts           | `text-flash-cuts`      | Datos, frases             |                                                                                                                           |

En todos se porta solo el **código** (MIT). Nunca se incluyen sus `STYLE.md` ni demás documentación
(CC BY-NC), y se revisa en el `REUSE.toml` de cada estilo si hay material de terceros.
