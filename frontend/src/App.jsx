import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "https://ccmusice.onrender.com";

const NAV_ITEMS = [
  { id: "home", label: "Главная", icon: "⌂" },
  { id: "recommendations", label: "Для вас", icon: "✦" },
  { id: "new", label: "Новинки", icon: "◈" },
  { id: "popular", label: "Популярное", icon: "🔥" },
  { id: "mixes", label: "Миксы", icon: "♫" },
  { id: "library", label: "Моя музыка", icon: "♡" },
  { id: "history", label: "История", icon: "↶" },
];

const DEMO_TRACKS = [
  {
    id: "demo-1",
    title: "Neon Dreams",
    artist_name: "Fenix Music",
    album_name: "Fenix Originals",
    cover_url: "",
    audio_url: "",
    duration: 218,
    plays_count: 12453,
  },
  {
    id: "demo-2",
    title: "Night Drive",
    artist_name: "Fenix Music",
    album_name: "Night Collection",
    cover_url: "",
    audio_url: "",
    duration: 194,
    plays_count: 9832,
  },
  {
    id: "demo-3",
    title: "After Dark",
    artist_name: "Fenix Music",
    album_name: "After Dark",
    cover_url: "",
    audio_url: "",
    duration: 231,
    plays_count: 8421,
  },
  {
    id: "demo-4",
    title: "Red Lights",
    artist_name: "Fenix Music",
    album_name: "Neon City",
    cover_url: "",
    audio_url: "",
    duration: 207,
    plays_count: 7314,
  },
  {
    id: "demo-5",
    title: "Midnight",
    artist_name: "Fenix Music",
    album_name: "Midnight",
    cover_url: "",
    audio_url: "",
    duration: 245,
    plays_count: 6211,
  },
  {
    id: "demo-6",
    title: "Electric Heart",
    artist_name: "Fenix Music",
    album_name: "Electric",
    cover_url: "",
    audio_url: "",
    duration: 201,
    plays_count: 5842,
  },
];

function apiUrl(url) {
  if (!url) {
    return API_BASE;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function apiFetch(url, options = {}) {
  const response = await fetch(apiUrl(url), {
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
    data = {
      ok: false,
      error: text || `HTTP ${response.status}`,
    };
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

function formatTime(seconds) {
  const value = Number(seconds);

  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("ru-RU").format(number);
}

function getInitials(name) {
  return String(name || "F")
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

function createCaptchaFallback() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function Cover({ track, size = "normal", playing = false }) {
  const title = track?.title || "Fenix Music";

  return (
    <div
      className={`fm-cover fm-cover-${size} ${
        playing ? "fm-cover-playing" : ""
      }`}
    >
      {track?.cover_url ? (
        <img
          src={apiUrl(track.cover_url)}
          alt={title}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}

      <div className="fm-cover-fallback">
        <span>F</span>
      </div>

      {playing ? (
        <div className="fm-cover-bars">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : null}
    </div>
  );
}

function Icon({ children }) {
  return <span className="fm-icon">{children}</span>;
}

function SectionTitle({ title, action, onAction }) {
  return (
    <div className="fm-section-title">
      <div>
        <h2>{title}</h2>
      </div>

      {action ? (
        <button
          className="fm-text-button"
          type="button"
          onClick={onAction}
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

function TrackRow({
  track,
  index,
  currentTrack,
  isPlaying,
  onPlay,
  onFavorite,
  favorite,
}) {
  const active = currentTrack?.id === track.id;

  return (
    <div className={`fm-track-row ${active ? "active" : ""}`}>
      <div className="fm-track-index">
        {active && isPlaying ? (
          <div className="fm-mini-bars">
            <i />
            <i />
            <i />
          </div>
        ) : (
          <span>{index + 1}</span>
        )}
      </div>

      <button
        className="fm-track-main"
        type="button"
        onClick={() => onPlay(track)}
      >
        <Cover
          track={track}
          size="small"
          playing={active && isPlaying}
        />

        <span className="fm-track-text">
          <strong>{track.title}</strong>
          <small>
            {track.artist_name || "Fenix Music"}
            {track.album_name
              ? ` • ${track.album_name}`
              : ""}
          </small>
        </span>
      </button>

      <span className="fm-track-plays">
        {formatNumber(track.plays_count || 0)}
      </span>

      <button
        className={`fm-heart ${favorite ? "liked" : ""}`}
        type="button"
        aria-label="Избранное"
        onClick={() => onFavorite(track)}
      >
        {favorite ? "♥" : "♡"}
      </button>

      <span className="fm-track-duration">
        {formatTime(track.duration)}
      </span>
    </div>
  );
}

function TrackCard({
  track,
  currentTrack,
  isPlaying,
  onPlay,
  onFavorite,
  favorite,
}) {
  const active = currentTrack?.id === track.id;

  return (
    <div className="fm-track-card">
      <button
        className="fm-card-cover-button"
        type="button"
        onClick={() => onPlay(track)}
      >
        <Cover
          track={track}
          size="large"
          playing={active && isPlaying}
        />

        <span className="fm-card-play">
          {active && isPlaying ? "Ⅱ" : "▶"}
        </span>
      </button>

      <div className="fm-card-info">
        <strong>{track.title}</strong>
        <span>{track.artist_name || "Fenix Music"}</span>
      </div>

      <button
        className={`fm-card-heart ${
          favorite ? "liked" : ""
        }`}
        type="button"
        onClick={() => onFavorite(track)}
      >
        {favorite ? "♥" : "♡"}
      </button>
    </div>
  );
}

function AuthModal({
  open,
  onClose,
  mode,
  setMode,
  captcha,
  captchaInput,
  setCaptchaInput,
  refreshCaptcha,
  onSubmit,
  authLoading,
  authError,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setUsername("");
      setCaptchaInput("");
    }
  }, [open, setCaptchaInput]);

  if (!open) {
    return null;
  }

  const register = mode === "register";

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
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          className="fm-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className="fm-modal-header">
          <div className="fm-logo-mark">F</div>
          <h2>{register ? "Создать аккаунт" : "Вход"}</h2>
          <p>
            {register
              ? "Создай свой профиль в Fenix Music"
              : "Войди в свой аккаунт Fenix Music"}
          </p>
        </div>

        <form
          className="fm-auth-form"
          onSubmit={(event) => {
            event.preventDefault();

            onSubmit({
              email,
              password,
              username,
              captcha: captchaInput,
            });
          }}
        >
          {register ? (
            <label>
              <span>Имя пользователя</span>
              <input
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="FenixUser"
                autoComplete="username"
              />
            </label>
          ) : null}

          <label>
            <span>Email</span>
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

          <label>
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              autoComplete={
                register
                  ? "new-password"
                  : "current-password"
              }
              required
            />
          </label>

          <div className="fm-captcha">
            <div className="fm-captcha-top">
              <span>CAPTCHA</span>

              <button
                type="button"
                onClick={refreshCaptcha}
                className="fm-captcha-refresh"
              >
                Обновить
              </button>
            </div>

            <div className="fm-captcha-box">
              <strong>{captcha || "----"}</strong>
              <span>Введите 4 цифры</span>
            </div>

            <input
              inputMode="numeric"
              maxLength={4}
              value={captchaInput}
              onChange={(event) =>
                setCaptchaInput(
                  event.target.value.replace(/\D/g, "")
                )
              }
              placeholder="0000"
              required
            />
          </div>

          {authError ? (
            <div className="fm-error">
              {authError}
            </div>
          ) : null}

          <button
            className="fm-primary-button fm-auth-submit"
            type="submit"
            disabled={authLoading}
          >
            {authLoading
              ? "Подождите..."
              : register
              ? "Создать аккаунт"
              : "Войти"}
          </button>
        </form>

        <div className="fm-auth-switch">
          <span>
            {register
              ? "Уже есть аккаунт?"
              : "Нет аккаунта?"}
          </span>

          <button
            type="button"
            onClick={() =>
              setMode(register ? "login" : "register")
            }
          >
            {register ? "Войти" : "Регистрация"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Player({
  track,
  isPlaying,
  onToggle,
  onNext,
  onPrevious,
  progress,
  duration,
  volume,
  setProgress,
  setVolume,
  favorite,
  onFavorite,
}) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current || !track?.audio_url) {
      return;
    }

    audioRef.current.src = apiUrl(track.audio_url);
    audioRef.current.load();

    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    }
  }, [track]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    if (isPlaying && track?.audio_url) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, track]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  if (!track) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={(event) =>
          setProgress(event.currentTarget.currentTime)
        }
        onLoadedMetadata={(event) => {
          if (
            Number.isFinite(
              event.currentTarget.duration
            )
          ) {
            setProgress(0);
          }
        }}
        onEnded={onNext}
      />

      <div className="fm-player">
        <div className="fm-player-progress">
          <input
            type="range"
            min="0"
            max={Math.max(duration || track.duration || 1, 1)}
            step="0.1"
            value={Math.min(
              progress,
              duration || track.duration || 1
            )}
            onChange={(event) => {
              const value = Number(event.target.value);
              setProgress(value);

              if (audioRef.current) {
                audioRef.current.currentTime = value;
              }
            }}
          />
        </div>

        <div className="fm-player-content">
          <div className="fm-player-track">
            <Cover track={track} size="player" />

            <div>
              <strong>{track.title}</strong>
              <span>
                {track.artist_name || "Fenix Music"}
              </span>
            </div>
          </div>

          <div className="fm-player-controls">
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Предыдущий"
            >
              ◀
            </button>

            <button
              className="fm-player-play"
              type="button"
              onClick={onToggle}
              aria-label="Воспроизведение"
            >
              {isPlaying ? "Ⅱ" : "▶"}
            </button>

            <button
              type="button"
              onClick={onNext}
              aria-label="Следующий"
            >
              ▶
            </button>
          </div>

          <div className="fm-player-right">
            <button
              className={`fm-player-like ${
                favorite ? "liked" : ""
              }`}
              type="button"
              onClick={() => onFavorite(track)}
            >
              {favorite ? "♥" : "♡"}
            </button>

            <span className="fm-player-time">
              {formatTime(progress)} /{" "}
              {formatTime(duration || track.duration)}
            </span>

            <span className="fm-volume-icon">
              🔊
            </span>

            <input
              className="fm-volume"
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) =>
                setVolume(Number(event.target.value))
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}

function App() {
  const [page, setPage] = useState("home");
  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [volume, setVolume] = useState(80);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadMusic = useCallback(async () => {
    setLoading(true);
    setServerError("");

    try {
      const data = await apiFetch("/api/music");

      if (Array.isArray(data?.tracks)) {
        setTracks(data.tracks);
      } else {
        setTracks([]);
      }
    } catch (error) {
      setServerError(
        error?.message ||
          "Не удалось загрузить музыку"
      );
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCaptcha = useCallback(async () => {
    setAuthError("");

    try {
      const data = await apiFetch("/api/captcha");

      if (data?.code) {
        setCaptcha(String(data.code));
        setCaptchaId(data.captcha_id || "");
        setCaptchaInput("");
        return;
      }

      throw new Error("CAPTCHA не получена");
    } catch {
      setCaptcha(createCaptchaFallback());
      setCaptchaId("");
      setCaptchaInput("");
    }
  }, []);

  useEffect(() => {
    loadMusic();

    const savedFavorites =
      localStorage.getItem("fenix_music_favorites");

    const savedHistory =
      localStorage.getItem("fenix_music_history");

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

    const savedUser =
      localStorage.getItem("fenix_music_user");

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }
  }, [loadMusic]);

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

  const allTracks = useMemo(() => {
    if (tracks.length > 0) {
      return tracks;
    }

    return DEMO_TRACKS;
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return allTracks;
    }

    return allTracks.filter((track) => {
      const text = [
        track.title,
        track.artist_name,
        track.album_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }, [allTracks, search]);

  const popularTracks = useMemo(() => {
    return [...filteredTracks].sort(
      (a, b) =>
        Number(b.plays_count || 0) -
        Number(a.plays_count || 0)
    );
  }, [filteredTracks]);

  const favoriteTracks = useMemo(() => {
    return allTracks.filter((track) =>
      favorites.includes(track.id)
    );
  }, [allTracks, favorites]);

  const historyTracks = useMemo(() => {
    return history
      .map((id) =>
        allTracks.find((track) => track.id === id)
      )
      .filter(Boolean);
  }, [allTracks, history]);

  const duration =
    currentTrack?.duration ||
    0;

  const currentIndex = currentTrack
    ? allTracks.findIndex(
        (track) => track.id === currentTrack.id
      )
    : -1;

  function playTrack(track) {
    setCurrentTrack(track);
    setIsPlaying(true);
    setProgress(0);

    setHistory((previous) => {
      const next = [
        track.id,
        ...previous.filter((id) => id !== track.id),
      ];

      return next.slice(0, 30);
    });
  }

  function togglePlayback() {
    if (!currentTrack) {
      if (allTracks[0]) {
        playTrack(allTracks[0]);
      }

      return;
    }

    setIsPlaying((value) => !value);
  }

  function nextTrack() {
    if (!allTracks.length) {
      return;
    }

    const nextIndex =
      currentIndex >= 0
        ? (currentIndex + 1) % allTracks.length
        : 0;

    playTrack(allTracks[nextIndex]);
  }

  function previousTrack() {
    if (!allTracks.length) {
      return;
    }

    const previousIndex =
      currentIndex > 0
        ? currentIndex - 1
        : allTracks.length - 1;

    playTrack(allTracks[previousIndex]);
  }

  function toggleFavorite(track) {
    setFavorites((previous) => {
      if (previous.includes(track.id)) {
        return previous.filter(
          (id) => id !== track.id
        );
      }

      return [...previous, track.id];
    });
  }

  async function submitAuth(values) {
    setAuthLoading(true);
    setAuthError("");

    if (
      values.captcha !== captcha ||
      !/^\d{4}$/.test(values.captcha)
    ) {
      setAuthError(
        "Неверная CAPTCHA. Обновите код и попробуйте снова."
      );
      setCaptchaInput("");
      setCaptcha(createCaptchaFallback());
      setAuthLoading(false);
      return;
    }

    try {
      const endpoint =
        authMode === "register"
          ? "/api/auth/register"
          : "/api/auth/login";

      const payload = {
        email: values.email,
        password: values.password,
        captcha: values.captcha,
        captcha_id: captchaId,
      };

      if (authMode === "register") {
        payload.username = values.username;
      }

      const data = await apiFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const nextUser =
        data?.user ||
        data?.profile ||
        data?.account ||
        null;

      if (nextUser) {
        setUser(nextUser);

        localStorage.setItem(
          "fenix_music_user",
          JSON.stringify(nextUser)
        );
      }

      setAuthOpen(false);
    } catch (error) {
      setAuthError(
        error?.message ||
          "Не удалось выполнить операцию"
      );
      await loadCaptcha();
    } finally {
      setAuthLoading(false);
    }
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    setAuthOpen(true);
    loadCaptcha();
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("fenix_music_user");
  }

  function changePage(nextPage) {
    setPage(nextPage);
    setSidebarOpen(false);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function renderPage() {
    if (page === "library") {
      return (
        <>
          <SectionTitle
            title="Моя музыка"
            action="Обновить"
            onAction={loadMusic}
          />

          {favoriteTracks.length === 0 ? (
            <div className="fm-empty">
              <div className="fm-empty-icon">♡</div>
              <h3>Здесь пока пусто</h3>
              <p>
                Добавляй любимые треки в избранное,
                и они появятся здесь.
              </p>
            </div>
          ) : (
            <div className="fm-track-list">
              {favoriteTracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={index}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  favorite={favorites.includes(track.id)}
                />
              ))}
            </div>
          )}
        </>
      );
    }

    if (page === "history") {
      return (
        <>
          <SectionTitle title="Недавно прослушанное" />

          {historyTracks.length === 0 ? (
            <div className="fm-empty">
              <div className="fm-empty-icon">↶</div>
              <h3>История пуста</h3>
              <p>
                Запусти любой трек, чтобы он появился
                здесь.
              </p>
            </div>
          ) : (
            <div className="fm-track-list">
              {historyTracks.map((track, index) => (
                <TrackRow
                  key={`${track.id}-${index}`}
                  track={track}
                  index={index}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  favorite={favorites.includes(track.id)}
                />
              ))}
            </div>
          )}
        </>
      );
    }

    if (page === "popular") {
      return (
        <>
          <SectionTitle
            title="Популярное"
            action="Все"
            onAction={() => {}}
          />

          <div className="fm-card-grid">
            {popularTracks
              .slice(0, 8)
              .map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  favorite={favorites.includes(track.id)}
                />
              ))}
          </div>

          <SectionTitle title="Топ треков" />

          <div className="fm-track-list">
            {popularTracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlay={playTrack}
                onFavorite={toggleFavorite}
                favorite={favorites.includes(track.id)}
              />
            ))}
          </div>
        </>
      );
    }

    if (page === "new") {
      return (
        <>
          <SectionTitle
            title="Новинки"
            action="Обновить"
            onAction={loadMusic}
          />

          <div className="fm-card-grid">
            {filteredTracks
              .slice(0, 8)
              .map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  favorite={favorites.includes(track.id)}
                />
              ))}
          </div>
        </>
      );
    }

    if (page === "recommendations") {
      return (
        <>
          <SectionTitle title="Для вас" />

          <div className="fm-recommendation-banner">
            <div>
              <span>ПЕРСОНАЛЬНАЯ ПОДБОРКА</span>
              <h2>Музыка под твоё настроение</h2>
              <p>
                Мы собрали треки, которые могут тебе
                понравиться.
              </p>
            </div>

            <button
              type="button"
              className="fm-primary-button"
              onClick={() =>
                filteredTracks[0] &&
                playTrack(filteredTracks[0])
              }
            >
              ▶ Слушать
            </button>
          </div>

          <SectionTitle title="Рекомендуем" />

          <div className="fm-card-grid">
            {filteredTracks
              .slice(0, 8)
              .map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  favorite={favorites.includes(track.id)}
                />
              ))}
          </div>
        </>
      );
    }

    if (page === "mixes") {
      return (
        <>
          <SectionTitle title="Миксы" />

          <div className="fm-mix-grid">
            {[
              ["Night Mix", "Темный ночной вайб", "🌙"],
              ["Energy Mix", "Заряд на весь день", "⚡"],
              ["Chill Mix", "Спокойное настроение", "☁"],
              ["Drive Mix", "Музыка для дороги", "🚗"],
              ["Neon Mix", "Городские огни", "🌃"],
              ["Focus Mix", "Концентрация", "◉"],
            ].map(([title, text, emoji]) => (
              <button
                key={title}
                className="fm-mix-card"
                type="button"
                onClick={() =>
                  filteredTracks[0] &&
                  playTrack(filteredTracks[0])
                }
              >
                <span>{emoji}</span>
                <strong>{title}</strong>
                <small>{text}</small>
              </button>
            ))}
          </div>
        </>
      );
    }

    return (
      <>
        <section className="fm-hero">
          <div className="fm-hero-content">
            <span className="fm-eyebrow">
              FENIX MUSIC
            </span>

            <h1>
              Музыка.
              <br />
              <em>Твой мир.</em>
            </h1>

            <p>
              Слушай любимые треки, открывай новые
              релизы и собирай свою музыкальную
              коллекцию.
            </p>

            <div className="fm-hero-actions">
              <button
                className="fm-primary-button"
                type="button"
                onClick={() =>
                  filteredTracks[0] &&
                  playTrack(filteredTracks[0])
                }
              >
                ▶ Начать слушать
              </button>

              <button
                className="fm-secondary-button"
                type="button"
                onClick={() =>
                  changePage("recommendations")
                }
              >
                Для вас
              </button>
            </div>
          </div>

          <div className="fm-hero-orb">
            <div className="fm-orb-ring ring-one" />
            <div className="fm-orb-ring ring-two" />
            <div className="fm-orb-center">
              <span>F</span>
            </div>
          </div>
        </section>

        <SectionTitle
          title="Продолжить слушать"
          action="Показать все"
          onAction={() => changePage("history")}
        />

        {historyTracks.length > 0 ? (
          <div className="fm-card-grid">
            {historyTracks
              .slice(0, 4)
              .map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  favorite={favorites.includes(track.id)}
                />
              ))}
          </div>
        ) : (
          <div className="fm-empty fm-empty-small">
            <div className="fm-empty-icon">♫</div>
            <h3>Начни слушать</h3>
            <p>
              Здесь появятся треки, которые ты недавно
              запускал.
            </p>
          </div>
        )}

        <SectionTitle
          title="Популярное"
          action="Все"
          onAction={() => changePage("popular")}
        />

        <div className="fm-card-grid">
          {popularTracks
            .slice(0, 6)
            .map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlay={playTrack}
                onFavorite={toggleFavorite}
                favorite={favorites.includes(track.id)}
              />
            ))}
        </div>

        <SectionTitle title="Все треки" />

        {filteredTracks.length > 0 ? (
          <div className="fm-track-list">
            {filteredTracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlay={playTrack}
                onFavorite={toggleFavorite}
                favorite={favorites.includes(track.id)}
              />
            ))}
          </div>
        ) : (
          <div className="fm-empty">
            <div className="fm-empty-icon">♫</div>
            <h3>Треки не найдены</h3>
            <p>
              Попробуй изменить поисковый запрос.
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="fm-app">
      <aside
        className={`fm-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="fm-brand">
          <div className="fm-logo-mark">F</div>
          <div>
            <strong>FENIX</strong>
            <span>MUSIC</span>
          </div>
        </div>

        <nav className="fm-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`fm-nav-item ${
                page === item.id ? "active" : ""
              }`}
              onClick={() => changePage(item.id)}
            >
              <Icon>{item.icon}</Icon>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="fm-sidebar-bottom">
          <div className="fm-sidebar-feature">
            <span>✦</span>
            <strong>Fenix Premium</strong>
            <small>
              Больше возможностей
            </small>
          </div>

          {user ? (
            <button
              className="fm-user-card"
              type="button"
              onClick={logout}
            >
              <span className="fm-avatar">
                {getInitials(
                  user.username ||
                    user.name ||
                    user.email
                )}
              </span>

              <span>
                <strong>
                  {user.username ||
                    user.name ||
                    "Пользователь"}
                </strong>
                <small>Выйти</small>
              </span>
            </button>
          ) : (
            <button
              className="fm-login-sidebar"
              type="button"
              onClick={() => openAuth("login")}
            >
              <span>↪</span>
              <strong>Войти в аккаунт</strong>
            </button>
          )}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          className="fm-mobile-overlay"
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="fm-main">
        <header className="fm-header">
          <button
            className="fm-menu-button"
            type="button"
            onClick={() =>
              setSidebarOpen((value) => !value)
            }
            aria-label="Меню"
          >
            ☰
          </button>

          <div className="fm-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Поиск музыки, артистов и альбомов"
            />

            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Очистить"
              >
                ×
              </button>
            ) : null}
          </div>

          <div className="fm-header-actions">
            <button
              className="fm-icon-button"
              type="button"
              onClick={() => changePage("history")}
              title="История"
            >
              ↶
            </button>

            {user ? (
              <button
                className="fm-header-user"
                type="button"
                onClick={logout}
              >
                <span className="fm-avatar">
                  {getInitials(
                    user.username ||
                      user.name ||
                      user.email
                  )}
                </span>
              </button>
            ) : (
              <button
                className="fm-login-button"
                type="button"
                onClick={() => openAuth("login")}
              >
                Войти
              </button>
            )}
          </div>
        </header>

        <div className="fm-content">
          {serverError ? (
            <div className="fm-server-warning">
              <span>⚠</span>
              <div>
                <strong>
                  Backend отвечает с ошибкой
                </strong>
                <small>{serverError}</small>
              </div>

              <button
                type="button"
                onClick={loadMusic}
              >
                Повторить
              </button>
            </div>
          ) : null}

          {loading && tracks.length === 0 ? (
            <div className="fm-loading">
              <div className="fm-spinner" />
              <span>Загружаем Fenix Music...</span>
            </div>
          ) : (
            renderPage()
          )}
        </div>
      </main>

      {currentTrack ? (
        <Player
          track={currentTrack}
          isPlaying={isPlaying}
          onToggle={togglePlayback}
          onNext={nextTrack}
          onPrevious={previousTrack}
          progress={progress}
          duration={duration}
          volume={volume}
          setProgress={setProgress}
          setVolume={setVolume}
          favorite={favorites.includes(
            currentTrack.id
          )}
          onFavorite={toggleFavorite}
        />
      ) : null}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        mode={authMode}
        setMode={setAuthMode}
        captcha={captcha}
        captchaInput={captchaInput}
        setCaptchaInput={setCaptchaInput}
        refreshCaptcha={loadCaptcha}
        onSubmit={submitAuth}
        authLoading={authLoading}
        authError={authError}
      />
    </div>
  );
}

export default App;
