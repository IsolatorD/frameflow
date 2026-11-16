"""Genera la narración de un storyboard con Kokoro (local, Apache-2.0).

Uso:
    uv run generate.py <storyboard.json> <salida-props.json>

Por cada escena con `narration`:
  - crea public/voice/<hash>.wav (se reutiliza si el texto/voz no cambian)
  - escribe en la escena `voice: {src, durationInSeconds}`
  - ajusta `durationInSeconds` para que la escena dure al menos lo que dura la voz
El resultado se guarda como props de Remotion: {"storyboard": {...}}.
"""

import difflib
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf

SAMPLE_RATE = 24_000
TAIL_PADDING_SECONDS = 0.5  # respiro tras cada frase antes de cambiar de escena

# Idioma del storyboard -> lang_code de Kokoro
LANG_CODES = {
    "en": "a", "en-gb": "b", "es": "e", "fr": "f",
    "hi": "h", "it": "i", "ja": "j", "pt": "p", "zh": "z",
}
DEFAULT_VOICES = {"es": "ef_dora", "en": "af_heart"}

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
WHISPER_MODEL = "base"  # basta: solo buscamos tiempos, el texto ya lo conocemos
WHISPER_RATE = 16_000

_whisper = None


def _normalize(word: str) -> str:
    """'¿Sabías' -> 'sabias'. Para comparar texto original con lo que oyó Whisper."""
    word = unicodedata.normalize("NFD", word.lower())
    word = "".join(c for c in word if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\w]", "", word)


def word_timings(wav_path: Path, narration: str, language: str) -> list[dict]:
    """Tiempos por palabra del texto ORIGINAL (con su ortografía y puntuación).

    Whisper transcribe el audio con tiempos por palabra; luego alineamos sus
    palabras con las de la narración. Las que no coinciden se interpolan.
    """
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel

        _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")

    audio, sr = sf.read(wav_path, dtype="float32")
    n = int(len(audio) * WHISPER_RATE / sr)
    audio16 = np.interp(np.linspace(0, len(audio) - 1, n), np.arange(len(audio)), audio)
    segments, _ = _whisper.transcribe(
        audio16.astype("float32"), language=language.split("-")[0], word_timestamps=True
    )
    heard = [w for s in segments for w in s.words]

    words = narration.split()
    times: list[tuple[float, float] | None] = [None] * len(words)
    matcher = difflib.SequenceMatcher(
        a=[_normalize(w) for w in words], b=[_normalize(h.word) for h in heard], autojunk=False
    )
    for block in matcher.get_matching_blocks():
        for k in range(block.size):
            h = heard[block.b + k]
            times[block.a + k] = (h.start, h.end)

    total = len(audio) / sr
    result = []
    for i, word in enumerate(words):
        if times[i] is None:
            # Reparte el hueco entre la palabra conocida anterior y la siguiente
            # a partes iguales entre las palabras sin tiempo que hay en medio.
            prev_end = times[i - 1][1] if i > 0 else 0.0
            nxt = next((j for j in range(i + 1, len(words)) if times[j]), None)
            gap_end = times[nxt][0] if nxt is not None else total
            unknown = (nxt if nxt is not None else len(words)) - i
            times[i] = (prev_end, prev_end + (gap_end - prev_end) / unknown)
        start, end = times[i]
        result.append({"text": word, "start": round(start, 3), "end": round(end, 3)})
    return result


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("Uso: uv run generate.py <storyboard.json> <salida-props.json>")
    source, target = Path(sys.argv[1]), Path(sys.argv[2])
    storyboard = json.loads(source.read_text(encoding="utf-8"))

    language = storyboard.get("language", "es")
    voice_cfg = storyboard.setdefault("voice", {})
    voice_id = voice_cfg.setdefault("voiceId", DEFAULT_VOICES.get(language, "af_heart"))
    speed = voice_cfg.setdefault("speed", 1.0)

    from kokoro import KPipeline  # import tardío: tarda en cargar

    pipeline = KPipeline(lang_code=LANG_CODES[language], repo_id="hexgrad/Kokoro-82M")
    out_dir = PUBLIC_DIR / "voice"
    out_dir.mkdir(parents=True, exist_ok=True)

    for i, scene in enumerate(storyboard["scenes"]):
        text = scene.get("narration")
        if not text:
            continue
        key = hashlib.sha1(f"{voice_id}|{speed}|{text}".encode()).hexdigest()[:12]
        wav_path = out_dir / f"{key}.wav"

        if not wav_path.exists():
            chunks = [audio for _, _, audio in pipeline(text, voice=voice_id, speed=speed)]
            sf.write(wav_path, np.concatenate(chunks), SAMPLE_RATE)

        words_path = wav_path.with_suffix(".words.json")
        if not words_path.exists():
            words_path.write_text(
                json.dumps(word_timings(wav_path, text, language), ensure_ascii=False),
                encoding="utf-8",
            )

        seconds = round(sf.info(wav_path).duration, 3)
        scene["voice"] = {
            "src": f"voice/{wav_path.name}",
            "durationInSeconds": seconds,
            "words": json.loads(words_path.read_text(encoding="utf-8")),
        }
        scene["durationInSeconds"] = round(
            max(scene["durationInSeconds"], seconds + TAIL_PADDING_SECONDS), 2
        )
        print(f"escena {i + 1}: {seconds:.2f}s de voz -> {scene['durationInSeconds']}s")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps({"storyboard": storyboard}, ensure_ascii=False, indent="\t"),
        encoding="utf-8",
    )
    print(f"props escritas en {target}")


if __name__ == "__main__":
    main()
