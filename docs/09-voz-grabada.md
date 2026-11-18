# Voz grabada

> 2026-11-18 · código en `packages/core/src/voice/recording.ts` y `whisperModel.ts` (parte pura),
> `apps/desktop/src/main/services/voice/whisper.ts`, `videoPipeline.ts` (`recordVoice`) y, en la
> interfaz, `useVoiceRecorder`, `RecordVoiceDialog` y `VoiceRecorderPanel`.

Además de la voz sintética (Kokoro, ver `05-voz.md`), puedes narrar los videos con tu propia voz.
Se graba **escena por escena**.

## Cómo se usa

- **En cualquier video:** en «Guion y escenas», cada escena guardada tiene **🎙 Grabar**. Se abre un
  diálogo con el texto de la escena, el nivel del micrófono y el tiempo estimado. Puedes escuchar la
  toma, repetirla o **importar un audio** que ya tengas. «Usar esta toma» la guarda como la voz de
  esa escena (insignia «Voz grabada»).
- Se graba el texto **guardado**: con cambios sin guardar en el guion, el botón está desactivado.
- Si después se cambia el texto de una escena, su voz deja de estar al día (como con la sintética) y
  hay que volver a grabarla.
- **Voz sintética y grabada se combinan:** «Generar voz» solo genera las escenas que no tienen voz
  al día; las grabadas se conservan.
- **Canal narrado siempre por ti:** en Marca y estilo → Voces, «Narración en …» → «Mi voz (la grabo
  yo)». Para ese idioma no se genera voz sintética: el video muestra «Faltan N escenas por grabar» y
  el modo automático se detiene tras escribir el guion para que grabes.

## Qué se hace con la toma

1. La interfaz graba con `MediaRecorder` (cancelación de eco y reducción de ruido del navegador),
   decodifica a mono y envía las muestras al proceso principal (máximo 3 minutos).
2. **Limpieza:** se recortan los silencios del principio y del final (con 120 ms de margen) y se
   iguala el volumen (nivel medio fijo, sin picos por encima de 0,95). Se guarda como
   `rec-<escena>-<fecha>.wav` a 24 kHz.
3. **Subtítulos sincronizados:** Whisper (`whisper-base_timestamped`, ONNX cuantizado, 77 MB, vía
   transformers.js) transcribe la toma con tiempos por palabra. Esas palabras se emparejan con las
   del guion (subsecuencia común más larga sobre palabras normalizadas: sin tildes ni signos); las
   que no coinciden (p. ej. Whisper escribe «8» y el guion dice «ocho») reparten el hueco entre sus
   vecinas. Así los subtítulos muestran **el texto del guion** al ritmo de tu voz.
4. Se guarda una nueva versión del video (entra en el historial y en deshacer).

El modelo de Whisper se descarga solo la primera vez que grabas, a `<datos>/models/whisper-<revisión>/`,
desde una revisión fijada de Hugging Face, y se verifica con SHA-256 (`core/voice/whisperModel.ts`).
Transcribir una frase tarda ~1 s.

> **Una sola versión de ONNX Runtime.** transformers.js trae su propio `onnxruntime-node` y Kokoro
> usa otro; con dos versiones nativas cargadas en el mismo proceso, Electron se cae (SIGSEGV) al
> cargar el modelo de Whisper después de Kokoro. `pnpm-workspace.yaml` fija una sola
> (`overrides.onnxruntime-node`). Al actualizar cualquiera de los dos, mantenerlas iguales.

## Permisos

- La app solo concede el **micrófono** (ningún otro permiso de medios).
- macOS pide permiso la primera vez (`NSMicrophoneUsageDescription` en `electron-builder.yml`).
- Si no hay permiso o micrófono, el diálogo lo explica y sigue ofreciendo importar un audio.

## Licencias

Whisper (OpenAI): MIT. transformers.js: Apache-2.0. La toma es tuya y no sale del equipo.

## Pendiente: toma completa

Grabar **todo el guion de una vez** y que la app lo reparta por escenas. Encaja con lo que ya hay:
Whisper da los tiempos de cada palabra de la toma entera, `alignWords` los empareja con el texto
completo del guion y el audio se corta en los límites entre escenas (en el silencio más cercano).
Falta: la interfaz (leer el guion entero tipo teleprompter), el corte por escenas y qué hacer si una
escena queda mal (volver a grabar solo esa, como ahora).

## Pruebas

```bash
pnpm --filter @frameflow/core test                         # limpieza y alineación (recording.test.ts)
FRAMEFLOW_LIVE_WHISPER=1 FRAMEFLOW_LIVE_HOME=<carpeta> FRAMEFLOW_LIVE_WAV=<voz.wav> \
  pnpm exec vitest run apps/desktop/src/main/services/voice/whisper.live.test.ts   # Whisper real
pnpm --filter @frameflow/desktop smoke                      # grabar con micrófono simulado
SMOKE_FULL=1 pnpm --filter @frameflow/desktop smoke         # además usa la toma con Whisper real
```

La prueba de humo arranca la app con `FRAMEFLOW_FAKE_MIC=1` (micrófono simulado de Chromium: un
tono), así que no hace falta micrófono real.
