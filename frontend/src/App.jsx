import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = "";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function formatTime(value) {
  const seconds = Number(value || 0);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function randomFallbackCaptcha() {
  return String(
    Math.floor(1000 + Math.random() * 9000)
  );
}

function Icon({ name, size = 20 }) {
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

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }

  if (name === "music") {
    return (
      <svg {...common}>
        <path d="M9 18V5l11-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="16" r="3" />
      </svg>
    );
  }

  if (name === "heart") {
    return (
      <svg {...common}>
        <path d="M20.8 8.7c0 5.5-8.8 10.3-8.8 10.3S3.2 14.2 3.2 8.7A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.3Z" />
      </svg>
    );
  }

  if (name === "history") {
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === "user") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c.8-4 3.3-6 8-6s7.2 2 8 6" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    );
  }

  if (name === "play") {
    return (
      <svg {...common} fill="currentColor" stroke="none">
        <path d="M8 5.2v13.6c0 .9 1 1.4 1.8.9l10-6.8a1.1 1.1 0 0 0 0-1.8l-10-6.8C9 3.8 8 4.3 8 5.2Z" />
      </svg>
    );
  }

  if (name === "pause") {
    return (
      <svg {...common} fill="currentColor" stroke="none">
        <rect x="7" y="5" width="3.5" height="14" rx="1" />
        <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
      </svg>
    );
  }

  if (name === "next") {
    return (
      <svg {...common}>
        <path d="m6 5 9 7-9 7V5Z" fill="currentColor" stroke="none" />
        <path d="M19 5v14" />
      </svg>
    );
  }

  if (name === "previous") {
    return (
      <svg {...common}>
        <path d="m18 5-9 7 9 7V5Z" fill="currentColor" stroke="none" />
        <path d="M5 5v14" />
      </svg>
    );
  }

  if (name === "shuffle") {
    return (
      <svg {...common}>
        <path d="M16 3h5v5" />
        <path d="M4 20 21 3" />
        <path d="M21 16v5h-5" />
        <path d="m15 15 6 6" />
        <path d="M4 4l5 5" />
      </svg>
    );
  }

  if (name === "repeat") {
    return (
      <svg {...common}>
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11V9a3 3 0 0 1 3-3h15" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v2a3 3 0 0 1-3 3H3" />
      </svg>
    );
  }

  if (name === "volume") {
    return (
      <svg {...common}>
        <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
        <path d="M17 9a4 4 0 0 1 0 6" />
        <path d="M19.5 6.5a8 8 0 0 1 0 11" />
      </svg>
    );
  }

  if (name === "volume-off") {
    return (
      <svg {...common}>
        <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
        <path d="m18 9 4 6" />
        <path d="m22 9-4 6" />
      </svg>
    );
  }

  if (name === "x") {
    return (
      <svg {...common}>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 4v5h5" />
        <path d="M4 13a8 8 0 0 0 14 5l3-3" />
        <path d="M21 20v-5h-5" />
      </svg>
    );
  }

  if (name === "log-out") {
    return (
      <svg {...common}>
        <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
        <path d="m16 16 4-4-4-4" />
        <path d="M20 12H9" />
      </svg>
    );
  }

  if (name === "edit") {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function App() {
  const audioRef = useRef(null);

  const [page, setPage] = useState("home");
  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const [search, setSearch] = useState("");

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const [toast, setToast] = useState("");

  const [loadingTracks, setLoadingTracks] = useState(true);
  const [loadingUser, setLoadingUser] = useState(true);

  function notify(message) {
    setToast(message);

    window.clearTimeout(window.__fenixToastTimer);

    window.__fenixToastTimer = window.setTimeout(() => {
      setToast("");
    }, 3000);
  }

  async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
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
          `Ошибка ${response.status}`
      );
    }

    return data;
  }

  async function loadUser() {
    try {
      const data = await request("/api/auth/me");
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  async function loadTracks() {
    setLoadingTracks(true);

    try {
      const data = await request("/api/tracks");

      const incoming = Array.isArray(data.tracks)
        ? data.tracks
        : [];

      setTracks(incoming);
    } catch (error) {
      console.error("Tracks:", error);
      setTracks([]);
      notify("Не удалось загрузить музыку");
    } finally {
      setLoadingTracks(false);
    }
  }

  async function loadFavorites() {
    if (!user) {
      setFavorites([]);
      return;
    }

    try {
      const data = await request("/api/favorites");

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
      setHistory([]);
      return;
    }

    try {
      const data = await request("/api/history");

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
    loadUser();
    loadTracks();
  }, []);

  useEffect(() => {
    if (user) {
      loadFavorites();
      loadHistory();
    } else {
      setFavorites([]);
      setHistory([]);
    }
  }, [user]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    const source =
      currentTrack.audio_url ||
      `/api/tracks/${currentTrack.id}/audio`;

    if (audio.src !== new URL(source, window.location.href).href) {
      audio.src = source;
    }

    audio.load();

    if (playing) {
      audio.play().catch(() => {
        setPlaying(false);
      });
    }
  }, [currentTrack]);

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

  function handleTimeUpdate() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setProgress(audio.currentTime || 0);
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setDuration(audio.duration || 0);
  }

  function handleEnded() {
    playNext();
  }

  async function registerPlay(track) {
    try {
      await request(
        `/api/tracks/${track.id}/play`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );
    } catch {
      return;
    }
  }

  async function saveHistory(track) {
    if (!user) {
      return;
    }

    try {
      await request("/api/history", {
        method: "POST",
        body: JSON.stringify({
          track_id: Number(track.id),
        }),
      });

      loadHistory();
    } catch {
      return;
    }
  }

  function playTrack(track) {
    if (!track) {
      return;
    }

    if (
      currentTrack &&
      String(currentTrack.id) === String(track.id)
    ) {
      setPlaying((value) => !value);
      return;
    }

    setProgress(0);
    setDuration(Number(track.duration || 0));
    setCurrentTrack(track);
    setPlaying(true);

    registerPlay(track);
    saveHistory(track);
  }

  function playNext() {
    if (!currentTrack || tracks.length === 0) {
      return;
    }

    const index = tracks.findIndex(
      (track) =>
        String(track.id) === String(currentTrack.id)
    );

    const nextIndex =
      index >= 0
        ? (index + 1) % tracks.length
        : 0;

    playTrack(tracks[nextIndex]);
  }

  function playPrevious() {
    if (!currentTrack || tracks.length === 0) {
      return;
    }

    const index = tracks.findIndex(
      (track) =>
        String(track.id) === String(currentTrack.id)
    );

    const previousIndex =
      index <= 0
        ? tracks.length - 1
        : index - 1;

    playTrack(tracks[previousIndex]);
  }

  function togglePlay() {
    if (!currentTrack) {
      if (tracks.length > 0) {
        playTrack(tracks[0]);
      }

      return;
    }

    setPlaying((value) => !value);
  }

  function seek(event) {
    const audio = audioRef.current;

    if (!audio || !duration) {
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    const ratio =
      (event.clientX - rect.left) /
      rect.width;

    const nextTime =
      Math.max(0, Math.min(1, ratio)) *
      duration;

    audio.currentTime = nextTime;
    setProgress(nextTime);
  }

  function toggleFavorite(track) {
    if (!user) {
      setAuthMode("login");
      setAuthOpen(true);
      notify("Войдите, чтобы добавлять музыку в избранное");
      return;
    }

    const id = Number(track.id);

    const exists = favorites.some(
      (item) =>
        Number(item.id) === id
    );

    if (exists) {
      removeFavorite(track);
    } else {
      addFavorite(track);
    }
  }

  async function addFavorite(track) {
    try {
      await request("/api/favorites", {
        method: "POST",
        body: JSON.stringify({
          track_id: Number(track.id),
        }),
      });

      await loadFavorites();

      notify("Добавлено в избранное");
    } catch (error) {
      notify(error.message);
    }
  }

  async function removeFavorite(track) {
    try {
      await request(
        `/api/favorites/${track.id}`,
        {
          method: "DELETE",
        }
      );

      await loadFavorites();

      notify("Удалено из избранного");
    } catch (error) {
      notify(error.message);
    }
  }

  function isFavorite(track) {
    return favorites.some(
      (item) =>
        String(item.id) === String(track.id)
    );
  }

  function openLogin() {
    setAuthMode("login");
    setAuthOpen(true);
  }

  function openRegister() {
    setAuthMode("register");
    setAuthOpen(true);
  }

  async function logout() {
    try {
      await request("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      return;
    }

    setUser(null);
    setFavorites([]);
    setHistory([]);
    setPage("home");
    notify("Вы вышли из аккаунта");
  }

  const filteredTracks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return tracks;
    }

    return tracks.filter((track) => {
      const title =
        String(track.title || "").toLowerCase();

      const artist =
        String(track.artist_name || "").toLowerCase();

      const album =
        String(track.album_name || "").toLowerCase();

      return (
        title.includes(query) ||
        artist.includes(query) ||
        album.includes(query)
      );
    });
  }, [tracks, search]);

  const popularTracks = useMemo(() => {
    return [...tracks]
      .sort(
        (a, b) =>
          Number(b.plays_count || 0) -
          Number(a.plays_count || 0)
      )
      .slice(0, 12);
  }, [tracks]);

  function goTo(nextPage) {
    setPage(nextPage);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="app">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      <header className="topbar">
        <button
          className="logo"
          onClick={() => goTo("home")}
          type="button"
        >
          <span className="logo-mark">
            FX
          </span>

          <span className="logo-text">
            FENIX MUSIC
          </span>
        </button>

        <div className="topbar-actions">
          <div className="search-box">
            <span className="search-icon">
              <Icon
                name="search"
                size={18}
              />
            </span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Поиск музыки..."
            />
          </div>

          {user ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => goTo("profile")}
            >
              <Icon
                name="user"
                size={17}
              />
              {user.username}
            </button>
          ) : (
            <button
              className="primary-button"
              type="button"
              onClick={openLogin}
            >
              Войти
            </button>
          )}
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          <div className="nav-section">
            <div className="nav-title">
              Навигация
            </div>

            <button
              className={`nav-item ${
                page === "home" ? "active" : ""
              }`}
              type="button"
              onClick={() => goTo("home")}
            >
              <Icon name="home" />
              Главная
            </button>

            <button
              className={`nav-item ${
                page === "music" ? "active" : ""
              }`}
              type="button"
              onClick={() => goTo("music")}
            >
              <Icon name="music" />
              Музыка
            </button>

            <button
              className={`nav-item ${
                page === "favorites" ? "active" : ""
              }`}
              type="button"
              onClick={() => goTo("favorites")}
            >
              <Icon name="heart" />
              Избранное
            </button>

            <button
              className={`nav-item ${
                page === "history" ? "active" : ""
              }`}
              type="button"
              onClick={() => goTo("history")}
            >
              <Icon name="history" />
              История
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-title">
              Аккаунт
            </div>

            <button
              className={`nav-item ${
                page === "profile" ? "active" : ""
              }`}
              type="button"
              onClick={() => {
                if (!user) {
                  openLogin();
                  return;
                }

                goTo("profile");
              }}
            >
              <Icon name="user" />
              Профиль
            </button>
          </div>
        </aside>

        <main className="content">
          {page === "home" && (
            <>
              <section className="hero">
                <div className="hero-content">
                  <span className="hero-badge">
                    FENIX MUSIC
                  </span>

                  <h1>
                    Твоя музыка.
                    <br />
                    Твоя вселенная.
                  </h1>

                  <p>
                    Слушай любимые треки,
                    находи новую музыку
                    и собирай собственную
                    библиотеку.
                  </p>

                  <div className="hero-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        if (tracks.length > 0) {
                          playTrack(tracks[0]);
                        } else {
                          goTo("music");
                        }
                      }}
                    >
                      <Icon
                        name="play"
                        size={17}
                      />
                      Слушать музыку
                    </button>

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => goTo("music")}
                    >
                      Все треки
                    </button>
                  </div>
                </div>
              </section>

              <section className="section">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">
                      Для вас
                    </h2>

                    <p className="section-subtitle">
                      Музыка, доступная прямо сейчас
                    </p>
                  </div>

                  <button
                    className="section-link"
                    type="button"
                    onClick={() => goTo("music")}
                  >
                    Смотреть всё
                  </button>
                </div>

                <TrackGrid
                  tracks={filteredTracks.slice(0, 8)}
                  loading={loadingTracks}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  isFavorite={isFavorite}
                />
              </section>

              <section className="section">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">
                      Популярное
                    </h2>

                    <p className="section-subtitle">
                      Самые прослушиваемые треки
                    </p>
                  </div>
                </div>

                <TrackGrid
                  tracks={popularTracks}
                  loading={loadingTracks}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  isFavorite={isFavorite}
                />
              </section>
            </>
          )}

          {page === "music" && (
            <section className="section">
              <div className="section-header">
                <div>
                  <h1 className="section-title">
                    Музыка
                  </h1>

                  <p className="section-subtitle">
                    {tracks.length} треков
                  </p>
                </div>
              </div>

              <TrackGrid
                tracks={filteredTracks}
                loading={loadingTracks}
                onPlay={playTrack}
                onFavorite={toggleFavorite}
                isFavorite={isFavorite}
              />
            </section>
          )}

          {page === "favorites" && (
            <section className="section">
              <div className="section-header">
                <div>
                  <h1 className="section-title">
                    Избранное
                  </h1>

                  <p className="section-subtitle">
                    Твои любимые треки
                  </p>
                </div>
              </div>

              {!user ? (
                <LoginPrompt
                  onLogin={openLogin}
                />
              ) : (
                <TrackGrid
                  tracks={favorites}
                  loading={false}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  isFavorite={isFavorite}
                />
              )}
            </section>
          )}

          {page === "history" && (
            <section className="section">
              <div className="section-header">
                <div>
                  <h1 className="section-title">
                    История
                  </h1>

                  <p className="section-subtitle">
                    Недавно прослушанные треки
                  </p>
                </div>
              </div>

              {!user ? (
                <LoginPrompt
                  onLogin={openLogin}
                />
              ) : (
                <TrackGrid
                  tracks={history}
                  loading={false}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                  isFavorite={isFavorite}
                />
              )}
            </section>
          )}

          {page === "profile" && (
            <ProfilePage
              user={user}
              loading={loadingUser}
              onLogin={openLogin}
              onLogout={logout}
              onSaved={() => {
                loadUser();
                notify("Профиль сохранён");
              }}
            />
          )}
        </main>
      </div>

      {currentTrack && (
        <Player
          track={currentTrack}
          playing={playing}
          progress={progress}
          duration={duration}
          volume={volume}
          onToggle={togglePlay}
          onNext={playNext}
          onPrevious={playPrevious}
          onSeek={seek}
          onVolume={setVolume}
        />
      )}

      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          close={() => setAuthOpen(false)}
          onSuccess={(nextUser) => {
            setUser(nextUser || null);
            setAuthOpen(false);
            setPage("home");
            notify(
              authMode === "register"
                ? "Аккаунт создан"
                : "Вы вошли в аккаунт"
            );
          }}
        />
      )}

      {toast && (
        <div className="toast-container">
          <div className="toast">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function TrackGrid({
  tracks,
  loading,
  onPlay,
  onFavorite,
  isFavorite,
}) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!tracks || tracks.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <strong>
            Музыки пока нет
          </strong>

          <span>
            Добавленные через бота треки
            появятся здесь автоматически.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="track-grid">
      {tracks.map((track) => (
        <TrackCard
          key={String(track.id)}
          track={track}
          onPlay={onPlay}
          onFavorite={onFavorite}
          favorite={isFavorite(track)}
        />
      ))}
    </div>
  );
}

function TrackCard({
  track,
  onPlay,
  onFavorite,
  favorite,
}) {
  const title =
    track.title ||
    track.file_name ||
    "Без названия";

  const artist =
    track.artist_name ||
    "Fenix Music";

  const cover =
    track.cover_url ||
    "/music-cover.svg";

  return (
    <article className="track-card">
      <div className="track-cover">
        <img
          src={cover}
          alt={title}
          onError={(event) => {
            event.currentTarget.style.display =
              "none";
          }}
        />

        <button
          className="track-play"
          type="button"
          aria-label={`Слушать ${title}`}
          onClick={() => onPlay(track)}
        >
          <Icon
            name="play"
            size={19}
          />
        </button>
      </div>

      <div className="track-info">
        <h3 className="track-title">
          {title}
        </h3>

        <p className="track-artist">
          {artist}
        </p>

        <div className="track-meta">
          <span>
            {formatTime(track.duration)}
          </span>

          <button
            type="button"
            onClick={() => onFavorite(track)}
            style={{
              color: favorite
                ? "#ff3e6d"
                : "#777783",
              background: "transparent",
              padding: 0,
              display: "grid",
              placeItems: "center",
            }}
            aria-label="Избранное"
          >
            <Icon
              name="heart"
              size={17}
            />
          </button>
        </div>
      </div>
    </article>
  );
}

function Player({
  track,
  playing,
  progress,
  duration,
  volume,
  onToggle,
  onNext,
  onPrevious,
  onSeek,
  onVolume,
}) {
  const cover =
    track.cover_url ||
    "/music-cover.svg";

  const actualDuration =
    duration ||
    Number(track.duration || 0);

  return (
    <div className="player">
      <div className="player-cover">
        <img
          src={cover}
          alt={track.title || "Track"}
          onError={(event) => {
            event.currentTarget.style.display =
              "none";
          }}
        />
      </div>

      <div className="player-info">
        <p className="player-title">
          {track.title ||
            track.file_name ||
            "Без названия"}
        </p>

        <p className="player-artist">
          {track.artist_name ||
            "Fenix Music"}
        </p>
      </div>

      <div className="player-controls">
        <button
          className="player-button secondary-control"
          type="button"
          onClick={onPrevious}
          aria-label="Предыдущий"
        >
          <Icon
            name="previous"
            size={20}
          />
        </button>

        <button
          className="player-button main"
          type="button"
          onClick={onToggle}
          aria-label={
            playing ? "Пауза" : "Воспроизвести"
          }
        >
          <Icon
            name={playing ? "pause" : "play"}
            size={21}
          />
        </button>

        <button
          className="player-button secondary-control"
          type="button"
          onClick={onNext}
          aria-label="Следующий"
        >
          <Icon
            name="next"
            size={20}
          />
        </button>
      </div>

      <div className="progress-area">
        <span className="progress-time">
          {formatTime(progress)}
        </span>

        <div
          className="progress"
          onClick={onSeek}
          role="slider"
          aria-valuemin="0"
          aria-valuemax={actualDuration}
          aria-valuenow={progress}
          tabIndex={0}
        >
          <div
            className="progress-fill"
            style={{
              width:
                actualDuration > 0
                  ? `${Math.min(
                      100,
                      (progress /
                        actualDuration) *
                        100
                    )}%`
                  : "0%",
            }}
          />
        </div>

        <span className="progress-time">
          {formatTime(actualDuration)}
        </span>
      </div>

      <div className="volume">
        <Icon
          name={
            volume > 0
              ? "volume"
              : "volume-off"
          }
          size={18}
        />

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) =>
            onVolume(
              Number(event.target.value)
            )
          }
          aria-label="Громкость"
        />
      </div>
    </div>
  );
}

function LoginPrompt({ onLogin }) {
  return (
    <div className="empty-state">
      <div>
        <strong>
          Войди в аккаунт
        </strong>

        <span>
          Авторизуйся, чтобы пользоваться
          этой функцией.
        </span>

        <div
          style={{
            marginTop: 18,
          }}
        >
          <button
            className="primary-button"
            type="button"
            onClick={onLogin}
          >
            Войти
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({
  user,
  loading,
  onLogin,
  onLogout,
  onSaved,
}) {
  const [username, setUsername] =
    useState("");

  const [bio, setBio] =
    useState("");

  const [avatarUrl, setAvatarUrl] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    setUsername(user.username || "");
    setBio(user.bio || "");
    setAvatarUrl(user.avatar_url || "");
  }, [user]);

  async function save() {
    setError("");
    setSaving(true);

    try {
      const response =
        await fetch(
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
              avatar_url: avatarUrl,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Не удалось сохранить профиль"
        );
      }

      onSaved();
    } catch (err) {
      setError(
        err.message ||
          "Ошибка сохранения"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPrompt onLogin={onLogin} />
    );
  }

  const firstLetter =
    String(
      user.username || "F"
    )
      .charAt(0)
      .toUpperCase();

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h1 className="section-title">
            Профиль
          </h1>

          <p className="section-subtitle">
            Управление аккаунтом Fenix Music
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={onLogout}
        >
          <Icon
            name="log-out"
            size={17}
          />
          Выйти
        </button>
      </div>

      <div className="profile">
        <div>
          {avatarUrl ? (
            <img
              className="avatar"
              src={avatarUrl}
              alt={username}
              onError={(event) => {
                event.currentTarget.style.display =
                  "none";
              }}
            />
          ) : (
            <div className="avatar">
              {firstLetter}
            </div>
          )}
        </div>

        <div className="profile-content">
          <h2 className="profile-name">
            {user.username}
          </h2>

          <p className="profile-email">
            {user.email}
          </p>

          <div
            className="form"
            style={{
              marginTop: 25,
            }}
          >
            <div className="form-group">
              <label className="form-label">
                Username
              </label>

              <input
                className="form-input"
                value={username}
                onChange={(event) =>
                  setUsername(
                    event.target.value
                  )
                }
                maxLength={64}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                О себе
              </label>

              <textarea
                className="form-input"
                value={bio}
                onChange={(event) =>
                  setBio(event.target.value)
                }
                maxLength={1000}
                placeholder="Расскажи о себе..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                URL аватара
              </label>

              <input
                className="form-input"
                value={avatarUrl}
                onChange={(event) =>
                  setAvatarUrl(
                    event.target.value
                  )
                }
                placeholder="https://..."
              />
            </div>

            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            <button
              className="primary-button"
              type="button"
              onClick={save}
              disabled={saving}
            >
              <Icon
                name="edit"
                size={17}
              />

              {saving
                ? "Сохранение..."
                : "Сохранить профиль"}
            </button>
          </div>
        </div>
      </div>
    </section>
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

  const [captchaLoading, setCaptchaLoading] =
    useState(false);

  async function loadCaptcha() {
    setCaptchaLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          apiUrl("/api/auth/captcha"),
          {
            credentials: "include",
          }
        );

      const data =
        await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data?.error ||
            "Не удалось получить CAPTCHA"
        );
      }

      setCaptchaId(
        String(data.id || "")
      );

      setCaptchaText(
        String(
          data.text ||
            data.code ||
            ""
        )
      );

      setCaptchaAnswer("");
    } catch (err) {
      setCaptchaId("");
      setCaptchaText(
        randomFallbackCaptcha()
      );
      setCaptchaAnswer("");

      setError(
        "Не удалось загрузить CAPTCHA с сервера. Обновите код."
      );

      console.error(
        "CAPTCHA:",
        err
      );
    } finally {
      setCaptchaLoading(false);
    }
  }

  useEffect(() => {
    if (mode === "register") {
      loadCaptcha();
    }
  }, [mode]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");

    if (nextMode === "register") {
      window.setTimeout(
        loadCaptcha,
        0
      );
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (mode === "register") {
      if (
        username.trim().length < 3
      ) {
        setError(
          "Username должен содержать минимум 3 символа."
        );
        return;
      }

      if (
        password.length < 6
      ) {
        setError(
          "Пароль должен содержать минимум 6 символов."
        );
        return;
      }

      if (
        password !== confirmPassword
      ) {
        setError(
          "Пароли не совпадают."
        );
        return;
      }

      if (
        !captchaAnswer.trim()
      ) {
        setError(
          "Введите код CAPTCHA."
        );
        return;
      }

      if (
        captchaId &&
        captchaText &&
        captchaAnswer.trim().toUpperCase() !==
          captchaText.trim().toUpperCase()
      ) {
        setError(
          "Неверный код CAPTCHA."
        );

        loadCaptcha();
        return;
      }
    }

    setBusy(true);

    try {
      const endpoint =
        mode === "register"
          ? "/api/auth/register"
          : "/api/auth/login";

      const body =
        mode === "register"
          ? {
              username:
                username.trim(),
              email:
                email.trim().toLowerCase(),
              password,
              captcha:
                captchaAnswer.trim(),
              captcha_id:
                captchaId,
            }
          : {
              login:
                email.trim(),
              password,
            };

      const response =
        await fetch(
          apiUrl(endpoint),
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(body),
          }
        );

      const data =
        await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data?.error ||
            "Неизвестная ошибка"
        );
      }

      onSuccess(
        data.user || null
      );
    } catch (err) {
      setError(
        err.message ||
          "Произошла ошибка"
      );

      if (mode === "register") {
        loadCaptcha();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          close();
        }
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {mode === "register"
                ? "Создать аккаунт"
                : "Войти"}
            </h2>

            <p className="modal-description">
              {mode === "register"
                ? "Создай свой аккаунт Fenix Music."
                : "Войди в свой Fenix Music аккаунт."}
            </p>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={close}
            aria-label="Закрыть"
          >
            <Icon
              name="x"
              size={19}
            />
          </button>
        </div>

        <form
          className="form"
          onSubmit={submit}
        >
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">
                Username
              </label>

              <input
                className="form-input"
                value={username}
                onChange={(event) =>
                  setUsername(
                    event.target.value
                  )
                }
                placeholder="Например: fenix"
                maxLength={64}
                autoComplete="username"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              {mode === "register"
                ? "Email"
                : "Email или username"}
            </label>

            <input
              className="form-input"
              type={
                mode === "register"
                  ? "email"
                  : "text"
              }
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder={
                mode === "register"
                  ? "you@example.com"
                  : "Введите email или username"
              }
              autoComplete={
                mode === "register"
                  ? "email"
                  : "username"
              }
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Пароль
            </label>

            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Минимум 6 символов"
              autoComplete={
                mode === "register"
                  ? "new-password"
                  : "current-password"
              }
              required
            />
          </div>

          {mode === "register" && (
            <>
              <div className="form-group">
                <label className="form-label">
                  Повторите пароль
                </label>

                <input
                  className="form-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  CAPTCHA
                </label>

                <div className="captcha">
                  <div className="captcha-image">
                    {captchaLoading
                      ? "...."
                      : captchaText ||
                        "----"}
                  </div>

                  <button
                    className="captcha-refresh"
                    type="button"
                    onClick={loadCaptcha}
                    disabled={captchaLoading}
                    aria-label="Обновить CAPTCHA"
                  >
                    <Icon
                      name="refresh"
                      size={19}
                    />
                  </button>
                </div>

                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={captchaAnswer}
                  onChange={(event) =>
                    setCaptchaAnswer(
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(0, 4)
                    )
                  }
                  placeholder="Введите 4 цифры"
                  autoComplete="off"
                  required
                />
              </div>
            </>
          )}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Подождите..."
              : mode === "register"
              ? "Создать аккаунт"
              : "Войти"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "register" ? (
            <>
              Уже есть аккаунт?{" "}
              <button
                type="button"
                onClick={() =>
                  switchMode("login")
                }
              >
                Войти
              </button>
            </>
          ) : (
            <>
              Нет аккаунта?{" "}
              <button
                type="button"
                onClick={() =>
                  switchMode("register")
                }
              >
                Создать
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Fenix Music: элемент #root не найден"
  );
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
