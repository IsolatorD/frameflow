# Marca de Frameflow

Símbolo: **tres fotogramas en flujo** (frame + flow) con un play en el delantero.

| Archivo                                                   | Uso                                                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `frameflow-icon.svg`                                      | Icono principal (placa violeta oscuro). Barra lateral, intro de videos, web             |
| `frameflow-icon-macos.svg`                                | Icono de la app (lienzo 1024 con márgenes de Apple). Fuente de `icon.png` / `icon.icns` |
| `frameflow-mark.svg`                                      | Símbolo sin placa, sobre fondos oscuros                                                 |
| `frameflow-mark-light.svg` / `frameflow-icon-light.svg`   | Sobre fondos claros                                                                     |
| `frameflow-icon-mono.svg` / `frameflow-mark-mono.svg`     | Monocromo (marcas de agua)                                                              |
| `frameflow-wordmark.svg` / `frameflow-wordmark-light.svg` | Firma: símbolo + nombre                                                                 |

## Colores

|                             | Hex       |
| --------------------------- | --------- |
| Placa (violeta noche)       | `#26215C` |
| Fotograma trasero           | `#534AB7` |
| Fotograma medio             | `#7F77DD` |
| Fotograma delantero (ámbar) | `#FAC775` |

## Regenerar los iconos de la app

```bash
pnpm --filter @frameflow/desktop icons
```

Lee `frameflow-icon-macos.svg` y escribe `apps/desktop/resources/icon.png` (1024 px) y
`apps/desktop/build/icon.icns` (todas las resoluciones de macOS).
