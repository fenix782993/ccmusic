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
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

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

from jose import jwt, JWTError
from passlib.context import CryptContext


# ============================================================
# FENIX MUSIC
# Backend API + PostgreSQL migration + React frontend serving
# ============================================================

APP_NAME = "FENIX MUSIC"
APP_VERSION = "4.0.0"

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

FRONTEND_DIR = PROJECT_DIR / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"

MEDIA_DIR = Path(
    os.getenv(
        "MEDIA_DIR",
        str(BASE_DIR / "media")
    )
)

AUDIO_DIR = MEDIA_DIR / "audio"
COVER_DIR = MEDIA_DIR / "covers"

AUDIO_DIR.mkdir(parents=True, exist_ok=True)
COVER_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# DATABASE
# ============================================================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{BASE_DIR / 'fenix_music.db'}"
)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )

if DATABASE_URL.startswith("postgresql://"):
    # psycopg2 compatibility
    if "+psycopg2" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace(
            "postgresql://",
            "postgresql+psycopg2://",
            1,
        )

connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {
        "check_same_thread": False
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

def get_table_columns(table_name: str):
    """
    Returns existing columns for a table.
    """

    inspector = inspect(engine)

    try:
        columns = inspector.get_columns(table_name)
        return {
            column["name"]
            for column in columns
        }
    except Exception:
        return set()


def table_exists(table_name: str):
    inspector = inspect(engine)

    try:
        return inspector.has_table(table_name)
    except Exception:
        return False


def migrate_postgres():
    """
    Automatically upgrades old FENIX MUSIC databases.

    Important:
    SQLAlchemy create_all() does NOT modify existing tables.
    Therefore this function adds missing columns manually.
    """

    print("=" * 60)
    print("FENIX MUSIC DATABASE MIGRATION")
    print("=" * 60)

    is_postgres = DATABASE_URL.startswith(
        "postgresql"
    )

    try:
        # ----------------------------------------------------
        # First create missing tables
        # ----------------------------------------------------

        Base.metadata.create_all(engine)

        print("Base tables checked.")

        # ----------------------------------------------------
        # PostgreSQL column migrations
        # ----------------------------------------------------

        if is_postgres:

            migrations = {

                "users": {
                    "avatar_url": """
                        ALTER TABLE users
                        ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)
                    """,

                    "is_admin": """
                        ALTER TABLE users
                        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN
                        NOT NULL DEFAULT FALSE
                    """,

                    "created_at": """
                        ALTER TABLE users
                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
                    """,
                },

                "tracks": {
                    "genre": """
                        ALTER TABLE tracks
                        ADD COLUMN IF NOT EXISTS genre VARCHAR(100)
                        DEFAULT 'Pop'
                    """,

                    "duration": """
                        ALTER TABLE tracks
                        ADD COLUMN IF NOT EXISTS duration INTEGER
                        DEFAULT 0
                    """,

                    "cover_url": """
                        ALTER TABLE tracks
                        ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500)
                    """,

                    "audio_path": """
                        ALTER TABLE tracks
                        ADD COLUMN IF NOT EXISTS audio_path VARCHAR(500)
                    """,

                    "plays": """
                        ALTER TABLE tracks
                        ADD COLUMN IF NOT EXISTS plays INTEGER
                        NOT NULL DEFAULT 0
                    """,

                    "created_at": """
                        ALTER TABLE tracks
                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
                    """,
                },

                "likes": {
                    "created_at": """
                        ALTER TABLE likes
                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
                    """,
                },

                "history": {
                    "played_at": """
                        ALTER TABLE history
                        ADD COLUMN IF NOT EXISTS played_at TIMESTAMP
                    """,
                },

                "playlists": {
                    "description": """
                        ALTER TABLE playlists
                        ADD COLUMN IF NOT EXISTS description TEXT
                    """,

                    "cover_url": """
                        ALTER TABLE playlists
                        ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500)
                    """,

                    "is_public": """
                        ALTER TABLE playlists
                        ADD COLUMN IF NOT EXISTS is_public BOOLEAN
                        DEFAULT TRUE
                    """,

                    "created_at": """
                        ALTER TABLE playlists
                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
                    """,
                },

                "playlist_tracks": {
                    "position": """
                        ALTER TABLE playlist_tracks
                        ADD COLUMN IF NOT EXISTS position INTEGER
                        DEFAULT 0
                    """,
                },
            }

            for table_name, columns in migrations.items():

                if not table_exists(table_name):
                    continue

                existing = get_table_columns(
                    table_name
                )

                for column_name, sql in columns.items():

                    if column_name in existing:
                        continue

                    try:
                        with engine.begin() as conn:
                            conn.execute(text(sql))

                        print(
                            f"MIGRATED: {table_name}.{column_name}"
                        )

                    except Exception as exc:
                        print(
                            f"MIGRATION WARNING: "
                            f"{table_name}.{column_name}: "
                            f"{exc}"
                        )

        # ----------------------------------------------------
        # Normalize nullable old fields
        # ----------------------------------------------------

        if is_postgres:

            fixes = [
                """
                UPDATE tracks
                SET genre = 'Pop'
                WHERE genre IS NULL
                """,

                """
                UPDATE tracks
                SET duration = 0
                WHERE duration IS NULL
                """,

                """
                UPDATE tracks
                SET plays = 0
                WHERE plays IS NULL
                """,

                """
                UPDATE users
                SET is_admin = FALSE
                WHERE is_admin IS NULL
                """,

                """
                UPDATE playlists
                SET is_public = TRUE
                WHERE is_public IS NULL
                """,

                """
                UPDATE playlist_tracks
                SET position = 0
                WHERE position IS NULL
                """,
            ]

            for sql in fixes:
                try:
                    with engine.begin() as conn:
                        conn.execute(text(sql))
                except Exception as exc:
                    print(
                        f"Migration update warning: {exc}"
                    )

        print("DATABASE MIGRATION COMPLETE")
        print("=" * 60)

    except Exception as exc:
        print("=" * 60)
        print("DATABASE MIGRATION FAILED")
        print(exc)
        print("=" * 60)

        raise


# Run migration before application startup
migrate_postgres()


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="FENIX MUSIC full music platform API",
)


# ============================================================
# CORS
# ============================================================

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "*",
).split(",")

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

def db_dep():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# ============================================================
# AUTH
# ============================================================

def make_token(user: User):

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

        uid = int(payload["sub"])

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
# JSON SERIALIZERS
# ============================================================

def track_json(t: Track):

    if not t:
        return None

    return {
        "id": t.id,
        "title": t.title,
        "artist": t.artist,
        "album": t.album,
        "genre": t.genre or "Pop",
        "duration": t.duration or 0,
        "duration_label": (
            f"{(t.duration or 0) // 60}:"
            f"{(t.duration or 0) % 60:02d}"
        ),
        "cover_url": t.cover_url,
        "audio_url": (
            f"/api/tracks/{t.id}/stream"
            if t.audio_path
            else None
        ),
        "plays": t.plays or 0,
    }


def user_json(u: User):

    return {
        "id": u.id,
        "email": u.email,
        "username": u.username,
        "avatar_url": u.avatar_url,
        "is_admin": bool(u.is_admin),
        "created_at": u.created_at,
    }


# ============================================================
# REQUEST MODELS
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
# HEALTH / ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "status": "online",
        "frontend": FRONTEND_DIST.exists(),
        "database": (
            "postgresql"
            if DATABASE_URL.startswith("postgresql")
            else "sqlite"
        ),
    }


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
        "database": (
            "postgresql"
            if DATABASE_URL.startswith("postgresql")
            else "sqlite"
        ),
        "frontend": FRONTEND_DIST.exists(),
        "time": datetime.now(
            timezone.utc
        ).isoformat(),
    }


# ============================================================
# AUTH ROUTES
# ============================================================

@app.post("/api/auth/register")
def register(
    body: Register,
    db: Session = Depends(db_dep),
):

    email = body.email.lower().strip()
    username = body.username.strip()

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

    exists = db.query(User).filter(
        or_(
            User.email == email,
            User.username == username,
        )
    ).first()

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
        "token": make_token(user),
        "user": user_json(user),
    }


@app.post("/api/auth/login")
def login(
    body: Login,
    db: Session = Depends(db_dep),
):

    email = body.email.lower().strip()

    user = db.query(User).filter(
        User.email == email
    ).first()

    if not user:

        raise HTTPException(
            401,
            "Invalid email or password",
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
            401,
            "Invalid email or password",
        )

    return {
        "token": make_token(user),
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
    db: Session = Depends(db_dep),
):

    if body.username:

        username = body.username.strip()

        exists = db.query(User).filter(
            User.username == username,
            User.id != user.id,
        ).first()

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
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(db_dep),
):

    limit = max(
        1,
        min(limit, 100),
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
        track_json(t)
        for t in results
    ]


@app.get("/api/tracks/{track_id}")
def track(
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
# AUDIO STREAM
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

    if not t or not t.audio_path:

        raise HTTPException(
            404,
            "Audio file not found",
        )

    path = Path(t.audio_path)

    if not path.is_absolute():
        path = BASE_DIR / path

    if not path.exists():

        raise HTTPException(
            404,
            "Audio file missing",
        )

    t.plays = (t.plays or 0) + 1

    db.commit()

    return FileResponse(
        path,
        media_type="audio/mpeg",
        filename=path.name,
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
    db: Session = Depends(db_dep),
):

    pattern = f"%{q}%"

    tracks_found = (
        db.query(Track)
        .filter(
            or_(
                Track.title.ilike(pattern),
                Track.artist.ilike(pattern),
                Track.album.ilike(pattern),
            )
        )
        .order_by(
            Track.plays.desc()
        )
        .limit(50)
        .all()
    )

    artists = sorted(
        {
            t.artist
            for t in tracks_found
        }
    )

    albums = sorted(
        {
            t.album
            for t in tracks_found
        }
    )

    return {
        "tracks": [
            track_json(t)
            for t in tracks_found
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
    db: Session = Depends(db_dep),
):

    limit = max(
        1,
        min(limit, 50),
    )

    results = (
        db.query(Track)
        .order_by(
            Track.plays.desc(),
            Track.created_at.desc(),
        )
        .limit(limit)
        .all()
    )

    return [
        track_json(t)
        for t in results
    ]


# ============================================================
# LIBRARY / LIKES
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

    tracks_found = (
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
            for t in tracks_found
        ],
    }


@app.put("/api/library/likes/{track_id}")
def set_like(
    track_id: int,
    body: LikeBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):

    track_obj = db.get(
        Track,
        track_id,
    )

    if not track_obj:

        raise HTTPException(
            404,
            "Track not found",
        )

    existing = (
        db.query(Like)
        .filter_by(
            user_id=user.id,
            track_id=track_id,
        )
        .first()
    )

    if body.liked and not existing:

        db.add(
            Like(
                user_id=user.id,
                track_id=track_id,
            )
        )

    elif not body.liked and existing:

        db.delete(existing)

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

    track_obj = db.get(
        Track,
        track_id,
    )

    if not track_obj:

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

    result = []

    for row in rows:

        track_obj = db.get(
            Track,
            row.track_id,
        )

        if not track_obj:
            continue

        result.append(
            {
                "played_at": row.played_at,
                "track": track_json(
                    track_obj
                ),
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

    playlist_rows = (
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

    for playlist in playlist_rows:

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

        for item in playlist_tracks:

            track_obj = db.get(
                Track,
                item.track_id,
            )

            if track_obj:
                tracks_result.append(
                    track_json(track_obj)
                )

        result.append(
            {
                "id": playlist.id,
                "name": playlist.name,
                "description": playlist.description,
                "cover_url": playlist.cover_url,
                "is_public": playlist.is_public,
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
            404,
            "Playlist not found",
        )

    playlist.name = body.name.strip()
    playlist.description = body.description
    playlist.is_public = body.is_public

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
            404,
            "Playlist not found",
        )

    db.query(PlaylistTrack).filter_by(
        playlist_id=pid
    ).delete(
        synchronize_session=False
    )

    db.delete(playlist)
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

    playlist = (
        db.query(Playlist)
        .filter_by(
            id=pid,
            user_id=user.id,
        )
        .first()
    )

    track_obj = db.get(
        Track,
        body.track_id,
    )

    if not playlist or not track_obj:

        raise HTTPException(
            404,
            "Playlist or track not found",
        )

    exists = (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=pid,
            track_id=track_obj.id,
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
                track_id=track_obj.id,
                position=int(position),
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
            404,
            "Not found",
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
            "plays": int(plays or 0),
            "tracks": int(track_count),
        }
        for artist, plays, track_count in rows
    ]


# ============================================================
# ALBUMS
# ============================================================

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
            "tracks": int(track_count),
        }
        for album, artist, track_count in rows
    ]


# ============================================================
# PROFILE STATS
# ============================================================

@app.get("/api/profile/stats")
def stats(
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
            History.track_id == Track.id,
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
        "tracks_played": history_count,
        "liked_tracks": liked,
        "playlists": playlist_count,
    }


# ============================================================
# ADMIN
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

    title = title.strip()
    artist = artist.strip()
    album = album.strip()

    if not title or not artist or not album:

        raise HTTPException(
            400,
            "Title, artist and album are required",
        )

    original_name = (
        audio.filename
        or "audio.mp3"
    )

    safe_name = re.sub(
        r"[^a-zA-Z0-9._-]",
        "_",
        original_name,
    )

    filename = (
        f"{uuid.uuid4().hex}_"
        f"{safe_name}"
    )

    audio_path = AUDIO_DIR / filename

    with audio_path.open(
        "wb"
    ) as file:

        while True:

            chunk = await audio.read(
                1024 * 1024
            )

            if not chunk:
                break

            file.write(chunk)

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
            COVER_DIR / cover_filename
        )

        with cover_path.open(
            "wb"
        ) as file:

            while True:

                chunk = await cover.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                file.write(chunk)

        cover_url = (
            f"/api/media/covers/"
            f"{cover_filename}"
        )

    track_obj = Track(
        title=title,
        artist=artist,
        album=album,
        genre=genre,
        duration=max(
            0,
            duration,
        ),
        audio_path=str(
            audio_path
        ),
        cover_url=cover_url,
    )

    db.add(track_obj)
    db.commit()
    db.refresh(track_obj)

    return track_json(track_obj)


@app.get("/api/admin/users")
def admin_users(
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
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
        user_json(u)
        for u in users
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
    }


@app.delete("/api/admin/tracks/{track_id}")
def admin_delete_track(
    track_id: int,
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):

    track_obj = db.get(
        Track,
        track_id,
    )

    if not track_obj:

        raise HTTPException(
            404,
            "Track not found",
        )

    # Delete audio file
    if track_obj.audio_path:

        try:
            Path(
                track_obj.audio_path
            ).unlink(
                missing_ok=True
            )
        except Exception:
            pass

    # Delete likes
    db.query(Like).filter_by(
        track_id=track_id
    ).delete(
        synchronize_session=False
    )

    # Delete history
    db.query(History).filter_by(
        track_id=track_id
    ).delete(
        synchronize_session=False
    )

    # Delete playlist references
    db.query(
        PlaylistTrack
    ).filter_by(
        track_id=track_id
    ).delete(
        synchronize_session=False
    )

    db.delete(track_obj)
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
def media_cover(
    filename: str,
):

    safe_filename = Path(
        filename
    ).name

    path = (
        COVER_DIR /
        safe_filename
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

def frontend_index():

    return (
        FRONTEND_DIST /
        "index.html"
    )


@app.get(
    "/assets/{file_path:path}"
)
def frontend_assets(
    file_path: str,
):

    path = (
        FRONTEND_DIST /
        "assets" /
        file_path
    )

    if not path.exists() or not path.is_file():

        raise HTTPException(
            404,
            "Asset not found",
        )

    return FileResponse(
        path
    )


@app.get(
    "/favicon.ico"
)
def favicon():

    favicon_path = (
        FRONTEND_DIST /
        "favicon.ico"
    )

    if favicon_path.exists():

        return FileResponse(
            favicon_path
        )

    raise HTTPException(
        404,
        "Favicon not found",
    )


# ============================================================
# SPA FALLBACK
# ============================================================

@app.get(
    "/{full_path:path}"
)
def frontend_fallback(
    full_path: str,
):

    # Never intercept API routes
    if full_path.startswith(
        "api/"
    ):

        raise HTTPException(
            404,
            "API route not found",
        )

    # If frontend isn't built
    if not FRONTEND_DIST.exists():

        return {
            "name": APP_NAME,
            "status": "online",
            "message": (
                "Frontend build not found. "
                "Run npm run build."
            ),
        }

    requested = (
        FRONTEND_DIST /
        full_path
    )

    # Prevent path traversal
    try:
        requested.resolve().relative_to(
            FRONTEND_DIST.resolve()
        )
    except ValueError:

        raise HTTPException(
            404,
            "Not found",
        )

    # Serve an actual static file
    if requested.exists() and requested.is_file():

        return FileResponse(
            requested
        )

    # React/Vite SPA fallback
    index = frontend_index()

    if index.exists():

        return FileResponse(
            index
        )

    raise HTTPException(
        404,
        "Frontend index.html not found",
    )


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup_event():

    print("")
    print("=" * 60)
    print("FENIX MUSIC STARTING")
    print("=" * 60)

    print(
        f"Version: {APP_VERSION}"
    )

    print(
        "Database:",
        (
            "PostgreSQL"
            if DATABASE_URL.startswith(
                "postgresql"
            )
            else "SQLite"
        ),
    )

    print(
        "Frontend:",
        (
            "FOUND"
            if FRONTEND_DIST.exists()
            else "NOT FOUND"
        ),
    )

    print(
        "Media:",
        MEDIA_DIR,
    )

    print(
        "Audio:",
        AUDIO_DIR,
    )

    print(
        "Covers:",
        COVER_DIR,
    )

    print("=" * 60)
    print("FENIX MUSIC ONLINE")
    print("=" * 60)
    print("")


# ============================================================
# OPTIONAL LOCAL RUN
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
