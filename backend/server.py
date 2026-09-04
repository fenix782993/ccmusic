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
    inspect,
    text,
)
from sqlalchemy.orm import Session

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
    Artist, Album, Genre, Subscription, Notification, QueueItem, ArtistFollow, UserFollow, PlaylistLike, SearchHistory, Achievement, UserAchievement,
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


def ensure_schema():
    """Safely add columns missing from an older PostgreSQL/SQLite database."""
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())

        if "history" in tables:
            columns = {c["name"] for c in inspector.get_columns("history")}
            if "listened_at" not in columns:
                with engine.begin() as conn:
                    conn.execute(text(
                        "ALTER TABLE history ADD COLUMN listened_at TIMESTAMP WITH TIME ZONE"
                        if engine.dialect.name == "postgresql"
                        else "ALTER TABLE history ADD COLUMN listened_at DATETIME"
                    ))
                print("Database migration: added history.listened_at")
    except Exception as exc:
        print(f"Database schema check warning: {exc}")


ensure_schema()


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
    path = resolve_path(track.audio_path)
    available = bool(path and path.exists() and path.is_file())
    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist or "Unknown Artist",
        "album": track.album or "",
        "genre": track.genre or "",
        "duration": track.duration or 0,
        "cover_url": track.cover_url,
        "audio_path": track.audio_path,
        "audio_url": f"/api/tracks/{track.id}/stream" if available else None,
        "file_available": available,
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

@app.on_event("startup")
def startup():
    print("Starting FENIX MUSIC...")

    seed_admin()

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

    result = []
    for track in rows:
        item = track_to_dict(track)
        if item["file_available"]:
            result.append(item)
    return result


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
    if not path or not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")

    size = path.stat().st_size
    content_types = {
        ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
        ".flac": "audio/flac", ".m4a": "audio/mp4", ".aac": "audio/aac",
        ".webm": "audio/webm", ".opus": "audio/ogg",
    }
    content_type = content_types.get(path.suffix.lower(), "application/octet-stream")
    range_header = request.headers.get("range")

    common = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
    }

    if not range_header:
        def iterator():
            with path.open("rb") as audio:
                while chunk := audio.read(1024 * 1024):
                    yield chunk
        common["Content-Length"] = str(size)
        return StreamingResponse(iterator(), media_type=content_type, headers=common)

    match = re.match(r"bytes=(\d*)-(\d*)", range_header.strip())
    if not match:
        raise HTTPException(status_code=416, detail="Invalid Range")

    start_byte = int(match.group(1) or 0)
    end_byte = int(match.group(2) or size - 1)
    if start_byte >= size or start_byte > end_byte:
        raise HTTPException(status_code=416, detail="Requested range not satisfiable")

    end_byte = min(end_byte, size - 1)
    length = end_byte - start_byte + 1

    def iterator_range():
        with path.open("rb") as audio:
            audio.seek(start_byte)
            remaining = length
            while remaining:
                chunk = audio.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    common["Content-Length"] = str(length)
    common["Content-Range"] = f"bytes {start_byte}-{end_byte}/{size}"
    return StreamingResponse(iterator_range(), status_code=206, media_type=content_type, headers=common)


# ============================================================
# PLAY
# ============================================================

@app.post("/api/tracks/{track_id}/play")
def play_track(
    track_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    track.plays = (track.plays or 0) + 1

    if token:
        try:
            user = get_current_user(token, db)
            db.add(History(user_id=user.id, track_id=track.id, listened_at=datetime.now(timezone.utc)))
        except HTTPException:
            pass

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        # Playback must never fail just because history is incompatible.
        print(f"History write warning: {exc}")
        try:
            track = db.query(Track).filter(Track.id == track_id).first()
            if track:
                track.plays = (track.plays or 0) + 1
                db.commit()
        except Exception:
            db.rollback()

    return {"ok": True, "plays": track.plays if track else 0}


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
        "cover": "/api/radio/retro-fm/cover",
    },
    {
        "id": "russkoe-radio",
        "name": "Русское Радио",
        "description": "Главное русское радио",
        "stream": "https://rusradio.hostingradio.ru/rusradio128.mp3",
        "cover": "/api/radio/russkoe-radio/cover",
    },
    {
        "id": "radio-dacha",
        "name": "Радио Дача",
        "description": "Музыка для хорошего настроения",
        "stream": "http://listen13.vdfm.ru:8000/dacha",
        "cover": "/api/radio/radio-dacha/cover",
    },
]


@app.get("/api/radio")
def radio():
    return RADIO_STATIONS


@app.get("/api/radio/{station_id}/cover")
def radio_cover(
    station_id: str,
):
    filename = (
        f"{station_id}.svg"
    )

    path = RADIO_DIR / filename

    if path.exists():
        return FileResponse(
            path,
            media_type="image/svg+xml",
        )

    return FileResponse(
        RADIO_DIR / "retro-fm.svg",
        media_type="image/svg+xml",
    )


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
        "",
    ).lstrip("@")

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
# FULL FENIX MUSIC API
# ============================================================
def _clean_track(db,t):
    return track_to_dict(t) if 'track_to_dict' in globals() else {"id":t.id,"title":t.title,"artist":t.artist,"album":t.album,"genre":t.genre,"duration":t.duration,"cover_url":t.cover_url,"audio_url":f"/api/tracks/{t.id}/stream","plays":t.plays,"lyrics":t.lyrics}
def _seed_catalog_entities(db):
    names={x[0] for x in db.query(Artist.name).all()}; albums={(x.title,x.artist) for x in db.query(Album).all()}; genres={x[0] for x in db.query(Genre.name).all()}
    for t in db.query(Track).all():
        if t.artist and t.artist not in names: db.add(Artist(name=t.artist)); names.add(t.artist)
        if t.album and (t.album,t.artist) not in albums: db.add(Album(title=t.album,artist=t.artist,cover_url=t.cover_url)); albums.add((t.album,t.artist))
        if t.genre and t.genre not in genres: db.add(Genre(name=t.genre)); genres.add(t.genre)
    db.commit()
@app.get("/api/new")
def api_new(db:Session=Depends(get_db)):
    return [_clean_track(db,t) for t in db.query(Track).order_by(Track.created_at.desc()).limit(50).all() if Path(t.audio_path).exists()]
@app.get("/api/popular")
def api_popular(db:Session=Depends(get_db)):
    return [_clean_track(db,t) for t in db.query(Track).order_by(Track.plays.desc(),Track.created_at.desc()).limit(50).all() if Path(t.audio_path).exists()]
@app.get("/api/artists")
def api_artists(db:Session=Depends(get_db)):
    _seed_catalog_entities(db); return [{"id":a.id,"name":a.name,"avatar_url":a.avatar_url,"bio":a.bio,"followers":a.followers} for a in db.query(Artist).order_by(Artist.name).all()]
@app.get("/api/artists/{artist_id}")
def api_artist(artist_id:int,db:Session=Depends(get_db)):
    a=db.get(Artist,artist_id)
    if not a: raise HTTPException(404,"Артист не найден")
    ts=db.query(Track).filter(Track.artist==a.name).order_by(Track.plays.desc()).all()
    return {"id":a.id,"name":a.name,"avatar_url":a.avatar_url,"bio":a.bio,"followers":a.followers,"tracks":[_clean_track(db,t) for t in ts if Path(t.audio_path).exists()]}
@app.get("/api/albums")
def api_albums(db:Session=Depends(get_db)):
    _seed_catalog_entities(db); return [{"id":a.id,"title":a.title,"artist":a.artist,"year":a.year,"cover_url":a.cover_url} for a in db.query(Album).order_by(Album.created_at.desc()).all()]
@app.get("/api/albums/{album_id}")
def api_album(album_id:int,db:Session=Depends(get_db)):
    a=db.get(Album,album_id)
    if not a: raise HTTPException(404,"Альбом не найден")
    ts=db.query(Track).filter(Track.album==a.title,Track.artist==a.artist).order_by(Track.id).all()
    return {"id":a.id,"title":a.title,"artist":a.artist,"year":a.year,"cover_url":a.cover_url,"tracks":[_clean_track(db,t) for t in ts if Path(t.audio_path).exists()]}
@app.get("/api/genres")
def api_genres(db:Session=Depends(get_db)):
    _seed_catalog_entities(db); return [{"id":g.id,"name":g.name,"tracks":db.query(Track).filter(Track.genre==g.name).count()} for g in db.query(Genre).order_by(Genre.name).all()]
@app.get("/api/mixes")
def api_mixes(db:Session=Depends(get_db)):
    ts=[t for t in db.query(Track).order_by(Track.plays.desc(),Track.created_at.desc()).all() if Path(t.audio_path).exists()]
    mixes=[{"id":"daily","title":"Микс дня","description":"Лучшее из каталога","track_ids":[t.id for t in ts[:30]]},{"id":"popular","title":"Популярное","description":"Самые прослушиваемые","track_ids":[t.id for t in ts[:30]]},{"id":"night","title":"Ночной микс","description":"Музыка для ночи","track_ids":[t.id for t in ts[::2][:30]]}]
    by={}
    for t in ts: by.setdefault(t.genre or "Mix",[]).append(t)
    for g,arr in list(by.items())[:15]: mixes.append({"id":"genre-"+str(abs(hash(g))),"title":g,"description":"Микс по жанру","track_ids":[t.id for t in arr[:30]]})
    return mixes
@app.get("/api/mixes/{mix_id}")
def api_mix(mix_id:str,db:Session=Depends(get_db)):
    m=next((x for x in api_mixes(db) if x["id"]==mix_id),None)
    if not m: raise HTTPException(404,"Микс не найден")
    return {**m,"tracks":[_clean_track(db,db.get(Track,i)) for i in m["track_ids"] if db.get(Track,i) and Path(db.get(Track,i).audio_path).exists()]}
@app.get("/api/queue")
def api_queue(db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid:return []
    rows=db.query(QueueItem).filter_by(user_id=uid).order_by(QueueItem.position).all(); out=[]
    for r in rows:
        t=db.get(Track,r.track_id)
        if t and Path(t.audio_path).exists(): out.append(_clean_track(db,t))
    return out
@app.post("/api/queue")
def api_queue_save(payload:dict,db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid: raise HTTPException(401,"Требуется авторизация")
    db.query(QueueItem).filter_by(user_id=uid).delete()
    for pos,tid in enumerate(payload.get("track_ids",[])):
        if db.get(Track,int(tid)): db.add(QueueItem(user_id=uid,track_id=int(tid),position=pos))
    db.commit(); return {"ok":True}
@app.get("/api/subscription")
def api_subscription(db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid:return {"plan":"FREE","active":False}
    s=db.query(Subscription).filter_by(user_id=uid).first(); return {"plan":s.plan if s else "FREE","active":bool(s and s.active),"expires_at":s.expires_at.isoformat() if s and s.expires_at else None}
@app.post("/api/subscription")
def api_subscription_update(payload:dict,db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid: raise HTTPException(401,"Требуется авторизация")
    plan=str(payload.get("plan","PREMIUM")).upper()
    if plan not in {"FREE","PREMIUM","PREMIUM+"}: raise HTTPException(400,"Неверный тариф")
    s=db.query(Subscription).filter_by(user_id=uid).first()
    if not s:s=Subscription(user_id=uid);db.add(s)
    s.plan=plan;s.active=plan!="FREE";s.expires_at=datetime.now(timezone.utc)+timedelta(days=30) if s.active else None;db.commit();return {"plan":s.plan,"active":s.active,"expires_at":s.expires_at.isoformat() if s.expires_at else None}
@app.get("/api/notifications")
def api_notifications(db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid:return []
    return [{"id":n.id,"title":n.title,"body":n.body,"read":n.read,"created_at":n.created_at.isoformat()} for n in db.query(Notification).filter_by(user_id=uid).order_by(Notification.created_at.desc()).limit(100).all()]
@app.post("/api/notifications/read")
def api_notifications_read(db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid:raise HTTPException(401,"Требуется авторизация")
    db.query(Notification).filter_by(user_id=uid).update({"read":True});db.commit();return {"ok":True}
@app.get("/api/stats")
def api_full_stats(db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token); total_tracks=db.query(Track).count(); total_plays=db.query(func.coalesce(func.sum(Track.plays),0)).scalar() or 0
    if not uid:return {"tracks":total_tracks,"plays":total_plays,"hours":0,"artists":0,"albums":0,"level":1,"xp":0,"streak":0}
    h=db.query(History).filter_by(user_id=uid).all();likes=db.query(Like).filter_by(user_id=uid).count();xp=len(h)*10+likes*5
    arts={db.get(Track,x.track_id).artist for x in h if db.get(Track,x.track_id)}; albs={db.get(Track,x.track_id).album for x in h if db.get(Track,x.track_id)}
    return {"tracks":total_tracks,"plays":total_plays,"hours":round(len(h)*3.5/60,2),"artists":len(arts),"albums":len(albs),"level":max(1,xp//500+1),"xp":xp,"streak":min(365,len(h))}
@app.get("/api/achievements")
def api_achievements(db:Session=Depends(get_db),token:str=Query("")):
    defaults=[("first","Первый трек","Прослушай первый трек",50),("hundred","100 треков","Прослушай 100 треков",250),("thousand","1000 треков","Прослушай 1000 треков",1000),("night","Ночной слушатель","Слушай ночью",100),("collector","Коллекционер","Добавь 25 треков в избранное",300)]
    for code,title,desc,xp in defaults:
        if not db.query(Achievement).filter_by(code=code).first():db.add(Achievement(code=code,title=title,description=desc,xp=xp))
    db.commit();uid=get_user_id_from_token(token);unlocked={x.achievement_id for x in db.query(UserAchievement).filter_by(user_id=uid).all()} if uid else set()
    return [{"id":a.id,"code":a.code,"title":a.title,"description":a.description,"xp":a.xp,"unlocked":a.id in unlocked} for a in db.query(Achievement).order_by(Achievement.id).all()]
@app.get("/api/search/history")
def api_search_history(db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid:return []
    return [x.query for x in db.query(SearchHistory).filter_by(user_id=uid).order_by(SearchHistory.created_at.desc()).limit(20).all()]
@app.post("/api/search/history")
def api_search_history_add(payload:dict,db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token);q=str(payload.get("query","")).strip()
    if uid and q:db.add(SearchHistory(user_id=uid,query=q));db.commit()
    return {"ok":bool(uid and q)}
@app.post("/api/artists/{artist_id}/follow")
def api_follow_artist(artist_id:int,db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid:raise HTTPException(401,"Требуется авторизация")
    a=db.get(Artist,artist_id)
    if not a:raise HTTPException(404,"Артист не найден")
    r=db.query(ArtistFollow).filter_by(user_id=uid,artist_id=artist_id).first()
    if r:db.delete(r);a.followers=max(0,a.followers-1);followed=False
    else:db.add(ArtistFollow(user_id=uid,artist_id=artist_id));a.followers+=1;followed=True
    db.commit();return {"followed":followed,"followers":a.followers}
@app.get("/api/social/friends")
def api_friends(db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid:return []
    return [{"id":u.id,"username":u.username,"avatar_url":u.avatar_url} for r in db.query(UserFollow).filter_by(follower_id=uid).all() if (u:=db.get(User,r.following_id))]
@app.post("/api/social/follow/{user_id}")
def api_follow_user(user_id:int,db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token)
    if not uid:raise HTTPException(401,"Требуется авторизация")
    if uid==user_id:raise HTTPException(400,"Нельзя подписаться на себя")
    if not db.get(User,user_id):raise HTTPException(404,"Пользователь не найден")
    r=db.query(UserFollow).filter_by(follower_id=uid,following_id=user_id).first()
    if r:db.delete(r);followed=False
    else:db.add(UserFollow(follower_id=uid,following_id=user_id));followed=True
    db.commit();return {"followed":followed}
@app.get("/api/profile/public/{user_id}")
def api_public_profile(user_id:int,db:Session=Depends(get_db)):
    u=db.get(User,user_id)
    if not u:raise HTTPException(404,"Пользователь не найден")
    return {"id":u.id,"username":u.username,"avatar_url":u.avatar_url,"created_at":u.created_at.isoformat() if u.created_at else None}
@app.get("/api/admin/stats")
def api_admin_stats(db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token);u=db.get(User,uid) if uid else None
    if not u or not u.is_admin:raise HTTPException(403,"Только администратор")
    return {"users":db.query(User).count(),"tracks":db.query(Track).count(),"plays":db.query(func.coalesce(func.sum(Track.plays),0)).scalar() or 0,"likes":db.query(Like).count(),"playlists":db.query(Playlist).count(),"premium":db.query(Subscription).filter(Subscription.plan!="FREE",Subscription.active==True).count()}
@app.delete("/api/admin/tracks/{track_id}")
def api_admin_delete_track(track_id:int,db:Session=Depends(get_db),token:str=Query("")):
    uid=get_user_id_from_token(token);u=db.get(User,uid) if uid else None
    if not u or not u.is_admin:raise HTTPException(403,"Только администратор")
    t=db.get(Track,track_id)
    if not t:raise HTTPException(404,"Трек не найден")
    p=Path(t.audio_path);db.delete(t);db.commit()
    try:p.unlink(missing_ok=True)
    except Exception:pass
    return {"ok":True}
@app.get("/api/download/{track_id}")
def api_download(track_id:int,db:Session=Depends(get_db),token:str=Query("")):
    if not get_user_id_from_token(token):raise HTTPException(401,"Требуется авторизация")
    t=db.get(Track,track_id)
    if not t or not Path(t.audio_path).exists():raise HTTPException(404,"Файл не найден")
    return FileResponse(t.audio_path,filename=Path(t.audio_path).name,media_type="application/octet-stream")


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

    source_index = FRONTEND_DIR / "index.html"
    if source_index.exists():
        return FileResponse(source_index)
    return {"message": "FENIX MUSIC API", "frontend": "Build frontend first"}


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

    source_index = FRONTEND_DIR / "index.html"
    if source_index.exists():
        return FileResponse(source_index)

    raise HTTPException(status_code=404, detail="Not found")
