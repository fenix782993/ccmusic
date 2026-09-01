import os, re, uuid, hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Table, UniqueConstraint, or_, func
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from jose import jwt, JWTError
from passlib.context import CryptContext

BASE_DIR = Path(__file__).resolve().parent
MEDIA_DIR = Path(os.getenv("MEDIA_DIR", BASE_DIR / "media"))
AUDIO_DIR = MEDIA_DIR / "audio"
COVER_DIR = MEDIA_DIR / "covers"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
COVER_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fenix_music.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

SECRET_KEY = os.getenv("JWT_SECRET", "change-this-secret-in-production")
ALGORITHM = "HS256"
ACCESS_MINUTES = int(os.getenv("ACCESS_MINUTES", "10080"))
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@fenixmusic.local")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me-now")
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    likes = relationship("Like", cascade="all, delete-orphan")
    playlists = relationship("Playlist", cascade="all, delete-orphan")

class Track(Base):
    __tablename__ = "tracks"
    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False, index=True)
    artist = Column(String(255), nullable=False, index=True)
    album = Column(String(255), nullable=False, index=True)
    genre = Column(String(100), default="Pop")
    duration = Column(Integer, default=0)
    cover_url = Column(String(500), nullable=True)
    audio_path = Column(String(500), nullable=True)
    plays = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Like(Base):
    __tablename__ = "likes"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("user_id", "track_id", name="uq_user_track_like"),)

class History(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    played_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

class Playlist(Base):
    __tablename__ = "playlists"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    cover_url = Column(String(500), nullable=True)
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"
    id = Column(Integer, primary_key=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    track_id = Column(Integer, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint("playlist_id", "track_id", name="uq_playlist_track"),)

Base.metadata.create_all(engine)

app = FastAPI(title="FENIX MUSIC API", version="3.0.0", description="Full music platform API")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount_media = False

@app.on_event("startup")
def seed():
    db = SessionLocal()
    try:
        if not db.query(User).filter_by(email=ADMIN_EMAIL).first():
            db.add(User(email=ADMIN_EMAIL, username="FenixAdmin", password_hash=pwd.hash(ADMIN_PASSWORD), is_admin=True))
        if db.query(Track).count() == 0:
            demo = [
                ("Blinding Lights", "The Weeknd", "After Hours", "Pop", 200, "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=85"),
                ("Save Your Tears", "The Weeknd", "After Hours", "Pop", 215, "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=85"),
                ("Starboy", "The Weeknd, Daft Punk", "Starboy", "Pop", 230, "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=85"),
                ("Die For You", "The Weeknd", "Starboy", "R&B", 260, "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=900&q=85"),
                ("I Feel It Coming", "The Weeknd, Daft Punk", "Starboy", "Pop", 269, "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=85"),
                ("After Hours", "The Weeknd", "After Hours", "R&B", 361, "https://images.unsplash.com/photo-1521337581100-8ca9a73a5f79?auto=format&fit=crop&w=900&q=85"),
            ]
            for t in demo:
                db.add(Track(title=t[0], artist=t[1], album=t[2], genre=t[3], duration=t[4], cover_url=t[5]))
        db.commit()
    finally:
        db.close()

def db_dep():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def make_token(user):
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user.id), "iat": now, "exp": now + timedelta(minutes=ACCESS_MINUTES)}, SECRET_KEY, algorithm=ALGORITHM)

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(db_dep)):
    if not creds: raise HTTPException(401, "Authorization required")
    try: uid = int(jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])["sub"])
    except (JWTError, ValueError, KeyError): raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, uid)
    if not user: raise HTTPException(401, "User not found")
    return user

def admin_user(user=Depends(current_user)):
    if not user.is_admin: raise HTTPException(403, "Admin access required")
    return user

def track_json(t):
    return {"id":t.id,"title":t.title,"artist":t.artist,"album":t.album,"genre":t.genre,"duration":t.duration,"duration_label":f"{t.duration//60}:{t.duration%60:02d}","cover_url":t.cover_url,"audio_url":f"/api/tracks/{t.id}/stream" if t.audio_path else None,"plays":t.plays}

def user_json(u):
    return {"id":u.id,"email":u.email,"username":u.username,"avatar_url":u.avatar_url,"is_admin":u.is_admin,"created_at":u.created_at}

class Register(BaseModel): email: EmailStr; username: str; password: str
class Login(BaseModel): email: EmailStr; password: str
class LikeBody(BaseModel): liked: bool
class PlaylistBody(BaseModel): name: str; description: str = ""; is_public: bool = True
class PlaylistTrackBody(BaseModel): track_id: int
class ProfileBody(BaseModel): username: Optional[str] = None; avatar_url: Optional[str] = None

@app.get("/")
def root(): return {"name":"FENIX MUSIC API","version":"3.0.0","status":"online"}
@app.get("/api/health")
def health(): return {"status":"ok","database":DATABASE_URL.split(":")[0],"time":datetime.now(timezone.utc).isoformat()}

@app.post("/api/auth/register")
def register(body:Register, db:Session=Depends(db_dep)):
    if len(body.password) < 6: raise HTTPException(400,"Password must be at least 6 characters")
    if db.query(User).filter(or_(User.email==body.email.lower(),User.username==body.username)).first(): raise HTTPException(409,"Email or username already exists")
    u=User(email=body.email.lower(),username=body.username.strip(),password_hash=pwd.hash(body.password)); db.add(u); db.commit(); db.refresh(u)
    return {"token":make_token(u),"user":user_json(u)}

@app.post("/api/auth/login")
def login(body:Login, db:Session=Depends(db_dep)):
    u=db.query(User).filter_by(email=body.email.lower()).first()
    if not u or not pwd.verify(body.password,u.password_hash): raise HTTPException(401,"Invalid email or password")
    return {"token":make_token(u),"user":user_json(u)}

@app.get("/api/auth/me")
def me(user=Depends(current_user)): return user_json(user)
@app.patch("/api/auth/me")
def update_me(body:ProfileBody,user=Depends(current_user),db:Session=Depends(db_dep)):
    if body.username:
        exists=db.query(User).filter(User.username==body.username,User.id!=user.id).first()
        if exists: raise HTTPException(409,"Username already exists")
        user.username=body.username.strip()
    if body.avatar_url is not None: user.avatar_url=body.avatar_url
    db.commit(); db.refresh(user); return user_json(user)

@app.get("/api/tracks")
def tracks(q:Optional[str]=None, genre:Optional[str]=None, limit:int=50, offset:int=0, db:Session=Depends(db_dep)):
    query=db.query(Track)
    if q: query=query.filter(or_(Track.title.ilike(f"%{q}%"),Track.artist.ilike(f"%{q}%"),Track.album.ilike(f"%{q}%")))
    if genre: query=query.filter(Track.genre.ilike(genre))
    return [track_json(t) for t in query.order_by(Track.created_at.desc()).offset(offset).limit(min(limit,100)).all()]
@app.get("/api/tracks/{track_id}")
def track(track_id:int,db:Session=Depends(db_dep)):
    t=db.get(Track,track_id)
    if not t: raise HTTPException(404,"Track not found")
    return track_json(t)

@app.get("/api/tracks/{track_id}/stream")
def stream(track_id:int,db:Session=Depends(db_dep)):
    t=db.get(Track,track_id)
    if not t or not t.audio_path: raise HTTPException(404,"Audio file not found")
    path=Path(t.audio_path)
    if not path.exists(): raise HTTPException(404,"Audio file missing")
    t.plays += 1; db.commit()
    return FileResponse(path, media_type="audio/mpeg", filename=path.name)

@app.get("/api/search")
def search(q:str=Query(min_length=1),db:Session=Depends(db_dep)):
    pattern=f"%{q}%"
    ts=db.query(Track).filter(or_(Track.title.ilike(pattern),Track.artist.ilike(pattern),Track.album.ilike(pattern))).limit(50).all()
    artists=sorted({t.artist for t in ts}); albums=sorted({t.album for t in ts})
    return {"tracks":[track_json(t) for t in ts],"artists":artists,"albums":albums,"playlists":[]}

@app.get("/api/recommendations")
def recommendations(limit:int=20,db:Session=Depends(db_dep)):
    return [track_json(t) for t in db.query(Track).order_by(Track.plays.desc(),Track.created_at.desc()).limit(min(limit,50)).all()]

@app.get("/api/library/likes")
def likes(user=Depends(current_user),db:Session=Depends(db_dep)):
    ids=[x.track_id for x in db.query(Like).filter_by(user_id=user.id).all()]
    ts=db.query(Track).filter(Track.id.in_(ids)).all() if ids else []
    return {"track_ids":ids,"tracks":[track_json(t) for t in ts]}
@app.put("/api/library/likes/{track_id}")
def set_like(track_id:int,body:LikeBody,user=Depends(current_user),db:Session=Depends(db_dep)):
    if not db.get(Track,track_id): raise HTTPException(404,"Track not found")
    x=db.query(Like).filter_by(user_id=user.id,track_id=track_id).first()
    if body.liked and not x: db.add(Like(user_id=user.id,track_id=track_id))
    if not body.liked and x: db.delete(x)
    db.commit(); return {"ok":True,"liked":body.liked}

@app.post("/api/history/{track_id}")
def add_history(track_id:int,user=Depends(current_user),db:Session=Depends(db_dep)):
    if not db.get(Track,track_id): raise HTTPException(404,"Track not found")
    db.add(History(user_id=user.id,track_id=track_id)); db.commit(); return {"ok":True}
@app.get("/api/history")
def history(user=Depends(current_user),db:Session=Depends(db_dep)):
    rows=db.query(History).filter_by(user_id=user.id).order_by(History.played_at.desc()).limit(100).all()
    return [{"played_at":r.played_at,"track":track_json(db.get(Track,r.track_id))} for r in rows]

@app.get("/api/playlists")
def playlists(user=Depends(current_user),db:Session=Depends(db_dep)):
    ps=db.query(Playlist).filter_by(user_id=user.id).order_by(Playlist.created_at.desc()).all()
    return [{"id":p.id,"name":p.name,"description":p.description,"cover_url":p.cover_url,"is_public":p.is_public,"tracks":[track_json(db.get(Track,x.track_id)) for x in db.query(PlaylistTrack).filter_by(playlist_id=p.id).order_by(PlaylistTrack.position).all()]} for p in ps]
@app.post("/api/playlists")
def create_playlist(body:PlaylistBody,user=Depends(current_user),db:Session=Depends(db_dep)):
    p=Playlist(user_id=user.id,name=body.name.strip(),description=body.description,is_public=body.is_public); db.add(p); db.commit(); db.refresh(p); return {"id":p.id,"name":p.name}
@app.patch("/api/playlists/{pid}")
def update_playlist(pid:int,body:PlaylistBody,user=Depends(current_user),db:Session=Depends(db_dep)):
    p=db.query(Playlist).filter_by(id=pid,user_id=user.id).first()
    if not p: raise HTTPException(404,"Playlist not found")
    p.name=body.name.strip(); p.description=body.description; p.is_public=body.is_public; db.commit(); return {"ok":True}
@app.delete("/api/playlists/{pid}")
def delete_playlist(pid:int,user=Depends(current_user),db:Session=Depends(db_dep)):
    p=db.query(Playlist).filter_by(id=pid,user_id=user.id).first()
    if not p: raise HTTPException(404,"Playlist not found")
    db.delete(p); db.commit(); return {"ok":True}
@app.post("/api/playlists/{pid}/tracks")
def playlist_add(pid:int,body:PlaylistTrackBody,user=Depends(current_user),db:Session=Depends(db_dep)):
    p=db.query(Playlist).filter_by(id=pid,user_id=user.id).first(); t=db.get(Track,body.track_id)
    if not p or not t: raise HTTPException(404,"Playlist or track not found")
    if not db.query(PlaylistTrack).filter_by(playlist_id=pid,track_id=t.id).first():
        pos=db.query(func.count(PlaylistTrack.id)).filter_by(playlist_id=pid).scalar() or 0
        db.add(PlaylistTrack(playlist_id=pid,track_id=t.id,position=pos)); db.commit()
    return {"ok":True}
@app.delete("/api/playlists/{pid}/tracks/{track_id}")
def playlist_remove(pid:int,track_id:int,user=Depends(current_user),db:Session=Depends(db_dep)):
    p=db.query(Playlist).filter_by(id=pid,user_id=user.id).first(); x=db.query(PlaylistTrack).filter_by(playlist_id=pid,track_id=track_id).first()
    if not p or not x: raise HTTPException(404,"Not found")
    db.delete(x); db.commit(); return {"ok":True}

@app.get("/api/artists")
def artists(db:Session=Depends(db_dep)):
    rows=db.query(Track.artist,func.sum(Track.plays).label("plays"),func.count(Track.id).label("tracks")).group_by(Track.artist).order_by(func.sum(Track.plays).desc()).all()
    return [{"name":a,"plays":int(p or 0),"tracks":int(c)} for a,p,c in rows]
@app.get("/api/albums")
def albums(db:Session=Depends(db_dep)):
    rows=db.query(Track.album,Track.artist,func.count(Track.id).label("tracks")).group_by(Track.album,Track.artist).all()
    return [{"album":a,"artist":ar,"tracks":int(c)} for a,ar,c in rows]

@app.get("/api/profile/stats")
def stats(user=Depends(current_user),db:Session=Depends(db_dep)):
    liked=db.query(Like).filter_by(user_id=user.id).count(); history_count=db.query(History).filter_by(user_id=user.id).count(); playlist_count=db.query(Playlist).filter_by(user_id=user.id).count()
    minutes=int((db.query(func.coalesce(func.sum(Track.duration),0)).join(History,History.track_id==Track.id).filter(History.user_id==user.id).scalar() or 0)/60)
    return {"minutes_listened":minutes,"tracks_played":history_count,"liked_tracks":liked,"playlists":playlist_count}

@app.post("/api/admin/tracks")
async def admin_upload_track(title:str=Form(...),artist:str=Form(...),album:str=Form(...),genre:str=Form("Pop"),duration:int=Form(0),audio:UploadFile=File(...),cover:Optional[UploadFile]=File(None),user=Depends(admin_user),db:Session=Depends(db_dep)):
    safe=re.sub(r"[^a-zA-Z0-9._-]","_",audio.filename or "audio.mp3")
    filename=f"{uuid.uuid4().hex}_{safe}"; path=AUDIO_DIR/filename
    with path.open("wb") as f:
        while chunk:=await audio.read(1024*1024): f.write(chunk)
    cover_url=None
    if cover:
        cs=re.sub(r"[^a-zA-Z0-9._-]","_",cover.filename or "cover.jpg"); cp=COVER_DIR/f"{uuid.uuid4().hex}_{cs}"
        with cp.open("wb") as f:
            while chunk:=await cover.read(1024*1024): f.write(chunk)
        cover_url=f"/api/media/covers/{cp.name}"
    t=Track(title=title,artist=artist,album=album,genre=genre,duration=duration,audio_path=str(path),cover_url=cover_url)
    db.add(t); db.commit(); db.refresh(t); return track_json(t)

@app.get("/api/admin/users")
def admin_users(user=Depends(admin_user),db:Session=Depends(db_dep)):
    return [user_json(u) for u in db.query(User).order_by(User.created_at.desc()).limit(500).all()]
@app.get("/api/admin/stats")
def admin_stats(user=Depends(admin_user),db:Session=Depends(db_dep)):
    return {"users":db.query(User).count(),"tracks":db.query(Track).count(),"plays":int(db.query(func.coalesce(func.sum(Track.plays),0)).scalar() or 0),"likes":db.query(Like).count(),"playlists":db.query(Playlist).count()}
@app.delete("/api/admin/tracks/{track_id}")
def admin_delete_track(track_id:int,user=Depends(admin_user),db:Session=Depends(db_dep)):
    t=db.get(Track,track_id)
    if not t: raise HTTPException(404,"Track not found")
    if t.audio_path: Path(t.audio_path).unlink(missing_ok=True)
    db.delete(t); db.commit(); return {"ok":True}

@app.get("/api/media/covers/{filename}")
def media_cover(filename:str):
    p=COVER_DIR/Path(filename).name
    if not p.exists(): raise HTTPException(404,"Cover not found")
    return FileResponse(p)
