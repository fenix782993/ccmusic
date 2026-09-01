import os
import re
import uuid
import time
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
from fastapi.responses import FileResponse
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
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from jose import jwt
from passlib.context import CryptContext


# ============================================================
# FENIX MUSIC
# ============================================================

APP_NAME = "FENIX MUSIC"
APP_VERSION = "6.1.0"

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

FRONTEND_DIST = PROJECT_DIR / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"

# ------------------------------------------------------------
# MEDIA
# ------------------------------------------------------------

MEDIA_DIR = Path(
    os.getenv(
        "MEDIA_DIR",
        str(BASE_DIR / "media"),
    )
)

AUDIO_DIR = MEDIA_DIR / "audio"
COVER_DIR = MEDIA_DIR / "covers"
MUSIC_DIR = MEDIA_DIR / "music"
UPLOADS_DIR = MEDIA_DIR / "uploads"

for directory in (
    AUDIO_DIR,
    COVER_DIR,
    MUSIC_DIR,
    UPLOADS_DIR,
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
    f"sqlite:///{BASE_DIR / 'fenix_music.db'}",
)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )

if (
    DATABASE_URL.startswith("postgresql://")
    and "+psycopg2" not in DATABASE_URL
):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+psycopg2://",
        1,
    )

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args=(
        {"check_same_thread": False}
        if DATABASE_URL.startswith("sqlite")
        else {}
    ),
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
    "CHANGE_THIS_SECRET_IN_PRODUCTION",
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
)

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
    )

    is_admin = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
    )

    likes = relationship(
        "Like",
        cascade="all, delete-orphan",
        backref="user",
    )

    playlists = relationship(
        "Playlist",
        cascade="all, delete-orphan",
        backref="user",
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
        default="Unknown",
    )

    duration = Column(
        Integer,
        default=0,
    )

    cover_url = Column(
        String(500),
    )

    audio_path = Column(
        String(500),
    )

    plays = Column(
        Integer,
        default=0,
        nullable=False,
    )

    created_at = Column(
        DateTime,
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
        DateTime,
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
        DateTime,
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
    )

    is_public = Column(
        Boolean,
        default=True,
    )

    created_at = Column(
        DateTime,
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
# DATABASE MIGRATION
# ============================================================

def table_exists(name):
    try:
        return inspect(engine).has_table(name)
    except Exception:
        return False


def columns(name):
    try:
        return {
            column["name"]
            for column in inspect(engine).get_columns(name)
        }
    except Exception:
        return set()


def add_col(
    table,
    column,
    pg_type,
    sqlite_type,
):
    if not table_exists(table):
        return

    if column in columns(table):
        return

    ddl = (
        pg_type
        if engine.dialect.name == "postgresql"
        else sqlite_type
    )

    if engine.dialect.name == "postgresql":
        sql = (
            f'ALTER TABLE "{table}" '
            f'ADD COLUMN IF NOT EXISTS '
            f'"{column}" {ddl}'
        )
    else:
        sql = (
            f'ALTER TABLE "{table}" '
            f'ADD COLUMN "{column}" {ddl}'
        )

    try:
        with engine.begin() as conn:
            conn.execute(text(sql))

        print(
            f"[MIGRATION] {table}.{column} added"
        )

    except Exception as exc:
        print(
            f"[MIGRATION WARNING] "
            f"{table}.{column}: {exc}"
        )


def migrate_database():
    print("=" * 68)
    print("FENIX MUSIC DATABASE MIGRATION")
    print("=" * 68)

    Base.metadata.create_all(engine)

    specs = {
        "users": [
            (
                "avatar_url",
                "VARCHAR(500)",
                "VARCHAR(500)",
            ),
            (
                "is_admin",
                "BOOLEAN NOT NULL DEFAULT FALSE",
                "BOOLEAN NOT NULL DEFAULT 0",
            ),
            (
                "created_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "DATETIME DEFAULT CURRENT_TIMESTAMP",
            ),
        ],
        "tracks": [
            (
                "genre",
                "VARCHAR(100) DEFAULT 'Unknown'",
                "VARCHAR(100) DEFAULT 'Unknown'",
            ),
            (
                "duration",
                "INTEGER DEFAULT 0",
                "INTEGER DEFAULT 0",
            ),
            (
                "cover_url",
                "VARCHAR(500)",
                "VARCHAR(500)",
            ),
            (
                "audio_path",
                "VARCHAR(500)",
                "VARCHAR(500)",
            ),
            (
                "plays",
                "INTEGER NOT NULL DEFAULT 0",
                "INTEGER NOT NULL DEFAULT 0",
            ),
            (
                "created_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "DATETIME DEFAULT CURRENT_TIMESTAMP",
            ),
        ],
        "likes": [
            (
                "created_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "DATETIME DEFAULT CURRENT_TIMESTAMP",
            ),
        ],
        "history": [
            (
                "played_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "DATETIME DEFAULT CURRENT_TIMESTAMP",
            ),
        ],
        "playlists": [
            (
                "description",
                "TEXT",
                "TEXT",
            ),
            (
                "cover_url",
                "VARCHAR(500)",
                "VARCHAR(500)",
            ),
            (
                "is_public",
                "BOOLEAN DEFAULT TRUE",
                "BOOLEAN DEFAULT 1",
            ),
            (
                "created_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "DATETIME DEFAULT CURRENT_TIMESTAMP",
            ),
        ],
        "playlist_tracks": [
            (
                "position",
                "INTEGER DEFAULT 0",
                "INTEGER DEFAULT 0",
            ),
        ],
    }

    for table, items in specs.items():
        for column, pg_type, sqlite_type in items:
            add_col(
                table,
                column,
                pg_type,
                sqlite_type,
            )

    print("DATABASE MIGRATION COMPLETE")
    print("=" * 68)


migrate_database()


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
)

origins = [
    item.strip()
    for item in os.getenv(
        "CORS_ORIGINS",
        "*",
    ).split(",")
    if item.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HELPERS
# ============================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def token_for(user):
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": now + timedelta(
            minutes=ACCESS_MINUTES
        ),
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer
    ),
    db: Session = Depends(get_db),
):
    if not credentials:
        raise HTTPException(
            401,
            "Authorization required",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        user_id = int(
            payload["sub"]
        )

    except Exception:
        raise HTTPException(
            401,
            "Invalid or expired token",
        )

    user = db.get(
        User,
        user_id,
    )

    if not user:
        raise HTTPException(
            401,
            "User not found",
        )

    return user


def admin_user(
    user=Depends(current_user),
):
    if not user.is_admin:
        raise HTTPException(
            403,
            "Admin access required",
        )

    return user


def user_json(user):
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "is_admin": bool(user.is_admin),
        "created_at": user.created_at,
    }


def track_json(track):
    duration = int(
        track.duration or 0
    )

    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "genre": track.genre or "Unknown",
        "duration": duration,
        "duration_label": (
            f"{duration // 60}:"
            f"{duration % 60:02d}"
        ),
        "cover_url": track.cover_url,
        "audio_url": (
            f"/api/tracks/"
            f"{track.id}/stream"
            if track.audio_path
            else None
        ),
        "plays": int(
            track.plays or 0
        ),
    }


# ============================================================
# SCHEMAS
# ============================================================

class Register(BaseModel):
    email: EmailStr
    username: str
    password: str


class Login(BaseModel):
    email: EmailStr
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


# ============================================================
# MUSIC SCANNER
# ============================================================

AUDIO_EXTS = {
    ".mp3",
    ".m4a",
    ".aac",
    ".ogg",
    ".wav",
    ".flac",
    ".opus",
}

IMAGE_EXTS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

# Главное:
# audio = основная папка
# music = совместимость со старой структурой
# uploads = persistent storage на Render

SCAN_DIRS = (
    AUDIO_DIR,
    MUSIC_DIR,
    UPLOADS_DIR,
)

SCAN_INTERVAL = int(
    os.getenv(
        "MUSIC_SCAN_INTERVAL",
        "15",
    )
)

_last_scan_at = 0.0


def clean_name(value):
    return re.sub(
        r"\s+",
        " ",
        str(value or "").strip(),
    )


def filename_meta(path):
    stem = path.stem.strip()

    parts = re.split(
        r"\s+-\s+|\s+—\s+|\s+–\s+",
        stem,
        maxsplit=1,
    )

    parts = [
        clean_name(item)
        for item in parts
    ]

    if len(parts) == 2:
        artist = (
            parts[0]
            or "Unknown Artist"
        )

        title = (
            parts[1]
            or stem
        )

        return (
            title,
            artist,
            "Singles",
        )

    return (
        clean_name(stem)
        or "Untitled",
        "Unknown Artist",
        "Singles",
    )


def get_audio_files():
    files = []
    seen = set()

    for directory in SCAN_DIRS:
        if not directory.exists():
            continue

        try:
            candidates = directory.rglob("*")
        except Exception as exc:
            print(
                f"[SCAN] "
                f"directory warning "
                f"{directory}: {exc}"
            )
            continue

        for path in candidates:
            try:
                if not path.is_file():
                    continue

                if (
                    path.suffix.lower()
                    not in AUDIO_EXTS
                ):
                    continue

                resolved = str(
                    path.resolve()
                ).lower()

                if resolved in seen:
                    continue

                seen.add(resolved)
                files.append(path)

            except Exception:
                continue

    return files


def safe_relative_path(path):
    try:
        return str(
            path.resolve().relative_to(
                BASE_DIR.resolve()
            )
        ).replace("\\", "/")

    except ValueError:
        return str(path)


def resolve_audio_path(audio_path):
    if not audio_path:
        return None

    path = Path(audio_path)

    if path.is_absolute():
        return path

    return BASE_DIR / path


def path_is_inside_media(path):
    try:
        resolved = path.resolve()

        for directory in SCAN_DIRS:
            try:
                resolved.relative_to(
                    directory.resolve()
                )
                return True
            except ValueError:
                pass

        return False

    except Exception:
        return False


def find_sidecar_cover(path):
    # song.mp3 -> song.jpg
    # song.mp3 -> song.jpeg
    # song.mp3 -> song.png
    # song.mp3 -> song.webp

    candidates = []

    for extension in IMAGE_EXTS:
        candidates.append(
            path.with_suffix(extension)
        )

    # Также поддерживаем:
    # cover.jpg
    # folder.jpg
    # front.jpg
    # album.jpg

    for name in (
        "cover.jpg",
        "cover.jpeg",
        "cover.png",
        "cover.webp",
        "folder.jpg",
        "folder.jpeg",
        "folder.png",
        "folder.webp",
        "front.jpg",
        "front.jpeg",
        "front.png",
        "front.webp",
        "album.jpg",
        "album.jpeg",
        "album.png",
        "album.webp",
    ):
        candidates.append(
            path.parent / name
        )

    for candidate in candidates:
        if (
            candidate.exists()
            and candidate.is_file()
        ):
            return candidate

    return None


def extract_embedded_cover(path):
    try:
        from mutagen import File as MutagenFile

        audio = MutagenFile(
            str(path)
        )

        if not audio:
            return None

        pictures = getattr(
            audio,
            "pictures",
            None,
        )

        if pictures:
            return pictures[0].data

        # M4A / MP4
        if getattr(
            audio,
            "tags",
            None,
        ):
            covr = audio.tags.get(
                "covr"
            )

            if covr:
                return bytes(
                    covr[0]
                )

    except Exception as exc:
        print(
            f"[COVER] "
            f"embedded warning "
            f"{path.name}: {exc}"
        )

    return None


def cover_for_track(path):
    # --------------------------------------------------------
    # 1. Separate cover рядом с MP3
    # --------------------------------------------------------

    sidecar = find_sidecar_cover(
        path
    )

    if sidecar:
        try:
            cover_id = uuid.uuid5(
                uuid.NAMESPACE_URL,
                str(path.resolve()),
            )

            target = (
                COVER_DIR
                / f"{cover_id}"
                f"{sidecar.suffix.lower()}"
            )

            if not target.exists():
                target.write_bytes(
                    sidecar.read_bytes()
                )

            return (
                f"/api/media/covers/"
                f"{target.name}"
            )

        except Exception as exc:
            print(
                f"[COVER] "
                f"sidecar warning "
                f"{path.name}: {exc}"
            )

    # --------------------------------------------------------
    # 2. Embedded cover внутри MP3
    # --------------------------------------------------------

    embedded = extract_embedded_cover(
        path
    )

    if embedded:
        try:
            cover_id = uuid.uuid5(
                uuid.NAMESPACE_URL,
                str(path.resolve()),
            )

            target = (
                COVER_DIR
                / f"{cover_id}.jpg"
            )

            if not target.exists():
                target.write_bytes(
                    embedded
                )

            return (
                f"/api/media/covers/"
                f"{target.name}"
            )

        except Exception as exc:
            print(
                f"[COVER] "
                f"embedded save warning "
                f"{path.name}: {exc}"
            )

    return None


def read_audio_metadata(path):
    title, artist, album = filename_meta(
        path
    )

    genre = "Unknown"
    duration = 0

    try:
        from mutagen import File as MutagenFile

        audio = MutagenFile(
            str(path),
            easy=True,
        )

        if audio:
            title = clean_name(
                (
                    audio.get("title")
                    or [title]
                )[0]
            )

            artist = clean_name(
                (
                    audio.get("artist")
                    or [artist]
                )[0]
            )

            album = clean_name(
                (
                    audio.get("album")
                    or [album]
                )[0]
            )

            genre = clean_name(
                (
                    audio.get("genre")
                    or ["Unknown"]
                )[0]
            )

            duration = int(
                getattr(
                    audio.info,
                    "length",
                    0,
                )
                or 0
            )

    except Exception as exc:
        print(
            f"[SCAN] "
            f"metadata warning "
            f"{path.name}: {exc}"
        )

    return (
        title,
        artist,
        album,
        genre,
        duration,
    )


def find_existing_track(
    db,
    path,
):
    absolute = str(
        path.resolve()
    )

    relative = safe_relative_path(
        path
    )

    raw = str(path)

    return (
        db.query(Track)
        .filter(
            or_(
                Track.audio_path == raw,
                Track.audio_path == absolute,
                Track.audio_path == relative,
            )
        )
        .first()
    )


def scan_music_folder(db=None):
    own_db = db is None

    if own_db:
        db = SessionLocal()

    files = get_audio_files()

    imported = 0
    updated = 0

    try:
        for path in files:
            existing = find_existing_track(
                db,
                path,
            )

            (
                title,
                artist,
                album,
                genre,
                duration,
            ) = read_audio_metadata(path)

            cover_url = cover_for_track(
                path
            )

            audio_path = str(
                path.resolve()
            )

            if existing:
                changed = False

                values = {
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "genre": genre,
                    "duration": duration,
                    "cover_url": cover_url,
                    "audio_path": audio_path,
                }

                for attribute, value in values.items():
                    if (
                        value is not None
                        and getattr(
                            existing,
                            attribute,
                        ) != value
                    ):
                        setattr(
                            existing,
                            attribute,
                            value,
                        )

                        changed = True

                if changed:
                    updated += 1

            else:
                db.add(
                    Track(
                        title=title,
                        artist=artist,
                        album=album,
                        genre=genre,
                        duration=duration,
                        cover_url=cover_url,
                        audio_path=audio_path,
                        plays=0,
                    )
                )

                imported += 1

        db.commit()

        result = {
            "files": len(files),
            "imported": imported,
            "updated": updated,
            "directories": [
                str(directory)
                for directory in SCAN_DIRS
            ],
        }

        print(
            "[SCAN] "
            f"files={len(files)} "
            f"imported={imported} "
            f"updated={updated}"
        )

        return result

    except Exception:
        db.rollback()
        raise

    finally:
        if own_db:
            db.close()


def auto_scan_if_needed():
    global _last_scan_at

    now = time.time()

    if (
        now - _last_scan_at
        < SCAN_INTERVAL
    ):
        return

    _last_scan_at = now

    try:
        scan_music_folder()
    except Exception as exc:
        print(
            f"[AUTO SCAN ERROR] {exc}"
        )


# ============================================================
# API
# ============================================================

@app.get("/api")
def api_root():
    return {
        "name": "FENIX MUSIC API",
        "version": APP_VERSION,
        "status": "online",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "name": APP_NAME,
        "version": APP_VERSION,
        "database": engine.dialect.name,
        "frontend": FRONTEND_INDEX.exists(),
        "audio_folder": str(AUDIO_DIR),
        "music_folder": str(MUSIC_DIR),
        "uploads_folder": str(UPLOADS_DIR),
        "covers_folder": str(COVER_DIR),
        "scan_directories": [
            str(directory)
            for directory in SCAN_DIRS
        ],
        "time": datetime.now(
            timezone.utc
        ).isoformat(),
    }


# ============================================================
# AUTH
# ============================================================

@app.post("/api/auth/register")
def register(
    body: Register,
    db: Session = Depends(get_db),
):
    email = (
        str(body.email)
        .lower()
        .strip()
    )

    username = body.username.strip()

    if len(username) < 3:
        raise HTTPException(
            400,
            "Username must contain at least 3 characters",
        )

    if len(body.password) < 6:
        raise HTTPException(
            400,
            "Password must contain at least 6 characters",
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
            409,
            "Email or username already exists",
        )

    user = User(
        email=email,
        username=username,
        password_hash=pwd.hash(
            body.password
        ),
        is_admin=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "token": token_for(user),
        "user": user_json(user),
    }


@app.post("/api/auth/login")
def login(
    body: Login,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(
            User.email
            == str(body.email).lower().strip()
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
            401,
            "Invalid email or password",
        )

    return {
        "token": token_for(user),
        "user": user_json(user),
    }


@app.get("/api/auth/me")
def me(
    user=Depends(current_user),
):
    return user_json(user)


@app.patch("/api/auth/me")
def update_me(
    body: ProfileBody,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    if body.username is not None:
        username = body.username.strip()

        if len(username) < 3:
            raise HTTPException(
                400,
                "Username too short",
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
                409,
                "Username already exists",
            )

        user.username = username

    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url

    db.commit()
    db.refresh(user)

    return user_json(user)


# ============================================================
# TRACKS
# ============================================================

@app.get("/api/tracks")
def tracks(
    q: Optional[str] = None,
    genre: Optional[str] = None,
    shuffle: bool = False,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    auto_scan_if_needed()

    limit = max(
        1,
        min(limit, 500),
    )

    offset = max(
        0,
        offset,
    )

    query = db.query(Track)

    if q:
        pattern = f"%{q}%"

        query = query.filter(
            or_(
                Track.title.ilike(pattern),
                Track.artist.ilike(pattern),
                Track.album.ilike(pattern),
                Track.genre.ilike(pattern),
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
        for track in query
        .offset(offset)
        .limit(limit)
        .all()
    ]


@app.get("/api/tracks/{track_id}")
def one_track(
    track_id: int,
    db: Session = Depends(get_db),
):
    track = db.get(
        Track,
        track_id,
    )

    if not track:
        raise HTTPException(
            404,
            "Track not found",
        )

    return track_json(track)


@app.get("/api/tracks/{track_id}/stream")
def stream(
    track_id: int,
    db: Session = Depends(get_db),
):
    track = db.get(
        Track,
        track_id,
    )

    if (
        not track
        or not track.audio_path
    ):
        raise HTTPException(
            404,
            "Audio file not found",
        )

    path = resolve_audio_path(
        track.audio_path
    )

    if (
        not path
        or not path.exists()
        or not path.is_file()
    ):
        raise HTTPException(
            404,
            "Audio file missing",
        )

    if not path_is_inside_media(path):
        raise HTTPException(
            403,
            "Audio file is outside media directories",
        )

    track.plays = (
        track.plays or 0
    ) + 1

    db.commit()

    mime_types = {
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".ogg": "audio/ogg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".opus": "audio/ogg",
    }

    media_type = mime_types.get(
        path.suffix.lower(),
        "application/octet-stream",
    )

    return FileResponse(
        path,
        media_type=media_type,
        filename=path.name,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        },
    )


@app.get("/api/search")
def search(
    q: str = Query(min_length=1),
    db: Session = Depends(get_db),
):
    auto_scan_if_needed()

    pattern = f"%{q}%"

    found = (
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

    return {
        "tracks": [
            track_json(track)
            for track in found
        ],
        "artists": sorted(
            {
                track.artist
                for track in found
            }
        ),
        "albums": sorted(
            {
                track.album
                for track in found
            }
        ),
        "playlists": [],
    }


@app.get("/api/recommendations")
def recommendations(
    limit: int = 30,
    db: Session = Depends(get_db),
):
    auto_scan_if_needed()

    limit = max(
        1,
        min(limit, 100),
    )

    return [
        track_json(track)
        for track in db.query(Track)
        .order_by(func.random())
        .limit(limit)
        .all()
    ]


# ============================================================
# LIKES
# ============================================================

@app.get("/api/library/likes")
def likes(
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    ids = [
        row.track_id
        for row in db.query(Like)
        .filter_by(user_id=user.id)
        .all()
    ]

    tracks_list = (
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
            for track in tracks_list
        ],
    }


@app.put("/api/library/likes/{track_id}")
def like(
    track_id: int,
    body: LikeBody,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    if not db.get(
        Track,
        track_id,
    ):
        raise HTTPException(
            404,
            "Track not found",
        )

    row = (
        db.query(Like)
        .filter_by(
            user_id=user.id,
            track_id=track_id,
        )
        .first()
    )

    if body.liked and not row:
        db.add(
            Like(
                user_id=user.id,
                track_id=track_id,
            )
        )

    elif not body.liked and row:
        db.delete(row)

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
    db: Session = Depends(get_db),
):
    if not db.get(
        Track,
        track_id,
    ):
        raise HTTPException(
            404,
            "Track not found",
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
    db: Session = Depends(get_db),
):
    rows = (
        db.query(History)
        .filter_by(
            user_id=user.id
        )
        .order_by(
            History.played_at.desc()
        )
        .limit(200)
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
    db: Session = Depends(get_db),
):
    rows = (
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

    for playlist in rows:
        links = (
            db.query(PlaylistTrack)
            .filter_by(
                playlist_id=playlist.id
            )
            .order_by(
                PlaylistTrack.position
            )
            .all()
        )

        playlist_tracks = []

        for link in links:
            track = db.get(
                Track,
                link.track_id,
            )

            if track:
                playlist_tracks.append(
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
                "tracks": playlist_tracks,
            }
        )

    return result


@app.post("/api/playlists")
def create_playlist(
    body: PlaylistBody,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()

    if not name:
        raise HTTPException(
            400,
            "Playlist name is required",
        )

    playlist = Playlist(
        user_id=user.id,
        name=name,
        description=body.description,
        is_public=body.is_public,
    )

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description,
        "is_public": playlist.is_public,
    }


@app.delete("/api/playlists/{playlist_id}")
def delete_playlist(
    playlist_id: int,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter_by(
            id=playlist_id,
            user_id=user.id,
        )
        .first()
    )

    if not playlist:
        raise HTTPException(
            404,
            "Playlist not found",
        )

    (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=playlist_id
        )
        .delete(
            synchronize_session=False
        )
    )

    db.delete(playlist)
    db.commit()

    return {
        "ok": True,
    }


@app.post("/api/playlists/{playlist_id}/tracks")
def playlist_add(
    playlist_id: int,
    body: PlaylistTrackBody,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter_by(
            id=playlist_id,
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
            404,
            "Playlist or track not found",
        )

    exists = (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=playlist_id,
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
                playlist_id=playlist_id
            )
            .scalar()
            or 0
        )

        db.add(
            PlaylistTrack(
                playlist_id=playlist_id,
                track_id=track.id,
                position=int(position),
            )
        )

        db.commit()

    return {
        "ok": True,
    }


@app.delete(
    "/api/playlists/{playlist_id}/tracks/{track_id}"
)
def playlist_remove(
    playlist_id: int,
    track_id: int,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter_by(
            id=playlist_id,
            user_id=user.id,
        )
        .first()
    )

    row = (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=playlist_id,
            track_id=track_id,
        )
        .first()
    )

    if not playlist or not row:
        raise HTTPException(
            404,
            "Not found",
        )

    db.delete(row)
    db.commit()

    return {
        "ok": True,
    }


# ============================================================
# ARTISTS / ALBUMS / PROFILE
# ============================================================

@app.get("/api/artists")
def artists(
    db: Session = Depends(get_db),
):
    auto_scan_if_needed()

    rows = (
        db.query(
            Track.artist,
            func.sum(Track.plays),
            func.count(Track.id),
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
            "tracks": int(count),
        }
        for artist, plays, count in rows
    ]


@app.get("/api/albums")
def albums(
    db: Session = Depends(get_db),
):
    auto_scan_if_needed()

    rows = (
        db.query(
            Track.album,
            Track.artist,
            func.count(Track.id),
        )
        .group_by(
            Track.album,
            Track.artist,
        )
        .order_by(
            func.count(
                Track.id
            ).desc()
        )
        .all()
    )

    return [
        {
            "album": album,
            "artist": artist,
            "tracks": int(count),
        }
        for album, artist, count in rows
    ]


@app.get("/api/profile/stats")
def profile_stats(
    user=Depends(current_user),
    db: Session = Depends(get_db),
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

    playlists_count = (
        db.query(Playlist)
        .filter_by(
            user_id=user.id
        )
        .count()
    )

    seconds = (
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

    return {
        "minutes_listened": int(
            seconds / 60
        ),
        "tracks_played": history_count,
        "liked_tracks": liked,
        "playlists": playlists_count,
    }


# ============================================================
# ADMIN
# ============================================================

@app.post("/api/admin/library/scan")
def admin_scan(
    user=Depends(admin_user),
    db: Session = Depends(get_db),
):
    global _last_scan_at

    _last_scan_at = time.time()

    return scan_music_folder(
        db
    )


@app.post("/api/admin/tracks")
async def upload_track(
    title: str = Form(...),
    artist: str = Form(...),
    album: str = Form(...),
    genre: str = Form("Unknown"),
    duration: int = Form(0),
    audio: UploadFile = File(...),
    cover: Optional[UploadFile] = File(None),
    user=Depends(admin_user),
    db: Session = Depends(get_db),
):
    original_name = (
        audio.filename
        or "audio.mp3"
    )

    safe_name = re.sub(
        r"[^a-zA-Z0-9._-]",
        "_",
        original_name,
    )

    path = (
        AUDIO_DIR
        / f"{uuid.uuid4().hex}_{safe_name}"
    )

    with path.open("wb") as output:
        while True:
            chunk = await audio.read(
                1024 * 1024
            )

            if not chunk:
                break

            output.write(chunk)

    cover_url = None

    if cover:
        original_cover_name = (
            cover.filename
            or "cover.jpg"
        )

        safe_cover_name = re.sub(
            r"[^a-zA-Z0-9._-]",
            "_",
            original_cover_name,
        )

        cover_path = (
            COVER_DIR
            / f"{uuid.uuid4().hex}_"
            f"{safe_cover_name}"
        )

        with cover_path.open("wb") as output:
            while True:
                chunk = await cover.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                output.write(chunk)

        cover_url = (
            f"/api/media/covers/"
            f"{cover_path.name}"
        )

    track = Track(
        title=title.strip(),
        artist=artist.strip(),
        album=album.strip(),
        genre=genre.strip() or "Unknown",
        duration=max(
            0,
            duration,
        ),
        cover_url=cover_url,
        audio_path=str(
            path.resolve()
        ),
        plays=0,
    )

    db.add(track)
    db.commit()
    db.refresh(track)

    return track_json(track)


@app.get("/api/admin/users")
def admin_users(
    user=Depends(admin_user),
    db: Session = Depends(get_db),
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
    db: Session = Depends(get_db),
):
    auto_scan_if_needed()

    return {
        "users": db.query(User).count(),
        "tracks": db.query(Track).count(),
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
        "music_files": len(
            get_audio_files()
        ),
    }


@app.delete("/api/admin/tracks/{track_id}")
def admin_delete(
    track_id: int,
    user=Depends(admin_user),
    db: Session = Depends(get_db),
):
    track = db.get(
        Track,
        track_id,
    )

    if not track:
        raise HTTPException(
            404,
            "Track not found",
        )

    audio_path = resolve_audio_path(
        track.audio_path
    )

    if (
        audio_path
        and audio_path.exists()
        and path_is_inside_media(
            audio_path
        )
    ):
        try:
            audio_path.unlink(
                missing_ok=True
            )
        except Exception:
            pass

    if track.cover_url:
        cover_name = (
            track.cover_url
            .rsplit("/", 1)[-1]
        )

        cover_path = (
            COVER_DIR
            / Path(cover_name).name
        )

        try:
            cover_path.unlink(
                missing_ok=True
            )
        except Exception:
            pass

    (
        db.query(Like)
        .filter_by(
            track_id=track_id
        )
        .delete(
            synchronize_session=False
        )
    )

    (
        db.query(History)
        .filter_by(
            track_id=track_id
        )
        .delete(
            synchronize_session=False
        )
    )

    (
        db.query(PlaylistTrack)
        .filter_by(
            track_id=track_id
        )
        .delete(
            synchronize_session=False
        )
    )

    db.delete(track)
    db.commit()

    return {
        "ok": True,
    }


# ============================================================
# COVERS
# ============================================================

@app.get("/api/media/covers/{filename}")
def cover(filename: str):
    safe_filename = Path(
        filename
    ).name

    path = (
        COVER_DIR
        / safe_filename
    )

    if (
        not path.exists()
        or not path.is_file()
    ):
        raise HTTPException(
            404,
            "Cover not found",
        )

    return FileResponse(path)


# ============================================================
# FRONTEND
# ============================================================

if (
    FRONTEND_DIST / "assets"
).exists():
    app.mount(
        "/assets",
        StaticFiles(
            directory=str(
                FRONTEND_DIST / "assets"
            )
        ),
        name="frontend-assets",
    )


@app.get(
    "/",
    include_in_schema=False,
)
def frontend_root():
    if FRONTEND_INDEX.exists():
        return FileResponse(
            FRONTEND_INDEX
        )

    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "status": "online",
        "frontend": False,
        "message": (
            "frontend/dist/"
            "index.html not found"
        ),
    }


@app.get(
    "/{full_path:path}",
    include_in_schema=False,
)
def spa(full_path: str):
    if (
        full_path == "api"
        or full_path.startswith("api/")
    ):
        raise HTTPException(
            404,
            "API route not found",
        )

    if not FRONTEND_INDEX.exists():
        raise HTTPException(
            404,
            "Frontend build not found",
        )

    requested = (
        FRONTEND_DIST
        / full_path
    )

    try:
        requested.resolve().relative_to(
            FRONTEND_DIST.resolve()
        )
    except ValueError:
        raise HTTPException(
            404,
            "Not found",
        )

    if (
        requested.exists()
        and requested.is_file()
    ):
        return FileResponse(
            requested
        )

    return FileResponse(
        FRONTEND_INDEX
    )


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    print("=" * 68)
    print("FENIX MUSIC 6.1 STARTING")
    print(
        f"Database: "
        f"{engine.dialect.name}"
    )
    print(
        f"Frontend: "
        f"{FRONTEND_INDEX.exists()}"
    )
    print(
        f"Audio folder: "
        f"{AUDIO_DIR}"
    )
    print(
        f"Music folder: "
        f"{MUSIC_DIR}"
    )
    print(
        f"Uploads folder: "
        f"{UPLOADS_DIR}"
    )
    print(
        f"Cover folder: "
        f"{COVER_DIR}"
    )
    print("=" * 68)

    try:
        result = scan_music_folder()

        print(
            "[STARTUP SCAN] "
            f"files={result['files']} "
            f"imported={result['imported']} "
            f"updated={result['updated']}"
        )

    except Exception as exc:
        print(
            f"[SCAN ERROR] {exc}"
        )


# ============================================================
# LOCAL START
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=int(
            os.getenv(
                "PORT",
                "8000",
            )
        ),
        reload=False,
    )
