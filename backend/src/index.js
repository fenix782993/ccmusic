
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || `http://localhost:${PORT}`;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, key] = String(stored).split(':');
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(key, 'hex'));
}
const sessions = new Map();
const captchas = new Map();

function tokenFor(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expires: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  return token;
}
async function auth(req,res,next){
  const h=req.headers.authorization||'';
  const token=h.startsWith('Bearer ')?h.slice(7):'';
  const s=sessions.get(token);
  if(!s || s.expires<Date.now()){ sessions.delete(token); return res.status(401).json({error:'Необходим вход'}); }
  const r=await pool.query('SELECT id, username, email, avatar_url, subscription_tier FROM users WHERE id=$1',[s.userId]);
  if(!r.rows[0]) return res.status(401).json({error:'Пользователь не найден'});
  req.user=r.rows[0]; next();
}

app.get('/api/health',(req,res)=>res.json({status:'ok',service:'Fenix Music API'}));

app.get('/api/auth/captcha',(req,res)=>{
  const id=crypto.randomBytes(12).toString('hex');
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let text=''; for(let i=0;i<6;i++) text+=chars[crypto.randomInt(chars.length)];
  captchas.set(id,{text,expires:Date.now()+5*60*1000});
  res.json({id,text}); // For production, render this server-side as an image.
});
app.post('/api/auth/register',async(req,res)=>{
  try{
    const {username,email,password,captcha}=req.body||{};
    if(!username||!email||!password||!captcha) return res.status(400).json({error:'Заполните все поля'});
    const captchaId=req.body.captcha_id;
    // Client can send the current captcha id. For compatibility with the UI, accept
    // the newest valid captcha if only the text was supplied.
    let entry=null, entryId=null;
    if(captchaId && captchas.has(captchaId)){entry=captchas.get(captchaId);entryId=captchaId;}
    else {
      for(const [id,v] of captchas){ if(v.expires>Date.now()){entry=v;entryId=id;} }
    }
    if(!entry || entry.expires<Date.now() || entry.text.toUpperCase()!==String(captcha).trim().toUpperCase())
      return res.status(400).json({error:'Неверная CAPTCHA'});
    captchas.delete(entryId);
    if(password.length<6) return res.status(400).json({error:'Пароль минимум 6 символов'});
    const exists=await pool.query('SELECT id FROM users WHERE lower(username)=lower($1) OR lower(email)=lower($2)',[username,email]);
    if(exists.rows.length) return res.status(409).json({error:'Пользователь или email уже существует'});
    const ins=await pool.query('INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING id,username,email,avatar_url,subscription_tier',[username,email,hashPassword(password)]);
    const user=ins.rows[0]; res.json({token:tokenFor(user),user});
  }catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});
app.post('/api/auth/login',async(req,res)=>{
  try{
    const {login,password}=req.body||{};
    const r=await pool.query('SELECT * FROM users WHERE lower(email)=lower($1) OR lower(username)=lower($1) LIMIT 1',[login]);
    const user=r.rows[0];
    if(!user || !verifyPassword(password,user.password_hash)) return res.status(401).json({error:'Неверный логин или пароль'});
    const safe={id:user.id,username:user.username,email:user.email,avatar_url:user.avatar_url,subscription_tier:user.subscription_tier};
    res.json({token:tokenFor(safe),user:safe});
  }catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});
app.get('/api/auth/me',auth,(req,res)=>res.json(req.user));

app.get('/api/tracks',async(req,res)=>{
  try{
    const {search,genre}=req.query;
    let sql=`SELECT t.id,t.title,t.duration,t.audio_url,t.genre,t.plays_count,t.is_premium,t.created_at,
      a.name AS artist_name, al.title AS album_title, al.cover_url
      FROM tracks t JOIN artists a ON t.artist_id=a.id
      LEFT JOIN albums al ON t.album_id=al.id`;
    const p=[];
    if(search){sql+=' WHERE t.title ILIKE $1 OR a.name ILIKE $1 OR t.genre ILIKE $1';p.push(`%${search}%`);}
    else if(genre){sql+=' WHERE t.genre=$1';p.push(genre);}
    sql+=' ORDER BY t.created_at DESC, t.plays_count DESC LIMIT 100';
    const r=await pool.query(sql,p);res.json(r.rows);
  }catch(e){console.error(e);res.status(500).json({error:'Server error'});}
});

async function telegram(method, body){
  if(!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const data=await r.json();
  if(!data.ok) throw new Error(data.description||'Telegram API error');
  return data.result;
}

app.get('/api/tracks/:id/audio',async(req,res)=>{
  try{
    const r=await pool.query('SELECT telegram_file_id,audio_url FROM tracks WHERE id=$1',[req.params.id]);
    if(!r.rows[0]) return res.status(404).end();
    const t=r.rows[0];
    if(t.telegram_file_id && BOT_TOKEN){
      const file=await telegram('getFile',{file_id:t.telegram_file_id});
      const url=`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
      const rr=await fetch(url);
      if(!rr.ok) return res.status(502).end();
      res.setHeader('Content-Type',rr.headers.get('content-type')||'audio/mpeg');
      res.setHeader('Cache-Control','public,max-age=3600');
      rr.body.pipeTo(new WritableStream({write(chunk){res.write(Buffer.from(chunk));},close(){res.end();}}));
      pool.query('UPDATE tracks SET plays_count=plays_count+1 WHERE id=$1',[req.params.id]).catch(()=>{});
      return;
    }
    if(t.audio_url) return res.redirect(t.audio_url);
    res.status(404).end();
  }catch(e){console.error(e);res.status(500).end();}
});

// Telegram bot: send audio/document to the bot and it is automatically added to DB and channel.
let offset=0;
async function processTelegramUpdate(update){
  const msg=update.message;
  if(!msg) return;
  const audio=msg.audio || (msg.document && String(msg.document.mime_type||'').startsWith('audio/') ? msg.document : null);
  if(!audio) return;
  try{
    const title=audio.title || audio.file_name?.replace(/\.[^.]+$/,'') || 'Без названия';
    const artist=audio.performer || msg.caption?.split('\\n')[0] || 'Неизвестный исполнитель';
    const duration=Number(audio.duration||0);
    const fileId=audio.file_id;
    const cover=msg.photo?.length ? `telegram_photo:${msg.photo[msg.photo.length-1].file_id}` : '';
    const genre='Music';

    const artistR=await pool.query('SELECT id FROM artists WHERE lower(name)=lower($1) LIMIT 1',[artist]);
    const artistId=artistR.rows[0]?.id || (await pool.query('INSERT INTO artists(name) VALUES($1) RETURNING id',[artist])).rows[0].id;

    const trackR=await pool.query(`INSERT INTO tracks(title,artist_id,duration,audio_url,genre,telegram_file_id)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[title,artistId,duration,`${PUBLIC_API_URL}/api/tracks/__ID__/audio`,genre,fileId]);
    const trackId=trackR.rows[0].id;
    await pool.query('UPDATE tracks SET audio_url=$1 WHERE id=$2',[`${PUBLIC_API_URL}/api/tracks/${trackId}/audio`,trackId]);

    let channelMessageId=null;
    if(CHANNEL_ID){
      const sent=await telegram('sendAudio',{chat_id:CHANNEL_ID,audio:fileId,caption:`🎵 ${title}\\n👤 ${artist}\\n🆔 ID: ${trackId}`});
      channelMessageId=sent.message_id;
      await pool.query('UPDATE tracks SET telegram_channel_id=$1, telegram_message_id=$2 WHERE id=$3',[String(CHANNEL_ID),channelMessageId,trackId]);
    }
    await telegram('sendMessage',{chat_id:msg.chat.id,text:`✅ Трек добавлен!\\n\\n🎵 ${title}\\n👤 ${artist}\\n🆔 ID: ${trackId}\\n${CHANNEL_ID?'📢 Опубликован в канале и появился на сайте.':''}`});
  }catch(e){
    console.error('Telegram import error',e);
    await telegram('sendMessage',{chat_id:msg.chat.id,text:`❌ Не удалось добавить трек: ${e.message}`}).catch(()=>{});
  }
}
async function botLoop(){
  if(!BOT_TOKEN) return;
  try{
    const updates=await telegram('getUpdates',{offset,timeout:25,allowed_updates:['message']});
    for(const u of updates){offset=u.update_id+1;await processTelegramUpdate(u);}
  }catch(e){console.error('Telegram polling:',e.message);await new Promise(r=>setTimeout(r,3000));}
  setImmediate(botLoop);
}
botLoop();

app.listen(PORT,()=>console.log(`Fenix Music API running on ${PORT}`));
