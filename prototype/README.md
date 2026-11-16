# Frameflow — prototipo Remotion

Prueba de concepto: un **storyboard JSON** se convierte en un video vertical animado.

```bash
nvm use            # Node 24
pnpm install
pnpm studio        # editor visual de Remotion en el navegador (props editables)
pnpm render        # → out/demo.mp4 (1080x1920)
```

## Voz (Kokoro, local)

Requisitos: `brew install espeak-ng uv`. La primera vez descarga el modelo (~330 MB).

```bash
pnpm voice          # genera public/voice/*.wav y out/props.json
pnpm render:voice   # voz + render → out/demo-voz.mp4
pnpm studio:voice   # Studio con la versión narrada
```

Cada escena puede tener `narration`. El script ajusta la duración de la escena a la de la voz
(+0,5 s) y cachea los audios por hash (texto + voz + velocidad).
Voces en español: `ef_dora` (mujer), `em_alex`, `em_santa` (hombre).

### Subtítulos sincronizados

Tras generar cada audio, `faster-whisper` (modelo `base`, local) obtiene los tiempos por palabra
y se alinean con el texto original de `narration` (se conservan tildes, `¿?` y mayúsculas;
las palabras que Whisper oye distinto —p. ej. cifras— se interpolan).
Se guardan en `public/voice/<hash>.words.json` y en `scene.voice.words`.
Se configuran con `captions: { enabled, maxWordsPerPage }` en el storyboard.

## Generar el storyboard con IA (Ollama, local)

Requisitos: `brew install ollama && brew services start ollama` y un modelo descargado:

```bash
ollama pull hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M   # ~5 GB, se puede retomar si se corta
export FRAMEFLOW_MODEL=hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M
pnpm ai "por qué el cielo es azul" --preset ciencia --duration 40 --render
```

- `generator/presets.ts` — presets de nicho (curiosidades, ciencia, historia, finanzas): colores, voz, tono.
- `generator/llm.ts` — interfaz `LlmProvider` + `OllamaProvider` (salida estructurada con JSON Schema).
- `generator/generate.ts` — tema → storyboard validado (reintenta pasándole el error a la IA)
  → `stories/<slug>.json`; con `--render` además genera voz y `out/<slug>.mp4`.

> Estado: escrito y compilando, **sin probar aún con un modelo real** (descarga pendiente).

## Archivos

- `src/storyboard/demo.json` — el guion/escenas. Cambia textos, colores, duraciones o `format` ("16:9").
- `src/storyboard/schema.ts` — contrato del storyboard (zod).
- `src/scenes/` — un componente por tipo de escena (`kinetic-text`, `stat`).
- `src/Storyboard.tsx` — registro tipo de escena → componente.
