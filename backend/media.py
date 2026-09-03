from pathlib import Path
import mimetypes

AUDIO_EXTS = {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac", ".opus"}
MIME = {
    ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac",
    ".ogg": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac",
    ".opus": "audio/ogg",
}

def audio_mime(path: Path):
    return MIME.get(path.suffix.lower(), mimetypes.guess_type(path.name)[0] or "application/octet-stream")

def safe_filename(name: str):
    return Path(name).name.replace("\x00", "")

def iter_range(path: Path, start: int, end: int, chunk=1024*1024):
    with path.open("rb") as f:
        f.seek(start)
        left = end - start + 1
        while left:
            data = f.read(min(chunk, left))
            if not data:
                break
            left -= len(data)
            yield data
