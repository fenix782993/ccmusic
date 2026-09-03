import os, re, secrets, shutil, mimetypes
from pathlib import Path
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from .database import init_db, get_db, SessionLocal
from .models import User, Track, Like, History, Playlist, PlaylistTrack, TelegramAuth
from .auth import hash_password, verify_password, make_token, read_token, random_token
from .media import AUDIO_EXTS, audio_mime, iter_range, safe_filename
from .radio import RADIO_STATIONS

APP_VERSION = "10.0.0"
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
MEDIA_DIR = Path(os.getenv("MEDIA_DIR", str(PROJECT_DIR / "media")))
AUDIO_DIR = MEDIA_DIR / "audio"
COVER_DIR = MEDIA_DIR / "covers"
UPLOAD_DIR = MEDIA_DIR / "uploads"
RADIO_DIR = MEDIA_DIR / "radio"
for d in (MEDIA_DIR, AUDIO_DIR, COVER_DIR, UPLOAD_DIR, RADIO_DIR):
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="FENIX MUSIC API", version=APP_VERSION)
origins = os.getenv("CORS_ORIGINS", "*")
app.add_middleware(CORSMiddleware, allow_origins=["*"] if origins == "*" else [x.strip() for x in origins.split(",")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    username: str = "User"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TelegramStartIn(BaseModel):
    pass

class PlaylistIn(BaseModel):
    name: str

class TrackIn(BaseModel):
    title: str
    artist: str = "Unknown Artist"
    album: str = "Single"
    genre: str = "Pop"

def resolve_path(value: str | None):
    if not value:
        return None
    p = Path(value)
    candidates = [p] if p.is_absolute() else [PROJECT_DIR/p, BASE_DIR/p, Path.cwd()/p, MEDIA_DIR/p]
    for c in candidates:
        try:
            c = c.resolve()
            if c.exists() and c.is_file():
                return c
        except Exception:
            pass
    return None

def current_user(request: Request, db: Session):
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.cookies.get("fenix_token")
    uid = read_token(token) if token else None
    return db.get(User, uid) if uid else None

def require_user(request: Request, db: Session):
    user = current_user(request, db)
    if not user:
        raise HTTPException(401, "Требуется авторизация")
    return user

def track_json(t: Track, liked=False):
    path = resolve_path(t.audio_path)
    return {
        "id": t.id, "title": t.title, "artist": t.artist, "album": t.album,
        "genre": t.genre or "Pop", "duration": int(t.duration or 0),
        "duration_label": f"{int(t.duration or 0)//60}:{int(t.duration or 0)%60:02d}",
        "cover_url": t.cover_url,
        "audio_url": f"/api/tracks/{t.id}/stream" if path else None,
        "file_available": bool(path), "plays": int(t.plays or 0),
        "liked": liked, "has_lyrics": bool((t.lyrics or "").strip())
    }

def user_json(u):
    return {"id": u.id, "email": u.email, "username": u.username, "avatar_url": u.avatar_url, "telegram": bool(u.telegram_id), "is_admin": bool(u.is_admin)}

@app.on_event("startup")
def startup():
    init_db()
    db = SessionLocal()
    try:
        admin_email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
        admin_password = os.getenv("ADMIN_PASSWORD") or ""
        admin_username = (os.getenv("ADMIN_USERNAME") or "FenixAdmin").strip() or "FenixAdmin"

        admin = None
        if admin_email:
            admin = db.query(User).filter(User.email.ilike(admin_email)).first()
        if not admin:
            admin = db.query(User).filter(User.username.ilike(admin_username)).first()

        if admin:
            changed = False
            if not admin.is_admin:
                admin.is_admin = True
                changed = True
            if admin_password:
                admin.password_hash = hash_password(admin_password)
                changed = True
            # Do not rename another user's username and trigger the unique index.
            if admin_username and admin.username.lower() != admin_username.lower():
                owner = db.query(User).filter(
                    User.username.ilike(admin_username), User.id != admin.id
                ).first()
                if not owner:
                    admin.username = admin_username
                    changed = True
            if changed:
                db.commit()
            print(f"[ADMIN] ready: {admin.email} / {admin.username}")
        elif admin_email and admin_password:
            db.add(User(email=admin_email, password_hash=hash_password(admin_password), username=admin_username, is_admin=True))
            try:
                db.commit()
                print(f"[ADMIN] created: {admin_email} / {admin_username}")
            except Exception as exc:
                db.rollback()
                existing = db.query(User).filter(User.username.ilike(admin_username)).first()
                if existing:
                    existing.is_admin = True
                    existing.password_hash = hash_password(admin_password)
                    db.commit()
                    print(f"[ADMIN] repaired existing username: {existing.username}")
                else:
                    print(f"[ADMIN] seed error: {exc}")

        scan_music(db)
    finally:
        db.close()

def scan_music(db: Session):
    seen = set()
    for folder in (AUDIO_DIR, MUSIC_DIR, UPLOAD_DIR):
        for path in folder.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in AUDIO_EXTS:
                continue
            rel = path.resolve().relative_to(PROJECT_DIR.resolve()).as_posix()
            seen.add(rel)
            tr = db.query(Track).filter(Track.audio_path == rel).first()
            if not tr:
                tr = Track(title=path.stem, artist="Unknown Artist", audio_path=rel)
                db.add(tr)
    db.commit()

@app.get("/api/health")
def health():
    return {"ok": True, "app": "FENIX MUSIC", "version": APP_VERSION}

@app.post("/api/auth/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if len(data.password) < 6:
        raise HTTPException(400, "Пароль минимум 6 символов")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(409, "Email уже зарегистрирован")
    u = User(email=data.email, password_hash=hash_password(data.password), username=data.username[:80] or "User")
    db.add(u); db.commit(); db.refresh(u)
    return {"token": make_token(u.id), "user": user_json(u)}

@app.post("/api/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == data.email).first()
    if not u or not u.password_hash or not verify_password(data.password, u.password_hash):
        raise HTTPException(401, "Неверный email или пароль")
    return {"token": make_token(u.id), "user": user_json(u)}

@app.get("/api/auth/me")
def me(request: Request, db: Session = Depends(get_db)):
    u = current_user(request, db)
    if not u: raise HTTPException(401, "Не авторизован")
    return user_json(u)

@app.post("/api/auth/telegram/start")
def telegram_start(db: Session = Depends(get_db)):
    bot = os.getenv("TELEGRAM_BOT_USERNAME", "").strip().lstrip("@")
    if not bot:
        raise HTTPException(503, "TELEGRAM_BOT_USERNAME не настроен")
    token = random_token()
    item = TelegramAuth(token=token, expires_at=datetime.now(timezone.utc)+timedelta(minutes=10))
    db.add(item); db.commit()
    return {"token": token, "url": f"https://t.me/{bot}?start=auth_{token}"}

@app.get("/api/auth/telegram/status/{token}")
def telegram_status(token: str, db: Session = Depends(get_db)):
    item = db.query(TelegramAuth).filter(TelegramAuth.token == token).first()
    if not item: raise HTTPException(404, "Токен не найден")
    if item.expires_at < datetime.now(timezone.utc): raise HTTPException(410, "Токен истёк")
    if not item.used or not item.user_id:
        return {"status": "pending"}
    u = db.get(User, item.user_id)
    return {"status": "confirmed", "token": make_token(u.id), "user": user_json(u)}

@app.get("/api/tracks")
def tracks(request: Request, db: Session = Depends(get_db)):
    u = current_user(request, db)
    liked_ids = {x.track_id for x in db.query(Like).filter(Like.user_id == u.id).all()} if u else set()
    rows = db.query(Track).order_by(desc(Track.created_at)).all()
    return [track_json(t, t.id in liked_ids) for t in rows if resolve_path(t.audio_path)]

@app.get("/api/tracks/{track_id}")
def track(track_id: int, request: Request, db: Session = Depends(get_db)):
    t = db.get(Track, track_id)
    if not t: raise HTTPException(404, "Трек не найден")
    u = current_user(request, db)
    liked = bool(u and db.query(Like).filter(Like.user_id==u.id, Like.track_id==t.id).first())
    return track_json(t, liked)

@app.get("/api/tracks/{track_id}/stream")
async def stream(track_id: int, request: Request, db: Session = Depends(get_db)):
    t = db.get(Track, track_id)
    if not t: raise HTTPException(404, "Трек не найден")
    path = resolve_path(t.audio_path)
    if not path:
        raise HTTPException(404, f"Audio file not found: {t.audio_path}")
    size = path.stat().st_size
    if size <= 0: raise HTTPException(404, "Audio file is empty")
    mime = audio_mime(path)
    rh = request.headers.get("range")
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600", "Content-Disposition": f'inline; filename="{path.name}"'}
    if not rh:
        headers["Content-Length"] = str(size)
        return StreamingResponse(iter_range(path, 0, size-1), media_type=mime, headers=headers)
    if not rh.startswith("bytes="):
        return StreamingResponse(iter(()), status_code=416, headers={"Content-Range": f"bytes */{size}"})
    val = rh[6:].split(",")[0].strip()
    try:
        a,b = val.split("-", 1)
        if a:
            start=int(a); end=int(b) if b else size-1
        else:
            suffix=int(b); start=max(size-suffix,0); end=size-1
        if start<0 or start>=size or end<start:
            raise ValueError
        end=min(end,size-1)
    except Exception:
        return StreamingResponse(iter(()), status_code=416, headers={"Content-Range": f"bytes */{size}"})
    headers.update({"Content-Length": str(end-start+1), "Content-Range": f"bytes {start}-{end}/{size}"})
    return StreamingResponse(iter_range(path,start,end), status_code=206, media_type=mime, headers=headers)

@app.post("/api/tracks/{track_id}/play")
def play(track_id: int, request: Request, db: Session = Depends(get_db)):
    t=db.get(Track,track_id)
    if not t: raise HTTPException(404,"Трек не найден")
    u=require_user(request,db)
    t.plays=(t.plays or 0)+1
    db.add(History(user_id=u.id,track_id=t.id))
    db.commit()
    return {"ok":True}

@app.get("/api/history")
def history(request: Request, db: Session=Depends(get_db)):
    u=require_user(request,db)
    rows=db.query(History).filter(History.user_id==u.id).order_by(desc(History.listened_at)).limit(100).all()
    return [track_json(db.get(Track,x.track_id), True) for x in rows if db.get(Track,x.track_id)]

@app.get("/api/favorites")
def favorites(request: Request, db: Session=Depends(get_db)):
    u=require_user(request,db)
    ids=[x.track_id for x in db.query(Like).filter(Like.user_id==u.id).all()]
    return [track_json(db.get(Track,i),True) for i in ids if db.get(Track,i)]

@app.post("/api/tracks/{track_id}/like")
def like(track_id:int, request:Request, db:Session=Depends(get_db)):
    u=require_user(request,db); t=db.get(Track,track_id)
    if not t: raise HTTPException(404,"Трек не найден")
    row=db.query(Like).filter(Like.user_id==u.id,Like.track_id==t.id).first()
    if row: db.delete(row); liked=False
    else: db.add(Like(user_id=u.id,track_id=t.id)); liked=True
    db.commit(); return {"liked":liked}

@app.get("/api/search")
def search(q:str="", request:Request=None, db:Session=Depends(get_db)):
    q=q.strip()
    if not q: return []
    rows=db.query(Track).filter(or_(Track.title.ilike(f"%{q}%"),Track.artist.ilike(f"%{q}%"),Track.album.ilike(f"%{q}%"),Track.genre.ilike(f"%{q}%"))).limit(100).all()
    return [track_json(t) for t in rows]

@app.get("/api/recommendations")
def recommendations(request:Request, db:Session=Depends(get_db)):
    rows=db.query(Track).order_by(desc(Track.plays),desc(Track.created_at)).limit(30).all()
    return [track_json(t) for t in rows]

@app.get("/api/radio")
def radio():
    return RADIO_STATIONS

@app.get("/api/media/radio/{filename}")
def radio_cover(filename:str):
    p=RADIO_DIR/safe_filename(filename)
    if not p.exists(): raise HTTPException(404,"Radio cover not found")
    return FileResponse(p)

@app.get("/api/media/covers/{filename}")
def cover(filename:str):
    p=COVER_DIR/safe_filename(filename)
    if not p.exists(): raise HTTPException(404,"Cover not found")
    return FileResponse(p)

@app.post("/api/admin/tracks/upload")
async def upload_track(request:Request, file:UploadFile=File(...), title:str="", artist:str="Unknown Artist", album:str="Single", genre:str="Pop", db:Session=Depends(get_db)):
    u=require_user(request,db)
    if not u.is_admin: raise HTTPException(403,"Admin only")
    ext=Path(file.filename or "").suffix.lower()
    if ext not in AUDIO_EXTS: raise HTTPException(400,"Неподдерживаемый аудиоформат")
    name=f"{secrets.token_hex(12)}{ext}"
    dest=AUDIO_DIR/name
    with dest.open("wb") as out:
        while chunk:=await file.read(1024*1024):
            out.write(chunk)
    t=Track(title=title or Path(file.filename).stem,artist=artist,album=album,genre=genre,audio_path=dest.resolve().relative_to(PROJECT_DIR.resolve()).as_posix())
    db.add(t); db.commit(); db.refresh(t)
    return track_json(t)

@app.post("/api/admin/tracks/{track_id}/cover")
async def upload_cover(track_id:int, request:Request, file:UploadFile=File(...), db:Session=Depends(get_db)):
    u=require_user(request,db)
    if not u.is_admin: raise HTTPException(403,"Admin only")
    t=db.get(Track,track_id)
    if not t: raise HTTPException(404,"Track not found")
    ext=Path(file.filename or "").suffix.lower() or ".jpg"
    if ext not in {".jpg",".jpeg",".png",".webp"}: raise HTTPException(400,"Неверный формат обложки")
    name=f"{secrets.token_hex(16)}{ext}"
    dest=COVER_DIR/name
    with dest.open("wb") as out:
        while chunk:=await file.read(1024*1024):
            out.write(chunk)
    t.cover_url=f"/api/media/covers/{name}"; db.commit()
    return {"ok":True,"cover_url":t.cover_url}

@app.get("/api/playlists")
def playlists(request:Request,db:Session=Depends(get_db)):
    u=require_user(request,db)
    return [{"id":p.id,"name":p.name,"tracks":[track_json(db.get(Track,x.track_id)) for x in db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id==p.id).order_by(PlaylistTrack.position).all()]} for p in db.query(Playlist).filter(Playlist.user_id==u.id).all()]

@app.post("/api/playlists")
def create_playlist(data:PlaylistIn,request:Request,db:Session=Depends(get_db)):
    u=require_user(request,db)
    p=Playlist(user_id=u.id,name=data.name[:255]);db.add(p);db.commit();db.refresh(p)
    return {"id":p.id,"name":p.name}

@app.post("/api/playlists/{playlist_id}/tracks/{track_id}")
def playlist_add(playlist_id:int,track_id:int,request:Request,db:Session=Depends(get_db)):
    u=require_user(request,db);p=db.get(Playlist,playlist_id);t=db.get(Track,track_id)
    if not p or p.user_id!=u.id or not t: raise HTTPException(404,"Not found")
    pos=db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id==p.id).count()
    db.add(PlaylistTrack(playlist_id=p.id,track_id=t.id,position=pos));db.commit()
    return {"ok":True}

# Render/frontend
DIST = PROJECT_DIR / "frontend" / "dist"
ASSETS_DIR = DIST / "assets"

# Vite может не создать папку assets, если frontend состоит из одного index.html.
# Создаём её заранее, чтобы Starlette StaticFiles не падал при старте.
if DIST.exists():
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

@app.get("/{full_path:path}")
def spa(full_path:str):
    if full_path.startswith("api/"):
        raise HTTPException(404,"Not found")
    index=DIST/"index.html"
    if index.exists():
        return FileResponse(index)
    return HTMLResponse("<h1>FENIX MUSIC</h1><p>Frontend build not found.</p>")
