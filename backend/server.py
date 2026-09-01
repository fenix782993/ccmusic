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

APP_VERSION = "8.0.0"

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

MEDIA_DIR = Path(
    os.getenv("MEDIA_DIR", str(BASE_DIR / "media"))
)

AUDIO_DIR = MEDIA_DIR / "audio"
MUSIC_DIR = MEDIA_DIR / "music"
UPLOAD_DIR = MEDIA_DIR / "uploads"
COVER_DIR = MEDIA_DIR / "covers"

for d in (AUDIO_DIR, MUSIC_DIR, UPLOAD_DIR, COVER_DIR):
    d.mkdir(parents=True, exist_ok=True)


# ============================================================
# DATABASE
# ============================================================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./fenix_music.db"
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
    os.getenv("ACCESS_MINUTES", "10080")
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

bearer = HTTPBearer(auto_error=False)


# ============================================================
# MODELS
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)

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

    # Telegram account
    telegram_id = Column(
        String(64),
        unique=True,
        nullable=True,
        index=True,
    )

    # Temporary secure linking token
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

    # Lyrics
    lyrics = Column(
        Text,
        nullable=True,
    )

    # JSON:
    # [
    #   {"time": 0, "text": "Intro"},
    #   {"time": 12.5, "text": "Hello"}
    # ]
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


Base.metadata.create_all(engine)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="FENIX MUSIC API",
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        x.strip()
        for x in os.getenv(
            "CORS_ORIGINS",
            "*",
        ).split(",")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HELPERS
# ============================================================

def utcnow():
    return datetime.now(timezone.utc)


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

        for table, cols in table_specs.items():

            if table not in tables:
                continue

            existing = {
                c["name"]
                for c in inspect(conn).get_columns(table)
            }

            for name, definition in cols.items():

                if name not in existing:

                    conn.execute(
                        text(
                            f'ALTER TABLE "{table}" '
                            f'ADD COLUMN "{name}" {definition}'
                        )
                    )

        # ----------------------------------------------------
        # USERS
        # ----------------------------------------------------

        if "users" in tables:

            cols = {
                c["name"]
                for c in inspect(conn).get_columns("users")
            }

            for name in cols - {
                "id",
                "email",
                "username",
                "password_hash",
                "is_admin",
            }:

                try:
                    conn.execute(
                        text(
                            f'ALTER TABLE "users" '
                            f'ALTER COLUMN "{name}" DROP NOT NULL'
                        )
                    )
                except Exception:
                    pass

            conn.execute(
                text(
                    "UPDATE users "
                    "SET bio = COALESCE(bio, '') "
                    "WHERE bio IS NULL"
                )
            )

        # ----------------------------------------------------
        # TRACKS
        # ----------------------------------------------------

        if "tracks" in tables:

            cols = {
                c["name"]
                for c in inspect(conn).get_columns("tracks")
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
                    conn.execute(
                        text(
                            f'ALTER TABLE "tracks" '
                            f'ALTER COLUMN "{name}" DROP NOT NULL'
                        )
                    )
                except Exception:
                    pass

            conn.execute(
                text(
                    "UPDATE tracks "
                    "SET title = COALESCE(NULLIF(title,''),'Unknown Track') "
                    "WHERE title IS NULL OR title=''"
                )
            )

            conn.execute(
                text(
                    "UPDATE tracks "
                    "SET artist = COALESCE(NULLIF(artist,''),'Unknown Artist') "
                    "WHERE artist IS NULL OR artist=''"
                )
            )

            conn.execute(
                text(
                    "UPDATE tracks "
                    "SET album = COALESCE(NULLIF(album,''),'Unknown Album') "
                    "WHERE album IS NULL OR album=''"
                )
            )

            conn.execute(
                text(
                    "UPDATE tracks "
                    "SET genre = COALESCE(NULLIF(genre,''),'Pop') "
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

            # Старые пустые записи без аудио удаляем.
            conn.execute(
                text(
                    "DELETE FROM tracks "
                    "WHERE audio_path IS NULL "
                    "OR BTRIM(audio_path) = ''"
                )
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
            c = candidate.resolve()

            if c.exists() and c.is_file():
                return c

        except Exception:
            pass

    return None


def normalize_saved_path(path: Path) -> str:

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

                                v = tags[name]

                                if isinstance(
                                    v,
                                    (list, tuple),
                                ):
                                    return (
                                        str(v[0])
                                        if v
                                        else None
                                    )

                                return str(v)

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


def extract_cover(path: Path) -> Optional[Path]:

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
                if p.is_file()
                and p.suffix.lower() in allowed
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
                    Track.audio_path
                    == normalized
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

def user_json(u):

    return {
        "id": u.id,
        "email": u.email,
        "username": u.username,
        "avatar_url": u.avatar_url,
        "bio": u.bio or "",
        "is_admin": bool(u.is_admin),
        "telegram_linked": bool(u.telegram_id),
        "created_at": u.created_at,
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


def track_json(t):

    return {
        "id": t.id,
        "title": t.title,
        "artist": t.artist,
        "album": t.album,
        "genre": t.genre or "Pop",
        "duration": int(t.duration or 0),

        "duration_label": (
            f"{int(t.duration or 0) // 60}:"
            f"{int(t.duration or 0) % 60:02d}"
        ),

        "cover_url": t.cover_url,

        "audio_url": (
            f"/api/tracks/{t.id}/stream"
            if (
                t.audio_path
                and resolve_audio_path(t.audio_path)
            )
            else None
        ),

        "plays": int(t.plays or 0),

        "has_lyrics": bool(
            (t.lyrics or "").strip()
        ),

        "has_synced_lyrics": bool(
            parse_lyrics_sync(
                t.lyrics_sync
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
            "exp": now
            + timedelta(
                minutes=ACCESS_MINUTES
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
            401,
            "Authorization required",
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
    ):

        raise HTTPException(
            401,
            "Invalid or expired token",
        )

    user = db.get(
        User,
        uid,
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
            400,
            "Username must be at least 3 characters",
        )

    if len(body.password) < 6:

        raise HTTPException(
            400,
            "Password must be at least 6 characters",
        )

    if (
        db.query(User)
        .filter(
            or_(
                User.email == email,
                User.username == username,
            )
        )
        .first()
    ):

        raise HTTPException(
            409,
            "Email or username already exists",
        )

    u = User(
        email=email,
        username=username,
        password_hash=pwd.hash(
            body.password
        ),
        bio="",
        is_admin=False,
    )

    db.add(u)
    db.commit()
    db.refresh(u)

    return {
        "token": make_token(u),
        "user": user_json(u),
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

    u = (
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
        not u
        or not pwd.verify(
            body.password,
            u.password_hash,
        )
    ):

        raise HTTPException(
            401,
            "Invalid email/username or password",
        )

    u.last_login = utcnow()

    db.commit()

    return {
        "token": make_token(u),
        "user": user_json(u),
    }


@app.patch("/api/auth/me")
def update_me(
    body: ProfileBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    if body.username is not None:

        username = body.username.strip()

        if len(username) < 3:

            raise HTTPException(
                400,
                "Username must be at least 3 characters",
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

        user.avatar_url = (
            body.avatar_url.strip()
            or None
        )

    if body.bio is not None:

        user.bio = body.bio[:1000]

    user.updated_at = utcnow()

    db.commit()
    db.refresh(user)

    return user_json(user)


# ============================================================
# TELEGRAM LINKING
# ============================================================

@app.get("/api/telegram/status")
def telegram_status(
    user=Depends(current_user),
):

    return {
        "linked": bool(user.telegram_id),
        "telegram_id": user.telegram_id,
    }


@app.post("/api/telegram/link-token")
def telegram_link_token(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    # Delete old token first.
    user.telegram_link_token = None
    user.telegram_link_expires_at = None

    token = secrets.token_urlsafe(32)

    user.telegram_link_token = token

    user.telegram_link_expires_at = (
        utcnow()
        + timedelta(minutes=10)
    )

    db.commit()

    return {
        "token": token,
        "expires_in": 600,
        "expires_at": user.telegram_link_expires_at,
        "command": f"/link {token}",
    }


@app.post("/api/telegram/unlink")
def telegram_unlink(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    user.telegram_id = None
    user.telegram_link_token = None
    user.telegram_link_expires_at = None

    db.commit()

    return {
        "ok": True,
        "linked": False,
    }


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
        track_json(t)
        for t in query
        .offset(offset)
        .limit(
            min(
                max(limit, 1),
                500,
            )
        )
        .all()
    ]


@app.get("/api/tracks/{track_id}")
def get_track(
    track_id: int,
    db: Session = Depends(db_dep),
):

    t = db.get(
        Track,
        track_id,
    )

    if not t:

        raise HTTPException(
            404,
            "Track not found",
        )

    return track_json(t)


# ============================================================
# STREAM
# ============================================================

@app.get("/api/tracks/{track_id}/stream")
def stream(
    track_id: int,
    db: Session = Depends(db_dep),
):

    t = db.get(
        Track,
        track_id,
    )

    path = resolve_audio_path(
        t.audio_path
        if t
        else None
    )

    if not t or not path:

        raise HTTPException(
            404,
            "Audio file not found",
        )

    t.plays = (
        int(t.plays or 0)
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
    q: str = Query(min_length=1),
    db: Session = Depends(db_dep),
):

    pattern = f"%{q}%"

    ts = (
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
            track_json(t)
            for t in ts
        ],
        "artists": sorted(
            {t.artist for t in ts}
        ),
        "albums": sorted(
            {t.album for t in ts}
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
        track_json(t)
        for t in (
            db.query(Track)
            .order_by(
                Track.plays.desc(),
                Track.created_at.desc(),
            )
            .limit(
                min(limit, 50)
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
    limit: int = Query(50, ge=1, le=100),
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
                400,
                "Invalid chart period. "
                "Use all, day, week or month.",
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
            404,
            "Track not found",
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
        x.track_id
        for x in (
            db.query(Like)
            .filter_by(
                user_id=user.id
            )
            .all()
        )
    ]

    ts = (
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
            track_json(t)
            for t in ts
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
            404,
            "Track not found",
        )

    x = (
        db.query(Like)
        .filter_by(
            user_id=user.id,
            track_id=track_id,
        )
        .first()
    )

    if body.liked and not x:

        db.add(
            Like(
                user_id=user.id,
                track_id=track_id,
            )
        )

    elif not body.liked and x:

        db.delete(x)

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
        "ok": True
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

    out = []

    for r in rows:

        t = db.get(
            Track,
            r.track_id,
        )

        if t:

            out.append(
                {
                    "played_at": r.played_at,
                    "track": track_json(t),
                }
            )

    return out


# ============================================================
# PLAYLISTS
# ============================================================

@app.get("/api/playlists")
def playlists(
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    ps = (
        db.query(Playlist)
        .filter_by(
            user_id=user.id
        )
        .order_by(
            Playlist.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "cover_url": p.cover_url,
            "is_public": p.is_public,
            "tracks": [
                track_json(t)
                for x in (
                    db.query(PlaylistTrack)
                    .filter_by(
                        playlist_id=p.id
                    )
                    .order_by(
                        PlaylistTrack.position
                    )
                    .all()
                )
                if (
                    t := db.get(
                        Track,
                        x.track_id,
                    )
                )
            ],
        }
        for p in ps
    ]


@app.post("/api/playlists")
def create_playlist(
    body: PlaylistBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    p = Playlist(
        user_id=user.id,
        name=body.name.strip(),
        description=body.description,
        is_public=body.is_public,
    )

    db.add(p)
    db.commit()
    db.refresh(p)

    return {
        "id": p.id,
        "name": p.name,
    }


@app.patch("/api/playlists/{pid}")
def update_playlist(
    pid: int,
    body: PlaylistBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    p = (
        db.query(Playlist)
        .filter_by(
            id=pid,
            user_id=user.id,
        )
        .first()
    )

    if not p:

        raise HTTPException(
            404,
            "Playlist not found",
        )

    p.name = body.name.strip()
    p.description = body.description
    p.is_public = body.is_public

    db.commit()

    return {
        "ok": True
    }


@app.delete("/api/playlists/{pid}")
def delete_playlist(
    pid: int,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    p = (
        db.query(Playlist)
        .filter_by(
            id=pid,
            user_id=user.id,
        )
        .first()
    )

    if not p:

        raise HTTPException(
            404,
            "Playlist not found",
        )

    db.delete(p)
    db.commit()

    return {
        "ok": True
    }


@app.post("/api/playlists/{pid}/tracks")
def playlist_add(
    pid: int,
    body: PlaylistTrackBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    p = (
        db.query(Playlist)
        .filter_by(
            id=pid,
            user_id=user.id,
        )
        .first()
    )

    t = db.get(
        Track,
        body.track_id,
    )

    if not p or not t:

        raise HTTPException(
            404,
            "Playlist or track not found",
        )

    exists = (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=pid,
            track_id=t.id,
        )
        .first()
    )

    if not exists:

        pos = (
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
                track_id=t.id,
                position=pos,
            )
        )

        db.commit()

    return {
        "ok": True
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

    p = (
        db.query(Playlist)
        .filter_by(
            id=pid,
            user_id=user.id,
        )
        .first()
    )

    x = (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=pid,
            track_id=track_id,
        )
        .first()
    )

    if not p or not x:

        raise HTTPException(
            404,
            "Not found",
        )

    db.delete(x)
    db.commit()

    return {
        "ok": True
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
            "name": a,
            "plays": int(p or 0),
            "tracks": int(c),
        }
        for a, p, c in rows
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
            "album": a,
            "artist": ar,
            "tracks": int(c),
        }
        for a, ar, c in rows
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

@app.patch("/api/admin/tracks/{track_id}/lyrics")
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
            404,
            "Track not found",
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

            # Normalize sync entries.
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
                400,
                f"Invalid lyrics_sync: {exc}",
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

    filename = (
        f"{uuid.uuid4().hex}_"
        f"{clean_filename(audio.filename or 'audio.mp3', 'audio.mp3')}"
    )

    path = AUDIO_DIR / filename

    with path.open("wb") as f:

        while chunk := await audio.read(
            1024 * 1024
        ):

            f.write(chunk)

    cover_url = None

    if cover:

        cp = (
            COVER_DIR
            / f"{uuid.uuid4().hex}_"
            f"{clean_filename(cover.filename or 'cover.jpg', 'cover.jpg')}"
        )

        with cp.open("wb") as f:

            while chunk := await cover.read(
                1024 * 1024
            ):

                f.write(chunk)

        cover_url = (
            f"/api/media/covers/{cp.name}"
        )

    t = Track(
        title=title.strip()[:255],
        artist=artist.strip()[:255],
        album=album.strip()[:255],
        genre=genre.strip()[:100] or "Pop",
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

    db.add(t)
    db.commit()
    db.refresh(t)

    return track_json(t)


# ============================================================
# ADMIN — USERS / STATS
# ============================================================

@app.get("/api/admin/users")
def admin_users(
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    return [
        user_json(u)
        for u in (
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
        "likes": db.query(Like).count(),
        "playlists": db.query(
            Playlist
        ).count(),
        "telegram_linked": db.query(
            User
        ).filter(
            User.telegram_id.isnot(None)
        ).count(),
        "tracks_with_lyrics": db.query(
            Track
        ).filter(
            Track.lyrics.isnot(None),
            Track.lyrics != "",
        ).count(),
    }


# ============================================================
# ADMIN — DELETE TRACK
# ============================================================

@app.delete("/api/admin/tracks/{track_id}")
def admin_delete_track(
    track_id: int,
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    t = db.get(
        Track,
        track_id,
    )

    if not t:

        raise HTTPException(
            404,
            "Track not found",
        )

    path = resolve_audio_path(
        t.audio_path
    )

    if path:

        path.unlink(
            missing_ok=True
        )

    if (
        t.cover_url
        and t.cover_url.startswith(
            "/api/media/covers/"
        )
    ):

        (
            COVER_DIR
            / Path(t.cover_url).name
        ).unlink(
            missing_ok=True
        )

    db.delete(t)
    db.commit()

    return {
        "ok": True
    }


# ============================================================
# ADMIN — SCAN
# ============================================================

@app.post("/api/admin/scan")
def admin_scan(
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    return scan_music(db)


# ============================================================
# MEDIA
# ============================================================

@app.get("/api/media/covers/{filename}")
def media_cover(
    filename: str,
):

    p = (
        COVER_DIR
        / Path(filename).name
    )

    if not p.exists():

        raise HTTPException(
            404,
            "Cover not found",
        )

    return FileResponse(p)


# ============================================================
# FRONTEND
# ============================================================

DIST_DIR = (
    PROJECT_DIR
    / "frontend"
    / "dist"
)

if DIST_DIR.exists():

    app.mount(
        "/assets",
        StaticFiles(
            directory=DIST_DIR / "assets"
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

    if full_path.startswith("api/"):

        raise HTTPException(
            404,
            "Not found",
        )

    candidate = (
        DIST_DIR
        / full_path
    )

    try:

        candidate = candidate.resolve()

        if (
            DIST_DIR.resolve()
            in candidate.parents
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
        404,
        "Not found",
    )
