import React, { useEffect, useMemo, useRef, useState } from "react";
const API = "";
function api(path, options = {}) {
return fetch(`${API}${path}`, {
...options,
headers: {
Accept: "application/json",
...(options.headers || {}),
},
});
}
function formatTime(value) {
const seconds = Math.max(0, Math.floor(Number(value) || 0));
const minutes = Math.floor(seconds / 60);
const secs = String(seconds % 60).padStart(2, "0");
return `${minutes}:${secs}`;
}
function generateLocalGradient(index) {
const gradients = [
"linear-gradient(135deg,#ff1744,#6a1b9a)",
"linear-gradient(135deg,#ff6f00,#d50000)",
"linear-gradient(135deg,#7c4dff,#00b8d4)",
"linear-gradient(135deg,#f50057,#651fff)",
"linear-gradient(135deg,#00c853,#1565c0)",
"linear-gradient(135deg,#ff9100,#ff1744)",
];
return gradients[index % gradients.length];
}
function Icon({ name, size = 20 }) {
const icons = {
home: "⌂",
search: "⌕",
library: "▣",
heart: "♥",
history: "◷",
queue: "☷",
play: "▶",
pause: "Ⅱ",
next: "⏭",
prev: "⏮",
shuffle: "⤨",
repeat: "↻",
volume: "🔊",
menu: "☰",
close: "×",
user: "●",
plus: "+",
fullscreen: "⛶",
back: "‹",
forward: "›",
refresh: "↻",
fire: "🔥",
star: "★",
bolt: "⚡",
};
return (
<span
style={{
display: "inline-flex",
width: size,
height: size,
alignItems: "center",
justifyContent: "center",
fontSize: size * 0.9,
lineHeight: 1,
}}
>
{icons[name] || "•"}
</span>
);
}
function TrackCover({ track, index = 0, small = false }) {
const style = {
width: small ? 54 : 180,
height: small ? 54 : 180,
minWidth: small ? 54 : 180,
borderRadius: small ? 12 : 20,
overflow: "hidden",
background: generateLocalGradient(index),
position: "relative",
boxShadow: small
? "0 8px 25px rgba(0,0,0,.25)"
: "0 18px 50px rgba(0,0,0,.35)",
};
if (track?.cover_url) {
return (
<div style={style}>
<img
src={track.cover_url}
alt=""
style={{
width: "100%",
height: "100%",
objectFit: "cover",
}}
onError={(event) => {
event.currentTarget.style.display = "none";
}}
/>
<div
style={{
position: "absolute",
inset: 0,
display: "flex",
alignItems: "center",
justifyContent: "center",
fontSize: small ? 22 : 64,
fontWeight: 900,
color: "#fff",
textShadow: "0 4px 20px rgba(0,0,0,.5)",
pointerEvents: "none",
}}
>
♪
</div>
</div>
);
}
return (
<div style={style}>
<div
style={{
position: "absolute",
width: "70%",
height: "70%",
borderRadius: "50%",
border: "2px solid rgba(255,255,255,.25)",
left: "15%",
top: "15%",
}}
/>
<div
style={{
position: "absolute",
width: "22%",
height: "22%",
borderRadius: "50%",
background: "#08080b",
left: "39%",
top: "39%",
}}
/>
<div
style={{
position: "absolute",
inset: 0,
display: "flex",
alignItems: "center",
justifyContent: "center",
color: "#fff",
fontWeight: 900,
fontSize: small ? 18 : 30,
}}
>
♪
</div>
</div>
);
}
function TrackCard({
track,
index,
onPlay,
onFavorite,
favorite,
}) {
return (
<div className="fm-track-card">
<button
className="fm-card-cover-button"
onClick={() => onPlay(track)}
>
<TrackCover track={track} index={index} />
<span className="fm-card-play">
<Icon name="play" size={24} />
</span>
</button>
      <div className="fm-card-info">
        <div className="fm-card-title">
          {track.title || "Без названия"}
        </div>

        <div className="fm-card-artist">
          {track.artist_name || "Fenix Music"}
        </div>

        <div className="fm-card-bottom">
          <button
            className={`fm-icon-button ${
              favorite ? "active" : ""
            }`}
            onClick={() => onFavorite(track)}
            title="Избранное"
          >
            <Icon name="heart" size={18} />
          </button>

          <span className="fm-play-count">
            {Number(track.plays_count || 0)} прослушиваний
          </span>
        </div>
      </div>
    </div>
);
}
function TrackRow({
track,
index,
onPlay,
onFavorite,
favorite,
playing,
}) {
return (
<div className={`fm-track-row ${playing ? "playing" : ""}`}>
<button
className="fm-row-cover"
onClick={() => onPlay(track)}
>
<TrackCover track={track} index={index} small />
{playing && (
<span className="fm-playing-indicator">
<i />
<i />
<i />
</span>
)}
</button>
      <button
        className="fm-row-main"
        onClick={() => onPlay(track)}
      >
        <strong>{track.title || "Без названия"}</strong>
        <span>
          {track.artist_name || "Fenix Music"}
          {track.album_name
            ? ` • ${track.album_name}`
            : ""}
        </span>
      </button>

      <span className="fm-row-duration">
        {track.duration ? formatTime(track.duration) : "—"}
      </span>

      <button
        className={`fm-icon-button ${
          favorite ? "active" : ""
        }`}
        onClick={() => onFavorite(track)}
      >
        <Icon name="heart" size={18} />
      </button>

      <button
        className="fm-more-button"
        onClick={() => onPlay(track)}
      >
        •••
      </button>
    </div>
);
}
function AuthModal({
open,
onClose,
mode,
setMode,
}) {
const [captchaCode, setCaptchaCode] = useState("");
const [captchaId, setCaptchaId] = useState("");
const [captchaInput, setCaptchaInput] = useState("");
const [captchaLoading, setCaptchaLoading] = useState(false);
const [captchaError, setCaptchaError] = useState("");
const [message, setMessage] = useState("");
const [name, setName] = useState("");
const [password, setPassword] = useState("");
const loadCaptcha = async () => {
try {
setCaptchaLoading(true);
setCaptchaError("");
setMessage("");
      const response = await api(
        `/api/captcha?_=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "CAPTCHA server error"
        );
      }

      if (!data.captcha_id || !data.code) {
        throw new Error("Некорректный ответ CAPTCHA");
      }

      setCaptchaId(data.captcha_id);
      setCaptchaCode(String(data.code));
      setCaptchaInput("");
      setCaptchaError("");
    } catch (error) {
      console.error(error);
      setCaptchaCode("");
      setCaptchaId("");
      setCaptchaInput("");
      setCaptchaError(
        "Не удалось загрузить CAPTCHA с сервера. Обновите код."
      );
    } finally {
      setCaptchaLoading(false);
    }
};
useEffect(() => {
if (open) {
loadCaptcha();
}
}, [open]);
if (!open) return null;
const submit = async (event) => {
event.preventDefault();
setMessage("");
setCaptchaError("");
    if (captchaInput.length !== 4) {
      setCaptchaError("Введите все 4 цифры CAPTCHA.");
      return;
    }

    try {
      const response = await api("/api/captcha/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          captcha_id: captchaId,
          code: captchaInput,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setCaptchaError(
          data.error || "Неверная CAPTCHA."
        );
        await loadCaptcha();
        return;
      }

      setMessage(
        mode === "login"
          ? "CAPTCHA пройдена. Авторизация готова."
          : "CAPTCHA пройдена. Регистрация готова."
      );
    } catch (error) {
      setCaptchaError(
        "Ошибка соединения с сервером."
      );
    }
};
return (
<div className="fm-modal-backdrop" onMouseDown={onClose}>
<div
className="fm-auth-modal"
onMouseDown={(event) => event.stopPropagation()}
>
<buttonclassName="fm-modal-close"onClick={onClose}>
<Icon name="close" size={26} />
</button>
        <div className="fm-auth-logo">
          <div className="fm-logo-mark">F</div>
          <div>
            <strong>FENIX</strong>
            <span>MUSIC</span>
          </div>
        </div>

        <h2>
          {mode === "login"
            ? "С возвращением"
            : "Создать аккаунт"}
        </h2>

        <p className="fm-auth-subtitle">
          {mode === "login"
            ? "Войдите в свою музыкальную вселенную."
            : "Создайте профиль и сохраняйте любимую музыку."}
        </p>

        <form onSubmit={submit}>
          <label className="fm-label">
            Имя пользователя
            <input
              className="fm-input"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Введите имя"
            />
          </label>

          <label className="fm-label">
            Пароль
            <input
              className="fm-input"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Введите пароль"
            />
          </label>

          <div className="fm-captcha-title">
            Проверка безопасности
          </div>

          <div className="fm-captcha">
            <div className="fm-captcha-code">
              {captchaLoading
                ? "••••"
                : captchaCode || "----"}
            </div>

            <button
              type="button"
              className="fm-captcha-refresh"
              onClick={loadCaptcha}
              title="Новая CAPTCHA"
            >
              <Icon name="refresh" size={22} />
            </button>
          </div>

          <input
            className="fm-input fm-captcha-input"
            inputMode="numeric"
            maxLength={4}
            value={captchaInput}
            placeholder="Введите 4 цифры"
            onChange={(event) =>
              setCaptchaInput(
                event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4)
              )
            }
          />

          {captchaError && (
            <div className="fm-error">
              {captchaError}
            </div>
          )}

          {message && (
            <div className="fm-success">
              {message}
            </div>
          )}

          <button className="fm-primary-button" type="submit">
            {mode === "login"
              ? "Войти"
              : "Зарегистрироваться"}
          </button>
        </form>

        <button
          className="fm-switch-auth"
          onClick={() => {
            setMode(
              mode === "login"
                ? "register"
                : "login"
            );
            setMessage("");
            setCaptchaError("");
            setCaptchaInput("");
          }}
        >
          {mode === "login"
            ? "Нет аккаунта? Зарегистрироваться"
            : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
);
}
function App() {
const audioRef = useRef(null);
const [tracks, setTracks] = useState([]);
const [activeTrack, setActiveTrack] = useState(null);
const [playing, setPlaying] = useState(false);
const [currentTime, setCurrentTime] = useState(0);
const [duration, setDuration] = useState(0);
const [volume, setVolume] = useState(0.8);
const [muted, setMuted] = useState(false);
const [shuffle, setShuffle] = useState(false);
const [repeat, setRepeat] = useState(false);
const [queue, setQueue] = useState([]);
const [history, setHistory] = useState([]);
const [favorites, setFavorites] = useState(() => {
try {
return JSON.parse(
localStorage.getItem("fenix_music_favorites") || "[]"
);
} catch {
return [];
}
});
const [search, setSearch] = useState("");
const [searchOpen, setSearchOpen] = useState(false);
const [section, setSection] = useState("home");
const [authOpen, setAuthOpen] = useState(false);
const [authMode, setAuthMode] = useState("login");
const [fullscreenPlayer, setFullscreenPlayer] =
useState(false);
const [sidebarOpen, setSidebarOpen] =
useState(false);
const [loading, setLoading] = useState(true);
const [serverError, setServerError] = useState("");
const [toast, setToast] = useState("");
const [mobileNav, setMobileNav] =
useState("home");
const showToast = (text) => {
setToast(text);
    window.clearTimeout(showToast.timer);

    showToast.timer = window.setTimeout(() => {
      setToast("");
    }, 2500);
};
const loadTracks = async () => {
try {
setLoading(true);
setServerError("");
      const response = await api(
        `/api/music/tracks?_=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(
          data.error || "Music API error"
        );
      }

      const loaded = Array.isArray(data.tracks)
        ? data.tracks
        : [];

      setTracks(loaded);
    } catch (error) {
      console.error("Music load error:", error);
      setServerError(
        "Не удалось загрузить музыку с сервера."
      );
    } finally {
      setLoading(false);
    }
};
useEffect(() => {
loadTracks();
}, []);
useEffect(() => {
localStorage.setItem(
"fenix_music_favorites",
JSON.stringify(favorites)
);
}, [favorites]);
useEffect(() => {
localStorage.setItem(
"fenix_music_history",
JSON.stringify(history)
);
}, [history]);
useEffect(() => {
try {
const savedHistory =
JSON.parse(
localStorage.getItem(
"fenix_music_history"
) || "[]"
);
      if (Array.isArray(savedHistory)) {
        setHistory(savedHistory);
      }
    } catch {}
}, []);
useEffect(() => {
if (!audioRef.current) return;
    audioRef.current.volume = muted
      ? 0
      : volume;
}, [volume, muted]);
const favoriteSet = useMemo(
() => new Set(favorites),
[favorites]
);
const toggleFavorite = async (track) => {
const id = track.id;
    setFavorites((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );

    try {
      await api("/api/music/favorite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          favorite:
            !favoriteSet.has(id),
        }),
      });
    } catch {
      // Local favorite still works if API is unavailable.
    }
};
const playTrack = async (
track,
list = tracks
) => {
if (!track) return;
    const audio = audioRef.current;

    if (!audio) return;

    const url =
      track.audio_url ||
      `/api/music/audio/${encodeURIComponent(
        track.file_name || ""
      )}`;

    if (
      activeTrack?.id === track.id &&
      audio.src
    ) {
      try {
        await audio.play();
        setPlaying(true);
        return;
      } catch {
        return;
      }
    }

    setActiveTrack(track);
    setCurrentTime(0);
    setDuration(
      Number(track.duration || 0)
    );

    const remaining = list.filter(
      (item) =>
        item.id !== track.id
    );

    setQueue(remaining);

    if (
      !history.some(
        (item) => item.id === track.id
      )
    ) {
      setHistory((current) =>
        [track, ...current].slice(0, 30)
      );
    } else {
      setHistory((current) => {
        const filtered =
          current.filter(
            (item) =>
              item.id !== track.id
          );

        return [track, ...filtered].slice(
          0,
          30
        );
      });
    }

    try {
      audio.src = url;
      audio.load();

      await audio.play();

      setPlaying(true);

      api("/api/music/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: track.id,
          file_name: track.file_name,
        }),
      }).catch(() => {});
    } catch (error) {
      console.error(
        "Playback error:",
        error
      );

      showToast(
        "Не удалось воспроизвести этот трек"
      );
    }
};
const togglePlay = async () => {
const audio = audioRef.current;
    if (!audio) return;

    if (!activeTrack) {
      if (tracks.length) {
        await playTrack(tracks[0]);
      }

      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        showToast(
          "Браузер заблокировал воспроизведение"
        );
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
};
const nextTrack = async () => {
if (!activeTrack) return;
    let next = null;

    if (shuffle) {
      const pool = tracks.filter(
        (track) =>
          track.id !== activeTrack.id
      );

      if (pool.length) {
        next =
          pool[
            Math.floor(
              Math.random() *
                pool.length
            )
          ];
      }
    } else if (queue.length) {
      next = queue[0];
      setQueue((current) =>
        current.slice(1)
      );
    }

    if (!next) {
      const index =
        tracks.findIndex(
          (track) =>
            track.id ===
            activeTrack.id
        );

      if (index >= 0) {
        next =
          tracks[
            (index + 1) %
              tracks.length
          ];
      }
    }

    if (next) {
      await playTrack(next, tracks);
    }
};
const previousTrack = async () => {
if (!activeTrack) return;
    if (currentTime > 5) {
      const audio = audioRef.current;

      if (audio) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }

      return;
    }

    const currentIndex =
      tracks.findIndex(
        (track) =>
          track.id ===
          activeTrack.id
      );

    if (currentIndex < 0) return;

    const previous =
      tracks[
        (currentIndex - 1 + tracks.length) %
          tracks.length
      ];

    if (previous) {
      await playTrack(previous, tracks);
    }
};
useEffect(() => {
const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(
        audio.currentTime || 0
      );
    };

    const onLoaded = () => {
      const actual =
        Number(audio.duration);

      if (Number.isFinite(actual)) {
        setDuration(actual);
      }
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    const onEnded = () => {
      if (repeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }

      nextTrack();
    };

    audio.addEventListener(
      "timeupdate",
      onTimeUpdate
    );

    audio.addEventListener(
      "loadedmetadata",
      onLoaded
    );

    audio.addEventListener(
      "durationchange",
      onLoaded
    );

    audio.addEventListener(
      "play",
      onPlay
    );

    audio.addEventListener(
      "pause",
      onPause
    );

    audio.addEventListener(
      "ended",
      onEnded
    );

    return () => {
      audio.removeEventListener(
        "timeupdate",
        onTimeUpdate
      );

      audio.removeEventListener(
        "loadedmetadata",
        onLoaded
      );

      audio.removeEventListener(
        "durationchange",
        onLoaded
      );

      audio.removeEventListener(
        "play",
        onPlay
      );

      audio.removeEventListener(
        "pause",
        onPause
      );

      audio.removeEventListener(
        "ended",
        onEnded
      );
    };
}, [
repeat,
shuffle,
queue,
tracks,
activeTrack,
currentTime,
]);
const seek = (event) => {
const value =
Number(event.target.value);
    const audio = audioRef.current;

    if (!audio) return;

    audio.currentTime = value;
    setCurrentTime(value);
};
const filteredTracks = useMemo(() => {
const query =
search.trim().toLowerCase();
    if (!query) {
      return tracks;
    }

    return tracks.filter(
      (track) => {
        const text = [
          track.title,
          track.artist_name,
          track.album_name,
          track.file_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(query);
      }
    );
}, [tracks, search]);
const popularTracks = useMemo(
() =>
[...tracks].sort(
(a, b) =>
Number(b.plays_count || 0) -
Number(a.plays_count || 0)
),
[tracks]
);
const favoriteTracks = useMemo(
() =>
tracks.filter((track) =>
favoriteSet.has(track.id)
),
[tracks, favoriteSet]
);
const newTracks = useMemo(
() =>
[...tracks].sort(
(a, b) =>
new Date(
b.created_at ||
b.modified_at ||
0
) -
new Date(
a.created_at ||
a.modified_at ||
0
)
),
[tracks]
);
const displayTracks =
section === "favorites"
? favoriteTracks
: section === "history"
? history
: section === "popular"
? popularTracks
: section === "new"
? newTracks
: filteredTracks;
const goSection = (value) => {
setSection(value);
setMobileNav(value);
setSidebarOpen(false);
    if (value !== "search") {
      setSearchOpen(false);
    }
};
const navItems = [
{
id: "home",
label: "Главная",
icon: "home",
},
{
id: "search",
label: "Поиск",
icon: "search",
},
{
id: "favorites",
label: "Моя музыка",
icon: "heart",
},
{
id: "history",
label: "История",
icon: "history",
},
{
id: "queue",
label: "Очередь",
icon: "queue",
},
];
const title =
section === "home"
? "Для вас"
: section === "favorites"
? "Моя музыка"
: section === "history"
? "Недавно прослушанное"
: section === "popular"
? "Популярное"
: section === "new"
? "Новинки"
: section === "search"
? "Поиск"
: section === "queue"
? "Очередь"
: "Fenix Music";
return (
<div className="fm-app">
<audio ref={audioRef} preload="metadata" />
      <aside
        className={`fm-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="fm-brand">
          <div className="fm-logo-mark">F</div>

          <div className="fm-brand-text">
            <strong>FENIX</strong>
            <span>MUSIC</span>
          </div>
        </div>

        <nav className="fm-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={
                section === item.id
                  ? "active"
                  : ""
              }
              onClick={() =>
                goSection(item.id)
              }
            >
              <Icon
                name={item.icon}
                size={21}
              />
              <span>{item.label}</span>

              {item.id ===
                "favorites" &&
                favoriteTracks.length > 0 && (
                  <em>
                    {favoriteTracks.length}
                  </em>
                )}
            </button>
          ))}
        </nav>

        <div className="fm-nav-heading">
          КАТАЛОГ
        </div>

        <nav className="fm-nav">
          <button
            className={
              section === "popular"
                ? "active"
                : ""
            }
            onClick={() =>
              goSection("popular")
            }
          >
            <Icon name="fire" size={21} />
            <span>Популярное</span>
          </button>

          <button
            className={
              section === "new"
                ? "active"
                : ""
            }
            onClick={() =>
              goSection("new")
            }
          >
            <Icon name="star" size={21} />
            <span>Новинки</span>
          </button>

          <button
            onClick={() =>
              showToast(
                "Миксы скоро появятся"
              )
            }
          >
            <Icon name="bolt" size={21} />
            <span>Миксы</span>
          </button>
        </nav>

        <div className="fm-sidebar-bottom">
          <div className="fm-mini-card">
            <div className="fm-mini-card-icon">
              ✦
            </div>
            <div>
              <strong>Fenix Premium</strong>
              <span>
                Музыка без ограничений
              </span>
            </div>
          </div>
        </div>
      </aside>

      <div
        className={`fm-sidebar-overlay ${
          sidebarOpen ? "show" : ""
        }`}
        onClick={() =>
          setSidebarOpen(false)
        }
      />

      <main className="fm-main">
        <header className="fm-header">
          <button
            className="fm-mobile-menu"
            onClick={() =>
              setSidebarOpen(true)
            }
          >
            <Icon name="menu" size={24} />
          </button>

          <div className="fm-header-arrows">
            <button
              onClick={() =>
                window.history.back()
              }
            >
              <Icon name="back" size={23} />
            </button>

            <button
              onClick={() =>
                window.history.forward()
              }
            >
              <Icon name="forward" size={23} />
            </button>
          </div>

          <div className="fm-search">
            <Icon name="search" size={22} />

            <input
              value={search}
              placeholder="Что хочешь послушать?"
              onFocus={() => {
                setSearchOpen(true);
                setSection("search");
              }}
              onChange={(event) => {
                setSearch(
                  event.target.value
                );
                setSearchOpen(true);
                setSection("search");
              }}
            />

            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setSearchOpen(false);
                }}
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>

          <button
            className="fm-login-button"
            onClick={() => {
              setAuthMode("login");
              setAuthOpen(true);
            }}
          >
            Войти
          </button>

          <button
            className="fm-register-button"
            onClick={() => {
              setAuthMode("register");
              setAuthOpen(true);
            }}
          >
            Регистрация
          </button>
        </header>

        <div className="fm-content">
          {section === "home" && (
            <>
              <section className="fm-hero">
                <div className="fm-hero-glow" />

                <div className="fm-hero-content">
                  <span className="fm-eyebrow">
                    FENIX MUSIC
                  </span>

                  <h1>
                    Твоя музыка.
                    <br />
                    <span>
                      Твоя вселенная.
                    </span>
                  </h1>

                  <p>
                    Слушай любимые треки,
                    открывай новых
                    исполнителей и собирай
                    свою идеальную
                    библиотеку.
                  </p>

                  <div className="fm-hero-buttons">
                    <button
                      className="fm-primary-button hero"
                      onClick={() => {
                        if (tracks.length) {
                          playTrack(
                            tracks[0]
                          );
                        }
                      }}
                    >
                      <Icon
                        name="play"
                        size={18}
                      />
                      Слушать музыку
                    </button>

                    <button
                      className="fm-secondary-button"
                      onClick={() =>
                        goSection(
                          "favorites"
                        )
                      }
                    >
                      <Icon
                        name="heart"
                        size={18}
                      />
                      Моя коллекция
                    </button>
                  </div>
                </div>

                <div className="fm-hero-art">
                  <div className="fm-disc">
                    <div className="fm-disc-center">
                      F
                    </div>
                  </div>
                </div>
              </section>

              <section className="fm-section">
                <div className="fm-section-heading">
                  <div>
                    <span className="fm-section-kicker">
                      РЕКОМЕНДАЦИИ
                    </span>
                    <h2>Для вас</h2>
                  </div>

                  <button
                    className="fm-see-all"
                    onClick={() =>
                      goSection("popular")
                    }
                  >
                    Смотреть всё
                    <Icon
                      name="forward"
                      size={18}
                    />
                  </button>
                </div>

                {loading ? (
                  <div className="fm-loading-grid">
                    {Array.from({
                      length: 6,
                    }).map(
                      (_, index) => (
                        <div
                          className="fm-skeleton"
                          key={index}
                        />
                      )
                    )}
                  </div>
                ) : tracks.length ? (
                  <div className="fm-card-grid">
                    {tracks
                      .slice(0, 6)
                      .map(
                        (
                          track,
                          index
                        ) => (
                          <TrackCard
                            key={
                              track.id ||
                              index
                            }
                            track={track}
                            index={index}
                            onPlay={
                              playTrack
                            }
                            onFavorite={
                              toggleFavorite
                            }
                            favorite={favoriteSet.has(
                              track.id
                            )}
                          />
                        )
                      )}
                  </div>
                ) : (
                  <div className="fm-empty">
                    <div className="fm-empty-icon">
                      ♪
                    </div>
                    <h3>
                      Пока нет музыки
                    </h3>
                    <p>
                      Добавь аудиофайлы в
                      папку music на
                      сервере.
                    </p>
                  </div>
                )}
              </section>

              <section className="fm-section">
                <div className="fm-section-heading">
                  <div>
                    <span className="fm-section-kicker">
                      В ТРЕНДЕ
                    </span>
                    <h2>
                      Популярное
                    </h2>
                  </div>

                  <button
                    className="fm-see-all"
                    onClick={() =>
                      goSection(
                        "popular"
                      )
                    }
                  >
                    Смотреть всё
                    <Icon
                      name="forward"
                      size={18}
                    />
                  </button>
                </div>

                <div className="fm-list">
                  {popularTracks
                    .slice(0, 7)
                    .map(
                      (
                        track,
                        index
                      ) => (
                        <TrackRow
                          key={
                            track.id ||
                            index
                          }
                          track={track}
                          index={index}
                          onPlay={
                            playTrack
                          }
                          onFavorite={
                            toggleFavorite
                          }
                          favorite={favoriteSet.has(
                            track.id
                          )}
                          playing={
                            activeTrack?.id ===
                              track.id &&
                            playing
                          }
                        />
                      )
                    )}
                </div>
              </section>

              <section className="fm-section">
                <div className="fm-section-heading">
                  <div>
                    <span className="fm-section-kicker">
                      СВЕЖЕЕ
                    </span>
                    <h2>
                      Новинки
                    </h2>
                  </div>

                  <button
                    className="fm-see-all"
                    onClick={() =>
                      goSection("new")
                    }
                  >
                    Все новинки
                    <Icon
                      name="forward"
                      size={18}
                    />
                  </button>
                </div>

                <div className="fm-card-grid">
                  {newTracks
                    .slice(0, 4)
                    .map(
                      (
                        track,
                        index
                      ) => (
                        <TrackCard
                          key={
                            track.id ||
                            index
                          }
                          track={track}
                          index={index + 2}
                          onPlay={
                            playTrack
                          }
                          onFavorite={
                            toggleFavorite
                          }
                          favorite={favoriteSet.has(
                            track.id
                          )}
                        />
                      )
                    )}
                </div>
              </section>
            </>
          )}

          {section !== "home" && (
            <section className="fm-section fm-page-section">
              <div className="fm-page-heading">
                <div>
                  <span className="fm-section-kicker">
                    FENIX MUSIC
                  </span>

                  <h1>{title}</h1>

                  {section ===
                    "search" && (
                    <p>
                      {search
                        ? `Результаты для «${search}»`
                        : "Найди любимые треки и исполнителей."}
                    </p>
                  )}
                </div>

                <button
                  className="fm-refresh-button"
                  onClick={loadTracks}
                >
                  <Icon
                    name="refresh"
                    size={20}
                  />
                  Обновить
                </button>
              </div>

              {section ===
                "queue" ? (
                queue.length ? (
                  <div className="fm-list">
                    {queue.map(
                      (
                        track,
                        index
                      ) => (
                        <TrackRow
                          key={
                            track.id ||
                            index
                          }
                          track={track}
                          index={index}
                          onPlay={
                            playTrack
                          }
                          onFavorite={
                            toggleFavorite
                          }
                          favorite={favoriteSet.has(
                            track.id
                          )}
                          playing={
                            activeTrack?.id ===
                              track.id &&
                            playing
                          }
                        />
                      )
                    )}
                  </div>
                ) : (
                  <div className="fm-empty">
                    <div className="fm-empty-icon">
                      ☷
                    </div>
                    <h3>
                      Очередь пуста
                    </h3>
                    <p>
                      Запусти трек, чтобы
                      увидеть очередь.
                    </p>
                  </div>
                )
              ) : displayTracks.length ? (
                <div className="fm-list">
                  {displayTracks.map(
                    (
                      track,
                      index
                    ) => (
                      <TrackRow
                        key={
                          track.id ||
                          `${track.file_name}-${index}`
                        }
                        track={track}
                        index={index}
                        onPlay={
                          playTrack
                        }
                        onFavorite={
                          toggleFavorite
                        }
                        favorite={favoriteSet.has(
                          track.id
                        )}
                        playing={
                          activeTrack?.id ===
                            track.id &&
                          playing
                        }
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="fm-empty">
                  <div className="fm-empty-icon">
                    {section ===
                    "favorites"
                      ? "♥"
                      : section ===
                        "history"
                      ? "◷"
                      : "⌕"}
                  </div>

                  <h3>
                    {section ===
                    "favorites"
                      ? "Избранное пусто"
                      : section ===
                        "history"
                      ? "История пуста"
                      : "Ничего не найдено"}
                  </h3>

                  <p>
                    {section ===
                    "favorites"
                      ? "Добавляй треки в избранное."
                      : section ===
                        "history"
                      ? "Начни слушать музыку."
                      : "Попробуй изменить поисковый запрос."}
                  </p>
                </div>
              )}
            </section>
          )}

          {serverError && (
            <div className="fm-server-warning">
              <span>!</span>
              <div>
                <strong>
                  Backend подключён, но
                  музыка недоступна
                </strong>
                <p>
                  {serverError}
                </p>
              </div>

              <button
                onClick={loadTracks}
              >
                Повторить
              </button>
            </div>
          )}
        </div>
      </main>

      {activeTrack && (
        <div
          className={`fm-player ${
            fullscreenPlayer
              ? "fullscreen"
              : ""
          }`}
        >
          {fullscreenPlayer && (
            <button
              className="fm-fullscreen-close"
              onClick={() =>
                setFullscreenPlayer(
                  false
                )
              }
            >
              <Icon
                name="close"
                size={26}
              />
            </button>
          )}

          {fullscreenPlayer ? (
            <div className="fm-fullscreen-player">
              <div className="fm-fullscreen-cover">
                <TrackCover
                  track={activeTrack}
                  index={0}
                />
              </div>

              <div className="fm-visualizer">
                {Array.from({
                  length: 32,
                }).map(
                  (_, index) => (
                    <i
                      key={index}
                      style={{
                        animationDelay: `${
                          index * 0.035
                        }s`,
                      }}
                    />
                  )
                )}
              </div>

              <div className="fm-fullscreen-info">
                <span>
                  NOW PLAYING
                </span>
                <h1>
                  {activeTrack.title}
                </h1>
                <p>
                  {activeTrack.artist_name ||
                    "Fenix Music"}
                </p>
              </div>

              <input
                className="fm-progress fullscreen-progress"
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(
                  currentTime,
                  duration || 0
                )}
                onChange={seek}
              />

              <div className="fm-time-row">
                <span>
                  {formatTime(
                    currentTime
                  )}
                </span>
                <span>
                  {formatTime(
                    duration
                  )}
                </span>
              </div>

              <div className="fm-controls fullscreen-controls">
                <button
                  className={
                    shuffle
                      ? "control-active"
                      : ""
                  }
                  onClick={() =>
                    setShuffle(
                      !shuffle
                    )
                  }
                >
                  <Icon
                    name="shuffle"
                    size={23}
                  />
                </button>

                <button
                  onClick={
                    previousTrack
                  }
                >
                  <Icon
                    name="prev"
                    size={28}
                  />
                </button>

                <button
                  className="fm-big-play"
                  onClick={togglePlay}
                >
                  <Icon
                    name={
                      playing
                        ? "pause"
                        : "play"
                    }
                    size={28}
                  />
                </button>

                <button
                  onClick={nextTrack}
                >
                  <Icon
                    name="next"
                    size={28}
                  />
                </button>

                <button
                  className={
                    repeat
                      ? "control-active"
                      : ""
                  }
                  onClick={() =>
                    setRepeat(!repeat)
                  }
                >
                  <Icon
                    name="repeat"
                    size={23}
                  />
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                className="fm-player-main"
                onClick={() =>
                  setFullscreenPlayer(
                    true
                  )
                }
              >
                <TrackCover
                  track={activeTrack}
                  small
                />

                <div className="fm-player-info">
                  <strong>
                    {activeTrack.title}
                  </strong>

                  <span>
                    {activeTrack.artist_name ||
                      "Fenix Music"}
                  </span>
                </div>
              </button>

              <div className="fm-player-center">
                <div className="fm-controls">
                  <button
                    className={
                      shuffle
                        ? "control-active"
                        : ""
                    }
                    onClick={() =>
                      setShuffle(
                        !shuffle
                      )
                    }
                  >
                    <Icon
                      name="shuffle"
                      size={18}
                    />
                  </button>

                  <button
                    onClick={
                      previousTrack
                    }
                  >
                    <Icon
                      name="prev"
                      size={20}
                    />
                  </button>

                  <button
                    className="fm-play-button"
                    onClick={
                      togglePlay
                    }
                  >
                    <Icon
                      name={
                        playing
                          ? "pause"
                          : "play"
                      }
                      size={18}
                    />
                  </button>

                  <button
                    onClick={nextTrack}
                  >
                    <Icon
                      name="next"
                      size={20}
                    />
                  </button>

                  <button
                    className={
                      repeat
                        ? "control-active"
                        : ""
                    }
                    onClick={() =>
                      setRepeat(!repeat)
                    }
                  >
                    <Icon
                      name="repeat"
                      size={18}
                    />
                  </button>
                </div>

                <div className="fm-progress-line">
                  <span>
                    {formatTime(
                      currentTime
                    )}
                  </span>

                  <input
                    className="fm-progress"
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={Math.min(
                      currentTime,
                      duration || 0
                    )}
                    onChange={seek}
                  />

                  <span>
                    {formatTime(
                      duration
                    )}
                  </span>
                </div>
              </div>

              <div className="fm-player-right">
                <button
                  onClick={() =>
                    setMuted(!muted)
                  }
                >
                  <Icon
                    name="volume"
                    size={19}
                  />
                </button>

                <input
                  className="fm-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={
                    muted
                      ? 0
                      : volume
                  }
                  onChange={(
                    event
                  ) => {
                    const value =
                      Number(
                        event.target
                          .value
                      );

                    setVolume(value);
                    setMuted(
                      value === 0
                    );
                  }}
                />

                <button
                  onClick={() =>
                    setFullscreenPlayer(
                      true
                    )
                  }
                >
                  <Icon
                    name="fullscreen"
                    size={19}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <nav className="fm-mobile-nav">
        {navItems
          .slice(0, 4)
          .map((item) => (
            <button
              key={item.id}
              className={
                mobileNav ===
                item.id
                  ? "active"
                  : ""
              }
              onClick={() =>
                goSection(
                  item.id
                )
              }
            >
              <Icon
                name={item.icon}
                size={21}
              />
              <span>
                {item.label}
              </span>
            </button>
          ))}
      </nav>

      <AuthModal
        open={authOpen}
        onClose={() =>
          setAuthOpen(false)
        }
        mode={authMode}
        setMode={setAuthMode}
      />

      {toast && (
        <div className="fm-toast">
          {toast}
        </div>
      )}
    </div>
);
}
export default App;
