```jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" &&
    window.__FENIX_API_URL__) ||
  "";

const DEFAULT_COVER =
  "https://placehold.co/700x700/09090b/ffffff?text=FENIX";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function formatTime(seconds) {
  const value = Number(seconds || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function randomCaptcha() {
  return Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();
}

function getStoredUser() {
  try {
    return JSON.parse(
      localStorage.getItem("fenix_user") || "null"
    );
  } catch {
    return null;
  }
}

function getStoredSettings() {
  try {
    return {
      theme: "dark",
      quality: "high",
      autoplay: true,
      autoNext: true,
      notifications: true,
      language: "ru",
      ...JSON.parse(
        localStorage.getItem("fenix_settings") || "{}"
      ),
    };
  } catch {
    return {
      theme: "dark",
      quality: "high",
      autoplay: true,
      autoNext: true,
      notifications: true,
      language: "ru",
    };
  }
}

function Icon({ name, size = 20 }) {
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
    heart: (
      <path d="M20.8 8.7c0 5.5-8.8 11.2-8.8 11.2S3.2 14.2 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />
    ),
    play: <path d="m8 5 11 7-11 7V5Z" />,
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
    previous: (
      <>
        <path d="m19 5-9 7 9 7V5Z" />
        <path d="M5 5v14" />
      </>
    ),
    shuffle: (
      <>
        <path d="M3 7h3c4 0 7 10 12 10h3" />
        <path d="m18 14 3 3-3 3" />
        <path d="M3 17h3c1.5 0 2.7-1.1 4-2.7" />
        <path d="M14 9.7C15.5 8 16.5 7 18 7h3" />
        <path d="m18 4 3 3-3 3" />
      </>
    ),
    repeat: (
      <>
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11V9a3 3 0 0 1 3-3h15" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v2a3 3 0 0 1-3 3H3" />
      </>
    ),
    volume: (
      <>
        <path d="M4 9v6h4l5 4V5L8 9H4Z" />
        <path d="M17 9.5a4 4 0 0 1 0 5" />
        <path d="M19.5 7a8 8 0 0 1 0 10" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V22h-2.6v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6V11h.4A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v3h-.1a1.7 1.7 0 0 0-1.6.9Z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.5-4L3 10" />
        <path d="M3 5v5h5" />
        <path d="M4 13a8 8 0 0 0 14.5 4L21 14" />
        <path d="M21 19v-5h-5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
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
      aria-hidden="true"
    >
      {paths[name] || null}
    </svg>
  );
}

function App() {
  const [user, setUser] = useState(getStoredUser);
  const [settings, setSettings] = useState(
    getStoredSettings
  );

  const [page, setPage] = useState("home");
  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");

  const [showQueue, setShowQueue] = useState(false);
  const [showFullPlayer, setShowFullPlayer] =
    useState(false);
  const [authMode, setAuthMode] = useState(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const audioRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme =
      settings.theme;

    localStorage.setItem(
      "fenix_settings",
      JSON.stringify(settings)
    );
  }, [settings]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(
        "fenix_user",
        JSON.stringify(user)
      );
    } else {
      localStorage.removeItem("fenix_user");
    }
  }, [user]);

  useEffect(() => {
    loadTracks();
  }, []);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setHistory([]);
      return;
    }

    loadUserData();
  }, [user]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const onTime = () =>
      setPosition(audio.currentTime || 0);

    const onLoaded = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      handleEnded();
    };

    audio.addEventListener(
      "timeupdate",
      onTime
    );

    audio.addEventListener(
      "loadedmetadata",
      onLoaded
    );

    audio.addEventListener(
      "ended",
      onEnded
    );

    return () => {
      audio.removeEventListener(
        "timeupdate",
        onTime
      );

      audio.removeEventListener(
        "loadedmetadata",
        onLoaded
      );

      audio.removeEventListener(
        "ended",
        onEnded
      );
    };
  });

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    const url =
      currentTrack.audio_url ||
      apiUrl(
        `/api/tracks/${currentTrack.id}/audio`
      );

    if (!url) {
      return;
    }

    audio.src = url;
    audio.volume = volume;
    audio.load();

    if (playing) {
      audio
        .play()
        .catch(() => {
          setPlaying(false);
          setMessage(
            "Не удалось воспроизвести этот трек."
          );
        });
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

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

  async function loadTracks() {
    setLoading(true);

    try {
      const response = await fetch(
        apiUrl("/api/tracks"),
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Ошибка загрузки музыки"
        );
      }

      setTracks(
        Array.isArray(data.tracks)
          ? data.tracks
          : []
      );
    } catch (error) {
      setMessage(
        error.message ||
          "Не удалось загрузить музыку."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadUserData() {
    try {
      const [favoritesResponse, historyResponse] =
        await Promise.all([
          fetch(apiUrl("/api/favorites"), {
            credentials: "include",
          }),
          fetch(apiUrl("/api/history"), {
            credentials: "include",
          }),
        ]);

      if (favoritesResponse.ok) {
        const data =
          await favoritesResponse.json();

        setFavorites(
          Array.isArray(data.tracks)
            ? data.tracks
            : []
        );
      }

      if (historyResponse.ok) {
        const data =
          await historyResponse.json();

        setHistory(
          Array.isArray(data.tracks)
            ? data.tracks
            : []
        );
      }
    } catch {
      // Backend may temporarily be unavailable.
    }
  }

  function playTrack(track, sourceQueue = tracks) {
    if (!track) {
      return;
    }

    const nextQueue =
      Array.isArray(sourceQueue) &&
      sourceQueue.length
        ? sourceQueue
        : tracks;

    setQueue(nextQueue);
    setCurrentTrack(track);
    setPosition(0);
    setPlaying(true);
    setShowFullPlayer(false);

    if (user) {
      fetch(
        apiUrl(`/api/history`),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            track_id: track.id,
          }),
        }
      ).catch(() => {});

      setHistory((previous) => [
        {
          ...track,
          played_at:
            new Date().toISOString(),
        },
        ...previous.filter(
          (item) =>
            String(item.id) !==
            String(track.id)
        ),
      ].slice(0, 100));
    } else {
      fetch(
        apiUrl(`/api/tracks/${track.id}/play`),
        {
          method: "POST",
        }
      ).catch(() => {});
    }
  }

  function handleEnded() {
    if (!currentTrack) {
      return;
    }

    if (repeat === "one") {
      setPosition(0);
      setPlaying(false);

      setTimeout(() => {
        const audio = audioRef.current;

        if (!audio) {
          return;
        }

        audio.currentTime = 0;
        audio
          .play()
          .then(() => setPlaying(true))
          .catch(() => {});
      }, 20);

      return;
    }

    nextTrack();
  }

  function nextTrack() {
    if (!currentTrack) {
      return;
    }

    const list =
      queue.length ? queue : tracks;

    if (!list.length) {
      return;
    }

    let index = list.findIndex(
      (item) =>
        String(item.id) ===
        String(currentTrack.id)
    );

    if (shuffle) {
      index =
        Math.floor(Math.random() * list.length);
    } else {
      index += 1;
    }

    if (index >= list.length) {
      if (repeat === "all") {
        index = 0;
      } else {
        setPlaying(false);
        return;
      }
    }

    playTrack(list[index], list);
  }

  function previousTrack() {
    if (!currentTrack) {
      return;
    }

    const audio = audioRef.current;

    if (audio && audio.currentTime > 5) {
      audio.currentTime = 0;
      setPosition(0);
      return;
    }

    const list =
      queue.length ? queue : tracks;

    const index = list.findIndex(
      (item) =>
        String(item.id) ===
        String(currentTrack.id)
    );

    const previousIndex =
      index <= 0
        ? list.length - 1
        : index - 1;

    if (list[previousIndex]) {
      playTrack(
        list[previousIndex],
        list
      );
    }
  }

  function togglePlaying() {
    if (!currentTrack) {
      if (tracks[0]) {
        playTrack(tracks[0], tracks);
      }

      return;
    }

    setPlaying((value) => !value);
  }

  function seek(event) {
    const value = Number(
      event.target.value
    );

    const audio = audioRef.current;

    if (!audio || !duration) {
      return;
    }

    audio.currentTime =
      value * duration;

    setPosition(
      value * duration
    );
  }

  async function toggleFavorite(track) {
    if (!user) {
      setAuthMode("login");
      return;
    }

    const exists = favorites.some(
      (item) =>
        String(item.id) ===
        String(track.id)
    );

    try {
      if (exists) {
        await fetch(
          apiUrl(
            `/api/favorites/${track.id}`
          ),
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        setFavorites((previous) =>
          previous.filter(
            (item) =>
              String(item.id) !==
              String(track.id)
          )
        );
      } else {
        await fetch(
          apiUrl("/api/favorites"),
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              track_id: track.id,
            }),
          }
        );

        setFavorites((previous) => [
          track,
          ...previous,
        ]);
      }
    } catch {
      setMessage(
        "Не удалось изменить избранное."
      );
    }
  }

  function logout() {
    fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
    }).catch(() => {});

    setUser(null);
    setFavorites([]);
    setHistory([]);
    setPage("home");
  }

  function saveUser(account) {
    setUser(account);
    setAuthMode(null);
    setPage("profile");
    setMessage("Аккаунт успешно сохранён.");
  }

  const filteredTracks = useMemo(() => {
    const value =
      search.trim().toLowerCase();

    if (!value) {
      return tracks;
    }

    return tracks.filter((track) =>
      [
        track.title,
        track.artist_name,
        track.album_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [tracks, search]);

  const pageContent = () => {
    if (page === "profile") {
      return (
        <ProfilePage
          user={user}
          setUser={setUser}
          history={history}
          favorites={favorites}
          logout={logout}
          setPage={setPage}
        />
      );
    }

    if (page === "settings") {
      return (
        <SettingsPage
          settings={settings}
          setSettings={setSettings}
          logout={logout}
        />
      );
    }

    if (page === "security") {
      return (
        <SecurityPage
          user={user}
          openAuth={() =>
            setAuthMode("login")
          }
        />
      );
    }

    if (page === "favorites") {
      return (
        <TrackPage
          title="Избранное"
          eyebrow="YOUR MUSIC"
          tracks={favorites}
          emptyText={
            user
              ? "Здесь пока нет избранных треков."
              : "Войди, чтобы использовать избранное."
          }
          playTrack={playTrack}
          currentTrack={currentTrack}
          playing={playing}
          togglePlaying={togglePlaying}
          toggleFavorite={toggleFavorite}
          favorites={favorites}
          requireLogin={() =>
            setAuthMode("login")
          }
        />
      );
    }

    if (page === "history") {
      return (
        <TrackPage
          title="История"
          eyebrow="RECENTLY PLAYED"
          tracks={history}
          emptyText={
            user
              ? "История прослушиваний пока пуста."
              : "Войди, чтобы сохранять историю."
          }
          playTrack={playTrack}
          currentTrack={currentTrack}
          playing={playing}
          togglePlaying={togglePlaying}
          toggleFavorite={toggleFavorite}
          favorites={favorites}
          requireLogin={() =>
            setAuthMode("login")
          }
        />
      );
    }

    return (
      <HomePage
        tracks={filteredTracks}
        allTracks={tracks}
        search={search}
        setSearch={setSearch}
        loading={loading}
        playTrack={playTrack}
        currentTrack={currentTrack}
        playing={playing}
        togglePlaying={togglePlaying}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        setPage={setPage}
      />
    );
  };

  return (
    <div className="app">
      <audio ref={audioRef} preload="metadata" />

      <Sidebar
        page={page}
        setPage={setPage}
        user={user}
        openAuth={() =>
          setAuthMode("login")
        }
      />

      <main className="main-content">
        {message && (
          <div className="toast">
            <span>{message}</span>

            <button
              onClick={() =>
                setMessage("")
              }
            >
              <Icon name="close" size={17} />
            </button>
          </div>
        )}

        {pageContent()}
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
          openFull={() =>
            setShowFullPlayer(true)
          }
          openQueue={() =>
            setShowQueue(true)
          }
        />
      )}

      {showQueue && (
        <QueuePanel
          queue={queue.length ? queue : tracks}
          currentTrack={currentTrack}
          playTrack={playTrack}
          close={() => setShowQueue(false)}
        />
      )}

      {showFullPlayer &&
        currentTrack && (
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
            close={() =>
              setShowFullPlayer(false)
            }
          />
        )}

      {authMode && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          close={() => setAuthMode(null)}
          onSuccess={saveUser}
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
}) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        onClick={() =>
          setPage("home")
        }
      >
        <span className="brand-mark">
          FX
        </span>

        <span>
          FENIX
          <small>MUSIC</small>
        </span>
      </button>

      <nav>
        <button
          className={
            page === "home"
              ? "nav-active"
              : ""
          }
          onClick={() =>
            setPage("home")
          }
        >
          <Icon name="home" />
          Главная
        </button>

        <button
          className={
            page === "favorites"
              ? "nav-active"
              : ""
          }
          onClick={() =>
            setPage("favorites")
          }
        >
          <Icon name="heart" />
          Избранное
        </button>

        <button
          className={
            page === "history"
              ? "nav-active"
              : ""
          }
          onClick={() =>
            setPage("history")
          }
        >
          <Icon name="repeat" />
          История
        </button>
      </nav>

      <div className="sidebar-bottom">
        {user ? (
          <button
            className="user-button"
            onClick={() =>
              setPage("profile")
            }
          >
            <span className="mini-avatar">
              {(user.username ||
                "FX")
                .slice(0, 2)
                .toUpperCase()}
            </span>

            <span>
              <b>
                {user.username ||
                  "Пользователь"}
              </b>

              <small>
                Профиль
              </small>
            </span>
          </button>
        ) : (
          <button
            className="login-sidebar"
            onClick={openAuth}
          >
            <Icon name="user" />
            Войти
          </button>
        )}
      </div>
    </aside>
  );
}

function HomePage({
  tracks,
  allTracks,
  search,
  setSearch,
  loading,
  playTrack,
  currentTrack,
  playing,
  togglePlaying,
  favorites,
  toggleFavorite,
  setPage,
}) {
  return (
    <div className="page">
      <header className="top-header">
        <div>
          <span className="eyebrow">
            FENIX MUSIC
          </span>

          <h1>
            Музыка начинается здесь.
          </h1>

          <p>
            Слушай любимые треки без лишнего.
          </p>
        </div>

        <div className="search-box">
          <Icon name="search" />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Найти трек или исполнителя..."
          />
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="hero-label">
            FENIX MUSIC
          </span>

          <h2>
            Твоя музыка.
            <br />
            Твой ритм.
          </h2>

          <p>
            Все загруженные треки
            появляются здесь автоматически.
          </p>

          {allTracks[0] && (
            <button
              className="primary-button"
              onClick={() =>
                playTrack(
                  allTracks[0],
                  allTracks
                )
              }
            >
              <Icon name="play" />
              Слушать сейчас
            </button>
          )}
        </div>

        <div className="hero-glow">
          FX
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              LIBRARY
            </span>

            <h2>
              Все треки
            </h2>
          </div>

          <span className="track-count">
            {tracks.length} треков
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            Загружаем музыку...
          </div>
        ) : tracks.length ? (
          <TrackGrid
            tracks={tracks}
            playTrack={playTrack}
            currentTrack={currentTrack}
            playing={playing}
            togglePlaying={togglePlaying}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-logo">
              FX
            </div>

            <h3>
              Музыки пока нет
            </h3>

            <p>
              Загруженные через бота
              треки появятся здесь.
            </p>
          </div>
        )}
      </section>

      <button
        className="mobile-profile-button"
        onClick={() =>
          setPage("profile")
        }
      >
        <Icon name="user" />
      </button>
    </div>
  );
}

function TrackPage({
  title,
  eyebrow,
  tracks,
  emptyText,
  playTrack,
  currentTrack,
  playing,
  togglePlaying,
  toggleFavorite,
  favorites,
  requireLogin,
}) {
  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          {eyebrow}
        </span>

        <h1>{title}</h1>

        <p>
          {tracks.length} треков
        </p>
      </div>

      {tracks.length ? (
        <TrackGrid
          tracks={tracks}
          playTrack={playTrack}
          currentTrack={currentTrack}
          playing={playing}
          togglePlaying={togglePlaying}
          favorites={favorites}
          toggleFavorite={
            toggleFavorite ||
            requireLogin
          }
        />
      ) : (
        <div className="empty-state">
          <Icon name="heart" size={42} />
          <h3>
            Пока пусто
          </h3>
          <p>
            {emptyText}
          </p>
        </div>
      )}
    </div>
  );
}

function TrackGrid({
  tracks,
  playTrack,
  currentTrack,
  playing,
  togglePlaying,
  favorites,
  toggleFavorite,
}) {
  return (
    <div className="track-grid">
      {tracks.map((track) => {
        const active =
          currentTrack &&
          String(currentTrack.id) ===
            String(track.id);

        const favorite =
          favorites.some(
            (item) =>
              String(item.id) ===
              String(track.id)
          );

        return (
          <article
            className={`track-card ${
              active ? "track-active" : ""
            }`}
            key={track.id}
          >
            <div className="track-cover">
              <img
                src={
                  track.cover_url ||
                  DEFAULT_COVER
                }
                alt=""
              />

              <button
                className="track-play"
                onClick={() => {
                  if (active) {
                    togglePlaying();
                  } else {
                    playTrack(
                      track,
                      tracks
                    );
                  }
                }}
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
                className={`favorite-button ${
                  favorite
                    ? "favorite-active"
                    : ""
                }`}
                onClick={() =>
                  toggleFavorite(track)
                }
              >
                <Icon
                  name="heart"
                  size={18}
                />
              </button>
            </div>

            <div className="track-info">
              <b>
                {track.title}
              </b>

              <span>
                {track.artist_name ||
                  "Unknown"}
              </span>

              {track.album_name && (
                <small>
                  {track.album_name}
                </small>
              )}
            </div>
          </article>
        );
      })}
    </div>
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

  const [saving, setSaving] =
    useState(false);

  const totalSeconds =
    history.reduce(
      (total, track) =>
        total +
        Number(track.duration || 0),
      0
    );

  async function saveProfile() {
    setSaving(true);

    try {
      const response = await fetch(
        apiUrl("/api/auth/profile"),
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            username,
            bio,
          }),
        }
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Не удалось сохранить профиль."
        );
      }

      setUser(
        data.user || {
          ...user,
          username,
          bio,
        }
      );
    } catch {
      setUser({
        ...user,
        username,
        bio,
      });
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="page">
        <LoginPage />
      </div>
    );
  }

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
            {username ||
              "Пользователь"}
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
          <span>
            прослушиваний
          </span>
        </div>

        <div>
          <strong>
            {favorites.length}
          </strong>
          <span>
            избранных
          </span>
        </div>

        <div>
          <strong>
            {formatTime(
              totalSeconds
            )}
          </strong>
          <span>
            времени
          </span>
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
              setBio(
                event.target.value
              )
            }
            placeholder="Расскажи о себе"
          />
        </label>

        <button
          className="primary-button"
          onClick={saveProfile}
          disabled={saving}
        >
          {saving
            ? "Сохраняем..."
            : "Сохранить"}
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
            update(
              "autoplay",
              value
            )
          }
        />

        <ToggleRow
          title="Автоматический переход"
          value={settings.autoNext}
          onChange={(value) =>
            update(
              "autoNext",
              value
            )
          }
        />

        <ToggleRow
          title="Уведомления"
          value={
            settings.notifications
          }
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

        <h1>
          Безопасность
        </h1>

        <p>
          Управление доступом
          к аккаунту.
        </p>
      </div>

      <div className="security-grid">
        <article>
          <Icon name="shield" />

          <h3>
            Защита сессии
          </h3>

          <p>
            Сессия сохраняется
            после входа.
          </p>

          <button
            className="secondary-button"
            onClick={openAuth}
          >
            Войти заново
          </button>
        </article>

        <article>
          <Icon name="lock" />

          <h3>
            Пароль
          </h3>

          <p>
            Пароль хранится
            на backend как
            защищённый hash.
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
            Защита регистрации
            включена.
          </p>

          <span className="security-ok">
            <Icon
              name="check"
              size={17}
            />
            Защита включена
          </span>
        </article>
      </div>

      {!user && (
        <div className="empty-state">
          Войди в аккаунт для
          управления безопасностью.
        </div>
      )}
    </div>
  );
}

function LoginPage() {
  return (
    <div className="empty-state">
      <div className="empty-logo">
        FX
      </div>

      <h3>
        Войдите в Fenix Music
      </h3>

      <p>
        Используйте кнопку «Войти»
        в боковом меню.
      </p>
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

  const [serverCaptcha, setServerCaptcha] =
    useState(null);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  async function getCaptcha() {
    setError("");

    try {
      const response = await fetch(
        apiUrl("/api/auth/captcha"),
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error();
      }

      const data =
        await response.json();

      setServerCaptcha(data);

      setCaptchaText(
        data.text ||
          data.code ||
          data.captcha ||
          ""
      );
    } catch {
      setServerCaptcha(null);
      setCaptchaText(
        randomCaptcha()
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
      captchaAnswer
        .trim()
        .toUpperCase() !==
        captchaText
          .trim()
          .toUpperCase()
    ) {
      setError(
        "Неверная CAPTCHA."
      );

      getCaptcha();
      return;
    }

    setBusy(true);

    try {
      const endpoint =
        mode === "register"
          ? "/api/auth/register"
          : "/api/auth/login";

      const payload =
        mode === "register"
          ? {
              username,
              email,
              password,
              captcha:
                captchaAnswer,
              captcha_id:
                serverCaptcha?.id ||
                serverCaptcha?.captcha_id ||
                undefined,
            }
          : {
              login:
                email || username,
              email,
              username,
              password,
            };

      const response = await fetch(
        apiUrl(endpoint),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload
          ),
        }
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "Ошибка авторизации."
        );
      }

      const account =
        data.user ||
        data.account || {
          username:
            data.username ||
            username,
          email:
            data.email ||
            email,
        };

      onSuccess(account);
    } catch (err) {
      setError(
        err.message ||
          "Сервер авторизации недоступен."
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
            ? "Сохраняй музыку, историю, настройки и избранное."
            : "Войди в свой аккаунт Fenix Music."}
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
              autoComplete="username"
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
            autoComplete="username"
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
            autoComplete={
              mode === "register"
                ? "new-password"
                : "current-password"
            }
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
              autoComplete="new-password"
              minLength={6}
              required
            />
          )}

          {mode === "register" && (
            <>
              <div className="captcha-box">
                <strong>
                  {captchaText ||
                    "------"}
                </strong>

                <button
                  type="button"
                  onClick={getCaptcha}
                  title="Обновить CAPTCHA"
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
                autoComplete="off"
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
          <b>
            {track.title}
          </b>

          <small>
            {track.artist_name ||
              "Unknown"}
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

          <button
            onClick={previousTrack}
          >
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

          <button
            onClick={nextTrack}
          >
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
        <button
          onClick={openQueue}
          title="Очередь"
        >
          <Icon name="list" />
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
              Number(
                event.target.value
              )
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
    <div className="overlay-panel">
      <div className="queue-panel">
        <div className="queue-heading">
          <div>
            <span className="eyebrow">
              PLAYBACK
            </span>

            <h2>
              Очередь
            </h2>
          </div>

          <button onClick={close}>
            <Icon name="close" />
          </button>
        </div>

        <div className="queue-list">
          {queue.length ? (
            queue.map((track) => (
              <button
                className={`queue-item ${
                  currentTrack &&
                  String(track.id) ===
                    String(
                      currentTrack.id
                    )
                    ? "active"
                    : ""
                }`}
                key={track.id}
                onClick={() => {
                  playTrack(
                    track,
                    queue
                  );
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
                  <b>
                    {track.title}
                  </b>

                  <small>
                    {track.artist_name ||
                      "Unknown"}
                  </small>
                </span>

                {currentTrack &&
                  String(
                    track.id
                  ) ===
                    String(
                      currentTrack.id
                    ) && (
                    <Icon
                      name="volume"
                      size={17}
                    />
                  )}
              </button>
            ))
          ) : (
            <div className="empty-state">
              Очередь пуста.
            </div>
          )}
        </div>
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
          {track.artist_name ||
            "Unknown"}
        </span>

        <h1>
          {track.title}
        </h1>

        <p>
          {track.album_name ||
            "Fenix Music"}
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

        <button
          onClick={previousTrack}
        >
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
            size={28}
          />
        </button>

        <button
          onClick={nextTrack}
        >
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
