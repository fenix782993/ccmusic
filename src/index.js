const express=require("express");
const path=require("path");
const crypto=require("crypto");
const bcrypt=require("bcryptjs");
const {Pool}=require("pg");
const cookieParser=require("cookie-parser");

const app=express();
const PORT=process.env.PORT||10000;
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:false
});
app.use(express.json({limit:"2mb"}));
app.use(cookieParser());

async function q(text,params=[]){return pool.query(text,params)}
async function initDatabase(){
  await q(`CREATE TABLE IF NOT EXISTS users(
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await q(`CREATE TABLE IF NOT EXISTS tracks(
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    artist_name TEXT NOT NULL DEFAULT 'Unknown',
    album_name TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    audio_url TEXT NOT NULL DEFAULT '',
    duration INTEGER NOT NULL DEFAULT 0,
    plays_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await q(`CREATE TABLE IF NOT EXISTS favorites(
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id,track_id)
  )`);
  await q(`CREATE TABLE IF NOT EXISTS history(
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await q(`CREATE TABLE IF NOT EXISTS sessions(
    token TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS captchas(
    id TEXT PRIMARY KEY,
    answer TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  )`);
  const n=await q("SELECT COUNT(*)::int AS n FROM tracks");
  if(n.rows[0].n===0){
    await q(`INSERT INTO tracks(title,artist_name,album_name,cover_url,audio_url,duration) VALUES
    ('Fenix Intro','Fenix Music','Fenix','https://placehold.co/700x700/18181b/ffffff?text=FX','',0),
    ('Night Drive','Fenix Music','Fenix','https://placehold.co/700x700/18181b/ffffff?text=NIGHT','',0),
    ('Neon Dreams','Fenix Music','Fenix','https://placehold.co/700x700/18181b/ffffff?text=NEON','',0)`);
  }
}
function token(){return crypto.randomBytes(32).toString("hex")}
function captcha(){return crypto.randomBytes(3).toString("hex").toUpperCase()}
async function currentUser(req){
  const t=req.cookies.fenix_session;
  if(!t)return null;
  const r=await q(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>NOW()`,[t]);
  return r.rows[0]||null;
}
function safe(u){if(!u)return null;const {password_hash,...x}=u;return x}
async function requireUser(req,res,next){req.user=await currentUser(req);if(!req.user)return res.status(401).json({error:"Требуется авторизация"});next()}

app.get("/api",(req,res)=>res.json({ok:true,service:"Fenix Music Backend",version:"2.0.0",status:"online",api:"/api",health:"/api/health",tracks:"/api/tracks"}));
app.get("/api/health",async(req,res)=>{try{await q("SELECT 1");res.json({ok:true,status:"healthy",database:"online"})}catch(e){res.status(500).json({ok:false,status:"error",error:e.message})}});
app.get("/api/auth/me",async(req,res)=>res.json({user:safe(await currentUser(req))}));

app.get("/api/auth/captcha",async(req,res)=>{
  const id=crypto.randomUUID(),a=captcha();
  await q("INSERT INTO captchas(id,answer,expires_at) VALUES($1,$2,NOW()+INTERVAL '10 minutes')",[id,a]);
  res.json({id,text:a});
});
app.post("/api/auth/register",async(req,res)=>{
  try{
    const {username,email,password,captcha:a,captcha_id}=req.body||{};
    if(!username||!email||!password)return res.status(400).json({error:"Заполните все поля"});
    if(String(password).length<6)return res.status(400).json({error:"Пароль минимум 6 символов"});
    const c=await q("SELECT * FROM captchas WHERE id=$1 AND expires_at>NOW()",[captcha_id]);
    if(!c.rows[0]||String(c.rows[0].answer).toUpperCase()!==String(a||"").trim().toUpperCase())return res.status(400).json({error:"Неверная CAPTCHA"});
    const exists=await q("SELECT id FROM users WHERE lower(email)=lower($1) OR lower(username)=lower($2)",[email,username]);
    if(exists.rows.length)return res.status(409).json({error:"Username или email уже используется"});
    const hash=await bcrypt.hash(password,12);
    const u=(await q("INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING *",[username,email,hash])).rows[0];
    await q("DELETE FROM captchas WHERE id=$1",[captcha_id]);
    const t=token();await q("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",[t,u.id]);
    res.cookie("fenix_session",t,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:2592e6});
    res.status(201).json({ok:true,user:safe(u),token:t});
  }catch(e){console.error(e);res.status(500).json({error:"Ошибка регистрации"})}
});
app.post("/api/auth/login",async(req,res)=>{
  try{
    const {login,email,username,password}=req.body||{};
    const key=login||email||username;
    const u=(await q("SELECT * FROM users WHERE lower(email)=lower($1) OR lower(username)=lower($1)",[key||""])).rows[0];
    if(!u||!(await bcrypt.compare(password||"",u.password_hash)))return res.status(401).json({error:"Неверный логин или пароль"});
    const t=token();await q("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",[t,u.id]);
    res.cookie("fenix_session",t,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:2592e6});
    res.json({ok:true,user:safe(u),token:t});
  }catch(e){res.status(500).json({error:"Ошибка входа"})}
});
app.post("/api/auth/logout",async(req,res)=>{const t=req.cookies.fenix_session;if(t)await q("DELETE FROM sessions WHERE token=$1",[t]);res.clearCookie("fenix_session");res.json({ok:true})});
app.put("/api/auth/profile",requireUser,async(req,res)=>{try{const {username,bio}=req.body||{};const u=(await q("UPDATE users SET username=COALESCE(NULLIF($1,''),username),bio=COALESCE($2,bio) WHERE id=$3 RETURNING *",[username,bio,req.user.id])).rows[0];res.json({ok:true,user:safe(u)})}catch(e){res.status(400).json({error:"Не удалось сохранить профиль"})}});

app.get("/api/tracks",async(req,res)=>{const r=await q("SELECT * FROM tracks ORDER BY id DESC");res.json({ok:true,tracks:r.rows})});
app.get("/api/tracks/:id",async(req,res)=>{const r=await q("SELECT * FROM tracks WHERE id=$1",[req.params.id]);if(!r.rows[0])return res.status(404).json({error:"Трек не найден"});res.json({ok:true,track:r.rows[0]})});
app.get("/api/tracks/:id/audio",async(req,res)=>{const r=await q("SELECT audio_url FROM tracks WHERE id=$1",[req.params.id]);if(!r.rows[0])return res.status(404).json({error:"Трек не найден"});if(!r.rows[0].audio_url)return res.status(404).json({error:"У трека нет audio_url"});res.redirect(r.rows[0].audio_url)});
app.post("/api/tracks/:id/play",async(req,res)=>{await q("UPDATE tracks SET plays_count=plays_count+1 WHERE id=$1",[req.params.id]);res.json({ok:true})});

app.get("/api/favorites",requireUser,async(req,res)=>{const r=await q("SELECT t.* FROM favorites f JOIN tracks t ON t.id=f.track_id WHERE f.user_id=$1 ORDER BY f.created_at DESC",[req.user.id]);res.json({ok:true,tracks:r.rows})});
app.post("/api/favorites",requireUser,async(req,res)=>{await q("INSERT INTO favorites(user_id,track_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[req.user.id,req.body.track_id]);res.json({ok:true})});
app.delete("/api/favorites/:id",requireUser,async(req,res)=>{await q("DELETE FROM favorites WHERE user_id=$1 AND track_id=$2",[req.user.id,req.params.id]);res.json({ok:true})});
app.get("/api/history",requireUser,async(req,res)=>{const r=await q("SELECT t.*,h.played_at FROM history h JOIN tracks t ON t.id=h.track_id WHERE h.user_id=$1 ORDER BY h.played_at DESC LIMIT 100",[req.user.id]);res.json({ok:true,tracks:r.rows})});
app.post("/api/history",requireUser,async(req,res)=>{await q("INSERT INTO history(user_id,track_id) VALUES($1,$2)",[req.user.id,req.body.track_id]);await q("UPDATE tracks SET plays_count=plays_count+1 WHERE id=$1",[req.body.track_id]);res.json({ok:true})});

const build=path.join(__dirname,"..","..","frontend","build");
app.use(express.static(build));
app.get("/{*path}",(req,res)=>{if(req.path.startsWith("/api/"))return res.status(404).json({error:"API route not found"});res.sendFile(path.join(build,"index.html"))});

async function start(){console.log("Connecting to PostgreSQL...");await initDatabase();app.listen(PORT,"0.0.0.0",()=>console.log(`FENIX MUSIC BACKEND ONLINE on ${PORT}`))}
start().catch(e=>{console.error("FENIX MUSIC BACKEND FAILED TO START",e);process.exit(1)});
