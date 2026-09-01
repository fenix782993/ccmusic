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
from sqlalchemy.orm import (
    declarative_base,
    sessionmaker,
    Session,
    relationship,
)

from jose import jwt, JWTError
from passlib.context import CryptContext


# ============================================================
# CONFIG
# ============================================================

APP_NAME = "FENIX MUSIC"
APP_VERSION = "7.0.0"

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

FRONTEND_DIR = PROJECT_DIR / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"

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
    MEDIA_DIR,
    AUDIO_DIR,
    COVER_DIR,
    MUSIC_DIR,
    UPLOADS_DIR,
):
    directory.mkdir(parents=True, exist_ok=True)


# ============================================================
# DATABASE
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace(
            "postgres://",
            "postgresql://",
            1,
        )

    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace(
            "postgresql://",
            "postgresql+psycopg2://",
            1,
        )

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=1800,
    )

else:
    sqlite_path = BASE_DIR / "fenix_music.db"

    engine = create_engine(
        f"sqlite:///{sqlite_path}",
        connect_args={"check_same_thread": False},
    )


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
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
# APP
# ============================================================

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODELS
# ============================================================


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    username = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash = Column(
        String(255),
        nullable=False,
    )

    avatar_url = Column(
        Text,
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

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    last_login = Column(
        DateTime,
        nullable=True,
    )

    likes = relationship(
        "Like",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    history = relationship(
        "History",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    playlists = relationship(
        "Playlist",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Track(Base):
    __tablename__ = "tracks"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    title = Column(
        String(255),
        nullable=False,
        index=True,
    )

    artist = Column(
        String(255),
        nullable=False,
        default="Unknown Artist",
        index=True,
    )

    album = Column(
        String(255),
        nullable=True,
        default="Unknown Album",
        index=True,
    )

    genre = Column(
        String(100),
        nullable=True,
    )

    duration = Column(
        Integer,
        nullable=True,
        default=0,
    )

    cover_url = Column(
        Text,
        nullable=True,
    )

    audio_path = Column(
        Text,
        nullable=False,
    )

    plays = Column(
        Integer,
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
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
        index=True,
    )

    track_id = Column(
        Integer,
        ForeignKey(
            "tracks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="likes",
    )

    track = relationship(
        "Track",
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "track_id",
            name="uq_like_user_track",
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
        index=True,
    )

    track_id = Column(
        Integer,
        ForeignKey(
            "tracks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    played_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="history",
    )

    track = relationship(
        "Track",
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
        index=True,
    )

    name = Column(
        String(255),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    cover_url = Column(
        Text,
        nullable=True,
    )

    is_public = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="playlists",
    )

    tracks = relationship(
        "PlaylistTrack",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="PlaylistTrack.position",
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
        index=True,
    )

    track_id = Column(
        Integer,
        ForeignKey(
            "tracks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    position = Column(
        Integer,
        default=0,
        nullable=False,
    )

    playlist = relationship(
        "Playlist",
        back_populates="tracks",
    )

    track = relationship(
        "Track",
    )

    __table_args__ = (
        UniqueConstraint(
            "playlist_id",
            "track_id",
            name="uq_playlist_track",
        ),
    )


# ============================================================
# SCHEMAS
# ============================================================


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str


class LoginRequest(BaseModel):
    email: Optional[EmailStr] = None
    login: Optional[str] = None
    password: str


class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class LikeRequest(BaseModel):
    liked: bool


class PlaylistCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    is_public: bool = False


class PlaylistAddTrackRequest(BaseModel):
    track_id: int


# ============================================================
# DB HELPERS
# ============================================================


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def table_exists(
    inspector,
    table_name: str,
) -> bool:
    return table_name in inspector.get_table_names()


def get_columns(
    inspector,
    table_name: str,
):
    if not table_exists(
        inspector,
        table_name,
    ):
        return set()

    return {
        column["name"]
        for column in inspector.get_columns(
            table_name
        )
    }


def add_column(
    table_name: str,
    column_name: str,
    column_type: str,
):
    inspector = inspect(engine)

    if not table_exists(
        inspector,
        table_name,
    ):
        return

    columns = get_columns(
        inspector,
        table_name,
    )

    if column_name in columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                f'ALTER TABLE "{table_name}" '
                f'ADD COLUMN "{column_name}" '
                f"{column_type}"
            )
        )

    print(
        f"[DB MIGRATION] Added "
        f"{table_name}.{column_name}"
    )


def migrate_database():
    """
    Creates missing tables and adds missing columns
    to old PostgreSQL/SQLite databases.

    This specifically fixes old tracks tables that
    don't have artist / album.
    """

    Base.metadata.create_all(engine)

    inspector = inspect(engine)

    # ----------------------------
    # USERS
    # ----------------------------

    add_column(
        "users",
        "avatar_url",
        "TEXT",
    )

    add_column(
        "users",
        "bio",
        "TEXT",
    )

    add_column(
        "users",
        "is_admin",
        "BOOLEAN DEFAULT FALSE",
    )

    add_column(
        "users",
        "created_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    )

    add_column(
        "users",
        "updated_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    )

    add_column(
        "users",
        "last_login",
        "TIMESTAMP",
    )

    # ----------------------------
    # TRACKS
    # ----------------------------

    # These are the important missing columns
    # from the old Render PostgreSQL database.

    add_column(
        "tracks",
        "artist",
        "TEXT DEFAULT 'Unknown Artist'",
    )

    add_column(
        "tracks",
        "album",
        "TEXT DEFAULT 'Unknown Album'",
    )

    add_column(
        "tracks",
        "genre",
        "TEXT",
    )

    add_column(
        "tracks",
        "duration",
        "INTEGER DEFAULT 0",
    )

    add_column(
        "tracks",
        "cover_url",
        "TEXT",
    )

    add_column(
        "tracks",
        "audio_path",
        "TEXT",
    )

    add_column(
        "tracks",
        "plays",
        "INTEGER DEFAULT 0",
    )

    add_column(
        "tracks",
        "created_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    )

    # ----------------------------
    # LIKES
    # ----------------------------

    add_column(
        "likes",
        "created_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    )

    # ----------------------------
    # HISTORY
    # ----------------------------

    add_column(
        "history",
        "played_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    )

    # ----------------------------
    # PLAYLISTS
    # ----------------------------

    add_column(
        "playlists",
        "description",
        "TEXT",
    )

    add_column(
        "playlists",
        "cover_url",
        "TEXT",
    )

    add_column(
        "playlists",
        "is_public",
        "BOOLEAN DEFAULT FALSE",
    )

    add_column(
        "playlists",
        "created_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    )

    # ----------------------------
    # PLAYLIST TRACKS
    # ----------------------------

    add_column(
        "playlist_tracks",
        "position",
        "INTEGER DEFAULT 0",
    )

    # ----------------------------
    # CLEAN NULLS IN OLD DB
    # ----------------------------

    try:
        with engine.begin() as connection:
            if table_exists(
                inspector,
                "tracks",
            ):
                connection.execute(
                    text(
                        """
                        UPDATE tracks
                        SET artist = 'Unknown Artist'
                        WHERE artist IS NULL
                        """
                    )
                )

                connection.execute(
                    text(
                        """
                        UPDATE tracks
                        SET album = 'Unknown Album'
                        WHERE album IS NULL
                        """
                    )
                )

                connection.execute(
                    text(
                        """
                        UPDATE tracks
                        SET plays = 0
                        WHERE plays IS NULL
                        """
                    )
                )

    except Exception as exc:
        print(
            "[DB MIGRATION WARNING]",
            exc,
        )

    print("[DB] Migration completed")


# ============================================================
# PASSWORD / JWT
# ============================================================


def hash_password(
    password: str,
) -> str:
    return pwd.hash(password)


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    try:
        return pwd.verify(
            password,
            password_hash,
        )
    except Exception:
        return False


def create_token(
    user: User,
) -> str:
    expires = datetime.now(
        timezone.utc
    ) + timedelta(
        minutes=ACCESS_MINUTES
    )

    payload = {
        "sub": str(user.id),
        "email": user.email,
        "username": user.username,
        "exp": expires,
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer
    ),
    db: Session = Depends(get_db),
):
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token",
            )

        user = (
            db.query(User)
            .filter(
                User.id == int(user_id)
            )
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=401,
                detail="User not found",
            )

        return user

    except (
        JWTError,
        ValueError,
        TypeError,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer
    ),
    db: Session = Depends(get_db),
):
    if not credentials:
        return None

    try:
        return get_current_user(
            credentials,
            db,
        )
    except HTTPException:
        return None


def require_admin(
    user: User = Depends(
        get_current_user
    ),
):
    if not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return user


# ============================================================
# SERIALIZATION
# ============================================================


def track_json(
    track: Track,
):
    audio_url = (
        f"/api/tracks/{track.id}/stream"
    )

    return {
        "id": track.id,
        "title": track.title or "Unknown Track",
        "artist": track.artist or "Unknown Artist",
        "album": track.album or "Unknown Album",
        "genre": track.genre or "",
        "duration": int(
            track.duration or 0
        ),
        "plays": int(
            track.plays or 0
        ),
        "cover_url": track.cover_url,
        "audio_path": track.audio_path,
        "audio_url": audio_url,
        "created_at": (
            track.created_at.isoformat()
            if track.created_at
            else None
        ),
    }


def user_json(
    user: User,
):
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "bio": user.bio or "",
        "is_admin": bool(
            user.is_admin
        ),
        "created_at": (
            user.created_at.isoformat()
            if user.created_at
            else None
        ),
        "updated_at": (
            user.updated_at.isoformat()
            if user.updated_at
            else None
        ),
        "last_login": (
            user.last_login.isoformat()
            if user.last_login
            else None
        ),
    }


def playlist_json(
    playlist: Playlist,
):
    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": (
            playlist.description or ""
        ),
        "cover_url": playlist.cover_url,
        "is_public": bool(
            playlist.is_public
        ),
        "created_at": (
            playlist.created_at.isoformat()
            if playlist.created_at
            else None
        ),
        "tracks": [
            track_json(item.track)
            for item in playlist.tracks
            if item.track
        ],
    }


# ============================================================
# FILE HELPERS
# ============================================================


AUDIO_EXTENSIONS = {
    ".mp3",
    ".m4a",
    ".aac",
    ".ogg",
    ".wav",
    ".flac",
    ".opus",
}

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


def safe_filename(
    filename: str,
) -> str:
    filename = (
        filename
        or "file"
    )

    filename = Path(
        filename
    ).name

    filename = re.sub(
        r"[^a-zA-Z0-9а-яА-ЯёЁ._ -]+",
        "_",
        filename,
    )

    return filename.strip(
        " ."
    ) or "file"


def normalize_audio_path(
    path: str,
) -> str:
    try:
        return str(
            Path(path).resolve()
        )
    except Exception:
        return str(path)


def find_audio_file(
    audio_path: str,
):
    if not audio_path:
        return None

    candidates = [
        Path(audio_path),
        BASE_DIR / audio_path,
        PROJECT_DIR / audio_path,
    ]

    for candidate in candidates:
        try:
            if candidate.exists():
                return candidate.resolve()
        except Exception:
            pass

    return None


def parse_filename(
    filename: str,
):
    stem = Path(
        filename
    ).stem

    # artist - title
    if " - " in stem:
        artist, title = stem.split(
            " - ",
            1,
        )

        return (
            artist.strip()
            or "Unknown Artist",
            title.strip()
            or "Unknown Track",
        )

    return (
        "Unknown Artist",
        stem.strip()
        or "Unknown Track",
    )


def read_metadata(
    file_path: Path,
):
    artist = None
    title = None
    album = None
    genre = None
    duration = 0
    cover_data = None
    cover_extension = ".jpg"

    filename_artist, filename_title = (
        parse_filename(
            file_path.name
        )
    )

    try:
        from mutagen import File as MutagenFile

        audio = MutagenFile(
            str(file_path),
            easy=False,
        )

        if audio:
            try:
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
            except Exception:
                duration = 0

            tags = audio.tags

            if tags:
                def get_tag(*names):
                    for name in names:
                        if name in tags:
                            value = tags[name]

                            if isinstance(
                                value,
                                list,
                            ):
                                return str(
                                    value[0]
                                )

                            return str(
                                value
                            )

                    return None

                artist = get_tag(
                    "artist",
                    "ARTIST",
                    "\xa9ART",
                )

                title = get_tag(
                    "title",
                    "TITLE",
                    "\xa9nam",
                )

                album = get_tag(
                    "album",
                    "ALBUM",
                    "\xa9alb",
                )

                genre = get_tag(
                    "genre",
                    "GENRE",
                    "\xa9gen",
                )

                # MP3 / ID3 APIC
                try:
                    for key in tags.keys():
                        if str(key).startswith(
                            "APIC"
                        ):
                            picture = tags[key]
                            cover_data = picture.data

                            mime = getattr(
                                picture,
                                "mime",
                                "",
                            )

                            if (
                                mime
                                == "image/png"
                            ):
                                cover_extension = ".png"
                            elif (
                                mime
                                == "image/webp"
                            ):
                                cover_extension = ".webp"

                            break
                except Exception:
                    pass

                # MP4 cover
                try:
                    covr = tags.get("covr")

                    if covr:
                        cover_data = bytes(
                            covr[0]
                        )
                        cover_extension = ".jpg"
                except Exception:
                    pass

    except Exception as exc:
        print(
            "[METADATA WARNING]",
            file_path.name,
            exc,
        )

    artist = (
        artist
        or filename_artist
        or "Unknown Artist"
    )

    title = (
        title
        or filename_title
        or "Unknown Track"
    )

    album = (
        album
        or "Unknown Album"
    )

    return {
        "artist": artist.strip(),
        "title": title.strip(),
        "album": album.strip(),
        "genre": (
            genre.strip()
            if genre
            else ""
        ),
        "duration": duration,
        "cover_data": cover_data,
        "cover_extension": cover_extension,
    }


def find_sidecar_cover(
    audio_file: Path,
):
    for extension in IMAGE_EXTENSIONS:
        candidate = (
            audio_file.with_suffix(
                extension
            )
        )

        if candidate.exists():
            return candidate

    return None


# ============================================================
# MUSIC SCANNER
# ============================================================


_last_scan = 0
_scan_interval = 30


def all_music_files():
    directories = [
        AUDIO_DIR,
        MUSIC_DIR,
        UPLOADS_DIR,
    ]

    result = []

    seen = set()

    for directory in directories:
        if not directory.exists():
            continue

        try:
            for file_path in directory.rglob("*"):
                if not file_path.is_file():
                    continue

                if (
                    file_path.suffix.lower()
                    not in AUDIO_EXTENSIONS
                ):
                    continue

                absolute = str(
                    file_path.resolve()
                )

                if absolute in seen:
                    continue

                seen.add(absolute)
                result.append(
                    file_path
                )

        except Exception as exc:
            print(
                "[SCAN DIRECTORY ERROR]",
                directory,
                exc,
            )

    return result


def existing_track_for_file(
    db: Session,
    file_path: Path,
):
    absolute = normalize_audio_path(
        str(file_path)
    )

    relative = None

    try:
        relative = str(
            file_path.resolve().relative_to(
                PROJECT_DIR.resolve()
            )
        ).replace(
            "\\",
            "/",
        )
    except Exception:
        pass

    tracks = (
        db.query(Track)
        .all()
    )

    for track in tracks:
        stored = (
            track.audio_path
            or ""
        )

        normalized = normalize_audio_path(
            stored
        )

        if normalized == absolute:
            return track

        if (
            relative
            and stored.replace(
                "\\",
                "/",
            )
            == relative
        ):
            return track

        if (
            stored.replace(
                "\\",
                "/",
            )
            == str(file_path).replace(
                "\\",
                "/",
            )
        ):
            return track

    return None


def create_cover_for_track(
    track_id: int,
    file_path: Path,
    metadata: dict,
):
    cover_data = metadata.get(
        "cover_data"
    )

    if cover_data:
        filename = (
            f"{track_id}"
            f"{metadata.get('cover_extension', '.jpg')}"
        )

        target = (
            COVER_DIR / filename
        )

        try:
            target.write_bytes(
                cover_data
            )

            return (
                f"/media/covers/{filename}"
            )

        except Exception as exc:
            print(
                "[COVER WRITE ERROR]",
                exc,
            )

    sidecar = find_sidecar_cover(
        file_path
    )

    if sidecar:
        extension = (
            sidecar.suffix.lower()
        )

        filename = (
            f"{track_id}{extension}"
        )

        target = (
            COVER_DIR / filename
        )

        try:
            target.write_bytes(
                sidecar.read_bytes()
            )

            return (
                f"/media/covers/{filename}"
            )

        except Exception as exc:
            print(
                "[SIDECAR COVER ERROR]",
                exc,
            )

    return None


def scan_music(
    db: Session,
):
    files = all_music_files()

    print(
        f"[SCAN] Found {len(files)} audio files"
    )

    added = 0
    updated = 0

    for file_path in files:
        try:
            metadata = read_metadata(
                file_path
            )

            track = existing_track_for_file(
                db,
                file_path,
            )

            relative_path = None

            try:
                relative_path = str(
                    file_path.resolve().relative_to(
                        PROJECT_DIR.resolve()
                    )
                ).replace(
                    "\\",
                    "/",
                )
            except Exception:
                relative_path = str(
                    file_path
                )

            if not track:
                track = Track(
                    title=metadata["title"],
                    artist=metadata["artist"],
                    album=metadata["album"],
                    genre=metadata["genre"],
                    duration=metadata["duration"],
                    audio_path=relative_path,
                    plays=0,
                )

                db.add(track)
                db.flush()

                cover_url = (
                    create_cover_for_track(
                        track.id,
                        file_path,
                        metadata,
                    )
                )

                track.cover_url = (
                    cover_url
                )

                added += 1

            else:
                changed = False

                if (
                    track.title
                    != metadata["title"]
                ):
                    track.title = (
                        metadata["title"]
                    )
                    changed = True

                if (
                    track.artist
                    != metadata["artist"]
                ):
                    track.artist = (
                        metadata["artist"]
                    )
                    changed = True

                if (
                    track.album
                    != metadata["album"]
                ):
                    track.album = (
                        metadata["album"]
                    )
                    changed = True

                if (
                    track.genre
                    != metadata["genre"]
                ):
                    track.genre = (
                        metadata["genre"]
                    )
                    changed = True

                if (
                    metadata["duration"]
                    and track.duration
                    != metadata["duration"]
                ):
                    track.duration = (
                        metadata["duration"]
                    )
                    changed = True

                if not track.cover_url:
                    cover_url = (
                        create_cover_for_track(
                            track.id,
                            file_path,
                            metadata,
                        )
                    )

                    if cover_url:
                        track.cover_url = (
                            cover_url
                        )
                        changed = True

                if changed:
                    updated += 1

            db.commit()

        except Exception as exc:
            db.rollback()

            print(
                "[SCAN ERROR]",
                file_path,
                exc,
            )

    print(
        f"[SCAN] Added={added}, Updated={updated}"
    )

    return {
        "found": len(files),
        "added": added,
        "updated": updated,
    }


def auto_scan_if_needed(
    db: Session,
):
    global _last_scan

    now = time.time()

    if (
        now - _last_scan
        >= _scan_interval
    ):
        _last_scan = now

        try:
            return scan_music(db)
        except Exception as exc:
            print(
                "[AUTO SCAN ERROR]",
                exc,
            )

    return None


# ============================================================
# STARTUP
# ============================================================


@app.on_event("startup")
def startup():
    print(
        f"[START] {APP_NAME} "
        f"v{APP_VERSION}"
    )

    print(
        "[START] BASE_DIR:",
        BASE_DIR,
    )

    print(
        "[START] MEDIA_DIR:",
        MEDIA_DIR,
    )

    print(
        "[START] MUSIC_DIR:",
        MUSIC_DIR,
    )

    try:
        migrate_database()
    except Exception as exc:
        print(
            "[DB STARTUP ERROR]",
            exc,
        )

    db = SessionLocal()

    try:
        # Create admin if explicitly configured
        # and no such email exists.
        admin = (
            db.query(User)
            .filter(
                func.lower(
                    User.email
                )
                == ADMIN_EMAIL
            )
            .first()
        )

        if (
            not admin
            and ADMIN_PASSWORD
            and ADMIN_PASSWORD
            != "change-me-now"
        ):
            admin = User(
                email=ADMIN_EMAIL,
                username="admin",
                password_hash=hash_password(
                    ADMIN_PASSWORD
                ),
                is_admin=True,
            )

            db.add(admin)
            db.commit()

            print(
                "[AUTH] Admin account created:",
                ADMIN_EMAIL,
            )

        elif admin and not admin.is_admin:
            # Don't unexpectedly promote normal
            # users unless the configured admin
            # credentials explicitly match.
            if ADMIN_PASSWORD != "change-me-now":
                admin.is_admin = True
                db.commit()

        # Scan immediately at startup.
        result = scan_music(db)

        print(
            "[STARTUP SCAN]",
            result,
        )

    except Exception as exc:
        db.rollback()

        print(
            "[STARTUP MUSIC ERROR]",
            exc,
        )

    finally:
        db.close()


# ============================================================
# BASIC
# ============================================================


@app.get("/api")
def api_root():
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "status": "online",
    }


@app.get("/api/health")
def health():
    db_ok = False

    try:
        db = SessionLocal()

        try:
            db.execute(
                text("SELECT 1")
            )
            db_ok = True
        finally:
            db.close()

    except Exception:
        db_ok = False

    return {
        "status": "ok",
        "app": APP_NAME,
        "version": APP_VERSION,
        "database": (
            "ok"
            if db_ok
            else "error"
        ),
        "music_directory": str(
            MUSIC_DIR
        ),
        "music_exists": MUSIC_DIR.exists(),
        "frontend_exists": FRONTEND_INDEX.exists(),
    }


# ============================================================
# AUTH
# ============================================================


@app.post("/api/auth/register")
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = (
        str(payload.email)
        .strip()
        .lower()
    )

    username = (
        payload.username
        .strip()
    )

    password = payload.password

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Username must contain at least 3 characters",
        )

    if len(username) > 32:
        raise HTTPException(
            status_code=400,
            detail="Username is too long",
        )

    if not re.match(
        r"^[a-zA-Z0-9а-яА-ЯёЁ_.-]+$",
        username,
    ):
        raise HTTPException(
            status_code=400,
            detail="Username contains invalid characters",
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 6 characters",
        )

    existing_email = (
        db.query(User)
        .filter(
            func.lower(
                User.email
            )
            == email
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        )

    existing_username = (
        db.query(User)
        .filter(
            func.lower(
                User.username
            )
            == username.lower()
        )
        .first()
    )

    if existing_username:
        raise HTTPException(
            status_code=409,
            detail="Username is already taken",
        )

    user = User(
        email=email,
        username=username,
        password_hash=hash_password(
            password
        ),
        is_admin=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user)

    return {
        "token": token,
        "access_token": token,
        "user": user_json(user),
    }


@app.post("/api/auth/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    identifier = (
        str(
            payload.email
            or payload.login
            or ""
        )
        .strip()
        .lower()
    )

    if not identifier:
        raise HTTPException(
            status_code=400,
            detail="Email or username is required",
        )

    user = (
        db.query(User)
        .filter(
            or_(
                func.lower(
                    User.email
                )
                == identifier,
                func.lower(
                    User.username
                )
                == identifier,
            )
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid login or password",
        )

    if not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid login or password",
        )

    user.last_login = datetime.utcnow()
    user.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(user)

    token = create_token(user)

    return {
        "token": token,
        "access_token": token,
        "user": user_json(user),
    }


@app.post("/api/auth/logout")
def logout(
    user: User = Depends(
        get_current_user
    ),
):
    # JWT is stateless.
    # Removing the token on the frontend
    # performs the actual logout.
    return {
        "ok": True,
        "message": "Logged out",
    }


@app.get("/api/auth/me")
def auth_me(
    user: User = Depends(
        get_current_user
    ),
):
    return user_json(user)


# ============================================================
# PROFILE
# ============================================================


@app.patch("/api/auth/me")
def update_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    if payload.username is not None:
        username = payload.username.strip()

        if len(username) < 3:
            raise HTTPException(
                status_code=400,
                detail="Username must contain at least 3 characters",
            )

        if len(username) > 32:
            raise HTTPException(
                status_code=400,
                detail="Username is too long",
            )

        existing = (
            db.query(User)
            .filter(
                func.lower(
                    User.username
                )
                == username.lower(),
                User.id != user.id,
            )
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=409,
                detail="Username is already taken",
            )

        user.username = username

    if payload.bio is not None:
        user.bio = payload.bio[:500]

    if payload.avatar_url is not None:
        user.avatar_url = (
            payload.avatar_url[:2000]
        )

    user.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(user)

    return user_json(user)


@app.post("/api/auth/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    extension = (
        Path(
            file.filename or ""
        ).suffix.lower()
    )

    if extension not in {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP avatars are supported",
        )

    data = await file.read()

    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Avatar is too large. Maximum 5 MB.",
        )

    filename = (
        f"avatar_{user.id}_"
        f"{uuid.uuid4().hex}"
        f"{extension}"
    )

    target = (
        UPLOADS_DIR / filename
    )

    target.write_bytes(data)

    user.avatar_url = (
        f"/media/uploads/{filename}"
    )

    user.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(user)

    return user_json(user)


# ============================================================
# TRACKS
# ============================================================


@app.get("/api/tracks")
def get_tracks(
    limit: int = Query(
        500,
        ge=1,
        le=1000,
    ),
    offset: int = Query(
        0,
        ge=0,
    ),
    shuffle: bool = False,
    genre: Optional[str] = None,
    db: Session = Depends(get_db),
):
    auto_scan_if_needed(db)

    query = db.query(Track)

    if genre:
        query = query.filter(
            func.lower(
                Track.genre
            )
            == genre.lower()
        )

    if shuffle:
        # PostgreSQL + SQLite
        query = query.order_by(
            func.random()
        )
    else:
        query = query.order_by(
            Track.created_at.desc(),
            Track.id.desc(),
        )

    tracks = (
        query
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        track_json(track)
        for track in tracks
    ]


@app.get("/api/tracks/{track_id}")
def get_track(
    track_id: int,
    db: Session = Depends(get_db),
):
    track = (
        db.query(Track)
        .filter(
            Track.id == track_id
        )
        .first()
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    return track_json(track)


@app.get("/api/tracks/{track_id}/stream")
def stream_track(
    track_id: int,
    db: Session = Depends(get_db),
):
    track = (
        db.query(Track)
        .filter(
            Track.id == track_id
        )
        .first()
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    file_path = find_audio_file(
        track.audio_path
    )

    if not file_path:
        raise HTTPException(
            status_code=404,
            detail="Audio file not found",
        )

    track.plays = (
        track.plays or 0
    ) + 1

    db.commit()

    return FileResponse(
        path=str(file_path),
        media_type="audio/mpeg",
        filename=file_path.name,
    )


@app.get("/api/search")
def search_tracks(
    q: str = Query(
        "",
        min_length=0,
    ),
    limit: int = Query(
        100,
        ge=1,
        le=500,
    ),
    db: Session = Depends(get_db),
):
    auto_scan_if_needed(db)

    query = q.strip()

    if not query:
        tracks = (
            db.query(Track)
            .order_by(
                Track.created_at.desc()
            )
            .limit(limit)
            .all()
        )

        return [
            track_json(track)
            for track in tracks
        ]

    pattern = f"%{query}%"

    tracks = (
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
            Track.plays.desc(),
            Track.title.asc(),
        )
        .limit(limit)
        .all()
    )

    return [
        track_json(track)
        for track in tracks
    ]


@app.get("/api/tracks/search")
def search_tracks_legacy(
    q: str = Query(
        "",
        min_length=0,
    ),
    limit: int = Query(
        100,
        ge=1,
        le=500,
    ),
    db: Session = Depends(get_db),
):
    return search_tracks(
        q=q,
        limit=limit,
        db=db,
    )


@app.get("/api/recommendations")
def recommendations(
    limit: int = Query(
        20,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
):
    auto_scan_if_needed(db)

    tracks = (
        db.query(Track)
        .order_by(
            func.random()
        )
        .limit(limit)
        .all()
    )

    return [
        track_json(track)
        for track in tracks
    ]


@app.get("/api/tracks/popular")
def popular_tracks(
    limit: int = Query(
        20,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
):
    tracks = (
        db.query(Track)
        .order_by(
            Track.plays.desc(),
            Track.id.desc(),
        )
        .limit(limit)
        .all()
    )

    return [
        track_json(track)
        for track in tracks
    ]


@app.get("/api/tracks/new")
def new_tracks(
    limit: int = Query(
        20,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
):
    tracks = (
        db.query(Track)
        .order_by(
            Track.created_at.desc(),
            Track.id.desc(),
        )
        .limit(limit)
        .all()
    )

    return [
        track_json(track)
        for track in tracks
    ]


# ============================================================
# GENRES / ARTISTS / ALBUMS
# ============================================================


@app.get("/api/genres")
def get_genres(
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            Track.genre,
            func.count(Track.id),
        )
        .filter(
            Track.genre.isnot(None),
            Track.genre != "",
        )
        .group_by(
            Track.genre
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
            "name": genre,
            "count": count,
        }
        for genre, count in rows
    ]


@app.get("/api/artists")
def get_artists(
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            Track.artist,
            func.count(Track.id),
        )
        .filter(
            Track.artist.isnot(None),
            Track.artist != "",
        )
        .group_by(
            Track.artist
        )
        .order_by(
            Track.artist.asc()
        )
        .all()
    )

    return [
        {
            "name": artist,
            "count": count,
        }
        for artist, count in rows
    ]


@app.get("/api/albums")
def get_albums(
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            Track.album,
            Track.artist,
            func.count(Track.id),
        )
        .filter(
            Track.album.isnot(None),
            Track.album != "",
        )
        .group_by(
            Track.album,
            Track.artist,
        )
        .order_by(
            Track.album.asc()
        )
        .all()
    )

    return [
        {
            "name": album,
            "artist": artist,
            "count": count,
        }
        for album, artist, count in rows
    ]


# ============================================================
# LIKES
# ============================================================


@app.get("/api/library/likes")
def get_likes(
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Like)
        .filter(
            Like.user_id == user.id
        )
        .order_by(
            Like.created_at.desc()
        )
        .all()
    )

    return [
        track_json(row.track)
        for row in rows
        if row.track
    ]


@app.put("/api/library/likes/{track_id}")
def toggle_like(
    track_id: int,
    payload: LikeRequest,
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    track = (
        db.query(Track)
        .filter(
            Track.id == track_id
        )
        .first()
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    existing = (
        db.query(Like)
        .filter(
            Like.user_id == user.id,
            Like.track_id == track_id,
        )
        .first()
    )

    if payload.liked:
        if not existing:
            db.add(
                Like(
                    user_id=user.id,
                    track_id=track_id,
                )
            )
    else:
        if existing:
            db.delete(existing)

    db.commit()

    return {
        "liked": payload.liked,
        "track_id": track_id,
    }


@app.delete("/api/library/likes/{track_id}")
def remove_like(
    track_id: int,
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Like)
        .filter(
            Like.user_id == user.id,
            Like.track_id == track_id,
        )
        .first()
    )

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


@app.post("/api/history/{track_id}")
def add_history(
    track_id: int,
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    track = (
        db.query(Track)
        .filter(
            Track.id == track_id
        )
        .first()
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    item = History(
        user_id=user.id,
        track_id=track_id,
        played_at=datetime.utcnow(),
    )

    db.add(item)
    db.commit()

    return {
        "ok": True,
        "track": track_json(track),
    }


@app.get("/api/history")
def get_history(
    limit: int = Query(
        100,
        ge=1,
        le=500,
    ),
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(History)
        .filter(
            History.user_id == user.id
        )
        .order_by(
            History.played_at.desc()
        )
        .limit(limit)
        .all()
    )

    result = []

    for row in rows:
        if not row.track:
            continue

        item = track_json(
            row.track
        )

        item["played_at"] = (
            row.played_at.isoformat()
            if row.played_at
            else None
        )

        result.append(item)

    return result


@app.delete("/api/history")
def clear_history(
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    (
        db.query(History)
        .filter(
            History.user_id == user.id
        )
        .delete(
            synchronize_session=False
        )
    )

    db.commit()

    return {
        "ok": True
    }


# ============================================================
# PLAYLISTS
# ============================================================


@app.get("/api/playlists")
def get_playlists(
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    playlists = (
        db.query(Playlist)
        .filter(
            Playlist.user_id == user.id
        )
        .order_by(
            Playlist.created_at.desc()
        )
        .all()
    )

    return [
        playlist_json(
            playlist
        )
        for playlist in playlists
    ]


@app.post("/api/playlists")
def create_playlist(
    payload: PlaylistCreateRequest,
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    name = payload.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Playlist name is required",
        )

    if len(name) > 100:
        raise HTTPException(
            status_code=400,
            detail="Playlist name is too long",
        )

    playlist = Playlist(
        user_id=user.id,
        name=name,
        description=(
            payload.description or ""
        )[:500],
        cover_url=(
            payload.cover_url or ""
        )[:2000],
        is_public=payload.is_public,
    )

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return playlist_json(
        playlist
    )


@app.get("/api/playlists/{playlist_id}")
def get_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(
            Playlist.id == playlist_id
        )
        .first()
    )

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    return playlist_json(
        playlist
    )


@app.delete("/api/playlists/{playlist_id}")
def delete_playlist(
    playlist_id: int,
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(
            Playlist.id == playlist_id,
            Playlist.user_id == user.id,
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
        "ok": True
    }


@app.post(
    "/api/playlists/{playlist_id}/tracks"
)
def add_playlist_track(
    playlist_id: int,
    payload: PlaylistAddTrackRequest,
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(
            Playlist.id == playlist_id,
            Playlist.user_id == user.id,
        )
        .first()
    )

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    track = (
        db.query(Track)
        .filter(
            Track.id
            == payload.track_id
        )
        .first()
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    existing = (
        db.query(PlaylistTrack)
        .filter(
            PlaylistTrack.playlist_id
            == playlist_id,
            PlaylistTrack.track_id
            == payload.track_id,
        )
        .first()
    )

    if existing:
        return playlist_json(
            playlist
        )

    max_position = (
        db.query(
            func.max(
                PlaylistTrack.position
            )
        )
        .filter(
            PlaylistTrack.playlist_id
            == playlist_id
        )
        .scalar()
    )

    position = (
        int(max_position or -1)
        + 1
    )

    item = PlaylistTrack(
        playlist_id=playlist_id,
        track_id=payload.track_id,
        position=position,
    )

    db.add(item)
    db.commit()
    db.refresh(playlist)

    return playlist_json(
        playlist
    )


@app.post(
    "/api/playlists/{playlist_id}/add"
)
def add_playlist_track_legacy(
    playlist_id: int,
    payload: PlaylistAddTrackRequest,
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    return add_playlist_track(
        playlist_id=playlist_id,
        payload=payload,
        user=user,
        db=db,
    )


@app.delete(
    "/api/playlists/{playlist_id}/tracks/{track_id}"
)
def remove_playlist_track(
    playlist_id: int,
    track_id: int,
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(
            Playlist.id == playlist_id,
            Playlist.user_id == user.id,
        )
        .first()
    )

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    item = (
        db.query(PlaylistTrack)
        .filter(
            PlaylistTrack.playlist_id
            == playlist_id,
            PlaylistTrack.track_id
            == track_id,
        )
        .first()
    )

    if item:
        db.delete(item)
        db.commit()

    return playlist_json(
        playlist
    )


# ============================================================
# PROFILE STATS
# ============================================================


@app.get("/api/profile/stats")
def profile_stats(
    user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    likes_count = (
        db.query(
            func.count(Like.id)
        )
        .filter(
            Like.user_id == user.id
        )
        .scalar()
        or 0
    )

    history_count = (
        db.query(
            func.count(History.id)
        )
        .filter(
            History.user_id == user.id
        )
        .scalar()
        or 0
    )

    playlists_count = (
        db.query(
            func.count(Playlist.id)
        )
        .filter(
            Playlist.user_id == user.id
        )
        .scalar()
        or 0
    )

    total_minutes = (
        db.query(
            func.sum(
                Track.duration
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
        "likes": int(
            likes_count
        ),
        "history": int(
            history_count
        ),
        "playlists": int(
            playlists_count
        ),
        "minutes": int(
            total_minutes
        ) // 60,
        "hours": round(
            int(
                total_minutes
            )
            / 3600,
            2,
        ),
    }


@app.get("/api/profile")
def profile(
    user: User = Depends(
        get_current_user
    ),
):
    return user_json(user)


# ============================================================
# ADMIN
# ============================================================


@app.get("/api/admin/stats")
def admin_stats(
    user: User = Depends(
        require_admin
    ),
    db: Session = Depends(get_db),
):
    users = (
        db.query(
            func.count(User.id)
        )
        .scalar()
        or 0
    )

    tracks = (
        db.query(
            func.count(Track.id)
        )
        .scalar()
        or 0
    )

    likes = (
        db.query(
            func.count(Like.id)
        )
        .scalar()
        or 0
    )

    plays = (
        db.query(
            func.coalesce(
                func.sum(
                    Track.plays
                ),
                0,
            )
        )
        .scalar()
        or 0
    )

    return {
        "users": int(users),
        "tracks": int(tracks),
        "likes": int(likes),
        "plays": int(plays),
    }


@app.get("/api/admin/users")
def admin_users(
    limit: int = Query(
        100,
        ge=1,
        le=500,
    ),
    user: User = Depends(
        require_admin
    ),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .order_by(
            User.created_at.desc()
        )
        .limit(limit)
        .all()
    )

    return [
        user_json(item)
        for item in users
    ]


@app.post("/api/admin/scan")
def admin_scan(
    user: User = Depends(
        require_admin
    ),
    db: Session = Depends(get_db),
):
    return scan_music(db)


@app.post("/api/admin/upload")
async def admin_upload(
    file: UploadFile = File(...),
    user: User = Depends(
        require_admin
    ),
    db: Session = Depends(get_db),
):
    filename = safe_filename(
        file.filename
        or "audio"
    )

    extension = (
        Path(filename)
        .suffix
        .lower()
    )

    if extension not in AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format",
        )

    unique_name = (
        f"{uuid.uuid4().hex}_"
        f"{filename}"
    )

    target = (
        MUSIC_DIR / unique_name
    )

    data = await file.read()

    target.write_bytes(data)

    result = scan_music(db)

    return {
        "ok": True,
        "filename": unique_name,
        "scan": result,
    }


@app.delete(
    "/api/admin/tracks/{track_id}"
)
def admin_delete_track(
    track_id: int,
    user: User = Depends(
        require_admin
    ),
    db: Session = Depends(get_db),
):
    track = (
        db.query(Track)
        .filter(
            Track.id == track_id
        )
        .first()
    )

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    file_path = find_audio_file(
        track.audio_path
    )

    db.delete(track)
    db.commit()

    if file_path:
        try:
            # Only remove files that are inside
            # our media directories.
            allowed = [
                AUDIO_DIR.resolve(),
                MUSIC_DIR.resolve(),
                UPLOADS_DIR.resolve(),
            ]

            resolved = file_path.resolve()

            if any(
                str(resolved).startswith(
                    str(directory)
                )
                for directory in allowed
            ):
                resolved.unlink(
                    missing_ok=True
                )

        except Exception as exc:
            print(
                "[FILE DELETE WARNING]",
                exc,
            )

    return {
        "ok": True
    }


# ============================================================
# MEDIA
# ============================================================


app.mount(
    "/media",
    StaticFiles(
        directory=str(
            MEDIA_DIR
        )
    ),
    name="media",
)


# ============================================================
# FRONTEND / SPA
# ============================================================


@app.get(
    "/{full_path:path}"
)
def frontend(
    full_path: str,
):
    """
    Serve Vite React production build.

    API and media routes are declared above,
    so this catch-all is only reached for frontend routes.
    """

    if full_path.startswith(
        "api/"
    ):
        raise HTTPException(
            status_code=404,
            detail="API route not found",
        )

    requested = (
        FRONTEND_DIST
        / full_path
    )

    try:
        requested = requested.resolve()
        frontend_root = (
            FRONTEND_DIST.resolve()
        )

        # Prevent path traversal.
        if not str(
            requested
        ).startswith(
            str(frontend_root)
        ):
            raise HTTPException(
                status_code=403,
                detail="Forbidden",
            )

        if requested.is_file():
            return FileResponse(
                str(requested)
            )

    except HTTPException:
        raise

    except Exception:
        pass

    if FRONTEND_INDEX.exists():
        return FileResponse(
            str(FRONTEND_INDEX)
        )

    return {
        "name": APP_NAME,
        "status": "backend_online",
        "message": "Frontend build not found",
    }
