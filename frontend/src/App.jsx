import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

const API = "/api";

async function api(url, options = {}) {
  const response = await fetch(`${API}${url}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

function Icon({ type, size = 20 }) {
  const icons = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-6h6v6" />
      </>
    ),

    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),

    heart: (
      <path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A5 5 0 0 1 12 5.7a5 5 0 0 1 8.8 3.1Z" />
    ),

    music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),

    play: <path d="M8 5v14l11-7L8 5Z" />,

    pause: (
      <>
        <path d="M7 5h3v14H7z" />
        <path d="M14 5h3v14h-3z" />
      </>
    ),

    next: (
      <>
        <path d="m5 5 8 7-8 7V5Z" />
        <path d="M16 5v14" />
      </>
    ),

    previous: (
      <>
        <path d="m19 5-8 7 8 7V5Z" />
        <path d="M8 5v14" />
      </>
    ),

    shuffle: (
      <>
        <path d="m3 5 5 5 8-8" />
        <path d="M16 2h5v5" />
        <path d="m3 19 5-5 8 8" />
        <path d="M16 22h5v-5" />
      </>
    ),

    repeat: (
      <>
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11V8a2 2 0 0 1 2-2h16" />
        <path d="M7 22l-4-4 4-4" />
        <path d="M21 13v3a2 2 0 0 1-2 2H3" />
      </>
    ),

    volume: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="M15 9a4 4 0 0 1 0 6" />
        <path d="M18 6a8 8 0 0 1 0 12" />
      </>
    ),

    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),

    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M11 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
      </>
    ),

    menu: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </>
    ),

    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),

    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[type] || icons.music}
    </svg>
  );
}

function normalizeTrack(track) {
  const fileName =
    track.file_name ||
    track.file ||
    track.filename ||
    "";

  let audioUrl =
    track.audio_url ||
    track.audioUrl ||
    "";

  if (!audioUrl && fileName) {
    audioUrl =
      `/api/music/audio/${encodeURIComponent(fileName)}`;
  }

  return {
    ...track,

    id: String(
      track.id ||
        fileName ||
        track.title ||
        Math.random()
    ),

    title:
      track.title ||
      track.name ||
      fileName ||
      "Без названия",

    artist_name:
      track.artist_name ||
      track.artist ||
      "Fenix Music",

    album_name:
      track.album_name ||
      track.album ||
      "Fenix Music",

    cover_url:
      track.cover_url ||
      track.cover ||
      "/music-cover.svg",

    audio_url: audioUrl,

    duration: Number(track.duration || 0),

    plays_count: Number(
      track.plays_count ||
        track.plays ||
        0
    ),

    file_name: fileName,
  };
}

function formatTime(value) {
  const seconds = Math.max(
    0,
    Math.floor(Number(value) || 0)
  );

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function Cover({ track, large = false }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={
        large
          ? "track-cover large"
          : "track-cover"
      }
    >
      {!failed && track?.cover_url ? (
        <img
          src={track.cover_url}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : null}

      {(failed || !track?.cover_url) && (
        <Icon
          type="music"
          size={large ? 42 : 24}
        />
      )}
    </div>
  );
}

function AuthModal({
  onClose,
  onLogin,
  onRegister,
}) {
  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    login: "",
    username: "",
    email: "",
    password: "",
    captcha: "",
    captcha_id: "",
  });

  const [captchaText, setCaptchaText] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function getCaptcha() {
    try {
      const result =
        await api("/auth/captcha");

      setCaptchaText(
        result.text ||
          result.code ||
          result.captcha ||
          ""
      );

      setForm((old) => ({
        ...old,
        captcha_id:
          result.id ||
          result.captcha_id ||
          "",
      }));
    } catch (e) {
      setCaptchaText("");
    }
  }

  useEffect(() => {
    if (mode === "register") {
      getCaptcha();
    }
  }, [mode]);

  function change(name, value) {
    setForm((old) => ({
      ...old,
      [name]: value,
    }));
  }

  async function submit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await onLogin({
          login: form.login,
          password: form.password,
        });
      } else {
        await onRegister(form);
      }

      onClose();
    } catch (e) {
      setError(
        e.message ||
          "Произошла ошибка"
      );

      if (mode === "register") {
        getCaptcha();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className="auth-modal"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >
        <button
          className="modal-close"
          onClick={onClose}
        >
          <Icon type="close" />
        </button>

        <div className="auth-symbol">
          F
        </div>

        <h2>
          {mode === "login"
            ? "С возвращением"
            : "Создать аккаунт"}
        </h2>

        <p>
          {mode === "login"
            ? "Войди в свою музыкальную вселенную"
            : "Создай аккаунт Fenix Music"}
        </p>

        <form onSubmit={submit}>
          {mode === "login" ? (
            <input
              value={form.login}
              onChange={(e) =>
                change(
                  "login",
                  e.target.value
                )
              }
              placeholder="Email или username"
              autoComplete="username"
              required
            />
          ) : (
            <>
              <input
                value={form.username}
                onChange={(e) =>
                  change(
                    "username",
                    e.target.value
                  )
                }
                placeholder="Username"
                required
              />

              <input
                value={form.email}
                onChange={(e) =>
                  change(
                    "email",
                    e.target.value
                  )
                }
                placeholder="Email"
                type="email"
                required
              />
            </>
          )}

          <input
            value={form.password}
            onChange={(e) =>
              change(
                "password",
                e.target.value
              )
            }
            placeholder="Пароль"
            type="password"
            autoComplete={
              mode === "login"
                ? "current-password"
                : "new-password"
            }
            required
          />

          {mode === "register" && (
            <div className="captcha">
              <div className="captcha-code">
                {captchaText || "------"}
              </div>

              <button
                type="button"
                className="captcha-refresh"
                onClick={getCaptcha}
              >
                ↻
              </button>

              <input
                value={form.captcha}
                onChange={(e) =>
                  change(
                    "captcha",
                    e.target.value
                  )
                }
                placeholder="Введите CAPTCHA"
                required
              />
            </div>
          )}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <button
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Подождите..."
              : mode === "login"
              ? "Войти"
              : "Зарегистрироваться"}
          </button>
        </form>

        <button
          className="switch-auth"
          onClick={() => {
            setError("");

            setMode(
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

export default function App() {
  const audioRef =
    useRef(null);

  const [tracks, setTracks] =
    useState([]);

  const [favorites, setFavorites] =
    useState([]);

  const [history, setHistory] =
    useState([]);

  const [user, setUser] =
    useState(null);

  const [current, setCurrent] =
    useState(null);

  const [playing, setPlaying] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [duration, setDuration] =
    useState(0);

  const [volume, setVolume] =
    useState(0.85);

  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState("home");

  const [shuffle, setShuffle] =
    useState(false);

  const [repeat, setRepeat] =
    useState(false);

  const [authOpen, setAuthOpen] =
    useState(false);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadTracks() {
    const result =
      await api("/tracks");

    const list = (
      result.tracks ||
      result.data ||
      []
    ).map(normalizeTrack);

    setTracks(list);

    setCurrent((old) => {
      if (old) {
        const fresh = list.find(
          (x) =>
            String(x.id) ===
            String(old.id)
        );

        return fresh || old;
      }

      return list[0] || null;
    });
  }

  async function loadUser() {
    try {
      const result =
        await api("/auth/me");

      const logged =
        result.user || null;

      setUser(logged);

      if (logged) {
        try {
          const fav =
            await api("/favorites");

          setFavorites(
            (
              fav.tracks ||
              []
            ).map(normalizeTrack)
          );
        } catch {}

        try {
          const hist =
            await api("/history");

          setHistory(
            (
              hist.tracks ||
              []
            ).map(normalizeTrack)
          );
        } catch {}
      }
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    Promise.all([
      loadTracks(),
      loadUser(),
    ])
      .catch((e) => {
        setError(
          e.message ||
            "Не удалось загрузить приложение"
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume =
        volume;
    }
  }, [volume]);

  function getAudioUrl(track) {
    if (!track) {
      return "";
    }

    if (track.audio_url) {
      return track.audio_url;
    }

    if (track.file_name) {
      return `/api/music/audio/${encodeURIComponent(
        track.file_name
      )}`;
    }

    return "";
  }

  async function playTrack(track) {
    if (!track) {
      return;
    }

    const audio =
      audioRef.current;

    const url =
      getAudioUrl(track);

    setCurrent(track);
    setProgress(0);
    setDuration(
      Number(track.duration) || 0
    );

    if (!audio || !url) {
      setError(
        "У этого трека нет аудиофайла."
      );
      return;
    }

    try {
      audio.src = url;
      audio.load();

      await audio.play();

      setPlaying(true);

      try {
        await api(
          `/tracks/${encodeURIComponent(
            track.id
          )}/play`,
          {
            method: "POST",
            body: JSON.stringify({}),
          }
        );
      } catch {}

      if (user) {
        try {
          await api("/history", {
            method: "POST",
            body: JSON.stringify({
              track_id: track.id,
            }),
          });
        } catch {}
      }
    } catch (e) {
      console.error(e);

      setPlaying(false);

      setError(
        "Не удалось воспроизвести трек. Проверь файл в music/."
      );
    }
  }

  function pauseTrack() {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    setPlaying(false);
  }

  function nextTrack() {
    if (!tracks.length) {
      return;
    }

    const index =
      tracks.findIndex(
        (track) =>
          String(track.id) ===
          String(current?.id)
      );

    let nextIndex;

    if (shuffle) {
      nextIndex =
        Math.floor(
          Math.random() *
            tracks.length
        );

      if (
        tracks.length > 1 &&
        nextIndex === index
      ) {
        nextIndex =
          (index + 1) %
          tracks.length;
      }
    } else {
      nextIndex =
        (index + 1) %
        tracks.length;
    }

    playTrack(
      tracks[nextIndex]
    );
  }

  function previousTrack() {
    if (!tracks.length) {
      return;
    }

    const index =
      tracks.findIndex(
        (track) =>
          String(track.id) ===
          String(current?.id)
      );

    const previousIndex =
      (index - 1 +
        tracks.length) %
      tracks.length;

    playTrack(
      tracks[previousIndex]
    );
  }

  function onEnded() {
    if (repeat && current) {
      playTrack(current);
      return;
    }

    nextTrack();
  }

  function seek(e) {
    const value =
      Number(e.target.value);

    setProgress(value);

    if (audioRef.current) {
      audioRef.current.currentTime =
        value;
    }
  }

  async function toggleFavorite(track) {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    const exists =
      favorites.some(
        (item) =>
          String(item.id) ===
          String(track.id)
      );

    try {
      if (exists) {
        await api(
          `/favorites/${encodeURIComponent(
            track.id
          )}`,
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
        await api("/favorites", {
          method: "POST",
          body: JSON.stringify({
            track_id: track.id,
          }),
        });

        setFavorites((old) => [
          track,
          ...old,
        ]);
      }
    } catch (e) {
      setError(
        e.message ||
          "Не удалось изменить избранное"
      );
    }
  }

  async function login(data) {
    const result =
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });

    setUser(result.user);

    try {
      const fav =
        await api("/favorites");

      setFavorites(
        (
          fav.tracks ||
          []
        ).map(normalizeTrack)
      );
    } catch {}
  }

  async function register(data) {
    const result =
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      });

    setUser(result.user);
  }

  async function logout() {
    try {
      await api("/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch {}

    setUser(null);
    setFavorites([]);
    setHistory([]);
  }

  const filteredTracks =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return tracks;
      }

      return tracks.filter(
        (track) =>
          `${track.title} ${track.artist_name} ${track.album_name}`
            .toLowerCase()
            .includes(query)
      );
    }, [tracks, search]);

  let visibleTracks =
    filteredTracks;

  if (page === "favorites") {
    visibleTracks =
      favorites;
  }

  if (page === "history") {
    visibleTracks =
      history;
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setMenuOpen(false);
  }

  const likedCurrent =
    current &&
    favorites.some(
      (item) =>
        String(item.id) ===
        String(current.id)
    );

  return (
    <div className="fenix-app">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setProgress(
              audioRef.current.currentTime
            );
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(
              audioRef.current.duration ||
                0
            );
          }
        }}
        onPlay={() =>
          setPlaying(true)
        }
        onPause={() =>
          setPlaying(false)
        }
        onEnded={onEnded}
        onError={() =>
          setPlaying(false)
        }
      />

      <aside
        className={
          "sidebar " +
          (menuOpen
            ? "sidebar-open"
            : "")
        }
      >
        <div className="brand">
          <div className="brand-icon">
            F
          </div>

          <div className="brand-name">
            FENIX
            <span>MUSIC</span>
          </div>
        </div>

        <nav className="navigation">
          <button
            className={
              page === "home"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              navigate("home")
            }
          >
            <Icon type="home" />
            <span>Главная</span>
          </button>

          <button
            className={
              page === "search"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              navigate("search")
            }
          >
            <Icon type="search" />
            <span>Поиск</span>
          </button>

          <button
            className={
              page === "favorites"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              navigate(
                "favorites"
              )
            }
          >
            <Icon type="heart" />
            <span>Избранное</span>
          </button>

          <button
            className={
              page === "history"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              navigate("history")
            }
          >
            <Icon type="clock" />
            <span>История</span>
          </button>
        </nav>

        <div className="sidebar-user">
          {user ? (
            <>
              <div className="profile-mini">
                <div className="avatar">
                  <Icon
                    type="user"
                    size={18}
                  />
                </div>

                <div>
                  <strong>
                    {user.username}
                  </strong>

                  <small>
                    Fenix Music
                  </small>
                </div>
              </div>

              <button
                className="logout-button"
                onClick={logout}
              >
                <Icon type="logout" />
                Выйти
              </button>
            </>
          ) : (
            <button
              className="login-button"
              onClick={() =>
                setAuthOpen(true)
              }
            >
              <Icon type="user" />
              Войти
            </button>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() =>
              setMenuOpen(
                !menuOpen
              )
            }
          >
            <Icon type="menu" />
          </button>

          <div className="search-bar">
            <Icon
              type="search"
              size={19}
            />

            <input
              value={search}
              onChange={(e) => {
                setSearch(
                  e.target.value
                );

                setPage("search");
              }}
              placeholder="Поиск музыки, артистов и альбомов..."
            />
          </div>

          {user ? (
            <div className="top-profile">
              <div className="avatar">
                <Icon
                  type="user"
                  size={17}
                />
              </div>

              <span>
                {user.username}
              </span>
            </div>
          ) : (
            <button
              className="top-login"
              onClick={() =>
                setAuthOpen(true)
              }
            >
              Войти
            </button>
          )}
        </header>

        {error && (
          <div
            className="error-toast"
            onClick={() =>
              setError("")
            }
          >
            {error}
          </div>
        )}

        <div className="page-content">
          {page === "home" && (
            <section className="hero">
              <div className="hero-content">
                <div className="hero-label">
                  FENIX MUSIC
                </div>

                <h1>
                  Твоя музыка.
                  <br />
                  <span>
                    Твоя вселенная.
                  </span>
                </h1>

                <p>
                  Слушай любимые треки,
                  открывай новую музыку
                  и создавай свою
                  коллекцию.
                </p>

                <button
                  className="hero-play"
                  onClick={() => {
                    if (
                      tracks.length
                    ) {
                      playTrack(
                        tracks[0]
                      );
                    }
                  }}
                >
                  <Icon
                    type="play"
                    size={19}
                  />
                  Начать слушать
                </button>
              </div>

              <div className="hero-art">
                <div className="glow"></div>

                <div className="hero-disc">
                  <div>
                    F
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="tracks-section">
            <div className="section-title">
              <div>
                <h2>
                  {page ===
                  "favorites"
                    ? "Избранное"
                    : page ===
                      "history"
                    ? "История"
                    : page ===
                      "search"
                    ? "Поиск"
                    : "Все треки"}
                </h2>

                <span>
                  {visibleTracks.length}{" "}
                  треков
                </span>
              </div>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="loading-circle"></div>
                <h3>
                  Загружаем музыку...
                </h3>
              </div>
            ) : visibleTracks.length ===
              0 ? (
              <div className="empty-state">
                <Icon
                  type="music"
                  size={46}
                />

                <h3>
                  Здесь пока пусто
                </h3>

                <p>
                  Новые песни появятся
                  после загрузки через
                  бота.
                </p>
              </div>
            ) : (
              <div className="tracks-list">
                {visibleTracks.map(
                  (track, index) => {
                    const active =
                      String(
                        current?.id
                      ) ===
                      String(
                        track.id
                      );

                    const liked =
                      favorites.some(
                        (item) =>
                          String(
                            item.id
                          ) ===
                          String(
                            track.id
                          )
                      );

                    return (
                      <div
                        className={
                          "track-row " +
                          (active
                            ? "track-active"
                            : "")
                        }
                        key={
                          track.id +
                          "-" +
                          index
                        }
                      >
                        <button
                          className="row-play"
                          onClick={() =>
                            active &&
                            playing
                              ? pauseTrack()
                              : playTrack(
                                  track
                                )
                          }
                        >
                          <Icon
                            type={
                              active &&
                              playing
                                ? "pause"
                                : "play"
                            }
                            size={18}
                          />
                        </button>

                        <Cover
                          track={track}
                        />

                        <div
                          className="track-data"
                          onClick={() =>
                            playTrack(
                              track
                            )
                          }
                        >
                          <strong>
                            {
                              track.title
                            }
                          </strong>

                          <span>
                            {
                              track.artist_name
                            }
                          </span>
                        </div>

                        <div className="track-album">
                          {
                            track.album_name
                          }
                        </div>

                        <div className="track-plays">
                          {track.plays_count
                            ? `${track.plays_count} прослушиваний`
                            : ""}
                        </div>

                        <button
                          className={
                            "favorite-button " +
                            (liked
                              ? "favorite-active"
                              : "")
                          }
                          onClick={() =>
                            toggleFavorite(
                              track
                            )
                          }
                        >
                          <Icon
                            type="heart"
                            size={19}
                          />
                        </button>

                        <div className="track-time">
                          {track.duration
                            ? formatTime(
                                track.duration
                              )
                            : "—"}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="player">
        <div className="player-current">
          {current ? (
            <>
              <Cover
                track={current}
              />

              <div className="player-info">
                <strong>
                  {current.title}
                </strong>

                <span>
                  {
                    current.artist_name
                  }
                </span>
              </div>

              <button
                className={
                  "player-heart " +
                  (likedCurrent
                    ? "favorite-active"
                    : "")
                }
                onClick={() =>
                  toggleFavorite(
                    current
                  )
                }
              >
                <Icon
                  type="heart"
                  size={18}
                />
              </button>
            </>
          ) : (
            <span className="player-empty">
              Выбери трек
            </span>
          )}
        </div>

        <div className="player-main">
          <div className="player-controls">
            <button
              className={
                shuffle
                  ? "control-active"
                  : ""
              }
              onClick={() =>
                setShuffle(!shuffle)
              }
            >
              <Icon
                type="shuffle"
                size={18}
              />
            </button>

            <button
              onClick={
                previousTrack
              }
            >
              <Icon
                type="previous"
                size={21}
              />
            </button>

            <button
              className="main-play"
              onClick={() => {
                if (!current) {
                  if (
                    tracks.length
                  ) {
                    playTrack(
                      tracks[0]
                    );
                  }

                  return;
                }

                if (playing) {
                  pauseTrack();
                } else {
                  playTrack(
                    current
                  );
                }
              }}
            >
              <Icon
                type={
                  playing
                    ? "pause"
                    : "play"
                }
                size={21}
              />
            </button>

            <button
              onClick={nextTrack}
            >
              <Icon
                type="next"
                size={21}
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
                type="repeat"
                size={18}
              />
            </button>
          </div>

          <div className="progress">
            <span>
              {formatTime(
                progress
              )}
            </span>

            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(
                progress,
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

        <div className="volume-control">
          <Icon
            type="volume"
            size={18}
          />

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) =>
              setVolume(
                Number(
                  e.target.value
                )
              )
            }
          />
        </div>
      </footer>

      {authOpen && (
        <AuthModal
          onClose={() =>
            setAuthOpen(false)
          }
          onLogin={login}
          onRegister={register}
        />
      )}
    </div>
  );
}
