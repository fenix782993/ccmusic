import os
import re
import secrets
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import (
    FastAPI,
    Request,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    FileResponse,
    StreamingResponse,
)
from fastapi.staticfiles import StaticFiles

from sqlalchemy import (
    func,
    or_,
)
from sqlalchemy.orm import Session
import httpx

from backend.database import (
    Base,
    SessionLocal,
    engine,
)
from backend.models import (
    User,
    Track,
    Like,
    History,
    Playlist,
    PlaylistTrack,
    TelegramAuth,
)

from backend.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="FENIX MUSIC API",
    version="10.1.0",
)


# ============================================================
# CORS
# ============================================================

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "*",
)

if CORS_ORIGINS == "*":
    allow_origins = ["*"]
else:
    allow_origins = [
        x.strip()
        for x in CORS_ORIGINS.split(",")
        if x.strip()
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"

DEFAULT_MEDIA_DIR = BASE_DIR / "backend" / "media"

MEDIA_DIR = Path(
    os.getenv(
        "MEDIA_DIR",
        str(DEFAULT_MEDIA_DIR),
    )
)

AUDIO_DIR = MEDIA_DIR / "audio"
MUSIC_DIR = MEDIA_DIR / "music"
UPLOAD_DIR = MEDIA_DIR / "uploads"
COVER_DIR = MEDIA_DIR / "covers"
RADIO_DIR = MEDIA_DIR / "radio"

for directory in (
    MEDIA_DIR,
    AUDIO_DIR,
    MUSIC_DIR,
    UPLOAD_DIR,
    COVER_DIR,
    RADIO_DIR,
):
    directory.mkdir(
        parents=True,
        exist_ok=True,
    )


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ============================================================
# ENV
# ============================================================

ADMIN_EMAIL = os.getenv(
    "ADMIN_EMAIL",
    "Kfeofilov52@gmail.com",
).strip()

ADMIN_PASSWORD = os.getenv(
    "ADMIN_PASSWORD",
    "ChangeMe123!",
)

ADMIN_USERNAME = os.getenv(
    "ADMIN_USERNAME",
    "FenixAdmin",
).strip()


# ============================================================
# HELPERS
# ============================================================

def normalize_email(email: str) -> str:
    return email.strip().lower()


def safe_filename(filename: str) -> str:
    filename = Path(filename).name

    filename = re.sub(
        r"[^a-zA-Z0-9а-яА-ЯёЁ._ -]",
        "_",
        filename,
    )

    return filename or "file"


def resolve_path(path_value: str | None):
    if not path_value:
        return None

    raw = Path(path_value)

    candidates = []

    if raw.is_absolute():
        candidates.append(raw)
    else:
        candidates.extend(
            [
                BASE_DIR / raw,
                BASE_DIR / "backend" / raw,
                Path.cwd() / raw,
                MEDIA_DIR / raw,
                AUDIO_DIR / raw,
                UPLOAD_DIR / raw,
            ]
        )

    for candidate in candidates:
        try:
            if candidate.exists():
                return candidate.resolve()
        except OSError:
            continue

    return None


def track_to_dict(
    track: Track,
    liked: bool = False,
):
    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist or "Unknown Artist",
        "album": track.album or "",
        "genre": track.genre or "",
        "duration": track.duration or 0,
        "cover_url": track.cover_url,
        "audio_path": track.audio_path,
        "plays": track.plays or 0,
        "lyrics": track.lyrics,
        "liked": liked,
    }


def get_current_user(
    token: Optional[str],
    db: Session,
):
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    user_id = payload.get("user_id")

    if user_id is None:
        user_id = payload.get("sub")

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
        )

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user


def require_admin(
    token: Optional[str],
    db: Session,
):
    user = get_current_user(
        token,
        db,
    )

    if not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return user


# ============================================================
# ADMIN SEED
# ============================================================

def seed_admin():
    """
    Создаёт администратора только если его нет.

    Если email уже существует:
    - НЕ создаёт второго пользователя;
    - назначает пользователя администратором;
    - обновляет username;
    - обновляет пароль.
    """

    db = SessionLocal()

    try:
        email = normalize_email(
            ADMIN_EMAIL
        )

        if not email:
            print(
                "ADMIN_EMAIL is empty. "
                "Admin seed skipped."
            )
            return

        admin = db.query(User).filter(
            func.lower(User.email) == email
        ).first()

        if admin:
            print(
                f"Admin already exists: {admin.email}"
            )

            changed = False

            if not admin.is_admin:
                admin.is_admin = True
                changed = True

            if ADMIN_USERNAME and (
                admin.username != ADMIN_USERNAME
            ):
                admin.username = ADMIN_USERNAME
                changed = True

            if ADMIN_PASSWORD:
                admin.password_hash = hash_password(
                    ADMIN_PASSWORD
                )
                changed = True

            if changed:
                db.commit()

            print(
                f"Admin ready: {admin.email}"
            )

            return

        admin = User(
            email=email,
            password_hash=hash_password(
                ADMIN_PASSWORD
            ),
            username=ADMIN_USERNAME,
            is_admin=True,
        )

        db.add(admin)

        db.commit()

        print(
            f"Admin created: {email}"
        )

    except Exception as exc:
        db.rollback()

        print(
            f"Admin seed error: {exc}"
        )

    finally:
        db.close()


# ============================================================
# MUSIC SCANNER
# ============================================================

AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
    ".aac",
    ".flac",
    ".webm",
}


def scan_music():
    """
    Сканирует media/audio, media/music и media/uploads.
    """

    db = SessionLocal()

    try:
        folders = [
            AUDIO_DIR,
            MUSIC_DIR,
            UPLOAD_DIR,
        ]

        existing_paths = {
            str(track.audio_path)
            for track in db.query(Track).all()
            if track.audio_path
        }

        added = 0

        for folder in folders:
            if not folder.exists():
                continue

            for path in folder.rglob("*"):

                if not path.is_file():
                    continue

                if path.suffix.lower() not in AUDIO_EXTENSIONS:
                    continue

                relative_path = str(
                    path.relative_to(BASE_DIR)
                ).replace("\\", "/")

                if relative_path in existing_paths:
                    continue

                filename = path.stem

                artist = "Unknown Artist"
                title = filename

                if " - " in filename:
                    artist, title = filename.split(
                        " - ",
                        1,
                    )

                track = Track(
                    title=title.strip(),
                    artist=artist.strip(),
                    album="",
                    genre="",
                    duration=0,
                    audio_path=relative_path,
                    cover_url=None,
                    plays=0,
                )

                db.add(track)

                existing_paths.add(
                    relative_path
                )

                added += 1

        if added:
            db.commit()

        print(
            f"Music scan complete. Added: {added}"
        )

    except Exception as exc:
        db.rollback()

        print(
            f"Music scan error: {exc}"
        )

    finally:
        db.close()


# ============================================================
# STARTUP
# ============================================================

DEMO_TRACKS = {
    "Blinding Lights",
    "Save Your Tears",
    "Starboy",
    "Die For You",
    "I Feel It Coming",
    "After Hours",
}

def remove_demo_tracks():
    """Удаляет только старые демо-треки The Weeknd. Пользовательские треки не трогает."""
    db = SessionLocal()
    try:
        tracks = (
            db.query(Track)
            .filter(
                Track.artist.ilike("%The Weeknd%"),
                Track.title.in_(DEMO_TRACKS),
            )
            .all()
        )
        if not tracks:
            return

        ids = [t.id for t in tracks]
        db.query(Like).filter(Like.track_id.in_(ids)).delete(synchronize_session=False)
        db.query(History).filter(History.track_id.in_(ids)).delete(synchronize_session=False)
        db.query(PlaylistTrack).filter(PlaylistTrack.track_id.in_(ids)).delete(synchronize_session=False)
        for track in tracks:
            db.delete(track)
        db.commit()
        print(f"Removed old demo tracks: {len(tracks)}")
    except Exception as exc:
        db.rollback()
        print(f"Demo cleanup error: {exc}")
    finally:
        db.close()


@app.on_event("startup")
def startup():
    print("Starting FENIX MUSIC...")

    seed_admin()
    remove_demo_tracks()
    scan_music()

    print("FENIX MUSIC startup complete.")


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "app": "FENIX MUSIC",
        "version": "10.1.0",
    }


@app.get("/api/health")
def api_health():
    return {
        "status": "ok",
        "app": "FENIX MUSIC",
        "version": "10.1.0",
    }


# ============================================================
# AUTH
# ============================================================

@app.post("/api/auth/register")
def register(
    email: str = Form(...),
    password: str = Form(...),
    username: str = Form(...),
    db: Session = Depends(get_db),
):
    email = normalize_email(email)

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 6 characters",
        )

    existing = db.query(User).filter(
        func.lower(User.email) == email
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    user = User(
        email=email,
        password_hash=hash_password(password),
        username=username.strip(),
        is_admin=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        user.id,
        user.email,
        user.is_admin,
    )

    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "is_admin": user.is_admin,
        },
    }


@app.post("/api/auth/login")
def login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    email = normalize_email(email)

    user = db.query(User).filter(
        func.lower(User.email) == email
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not verify_password(
        password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = create_access_token(
        user.id,
        user.email,
        user.is_admin,
    )

    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "is_admin": user.is_admin,
        },
    }


@app.get("/api/auth/me")
def me(
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    user = get_current_user(
        token,
        db,
    )

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "telegram_id": user.telegram_id,
        "is_admin": user.is_admin,
    }


# ============================================================
# TRACKS
# ============================================================

@app.get("/api/tracks")
def tracks(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Track)
        .order_by(
            Track.created_at.desc()
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        track_to_dict(track)
        for track in rows
    ]


@app.get("/api/tracks/{track_id}")
def get_track(
    track_id: int,
    db: Session = Depends(get_db),
):
    track = db.query(Track).filter(
        Track.id == track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    return track_to_dict(track)


# ============================================================
# STREAM
# ============================================================

@app.get("/api/tracks/{track_id}/stream")
def stream_track(
    track_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    track = db.query(Track).filter(Track.id == track_id).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    path = resolve_path(track.audio_path)

    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    size = path.stat().st_size
    range_header = request.headers.get("range")

    content_type = "audio/mpeg"
    extension = path.suffix.lower()
    content_types = {
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".webm": "audio/webm",
        ".opus": "audio/ogg",
    }
    content_type = content_types.get(extension, content_type)

    if not range_header:
        def iter_file():
            with path.open("rb") as audio:
                while True:
                    chunk = audio.read(1024 * 1024)
                    if not chunk:
                        break
                    yield chunk

        return StreamingResponse(
            iter_file(),
            media_type=content_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(size),
                "Cache-Control": "no-cache",
            },
        )

    match = re.match(r"bytes=(\d*)-(\d*)", range_header)
    if not match:
        raise HTTPException(status_code=416, detail="Invalid Range")

    start_byte = int(match.group(1) or 0)
    end_byte = int(match.group(2) or size - 1)

    if start_byte >= size or start_byte > end_byte:
        raise HTTPException(
            status_code=416,
            detail="Requested range not satisfiable",
            headers={"Content-Range": f"bytes */{size}"},
        )

    end_byte = min(end_byte, size - 1)
    length = end_byte - start_byte + 1

    def iter_range():
        with path.open("rb") as audio:
            audio.seek(start_byte)
            remaining = length
            while remaining:
                chunk = audio.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(
        iter_range(),
        status_code=206,
        media_type=content_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Range": f"bytes {start_byte}-{end_byte}/{size}",
            "Cache-Control": "no-cache",
        },
    )


# ============================================================
# PLAY
# ============================================================

@app.post("/api/tracks/{track_id}/play")
def play_track(
    track_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    track = db.query(Track).filter(
        Track.id == track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    track.plays = (
        track.plays or 0
    ) + 1

    if token:
        try:
            user = get_current_user(
                token,
                db,
            )

            history = History(
                user_id=user.id,
                track_id=track.id,
                listened_at=datetime.now(
                    timezone.utc
                ),
            )

            db.add(history)

        except HTTPException:
            pass

    db.commit()

    return {
        "ok": True,
        "plays": track.plays,
    }


# ============================================================
# SEARCH
# ============================================================

@app.get("/api/search")
def search(
    q: str = Query(""),
    db: Session = Depends(get_db),
):
    q = q.strip()

    if not q:
        return []

    pattern = f"%{q}%"

    rows = (
        db.query(Track)
        .filter(
            or_(
                Track.title.ilike(pattern),
                Track.artist.ilike(pattern),
                Track.album.ilike(pattern),
                Track.genre.ilike(pattern),
            )
        )
        .order_by(
            Track.plays.desc()
        )
        .limit(100)
        .all()
    )

    return [
        track_to_dict(track)
        for track in rows
    ]


# ============================================================
# RECOMMENDATIONS
# ============================================================

@app.get("/api/recommendations")
def recommendations(
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Track)
        .order_by(
            Track.plays.desc()
        )
        .limit(30)
        .all()
    )

    return [
        track_to_dict(track)
        for track in rows
    ]


# ============================================================
# FAVORITES
# ============================================================

@app.get("/api/favorites")
def favorites(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(
        token,
        db,
    )

    rows = (
        db.query(Track)
        .join(
            Like,
            Like.track_id == Track.id,
        )
        .filter(
            Like.user_id == user.id
        )
        .order_by(
            Track.title.asc()
        )
        .all()
    )

    return [
        track_to_dict(
            track,
            liked=True,
        )
        for track in rows
    ]


@app.post("/api/tracks/{track_id}/like")
def toggle_like(
    track_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(
        token,
        db,
    )

    track = db.query(Track).filter(
        Track.id == track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    existing = db.query(Like).filter(
        Like.user_id == user.id,
        Like.track_id == track.id,
    ).first()

    if existing:
        db.delete(existing)
        liked = False
    else:
        db.add(
            Like(
                user_id=user.id,
                track_id=track.id,
            )
        )
        liked = True

    db.commit()

    return {
        "liked": liked,
    }


# ============================================================
# HISTORY
# ============================================================

@app.get("/api/history")
def history(
    token: str = Query(...),
    limit: int = Query(
        100,
        ge=1,
        le=500,
    ),
    db: Session = Depends(get_db),
):
    user = get_current_user(
        token,
        db,
    )

    rows = (
        db.query(History)
        .filter(
            History.user_id == user.id
        )
        .order_by(
            History.listened_at.desc()
        )
        .limit(limit)
        .all()
    )

    result = []

    for item in rows:
        track = db.query(Track).filter(
            Track.id == item.track_id
        ).first()

        if track:
            result.append(
                track_to_dict(track)
            )

    return result


# ============================================================
# PLAYLISTS
# ============================================================

@app.get("/api/playlists")
def playlists(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(
        token,
        db,
    )

    rows = db.query(
        Playlist
    ).filter(
        Playlist.user_id == user.id
    ).all()

    result = []

    for playlist in rows:
        links = (
            db.query(PlaylistTrack)
            .filter(
                PlaylistTrack.playlist_id
                == playlist.id
            )
            .order_by(
                PlaylistTrack.position.asc()
            )
            .all()
        )

        tracks_data = []

        for link in links:
            track = db.query(Track).filter(
                Track.id == link.track_id
            ).first()

            if track:
                tracks_data.append(
                    track_to_dict(track)
                )

        result.append({
            "id": playlist.id,
            "name": playlist.name,
            "tracks": tracks_data,
        })

    return result


@app.post("/api/playlists")
def create_playlist(
    name: str = Form(...),
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(
        token,
        db,
    )

    name = name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Playlist name is required",
        )

    playlist = Playlist(
        user_id=user.id,
        name=name,
    )

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return {
        "id": playlist.id,
        "name": playlist.name,
        "tracks": [],
    }


@app.post(
    "/api/playlists/{playlist_id}/tracks/{track_id}"
)
def add_to_playlist(
    playlist_id: int,
    track_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(
        token,
        db,
    )

    playlist = db.query(
        Playlist
    ).filter(
        Playlist.id == playlist_id,
        Playlist.user_id == user.id,
    ).first()

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    track = db.query(Track).filter(
        Track.id == track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    existing = db.query(
        PlaylistTrack
    ).filter(
        PlaylistTrack.playlist_id
        == playlist.id,
        PlaylistTrack.track_id
        == track.id,
    ).first()

    if existing:
        return {
            "ok": True,
            "message": "Track already in playlist",
        }

    count = db.query(
        PlaylistTrack
    ).filter(
        PlaylistTrack.playlist_id
        == playlist.id
    ).count()

    item = PlaylistTrack(
        playlist_id=playlist.id,
        track_id=track.id,
        position=count,
    )

    db.add(item)
    db.commit()

    return {
        "ok": True,
    }


# ============================================================
# RADIO
# ============================================================

RADIO_STATIONS = [
    {
        "id": "retro-fm",
        "name": "Retro FM",
        "description": "Ретро-хиты",
        "stream": "https://hls-01-retro.emgsound.ru/12/128/playlist.m3u8",
        "type": "hls",
        "cover": "/api/radio/retro-fm/cover",
    },
    {
        "id": "russkoe-radio",
        "name": "Русское Радио",
        "description": "Главное русское радио",
        "stream": "/api/radio/russkoe-radio/stream",
        "type": "mp3",
        "cover": "/api/radio/russkoe-radio/cover",
    },
    {
        "id": "radio-dacha",
        "name": "Радио Дача",
        "description": "Музыка для хорошего настроения",
        "stream": "/api/radio/radio-dacha/stream",
        "type": "mp3",
        "cover": "/api/radio/radio-dacha/cover",
    },
]

RADIO_SOURCE_URLS = {
    "russkoe-radio": "https://rusradio.hostingradio.ru/rusradio128.mp3",
    "radio-dacha": "http://listen13.vdfm.ru:8000/dacha",
}

@app.get("/api/radio")
def radio():
    return RADIO_STATIONS


@app.get("/api/radio/{station_id}/stream")
async def radio_stream(station_id: str):
    source_url = RADIO_SOURCE_URLS.get(station_id)
    if not source_url:
        raise HTTPException(status_code=404, detail="Radio station not found")

    async def proxy():
        timeout = httpx.Timeout(connect=15.0, read=None, write=15.0, pool=15.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            async with client.stream(
                "GET",
                source_url,
                headers={
                    "User-Agent": "FENIX-MUSIC/1.0",
                    "Icy-MetaData": "1",
                },
            ) as response:
                if response.status_code >= 400:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Radio upstream returned {response.status_code}",
                    )
                async for chunk in response.aiter_bytes(1024 * 64):
                    yield chunk

    return StreamingResponse(
        proxy(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache, no-store",
            "Accept-Ranges": "none",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.get("/api/radio/{station_id}/cover")
def radio_cover(station_id: str):
    filename = f"{station_id}.svg"
    path = RADIO_DIR / filename

    if path.exists():
        return FileResponse(path, media_type="image/svg+xml")

    fallback = RADIO_DIR / "retro-fm.svg"
    if fallback.exists():
        return FileResponse(fallback, media_type="image/svg+xml")

    raise HTTPException(status_code=404, detail="Radio cover not found")


# ============================================================
# ADMIN UPLOAD AUDIO
# ============================================================

@app.post("/api/admin/tracks/upload")
async def admin_upload_track(
    title: str = Form(...),
    artist: str = Form(...),
    album: str = Form(""),
    genre: str = Form(""),
    token: str = Query(...),
    audio: UploadFile = File(...),
    cover: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    require_admin(
        token,
        db,
    )

    if not audio.filename:
        raise HTTPException(
            status_code=400,
            detail="Audio filename is required",
        )

    filename = safe_filename(
        audio.filename
    )

    destination = AUDIO_DIR / filename

    if destination.exists():
        destination = (
            AUDIO_DIR
            / f"{secrets.token_hex(4)}_{filename}"
        )

    with destination.open("wb") as output:
        shutil.copyfileobj(
            audio.file,
            output,
        )

    cover_url = None

    if cover and cover.filename:
        cover_filename = safe_filename(
            cover.filename
        )

        cover_path = (
            COVER_DIR / cover_filename
        )

        if cover_path.exists():
            cover_path = (
                COVER_DIR
                / f"{secrets.token_hex(4)}_{cover_filename}"
            )

        with cover_path.open("wb") as output:
            shutil.copyfileobj(
                cover.file,
                output,
            )

        cover_url = (
            "/api/covers/"
            + cover_path.name
        )

    relative_audio = str(
        destination.relative_to(
            BASE_DIR
        )
    ).replace("\\", "/")

    track = Track(
        title=title.strip(),
        artist=artist.strip(),
        album=album.strip(),
        genre=genre.strip(),
        duration=0,
        cover_url=cover_url,
        audio_path=relative_audio,
        plays=0,
    )

    db.add(track)
    db.commit()
    db.refresh(track)

    return track_to_dict(track)


# ============================================================
# COVERS
# ============================================================

@app.get("/api/covers/{filename}")
def get_cover(
    filename: str,
):
    filename = Path(filename).name

    path = COVER_DIR / filename

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Cover not found",
        )

    return FileResponse(
        path
    )


# ============================================================
# TELEGRAM AUTH
# ============================================================

@app.post("/api/auth/telegram/start")
def telegram_auth_start(
    db: Session = Depends(get_db),
):
    token = secrets.token_urlsafe(32)

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=10)
    )

    auth = TelegramAuth(
        token=token,
        telegram_id=None,
        username=None,
        user_id=None,
        expires_at=expires_at,
        used=False,
    )

    db.add(auth)
    db.commit()

    bot_username = os.getenv(
        "TELEGRAM_BOT_USERNAME",
        "FenixMusicRabot",
    ).strip().lstrip("@")

    deep_link = None

    if bot_username:
        deep_link = (
            f"https://t.me/"
            f"{bot_username}"
            f"?start=auth_{token}"
        )

    return {
        "token": token,
        "url": deep_link,
        "expires_at": expires_at.isoformat(),
    }


@app.get("/api/auth/telegram/status")
def telegram_auth_status(
    token: str,
    db: Session = Depends(get_db),
):
    auth = db.query(
        TelegramAuth
    ).filter(
        TelegramAuth.token == token
    ).first()

    if not auth:
        raise HTTPException(
            status_code=404,
            detail="Auth session not found",
        )

    if auth.expires_at:
        expires = auth.expires_at

        if expires.tzinfo is None:
            expires = expires.replace(
                tzinfo=timezone.utc
            )

        if datetime.now(timezone.utc) > expires:
            return {
                "status": "expired"
            }

    if not auth.user_id:
        return {
            "status": "pending"
        }

    user = db.query(User).filter(
        User.id == auth.user_id
    ).first()

    if not user:
        return {
            "status": "pending"
        }

    jwt_token = create_access_token(
        user.id,
        user.email,
        user.is_admin,
    )

    auth.used = True
    db.commit()

    return {
        "status": "authorized",
        "token": jwt_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "is_admin": user.is_admin,
        },
    }


# ============================================================
# FRONTEND
# ============================================================

if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"

    if assets_dir.exists():
        app.mount(
            "/assets",
            StaticFiles(
                directory=str(assets_dir)
            ),
            name="assets",
        )


@app.get(
    "/",
    include_in_schema=False,
)
def frontend_index():
    index = FRONTEND_DIST / "index.html"

    if index.exists():
        return FileResponse(index)

    return {
        "message": "FENIX MUSIC API",
        "frontend": "Build frontend first",
    }


@app.get(
    "/{full_path:path}",
    include_in_schema=False,
)
def frontend_fallback(
    full_path: str,
):
    if full_path.startswith("api/"):
        raise HTTPException(
            status_code=404,
            detail="API endpoint not found",
        )

    requested = FRONTEND_DIST / full_path

    if requested.exists() and requested.is_file():
        return FileResponse(requested)

    index = FRONTEND_DIST / "index.html"

    if index.exists():
        return FileResponse(index)

    raise HTTPException(
        status_code=404,
        detail="Not found",
    )
