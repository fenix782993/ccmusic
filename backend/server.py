import os
import re
import uuid
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
# FENIX MUSIC
# Full Backend + PostgreSQL Migration + Frontend
# ============================================================

APP_NAME = "FENIX MUSIC"
APP_VERSION = "5.0.0"

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

# ------------------------------------------------------------
# FRONTEND
# ------------------------------------------------------------

FRONTEND_DIR = PROJECT_DIR / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"
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

AUDIO_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

COVER_DIR.mkdir(
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

# Render/PostgreSQL compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )

if DATABASE_URL.startswith("postgresql://"):
    if "+psycopg2" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace(
            "postgresql://",
            "postgresql+psycopg2://",
            1,
        )

connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {
        "check_same_thread": False,
    }

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
# SECURITY
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
# DATABASE MODELS
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
        nullable=True,
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

def table_exists(table_name: str) -> bool:
    inspector = inspect(engine)

    try:
        return inspector.has_table(
            table_name
        )
    except Exception:
        return False


def get_columns(table_name: str) -> set:
    inspector = inspect(engine)

    try:
        return {
            column["name"]
            for column in inspector.get_columns(
                table_name
            )
        }
    except Exception:
        return set()


def add_missing_column(
    table_name: str,
    column_name: str,
    postgres_definition: str,
    sqlite_definition: str,
):
    if not table_exists(table_name):
        return

    columns = get_columns(
        table_name
    )

    if column_name in columns:
        return

    dialect = engine.dialect.name

    if dialect == "postgresql":

        sql = (
            f'ALTER TABLE "{table_name}" '
            f'ADD COLUMN IF NOT EXISTS '
            f'"{column_name}" '
            f'{postgres_definition}'
        )

    else:

        sql = (
            f'ALTER TABLE "{table_name}" '
            f'ADD COLUMN '
            f'"{column_name}" '
            f'{sqlite_definition}'
        )

    try:

        with engine.begin() as conn:
            conn.execute(
                text(sql)
            )

        print(
            f"[MIGRATION] Added "
            f"{table_name}.{column_name}"
        )

    except Exception as exc:

        print(
            f"[MIGRATION ERROR] "
            f"{table_name}.{column_name}: "
            f"{exc}"
        )


def migrate_database():
    print("")
    print("=" * 70)
    print("FENIX MUSIC DATABASE MIGRATION")
    print("=" * 70)

    # --------------------------------------------------------
    # Create missing tables
    # --------------------------------------------------------

    Base.metadata.create_all(
        engine
    )

    print(
        "[MIGRATION] Base tables checked"
    )

    # --------------------------------------------------------
    # USERS
    # --------------------------------------------------------

    add_missing_column(
        "users",
        "avatar_url",
        "VARCHAR(500)",
        "VARCHAR(500)",
    )

    add_missing_column(
        "users",
        "is_admin",
        "BOOLEAN NOT NULL DEFAULT FALSE",
        "BOOLEAN NOT NULL DEFAULT 0",
    )

    add_missing_column(
        "users",
        "created_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "DATETIME DEFAULT CURRENT_TIMESTAMP",
    )

    # --------------------------------------------------------
    # TRACKS
    # --------------------------------------------------------

    add_missing_column(
        "tracks",
        "genre",
        "VARCHAR(100) DEFAULT 'Pop'",
        "VARCHAR(100) DEFAULT 'Pop'",
    )

    add_missing_column(
        "tracks",
        "duration",
        "INTEGER DEFAULT 0",
        "INTEGER DEFAULT 0",
    )

    add_missing_column(
        "tracks",
        "cover_url",
        "VARCHAR(500)",
        "VARCHAR(500)",
    )

    add_missing_column(
        "tracks",
        "audio_path",
        "VARCHAR(500)",
        "VARCHAR(500)",
    )

    add_missing_column(
        "tracks",
        "plays",
        "INTEGER NOT NULL DEFAULT 0",
        "INTEGER NOT NULL DEFAULT 0",
    )

    add_missing_column(
        "tracks",
        "created_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "DATETIME DEFAULT CURRENT_TIMESTAMP",
    )

    # --------------------------------------------------------
    # LIKES
    # --------------------------------------------------------

    add_missing_column(
        "likes",
        "created_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "DATETIME DEFAULT CURRENT_TIMESTAMP",
    )

    # --------------------------------------------------------
    # HISTORY
    # --------------------------------------------------------

    add_missing_column(
        "history",
        "played_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "DATETIME DEFAULT CURRENT_TIMESTAMP",
    )

    # --------------------------------------------------------
    # PLAYLISTS
    # --------------------------------------------------------

    add_missing_column(
        "playlists",
        "description",
        "TEXT",
        "TEXT",
    )

    add_missing_column(
        "playlists",
        "cover_url",
        "VARCHAR(500)",
        "VARCHAR(500)",
    )

    add_missing_column(
        "playlists",
        "is_public",
        "BOOLEAN DEFAULT TRUE",
        "BOOLEAN DEFAULT 1",
    )

    add_missing_column(
        "playlists",
        "created_at",
        "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "DATETIME DEFAULT CURRENT_TIMESTAMP",
    )

    # --------------------------------------------------------
    # PLAYLIST TRACKS
    # --------------------------------------------------------

    add_missing_column(
        "playlist_tracks",
        "position",
        "INTEGER DEFAULT 0",
        "INTEGER DEFAULT 0",
    )

    # --------------------------------------------------------
    # PostgreSQL data normalization
    # --------------------------------------------------------

    if engine.dialect.name == "postgresql":

        fixes = [
            (
                "UPDATE tracks "
                "SET genre = 'Pop' "
                "WHERE genre IS NULL"
            ),
            (
                "UPDATE tracks "
                "SET duration = 0 "
                "WHERE duration IS NULL"
            ),
            (
                "UPDATE tracks "
                "SET plays = 0 "
                "WHERE plays IS NULL"
            ),
            (
                "UPDATE users "
                "SET is_admin = FALSE "
                "WHERE is_admin IS NULL"
            ),
            (
                "UPDATE playlists "
                "SET is_public = TRUE "
                "WHERE is_public IS NULL"
            ),
            (
                "UPDATE playlist_tracks "
                "SET position = 0 "
                "WHERE position IS NULL"
            ),
        ]

        for sql in fixes:

            try:

                with engine.begin() as conn:
                    conn.execute(
                        text(sql)
                    )

            except Exception as exc:

                print(
                    "[MIGRATION WARNING]",
                    exc,
                )

    print(
        "[MIGRATION] COMPLETE"
    )

    print("=" * 70)
    print("")


# IMPORTANT:
# Migration runs before FastAPI starts.
migrate_database()


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=(
        "FENIX MUSIC API and frontend server"
    ),
)


# ============================================================
# CORS
# ============================================================

cors_raw = os.getenv(
    "CORS_ORIGINS",
    "*",
)

cors_origins = [
    item.strip()
    for item in cors_raw.split(",")
    if item.strip()
]

if cors_origins == ["*"]:

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

else:

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# ============================================================
# AUTH HELPERS
# ============================================================

def create_token(
    user: User,
) -> str:

    now = datetime.now(
        timezone.utc
    )

    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": (
            now
            + timedelta(
                minutes=ACCESS_MINUTES
            )
        ),
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
            detail="Authorization required",
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
        user_id,
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user


def get_admin_user(
    user=Depends(
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
# SERIALIZERS
# ============================================================

def serialize_user(
    user: User,
):

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "is_admin": bool(
            user.is_admin
        ),
        "created_at": user.created_at,
    }


def serialize_track(
    track: Track,
):

    duration = int(
        track.duration or 0
    )

    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "genre": track.genre or "Pop",
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
# PYDANTIC MODELS
# ============================================================

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LikeRequest(BaseModel):
    liked: bool


class PlaylistRequest(BaseModel):
    name: str
    description: str = ""
    is_public: bool = True


class PlaylistTrackRequest(BaseModel):
    track_id: int


class ProfileRequest(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None


# ============================================================
# API ROOT
# ============================================================

@app.get("/api")
def api_root():

    return {
        "name": "FENIX MUSIC API",
        "version": APP_VERSION,
        "status": "online",
    }


@app.get("/api/health")
def api_health():

    return {
        "status": "ok",
        "name": APP_NAME,
        "version": APP_VERSION,
        "database": (
            "postgresql"
            if engine.dialect.name
            == "postgresql"
            else "sqlite"
        ),
        "frontend": FRONTEND_INDEX.exists(),
        "time": datetime.now(
            timezone.utc
        ).isoformat(),
    }


# ============================================================
# AUTH
# ============================================================

@app.post("/api/auth/register")
def register(
    body: RegisterRequest,
    db: Session = Depends(get_db),
):

    email = (
        str(body.email)
        .lower()
        .strip()
    )

    username = (
        body.username
        .strip()
    )

    if len(username) < 3:

        raise HTTPException(
            status_code=400,
            detail=(
                "Username must contain "
                "at least 3 characters"
            ),
        )

    if len(body.password) < 6:

        raise HTTPException(
            status_code=400,
            detail=(
                "Password must contain "
                "at least 6 characters"
            ),
        )

    existing = (
        db.query(User)
        .filter(
            or_(
                User.email == email,
                User.username == username,
            )
        )
        .first()
    )

    if existing:

        raise HTTPException(
            status_code=409,
            detail=(
                "Email or username "
                "already exists"
            ),
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
        "token": create_token(user),
        "user": serialize_user(user),
    }


@app.post("/api/auth/login")
def login(
    body: LoginRequest,
    db: Session = Depends(get_db),
):

    email = (
        str(body.email)
        .lower()
        .strip()
    )

    user = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    try:

        valid = pwd.verify(
            body.password,
            user.password_hash,
        )

    except Exception:

        valid = False

    if not valid:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    return {
        "token": create_token(user),
        "user": serialize_user(user),
    }


@app.get("/api/auth/me")
def me(
    user=Depends(
        get_current_user
    ),
):

    return serialize_user(
        user
    )


@app.patch("/api/auth/me")
def update_profile(
    body: ProfileRequest,
    user=Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    if body.username is not None:

        username = (
            body.username
            .strip()
        )

        if len(username) < 3:

            raise HTTPException(
                400,
                "Username too short",
            )

        duplicate = (
            db.query(User)
            .filter(
                User.username == username,
                User.id != user.id,
            )
            .first()
        )

        if duplicate:

            raise HTTPException(
                409,
                "Username already exists",
            )

        user.username = username

    if body.avatar_url is not None:
        user.avatar_url = (
            body.avatar_url
        )

    db.commit()
    db.refresh(user)

    return serialize_user(
        user
    )


# ============================================================
# TRACKS
# ============================================================

@app.get("/api/tracks")
def get_tracks(
    q: Optional[str] = None,
    genre: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):

    limit = max(
        1,
        min(
            limit,
            100,
        ),
    )

    offset = max(
        0,
        offset,
    )

    query = db.query(
        Track
    )

    if q:

        pattern = f"%{q}%"

        query = query.filter(
            or_(
                Track.title.ilike(
                    pattern
                ),
                Track.artist.ilike(
                    pattern
                ),
                Track.album.ilike(
                    pattern
                ),
            )
        )

    if genre:

        query = query.filter(
            Track.genre.ilike(
                genre
            )
        )

    results = (
        query
        .order_by(
            Track.created_at.desc()
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        serialize_track(
            track
        )
        for track in results
    ]


@app.get("/api/tracks/{track_id}")
def get_track(
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

    return serialize_track(
        track
    )


# ============================================================
# AUDIO
# ============================================================

@app.get(
    "/api/tracks/{track_id}/stream"
)
def stream_track(
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

    if not track.audio_path:

        raise HTTPException(
            404,
            "Audio file not found",
        )

    audio_path = Path(
        track.audio_path
    )

    if not audio_path.is_absolute():

        audio_path = (
            BASE_DIR /
            audio_path
        )

    if not audio_path.exists():

        raise HTTPException(
            404,
            "Audio file missing",
        )

    track.plays = (
        track.plays or 0
    ) + 1

    db.commit()

    return FileResponse(
        audio_path,
        media_type="audio/mpeg",
        filename=audio_path.name,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        },
    )


# ============================================================
# SEARCH
# ============================================================

@app.get("/api/search")
def search(
    q: str = Query(
        min_length=1
    ),
    db: Session = Depends(get_db),
):

    pattern = f"%{q}%"

    found = (
        db.query(Track)
        .filter(
            or_(
                Track.title.ilike(
                    pattern
                ),
                Track.artist.ilike(
                    pattern
                ),
                Track.album.ilike(
                    pattern
                ),
            )
        )
        .order_by(
            Track.plays.desc()
        )
        .limit(100)
        .all()
    )

    artists = sorted(
        {
            track.artist
            for track in found
        }
    )

    albums = sorted(
        {
            track.album
            for track in found
        }
    )

    return {
        "tracks": [
            serialize_track(
                track
            )
            for track in found
        ],
        "artists": artists,
        "albums": albums,
        "playlists": [],
    }


# ============================================================
# RECOMMENDATIONS
# ============================================================

@app.get("/api/recommendations")
def recommendations(
    limit: int = 20,
    db: Session = Depends(get_db),
):

    limit = max(
        1,
        min(
            limit,
            100,
        ),
    )

    tracks = (
        db.query(Track)
        .order_by(
            Track.plays.desc(),
            Track.created_at.desc(),
        )
        .limit(limit)
        .all()
    )

    return [
        serialize_track(
            track
        )
        for track in tracks
    ]


# ============================================================
# LIKES
# ============================================================

@app.get("/api/library/likes")
def get_likes(
    user=Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    likes = (
        db.query(Like)
        .filter(
            Like.user_id == user.id
        )
        .all()
    )

    ids = [
        like.track_id
        for like in likes
    ]

    tracks = (
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
            serialize_track(
                track
            )
            for track in tracks
        ],
    }


@app.put(
    "/api/library/likes/{track_id}"
)
def update_like(
    track_id: int,
    body: LikeRequest,
    user=Depends(
        get_current_user
    ),
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

    existing = (
        db.query(Like)
        .filter(
            Like.user_id == user.id,
            Like.track_id == track_id,
        )
        .first()
    )

    if body.liked:

        if not existing:

            db.add(
                Like(
                    user_id=user.id,
                    track_id=track_id,
                )
            )

    else:

        if existing:
            db.delete(
                existing
            )

    db.commit()

    return {
        "ok": True,
        "liked": body.liked,
    }


# ============================================================
# HISTORY
# ============================================================

@app.post(
    "/api/history/{track_id}"
)
def add_history(
    track_id: int,
    user=Depends(
        get_current_user
    ),
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
def get_history(
    user=Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    history_rows = (
        db.query(History)
        .filter(
            History.user_id == user.id
        )
        .order_by(
            History.played_at.desc()
        )
        .limit(100)
        .all()
    )

    result = []

    for row in history_rows:

        track = db.get(
            Track,
            row.track_id,
        )

        if not track:
            continue

        result.append(
            {
                "played_at": row.played_at,
                "track": serialize_track(
                    track
                ),
            }
        )

    return result


# ============================================================
# PLAYLISTS
# ============================================================

@app.get("/api/playlists")
def get_playlists(
    user=Depends(
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

    result = []

    for playlist in playlists:

        items = (
            db.query(PlaylistTrack)
            .filter(
                PlaylistTrack.playlist_id
                == playlist.id
            )
            .order_by(
                PlaylistTrack.position
            )
            .all()
        )

        playlist_tracks = []

        for item in items:

            track = db.get(
                Track,
                item.track_id,
            )

            if track:

                playlist_tracks.append(
                    serialize_track(
                        track
                    )
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
    body: PlaylistRequest,
    user=Depends(
        get_current_user
    ),
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


@app.patch(
    "/api/playlists/{playlist_id}"
)
def update_playlist(
    playlist_id: int,
    body: PlaylistRequest,
    user=Depends(
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
            404,
            "Playlist not found",
        )

    playlist.name = (
        body.name.strip()
    )

    playlist.description = (
        body.description
    )

    playlist.is_public = (
        body.is_public
    )

    db.commit()

    return {
        "ok": True
    }


@app.delete(
    "/api/playlists/{playlist_id}"
)
def delete_playlist(
    playlist_id: int,
    user=Depends(
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
            404,
            "Playlist not found",
        )

    db.query(
        PlaylistTrack
    ).filter(
        PlaylistTrack.playlist_id
        == playlist_id
    ).delete(
        synchronize_session=False
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
    body: PlaylistTrackRequest,
    user=Depends(
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
            404,
            "Playlist not found",
        )

    track = db.get(
        Track,
        body.track_id,
    )

    if not track:

        raise HTTPException(
            404,
            "Track not found",
        )

    exists = (
        db.query(PlaylistTrack)
        .filter(
            PlaylistTrack.playlist_id
            == playlist_id,
            PlaylistTrack.track_id
            == body.track_id,
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
            .filter(
                PlaylistTrack.playlist_id
                == playlist_id
            )
            .scalar()
            or 0
        )

        db.add(
            PlaylistTrack(
                playlist_id=playlist_id,
                track_id=body.track_id,
                position=int(
                    position
                ),
            )
        )

        db.commit()

    return {
        "ok": True
    }


@app.delete(
    "/api/playlists/{playlist_id}/tracks/{track_id}"
)
def remove_playlist_track(
    playlist_id: int,
    track_id: int,
    user=Depends(
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
            404,
            "Playlist not found",
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

    if not item:

        raise HTTPException(
            404,
            "Track not found in playlist",
        )

    db.delete(item)
    db.commit()

    return {
        "ok": True
    }


# ============================================================
# ARTISTS
# ============================================================

@app.get("/api/artists")
def get_artists(
    db: Session = Depends(get_db),
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
                tracks
            ),
        }
        for artist, plays, tracks in rows
    ]


# ============================================================
# ALBUMS
# ============================================================

@app.get("/api/albums")
def get_albums(
    db: Session = Depends(get_db),
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
            "tracks": int(
                tracks
            ),
        }
        for album, artist, tracks in rows
    ]


# ============================================================
# PROFILE STATS
# ============================================================

@app.get("/api/profile/stats")
def profile_stats(
    user=Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    liked = (
        db.query(Like)
        .filter(
            Like.user_id == user.id
        )
        .count()
    )

    history_count = (
        db.query(History)
        .filter(
            History.user_id == user.id
        )
        .count()
    )

    playlists_count = (
        db.query(Playlist)
        .filter(
            Playlist.user_id == user.id
        )
        .count()
    )

    total_seconds = (
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
            History.user_id == user.id
        )
        .scalar()
        or 0
    )

    return {
        "minutes_listened": int(
            total_seconds / 60
        ),
        "tracks_played": int(
            history_count
        ),
        "liked_tracks": int(
            liked
        ),
        "playlists": int(
            playlists_count
        ),
    }


# ============================================================
# ADMIN
# ============================================================

@app.get("/api/admin/stats")
def admin_stats(
    user=Depends(
        get_admin_user
    ),
    db: Session = Depends(get_db),
):

    total_plays = (
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
        "users": db.query(User).count(),
        "tracks": db.query(Track).count(),
        "plays": int(
            total_plays
        ),
        "likes": db.query(
            Like
        ).count(),
        "playlists": db.query(
            Playlist
        ).count(),
    }


@app.get("/api/admin/users")
def admin_users(
    user=Depends(
        get_admin_user
    ),
    db: Session = Depends(get_db),
):

    users = (
        db.query(User)
        .order_by(
            User.created_at.desc()
        )
        .limit(500)
        .all()
    )

    return [
        serialize_user(
            item
        )
        for item in users
    ]


@app.post("/api/admin/tracks")
async def admin_upload_track(
    title: str = Form(...),
    artist: str = Form(...),
    album: str = Form(...),
    genre: str = Form("Pop"),
    duration: int = Form(0),
    audio: UploadFile = File(...),
    cover: Optional[UploadFile] = File(None),
    user=Depends(
        get_admin_user
    ),
    db: Session = Depends(get_db),
):

    title = title.strip()
    artist = artist.strip()
    album = album.strip()

    if not title:
        raise HTTPException(
            400,
            "Title is required",
        )

    if not artist:
        raise HTTPException(
            400,
            "Artist is required",
        )

    if not album:
        raise HTTPException(
            400,
            "Album is required",
        )

    # --------------------------------------------------------
    # AUDIO
    # --------------------------------------------------------

    original_audio = (
        audio.filename
        or "audio.mp3"
    )

    safe_audio = re.sub(
        r"[^a-zA-Z0-9._-]",
        "_",
        original_audio,
    )

    audio_filename = (
        f"{uuid.uuid4().hex}_"
        f"{safe_audio}"
    )

    audio_path = (
        AUDIO_DIR /
        audio_filename
    )

    with audio_path.open(
        "wb"
    ) as output:

        while True:

            chunk = await audio.read(
                1024 * 1024
            )

            if not chunk:
                break

            output.write(
                chunk
            )

    # --------------------------------------------------------
    # COVER
    # --------------------------------------------------------

    cover_url = None

    if cover:

        original_cover = (
            cover.filename
            or "cover.jpg"
        )

        safe_cover = re.sub(
            r"[^a-zA-Z0-9._-]",
            "_",
            original_cover,
        )

        cover_filename = (
            f"{uuid.uuid4().hex}_"
            f"{safe_cover}"
        )

        cover_path = (
            COVER_DIR /
            cover_filename
        )

        with cover_path.open(
            "wb"
        ) as output:

            while True:

                chunk = await cover.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                output.write(
                    chunk
                )

        cover_url = (
            "/api/media/covers/"
            + cover_filename
        )

    # --------------------------------------------------------
    # DATABASE
    # --------------------------------------------------------

    track = Track(
        title=title,
        artist=artist,
        album=album,
        genre=genre,
        duration=max(
            0,
            duration,
        ),
        cover_url=cover_url,
        audio_path=str(
            audio_path
        ),
        plays=0,
    )

    db.add(track)
    db.commit()
    db.refresh(track)

    return serialize_track(
        track
    )


@app.delete(
    "/api/admin/tracks/{track_id}"
)
def admin_delete_track(
    track_id: int,
    user=Depends(
        get_admin_user
    ),
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

    # Remove audio
    if track.audio_path:

        try:

            Path(
                track.audio_path
            ).unlink(
                missing_ok=True
            )

        except Exception:
            pass

    # Remove likes
    db.query(
        Like
    ).filter(
        Like.track_id == track_id
    ).delete(
        synchronize_session=False
    )

    # Remove history
    db.query(
        History
    ).filter(
        History.track_id == track_id
    ).delete(
        synchronize_session=False
    )

    # Remove playlist links
    db.query(
        PlaylistTrack
    ).filter(
        PlaylistTrack.track_id
        == track_id
    ).delete(
        synchronize_session=False
    )

    db.delete(track)
    db.commit()

    return {
        "ok": True
    }


# ============================================================
# MEDIA
# ============================================================

@app.get(
    "/api/media/covers/{filename}"
)
def get_cover(
    filename: str,
):

    safe_name = Path(
        filename
    ).name

    path = (
        COVER_DIR /
        safe_name
    )

    if not path.exists():

        raise HTTPException(
            404,
            "Cover not found",
        )

    return FileResponse(
        path
    )


# ============================================================
# FRONTEND
# ============================================================

# Mount Vite assets if they exist.
if (
    FRONTEND_DIST /
    "assets"
).exists():

    app.mount(
        "/assets",
        StaticFiles(
            directory=str(
                FRONTEND_DIST /
                "assets"
            )
        ),
        name="frontend-assets",
    )


@app.get(
    "/favicon.ico",
    include_in_schema=False,
)
def favicon():

    path = (
        FRONTEND_DIST /
        "favicon.ico"
    )

    if path.exists():

        return FileResponse(
            path
        )

    raise HTTPException(
        404,
        "Favicon not found",
    )


# ============================================================
# FRONTEND ROOT
# ============================================================

@app.get(
    "/",
    include_in_schema=False,
)
def frontend_root():

    if FRONTEND_INDEX.exists():

        return FileResponse(
            FRONTEND_INDEX
        )

    # Diagnostic response if React wasn't built.
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "status": "online",
        "frontend": False,
        "message": (
            "FENIX MUSIC backend is online, "
            "but frontend/dist/index.html "
            "was not found."
        ),
    }


# ============================================================
# REACT SPA FALLBACK
# ============================================================

@app.get(
    "/{full_path:path}",
    include_in_schema=False,
)
def frontend_fallback(
    full_path: str,
):

    # --------------------------------------------------------
    # Never treat API routes as frontend routes
    # --------------------------------------------------------

    if (
        full_path == "api"
        or full_path.startswith("api/")
    ):

        raise HTTPException(
            404,
            "API route not found",
        )

    # --------------------------------------------------------
    # Frontend missing
    # --------------------------------------------------------

    if not FRONTEND_INDEX.exists():

        raise HTTPException(
            404,
            "Frontend build not found",
        )

    # --------------------------------------------------------
    # Requested static file
    # --------------------------------------------------------

    requested = (
        FRONTEND_DIST /
        full_path
    )

    # Prevent ../ traversal
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

    # --------------------------------------------------------
    # React Router fallback
    # --------------------------------------------------------

    return FileResponse(
        FRONTEND_INDEX
    )


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():

    print("")
    print("=" * 70)
    print("                 FENIX MUSIC")
    print("=" * 70)

    print(
        f"Version: {APP_VERSION}"
    )

    print(
        "Database:",
        engine.dialect.name,
    )

    print(
        "Frontend:",
        (
            "FOUND"
            if FRONTEND_INDEX.exists()
            else "NOT FOUND"
        ),
    )

    print(
        "Frontend path:",
        FRONTEND_DIST,
    )

    print(
        "Media path:",
        MEDIA_DIR,
    )

    print(
        "Audio path:",
        AUDIO_DIR,
    )

    print(
        "Covers path:",
        COVER_DIR,
    )

    print("=" * 70)
    print("FENIX MUSIC ONLINE")
    print("=" * 70)
    print("")


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
