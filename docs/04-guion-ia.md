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

**Ronda 3** (2026-11-17, `think: true`, Qwen3 14B frente a 8B, mismo código):

| Modelo       | Válidos | Tiempo medio | Líneas copiadas | Repeticiones | Duración | Datos (lectura manual)                                                                                                                                            |
| ------------ | ------- | ------------ | --------------- | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8B (5,0 GB)  | 4/4     | 193 s        | 14 %            | 1            | 0,71×    | Cifras absurdas o mal calculadas (agujero negro de 3·10¹⁰ kg, nube de 500 000 m³ = "500 t"), "35 % de hierro" inventado, palabras rotas ("purrimiento", "sucian") |
| 14B (9,0 GB) | 4/4     | 280 s        | 40 %            | 0            | 0,74×    | **Mejor**: mecanismo correcto (diafragma y laringe), Sagitario A\* ≈ 4 millones de soles; aún falla (nube de 100 t, "traga galaxias enteras")                     |

El 14B escribe mejor español y se inventa menos cifras, pero tarda ~45 % más (≈ 4,7 min por guion),
copia más la narración en los textos en pantalla y ocupa ~10 GB de RAM mientras genera (justo en
un equipo de 16 GB). Muestra pequeña: 4 temas, una pasada por modelo.

## Límites conocidos

- Sigue habiendo algún dato inventado, frases de relleno y líneas que copian la narración:
  **el guion debe revisarse antes de publicar** (el modo paso a paso existe para eso).
- La duración real varía (0,5–1,1× lo pedido); la voz final manda.
- Para mejores datos: el modelo local 14B o un proveedor en la nube (ver abajo).

## Proveedores (Ajustes → IA)

Quien escribe el guion se elige en **Ajustes**: un modelo local con Ollama (Qwen3 8B o 14B) o un
proveedor en la nube con la clave de API del usuario (Claude, OpenAI, Gemini). Código en
`packages/core/src/ai/` (`catalog.ts` sin SDKs, para la interfaz; `providers/` con los SDK oficiales,
solo en el proceso principal).

- **Mismo flujo para todos:** el `LlmProvider` recibe el esquema JSON y devuelve texto; la validación,
  los reintentos y las mejoras de arriba no cambian. `portableJsonSchema` quita las restricciones
  (longitudes, mínimos…) que no todos aceptan en la salida estructurada; se validan después con Zod.
- **"Pensar"** se traduce al control de cada proveedor: `effort` alto/bajo en Claude (el razonamiento
  va siempre activo), `reasoning.effort` en OpenAI; Gemini decide solo. En Claude Opus/Sonnet 5.5 se
  activa el reintento en el servidor si el filtro de seguridad rechaza la petición (`fallbacks`).
- **Claves:** se guardan cifradas con `safeStorage` de Electron (Llavero en macOS, DPAPI en Windows,
  libsecret/KWallet en Linux) en `ai-keys.json`; la interfaz solo ve si existe y sus 4 últimos
  caracteres. En Linux sin llavero se avisa de que el cifrado es débil.
- **Modelos:** el catálogo sugiere unos pocos por proveedor y admite cualquier ID ("Otro modelo"),
  porque los nombres cambian a menudo. "Probar conexión" valida clave y modelo sin gastar tokens.
- **Recomendación local** según el equipo: < 8 GB de RAM → la nube; 8–16 GB → 8B; ≥ 16 GB → 14B.
  Fuera de Mac con Apple Silicon se avisa de que sin GPU dedicada será lento.
- Pendiente de probar con claves reales: los tres proveedores en la nube solo tienen tests con
  clientes simulados.

## Cómo repetir la evaluación

```bash
FRAMEFLOW_EVAL_OUT=/tmp/eval.jsonl FRAMEFLOW_EVAL_VARIANT='{"think":true}' \
  pnpm --filter @frameflow/core exec vitest run ai.eval
```
