import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

const API = "/api";

const DEFAULT_COVER =
  "https://placehold.co/700x700/111116/ffffff?text=FENIX";

async function api(url, options = {}) {
  const response = await fetch(`${API}${url}`, {
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
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        `Ошибка API: ${response.status}`
    );
  }

  return data;
}

function formatTime(value) {
  const seconds = Math.max(
    0,
    Math.floor(Number(value) || 0)
  );

  const minutes = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");

  return `${minutes}:${secs}`;
}

function Icon({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function App() {
  const [page, setPage] = useState("home");

  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);

  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const audioRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!currentTrack) {
      audio.pause();
      return;
    }

    const source =
      currentTrack.audio_url ||
      `/api/tracks/${encodeURIComponent(
        currentTrack.id
      )}/audio`;

    if (audio.src !== new URL(source, window.location.href).href) {
      audio.src = source;
      audio.load();
    }

    if (playing) {
      audio.play().catch((error) => {
        console.error("Audio play error:", error);
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [currentTrack, playing]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    const onTimeUpdate = () => {
      setPosition(audio.currentTime || 0);
    };

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      playNext();
    };

    const onError = () => {
      console.error("Audio loading error");
    };

    audio.addEventListener(
      "timeupdate",
      onTimeUpdate
    );

    audio.addEventListener(
      "loadedmetadata",
      onLoadedMetadata
    );

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener(
        "timeupdate",
        onTimeUpdate
      );

      audio.removeEventListener(
        "loadedmetadata",
        onLoadedMetadata
      );

      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  });

  async function loadInitialData() {
    setLoading(true);
    setApiError("");

    await Promise.allSettled([
      loadTracks(),
      loadUser(),
    ]);

    setLoading(false);
  }

  async function loadTracks() {
    try {
      const data = await api("/tracks");

      const list = Array.isArray(data.tracks)
        ? data.tracks
        : [];

      setTracks(list);
    } catch (error) {
      console.error("Tracks error:", error);
      setTracks([]);
      setApiError(error.message);
    }
  }

  async function loadUser() {
    try {
      const data = await api("/auth/me");

      setUser(data.user || null);
    } catch {
      setUser(null);
    }
  }

  async function loadFavorites() {
    if (!user) {
      return;
    }

    try {
      const data = await api("/favorites");

      setFavorites(
        Array.isArray(data.tracks)
          ? data.tracks
          : []
      );
    } catch {
      setFavorites([]);
    }
  }

  async function loadHistory() {
    if (!user) {
      return;
    }

    try {
      const data = await api("/history");

      setHistory(
        Array.isArray(data.tracks)
          ? data.tracks
          : []
      );
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setHistory([]);
      return;
    }

    loadFavorites();
    loadHistory();
  }, [user]);

  function playTrack(track, list = tracks) {
    if (!track) {
      return;
    }

    setCurrentTrack(track);
    setPlaying(true);
    setPosition(0);

    if (track.duration) {
      setDuration(Number(track.duration));
    } else {
      setDuration(0);
    }

    if (user) {
      api("/history", {
        method: "POST",
        body: JSON.stringify({
          track_id: track.id,
        }),
      }).catch(() => {});
    }

    api(
      `/tracks/${encodeURIComponent(track.id)}/play`,
      {
        method: "POST",
      }
    ).catch(() => {});
  }

  function togglePlay() {
    if (!currentTrack) {
      if (tracks.length > 0) {
        playTrack(tracks[0], tracks);
      }

      return;
    }

    setPlaying((value) => !value);
  }

  function playNext() {
    if (!currentTrack || tracks.length === 0) {
      setPlaying(false);
      return;
    }

    const index = tracks.findIndex(
      (track) =>
        String(track.id) ===
        String(currentTrack.id)
    );

    const nextIndex =
      index >= 0 && index < tracks.length - 1
        ? index + 1
        : 0;

    playTrack(tracks[nextIndex], tracks);
  }

  function playPrevious() {
    if (!currentTrack || tracks.length === 0) {
      return;
    }

    if (
      audioRef.current &&
      audioRef.current.currentTime > 5
    ) {
      audioRef.current.currentTime = 0;
      setPosition(0);
      return;
    }

    const index = tracks.findIndex(
      (track) =>
        String(track.id) ===
        String(currentTrack.id)
    );

    const previousIndex =
      index > 0
        ? index - 1
        : tracks.length - 1;

    playTrack(
      tracks[previousIndex],
      tracks
    );
  }

  function seek(event) {
    const value = Number(event.target.value);

    if (!audioRef.current || !duration) {
      return;
    }

    const time = value * duration;

    audioRef.current.currentTime = time;
    setPosition(time);
  }

  async function toggleFavorite(track) {
    if (!user) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }

    const exists = favorites.some(
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
      } else {
        await api("/favorites", {
          method: "POST",
          body: JSON.stringify({
            track_id: track.id,
          }),
        });
      }

      await loadFavorites();
    } catch (error) {
      console.error(error);
    }
  }

  function isFavorite(track) {
    return favorites.some(
      (item) =>
        String(item.id) ===
        String(track?.id)
    );
  }

  async function logout() {
    try {
      await api("/auth/logout", {
        method: "POST",
      });
    } catch {}

    setUser(null);
    setFavorites([]);
    setHistory([]);
    setPage("home");
  }

  function onAuthSuccess(account) {
    setUser(account || null);
    setAuthOpen(false);
    setPage("profile");

    setTimeout(() => {
      loadFavorites();
      loadHistory();
    }, 100);
  }

  return (
    <div className="fenix-app">
      <audio
        ref={audioRef}
        preload="metadata"
      />

      <Sidebar
        page={page}
        setPage={setPage}
        user={user}
        openAuth={() => {
          setAuthMode("login");
          setAuthOpen(true);
        }}
        logout={logout}
      />

      <div className="fenix-main">
        <MobileHeader
          page={page}
          setPage={setPage}
          user={user}
          openAuth={() => {
            setAuthMode("login");
            setAuthOpen(true);
          }}
        />

        {loading ? (
          <LoadingScreen />
        ) : (
          <>
            {apiError && (
              <div className="api-warning">
                <span>
                  Сервер музыки временно недоступен.
                </span>

                <button
                  onClick={loadInitialData}
                >
                  Повторить
                </button>
              </div>
            )}

            {page === "home" && (
              <HomePage
                tracks={tracks}
                currentTrack={currentTrack}
                playing={playing}
                playTrack={playTrack}
                toggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
                setPage={setPage}
              />
            )}

            {page === "search" && (
              <SearchPage
                tracks={tracks}
                playTrack={playTrack}
                toggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
              />
            )}

            {page === "favorites" && (
              <FavoritesPage
                user={user}
                favorites={favorites}
                playTrack={playTrack}
                toggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
                openAuth={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
              />
            )}

            {page === "history" && (
              <HistoryPage
                user={user}
                history={history}
                playTrack={playTrack}
                openAuth={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
              />
            )}

            {page === "profile" && (
              <ProfilePage
                user={user}
                history={history}
                favorites={favorites}
                setUser={setUser}
                logout={logout}
                setPage={setPage}
              />
            )}

            {page === "settings" && (
              <SettingsPage />
            )}
          </>
        )}
      </div>

      {currentTrack && (
        <Player
          track={currentTrack}
          playing={playing}
          position={position}
          duration={duration}
          volume={volume}
          setVolume={setVolume}
          togglePlay={togglePlay}
          next={playNext}
          previous={playPrevious}
          seek={seek}
        />
      )}

      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          close={() => setAuthOpen(false)}
          onSuccess={onAuthSuccess}
        />
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        FX
      </div>

      <h1>FENIX MUSIC</h1>

      <p>Загрузка музыкальной вселенной...</p>

      <div className="loading-line">
        <span />
      </div>
    </div>
  );
}

function Sidebar({
  page,
  setPage,
  user,
  openAuth,
  logout,
}) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        onClick={() => setPage("home")}
      >
        <div className="brand-logo">
          FX
        </div>

        <div className="brand-text">
          <strong>FENIX</strong>
          <span>MUSIC</span>
        </div>
      </button>

      <nav className="side-nav">
        <NavButton
          active={page === "home"}
          icon="⌂"
          text="Главная"
          onClick={() => setPage("home")}
        />

        <NavButton
          active={page === "search"}
          icon="⌕"
          text="Поиск"
          onClick={() => setPage("search")}
        />

        <NavButton
          active={page === "favorites"}
          icon="♥"
          text="Избранное"
          onClick={() =>
            setPage("favorites")
          }
        />

        <NavButton
          active={page === "history"}
          icon="◷"
          text="История"
          onClick={() =>
            setPage("history")
          }
        />
      </nav>

      <div className="sidebar-bottom">
        {user ? (
          <>
            <NavButton
              active={page === "profile"}
              icon="●"
              text="Профиль"
              onClick={() =>
                setPage("profile")
              }
            />

            <NavButton
              active={page === "settings"}
              icon="⚙"
              text="Настройки"
              onClick={() =>
                setPage("settings")
              }
            />

            <button
              className="logout-button"
              onClick={logout}
            >
              <Icon>↪</Icon>
              Выйти
            </button>
          </>
        ) : (
          <button
            className="login-button"
            onClick={openAuth}
          >
            <Icon>●</Icon>
            Войти
          </button>
        )}
      </div>
    </aside>
  );
}

function NavButton({
  active,
  icon,
  text,
  onClick,
}) {
  return (
    <button
      className={
        active
          ? "nav-button active"
          : "nav-button"
      }
      onClick={onClick}
    >
      <Icon>{icon}</Icon>
      <span>{text}</span>
    </button>
  );
}

function MobileHeader({
  page,
  setPage,
  user,
  openAuth,
}) {
  const titles = {
    home: "Fenix Music",
    search: "Поиск",
    favorites: "Избранное",
    history: "История",
    profile: "Профиль",
    settings: "Настройки",
  };

  return (
    <header className="mobile-header">
      <button
        className="mobile-logo"
        onClick={() => setPage("home")}
      >
        FX
      </button>

      <strong>
        {titles[page] || "Fenix Music"}
      </strong>

      <button
        className="mobile-user"
        onClick={() =>
          user
            ? setPage("profile")
            : openAuth()
        }
      >
        {user ? "●" : "○"}
      </button>
    </header>
  );
}

function HomePage({
  tracks,
  currentTrack,
  playing,
  playTrack,
  toggleFavorite,
  isFavorite,
  setPage,
}) {
  const featured = tracks.slice(0, 6);

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            FENIX MUSIC
          </span>

          <h1>
            Твоя музыка.
            <br />
            Твой мир.
          </h1>

          <p>
            Слушай музыку, сохраняй любимые
            треки и собирай собственную
            коллекцию.
          </p>

          <div className="hero-buttons">
            <button
              className="primary-button"
              disabled={!featured.length}
              onClick={() => {
                if (featured.length) {
                  playTrack(
                    featured[0],
                    featured
                  );
                }
              }}
            >
              ▶ Слушать
            </button>

            <button
              className="secondary-button"
              onClick={() => setPage("search")}
            >
              Найти музыку
            </button>
          </div>
        </div>

        <div className="hero-art">
          <div className="hero-disc">
            <span>FX</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              LIBRARY
            </span>

            <h2>Музыка</h2>
          </div>

          <span>
            {tracks.length} треков
          </span>
        </div>

        {tracks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              ♫
            </div>

            <h3>Музыки пока нет</h3>

            <p>
              Треки, загруженные через бота,
              появятся здесь автоматически.
            </p>
          </div>
        ) : (
          <TrackGrid
            tracks={tracks}
            currentTrack={currentTrack}
            playing={playing}
            playTrack={playTrack}
            toggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
          />
        )}
      </section>
    </main>
  );
}

function SearchPage({
  tracks,
  playTrack,
  toggleFavorite,
  isFavorite,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const value = query
      .trim()
      .toLowerCase();

    if (!value) {
      return tracks;
    }

    return tracks.filter((track) => {
      const text = [
        track.title,
        track.artist_name,
        track.album_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(value);
    });
  }, [tracks, query]);

  return (
    <main className="page">
      <div className="page-heading">
        <span className="eyebrow">
          SEARCH
        </span>

        <h1>Поиск</h1>

        <p>
          Найди любой трек в музыкальной
          библиотеке.
        </p>
      </div>

      <div className="search-input">
        <span>⌕</span>

        <input
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Название, исполнитель или альбом..."
        />
      </div>

      {filtered.length ? (
        <TrackGrid
          tracks={filtered}
          playTrack={playTrack}
          toggleFavorite={toggleFavorite}
          isFavorite={isFavorite}
        />
      ) : (
        <div className="empty-state">
          Ничего не найдено.
        </div>
      )}
    </main>
  );
}

function FavoritesPage({
  user,
  favorites,
  playTrack,
  toggleFavorite,
  isFavorite,
  openAuth,
}) {
  if (!user) {
    return (
      <main className="page">
        <div className="empty-state large">
          <div className="empty-icon">
            ♥
          </div>

          <h2>Твоя коллекция</h2>

          <p>
            Войди в аккаунт, чтобы сохранять
            любимые треки.
          </p>

          <button
            className="primary-button"
            onClick={openAuth}
          >
            Войти
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-heading">
        <span className="eyebrow">
          COLLECTION
        </span>

        <h1>Избранное</h1>

        <p>
          {favorites.length} сохранённых
          треков.
        </p>
      </div>

      {favorites.length ? (
        <TrackGrid
          tracks={favorites}
          playTrack={playTrack}
          toggleFavorite={toggleFavorite}
          isFavorite={isFavorite}
        />
      ) : (
        <div className="empty-state">
          В избранном пока ничего нет.
        </div>
      )}
    </main>
  );
}

function HistoryPage({
  user,
  history,
  playTrack,
  openAuth,
}) {
  if (!user) {
    return (
      <main className="page">
        <div className="empty-state large">
          <div className="empty-icon">
            ◷
          </div>

          <h2>История прослушиваний</h2>

          <p>
            Войди в аккаунт, чтобы сохранять
            историю.
          </p>

          <button
            className="primary-button"
            onClick={openAuth}
          >
            Войти
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-heading">
        <span className="eyebrow">
          HISTORY
        </span>

        <h1>История</h1>

        <p>
          Последние прослушанные треки.
        </p>
      </div>

      {history.length ? (
        <div className="history-list">
          {history.map((track, index) => (
            <button
              className="history-item"
              key={`${track.id}-${index}`}
              onClick={() =>
                playTrack(track, history)
              }
            >
              <img
                src={
                  track.cover_url ||
                  DEFAULT_COVER
                }
                alt=""
              />

              <span>
                <strong>{track.title}</strong>
                <small>
                  {track.artist_name ||
                    "Fenix Music"}
                </small>
              </span>

              <time>
                {formatTime(track.duration)}
              </time>

              <b>▶</b>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          История пока пустая.
        </div>
      )}
    </main>
  );
}

function TrackGrid({
  tracks,
  playTrack,
  toggleFavorite,
  isFavorite,
  currentTrack,
  playing,
}) {
  return (
    <div className="track-grid">
      {tracks.map((track) => (
        <TrackCard
          key={track.id}
          track={track}
          playTrack={playTrack}
          toggleFavorite={toggleFavorite}
          isFavorite={isFavorite}
          currentTrack={currentTrack}
          playing={playing}
        />
      ))}
    </div>
  );
}

function TrackCard({
  track,
  playTrack,
  toggleFavorite,
  isFavorite,
  currentTrack,
  playing,
}) {
  const active =
    String(currentTrack?.id) ===
      String(track.id) && playing;

  return (
    <article
      className={
        active
          ? "track-card active"
          : "track-card"
      }
    >
      <div className="track-cover">
        <img
          src={
            track.cover_url ||
            DEFAULT_COVER
          }
          alt=""
          onError={(event) => {
            event.currentTarget.src =
              DEFAULT_COVER;
          }}
        />

        <button
          className="track-play"
          onClick={() =>
            playTrack(track)
          }
        >
          {active ? "Ⅱ" : "▶"}
        </button>

        <button
          className={
            isFavorite(track)
              ? "track-heart active"
              : "track-heart"
          }
          onClick={() =>
            toggleFavorite(track)
          }
        >
          ♥
        </button>
      </div>

      <div className="track-info">
        <strong>{track.title}</strong>

        <span>
          {track.artist_name ||
            "Неизвестный исполнитель"}
        </span>

        {track.album_name && (
          <small>
            {track.album_name}
          </small>
        )}
      </div>
    </article>
  );
}

function ProfilePage({
  user,
  history,
  favorites,
  setUser,
  logout,
  setPage,
}) {
  const [username, setUsername] =
    useState(user?.username || "");

  const [bio, setBio] =
    useState(user?.bio || "");

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    setUsername(user?.username || "");
    setBio(user?.bio || "");
  }, [user]);

  async function saveProfile() {
    setSaving(true);

    try {
      const data = await api(
        "/auth/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            username,
            bio,
          }),
        }
      );

      setUser(data.user || user);
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="profile-card">
        <div className="profile-avatar">
          {(username || "FX")
            .slice(0, 2)
            .toUpperCase()}
        </div>

        <div>
          <span className="eyebrow">
            PROFILE
          </span>

          <h1>
            {username || "Пользователь"}
          </h1>

          <p>{user?.email}</p>
        </div>
      </div>

      <div className="profile-stats">
        <div>
          <strong>
            {history.length}
          </strong>

          <span>прослушиваний</span>
        </div>

        <div>
          <strong>
            {favorites.length}
          </strong>

          <span>избранных</span>
        </div>
      </div>

      <div className="form-card">
        <h2>Профиль</h2>

        <label>
          Username

          <input
            value={username}
            onChange={(event) =>
              setUsername(
                event.target.value
              )
            }
          />
        </label>

        <label>
          Описание

          <textarea
            value={bio}
            onChange={(event) =>
              setBio(event.target.value)
            }
            placeholder="Расскажи о себе"
          />
        </label>

        <button
          className="primary-button"
          disabled={saving}
          onClick={saveProfile}
        >
          {saving
            ? "Сохранение..."
            : "Сохранить"}
        </button>
      </div>

      <div className="profile-links">
        <button
          onClick={() =>
            setPage("settings")
          }
        >
          ⚙ Настройки
        </button>

        <button
          className="danger-button"
          onClick={logout}
        >
          ↪ Выйти
        </button>
      </div>
    </main>
  );
}

function SettingsPage() {
  const [autoplay, setAutoplay] =
    useState(true);

  const [notifications, setNotifications] =
    useState(true);

  return (
    <main className="page">
      <div className="page-heading">
        <span className="eyebrow">
          SETTINGS
        </span>

        <h1>Настройки</h1>

        <p>
          Настрой Fenix Music под себя.
        </p>
      </div>

      <div className="settings-card">
        <div className="setting-row">
          <span>Тёмная тема</span>

          <span className="setting-value">
            Включена
          </span>
        </div>

        <div className="setting-row">
          <span>Автоплей</span>

          <button
            className={
              autoplay
                ? "toggle on"
                : "toggle"
            }
            onClick={() =>
              setAutoplay(
                (value) => !value
              )
            }
          >
            <i />
          </button>
        </div>

        <div className="setting-row">
          <span>Уведомления</span>

          <button
            className={
              notifications
                ? "toggle on"
                : "toggle"
            }
            onClick={() =>
              setNotifications(
                (value) => !value
              )
            }
          >
            <i />
          </button>
        </div>
      </div>
    </main>
  );
}

function Player({
  track,
  playing,
  position,
  duration,
  volume,
  setVolume,
  togglePlay,
  next,
  previous,
  seek,
}) {
  const progress =
    duration > 0
      ? Math.min(
          1,
          Math.max(
            0,
            position / duration
          )
        )
      : 0;

  return (
    <footer className="player">
      <div className="player-track">
        <img
          src={
            track.cover_url ||
            DEFAULT_COVER
          }
          alt=""
        />

        <div>
          <strong>{track.title}</strong>

          <span>
            {track.artist_name ||
              "Fenix Music"}
          </span>
        </div>
      </div>

      <div className="player-controls">
        <button onClick={previous}>
          |◀
        </button>

        <button
          className="player-main"
          onClick={togglePlay}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>

        <button onClick={next}>
          ▶|
        </button>
      </div>

      <div className="player-progress">
        <span>
          {formatTime(position)}
        </span>

        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={seek}
        />

        <span>
          {formatTime(duration)}
        </span>
      </div>

      <div className="player-volume">
        <span>🔊</span>

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
    </footer>
  );
}

function AuthModal({
  mode,
  setMode,
  close,
  onSuccess,
}) {
  const [username, setUsername] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [captchaId, setCaptchaId] =
    useState("");

  const [captchaText, setCaptchaText] =
    useState("");

  const [captchaAnswer, setCaptchaAnswer] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  async function getCaptcha() {
    try {
      const data = await api(
        "/auth/captcha"
      );

      setCaptchaId(
        data.id ||
          data.captcha_id ||
          ""
      );

      setCaptchaText(
        data.text ||
          data.code ||
          data.captcha ||
          ""
      );
    } catch (captchaError) {
      console.error(captchaError);

      setCaptchaId("");
      setCaptchaText(
        "CAPTCHA недоступна"
      );
    }

    setCaptchaAnswer("");
  }

  useEffect(() => {
    if (mode === "register") {
      getCaptcha();
    }
  }, [mode]);

  async function submit(event) {
    event.preventDefault();

    setError("");

    if (
      mode === "register" &&
      password !== confirmPassword
    ) {
      setError(
        "Пароли не совпадают."
      );
      return;
    }

    if (
      mode === "register" &&
      !captchaAnswer.trim()
    ) {
      setError(
        "Введите CAPTCHA."
      );
      return;
    }

    setBusy(true);

    try {
      let data;

      if (mode === "register") {
        data = await api(
          "/auth/register",
          {
            method: "POST",
            body: JSON.stringify({
              username,
              email,
              password,
              captcha:
                captchaAnswer,
              captcha_id:
                captchaId,
            }),
          }
        );
      } else {
        data = await api(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              login: email,
              email,
              username: email,
              password,
            }),
          }
        );
      }

      onSuccess(
        data.user ||
          data.account ||
          null
      );
    } catch (authError) {
      setError(
        authError.message ||
          "Ошибка авторизации."
      );

      if (mode === "register") {
        getCaptcha();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal"
      onMouseDown={close}
    >
      <div
        className="auth-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <button
          className="modal-close"
          onClick={close}
        >
          ×
        </button>

        <div className="auth-logo">
          FX
        </div>

        <span className="eyebrow">
          {mode === "register"
            ? "CREATE ACCOUNT"
            : "WELCOME BACK"}
        </span>

        <h2>
          {mode === "register"
            ? "Создай аккаунт"
            : "С возвращением"}
        </h2>

        <p>
          {mode === "register"
            ? "Сохраняй музыку и собирай свою коллекцию."
            : "Войди в свой Fenix Music аккаунт."}
        </p>

        <form onSubmit={submit}>
          {mode === "register" && (
            <input
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              placeholder="Имя пользователя"
              minLength={2}
              maxLength={64}
              required
            />
          )}

          <input
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            type={
              mode === "register"
                ? "email"
                : "text"
            }
            placeholder={
              mode === "register"
                ? "Email"
                : "Email или username"
            }
            required
          />

          <input
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            type="password"
            placeholder="Пароль"
            minLength={6}
            required
          />

          {mode === "register" && (
            <input
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              type="password"
              placeholder="Повтори пароль"
              minLength={6}
              required
            />
          )}

          {mode === "register" && (
            <>
              <div className="captcha">
                <strong>
                  {captchaText ||
                    "Загрузка..."}
                </strong>

                <button
                  type="button"
                  onClick={getCaptcha}
                >
                  ↻
                </button>
              </div>

              <input
                value={captchaAnswer}
                onChange={(event) =>
                  setCaptchaAnswer(
                    event.target.value
                  )
                }
                placeholder="Введите CAPTCHA"
                required
              />
            </>
          )}

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <button
            className="primary-button wide"
            disabled={busy}
          >
            {busy
              ? "Проверяем..."
              : mode === "register"
              ? "Создать аккаунт"
              : "Войти"}
          </button>
        </form>

        <button
          className="auth-switch"
          onClick={() => {
            setError("");

            setMode(
              mode === "register"
                ? "login"
                : "register"
            );
          }}
        >
          {mode === "register"
            ? "Уже есть аккаунт? Войти"
            : "Нет аккаунта? Регистрация"}
        </button>
      </div>
    </div>
  );
}

export default App;
