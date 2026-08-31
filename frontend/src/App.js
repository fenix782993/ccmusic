
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, Search, Library, Heart, Play, Pause, SkipBack, SkipForward,
  Volume2, Repeat, Shuffle, Crown, Flame, Clock, User, Menu, X,
  LogIn, UserPlus, Eye, EyeOff, RefreshCw, Send, LogOut
} from 'lucide-react';
import './App.css';

const API = process.env.REACT_APP_API_URL || '';

const fallbackTracks = [
  { id: 1, title: 'Neon Horizon', artist_name: 'CyberPulse', genre: 'Synthwave',
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=700&auto=format&fit=crop&q=80',
    duration: 214, audio_url: '' },
  { id: 2, title: 'Midnight Rain', artist_name: 'Aura', genre: 'Lo-Fi',
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=700&auto=format&fit=crop&q=80',
    duration: 198, audio_url: '' },
];

function formatTime(sec = 0) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function apiUrl(path) {
  return `${API}${path}`;
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [tracks, setTracks] = useState([]);
  const [track, setTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [search, setSearch] = useState('');
  const [volume, setVolume] = useState(0.8);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [auth, setAuth] = useState(() => localStorage.getItem('fenix_token') ? true : false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const audioRef = useRef(null);

  const loadTracks = async () => {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const r = await fetch(apiUrl(`/api/tracks${q}`));
      if (!r.ok) throw new Error();
      const data = await r.json();
      setTracks(Array.isArray(data) ? data : []);
    } catch {
      if (!tracks.length) setTracks(fallbackTracks);
    }
  };

  const loadMe = async () => {
    const token = localStorage.getItem('fenix_token');
    if (!token) return;
    try {
      const r = await fetch(apiUrl('/api/auth/me'), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error();
      setUser(await r.json());
      setAuth(true);
    } catch {
      localStorage.removeItem('fenix_token');
      setAuth(false);
    }
  };

  useEffect(() => { loadTracks(); loadMe(); }, []);
  useEffect(() => {
    const t = setTimeout(loadTracks, 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const timer = setInterval(loadTracks, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!track || !audioRef.current) return;
    const audio = audioRef.current;
    const source = track.audio_url || `${API}/api/tracks/${track.id}/audio`;
    if (audio.src !== new URL(source, window.location.origin).href) {
      audio.src = source;
    }
    if (playing) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [track, playing]);

  const selectTrack = async (t) => {
    setTrack(t);
    setPlaying(true);
    setPosition(0);
  };

  const next = () => {
    if (!tracks.length) return;
    const i = Math.max(0, tracks.findIndex(x => x.id === track?.id));
    selectTrack(tracks[(i + 1) % tracks.length]);
  };

  const prev = () => {
    if (!tracks.length) return;
    const i = Math.max(0, tracks.findIndex(x => x.id === track?.id));
    selectTrack(tracks[(i - 1 + tracks.length) % tracks.length]);
  };

  const logout = () => {
    localStorage.removeItem('fenix_token');
    setAuth(false); setUser(null); setAuthOpen(false);
  };

  const genres = useMemo(() => [...new Set(tracks.map(t => t.genre).filter(Boolean))], [tracks]);

  return (
    <div className="app">
      <audio ref={audioRef}
        onTimeUpdate={e => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration || track?.duration || 0)}
        onEnded={next}
      />

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div>
          <div className="brand"><div className="brandIcon"><Flame size={21}/></div><b>FENIX MUSIC</b></div>
          <nav>
            <Nav icon={<Home/>} text="Главная" active={tab==='home'} onClick={()=>{setTab('home');setMobileOpen(false)}}/>
            <Nav icon={<Search/>} text="Поиск" active={tab==='search'} onClick={()=>{setTab('search');setMobileOpen(false)}}/>
            <Nav icon={<Library/>} text="Библиотека" active={tab==='library'} onClick={()=>{setTab('library');setMobileOpen(false)}}/>
            <Nav icon={<Heart/>} text="Избранное" active={tab==='favorites'} onClick={()=>{setTab('favorites');setMobileOpen(false)}}/>
            <Nav icon={<Clock/>} text="История" active={tab==='history'} onClick={()=>{setTab('history');setMobileOpen(false)}}/>
          </nav>
        </div>
        <div>
          <div className="premiumCard"><Crown size={19}/><div><b>Fenix Premium</b><span>Без рекламы и максимум качества</span></div></div>
          {auth ? <button className="profileButton" onClick={()=>setTab('profile')}><User size={19}/><span>{user?.username || 'Профиль'}</span></button>
                 : <button className="profileButton" onClick={()=>{setAuthMode('login');setAuthOpen(true)}}><LogIn size={19}/><span>Войти</span></button>}
        </div>
      </aside>

      {mobileOpen && <div className="overlay" onClick={()=>setMobileOpen(false)}/>}

      <main className="main">
        <header className="topbar">
          <div className="mobileBrand"><button className="iconButton" onClick={()=>setMobileOpen(!mobileOpen)}>{mobileOpen?<X/>:<Menu/>}</button><b>FENIX</b></div>
          <div className="searchBox"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Что хотите послушать?"/></div>
          <div className="topActions">
            {!auth && <button className="authButton" onClick={()=>{setAuthMode('login');setAuthOpen(true)}}>Войти</button>}
            {auth && <button className="avatar" onClick={()=>setTab('profile')}>{(user?.username||'FX').slice(0,2).toUpperCase()}</button>}
          </div>
        </header>

        <section className="content">
          {tab === 'home' && <>
            <section className="hero">
              <div><span className="eyebrow">НОВЫЕ ТРЕКИ АВТОМАТИЧЕСКИ</span><h1>Музыка из Telegram<br/>сразу на Fenix Music</h1>
              <p>Отправляйте треки боту — после публикации в канале они автоматически появляются здесь.</p>
              <button className="primary" onClick={()=>window.open('https://t.me/fenix_music_bot','_blank')}><Send size={17}/> Открыть бота</button></div>
            </section>
            <TrackSection title="🔥 Популярные треки" tracks={tracks} onPlay={selectTrack}/>
            {genres.length>0 && <section className="section"><h2>Жанры</h2><div className="genres">{genres.map(g=><button key={g} onClick={()=>setSearch(g)}>{g}</button>)}</div></section>}
          </>}

          {tab === 'search' && <section className="section"><h1>Поиск</h1><div className="mobileSearch"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Трек, исполнитель, жанр"/></div><TrackSection title={search?`Результаты: ${search}`:'Все треки'} tracks={tracks} onPlay={selectTrack}/></section>}

          {tab === 'library' && <section className="section"><h1>Библиотека</h1><p className="muted">Треки из каталога доступны здесь. Избранное и история привязываются к аккаунту.</p><TrackSection title="Каталог" tracks={tracks} onPlay={selectTrack}/></section>}

          {tab === 'favorites' && <section className="empty"><Heart size={48}/><h2>Избранное</h2><p>Добавляйте любимые треки в избранное после входа.</p></section>}
          {tab === 'history' && <section className="empty"><Clock size={48}/><h2>История</h2><p>История прослушиваний будет сохраняться в аккаунте.</p></section>}
          {tab === 'profile' && <section className="profilePage"><h1>Профиль</h1>{auth ? <><div className="profileCard"><div className="bigAvatar">{(user?.username||'FX').slice(0,2).toUpperCase()}</div><div><h2>{user?.username}</h2><p>{user?.email}</p></div></div><button className="danger" onClick={logout}><LogOut size={17}/> Выйти</button></> : <button className="primary" onClick={()=>{setAuthMode('login');setAuthOpen(true)}}>Войти</button>}</section>}
        </section>
      </main>

      {track && <footer className="player">
        <div className="now"><img src={track.cover_url || fallbackTracks[0].cover_url}/><div><b>{track.title}</b><span>{track.artist_name}</span></div><Heart size={18}/></div>
        <div className="controls">
          <div className="controlRow"><button onClick={prev}><SkipBack/></button><button className="play" onClick={()=>setPlaying(!playing)}>{playing?<Pause/>:<Play fill="currentColor"/>}</button><button onClick={next}><SkipForward/></button><button onClick={()=>{}}><Repeat/></button></div>
          <div className="progress"><span>{formatTime(position)}</span><input type="range" min="0" max={duration || track.duration || 1} value={Math.min(position,duration||track.duration||1)} onChange={e=>{const v=Number(e.target.value);setPosition(v);if(audioRef.current)audioRef.current.currentTime=v}}/><span>{formatTime(duration || track.duration)}</span></div>
        </div>
        <div className="volume"><Volume2 size={18}/><input type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></div>
      </footer>}

      <nav className="mobileNav">
        <Nav icon={<Home/>} text="Главная" active={tab==='home'} onClick={()=>setTab('home')}/>
        <Nav icon={<Search/>} text="Поиск" active={tab==='search'} onClick={()=>setTab('search')}/>
        <Nav icon={<Library/>} text="Библиотека" active={tab==='library'} onClick={()=>setTab('library')}/>
        <Nav icon={<Heart/>} text="Избранное" active={tab==='favorites'} onClick={()=>setTab('favorites')}/>
        <Nav icon={<User/>} text="Профиль" active={tab==='profile'} onClick={()=>setTab('profile')}/>
      </nav>

      {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={()=>setAuthOpen(false)} onSuccess={(u)=>{setUser(u);setAuth(true);setAuthOpen(false)}}/>}
    </div>
  );
}

function Nav({icon,text,active,onClick}) {
  return <button className={`navItem ${active?'active':''}`} onClick={onClick}>{icon}<span>{text}</span></button>;
}

function TrackSection({title,tracks,onPlay}) {
  return <section className="section"><h2>{title}</h2><div className="trackGrid">{tracks.map(t=><article className="track" key={t.id} onClick={()=>onPlay(t)}>
    <img src={t.cover_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=700&auto=format&fit=crop&q=80'} />
    <div className="trackInfo"><b>{t.title}</b><span>{t.artist_name || 'Unknown Artist'}</span><small>{t.genre || 'Music'} · {formatTime(t.duration)}</small></div>
    <button className="trackPlay" onClick={e=>{e.stopPropagation();onPlay(t)}}><Play fill="currentColor"/></button>
  </article>)}</div></section>;
}

function AuthModal({mode,setMode,onClose,onSuccess}) {
  const [form,setForm]=useState({username:'',email:'',password:'',captcha:''});
  const [captcha,setCaptcha]=useState(null);
  const [show,setShow]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  const getCaptcha=async()=>{ try { const r=await fetch(apiUrl('/api/auth/captcha')); setCaptcha(await r.json()); } catch { setCaptcha(null); }};
  useEffect(()=>{getCaptcha()},[mode]);

  const submit=async e=>{
    e.preventDefault();setError('');setBusy(true);
    try {
      const path=mode==='register'?'/api/auth/register':'/api/auth/login';
      const payload=mode==='register'?form:{login:form.email||form.username,password:form.password};
      if(mode==='register') payload.captcha=form.captcha;
      const r=await fetch(apiUrl(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await r.json(); if(!r.ok) throw new Error(data.error||'Ошибка');
      localStorage.setItem('fenix_token',data.token); onSuccess(data.user);
    } catch(err){setError(err.message); if(mode==='register') getCaptcha();} finally {setBusy(false);}
  };

  return <div className="modalBackdrop" onMouseDown={onClose}><div className="authModal" onMouseDown={e=>e.stopPropagation()}>
    <button className="close" onClick={onClose}><X/></button><div className="authLogo"><Flame/></div>
    <span className="eyebrow">{mode==='register'?'СОЗДАНИЕ АККАУНТА':'С ВОЗВРАЩЕНИЕМ'}</span><h2>{mode==='register'?'Создай свой Fenix':'Войти в Fenix Music'}</h2>
    <p className="muted">{mode==='register'?'Аккаунт сохранит профиль, историю и настройки.':'Пароль проверяется в базе, поэтому регистрация не нужна при каждом входе.'}</p>
    <form onSubmit={submit}>
      {mode==='register' && <input placeholder="Имя пользователя" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required/>}
      <input placeholder={mode==='register'?'Email':'Email или имя пользователя'} type={mode==='register'?'email':'text'} value={form.email||form.username} onChange={e=>setForm({...form,email:e.target.value,username:mode==='login'?e.target.value:form.username})} required/>
      <div className="passwordInput"><input placeholder="Пароль" type={show?'text':'password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required minLength="6"/><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div>
      {mode==='register' && <><div className="captcha"><div className="captchaImage">{captcha?.text || '------'}</div><button type="button" onClick={getCaptcha}><RefreshCw/></button></div><input placeholder="Введите код с картинки" value={form.captcha} onChange={e=>setForm({...form,captcha:e.target.value})} required/></>}
      {error && <div className="error">{error}</div>}
      <button className="primary full" disabled={busy}>{busy?'Подождите...':mode==='register'?'Создать аккаунт':'Войти'}</button>
    </form>
    <button className="switch" onClick={()=>{setError('');setMode(mode==='register'?'login':'register')}}>{mode==='register'?'Уже есть аккаунт? Войти':'Нет аккаунта? Зарегистрироваться'}</button>
  </div></div>;
}
