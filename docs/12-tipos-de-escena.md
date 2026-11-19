# Tipos de escena

> 2026-11-19 · esquema en `packages/core/src/storyboard/scenes.ts`; dibujo en
> `packages/renderer-remotion/src/scenes/` (`KineticText`, `Stat`, `ListScenes`).

Cada escena tiene una narración (la voz) y algo **en pantalla**:

| Tipo            | Para qué                           | Contenido                                         |
| --------------- | ---------------------------------- | ------------------------------------------------- |
| Texto animado   | La mayoría de escenas              | 1 a 3 líneas; una puede ir destacada              |
| Cifra destacada | Un dato numérico                   | Número, unidad y explicación                      |
| Pasos           | Un proceso o una lista             | Título opcional y 2 a 5 pasos                     |
| Línea de tiempo | Algo que cambió con el tiempo      | Título opcional y 2 a 5 hitos (cuándo + qué pasó) |
| Comparación     | Dos cosas frente a frente (A vs B) | Título opcional y 2 lados (nombre + detalle)      |
| Gráfico         | Varias cantidades comparables      | Título opcional, unidad y 2 a 5 barras            |

Textos de hasta 40 caracteres (el cuándo de un hito, 16), pensados para leerse en un móvil.

## Cómo se ven

- **Estilo Libre:** con los colores de la marca.
  - Pasos: números en círculos.
  - Línea de tiempo: una línea que crece con un punto por hito.
  - Comparación: dos tarjetas y un «VS».
  - Gráfico: barras que crecen; la mayor, en el color de acento.

  Los elementos entran uno detrás de otro (0,4 s).
- **Holograma, Viaje de escala y Pictogramas** dibujan ellos mismos el texto y las cifras. Los tipos
  nuevos se dibujan **encima de su fondo, sobre una placa** del color de fondo de la marca para que
  se lean. Pendiente: un dibujo propio en cada estilo (p. ej. el gráfico como barras holográficas).

## Tiempo de lectura

Cada escena calcula cuánto se tarda en **leer lo que hay en pantalla** (`readingSeconds` en
`core/storyboard/scenes.ts`):

- 1 s más 0,25 s por cada palabra a partir de la tercera (regla de teardown);
- más lo que tardan en entrar los elementos de una lista (0,4 s cada uno) o en rodar una cifra.

Si la escena dura menos (con medio segundo de margen), el editor muestra **«Poco tiempo para
leer»** y propone añadir una pausa después de la voz o acortar el texto.

## Editar

En «Guion y escenas» → **En pantalla** se elige el tipo. Al cambiarlo se conservan los textos que se
puedan. Cada elemento se añade o se quita con **+ Paso / + Hito / + Barra** y **✕**. Antes de
guardar se avisa de pasos vacíos, hitos sin fecha o barras sin número.

## Con IA

El guion con IA puede usar los cuatro tipos, **como mucho en dos escenas** y solo si encajan. El
resto sigue siendo texto y cifras. Para no complicar el esquema a los modelos pequeños, todos usan
un campo común `items` (`label` + `value`) que luego se convierte al tipo. La respuesta se valida y
los errores se le devuelven a la IA:

- número de elementos fuera de rango (una comparación tiene exactamente 2);
- hitos sin fecha;
- valores de un gráfico que no son números.

«Revisar guion» también lee estos tipos.
