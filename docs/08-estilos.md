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

| Estilo    | Desde | Opciones                                          | Origen                                        |
| --------- | ----- | ------------------------------------------------- | --------------------------------------------- |
| Libre     | 0.1.0 | —                                                 | Frameflow                                     |
| Holograma | 0.2.0 | Modelo 3D: planeta, con anillos, satélite, cohete | «hologram-hud» de Lemo-Opuscar (MIT), portado |

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

## Añadir un estilo

1. Portar el código visual (si es de un tercero, comprobar que la licencia del **código** permite
   incluirlo y copiarlo en `looks/<estilo>/vendor/` con su licencia).
2. Escribir el escenario (`StageProps`: storyboard + opciones) y registrarlo en `looks/index.ts`.
3. Añadirlo al catálogo `VISUAL_STYLES` (nombre, descripción, crédito, versión y opciones).
4. Probar con fotogramas sueltos (`npx remotion still … --props`) en 9:16 y 16:9, y con la prueba de
   humo completa.
