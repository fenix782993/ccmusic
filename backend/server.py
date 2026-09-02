# backend/server.py

import os
import json
import mimetypes
import secrets
import shutil
import urllib.request
import urllib.error

from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    Query,
)
from fastapi.responses import (
    FileResponse,
    StreamingResponse,
    JSONResponse,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.database import Base, SessionLocal, engine
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
# CONFIG
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"

MEDIA_DIR = BASE_DIR / "backend" / "media"
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
    directory.mkdir(parents=True, exist_ok=True)


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "fenix-music-development-secret-change-this",
)

ACCESS_MINUTES = int(
    os.getenv("ACCESS_MINUTES", "10080")
)

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
# APP
# ============================================================

app = FastAPI(
    title="FENIX MUSIC API",
    version="4.0.0",
    description="FENIX MUSIC backend",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
# HELPERS
# ============================================================

def utcnow():
    return datetime.now(timezone.utc)


def safe_filename(filename: str) -> str:
    filename = Path(filename or "file").name

    allowed = (
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789"
        "._- "
    )

    cleaned = "".join(
        char if char in allowed else "_"
        for char in filename
    )

    cleaned = cleaned.strip(" .")

    return cleaned or "file"


def unique_filename(original_name: str) -> str:
    suffix = Path(original_name).suffix.lower()

    if not suffix:
        suffix = ".bin"

    return f"{secrets.token_hex(16)}{suffix}"


def resolve_path(path_value: Optional[str]) -> Optional[Path]:
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
                MEDIA_DIR / raw,
                AUDIO_DIR / raw,
                COVER_DIR / raw,
                MUSIC_DIR / raw,
                UPLOAD_DIR / raw,
            ]
        )

    for candidate in candidates:
        try:
            candidate = candidate.resolve()

            if candidate.exists() and candidate.is_file():
                return candidate
        except Exception:
            continue

    return None


def relative_media_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(BASE_DIR.resolve())).replace(
            "\\",
            "/",
        )
    except Exception:
        return str(path).replace("\\", "/")


def track_to_dict(track: Track, liked: bool = False):
    audio_file = resolve_path(track.audio_path)

    cover_url = None

    if getattr(track, "cover_path", None):
        cover_path = resolve_path(track.cover_path)

        if cover_path:
            cover_url = (
                f"/api/covers/{cover_path.name}"
            )

    return {
        "id": track.id,
        "title": getattr(track, "title", "") or "",
        "artist": getattr(track, "artist", "") or "",
        "album": getattr(track, "album", "") or "",
        "genre": getattr(track, "genre", "") or "",
        "duration": getattr(track, "duration", 0) or 0,
        "cover_url": cover_url,
        "audio_url": (
            f"/api/tracks/{track.id}/stream"
            if audio_file
            else None
        ),
        "liked": liked,
        "available": bool(audio_file),
        "created_at": (
            track.created_at.isoformat()
            if getattr(track, "created_at", None)
            else None
        ),
    }


def user_to_dict(user: User):
    return {
        "id": user.id,
        "email": getattr(user, "email", "") or "",
        "username": getattr(user, "username", "") or "",
        "avatar_url": getattr(user, "avatar_url", None),
        "telegram_id": getattr(user, "telegram_id", None),
        "is_admin": bool(
            getattr(user, "is_admin", False)
        ),
        "subscription": getattr(
            user,
            "subscription",
            "FREE",
        ) or "FREE",
    }


def get_user_from_token(
    token: str,
    db: Session,
):
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Токен отсутствует",
        )

    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Недействительный токен",
        )

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Недействительный токен",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Некорректный токен",
        )

    user = db.query(User).filter(
        User.id == int(user_id)
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Пользователь не найден",
        )

    return user


def require_admin(
    token: str,
    db: Session,
):
    user = get_user_from_token(
        token,
        db,
    )

    if not getattr(user, "is_admin", False):
        raise HTTPException(
            status_code=403,
            detail="Доступ только для администратора",
        )

    return user


def ensure_admin(db: Session):
    admin = db.query(User).filter(
        User.email == ADMIN_EMAIL
    ).first()

    if not admin:
        admin = User(
            email=ADMIN_EMAIL,
            username=ADMIN_USERNAME,
            password_hash=hash_password(ADMIN_PASSWORD),
            is_admin=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

    else:
        changed = False

        if not getattr(admin, "is_admin", False):
            admin.is_admin = True
            changed = True

        if not getattr(admin, "username", None):
            admin.username = ADMIN_USERNAME
            changed = True

        if changed:
            db.commit()

    return admin


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    db = SessionLocal()

    try:
        ensure_admin(db)
    finally:
        db.close()


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "fenix-music",
        "version": "4.0.0",
        "time": utcnow().isoformat(),
    }


@app.get("/api")
def api_root():
    return {
        "name": "FENIX MUSIC API",
        "version": "4.0.0",
        "status": "online",
    }


# ============================================================
# AUTH
# ============================================================

class RegisterRequest(BaseModel):
    email: str
    password: str
    username: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/register")
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = data.email.strip().lower()
    username = data.username.strip()

    if not email or "@" not in email:
        raise HTTPException(
            status_code=400,
            detail="Введите корректную почту",
        )

    if len(data.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Пароль должен содержать минимум 6 символов",
        )

    existing = db.query(User).filter(
        User.email == email
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Пользователь с такой почтой уже существует",
        )

    if not username:
        username = email.split("@")[0]

    user = User(
        email=email,
        username=username,
        password_hash=hash_password(data.password),
        is_admin=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        {
            "sub": str(user.id),
        },
        expires_delta=timedelta(
            minutes=ACCESS_MINUTES
        ),
    )

    return {
        "token": token,
        "user": user_to_dict(user),
    }


@app.post("/api/auth/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    email = data.email.strip().lower()

    user = db.query(User).filter(
        User.email == email
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Неверная почта или пароль",
        )

    password_hash = getattr(
        user,
        "password_hash",
        "",
    )

    if not password_hash or not verify_password(
        data.password,
        password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверная почта или пароль",
        )

    token = create_access_token(
        {
            "sub": str(user.id),
        },
        expires_delta=timedelta(
            minutes=ACCESS_MINUTES
        ),
    )

    return {
        "token": token,
        "user": user_to_dict(user),
    }


@app.get("/api/auth/me")
def auth_me(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    return user_to_dict(user)


# ============================================================
# TELEGRAM AUTH
# ============================================================

@app.get("/api/auth/telegram")
def telegram_auth(
    db: Session = Depends(get_db),
):
    """
    Возвращает deep-link для Telegram Mini App / bot auth.

    BOT_USERNAME можно задать в Render.
    """

    bot_username = os.getenv(
        "BOT_USERNAME",
        "",
    ).strip().lstrip("@")

    if not bot_username:
        return {
            "enabled": False,
            "url": None,
        }

    auth_token = secrets.token_urlsafe(32)

    auth_record = TelegramAuth(
        token=auth_token,
        created_at=utcnow(),
    )

    db.add(auth_record)
    db.commit()

    url = (
        f"https://t.me/{bot_username}"
        f"?start=auth_{auth_token}"
    )

    return {
        "enabled": True,
        "url": url,
        "deep_link": url,
        "token": auth_token,
    }


# ============================================================
# USER
# ============================================================

@app.get("/api/profile")
def profile(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    tracks_count = db.query(History).filter(
        History.user_id == user.id
    ).count()

    likes_count = db.query(Like).filter(
        Like.user_id == user.id
    ).count()

    playlists_count = db.query(Playlist).filter(
        Playlist.user_id == user.id
    ).count()

    return {
        **user_to_dict(user),
        "stats": {
            "listening": tracks_count,
            "likes": likes_count,
            "playlists": playlists_count,
        },
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
        .order_by(Track.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []

    for track in rows:
        if not resolve_path(
            getattr(track, "audio_path", None)
        ):
            continue

        result.append(
            track_to_dict(track)
        )

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
            detail="Трек не найден",
        )

    return track_to_dict(track)


# ============================================================
# STREAM TRACK
# ============================================================

@app.get("/api/tracks/{track_id}/stream")
def stream_track(
    track_id: int,
    db: Session = Depends(get_db),
):
    track = db.query(Track).filter(
        Track.id == track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Трек не найден",
        )

    path = resolve_path(
        getattr(track, "audio_path", None)
    )

    if not path:
        raise HTTPException(
            status_code=404,
            detail="Файл аудио отсутствует",
        )

    mime_type, _ = mimetypes.guess_type(
        str(path)
    )

    mime_type = mime_type or "audio/mpeg"

    file_size = path.stat().st_size

    range_header = None

    # FastAPI Request здесь специально не используется,
    # чтобы сохранить совместимость с текущей структурой.
    # Браузер может получить полный файл через FileResponse.

    return FileResponse(
        path=str(path),
        media_type=mime_type,
        filename=path.name,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Cache-Control": "public, max-age=3600",
        },
    )


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
            detail="Обложка не найдена",
        )

    mime_type, _ = mimetypes.guess_type(
        str(path)
    )

    return FileResponse(
        str(path),
        media_type=mime_type or "image/jpeg",
    )


# Compatibility route
# /api/media/covers/filename.jpg

@app.get("/api/media/covers/{filename}")
def get_cover_compat(
    filename: str,
):
    return get_cover(filename)


# ============================================================
# SEARCH
# ============================================================

@app.get("/api/search")
def search(
    q: str = Query("", min_length=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = q.strip()

    if not query:
        return {
            "tracks": [],
            "artists": [],
            "albums": [],
            "genres": [],
            "playlists": [],
        }

    pattern = f"%{query}%"

    track_rows = (
        db.query(Track)
        .filter(
            or_(
                Track.title.ilike(pattern),
                Track.artist.ilike(pattern),
                Track.album.ilike(pattern),
                Track.genre.ilike(pattern),
            )
        )
        .order_by(Track.created_at.desc())
        .limit(limit)
        .all()
    )

    tracks_result = []

    for track in track_rows:
        if not resolve_path(
            getattr(track, "audio_path", None)
        ):
            continue

        tracks_result.append(
            track_to_dict(track)
        )

    artists = sorted(
        {
            (track.artist or "").strip()
            for track in track_rows
            if (track.artist or "").strip()
        }
    )

    albums = sorted(
        {
            (track.album or "").strip()
            for track in track_rows
            if (track.album or "").strip()
        }
    )

    genres = sorted(
        {
            (track.genre or "").strip()
            for track in track_rows
            if (track.genre or "").strip()
        }
    )

    return {
        "tracks": tracks_result,
        "artists": artists,
        "albums": albums,
        "genres": genres,
        "playlists": [],
    }


# ============================================================
# NEW / POPULAR
# ============================================================

@app.get("/api/catalog/new")
def catalog_new(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Track)
        .order_by(Track.created_at.desc())
        .limit(limit * 2)
        .all()
    )

    result = []

    for track in rows:
        if not resolve_path(
            getattr(track, "audio_path", None)
        ):
            continue

        result.append(
            track_to_dict(track)
        )

        if len(result) >= limit:
            break

    return result


@app.get("/api/catalog/popular")
def catalog_popular(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    tracks_rows = (
        db.query(Track)
        .all()
    )

    popularity = []

    for track in tracks_rows:
        audio = resolve_path(
            getattr(track, "audio_path", None)
        )

        if not audio:
            continue

        likes = db.query(Like).filter(
            Like.track_id == track.id
        ).count()

        listens = db.query(History).filter(
            History.track_id == track.id
        ).count()

        score = (
            likes * 5 +
            listens
        )

        popularity.append(
            (
                score,
                track,
            )
        )

    popularity.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    return [
        track_to_dict(track)
        for _, track in popularity[:limit]
    ]


# ============================================================
# RECOMMENDATIONS
# ============================================================

@app.get("/api/recommendations")
def recommendations(
    token: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Track)
        .order_by(Track.created_at.desc())
        .limit(limit * 3)
        .all()
    )

    result = []

    for track in rows:
        if not resolve_path(
            getattr(track, "audio_path", None)
        ):
            continue

        result.append(
            track_to_dict(track)
        )

        if len(result) >= limit:
            break

    return result


# ============================================================
# LIKES
# ============================================================

@app.get("/api/likes")
def get_likes(
    token: str,
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    likes = (
        db.query(Like)
        .filter(Like.user_id == user.id)
        .all()
    )

    result = []

    for like in likes:
        track = db.query(Track).filter(
            Track.id == like.track_id
        ).first()

        if not track:
            continue

        if not resolve_path(
            getattr(track, "audio_path", None)
        ):
            continue

        result.append(
            track_to_dict(
                track,
                liked=True,
            )
        )

    return result


@app.post("/api/likes/{track_id}")
def like_track(
    track_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    track = db.query(Track).filter(
        Track.id == track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Трек не найден",
        )

    existing = db.query(Like).filter(
        Like.user_id == user.id,
        Like.track_id == track_id,
    ).first()

    if existing:
        db.delete(existing)
        liked = False
    else:
        db.add(
            Like(
                user_id=user.id,
                track_id=track_id,
            )
        )
        liked = True

    db.commit()

    return {
        "liked": liked,
        "track_id": track_id,
    }


@app.delete("/api/likes/{track_id}")
def unlike_track(
    track_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    existing = db.query(Like).filter(
        Like.user_id == user.id,
        Like.track_id == track_id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()

    return {
        "liked": False,
        "track_id": track_id,
    }


# ============================================================
# HISTORY
# ============================================================

@app.get("/api/history")
def get_history(
    token: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    rows = (
        db.query(History)
        .filter(History.user_id == user.id)
        .order_by(History.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []

    for history in rows:
        track = db.query(Track).filter(
            Track.id == history.track_id
        ).first()

        if not track:
            continue

        if not resolve_path(
            getattr(track, "audio_path", None)
        ):
            continue

        result.append(
            track_to_dict(track)
        )

    return result


class HistoryRequest(BaseModel):
    track_id: int


@app.post("/api/history")
def add_history(
    data: HistoryRequest,
    token: str,
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    track = db.query(Track).filter(
        Track.id == data.track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Трек не найден",
        )

    history = History(
        user_id=user.id,
        track_id=track.id,
        created_at=utcnow(),
    )

    db.add(history)
    db.commit()

    return {
        "success": True,
        "track_id": track.id,
    }


# ============================================================
# PLAYLISTS
# ============================================================

@app.get("/api/playlists")
def get_playlists(
    token: str,
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    playlists = db.query(Playlist).filter(
        Playlist.user_id == user.id
    ).order_by(
        Playlist.created_at.desc()
    ).all()

    result = []

    for playlist in playlists:
        result.append(
            {
                "id": playlist.id,
                "name": playlist.name,
                "description": getattr(
                    playlist,
                    "description",
                    "",
                ) or "",
                "created_at": (
                    playlist.created_at.isoformat()
                    if getattr(
                        playlist,
                        "created_at",
                        None,
                    )
                    else None
                ),
            }
        )

    return result


class PlaylistCreateRequest(BaseModel):
    name: str
    description: str = ""


@app.post("/api/playlists")
def create_playlist(
    data: PlaylistCreateRequest,
    token: str,
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    name = data.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Введите название плейлиста",
        )

    playlist = Playlist(
        user_id=user.id,
        name=name,
        description=data.description.strip(),
        created_at=utcnow(),
    )

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": getattr(
            playlist,
            "description",
            "",
        ) or "",
    }


@app.get("/api/playlists/{playlist_id}")
def get_playlist(
    playlist_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.user_id == user.id,
    ).first()

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Плейлист не найден",
        )

    links = db.query(
        PlaylistTrack
    ).filter(
        PlaylistTrack.playlist_id == playlist.id
    ).all()

    result = []

    for link in links:
        track = db.query(Track).filter(
            Track.id == link.track_id
        ).first()

        if not track:
            continue

        if not resolve_path(
            getattr(track, "audio_path", None)
        ):
            continue

        result.append(
            track_to_dict(track)
        )

    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": getattr(
            playlist,
            "description",
            "",
        ) or "",
        "tracks": result,
    }


@app.post("/api/playlists/{playlist_id}/tracks/{track_id}")
def add_to_playlist(
    playlist_id: int,
    track_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.user_id == user.id,
    ).first()

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Плейлист не найден",
        )

    track = db.query(Track).filter(
        Track.id == track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Трек не найден",
        )

    existing = db.query(
        PlaylistTrack
    ).filter(
        PlaylistTrack.playlist_id == playlist_id,
        PlaylistTrack.track_id == track_id,
    ).first()

    if not existing:
        db.add(
            PlaylistTrack(
                playlist_id=playlist_id,
                track_id=track_id,
            )
        )

        db.commit()

    return {
        "success": True,
        "playlist_id": playlist_id,
        "track_id": track_id,
    }


@app.delete("/api/playlists/{playlist_id}/tracks/{track_id}")
def remove_from_playlist(
    playlist_id: int,
    track_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    user = get_user_from_token(
        token,
        db,
    )

    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.user_id == user.id,
    ).first()

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Плейлист не найден",
        )

    link = db.query(
        PlaylistTrack
    ).filter(
        PlaylistTrack.playlist_id == playlist_id,
        PlaylistTrack.track_id == track_id,
    ).first()

    if link:
        db.delete(link)
        db.commit()

    return {
        "success": True,
    }


# ============================================================
# ADMIN
# ============================================================

@app.get("/api/admin/me")
def admin_me(
    token: str,
    db: Session = Depends(get_db),
):
    admin = require_admin(
        token,
        db,
    )

    return user_to_dict(admin)


@app.get("/api/admin/tracks")
def admin_tracks(
    token: str,
    db: Session = Depends(get_db),
):
    require_admin(
        token,
        db,
    )

    rows = (
        db.query(Track)
        .order_by(Track.created_at.desc())
        .all()
    )

    return [
        track_to_dict(track)
        for track in rows
    ]


# ============================================================
# ADMIN UPLOAD
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

    title = title.strip()
    artist = artist.strip()
    album = album.strip()
    genre = genre.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Введите название трека",
        )

    if not artist:
        raise HTTPException(
            status_code=400,
            detail="Введите исполнителя",
        )

    if not audio.filename:
        raise HTTPException(
            status_code=400,
            detail="Аудиофайл не выбран",
        )

    audio_original = safe_filename(
        audio.filename
    )

    audio_suffix = (
        Path(audio_original)
        .suffix
        .lower()
    )

    allowed_audio = {
        ".mp3",
        ".wav",
        ".ogg",
        ".oga",
        ".m4a",
        ".aac",
        ".flac",
        ".webm",
    }

    if audio_suffix not in allowed_audio:
        raise HTTPException(
            status_code=400,
            detail=(
                "Неподдерживаемый формат аудио. "
                "Разрешены MP3, WAV, OGG, M4A, AAC, FLAC, WEBM."
            ),
        )

    audio_filename = unique_filename(
        audio_original
    )

    audio_path = AUDIO_DIR / audio_filename

    with audio_path.open("wb") as output:
        shutil.copyfileobj(
            audio.file,
            output,
        )

    cover_path = None

    if cover and cover.filename:
        cover_original = safe_filename(
            cover.filename
        )

        cover_suffix = (
            Path(cover_original)
            .suffix
            .lower()
        )

        allowed_covers = {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".gif",
        }

        if cover_suffix not in allowed_covers:
            audio_path.unlink(
                missing_ok=True
            )

            raise HTTPException(
                status_code=400,
                detail=(
                    "Неподдерживаемый формат обложки. "
                    "Разрешены JPG, JPEG, PNG, WEBP, GIF."
                ),
            )

        cover_filename = unique_filename(
            cover_original
        )

        cover_path = COVER_DIR / cover_filename

        with cover_path.open("wb") as output:
            shutil.copyfileobj(
                cover.file,
                output,
            )

    track = Track(
        title=title,
        artist=artist,
        album=album,
        genre=genre,
        audio_path=relative_media_path(
            audio_path
        ),
        cover_path=(
            relative_media_path(cover_path)
            if cover_path
            else None
        ),
        created_at=utcnow(),
    )

    db.add(track)
    db.commit()
    db.refresh(track)

    return {
        "success": True,
        "message": "Трек успешно загружен",
        "track": track_to_dict(track),
    }


# ============================================================
# ADMIN DELETE TRACK
# ============================================================

@app.delete("/api/admin/tracks/{track_id}")
def admin_delete_track(
    track_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    require_admin(
        token,
        db,
    )

    track = db.query(Track).filter(
        Track.id == track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Трек не найден",
        )

    audio_path = resolve_path(
        getattr(track, "audio_path", None)
    )

    cover_path = resolve_path(
        getattr(track, "cover_path", None)
    )

    if audio_path:
        audio_path.unlink(
            missing_ok=True
        )

    if cover_path:
        cover_path.unlink(
            missing_ok=True
        )

    db.query(Like).filter(
        Like.track_id == track_id
    ).delete(
        synchronize_session=False
    )

    db.query(History).filter(
        History.track_id == track_id
    ).delete(
        synchronize_session=False
    )

    db.query(PlaylistTrack).filter(
        PlaylistTrack.track_id == track_id
    ).delete(
        synchronize_session=False
    )

    db.delete(track)
    db.commit()

    return {
        "success": True,
        "deleted": track_id,
    }


# ============================================================
# RADIO
# ============================================================

RADIO_STATIONS = [
    {
        "id": "retro-fm",
        "name": "Retro FM",
        "description": "Ретро-хиты",
        "stream": (
            "https://hls-01-retro.emgsound.ru/"
            "12/128/playlist.m3u8"
        ),
        "type": "hls",
    },
    {
        "id": "russkoe-radio",
        "name": "Русское Радио",
        "description": "Главное русское радио",
        "stream": "/api/radio/russkoe-radio/stream",
        "type": "proxy",
    },
    {
        "id": "radio-dacha",
        "name": "Радио Дача",
        "description": "Музыка для хорошего настроения",
        "stream": "/api/radio/radio-dacha/stream",
        "type": "proxy",
    },
]


@app.get("/api/radio")
def radio():
    return RADIO_STATIONS


RADIO_SOURCE_URLS = {
    "russkoe-radio": (
        "https://rusradio.hostingradio.ru/"
        "rusradio96.aacp"
    ),
    "radio-dacha": (
        "https://radiodacha.hostingradio.ru/"
        "radiodacha96.aacp"
    ),
}


@app.get("/api/radio/{station_id}/stream")
def radio_stream(
    station_id: str,
):
    station_id = station_id.strip().lower()

    source_url = RADIO_SOURCE_URLS.get(
        station_id
    )

    if not source_url:
        raise HTTPException(
            status_code=404,
            detail="Радиостанция не найдена",
        )

    try:
        request = urllib.request.Request(
            source_url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "Chrome/150 Safari/537.36"
                ),
                "Icy-MetaData": "1",
            },
        )

        response = urllib.request.urlopen(
            request,
            timeout=20,
        )

        content_type = (
            response.headers.get(
                "Content-Type"
            )
            or "audio/aac"
        )

        def iterator():
            try:
                while True:
                    chunk = response.read(64 * 1024)

                    if not chunk:
                        break

                    yield chunk

            finally:
                try:
                    response.close()
                except Exception:
                    pass

        return StreamingResponse(
            iterator(),
            media_type=content_type,
            headers={
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*",
            },
        )

    except urllib.error.URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка радио: {exc}",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка радио: {exc}",
        )


# ============================================================
# STATIC MEDIA
# ============================================================

if MEDIA_DIR.exists():
    app.mount(
        "/media",
        StaticFiles(
            directory=str(MEDIA_DIR)
        ),
        name="media",
    )


# ============================================================
# FRONTEND
# ============================================================

def frontend_file() -> Optional[Path]:
    candidates = [
        FRONTEND_DIST / "index.html",
        FRONTEND_DIR / "index.html",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


@app.get("/")
def frontend_root():
    index = frontend_file()

    if not index:
        return JSONResponse(
            {
                "service": "FENIX MUSIC",
                "status": "online",
                "message": (
                    "Frontend index.html не найден"
                ),
            }
        )

    return FileResponse(
        str(index),
        media_type="text/html",
    )


@app.get("/{path:path}")
def frontend_fallback(
    path: str,
):
    # Не перехватываем API
    if path.startswith("api/"):
        raise HTTPException(
            status_code=404,
            detail="API endpoint not found",
        )

    # Не перехватываем media
    if path.startswith("media/"):
        raise HTTPException(
            status_code=404,
            detail="Media not found",
        )

    # Сначала ищем реальный файл в dist
    if FRONTEND_DIST.exists():
        candidate = (
            FRONTEND_DIST / path
        ).resolve()

        try:
            candidate.relative_to(
                FRONTEND_DIST.resolve()
            )
        except ValueError:
            candidate = None

        if candidate and candidate.exists():
            if candidate.is_file():
                mime_type, _ = mimetypes.guess_type(
                    str(candidate)
                )

                return FileResponse(
                    str(candidate),
                    media_type=mime_type,
                )

    # Затем файлы непосредственно frontend/
    candidate = (
        FRONTEND_DIR / path
    ).resolve()

    try:
        candidate.relative_to(
            FRONTEND_DIR.resolve()
        )
    except ValueError:
        candidate = None

    if candidate and candidate.exists():
        if candidate.is_file():
            mime_type, _ = mimetypes.guess_type(
                str(candidate)
            )

            return FileResponse(
                str(candidate),
                media_type=mime_type,
            )

    # SPA fallback
    index = frontend_file()

    if index:
        return FileResponse(
            str(index),
            media_type="text/html",
        )

    raise HTTPException(
        status_code=404,
        detail="Frontend not found",
    )
