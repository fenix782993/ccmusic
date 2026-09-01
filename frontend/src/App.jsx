```jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

const API = "/api";

const api = async (url, options = {}) => {
  const response = await fetch(`${API}${url}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || "Ошибка запроса");
  }

  return data;
};

const formatTime = (seconds = 0) => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(value / 60);
  const secs = String(value % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
};

const DEFAULT_COVER =
  "https://placehold.co/700x700/09090b/ffffff?text=FX";

function Icon({ name }) {
  const icons = {
    home: "⌂",
    search: "⌕",
    music: "♫",
    heart: "♥",
    history: "◷",
    user: "●",
    settings: "⚙",
    shield: "♢",
    lock: "▣",
    close: "×",
    play: "▶",
    pause: "Ⅱ",
    next: "▶|",
    previous: "|◀",
    shuffle: "⤨",
    repeat: "↻",
    volume: "◖",
    refresh: "↻",
    check: "✓",
    queue: "☷",
    plus: "+",
    logout: "↪",
  };

  return <span className="icon">{icons[name] || "•"}</span>;
}

function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);

  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);

  const [settings, setSettings] = useState({
    theme: "dark",
    quality: "high",
    autoplay: true,
    autoNext: true,
    notifications: true,
    language: "ru",
  });

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [playing, setPlaying] = useState(false);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");

  const [queueOpen, setQueueOpen] = useState(false);
  const [fullPlayer, setFullPlayer] = useState(false);

  const audioRef = useRef(null);

  useEffect(() => {
    loadTracks();
    loadMe();

    const savedSettings = localStorage.getItem(
      "fenix_music_settings"
    );

    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "fenix_music_settings",
      JSON.stringify(settings)
    );

    document.body.dataset.theme = settings.theme;
  }, [settings]);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setHistory([]);
      return;
    }

    loadFavorites();
    loadHistory();
  }, [user]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    const audio = audioRef.current;

    const onTime = () => {
      setPosition(audio.currentTime || 0);
    };

    const onLoaded = () => {
      setDuration(audio.duration || Number(currentTrack.duration) || 0);
    };

    const onEnded = () => {
      handleTrackEnded();
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrack, queue, repeat, shuffle]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    if (playing) {
      audioRef.current.play().catch(() => {
        setPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [playing, currentTrack]);

  async function loadMe() {
    try {
      const data = await api("/auth/me");
      setUser(data.user || null);
    } catch {
      setUser(null);
    }
  }

  async function loadTracks() {
    try {
      const data = await api("/tracks");
      setTracks(data.tracks || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadFavorites() {
    try {
      const data = await api("/favorites");
      setFavorites(data.tracks || []);
    } catch {}
  }

  async function loadHistory() {
    try {
      const data = await api("/history");
      setHistory(data.tracks || []);
    } catch {}
  }

  function playTrack(track, newQueue = null) {
    if (!track) return;

    const list =
      newQueue && newQueue.length
        ? newQueue
        : tracks;

    setQueue(list);
    setCurrentTrack(track);
    setPosition(0);
    setDuration(Number(track.duration) || 0);
    setPlaying(true);

    api(`/tracks/${track.id}/play`, {
      method: "POST",
    }).catch(() => {});

    if (user) {
      api("/history", {
        method: "POST",
        body: JSON.stringify({
          track_id: track.id,
        }),
      })
        .then(() => loadHistory())
        .catch(() => {});
    }
  }

  function togglePlaying() {
    if (!currentTrack) {
      if (tracks.length) {
        playTrack(tracks[0], tracks);
      }
      return;
    }

    setPlaying((value) => !value);
  }

  function nextTrack() {
    if (!currentTrack || !queue.length) return;

    if (repeat === "one") {
      setPosition(0);
      setPlaying(true);

      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }

      return;
    }

    let index = queue.findIndex(
      (track) =>
        String(track.id) === String(currentTrack.id)
    );

    let nextIndex;

    if (shuffle) {
      const available = queue
        .map((_, i) => i)
        .filter((i) => i !== index);

      nextIndex =
        available.length
          ? available[
              Math.floor(
                Math.random() * available.length
              )
            ]
          : index;
    } else {
      nextIndex = index + 1;

      if (nextIndex >= queue.length) {
        if (repeat === "all") {
          nextIndex = 0;
        } else {
          setPlaying(false);
          return;
        }
      }
    }

    playTrack(queue[nextIndex], queue);
  }

  function previousTrack() {
    if (!currentTrack || !queue.length) return;

    if (
      audioRef.current &&
      audioRef.current.currentTime > 5
    ) {
      audioRef.current.currentTime = 0;
      setPosition(0);
      return;
    }

    const index = queue.findIndex(
      (track) =>
        String(track.id) === String(currentTrack.id)
    );

    let previousIndex = index - 1;

    if (previousIndex < 0) {
      previousIndex =
        repeat === "all"
          ? queue.length - 1
          : 0;
    }

    playTrack(queue[previousIndex], queue);
  }

  function handleTrackEnded() {
    if (repeat === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }

      return;
    }

    if (settings.autoNext) {
      nextTrack();
    } else {
      setPlaying(false);
    }
  }

  function seek(event) {
    const value = Number(event.target.value);

    if (!audioRef.current || !duration) return;

    const time = value * duration;

    audioRef.current.currentTime = time;
    setPosition(time);
  }

  function logout() {
    api("/auth/logout", {
      method: "POST",
    }).catch(() => {});

    setUser(null);
    setFavorites([]);
    setHistory([]);
    setPage("home");
    setAuthOpen(false);
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  function handleAuthSuccess(account) {
    setUser(account);
    setAuthOpen(false);
    setPage("profile");
  }

  async function toggleFavorite(track) {
    if (!user) {
      openAuth("login");
      return;
    }

    const exists = favorites.some(
      (item) =>
        String(item.id) === String(track.id)
    );

    try {
      if (exists) {
        await api(`/favorites/${track.id}`, {
          method: "DELETE",
        });
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

  const isFavorite = (track) =>
    favorites.some(
      (item) =>
        String(item.id) === String(track?.id)
    );

  return (
    <div className="app-shell">
      <audio
        ref={audioRef}
        src={
          currentTrack
            ? currentTrack.audio_url ||
              `/api/tracks/${currentTrack.id}/audio`
            : undefined
        }
        preload="metadata"
      />

      <Sidebar
        page={page}
        setPage={setPage}
        user={user}
        openAuth={openAuth}
        logout={logout}
      />

      <main className="main-content">
        <MobileHeader
          page={page}
          setPage={setPage}
          user={user}
          openAuth={openAuth}
        />

        {page === "home" && (
          <HomePage
            tracks={tracks}
            playTrack={playTrack}
            toggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
            currentTrack={currentTrack}
            playing={playing}
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
            favorites={favorites}
            playTrack={playTrack}
            toggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
            user={user}
            openAuth={openAuth}
          />
        )}

        {page === "history" && (
          <HistoryPage
            history={history}
            playTrack={playTrack}
            user={user}
            openAuth={openAuth}
          />
        )}

        {page === "profile" && (
          <ProfilePage
            user={user}
            setUser={setUser}
            history={history}
            favorites={favorites}
            logout={logout}
            setPage={setPage}
          />
        )}

        {page === "settings" && (
          <SettingsPage
            settings={settings}
            setSettings={setSettings}
            logout={logout}
          />
        )}

        {page === "security" && (
          <SecurityPage
            user={user}
            openAuth={() => openAuth("login")}
          />
        )}

        {![
          "home",
          "search",
          "favorites",
          "history",
          "profile",
          "settings",
          "security",
        ].includes(page) && (
          <HomePage
            tracks={tracks}
            playTrack={playTrack}
            toggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
            currentTrack={currentTrack}
            playing={playing}
            setPage={setPage}
          />
        )}
      </main>

      {currentTrack && (
        <PlayerBar
          track={currentTrack}
          playing={playing}
          position={position}
          duration={duration}
          volume={volume}
          setVolume={setVolume}
          shuffle={shuffle}
          setShuffle={setShuffle}
          repeat={repeat}
          setRepeat={setRepeat}
          togglePlaying={togglePlaying}
          nextTrack={nextTrack}
          previousTrack={previousTrack}
          seek={seek}
          openFull={() => setFullPlayer(true)}
          openQueue={() => setQueueOpen(true)}
        />
      )}

      {queueOpen && currentTrack && (
        <QueuePanel
          queue={queue}
          currentTrack={currentTrack}
          playTrack={playTrack}
          close={() => setQueueOpen(false)}
        />
      )}

      {fullPlayer && currentTrack && (
        <FullPlayer
          track={currentTrack}
          playing={playing}
          position={position}
          duration={duration}
          shuffle={shuffle}
          setShuffle={setShuffle}
          repeat={repeat}
          setRepeat={setRepeat}
          togglePlaying={togglePlaying}
          nextTrack={nextTrack}
          previousTrack={previousTrack}
          seek={seek}
          close={() => setFullPlayer(false)}
        />
      )}

      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          close={() => setAuthOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
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
      <div className="brand">
        <div className="brand-mark">FX</div>

        <div>
          <strong>FENIX</strong>
          <span>MUSIC</span>
        </div>
      </div>

      <nav>
        <button
          className={page === "home" ? "active" : ""}
          onClick={() => setPage("home")}
        >
          <Icon name="home" />
          Главная
        </button>

        <button
          className={page === "search" ? "active" : ""}
          onClick={() => setPage("search")}
        >
          <Icon name="search" />
          Поиск
        </button>

        <button
          className={
            page === "favorites" ? "active" : ""
          }
          onClick={() => setPage("favorites")}
        >
          <Icon name="heart" />
          Избранное
        </button>

        <button
          className={
            page === "history" ? "active" : ""
          }
          onClick={() => setPage("history")}
        >
          <Icon name="history" />
          История
        </button>
      </nav>

      <div className="sidebar-bottom">
        {user ? (
          <>
            <button
              className={
                page === "profile" ? "active" : ""
              }
              onClick={() => setPage("profile")}
            >
              <Icon name="user" />
              Профиль
            </button>

            <button
              className={
                page === "settings" ? "active" : ""
              }
              onClick={() => setPage("settings")}
            >
              <Icon name="settings" />
              Настройки
            </button>
          </>
        ) : (
          <button
            className="login-sidebar"
            onClick={() => openAuth("login")}
          >
            <Icon name="user" />
            Войти
          </button>
        )}
      </div>
    </aside>
  );
}

function MobileHeader({
  page,
  setPage,
  user,
  openAuth,
}) {
  return (
    <header className="mobile-header">
      <button
        className="mobile-logo"
        onClick={() => setPage("home")}
      >
        FX
      </button>

      <strong>
        {page === "search"
          ? "Поиск"
          : page === "favorites"
          ? "Избранное"
          : page === "history"
          ? "История"
          : page === "profile"
          ? "Профиль"
          : "Fenix Music"}
      </strong>

      <button
        className="mobile-user"
        onClick={() =>
          user
            ? setPage("profile")
            : openAuth("login")
        }
      >
        <Icon name="user" />
      </button>
    </header>
  );
}

function HomePage({
  tracks,
  playTrack,
  toggleFavorite,
  isFavorite,
  currentTrack,
  playing,
  setPage,
}) {
  const featured = tracks.slice(0, 6);

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="eyebrow">
            FENIX MUSIC
          </span>

          <h1>
            Твоя музыка.
            <br />
            Твой мир.
          </h1>

          <p>
            Слушай любимые треки,
            сохраняй музыку и создавай
            свою коллекцию.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() =>
                featured.length &&
                playTrack(
                  featured[0],
                  featured
                )
              }
            >
              <Icon name="play" />
              Слушать
            </button>

            <button
              className="secondary-button"
              onClick={() => setPage("search")}
            >
              Найти музыку
            </button>
          </div>
        </div>

        <div className="hero-glow">
          <span>FX</span>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              LIBRARY
            </span>
            <h2>Треки</h2>
          </div>

          <span>
            {tracks.length} треков
          </span>
        </div>

        {tracks.length === 0 ? (
          <div className="empty-state">
            Музыки пока нет.
            <br />
            Загруженные через бота треки
            появятся здесь автоматически.
          </div>
        ) : (
          <TrackGrid
            tracks={tracks}
            playTrack={playTrack}
            toggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
            currentTrack={currentTrack}
            playing={playing}
          />
        )}
      </section>
    </div>
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
    const value = query.trim().toLowerCase();

    if (!value) return tracks;

    return tracks.filter((track) =>
      [
        track.title,
        track.artist_name,
        track.album_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [tracks, query]);

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          SEARCH
        </span>

        <h1>Поиск</h1>

        <p>
          Найди любой трек в библиотеке.
        </p>
      </div>

      <div className="search-box">
        <Icon name="search" />

        <input
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Название, исполнитель или альбом..."
        />
      </div>

      <TrackGrid
        tracks={filtered}
        playTrack={playTrack}
        toggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
      />

      {!filtered.length && (
        <div className="empty-state">
          Ничего не найдено.
        </div>
      )}
    </div>
  );
}

function FavoritesPage({
  favorites,
  playTrack,
  toggleFavorite,
  isFavorite,
  user,
  openAuth,
}) {
  if (!user) {
    return (
      <div className="page">
        <div className="empty-state large">
          <Icon name="heart" />

          <h2>
            Твоя музыка здесь
          </h2>

          <p>
            Войди в аккаунт, чтобы
            сохранять любимые треки.
          </p>

          <button
            className="primary-button"
            onClick={() => openAuth("login")}
          >
            Войти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-title">
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
    </div>
  );
}

function HistoryPage({
  history,
  playTrack,
  user,
  openAuth,
}) {
  if (!user) {
    return (
      <div className="page">
        <div className="empty-state large">
          <Icon name="history" />

          <h2>
            История прослушиваний
          </h2>

          <p>
            Войди в аккаунт, чтобы
            сохранять историю.
          </p>

          <button
            className="primary-button"
            onClick={() => openAuth("login")}
          >
            Войти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-title">
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
                <b>{track.title}</b>
                <small>
                  {track.artist_name}
                </small>
              </span>

              <time>
                {formatTime(track.duration)}
              </time>

              <Icon name="play" />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          История пока пустая.
        </div>
      )}
    </div>
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
    <article className="track-card">
      <div className="track-cover">
        <img
          src={
            track.cover_url ||
            DEFAULT_COVER
          }
          alt=""
        />

        <button
          className="card-play"
          onClick={() => playTrack(track)}
        >
          <Icon
            name={active ? "pause" : "play"}
          />
        </button>

        <button
          className={`favorite-button ${
            isFavorite(track) ? "favorite-active" : ""
          }`}
          onClick={() =>
            toggleFavorite(track)
          }
        >
          <Icon name="heart" />
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
  setUser,
  history,
  favorites,
  logout,
  setPage,
}) {
  const [username, setUsername] =
    useState(user?.username || "");

  const [bio, setBio] =
    useState(user?.bio || "");

  useEffect(() => {
    setUsername(user?.username || "");
    setBio(user?.bio || "");
  }, [user]);

  const saveProfile = async () => {
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

      setUser(data.user);
    } catch (error) {
      alert(error.message);
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="empty-state">
          Войди в аккаунт.
        </div>
      </div>
    );
  }

  const totalSeconds = history.reduce(
    (total, track) =>
      total +
      Number(track.duration || 0),
    0
  );

  return (
    <div className="page">
      <div className="profile-header">
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

          <p>
            {user.email ||
              "Аккаунт Fenix Music"}
          </p>
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

        <div>
          <strong>
            {formatTime(totalSeconds)}
          </strong>
          <span>времени</span>
        </div>
      </div>

      <div className="form-card">
        <h2>
          Редактирование профиля
        </h2>

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
          onClick={saveProfile}
        >
          Сохранить
        </button>
      </div>

      <div className="profile-links">
        <button
          onClick={() =>
            setPage("settings")
          }
        >
          <Icon name="settings" />
          Настройки
        </button>

        <button
          onClick={() =>
            setPage("security")
          }
        >
          <Icon name="shield" />
          Безопасность
        </button>

        <button
          className="danger-button"
          onClick={logout}
        >
          <Icon name="logout" />
          Выйти
        </button>
      </div>
    </div>
  );
}

function SettingsPage({
  settings,
  setSettings,
  logout,
}) {
  const update = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          SETTINGS
        </span>

        <h1>Настройки</h1>

        <p>
          Настрой Fenix Music под себя.
        </p>
      </div>

      <div className="settings-card">
        <SettingRow title="Тема">
          <select
            value={settings.theme}
            onChange={(event) =>
              update(
                "theme",
                event.target.value
              )
            }
          >
            <option value="dark">
              Тёмная
            </option>

            <option value="light">
              Светлая
            </option>
          </select>
        </SettingRow>

        <SettingRow title="Качество звука">
          <select
            value={settings.quality}
            onChange={(event) =>
              update(
                "quality",
                event.target.value
              )
            }
          >
            <option value="normal">
              Обычное
            </option>

            <option value="high">
              Высокое
            </option>

            <option value="max">
              Максимальное
            </option>
          </select>
        </SettingRow>

        <ToggleRow
          title="Автоплей"
          value={settings.autoplay}
          onChange={(value) =>
            update("autoplay", value)
          }
        />

        <ToggleRow
          title="Автоматический переход"
          value={settings.autoNext}
          onChange={(value) =>
            update("autoNext", value)
          }
        />

        <ToggleRow
          title="Уведомления"
          value={settings.notifications}
          onChange={(value) =>
            update(
              "notifications",
              value
            )
          }
        />

        <SettingRow title="Язык">
          <select
            value={settings.language}
            onChange={(event) =>
              update(
                "language",
                event.target.value
              )
            }
          >
            <option value="ru">
              Русский
            </option>

            <option value="en">
              English
            </option>
          </select>
        </SettingRow>
      </div>

      <button
        className="danger-button"
        onClick={logout}
      >
        <Icon name="logout" />
        Выйти из аккаунта
      </button>
    </div>
  );
}

function SettingRow({
  title,
  children,
}) {
  return (
    <div className="setting-row">
      <span>{title}</span>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  value,
  onChange,
}) {
  return (
    <div className="setting-row">
      <span>{title}</span>

      <button
        className={`toggle ${
          value ? "on" : ""
        }`}
        onClick={() =>
          onChange(!value)
        }
      >
        <i />
      </button>
    </div>
  );
}

function SecurityPage({
  user,
  openAuth,
}) {
  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          SECURITY
        </span>

        <h1>Безопасность</h1>

        <p>
          Управление доступом к аккаунту.
        </p>
      </div>

      <div className="security-grid">
        <article>
          <Icon name="shield" />

          <h3>
            Защита сессии
          </h3>

          <p>
            Сессия сохраняется после
            входа и не требует повторной
            регистрации каждый раз.
          </p>

          <button
            className="secondary-button"
            onClick={() =>
              alert(
                "Для выхода со всех устройств удалите активные сессии через backend."
              )
            }
          >
            Выйти со всех устройств
          </button>
        </article>

        <article>
          <Icon name="lock" />

          <h3>
            Пароль
          </h3>

          <p>
            Пароль хранится на backend
            только в виде защищённого hash.
          </p>

          <button
            className="secondary-button"
            onClick={openAuth}
          >
            Сменить пароль
          </button>
        </article>

        <article>
          <Icon name="shield" />

          <h3>
            CAPTCHA
          </h3>

          <p>
            При регистрации используется
            серверная CAPTCHA.
          </p>

          <span className="security-ok">
            <Icon name="check" />
            Защита включена
          </span>
        </article>
      </div>

      {!user && (
        <div className="empty-state">
          Войди в аккаунт для управления
          безопасностью.
        </div>
      )}
    </div>
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

  const [captchaText, setCaptchaText] =
    useState("");

  const [captchaAnswer, setCaptchaAnswer] =
    useState("");

  const [captchaId, setCaptchaId] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  async function getCaptcha() {
    setError("");

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
    } catch {
      setCaptchaId("");
      setCaptchaText("");
      setError(
        "Не удалось получить CAPTCHA."
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
      const endpoint =
        mode === "register"
          ? "/auth/register"
          : "/auth/login";

      const payload =
        mode === "register"
          ? {
              username,
              email,
              password,
              captcha:
                captchaAnswer,
              captcha_id:
                captchaId,
            }
          : {
              login: email,
              email,
              username,
              password,
            };

      const data = await api(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify(
            payload
          ),
        }
      );

      onSuccess(
        data.user ||
          data.account
      );
    } catch (err) {
      setError(
        err.message ||
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
      className="modal-backdrop"
      onMouseDown={close}
    >
      <div
        className="auth-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <button
          className="auth-close"
          onClick={close}
        >
          <Icon name="close" />
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
            ? "Создай свой аккаунт"
            : "С возвращением"}
        </h2>

        <p>
          {mode === "register"
            ? "Сохраняй музыку, историю и избранное."
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
              required
              minLength={2}
              maxLength={64}
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
              <div className="captcha-box">
                <strong>
                  {captchaText ||
                    "Загрузка..."}
                </strong>

                <button
                  type="button"
                  onClick={getCaptcha}
                >
                  <Icon name="refresh" />
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

function PlayerBar({
  track,
  playing,
  position,
  duration,
  volume,
  setVolume,
  shuffle,
  setShuffle,
  repeat,
  setRepeat,
  togglePlaying,
  nextTrack,
  previousTrack,
  seek,
  openFull,
  openQueue,
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
    <footer className="player-bar">
      <button
        className="now-playing"
        onClick={openFull}
      >
        <img
          src={
            track.cover_url ||
            DEFAULT_COVER
          }
          alt=""
        />

        <span>
          <b>{track.title}</b>
          <small>
            {track.artist_name}
          </small>
        </span>
      </button>

      <div className="player-center">
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
            <Icon name="shuffle" />
          </button>

          <button onClick={previousTrack}>
            <Icon name="previous" />
          </button>

          <button
            className="player-play"
            onClick={togglePlaying}
          >
            <Icon
              name={
                playing
                  ? "pause"
                  : "play"
              }
            />
          </button>

          <button onClick={nextTrack}>
            <Icon name="next" />
          </button>

          <button
            className={
              repeat !== "off"
                ? "control-active"
                : ""
            }
            onClick={() => {
              setRepeat(
                repeat === "off"
                  ? "all"
                  : repeat === "all"
                  ? "one"
                  : "off"
              );
            }}
          >
            <Icon name="repeat" />
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
      </div>

      <div className="player-right">
        <button onClick={openQueue}>
          <Icon name="queue" />
        </button>

        <Icon name="volume" />

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

function QueuePanel({
  queue,
  currentTrack,
  playTrack,
  close,
}) {
  return (
    <div className="side-panel">
      <div className="queue-heading">
        <h2>Очередь</h2>

        <button onClick={close}>
          <Icon name="close" />
        </button>
      </div>

      <div className="queue-list">
        {queue.map((track) => (
          <button
            className={`queue-item ${
              String(track.id) ===
              String(currentTrack.id)
                ? "active"
                : ""
            }`}
            key={track.id}
            onClick={() => {
              playTrack(track, queue);
              close();
            }}
          >
            <img
              src={
                track.cover_url ||
                DEFAULT_COVER
              }
              alt=""
            />

            <span>
              <b>{track.title}</b>
              <small>
                {track.artist_name}
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FullPlayer({
  track,
  playing,
  position,
  duration,
  shuffle,
  setShuffle,
  repeat,
  setRepeat,
  togglePlaying,
  nextTrack,
  previousTrack,
  seek,
  close,
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
    <div className="full-player">
      <button
        className="full-player-close"
        onClick={close}
      >
        <Icon name="close" />
      </button>

      <div className="full-player-cover">
        <img
          src={
            track.cover_url ||
            DEFAULT_COVER
          }
          alt=""
        />
      </div>

      <div className="full-player-info">
        <span>
          {track.artist_name}
        </span>

        <h1>{track.title}</h1>

        <p>
          {track.album_name}
        </p>
      </div>

      <div className="full-progress">
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={seek}
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

      <div className="full-player-controls">
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
          <Icon name="shuffle" />
        </button>

        <button onClick={previousTrack}>
          <Icon name="previous" />
        </button>

        <button
          className="full-play-button"
          onClick={togglePlaying}
        >
          <Icon
            name={
              playing
                ? "pause"
                : "play"
            }
          />
        </button>

        <button onClick={nextTrack}>
          <Icon name="next" />
        </button>

        <button
          className={
            repeat !== "off"
              ? "control-active"
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
      </div>
    </div>
  );
}

export default App;
```
