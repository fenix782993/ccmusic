import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
import.meta.env.VITE_API_URL || "https://ccmusice.onrender.com";

const DEFAULT_COVER =
"https://placehold.co/600x600/111118/ffffff?text=FENIX+MUSIC";

function apiUrl(path) {
if (!path) return API_BASE;
if (path.startsWith("http://") || path.startsWith("https://")) return path;
return ${API_BASE}${path.startsWith("/") ? path : /${path}};
}

async function requestJson(path, options = {}) {
const response = await fetch(apiUrl(path), {
credentials: "include",
...options,
headers: {
Accept: "application/json",
...(options.headers || {}),
},
});

const text = await response.text();

let data = null;

try {
data = text ? JSON.parse(text) : null;
} catch {
throw new Error(Сервер вернул некорректный ответ: ${response.status});
}

if (!response.ok) {
throw new Error(
data?.error ||
data?.message ||
Ошибка сервера: ${response.status}
);
}

return data;
}

function Icon({ name, size = 22 }) {
const common = {
width: size,
height: size,
viewBox: "0 0 24 24",
fill: "none",
stroke: "currentColor",
strokeWidth: 1.9,
strokeLinecap: "round",
strokeLinejoin: "round",
"aria-hidden": true,
};

const paths = {
home: (
<>
<path d="M3 10.8 12 3l9 7.8" />
<path d="M5.5 9.5V21h13V9.5" />
<path d="M9.5 21v-6h5v6" />
</>
),
search: (
<>
<circle cx="10.8" cy="10.8" r="6.8" />
<path d="m16 16 5 5" />
</>
),
library: (
<>
<path d="M4 4h4v16H4z" />
<path d="M10 4h4v16h-4z" />
<path d="M16 4h4v16h-4z" />
</>
),
heart: <path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8Z" />,
heartFill: (
<path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8Z" fill="currentColor" />
),
play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" />,
pause: (
<>
<path d="M7 5v14" />
<path d="M17 5v14" />
</>
),
next: (
<>
<path d="m5 5 10 7-10 7V5Z" fill="currentColor" />
<path d="M19 5v14" />
</>
),
previous: (
<>
<path d="m19 5-10 7 10 7V5Z" fill="currentColor" />
<path d="M5 5v14" />
</>
),
shuffle: (
<>
<path d="M3 7h3c4 0 5 10 9 10h6" />
<path d="m18 14 3 3-3 3" />
<path d="M3 17h3c1.6 0 2.8-1.2 3.8-2.8" />
<path d="M15.5 9.8C16.4 8.2 17.6 7 19 7h2" />
<path d="m18 4 3 3-3 3" />
</>
),
repeat: (
<>
<path d="M17 2.5 21 6l-4 3.5" />
<path d="M3 10V8a2 2 0 0 1 2-2h16" />
<path d="m7 21.5-4-3.5 4-3.5" />
<path d="M21 14v2a2 2 0 0 1-2 2H3" />
</>
),
volume: (
<>
<path d="M4 9v6h4l5 4V5L8 9H4Z" />
<path d="M17 9a4 4 0 0 1 0 6" />
<path d="M19.5 6.5a8 8 0 0 1 0 11" />
</>
),
user: (
<>
<circle cx="12" cy="8" r="4" />
<path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6" />
</>
),
close: (
<>
<path d="m6 6 12 12" />
<path d="m18 6-12 12" />
</>
),
refresh: (
<>
<path d="M20 11a8 8 0 0 0-14-5L4 8" />
<path d="M4 4v4h4" />
<path d="M4 13a8 8 0 0 0 14 5l2-2" />
<path d="M20 20v-4h-4" />
</>
),
music: (
<>
<path d="M9 18V5l11-2v13" />
<circle cx="6" cy="18" r="3" />
<circle cx="17" cy="16" r="3" />
</>
),
clock: (
<>
<circle cx="12" cy="12" r="9" />
<path d="M12 7v5l3 2" />
</>
),
star: (
<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z" />
),
fire: (
<path d="M12 22c4.4 0 7-2.8 7-6.8 0-3.1-1.8-5.4-4.4-7.5.1 2.1-.6 3.5-1.8 4.3.1-4-1.6-7.2-4.6-9.5.3 4.2-4.2 6.8-4.2 11.9C4 18.8 7 22 12 22Z" />
),
crown: (
<path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" />
),
};

return <svg {...common}>{paths[name] || paths.music}</svg>;
}

function formatTime(value) {
const seconds = Number(value);

if (!Number.isFinite(seconds) || seconds < 0) {
return "0:00";
}

const mins = Math.floor(seconds / 60);
const secs = Math.floor(seconds % 60);

return ${mins}:${String(secs).padStart(2, "0")};
}

function normalizeTrack(item, index = 0) {
const fileName =
item?.file_name ||
item?.filename ||
item?.file ||
item?.name ||
"";

const rawAudio =
item?.audio_url ||
item?.url ||
item?.stream_url ||
(fileName ? /api/music/audio/${encodeURIComponent(fileName)} : "");

return {
id: String(item?.id || fileName || track-${index}),
title:
item?.title ||
item?.name ||
fileName.replace(/.[^/.]+$/, "") ||
Трек ${index + 1},
artist:
item?.artist_name ||
item?.artist ||
item?.author ||
"Fenix Music",
album:
item?.album_name ||
item?.album ||
"Fenix Music",
cover:
item?.cover_url ||
item?.cover ||
DEFAULT_COVER,
audioUrl: apiUrl(rawAudio),
duration: Number(item?.duration || 0),
plays: Number(item?.plays_count || item?.plays || 0),
fileName,
liked: Boolean(item?.liked),
};
}

function SectionTitle({ title, subtitle, onMore }) {
return (
<div className="fm-section-title">
<div>
<h2>{title}</h2>
{subtitle && <p>{subtitle}</p>}
</div>

  {onMore && (
    <button className="fm-text-button" onClick={onMore}>
      Смотреть всё
    </button>
  )}
</div>

);
}

function TrackCard({ track, active, liked, onPlay, onLike }) {
return (
<article className={fm-track-card ${active ? "active" : ""}}>
<button
className="fm-cover-button"
onClick={() => onPlay(track)}
aria-label={Воспроизвести ${track.title}}
>
<img src={track.cover} alt="" />

    <span className="fm-cover-overlay">
      <Icon name={active ? "pause" : "play"} size={25} />
    </span>
  </button>

  <div className="fm-track-info">
    <button className="fm-track-title" onClick={() => onPlay(track)}>
      {track.title}
    </button>

    <div className="fm-track-artist">{track.artist}</div>
  </div>

  <button
    className={`fm-like-button ${liked ? "liked" : ""}`}
    onClick={() => onLike(track)}
    aria-label="Избранное"
  >
    <Icon name={liked ? "heartFill" : "heart"} size={19} />
  </button>
</article>

);
}

function HorizontalTracks({
title,
subtitle,
tracks,
activeId,
likedIds,
onPlay,
onLike,
onMore,
}) {
if (!tracks.length) {
return (
<section className="fm-section">
<SectionTitle title={title} subtitle={subtitle} />
<div className="fm-empty">
<Icon name="music" size={34} />
<span>Пока здесь нет треков</span>
</div>
</section>
);
}

return (
<section className="fm-section">
<SectionTitle title={title} subtitle={subtitle} onMore={onMore} />

  <div className="fm-track-grid">
    {tracks.slice(0, 8).map((track) => (
      <TrackCard
        key={track.id}
        track={track}
        active={activeId === track.id}
        liked={likedIds.has(track.id)}
        onPlay={onPlay}
        onLike={onLike}
      />
    ))}
  </div>
</section>

);
}

function AuthModal({
open,
mode,
setMode,
onClose,
onSubmit,
captcha,
captchaLoading,
captchaError,
refreshCaptcha,
authLoading,
error,
}) {
const [login, setLogin] = useState("");
const [password, setPassword] = useState("");
const [captchaValue, setCaptchaValue] = useState("");

useEffect(() => {
if (!open) {
setLogin("");
setPassword("");
setCaptchaValue("");
}
}, [open]);

if (!open) return null;

async function submit(event) {
event.preventDefault();

await onSubmit({
  login,
  password,
  captcha: captchaValue,
  mode,
});

}

return (
<div className="fm-modal-backdrop" onMouseDown={onClose}>
<div
className="fm-modal"
onMouseDown={(event) => event.stopPropagation()}
>
<button className="fm-modal-close" onClick={onClose}>
<Icon name="close" size={24} />
</button>

    <div className="fm-modal-logo">
      <div className="fm-logo-mark">F</div>
      <div>
        <strong>FENIX</strong>
        <span>MUSIC</span>
      </div>
    </div>

    <h2>{mode === "login" ? "С возвращением" : "Создать аккаунт"}</h2>

    <p className="fm-modal-description">
      {mode === "login"
        ? "Войди, чтобы сохранять музыку и историю."
        : "Создай профиль Fenix Music бесплатно."}
    </p>

    <form onSubmit={submit}>
      <label className="fm-field">
        <span>Логин</span>
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
            mode === "login" ? "current-password" : "new-password"
          }
          required
        />
      </label>

      <div className="fm-captcha">
        <div className="fm-captcha-top">
          <span>Введите 4 цифры</span>

          <button
            type="button"
            className="fm-icon-button"
            onClick={refreshCaptcha}
            disabled={captchaLoading}
            title="Обновить CAPTCHA"
          >
            <Icon name="refresh" size={19} />
          </button>
        </div>

        <div className="fm-captcha-code">
          {captchaLoading ? "••••" : captcha?.code || "----"}
        </div>

        {captchaError && (
          <div className="fm-captcha-error">
            {captchaError}
          </div>
        )}

        <input
          value={captchaValue}
          onChange={(event) =>
            setCaptchaValue(
              event.target.value.replace(/\D/g, "").slice(0, 4)
            )
          }
          inputMode="numeric"
          maxLength={4}
          placeholder="Введите код"
          required
        />
      </div>

      {(error || authLoading) && (
        <div className={`fm-form-message ${error ? "error" : ""}`}>
          {error || "Проверяем данные…"}
        </div>
      )}

      <button
        className="fm-primary-button fm-submit"
        disabled={authLoading}
        type="submit"
      >
        {authLoading
          ? "Загрузка…"
          : mode === "login"
          ? "Войти"
          : "Зарегистрироваться"}
      </button>
    </form>

    <div className="fm-auth-switch">
      {mode === "login" ? (
        <>
          Нет аккаунта?
          <button onClick={() => setMode("register")}>
            Регистрация
          </button>
        </>
      ) : (
        <>
          Уже есть аккаунт?
          <button onClick={() => setMode("login")}>
            Войти
          </button>
        </>
      )}
    </div>
  </div>
</div>

);
}

function FullPlayer({
track,
isPlaying,
liked,
onClose,
onToggle,
onPrevious,
onNext,
onLike,
currentTime,
duration,
onSeek,
}) {
if (!track) return null;

return (
<div className="fm-full-player">
<div className="fm-full-player-top">
<button className="fm-icon-button" onClick={onClose}>
<Icon name="close" size={27} />
</button>

    <span>Сейчас играет</span>

    <button className="fm-icon-button">
      <Icon name="star" size={23} />
    </button>
  </div>

  <div className="fm-full-cover-wrap">
    <img src={track.cover} alt="" className="fm-full-cover" />
  </div>

  <div className="fm-full-info">
    <div>
      <h1>{track.title}</h1>
      <p>{track.artist}</p>
    </div>

    <button
      className={`fm-full-like ${liked ? "liked" : ""}`}
      onClick={() => onLike(track)}
    >
      <Icon name={liked ? "heartFill" : "heart"} size={25} />
    </button>
  </div>

  <div className="fm-full-progress">
    <input
      type="range"
      min="0"
      max={duration || 1}
      step="0.1"
      value={Math.min(currentTime, duration || 1)}
      onChange={(event) => onSeek(Number(event.target.value))}
    />

    <div>
      <span>{formatTime(currentTime)}</span>
      <span>{formatTime(duration)}</span>
    </div>
  </div>

  <div className="fm-full-controls">
    <button onClick={onPrevious}>
      <Icon name="previous" size={28} />
    </button>

    <button className="fm-big-play" onClick={onToggle}>
      <Icon name={isPlaying ? "pause" : "play"} size={31} />
    </button>

    <button onClick={onNext}>
      <Icon name="next" size={28} />
    </button>
  </div>
</div>

);
}

function Player({
track,
isPlaying,
onToggle,
onPrevious,
onNext,
onOpen,
onLike,
liked,
currentTime,
duration,
onSeek,
}) {
if (!track) return null;

return (
<div className="fm-player">
<div className="fm-player-track" onClick={onOpen}>
<img src={track.cover} alt="" />

    <div>
      <strong>{track.title}</strong>
      <span>{track.artist}</span>
    </div>
  </div>

  <div className="fm-player-center">
    <div className="fm-player-buttons">
      <button onClick={onPrevious}>
        <Icon name="previous" size={19} />
      </button>

      <button className="fm-player-play" onClick={onToggle}>
        <Icon name={isPlaying ? "pause" : "play"} size={20} />
      </button>

      <button onClick={onNext}>
        <Icon name="next" size={19} />
      </button>
    </div>

    <div className="fm-player-progress">
      <span>{formatTime(currentTime)}</span>

      <input
        type="range"
        min="0"
        max={duration || 1}
        step="0.1"
        value={Math.min(currentTime, duration || 1)}
        onChange={(event) => onSeek(Number(event.target.value))}
      />

      <span>{formatTime(duration)}</span>
    </div>
  </div>

  <div className="fm-player-actions">
    <button
      className={liked ? "liked" : ""}
      onClick={() => onLike(track)}
    >
      <Icon name={liked ? "heartFill" : "heart"} size={19} />
    </button>

    <button>
      <Icon name="volume" size={19} />
    </button>
  </div>
</div>

);
}

function App() {
const audioRef = useRef(null);

const [tracks, setTracks] = useState([]);
const [loading, setLoading] = useState(true);
const [musicError, setMusicError] = useState("");

const [currentTrack, setCurrentTrack] = useState(null);
const [isPlaying, setIsPlaying] = useState(false);

const [currentTime, setCurrentTime] = useState(0);
const [duration, setDuration] = useState(0);

const [likedIds, setLikedIds] = useState(() => {
try {
return new Set(JSON.parse(localStorage.getItem("fenix_liked") || "[]"));
} catch {
return new Set();
}
});

const [historyIds, setHistoryIds] = useState(() => {
try {
return JSON.parse(
localStorage.getItem("fenix_history") || "[]"
);
} catch {
return [];
}
});

const [activeTab, setActiveTab] = useState("home");
const [search, setSearch] = useState("");
const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
const [fullPlayerOpen, setFullPlayerOpen] = useState(false);

const [authOpen, setAuthOpen] = useState(false);
const [authMode, setAuthMode] = useState("login");
const [authLoading, setAuthLoading] = useState(false);
const [authError, setAuthError] = useState("");

const [captcha, setCaptcha] = useState(null);
const [captchaLoading, setCaptchaLoading] = useState(false);
const [captchaError, setCaptchaError] = useState("");

const [user, setUser] = useState(() => {
try {
return JSON.parse(localStorage.getItem("fenix_user") || "null");
} catch {
return null;
}
});

const audio = audioRef.current;

async function loadMusic() {
setLoading(true);
setMusicError("");

try {
  const data = await requestJson("/api/music");

  const list =
    Array.isArray(data)
      ? data
      : data?.tracks || data?.music || data?.items || [];

  setTracks(list.map(normalizeTrack));
} catch (error) {
  setMusicError(error.message || "Не удалось загрузить музыку");
} finally {
  setLoading(false);
}

}

async function loadCaptcha() {
setCaptchaLoading(true);
setCaptchaError("");

try {
  const data = await requestJson("/api/captcha");

  if (!data?.code) {
    throw new Error("CAPTCHA не пришла от сервера");
  }

  setCaptcha(data);
} catch (error) {
  setCaptcha(null);
  setCaptchaError("Не удалось загрузить CAPTCHA с сервера. Обновите код.");
} finally {
  setCaptchaLoading(false);
}

}

useEffect(() => {
loadMusic();
}, []);

useEffect(() => {
if (authOpen) {
loadCaptcha();
}
}, [authOpen, authMode]);

useEffect(() => {
localStorage.setItem(
"fenix_liked",
JSON.stringify(Array.from(likedIds))
);
}, [likedIds]);

useEffect(() => {
localStorage.setItem(
"fenix_history",
JSON.stringify(historyIds.slice(0, 50))
);
}, [historyIds]);

useEffect(() => {
if (!audio || !currentTrack) return;

const onTime = () => setCurrentTime(audio.currentTime || 0);

const onLoaded = () => {
  setDuration(
    Number.isFinite(audio.duration) ? audio.duration : currentTrack.duration
  );
};

const onEnded = () => {
  playNext();
};

const onPlay = () => setIsPlaying(true);
const onPause = () => setIsPlaying(false);

audio.addEventListener("timeupdate", onTime);
audio.addEventListener("loadedmetadata", onLoaded);
audio.addEventListener("ended", onEnded);
audio.addEventListener("play", onPlay);
audio.addEventListener("pause", onPause);

return () => {
  audio.removeEventListener("timeupdate", onTime);
  audio.removeEventListener("loadedmetadata", onLoaded);
  audio.removeEventListener("ended", onEnded);
  audio.removeEventListener("play", onPlay);
  audio.removeEventListener("pause", onPause);
};

}, [currentTrack, audio]);

function rememberTrack(track) {
setHistoryIds((previous) => [
track.id,
...previous.filter((id) => id !== track.id),
]);
}

async function playTrack(track) {
if (!track?.audioUrl) return;

setCurrentTrack(track);
setCurrentTime(0);
rememberTrack(track);

setTimeout(async () => {
  try {
    if (!audioRef.current) return;

    audioRef.current.src = track.audioUrl;
    audioRef.current.load();

    await audioRef.current.play();
    setIsPlaying(true);
  } catch {
    setIsPlaying(false);
  }
}, 0);

}

async function togglePlay() {
if (!audioRef.current) return;

if (!currentTrack) {
  if (tracks.length) {
    await playTrack(tracks[0]);
  }
  return;
}

if (audioRef.current.paused) {
  try {
    await audioRef.current.play();
  } catch {
    setIsPlaying(false);
  }
} else {
  audioRef.current.pause();
}

}

function getCurrentIndex() {
return tracks.findIndex(
(track) => track.id === currentTrack?.id
);
}

async function playNext() {
if (!tracks.length) return;

const index = getCurrentIndex();

const next =
  index < 0
    ? tracks[0]
    : tracks[(index + 1) % tracks.length];

await playTrack(next);

}

async function playPrevious() {
if (!tracks.length) return;

const index = getCurrentIndex();

const previous =
  index <= 0
    ? tracks[tracks.length - 1]
    : tracks[index - 1];

await playTrack(previous);

}

function seek(value) {
if (!audioRef.current) return;

audioRef.current.currentTime = value;
setCurrentTime(value);

}

function toggleLike(track) {
setLikedIds((previous) => {
const next = new Set(previous);

  if (next.has(track.id)) {
    next.delete(track.id);
  } else {
    next.add(track.id);
  }

  return next;
});

}

async function submitAuth(values) {
setAuthLoading(true);
setAuthError("");

try {
  if (!captcha?.captcha_id && !captcha?.id) {
    throw new Error("CAPTCHA ещё не загружена");
  }

  const captchaId = captcha.captcha_id || captcha.id;

  const endpoint =
    values.mode === "login"
      ? "/api/auth/login"
      : "/api/auth/register";

  const body = {
    login: values.login,
    username: values.login,
    password: values.password,
    captcha_id: captchaId,
    captcha: values.captcha,
    code: values.captcha,
  };

  const data = await requestJson(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const nextUser =
    data?.user ||
    data?.profile ||
    (data?.username
      ? {
          username: data.username,
        }
      : null);

  if (nextUser) {
    setUser(nextUser);
    localStorage.setItem(
      "fenix_user",
      JSON.stringify(nextUser)
    );
  }

  setAuthOpen(false);
} catch (error) {
  setAuthError(error.message || "Ошибка авторизации");
  await loadCaptcha();
} finally {
  setAuthLoading(false);
}

}

function logout() {
setUser(null);
localStorage.removeItem("fenix_user");
}

const likedTracks = useMemo(
() => tracks.filter((track) => likedIds.has(track.id)),
[tracks, likedIds]
);

const historyTracks = useMemo(() => {
return historyIds
.map((id) => tracks.find((track) => track.id === id))
.filter(Boolean);
}, [historyIds, tracks]);

const filteredTracks = useMemo(() => {
const query = search.trim().toLowerCase();

if (!query) return tracks;

return tracks.filter((track) => {
  return (
    track.title.toLowerCase().includes(query) ||
    track.artist.toLowerCase().includes(query) ||
    track.album.toLowerCase().includes(query)
  );
});

}, [tracks, search]);

const popularTracks = useMemo(
() =>
[...tracks].sort(
(a, b) => (b.plays || 0) - (a.plays || 0)
),
[tracks]
);

const newTracks = useMemo(
() => [...tracks].reverse(),
[tracks]
);

function openLogin() {
setAuthMode("login");
setAuthError("");
setAuthOpen(true);
}

function openRegister() {
setAuthMode("register");
setAuthError("");
setAuthOpen(true);
}

function renderHome() {
return (
<>
<section className="fm-hero">
<div className="fm-hero-content">
<div className="fm-eyebrow">
<Icon name="fire" size={17} />
ТВОЯ МУЗЫКА
</div>

        <h1>
          Музыка,
          <br />
          которая <span>двигает.</span>
        </h1>

        <p>
          Слушай любимые треки, открывай новых артистов
          и собирай свою музыкальную коллекцию.
        </p>

        <div className="fm-hero-buttons">
          <button
            className="fm-primary-button"
            onClick={() =>
              tracks.length && playTrack(tracks[0])
            }
          >
            <Icon name="play" size={19} />
            Начать слушать
          </button>

          {!user && (
            <button
              className="fm-secondary-button"
              onClick={openRegister}
            >
              Создать аккаунт
            </button>
          )}
        </div>
      </div>

      <div className="fm-hero-visual">
        <div className="fm-hero-disc">
          <div className="fm-hero-disc-center">
            <span>F</span>
          </div>
        </div>
      </div>
    </section>

    <HorizontalTracks
      title="Для вас"
      subtitle="Подборка специально для тебя"
      tracks={tracks}
      activeId={currentTrack?.id}
      likedIds={likedIds}
      onPlay={playTrack}
      onLike={toggleLike}
    />

    <HorizontalTracks
      title="Популярное"
      subtitle="То, что сейчас слушают"
      tracks={popularTracks}
      activeId={currentTrack?.id}
      likedIds={likedIds}
      onPlay={playTrack}
      onLike={toggleLike}
    />

    <HorizontalTracks
      title="Новинки"
      subtitle="Свежие треки"
      tracks={newTracks}
      activeId={currentTrack?.id}
      likedIds={likedIds}
      onPlay={playTrack}
      onLike={toggleLike}
    />

    {historyTracks.length > 0 && (
      <HorizontalTracks
        title="Продолжить слушать"
        subtitle="Недавно прослушанное"
        tracks={historyTracks}
        activeId={currentTrack?.id}
        likedIds={likedIds}
        onPlay={playTrack}
        onLike={toggleLike}
      />
    )}
  </>
);

}

function renderLibrary() {
return (
<div className="fm-page">
<div className="fm-page-heading">
<div>
<div className="fm-eyebrow">КОЛЛЕКЦИЯ</div>
<h1>Моя библиотека</h1>
<p>Твои любимые треки и история прослушиваний.</p>
</div>
</div>

    <HorizontalTracks
      title="Избранное"
      subtitle={`${likedTracks.length} треков`}
      tracks={likedTracks}
      activeId={currentTrack?.id}
      likedIds={likedIds}
      onPlay={playTrack}
      onLike={toggleLike}
    />

    <HorizontalTracks
      title="Недавно прослушанное"
      subtitle={`${historyTracks.length} треков`}
      tracks={historyTracks}
      activeId={currentTrack?.id}
      likedIds={likedIds}
      onPlay={playTrack}
      onLike={toggleLike}
    />
  </div>
);

}

function renderSearch() {
return (
<div className="fm-page">
<div className="fm-search-page">
<Icon name="search" size={28} />

      <input
        autoFocus
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Найти трек, артиста или альбом..."
      />
    </div>

    <HorizontalTracks
      title={search ? `Результаты: ${search}` : "Все треки"}
      tracks={filteredTracks}
      activeId={currentTrack?.id}
      likedIds={likedIds}
      onPlay={playTrack}
      onLike={toggleLike}
    />
  </div>
);

}

function renderProfile() {
return (
<div className="fm-page">
<div className="fm-profile-card">
<div className="fm-profile-avatar">
{user?.username?.slice(0, 1)?.toUpperCase() || "F"}
</div>

      <div className="fm-profile-info">
        <div className="fm-eyebrow">ПРОФИЛЬ</div>
        <h1>{user?.username || "Гость"}</h1>
        <p>
          {user
            ? "Добро пожаловать в Fenix Music."
            : "Войди в аккаунт, чтобы сохранять прогресс."}
        </p>
      </div>

      {user ? (
        <button
          className="fm-secondary-button"
          onClick={logout}
        >
          Выйти
        </button>
      ) : (
        <div className="fm-profile-actions">
          <button
            className="fm-secondary-button"
            onClick={openLogin}
          >
            Войти
          </button>

          <button
            className="fm-primary-button"
            onClick={openRegister}
          >
            Регистрация
          </button>
        </div>
      )}
    </div>

    <div className="fm-stats">
      <div>
        <strong>{tracks.length}</strong>
        <span>Треков</span>
      </div>

      <div>
        <strong>{likedTracks.length}</strong>
        <span>Избранных</span>
      </div>

      <div>
        <strong>{historyTracks.length}</strong>
        <span>Прослушано</span>
      </div>
    </div>
  </div>
);

}

function renderContent() {
if (activeTab === "search") return renderSearch();
if (activeTab === "library") return renderLibrary();
if (activeTab === "profile") return renderProfile();

return renderHome();

}

return (
<div className="fenix-music">
<audio ref={audioRef} preload="metadata" />

  <aside className="fm-sidebar">
    <div className="fm-brand">
      <div className="fm-logo-mark">F</div>
      <div>
        <strong>FENIX</strong>
        <span>MUSIC</span>
      </div>
    </div>

    <nav className="fm-nav">
      <button
        className={activeTab === "home" ? "active" : ""}
        onClick={() => setActiveTab("home")}
      >
        <Icon name="home" />
        Главная
      </button>

      <button
        className={activeTab === "search" ? "active" : ""}
        onClick={() => setActiveTab("search")}
      >
        <Icon name="search" />
        Поиск
      </button>

      <button
        className={activeTab === "library" ? "active" : ""}
        onClick={() => setActiveTab("library")}
      >
        <Icon name="library" />
        Библиотека
      </button>
    </nav>

    <div className="fm-sidebar-section">
      <span className="fm-sidebar-label">ТВОЯ МУЗЫКА</span>

      <button onClick={() => setActiveTab("library")}>
        <Icon name="heart" />
        Избранное
        <small>{likedTracks.length}</small>
      </button>

      <button onClick={() => setActiveTab("library")}>
        <Icon name="clock" />
        История
      </button>

      <button>
        <Icon name="star" />
        Миксы
      </button>
    </div>

    <div className="fm-sidebar-bottom">
      {user ? (
        <button
          className="fm-user-mini"
          onClick={() => setActiveTab("profile")}
        >
          <div className="fm-mini-avatar">
            {user?.username?.slice(0, 1)?.toUpperCase() || "F"}
          </div>

          <div>
            <strong>{user.username || "Пользователь"}</strong>
            <span>Профиль</span>
          </div>
        </button>
      ) : (
        <button className="fm-login-sidebar" onClick={openLogin}>
          <Icon name="user" />
          Войти в аккаунт
        </button>
      )}
    </div>
  </aside>

  <main className="fm-main">
    <header className="fm-header">
      <div className="fm-mobile-brand">
        <div className="fm-logo-mark">F</div>
        <strong>FENIX MUSIC</strong>
      </div>

      <div
        className={`fm-header-search ${
          mobileSearchOpen ? "open" : ""
        }`}
      >
        <Icon name="search" size={20} />

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setMobileSearchOpen(true)}
          placeholder="Поиск музыки..."
        />
      </div>

      <div className="fm-header-actions">
        <button
          className="fm-mobile-search"
          onClick={() => {
            setMobileSearchOpen((value) => !value);
            setActiveTab("search");
          }}
        >
          <Icon name="search" size={21} />
        </button>

        {user ? (
          <button
            className="fm-header-user"
            onClick={() => setActiveTab("profile")}
          >
            <div className="fm-mini-avatar">
              {user?.username?.slice(0, 1)?.toUpperCase() || "F"}
            </div>
            <span>{user.username || "Профиль"}</span>
          </button>
        ) : (
          <button
            className="fm-login-button"
            onClick={openLogin}
          >
            Войти
          </button>
        )}
      </div>
    </header>

    {musicError && (
      <div className="fm-error-banner">
        <span>{musicError}</span>

        <button onClick={loadMusic}>
          <Icon name="refresh" size={18} />
          Повторить
        </button>
      </div>
    )}

    {loading ? (
      <div className="fm-loading">
        <div className="fm-loader" />
        <span>Загружаем музыку...</span>
      </div>
    ) : (
      <div className="fm-content">{renderContent()}</div>
    )}
  </main>

  <Player
    track={currentTrack}
    isPlaying={isPlaying}
    onToggle={togglePlay}
    onPrevious={playPrevious}
    onNext={playNext}
    onOpen={() => setFullPlayerOpen(true)}
    onLike={toggleLike}
    liked={currentTrack ? likedIds.has(currentTrack.id) : false}
    currentTime={currentTime}
    duration={duration}
    onSeek={seek}
  />

  {fullPlayerOpen && (
    <FullPlayer
      track={currentTrack}
      isPlaying={isPlaying}
      liked={currentTrack ? likedIds.has(currentTrack.id) : false}
      onClose={() => setFullPlayerOpen(false)}
      onToggle={togglePlay}
      onPrevious={playPrevious}
      onNext={playNext}
      onLike={toggleLike}
      currentTime={currentTime}
      duration={duration}
      onSeek={seek}
    />
  )}

  <AuthModal
    open={authOpen}
    mode={authMode}
    setMode={setAuthMode}
    onClose={() => setAuthOpen(false)}
    onSubmit={submitAuth}
    captcha={captcha}
    captchaLoading={captchaLoading}
    captchaError={captchaError}
    refreshCaptcha={loadCaptcha}
    authLoading={authLoading}
    error={authError}
  />
</div>

);
}

export default App;
