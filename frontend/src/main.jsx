import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
  Radio as RadioIcon,
  Heart,
  History,
  Search,
  User,
  Menu,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat2,
  Volume2,
  VolumeX,
  Plus,
  LogIn,
  LogOut,
  Music2,
  ListMusic,
  Upload,
  Send,
  ChevronDown,
  X,
} from "lucide-react";
import "./styles.css";

/* =========================================================
   API
========================================================= */

const api = async (path, options = {}) => {
  const token = localStorage.getItem("fenix_token");

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "Ошибка запроса");
  }

  return data;
};

/* =========================================================
   HELPERS
========================================================= */

function formatTime(seconds) {
  const value = Math.floor(Number(seconds) || 0);

  const minutes = Math.floor(value / 60);
  const secs = value % 60;

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getInitial(username = "") {
  return username?.trim()?.[0]?.toUpperCase() || "F";
}

/* =========================================================
   COVER
========================================================= */

function Cover({ track, size = "md" }) {
  const url = track?.cover_url || track?.cover;

  if (url) {
    return (
      <img
        className={`cover ${size}`}
        src={url}
        alt={track?.title || "FENIX MUSIC"}
      />
    );
  }

  return (
    <div className={`cover ${size} placeholder`}>
      <Music2 size={size === "lg" ? 42 : 24} />
    </div>
  );
}

/* =========================================================
   EMPTY
========================================================= */

function Empty({ text }) {
  return (
    <div className="empty">
      <Music2 size={42} />
      <b>{text}</b>
    </div>
  );
}

/* =========================================================
   TRACK ROW
========================================================= */

function TrackRow({ track, onPlay, onLike }) {
  return (
    <div className="track-row">
      <Cover track={track} />

      <div
        className="track-info"
        onClick={() => onPlay(track)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onPlay(track);
          }
        }}
      >
        <b>{track?.title || "Без названия"}</b>

        <span>
          {track?.artist || "Неизвестный артист"}
          {track?.album ? ` · ${track.album}` : ""}
        </span>
      </div>

      <span className="duration">
        {track?.duration_label || formatTime(track?.duration)}
      </span>

      <button
        type="button"
        className={track?.liked ? "icon active" : "icon"}
        onClick={() => onLike(track)}
        title="Избранное"
      >
        <Heart
          size={18}
          fill={track?.liked ? "currentColor" : "none"}
        />
      </button>

      <button
        type="button"
        className="play-small"
        onClick={() => onPlay(track)}
        title="Воспроизвести"
      >
        <Play size={17} fill="currentColor" />
      </button>
    </div>
  );
}

/* =========================================================
   AUTH
========================================================= */

function Auth({ onClose, onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [telegramToken, setTelegramToken] = useState("");

  useEffect(() => {
    if (!telegramToken) {
      return undefined;
    }

    const interval = setInterval(async () => {
      try {
        const data = await api(
          `/api/auth/telegram/status/${telegramToken}`
        );

        if (data.status === "confirmed") {
          localStorage.setItem("fenix_token", data.token);

          onAuth(data.user);
          onClose();
        }
      } catch {
        // Ожидаем подтверждение Telegram
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [telegramToken, onAuth, onClose]);

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/register";

      const body =
        mode === "login"
          ? {
              email,
              password,
            }
          : {
              email,
              password,
              username,
            };

      const data = await api(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      localStorage.setItem("fenix_token", data.token);

      onAuth(data.user);
      onClose();
    } catch (err) {
      setError(err.message || "Не удалось выполнить вход");
    }
  }

  async function telegramLogin() {
    setError("");

    try {
      const data = await api("/api/auth/telegram/start", {
        method: "POST",
      });

      setTelegramToken(data.token);

      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err.message || "Telegram авторизация недоступна");
    }
  }

  return (
    <div className="modal-back">
      <div className="modal auth-modal">
        <button
          type="button"
          className="close"
          onClick={onClose}
          title="Закрыть"
        >
          <X />
        </button>

        <div className="brand big">
          FENIX<span>MUSIC</span>
        </div>

        <h2>
          {mode === "login"
            ? "С возвращением"
            : "Создать аккаунт"}
        </h2>

        <form onSubmit={submit}>
          {mode === "register" && (
            <input
              type="text"
              placeholder="Никнейм"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
          />

          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
          />

          <button type="submit" className="primary">
            {mode === "login"
              ? "Войти"
              : "Зарегистрироваться"}
          </button>
        </form>

        <div className="or">или</div>

        <button
          type="button"
          className="telegram"
          onClick={telegramLogin}
        >
          <Send size={18} />
          Войти через Telegram
        </button>

        {telegramToken && (
          <div className="waiting">
            Откройте Telegram и нажмите Start.
            <br />
            Ожидаю подтверждение…
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <button
          type="button"
          className="switch"
          onClick={() =>
            setMode(
              mode === "login"
                ? "register"
                : "login"
            )
          }
        >
          {mode === "login"
            ? "Нет аккаунта? Регистрация"
            : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   PLAYLISTS
========================================================= */

function PlaylistPage() {
  const [playlists, setPlaylists] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/api/playlists")
      .then(setPlaylists)
      .catch(() => setPlaylists([]));
  }, []);

  async function createPlaylist() {
    const cleanName = name.trim();

    if (!cleanName || loading) {
      return;
    }

    setLoading(true);

    try {
      const playlist = await api("/api/playlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
        }),
      });

      setPlaylists((current) => [
        ...current,
        {
          ...playlist,
          tracks: playlist.tracks || [],
        },
      ]);

      setName("");
    } catch {
      // Ошибка создания плейлиста
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="playlist-create">
        <input
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              createPlaylist();
            }
          }}
          placeholder="Название нового плейлиста"
        />

        <button
          type="button"
          className="primary"
          onClick={createPlaylist}
          disabled={loading}
        >
          <Plus size={18} />
          {loading ? "Создание..." : "Создать"}
        </button>
      </div>

      {playlists.length === 0 ? (
        <Empty text="У тебя пока нет плейлистов" />
      ) : (
        <div className="playlist-grid">
          {playlists.map((playlist) => (
            <div
              className="playlist-card"
              key={playlist.id}
            >
              <ListMusic size={32} />

              <b>{playlist.name}</b>

              <span>
                {playlist.tracks?.length || 0} треков
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [page, setPage] = useState("home");

  const [tracks, setTracks] = useState([]);
  const [radio, setRadio] = useState([]);

  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);

  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState(false);

  const [query, setQuery] = useState("");

  const [mobile, setMobile] = useState(false);

  const [volume, setVolume] = useState(0.9);

  const [liked, setLiked] = useState([]);
  const [history, setHistory] = useState([]);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const audio = useRef(new Audio());

  /* -------------------------------------------------------
     INITIAL LOAD
  ------------------------------------------------------- */

  useEffect(() => {
    api("/api/tracks")
      .then((data) => {
        setTracks(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setTracks([]);
      });

    api("/api/radio")
      .then((data) => {
        setRadio(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setRadio([]);
      });

    api("/api/auth/me")
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

  /* -------------------------------------------------------
     AUDIO EVENTS
  ------------------------------------------------------- */

  useEffect(() => {
    const player = audio.current;

    player.volume = volume;

    const handleTime = () => {
      setProgress(player.currentTime || 0);
    };

    const handleMetadata = () => {
      setDuration(
        Number(player.duration) ||
          Number(current?.duration) ||
          0
      );
    };

    const handleEnded = () => {
      if (repeat && current) {
        player.currentTime = 0;

        player
          .play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));

        return;
      }

      nextTrack();
    };

    player.addEventListener(
      "timeupdate",
      handleTime
    );

    player.addEventListener(
      "loadedmetadata",
      handleMetadata
    );

    player.addEventListener(
      "ended",
      handleEnded
    );

    return () => {
      player.removeEventListener(
        "timeupdate",
        handleTime
      );

      player.removeEventListener(
        "loadedmetadata",
        handleMetadata
      );

      player.removeEventListener(
        "ended",
        handleEnded
      );
    };
  }, [volume, repeat, current, tracks, shuffle]);

  /* -------------------------------------------------------
     VOLUME
  ------------------------------------------------------- */

  useEffect(() => {
    audio.current.volume = volume;
  }, [volume]);

  /* -------------------------------------------------------
     PLAY TRACK
  ------------------------------------------------------- */

  async function playTrack(track) {
    if (!track?.audio_url) {
      return;
    }

    const player = audio.current;

    if (current?.id === track.id) {
      if (player.paused) {
        try {
          await player.play();
          setPlaying(true);
        } catch {
          setPlaying(false);
        }
      } else {
        player.pause();
        setPlaying(false);
      }

      return;
    }

    try {
      player.pause();

      player.src = track.audio_url;

      player.currentTime = 0;

      setCurrent(track);
      setProgress(0);
      setDuration(
        Number(track.duration) || 0
      );

      await player.play();

      setPlaying(true);

      if (user && track.id) {
        api(`/api/tracks/${track.id}/play`, {
          method: "POST",
        }).catch(() => {});
      }
    } catch {
      setPlaying(false);
    }
  }

  /* -------------------------------------------------------
     NEXT
  ------------------------------------------------------- */

  function nextTrack() {
    if (!tracks.length) {
      return;
    }

    if (!current) {
      playTrack(tracks[0]);
      return;
    }

    if (shuffle) {
      if (tracks.length === 1) {
        playTrack(tracks[0]);
        return;
      }

      const available = tracks.filter(
        (track) => track.id !== current.id
      );

      const random =
        available[
          Math.floor(
            Math.random() * available.length
          )
        ];

      playTrack(random);
      return;
    }

    const index = tracks.findIndex(
      (track) => track.id === current.id
    );

    const nextIndex =
      (index + 1 + tracks.length) %
      tracks.length;

    playTrack(tracks[nextIndex]);
  }

  /* -------------------------------------------------------
     PREVIOUS
  ------------------------------------------------------- */

  function previousTrack() {
    if (!tracks.length) {
      return;
    }

    if (!current) {
      playTrack(tracks[0]);
      return;
    }

    if (audio.current.currentTime > 5) {
      audio.current.currentTime = 0;
      return;
    }

    const index = tracks.findIndex(
      (track) => track.id === current.id
    );

    const previousIndex =
      (index - 1 + tracks.length) %
      tracks.length;

    playTrack(tracks[previousIndex]);
  }

  /* -------------------------------------------------------
     LIKE
  ------------------------------------------------------- */

  async function likeTrack(track) {
    if (!track) {
      return;
    }

    if (!user) {
      setAuth(true);
      return;
    }

    try {
      const data = await api(
        `/api/tracks/${track.id}/like`,
        {
          method: "POST",
        }
      );

      setTracks((currentTracks) =>
        currentTracks.map((item) =>
          item.id === track.id
            ? {
                ...item,
                liked: data.liked,
              }
            : item
        )
      );

      setLiked((currentLiked) => {
        if (data.liked) {
          const exists = currentLiked.some(
            (item) => item.id === track.id
          );

          if (exists) {
            return currentLiked;
          }

          return [...currentLiked, { ...track, liked: true }];
        }

        return currentLiked.filter(
          (item) => item.id !== track.id
        );
      });
    } catch {
      // Ошибка лайка
    }
  }

  /* -------------------------------------------------------
     RADIO
  ------------------------------------------------------- */

  function playRadio(station) {
    if (!station?.stream_url) {
      return;
    }

    const player = audio.current;

    player.pause();

    player.src = station.stream_url;

    player.currentTime = 0;

    setCurrent({
      id: `radio-${station.id}`,
      title: station.name,
      artist: "Радио",
      album: station.genre || "Прямой эфир",
      cover_url: station.cover,
      audio_url: station.stream_url,
      duration: 0,
      radio: true,
    });

    setProgress(0);
    setDuration(0);

    player
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }

  /* -------------------------------------------------------
     SEARCH
  ------------------------------------------------------- */

  const filteredTracks = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return tracks;
    }

    return tracks.filter((track) => {
      const text = [
        track?.title,
        track?.artist,
        track?.album,
        track?.genre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }, [tracks, query]);

  /* -------------------------------------------------------
     PAGE LOAD
  ------------------------------------------------------- */

  async function loadPage(nextPage) {
    setPage(nextPage);

    setMobile(false);

    if (nextPage === "history" && user) {
      api("/api/history")
        .then((data) => {
          setHistory(
            Array.isArray(data) ? data : []
          );
        })
        .catch(() => {
          setHistory([]);
        });
    }

    if (nextPage === "favorites" && user) {
      api("/api/favorites")
        .then((data) => {
          setLiked(
            Array.isArray(data) ? data : []
          );
        })
        .catch(() => {
          setLiked([]);
        });
    }
  }

  /* -------------------------------------------------------
     SEARCH PAGE
  ------------------------------------------------------- */

  function handleSearch(value) {
    setQuery(value);

    if (value.trim()) {
      setPage("search");
    } else {
      setPage("home");
    }
  }

  /* -------------------------------------------------------
     LOGOUT
  ------------------------------------------------------- */

  function logout() {
    audio.current.pause();

    setPlaying(false);
    setCurrent(null);

    localStorage.removeItem("fenix_token");

    setUser(null);
    setLiked([]);
    setHistory([]);

    setPage("home");
  }

  /* -------------------------------------------------------
     PLAYER SEEK
  ------------------------------------------------------- */

  function seek(event) {
    const value = Number(event.target.value);

    audio.current.currentTime = value;

    setProgress(value);
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app">
      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside
        className={
          mobile
            ? "sidebar open"
            : "sidebar"
        }
      >
        <div className="brand">
          FENIX<span>MUSIC</span>
        </div>

        <nav>
          <button
            type="button"
            className={
              page === "home"
                ? "nav active"
                : "nav"
            }
            onClick={() => loadPage("home")}
          >
            <Home />
            Для вас
          </button>

          <button
            type="button"
            className={
              page === "radio"
                ? "nav active"
                : "nav"
            }
            onClick={() => loadPage("radio")}
          >
            <RadioIcon />
            Радио
          </button>

          <button
            type="button"
            className={
              page === "favorites"
                ? "nav active"
                : "nav"
            }
            onClick={() => loadPage("favorites")}
          >
            <Heart />
            Избранное
          </button>

          <button
            type="button"
            className={
              page === "history"
                ? "nav active"
                : "nav"
            }
            onClick={() => loadPage("history")}
          >
            <History />
            История
          </button>

          <button
            type="button"
            className={
              page === "playlists"
                ? "nav active"
                : "nav"
            }
            onClick={() => loadPage("playlists")}
          >
            <ListMusic />
            Плейлисты
          </button>
        </nav>

        <div className="side-bottom">
          {user ? (
            <>
              <div className="profile-mini">
                <div className="avatar">
                  {getInitial(user.username)}
                </div>

                <div>
                  <b>
                    {user.username || "Пользователь"}
                  </b>

                  <span>
                    {user.telegram
                      ? "Telegram"
                      : "FENIX аккаунт"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="nav"
                onClick={logout}
              >
                <LogOut />
                Выйти
              </button>
            </>
          ) : (
            <button
              type="button"
              className="login-side"
              onClick={() => setAuth(true)}
            >
              <LogIn />
              Войти
            </button>
          )}
        </div>
      </aside>

      {/* ===================================================
          MAIN
      =================================================== */}

      <main>
        <header>
          <button
            type="button"
            className="mobile-menu"
            onClick={() =>
              setMobile((value) => !value)
            }
          >
            <Menu />
          </button>

          <div className="search">
            <Search size={19} />

            <input
              value={query}
              onChange={(event) =>
                handleSearch(event.target.value)
              }
              placeholder="Поиск музыки, артистов, альбомов…"
            />
          </div>

          <button
            type="button"
            className="profile-btn"
            onClick={() => {
              if (!user) {
                setAuth(true);
              }
            }}
          >
            <User size={19} />

            <span>
              {user
                ? user.username || "Профиль"
                : "Войти"}
            </span>
          </button>
        </header>

        <section className="content">
          {/* =================================================
              HOME
          ================================================= */}

          {page === "home" && (
            <>
              <div className="hero">
                <div>
                  <span className="eyebrow">
                    FENIX MUSIC
                  </span>

                  <h1>
                    Музыка,
                    <br />
                    <em>которая</em> рядом.
                  </h1>

                  <p>
                    Слушай любимые треки и прямой
                    эфир радио в одном месте.
                  </p>

                  <button
                    type="button"
                    className="primary hero-btn"
                    onClick={() => {
                      if (tracks[0]) {
                        playTrack(tracks[0]);
                      }
                    }}
                  >
                    <Play
                      size={18}
                      fill="currentColor"
                    />
                    Начать слушать
                  </button>
                </div>

                <div className="hero-orb">
                  <Music2 />
                </div>
              </div>

              <h2>Популярное</h2>

              <div className="tracks">
                {tracks
                  .slice(0, 10)
                  .map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      onPlay={playTrack}
                      onLike={likeTrack}
                    />
                  ))}
              </div>

              {tracks.length === 0 && (
                <Empty text="Музыка пока не загружена" />
              )}
            </>
          )}

          {/* =================================================
              SEARCH
          ================================================= */}

          {page === "search" && (
            <>
              <h2>Результаты поиска</h2>

              {filteredTracks.length ? (
                <div className="tracks">
                  {filteredTracks.map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      onPlay={playTrack}
                      onLike={likeTrack}
                    />
                  ))}
                </div>
              ) : (
                <Empty text="Ничего не найдено" />
              )}
            </>
          )}

          {/* =================================================
              RADIO
          ================================================= */}

          {page === "radio" && (
            <>
              <h2>Радио</h2>

              <p className="muted">
                Прямой эфир · слушай без остановки
              </p>

              {radio.length ? (
                <div className="radio-grid">
                  {radio.map((station) => (
                    <button
                      type="button"
                      className="radio-card"
                      key={station.id}
                      onClick={() =>
                        playRadio(station)
                      }
                    >
                      <img
                        src={station.cover}
                        alt={station.name}
                      />

                      <div>
                        <b>{station.name}</b>

                        <span>
                          {station.genre}
                          {station.bitrate
                            ? ` · ${station.bitrate}`
                            : ""}
                        </span>

                        <small>
                          ▶ В эфир
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty text="Радиостанции пока недоступны" />
              )}
            </>
          )}

          {/* =================================================
              FAVORITES
          ================================================= */}

          {page === "favorites" && (
            <>
              <h2>Избранное</h2>

              {user ? (
                liked.length ? (
                  <div className="tracks">
                    {liked.map((track) => (
                      <TrackRow
                        key={track.id}
                        track={{
                          ...track,
                          liked: true,
                        }}
                        onPlay={playTrack}
                        onLike={likeTrack}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty text="Добавляй треки в избранное" />
                )
              ) : (
                <Empty text="Войди, чтобы увидеть избранное" />
              )}
            </>
          )}

          {/* =================================================
              HISTORY
          ================================================= */}

          {page === "history" && (
            <>
              <h2>Недавно прослушанное</h2>

              {user ? (
                history.length ? (
                  <div className="tracks">
                    {history.map((track, index) => (
                      <TrackRow
                        key={
                          track.id
                            ? `${track.id}-${index}`
                            : index
                        }
                        track={track}
                        onPlay={playTrack}
                        onLike={likeTrack}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty text="История пока пустая" />
                )
              ) : (
                <Empty text="Войди, чтобы увидеть историю" />
              )}
            </>
          )}

          {/* =================================================
              PLAYLISTS
          ================================================= */}

          {page === "playlists" && (
            <>
              <h2>Плейлисты</h2>

              {user ? (
                <PlaylistPage />
              ) : (
                <Empty text="Войди, чтобы создавать плейлисты" />
              )}
            </>
          )}
        </section>
      </main>

      {/* ===================================================
          PLAYER
      =================================================== */}

      {current && (
        <div className="player">
          <Cover track={current} />

          <div className="now">
            <b>{current.title}</b>
            <span>{current.artist}</span>
          </div>

          <div className="controls">
            <button
              type="button"
              className={shuffle ? "active" : ""}
              onClick={() =>
                setShuffle((value) => !value)
              }
              title="Перемешивание"
            >
              <Shuffle />
            </button>

            <button
              type="button"
              onClick={previousTrack}
              title="Предыдущий"
            >
              <SkipBack />
            </button>

            <button
              type="button"
              className="play-main"
              onClick={() => playTrack(current)}
              title={
                playing
                  ? "Пауза"
                  : "Воспроизвести"
              }
            >
              {playing ? (
                <Pause fill="currentColor" />
              ) : (
                <Play fill="currentColor" />
              )}
            </button>

            <button
              type="button"
              onClick={nextTrack}
              title="Следующий"
            >
              <SkipForward />
            </button>

            <button
              type="button"
              className={repeat ? "active" : ""}
              onClick={() =>
                setRepeat((value) => !value)
              }
              title="Повтор"
            >
              <Repeat2 />
            </button>
          </div>

          <div className="seek">
            <span>{formatTime(progress)}</span>

            <input
              type="range"
              min="0"
              max={duration || 100}
              value={Math.min(
                progress,
                duration || 100
              )}
              onChange={seek}
            />

            <span>{formatTime(duration)}</span>
          </div>

          <div className="vol">
            {volume === 0 ? (
              <VolumeX />
            ) : (
              <Volume2 />
            )}

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) =>
                setVolume(
                  Number(event.target.value)
                )
              }
            />
          </div>
        </div>
      )}

      {/* ===================================================
          AUTH MODAL
      =================================================== */}

      {auth && (
        <Auth
          onClose={() => setAuth(false)}
          onAuth={(nextUser) => setUser(nextUser)}
        />
      )}
    </div>
  );
}

/* =========================================================
   START REACT
========================================================= */

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "FENIX MUSIC: элемент #root не найден в index.html"
  );
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
