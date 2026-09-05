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
    Response,
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
    Artist, Album, Genre, ArtistFollow, UserFollow, Dislike, Subscription,
    ListeningProgress, Notification, Achievement, UserAchievement, Comment,
    Mix, MixTrack, Presence, ArtistRelease,
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

        if "playlists" in tables:
            columns = {c["name"] for c in inspector.get_columns("playlists")}
            additions = []
            if "description" not in columns: additions.append(("description", "TEXT" if engine.dialect.name == "postgresql" else "TEXT"))
            if "is_public" not in columns: additions.append(("is_public", "BOOLEAN DEFAULT FALSE" if engine.dialect.name == "postgresql" else "INTEGER DEFAULT 0"))
            if additions:
                with engine.begin() as conn:
                    for name, typ in additions:
                        conn.execute(text(f"ALTER TABLE playlists ADD COLUMN {name} {typ}"))
                print("Database migration: updated playlists schema")
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

            if ADMIN_USERNAME and admin.username != ADMIN_USERNAME:
                username_owner = db.query(User).filter(
                    func.lower(User.username) == ADMIN_USERNAME.lower(),
                    User.id != admin.id,
                ).first()
                if not username_owner:
                    admin.username = ADMIN_USERNAME
                    changed = True
                else:
                    print(f"Admin username {ADMIN_USERNAME!r} already belongs to another user; keeping {admin.username!r}")

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

        chosen_username = ADMIN_USERNAME or "FenixAdmin"
        if db.query(User).filter(func.lower(User.username) == chosen_username.lower()).first():
            base_username = chosen_username
            n = 2
            while db.query(User).filter(func.lower(User.username) == f"{base_username}_{n}".lower()).first():
                n += 1
            chosen_username = f"{base_username}_{n}"
            print(f"Admin username occupied; using {chosen_username}")

        admin = User(
            email=email,
            password_hash=hash_password(ADMIN_PASSWORD),
            username=chosen_username,
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



def sync_catalog_metadata(db: Session):
    """Create artist/album/genre catalog records from existing tracks."""
    for t in db.query(Track).all():
        artist=(t.artist or "Unknown Artist").strip()
        if artist and not db.query(Artist).filter(func.lower(Artist.name)==artist.lower()).first():
            db.add(Artist(name=artist))
        album=(t.album or "Single").strip()
        if album and not db.query(Album).filter(func.lower(Album.title)==album.lower(),func.lower(Album.artist)==artist.lower()).first():
            db.add(Album(title=album,artist=artist,cover_url=t.cover_url))
        genre=(t.genre or "").strip()
        if genre and not db.query(Genre).filter(func.lower(Genre.name)==genre.lower()).first():
            db.add(Genre(name=genre))
    db.commit()

# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    print("Starting FENIX MUSIC...")

    seed_admin()

    scan_music()
    db = SessionLocal()
    try:
        sync_catalog_metadata(db)
    except Exception as exc:
        db.rollback()
        print(f"Metadata sync warning: {exc}")
    finally:
        db.close()

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
    audio: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    cover: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    require_admin(
        token,
        db,
    )

    audio = audio or file
    if not audio or not audio.filename:
        raise HTTPException(status_code=400, detail="Audio file is required")

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
    sync_catalog_metadata(db)

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
# FULL FENIX FEATURES API
# ============================================================

def _user_required(token, db):
    return get_current_user(token, db)

def _json_user(u):
    return {"id":u.id,"email":u.email,"username":u.username,"avatar_url":u.avatar_url,"is_admin":u.is_admin}

def _track_list(db, rows):
    liked_ids=set()
    for x in rows: pass
    return [track_to_dict(x) for x in rows if track_to_dict(x)["file_available"]]

@app.get("/api/meta")
def meta_catalog(db: Session = Depends(get_db)):
    artists=[{"id":x.id,"name":x.name,"avatar_url":x.avatar_url,"verified":x.verified} for x in db.query(Artist).order_by(Artist.name).all()]
    albums=[{"id":x.id,"title":x.title,"artist":x.artist,"year":x.year,"cover_url":x.cover_url} for x in db.query(Album).order_by(Album.title).all()]
    genres=[{"id":x.id,"name":x.name} for x in db.query(Genre).order_by(Genre.name).all()]
    if not artists:
        names=sorted({(t.artist or "Unknown Artist").strip() for t in db.query(Track).all() if t.artist})
        artists=[{"id":None,"name":n,"avatar_url":None,"verified":False} for n in names]
    if not albums:
        seen=set(); albums=[]
        for t in db.query(Track).order_by(Track.album).all():
            key=(t.album or "Single",t.artist or "Unknown Artist")
            if key in seen: continue
            seen.add(key); albums.append({"id":None,"title":key[0],"artist":key[1],"year":None,"cover_url":t.cover_url})
    if not genres:
        names=sorted({(t.genre or "Без жанра").strip() for t in db.query(Track).all() if (t.genre or "").strip()})
        genres=[{"id":None,"name":n} for n in names]
    return {"artists":artists,"albums":albums,"genres":genres}

@app.get("/api/artist/{name}")
def artist_page(name: str, db: Session = Depends(get_db)):
    tracks_rows=db.query(Track).filter(func.lower(Track.artist)==name.lower()).order_by(Track.plays.desc()).all()
    if not tracks_rows: raise HTTPException(404,"Artist not found")
    return {"name":tracks_rows[0].artist,"tracks":[track_to_dict(t) for t in tracks_rows if resolve_path(t.audio_path) and resolve_path(t.audio_path).exists()],"albums":sorted({t.album for t in tracks_rows if t.album})}

@app.get("/api/album")
def album_page(title: str, artist: str, db: Session = Depends(get_db)):
    rows=db.query(Track).filter(func.lower(Track.album)==title.lower(),func.lower(Track.artist)==artist.lower()).order_by(Track.created_at.asc()).all()
    return {"title":title,"artist":artist,"tracks":[track_to_dict(t) for t in rows if resolve_path(t.audio_path) and resolve_path(t.audio_path).exists()]}

@app.get("/api/genres/{genre}/tracks")
def genre_tracks(genre: str, db: Session = Depends(get_db)):
    rows=db.query(Track).filter(func.lower(Track.genre)==genre.lower()).order_by(Track.plays.desc()).limit(100).all()
    return [track_to_dict(t) for t in rows if resolve_path(t.audio_path) and resolve_path(t.audio_path).exists()]

@app.post("/api/tracks/{track_id}/dislike")
def dislike_track(track_id:int, token:str=Query(...), db:Session=Depends(get_db)):
    u=_user_required(token,db); t=db.query(Track).filter(Track.id==track_id).first()
    if not t: raise HTTPException(404,"Track not found")
    existing=db.query(Dislike).filter_by(user_id=u.id,track_id=t.id).first()
    if existing: db.delete(existing); value=False
    else:
        old=db.query(Like).filter_by(user_id=u.id,track_id=t.id).first()
        if old: db.delete(old)
        db.add(Dislike(user_id=u.id,track_id=t.id)); value=True
    db.commit(); return {"disliked":value}

@app.post("/api/progress/{track_id}")
def save_progress(track_id:int, seconds:float=Form(...), token:str=Query(...), db:Session=Depends(get_db)):
    u=_user_required(token,db); row=db.query(ListeningProgress).filter_by(user_id=u.id,track_id=track_id).first()
    if not row: row=ListeningProgress(user_id=u.id,track_id=track_id); db.add(row)
    row.seconds=max(0,float(seconds)); row.updated_at=datetime.now(timezone.utc); db.commit(); return {"ok":True}

@app.get("/api/progress/{track_id}")
def get_progress(track_id:int, token:str=Query(...), db:Session=Depends(get_db)):
    u=_user_required(token,db); row=db.query(ListeningProgress).filter_by(user_id=u.id,track_id=track_id).first(); return {"seconds":row.seconds if row else 0}

@app.post("/api/follows/artist/{artist_name}")
def follow_artist(artist_name:str, token:str=Query(...), db:Session=Depends(get_db)):
    u=_user_required(token,db); a=db.query(Artist).filter(func.lower(Artist.name)==artist_name.lower()).first()
    if not a:
        a=Artist(name=artist_name.strip()); db.add(a); db.flush()
    row=db.query(ArtistFollow).filter_by(user_id=u.id,artist_id=a.id).first()
    if row: db.delete(row); followed=False
    else: db.add(ArtistFollow(user_id=u.id,artist_id=a.id)); followed=True
    db.commit(); return {"followed":followed}

@app.get("/api/follows/artists")
def followed_artists(token:str=Query(...),db:Session=Depends(get_db)):
    u=_user_required(token,db); return [{"id":a.id,"name":a.name,"verified":a.verified} for a in db.query(Artist).join(ArtistFollow,ArtistFollow.artist_id==Artist.id).filter(ArtistFollow.user_id==u.id).all()]

@app.post("/api/follows/user/{user_id}")
def follow_user(user_id:int, token:str=Query(...), db:Session=Depends(get_db)):
    u=_user_required(token,db)
    if u.id==user_id: raise HTTPException(400,"Cannot follow yourself")
    target=db.query(User).filter(User.id==user_id).first()
    if not target: raise HTTPException(404,"User not found")
    row=db.query(UserFollow).filter_by(follower_id=u.id,following_id=target.id).first()
    if row: db.delete(row); followed=False
    else: db.add(UserFollow(follower_id=u.id,following_id=target.id)); followed=True
    db.commit(); return {"followed":followed}

@app.get("/api/social")
def social(token:str=Query(...),db:Session=Depends(get_db)):
    u=_user_required(token,db)
    following=[x.following_id for x in db.query(UserFollow).filter_by(follower_id=u.id).all()]
    followers=[x.follower_id for x in db.query(UserFollow).filter_by(following_id=u.id).all()]
    presence=db.query(Presence).filter(Presence.is_listening==True,Presence.updated_at>=datetime.now(timezone.utc)-timedelta(minutes=10)).all()
    live=[]
    for p in presence:
        usr=db.query(User).filter(User.id==p.user_id).first(); tr=db.query(Track).filter(Track.id==p.track_id).first() if p.track_id else None
        if usr: live.append({"user":_json_user(usr),"track":track_to_dict(tr) if tr else None})
    return {"following":following,"followers":followers,"currently_listening":live}

@app.post("/api/presence")
def presence(track_id:Optional[int]=Form(None), listening:bool=Form(True), token:str=Query(...), db:Session=Depends(get_db)):
    u=_user_required(token,db); row=db.query(Presence).filter_by(user_id=u.id).first()
    if not row: row=Presence(user_id=u.id); db.add(row)
    row.track_id=track_id; row.is_listening=bool(listening); row.updated_at=datetime.now(timezone.utc); db.commit(); return {"ok":True}

@app.get("/api/notifications")
def notifications(token:str=Query(...),db:Session=Depends(get_db)):
    u=_user_required(token,db); rows=db.query(Notification).filter_by(user_id=u.id).order_by(Notification.created_at.desc()).limit(100).all()
    return [{"id":x.id,"title":x.title,"body":x.body,"kind":x.kind,"is_read":x.is_read,"created_at":x.created_at.isoformat()} for x in rows]

@app.post("/api/notifications/{notification_id}/read")
def notification_read(notification_id:int,token:str=Query(...),db:Session=Depends(get_db)):
    u=_user_required(token,db); x=db.query(Notification).filter_by(id=notification_id,user_id=u.id).first()
    if not x: raise HTTPException(404,"Notification not found")
    x.is_read=True; db.commit(); return {"ok":True}

@app.get("/api/subscription")
def subscription(token:str=Query(...),db:Session=Depends(get_db)):
    u=_user_required(token,db); x=db.query(Subscription).filter_by(user_id=u.id).first()
    if not x: x=Subscription(user_id=u.id,plan="FREE",active=True); db.add(x); db.commit(); db.refresh(x)
    return {"plan":x.plan,"active":x.active,"expires_at":x.expires_at.isoformat() if x.expires_at else None}

@app.post("/api/subscription/demo")
def demo_subscription(plan:str=Form("PREMIUM"),token:str=Query(...),db:Session=Depends(get_db)):
    u=_user_required(token,db); plan=plan.upper()
    if plan not in {"FREE","PREMIUM","PREMIUM+"}: raise HTTPException(400,"Unknown plan")
    x=db.query(Subscription).filter_by(user_id=u.id).first()
    if not x: x=Subscription(user_id=u.id); db.add(x)
    x.plan=plan; x.active=True; x.expires_at=datetime.now(timezone.utc)+timedelta(days=30) if plan!="FREE" else None; db.commit(); return {"plan":x.plan,"active":x.active}

@app.get("/api/achievements")
def achievements(token:str=Query(...),db:Session=Depends(get_db)):
    u=_user_required(token,db)
    defaults=[("first_play","Первое прослушивание","Запусти первый трек",10),("ten_plays","10 треков","Прослушай 10 треков",50),("collector","Коллекционер","Добавь 10 треков в избранное",100),("night_owl","Ночной слушатель","Слушай музыку после полуночи",25)]
    for code,title,desc,xp in defaults:
        if not db.query(Achievement).filter_by(code=code).first(): db.add(Achievement(code=code,title=title,description=desc,xp=xp))
    db.commit()
    rows=db.query(Achievement).all(); earned={x.achievement_id for x in db.query(UserAchievement).filter_by(user_id=u.id).all()}
    return [{"code":x.code,"title":x.title,"description":x.description,"xp":x.xp,"earned":x.id in earned} for x in rows]

@app.get("/api/stats/full")
def stats_full(token:str=Query(...),db:Session=Depends(get_db)):
    u=_user_required(token,db); histories=db.query(History).filter_by(user_id=u.id).all(); likes=db.query(Like).filter_by(user_id=u.id).count()
    counts={}
    for h in histories:
        t=db.query(Track).filter(Track.id==h.track_id).first()
        if t: counts[t.artist]=counts.get(t.artist,0)+1
    top_artist=max(counts,key=counts.get) if counts else "—"
    total_seconds=sum((db.query(Track).filter(Track.id==h.track_id).first().duration or 0) for h in histories)
    return {"tracks":len(histories),"likes":likes,"hours":round(total_seconds/3600,2),"top_artist":top_artist,"top_genre":(db.query(Track).filter(Track.id.in_([h.track_id for h in histories])).order_by(Track.plays.desc()).first().genre if histories else "—")}

@app.post("/api/comments/{track_id}")
def add_comment(track_id:int,text_value:str=Form(...),token:str=Query(...),db:Session=Depends(get_db)):
    u=_user_required(token,db); text_value=text_value.strip()
    if not text_value or len(text_value)>2000: raise HTTPException(400,"Invalid comment")
    c=Comment(user_id=u.id,track_id=track_id,text=text_value); db.add(c); db.commit(); db.refresh(c); return {"id":c.id,"text":c.text,"username":u.username,"created_at":c.created_at.isoformat()}

@app.get("/api/comments/{track_id}")
def list_comments(track_id:int,db:Session=Depends(get_db)):
    rows=db.query(Comment).filter_by(track_id=track_id).order_by(Comment.created_at.desc()).limit(100).all(); out=[]
    for c in rows:
        u=db.query(User).filter(User.id==c.user_id).first(); out.append({"id":c.id,"text":c.text,"username":u.username if u else "User","created_at":c.created_at.isoformat()})
    return out

@app.get("/api/mixes")
def mixes(db:Session=Depends(get_db)):
    rows=db.query(Mix).order_by(Mix.name).all()
    if not rows:
        defaults=[("FENIX POP","Хиты и свежие поп-треки","energy"),("FENIX ROCK","Гитары и мощный звук","energy"),("FENIX HIP-HOP","Ритм и бас","energy"),("FENIX CHILL","Спокойный поток","calm"),("FENIX NIGHT","Ночная атмосфера","night"),("FENIX MIX","Всё вперемешку","mix")]
        for n,d,m in defaults: db.add(Mix(name=n,description=d,mood=m))
        db.commit(); rows=db.query(Mix).all()
    return [{"id":x.id,"name":x.name,"description":x.description,"mood":x.mood,"cover_url":x.cover_url} for x in rows]

@app.get("/api/mixes/{mix_id}/tracks")
def mix_tracks(mix_id:int,db:Session=Depends(get_db)):
    links=db.query(MixTrack).filter_by(mix_id=mix_id).order_by(MixTrack.position).all(); out=[]
    for x in links:
        t=db.query(Track).filter(Track.id==x.track_id).first()
        if t and resolve_path(t.audio_path) and resolve_path(t.audio_path).exists(): out.append(track_to_dict(t))
    if not out:
        mix=db.query(Mix).filter_by(id=mix_id).first(); q=db.query(Track)
        if mix and mix.mood and mix.mood not in {"mix","energy"}: q=q.filter(func.lower(Track.genre).contains(mix.mood.lower()))
        out=[track_to_dict(t) for t in q.order_by(Track.plays.desc()).limit(50).all() if resolve_path(t.audio_path) and resolve_path(t.audio_path).exists()]
    return out

@app.post("/api/ai")
def fenix_ai(prompt:str=Form(...),token:Optional[str]=Query(None),db:Session=Depends(get_db)):
    q=prompt.strip().lower(); rows=db.query(Track).order_by(Track.plays.desc()).limit(200).all()
    words=[w for w in re.findall(r"[a-zа-яё0-9]+",q) if len(w)>2]
    def score(t):
        textv=f"{t.title} {t.artist} {t.album} {t.genre}".lower(); return sum(3 for w in words if w in textv)+int(t.plays or 0)/100000
    rows=sorted([t for t in rows if resolve_path(t.audio_path) and resolve_path(t.audio_path).exists()],key=score,reverse=True)[:30]
    if not rows: rows=[t for t in db.query(Track).order_by(Track.plays.desc()).limit(20).all() if resolve_path(t.audio_path) and resolve_path(t.audio_path).exists()]
    return {"message":"Я подобрал музыку по твоему запросу.","query":prompt,"tracks":[track_to_dict(t) for t in rows]}

@app.get("/api/admin/dashboard")
def admin_dashboard(token:str=Query(...),db:Session=Depends(get_db)):
    require_admin(token,db)
    now=datetime.now(timezone.utc)
    return {"users":db.query(User).count(),"tracks":db.query(Track).count(),"available_tracks":sum(1 for t in db.query(Track).all() if resolve_path(t.audio_path) and resolve_path(t.audio_path).exists()),"plays":sum((t.plays or 0) for t in db.query(Track).all()),"likes":db.query(Like).count(),"playlists":db.query(Playlist).count(),"premium":db.query(Subscription).filter(Subscription.plan!="FREE",Subscription.active==True).count(),"comments":db.query(Comment).count(),"server_time":now.isoformat()}

@app.get("/api/admin/users")
def admin_users(token:str=Query(...),db:Session=Depends(get_db)):
    require_admin(token,db); return [{"id":u.id,"email":u.email,"username":u.username,"is_admin":u.is_admin,"created_at":u.created_at.isoformat() if u.created_at else None} for u in db.query(User).order_by(User.id.desc()).limit(500).all()]

@app.delete("/api/admin/tracks/{track_id}")
def admin_delete_track(track_id:int,token:str=Query(...),db:Session=Depends(get_db)):
    require_admin(token,db); t=db.query(Track).filter(Track.id==track_id).first()
    if not t: raise HTTPException(404,"Track not found")
    path=resolve_path(t.audio_path); db.delete(t); db.commit()
    if path and path.exists():
        try: path.unlink()
        except Exception: pass
    return {"ok":True}

@app.post("/api/admin/notifications")
def admin_notify(title:str=Form(...),body:str=Form(...),token:str=Query(...),db:Session=Depends(get_db)):
    require_admin(token,db); users=db.query(User).all()
    for u in users: db.add(Notification(user_id=u.id,title=title,body=body,kind="admin"))
    db.commit(); return {"ok":True,"sent":len(users)}


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


@app.head("/", include_in_schema=False)
def head_root():
    return Response(status_code=200)


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
