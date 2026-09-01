import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
import.meta.env.VITE_API_URL ||
(typeof window !== "undefined" ? window.location.origin : "");

const DEFAULT_COVER =
"https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80";

const FALLBACK_TRACKS = [
{
id: 1,
title: "Fenix Night",
artist: "Fenix Music",
genre: "Electronic",
duration: 214,
cover:
"https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
audio_url: "",
},
{
id: 2,
title: "Neon Dreams",
artist: "Fenix Music",
genre: "Synthwave",
duration: 198,
cover:
"https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80",
audio_url: "",
},
{
id: 3,
title: "Midnight Drive",
artist: "Fenix Music",
genre: "Chill",
duration: 231,
cover:
"https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80",
audio_url: "",
},
{
id: 4,
title: "Red Horizon",
artist: "Fenix Music",
genre: "Pop",
duration: 187,
cover:
"https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=80",
audio_url: "",
},
{
id: 5,
title: "After Dark",
artist: "Fenix Music",
genre: "Electronic",
duration: 245,
cover:
"https://images.unsplash.com/photo-1571266028243-d220c9c3b9e3?auto=format&fit=crop&w=900&q=80",
audio_url: "",
},
{
id: 6,
title: "Lost Signal",
artist: "Fenix Music",
genre: "Ambient",
duration: 205,
cover:
"https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
audio_url: "",
},
];

function normalizeTrack(track, index) {
return {
id: track.id ?? track._id ?? index + 1,
title: track.title || track.name || "Без названия",
artist: track.artist || track.author || "Fenix Music",
album: track.album || "",
genre: track.genre || track.category || "Music",
duration: Number(track.duration || 0),
cover:
track.cover ||
track.cover_url ||
track.image ||
track.image_url ||
DEFAULT_COVER,
audio_url:
track.audio_url ||
track.audioUrl ||
track.url ||
track.stream_url ||
"",
liked: Boolean(track.liked),
};
}

async function apiFetch(path, options = {}) {
const response = await fetch(`${API_BASE}${path}`, {
credentials: "include",
...options,
headers: {
Accept: "application/json",
...(options.body ? { "Content-Type": "application/json" } : {}),
...(options.headers || {}),
},
});

const text = await response.text();
let data = null;

try {
data = text ? JSON.parse(text) : null;
} catch {
data = text;
}

if (!response.ok) {
throw new Error(
data?.detail ||
data?.message ||
data?.error ||
`Ошибка сервера: ${response.status}`
);
}

return data;
}

function formatTime(seconds) {
const value = Number(seconds);
if (!Number.isFinite(value) || value <= 0) return "0:00";

const minutes = Math.floor(value / 60);
const secs = Math.floor(value % 60)
.toString()
.padStart(2, "0");

return `${minutes}:${secs}`;
}

function randomCaptcha() {
return String(Math.floor(1000 + Math.random() * 9000));
}

function Icon({ name, size = 20, fill = "none" }) {
const common = {
width: size,
height: size,
viewBox: "0 0 24 24",
fill,
xmlns: "http://www.w3.org/2000/svg",
"aria-hidden": true,
};

switch (name) {
case "home":
return (
<svg {...common}> <path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9Z" stroke="currentColor" strokeWidth="1.8" /> <path d="M9 21v-7h6v7" stroke="currentColor" strokeWidth="1.8" /> </svg>
);
case "search":
return (
<svg {...common}> <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.8" /> <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> </svg>
);
case "heart":
return (
<svg {...common}> <path d="M20.8 8.7c0 5.2-8.8 10.2-8.8 10.2S3.2 13.9 3.2 8.7A5 5 0 0 1 12 5.5a5 5 0 0 1 8.8 3.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /> </svg>
);
case "heartFill":
return (
<svg {...common} fill="currentColor"> <path d="M12 21s-8.8-5.5-10.2-10.4C.7 5.7 3.1 2 6.9 2c2.1 0 4 1.2 5.1 3 1.1-1.8 3-3 5.1-3 3.8 0 6.2 3.7 5.1 8.6C20.8 15.5 12 21 12 21Z" /> </svg>
);
case "play":
return (
<svg {...common} fill="currentColor"> <path d="M8 5.4v13.2c0 1 1.1 1.6 2 1l9.4-6.6a1.2 1.2 0 0 0 0-2L10 4.4c-.9-.6-2 .1-2 1Z" /> </svg>
);
case "pause":
return (
<svg {...common} fill="currentColor"> <rect x="6" y="4" width="4" height="16" rx="1" /> <rect x="14" y="4" width="4" height="16" rx="1" /> </svg>
);
case "next":
return (
<svg {...common} fill="currentColor"> <path d="M5 5.5v13l9-6.5-9-6.5Zm10 0v13h3v-13h-3Z" /> </svg>
);
case "prev":
return (
<svg {...common} fill="currentColor"> <path d="M19 5.5v13l-9-6.5 9-6.5ZM6 5.5v13h3v-13H6Z" /> </svg>
);
case "shuffle":
return (
<svg {...common}> <path d="M16 3h5v5M4 7h2.5c3.8 0 5.4 5 9 5H21M16 21h5v-5M4 17h2.5c1.7 0 2.8-1.2 3.8-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> </svg>
);
case "repeat":
return (
<svg {...common}> <path d="M17 4h3a2 2 0 0 1 2 2v3M7 20H4a2 2 0 0 1-2-2v-3M20 9l2-2-2-2M4 15l-2 2 2 2M5 8h11a4 4 0 0 1 4 4M19 16H8a4 4 0 0 1-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /> </svg>
);
case "volume":
return (
<svg {...common}> <path d="M4 9v6h4l5 4V5L8 9H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /> <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> </svg>
);
case "queue":
return (
<svg {...common}> <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> </svg>
);
case "user":
return (
<svg {...common}> <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" /> <path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> </svg>
);
case "settings":
return (
<svg {...common}> <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="1.7" /> <path d="m19 13 .9 1.2-1.8 3.1-1.5-.3a8 8 0 0 1-1.7 1l-.4 1.5h-3.6l-.4-1.5a8 8 0 0 1-1.7-1l-1.5.3-1.8-3.1L7 13a8 8 0 0 1 0-2l-1.4-1.2 1.8-3.1 1.5.3a8 8 0 0 1 1.7-1l.4-1.5h3.6l.4 1.5a8 8 0 0 1 1.7 1l1.5-.3 1.8 3.1L19 11a8 8 0 0 1 0 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /> </svg>
);
case "menu":
return (
<svg {...common}> <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> </svg>
);
case "close":
return (
<svg {...common}> <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /> </svg>
);
case "more":
return (
<svg {...common} fill="currentColor"> <circle cx="5" cy="12" r="1.7" /> <circle cx="12" cy="12" r="1.7" /> <circle cx="19" cy="12" r="1.7" /> </svg>
);
case "plus":
return (
<svg {...common}> <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> </svg>
);
case "chevron":
return (
<svg {...common}> <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> </svg>
);
case "expand":
return (
<svg {...common}> <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> </svg>
);
case "clock":
return (
<svg {...common}> <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" /> <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /> </svg>
);
default:
return null;
}
}

function Logo() {
return ( <div className="fm-logo"> <div className="fm-logo-mark">F</div> <div> <div className="fm-logo-title">FENIX</div> <div className="fm-logo-subtitle">MUSIC</div> </div> </div>
);
}

function TrackCover({ track, size = "normal" }) {
return (
<div className={`fm-cover fm-cover-${size}`}>
<img src={track.cover || DEFAULT_COVER} alt="" /> <div className="fm-cover-shine" /> </div>
);
}

function TrackRow({
track,
index,
active,
playing,
liked,
onPlay,
onLike,
onQueue,
}) {
return (
<div className={`fm-track-row ${active ? "is-active" : ""}`}>
<button className="fm-track-index" onClick={() => onPlay(track)}>
{active && playing ? ( <span className="fm-equalizer"> <i /> <i /> <i /> </span>
) : (
index + 1
)} </button>

  <button className="fm-row-main" onClick={() => onPlay(track)}>
    <TrackCover track={track} size="small" />
    <div className="fm-row-text">
      <strong>{track.title}</strong>
      <span>{track.artist}</span>
    </div>
  </button>

  <div className="fm-row-album">{track.album || track.genre}</div>

  <div className="fm-row-duration">{formatTime(track.duration)}</div>

  <button
    className={`fm-icon-button ${liked ? "is-liked" : ""}`}
    onClick={() => onLike(track)}
    aria-label="Избранное"
  >
    <Icon name={liked ? "heartFill" : "heart"} size={19} />
  </button>

  <button
    className="fm-icon-button"
    onClick={() => onQueue(track)}
    aria-label="В очередь"
  >
    <Icon name="more" size={20} />
  </button>
</div>

);
}

function SectionHeader({ title, subtitle, action, onAction }) {
return ( <div className="fm-section-header"> <div> <h2>{title}</h2>
{subtitle && <p>{subtitle}</p>} </div>
  {action && (
    <button className="fm-see-all" onClick={onAction}>
      {action}
      <Icon name="chevron" size={16} />
    </button>
  )}
</div>

);
}

function MusicCard({ track, onPlay, onLike, liked }) {
return ( <article className="fm-music-card">
<button className="fm-card-cover-wrap" onClick={() => onPlay(track)}> <TrackCover track={track} /> <span className="fm-card-play"> <Icon name="play" size={22} /> </span> </button>

  <div className="fm-card-info">
    <button className="fm-card-title" onClick={() => onPlay(track)}>
      {track.title}
    </button>
    <div className="fm-card-bottom">
      <span>{track.artist}</span>
      <button
        className={`fm-mini-like ${liked ? "is-liked" : ""}`}
        onClick={() => onLike(track)}
      >
        <Icon name={liked ? "heartFill" : "heart"} size={17} />
      </button>
    </div>
  </div>
</article>

);
}

function AuthModal({ mode, onClose, onSuccess }) {
const [authMode, setAuthMode] = useState(mode);
const [login, setLogin] = useState("");
const [password, setPassword] = useState("");
const [captcha, setCaptcha] = useState("");
const [captchaId, setCaptchaId] = useState("");
const [captchaCode, setCaptchaCode] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

async function loadCaptcha() {
setError("");
try {
  const data = await apiFetch("/api/auth/captcha");
  setCaptchaId(data.captcha_id || data.id || "");
  setCaptchaCode(data.code || data.text || "");
} catch {
  setCaptchaId("");
  setCaptchaCode(randomCaptcha());
  setError("Не удалось загрузить CAPTCHA с сервера. Используется резервный код.");
}
}

useEffect(() => {
loadCaptcha();
}, []);

async function submit(event) {
event.preventDefault();
setError("");

```
if (captcha.length !== 4) {
  setError("Введите 4 цифры CAPTCHA.");
  return;
}

if (captcha !== captchaCode) {
  setError("Неверный код CAPTCHA.");
  await loadCaptcha();
  setCaptcha("");
  return;
}

setLoading(true);

try {
  const endpoint =
    authMode === "login" ? "/api/auth/login" : "/api/auth/register";

  const data = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      login,
      username: login,
      email: login,
      password,
      captcha_id: captchaId,
      captcha: captcha,
      captcha_code: captcha,
    }),
  });

  onSuccess(data?.user || data);
} catch (err) {
  setError(err.message || "Не удалось выполнить операцию.");
  await loadCaptcha();
  setCaptcha("");
} finally {
  setLoading(false);
}
```

}

return ( <div className="fm-modal-backdrop" onMouseDown={onClose}>
<div
className="fm-auth-modal"
onMouseDown={(event) => event.stopPropagation()}
> <button className="fm-modal-close" onClick={onClose}> <Icon name="close" size={24} /> </button>

```
    <div className="fm-auth-glow" />

    <div className="fm-auth-logo">
      <div className="fm-auth-logo-mark">F</div>
    </div>

    <h2>{authMode === "login" ? "С возвращением" : "Создать аккаунт"}</h2>
    <p>
      {authMode === "login"
        ? "Войдите в свою музыкальную вселенную"
        : "Присоединяйтесь к Fenix Music"}
    </p>

    <form onSubmit={submit}>
      <label className="fm-field">
        <span>Логин или E-mail</span>
        <input
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          placeholder="Введите логин"
          autoComplete="username"
          required
        />
      </label>

      <label className="fm-field">
        <span>Пароль</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Введите пароль"
          type="password"
          autoComplete={
            authMode === "login" ? "current-password" : "new-password"
          }
          required
        />
      </label>

      <div className="fm-captcha-block">
        <div className="fm-captcha-top">
          <span>CAPTCHA</span>
          <button type="button" onClick={loadCaptcha}>
            Обновить код
          </button>
        </div>

        <div className="fm-captcha-code">{captchaCode || "----"}</div>

        <input
          className="fm-captcha-input"
          value={captcha}
          onChange={(event) =>
            setCaptcha(event.target.value.replace(/\D/g, "").slice(0, 4))
          }
          inputMode="numeric"
          maxLength={4}
          placeholder="Введите 4 цифры"
          required
        />
      </div>

      {error && <div className="fm-form-error">{error}</div>}

      <button className="fm-auth-submit" disabled={loading}>
        {loading
          ? "Подождите..."
          : authMode === "login"
          ? "Войти"
          : "Зарегистрироваться"}
      </button>
    </form>

    <button
      className="fm-auth-switch"
      onClick={() => {
        setAuthMode(authMode === "login" ? "register" : "login");
        setError("");
        setCaptcha("");
        loadCaptcha();
      }}
    >
      {authMode === "login"
        ? "Нет аккаунта? Зарегистрироваться"
        : "Уже есть аккаунт? Войти"}
    </button>
  </div>
</div>
```

);
}

function QueuePanel({ queue, current, onPlay, onClose, onRemove }) {
return ( <div className="fm-side-panel"> <div className="fm-panel-header"> <div> <h3>Очередь</h3> <span>{queue.length} треков</span> </div>

```
    <button className="fm-icon-button" onClick={onClose}>
      <Icon name="close" size={22} />
    </button>
  </div>

  <div className="fm-queue-list">
    {queue.length === 0 ? (
      <div className="fm-empty">
        <Icon name="queue" size={34} />
        <strong>Очередь пуста</strong>
        <span>Добавляйте треки из каталога</span>
      </div>
    ) : (
      queue.map((track, index) => (
        <div
          className={`fm-queue-item ${
            current?.id === track.id ? "is-current" : ""
          }`}
          key={`${track.id}-${index}`}
        >
          <button onClick={() => onPlay(track)}>
            <TrackCover track={track} size="tiny" />
            <div>
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
            </div>
          </button>

          <button
            className="fm-icon-button"
            onClick={() => onRemove(index)}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
      ))
    )}
  </div>
</div>
```

);
}

function FullPlayer({
track,
playing,
progress,
duration,
volume,
onClose,
onPlayPause,
onNext,
onPrevious,
onSeek,
onVolume,
liked,
onLike,
}) {
if (!track) return null;

return ( <div className="fm-full-player"> <div className="fm-full-player-bg">
<img src={track.cover || DEFAULT_COVER} alt="" /> </div>

```
  <button className="fm-full-close" onClick={onClose}>
    <Icon name="chevron" size={27} />
  </button>

  <div className="fm-full-content">
    <div className="fm-full-cover">
      <img src={track.cover || DEFAULT_COVER} alt="" />
    </div>

    <div className="fm-full-info">
      <span className="fm-full-label">СЕЙЧАС ИГРАЕТ</span>
      <h1>{track.title}</h1>
      <p>{track.artist}</p>

      <div className="fm-full-progress">
        <input
          type="range"
          min="0"
          max={duration || 1}
          value={Math.min(progress, duration || 1)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <div>
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="fm-full-controls">
        <button className="fm-player-secondary">
          <Icon name="shuffle" size={22} />
        </button>

        <button className="fm-player-main" onClick={onPrevious}>
          <Icon name="prev" size={24} />
        </button>

        <button className="fm-full-play" onClick={onPlayPause}>
          <Icon name={playing ? "pause" : "play"} size={30} />
        </button>

        <button className="fm-player-main" onClick={onNext}>
          <Icon name="next" size={24} />
        </button>

        <button
          className={`fm-player-secondary ${liked ? "is-liked" : ""}`}
          onClick={onLike}
        >
          <Icon name={liked ? "heartFill" : "heart"} size={22} />
        </button>
      </div>

      <div className="fm-full-volume">
        <Icon name="volume" size={20} />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
      </div>
    </div>
  </div>
</div>
```

);
}

export default function App() {
const audioRef = useRef(null);

const [section, setSection] = useState("home");
const [tracks, setTracks] = useState(FALLBACK_TRACKS);
const [search, setSearch] = useState("");
const [current, setCurrent] = useState(null);
const [playing, setPlaying] = useState(false);
const [progress, setProgress] = useState(0);
const [duration, setDuration] = useState(0);
const [volume, setVolume] = useState(0.8);
const [queue, setQueue] = useState([]);
const [favorites, setFavorites] = useState([]);
const [history, setHistory] = useState([]);
const [authOpen, setAuthOpen] = useState(false);
const [authMode, setAuthMode] = useState("login");
const [user, setUser] = useState(null);
const [queueOpen, setQueueOpen] = useState(false);
const [fullPlayer, setFullPlayer] = useState(false);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [loading, setLoading] = useState(true);
const [serverOnline, setServerOnline] = useState(false);

const [shuffle, setShuffle] = useState(false);
const [repeat, setRepeat] = useState(false);

useEffect(() => {
const savedFavorites = localStorage.getItem("fenix_favorites");
const savedHistory = localStorage.getItem("fenix_history");

```
if (savedFavorites) {
  try {
    setFavorites(JSON.parse(savedFavorites));
  } catch {}
}

if (savedHistory) {
  try {
    setHistory(JSON.parse(savedHistory));
  } catch {}
}

loadApp();
```

}, []);

useEffect(() => {
localStorage.setItem("fenix_favorites", JSON.stringify(favorites));
}, [favorites]);

useEffect(() => {
localStorage.setItem("fenix_history", JSON.stringify(history));
}, [history]);

useEffect(() => {
if (audioRef.current) {
audioRef.current.volume = volume;
}
}, [volume]);

async function loadApp() {
setLoading(true);

```
try {
  const userData = await apiFetch("/api/auth/me");
  if (userData?.user) setUser(userData.user);
  else if (userData?.id) setUser(userData);
} catch {}

try {
  const data = await apiFetch("/api/music");
  const raw = Array.isArray(data)
    ? data
    : data?.tracks || data?.items || data?.music || [];

  if (raw.length) {
    setTracks(raw.map(normalizeTrack));
  }

  setServerOnline(true);
} catch {
  try {
    const data = await apiFetch("/api/tracks");
    const raw = Array.isArray(data)
      ? data
      : data?.tracks || data?.items || [];

    if (raw.length) {
      setTracks(raw.map(normalizeTrack));
    }

    setServerOnline(true);
  } catch {
    setServerOnline(false);
  }
} finally {
  setLoading(false);
}
```

}

const filteredTracks = useMemo(() => {
const query = search.trim().toLowerCase();

```
if (!query) return tracks;

return tracks.filter((track) =>
  [track.title, track.artist, track.album, track.genre]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query))
);
```

}, [tracks, search]);

const favoriteTracks = useMemo(
() =>
tracks.filter((track) =>
favorites.some((favorite) => String(favorite.id) === String(track.id))
),
[tracks, favorites]
);

const historyTracks = useMemo(
() =>
history
.map((item) =>
tracks.find((track) => String(track.id) === String(item.id))
)
.filter(Boolean),
[history, tracks]
);

const recommended = useMemo(() => tracks.slice(0, 6), [tracks]);
const popular = useMemo(() => tracks.slice(0, 6).reverse(), [tracks]);
const newTracks = useMemo(() => tracks.slice(0, 6), [tracks]);
const mixes = useMemo(() => tracks.slice(0, 5), [tracks]);

const isLiked = (track) =>
favorites.some(
(favorite) => String(favorite.id) === String(track?.id)
);

async function toggleFavorite(track) {
if (!track) return;

```
const exists = isLiked(track);

setFavorites((previous) =>
  exists
    ? previous.filter(
        (favorite) => String(favorite.id) !== String(track.id)
      )
    : [...previous, track]
);

try {
  await apiFetch(`/api/music/${track.id}/favorite`, {
    method: "POST",
    body: JSON.stringify({ liked: !exists }),
  });
} catch {}
```

}

function addHistory(track) {
setHistory((previous) => {
const without = previous.filter(
(item) => String(item.id) !== String(track.id)
);

```
  return [
    {
      id: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover,
    },
    ...without,
  ].slice(0, 50);
});
```

}

async function playTrack(track) {
if (!track) return;

```
setCurrent(track);
setProgress(0);
setPlaying(false);
addHistory(track);

const source = track.audio_url;

if (!source) {
  setPlaying(false);
  return;
}

try {
  const audio = audioRef.current;

  audio.src = source;
  audio.volume = volume;
  audio.currentTime = 0;

  await audio.play();
  setPlaying(true);
} catch {
  setPlaying(false);
}
```

}

async function togglePlay() {
const audio = audioRef.current;

```
if (!current) {
  if (tracks.length) {
    await playTrack(tracks[0]);
  }
  return;
}

if (!audio.src) {
  await playTrack(current);
  return;
}

if (audio.paused) {
  try {
    await audio.play();
    setPlaying(true);
  } catch {
    setPlaying(false);
  }
} else {
  audio.pause();
  setPlaying(false);
}
```

}

function getCurrentIndex() {
return tracks.findIndex(
(track) => String(track.id) === String(current?.id)
);
}

async function nextTrack() {
if (!tracks.length) return;

```
let index = getCurrentIndex();

if (shuffle) {
  index = Math.floor(Math.random() * tracks.length);
} else {
  index += 1;

  if (index >= tracks.length) {
    if (repeat) index = 0;
    else {
      setPlaying(false);
      return;
    }
  }
}

await playTrack(tracks[index]);
```

}

async function previousTrack() {
if (!tracks.length) return;

```
let index = getCurrentIndex() - 1;

if (index < 0) index = tracks.length - 1;

await playTrack(tracks[index]);
```

}

function seek(value) {
const audio = audioRef.current;

```
if (audio && Number.isFinite(value)) {
  audio.currentTime = value;
  setProgress(value);
}
```

}

function addToQueue(track) {
setQueue((previous) => [...previous, track]);
setQueueOpen(true);
}

function removeFromQueue(index) {
setQueue((previous) => previous.filter((_, i) => i !== index));
}

async function playFromQueue(track) {
await playTrack(track);
}

function openAuth(mode) {
setAuthMode(mode);
setAuthOpen(true);
}

async function logout() {
try {
await apiFetch("/api/auth/logout", { method: "POST" });
} catch {}

```
setUser(null);
```

}

function handleAuthSuccess(account) {
setUser(account || { login: "Fenix User" });
setAuthOpen(false);
}

function navigate(nextSection) {
setSection(nextSection);
setSidebarOpen(false);
}

useEffect(() => {
const audio = audioRef.current;

```
if (!audio) return undefined;

const updateTime = () => setProgress(audio.currentTime || 0);
const updateDuration = () => setDuration(audio.duration || current?.duration || 0);
const onPlay = () => setPlaying(true);
const onPause = () => setPlaying(false);
const onEnded = () => {
  if (repeat) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    nextTrack();
  }
};

audio.addEventListener("timeupdate", updateTime);
audio.addEventListener("loadedmetadata", updateDuration);
audio.addEventListener("durationchange", updateDuration);
audio.addEventListener("play", onPlay);
audio.addEventListener("pause", onPause);
audio.addEventListener("ended", onEnded);

return () => {
  audio.removeEventListener("timeupdate", updateTime);
  audio.removeEventListener("loadedmetadata", updateDuration);
  audio.removeEventListener("durationchange", updateDuration);
  audio.removeEventListener("play", onPlay);
  audio.removeEventListener("pause", onPause);
  audio.removeEventListener("ended", onEnded);
};
```

}, [current, repeat]);

function renderTrackGrid(items, title, subtitle) {
return ( <section className="fm-section"> <SectionHeader title={title} subtitle={subtitle} />

```
    <div className="fm-card-grid">
      {items.length ? (
        items.map((track) => (
          <MusicCard
            key={track.id}
            track={track}
            onPlay={playTrack}
            onLike={toggleFavorite}
            liked={isLiked(track)}
          />
        ))
      ) : (
        <div className="fm-empty-wide">Музыка пока не найдена</div>
      )}
    </div>
  </section>
);
```

}

function renderRows(items, title, subtitle) {
return ( <section className="fm-section"> <SectionHeader title={title} subtitle={subtitle} />

```
    <div className="fm-track-list">
      {items.length ? (
        items.map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            index={index}
            active={current?.id === track.id}
            playing={playing}
            liked={isLiked(track)}
            onPlay={playTrack}
            onLike={toggleFavorite}
            onQueue={addToQueue}
          />
        ))
      ) : (
        <div className="fm-empty-wide">Здесь пока ничего нет</div>
      )}
    </div>
  </section>
);
```

}

function renderHome() {
return (
<> <section className="fm-hero"> <div className="fm-hero-content"> <span className="fm-hero-kicker">FENIX MUSIC</span> <h1>
Твоя музыка. <br /> <em>Твоя вселенная.</em> </h1> <p>
Открывай новые треки, собирай любимые композиции
и слушай музыку без границ. </p>

```
        <div className="fm-hero-actions">
          <button
            className="fm-primary-button"
            onClick={() => playTrack(recommended[0])}
          >
            <Icon name="play" size={18} />
            Слушать сейчас
          </button>

          <button
            className="fm-secondary-button"
            onClick={() => navigate("for-you")}
          >
            Для вас
          </button>
        </div>
      </div>

      <div className="fm-hero-art">
        <div className="fm-hero-ring ring-one" />
        <div className="fm-hero-ring ring-two" />
        <div className="fm-hero-disc">
          <img src={recommended[0]?.cover || DEFAULT_COVER} alt="" />
        </div>
        <div className="fm-hero-floating">
          <Icon name="music" size={22} />
          <span>Fenix Music</span>
        </div>
      </div>
    </section>

    {renderTrackGrid(recommended, "Для вас", "Подборка специально для тебя")}

    {renderTrackGrid(newTracks, "Новинки", "Свежая музыка")}

    {renderTrackGrid(popular, "Популярное", "Сейчас слушают чаще всего")}

    <section className="fm-section">
      <SectionHeader
        title="Продолжить слушать"
        subtitle="Твоя история"
        action="Вся история"
        onAction={() => navigate("history")}
      />

      <div className="fm-horizontal-list">
        {(historyTracks.length ? historyTracks : mixes).map((track) => (
          <button
            className="fm-horizontal-card"
            key={track.id}
            onClick={() => playTrack(track)}
          >
            <TrackCover track={track} size="small" />
            <div>
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  </>
);
```

}

function renderCurrentSection() {
if (section === "home") return renderHome();

```
if (section === "for-you") {
  return (
    <>
      <div className="fm-page-title">
        <span>ПЕРСОНАЛЬНАЯ ЛЕНТА</span>
        <h1>Для вас</h1>
        <p>Музыка, которая может тебе понравиться.</p>
      </div>

      {renderTrackGrid(recommended, "Рекомендации", "На основе твоих предпочтений")}
      {renderTrackGrid(mixes, "Твои миксы", "Готовые музыкальные подборки")}
    </>
  );
}

if (section === "new") {
  return (
    <>
      <div className="fm-page-title">
        <span>СВЕЖИЕ РЕЛИЗЫ</span>
        <h1>Новинки</h1>
        <p>Новые треки в каталоге Fenix Music.</p>
      </div>
      {renderRows(newTracks, "Новые треки", "Последние добавления")}
    </>
  );
}

if (section === "popular") {
  return (
    <>
      <div className="fm-page-title">
        <span>ТОП FENIX MUSIC</span>
        <h1>Популярное</h1>
        <p>Самые востребованные композиции.</p>
      </div>
      {renderRows(popular, "Чарты", "Треки недели")}
    </>
  );
}

if (section === "mixes") {
  return (
    <>
      <div className="fm-page-title">
        <span>ПОДБОРКИ</span>
        <h1>Миксы</h1>
        <p>Готовые подборки для любого настроения.</p>
      </div>
      {renderTrackGrid(mixes, "Fenix Mixes", "Персональные музыкальные миксы")}
    </>
  );
}

if (section === "favorites") {
  return (
    <>
      <div className="fm-page-title">
        <span>ТВОЯ КОЛЛЕКЦИЯ</span>
        <h1>Избранное</h1>
        <p>{favoriteTracks.length} любимых треков.</p>
      </div>
      {renderRows(favoriteTracks, "Любимые треки", "Сохранено тобой")}
    </>
  );
}

if (section === "history") {
  return (
    <>
      <div className="fm-page-title">
        <span>ИСТОРИЯ</span>
        <h1>Недавно прослушанное</h1>
        <p>Треки, которые ты слушал недавно.</p>
      </div>
      {renderRows(historyTracks, "История", "Последние прослушивания")}
    </>
  );
}

if (section === "search") {
  return (
    <>
      <div className="fm-page-title">
        <span>ПОИСК</span>
        <h1>Найти музыку</h1>
        <p>Ищи по названию, исполнителю или жанру.</p>
      </div>

      <div className="fm-big-search">
        <Icon name="search" size={23} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Например: Neon Dreams"
          autoFocus
        />
        {search && (
          <button onClick={() => setSearch("")}>
            <Icon name="close" size={19} />
          </button>
        )}
      </div>

      {renderRows(
        filteredTracks,
        search ? `Результаты: ${search}` : "Весь каталог",
        `${filteredTracks.length} треков`
      )}
    </>
  );
}

if (section === "profile") {
  return (
    <div className="fm-profile-page">
      <div className="fm-profile-card">
        <div className="fm-profile-avatar">
          {user?.login?.slice(0, 1)?.toUpperCase() || "F"}
        </div>
        <div>
          <span>ПРОФИЛЬ</span>
          <h1>{user?.login || user?.username || "Гость Fenix"}</h1>
          <p>
            {user
              ? "Добро пожаловать обратно в Fenix Music."
              : "Войди в аккаунт, чтобы сохранять свою музыку."}
          </p>
        </div>
      </div>

      <div className="fm-stat-grid">
        <div>
          <strong>{favoriteTracks.length}</strong>
          <span>Избранных треков</span>
        </div>
        <div>
          <strong>{historyTracks.length}</strong>
          <span>Прослушано</span>
        </div>
        <div>
          <strong>{queue.length}</strong>
          <span>В очереди</span>
        </div>
      </div>

      {!user ? (
        <button
          className="fm-primary-button"
          onClick={() => openAuth("login")}
        >
          Войти в аккаунт
        </button>
      ) : (
        <button className="fm-danger-button" onClick={logout}>
          Выйти
        </button>
      )}
    </div>
  );
}

if (section === "settings") {
  return (
    <div className="fm-settings-page">
      <div className="fm-page-title">
        <span>FENIX MUSIC</span>
        <h1>Настройки</h1>
        <p>Управление приложением и воспроизведением.</p>
      </div>

      <div className="fm-settings-list">
        <div className="fm-setting">
          <div>
            <strong>Громкость</strong>
            <span>{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>

        <div className="fm-setting">
          <div>
            <strong>Перемешивание</strong>
            <span>Случайный порядок треков</span>
          </div>
          <button
            className={`fm-toggle ${shuffle ? "is-on" : ""}`}
            onClick={() => setShuffle((value) => !value)}
          >
            <i />
          </button>
        </div>

        <div className="fm-setting">
          <div>
            <strong>Повтор</strong>
            <span>Повторять очередь</span>
          </div>
          <button
            className={`fm-toggle ${repeat ? "is-on" : ""}`}
            onClick={() => setRepeat((value) => !value)}
          >
            <i />
          </button>
        </div>
      </div>
    </div>
  );
}

return renderHome();
```

}

return ( <div className="fm-app"> <audio ref={audioRef} preload="metadata" />

```
  <aside className={`fm-sidebar ${sidebarOpen ? "is-open" : ""}`}>
    <div className="fm-sidebar-top">
      <Logo />

      <button
        className="fm-mobile-close"
        onClick={() => setSidebarOpen(false)}
      >
        <Icon name="close" size={23} />
      </button>
    </div>

    <nav className="fm-nav">
      <button
        className={section === "home" ? "is-active" : ""}
        onClick={() => navigate("home")}
      >
        <Icon name="home" size={21} />
        Главная
      </button>

      <button
        className={section === "search" ? "is-active" : ""}
        onClick={() => navigate("search")}
      >
        <Icon name="search" size={21} />
        Поиск
      </button>

      <div className="fm-nav-label">ОБЗОР</div>

      <button
        className={section === "for-you" ? "is-active" : ""}
        onClick={() => navigate("for-you")}
      >
        <span className="fm-nav-dot red" />
        Для вас
      </button>

      <button
        className={section === "new" ? "is-active" : ""}
        onClick={() => navigate("new")}
      >
        <span className="fm-nav-dot purple" />
        Новинки
      </button>

      <button
        className={section === "popular" ? "is-active" : ""}
        onClick={() => navigate("popular")}
      >
        <span className="fm-nav-dot orange" />
        Популярное
      </button>

      <button
        className={section === "mixes" ? "is-active" : ""}
        onClick={() => navigate("mixes")}
      >
        <span className="fm-nav-dot blue" />
        Миксы
      </button>

      <div className="fm-nav-label">БИБЛИОТЕКА</div>

      <button
        className={section === "favorites" ? "is-active" : ""}
        onClick={() => navigate("favorites")}
      >
        <Icon name="heart" size={21} />
        Избранное
        <span className="fm-nav-count">{favoriteTracks.length}</span>
      </button>

      <button
        className={section === "history" ? "is-active" : ""}
        onClick={() => navigate("history")}
      >
        <Icon name="clock" size={21} />
        История
      </button>

      <button onClick={() => setQueueOpen(true)}>
        <Icon name="queue" size={21} />
        Очередь
        {queue.length > 0 && (
          <span className="fm-nav-count">{queue.length}</span>
        )}
      </button>
    </nav>

    <div className="fm-sidebar-bottom">
      <div className={`fm-server ${serverOnline ? "online" : ""}`}>
        <i />
        <span>
          {serverOnline ? "Сервер онлайн" : "Локальный режим"}
        </span>
      </div>

      <button
        className={section === "profile" ? "is-active" : ""}
        onClick={() => navigate("profile")}
      >
        <Icon name="user" size={21} />
        {user?.login || "Профиль"}
      </button>

      <button
        className={section === "settings" ? "is-active" : ""}
        onClick={() => navigate("settings")}
      >
        <Icon name="settings" size={21} />
        Настройки
      </button>
    </div>
  </aside>

  {sidebarOpen && (
    <button
      className="fm-sidebar-overlay"
      onClick={() => setSidebarOpen(false)}
      aria-label="Закрыть меню"
    />
  )}

  <main className="fm-main">
    <header className="fm-header">
      <div className="fm-header-left">
        <button
          className="fm-mobile-menu"
          onClick={() => setSidebarOpen(true)}
        >
          <Icon name="menu" size={24} />
        </button>

        <button
          className="fm-header-search"
          onClick={() => navigate("search")}
        >
          <Icon name="search" size={20} />
          <span>{search || "Поиск музыки, артистов, альбомов..."}</span>
        </button>
      </div>

      <div className="fm-header-actions">
        <div className="fm-online-indicator">
          <i />
          {serverOnline ? "ONLINE" : "OFFLINE"}
        </div>

        {user ? (
          <button
            className="fm-user-button"
            onClick={() => navigate("profile")}
          >
            <span>{user.login?.slice(0, 1)?.toUpperCase() || "F"}</span>
            <strong>{user.login || user.username || "Fenix"}</strong>
          </button>
        ) : (
          <button
            className="fm-login-button"
            onClick={() => openAuth("login")}
          >
            Войти
          </button>
        )}
      </div>
    </header>

    <div className="fm-content">
      {loading ? (
        <div className="fm-loading">
          <div className="fm-loading-logo">F</div>
          <span>Загружаем Fenix Music...</span>
        </div>
      ) : (
        renderCurrentSection()
      )}
    </div>
  </main>

  {current && (
    <div className="fm-bottom-player">
      <div className="fm-player-track" onClick={() => setFullPlayer(true)}>
        <TrackCover track={current} size="tiny" />
        <div>
          <strong>{current.title}</strong>
          <span>{current.artist}</span>
        </div>
      </div>

      <div className="fm-player-center">
        <div className="fm-player-buttons">
          <button
            className={`fm-player-secondary ${shuffle ? "is-active" : ""}`}
            onClick={() => setShuffle((value) => !value)}
          >
            <Icon name="shuffle" size={18} />
          </button>

          <button className="fm-player-main" onClick={previousTrack}>
            <Icon name="prev" size={21} />
          </button>

          <button className="fm-player-play" onClick={togglePlay}>
            <Icon name={playing ? "pause" : "play"} size={21} />
          </button>

          <button className="fm-player-main" onClick={nextTrack}>
            <Icon name="next" size={21} />
          </button>

          <button
            className={`fm-player-secondary ${repeat ? "is-active" : ""}`}
            onClick={() => setRepeat((value) => !value)}
          >
            <Icon name="repeat" size={18} />
          </button>
        </div>

        <div className="fm-player-progress">
          <span>{formatTime(progress)}</span>
          <input
            type="range"
            min="0"
            max={duration || current.duration || 1}
            value={Math.min(progress, duration || current.duration || 1)}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <span>{formatTime(duration || current.duration)}</span>
        </div>
      </div>

      <div className="fm-player-right">
        <button
          className={`fm-icon-button ${
            isLiked(current) ? "is-liked" : ""
          }`}
          onClick={() => toggleFavorite(current)}
        >
          <Icon
            name={isLiked(current) ? "heartFill" : "heart"}
            size={19}
          />
        </button>

        <div className="fm-volume">
          <Icon name="volume" size={18} />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>

        <button
          className="fm-icon-button"
          onClick={() => setQueueOpen(true)}
        >
          <Icon name="queue" size={20} />
        </button>

        <button
          className="fm-icon-button"
          onClick={() => setFullPlayer(true)}
        >
          <Icon name="expand" size={19} />
        </button>
      </div>
    </div>
  )}

  <div className="fm-mobile-bottom-nav">
    <button
      className={section === "home" ? "is-active" : ""}
      onClick={() => navigate("home")}
    >
      <Icon name="home" size={21} />
      <span>Главная</span>
    </button>

    <button
      className={section === "search" ? "is-active" : ""}
      onClick={() => navigate("search")}
    >
      <Icon name="search" size={21} />
      <span>Поиск</span>
    </button>

    <button onClick={() => setQueueOpen(true)}>
      <Icon name="queue" size={21} />
      <span>Очередь</span>
    </button>

    <button
      className={section === "favorites" ? "is-active" : ""}
      onClick={() => navigate("favorites")}
    >
      <Icon name="heart" size={21} />
      <span>Любимое</span>
    </button>

    <button
      className={section === "profile" ? "is-active" : ""}
      onClick={() => navigate("profile")}
    >
      <Icon name="user" size={21} />
      <span>Профиль</span>
    </button>
  </div>

  {queueOpen && (
    <div className="fm-panel-backdrop" onMouseDown={() => setQueueOpen(false)}>
      <div onMouseDown={(event) => event.stopPropagation()}>
        <QueuePanel
          queue={queue}
          current={current}
          onPlay={playFromQueue}
          onClose={() => setQueueOpen(false)}
          onRemove={removeFromQueue}
        />
      </div>
    </div>
  )}

  {authOpen && (
    <AuthModal
      mode={authMode}
      onClose={() => setAuthOpen(false)}
      onSuccess={handleAuthSuccess}
    />
  )}

  {fullPlayer && (
    <FullPlayer
      track={current}
      playing={playing}
      progress={progress}
      duration={duration || current?.duration || 0}
      volume={volume}
      liked={isLiked(current)}
      onClose={() => setFullPlayer(false)}
      onPlayPause={togglePlay}
      onNext={nextTrack}
      onPrevious={previousTrack}
      onSeek={seek}
      onVolume={setVolume}
      onLike={() => toggleFavorite(current)}
    />
  )}
</div>
);
}
export default App
