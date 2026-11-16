"""Servicio de voz de Frameflow: Kokoro (TTS, Apache-2.0) + Whisper (tiempos por palabra).

La app lo ejecuta con `uv run --project packages/tts synthesize.py` y le pasa por stdin:

    {"language": "es", "voiceId": "em_alex", "speed": 1.0, "outDir": "/ruta/voice",
     "items": [{"id": "scene-1", "text": "¿Sabías que…?"}, ...]}

Por stdout responde una línea JSON por evento:

    {"type": "progress", "done": 1, "total": 3, "id": "scene-1"}
    {"type": "result", "items": [{"id", "file", "duration", "words": [...]}]}
    {"type": "error", "message": "..."}

Cada audio se nombra con un hash de voz+velocidad+texto: si no cambian, se reutiliza.
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
LANG_CODES = {"en": "a", "en-gb": "b", "es": "e", "fr": "f", "it": "i", "pt": "p"}
WHISPER_MODEL = "base"  # basta: solo buscamos tiempos, el texto ya lo conocemos
WHISPER_RATE = 16_000

_whisper = None


def emit(event: dict) -> None:
    print(json.dumps(event, ensure_ascii=False), flush=True)


def _normalize(word: str) -> str:
    """'¿Sabías' -> 'sabias'. Para comparar texto original con lo que oyó Whisper."""
    word = unicodedata.normalize("NFD", word.lower())
    word = "".join(c for c in word if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\w]", "", word)


def word_timings(wav_path: Path, text: str, language: str) -> list[dict]:
    """Tiempos por palabra del texto ORIGINAL, alineando lo que oyó Whisper con el guion."""
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel

        _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")

    audio, sr = sf.read(wav_path, dtype="float32")
    # PyAV >= 19 falla al decodificar archivos: se pasa un array a 16 kHz.
    n = int(len(audio) * WHISPER_RATE / sr)
    audio16 = np.interp(np.linspace(0, len(audio) - 1, n), np.arange(len(audio)), audio)
    segments, _ = _whisper.transcribe(
        audio16.astype("float32"), language=language.split("-")[0], word_timestamps=True
    )
    heard = [w for s in segments for w in s.words]

    words = text.split()
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
            # Reparte el hueco entre la palabra conocida anterior y la siguiente.
            prev_end = times[i - 1][1] if i > 0 else 0.0
            nxt = next((j for j in range(i + 1, len(words)) if times[j]), None)
            gap_end = times[nxt][0] if nxt is not None else total
            unknown = (nxt if nxt is not None else len(words)) - i
            times[i] = (prev_end, prev_end + (gap_end - prev_end) / unknown)
        start, end = times[i]
        result.append({"text": word, "start": round(start, 3), "end": round(end, 3)})
    return result


def main() -> None:
    request = json.loads(sys.stdin.read())
    language = request["language"]
    voice_id = request["voiceId"]
    speed = float(request.get("speed", 1.0))
    out_dir = Path(request["outDir"])
    items = request["items"]
    out_dir.mkdir(parents=True, exist_ok=True)

    pipeline = None
    results = []
    for done, item in enumerate(items, start=1):
        text = item["text"].strip()
        key = hashlib.sha1(f"{voice_id}|{speed}|{text}".encode()).hexdigest()[:12]
        wav_path = out_dir / f"{key}.wav"
        words_path = wav_path.with_suffix(".words.json")

        if not wav_path.exists():
            if pipeline is None:
                from kokoro import KPipeline  # import tardío: tarda en cargar

                pipeline = KPipeline(lang_code=LANG_CODES[language], repo_id="hexgrad/Kokoro-82M")
            chunks = [audio for _, _, audio in pipeline(text, voice=voice_id, speed=speed)]
            sf.write(wav_path, np.concatenate(chunks), SAMPLE_RATE)
        if not words_path.exists():
            words_path.write_text(
                json.dumps(word_timings(wav_path, text, language), ensure_ascii=False),
                encoding="utf-8",
            )

        results.append(
            {
                "id": item["id"],
                "file": wav_path.name,
                "duration": round(sf.info(wav_path).duration, 3),
                "words": json.loads(words_path.read_text(encoding="utf-8")),
            }
        )
        emit({"type": "progress", "done": done, "total": len(items), "id": item["id"]})

    emit({"type": "result", "items": results})


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 — se informa a la app como evento
        emit({"type": "error", "message": f"{type(error).__name__}: {error}"})
        sys.exit(1)
