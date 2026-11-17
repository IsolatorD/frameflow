# Voz — Kokoro en Node

> 2026-11-17 · código en `packages/core/src/voice/` (parte pura) y
> `apps/desktop/src/main/services/voice/` + `apps/desktop/src/main/espeak-process.ts`.

La voz ya no necesita Python, uv ni eSpeak instalados en el sistema: todo corre dentro de la app,
igual en macOS, Windows y Linux.

## Cómo se genera

1. **Texto → fonemas** con eSpeak NG compilado a WebAssembly (`@echogarden/espeak-ng-emscripten`),
   en **su propio proceso** (ver Licencias). Encima se aplican exactamente las reglas de la
   librería de Python que usábamos (`misaki` + `phonemizer`): puntuación conservada, fonemas
   compuestos unidos (`tʃ` → `ʧ`) y símbolos adaptados a Kokoro.
2. **Fonemas → audio** con Kokoro-82M v1.0 (Apache-2.0) en ONNX Runtime (`onnxruntime-node`),
   variante que además devuelve la **duración de cada fonema**.
3. **Tiempos por palabra** a partir de esas duraciones (escaladas a la duración real del audio) y
   ajustados a los silencios reales (inicio, final y pausas de más de 100 ms). Ya no hace falta
   Whisper.
4. Los audios se nombran con un hash de voz + velocidad + texto, **igual que antes**: las voces
   generadas con la versión de Python se reutilizan.

El modelo (325 MB) y cada voz (0,5 MB) se descargan la primera vez a
`<datos>/models/kokoro-<revisión>/`, desde una revisión fijada de Hugging Face, y se verifican con
SHA-256 (`core/voice/kokoroModel.ts`). Textos largos se parten por frases para no pasar del límite
del modelo (510 fonemas).

## Comparación con la versión de Python (4 frases, `em_alex` y `ef_dora`)

| Variante                     | Parecido al audio de Python | Se entiende (Whisper) | Tiempo por frase |
| ---------------------------- | --------------------------- | --------------------- | ---------------- |
| Python (antes)               | —                           | igual                 | ~0,55 s          |
| **Node, completo (325 MB)**  | **idéntico** (r = 0,99)     | igual                 | ~0,8–1,3 s       |
| Node, cuantizado (92 MB)     | distinto (hay que oírlo)    | igual                 | ~0,4–0,6 s       |
| Node, media precisión (fp16) | genera silencio en CPU      | —                     | —                |

- Los fonemas de 75 frases (narraciones reales de guiones y frases difíciles: signos, comillas,
  paréntesis, siglas, palabras en inglés) salen **idénticos** a los de Python
  (`services/voice/phonemes.test.ts`, contra `fixtures/phonemes-es.json`).
- Tiempos por palabra: en las pausas coinciden con el silencio real; dentro del habla continua
  quedan ~100 ms más tarde que los de Whisper (que a su vez falla en la primera palabra).
- Por defecto se usa el modelo completo (`DEFAULT_KOKORO_VARIANT`); el cuantizado es una línea si al
  oírlo convence.
- Inglés: eSpeak + las reglas de `misaki` para inglés. En Python se usaba un diccionario
  (`misaki.en`), así que el inglés puede sonar algo distinto; el español es idéntico.

## Licencias

- **eSpeak NG es GPL-3.0** → Frameflow se publica bajo **GPL-3.0** (`LICENSE`).
- Remotion tiene su propia licencia (no compatible con la GPL). Para no combinar eSpeak con él en
  un mismo programa, eSpeak corre en un proceso aparte que solo recibe textos y devuelve fonemas
  (igual que antes el servicio de Python). Interpretación habitual de la GPL, no asesoría legal.
- Kokoro-82M (modelo y voces): Apache-2.0. ONNX Runtime: MIT.

## Pruebas

```bash
pnpm --filter @frameflow/desktop test                       # fonemas idénticos a Python (proceso real de eSpeak)
FRAMEFLOW_LIVE_VOICE=1 pnpm exec vitest run apps/desktop/src/main/services/voice   # voz real (descarga el modelo)
SMOKE_FULL=1 pnpm --filter @frameflow/desktop smoke         # voz y MP4 reales desde la interfaz
```
