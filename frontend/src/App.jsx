import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

function apiUrl(path) {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(apiUrl(path), {
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
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Ошибка сервера: ${response.status}`
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
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    home: (
      <>
        <path d="M3 10.8 12 3l9 7.8" />
        <path d="M5 9.8V21h14V9.8" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 5 5" />
      </>
    ),
    heart: (
      <path d="M20.8 8.7c0 5.1-8.8 11.1-8.8 11.1S3.2 13.8 3.2 8.7A5 5 0 0 1 12 5.5a5 5 0 0 1 8.8 3.2Z" />
    ),
    heartFill: (
      <path
        d="M20.8 8.7c0 5.1-8.8 11.1-8.8 11.1S3.2 13.8 3.2 8.7A5 5 0 0 1 12 5.5a5 5 0 0 1 8.8 3.2Z"
        fill="currentColor"
      />
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
        <path d="m5 5 9 7-9 7V5Z" />
        <path d="M19 5v14" />
      </>
    ),
    prev: (
      <>
        <path d="m19 5-9 7 9 7V5Z" />
        <path d="M5 5v14" />
      </>
    ),
    shuffle: (
      <>
        <path d="M3 7h3c4 0 5 10 9 10h6" />
        <path d="m18 14 3 3-3 3" />
        <path d="M3 17h3c1.4 0 2.4-1.3 3.2-2.8" />
        <path d="M14.8 9.8C15.6 8.2 16.5 7 18 7h3" />
        <path d="m18 4 3 3-3 3" />
      </>
    ),
    repeat: (
      <>
        <path d="M17 2.8 20.2 6 17 9.2" />
        <path d="M4 9V7a1 1 0 0 1 1-1h15" />
        <path d="m7 21.2-3.2-3.2L7 14.8" />
        <path d="M20 15v2a1 1 0 0 1-1 1H4" />
      </>
    ),
    volume: (
      <>
        <path d="M4 9v6h4l5 4V5L8 9H4Z" />
        <path d="M17 9.2a4 4 0 0 1 0 5.6" />
        <path d="M19.5 6.5a8 8 0 0 1 0 11" />
      </>
    ),
    volumeMute: (
      <>
        <path d="M4 9v6h4l5 4V5L8 9H4Z" />
        <path d="m18 9 4 6" />
        <path d="m22 9-4 6" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l11-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="16" r="3" />
      </>
    ),
    library: (
      <>
        <path d="M5 4h14v16H5z" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-3.4 3-5.2 7-5.2s6.3 1.8 7 5.2" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 14v5h14v-5" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    fire: (
      <path d="M12.1 22c4.2 0 7.2-2.7 7.2-6.8 0-3.1-1.6-5.3-3.8-7.5.1 2-1.1 3.4-2.4 4.1.2-3.5-1.4-6.4-4.4-8.8.2 3.8-3.2 5.9-3.2 10.2C5.5 18.5 8.1 22 12.1 22Z" />
    ),
    bolt: (
      <path d="m13 2-8 11h6l-1 9 8-12h-6l1-8Z" />
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L4 8" />
        <path d="M4 4v4h4" />
        <path d="M4 13a8 8 0 0 0 14 5l2-2" />
        <path d="M20 20v-4h-4" />
      </>
    ),
    fullscreen: (
      <>
        <path d="M8 3H3v5" />
        <path d="M16 3h5v5" />
        <path d="M21 16v5h-5" />
        <path d="M3 16v5h5" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.music}</svg>;
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function makeLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTrack(item, index = 0) {
  if (!item) return null;

  const fileName =
    item.file_name ||
    item.filename ||
    item.file ||
    item.name ||
    "";

  let audioUrl =
    item.audio_url ||
    item.url ||
    item.src ||
    "";

  if (!audioUrl && fileName) {
    audioUrl = `/api/music/audio/${encodeURIComponent(fileName)}`;
  }

  return {
    id: String(item.id || fileName || `track-${index}`),
    title:
      item.title ||
      item.name ||
      fileName.replace(/\.[^/.]+$/, "") ||
      "Без названия",
    artist:
      item.artist_name ||
      item.artist ||
      "Fenix Music",
    album:
      item.album_name ||
      item.album ||
      "Fenix Music",
    cover:
      item.cover_url ||
      item.cover ||
      "/music-cover.svg",
    audio_url: audioUrl,
    duration: Number(item.duration || 0),
    plays_count: Number(item.plays_count || item.plays || 0),
    file_name: fileName,
    mime: item.mime || "",
    size: Number(item.size || 0),
  };
}

function TrackCover({ track, large = false }) {
  const [failed, setFailed] = useState(false);

  const title = track?.title || "Fenix Music";

  if (!track?.cover || failed) {
    return (
      <div className={`track-cover ${large ? "track-cover-large" : ""}`}>
        <Icon name="music" size={large ? 42 : 26} />
      </div>
    );
  }

  return (
    <img
      className={`track-cover-image ${
        large ? "track-cover-large" : ""
      }`}
      src={apiUrl(track.cover)}
      alt={title}
      onError={() => setFailed(true)}
    />
  );
}

function EmptyState({ icon = "music", title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name={icon} size={34} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
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
  onMenu,
}) {
  return (
    <div className={`track-row ${active ? "active" : ""}`}>
      <button className="track-number" onClick={() => onPlay(track)}>
        {active && playing ? (
          <span className="equalizer">
            <i />
            <i />
            <i />
          </span>
        ) : (
          String(index + 1).padStart(2, "0")
        )}
      </button>

      <button className="track-main" onClick={() => onPlay(track)}>
        <TrackCover track={track} />
        <span className="track-info">
          <strong>{track.title}</strong>
          <small>{track.artist}</small>
        </span>
      </button>

      <span className="track-album">{track.album}</span>

      <span className="track-plays">
        {track.plays_count > 0
          ? `${track.plays_count.toLocaleString("ru-RU")}`
          : "—"}
      </span>

      <span className="track-duration">
        {formatTime(track.duration)}
      </span>

      <button
        className={`icon-button small ${liked ? "liked" : ""}`}
        onClick={() => onLike(track)}
        title="Избранное"
      >
        <Icon name={liked ? "heartFill" : "heart"} size={18} />
      </button>

      <button
        className="icon-button small"
        onClick={() => onMenu(track)}
        title="Ещё"
      >
        <Icon name="more" size={18} />
      </button>
    </div>
  );
}

function Sidebar({ page, setPage, user, onLogin }) {
  const items = [
    ["home", "Главная", "home"],
    ["search", "Поиск", "search"],
    ["library", "Моя музыка", "library"],
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">F</div>
        <div>
          <strong>FENIX</strong>
          <span>MUSIC</span>
        </div>
      </div>

      <nav className="main-nav">
        {items.map(([icon, title, value]) => (
          <button
            key={value}
            className={`nav-item ${page === value ? "active" : ""}`}
            onClick={() => setPage(value)}
          >
            <Icon name={icon} size={21} />
            <span>{title}</span>
          </button>
        ))}
      </nav>

      <div className="nav-title">БИБЛИОТЕКА</div>

      <nav className="main-nav">
        <button
          className={`nav-item ${page === "liked" ? "active" : ""}`}
          onClick={() => setPage("liked")}
        >
          <Icon name="heart" size={21} />
          <span>Избранное</span>
        </button>

        <button
          className={`nav-item ${page === "recent" ? "active" : ""}`}
          onClick={() => setPage("recent")}
        >
          <Icon name="clock" size={21} />
          <span>История</span>
        </button>
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-bottom">
        {user ? (
          <button className="profile-mini" onClick={() => setPage("profile")}>
            <div className="avatar">
              {(user.username ||
                user.first_name ||
                user.name ||
                "F")[0].toUpperCase()}
            </div>
            <div>
              <strong>
                {user.username ||
                  user.first_name ||
                  user.name ||
                  "Пользователь"}
              </strong>
              <span>Профиль</span>
            </div>
          </button>
        ) : (
          <button className="login-sidebar" onClick={onLogin}>
            <Icon name="user" size={20} />
            <span>Войти в аккаунт</span>
          </button>
        )}
      </div>
    </aside>
  );
}

function TopBar({ onSearch, onLogin, user, onProfile }) {
  return (
    <header className="topbar">
      <div className="topbar-search">
        <Icon name="search" size={20} />
        <input
          type="search"
          placeholder="Найти музыку, исполнителя или альбом..."
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <div className="topbar-actions">
        <button className="header-button">
          <Icon name="bolt" size={18} />
          <span>Premium</span>
        </button>

        {user ? (
          <button className="header-profile" onClick={onProfile}>
            <div className="avatar">
              {(user.username ||
                user.first_name ||
                user.name ||
                "F")[0].toUpperCase()}
            </div>
          </button>
        ) : (
          <button className="login-button" onClick={onLogin}>
            Войти
          </button>
        )}
      </div>
    </header>
  );
}

function Hero({ onPlay, track }) {
  return (
    <section className="hero">
      <div className="hero-glow" />
      <div className="hero-content">
        <div className="hero-label">
          <span className="live-dot" />
          FENIX MUSIC
        </div>

        <h1>
          Музыка, которая
          <br />
          <span>движет тобой.</span>
        </h1>

        <p>
          Открывай новые треки, создавай свою коллекцию
          и слушай любимую музыку без границ.
        </p>

        <div className="hero-actions">
          <button
            className="primary-button"
            onClick={() => track && onPlay(track)}
            disabled={!track}
          >
            <Icon name="play" size={18} />
            Слушать сейчас
          </button>

          <button className="secondary-button">
            <Icon name="fire" size={18} />
            Популярное
          </button>
        </div>
      </div>

      <div className="hero-disc">
        <div className="disc-ring disc-ring-one" />
        <div className="disc-ring disc-ring-two" />
        <div className="disc-center">
          <TrackCover track={track} large />
        </div>
      </div>
    </section>
  );
}

function CategoryTabs({ category, setCategory }) {
  const tabs = [
    ["for-you", "Для вас"],
    ["new", "Новинки"],
    ["popular", "Популярное"],
    ["mixes", "Миксы"],
    ["recent", "Недавно слушали"],
  ];

  return (
    <div className="category-tabs">
      {tabs.map(([value, label]) => (
        <button
          key={value}
          className={category === value ? "active" : ""}
          onClick={() => setCategory(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {action && (
        <button className="text-button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function QuickCard({ track, active, playing, onPlay }) {
  return (
    <button
      className={`quick-card ${active ? "active" : ""}`}
      onClick={() => onPlay(track)}
    >
      <TrackCover track={track} />
      <div>
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </div>

      <div className="quick-play">
        <Icon name={active && playing ? "pause" : "play"} size={17} />
      </div>
    </button>
  );
}

function MusicGrid({ tracks, activeId, playing, onPlay, onLike, likedIds }) {
  if (!tracks.length) {
    return (
      <EmptyState
        icon="music"
        title="Музыки пока нет"
        text="Добавь аудиофайлы в папку music на сервере."
      />
    );
  }

  return (
    <div className="music-grid">
      {tracks.map((track) => {
        const liked = likedIds.has(track.id);

        return (
          <article
            className={`music-card ${
              activeId === track.id ? "active" : ""
            }`}
            key={track.id}
          >
            <div className="music-card-cover">
              <TrackCover track={track} large />

              <button
                className="card-play"
                onClick={() => onPlay(track)}
              >
                <Icon
                  name={
                    activeId === track.id && playing
                      ? "pause"
                      : "play"
                  }
                  size={22}
                />
              </button>

              <button
                className={`card-heart ${liked ? "liked" : ""}`}
                onClick={() => onLike(track)}
              >
                <Icon
                  name={liked ? "heartFill" : "heart"}
                  size={18}
                />
              </button>
            </div>

            <div className="music-card-info">
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function LoginModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadCaptcha() {
    setCaptchaLoading(true);
    setError("");

    try {
      const data = await apiFetch("/api/captcha");

      const code = String(
        data?.code ||
          data?.captcha ||
          data?.captcha_code ||
          ""
      ).replace(/\D/g, "");

      setCaptchaId(String(data?.captcha_id || data?.id || ""));
      setCaptchaCode(code);
      setCaptcha("");
    } catch {
      setCaptchaCode("");
      setCaptchaId("");
      setError("Не удалось загрузить CAPTCHA с сервера. Обновите код.");
    } finally {
      setCaptchaLoading(false);
    }
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  async function submit(event) {
    event.preventDefault();

    setError("");

    if (!username.trim()) {
      setError("Введите логин.");
      return;
    }

    if (password.length < 4) {
      setError("Пароль должен содержать минимум 4 символа.");
      return;
    }

    if (captcha.length !== 4) {
      setError("Введите 4 цифры CAPTCHA.");
      return;
    }

    if (captchaCode && captcha !== captchaCode) {
      setError("Неверный код CAPTCHA.");
      loadCaptcha();
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
          captcha_code: captcha,
          captcha_id: captchaId,
        }),
      });

      const user =
        data?.user ||
        data?.profile ||
        (data?.username ? data : null);

      if (user) {
        onSuccess(user);
      } else {
        onSuccess({
          username: username.trim(),
        });
      }

      onClose();
    } catch (err) {
      setError(
        err.message ||
          "Не удалось выполнить операцию."
      );
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="auth-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          type="button"
        >
          <Icon name="close" size={24} />
        </button>

        <div className="auth-logo">F</div>

        <h2>
          {mode === "login"
            ? "С возвращением"
            : "Создать аккаунт"}
        </h2>

        <p className="auth-subtitle">
          {mode === "login"
            ? "Войди, чтобы продолжить слушать музыку."
            : "Создай аккаунт Fenix Music бесплатно."}
        </p>

        <form onSubmit={submit}>
          <label className="form-field">
            <span>Логин</span>
            <input
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              placeholder="Введите логин"
              autoComplete="username"
            />
          </label>

          <label className="form-field">
            <span>Пароль</span>
            <input
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
          </label>

          <div className="captcha-box">
            <div className="captcha-top">
              <span>CAPTCHA</span>

              <button
                type="button"
                className="captcha-refresh"
                onClick={loadCaptcha}
                disabled={captchaLoading}
              >
                <Icon name="refresh" size={17} />
              </button>
            </div>

            <div className="captcha-code">
              {captchaLoading
                ? "----"
                : captchaCode
                  ? captchaCode
                  : "----"}
            </div>

            <input
              className="captcha-input"
              value={captcha}
              onChange={(event) =>
                setCaptcha(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4)
                )
              }
              placeholder="Введите 4 цифры"
              inputMode="numeric"
              maxLength={4}
            />
          </div>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <button
            className="auth-submit"
            disabled={loading || captchaLoading}
            type="submit"
          >
            {loading
              ? "Подождите..."
              : mode === "login"
                ? "Войти"
                : "Зарегистрироваться"}
          </button>
        </form>

        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setMode(
              mode === "login"
                ? "register"
                : "login"
            );
            setError("");
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

function TrackMenu({ track, onClose, onLike, liked }) {
  if (!track) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="track-menu"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="menu-track">
          <TrackCover track={track} />
          <div>
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </div>
        </div>

        <button
          onClick={() => {
            onLike(track);
            onClose();
          }}
        >
          <Icon
            name={liked ? "heartFill" : "heart"}
            size={20}
          />
          {liked
            ? "Убрать из избранного"
            : "Добавить в избранное"}
        </button>

        <button onClick={onClose}>
          <Icon name="plus" size={20} />
          Добавить в очередь
        </button>

        <button onClick={onClose}>
          <Icon name="library" size={20} />
          Добавить в плейлист
        </button>
      </div>
    </div>
  );
}

function Player({
  track,
  playing,
  progress,
  duration,
  volume,
  shuffle,
  repeat,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolume,
  onShuffle,
  onRepeat,
  onFullscreen,
}) {
  if (!track) return null;

  return (
    <div className="player">
      <div className="player-progress">
        <input
          type="range"
          min="0"
          max={Math.max(duration, 1)}
          step="0.1"
          value={Math.min(progress, duration || 0)}
          onChange={(event) =>
            onSeek(Number(event.target.value))
          }
        />
      </div>

      <div className="player-inner">
        <div className="player-track">
          <TrackCover track={track} />
          <div>
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </div>
        </div>

        <div className="player-center">
          <div className="player-controls">
            <button
              className={shuffle ? "control-active" : ""}
              onClick={onShuffle}
              title="Перемешивание"
            >
              <Icon name="shuffle" size={18} />
            </button>

            <button onClick={onPrev}>
              <Icon name="prev" size={21} />
            </button>

            <button
              className="player-play"
              onClick={onPlayPause}
            >
              <Icon
                name={playing ? "pause" : "play"}
                size={21}
              />
            </button>

            <button onClick={onNext}>
              <Icon name="next" size={21} />
            </button>

            <button
              className={repeat ? "control-active" : ""}
              onClick={onRepeat}
              title="Повтор"
            >
              <Icon name="repeat" size={18} />
            </button>
          </div>

          <div className="player-time">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="player-right">
          <div className="volume-control">
            <Icon
              name={volume === 0 ? "volumeMute" : "volume"}
              size={19}
            />

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) =>
                onVolume(Number(event.target.value))
              }
            />
          </div>

          <button onClick={onFullscreen}>
            <Icon name="fullscreen" size={19} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FullscreenPlayer({
  track,
  playing,
  progress,
  duration,
  volume,
  onClose,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolume,
}) {
  if (!track) return null;

  return (
    <div className="fullscreen-player">
      <div className="fullscreen-bg" />

      <button
        className="fullscreen-close"
        onClick={onClose}
      >
        <Icon name="close" size={27} />
      </button>

      <div className="fullscreen-content">
        <div className="fullscreen-cover">
          <TrackCover track={track} large />
        </div>

        <div className="fullscreen-info">
          <span>СЕЙЧАС ИГРАЕТ</span>
          <h1>{track.title}</h1>
          <p>{track.artist}</p>
        </div>

        <div className="fullscreen-progress">
          <input
            type="range"
            min="0"
            max={Math.max(duration, 1)}
            step="0.1"
            value={Math.min(progress, duration || 0)}
            onChange={(event) =>
              onSeek(Number(event.target.value))
            }
          />

          <div>
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="fullscreen-controls">
          <button onClick={onPrev}>
            <Icon name="prev" size={29} />
          </button>

          <button
            className="fullscreen-play"
            onClick={onPlayPause}
          >
            <Icon
              name={playing ? "pause" : "play"}
              size={30}
            />
          </button>

          <button onClick={onNext}>
            <Icon name="next" size={29} />
          </button>
        </div>

        <div className="fullscreen-volume">
          <Icon
            name={volume === 0 ? "volumeMute" : "volume"}
            size={20}
          />

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) =>
              onVolume(Number(event.target.value))
            }
          />
        </div>
      </div>
    </div>
  );
}

function HomePage({
  tracks,
  category,
  setCategory,
  activeId,
  playing,
  onPlay,
  onLike,
  likedIds,
  search,
}) {
  const filtered = useMemo(() => {
    let result = [...tracks];

    if (search.trim()) {
      const q = search.toLowerCase();

      result = result.filter(
        (track) =>
          track.title.toLowerCase().includes(q) ||
          track.artist.toLowerCase().includes(q) ||
          track.album.toLowerCase().includes(q)
      );
    }

    if (category === "new") {
      return result.slice().reverse();
    }

    if (category === "popular") {
      return result
        .slice()
        .sort(
          (a, b) =>
            b.plays_count - a.plays_count
        );
    }

    return result;
  }, [tracks, category, search]);

  const heroTrack = tracks[0] || null;
  const quickTracks = filtered.slice(0, 5);

  return (
    <div className="page">
      {!search && (
        <Hero
          track={heroTrack}
          onPlay={onPlay}
        />
      )}

      <CategoryTabs
        category={category}
        setCategory={setCategory}
      />

      {search ? (
        <section className="content-section">
          <SectionHeader
            title={`Результаты поиска`}
            subtitle={`Найдено: ${filtered.length}`}
          />

          <MusicGrid
            tracks={filtered}
            activeId={activeId}
            playing={playing}
            onPlay={onPlay}
            onLike={onLike}
            likedIds={likedIds}
          />
        </section>
      ) : (
        <>
          <section className="content-section">
            <SectionHeader
              title={
                category === "popular"
                  ? "Популярное сейчас"
                  : category === "new"
                    ? "Свежие релизы"
                    : "Для вас"
              }
              subtitle="Подборка музыки специально для тебя"
            />

            {quickTracks.length ? (
              <div className="quick-grid">
                {quickTracks.map((track) => (
                  <QuickCard
                    key={track.id}
                    track={track}
                    active={
                      activeId === track.id
                    }
                    playing={playing}
                    onPlay={onPlay}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="music"
                title="Музыка не найдена"
                text="Положи аудиофайлы в папку music на сервере."
              />
            )}
          </section>

          <section className="content-section">
            <SectionHeader
              title="Треки"
              subtitle="Вся доступная музыка"
            />

            {filtered.length ? (
              <div className="track-list">
                <div className="track-list-head">
                  <span>#</span>
                  <span>ТРЕК</span>
                  <span>АЛЬБОМ</span>
                  <span>ПРОСЛУШИВАНИЯ</span>
                  <span>ВРЕМЯ</span>
                  <span />
                </div>

                {filtered.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index}
                    active={
                      activeId === track.id
                    }
                    playing={playing}
                    liked={likedIds.has(track.id)}
                    onPlay={onPlay}
                    onLike={onLike}
                    onMenu={() => {}}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="music"
                title="Треков пока нет"
                text="Добавь MP3, WAV, OGG, FLAC или M4A в папку music."
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function LibraryPage({
  tracks,
  likedIds,
  onPlay,
  activeId,
  playing,
  onLike,
}) {
  const liked = tracks.filter((track) =>
    likedIds.has(track.id)
  );

  return (
    <div className="page simple-page">
      <div className="page-title">
        <span>БИБЛИОТЕКА</span>
        <h1>Моя музыка</h1>
        <p>Твоя личная музыкальная коллекция.</p>
      </div>

      <section className="content-section">
        <SectionHeader
          title="Все треки"
          subtitle={`${tracks.length} доступных треков`}
        />

        <MusicGrid
          tracks={tracks}
          activeId={activeId}
          playing={playing}
          onPlay={onPlay}
          onLike={onLike}
          likedIds={likedIds}
        />
      </section>

      <section className="content-section">
        <SectionHeader
          title="Избранное"
          subtitle={`${liked.length} треков`}
        />

        {liked.length ? (
          <MusicGrid
            tracks={liked}
            activeId={activeId}
            playing={playing}
            onPlay={onPlay}
            onLike={onLike}
            likedIds={likedIds}
          />
        ) : (
          <EmptyState
            icon="heart"
            title="Избранное пусто"
            text="Нажми на сердечко возле трека, чтобы добавить его сюда."
          />
        )}
      </section>
    </div>
  );
}

function LikedPage({
  tracks,
  likedIds,
  onPlay,
  activeId,
  playing,
  onLike,
}) {
  const liked = tracks.filter((track) =>
    likedIds.has(track.id)
  );

  return (
    <div className="page simple-page">
      <div className="page-title">
        <span>КОЛЛЕКЦИЯ</span>
        <h1>Избранное</h1>
        <p>Треки, которые ты сохранил.</p>
      </div>

      {liked.length ? (
        <MusicGrid
          tracks={liked}
          activeId={activeId}
          playing={playing}
          onPlay={onPlay}
          onLike={onLike}
          likedIds={likedIds}
        />
      ) : (
        <EmptyState
          icon="heart"
          title="Здесь пока ничего нет"
          text="Добавляй любимые треки в избранное."
        />
      )}
    </div>
  );
}

function RecentPage({
  tracks,
  recentIds,
  onPlay,
  activeId,
  playing,
  onLike,
  likedIds,
}) {
  const recent = recentIds
    .map((id) =>
      tracks.find((track) => track.id === id)
    )
    .filter(Boolean);

  return (
    <div className="page simple-page">
      <div className="page-title">
        <span>ИСТОРИЯ</span>
        <h1>Недавно слушали</h1>
        <p>Треки, которые ты слушал недавно.</p>
      </div>

      {recent.length ? (
        <div className="track-list">
          {recent.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              active={
                activeId === track.id
              }
              playing={playing}
              liked={likedIds.has(track.id)}
              onPlay={onPlay}
              onLike={onLike}
              onMenu={() => {}}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="clock"
          title="История пока пуста"
          text="Начни слушать музыку — здесь появятся последние треки."
        />
      )}
    </div>
  );
}

function SearchPage({
  tracks,
  query,
  onPlay,
  activeId,
  playing,
  onLike,
  likedIds,
}) {
  const q = query.toLowerCase();

  const result = tracks.filter(
    (track) =>
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      track.album.toLowerCase().includes(q)
  );

  return (
    <div className="page simple-page">
      <div className="page-title">
        <span>ПОИСК</span>
        <h1>Результаты</h1>
        <p>
          {query
            ? `По запросу «${query}» найдено ${result.length}`
            : "Начни вводить запрос в строке поиска."}
        </p>
      </div>

      {result.length ? (
        <MusicGrid
          tracks={result}
          activeId={activeId}
          playing={playing}
          onPlay={onPlay}
          onLike={onLike}
          likedIds={likedIds}
        />
      ) : (
        <EmptyState
          icon="search"
          title="Ничего не найдено"
          text="Попробуй изменить поисковый запрос."
        />
      )}
    </div>
  );
}

function ProfilePage({ user, onLogin }) {
  if (!user) {
    return (
      <div className="page simple-page">
        <div className="profile-login">
          <div className="profile-big-avatar">
            <Icon name="user" size={46} />
          </div>
          <h1>Твой профиль</h1>
          <p>
            Войди в аккаунт, чтобы сохранять
            свою коллекцию и историю.
          </p>
          <button
            className="primary-button"
            onClick={onLogin}
          >
            Войти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page simple-page">
      <div className="profile-card">
        <div className="profile-big-avatar">
          {(user.username ||
            user.first_name ||
            user.name ||
            "F")[0].toUpperCase()}
        </div>

        <div>
          <span className="profile-label">
            ПРОФИЛЬ
          </span>
          <h1>
            {user.username ||
              user.first_name ||
              user.name ||
              "Пользователь"}
          </h1>
          {user.id && (
            <p>ID: {user.id}</p>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div>
          <strong>0</strong>
          <span>Плейлистов</span>
        </div>
        <div>
          <strong>0</strong>
          <span>Избранных</span>
        </div>
        <div>
          <strong>0</strong>
          <span>Прослушано</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const audioRef = useRef(null);

  const [page, setPage] = useState("home");
  const [category, setCategory] = useState("for-you");

  const [tracks, setTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [musicError, setMusicError] = useState("");

  const [search, setSearch] = useState("");

  const [currentTrack, setCurrentTrack] =
    useState(null);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(
      "fenix_music_volume"
    );

    return saved !== null
      ? Number(saved)
      : 0.85;
  });

  const [shuffle, setShuffle] =
    useState(false);

  const [repeat, setRepeat] =
    useState(false);

  const [likedIds, setLikedIds] =
    useState(() => {
      try {
        return new Set(
          JSON.parse(
            localStorage.getItem(
              "fenix_music_liked"
            ) || "[]"
          )
        );
      } catch {
        return new Set();
      }
    });

  const [recentIds, setRecentIds] =
    useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            "fenix_music_recent"
          ) || "[]"
        );
      } catch {
        return [];
      }
    });

  const [user, setUser] = useState(null);

  const [authOpen, setAuthOpen] =
    useState(false);

  const [fullscreen, setFullscreen] =
    useState(false);

  const [menuTrack, setMenuTrack] =
    useState(null);

  const activeId = currentTrack?.id || null;

  async function loadMusic() {
    setLoadingTracks(true);
    setMusicError("");

    try {
      const data = await apiFetch("/api/music");

      const source =
        Array.isArray(data)
          ? data
          : data?.tracks ||
            data?.music ||
            data?.items ||
            [];

      const normalized = source
        .map(normalizeTrack)
        .filter(Boolean);

      setTracks(normalized);
    } catch (error) {
      setTracks([]);
      setMusicError(
        error.message ||
          "Не удалось загрузить музыку."
      );
    } finally {
      setLoadingTracks(false);
    }
  }

  async function loadUser() {
    try {
      const data = await apiFetch("/api/auth/me");

      if (data?.user) {
        setUser(data.user);
      } else if (data?.username) {
        setUser(data);
      }
    } catch {
      // Пользователь может быть не авторизован.
    }
  }

  useEffect(() => {
    loadMusic();
    loadUser();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "fenix_music_liked",
      JSON.stringify([...likedIds])
    );
  }, [likedIds]);

  useEffect(() => {
    localStorage.setItem(
      "fenix_music_recent",
      JSON.stringify(recentIds)
    );
  }, [recentIds]);

  useEffect(() => {
    localStorage.setItem(
      "fenix_music_volume",
      String(volume)
    );

    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    function onTimeUpdate() {
      setProgress(audio.currentTime || 0);
    }

    function onLoadedMetadata() {
      setDuration(
        Number(audio.duration) || 0
      );
    }

    function onEnded() {
      if (repeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }

      playNext();
    }

    function onPlay() {
      setPlaying(true);
    }

    function onPause() {
      setPlaying(false);
    }

    function onError() {
      setPlaying(false);
    }

    audio.addEventListener(
      "timeupdate",
      onTimeUpdate
    );

    audio.addEventListener(
      "loadedmetadata",
      onLoadedMetadata
    );

    audio.addEventListener(
      "ended",
      onEnded
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
      "error",
      onError
    );

    return () => {
      audio.removeEventListener(
        "timeupdate",
        onTimeUpdate
      );

      audio.removeEventListener(
        "loadedmetadata",
        onLoadedMetadata
      );

      audio.removeEventListener(
        "ended",
        onEnded
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
        "error",
        onError
      );
    };
  }, [repeat, currentTrack, tracks, shuffle]);

  function rememberTrack(track) {
    setRecentIds((old) => {
      const next = [
        track.id,
        ...old.filter(
          (id) => id !== track.id
        ),
      ];

      return next.slice(0, 30);
    });
  }

  function playTrack(track) {
    if (!track) return;

    const audioUrl = track.audio_url;

    if (!audioUrl) {
      setMusicError(
        "У этого трека отсутствует audio_url."
      );
      return;
    }

    if (
      currentTrack?.id === track.id &&
      audioRef.current
    ) {
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
      return;
    }

    setCurrentTrack(track);
    setProgress(0);
    setDuration(
      Number(track.duration) || 0
    );
    rememberTrack(track);

    setTimeout(() => {
      if (!audioRef.current) return;

      audioRef.current.src =
        apiUrl(audioUrl);

      audioRef.current.volume = volume;

      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          setPlaying(false);
        });
    }, 0);
  }

  function togglePlay() {
    if (!audioRef.current) return;

    if (!currentTrack) {
      if (tracks[0]) {
        playTrack(tracks[0]);
      }

      return;
    }

    if (audioRef.current.paused) {
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  }

  function getNextTrack() {
    if (!tracks.length) return null;

    const currentIndex =
      tracks.findIndex(
        (track) =>
          track.id === currentTrack?.id
      );

    if (shuffle) {
      const available = tracks.filter(
        (track) =>
          track.id !== currentTrack?.id
      );

      if (!available.length) {
        return tracks[0];
      }

      return available[
        Math.floor(
          Math.random() *
            available.length
        )
      ];
    }

    if (currentIndex < 0) {
      return tracks[0];
    }

    return tracks[
      (currentIndex + 1) %
        tracks.length
    ];
  }

  function getPrevTrack() {
    if (!tracks.length) return null;

    const currentIndex =
      tracks.findIndex(
        (track) =>
          track.id === currentTrack?.id
      );

    if (currentIndex <= 0) {
      return tracks[tracks.length - 1];
    }

    return tracks[currentIndex - 1];
  }

  function playNext() {
    const next = getNextTrack();

    if (next) {
      playTrack(next);
    }
  }

  function playPrev() {
    if (
      audioRef.current &&
      audioRef.current.currentTime > 5
    ) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      return;
    }

    const prev = getPrevTrack();

    if (prev) {
      playTrack(prev);
    }
  }

  function seek(value) {
    if (!audioRef.current) return;

    audioRef.current.currentTime = value;
    setProgress(value);
  }

  function changeVolume(value) {
    setVolume(value);

    if (audioRef.current) {
      audioRef.current.volume = value;
    }
  }

  function toggleLike(track) {
    if (!track) return;

    setLikedIds((old) => {
      const next = new Set(old);

      if (next.has(track.id)) {
        next.delete(track.id);
      } else {
        next.add(track.id);
      }

      return next;
    });
  }

  function handleSearch(value) {
    setSearch(value);

    if (value.trim()) {
      setPage("search");
    } else if (page === "search") {
      setPage("home");
    }
  }

  function handleAuthSuccess(nextUser) {
    setUser(nextUser);
  }

  function renderPage() {
    if (page === "home") {
      return (
        <HomePage
          tracks={tracks}
          category={category}
          setCategory={setCategory}
          activeId={activeId}
          playing={playing}
          onPlay={playTrack}
          onLike={toggleLike}
          likedIds={likedIds}
          search=""
        />
      );
    }

    if (page === "search") {
      return (
        <SearchPage
          tracks={tracks}
          query={search}
          onPlay={playTrack}
          activeId={activeId}
          playing={playing}
          onLike={toggleLike}
          likedIds={likedIds}
        />
      );
    }

    if (page === "library") {
      return (
        <LibraryPage
          tracks={tracks}
          likedIds={likedIds}
          onPlay={playTrack}
          activeId={activeId}
          playing={playing}
          onLike={toggleLike}
        />
      );
    }

    if (page === "liked") {
      return (
        <LikedPage
          tracks={tracks}
          likedIds={likedIds}
          onPlay={playTrack}
          activeId={activeId}
          playing={playing}
          onLike={toggleLike}
        />
      );
    }

    if (page === "recent") {
      return (
        <RecentPage
          tracks={tracks}
          recentIds={recentIds}
          onPlay={playTrack}
          activeId={activeId}
          playing={playing}
          onLike={toggleLike}
          likedIds={likedIds}
        />
      );
    }

    if (page === "profile") {
      return (
        <ProfilePage
          user={user}
          onLogin={() => setAuthOpen(true)}
        />
      );
    }

    return (
      <HomePage
        tracks={tracks}
        category={category}
        setCategory={setCategory}
        activeId={activeId}
        playing={playing}
        onPlay={playTrack}
        onLike={toggleLike}
        likedIds={likedIds}
        search=""
      />
    );
  }

  return (
    <div className="fenix-app">
      <audio
        ref={audioRef}
        preload="metadata"
      />

      <div className="mobile-header">
        <div className="brand">
          <div className="brand-logo">F</div>
          <div>
            <strong>FENIX</strong>
            <span>MUSIC</span>
          </div>
        </div>

        <button
          className="icon-button"
          onClick={() =>
            setPage("profile")
          }
        >
          <Icon name="user" size={22} />
        </button>
      </div>

      <Sidebar
        page={page}
        setPage={setPage}
        user={user}
        onLogin={() => setAuthOpen(true)}
      />

      <main className="main">
        <TopBar
          onSearch={handleSearch}
          onLogin={() => setAuthOpen(true)}
          user={user}
          onProfile={() =>
            setPage("profile")
          }
        />

        {musicError && (
          <div className="global-notice">
            <span>{musicError}</span>
            <button onClick={loadMusic}>
              <Icon name="refresh" size={17} />
              Повторить
            </button>
          </div>
        )}

        {loadingTracks ? (
          <div className="loading-screen">
            <div className="loading-logo">F</div>
            <div className="loading-spinner" />
            <p>Загружаем Fenix Music...</p>
          </div>
        ) : (
          renderPage()
        )}
      </main>

      <Player
        track={currentTrack}
        playing={playing}
        progress={progress}
        duration={duration}
        volume={volume}
        shuffle={shuffle}
        repeat={repeat}
        onPlayPause={togglePlay}
        onNext={playNext}
        onPrev={playPrev}
        onSeek={seek}
        onVolume={changeVolume}
        onShuffle={() =>
          setShuffle((value) => !value)
        }
        onRepeat={() =>
          setRepeat((value) => !value)
        }
        onFullscreen={() =>
          setFullscreen(true)
        }
      />

      {authOpen && (
        <LoginModal
          onClose={() => setAuthOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {menuTrack && (
        <TrackMenu
          track={menuTrack}
          liked={likedIds.has(menuTrack.id)}
          onLike={toggleLike}
          onClose={() => setMenuTrack(null)}
        />
      )}

      {fullscreen && currentTrack && (
        <FullscreenPlayer
          track={currentTrack}
          playing={playing}
          progress={progress}
          duration={duration}
          volume={volume}
          onClose={() => setFullscreen(false)}
          onPlayPause={togglePlay}
          onNext={playNext}
          onPrev={playPrev}
          onSeek={seek}
          onVolume={changeVolume}
        />
      )}
    </div>
  );
}

export default App;
