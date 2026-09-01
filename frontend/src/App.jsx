import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "";

function apiUrl(endpoint) {
  return `${API_BASE}${endpoint}`;
}

async function api(endpoint, options = {}) {
  const response = await fetch(apiUrl(endpoint), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.error
        ? data.error
        : "Ошибка запроса";

    throw new Error(message);
  }

  return data;
}

function formatTime(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getTrackId(track) {
  return String(track?.id ?? track?.file_name ?? track?.title ?? "");
}

function getAudioUrl(track) {
  if (!track) {
    return "";
  }

  if (track.audio_url) {
    if (
      track.audio_url.startsWith("http://") ||
      track.audio_url.startsWith("https://") ||
      track.audio_url.startsWith("/")
    ) {
      return track.audio_url;
    }

    return apiUrl(track.audio_url);
  }

  if (track.file_name) {
    return apiUrl(
      `/api/music/audio/${encodeURIComponent(track.file_name)}`
    );
  }

  return "";
}

function getCover(track) {
  return (
    track?.cover_url ||
    "/music-cover.svg"
  );
}

function normalizeTracks(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.tracks)) {
    return data.tracks;
  }

  return [];
}

function TrackCard({ track, active, liked, onPlay, onLike }) {
  return (
    <div className={`track-card ${active ? "active" : ""}`}>
      <button
        className="track-cover-button"
        onClick={() => onPlay(track)}
        type="button"
      >
        <img
          className="track-cover"
          src={getCover(track)}
          alt={track?.title || "Track"}
          onError={(event) => {
            event.currentTarget.src = "/music-cover.svg";
          }}
        />

        <span className="track-play">
          {active ? "❚❚" : "▶"}
        </span>
      </button>

      <div className="track-info">
        <strong>{track?.title || "Без названия"}</strong>
        <span>
          {track?.artist_name || "Fenix Music"}
        </span>
      </div>

      <button
        className={`like-button ${liked ? "liked" : ""}`}
        onClick={() => onLike(track)}
        type="button"
        aria-label="Избранное"
      >
        {liked ? "♥" : "♡"}
      </button>
    </div>
  );
}

function Sidebar({ page, setPage, user, onLogin }) {
  const items = [
    ["home", "⌂", "Главная"],
    ["discover", "◉", "Рекомендации"],
    ["library", "♫", "Моя музыка"],
    ["favorites", "♥", "Избранное"],
    ["history", "◷", "История"],
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">F</div>

        <div>
          <div className="brand-name">
            FENIX
          </div>
          <div className="brand-subtitle">
            MUSIC
          </div>
        </div>
      </div>

      <nav className="side-nav">
        {items.map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            className={page === id ? "nav-item selected" : "nav-item"}
            onClick={() => setPage(id)}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {user ? (
          <button
            type="button"
            className="profile-mini"
            onClick={() => setPage("profile")}
          >
            <div className="avatar">
              {(user.username || "U")
                .slice(0, 1)
                .toUpperCase()}
            </div>

            <div>
              <strong>{user.username}</strong>
              <span>Профиль</span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            className="login-sidebar"
            onClick={onLogin}
          >
            Войти в аккаунт
          </button>
        )}
      </div>
    </aside>
  );
}

function BottomNav({ page, setPage }) {
  return (
    <nav className="bottom-nav">
      <button
        type="button"
        className={page === "home" ? "active" : ""}
        onClick={() => setPage("home")}
      >
        <span>⌂</span>
        <small>Главная</small>
      </button>

      <button
        type="button"
        className={page === "discover" ? "active" : ""}
        onClick={() => setPage("discover")}
      >
        <span>◉</span>
        <small>Для вас</small>
      </button>

      <button
        type="button"
        className={page === "library" ? "active" : ""}
        onClick={() => setPage("library")}
      >
        <span>♫</span>
        <small>Библиотека</small>
      </button>

      <button
        type="button"
        className={page === "profile" ? "active" : ""}
        onClick={() => setPage("profile")}
      >
        <span>●</span>
        <small>Профиль</small>
      </button>
    </nav>
  );
}

function AuthModal({
  open,
  mode,
  setMode,
  onClose,
  onSuccess,
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, setLogin] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaText, setCaptchaText] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadCaptcha() {
    setCaptchaLoading(true);
    setError("");

    try {
      const data = await api("/api/auth/captcha");

      setCaptchaId(data.id || "");
      setCaptchaText(data.text || "");
      setCaptchaAnswer("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCaptchaLoading(false);
    }
  }

  useEffect(() => {
    if (open && mode === "register") {
      loadCaptcha();
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) {
      setError("");
      setPassword("");
      setCaptchaAnswer("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        const data = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username,
            email,
            password,
            captcha: captchaAnswer,
            captcha_id: captchaId,
          }),
        });

        onSuccess(data.user);
      } else {
        const data = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            login,
            password,
          }),
        });

        onSuccess(data.user);
      }
    } catch (err) {
      setError(err.message);
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
          type="button"
          className="modal-close"
          onClick={onClose}
        >
          ×
        </button>

        <div className="auth-logo">F</div>

        <h2>
          {mode === "login"
            ? "С возвращением"
            : "Создать аккаунт"}
        </h2>

        <p className="modal-description">
          {mode === "login"
            ? "Войдите в Fenix Music"
            : "Создайте свой музыкальный профиль"}
        </p>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <label>
                Username
                <input
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Ваш username"
                  autoComplete="username"
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
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
              Логин или email
              <input
                value={login}
                onChange={(event) =>
                  setLogin(event.target.value)
                }
                placeholder="Username или email"
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
              onChange={(event) =>
                setPassword(event.target.value)
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
            <div className="captcha-block">
              <div className="captcha-header">
                <span>CAPTCHA</span>

                <button
                  type="button"
                  onClick={loadCaptcha}
                  disabled={captchaLoading}
                >
                  ↻
                </button>
              </div>

              <div className="captcha-code">
                {captchaLoading
                  ? "..."
                  : captchaText || "ERROR"}
              </div>

              <input
                value={captchaAnswer}
                onChange={(event) =>
                  setCaptchaAnswer(event.target.value)
                }
                placeholder="Введите код"
                required
              />
            </div>
          )}

          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Загрузка..."
              : mode === "login"
              ? "Войти"
              : "Создать аккаунт"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <>
              Нет аккаунта?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Регистрация
              </button>
            </>
          ) : (
            <>
              Уже есть аккаунт?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Войти
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Player({
  track,
  playing,
  setPlaying,
  onNext,
  onPrevious,
  onLike,
  liked,
}) {
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    Number(track?.duration) || 0
  );
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (!track) {
      return;
    }

    setCurrentTime(0);
    setDuration(Number(track.duration) || 0);

    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.src = getAudioUrl(track);
    audio.load();

    if (playing) {
      audio
        .play()
        .catch(() => {
          setPlaying(false);
        });
    }
  }, [track]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (playing) {
      audio.play().catch(() => {
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [playing]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  if (!track) {
    return (
      <div className="player empty-player">
        <div className="empty-player-text">
          Выберите трек для воспроизведения
        </div>
      </div>
    );
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setCurrentTime(audio.currentTime);
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (Number.isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  }

  function seek(event) {
    const value = Number(event.target.value);
    setCurrentTime(value);

    if (audioRef.current) {
      audioRef.current.currentTime = value;
    }
  }

  function ended() {
    setPlaying(false);
    onNext();
  }

  return (
    <div className="player">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={ended}
        onError={() => setPlaying(false)}
        preload="metadata"
      />

      <img
        className="player-cover"
        src={getCover(track)}
        alt={track.title || "Track"}
        onError={(event) => {
          event.currentTarget.src = "/music-cover.svg";
        }}
      />

      <div className="player-track">
        <strong>{track.title}</strong>
        <span>
          {track.artist_name || "Fenix Music"}
        </span>
      </div>

      <button
        type="button"
        className={`player-like ${liked ? "liked" : ""}`}
        onClick={() => onLike(track)}
      >
        {liked ? "♥" : "♡"}
      </button>

      <div className="player-controls">
        <button type="button" onClick={onPrevious}>
          |◀
        </button>

        <button
          type="button"
          className="play-button"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        <button type="button" onClick={onNext}>
          ▶|
        </button>
      </div>

      <div className="progress-area">
        <span>{formatTime(currentTime)}</span>

        <input
          className="progress"
          type="range"
          min="0"
          max={duration || 1}
          step="0.1"
          value={Math.min(currentTime, duration || 1)}
          onChange={seek}
        />

        <span>{formatTime(duration)}</span>
      </div>

      <div className="volume">
        <span>🔊</span>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) =>
            setVolume(Number(event.target.value))
          }
        />
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [search, setSearch] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTracks() {
    try {
      const data = await api("/api/music");
      setTracks(normalizeTracks(data));
    } catch (err) {
      try {
        const data = await api("/api/tracks");
        setTracks(normalizeTracks(data));
      } catch (secondError) {
        setError(secondError.message);
      }
    }
  }

  async function loadUser() {
    try {
      const data = await api("/api/auth/me");
      setUser(data.user || null);
    } catch {
      setUser(null);
    }
  }

  async function loadFavorites() {
    if (!user) {
      setFavorites([]);
      return;
    }

    try {
      const data = await api("/api/favorites");
      setFavorites(normalizeTracks(data));
    } catch {
      setFavorites([]);
    }
  }

  async function loadHistory() {
    if (!user) {
      setHistory([]);
      return;
    }

    try {
      const data = await api("/api/history");
      setHistory(normalizeTracks(data));
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([
        loadTracks(),
        loadUser(),
      ]);
      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    loadFavorites();
    loadHistory();
  }, [user]);

  const favoriteIds = useMemo(
    () =>
      new Set(
        favorites.map((track) =>
          getTrackId(track)
        )
      ),
    [favorites]
  );

  const filteredTracks = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return tracks;
    }

    return tracks.filter((track) => {
      const title = String(
        track?.title || ""
      ).toLowerCase();

      const artist = String(
        track?.artist_name || ""
      ).toLowerCase();

      const album = String(
        track?.album_name || ""
      ).toLowerCase();

      return (
        title.includes(value) ||
        artist.includes(value) ||
        album.includes(value)
      );
    });
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

  const recentTracks = history.length
    ? history
    : tracks.slice(0, 8);

  async function playTrack(track) {
    setCurrentTrack(track);
    setPlaying(true);

    try {
      await api(
        `/api/tracks/${encodeURIComponent(
          track.id
        )}/play`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );
    } catch {
      // Игнорируем ошибку счётчика.
    }

    if (user) {
      try {
        await api("/api/history", {
          method: "POST",
          body: JSON.stringify({
            track_id: track.id,
          }),
        });

        loadHistory();
      } catch {
        // История необязательна для запуска плеера.
      }
    }
  }

  function nextTrack() {
    if (!currentTrack || !tracks.length) {
      return;
    }

    const index = tracks.findIndex(
      (track) =>
        getTrackId(track) ===
        getTrackId(currentTrack)
    );

    const next =
      tracks[(index + 1) % tracks.length];

    if (next) {
      playTrack(next);
    }
  }

  function previousTrack() {
    if (!currentTrack || !tracks.length) {
      return;
    }

    const index = tracks.findIndex(
      (track) =>
        getTrackId(track) ===
        getTrackId(currentTrack)
    );

    const previous =
      tracks[
        (index - 1 + tracks.length) %
          tracks.length
      ];

    if (previous) {
      playTrack(previous);
    }
  }

  async function toggleFavorite(track) {
    if (!user) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }

    const id = getTrackId(track);
    const isLiked = favoriteIds.has(id);

    try {
      if (isLiked) {
        await api(
          `/api/favorites/${encodeURIComponent(
            track.id
          )}`,
          {
            method: "DELETE",
          }
        );
      } else {
        await api("/api/favorites", {
          method: "POST",
          body: JSON.stringify({
            track_id: track.id,
          }),
        });
      }

      await loadFavorites();
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setUser(null);
      setFavorites([]);
      setHistory([]);
      setPage("home");
    }
  }

  function openLogin() {
    setAuthMode("login");
    setAuthOpen(true);
  }

  function openRegister() {
    setAuthMode("register");
    setAuthOpen(true);
  }

  function authSuccess(nextUser) {
    setUser(nextUser);
    setAuthOpen(false);
    setPage("profile");
  }

  function renderTrackGrid(list, emptyText) {
    if (!list.length) {
      return (
        <div className="empty-state">
          <div className="empty-icon">♫</div>
          <h3>{emptyText}</h3>
          <p>
            Когда музыка появится, она будет
            отображаться здесь.
          </p>
        </div>
      );
    }

    return (
      <div className="track-grid">
        {list.map((track, index) => (
          <TrackCard
            key={`${getTrackId(track)}-${index}`}
            track={track}
            active={
              getTrackId(currentTrack) ===
                getTrackId(track) &&
              playing
            }
            liked={favoriteIds.has(
              getTrackId(track)
            )}
            onPlay={playTrack}
            onLike={toggleFavorite}
          />
        ))}
      </div>
    );
  }

  function renderHome() {
    return (
      <>
        <section className="hero">
          <div className="hero-content">
            <span className="hero-label">
              FENIX MUSIC
            </span>

            <h1>
              Твоя музыка.
              <br />
              Твоя вселенная.
            </h1>

            <p>
              Слушай любимые треки, открывай
              новых исполнителей и создавай
              собственную коллекцию.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (tracks[0]) {
                    playTrack(tracks[0]);
                  } else {
                    setPage("discover");
                  }
                }}
              >
                ▶ Начать слушать
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setPage("discover")
                }
              >
                Найти музыку
              </button>
            </div>
          </div>

          <div className="hero-glow" />
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                ПЕРСОНАЛЬНО
              </span>
              <h2>Для вас</h2>
            </div>

            <button
              type="button"
              onClick={() =>
                setPage("discover")
              }
            >
              Все →
            </button>
          </div>

          {renderTrackGrid(
            filteredTracks.slice(0, 8),
            "Пока нет музыки"
          )}
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                СЕЙЧАС СЛУШАЮТ
              </span>
              <h2>Популярное</h2>
            </div>
          </div>

          {renderTrackGrid(
            popularTracks.slice(0, 8),
            "Популярных треков пока нет"
          )}
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                ИСТОРИЯ
              </span>
              <h2>Продолжить слушать</h2>
            </div>
          </div>

          {renderTrackGrid(
            recentTracks.slice(0, 8),
            "История прослушиваний пуста"
          )}
        </section>
      </>
    );
  }

  function renderDiscover() {
    return (
      <>
        <div className="page-title">
          <span className="section-kicker">
            FENIX MUSIC
          </span>
          <h1>Рекомендации</h1>
          <p>
            Найди что-нибудь новое для себя.
          </p>
        </div>

        <div className="search-large">
          <span>⌕</span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Поиск треков, артистов и альбомов..."
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
            >
              ×
            </button>
          )}
        </div>

        {renderTrackGrid(
          filteredTracks,
          search
            ? "Ничего не найдено"
            : "Музыка ещё не загружена"
        )}
      </>
    );
  }

  function renderLibrary() {
    return (
      <>
        <div className="page-title">
          <span className="section-kicker">
            БИБЛИОТЕКА
          </span>
          <h1>Моя музыка</h1>
          <p>
            Все доступные треки Fenix Music.
          </p>
        </div>

        {renderTrackGrid(
          tracks,
          "В библиотеке пока нет треков"
        )}
      </>
    );
  }

  function renderFavorites() {
    return (
      <>
        <div className="page-title">
          <span className="section-kicker">
            КОЛЛЕКЦИЯ
          </span>
          <h1>Избранное</h1>
          <p>
            Треки, которые ты сохранил.
          </p>
        </div>

        {!user ? (
          <div className="login-card">
            <div className="login-card-icon">
              ♥
            </div>

            <h2>Войди в аккаунт</h2>

            <p>
              Авторизуйся, чтобы сохранять
              любимую музыку.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={openLogin}
            >
              Войти
            </button>
          </div>
        ) : (
          renderTrackGrid(
            favorites,
            "Избранное пока пусто"
          )
        )}
      </>
    );
  }

  function renderHistory() {
    return (
      <>
        <div className="page-title">
          <span className="section-kicker">
            НЕДАВНО
          </span>
          <h1>История</h1>
          <p>
            Треки, которые ты недавно слушал.
          </p>
        </div>

        {!user ? (
          <div className="login-card">
            <div className="login-card-icon">
              ◷
            </div>

            <h2>Войди в аккаунт</h2>

            <p>
              История будет сохраняться после
              авторизации.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={openLogin}
            >
              Войти
            </button>
          </div>
        ) : (
          renderTrackGrid(
            history,
            "История пока пуста"
          )
        )}
      </>
    );
  }

  function renderProfile() {
    if (!user) {
      return (
        <div className="profile-login">
          <div className="profile-big-avatar">
            F
          </div>

          <h1>Профиль Fenix Music</h1>

          <p>
            Войди или зарегистрируйся, чтобы
            получить доступ к профилю.
          </p>

          <div className="profile-actions">
            <button
              type="button"
              className="primary-button"
              onClick={openLogin}
            >
              Войти
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={openRegister}
            >
              Регистрация
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="profile-page">
        <div className="profile-header">
          <div className="profile-big-avatar">
            {(user.username || "U")
              .slice(0, 1)
              .toUpperCase()}
          </div>

          <div>
            <span className="section-kicker">
              ПРОФИЛЬ
            </span>

            <h1>{user.username}</h1>

            <p>
              {user.bio ||
                "Добро пожаловать в Fenix Music"}
            </p>

            <span className="profile-email">
              {user.email}
            </span>
          </div>
        </div>

        <div className="profile-stats">
          <div>
            <strong>{tracks.length}</strong>
            <span>Треков</span>
          </div>

          <div>
            <strong>{favorites.length}</strong>
            <span>Избранных</span>
          </div>

          <div>
            <strong>{history.length}</strong>
            <span>Прослушано</span>
          </div>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={logout}
        >
          Выйти из аккаунта
        </button>
      </div>
    );
  }

  function renderPage() {
    switch (page) {
      case "discover":
        return renderDiscover();

      case "library":
        return renderLibrary();

      case "favorites":
        return renderFavorites();

      case "history":
        return renderHistory();

      case "profile":
        return renderProfile();

      case "home":
      default:
        return renderHome();
    }
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-logo">F</div>
        <div className="loading-name">
          FENIX MUSIC
        </div>
        <div className="loading-line" />
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        page={page}
        setPage={setPage}
        user={user}
        onLogin={openLogin}
      />

      <main className="main">
        <header className="topbar">
          <button
            type="button"
            className="mobile-brand"
            onClick={() => setPage("home")}
          >
            <span>F</span>
            FENIX MUSIC
          </button>

          <div className="top-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);

                if (
                  event.target.value &&
                  page !== "discover"
                ) {
                  setPage("discover");
                }
              }}
              placeholder="Поиск..."
            />
          </div>

          <div className="top-actions">
            {user ? (
              <button
                type="button"
                className="top-profile"
                onClick={() =>
                  setPage("profile")
                }
              >
                <div className="avatar">
                  {(user.username || "U")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <span>{user.username}</span>
              </button>
            ) : (
              <button
                type="button"
                className="top-login"
                onClick={openLogin}
              >
                Войти
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="global-error">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}

        <div className="page-content">
          {renderPage()}
        </div>
      </main>

      <Player
        track={currentTrack}
        playing={playing}
        setPlaying={setPlaying}
        onNext={nextTrack}
        onPrevious={previousTrack}
        onLike={toggleFavorite}
        liked={
          currentTrack
            ? favoriteIds.has(
                getTrackId(currentTrack)
              )
            : false
        }
      />

      <BottomNav
        page={page}
        setPage={setPage}
      />

      <AuthModal
        open={authOpen}
        mode={authMode}
        setMode={setAuthMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={authSuccess}
      />
    </div>
  );
}
