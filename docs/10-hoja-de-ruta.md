# Hoja de ruta

> 2026-11-19 · lo pendiente, con las ideas tomadas de otros repositorios. Se actualiza al cerrar o
> añadir trabajo. Última versión publicada: **v0.3.0** (voz grabada por escena y estilo Viaje de
> escala).

## Próxima versión (v0.4.0)

Candidatos, en este orden:

- [x] Estilo **Pictogramas** (Pictogram Motion, `docs/08-estilos.md`).
- [x] **«Revisar guion» con IA** (`docs/04-guion-ia.md`).
- [x] **Estilo desde una referencia**, fase 1: colores (ver abajo).

## Estilo desde una referencia

Cargar una imagen o un video de referencia y que la app **proponga los ajustes** que la imitan con
lo que ya existe: colores, fuente, estilo del catálogo y ritmo. No se genera un estilo animado nuevo
(cada estilo es código escrito a mano). Se imita el estilo, no el contenido: los personajes, logos o
imágenes de la referencia no pasan al video. Las propuestas se aplican al proyecto (marca) o solo al
video, y se pueden revisar antes.

1. ✅ **Colores** (local, sin IA; desde v0.5.0, en Marca y estilo → Colores → «Desde una
   referencia»):
   - paleta dominante de la imagen o de 8 fotogramas del video (k-means, `core/look/palette.ts`);
   - propuesta de fondo, texto, acento y secundario, comprobando el contraste (el acento no se
     deforma: si para llegar a 3:1 cambiaría demasiado, se usa otro).
   - Pendiente: aplicarlo solo a un video (ahora va a la marca).
   - La **tipografía** pasa a la fase 3: reconocer una fuente en una imagen necesita leer el texto
     (IA de visión); sin eso, la propuesta sería una adivinanza.
2. **Ritmo** (local, con lo que ya hay):
   - detectar los cortes del video (diferencia entre fotogramas) → duración media de las escenas;
   - transcribir la voz con Whisper → palabras por segundo, duración del gancho y estructura;
   - usarlo en las duraciones de las escenas y como plantilla para el guion con IA.
3. **Análisis con IA de visión:**
   - describir el estilo (técnica, fondo, composición, tratamiento del texto, personaje guía…);
   - la fuente más parecida entre las disponibles (con o sin serifa, grosor, ancho);
   - elegir el estilo del catálogo más parecido y sus opciones, y decir si se parece a uno de la
     cola aún sin portar;
   - con Claude, OpenAI o Gemini (clave del usuario) o con un modelo local de visión, que sería otra
     descarga de unos 5–8 GB (Qwen3 solo lee texto).

**Privacidad:** el análisis local no saca nada del equipo. Con un proveedor en la nube se envían
algunos fotogramas: la app lo avisa antes de analizar.

## Guion

- **«Revisar guion» con IA.** Un editor crítico que revisa el guion antes de grabar o generar voz:
  - promesa contra entrega: ¿el gancho cumple lo que promete?
  - comprensión desde cero: jerga y referencias sin contexto;
  - progresión: ¿cada escena acerca a la respuesta?
  - cierre: ¿resuelve la pregunta inicial?
  - credibilidad: datos que conviene comprobar.

  Responde por escena con «frase → problema → ajuste concreto», que se puede aplicar con un clic.
  Pocos cambios de alto impacto, conservando la voz del autor. Sin notas numéricas ni promesas de
  viralidad. Usa los proveedores de IA que ya hay.
  _Idea: skill `cuestionar-guion` de [skills-videos-cortos](https://github.com/JustCarlos30/skills-videos-cortos) (MIT)._
- **Plantillas de estructura** para el guion con IA. Por ejemplo:
  - negocio: problema → qué hago → cómo funciona en 3 pasos → una prueba → nombre;
  - dato curioso: pregunta → respuesta sorprendente → por qué → cierre;
  - lista, línea de tiempo y comparación.

  _Idea: estructuras repetidas en [awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos)._
- **Aviso de tiempo de lectura:** una escena debe durar al menos 1 s más 0,25 s por cada palabra a
  partir de la cuarta. Aviso en el editor si no llega. _Idea: regla de [teardown](https://github.com/elvarofficial/teardown) (MIT)._

## Escenas y estilos

- **Nuevos tipos de escena**, además de texto y cifra:
  - **pasos** (cómo funciona en 3 pasos);
  - **línea de tiempo**;
  - **comparación A vs B**;
  - **gráfico** (barras o línea con varios datos).

  En el catálogo de awesome-opus son de los formatos más pedidos: 185 prompts hablan de datos o
  gráficos, 46 de procesos, 31 de historia y 10 de comparaciones.
- **Cola de estilos de Lemo-Opuscar** (25): ver `docs/08-estilos.md`. Scale Zoom Explainer y
  Pictogram Motion primero; 52 prompts del catálogo piden escala o zoom, lo que confirma la
  prioridad.
- **Estilo «Despiece / Cómo funciona»** (más adelante): una máquina o mecanismo en 3D que se abre
  por partes, movido por un solo valor (ángulo, recorrido) con cifras reales.
  _Idea: [teardown](https://github.com/elvarofficial/teardown) (MIT, three.js). Encaja con el motor
  del estilo Holograma (canvas redibujado por fotograma)._
- **Reglas al portar estilos:**
  - un protagonista por momento;
  - cada transición tiene una causa;
  - entradas con `cubic-bezier(0.16, 1, 0.3, 1)` y salidas a la mitad de su duración;
  - etiquetas de al menos 34 px en 1080;
  - siempre algo vivo en pantalla.

  _De teardown y de la skill `motion` de skills-videos-cortos._

## Sonido

- [x] **Masterizado a −14 LUFS** y **efectos de sonido** (v0.5.0, `docs/11-sonido.md`).
- **Más efectos:** tecleo en los textos que se escriben, efectos propios de cada estilo visual.
- **Cortes al ritmo de la música:** detectar los golpes (tempo, compases, el «drop») y ajustar los
  cambios de escena al golpe más cercano. _Idea: `sims/beats.py` de teardown._

## Voz grabada

- **Toma completa:** grabar el guion entero y repartirlo por escenas (ver `docs/09-voz-grabada.md`).
- **Aviso de toma incompleta:** si Whisper no reconoció una parte grande del texto, decir qué
  palabras faltan y proponer repetir la toma. La alineación ya lo sabe.
- **Recortar pausas largas** dentro de la toma (opcional): margen de 120–140 ms y rampas de 8 ms,
  conservando las pausas con intención.
- Igualar el volumen por **LUFS** en vez de por RMS (junto con el masterizado).
  _Ideas: skill `voz-whisper` de skills-videos-cortos._

## Revisión y publicación

- **Hoja de revisión:** una miniatura por escena (justo después de su entrada) para revisar el video
  de un vistazo.
- **Portada:** elegir el fotograma que hace de portada en «Publicar». El fotograma 0 debe mostrar ya
  el tema.
- **Calendario** de publicaciones.
- **Cuentas y publicación directa** (TikTok, YouTube, Instagram).
- **Estadísticas** de lo publicado.

## Distribución

- Probar los instaladores de **Windows y Linux** y el ciclo de actualización entre versiones.
- **Firma**: macOS (Apple Developer, 99 USD/año) y Windows (certificado). Decisión de Daniel.

## Licencias de lo tomado de fuera

- De estos repositorios se toman **ideas y reglas**, no código copiado.
- Si algún día se copia código, teardown y skills-videos-cortos son MIT: incluir su licencia.
- Las muestras de sonido son CC0.
- Los prompts y videos de awesome-opus5-5-videos son de sus autores: solo como referencia.
