import React,{useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {Home,Radio as RadioIcon,Heart,History,Search,User,Menu,Play,Pause,SkipBack,SkipForward,Shuffle,Repeat2,Volume2,VolumeX,Plus,LogIn,LogOut,Music2,ListMusic,Upload,Send,ChevronDown,X} from "lucide-react";
import "./styles.css";

const api=async(path,opt={})=>{
  const token=localStorage.getItem("fenix_token");
  const headers={...(opt.headers||{})};
  if(token) headers.Authorization=`Bearer ${token}`;
  const r=await fetch(path,{...opt,headers});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.detail||"Ошибка");
  return data;
};

function Cover({track,size="md"}){
  const url=track?.cover_url;
  return url?<img className={`cover ${size}`} src={url} />:<div className={`cover ${size} placeholder`}><Music2/></div>
}

function TrackRow({track,onPlay,onLike}){
  return <div className="track-row">
    <Cover track={track}/>
    <div className="track-info" onClick={()=>onPlay(track)}>
      <b>{track.title}</b><span>{track.artist} · {track.album}</span>
    </div>
    <span className="duration">{track.duration_label}</span>
    <button className={track.liked?"icon active":"icon"} onClick={()=>onLike(track)}><Heart size={18} fill={track.liked?"currentColor":"none"}/></button>
    <button className="play-small" onClick={()=>onPlay(track)}><Play size={17} fill="currentColor"/></button>
  </div>
}

function Auth({onClose,onAuth}){
  const [mode,setMode]=useState("login"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[username,setUsername]=useState(""),[err,setErr]=useState("");
  const [tgToken,setTgToken]=useState("");
  useEffect(()=>{ if(!tgToken)return; const id=setInterval(async()=>{try{const d=await api(`/api/auth/telegram/status/${tgToken}`);if(d.status==="confirmed"){localStorage.setItem("fenix_token",d.token);onAuth(d.user);onClose();}}catch{}} ,1500);return()=>clearInterval(id)},[tgToken]);
  async function submit(e){e.preventDefault();setErr("");try{const d=await api(mode==="login"?"/api/auth/login":"/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(mode==="login"?{email,password}:{email,password,username})});localStorage.setItem("fenix_token",d.token);onAuth(d.user);onClose()}catch(e){setErr(e.message)}}
  async function telegram(){try{const d=await api("/api/auth/telegram/start",{method:"POST"});setTgToken(d.token);window.open(d.url,"_blank")}catch(e){setErr(e.message)}}
  return <div className="modal-back"><div className="modal auth-modal"><button className="close" onClick={onClose}><X/></button><div className="brand big">FENIX<span>MUSIC</span></div><h2>{mode==="login"?"С возвращением":"Создать аккаунт"}</h2>
    <form onSubmit={submit}>{mode==="register"&&<input placeholder="Никнейм" value={username} onChange={e=>setUsername(e.target.value)}/>}<input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary">{mode==="login"?"Войти":"Зарегистрироваться"}</button></form>
    <div className="or">или</div><button className="telegram" onClick={telegram}><Send size={18}/> Войти через Telegram</button>{tgToken&&<div className="waiting">Откройте Telegram и нажмите Start. Ожидаю подтверждение…</div>}{err&&<div className="error">{err}</div>}<button className="switch" onClick={()=>setMode(mode==="login"?"register":"login")}>{mode==="login"?"Нет аккаунта? Регистрация":"Уже есть аккаунт? Войти"}</button>
  </div></div>
}

function App(){
 const [page,setPage]=useState("home"),[tracks,setTracks]=useState([]),[radio,setRadio]=useState([]),[current,setCurrent]=useState(null),[playing,setPlaying]=useState(false),[user,setUser]=useState(null),[auth,setAuth]=useState(false),[query,setQuery]=useState(""),[mobile,setMobile]=useState(false),[volume,setVolume]=useState(.9),[liked,setLiked]=useState([]),[history,setHistory]=useState([]);
 const audio=useRef(new Audio()), [progress,setProgress]=useState(0),[duration,setDuration]=useState(0);
 useEffect(()=>{api("/api/tracks").then(setTracks).catch(()=>{});api("/api/radio").then(setRadio).catch(()=>{});api("/api/auth/me").then(setUser).catch(()=>{})},[]);
 useEffect(()=>{const a=audio.current;a.volume=volume;const time=()=>setProgress(a.currentTime||0),meta=()=>setDuration(a.duration||current?.duration||0),end=()=>setPlaying(false);a.addEventListener("timeupdate",time);a.addEventListener("loadedmetadata",meta);a.addEventListener("ended",end);return()=>{a.removeEventListener("timeupdate",time);a.removeEventListener("loadedmetadata",meta);a.removeEventListener("ended",end)}},[current,volume]);
 function play(t){if(!t?.audio_url)return; if(current?.id===t.id){audio.current.paused?audio.current.play():audio.current.pause();setPlaying(!audio.current.paused);return} audio.current.src=t.audio_url;audio.current.play().then(()=>setPlaying(true));setCurrent(t);setProgress(0);setDuration(t.duration||0);if(user)api(`/api/tracks/${t.id}/play`,{method:"POST"}).catch(()=>{})}
 function next(){if(!tracks.length)return;const i=tracks.findIndex(x=>x.id===current?.id);play(tracks[(i+1+tracks.length)%tracks.length])}
 function prev(){const i=tracks.findIndex(x=>x.id===current?.id);play(tracks[(i-1+tracks.length)%tracks.length])}
 function like(t){if(!user){setAuth(true);return}api(`/api/tracks/${t.id}/like`,{method:"POST"}).then(d=>{setTracks(x=>x.map(a=>a.id===t.id?{...a,liked:d.liked}:a));setLiked([])})}
 function radioPlay(r){audio.current.src=r.stream_url;audio.current.play().then(()=>setPlaying(true));setCurrent({id:r.id,title:r.name,artist:"Радио",album:r.genre,cover_url:r.cover,audio_url:r.stream_url,duration:0});}
 const filtered=useMemo(()=>tracks.filter(t=>(`${t.title} ${t.artist} ${t.album} ${t.genre}`).toLowerCase().includes(query.toLowerCase())),[tracks,query]);
 async function loadPage(p){setPage(p);if(p==="history"&&user)api("/api/history").then(setHistory).catch(()=>{});if(p==="favorites"&&user)api("/api/favorites").then(setLiked).catch(()=>{})}
 return <div className="app">
  <aside className={mobile?"sidebar open":"sidebar"}><div className="brand">FENIX<span>MUSIC</span></div><nav>
   <button className={page==="home"?"nav active":"nav"} onClick={()=>loadPage("home")}><Home/>Для вас</button>
   <button className={page==="radio"?"nav active":"nav"} onClick={()=>loadPage("radio")}><RadioIcon/>Радио</button>
   <button className={page==="favorites"?"nav active":"nav"} onClick={()=>loadPage("favorites")}><Heart/>Избранное</button>
   <button className={page==="history"?"nav active":"nav"} onClick={()=>loadPage("history")}><History/>История</button>
   <button className={page==="playlists"?"nav active":"nav"} onClick={()=>loadPage("playlists")}><ListMusic/>Плейлисты</button>
  </nav><div className="side-bottom">{user?<><div className="profile-mini"><div className="avatar">{user.username?.[0]?.toUpperCase()}</div><div><b>{user.username}</b><span>{user.telegram?"Telegram":"FENIX аккаунт"}</span></div></div><button className="nav" onClick={()=>{localStorage.removeItem("fenix_token");setUser(null)}}><LogOut/>Выйти</button></>:<button className="login-side" onClick={()=>setAuth(true)}><LogIn/>Войти</button>}</div></aside>
  <main><header><button className="mobile-menu" onClick={()=>setMobile(!mobile)}><Menu/></button><div className="search"><Search size={19}/><input value={query} onChange={e=>{setQuery(e.target.value);setPage("search")}} placeholder="Поиск музыки, артистов, альбомов…"/></div><button className="profile-btn" onClick={()=>user?null:setAuth(true)}><User size={19}/><span>{user?user.username:"Войти"}</span></button></header>
   <section className="content">
    {page==="home"&&<><div className="hero"><div><span className="eyebrow">FENIX MUSIC</span><h1>Музыка,<br/><em>которая</em> рядом.</h1><p>Слушай любимые треки и прямой эфир радио в одном месте.</p><button className="primary hero-btn" onClick={()=>tracks[0]&&play(tracks[0])}><Play size={18} fill="currentColor"/>Начать слушать</button></div><div className="hero-orb"><Music2/></div></div><h2>Популярное</h2><div className="tracks">{tracks.slice(0,10).map(t=><TrackRow key={t.id} track={t} onPlay={play} onLike={like}/>)}</div></>}
    {page==="search"&&<><h2>Результаты поиска</h2>{filtered.length?<div className="tracks">{filtered.map(t=><TrackRow key={t.id} track={t} onPlay={play} onLike={like}/>)}</div>:<Empty text="Ничего не найдено"/></>}
    {page==="radio"&&<><h2>Радио</h2><p className="muted">Прямой эфир · слушай без остановки</p><div className="radio-grid">{radio.map(r=><button className="radio-card" key={r.id} onClick={()=>radioPlay(r)}><img src={r.cover}/><div><b>{r.name}</b><span>{r.genre} · {r.bitrate}</span><small>▶ В эфир</small></div></button>)}</div></>}
    {page==="favorites"&&<><h2>Избранное</h2>{user?<div className="tracks">{liked.length?liked.map(t=><TrackRow key={t.id} track={t} onPlay={play} onLike={like}/>):<Empty text="Добавляй треки в избранное"/>}</div>:<Empty text="Войди, чтобы увидеть избранное"/>}</>}
    {page==="history"&&<><h2>Недавно прослушанное</h2>{user?<div className="tracks">{history.length?history.map((t,i)=><TrackRow key={i} track={t} onPlay={play} onLike={like}/>):<Empty text="История пока пустая"/>}</div>:<Empty text="Войди, чтобы увидеть историю"/>}</>}
    {page==="playlists"&&<><h2>Плейлисты</h2>{user?<PlaylistPage/>:<Empty text="Войди, чтобы создавать плейлисты"/>}</>}
   </section>
  </main>
  {current&&<div className="player"><Cover track={current}/><div className="now"><b>{current.title}</b><span>{current.artist}</span></div><div className="controls"><button onClick={prev}><SkipBack/></button><button className="play-main" onClick={()=>play(current)}>{playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button><button onClick={next}><SkipForward/></button></div><div className="seek"><span>{fmt(progress)}</span><input type="range" min="0" max={duration||100} value={Math.min(progress,duration||100)} onChange={e=>{const v=+e.target.value;audio.current.currentTime=v;setProgress(v)}}/><span>{fmt(duration)}</span></div><div className="vol"><Volume2/><input type="range" min="0" max="1" step=".01" value={volume} onChange={e=>setVolume(+e.target.value)}/></div></div>}
  {auth&&<Auth onClose={()=>setAuth(false)} onAuth={setUser}/>}
 </div>
}

function PlaylistPage(){const [ps,setPs]=useState([]),[name,setName]=useState("");useEffect(()=>{api("/api/playlists").then(setPs).catch(()=>{})},[]);async function add(){if(!name)return;const p=await api("/api/playlists",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});setPs([...ps,{...p,tracks:[]}]);setName("")}return <><div className="playlist-create"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Название нового плейлиста"/><button className="primary" onClick={add}><Plus/>Создать</button></div><div className="playlist-grid">{ps.map(p=><div className="playlist-card" key={p.id}><ListMusic/><b>{p.name}</b><span>{p.tracks?.length||0} треков</span></div>)}</div></>}
function Empty({text}){return <div className="empty"><Music2/><b>{text}</b></div>}
function fmt(n){n=Math.floor(n||0);return `${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`}
createRoot(document.getElementById("root")).render(<App/>);
