```jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

const API = "/api";
const DEFAULT_COVER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="45%" stop-color="#7f1d1d"/>
          <stop offset="100%" stop-color="#09090b"/>
        </linearGradient>
      </defs>
      <rect width="700" height="700" fill="#09090b"/>
      <rect width="700" height="700" fill="url(#g)" opacity=".92"/>
      <circle cx="350" cy="330" r="150" fill="#09090b" opacity=".82"/>
      <circle cx="350" cy="330" r="52" fill="#ef4444"/>
      <text x="350" y="535"
        text-anchor="middle"
        fill="white"
        font-family="Arial,sans-serif"
        font-size="72"
        font-weight="900">FENIX</text>
      <text x="350" y="590"
        text-anchor="middle"
        fill="#fecaca"
        font-family="Arial,sans-serif"
        font-size="28">MUSIC</text>
    </svg>
  `);

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
    play: (
      <>
        <polygon points="6 3 20 12 6 21 6 3" />
      </>
    ),
    pause: (
      <>
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </>
    ),
    next: (
      <>
        <polygon points="5 4 15 12 5 20 5 4" />
        <line x1="19" y1="5" x2="19" y2="19" />
      </>
    ),
    previous: (
      <>
        <polygon points="19 4 9 12 19 20 19 4" />
        <line x1="5" y1="5" x2="5" y2="19" />
      </>
    ),
    heart: (
      <path d="M20.8 8.7c0 5.1-8.8 10.3-8.8 10.3S3.2 13.8 3.2 8.7A5.1 5.1 0 0 1 12 5.4a5.1 5.1 0 0 1 8.8 3.3Z" />
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <line x1="16.2" y1="16.2" x2="21" y2="21" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 3v18" />
      </>
    ),
    menu: (
      <>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </>
    ),
    close: (
      <>
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="19" y1="5" x2="5" y2="19" />
      </>
    ),
    volume: (
      <>
        <polygon points="4 9 8 9 13 5 13 19 8 15 4 15 4 9" />
        <path d="M16 9.5a4 4 0 0 1 0 5" />
        <path d="M18.5 7a7 7 0 0 1 0 10" />
      </>
    ),
    shuffle: (
      <>
        <path d="M16 3h5v5" />
        <path d="M4 20 21 3" />
        <path d="M21 16v5h-5" />
        <path d="M15 15l6 6" />
        <path d="M4 4l5 5" />
      </>
    ),
    repeat: (
      <>
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </>
    ),
    queue: (
      <>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="14" y2="18" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.5v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.6v-2.5h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h2.5v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v2.5h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.music}</svg>;
}

function formatTime(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function normalizeTrack(track) {
  if (!track) return null;

  let audioUrl = track.audio_url || track.url || "";

  if (track.file_name && !audioUrl) {
    audioUrl =
      "/api/music/audio/" +
      encodeURIComponent(track.file_name);
  }

  return {
    ...track,
    id: track.id ?? track.file_name ?? crypto.randomUUID(),
    title: track.title || track.name || "Без названия",
    artist_name:
      track.artist_name ||
      track.artist ||
      "Fenix Music",
    album_name:
      track.album_name ||
      track.album ||
      "Fenix Music",
    cover_url: track.cover_url || DEFAULT_COVER,
    audio_url: audioUrl,
    duration: Number(track.duration) || 0,
    plays_count: Number(track.plays_count) || 0,
  };
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = {};
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

function TrackCard({
  track,
  active,
  playing,
  favorite,
  onPlay,
  onFavorite,
}) {
  return (
    <div className={`track-card ${active ? "active" : ""}`}>
      <button
        className="track-cover-button"
        onClick={() => onPlay(track)}
        aria-label="Воспроизвести"
      >
        <img
          className="track-cover"
          src={track.cover_url || DEFAULT_COVER}
          alt=""
          onError={(e) => {
            e.currentTarget.src = DEFAULT_COVER;
          }}
        />

        <span className="track-play-overlay">
          <Icon
            name={active && playing ? "pause" : "play"}
            size={25}
          />
        </span>
      </button>

      <div className="track-details">
        <strong>{track.title}</strong>
        <span>{track.artist_name}</span>
        {track.album_name && (
          <small>{track.album_name}</small>
        )}
      </div>

      <div className="track-actions">
        <button
          className={`icon-button ${
            favorite ? "favorite-active" : ""
          }`}
          onClick={() => onFavorite(track)}
          title="Избранное"
        >
          <Icon name="heart" size={19} />
        </button>
      </div>
    </div>
  );
}

function AuthModal({
  mode,
  setMode,
  close,
  onSuccess,
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, setLogin] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaText, setCaptchaText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCaptcha = async () => {
    try {
      const data = await apiFetch(
        `${API}/auth/captcha`
      );

      setCaptchaId(data.id || "");
      setCaptchaText(data.text || data.captcha || "");
    } catch (e) {
      setCaptchaId("");
      setCaptchaText("");
      setError(e.message);
    }
  };

  useEffect(() => {
    if (mode === "register") {
      loadCaptcha();
    }
  }, [mode]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const data = await apiFetch(
          `${API}/auth/register`,
          {
            method: "POST",
            body: JSON.stringify({
              username,
              email,
              password,
              captcha,
              captcha_id: captchaId,
            }),
          }
        );

        onSuccess(data.user);
      } else {
        const data = await apiFetch(
          `${API}/auth/login`,
          {
            method: "POST",
            body: JSON.stringify({
              login,
              password,
            }),
          }
        );

        onSuccess(data.user);
      }

      close();
    } catch (e) {
      setError(e.message);
      if (mode === "register") {
        loadCaptcha();
        setCaptcha("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="auth-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={close}>
          <Icon name="close" />
        </button>

        <div className="auth-logo">
          <span>F</span>
        </div>

        <h2>
          {mode === "login"
            ? "С возвращением"
            : "Создать аккаунт"}
        </h2>

        <p className="auth-subtitle">
          {mode === "login"
            ? "Войди в свою музыкальную вселенную"
            : "Присоединяйся к Fenix Music"}
        </p>

        {error && (
          <div className="error-box">{error}</div>
        )}

        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <label>
                Имя пользователя
                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                  placeholder="fenix_user"
                  autoComplete="username"
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
            </>
          )}

          {mode === "login" && (
            <label>
              Логин или Email
              <input
                value={login}
                onChange={(e) =>
                  setLogin(e.target.value)
                }
                placeholder="Введите логин или email"
                autoComplete="username"
                required
              />
            </label>
          )}

          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Минимум 6 символов"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              required
            />
          </label>

          {mode === "register" && (
            <div className="captcha-wrap">
              <label>
                CAPTCHA
                <div className="captcha-row">
                  <div className="captcha-image">
                    {captchaText || "------"}
                  </div>

                  <button
                    type="button"
                    className="captcha-refresh"
                    onClick={loadCaptcha}
                  >
                    ↻
                  </button>
                </div>

                <input
                  value={captcha}
                  onChange={(e) =>
                    setCaptcha(
                      e.target.value.toUpperCase()
                    )
                  }
                  placeholder="Введите код"
                  required
                />
              </label>
            </div>
          )}

          <button
            className="primary-button auth-submit"
            disabled={loading}
          >
            {loading
              ? "Подождите..."
              : mode === "login"
              ? "Войти"
              : "Создать аккаунт"}
          </button>
        </form>

        <button
          className="switch-auth"
          onClick={() =>
            setMode(
              mode === "login"
                ? "register"
                : "login"
            )
          }
        >
          {mode === "login"
            ? "Нет аккаунта? Зарегистрироваться"
            : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  setPage,
  user,
  onLogin,
  onLogout,
  mobileOpen,
  closeMobile,
}) {
  const item = (key, icon, title) => (
    <button
      className={`nav-item ${
        page === key ? "selected" : ""
      }`}
      onClick={() => {
        setPage(key);
        closeMobile();
      }}
    >
      <Icon name={icon} size={21} />
      <span>{title}</span>
    </button>
  );

  return (
    <aside
      className={`sidebar ${
        mobileOpen ? "mobile-open" : ""
      }`}
    >
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          <b>FENIX</b>
          <span>MUSIC</span>
        </div>
      </div>

      <nav>
        <div className="nav-label">МЕНЮ</div>

        {item("home", "home", "Главная")}
        {item("music", "music", "Музыка")}
        {item("favorites", "heart", "Избранное")}
        {item("history", "repeat", "История")}
        {item("profile", "user", "Профиль")}
      </nav>

      <div className="sidebar-bottom">
        {user ? (
          <div className="sidebar-user">
            <div className="user-avatar">
              {(user.username ||
                user.email ||
                "F")[0].toUpperCase()}
            </div>

            <div className="sidebar-user-info">
              <strong>
                {user.username || "Пользователь"}
              </strong>
              <small>Fenix Music</small>
            </div>

            <button
              className="icon-button"
              onClick={onLogout}
              title="Выйти"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        ) : (
          <button
            className="login-sidebar"
            onClick={onLogin}
          >
            <Icon name="user" size={20} />
            <span>Войти</span>
          </button>
        )}
      </div>
    </aside>
  );
}

function Player({
  track,
  playing,
  position,
  duration,
  volume,
  setVolume,
  togglePlaying,
  nextTrack,
  previousTrack,
  seek,
  openFull,
}) {
  if (!track) {
    return (
      <footer className="player player-empty">
        <div className="empty-player-logo">F</div>
        <span>Выбери трек для воспроизведения</span>
      </footer>
    );
  }

  const progress =
    duration > 0
      ? Math.min(1, Math.max(0, position / duration))
      : 0;

  return (
    <footer className="player">
      <button
        className="player-track"
        onClick={openFull}
      >
        <img
          src={track.cover_url || DEFAULT_COVER}
          alt=""
          onError={(e) => {
            e.currentTarget.src = DEFAULT_COVER;
          }}
        />

        <div>
          <strong>{track.title}</strong>
          <span>{track.artist_name}</span>
        </div>
      </button>

      <div className="player-center">
        <div className="player-controls">
          <button
            className="player-control"
            onClick={previousTrack}
            title="Предыдущий"
          >
            <Icon name="previous" size={19} />
          </button>

          <button
            className="main-play"
            onClick={togglePlaying}
            title={playing ? "Пауза" : "Воспроизвести"}
          >
            <Icon
              name={playing ? "pause" : "play"}
              size={21}
            />
          </button>

          <button
            className="player-control"
            onClick={nextTrack}
            title="Следующий"
          >
            <Icon name="next" size={19} />
          </button>
        </div>

        <div className="progress-line">
          <span>{formatTime(position)}</span>

          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={Math.min(position, duration || 1)}
            onChange={seek}
          />

          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-volume">
        <Icon name="volume" size={18} />

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) =>
            setVolume(Number(e.target.value))
          }
        />
      </div>
    </footer>
  );
}

export default function App() {
  const audioRef = useRef(null);

  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

  const [page, setPage] = useState("home");
  const [search, setSearch] = useState("");

  const [currentTrack, setCurrentTrack] =
    useState(null);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] =
    useState("login");

  const [mobileMenu, setMobileMenu] =
    useState(false);

  const [queueOpen, setQueueOpen] =
    useState(false);

  const [fullPlayer, setFullPlayer] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");

  const favoriteIds = useMemo(
    () =>
      new Set(
        favorites.map((track) => String(track.id))
      ),
    [favorites]
  );

  const loadTracks = async () => {
    try {
      const data = await apiFetch(
        `${API}/music/tracks`
      );

      const result =
        data.tracks ||
        data.data ||
        [];

      setTracks(result.map(normalizeTrack));
      setError("");
    } catch (e) {
      try {
        const data = await apiFetch(
          `${API}/tracks`
        );

        const result =
          data.tracks ||
          data.data ||
          [];

        setTracks(result.map(normalizeTrack));
        setError("");
      } catch (secondError) {
        setError(secondError.message);
      }
    }
  };

  const loadUserData = async () => {
    try {
      const me = await apiFetch(
        `${API}/auth/me`
      );

      setUser(me.user || null);

      if (me.user) {
        try {
          const fav = await apiFetch(
            `${API}/favorites`
          );
          setFavorites(
            (fav.tracks || []).map(normalizeTrack)
          );
        } catch {}

        try {
          const hist = await apiFetch(
            `${API}/history`
          );
          setHistory(
            (hist.tracks || []).map(normalizeTrack)
          );
        } catch {}
      }
    } catch {}
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      await Promise.all([
        loadTracks(),
        loadUserData(),
      ]);

      if (mounted) {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const setVolume = (value) => {
    setVolumeState(value);

    if (audioRef.current) {
      audioRef.current.volume = value;
    }
  };

  const playTrack = async (
    track,
    customQueue = tracks
  ) => {
    if (!track) return;

    const audio = audioRef.current;

    if (!audio) return;

    try {
      if (
        currentTrack &&
        String(currentTrack.id) ===
          String(track.id)
      ) {
        if (playing) {
          audio.pause();
          setPlaying(false);
        } else {
          await audio.play();
          setPlaying(true);
        }

        return;
      }

      setCurrentTrack(track);
      setPosition(0);
      setDuration(
        Number(track.duration) || 0
      );

      const source =
        track.audio_url ||
        (track.file_name
          ? `/api/music/audio/${encodeURIComponent(
              track.file_name
            )}`
          : "");

      if (!source) {
        setError(
          "У этого трека нет аудиофайла."
        );
        return;
      }

      audio.src = source;
      audio.load();

      await audio.play();

      setPlaying(true);

      try {
        await apiFetch(
          `${API}/history`,
          {
            method: "POST",
            body: JSON.stringify({
              track_id: track.id,
            }),
          }
        );

        setHistory((old) => [
          track,
          ...old.filter(
            (item) =>
              String(item.id) !==
              String(track.id)
          ),
        ]);
      } catch {}

      setError("");
    } catch (e) {
      console.error(e);
      setPlaying(false);
      setError(
        "Не удалось воспроизвести трек. Проверь audio-файл."
      );
    }
  };

  const togglePlaying = async () => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) return;

    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        await audio.play();
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    }
  };

  const getQueue = () => {
    if (page === "favorites") {
      return favorites.length
        ? favorites
        : tracks;
    }

    if (page === "history") {
      return history.length
        ? history
        : tracks;
    }

    return filteredTracks.length
      ? filteredTracks
      : tracks;
  };

  const nextTrack = () => {
    const queue = getQueue();

    if (!queue.length) return;

    if (shuffle) {
      const random =
        Math.floor(
          Math.random() * queue.length
        );

      playTrack(queue[random], queue);
      return;
    }

    const index = queue.findIndex(
      (track) =>
        String(track.id) ===
        String(currentTrack?.id)
    );

    const nextIndex =
      index < 0
        ? 0
        : (index + 1) % queue.length;

    playTrack(queue[nextIndex], queue);
  };

  const previousTrack = () => {
    const queue = getQueue();

    if (!queue.length) return;

    const index = queue.findIndex(
      (track) =>
        String(track.id) ===
        String(currentTrack?.id)
    );

    const previousIndex =
      index <= 0
        ? queue.length - 1
        : index - 1;

    playTrack(
      queue[previousIndex],
      queue
    );
  };

  const seek = (event) => {
    const value = Number(
      event.target.value
    );

    if (audioRef.current) {
      audioRef.current.currentTime =
        value;
    }

    setPosition(value);
  };

  const handleEnded = () => {
    if (repeat === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    setPlaying(false);

    if (repeat === "all" || shuffle) {
      nextTrack();
    }
  };

  const toggleFavorite = async (track) => {
    if (!user) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }

    const exists = favoriteIds.has(
      String(track.id)
    );

    try {
      if (exists) {
        await apiFetch(
          `${API}/favorites/${track.id}`,
          {
            method: "DELETE",
          }
        );

        setFavorites((old) =>
          old.filter(
            (item) =>
              String(item.id) !==
              String(track.id)
          )
        );
      } else {
        await apiFetch(
          `${API}/favorites`,
          {
            method: "POST",
            body: JSON.stringify({
              track_id: track.id,
            }),
          }
        );

        setFavorites((old) => [
          track,
          ...old.filter(
            (item) =>
              String(item.id) !==
              String(track.id)
          ),
        ]);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const login = () => {
    setAuthMode("login");
    setAuthOpen(true);
  };

  const register = () => {
    setAuthMode("register");
    setAuthOpen(true);
  };

  const logout = async () => {
    try {
      await apiFetch(
        `${API}/auth/logout`,
        {
          method: "POST",
        }
      );
    } catch {}

    setUser(null);
    setFavorites([]);
    setHistory([]);
    setPage("home");
  };

  const filteredTracks = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) return tracks;

    return tracks.filter((track) =>
      [
        track.title,
        track.artist_name,
        track.album_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [tracks, search]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    const timeUpdate = () =>
      setPosition(audio.currentTime || 0);

    const metadata = () =>
      setDuration(
        audio.duration &&
          Number.isFinite(audio.duration)
          ? audio.duration
          : Number(currentTrack?.duration) || 0
      );

    const ended = handleEnded;

    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);

    audio.addEventListener(
      "timeupdate",
      timeUpdate
    );
    audio.addEventListener(
      "loadedmetadata",
      metadata
    );
    audio.addEventListener(
      "ended",
      ended
    );
    audio.addEventListener("play", play);
    audio.addEventListener("pause", pause);

    return () => {
      audio.removeEventListener(
        "timeupdate",
        timeUpdate
      );
      audio.removeEventListener(
        "loadedmetadata",
        metadata
      );
      audio.removeEventListener(
        "ended",
        ended
      );
      audio.removeEventListener("play", play);
      audio.removeEventListener("pause", pause);
    };
  }, [currentTrack, repeat, shuffle]);

  const pageTitle = {
    home: "Главная",
    music: "Музыка",
    favorites: "Избранное",
    history: "История",
    profile: "Профиль",
  }[page];

  const renderTracks = (
    list,
    emptyText = "Треков пока нет"
  ) => {
    if (!list.length) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            <Icon name="music" size={34} />
          </div>
          <h3>{emptyText}</h3>
          <p>
            Когда здесь появится музыка,
            она будет отображаться в этом разделе.
          </p>
        </div>
      );
    }

    return (
      <div className="tracks-list">
        {list.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            active={
              String(currentTrack?.id) ===
              String(track.id)
            }
            playing={playing}
            favorite={favoriteIds.has(
              String(track.id)
            )}
            onPlay={playTrack}
            onFavorite={toggleFavorite}
          />
        ))}
      </div>
    );
  };

  const renderHome = () => (
    <>
      <section className="hero">
        <div className="hero-glow" />

        <div className="hero-content">
          <span className="eyebrow">
            FENIX MUSIC
          </span>

          <h1>
            Твоя музыка.
            <br />
            <em>Твоя вселенная.</em>
          </h1>

          <p>
            Слушай любимые треки в одном
            месте. Быстро, красиво и без
            лишнего.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => setPage("music")}
            >
              <Icon name="play" size={18} />
              Слушать музыку
            </button>

            {!user && (
              <button
                className="secondary-button"
                onClick={register}
              >
                Создать аккаунт
              </button>
            )}
          </div>
        </div>

        <div className="hero-disc">
          <div className="disc-ring ring-one" />
          <div className="disc-ring ring-two" />
          <div className="disc-core">
            <span>F</span>
          </div>
      </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              MUSIC
            </span>
            <h2>Последние треки</h2>
          </div>

          <button
            className="text-button"
            onClick={() => setPage("music")}
          >
            Все треки →
          </button>
        </div>

        {loading
          ? <Loading />
          : renderTracks(
              tracks.slice(0, 8)
            )}
      </section>
    </>
  );

  const renderMusic = () => (
    <section className="section page-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            LIBRARY
          </span>
          <h2>Вся музыка</h2>
        </div>

        <span className="count-badge">
          {filteredTracks.length} треков
        </span>
      </div>

      {renderTracks(
        filteredTracks,
        "Музыка не найдена"
      )}
    </section>
  );

  const renderFavorites = () => (
    <section className="section page-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            YOUR MUSIC
          </span>
          <h2>Избранное</h2>
        </div>
      </div>

      {!user ? (
        <LoginPrompt onLogin={login} />
      ) : (
        renderTracks(
          favorites,
          "Избранных треков пока нет"
        )
      )}
    </section>
  );

  const renderHistory = () => (
    <section className="section page-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            RECENT
          </span>
          <h2>История</h2>
        </div>
      </div>

      {!user ? (
        <LoginPrompt onLogin={login} />
      ) : (
        renderTracks(
          history,
          "История прослушиваний пуста"
        )
      )}
    </section>
  );

  const renderProfile = () => (
    <section className="section page-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            ACCOUNT
          </span>
          <h2>Профиль</h2>
        </div>
      </div>

      {!user ? (
        <LoginPrompt onLogin={login} />
      ) : (
        <div className="profile-card">
          <div className="profile-avatar">
            {(user.username ||
              user.email ||
              "F")[0].toUpperCase()}
          </div>

          <div className="profile-main">
            <span className="section-kicker">
              FENIX USER
            </span>

            <h3>
              {user.username ||
                "Пользователь"}
            </h3>

            <p>
              {user.email ||
                "Fenix Music account"}
            </p>

            {user.bio && (
              <p className="profile-bio">
                {user.bio}
              </p>
            )}

            <div className="profile-stats">
              <div>
                <strong>
                  {tracks.length}
                </strong>
                <span>Треков</span>
              </div>

              <div>
                <strong>
                  {favorites.length}
                </strong>
                <span>Избранных</span>
              </div>

              <div>
                <strong>
                  {history.length}
                </strong>
                <span>Прослушано</span>
              </div>
            </div>
          </div>

          <button
            className="danger-button"
            onClick={logout}
          >
            <Icon name="logout" size={18} />
            Выйти
          </button>
        </div>
      )}
    </section>
  );

  return (
    <div className="app">
      <audio ref={audioRef} preload="metadata" />

      <Sidebar
        page={page}
        setPage={setPage}
        user={user}
        onLogin={login}
        onLogout={logout}
        mobileOpen={mobileMenu}
        closeMobile={() =>
          setMobileMenu(false)
        }
      />

      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenu(!mobileMenu)
            }
          >
            <Icon
              name={mobileMenu ? "close" : "menu"}
              size={23}
            />
          </button>

          <div className="mobile-title">
            {pageTitle}
          </div>

          <div className="search-box">
            <Icon name="search" size={19} />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Поиск музыки..."
            />

            {search && (
              <button
                className="search-clear"
                onClick={() => setSearch("")}
              >
                ×
              </button>
            )}
          </div>

          <div className="topbar-actions">
            {user ? (
              <button
                className="top-user"
                onClick={() =>
                  setPage("profile")
                }
              >
                <div className="top-avatar">
                  {(user.username ||
                    user.email ||
                    "F")[0].toUpperCase()}
                </div>

                <span>
                  {user.username ||
                    "Профиль"}
                </span>
              </button>
            ) : (
              <>
                <button
                  className="top-login"
                  onClick={login}
                >
                  Войти
                </button>

                <button
                  className="top-register"
                  onClick={register}
                >
                  Регистрация
                </button>
              </>
            )}
          </div>
        </header>

        <div className="content">
          {error && (
            <div className="global-error">
              <span>{error}</span>

              <button
                onClick={() => setError("")}
              >
                ×
              </button>
            </div>
          )}

          {page === "home" &&
            renderHome()}

          {page === "music" &&
            renderMusic()}

          {page === "favorites" &&
            renderFavorites()}

          {page === "history" &&
            renderHistory()}

          {page === "profile" &&
            renderProfile()}
        </div>
      </main>

      {queueOpen && (
        <div className="queue-panel">
          <div className="queue-header">
            <div>
              <span className="section-kicker">
                PLAYER
              </span>
              <h3>Очередь</h3>
            </div>

            <button
              className="icon-button"
              onClick={() =>
                setQueueOpen(false)
              }
            >
              <Icon name="close" />
            </button>
          </div>

          {getQueue().map((track) => (
            <button
              key={track.id}
              className={`queue-item ${
                String(track.id) ===
                String(currentTrack?.id)
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                playTrack(track);
                setQueueOpen(false);
              }}
            >
              <img
                src={
                  track.cover_url ||
                  DEFAULT_COVER
                }
                alt=""
              />

              <div>
                <strong>
                  {track.title}
                </strong>
                <span>
                  {track.artist_name}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Player
        track={currentTrack}
        playing={playing}
        position={position}
        duration={duration}
        volume={volume}
        setVolume={setVolume}
        togglePlaying={togglePlaying}
        nextTrack={nextTrack}
        previousTrack={previousTrack}
        seek={seek}
        openFull={() => setFullPlayer(true)}
      />

      {fullPlayer &&
        currentTrack && (
          <div className="full-player">
            <button
              className="full-player-close"
              onClick={() =>
                setFullPlayer(false)
              }
            >
              <Icon name="close" />
            </button>

            <div className="full-cover">
              <img
                src={
                  currentTrack.cover_url ||
                  DEFAULT_COVER
                }
                alt=""
              />
            </div>

            <span className="section-kicker">
              NOW PLAYING
            </span>

            <h1>
              {currentTrack.title}
            </h1>

            <p>
              {currentTrack.artist_name}
            </p>

            <input
              className="full-range"
              type="range"
              min="0"
              max={duration || 1}
              step="0.1"
              value={Math.min(
                position,
                duration || 1
              )}
              onChange={seek}
            />

            <div className="full-times">
              <span>
                {formatTime(position)}
              </span>
              <span>
                {formatTime(duration)}
              </span>
            </div>

            <div className="full-controls">
              <button
                onClick={previousTrack}
              >
                <Icon
                  name="previous"
                  size={25}
                />
              </button>

              <button
                className="full-play"
                onClick={togglePlaying}
              >
                <Icon
                  name={
                    playing
                      ? "pause"
                      : "play"
                  }
                  size={30}
                />
              </button>

              <button onClick={nextTrack}>
                <Icon
                  name="next"
                  size={25}
                />
              </button>
            </div>

            <div className="full-options">
              <button
                className={
                  shuffle
                    ? "active-option"
                    : ""
                }
                onClick={() =>
                  setShuffle(!shuffle)
                }
              >
                <Icon name="shuffle" />
              </button>

              <button
                className={
                  repeat !== "off"
                    ? "active-option"
                    : ""
                }
                onClick={() =>
                  setRepeat(
                    repeat === "off"
                      ? "all"
                      : repeat === "all"
                      ? "one"
                      : "off"
                  )
                }
              >
                <Icon name="repeat" />
              </button>

              <button
                className={
                  favoriteIds.has(
                    String(
                      currentTrack.id
                    )
                  )
                    ? "active-option"
                    : ""
                }
                onClick={() =>
                  toggleFavorite(
                    currentTrack
                  )
                }
              >
                <Icon name="heart" />
              </button>
            </div>
          </div>
        )}

      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          close={() => setAuthOpen(false)}
          onSuccess={async (newUser) => {
            setUser(newUser);
            await loadUserData();
          }}
        />
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="loading">
      <div className="loader" />
      <span>Загружаем музыку...</span>
    </div>
  );
}

function LoginPrompt({ onLogin }) {
  return (
    <div className="empty-state login-prompt">
      <div className="empty-icon">
        <Icon name="user" size={34} />
      </div>

      <h3>Нужна авторизация</h3>

      <p>
        Войди в аккаунт, чтобы использовать
        этот раздел.
      </p>

      <button
        className="primary-button"
        onClick={onLogin}
      >
        Войти
      </button>
    </div>
  );
}
```
