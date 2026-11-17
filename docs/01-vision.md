# Frameflow — Visión y decisiones iniciales

> Documento vivo. Última actualización: 2026-11-15.

## Qué es

App de escritorio para generar videos animados informativos cortos (60 s – 3 min)
a partir de instrucciones, con un editor tipo CapCut para retocar el resultado.
Primero para uso propio; más adelante, compartible con otros creadores.

## Decisiones tomadas

| Tema            | Decisión                                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nicho           | Configurable: **presets por nicho** (tono, paleta, ritmo, estilo, mascota por defecto)                                                                                      |
| Idioma          | **Multi-idioma** (guion, voz y subtítulos)                                                                                                                                  |
| Formato         | **9:16 primero**; 16:9 seleccionable después                                                                                                                                |
| Estilos         | Texto cinético · Infografía animada · Personaje 2D                                                                                                                          |
| Voz             | Elegible: **voz propia grabada** o **TTS sintético**                                                                                                                        |
| Flujo           | Dos modos: **paso a paso** (revisar guion → escenas → video) y **automático**                                                                                               |
| Costos          | **Local y gratis primero**; APIs de pago opcionales                                                                                                                         |
| Plataforma      | **Híbrida**: escritorio primero (Electron); monorepo con `core`/`ui` reutilizables para una web futura; servicio cloud pequeño más adelante (OAuth, programación, métricas) |
| Motor de video  | **Remotion** (React → MP4), validado con prototipo; render aislado tras el storyboard para poder cambiar (p. ej. HyperFrames)                                               |
| Eje del sistema | **Proyecto = canal** (Astroinfo…): marca, generación, biblioteca, cuentas, publicación y estadísticas                                                                       |
| Redes           | Fase 1 exportar con metadatos · 2 YouTube · 3 Instagram/Facebook · 4 TikTok                                                                                                 |

## Arquitectura conceptual

```
Tema + preset de nicho
   │
   ▼
[LLM] guion ──► [LLM] escenas (JSON "storyboard")
   │                      │
   ▼                      ▼
[TTS / voz propia]   [Componentes Remotion por estilo]
   │                      │
   └──► tiempos de palabras (duraciones de Kokoro) ──► subtítulos sincronizados
                          │
                          ▼
              Editor (línea de tiempo) edita el JSON
                          │
                          ▼
                   Render MP4 local
```

La pieza central es el **JSON del storyboard**: la IA lo genera, el editor lo edita
y Remotion lo renderiza. Nada se "quema" hasta el render final.

## Stack candidato (local / gratis)

- **Escritorio**: Electron (Remotion necesita Node + Chrome headless; Electron ya los trae).
  Alternativa: Tauri + Node sidecar (más ligero, más complejo).
- **Video**: Remotion. Licencia gratis para individuos y empresas ≤3 personas;
  si Frameflow se vuelve producto para terceros hay que revisar la licencia "Automators".
- **LLM**: Ollama local (Llama / Qwen / Gemma) con opción de API (Claude, etc.).
- **TTS**: Kokoro (Apache-2.0, multi-idioma, buena calidad). Piper como alternativa rápida
  (GPL-3, revisar licencia de cada voz). Evitar XTTS v2 (licencia no comercial).
- **Subtítulos / sincronía**: ~~Whisper~~ → desde 2026-11-17, las duraciones por fonema de Kokoro
  ajustadas a los silencios (ver `docs/05-voz.md`).

## Decisión 2026-11-16 (adoptada): proyectos/canales como eje central

La unidad principal deja de ser "el video" y pasa a ser el **proyecto** (= un canal, p. ej. _Astroinfo_).

```
Proyecto (Astroinfo)
├── Marca y estilo: preset de nicho base + personalización (colores, logo, mascota, voz, idiomas)
├── Generar video → storyboard → editor → render
├── Biblioteca: storyboards, renders, versiones por idioma/formato
├── Cuentas conectadas: YouTube · Instagram · Facebook · TikTok
├── Publicación: directa (API) o exportar + texto/hashtags listos para pegar
└── Estadísticas por publicación y por red
```

Realidad de las APIs (verificar detalles al implementar cada una):

| Red       | Publicar por API     | Estadísticas       | Obstáculo principal                                                                 |
| --------- | -------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| YouTube   | Sí (Data API v3)     | Sí (Analytics API) | Cuota diaria; app sin verificar sube vídeos privados                                |
| Instagram | Reels sí (Graph API) | Sí (Insights)      | Cuenta Business/Creator ligada a página de Facebook; revisión de Meta para terceros |
| Facebook  | Reels en Páginas     | Sí                 | Igual que Instagram (misma app de Meta)                                             |
| TikTok    | Content Posting API  | Limitadas          | Auditoría de la app; sin ella solo publica en privado                               |

Para **uso propio** las apps en modo desarrollo bastan (tus cuentas como testers).
Las revisiones/auditorías solo hacen falta al abrirlo a otros usuarios.

Orden propuesto: 1) proyectos + generar + exportar con metadatos por red,
2) YouTube (publicar + estadísticas), 3) Meta (IG + FB), 4) TikTok.

Implicaciones técnicas: base de datos local (SQLite), tokens OAuth en el llavero del sistema,
sincronización de estadísticas cuando la app está abierta. Electron sigue encajando.

## Decisión 2026-11-16 (adoptada): arquitectura híbrida

Escritorio primero, pero con el código organizado para que una versión web sea "otra app" y no una reescritura.

| Pieza                                      | Escritorio                           | Web                                                                    |
| ------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------- |
| Render (Remotion)                          | Gratis, en la máquina del usuario    | Servidor/nube: coste por video; licencia de Remotion para empresas     |
| Voz (Kokoro) y Whisper                     | Local, gratis                        | Servidor con CPU/GPU, o en navegador (limitado: kokoro-js solo inglés) |
| LLM                                        | Ollama local o API                   | API de pago (o servidor con GPU)                                       |
| OAuth de redes                             | Incómodo (Meta/TikTok prefieren web) | Natural                                                                |
| Publicar programado / sincronizar métricas | Solo con la app abierta              | 24/7                                                                   |
| Multi-dispositivo / equipos                | No                                   | Sí                                                                     |
| Costes fijos                               | Ninguno                              | Hosting, almacenamiento de videos, cómputo, auth, pagos                |

Plan híbrido:

1. **Monorepo** (pnpm workspaces): `packages/core` (dominio, storyboard, pipeline e interfaces),
   `packages/renderer-remotion`, `packages/ui` (React), `apps/desktop` (Electron).
2. **Todo lo intercambiable detrás de interfaces**: LLM (Ollama | Claude), TTS (Kokoro | nube),
   almacenamiento (disco | S3), BD (SQLite | Postgres, ambos con Drizzle).
3. Más adelante, un **servicio cloud pequeño** solo para lo que el escritorio hace mal: OAuth,
   publicación programada y sincronización de métricas. Barato: no renderiza.
4. **Web completa** solo si Frameflow se vuelve producto, con planes de pago que cubran el render.

## Referencias evaluadas (2026-11-16)

- **Lemo-Opuscar** (github.com/lemomo-ai/lemo-opuscar): skill de Claude Code con 99 estilos de "película
  hecha con código" (HTML/canvas/three.js → Playwright → ffmpeg). No es un motor de plantillas: el agente
  escribe código nuevo por video. Código MIT; los prompts/estilos (docs) son CC BY-NC → meterlos en un
  producto comercial requiere licencia. Útil como inspiración, para portar técnicas (MIT) y para videos
  "premium" puntuales del canal hechos con Claude Code.
- **HyperFrames** (HeyGen, Apache-2.0): HTML → MP4 pensado para agentes. Alternativa a Remotion con
  licencia más libre. Mantener el render detrás de una interfaz (storyboard → renderer) para poder cambiar.
- **FFmpeg**: ya incluido vía Remotion; útil para normalizar volumen (−14 LUFS), unir audio/música.
- **yt-dlp**: descarga videos de plataformas. Solo para material propio o análisis de referencias;
  reutilizar contenido ajeno choca con copyright y términos de servicio.

## Preguntas abiertas

1. ¿Qué mascota inicial? (Bit · Sabio · Chispa · Gota · otra)
2. ¿Cómo se crean los personajes 2D: rig propio en SVG, Rive, o assets externos?
3. ¿Música de fondo? (biblioteca libre de derechos local)
4. ¿Publicación directa a redes, o solo exportar MP4?
5. Requisitos mínimos de hardware para usuarios futuros (RAM / GPU para LLM y TTS locales).
