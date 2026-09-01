```python
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
from fastapi.responses import FileResponse, JSONResponse
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
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

FRONTEND_DIR = PROJECT_DIR / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
INDEX_FILE = DIST_DIR / "index.html"
ASSETS_DIR = DIST_DIR / "assets"

MEDIA_DIR = Path(
    os.getenv(
        "MEDIA_DIR",
        str(BASE_DIR / "media"),
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
    "sqlite:///./fenix_music.db",
)

# Render/PostgreSQL compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )

if DATABASE_URL.startswith("postgresql://"):
    # psycopg2 is used by SQLAlchemy if available.
    # Render requirements should contain psycopg2-binary.
    pass

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
)

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
    )

    playlists = relationship(
        "Playlist",
        cascade="all, delete-orphan",
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
# DATABASE INIT
# ============================================================

Base.metadata.create_all(engine)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="FENIX MUSIC API",
    version="4.0.0",
    description="FENIX MUSIC full music platform",
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
# SERIALIZERS
# ============================================================


def track_json(track: Track):
    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "genre": track.genre,
        "duration": track.duration,
        "duration_label": (
            f"{track.duration // 60}:"
            f"{track.duration % 60:02d}"
        ),
        "cover_url": track.cover_url,
        "audio_url": (
            f"/api/tracks/{track.id}/stream"
            if track.audio_path
            else None
        ),
        "plays": track.plays,
    }


def user_json(user: User):
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "is_admin": user.is_admin,
        "created_at": user.created_at,
    }


# ============================================================
# JWT
# ============================================================


def make_token(user: User):
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": now
        + timedelta(
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
# HEALTH / API INFO
# ============================================================


@app.get("/api/health")
def health():
    database_name = (
        "postgres"
        if DATABASE_URL.startswith("postgresql")
        else "sqlite"
    )

    return {
        "status": "ok",
        "service": "FENIX MUSIC",
        "version": "4.0.0",
        "database": database_name,
        "frontend": INDEX_FILE.exists(),
        "time": datetime.now(
            timezone.utc
        ).isoformat(),
    }


@app.get("/api")
def api_info():
    return {
        "name": "FENIX MUSIC API",
        "version": "4.0.0",
        "status": "online",
        "frontend": INDEX_FILE.exists(),
    }


# ============================================================
# STARTUP / SEED
# ============================================================


@app.on_event("startup")
def seed():
    db = SessionLocal()

    try:
        # ----------------------------------------------------
        # Admin
        # ----------------------------------------------------

        admin = (
            db.query(User)
            .filter_by(email=ADMIN_EMAIL)
            .first()
        )

        if not admin:
            admin = User(
                email=ADMIN_EMAIL,
                username="FenixAdmin",
                password_hash=pwd.hash(
                    ADMIN_PASSWORD
                ),
                is_admin=True,
            )

            db.add(admin)

        # ----------------------------------------------------
        # Demo tracks
        # ----------------------------------------------------

        if db.query(Track).count() == 0:
            demo = [
                (
                    "Blinding Lights",
                    "The Weeknd",
                    "After Hours",
                    "Pop",
                    200,
                    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=85",
                ),
                (
                    "Save Your Tears",
                    "The Weeknd",
                    "After Hours",
                    "Pop",
                    215,
                    "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=85",
                ),
                (
                    "Starboy",
                    "The Weeknd, Daft Punk",
                    "Starboy",
                    "Pop",
                    230,
                    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=85",
                ),
                (
                    "Die For You",
                    "The Weeknd",
                    "Starboy",
                    "R&B",
                    260,
                    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=900&q=85",
                ),
                (
                    "I Feel It Coming",
                    "The Weeknd, Daft Punk",
                    "Starboy",
                    "Pop",
                    269,
                    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=85",
                ),
                (
                    "After Hours",
                    "The Weeknd",
                    "After Hours",
                    "R&B",
                    361,
                    "https://images.unsplash.com/photo-1521337581100-8ca9a73a5f79?auto=format&fit=crop&w=900&q=85",
                ),
            ]

            for item in demo:
                db.add(
                    Track(
                        title=item[0],
                        artist=item[1],
                        album=item[2],
                        genre=item[3],
                        duration=item[4],
                        cover_url=item[5],
                    )
                )

        db.commit()

    finally:
        db.close()


# ============================================================
# AUTH
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
    user = (
        db.query(User)
        .filter_by(
            email=body.email.lower().strip()
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not pwd.verify(
        body.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
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
    limit = min(
        max(limit, 1),
        100,
    )

    offset = max(
        offset,
        0,
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
            Track.genre.ilike(genre)
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
        track_json(track)
        for track in results
    ]


@app.get("/api/tracks/{track_id}")
def track(
    track_id: int,
    db: Session = Depends(db_dep),
):
    item = db.get(
        Track,
        track_id,
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    return track_json(item)


@app.get("/api/tracks/{track_id}/stream")
def stream(
    track_id: int,
    db: Session = Depends(db_dep),
):
    item = db.get(
        Track,
        track_id,
    )

    if not item or not item.audio_path:
        raise HTTPException(
            status_code=404,
            detail="Audio file not found",
        )

    path = Path(
        item.audio_path
    ).resolve()

    # Security check
    try:
        path.relative_to(
            AUDIO_DIR.resolve()
        )
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail="Invalid audio path",
        )

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Audio file missing",
        )

    item.plays += 1
    db.commit()

    return FileResponse(
        path,
        media_type="audio/mpeg",
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
            )
        )
        .limit(50)
        .all()
    )

    artists = sorted(
        {
            item.artist
            for item in tracks_result
        }
    )

    albums = sorted(
        {
            item.album
            for item in tracks_result
        }
    )

    return {
        "tracks": [
            track_json(item)
            for item in tracks_result
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
    limit = min(
        max(limit, 1),
        50,
    )

    result = (
        db.query(Track)
        .order_by(
            Track.plays.desc(),
            Track.created_at.desc(),
        )
        .limit(limit)
        .all()
    )

    return [
        track_json(item)
        for item in result
    ]


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

    if ids:
        tracks_result = (
            db.query(Track)
            .filter(
                Track.id.in_(ids)
            )
            .all()
        )
    else:
        tracks_result = []

    return {
        "track_ids": ids,
        "tracks": [
            track_json(item)
            for item in tracks_result
        ],
    }


@app.put("/api/library/likes/{track_id}")
def set_like(
    track_id: int,
    body: LikeBody,
    user=Depends(current_user),
    db: Session = Depends(db_dep),
):
    track_item = db.get(
        Track,
        track_id,
    )

    if not track_item:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    like = (
        db.query(Like)
        .filter_by(
            user_id=user.id,
            track_id=track_id,
        )
        .first()
    )

    if body.liked and not like:
        db.add(
            Like(
                user_id=user.id,
                track_id=track_id,
            )
        )

    elif not body.liked and like:
        db.delete(like)

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
    track_item = db.get(
        Track,
        track_id,
    )

    if not track_item:
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
        track_item = db.get(
            Track,
            row.track_id,
        )

        if not track_item:
            continue

        result.append(
            {
                "played_at": row.played_at,
                "track": track_json(
                    track_item
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
        rows = (
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

        for row in rows:
            track_item = db.get(
                Track,
                row.track_id,
            )

            if track_item:
                tracks_result.append(
                    track_json(
                        track_item
                    )
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
            status_code=400,
            detail="Playlist name is required",
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
            status_code=404,
            detail="Playlist not found",
        )

    name = body.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Playlist name is required",
        )

    playlist.name = name
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
            status_code=404,
            detail="Playlist not found",
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

    track_item = db.get(
        Track,
        body.track_id,
    )

    if not playlist or not track_item:
        raise HTTPException(
            status_code=404,
            detail="Playlist or track not found",
        )

    existing = (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=pid,
            track_id=track_item.id,
        )
        .first()
    )

    if not existing:
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
                track_id=track_item.id,
                position=position,
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

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    item = (
        db.query(PlaylistTrack)
        .filter_by(
            playlist_id=pid,
            track_id=track_id,
        )
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Track not found in playlist",
        )

    db.delete(item)
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
            "name": artist,
            "plays": int(
                plays or 0
            ),
            "tracks": int(
                tracks_count
            ),
        }
        for artist, plays, tracks_count in rows
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
                tracks_count
            ),
        }
        for album, artist, tracks_count in rows
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
    safe_name = Path(
        filename
    ).name

    path = (
        COVER_DIR / safe_name
    ).resolve()

    try:
        path.relative_to(
            COVER_DIR.resolve()
        )
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail="Invalid cover path",
        )

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Cover not found",
        )

    return FileResponse(path)


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

    audio_path = (
        AUDIO_DIR / filename
    )

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
        original_cover_name = (
            cover.filename
            or "cover.jpg"
        )

        safe_cover_name = re.sub(
            r"[^a-zA-Z0-9._-]",
            "_",
            original_cover_name,
        )

        cover_filename = (
            f"{uuid.uuid4().hex}_"
            f"{safe_cover_name}"
        )

        cover_path = (
            COVER_DIR
            / cover_filename
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

    track_item = Track(
        title=title.strip(),
        artist=artist.strip(),
        album=album.strip(),
        genre=genre.strip(),
        duration=max(
            int(duration),
            0,
        ),
        audio_path=str(
            audio_path
        ),
        cover_url=cover_url,
    )

    db.add(track_item)
    db.commit()
    db.refresh(track_item)

    return track_json(track_item)


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
        user_json(item)
        for item in users
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
    }


@app.delete(
    "/api/admin/tracks/{track_id}"
)
def admin_delete_track(
    track_id: int,
    user=Depends(admin_user),
    db: Session = Depends(db_dep),
):
    track_item = db.get(
        Track,
        track_id,
    )

    if not track_item:
        raise HTTPException(
            status_code=404,
            detail="Track not found",
        )

    if track_item.audio_path:
        Path(
            track_item.audio_path
        ).unlink(
            missing_ok=True
        )

    db.delete(track_item)
    db.commit()

    return {
        "ok": True
    }


# ============================================================
# FRONTEND
# ============================================================

# IMPORTANT:
#
# React/Vite is built during Render build:
#
# cd frontend
# npm install
# npm run build
#
# Result:
#
# frontend/dist/
# ├── index.html
# └── assets/
#
# FastAPI serves this folder from the SAME DOMAIN.
# ============================================================


if ASSETS_DIR.exists():
    from fastapi.staticfiles import StaticFiles

    app.mount(
        "/assets",
        StaticFiles(
            directory=str(
                ASSETS_DIR
            )
        ),
        name="frontend-assets",
    )


@app.get("/")
def frontend_root():
    if INDEX_FILE.exists():
        return FileResponse(
            INDEX_FILE
        )

    return JSONResponse(
        {
            "name": "FENIX MUSIC",
            "status": "online",
            "message": (
                "Frontend build not found. "
                "Run: cd frontend && npm run build"
            ),
        }
    )


# ============================================================
# REACT ROUTER FALLBACK
# ============================================================

# Any normal browser route that isn't /api/*
# gets React's index.html.
#
# Examples:
#
# /profile
# /settings
# /search
# /playlists
# /artists
# /albums
#
# This makes React Router work correctly on Render.
# ============================================================


@app.get(
    "/{full_path:path}",
    include_in_schema=False,
)
def frontend_fallback(
    full_path: str,
):
    # Never hijack API paths.
    if (
        full_path == "api"
        or full_path.startswith("api/")
    ):
        raise HTTPException(
            status_code=404,
            detail="API endpoint not found",
        )

    # Do not hijack documentation.
    if (
        full_path == "docs"
        or full_path.startswith("docs/")
        or full_path == "redoc"
        or full_path.startswith("redoc/")
        or full_path == "openapi.json"
    ):
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    # If a real frontend file exists,
    # serve it.
    requested_file = (
        DIST_DIR / full_path
    ).resolve()

    try:
        requested_file.relative_to(
            DIST_DIR.resolve()
        )
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if (
        requested_file.is_file()
        and requested_file.exists()
    ):
        return FileResponse(
            requested_file
        )

    # Otherwise React handles the route.
    if INDEX_FILE.exists():
        return FileResponse(
            INDEX_FILE
        )

    raise HTTPException(
        status_code=404,
        detail="Frontend not found",
    )
```
