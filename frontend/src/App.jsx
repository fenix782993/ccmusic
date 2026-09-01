import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
const API_BASE = "https://ccmusice.onrender.com";
const apiFetch = async (url, options = {}) => {
const response = await fetch(`${API_BASE}${url}`, {
credentials: "include",
...options,
headers: {
Accept: "application/json",
...(options.body ? { "Content-Type": "application/json" } : {}),
...(options.headers || {}),
},
});
const contentType = response.headers.get("content-type") || "";
if (!response.ok) {
let message = `HTTP ${response.status}`;
    try {
      if (contentType.includes("application/json")) {
        const data = await response.json();
        message = data.error || data.message || message;
      } else {
        const text = await response.text();
        if (text) message = text;
      }
    } catch {
      // ignore parsing error
    }

    throw new Error(message);
}
if (contentType.includes("application/json")) {
return response.json();
}
return response.text();
};
const formatTime = (seconds) => {
const value = Number(seconds);
if (!Number.isFinite(value) || value < 0) {
return "0:00";
}
const total = Math.floor(value);
const minutes = Math.floor(total / 60);
const secondsPart = total % 60;
return `${minutes}:${String(secondsPart).padStart(2, "0")}`;
};
const getTrackId = (track) => {
return (
track?.id ||
track?.track_id ||
track?.file_name ||
track?.file ||
track?.title ||
Math.random().toString(36)
);
};
const getTrackTitle = (track) => {
return (
track?.title ||
track?.name ||
track?.track_name ||
track?.file_name ||
"Без названия"
);
};
const getTrackArtist = (track) => {
return (
track?.artist_name ||
track?.artist ||
track?.author ||
"Fenix Music"
);
};
const getTrackCover = (track) => {
return (
track?.cover_url ||
track?.cover ||
track?.image ||
"/music-cover.svg"
);
};
const getTrackAudioUrl = (track) => {
if (track?.audio_url) {
if (track.audio_url.startsWith("http")) {
return track.audio_url;
}
    return `${API_BASE}${track.audio_url}`;
}
if (track?.url) {
if (track.url.startsWith("http")) {
return track.url;
}
    return `${API_BASE}${track.url}`;
}
const fileName =
track?.file_name ||
track?.file ||
track?.filename;
if (fileName) {
return `${API_BASE}/api/music/audio/${encodeURIComponent(fileName)}`;
}
return "";
};
const normalizeTracks = (data) => {
if (Array.isArray(data)) {
return data;
}
if (Array.isArray(data?.tracks)) {
return data.tracks;
}
if (Array.isArray(data?.items)) {
return data.items;
}
if (Array.isArray(data?.music)) {
return data.music;
}
if (Array.isArray(data?.results)) {
return data.results;
}
return [];
};
const Icon = ({ name, size = 22, strokeWidth = 2 }) => {
const common = {
width: size,
height: size,
viewBox: "0 0 24 24",
fill: "none",
stroke: "currentColor",
strokeWidth,
strokeLinecap: "round",
strokeLinejoin: "round",
"aria-hidden": "true",
};
switch (name) {
case "home":
return (
<svg {...common}>
<path d="M3 10.8 12 3l9 7.8" />
<path d="M5.5 9.5V21h13V9.5" />
<path d="M9.5 21v-6h5v6" />
</svg>
);
    case "search":
      return (
        <svg {...common}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 5 5" />
        </svg>
      );

    case "library":
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      );

    case "heart":
      return (
        <svg {...common}>
          <path d="M20.8 8.8c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A5 5 0 0 1 12 5.7a5 5 0 0 1 8.8 3.1Z" />
        </svg>
      );

    case "heartFilled":
      return (
        <svg
          {...common}
          fill="currentColor"
        >
          <path d="M20.8 8.8c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A5 5 0 0 1 12 5.7a5 5 0 0 1 8.8 3.1Z" />
        </svg>
      );

    case "play":
      return (
        <svg {...common} fill="currentColor">
          <path
            d="M8 5.2v13.6c0 .9 1 1.45 1.8.98l10.3-6.8a1.15 1.15 0 0 0 0-1.96L9.8 4.22C9 3.75 8 4.3 8 5.2Z"
            stroke="none"
          />
        </svg>
      );

    case "pause":
      return (
        <svg {...common} fill="currentColor">
          <rect
            x="6"
            y="4"
            width="4"
            height="16"
            rx="1"
            stroke="none"
          />
          <rect
            x="14"
            y="4"
            width="4"
            height="16"
            rx="1"
            stroke="none"
          />
        </svg>
      );

    case "next":
      return (
        <svg {...common}>
          <path d="m5 5 9 7-9 7V5Z" fill="currentColor" />
          <path d="M19 5v14" />
        </svg>
      );

    case "previous":
      return (
        <svg {...common}>
          <path d="m19 5-9 7 9 7V5Z" fill="currentColor" />
          <path d="M5 5v14" />
        </svg>
      );

    case "shuffle":
      return (
        <svg {...common}>
          <path d="M3 7h3c4.5 0 5 10 9 10h6" />
          <path d="m18 14 3 3-3 3" />
          <path d="M3 17h3c1.6 0 2.7-1.4 3.5-2.8" />
          <path d="M14 9c.7-1.2 1.8-2 3-2h4" />
          <path d="m18 4 3 3-3 3" />
        </svg>
      );

    case "repeat":
      return (
        <svg {...common}>
          <path d="M17 2l3 3-3 3" />
          <path d="M20 5H7a4 4 0 0 0-4 4v1" />
          <path d="m7 22-3-3 3-3" />
          <path d="M4 19h13a4 4 0 0 0 4-4v-1" />
        </svg>
      );

    case "volume":
      return (
        <svg {...common}>
          <path d="M4 9v6h4l5 4V5L8 9H4Z" />
          <path d="M17 8.5a5 5 0 0 1 0 7" />
          <path d="M19.5 6a8.5 8.5 0 0 1 0 12" />
        </svg>
      );

    case "volumeMute":
      return (
        <svg {...common}>
          <path d="M4 9v6h4l5 4V5L8 9H4Z" />
          <path d="m18 9 3 6" />
          <path d="m21 9-3 6" />
        </svg>
      );

    case "queue":
      return (
        <svg {...common}>
          <path d="M4 6h12" />
          <path d="M4 11h12" />
          <path d="M4 16h7" />
          <path d="M18 15v6" />
          <path d="M15 18h6" />
        </svg>
      );

    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.7-4L3 10" />
          <path d="M3 5v5h5" />
          <path d="M4 13a8 8 0 0 0 14.7 4L21 14" />
          <path d="M21 19v-5h-5" />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21c.7-3.5 3-5.5 7-5.5s6.3 2 7 5.5" />
        </svg>
      );

    case "music":
      return (
        <svg {...common}>
          <path d="M9 18V5l11-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "star":
      return (
        <svg {...common}>
          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
        </svg>
      );

    case "login":
      return (
        <svg {...common}>
          <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
          <path d="M14 8l4 4-4 4" />
          <path d="M8 12h10" />
        </svg>
      );

    case "userPlus":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20c.6-3.4 2.5-5.3 5.5-5.3s4.9 1.9 5.5 5.3" />
          <path d="M18 8v6" />
          <path d="M15 11h6" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );

    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );

    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M4 20h16" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
}
};
function Captcha({ value, onChange, onRefresh, loading }) {
return (
<div className="fm-captcha">
<div className="fm-captcha-header">
<span>Проверка безопасности</span>
        <button
          type="button"
          className="fm-icon-button"
          onClick={onRefresh}
          disabled={loading}
          title="Новый код"
        >
          <Icon
            name="refresh"
            size={18}
          />
        </button>
      </div>

      <div className="fm-captcha-code">
        <span className="fm-captcha-digit">
          5
        </span>
        <span className="fm-captcha-digit">
          8
        </span>
        <span className="fm-captcha-digit">
          3
        </span>
        <span className="fm-captcha-digit">
          5
        </span>
      </div>

      <label className="fm-field-label">
        Введите 4 цифры
      </label>

      <input
        className="fm-input fm-captcha-input"
        value={value}
        onChange={(event) => {
          const next = event.target.value
            .replace(/\D/g, "")
            .slice(0, 4);

          onChange(next);
        }}
        inputMode="numeric"
        maxLength={4}
        placeholder="0000"
        autoComplete="off"
      />
    </div>
);
}
function AuthModal({
mode,
onClose,
onModeChange,
onAuthorized,
}) {
const [username, setUsername] = useState("");
const [password, setPassword] = useState("");
const [captcha, setCaptcha] = useState("");
const [captchaCode, setCaptchaCode] = useState("");
const [captchaId, setCaptchaId] = useState("");
const [loading, setLoading] = useState(false);
const [captchaLoading, setCaptchaLoading] = useState(false);
const [error, setError] = useState("");
const generateLocalCaptcha = useCallback(() => {
const code = String(
Math.floor(1000 + Math.random() * 9000)
);
    setCaptchaCode(code);
    setCaptchaId(`local-${Date.now()}`);
    setCaptcha("");
}, []);
const loadCaptcha = useCallback(async () => {
setCaptchaLoading(true);
setError("");
    try {
      const data = await apiFetch(
        "/api/captcha"
      );

      const code =
        data?.code ||
        data?.captcha ||
        data?.captcha_code;

      if (code) {
        setCaptchaCode(String(code));
        setCaptchaId(
          data?.captcha_id ||
            data?.id ||
            `server-${Date.now()}`
        );
        setCaptcha("");
      } else {
        generateLocalCaptcha();
      }
    } catch {
      generateLocalCaptcha();
    } finally {
      setCaptchaLoading(false);
    }
}, [generateLocalCaptcha]);
useEffect(() => {
loadCaptcha();
}, [loadCaptcha, mode]);
const submit = async (event) => {
event.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Введите имя пользователя.");
      return;
    }

    if (!password) {
      setError("Введите пароль.");
      return;
    }

    if (captcha.length !== 4) {
      setError("Введите 4 цифры CAPTCHA.");
      return;
    }

    if (captcha !== captchaCode) {
      setError("Неверный код CAPTCHA.");
      generateLocalCaptcha();
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/register";

      const data = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
          captcha,
          captcha_id: captchaId,
        }),
      });

      onAuthorized(data);
      onClose();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Не удалось выполнить запрос."
      );
      generateLocalCaptcha();
    } finally {
      setLoading(false);
    }
};
return (
<div
className="fm-modal-backdrop"
onMouseDown={(event) => {
if (event.target === event.currentTarget) {
onClose();
}
}}
>
<div
className="fm-modal"
onMouseDown={(event) =>
event.stopPropagation()
}
>
<buttontype="button"className="fm-modal-close"onClick={onClose}>
<Iconname="close"size={24}/>
</button>
        <div className="fm-auth-logo">
          <div className="fm-logo-mark">
            F
          </div>
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

        <p className="fm-modal-subtitle">
          {mode === "login"
            ? "Войдите в Fenix Music"
            : "Создайте свой музыкальный профиль"}
        </p>

        {error && (
          <div className="fm-error">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <label className="fm-field-label">
            Имя пользователя
          </label>

          <div className="fm-input-wrap">
            <Icon
              name="user"
              size={19}
            />
            <input
              className="fm-input"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              placeholder="Введите имя"
              autoComplete="username"
            />
          </div>

          <label className="fm-field-label">
            Пароль
          </label>

          <div className="fm-input-wrap">
            <Icon
              name="lock"
              size={19}
            />
            <input
              className="fm-input"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Введите пароль"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
            />
          </div>

          <Captcha
            value={captcha}
            onChange={setCaptcha}
            onRefresh={loadCaptcha}
            loading={captchaLoading}
          />

          <button
            className="fm-primary-button fm-auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              "Загрузка..."
            ) : mode === "login" ? (
              <>
                <Icon
                  name="login"
                  size={19}
                />
                Войти
              </>
            ) : (
              <>
                <Icon
                  name="userPlus"
                  size={19}
                />
                Зарегистрироваться
              </>
            )}
          </button>
        </form>

        <div className="fm-auth-switch">
          {mode === "login"
            ? "Нет аккаунта?"
            : "Уже есть аккаунт?"}

          <button
            type="button"
            onClick={() =>
              onModeChange(
                mode === "login"
                  ? "register"
                  : "login"
              )
            }
          >
            {mode === "login"
              ? "Регистрация"
              : "Войти"}
          </button>
        </div>
      </div>
    </div>
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
}) {
return (
<div
className={`fm-track-row ${ active ? "is-active" : "" }`}
onDoubleClick={() => onPlay(track)}
>
<div className="fm-track-number">
{active && playing ? (
<span className="fm-equalizer">
<i />
<i />
<i />
</span>
) : (
index + 1
)}
</div>
      <img
        className="fm-track-cover"
        src={getTrackCover(track)}
        alt=""
        onError={(event) => {
          event.currentTarget.src =
            "/music-cover.svg";
        }}
      />

      <div className="fm-track-info">
        <div className="fm-track-title">
          {getTrackTitle(track)}
        </div>

        <div className="fm-track-artist">
          {getTrackArtist(track)}
        </div>
      </div>

      <div className="fm-track-duration">
        {formatTime(track?.duration)}
      </div>

      <button
        type="button"
        className={`fm-like-button ${
          liked ? "is-liked" : ""
        }`}
        onClick={(event) => {
          event.stopPropagation();
          onLike(track);
        }}
        title={
          liked
            ? "Убрать из избранного"
            : "Добавить в избранное"
        }
      >
        <Icon
          name={liked ? "heartFilled" : "heart"}
          size={19}
        />
      </button>

      <button
        type="button"
        className="fm-row-play"
        onClick={(event) => {
          event.stopPropagation();
          onPlay(track);
        }}
      >
        <Icon
          name={
            active && playing
              ? "pause"
              : "play"
          }
          size={18}
        />
      </button>
    </div>
);
}
function TrackCard({
track,
active,
playing,
liked,
onPlay,
onLike,
}) {
return (
<div className="fm-track-card">
<div
className="fm-card-cover-wrap"
onClick={() => onPlay(track)}
>
<img
className="fm-card-cover"
src={getTrackCover(track)}
alt=""
onError={(event) => {
event.currentTarget.src =
"/music-cover.svg";
}}
/>
        <button
          type="button"
          className="fm-card-play"
          onClick={(event) => {
            event.stopPropagation();
            onPlay(track);
          }}
        >
          <Icon
            name={
              active && playing
                ? "pause"
                : "play"
            }
            size={22}
          />
        </button>
      </div>

      <div className="fm-card-title">
        {getTrackTitle(track)}
      </div>

      <div className="fm-card-artist">
        {getTrackArtist(track)}
      </div>

      <button
        type="button"
        className={`fm-card-like ${
          liked ? "is-liked" : ""
        }`}
        onClick={() => onLike(track)}
      >
        <Icon
          name={liked ? "heartFilled" : "heart"}
          size={17}
        />
      </button>
    </div>
);
}
function EmptyState({
title,
text,
action,
}) {
return (
<div className="fm-empty">
<div className="fm-empty-icon">
<Iconname="music"size={38}/>
</div>
      <h3>{title}</h3>
      <p>{text}</p>

      {action}
    </div>
);
}
function Player({
track,
playing,
currentTime,
duration,
volume,
shuffle,
repeat,
onPlayPause,
onPrevious,
onNext,
onSeek,
onVolume,
onShuffle,
onRepeat,
onOpenFullscreen,
onLike,
liked,
}) {
if (!track) {
return (
<div className="fm-player fm-player-empty">
<div className="fm-player-empty-text">
<Iconname="music"size={22}/>
Выберите трек для воспроизведения
</div>
</div>
);
}
const progress =
duration > 0
? Math.min(
100,
Math.max(
0,
(currentTime / duration) * 100
)
)
: 0;
return (
<div className="fm-player">
<div className="fm-player-track">
<img
className="fm-player-cover"
src={getTrackCover(track)}
alt=""
onError={(event) => {
event.currentTarget.src =
"/music-cover.svg";
}}
/>
        <div className="fm-player-info">
          <div className="fm-player-title">
            {getTrackTitle(track)}
          </div>
          <div className="fm-player-artist">
            {getTrackArtist(track)}
          </div>
        </div>

        <button
          type="button"
          className={`fm-player-like ${
            liked ? "is-liked" : ""
          }`}
          onClick={() => onLike(track)}
        >
          <Icon
            name={liked ? "heartFilled" : "heart"}
            size={20}
          />
        </button>
      </div>

      <div className="fm-player-center">
        <div className="fm-player-controls">
          <button
            type="button"
            className={`fm-player-control small ${
              shuffle ? "active" : ""
            }`}
            onClick={onShuffle}
            title="Перемешивание"
          >
            <Icon
              name="shuffle"
              size={18}
            />
          </button>

          <button
            type="button"
            className="fm-player-control"
            onClick={onPrevious}
            title="Предыдущий"
          >
            <Icon
              name="previous"
              size={21}
            />
          </button>

          <button
            type="button"
            className="fm-player-main"
            onClick={onPlayPause}
            title={
              playing ? "Пауза" : "Воспроизвести"
            }
          >
            <Icon
              name={playing ? "pause" : "play"}
              size={23}
            />
          </button>

          <button
            type="button"
            className="fm-player-control"
            onClick={onNext}
            title="Следующий"
          >
            <Icon
              name="next"
              size={21}
            />
          </button>

          <button
            type="button"
            className={`fm-player-control small ${
              repeat ? "active" : ""
            }`}
            onClick={onRepeat}
            title="Повтор"
          >
            <Icon
              name="repeat"
              size={18}
            />
          </button>
        </div>

        <div className="fm-progress-row">
          <span>
            {formatTime(currentTime)}
          </span>

          <div className="fm-progress">
            <div
              className="fm-progress-fill"
              style={{
                width: `${progress}%`,
              }}
            />

            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={
                Math.min(
                  currentTime,
                  duration || currentTime
                )
              }
              onChange={(event) =>
                onSeek(
                  Number(event.target.value)
                )
              }
              aria-label="Прогресс"
            />
          </div>

          <span>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      <div className="fm-player-right">
        <div className="fm-volume">
          <Icon
            name={
              volume === 0
                ? "volumeMute"
                : "volume"
            }
            size={19}
          />

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) =>
              onVolume(
                Number(event.target.value)
              )
            }
            aria-label="Громкость"
          />
        </div>

        <button
          type="button"
          className="fm-player-control"
          onClick={onOpenFullscreen}
          title="Полноэкранный плеер"
        >
          <Icon
            name="queue"
            size={19}
          />
        </button>
      </div>
    </div>
);
}
function FullscreenPlayer({
track,
playing,
currentTime,
duration,
onClose,
onPlayPause,
onPrevious,
onNext,
onSeek,
onLike,
liked,
}) {
if (!track) return null;
const progress =
duration > 0
? Math.min(
100,
Math.max(
0,
(currentTime / duration) * 100
)
)
: 0;
return (
<div className="fm-fullscreen-player">
<buttontype="button"className="fm-fullscreen-close"onClick={onClose}>
<Iconname="close"size={25}/>
</button>
      <div className="fm-fullscreen-content">
        <div className="fm-fullscreen-label">
          FENIX MUSIC
        </div>

        <img
          className="fm-fullscreen-cover"
          src={getTrackCover(track)}
          alt=""
          onError={(event) => {
            event.currentTarget.src =
              "/music-cover.svg";
          }}
        />

        <div className="fm-fullscreen-title">
          {getTrackTitle(track)}
        </div>

        <div className="fm-fullscreen-artist">
          {getTrackArtist(track)}
        </div>

        <button
          type="button"
          className={`fm-fullscreen-like ${
            liked ? "is-liked" : ""
          }`}
          onClick={() => onLike(track)}
        >
          <Icon
            name={liked ? "heartFilled" : "heart"}
            size={22}
          />
        </button>

        <div className="fm-fullscreen-progress">
          <div className="fm-progress-row">
            <span>
              {formatTime(currentTime)}
            </span>

            <div className="fm-progress">
              <div
                className="fm-progress-fill"
                style={{
                  width: `${progress}%`,
                }}
              />

              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={currentTime}
                onChange={(event) =>
                  onSeek(
                    Number(event.target.value)
                  )
                }
              />
            </div>

            <span>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="fm-fullscreen-controls">
          <button
            type="button"
            onClick={onPrevious}
          >
            <Icon
              name="previous"
              size={28}
            />
          </button>

          <button
            type="button"
            className="fm-fullscreen-main"
            onClick={onPlayPause}
          >
            <Icon
              name={playing ? "pause" : "play"}
              size={31}
            />
          </button>

          <button
            type="button"
            onClick={onNext}
          >
            <Icon
              name="next"
              size={28}
            />
          </button>
        </div>
      </div>
    </div>
);
}
function Sidebar({
page,
onPage,
onLogin,
user,
}) {
return (
<aside className="fm-sidebar">
<div className="fm-brand">
<div className="fm-brand-mark">
F
</div>
        <div className="fm-brand-text">
          <strong>FENIX</strong>
          <span>MUSIC</span>
        </div>
      </div>

      <nav className="fm-nav">
        <button
          type="button"
          className={
            page === "home"
              ? "active"
              : ""
          }
          onClick={() => onPage("home")}
        >
          <Icon
            name="home"
            size={20}
          />
          Главная
        </button>

        <button
          type="button"
          className={
            page === "search"
              ? "active"
              : ""
          }
          onClick={() => onPage("search")}
        >
          <Icon
            name="search"
            size={20}
          />
          Поиск
        </button>

        <button
          type="button"
          className={
            page === "library"
              ? "active"
              : ""
          }
          onClick={() => onPage("library")}
        >
          <Icon
            name="library"
            size={20}
          />
          Моя библиотека
        </button>
      </nav>

      <div className="fm-sidebar-section">
        <div className="fm-sidebar-heading">
          Ваша музыка
        </div>

        <button
          type="button"
          className={
            page === "liked"
              ? "active"
              : ""
          }
          onClick={() => onPage("liked")}
        >
          <Icon
            name="heart"
            size={19}
          />
          Избранное
        </button>

        <button
          type="button"
          className={
            page === "history"
              ? "active"
              : ""
          }
          onClick={() => onPage("history")}
        >
          <Icon
            name="clock"
            size={19}
          />
          История
        </button>
      </div>

      <div className="fm-sidebar-spacer" />

      <div className="fm-sidebar-bottom">
        {user ? (
          <button
            type="button"
            className="fm-user-card"
            onClick={() => onPage("profile")}
          >
            <div className="fm-avatar">
              {String(
                user.username ||
                  user.name ||
                  "U"
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="fm-user-info">
              <strong>
                {user.username ||
                  user.name ||
                  "Пользователь"}
              </strong>

              <span>
                Ваш профиль
              </span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            className="fm-login-sidebar"
            onClick={onLogin}
          >
            <Icon
              name="login"
              size={19}
            />
            Войти
          </button>
        )}
      </div>
    </aside>
);
}
function HomePage({
tracks,
recentTracks,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
onPage,
}) {
const popular = tracks.slice(0, 8);
const newTracks = tracks.slice(0, 8);
const recent = recentTracks.slice(0, 8);
return (
<div className="fm-page">
<section className="fm-hero">
<div className="fm-hero-content">
<div className="fm-hero-badge">
<Iconname="star"size={15}/>
FENIX MUSIC
</div>
          <h1>
            Твоя музыка.
            <br />
            Твой мир.
          </h1>

          <p>
            Слушай любимые треки,
            открывай новых исполнителей
            и собирай свою музыкальную
            библиотеку.
          </p>

          <div className="fm-hero-actions">
            <button
              type="button"
              className="fm-primary-button"
              onClick={() => {
                if (tracks.length) {
                  onPlay(tracks[0]);
                }
              }}
              disabled={!tracks.length}
            >
              <Icon
                name="play"
                size={19}
              />
              Слушать музыку
            </button>

            <button
              type="button"
              className="fm-secondary-button"
              onClick={() => onPage("search")}
            >
              Найти музыку
              <Icon
                name="arrow"
                size={17}
              />
            </button>
          </div>
        </div>

        <div className="fm-hero-art">
          <div className="fm-hero-disc">
            <div className="fm-disc-center">
              F
            </div>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="fm-section">
          <div className="fm-section-header">
            <div>
              <h2>
                Продолжить слушать
              </h2>
              <span>
                Недавно прослушанное
              </span>
            </div>

            <button
              type="button"
              onClick={() => onPage("history")}
            >
              Все
              <Icon
                name="arrow"
                size={16}
              />
            </button>
          </div>

          <div className="fm-horizontal-cards">
            {recent.map((track) => (
              <TrackCard
                key={getTrackId(track)}
                track={track}
                active={
                  getTrackId(track) ===
                  getTrackId(currentTrack)
                }
                playing={playing}
                liked={likedIds.has(
                  getTrackId(track)
                )}
                onPlay={onPlay}
                onLike={onLike}
              />
            ))}
          </div>
        </section>
      )}

      <section className="fm-section">
        <div className="fm-section-header">
          <div>
            <h2>Популярное</h2>
            <span>
              Что сейчас слушают
            </span>
          </div>
        </div>

        {popular.length > 0 ? (
          <div className="fm-track-list">
            {popular.map((track, index) => (
              <TrackRow
                key={getTrackId(track)}
                track={track}
                index={index}
                active={
                  getTrackId(track) ===
                  getTrackId(currentTrack)
                }
                playing={playing}
                liked={likedIds.has(
                  getTrackId(track)
                )}
                onPlay={onPlay}
                onLike={onLike}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Музыки пока нет"
            text="Добавьте аудиофайлы в папку music на сервере."
          />
        )}
      </section>

      <section className="fm-section">
        <div className="fm-section-header">
          <div>
            <h2>Новинки</h2>
            <span>
              Свежие треки
            </span>
          </div>
        </div>

        {newTracks.length > 0 ? (
          <div className="fm-card-grid">
            {newTracks.map((track) => (
              <TrackCard
                key={getTrackId(track)}
                track={track}
                active={
                  getTrackId(track) ===
                  getTrackId(currentTrack)
                }
                playing={playing}
                liked={likedIds.has(
                  getTrackId(track)
                )}
                onPlay={onPlay}
                onLike={onLike}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Новинок пока нет"
            text="Когда на сервере появятся треки, они будут показаны здесь."
          />
        )}
      </section>
    </div>
);
}
function SearchPage({
tracks,
query,
setQuery,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
}) {
const filtered = useMemo(() => {
const value = query
.trim()
.toLowerCase();
    if (!value) {
      return tracks;
    }

    return tracks.filter((track) => {
      const title = getTrackTitle(
        track
      ).toLowerCase();

      const artist = getTrackArtist(
        track
      ).toLowerCase();

      return (
        title.includes(value) ||
        artist.includes(value)
      );
    });
}, [tracks, query]);
return (
<div className="fm-page">
<div className="fm-page-heading">
<div>
<div className="fm-page-kicker">
FENIX MUSIC
</div>
<h1>Поиск</h1>
<p>
Найдите любимый трек или
исполнителя.
</p>
</div>
</div>
      <div className="fm-search-large">
        <Icon
          name="search"
          size={22}
        />

        <input
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Что хотите послушать?"
          autoFocus
        />

        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
          >
            <Icon
              name="close"
              size={19}
            />
          </button>
        )}
      </div>

      <div className="fm-search-result-title">
        {query
          ? `Результаты поиска: ${filtered.length}`
          : `Все треки: ${filtered.length}`}
      </div>

      {filtered.length > 0 ? (
        <div className="fm-track-list">
          {filtered.map((track, index) => (
            <TrackRow
              key={getTrackId(track)}
              track={track}
              index={index}
              active={
                getTrackId(track) ===
                getTrackId(currentTrack)
              }
              playing={playing}
              liked={likedIds.has(
                getTrackId(track)
              )}
              onPlay={onPlay}
              onLike={onLike}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Ничего не найдено"
          text="Попробуйте изменить запрос."
        />
      )}
    </div>
);
}
function LibraryPage({
likedTracks,
recentTracks,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
onPage,
}) {
return (
<div className="fm-page">
<div className="fm-page-heading">
<div>
<div className="fm-page-kicker">
ВАША МУЗЫКА
</div>
<h1>Моя библиотека</h1>
<p>
Всё, что вы слушаете и
сохраняете.
</p>
</div>
</div>
      <div className="fm-library-stats">
        <div className="fm-stat-card">
          <Icon
            name="heart"
            size={23}
          />
          <strong>
            {likedTracks.length}
          </strong>
          <span>
            Избранных треков
          </span>
        </div>

        <div className="fm-stat-card">
          <Icon
            name="clock"
            size={23}
          />
          <strong>
            {recentTracks.length}
          </strong>
          <span>
            В истории
          </span>
        </div>
      </div>

      <section className="fm-section">
        <div className="fm-section-header">
          <div>
            <h2>Избранное</h2>
            <span>
              Ваши любимые треки
            </span>
          </div>

          <button
            type="button"
            onClick={() => onPage("liked")}
          >
            Открыть
            <Icon
              name="arrow"
              size={16}
            />
          </button>
        </div>

        {likedTracks.length > 0 ? (
          <div className="fm-track-list">
            {likedTracks
              .slice(0, 8)
              .map((track, index) => (
                <TrackRow
                  key={getTrackId(track)}
                  track={track}
                  index={index}
                  active={
                    getTrackId(track) ===
                    getTrackId(currentTrack)
                  }
                  playing={playing}
                  liked={likedIds.has(
                    getTrackId(track)
                  )}
                  onPlay={onPlay}
                  onLike={onLike}
                />
              ))}
          </div>
        ) : (
          <EmptyState
            title="Избранное пусто"
            text="Нажимайте на сердечко возле треков, чтобы сохранить их."
          />
        )}
      </section>

      <section className="fm-section">
        <div className="fm-section-header">
          <div>
            <h2>История</h2>
            <span>
              Недавно прослушанное
            </span>
          </div>

          <button
            type="button"
            onClick={() => onPage("history")}
          >
            Открыть
            <Icon
              name="arrow"
              size={16}
            />
          </button>
        </div>

        {recentTracks.length > 0 ? (
          <div className="fm-horizontal-cards">
            {recentTracks
              .slice(0, 6)
              .map((track) => (
                <TrackCard
                  key={getTrackId(track)}
                  track={track}
                  active={
                    getTrackId(track) ===
                    getTrackId(currentTrack)
                  }
                  playing={playing}
                  liked={likedIds.has(
                    getTrackId(track)
                  )}
                  onPlay={onPlay}
                  onLike={onLike}
                />
              ))}
          </div>
        ) : (
          <EmptyState
            title="История пуста"
            text="Начните слушать музыку."
          />
        )}
      </section>
    </div>
);
}
function CollectionPage({
title,
subtitle,
tracks,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
}) {
return (
<div className="fm-page">
<div className="fm-page-heading">
<div>
<div className="fm-page-kicker">
FENIX MUSIC
</div>
          <h1>{title}</h1>

          <p>{subtitle}</p>
        </div>
      </div>

      {tracks.length > 0 ? (
        <div className="fm-track-list">
          {tracks.map((track, index) => (
            <TrackRow
              key={getTrackId(track)}
              track={track}
              index={index}
              active={
                getTrackId(track) ===
                getTrackId(currentTrack)
              }
              playing={playing}
              liked={likedIds.has(
                getTrackId(track)
              )}
              onPlay={onPlay}
              onLike={onLike}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            title === "Избранное"
              ? "Нет избранных треков"
              : "История пуста"
          }
          text={
            title === "Избранное"
              ? "Сохраняйте понравившуюся музыку сердечком."
              : "Прослушанные треки появятся здесь."
          }
        />
      )}
    </div>
);
}
function ProfilePage({
user,
onLogin,
}) {
if (!user) {
return (
<div className="fm-page">
<div className="fm-profile-login">
<div className="fm-profile-login-icon">
<Iconname="user"size={38}/>
</div>
          <h1>Ваш профиль</h1>

          <p>
            Войдите или зарегистрируйтесь,
            чтобы сохранять библиотеку
            и историю прослушиваний.
          </p>

          <button
            type="button"
            className="fm-primary-button"
            onClick={onLogin}
          >
            <Icon
              name="login"
              size={19}
            />
            Войти
          </button>
        </div>
      </div>
    );
}
const username =
user.username ||
user.name ||
"Пользователь";
return (
<div className="fm-page">
<div className="fm-profile">
<div className="fm-profile-cover">
<div className="fm-profile-glow" />
</div>
        <div className="fm-profile-main">
          <div className="fm-profile-avatar">
            {username
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="fm-profile-info">
            <div className="fm-profile-kicker">
              FENIX MUSIC
            </div>

            <h1>{username}</h1>

            <p>
              Музыкальный профиль
            </p>
          </div>
        </div>

        <div className="fm-profile-cards">
          <div>
            <strong>
              {user.id || "—"}
            </strong>
            <span>ID пользователя</span>
          </div>

          <div>
            <strong>Fenix</strong>
            <span>Платформа</span>
          </div>

          <div>
            <strong>Music</strong>
            <span>Сервис</span>
          </div>
        </div>
      </div>
    </div>
);
}
function App() {
const audioRef = useRef(null);
const [page, setPage] = useState("home");
const [tracks, setTracks] = useState([]);
const [loadingTracks, setLoadingTracks] =
useState(true);
const [tracksError, setTracksError] =
useState("");
const [currentTrack, setCurrentTrack] =
useState(null);
const [playing, setPlaying] =
useState(false);
const [currentTime, setCurrentTime] =
useState(0);
const [duration, setDuration] =
useState(0);
const [volume, setVolume] =
useState(0.8);
const [shuffle, setShuffle] =
useState(false);
const [repeat, setRepeat] =
useState(false);
const [likedIds, setLikedIds] =
useState(() => {
try {
const stored =
localStorage.getItem(
"fenix_music_liked"
);
        return new Set(
          stored
            ? JSON.parse(stored)
            : []
        );
      } catch {
        return new Set();
      }
    });

const [historyIds, setHistoryIds] =
useState(() => {
try {
const stored =
localStorage.getItem(
"fenix_music_history"
);
        return stored
          ? JSON.parse(stored)
          : [];
      } catch {
        return [];
      }
    });

const [searchQuery, setSearchQuery] =
useState("");
const [authOpen, setAuthOpen] =
useState(false);
const [authMode, setAuthMode] =
useState("login");
const [user, setUser] =
useState(null);
const [fullscreen, setFullscreen] =
useState(false);
const [toast, setToast] =
useState("");
const showToast = useCallback(
(message) => {
setToast(message);
      window.clearTimeout(
        showToast.timeout
      );

      showToast.timeout =
        window.setTimeout(() => {
          setToast("");
        }, 2200);
    },
    []
);
const loadTracks = useCallback(
async () => {
setLoadingTracks(true);
setTracksError("");
      try {
        const data =
          await apiFetch(
            "/api/music"
          );

        const nextTracks =
          normalizeTracks(data);

        setTracks(nextTracks);

        if (
          nextTracks.length > 0 &&
          !currentTrack
        ) {
          // Не запускаем автоматически.
        }
      } catch (error) {
        setTracksError(
          error?.message ||
            "Не удалось загрузить музыку."
        );
        setTracks([]);
      } finally {
        setLoadingTracks(false);
      }
    },
    [currentTrack]
);
useEffect(() => {
loadTracks();
}, [loadTracks]);
useEffect(() => {
const checkAuth = async () => {
const endpoints = [
"/api/auth/me",
"/api/me",
"/api/user",
];
      for (const endpoint of endpoints) {
        try {
          const data =
            await apiFetch(endpoint);

          const nextUser =
            data?.user ||
            data?.profile ||
            (data?.ok
              ? data
              : null);

          if (nextUser) {
            setUser(nextUser);
            return;
          }
        } catch {
          // Проверяем следующий endpoint.
        }
      }
    };

    checkAuth();
}, []);
useEffect(() => {
try {
localStorage.setItem(
"fenix_music_liked",
JSON.stringify(
Array.from(likedIds)
)
);
} catch {
// ignore
}
}, [likedIds]);
useEffect(() => {
try {
localStorage.setItem(
"fenix_music_history",
JSON.stringify(historyIds)
);
} catch {
// ignore
}
}, [historyIds]);
useEffect(() => {
const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
}, [volume]);
const addHistory = useCallback(
(track) => {
const id = getTrackId(track);
      setHistoryIds((previous) => [
        id,
        ...previous.filter(
          (item) => item !== id
        ),
      ].slice(0, 50));
    },
    []
);
const playTrack = useCallback(
async (track) => {
if (!track) return;
      const audio = audioRef.current;

      if (!audio) return;

      const sameTrack =
        getTrackId(currentTrack) ===
        getTrackId(track);

      if (sameTrack) {
        try {
          if (audio.paused) {
            await audio.play();
            setPlaying(true);
          } else {
            audio.pause();
            setPlaying(false);
          }
        } catch {
          showToast(
            "Не удалось запустить аудио."
          );
        }

        return;
      }

      const url =
        getTrackAudioUrl(track);

      if (!url) {
        showToast(
          "У этого трека нет аудиофайла."
        );
        return;
      }

      audio.pause();

      audio.src = url;
      audio.currentTime = 0;

      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(
        Number(track?.duration) || 0
      );

      addHistory(track);

      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        showToast(
          "Браузер не разрешил воспроизведение. Нажмите Play."
        );
      }
    },
    [
      currentTrack,
      addHistory,
      showToast,
    ]
);
const togglePlay = useCallback(
async () => {
const audio = audioRef.current;
      if (!audio || !currentTrack) {
        if (tracks.length > 0) {
          playTrack(tracks[0]);
        }

        return;
      }

      try {
        if (audio.paused) {
          await audio.play();
          setPlaying(true);
        } else {
          audio.pause();
          setPlaying(false);
        }
      } catch {
        showToast(
          "Не удалось воспроизвести трек."
        );
      }
    },
    [
      currentTrack,
      tracks,
      playTrack,
      showToast,
    ]
);
const getCurrentIndex =
useCallback(() => {
if (!currentTrack) return -1;
      return tracks.findIndex(
        (track) =>
          getTrackId(track) ===
          getTrackId(currentTrack)
      );
    }, [tracks, currentTrack]);

const nextTrack = useCallback(() => {
if (!tracks.length) return;
    let index =
      getCurrentIndex();

    if (shuffle) {
      index = Math.floor(
        Math.random() *
          tracks.length
      );
    } else {
      index += 1;

      if (index >= tracks.length) {
        index = 0;
      }
    }

    playTrack(tracks[index]);
}, [
tracks,
shuffle,
getCurrentIndex,
playTrack,
]);
const previousTrack =
useCallback(() => {
const audio =
audioRef.current;
      if (
        audio &&
        audio.currentTime > 4
      ) {
        audio.currentTime = 0;
        return;
      }

      if (!tracks.length) return;

      let index =
        getCurrentIndex();

      index -= 1;

      if (index < 0) {
        index = tracks.length - 1;
      }

      playTrack(tracks[index]);
    }, [
      tracks,
      getCurrentIndex,
      playTrack,
    ]);

const toggleLike = useCallback(
(track) => {
if (!track) return;
      const id = getTrackId(track);

      setLikedIds((previous) => {
        const next = new Set(
          previous
        );

        if (next.has(id)) {
          next.delete(id);
          showToast(
            "Удалено из избранного"
          );
        } else {
          next.add(id);
          showToast(
            "Добавлено в избранное"
          );
        }

        return next;
      });
    },
    [showToast]
);
const seek = useCallback(
(value) => {
const audio =
audioRef.current;
      if (!audio) return;

      audio.currentTime = value;
      setCurrentTime(value);
    },
    []
);
const changeVolume =
useCallback((value) => {
setVolume(value);
      if (audioRef.current) {
        audioRef.current.volume =
          value;
      }
    }, []);

const likedTracks = useMemo(
() =>
tracks.filter((track) =>
likedIds.has(
getTrackId(track)
)
),
[tracks, likedIds]
);
const recentTracks = useMemo(
() => {
const result = [];
      for (const id of historyIds) {
        const track = tracks.find(
          (item) =>
            getTrackId(item) === id
        );

        if (track) {
          result.push(track);
        }
      }

      return result;
    },
    [tracks, historyIds]
);
const handleAudioTimeUpdate =
() => {
const audio =
audioRef.current;
      if (!audio) return;

      setCurrentTime(
        audio.currentTime
      );
    };

const handleAudioLoaded =
() => {
const audio =
audioRef.current;
      if (!audio) return;

      if (
        Number.isFinite(
          audio.duration
        )
      ) {
        setDuration(
          audio.duration
        );
      }
    };

const handleAudioPlay = () => {
setPlaying(true);
};
const handleAudioPause = () => {
setPlaying(false);
};
const handleAudioEnded = () => {
if (repeat) {
const audio =
audioRef.current;
      if (!audio) return;

      audio.currentTime = 0;
      audio.play();

      return;
    }

    nextTrack();
};
const handleAuthorized =
(data) => {
const nextUser =
data?.user ||
data?.profile ||
data;
      if (nextUser) {
        setUser(nextUser);
        showToast(
          "Добро пожаловать в Fenix Music!"
        );
      }
    };

const pageTitle = {
home: "Главная",
search: "Поиск",
library: "Библиотека",
liked: "Избранное",
history: "История",
profile: "Профиль",
};
const renderPage = () => {
if (
loadingTracks &&
page === "home"
) {
return (
<div className="fm-page">
<div className="fm-loading">
<div className="fm-spinner" />
<h2>
Загружаем Fenix Music
</h2>
<p>
Подготавливаем вашу музыку...
</p>
</div>
</div>
);
}
    if (
      tracksError &&
      page === "home"
    ) {
      return (
        <div className="fm-page">
          <div className="fm-error-page">
            <div className="fm-error-icon">
              <Icon
                name="music"
                size={35}
              />
            </div>

            <h1>
              Не удалось загрузить музыку
            </h1>

            <p>
              {tracksError}
            </p>

            <button
              type="button"
              className="fm-primary-button"
              onClick={loadTracks}
            >
              <Icon
                name="refresh"
                size={18}
              />
              Повторить
            </button>
          </div>
        </div>
      );
    }

    switch (page) {
      case "search":
        return (
          <SearchPage
            tracks={tracks}
            query={searchQuery}
            setQuery={setSearchQuery}
            likedIds={likedIds}
            currentTrack={currentTrack}
            playing={playing}
            onPlay={playTrack}
            onLike={toggleLike}
          />
        );

      case "library":
        return (
          <LibraryPage
            likedTracks={likedTracks}
            recentTracks={recentTracks}
            likedIds={likedIds}
            currentTrack={currentTrack}
            playing={playing}
            onPlay={playTrack}
            onLike={toggleLike}
            onPage={setPage}
          />
        );

      case "liked":
        return (
          <CollectionPage
            title="Избранное"
            subtitle="Треки, которые вы сохранили."
            tracks={likedTracks}
            likedIds={likedIds}
            currentTrack={currentTrack}
            playing={playing}
            onPlay={playTrack}
            onLike={toggleLike}
          />
        );

      case "history":
        return (
          <CollectionPage
            title="История"
            subtitle="Недавно прослушанная музыка."
            tracks={recentTracks}
            likedIds={likedIds}
            currentTrack={currentTrack}
            playing={playing}
            onPlay={playTrack}
            onLike={toggleLike}
          />
        );

      case "profile":
        return (
          <ProfilePage
            user={user}
            onLogin={() => {
              setAuthMode("login");
              setAuthOpen(true);
            }}
          />
        );

      default:
        return (
          <HomePage
            tracks={tracks}
            recentTracks={recentTracks}
            likedIds={likedIds}
            currentTrack={currentTrack}
            playing={playing}
            onPlay={playTrack}
            onLike={toggleLike}
            onPage={setPage}
          />
        );
    }
};
return (
<div className="fenix-music-app">
<audio
ref={audioRef}
preload="metadata"
onTimeUpdate={
handleAudioTimeUpdate
}
onLoadedMetadata={
handleAudioLoaded
}
onPlay={handleAudioPlay}
onPause={handleAudioPause}
onEnded={handleAudioEnded}
/>
      <Sidebar
        page={page}
        onPage={setPage}
        onLogin={() => {
          setAuthMode("login");
          setAuthOpen(true);
        }}
        user={user}
      />

      <main className="fm-main">
        <header className="fm-topbar">
          <div className="fm-breadcrumb">
            <span>Fenix Music</span>
            <b>/</b>
            <strong>
              {pageTitle[page] ||
                "Главная"}
            </strong>
          </div>

          <div className="fm-topbar-actions">
            <button
              type="button"
              className="fm-topbar-search"
              onClick={() =>
                setPage("search")
              }
            >
              <Icon
                name="search"
                size={18}
              />
              <span>
                Поиск музыки
              </span>
              <kbd>⌘ K</kbd>
            </button>

            {user ? (
              <button
                type="button"
                className="fm-top-avatar"
                onClick={() =>
                  setPage("profile")
                }
              >
                {String(
                  user.username ||
                    user.name ||
                    "U"
                )
                  .charAt(0)
                  .toUpperCase()}
              </button>
            ) : (
              <button
                type="button"
                className="fm-top-login"
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
              >
                <Icon
                  name="login"
                  size={17}
                />
                Войти
              </button>
            )}
          </div>
        </header>

        {renderPage()}
      </main>

      <Player
        track={currentTrack}
        playing={playing}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        shuffle={shuffle}
        repeat={repeat}
        onPlayPause={togglePlay}
        onPrevious={previousTrack}
        onNext={nextTrack}
        onSeek={seek}
        onVolume={changeVolume}
        onShuffle={() =>
          setShuffle(
            (value) => !value
          )
        }
        onRepeat={() =>
          setRepeat(
            (value) => !value
          )
        }
        onOpenFullscreen={() =>
          setFullscreen(true)
        }
        onLike={toggleLike}
        liked={
          currentTrack
            ? likedIds.has(
                getTrackId(
                  currentTrack
                )
              )
            : false
        }
      />

      {authOpen && (
        <AuthModal
          mode={authMode}
          onClose={() =>
            setAuthOpen(false)
          }
          onModeChange={setAuthMode}
          onAuthorized={
            handleAuthorized
          }
        />
      )}

      {fullscreen && (
        <FullscreenPlayer
          track={currentTrack}
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          onClose={() =>
            setFullscreen(false)
          }
          onPlayPause={togglePlay}
          onPrevious={previousTrack}
          onNext={nextTrack}
          onSeek={seek}
          onLike={toggleLike}
          liked={
            currentTrack
              ? likedIds.has(
                  getTrackId(
                    currentTrack
                  )
                )
              : false
          }
        />
      )}

      {toast && (
        <div className="fm-toast">
          <Icon
            name="check"
            size={17}
          />
          {toast}
        </div>
      )}
    </div>
);
}
export default App;
