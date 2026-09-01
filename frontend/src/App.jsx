import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "https://ccmusice.onrender.com";

const apiUrl = (path) => {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
};

async function apiFetch(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
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
      typeof data === "object" && data?.detail
        ? data.detail
        : `Ошибка сервера: ${response.status}`
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
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </>
    ),
    library: (
      <>
        <path d="M4 5h16" />
        <path d="M4 10h16" />
        <path d="M4 15h10" />
        <path d="M4 20h10" />
      </>
    ),
    heart: (
      <path d="M20.8 8.7c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.7Z" />
    ),
    heartFill: (
      <path
        d="M20.8 8.7c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.7Z"
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
        <path d="m5 4 10 8-10 8V4Z" />
        <path d="M19 5v14" />
      </>
    ),
    prev: (
      <>
        <path d="m19 4-10 8 10 8V4Z" />
        <path d="M5 5v14" />
      </>
    ),
    volume: (
      <>
        <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
        <path d="M17 9a4 4 0 0 1 0 6" />
        <path d="M19.5 6.5a8 8 0 0 1 0 11" />
      </>
    ),
    shuffle: (
      <>
        <path d="M3 7h3c5 0 7 10 12 10h3" />
        <path d="m18 14 3 3-3 3" />
        <path d="M3 17h3c1.7 0 3-1 4-2" />
        <path d="M14 9c1-1 2-2 4-2h3" />
        <path d="m18 4 3 3-3 3" />
      </>
    ),
    repeat: (
      <>
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11V9a3 3 0 0 1 3-3h15" />
        <path d="M7 22l-4-4 4-4" />
        <path d="M21 13v2a3 3 0 0 1-3 3H3" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.8v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H5.6v-2.8h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L7 7l2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2.8v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.8h-.2a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-4L4 9" />
        <path d="M4 4v5h5" />
        <path d="M4 13a8 8 0 0 0 14 4l2-2" />
        <path d="M20 20v-5h-5" />
      </>
    ),
    queue: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h10" />
        <path d="M4 18h7" />
        <path d="m17 16 3 2-3 2v-4Z" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.music}</svg>;
}

function Cover({ src, title, size = "medium", gradient = false }) {
  const fallback = useMemo(() => {
    const text = title || "F";
    return text.trim().charAt(0).toUpperCase();
  }, [title]);

  return (
    <div className={`fm-cover fm-cover-${size} ${gradient ? "fm-cover-gradient" : ""}`}>
      {src ? (
        <img
          src={src}
          alt={title || "Обложка"}
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.parentElement.classList.add("fm-cover-fallback");
          }}
        />
      ) : null}
      <span>{fallback}</span>
    </div>
  );
}

function SectionTitle({ title, subtitle, action, onAction }) {
  return (
    <div className="fm-section-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      {action ? (
        <button className="fm-see-all" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

function TrackCard({ track, onPlay, onLike, liked }) {
  const title = track.title || track.name || "Без названия";
  const artist = track.artist || track.author || track.artist_name || "Неизвестный артист";
  const cover = track.cover || track.cover_url || track.image || track.image_url || "";

  return (
    <article className="fm-track-card">
      <button className="fm-track-cover" onClick={() => onPlay(track)} aria-label={`Слушать ${title}`}>
        <Cover src={cover} title={title} size="card" />
        <span className="fm-card-play">
          <Icon name="play" size={22} />
        </span>
      </button>

      <div className="fm-track-info">
        <button className="fm-track-title" onClick={() => onPlay(track)}>
          {title}
        </button>
        <button className="fm-track-artist">{artist}</button>
      </div>

      <button
        className={`fm-card-like ${liked ? "active" : ""}`}
        onClick={() => onLike(track)}
        aria-label="Избранное"
      >
        <Icon name={liked ? "heartFill" : "heart"} size={19} />
      </button>
    </article>
  );
}

function TrackRow({ track, index, onPlay, onLike, liked }) {
  const title = track.title || track.name || "Без названия";
  const artist = track.artist || track.author || track.artist_name || "Неизвестный артист";
  const album = track.album || track.album_name || "Fenix Music";
  const cover = track.cover || track.cover_url || track.image || track.image_url || "";

  return (
    <div className="fm-track-row">
      <div className="fm-row-index">
        <span>{index + 1}</span>
        <button onClick={() => onPlay(track)}>
          <Icon name="play" size={17} />
        </button>
      </div>

      <Cover src={cover} title={title} size="small" />

      <div className="fm-row-main">
        <button className="fm-row-title" onClick={() => onPlay(track)}>
          {title}
        </button>
        <span>{artist}</span>
      </div>

      <div className="fm-row-album">{album}</div>

      <div className="fm-row-duration">{track.duration || "—"}</div>

      <button
        className={`fm-row-like ${liked ? "active" : ""}`}
        onClick={() => onLike(track)}
      >
        <Icon name={liked ? "heartFill" : "heart"} size={18} />
      </button>

      <button className="fm-row-more">
        <Icon name="more" size={21} />
      </button>
    </div>
  );
}

function AuthModal({ mode, setMode, onClose, onSuccess }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [captcha, setCaptcha] = useState(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCaptcha = async () => {
    setError("");
    setCaptchaInput("");

    try {
      const data = await apiFetch("/captcha");
      setCaptcha(data);
    } catch {
      try {
        const data = await apiFetch("/api/captcha");
        setCaptcha(data);
      } catch {
        setCaptcha(null);
        setError("Не удалось загрузить CAPTCHA с сервера. Обновите код.");
      }
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  const submit = async (event) => {
    event.preventDefault();

    if (!login.trim() || !password.trim()) {
      setError("Заполните все обязательные поля.");
      return;
    }

    if (mode === "register" && !name.trim()) {
      setError("Введите имя.");
      return;
    }

    if (!captcha) {
      setError("CAPTCHA ещё не загружена.");
      return;
    }

    if (String(captchaInput).trim() !== String(captcha.code)) {
      setError("Неверный код CAPTCHA.");
      await loadCaptcha();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload =
        mode === "register"
          ? {
              username: login.trim(),
              password,
              name: name.trim(),
              captcha_id: captcha.captcha_id,
              captcha_code: captchaInput.trim(),
            }
          : {
              username: login.trim(),
              password,
              captcha_id: captcha.captcha_id,
              captcha_code: captchaInput.trim(),
            };

      let result;

      if (mode === "register") {
        try {
          result = await apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } catch {
          result = await apiFetch("/api/auth/register", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
      } else {
        try {
          result = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } catch {
          result = await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
      }

      onSuccess(result || { username: login });
      onClose();
    } catch (requestError) {
      setError(requestError.message || "Ошибка авторизации.");
      await loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fm-modal-backdrop" onMouseDown={onClose}>
      <div className="fm-auth-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="fm-modal-close" onClick={onClose}>
          <Icon name="close" size={24} />
        </button>

        <div className="fm-auth-logo">F</div>

        <h2>{mode === "login" ? "С возвращением" : "Создать аккаунт"}</h2>
        <p className="fm-auth-subtitle">
          {mode === "login"
            ? "Войдите в свой Fenix Music"
            : "Создайте профиль и сохраните свою музыку"}
        </p>

        <form onSubmit={submit} className="fm-auth-form">
          {mode === "register" ? (
            <label>
              Имя
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ваше имя"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label>
            Логин
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="Введите логин"
              autoComplete="username"
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введите пароль"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          <div className="fm-captcha-block">
            <div className="fm-captcha-top">
              <span>Введите 4 цифры</span>

              <button type="button" onClick={loadCaptcha} title="Обновить CAPTCHA">
                <Icon name="refresh" size={18} />
              </button>
            </div>

            <div className="fm-captcha-code">
              {captcha?.code ? (
                <strong>{String(captcha.code).padStart(4, "0")}</strong>
              ) : (
                <span>----</span>
              )}
            </div>

            <input
              inputMode="numeric"
              maxLength={4}
              value={captchaInput}
              onChange={(event) =>
                setCaptchaInput(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="____"
              autoComplete="off"
            />
          </div>

          {error ? <div className="fm-auth-error">{error}</div> : null}

          <button className="fm-auth-submit" type="submit" disabled={loading}>
            {loading
              ? "Подождите..."
              : mode === "login"
              ? "Войти"
              : "Зарегистрироваться"}
          </button>
        </form>

        <div className="fm-auth-switch">
          {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}

          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Создать" : "Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Player({ track, playing, onPlayPause, onNext, onPrev, onLike, liked }) {
  const audioRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  const audioUrl =
    track?.audio ||
    track?.audio_url ||
    track?.url ||
    track?.stream_url ||
    "";

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    if (audioUrl) {
      audio.src = audioUrl;
      audio.load();
    }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    audio.volume = volume;

    if (playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playing, volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return undefined;

    const update = () => {
      setProgress(audio.currentTime || 0);
      setDuration(audio.duration || 0);
    };

    const ended = () => {
      onNext();
    };

    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", update);
    audio.addEventListener("ended", ended);

    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("loadedmetadata", update);
      audio.removeEventListener("ended", ended);
    };
  }, [onNext]);

  const seek = (event) => {
    const value = Number(event.target.value);

    if (audioRef.current) {
      audioRef.current.currentTime = value;
    }

    setProgress(value);
  };

  const formatTime = (value) => {
    if (!Number.isFinite(value)) return "0:00";

    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  if (!track) {
    return null;
  }

  const title = track.title || track.name || "Без названия";
  const artist = track.artist || track.author || track.artist_name || "Неизвестный артист";
  const cover = track.cover || track.cover_url || track.image || track.image_url || "";

  return (
    <div className="fm-player">
      <audio ref={audioRef} />

      <div className="fm-player-track">
        <Cover src={cover} title={title} size="player" />

        <div className="fm-player-meta">
          <button>{title}</button>
          <span>{artist}</span>
        </div>

        <button
          className={`fm-player-heart ${liked ? "active" : ""}`}
          onClick={() => onLike(track)}
        >
          <Icon name={liked ? "heartFill" : "heart"} size={20} />
        </button>
      </div>

      <div className="fm-player-controls">
        <button>
          <Icon name="shuffle" size={19} />
        </button>

        <button onClick={onPrev}>
          <Icon name="prev" size={22} />
        </button>

        <button className="fm-main-play" onClick={onPlayPause}>
          <Icon name={playing ? "pause" : "play"} size={21} />
        </button>

        <button onClick={onNext}>
          <Icon name="next" size={22} />
        </button>

        <button>
          <Icon name="repeat" size={19} />
        </button>
      </div>

      <div className="fm-player-progress">
        <span>{formatTime(progress)}</span>

        <input
          type="range"
          min="0"
          max={duration || 0}
          value={progress}
          onChange={seek}
        />

        <span>{formatTime(duration)}</span>
      </div>

      <div className="fm-player-volume">
        <Icon name="volume" size={19} />

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />

        <button>
          <Icon name="queue" size={20} />
        </button>
      </div>
    </div>
  );
}

const demoTracks = [
  {
    id: "demo-1",
    title: "Fenix Night",
    artist: "Fenix Music",
    album: "Fenix Originals",
    duration: "3:42",
  },
  {
    id: "demo-2",
    title: "Neon Dreams",
    artist: "Fenix Music",
    album: "Neon",
    duration: "4:08",
  },
  {
    id: "demo-3",
    title: "After Midnight",
    artist: "Fenix Music",
    album: "Night Drive",
    duration: "3:27",
  },
  {
    id: "demo-4",
    title: "Red Lights",
    artist: "Fenix Music",
    album: "City",
    duration: "2:58",
  },
  {
    id: "demo-5",
    title: "Lost Signal",
    artist: "Fenix Music",
    album: "Signals",
    duration: "4:21",
  },
  {
    id: "demo-6",
    title: "Last Summer",
    artist: "Fenix Music",
    album: "Memories",
    duration: "3:51",
  },
  {
    id: "demo-7",
    title: "No Sleep",
    artist: "Fenix Music",
    album: "After Hours",
    duration: "3:13",
  },
  {
    id: "demo-8",
    title: "Gravity",
    artist: "Fenix Music",
    album: "Universe",
    duration: "4:17",
  },
];

function HomePage({ tracks, onPlay, onLike, likedIds, setPage }) {
  const popular = tracks.slice(0, 6);
  const recent = tracks.slice(2, 8);

  return (
    <>
      <section className="fm-hero">
        <div className="fm-hero-content">
          <span className="fm-eyebrow">FENIX MUSIC</span>
          <h1>Музыка, которая<br />движет тобой.</h1>
          <p>
            Открывай новые треки, создавай свою библиотеку
            и слушай любимую музыку в одном месте.
          </p>

          <div className="fm-hero-actions">
            <button className="fm-primary-button" onClick={() => onPlay(tracks[0])}>
              <Icon name="play" size={18} />
              Начать слушать
            </button>

            <button className="fm-secondary-button" onClick={() => setPage("search")}>
              Найти музыку
            </button>
          </div>
        </div>

        <div className="fm-hero-art">
          <div className="fm-orb fm-orb-one" />
          <div className="fm-orb fm-orb-two" />
          <div className="fm-hero-disc">
            <span>F</span>
          </div>
        </div>
      </section>

      <section className="fm-section">
        <SectionTitle
          title="Популярное"
          subtitle="Треки, которые сейчас слушают"
          action="Показать всё"
          onAction={() => setPage("popular")}
        />

        <div className="fm-card-grid">
          {popular.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onPlay={onPlay}
              onLike={onLike}
              liked={likedIds.has(track.id)}
            />
          ))}
        </div>
      </section>

      <section className="fm-section">
        <SectionTitle
          title="Недавно прослушанное"
          subtitle="Продолжи с того места, где остановился"
        />

        <div className="fm-track-list">
          {recent.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              onPlay={onPlay}
              onLike={onLike}
              liked={likedIds.has(track.id)}
            />
          ))}
        </div>
      </section>

      <section className="fm-section">
        <SectionTitle title="Миксы для тебя" subtitle="Подборки на каждый момент" />

        <div className="fm-mix-grid">
          <button className="fm-mix-card mix-red" onClick={() => onPlay(tracks[0])}>
            <span className="fm-mix-label">FENIX</span>
            <strong>Ночной драйв</strong>
            <small>Для поздних поездок</small>
            <span className="fm-mix-icon">
              <Icon name="play" size={20} />
            </span>
          </button>

          <button className="fm-mix-card mix-purple" onClick={() => onPlay(tracks[2])}>
            <span className="fm-mix-label">VIBES</span>
            <strong>Спокойный вечер</strong>
            <small>Мягкий звук и атмосфера</small>
            <span className="fm-mix-icon">
              <Icon name="play" size={20} />
            </span>
          </button>

          <button className="fm-mix-card mix-blue" onClick={() => onPlay(tracks[4])}>
            <span className="fm-mix-label">ENERGY</span>
            <strong>На максимум</strong>
            <small>Энергия без остановки</small>
            <span className="fm-mix-icon">
              <Icon name="play" size={20} />
            </span>
          </button>
        </div>
      </section>
    </>
  );
}

function SearchPage({ tracks, onPlay, onLike, likedIds }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return tracks;

    return tracks.filter((track) => {
      const text = [
        track.title,
        track.name,
        track.artist,
        track.author,
        track.album,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(value);
    });
  }, [tracks, query]);

  return (
    <section className="fm-page-section">
      <div className="fm-search-page-head">
        <span className="fm-eyebrow">ПОИСК</span>
        <h1>Найди свою музыку</h1>
        <p>Ищи треки, артистов и альбомы.</p>

        <div className="fm-big-search">
          <Icon name="search" size={24} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Что хочешь послушать?"
            autoFocus
          />

          {query ? (
            <button onClick={() => setQuery("")}>
              <Icon name="close" size={20} />
            </button>
          ) : null}
        </div>
      </div>

      <SectionTitle
        title={query ? `Результаты: ${query}` : "Вся музыка"}
        subtitle={`${filtered.length} треков`}
      />

      <div className="fm-track-list">
        {filtered.length ? (
          filtered.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              onPlay={onPlay}
              onLike={onLike}
              liked={likedIds.has(track.id)}
            />
          ))
        ) : (
          <div className="fm-empty">
            <Icon name="search" size={42} />
            <h3>Ничего не найдено</h3>
            <p>Попробуй изменить запрос.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function LibraryPage({ tracks, likedIds, onPlay, onLike }) {
  const likedTracks = tracks.filter((track) => likedIds.has(track.id));

  return (
    <section className="fm-page-section">
      <div className="fm-page-heading">
        <span className="fm-eyebrow">БИБЛИОТЕКА</span>
        <h1>Твоя музыка</h1>
        <p>Всё, что ты сохранил, в одном месте.</p>
      </div>

      <div className="fm-library-tabs">
        <button className="active">Избранное</button>
        <button>Плейлисты</button>
        <button>Альбомы</button>
        <button>Исполнители</button>
      </div>

      {likedTracks.length ? (
        <div className="fm-track-list">
          {likedTracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              onPlay={onPlay}
              onLike={onLike}
              liked
            />
          ))}
        </div>
      ) : (
        <div className="fm-empty fm-library-empty">
          <div className="fm-empty-icon">
            <Icon name="heart" size={34} />
          </div>
          <h3>Здесь пока пусто</h3>
          <p>Добавляй понравившиеся треки в избранное.</p>
          <button className="fm-primary-button" onClick={() => onPlay(tracks[0])}>
            Послушать музыку
          </button>
        </div>
      )}
    </section>
  );
}

function PopularPage({ tracks, onPlay, onLike, likedIds }) {
  return (
    <section className="fm-page-section">
      <div className="fm-page-heading">
        <span className="fm-eyebrow">ТОП</span>
        <h1>Популярное</h1>
        <p>Самые популярные треки Fenix Music.</p>
      </div>

      <div className="fm-ranking">
        {tracks.map((track, index) => (
          <div className="fm-ranking-item" key={track.id}>
            <div className="fm-ranking-number">
              {String(index + 1).padStart(2, "0")}
            </div>

            <Cover
              src={track.cover || track.cover_url || track.image}
              title={track.title}
              size="small"
            />

            <div className="fm-ranking-info">
              <button onClick={() => onPlay(track)}>
                {track.title || track.name}
              </button>
              <span>{track.artist || track.author || "Fenix Music"}</span>
            </div>

            <div className="fm-ranking-actions">
              <button
                className={likedIds.has(track.id) ? "active" : ""}
                onClick={() => onLike(track)}
              >
                <Icon
                  name={likedIds.has(track.id) ? "heartFill" : "heart"}
                  size={19}
                />
              </button>

              <button onClick={() => onPlay(track)}>
                <Icon name="play" size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfilePage({ user, onLogin }) {
  if (!user) {
    return (
      <section className="fm-page-section">
        <div className="fm-profile-login">
          <div className="fm-profile-avatar">
            <Icon name="user" size={42} />
          </div>

          <h1>Твой профиль</h1>
          <p>Войди в аккаунт, чтобы сохранять музыку и настройки.</p>

          <button className="fm-primary-button" onClick={onLogin}>
            Войти в Fenix Music
          </button>
        </div>
      </section>
    );
  }

  const username = user.username || user.login || "Fenix User";
  const displayName = user.name || user.display_name || username;

  return (
    <section className="fm-page-section">
      <div className="fm-profile-card">
        <div className="fm-profile-cover" />

        <div className="fm-profile-content">
          <div className="fm-profile-avatar large">
            {displayName.charAt(0).toUpperCase()}
          </div>

          <div>
            <span className="fm-eyebrow">ПРОФИЛЬ</span>
            <h1>{displayName}</h1>
            <p>@{username}</p>
          </div>

          <button className="fm-outline-button">
            <Icon name="settings" size={18} />
            Настройки
          </button>
        </div>

        <div className="fm-profile-stats">
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
    </section>
  );
}

function App() {
  const [page, setPage] = useState("home");
  const [tracks, setTracks] = useState(demoTracks);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [likedIds, setLikedIds] = useState(new Set());
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    const loadMusic = async () => {
      try {
        const endpoints = [
          "/tracks",
          "/api/tracks",
          "/music",
          "/api/music",
          "/songs",
          "/api/songs",
        ];

        let result = null;

        for (const endpoint of endpoints) {
          try {
            result = await apiFetch(endpoint);
            if (result) break;
          } catch {
            continue;
          }
        }

        if (!active || !result) return;

        const list = Array.isArray(result)
          ? result
          : result.tracks ||
            result.items ||
            result.songs ||
            result.music ||
            [];

        if (Array.isArray(list) && list.length) {
          setTracks(list);
        }
      } catch {
        // Демо-данные остаются, если API музыки пока недоступен.
      } finally {
        if (active) setLoading(false);
      }
    };

    loadMusic();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const savedLikes = localStorage.getItem("fenix_music_likes");

    if (savedLikes) {
      try {
        const parsed = JSON.parse(savedLikes);

        if (Array.isArray(parsed)) {
          setLikedIds(new Set(parsed));
        }
      } catch {
        // ignore
      }
    }

    const savedUser = localStorage.getItem("fenix_music_user");

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "fenix_music_likes",
      JSON.stringify(Array.from(likedIds))
    );
  }, [likedIds]);

  const showNotice = (text) => {
    setNotice(text);

    window.setTimeout(() => {
      setNotice("");
    }, 2600);
  };

  const playTrack = (track) => {
    if (!track) return;

    setCurrentTrack(track);
    setPlaying(true);
  };

  const togglePlay = () => {
    if (!currentTrack && tracks.length) {
      playTrack(tracks[0]);
      return;
    }

    setPlaying((value) => !value);
  };

  const playNext = () => {
    if (!tracks.length) return;

    if (!currentTrack) {
      playTrack(tracks[0]);
      return;
    }

    const currentIndex = tracks.findIndex((track) => track.id === currentTrack.id);
    const nextIndex =
      currentIndex >= 0 ? (currentIndex + 1) % tracks.length : 0;

    playTrack(tracks[nextIndex]);
  };

  const playPrev = () => {
    if (!tracks.length) return;

    if (!currentTrack) {
      playTrack(tracks[0]);
      return;
    }

    const currentIndex = tracks.findIndex((track) => track.id === currentTrack.id);
    const prevIndex =
      currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;

    playTrack(tracks[prevIndex]);
  };

  const toggleLike = (track) => {
    if (!track) return;

    setLikedIds((previous) => {
      const next = new Set(previous);

      if (next.has(track.id)) {
        next.delete(track.id);
        showNotice("Удалено из избранного");
      } else {
        next.add(track.id);
        showNotice("Добавлено в избранное");
      }

      return next;
    });
  };

  const openLogin = () => {
    setAuthMode("login");
    setAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setAuthOpen(true);
  };

  const handleAuthSuccess = (result) => {
    const account =
      result?.user ||
      result?.profile ||
      result || {
        username: "Fenix User",
      };

    setUser(account);
    localStorage.setItem("fenix_music_user", JSON.stringify(account));
    showNotice("Добро пожаловать в Fenix Music");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("fenix_music_user");
    showNotice("Вы вышли из аккаунта");
  };

  const navigation = [
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
      id: "popular",
      label: "Популярное",
      icon: "star",
    },
    {
      id: "library",
      label: "Моя музыка",
      icon: "library",
    },
  ];

  const renderPage = () => {
    if (loading) {
      return (
        <div className="fm-loading-screen">
          <div className="fm-loader">
            <div>F</div>
          </div>
          <p>Загружаем Fenix Music...</p>
        </div>
      );
    }

    switch (page) {
      case "search":
        return (
          <SearchPage
            tracks={tracks}
            onPlay={playTrack}
            onLike={toggleLike}
            likedIds={likedIds}
          />
        );

      case "popular":
        return (
          <PopularPage
            tracks={tracks}
            onPlay={playTrack}
            onLike={toggleLike}
            likedIds={likedIds}
          />
        );

      case "library":
        return (
          <LibraryPage
            tracks={tracks}
            likedIds={likedIds}
            onPlay={playTrack}
            onLike={toggleLike}
          />
        );

      case "profile":
        return (
          <ProfilePage
            user={user}
            onLogin={openLogin}
          />
        );

      default:
        return (
          <HomePage
            tracks={tracks}
            onPlay={playTrack}
            onLike={toggleLike}
            likedIds={likedIds}
            setPage={setPage}
          />
        );
    }
  };

  const handleNavigation = (id) => {
    setPage(id);
    setSidebarOpen(false);
  };

  return (
    <div className="fenix-music-app">
      <aside className={`fm-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="fm-brand">
          <div className="fm-brand-mark">F</div>

          <div className="fm-brand-text">
            <strong>FENIX</strong>
            <span>MUSIC</span>
          </div>
        </div>

        <nav className="fm-nav">
          <span className="fm-nav-label">МЕНЮ</span>

          {navigation.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => handleNavigation(item.id)}
            >
              <Icon name={item.icon} size={21} />
              <span>{item.label}</span>
            </button>
          ))}

          <span className="fm-nav-label second">ТВОЁ</span>

          <button
            className={page === "profile" ? "active" : ""}
            onClick={() => handleNavigation("profile")}
          >
            <Icon name="user" size={21} />
            <span>Профиль</span>
          </button>

          <button onClick={() => showNotice("Раздел настроек скоро будет доступен")}>
            <Icon name="settings" size={21} />
            <span>Настройки</span>
          </button>
        </nav>

        <div className="fm-sidebar-bottom">
          {user ? (
            <button className="fm-sidebar-user" onClick={() => setPage("profile")}>
              <div className="fm-mini-avatar">
                {(user.name || user.username || "F").charAt(0).toUpperCase()}
              </div>

              <div>
                <strong>{user.name || user.username || "Fenix User"}</strong>
                <span>Мой профиль</span>
              </div>
            </button>
          ) : (
            <div className="fm-login-promo">
              <strong>Сохраняй музыку</strong>
              <span>Войди, чтобы пользоваться библиотекой.</span>

              <button onClick={openLogin}>Войти</button>
            </div>
          )}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          className="fm-mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Закрыть меню"
        />
      ) : null}

      <main className="fm-main">
        <header className="fm-header">
          <button className="fm-mobile-menu" onClick={() => setSidebarOpen(true)}>
            <Icon name="music" size={24} />
          </button>

          <button
            className="fm-header-search"
            onClick={() => setPage("search")}
          >
            <Icon name="search" size={20} />
            <span>Что хочешь послушать?</span>
            <kbd>⌘ K</kbd>
          </button>

          <div className="fm-header-actions">
            <button
              className="fm-header-icon"
              onClick={() => showNotice("Уведомления пока пусты")}
            >
              <Icon name="music" size={20} />
            </button>

            {user ? (
              <button className="fm-header-profile" onClick={() => setPage("profile")}>
                <div className="fm-mini-avatar">
                  {(user.name || user.username || "F").charAt(0).toUpperCase()}
                </div>

                <span>{user.name || user.username || "Профиль"}</span>
              </button>
            ) : (
              <div className="fm-header-auth">
                <button onClick={openLogin}>Войти</button>
                <button className="fm-header-register" onClick={openRegister}>
                  Регистрация
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="fm-content">{renderPage()}</div>
      </main>

      {currentTrack ? (
        <Player
          track={currentTrack}
          playing={playing}
          onPlayPause={togglePlay}
          onNext={playNext}
          onPrev={playPrev}
          onLike={toggleLike}
          liked={likedIds.has(currentTrack.id)}
        />
      ) : null}

      {notice ? (
        <div className="fm-toast">
          <span className="fm-toast-dot" />
          {notice}
        </div>
      ) : null}

      {authOpen ? (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          onClose={() => setAuthOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      ) : null}

      {user ? (
        <button className="fm-logout-hidden" onClick={logout} aria-label="Выйти" />
      ) : null}
    </div>
  );
}

export default App;
