# Guion con IA — evaluación y decisiones

> 2026-11-16 · modelo local `hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M` (Ollama) · código en
> `packages/core/src/script/` (`ai.ts`, `quality.ts`).

## Cómo se genera

1. La IA recibe el tema, el tono de la marca y la duración, y responde un JSON **plano** (todas las
   escenas con los mismos campos; `visual: "texto" | "cifra"` decide cuáles cuentan).
2. **Errores graves** (formato, fragmentos, números con cifras en la narración, cifras con valor 0,
   todo cifras, textos demasiado largos): se le devuelve el error y reintenta, hasta 3 veces.
3. **Mejoras deseables** (duración ±, líneas que copian la narración, ideas repetidas): se piden
   **una** vez; si no mejora, se usa el mejor intento válido en vez de fallar.
4. Por defecto el modelo **razona antes de escribir** (`think: true`).

## Lecciones con modelos pequeños y salida restringida (JSON Schema)

| Lo que hicimos                              | Lo que pasó                                     | Ahora                                         |
| ------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| Unión de tipos de escena (`anyOf`)          | Todas las escenas salían como cifra con valor 0 | Esquema plano + validación posterior          |
| `maxLength` en el esquema                   | El modelo cortaba palabras ("objetos tan fu")   | Sin límites en el esquema; se validan después |
| Duración y estilo como errores obligatorios | Fiabilidad 1/4 y 0/4                            | Mejoras "blandas": se piden una vez           |

## Evaluación (4 temas, 45 s, español)

Métricas automáticas en `quality.ts`; los datos se revisaron leyendo cada guion.

**Ronda 1** (duración/estilo aún obligatorios):

| Variante                 | Válidos | Tiempo medio | Líneas copiadas | Repeticiones |
| ------------------------ | ------- | ------------ | --------------- | ------------ |
| Base                     | 3/4     | 83 s         | 29 %            | 1            |
| Comprobaciones estrictas | 1/4     | 126 s        | 0 %             | 0            |
| Revisión (2.ª pasada)    | 3/4     | 134 s        | 8 %             | 2            |
| Pensar                   | **4/4** | 191 s        | 29 %            | 0            |
| Revisión + estrictas     | 0/4     | —            | —               | —            |

**Ronda 2** (mejoras blandas):

| Variante | Válidos | Tiempo medio | Líneas copiadas | Repeticiones | Datos (lectura manual)                                                                            |
| -------- | ------- | ------------ | --------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| Base     | 3/4     | 110 s        | 31 %            | 0            | Errores sueltos ("la capa de ozono protege de la oxidación")                                      |
| Revisión | 4/4     | 171 s        | 12 %            | 2            | **Peor**: inventa cifras (100 g de agua/m³, nube de 100 000 t)                                    |
| Pensar   | **4/4** | 228 s        | 20 %            | 1            | **Mejor**: nube típica ≈ 500 t (cifra del USGS), ronroneo 25–150 Hz; aún inventa algún porcentaje |

**Decisión:** `think: true` por defecto (única fiable en ambas rondas y la de mejores datos), a
cambio de 3–4 min por guion. La revisión queda como opción desactivada: un modelo de 8B
revisándose a sí mismo no corrige errores factuales, a veces los añade.

## Límites conocidos

- Sigue habiendo algún dato inventado, frases de relleno y líneas que copian la narración:
  **el guion debe revisarse antes de publicar** (el modo paso a paso existe para eso).
- La duración real varía (0,5–1,1× lo pedido); la voz final manda.
- Mejoras posibles: un modelo local mayor (más RAM y tiempo) o un proveedor en la nube
  (`LlmProvider` ya lo permite), que mejoraría mucho los datos.

## Cómo repetir la evaluación

```bash
FRAMEFLOW_EVAL_OUT=/tmp/eval.jsonl FRAMEFLOW_EVAL_VARIANT='{"think":true}' \
  pnpm --filter @frameflow/core exec vitest run ai.eval
```
