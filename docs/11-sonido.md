# Sonido: masterizado y efectos

> 2026-11-19 · código en `packages/core/src/audio/` (`loudness.ts`, `sfx.ts`),
> `apps/desktop/src/main/services/render.ts` (masterizado) y `sfxFiles.ts`.

## Masterizado para redes (siempre)

Todo MP4 sale con una **sonoridad integrada de −14 LUFS** y el **pico real por debajo de
−1,5 dBTP**, el nivel al que TikTok, YouTube e Instagram normalizan. Así el video no suena flojo
al lado de otros ni lo bajan con distorsión.

1. Remotion renderiza el video (`*.sin-masterizar.mp4`).
2. **Primera pasada:** el filtro `loudnorm` de ffmpeg (EBU R128) mide la sonoridad, el pico real y
   el rango.
3. **Segunda pasada:** aplica una **ganancia lineal** con lo medido. No comprime la dinámica: la voz
   suena igual, solo más o menos fuerte. La imagen se copia sin recodificar; el audio sale en AAC
   de 192 kbps a 48 kHz.
4. Se guarda la sonoridad final (`renders.loudness_lufs`, migración 0003) y se muestra junto al
   MP4: «MP4 de la versión 3 · 4,1 MB · volumen −14,0 LUFS».

Se usa el ffmpeg que ya trae Remotion (incluye `loudnorm`), sin dependencias nuevas. Un video sin
sonido no se toca. Los renders anteriores a 0.5.0 no tienen el dato.

## Efectos de sonido (opcional, por video)

En **Ajustes del video → Efectos de sonido**. Son tres efectos sutiles, con un volumen común:

| Efecto    | Cuándo                                                | Alineación                      |
| --------- | ----------------------------------------------------- | ------------------------------- |
| Barrido   | En cada cambio de escena                              | Su pico (0,3 s) cae en el corte |
| Pop       | Cuando entra la cifra de una escena de cifra (+0,4 s) | Ataque inmediato                |
| Campanita | Cuando aparece la llamada a la acción                 | Ataque inmediato                |

- Se **sintetizan en código** (`core/audio/sfx.ts`: ruido filtrado, un seno que cae de tono y dos
  parciales en quinta). No hay muestras de terceros ni licencias que añadir, y son deterministas.
  Se escriben como WAV en la carpeta del proyecto (`sfx/v1/`, unos KB) la primera vez que hacen
  falta.
- Van en una pista «Efectos» de la línea de tiempo: se ven, se pueden silenciar (se respeta al
  editar) y **siguen a las escenas**: si cambian los tiempos, se recolocan.
- Un acento por momento, nunca por palabra. Si dos efectos se tocan, el primero se recorta con un
  fundido de 30 ms.
- El masterizado se aplica a la mezcla completa (voz, música y efectos).

Criterios tomados de teardown (`sfx/`, MIT) y de la skill «sonido» de skills-videos-cortos (MIT):
alinear el pico con el impacto, acentuar sin narrar y medir la mezcla final, no las pistas.

## Pruebas

```bash
pnpm --filter @frameflow/core exec vitest run src/audio      # medición, filtros, síntesis y eventos
SMOKE_FULL=1 pnpm --filter @frameflow/desktop smoke          # render real: efectos y −14 LUFS
```
