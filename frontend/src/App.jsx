import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "/api";
const CAPTCHA_ENDPOINT = "/captcha";
const DEFAULT_COVER = "/music-cover.svg";

const apiFetch = async (url, options = {}) => {
const response = await fetch(${API_BASE}${url}, {
credentials: "include",
...options,
headers: {
...(options.body ? { "Content-Type": "application/json" } : {}),
...(options.headers || {}),
},
});

const text = await response.text();
let data = {};

try {
data = text ? JSON.parse(text) : {};
} catch {
data = { raw: text };
}

if (!response.ok) {
throw new Error(
data?.error ||
data?.message ||
Ошибка сервера: ${response.status}
);
}

return data;
};

const formatTime = (seconds) => {
const value = Math.max(0, Math.floor(Number(seconds) || 0));
const minutes = Math.floor(value / 60);
const secs = String(value % 60).padStart(2, "0");
return ${minutes}:${secs};
};

const normalizeTrack = (item, index) => {
const fileName =
item?.file_name ||
item?.file ||
item?.filename ||
"";

const title =
item?.title ||
fileName.replace(/.[^/.]+$/, "") ||
Трек ${index + 1};

return {
id:
item?.id ||
item?.track_id ||
track-${index}-${fileName},
title,
artist:
item?.artist ||
item?.artist_name ||
"Fenix Music",
album:
item?.album ||
item?.album_name ||
"Fenix Music",
cover:
item?.cover_url ||
item?.cover ||
DEFAULT_COVER,
audio:
item?.audio_url ||
item?.url ||
(fileName
? /api/music/audio/${encodeURIComponent(fileName)}
: ""),
fileName,
duration: Number(item?.duration || 0),
plays: Number(item?.plays_count || item?.plays || 0),
raw: item,
};
};

function Icon({ name, size = 20 }) {
const icons = {
home: "⌂",
search: "⌕",
music: "♫",
heart: "♡",
heartFill: "♥",
history: "◷",
library: "▣",
user: "●",
settings: "⚙",
queue: "☷",
play: "▶",
pause: "Ⅱ",
next: "▶|",
previous: "|◀",
shuffle: "⤨",
repeat: "↻",
volume: "◖",
volumeOff: "×",
close: "×",
refresh: "↻",
plus: "+",
logout: "↪",
check: "✓",
star: "★",
fire: "♨",
download: "↓",
more: "•••",
back: "‹",
forward: "›",
lock: "▣",
shield: "◇",
};

return (
<span
className="fm-icon"
style={{
fontSize: ${size}px,
lineHeight: 1,
}}
aria-hidden="true"
>
{icons[name] || "•"}
</span>
);
}

function TrackCover({ track, large = false }) {
const [failed, setFailed] = useState(false);

const source =
!failed && track?.cover
? track.cover
: DEFAULT_COVER;

return (
<div className={fm-cover ${large ? "fm-cover-large" : ""}}>
<img
src={source}
alt={track?.title || "Обложка"}
onError={() => setFailed(true)}
/>
</div>
);
}

function EmptyState({ icon = "music", title, text, action }) {
return (
<div className="fm-empty">
<div className="fm-empty-icon">
<Icon name={icon} size={34} />
</div>

  <h3>{title}</h3>

  {text && <p>{text}</p>}

  {action && (
    <button
      className="fm-button fm-button-primary"
      onClick={action.onClick}
    >
      {action.label}
    </button>
  )}
</div>

);
}

function SectionHeader({
eyebrow,
title,
subtitle,
action,
}) {
return (
<div className="fm-section-header">
<div>
{eyebrow && (
<div className="fm-eyebrow">
{eyebrow}
</div>
)}

    <h2>{title}</h2>

    {subtitle && <p>{subtitle}</p>}
  </div>

  {action && (
    <button
      className="fm-text-button"
      onClick={action.onClick}
    >
      {action.label}
    </button>
  )}
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
onMenu,
}) {
return (
<article
className={fm-track-card ${ active ? "is-active" : "" }}
>
<div className="fm-track-cover-wrap">
<TrackCover track={track} large />

    <button
      className="fm-card-play"
      onClick={() => onPlay(track)}
      aria-label={
        active && playing
          ? "Пауза"
          : "Воспроизвести"
      }
    >
      <Icon
        name={
          active && playing
            ? "pause"
            : "play"
        }
        size={23}
      />
    </button>

    <button
      className={`fm-card-like ${
        liked ? "is-liked" : ""
      }`}
      onClick={() => onLike(track)}
      aria-label="Избранное"
    >
      <Icon
        name={
          liked
            ? "heartFill"
            : "heart"
        }
        size={19}
      />
    </button>
  </div>

  <div className="fm-track-card-info">
    <strong title={track.title}>
      {track.title}
    </strong>

    <span title={track.artist}>
      {track.artist}
    </span>
  </div>

  <button
    className="fm-more-button"
    onClick={() => onMenu(track)}
    aria-label="Дополнительно"
  >
    <Icon name="more" size={17} />
  </button>
</article>

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
onMenu,
}) {
return (
<div
className={fm-track-row ${ active ? "is-active" : "" }}
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

  <TrackCover track={track} />

  <button
    className="fm-row-main"
    onClick={() => onPlay(track)}
  >
    <strong>{track.title}</strong>
    <span>{track.artist}</span>
  </button>

  <span className="fm-row-album">
    {track.album}
  </span>

  <span className="fm-row-plays">
    {track.plays}
  </span>

  <button
    className={`fm-row-like ${
      liked ? "is-liked" : ""
    }`}
    onClick={() => onLike(track)}
  >
    <Icon
      name={
        liked
          ? "heartFill"
          : "heart"
      }
      size={18}
    />
  </button>

  <button
    className="fm-more-button"
    onClick={() => onMenu(track)}
  >
    <Icon name="more" size={17} />
  </button>
</div>

);
}

function AuthModal({
mode,
onModeChange,
onClose,
onSuccess,
}) {
const [username, setUsername] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] =
useState("");

const [captchaId, setCaptchaId] =
useState("");
const [captchaCode, setCaptchaCode] =
useState("");
const [captchaAnswer, setCaptchaAnswer] =
useState("");

const [captchaLoading, setCaptchaLoading] =
useState(false);
const [loading, setLoading] =
useState(false);
const [error, setError] = useState("");

const loadCaptcha = useCallback(
async () => {
setCaptchaLoading(true);
setError("");

  try {
    const data = await apiFetch(
      CAPTCHA_ENDPOINT
    );

    const id = String(
      data?.captcha_id ||
        data?.id ||
        ""
    );

    const code = String(
      data?.code ||
        data?.captcha_code ||
        data?.captcha ||
        data?.text ||
        ""
    ).replace(/\D/g, "");

    if (!id || !code) {
      throw new Error(
        "Сервер не вернул CAPTCHA."
      );
    }

    setCaptchaId(id);
    setCaptchaCode(code);
    setCaptchaAnswer("");
  } catch (err) {
    setCaptchaId("");
    setCaptchaCode("");
    setCaptchaAnswer("");
    setError(
      err.message ||
        "Не удалось загрузить CAPTCHA с сервера."
    );
  } finally {
    setCaptchaLoading(false);
  }
},
[]

);

useEffect(() => {
if (mode === "register") {
loadCaptcha();
}
}, [mode, loadCaptcha]);

const submit = async (event) => {
event.preventDefault();
setError("");

if (!username.trim()) {
  setError("Введите логин.");
  return;
}

if (password.length < 6) {
  setError(
    "Пароль должен содержать минимум 6 символов."
  );
  return;
}

if (
  mode === "register" &&
  password !== confirmPassword
) {
  setError("Пароли не совпадают.");
  return;
}

if (mode === "register") {
  if (
    !captchaId ||
    !captchaCode
  ) {
    setError(
      "CAPTCHA ещё не загружена."
    );
    return;
  }

  if (
    captchaAnswer.length !== 4
  ) {
    setError(
      "Введите 4 цифры CAPTCHA."
    );
    return;
  }

  if (
    captchaAnswer !== captchaCode
  ) {
    setError(
      "Неверная CAPTCHA."
    );
    await loadCaptcha();
    return;
  }
}

setLoading(true);

try {
  const endpoint =
    mode === "login"
      ? "/auth/login"
      : "/auth/register";

  const payload =
    mode === "login"
      ? {
          username:
            username.trim(),
          email:
            email.trim(),
          password,
        }
      : {
          username:
            username.trim(),
          email:
            email.trim(),
          password,
          captcha:
            captchaAnswer,
          captcha_code:
            captchaAnswer,
          captcha_id:
            captchaId,
        };

  const data = await apiFetch(
    endpoint,
    {
      method: "POST",
      body: JSON.stringify(
        payload
      ),
    }
  );

  const result =
    data?.user ||
    data?.account ||
    data?.profile ||
    {
      username:
        username.trim(),
      email:
        email.trim(),
    };

  onSuccess(result);
  onClose();
} catch (err) {
  setError(
    err.message ||
      "Не удалось выполнить авторизацию."
  );

  if (mode === "register") {
    await loadCaptcha();
  }
} finally {
  setLoading(false);
}

};

return (
<div className="fm-modal-backdrop" onMouseDown={onClose} >
<div
className="fm-auth-modal"
onMouseDown={(event) =>
event.stopPropagation()
}
>
<button className="fm-modal-close" type="button" onClick={onClose} >
<Icon name="close" size={25} />
</button>

    <div className="fm-auth-logo">
      F
    </div>

    <div className="fm-eyebrow">
      FENIX MUSIC
    </div>

    <h2>
      {mode === "login"
        ? "С возвращением"
        : "Создать аккаунт"}
    </h2>

    <p className="fm-auth-description">
      {mode === "login"
        ? "Войди, чтобы сохранить музыку и историю."
        : "Создай аккаунт и получи свою музыкальную библиотеку."}
    </p>

    <form onSubmit={submit}>
      <label className="fm-form-field">
        <span>Логин</span>

        <input
          value={username}
          onChange={(event) =>
            setUsername(
              event.target.value
            )
          }
          placeholder="Введите логин"
          autoComplete="username"
          required
        />
      </label>

      {mode === "register" && (
        <label className="fm-form-field">
          <span>Email</span>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
      )}

      <label className="fm-form-field">
        <span>Пароль</span>

        <input
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(
              event.target.value
            )
          }
          placeholder="Введите пароль"
          autoComplete={
            mode === "login"
              ? "current-password"
              : "new-password"
          }
          required
        />
      </label>

      {mode === "register" && (
        <label className="fm-form-field">
          <span>Повтор пароля</span>

          <input
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value
              )
            }
            placeholder="Повторите пароль"
            autoComplete="new-password"
            required
          />
        </label>
      )}

      {mode === "register" && (
        <div className="fm-captcha-area">
          <div className="fm-captcha-head">
            <span>
              CAPTCHA
            </span>

            <button
              type="button"
              onClick={loadCaptcha}
              disabled={captchaLoading}
            >
              <Icon
                name="refresh"
                size={18}
              />
            </button>
          </div>

          <div className="fm-captcha-code">
            {captchaLoading
              ? "••••"
              : captchaCode ||
                "----"}
          </div>

          <input
            value={captchaAnswer}
            onChange={(event) =>
              setCaptchaAnswer(
                event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4)
              )
            }
            inputMode="numeric"
            maxLength={4}
            placeholder="Введите 4 цифры"
            autoComplete="off"
          />
        </div>
      )}

      {error && (
        <div className="fm-auth-error">
          {error}
        </div>
      )}

      <button
        className="fm-button fm-button-primary fm-button-wide"
        disabled={loading}
        type="submit"
      >
        {loading
          ? "Проверяем..."
          : mode === "login"
          ? "Войти"
          : "Создать аккаунт"}
      </button>
    </form>

    <button
      className="fm-auth-switch"
      type="button"
      onClick={() => {
        setError("");

        onModeChange(
          mode === "login"
            ? "register"
            : "login"
        );
      }}
    >
      {mode === "login"
        ? "Нет аккаунта? Регистрация"
        : "Уже есть аккаунт? Войти"}
    </button>
  </div>
</div>

);
}

function TrackMenu({
track,
liked,
onLike,
onPlay,
onClose,
}) {
return (
<div className="fm-modal-backdrop" onMouseDown={onClose} >
<div
className="fm-track-menu"
onMouseDown={(event) =>
event.stopPropagation()
}
>
<div className="fm-menu-track">
<TrackCover track={track} />

      <div>
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </div>
    </div>

    <button
      onClick={() => {
        onPlay(track);
        onClose();
      }}
    >
      <Icon name="play" size={19} />
      Воспроизвести
    </button>

    <button
      onClick={() => {
        onLike(track);
        onClose();
      }}
    >
      <Icon
        name={
          liked
            ? "heartFill"
            : "heart"
        }
        size={19}
      />
      {liked
        ? "Убрать из избранного"
        : "Добавить в избранное"}
    </button>

    <button
      onClick={onClose}
    >
      <Icon name="close" size={19} />
      Закрыть
    </button>
  </div>
</div>

);
}

function QueuePanel({
queue,
currentTrack,
playing,
onPlay,
onClose,
}) {
return (
<div className="fm-modal-backdrop fm-queue-backdrop" onMouseDown={onClose} >
<aside
className="fm-queue-panel"
onMouseDown={(event) =>
event.stopPropagation()
}
>
<div className="fm-panel-header">
<div>
<div className="fm-eyebrow">
PLAY QUEUE
</div>
<h2>Очередь</h2>
</div>

      <button
        className="fm-modal-close"
        onClick={onClose}
      >
        <Icon name="close" size={23} />
      </button>
    </div>

    {queue.length === 0 ? (
      <EmptyState
        icon="queue"
        title="Очередь пуста"
        text="Добавь треки через воспроизведение."
      />
    ) : (
      <div className="fm-queue-list">
        {queue.map((track, index) => (
          <button
            key={`${track.id}-${index}`}
            className={`fm-queue-item ${
              currentTrack?.id ===
              track.id
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              onPlay(track, queue)
            }
          >
            <TrackCover track={track} />

            <div>
              <strong>
                {track.title}
              </strong>
              <span>
                {track.artist}
              </span>
            </div>

            {currentTrack?.id ===
              track.id &&
              playing && (
                <span className="fm-playing-dot">
                  ●
                </span>
              )}
          </button>
        ))}
      </div>
    )}
  </aside>
</div>

);
}

function PlayerBar({
track,
playing,
position,
duration,
volume,
shuffle,
repeat,
onPlayPause,
onNext,
onPrevious,
onSeek,
onVolume,
onShuffle,
onRepeat,
onQueue,
onFullscreen,
}) {
if (!track) {
return null;
}

const progress =
duration > 0
? Math.min(
100,
(position / duration) * 100
)
: 0;

return (
<div className="fm-player">
<div className="fm-player-progress">
<div
className="fm-player-progress-value"
style={{
width: ${progress}%,
}}
/>
</div>

  <div className="fm-player-inner">
    <button
      className="fm-player-track"
      onClick={onFullscreen}
    >
      <TrackCover track={track} />

      <div>
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </div>
    </button>

    <div className="fm-player-center">
      <div className="fm-player-buttons">
        <button
          className={
            shuffle
              ? "is-active"
              : ""
          }
          onClick={onShuffle}
          title="Перемешивание"
        >
          <Icon
            name="shuffle"
            size={19}
          />
        </button>

        <button
          onClick={onPrevious}
          title="Предыдущий"
        >
          <Icon
            name="previous"
            size={19}
          />
        </button>

        <button
          className="fm-player-main-button"
          onClick={onPlayPause}
          title={
            playing
              ? "Пауза"
              : "Воспроизвести"
          }
        >
          <Icon
            name={
              playing
                ? "pause"
                : "play"
            }
            size={22}
          />
        </button>

        <button
          onClick={onNext}
          title="Следующий"
        >
          <Icon
            name="next"
            size={19}
          />
        </button>

        <button
          className={
            repeat !== "off"
              ? "is-active"
              : ""
          }
          onClick={onRepeat}
          title="Повтор"
        >
          <Icon
            name="repeat"
            size={19}
          />
        </button>
      </div>

      <div className="fm-player-time">
        <span>
          {formatTime(position)}
        </span>

        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(
            position,
            duration || 0
          )}
          onChange={(event) =>
            onSeek(
              Number(
                event.target.value
              )
            )
          }
        />

        <span>
          {formatTime(duration)}
        </span>
      </div>
    </div>

    <div className="fm-player-right">
      <button
        onClick={onQueue}
        title="Очередь"
      >
        <Icon
          name="queue"
          size={20}
        />
      </button>

      <Icon
        name={
          volume === 0
            ? "volumeOff"
            : "volume"
        }
        size={18}
      />

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(event) =>
          onVolume(
            Number(
              event.target.value
            )
          )
        }
      />

      <button
        onClick={onFullscreen}
        title="Полный экран"
      >
        ⛶
      </button>
    </div>
  </div>
</div>

);
}

function FullscreenPlayer({
track,
playing,
position,
duration,
volume,
onClose,
onPlayPause,
onNext,
onPrevious,
onSeek,
onVolume,
onShuffle,
onRepeat,
}) {
const progress =
duration > 0
? Math.min(
100,
(position / duration) * 100
)
: 0;

return (
<div className="fm-full-player">
<div className="fm-full-background" />

  <button
    className="fm-full-close"
    onClick={onClose}
  >
    <Icon name="close" size={28} />
  </button>

  <div className="fm-full-content">
    <div className="fm-eyebrow">
      NOW PLAYING
    </div>

    <TrackCover
      track={track}
      large
    />

    <h1>{track.title}</h1>

    <p>{track.artist}</p>

    <div className="fm-full-progress">
      <input
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={Math.min(
          position,
          duration || 0
        )}
        onChange={(event) =>
          onSeek(
            Number(
              event.target.value
            )
          )
        }
        style={{
          "--fm-progress": `${progress}%`,
        }}
      />

      <div>
        <span>
          {formatTime(position)}
        </span>

        <span>
          {formatTime(duration)}
        </span>
      </div>
    </div>

    <div className="fm-full-controls">
      <button onClick={onShuffle}>
        <Icon
          name="shuffle"
          size={22}
        />
      </button>

      <button onClick={onPrevious}>
        <Icon
          name="previous"
          size={24}
        />
      </button>

      <button
        className="fm-full-play"
        onClick={onPlayPause}
      >
        <Icon
          name={
            playing
              ? "pause"
              : "play"
          }
          size={29}
        />
      </button>

      <button onClick={onNext}>
        <Icon
          name="next"
          size={24}
        />
      </button>

      <button onClick={onRepeat}>
        <Icon
          name="repeat"
          size={22}
        />
      </button>
    </div>

    <div className="fm-full-volume">
      <Icon
        name={
          volume === 0
            ? "volumeOff"
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
            Number(
              event.target.value
            )
          )
        }
      />
    </div>
  </div>
</div>

);
}

function HomePage({
tracks,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
onMenu,
onNavigate,
}) {
const popular = useMemo(
() =>
[...tracks]
.sort(
(a, b) =>
b.plays - a.plays
)
.slice(0, 8),
[tracks]
);

const recent = tracks.slice(0, 6);

return (
<div className="fm-page">
<section className="fm-hero">
<div className="fm-hero-copy">
<div className="fm-eyebrow">
FENIX MUSIC
</div>

      <h1>
        Твоя музыка.
        <br />
        Твой ритм.
      </h1>

      <p>
        Слушай любимые треки,
        открывай новое и собирай
        свою музыкальную вселенную.
      </p>

      <div className="fm-hero-actions">
        {tracks[0] && (
          <button
            className="fm-button fm-button-primary"
            onClick={() =>
              onPlay(
                tracks[0],
                tracks
              )
            }
          >
            <Icon
              name="play"
              size={17}
            />
            Слушать сейчас
          </button>
        )}

        <button
          className="fm-button fm-button-secondary"
          onClick={() =>
            onNavigate("search")
          }
        >
          <Icon
            name="search"
            size={18}
          />
          Найти музыку
        </button>
      </div>
    </div>

    <div className="fm-hero-art">
      <div className="fm-hero-orbit">
        <span>♫</span>
        <span>♪</span>
        <span>♬</span>
      </div>

      <div className="fm-hero-logo">
        F
      </div>
    </div>
  </section>

  <section>
    <SectionHeader
      title="Продолжить слушать"
      subtitle="Треки, которые доступны прямо сейчас"
      action={{
        label: "Все треки",
        onClick: () =>
          onNavigate("library"),
      }}
    />

    {recent.length ? (
      <div className="fm-track-grid fm-track-grid-4">
        {recent.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            active={
              currentTrack?.id ===
              track.id
            }
            playing={playing}
            liked={likedIds.has(
              String(track.id)
            )}
            onPlay={() =>
              onPlay(
                track,
                tracks
              )
            }
            onLike={onLike}
            onMenu={onMenu}
          />
        ))}
      </div>
    ) : (
      <EmptyState
        title="Музыки пока нет"
        text="Добавь аудиофайлы в папку music на сервере."
      />
    )}
  </section>

  <section>
    <SectionHeader
      eyebrow="TRENDING"
      title="Популярное"
      subtitle="Самые прослушиваемые треки"
      action={{
        label: "Показать всё",
        onClick: () =>
          onNavigate("popular"),
      }}
    />

    {popular.length ? (
      <div className="fm-track-grid fm-track-grid-4">
        {popular.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            active={
              currentTrack?.id ===
              track.id
            }
            playing={playing}
            liked={likedIds.has(
              String(track.id)
            )}
            onPlay={() =>
              onPlay(
                track,
                popular
              )
            }
            onLike={onLike}
            onMenu={onMenu}
          />
        ))}
      </div>
    ) : (
      <EmptyState
        title="Пока нет популярных треков"
        text="Статистика появится после прослушиваний."
      />
    )}
  </section>

  <section className="fm-feature-grid">
    <button
      className="fm-feature-card fm-feature-card-red"
      onClick={() =>
        onNavigate("popular")
      }
    >
      <Icon
        name="fire"
        size={34}
      />

      <strong>
        Горячие треки
      </strong>

      <span>
        Музыка, которую сейчас
        слушают чаще всего.
      </span>
    </button>

    <button
      className="fm-feature-card"
      onClick={() =>
        onNavigate("library")
      }
    >
      <Icon
        name="library"
        size={34}
      />

      <strong>
        Твоя библиотека
      </strong>

      <span>
        Все доступные композиции
        в одном месте.
      </span>
    </button>

    <button
      className="fm-feature-card"
      onClick={() =>
        onNavigate("favorites")
      }
    >
      <Icon
        name="heartFill"
        size={34}
      />

      <strong>
        Избранное
      </strong>

      <span>
        Сохраняй любимые треки
        одним нажатием.
      </span>
    </button>
  </section>
</div>

);
}

function LibraryPage({
tracks,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
onMenu,
}) {
return (
<div className="fm-page">
<div className="fm-page-title">
<div className="fm-eyebrow">
LIBRARY
</div>

    <h1>
      Музыка
    </h1>

    <p>
      {tracks.length}{" "}
      {tracks.length === 1
        ? "трек"
        : "треков"}{" "}
      доступно для прослушивания.
    </p>
  </div>

  {tracks.length ? (
    <div className="fm-track-list">
      {tracks.map(
        (track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            index={index}
            active={
              currentTrack?.id ===
              track.id
            }
            playing={playing}
            liked={likedIds.has(
              String(track.id)
            )}
            onPlay={onPlay}
            onLike={onLike}
            onMenu={onMenu}
          />
        )
      )}
    </div>
  ) : (
    <EmptyState
      title="Музыка не найдена"
      text="Проверь содержимое папки music на сервере."
    />
  )}
</div>

);
}

function PopularPage({
tracks,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
onMenu,
}) {
const popular = useMemo(
() =>
[...tracks].sort(
(a, b) =>
b.plays - a.plays
),
[tracks]
);

return (
<div className="fm-page">
<div className="fm-page-title">
<div className="fm-eyebrow">
TRENDING
</div>

    <h1>
      Популярное
    </h1>

    <p>
      Треки с максимальным
      количеством прослушиваний.
    </p>
  </div>

  {popular.length ? (
    <div className="fm-track-grid fm-track-grid-4">
      {popular.map((track) => (
        <TrackCard
          key={track.id}
          track={track}
          active={
            currentTrack?.id ===
            track.id
          }
          playing={playing}
          liked={likedIds.has(
            String(track.id)
          )}
          onPlay={() =>
            onPlay(
              track,
              popular
            )
          }
          onLike={onLike}
          onMenu={onMenu}
        />
      ))}
    </div>
  ) : (
    <EmptyState
      title="Популярных треков пока нет"
      text="Начни слушать музыку."
    />
  )}
</div>

);
}

function FavoritesPage({
tracks,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
onMenu,
}) {
const favoriteTracks =
tracks.filter((track) =>
likedIds.has(
String(track.id)
)
);

return (
<div className="fm-page">
<div className="fm-page-title">
<div className="fm-eyebrow">
YOUR MUSIC
</div>

    <h1>
      Избранное
    </h1>

    <p>
      {favoriteTracks.length}{" "}
      сохранённых треков.
    </p>
  </div>

  {favoriteTracks.length ? (
    <div className="fm-track-grid fm-track-grid-4">
      {favoriteTracks.map(
        (track) => (
          <TrackCard
            key={track.id}
            track={track}
            active={
              currentTrack?.id ===
              track.id
            }
            playing={playing}
            liked
            onPlay={() =>
              onPlay(
                track,
                favoriteTracks
              )
            }
            onLike={onLike}
            onMenu={onMenu}
          />
        )
      )}
    </div>
  ) : (
    <EmptyState
      icon="heart"
      title="Избранное пусто"
      text="Нажимай на сердечко у треков, чтобы сохранить их сюда."
    />
  )}
</div>

);
}

function SearchPage({
tracks,
search,
setSearch,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
onMenu,
}) {
const query =
search.trim().toLowerCase();

const results = useMemo(() => {
if (!query) {
return tracks;
}

return tracks.filter(
  (track) =>
    track.title
      .toLowerCase()
      .includes(query) ||
    track.artist
      .toLowerCase()
      .includes(query) ||
    track.album
      .toLowerCase()
      .includes(query)
);

}, [tracks, query]);

return (
<div className="fm-page">
<div className="fm-search-page-head">
<div>
<div className="fm-eyebrow">
DISCOVER
</div>

      <h1>
        Поиск
      </h1>

      <p>
        Найди нужный трек,
        исполнителя или альбом.
      </p>
    </div>

    <div className="fm-search-large">
      <Icon
        name="search"
        size={22}
      />

      <input
        value={search}
        onChange={(event) =>
          setSearch(
            event.target.value
          )
        }
        placeholder="Найти музыку..."
        autoFocus
      />

      {search && (
        <button
          onClick={() =>
            setSearch("")
          }
        >
          <Icon
            name="close"
            size={20}
          />
        </button>
      )}
    </div>
  </div>

  <SectionHeader
    title={
      query
        ? `Результаты для «${search}»`
        : "Вся музыка"
    }
    subtitle={`${results.length} треков`}
  />

  {results.length ? (
    <div className="fm-track-grid fm-track-grid-4">
      {results.map((track) => (
        <TrackCard
          key={track.id}
          track={track}
          active={
            currentTrack?.id ===
            track.id
          }
          playing={playing}
          liked={likedIds.has(
            String(track.id)
          )}
          onPlay={() =>
            onPlay(
              track,
              results
            )
          }
          onLike={onLike}
          onMenu={onMenu}
        />
      ))}
    </div>
  ) : (
    <EmptyState
      icon="search"
      title="Ничего не найдено"
      text="Попробуй изменить запрос."
    />
  )}
</div>

);
}

function HistoryPage({
tracks,
history,
likedIds,
currentTrack,
playing,
onPlay,
onLike,
onMenu,
}) {
const historyTracks = history
.map((id) =>
tracks.find(
(track) =>
String(track.id) ===
String(id)
)
)
.filter(Boolean);

return (
<div className="fm-page">
<div className="fm-page-title">
<div className="fm-eyebrow">
RECENTLY PLAYED
</div>

    <h1>
      История
    </h1>

    <p>
      Треки, которые ты недавно
      слушал.
    </p>
  </div>

  {historyTracks.length ? (
    <div className="fm-track-list">
      {historyTracks.map(
        (track, index) => (
          <TrackRow
            key={`${track.id}-${index}`}
            track={track}
            index={index}
            active={
              currentTrack?.id ===
              track.id
            }
            playing={playing}
            liked={likedIds.has(
              String(track.id)
            )}
            onPlay={onPlay}
            onLike={onLike}
            onMenu={onMenu}
          />
        )
      )}
    </div>
  ) : (
    <EmptyState
      icon="history"
      title="История пуста"
      text="После прослушивания треки появятся здесь."
    />
  )}
</div>

);
}

function ProfilePage({
user,
onLogin,
onLogout,
}) {
if (!user) {
return (
<div className="fm-page">
<div className="fm-profile-guest">
<div className="fm-profile-avatar">
F
</div>

      <div className="fm-eyebrow">
        FENIX ACCOUNT
      </div>

      <h1>
        Твой профиль
      </h1>

      <p>
        Войди в аккаунт, чтобы
        сохранять избранное,
        историю и настройки.
      </p>

      <button
        className="fm-button fm-button-primary"
        onClick={onLogin}
      >
        <Icon
          name="user"
          size={17}
        />
        Войти
      </button>
    </div>
  </div>
);

}

return (
<div className="fm-page">
<div className="fm-profile-card">
<div className="fm-profile-avatar">
{(user.username ||
user.name ||
"F")
.charAt(0)
.toUpperCase()}
</div>

    <div className="fm-profile-info">
      <div className="fm-eyebrow">
        FENIX MEMBER
      </div>

      <h1>
        {user.username ||
          user.name ||
          "Пользователь"}
      </h1>

      {user.email && (
        <p>
          {user.email}
        </p>
      )}

      <span className="fm-profile-status">
        <Icon
          name="check"
          size={14}
        />
        Аккаунт активен
      </span>
    </div>

    <button
      className="fm-button fm-button-secondary"
      onClick={onLogout}
    >
      <Icon
        name="logout"
        size={17}
      />
      Выйти
    </button>
  </div>

  <div className="fm-profile-grid">
    <article>
      <Icon
        name="shield"
        size={27}
      />

      <h3>
        Безопасность
      </h3>

      <p>
        Защита аккаунта и CAPTCHA
        включены.
      </p>
    </article>

    <article>
      <Icon
        name="music"
        size={27}
      />

      <h3>
        Fenix Music
      </h3>

      <p>
        Твоя персональная
        музыкальная библиотека.
      </p>
    </article>

    <article>
      <Icon
        name="star"
        size={27}
      />

      <h3>
        Premium
      </h3>

      <p>
        Дополнительные возможности
        можно добавить позже.
      </p>
    </article>
  </div>
</div>

);
}

function Sidebar({
page,
setPage,
user,
onLogin,
}) {
const items = [
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
id: "library",
label: "Музыка",
icon: "music",
},
{
id: "popular",
label: "Популярное",
icon: "fire",
},
{
id: "favorites",
label: "Избранное",
icon: "heart",
},
{
id: "history",
label: "История",
icon: "history",
},
];

return (
<aside className="fm-sidebar">
<button
className="fm-brand"
onClick={() =>
setPage("home")
}
>
<span className="fm-brand-mark">
F
</span>

    <span>
      <strong>
        FENIX
      </strong>
      <small>
        MUSIC
      </small>
    </span>
  </button>

  <nav className="fm-nav">
    <div className="fm-nav-label">
      MENU
    </div>

    {items.map((item) => (
      <button
        key={item.id}
        className={
          page === item.id
            ? "is-active"
            : ""
        }
        onClick={() =>
          setPage(item.id)
        }
      >
        <Icon
          name={item.icon}
          size={20}
        />

        <span>
          {item.label}
        </span>
      </button>
    ))}
  </nav>

  <div className="fm-sidebar-bottom">
    <button
      className={
        page === "profile"
          ? "is-active"
          : ""
      }
      onClick={() =>
        user
          ? setPage("profile")
          : onLogin()
      }
    >
      <Icon
        name="user"
        size={20}
      />

      <span>
        {user
          ? user.username ||
            user.name ||
            "Профиль"
          : "Войти"}
      </span>
    </button>

    <div className="fm-sidebar-version">
      FENIX MUSIC
      <span>v3.0</span>
    </div>
  </div>
</aside>

);
}

function MobileNav({
page,
setPage,
user,
onLogin,
}) {
const items = [
["home", "home", "Главная"],
["search", "search", "Поиск"],
["library", "music", "Музыка"],
[
"favorites",
"heart",
"Избранное",
],
[
"profile",
"user",
"Профиль",
],
];

return (
<nav className="fm-mobile-nav">
{items.map(
([id, icon, label]) => (
<button
key={id}
className={
page === id
? "is-active"
: ""
}
onClick={() => {
if (
id === "profile" &&
!user
) {
onLogin();
return;
}

          setPage(id);
        }}
      >
        <Icon
          name={icon}
          size={20}
        />

        <span>
          {label}
        </span>
      </button>
    )
  )}
</nav>

);
}

function App() {
const [page, setPage] =
useState("home");

const [tracks, setTracks] =
useState([]);

const [user, setUser] =
useState(null);

const [favorites, setFavorites] =
useState(() => {
try {
return JSON.parse(
localStorage.getItem(
"fenix_music_favorites"
) || "[]"
);
} catch {
return [];
}
});

const [history, setHistory] =
useState(() => {
try {
return JSON.parse(
localStorage.getItem(
"fenix_music_history"
) || "[]"
);
} catch {
return [];
}
});

const [search, setSearch] =
useState("");

const [loading, setLoading] =
useState(true);

const [loadError, setLoadError] =
useState("");

const [authOpen, setAuthOpen] =
useState(false);

const [authMode, setAuthMode] =
useState("login");

const [currentTrack, setCurrentTrack] =
useState(null);

const [queue, setQueue] =
useState([]);

const [playing, setPlaying] =
useState(false);

const [position, setPosition] =
useState(0);

const [duration, setDuration] =
useState(0);

const [volume, setVolume] =
useState(() => {
const saved =
localStorage.getItem(
"fenix_music_volume"
);

  const value =
    Number(saved);

  return Number.isFinite(value)
    ? Math.max(
        0,
        Math.min(1, value)
      )
    : 1;
});

const [shuffle, setShuffle] =
useState(false);

const [repeat, setRepeat] =
useState("off");

const [queueOpen, setQueueOpen] =
useState(false);

const [fullscreen, setFullscreen] =
useState(false);

const [menuTrack, setMenuTrack] =
useState(null);

const audioRef =
useRef(null);

const loadMusic = useCallback(
async () => {
setLoading(true);
setLoadError("");

  try {
    const data =
      await apiFetch(
        "/music"
      );

    const source =
      Array.isArray(data)
        ? data
        : Array.isArray(
            data?.tracks
          )
        ? data.tracks
        : Array.isArray(
            data?.music
          )
        ? data.music
        : [];

    setTracks(
      source.map(
        normalizeTrack
      )
    );
  } catch (error) {
    console.error(
      "Fenix Music:",
      error
    );

    setLoadError(
      error.message ||
        "Не удалось загрузить музыку."
    );
  } finally {
    setLoading(false);
  }
},
[]

);

const loadMe = useCallback(
async () => {
try {
const data =
await apiFetch(
"/auth/me"
);

    if (
      data?.user ||
      data?.account ||
      data?.profile
    ) {
      setUser(
        data.user ||
          data.account ||
          data.profile
      );
    }
  } catch {
    setUser(null);
  }
},
[]

);

useEffect(() => {
loadMusic();
loadMe();
}, [loadMusic, loadMe]);

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
localStorage.setItem(
"fenix_music_volume",
String(volume)
);
}, [volume]);

useEffect(() => {
if (audioRef.current) {
audioRef.current.volume =
volume;
}
}, [volume]);

const likedIds = useMemo(
() =>
new Set(
favorites.map((id) =>
String(id)
)
),
[favorites]
);

const playTrack = useCallback(
(
track,
sourceQueue = tracks
) => {
if (!track?.audio) {
return;
}

  const normalized =
    normalizeTrack(
      track,
      0
    );

  const preparedQueue =
    sourceQueue.length
      ? sourceQueue.map(
          normalizeTrack
        )
      : [normalized];

  setQueue(
    preparedQueue
  );

  setCurrentTrack(
    normalized
  );

  setPosition(0);
  setDuration(
    normalized.duration || 0
  );
  setPlaying(true);

  setHistory((previous) => {
    const id =
      String(normalized.id);

    return [
      id,
      ...previous.filter(
        (item) =>
          String(item) !== id
      ),
    ].slice(0, 50);
  });
},
[tracks]

);

useEffect(() => {
if (!audioRef.current) {
return;
}

const audio =
  audioRef.current;

if (!currentTrack?.audio) {
  audio.pause();
  setPlaying(false);
  return;
}

audio.src =
  currentTrack.audio;

audio.load();

if (playing) {
  const promise =
    audio.play();

  if (
    promise &&
    typeof promise.catch ===
      "function"
  ) {
    promise.catch(
      (error) => {
        console.warn(
          "Audio autoplay:",
          error
        );
        setPlaying(false);
      }
    );
  }
}

}, [currentTrack]);

useEffect(() => {
const audio =
audioRef.current;

if (!audio) {
  return;
}

if (playing) {
  const promise =
    audio.play();

  if (
    promise &&
    typeof promise.catch ===
      "function"
  ) {
    promise.catch(() => {
      setPlaying(false);
    });
  }
} else {
  audio.pause();
}

}, [playing]);

const togglePlaying =
useCallback(() => {
if (!currentTrack) {
if (tracks[0]) {
playTrack(
tracks[0],
tracks
);
}

    return;
  }

  setPlaying(
    (value) => !value
  );
}, [
  currentTrack,
  tracks,
  playTrack,
]);

const nextTrack =
useCallback(() => {
if (!currentTrack) {
return;
}

  const source =
    queue.length
      ? queue
      : tracks;

  if (!source.length) {
    return;
  }

  if (repeat === "one") {
    setPosition(0);
    setPlaying(true);

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }

    return;
  }

  let index =
    source.findIndex(
      (track) =>
        String(track.id) ===
        String(
          currentTrack.id
        )
    );

  let nextIndex;

  if (shuffle) {
    const candidates =
      source
        .map(
          (_, itemIndex) =>
            itemIndex
        )
        .filter(
          (itemIndex) =>
            itemIndex !== index
        );

    nextIndex =
      candidates.length
        ? candidates[
            Math.floor(
              Math.random() *
                candidates.length
            )
          ]
        : 0;
  } else {
    nextIndex =
      index + 1;
  }

  if (
    nextIndex >=
    source.length
  ) {
    if (repeat === "all") {
      nextIndex = 0;
    } else {
      setPlaying(false);
      setPosition(0);
      return;
    }
  }

  playTrack(
    source[nextIndex],
    source
  );
}, [
  currentTrack,
  queue,
  tracks,
  repeat,
  shuffle,
  playTrack,
]);

const previousTrack =
useCallback(() => {
if (
audioRef.current &&
audioRef.current.currentTime >
5
) {
audioRef.current.currentTime = 0;
setPosition(0);
return;
}

  const source =
    queue.length
      ? queue
      : tracks;

  if (!source.length) {
    return;
  }

  const index =
    source.findIndex(
      (track) =>
        String(track.id) ===
        String(
          currentTrack?.id
        )
    );

  const previousIndex =
    index > 0
      ? index - 1
      : source.length - 1;

  playTrack(
    source[previousIndex],
    source
  );
}, [
  queue,
  tracks,
  currentTrack,
  playTrack,
]);

const seek = useCallback(
(value) => {
const audio =
audioRef.current;

  if (!audio) {
    return;
  }

  audio.currentTime =
    Number(value) || 0;

  setPosition(
    Number(value) || 0
  );
},
[]

);

const changeVolume =
useCallback(
(value) => {
const next =
Math.max(
0,
Math.min(
1,
Number(value) || 0
)
);

    setVolume(next);

    if (audioRef.current) {
      audioRef.current.volume =
        next;
    }
  },
  []
);

const toggleFavorite =
useCallback(
(track) => {
if (!track?.id) {
return;
}

    const id =
      String(track.id);

    setFavorites(
      (previous) =>
        previous.some(
          (item) =>
            String(item) === id
        )
          ? previous.filter(
              (item) =>
                String(item) !== id
            )
          : [
              ...previous,
              id,
            ]
    );
  },
  []
);

const handleAuthSuccess =
useCallback(
(nextUser) => {
setUser(nextUser);
setPage("profile");
},
[]
);

const logout =
useCallback(
async () => {
try {
await apiFetch(
"/auth/logout",
{
method: "POST",
}
);
} catch {
} finally {
setUser(null);
setPage("home");
}
},
[]
);

const handleAudioTime =
() => {
const audio =
audioRef.current;

  if (!audio) {
    return;
  }

  setPosition(
    audio.currentTime || 0
  );
};

const handleAudioLoaded =
() => {
const audio =
audioRef.current;

  if (!audio) {
    return;
  }

  const value =
    Number(audio.duration);

  if (
    Number.isFinite(value)
  ) {
    setDuration(value);
  }
};

const handleAudioEnded =
() => {
nextTrack();
};

const renderPage = () => {
if (loading) {
return (
<div className="fm-loading">
<div className="fm-loading-logo">
F
</div>

      <div className="fm-loading-spinner" />

      <strong>
        Загружаем Fenix Music
      </strong>

      <span>
        Подключаем музыкальную библиотеку...
      </span>
    </div>
  );
}

if (loadError) {
  return (
    <div className="fm-page">
      <EmptyState
        icon="refresh"
        title="Не удалось загрузить музыку"
        text={loadError}
        action={{
          label: "Повторить",
          onClick: loadMusic,
        }}
      />
    </div>
  );
}

const common = {
  tracks,
  likedIds,
  currentTrack,
  playing,
  onPlay: playTrack,
  onLike: toggleFavorite,
  onMenu: setMenuTrack,
};

switch (page) {
  case "search":
    return (
      <SearchPage
        {...common}
        search={search}
        setSearch={setSearch}
      />
    );

  case "library":
    return (
      <LibraryPage
        {...common}
      />
    );

  case "popular":
    return (
      <PopularPage
        {...common}
      />
    );

  case "favorites":
    return (
      <FavoritesPage
        {...common}
      />
    );

  case "history":
    return (
      <HistoryPage
        {...common}
        history={history}
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
        onLogout={logout}
      />
    );

  case "home":
  default:
    return (
      <HomePage
        {...common}
        onNavigate={setPage}
      />
    );
}

};

return (
<div className="fm-app">
<audio
ref={audioRef}
preload="metadata"
onTimeUpdate={
handleAudioTime
}
onLoadedMetadata={
handleAudioLoaded
}
onDurationChange={
handleAudioLoaded
}
onEnded={
handleAudioEnded
}
onPlay={() =>
setPlaying(true)
}
onPause={() =>
setPlaying(false)
}
onError={(event) => {
console.error(
"Fenix Music audio:",
event
);
}}
/>

  <Sidebar
    page={page}
    setPage={setPage}
    user={user}
    onLogin={() => {
      setAuthMode("login");
      setAuthOpen(true);
    }}
  />

  <main className="fm-main">
    <header className="fm-topbar">
      <div className="fm-mobile-brand">
        <span>F</span>
        <strong>
          FENIX MUSIC
        </strong>
      </div>

      <div className="fm-top-search">
        <Icon
          name="search"
          size={20}
        />

        <input
          value={search}
          onChange={(event) => {
            setSearch(
              event.target.value
            );

            if (
              event.target.value &&
              page !== "search"
            ) {
              setPage("search");
            }
          }}
          placeholder="Поиск музыки..."
        />

        {search && (
          <button
            onClick={() =>
              setSearch("")
            }
          >
            <Icon
              name="close"
              size={17}
            />
          </button>
        )}
      </div>

      <div className="fm-top-actions">
        <button
          onClick={() =>
            setPage("history")
          }
          title="История"
        >
          <Icon
            name="history"
            size={20}
          />
        </button>

        <button
          onClick={() => {
            if (user) {
              setPage("profile");
            } else {
              setAuthMode(
                "login"
              );
              setAuthOpen(true);
            }
          }}
          className="fm-user-button"
        >
          <span>
            {user
              ? (
                  user.username ||
                  user.name ||
                  "F"
                )
                  .charAt(0)
                  .toUpperCase()
              : "F"}
          </span>
        </button>
      </div>
    </header>

    <div className="fm-content">
      {renderPage()}
    </div>
  </main>

  <MobileNav
    page={page}
    setPage={setPage}
    user={user}
    onLogin={() => {
      setAuthMode("login");
      setAuthOpen(true);
    }}
  />

  <PlayerBar
    track={currentTrack}
    playing={playing}
    position={position}
    duration={duration}
    volume={volume}
    shuffle={shuffle}
    repeat={repeat}
    onPlayPause={togglePlaying}
    onNext={nextTrack}
    onPrevious={previousTrack}
    onSeek={seek}
    onVolume={changeVolume}
    onShuffle={() =>
      setShuffle(
        (value) => !value
      )
    }
    onRepeat={() =>
      setRepeat(
        (value) =>
          value === "off"
            ? "all"
            : value === "all"
            ? "one"
            : "off"
      )
    }
    onQueue={() =>
      setQueueOpen(true)
    }
    onFullscreen={() =>
      setFullscreen(true)
    }
  />

  {authOpen && (
    <AuthModal
      mode={authMode}
      onModeChange={
        setAuthMode
      }
      onClose={() =>
        setAuthOpen(false)
      }
      onSuccess={
        handleAuthSuccess
      }
    />
  )}

  {queueOpen && (
    <QueuePanel
      queue={queue}
      currentTrack={
        currentTrack
      }
      playing={playing}
      onPlay={(
        track,
        source
      ) => {
        playTrack(
          track,
          source || queue
        );
        setQueueOpen(false);
      }}
      onClose={() =>
        setQueueOpen(false)
      }
    />
  )}

  {menuTrack && (
    <TrackMenu
      track={menuTrack}
      liked={likedIds.has(
        String(menuTrack.id)
      )}
      onLike={toggleFavorite}
      onPlay={(
        track
      ) => {
        playTrack(
          track,
          tracks
        );
      }}
      onClose={() =>
        setMenuTrack(null)
      }
    />
  )}

  {fullscreen &&
    currentTrack && (
      <FullscreenPlayer
        track={currentTrack}
        playing={playing}
        position={position}
        duration={duration}
        volume={volume}
        onClose={() =>
          setFullscreen(false)
        }
        onPlayPause={
          togglePlaying
        }
        onNext={nextTrack}
        onPrevious={
          previousTrack
        }
        onSeek={seek}
        onVolume={
          changeVolume
        }
        onShuffle={() =>
          setShuffle(
            (value) => !value
          )
        }
        onRepeat={() =>
          setRepeat(
            (value) =>
              value === "off"
                ? "all"
                : value === "all"
                ? "one"
                : "off"
          )
        }
      />
    )}
</div>

);
}

export default App;
