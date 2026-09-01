import os
import re
import uuid
import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
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
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    or_,
    func,
    inspect,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from jose import jwt, JWTError
from passlib.context import CryptContext


# ============================================================
# APP
# ============================================================

APP_VERSION = "8.0.1"

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

MEDIA_DIR = Path(
    os.getenv(
        "MEDIA_DIR",
        str(BASE_DIR / "media"),
    )
)

AUDIO_DIR = MEDIA_DIR / "audio"
MUSIC_DIR = MEDIA_DIR / "music"
UPLOAD_DIR = MEDIA_DIR / "uploads"
COVER_DIR = MEDIA_DIR / "covers"

for directory in (
    AUDIO_DIR,
    MUSIC_DIR,
    UPLOAD_DIR,
    COVER_DIR,
):
    directory.mkdir(
        parents=True,
        exist_ok=True,
    )


# ============================================================
# DATABASE
# ============================================================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./fenix_music.db",
)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )

connect_args = (
    {"check_same_thread": False}
    if DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


# ============================================================
# AUTH
# ============================================================

SECRET_KEY = os.getenv(
    "JWT_SECRET",
    "change-this-secret-in-production",
)

ALGORITHM = "HS256"

ACCESS_MINUTES = int(
    os.getenv(
        "ACCESS_MINUTES",
        "10080",
    )
)

ADMIN_EMAIL = os.getenv(
    "ADMIN_EMAIL",
    "admin@fenixmusic.local",
).strip().lower()

ADMIN_PASSWORD = os.getenv(
    "ADMIN_PASSWORD",
    "change-me-now",
)

pwd = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

bearer = HTTPBearer(
    auto_error=False,
)


# ============================================================
# MODELS
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    username = Column(
        String(80),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash = Column(
        String(255),
        nullable=False,
    )

    avatar_url = Column(
        String(500),
        nullable=True,
    )

    bio = Column(
        Text,
        nullable=True,
    )

    is_admin = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    telegram_id = Column(
        String(64),
        unique=True,
        nullable=True,
        index=True,
    )

    telegram_link_token = Column(
        String(128),
        unique=True,
        nullable=True,
        index=True,
    )

    telegram_link_expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    last_login = Column(
        DateTime(timezone=True),
        nullable=True,
    )


class Track(Base):
    __tablename__ = "tracks"

    id = Column(
        Integer,
        primary_key=True,
    )

    title = Column(
        String(255),
        nullable=False,
        index=True,
    )

    artist = Column(
        String(255),
        nullable=False,
        index=True,
    )

    album = Column(
        String(255),
        nullable=False,
        index=True,
    )

    genre = Column(
        String(100),
        default="Pop",
    )

    duration = Column(
        Integer,
        default=0,
    )

    cover_url = Column(
        String(500),
        nullable=True,
    )

    audio_path = Column(
        String(500),
        nullable=True,
    )

    plays = Column(
        Integer,
        default=0,
        nullable=False,
    )

    lyrics = Column(
        Text,
        nullable=True,
    )

    lyrics_sync = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class Like(Base):
    __tablename__ = "likes"

    id = Column(
        Integer,
        primary_key=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    track_id = Column(
        Integer,
        ForeignKey(
            "tracks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "track_id",
            name="uq_user_track_like",
        ),
    )


class History(Base):
    __tablename__ = "history"

    id = Column(
        Integer,
        primary_key=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    track_id = Column(
        Integer,
        ForeignKey(
            "tracks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    played_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(
        Integer,
        primary_key=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    name = Column(
        String(255),
        nullable=False,
    )

    description = Column(
        Text,
        default="",
    )

    cover_url = Column(
        String(500),
        nullable=True,
    )

    is_public = Column(
        Boolean,
        default=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"

    id = Column(
        Integer,
        primary_key=True,
    )

    playlist_id = Column(
        Integer,
        ForeignKey(
            "playlists.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    track_id = Column(
        Integer,
        ForeignKey(
            "tracks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    position = Column(
        Integer,
        default=0,
    )

    __table_args__ = (
        UniqueConstraint(
            "playlist_id",
            "track_id",
            name="uq_playlist_track",
        ),
    )


# ============================================================
# CREATE TABLES
# ============================================================

Base.metadata.create_all(engine)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="FENIX MUSIC API",
    version=APP_VERSION,
)

cors_origins = [
    x.strip()
    for x in os.getenv(
        "CORS_ORIGINS",
        "*",
    ).split(",")
    if x.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HELPERS
# ============================================================

def utcnow():
    return datetime.now(timezone.utc)


def normalize_datetime(value):
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(
            tzinfo=timezone.utc
        )

    return value


def migration():
    """
    Safely upgrades old PostgreSQL/SQLite schemas.
    Existing data is preserved.
    """

    insp = inspect(engine)

    table_specs = {
        "users": {
            "email": "VARCHAR(255)",
            "username": "VARCHAR(80)",
            "password_hash": "VARCHAR(255)",
            "avatar_url": "VARCHAR(500)",
            "bio": "TEXT",
            "is_admin": "BOOLEAN DEFAULT FALSE",
            "telegram_id": "VARCHAR(64)",
            "telegram_link_token": "VARCHAR(128)",
            "telegram_link_expires_at": "TIMESTAMP WITH TIME ZONE",
            "created_at": "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
            "updated_at": "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
            "last_login": "TIMESTAMP WITH TIME ZONE",
        },
        "tracks": {
            "title": "VARCHAR(255)",
            "artist": "VARCHAR(255)",
            "album": "VARCHAR(255)",
            "genre": "VARCHAR(100) DEFAULT 'Pop'",
            "duration": "INTEGER DEFAULT 0",
            "cover_url": "VARCHAR(500)",
            "audio_path": "VARCHAR(500)",
            "plays": "INTEGER DEFAULT 0",
            "lyrics": "TEXT",
            "lyrics_sync": "TEXT",
            "created_at": "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
        },
    }

    with engine.begin() as conn:
        tables = set(
            inspect(conn).get_table_names()
        )

        for table, columns in table_specs.items():
            if table not in tables:
                continue

            existing = {
                c["name"]
                for c in inspect(conn).get_columns(table)
            }

            for name, definition in columns.items():
                if name not in existing:
                    try:
                        conn.execute(
                            text(
                                f'ALTER TABLE "{table}" '
                                f'ADD COLUMN "{name}" {definition}'
                            )
                        )
                        print(
                            f"[DB] Added column "
                            f"{table}.{name}"
                        )
                    except Exception as exc:
                        print(
                            f"[DB] Could not add "
                            f"{table}.{name}: {exc}"
                        )

        if "users" in tables:
            cols = {
                c["name"]
                for c in inspect(conn).get_columns(
                    "users"
                )
            }

            for name in cols - {
                "id",
                "email",
                "username",
                "password_hash",
                "is_admin",
            }:
                try:
                    if not DATABASE_URL.startswith(
                        "sqlite"
                    ):
                        conn.execute(
                            text(
                                f'ALTER TABLE "users" '
                                f'ALTER COLUMN "{name}" '
                                f'DROP NOT NULL'
                            )
                        )
                except Exception:
                    pass

            try:
                conn.execute(
                    text(
                        "UPDATE users "
                        "SET bio = COALESCE(bio, '') "
                        "WHERE bio IS NULL"
                    )
                )
            except Exception:
                pass

        if "tracks" in tables:
            cols = {
                c["name"]
                for c in inspect(conn).get_columns(
                    "tracks"
                )
            }

            for name in cols - {
                "id",
                "title",
                "artist",
                "album",
                "genre",
                "duration",
                "plays",
            }:
                try:
                    if not DATABASE_URL.startswith(
                        "sqlite"
                    ):
                        conn.execute(
                            text(
                                f'ALTER TABLE "tracks" '
                                f'ALTER COLUMN "{name}" '
                                f'DROP NOT NULL'
                            )
                        )
                except Exception:
                    pass

            try:
                conn.execute(
                    text(
                        "UPDATE tracks "
                        "SET title = COALESCE("
                        "NULLIF(title,''),"
                        "'Unknown Track') "
                        "WHERE title IS NULL OR title=''"
                    )
                )

                conn.execute(
                    text(
                        "UPDATE tracks "
                        "SET artist = COALESCE("
                        "NULLIF(artist,''),"
                        "'Unknown Artist') "
                        "WHERE artist IS NULL OR artist=''"
                    )
                )

                conn.execute(
                    text(
                        "UPDATE tracks "
                        "SET album = COALESCE("
                        "NULLIF(album,''),"
                        "'Unknown Album') "
                        "WHERE album IS NULL OR album=''"
                    )
                )

                conn.execute(
                    text(
                        "UPDATE tracks "
                        "SET genre = COALESCE("
                        "NULLIF(genre,''),"
                        "'Pop') "
                        "WHERE genre IS NULL OR genre=''"
                    )
                )

                conn.execute(
                    text(
                        "UPDATE tracks "
                        "SET duration = COALESCE(duration,0), "
                        "plays = COALESCE(plays,0)"
                    )
                )

                # Только старые пустые записи без аудио.
                conn.execute(
                    text(
                        "DELETE FROM tracks "
                        "WHERE audio_path IS NULL "
                        "OR TRIM(audio_path) = ''"
                    )
                )

            except Exception as exc:
                print(
                    f"[DB] Track normalization error: {exc}"
                )


def resolve_audio_path(
    value: str | None,
) -> Optional[Path]:

    if not value:
        return None

    p = Path(value)

    candidates = []

    if p.is_absolute():
        candidates.append(p)
    else:
        candidates.extend(
            [
                PROJECT_DIR / p,
                BASE_DIR / p,
                Path.cwd() / p,
            ]
        )

    for candidate in candidates:
        try:
            resolved = candidate.resolve()

            if (
                resolved.exists()
                and resolved.is_file()
            ):
                return resolved

        except Exception:
            pass

    return None


def normalize_saved_path(
    path: Path,
) -> str:

    try:
        return path.resolve().relative_to(
            PROJECT_DIR.resolve()
        ).as_posix()

    except Exception:
        return path.resolve().as_posix()


def clean_filename(
    name: str,
    fallback: str,
) -> str:

    name = Path(
        name or fallback
    ).name

    name = re.sub(
        r"[^\w\-. ()\[\]А-Яа-яЁё]+",
        "_",
        name,
        flags=re.UNICODE,
    ).strip(" .")

    return name or fallback


def metadata_from_file(path: Path):

    title = path.stem
    artist = "Unknown Artist"
    album = "Unknown Album"
    genre = "Pop"
    duration = 0

    try:
        from mutagen import File as MutagenFile

        audio = MutagenFile(
            str(path),
            easy=False,
        )

        if audio:
            duration = int(
                float(
                    getattr(
                        audio.info,
                        "length",
                        0,
                    )
                    or 0
                )
            )

            tags = audio.tags

            if tags:

                def tag(*names):
                    for name in names:
                        try:
                            if name in tags:
                                value = tags[name]

                                if isinstance(
                                    value,
                                    (list, tuple),
                                ):
                                    return (
                                        str(value[0])
                                        if value
                                        else None
                                    )

                                return str(value)

                        except Exception:
                            pass

                    return None

                artist = (
                    tag(
                        "artist",
                        "ARTIST",
                        "©ART",
                    )
                    or artist
                )

                title = (
                    tag(
                        "title",
                        "TITLE",
                        "©nam",
                    )
                    or title
                )

                album = (
                    tag(
                        "album",
                        "ALBUM",
                        "©alb",
                    )
                    or album
                )

                genre = (
                    tag(
                        "genre",
                        "GENRE",
                        "©gen",
                    )
                    or genre
                )

    except Exception:
        pass

    if (
        artist == "Unknown Artist"
        and " - " in path.stem
    ):
        a, t = path.stem.split(
            " - ",
            1,
        )

        artist = a.strip()
        title = t.strip()

    return (
        title.strip()[:255]
        or "Unknown Track",
        artist.strip()[:255]
        or "Unknown Artist",
        album.strip()[:255]
        or "Unknown Album",
        genre.strip()[:100]
        or "Pop",
        duration,
    )


def extract_cover(
    path: Path,
) -> Optional[Path]:

    try:
        from mutagen import File as MutagenFile

        audio = MutagenFile(
            str(path),
            easy=False,
        )

        if not audio or not audio.tags:
            return None

        data = None
        ext = ".jpg"
        tags = audio.tags

        if hasattr(tags, "getall"):
            pics = tags.getall("APIC")

            if pics:
                data = pics[0].data

                mime = getattr(
                    pics[0],
                    "mime",
                    "image/jpeg",
                )

                ext = (
                    ".png"
                    if "png" in mime
                    else ".jpg"
                )

        if data is None and "covr" in tags:
            covr = tags["covr"]

            if covr:
                data = bytes(covr[0])
                ext = ".jpg"

        if not data:
            return None

        target = (
            COVER_DIR
            / f"{uuid.uuid4().hex}{ext}"
        )

        target.write_bytes(data)

        return target

    except Exception:
        return None


def scan_music(db: Session):

    files = []

    allowed = {
        ".mp3",
        ".m4a",
        ".aac",
        ".ogg",
        ".wav",
        ".flac",
        ".opus",
    }

    for root in (
        AUDIO_DIR,
        MUSIC_DIR,
        UPLOAD_DIR,
    ):
        if root.exists():
            files.extend(
                p
                for p in root.rglob("*")
                if (
                    p.is_file()
                    and p.suffix.lower() in allowed
                )
            )

    unique = {
        p.resolve(): p
        for p in files
    }

    files = list(
        unique.values()
    )

    added = 0
    updated = 0

    for path in files:
        try:
            normalized = normalize_saved_path(
                path
            )

            (
                title,
                artist,
                album,
                genre,
                duration,
            ) = metadata_from_file(path)

            track = (
                db.query(Track)
                .filter(
                    Track.audio_path == normalized
                )
                .first()
            )

            if not track:
                track = (
                    db.query(Track)
                    .filter(
                        Track.title == title,
                        Track.artist == artist,
                    )
                    .first()
                )

            if track:
                track.title = title
                track.artist = artist
                track.album = album
                track.genre = genre
                track.duration = duration
                track.audio_path = normalized

                if not track.cover_url:
                    cover = extract_cover(path)

                    if cover:
                        track.cover_url = (
                            f"/api/media/covers/"
                            f"{cover.name}"
                        )

                updated += 1

            else:
                cover = extract_cover(path)

                track = Track(
                    title=title,
                    artist=artist,
                    album=album,
                    genre=genre,
                    duration=duration,
                    audio_path=normalized,
                    cover_url=(
                        f"/api/media/covers/"
                        f"{cover.name}"
                        if cover
                        else None
                    ),
                    plays=0,
                )

                db.add(track)
                added += 1

        except Exception as exc:
            print(
                f"[SCAN ERROR] "
                f"{path} ({exc})"
            )

    db.commit()

    return {
        "found": len(files),
        "added": added,
        "updated": updated,
    }


# ============================================================
# JSON SERIALIZERS
# ============================================================

def user_json(user):

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "bio": user.bio or "",
        "is_admin": bool(user.is_admin),
        "telegram_linked": bool(
            user.telegram_id
        ),
        "created_at": user.created_at,
    }


def parse_lyrics_sync(value):

    if not value:
        return []

    try:
        parsed = json.loads(value)

        if isinstance(parsed, list):
            return parsed

    except Exception:
        pass

    return []


def track_json(track):

    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "genre": track.genre or "Pop",
        "duration": int(
            track.duration or 0
        ),
        "duration_label": (
            f"{int(track.duration or 0) // 60}:"
            f"{int(track.duration or 0) % 60:02d}"
        ),
        "cover_url": track.cover_url,
        "audio_url": (
            f"/api/tracks/{track.id}/stream"
            if (
                track.audio_path
                and resolve_audio_path(
                    track.audio_path
                )
            )
            else None
        ),
        "plays": int(
            track.plays or 0
        ),
        "has_lyrics": bool(
            (track.lyrics or "").strip()
        ),
        "has_synced_lyrics": bool(
            parse_lyrics_sync(
                track.lyrics_sync
            )
        ),
    }


# ============================================================
# PYDANTIC MODELS
# ============================================================

class Register(BaseModel):
    email: EmailStr
    username: str
    password: str


class Login(BaseModel):
    email: Optional[EmailStr] = None
    login: Optional[str] = None
    password: str


class LikeBody(BaseModel):
    liked: bool


class PlaylistBody(BaseModel):
    name: str
    description: str = ""
    is_public: bool = True


class PlaylistTrackBody(BaseModel):
    track_id: int


class ProfileBody(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None


class LyricsBody(BaseModel):
    lyrics: Optional[str] = None
    lyrics_sync: Optional[list] = None


# ============================================================
# DB / AUTH DEPENDENCIES
# ============================================================

def db_dep():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


def make_token(user):

    now = utcnow()

    return jwt.encode(
        {
            "sub": str(user.id),
            "iat": now,
            "exp": (
                now
                + timedelta(
                    minutes=ACCESS_MINUTES
                )
            ),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def current_user(
    creds: HTTPAuthorizationCredentials = Depends(
        bearer
    ),
    db: Session = Depends(db_dep),
):

    if not creds:
        raise HTTPException(
            status_code=401,
            detail="Authorization required",
        )

    try:
        payload = jwt.decode(
            creds.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        uid = int(
            payload["sub"]
        )

    except (
        JWTError,
        ValueError,
        KeyError,
        TypeError,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    user = db.get(
        User,
        uid,
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user


def admin_user(
    user=Depends(current_user),
):

    if not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return user


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():

    print(
        f"[START] FENIX MUSIC v{APP_VERSION}"
    )

    print(
        f"[START] BASE_DIR: {BASE_DIR}"
    )

    print(
        f"[START] MEDIA_DIR: {MEDIA_DIR}"
    )

    print(
        f"[START] DATABASE: "
        f"{DATABASE_URL.split(':')[0]}"
    )

    try:
        migration()

        print(
            "[DB] Migration completed"
        )

    except Exception as exc:
        print(
            f"[DB MIGRATION ERROR] {exc}"
        )

    db = SessionLocal()

    try:
        admin = (
            db.query(User)
            .filter(
                User.email == ADMIN_EMAIL
            )
            .first()
        )

        if not admin:
            admin = User(
                email=ADMIN_EMAIL,
                username="admin",
                password_hash=pwd.hash(
                    ADMIN_PASSWORD
                ),
                bio="",
                is_admin=True,
            )

            db.add(admin)
            db.commit()

            print(
                "[DB] Admin account created"
            )

        else:
            admin.is_admin = True
            admin.bio = admin.bio or ""

            db.commit()

        result = scan_music(db)

        print(
            f"[SCAN] Found "
            f"{result['found']} audio files"
        )

        print(
            f"[SCAN] Added="
            f"{result['added']}, "
            f"Updated="
            f"{result['updated']}"
        )

    except Exception as exc:
        db.rollback()

        print(
            f"[STARTUP MUSIC ERROR] {exc}"
        )

    finally:
        db.close()


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():

    return {
        "status": "ok",
        "version": APP_VERSION,
        "database": DATABASE_URL.split(":")[0],
        "time": utcnow().isoformat(),
    }


# ============================================================
# AUTH
# ============================================================

@app.get("/api/auth/me")
def me(
    user=Depends(current_user),
):
    return user_json(user)


@app.post("/api/auth/register")
def register(
    body: Register,
    db: Session = Depends(db_dep),
):

    username = body.username.strip()
    email = body.email.lower()

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Username must be at least 3 characters",
        )

    if len(body.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters",
        )

    exists = (
        db.query(User)
        .filter(
            or_(
                User.email == email,
                User.username == username,
            )
        )
        .first()
    )

    if exists:
        raise HTTPException(
            status_code=409,
            detail="Email or username already exists",
        )

    user = User(
        email=email,
        username=username,
        password_hash=pwd.hash(
            body.password
        ),
        bio="",
        is_admin=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "token": make_token(user),
        "user": user_json(user),
    }


@app.post("/api/auth/login")
def login(
    body: Login,
    db: Session = Depends(db_dep),
):

    identifier = (
        body.email
        or body.login
        or ""
    ).strip()

    user = (
        db.query(User)
        .filter(
            or_(
                User.email
                == identifier.lower(),
                User.username
                == identifier,
            )
        )
        .first()
    )

    if (
        not user
        or not pwd.verify(
            body.password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email/username or password",
        )

    user.last_login = utcnow()

    db.commit()

    return {
        "token": make_token(user),
        "user": user_json(user),
    }


@app.patch("/api/auth/me")
@app.patch("/api/profile")
def update_me(
    body: ProfileBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    if body.username is not None:

        username = body.username.strip()

        if len(username) < 3:
            raise HTTPException(
                status_code=400,
                detail="Username must be at least 3 characters",
            )

        exists = (
            db.query(User)
            .filter(
                User.username == username,
                User.id != user.id,
            )
            .first()
        )

        if exists:
            raise HTTPException(
                status_code=409,
                detail="Username already exists",
            )

        user.username = username

    if body.avatar_url is not None:
        user.avatar_url = (
            body.avatar_url.strip()
            or None
        )

    if body.bio is not None:
        user.bio = body.bio[:1000]

    user.updated_at = utcnow()

    db.commit()
    db.refresh(user)

    print(
        f"[PROFILE] Updated user "
        f"id={user.id}"
    )

    return user_json(user)


# ============================================================
# TELEGRAM LINKING
# ============================================================

def telegram_status_response(user):

    expires_at = normalize_datetime(
        user.telegram_link_expires_at
    )

    token = user.telegram_link_token

    if (
        expires_at
        and expires_at <= utcnow()
        and token
    ):
        token = None
        expires_at = None

    return {
        "linked": bool(
            user.telegram_id
        ),
        "telegram_id": user.telegram_id,
        "code": token,
        "token": token,
        "link_token": token,
        "telegram_link_token": token,
        "expires_at": (
            expires_at.isoformat()
            if expires_at
            else None
        ),
        "expires": (
            expires_at.isoformat()
            if expires_at
            else None
        ),
        "expires_in": (
            max(
                0,
                int(
                    (
                        expires_at
                        - utcnow()
                    ).total_seconds()
                ),
            )
            if expires_at
            else 0
        ),
    }


@app.get("/api/profile/telegram")
def profile_telegram_status(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    # Remove expired token automatically.
    expires_at = normalize_datetime(
        user.telegram_link_expires_at
    )

    if (
        user.telegram_link_token
        and expires_at
        and expires_at <= utcnow()
    ):
        user.telegram_link_token = None
        user.telegram_link_expires_at = None
        db.commit()

    return telegram_status_response(
        user
    )


@app.post("/api/profile/telegram/link")
def profile_telegram_link(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    # If already linked, don't generate a useless token.
    if user.telegram_id:
        return {
            **telegram_status_response(user),
            "ok": True,
            "message": "Telegram already linked",
        }

    # Invalidate old token.
    user.telegram_link_token = None
    user.telegram_link_expires_at = None

    # Secure random token.
    token = secrets.token_urlsafe(32)

    expires_at = (
        utcnow()
        + timedelta(
            minutes=10
        )
    )

    user.telegram_link_token = token
    user.telegram_link_expires_at = expires_at

    db.commit()
    db.refresh(user)

    print(
        f"[TELEGRAM] Link token created "
        f"user_id={user.id}"
    )

    return {
        "ok": True,
        "linked": False,
        "telegram_id": None,

        # Frontend compatibility.
        "code": token,
        "token": token,
        "link_token": token,
        "telegram_link_token": token,

        "expires_at": expires_at.isoformat(),
        "expires": expires_at.isoformat(),
        "expires_in": 600,

        "command": f"/link {token}",
    }


@app.post("/api/profile/telegram/unlink")
def profile_telegram_unlink(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    old_telegram_id = user.telegram_id

    user.telegram_id = None
    user.telegram_link_token = None
    user.telegram_link_expires_at = None

    db.commit()
    db.refresh(user)

    print(
        f"[TELEGRAM] Unlinked "
        f"user_id={user.id} "
        f"telegram_id={old_telegram_id}"
    )

    return {
        "ok": True,
        "linked": False,
        "telegram_id": None,
    }


# ------------------------------------------------------------
# Old Telegram API routes — compatibility
# ------------------------------------------------------------

@app.get("/api/telegram/status")
def telegram_status(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    return profile_telegram_status(
        user=user,
        db=db,
    )


@app.post("/api/telegram/link-token")
def telegram_link_token(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    return profile_telegram_link(
        user=user,
        db=db,
    )


@app.post("/api/telegram/unlink")
def telegram_unlink(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    return profile_telegram_unlink(
        user=user,
        db=db,
    )


# ============================================================
# TRACKS
# ============================================================

@app.get("/api/tracks")
def tracks(
    q: Optional[str] = None,
    genre: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    shuffle: bool = False,
    db: Session = Depends(db_dep),
):

    query = db.query(Track)

    if q:
        pattern = f"%{q}%"

        query = query.filter(
            or_(
                Track.title.ilike(pattern),
                Track.artist.ilike(pattern),
                Track.album.ilike(pattern),
            )
        )

    if genre:
        query = query.filter(
            Track.genre.ilike(genre)
        )

    if shuffle:
        query = query.order_by(
            func.random()
        )
    else:
        query = query.order_by(
            Track.created_at.desc(),
            Track.id.desc(),
        )

    return [
        track_json(track)
        for track in (
            query
            .offset(offset)
            .limit(
                min(
                    max(limit, 1),
                    500,
                )
            )
            .all()
        )
    ]


@app.get("/api/tracks/{track_id}")
def get_track(
    track_id: int,
    db: Session = Depends(db_dep),
):

    track = db.get(
        Track,
        track_id,
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    return track_json(track)


# ============================================================
# STREAM
# ============================================================

@app.get("/api/tracks/{track_id}/stream")
def stream(
    track_id: int,
    db: Session = Depends(db_dep),
):

    track = db.get(
        Track,
        track_id,
    )

    path = resolve_audio_path(
        track.audio_path
        if track
        else None
    )

    if not track or not path:
        raise HTTPException(
            status_code=404,
            detail="Audio file not found",
        )

    track.plays = (
        int(track.plays or 0)
        + 1
    )

    db.commit()

    ext = path.suffix.lower()

    mime = {
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".ogg": "audio/ogg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".opus": "audio/ogg",
    }.get(
        ext,
        "application/octet-stream",
    )

    return FileResponse(
        path,
        media_type=mime,
        filename=path.name,
    )


# ============================================================
# SEARCH
# ============================================================

@app.get("/api/search")
def search(
    q: str = Query(
        min_length=1
    ),
    db: Session = Depends(db_dep),
):

    pattern = f"%{q}%"

    tracks_result = (
        db.query(Track)
        .filter(
            or_(
                Track.title.ilike(pattern),
                Track.artist.ilike(pattern),
                Track.album.ilike(pattern),
                Track.genre.ilike(pattern),
            )
        )
        .limit(50)
        .all()
    )

    return {
        "tracks": [
            track_json(track)
            for track in tracks_result
        ],
        "artists": sorted(
            {
                track.artist
                for track in tracks_result
            }
        ),
        "albums": sorted(
            {
                track.album
                for track in tracks_result
            }
        ),
        "playlists": [],
    }


# ============================================================
# RECOMMENDATIONS
# ============================================================

@app.get("/api/recommendations")
def recommendations(
    limit: int = 20,
    db: Session = Depends(db_dep),
):

    return [
        track_json(track)
        for track in (
            db.query(Track)
            .order_by(
                Track.plays.desc(),
                Track.created_at.desc(),
            )
            .limit(
                min(
                    max(limit, 1),
                    50,
                )
            )
            .all()
        )
    ]


# ============================================================
# CHARTS
# ============================================================

@app.get("/api/charts")
def charts(
    period: str = Query("all"),
    limit: int = Query(
        50,
        ge=1,
        le=100,
    ),
    db: Session = Depends(db_dep),
):

    period = period.lower().strip()

    if period == "all":

        rows = (
            db.query(
                Track,
                Track.plays.label(
                    "chart_plays"
                ),
            )
            .order_by(
                Track.plays.desc(),
                Track.id.desc(),
            )
            .limit(limit)
            .all()
        )

    else:

        days = {
            "day": 1,
            "week": 7,
            "month": 30,
        }.get(period)

        if not days:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid chart period. "
                    "Use all, day, week or month."
                ),
            )

        cutoff = (
            utcnow()
            - timedelta(days=days)
        )

        rows = (
            db.query(
                Track,
                func.count(
                    History.id
                ).label(
                    "chart_plays"
                ),
            )
            .join(
                History,
                History.track_id
                == Track.id,
            )
            .filter(
                History.played_at
                >= cutoff
            )
            .group_by(
                Track.id
            )
            .order_by(
                func.count(
                    History.id
                ).desc(),
                Track.id.desc(),
            )
            .limit(limit)
            .all()
        )

    result = []

    for index, (
        track,
        chart_plays,
    ) in enumerate(rows):

        item = track_json(track)

        item["rank"] = index + 1

        item["chart_plays"] = int(
            chart_plays or 0
        )

        result.append(item)

    return {
        "period": period,
        "tracks": result,
    }


# ============================================================
# LYRICS
# ============================================================

@app.get("/api/tracks/{track_id}/lyrics")
def get_lyrics(
    track_id: int,
    db: Session = Depends(db_dep),
):

    track = db.get(
        Track,
        track_id,
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    return {
        "track_id": track.id,
        "lyrics": track.lyrics or "",
        "synced": parse_lyrics_sync(
            track.lyrics_sync
        ),
    }


# ============================================================
# LIKES
# ============================================================

@app.get("/api/library/likes")
def likes(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    ids = [
        item.track_id
        for item in (
            db.query(Like)
            .filter_by(
                user_id=user.id
            )
            .all()
        )
    ]

    tracks_result = (
        db.query(Track)
        .filter(
            Track.id.in_(ids)
        )
        .all()
        if ids
        else []
    )

    return {
        "track_ids": ids,
        "tracks": [
            track_json(track)
            for track in tracks_result
        ],
    }


@app.put("/api/library/likes/{track_id}")
def set_like(
    track_id: int,
    body: LikeBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    if not db.get(
        Track,
        track_id,
    ):
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    item = (
        db.query(Like)
        .filter_by(
            user_id=user.id,
            track_id=track_id,
        )
        .first()
    )

    if body.liked and not item:

        db.add(
            Like(
                user_id=user.id,
                track_id=track_id,
            )
        )

    elif not body.liked and item:

        db.delete(item)

    db.commit()

    return {
        "ok": True,
        "liked": body.liked,
    }


# ============================================================
# HISTORY
# ============================================================

@app.post("/api/history/{track_id}")
def add_history(
    track_id: int,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    if not db.get(
        Track,
        track_id,
    ):
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    db.add(
        History(
            user_id=user.id,
            track_id=track_id,
        )
    )

    db.commit()

    return {
        "ok": True,
    }


@app.get("/api/history")
def history(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    rows = (
        db.query(History)
        .filter_by(
            user_id=user.id
        )
        .order_by(
            History.played_at.desc()
        )
        .limit(100)
        .all()
    )

    result = []

    for row in rows:

        track = db.get(
            Track,
            row.track_id,
        )

        if track:
            result.append(
                {
                    "played_at": row.played_at,
                    "track": track_json(track),
                }
            )

    return result


# ============================================================
# PLAYLISTS
# ============================================================

@app.get("/api/playlists")
def playlists(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    playlist_items = (
        db.query(Playlist)
        .filter_by(
            user_id=user.id
        )
        .order_by(
            Playlist.created_at.desc()
        )
        .all()
    )

    result = []

    for playlist in playlist_items:

        playlist_tracks = (
            db.query(PlaylistTrack)
            .filter_by(
                playlist_id=playlist.id
            )
            .order_by(
                PlaylistTrack.position
            )
            .all()
        )

        tracks_result = []

        for playlist_track in playlist_tracks:

            track = db.get(
                Track,
                playlist_track.track_id,
            )

            if track:
                tracks_result.append(
                    track_json(track)
                )

        result.append(
            {
                "id": playlist.id,
                "name": playlist.name,
                "description": (
                    playlist.description
                    or ""
                ),
                "cover_url": playlist.cover_url,
                "is_public": bool(
                    playlist.is_public
                ),
                "tracks": tracks_result,
            }
        )

    return result


@app.post("/api/playlists")
def create_playlist(
    body: PlaylistBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    name = body.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Playlist name is required",
        )

    playlist = Playlist(
        user_id=user.id,
        name=name[:255],
        description=body.description[:5000],
        is_public=body.is_public,
    )

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return {
        "id": playlist.id,
        "name": playlist.name,
    }


@app.patch("/api/playlists/{pid}")
def update_playlist(
    pid: int,
    body: PlaylistBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    playlist = (
        db.query(Playlist)
        .filter_by(
            id=pid,
            user_id=user.id,
        )
        .first()
    )

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    name = body.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Playlist name is required",
        )

    playlist.name = name[:255]
    playlist.description = body.description[:5000]
    playlist.is_public = body.is_public

    db.commit()

    return {
        "ok": True,
    }


@app.delete("/api/playlists/{pid}")
def delete_playlist(
    pid: int,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    playlist = (
        db.query(Playlist)
        .filter_by(
            id=pid,
            user_id=user.id,
        )
        .first()
    )

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    db.delete(playlist)
    db.commit()

    return {
        "ok": True,
    }


@app.post("/api/playlists/{pid}/tracks")
def playlist_add(
    pid: int,
    body: PlaylistTrackBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    playlist = (
        db.query(Playlist)
        .filter_by(
            id=pid,
            user_id=user.id,
        )
        .first()
    )

    track = db.get(
        Track,
        body.track_id,
    )

    if not playlist or not track:
        raise HTTPException(
            status_code=404,
            detail="Playlist or track not found",
        )

    exists = (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=pid,
            track_id=track.id,
        )
        .first()
    )

    if not exists:

        position = (
            db.query(
                func.count(
                    PlaylistTrack.id
                )
            )
            .filter_by(
                playlist_id=pid
            )
            .scalar()
            or 0
        )

        db.add(
            PlaylistTrack(
                playlist_id=pid,
                track_id=track.id,
                position=position,
            )
        )

        db.commit()

    return {
        "ok": True,
    }


@app.delete(
    "/api/playlists/{pid}/tracks/{track_id}"
)
def playlist_remove(
    pid: int,
    track_id: int,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    playlist = (
        db.query(Playlist)
        .filter_by(
            id=pid,
            user_id=user.id,
        )
        .first()
    )

    item = (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=pid,
            track_id=track_id,
        )
        .first()
    )

    if not playlist or not item:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    db.delete(item)
    db.commit()

    return {
        "ok": True,
    }


# ============================================================
# ARTISTS / ALBUMS
# ============================================================

@app.get("/api/artists")
def artists(
    db: Session = Depends(db_dep),
):

    rows = (
        db.query(
            Track.artist,
            func.sum(
                Track.plays
            ).label("plays"),
            func.count(
                Track.id
            ).label("tracks"),
        )
        .group_by(
            Track.artist
        )
        .order_by(
            func.sum(
                Track.plays
            ).desc()
        )
        .all()
    )

    return [
        {
            "name": artist,
            "plays": int(
                plays or 0
            ),
            "tracks": int(
                count
            ),
        }
        for artist, plays, count in rows
    ]


@app.get("/api/albums")
def albums(
    db: Session = Depends(db_dep),
):

    rows = (
        db.query(
            Track.album,
            Track.artist,
            func.count(
                Track.id
            ).label("tracks"),
        )
        .group_by(
            Track.album,
            Track.artist,
        )
        .all()
    )

    return [
        {
            "album": album,
            "artist": artist,
            "tracks": int(
                count
            ),
        }
        for album, artist, count in rows
    ]


# ============================================================
# PROFILE STATS
# ============================================================

@app.get("/api/profile/stats")
def profile_stats(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    liked = (
        db.query(Like)
        .filter_by(
            user_id=user.id
        )
        .count()
    )

    history_count = (
        db.query(History)
        .filter_by(
            user_id=user.id
        )
        .count()
    )

    playlist_count = (
        db.query(Playlist)
        .filter_by(
            user_id=user.id
        )
        .count()
    )

    minutes = int(
        (
            db.query(
                func.coalesce(
                    func.sum(
                        Track.duration
                    ),
                    0,
                )
            )
            .join(
                History,
                History.track_id
                == Track.id,
            )
            .filter(
                History.user_id
                == user.id
            )
            .scalar()
            or 0
        )
        / 60
    )

    return {
        "minutes_listened": minutes,
        "tracks_played": history_count,
        "liked_tracks": liked,
        "playlists": playlist_count,
        "telegram_linked": bool(
            user.telegram_id
        ),
    }


# ============================================================
# ADMIN — LYRICS
# ============================================================

@app.patch(
    "/api/admin/tracks/{track_id}/lyrics"
)
def admin_update_lyrics(
    track_id: int,
    body: LyricsBody,
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    track = db.get(
        Track,
        track_id,
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    track.lyrics = (
        body.lyrics
        if body.lyrics is not None
        else None
    )

    if body.lyrics_sync is None:
        track.lyrics_sync = None

    else:

        try:
            normalized = []

            for item in body.lyrics_sync:

                if not isinstance(
                    item,
                    dict,
                ):
                    continue

                time_value = float(
                    item.get(
                        "time",
                        0,
                    )
                )

                text_value = str(
                    item.get(
                        "text",
                        "",
                    )
                ).strip()

                if not text_value:
                    continue

                normalized.append(
                    {
                        "time": max(
                            0,
                            time_value,
                        ),
                        "text": text_value,
                    }
                )

            normalized.sort(
                key=lambda x: x["time"]
            )

            track.lyrics_sync = json.dumps(
                normalized,
                ensure_ascii=False,
            )

        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid lyrics_sync: {exc}"
                ),
            )

    db.commit()
    db.refresh(track)

    return {
        "ok": True,
        "lyrics": track.lyrics or "",
        "synced": parse_lyrics_sync(
            track.lyrics_sync
        ),
    }


# ============================================================
# ADMIN — MUSIC UPLOAD
# ============================================================

@app.post("/api/admin/tracks")
async def admin_upload_track(
    title: str = Form(...),
    artist: str = Form(...),
    album: str = Form(...),
    genre: str = Form("Pop"),
    duration: int = Form(0),
    audio: UploadFile = File(...),
    cover: Optional[UploadFile] = File(None),
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    original_name = (
        audio.filename
        or "audio.mp3"
    )

    filename = (
        f"{uuid.uuid4().hex}_"
        f"{clean_filename(original_name, 'audio.mp3')}"
    )

    path = AUDIO_DIR / filename

    with path.open("wb") as file:

        while True:

            chunk = await audio.read(
                1024 * 1024
            )

            if not chunk:
                break

            file.write(chunk)

    cover_url = None

    if cover:

        cover_name = (
            f"{uuid.uuid4().hex}_"
            f"{clean_filename("
                f"cover.filename or 'cover.jpg', "
                f"'cover.jpg'"
            )}"
        )

        cover_path = (
            COVER_DIR / cover_name
        )

        with cover_path.open("wb") as file:

            while True:

                chunk = await cover.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                file.write(chunk)

        cover_url = (
            f"/api/media/covers/"
            f"{cover_path.name}"
        )

    track = Track(
        title=title.strip()[:255],
        artist=artist.strip()[:255],
        album=album.strip()[:255],
        genre=(
            genre.strip()[:100]
            or "Pop"
        ),
        duration=max(
            0,
            duration,
        ),
        audio_path=normalize_saved_path(
            path
        ),
        cover_url=cover_url,
        plays=0,
    )

    db.add(track)
    db.commit()
    db.refresh(track)

    print(
        f"[ADMIN] Track uploaded "
        f"id={track.id} "
        f"title={track.title}"
    )

    return track_json(track)


# ============================================================
# ADMIN — USERS / STATS
# ============================================================

@app.get("/api/admin/users")
def admin_users(
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    return [
        user_json(item)
        for item in (
            db.query(User)
            .order_by(
                User.created_at.desc()
            )
            .limit(500)
            .all()
        )
    ]


@app.get("/api/admin/stats")
def admin_stats(
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    return {
        "users": db.query(
            User
        ).count(),

        "tracks": db.query(
            Track
        ).count(),

        "plays": int(
            db.query(
                func.coalesce(
                    func.sum(
                        Track.plays
                    ),
                    0,
                )
            ).scalar()
            or 0
        ),

        "likes": db.query(
            Like
        ).count(),

        "playlists": db.query(
            Playlist
        ).count(),

        "telegram_linked": (
            db.query(User)
            .filter(
                User.telegram_id.isnot(None)
            )
            .count()
        ),

        "tracks_with_lyrics": (
            db.query(Track)
            .filter(
                Track.lyrics.isnot(None),
                Track.lyrics != "",
            )
            .count()
        ),
    }


# ============================================================
# ADMIN — DELETE TRACK
# ============================================================

@app.delete(
    "/api/admin/tracks/{track_id}"
)
def admin_delete_track(
    track_id: int,
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    track = db.get(
        Track,
        track_id,
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    path = resolve_audio_path(
        track.audio_path
    )

    if path:
        try:
            path.unlink(
                missing_ok=True
            )
        except Exception as exc:
            print(
                f"[DELETE] Audio delete error: "
                f"{exc}"
            )

    if (
        track.cover_url
        and track.cover_url.startswith(
            "/api/media/covers/"
        )
    ):
        try:
            (
                COVER_DIR
                / Path(
                    track.cover_url
                ).name
            ).unlink(
                missing_ok=True
            )
        except Exception:
            pass

    db.delete(track)
    db.commit()

    return {
        "ok": True,
    }


# ============================================================
# ADMIN — SCAN
# ============================================================

@app.post("/api/admin/scan")
def admin_scan(
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    result = scan_music(db)

    print(
        f"[ADMIN SCAN] {result}"
    )

    return result


# ============================================================
# MEDIA
# ============================================================

@app.get(
    "/api/media/covers/{filename}"
)
def media_cover(
    filename: str,
):

    path = (
        COVER_DIR
        / Path(filename).name
    )

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Cover not found",
        )

    return FileResponse(
        path
    )


# ============================================================
# DEBUG — CURRENT USER / TELEGRAM
# ============================================================

@app.get("/api/debug/session")
def debug_session(
    user=Depends(current_user),
):

    return {
        "ok": True,
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "telegram_id": user.telegram_id,
        "telegram_linked": bool(
            user.telegram_id
        ),
        "has_link_token": bool(
            user.telegram_link_token
        ),
        "link_token_expires_at": (
            normalize_datetime(
                user.telegram_link_expires_at
            ).isoformat()
            if user.telegram_link_expires_at
            else None
        ),
    }


# ============================================================
# FRONTEND
# ============================================================

DIST_DIR = (
    PROJECT_DIR
    / "frontend"
    / "dist"
)

if DIST_DIR.exists():

    ASSETS_DIR = (
        DIST_DIR / "assets"
    )

    if ASSETS_DIR.exists():

        app.mount(
            "/assets",
            StaticFiles(
                directory=ASSETS_DIR
            ),
            name="assets",
        )


@app.get(
    "/",
    response_class=HTMLResponse,
)
def frontend_root():

    index = (
        DIST_DIR
        / "index.html"
    )

    if index.exists():

        return HTMLResponse(
            index.read_text(
                encoding="utf-8"
            )
        )

    return HTMLResponse(
        f"""
        <h1>FENIX MUSIC {APP_VERSION}</h1>
        <p>Frontend build not found.</p>
        """
    )


@app.get(
    "/{full_path:path}",
    response_class=HTMLResponse,
)
def spa_fallback(
    full_path: str,
):

    if full_path.startswith(
        "api/"
    ):
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    candidate = (
        DIST_DIR
        / full_path
    )

    try:

        candidate = candidate.resolve()

        dist_resolved = (
            DIST_DIR.resolve()
        )

        if (
            dist_resolved in candidate.parents
            and candidate.is_file()
        ):
            return FileResponse(
                candidate
            )

    except Exception:
        pass

    index = (
        DIST_DIR
        / "index.html"
    )

    if index.exists():

        return HTMLResponse(
            index.read_text(
                encoding="utf-8"
            )
        )

    raise HTTPException(
        status_code=404,
        detail="Not found",
    )
