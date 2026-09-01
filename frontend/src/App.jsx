import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Home,
  Library,
  Heart,
  History,
  ListMusic,
  User,
  Settings,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  MoreHorizontal,
  Music2,
  Disc3,
  Mic2,
  LogIn,
  LogOut,
  UserPlus,
  X,
  Check,
  Upload,
  RefreshCw,
} from "lucide-react";

import "./styles.css";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "");

const TOKEN_KEY = "fenix_token";

function apiUrl(path) {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        `Ошибка сервера: ${response.status}`
    );
  }

  return data;
}

function formatTime(seconds) {
  const value = Number(seconds || 0);

  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getCover(track) {
  if (!track?.cover_url) return null;
  return apiUrl(track.cover_url);
}

function getAudio(track) {
  if (!track) return "";
  return apiUrl(track.audio_url || `/api/tracks/${track.id}/stream`);
}

function uniqueTracks(items) {
  const map = new Map();

  for (const item of items || []) {
    if (item?.id != null) {
      map.set(item.id, item);
    }
  }

  return [...map.values()];
}

function App() {
  const audioRef = useRef(null);

  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);

  const [page, setPage] = useState("home");
  const [search, setSearch] = useState("");

  const [tracks, setTracks] = useState([]);
  const [popular, setPopular] = useState([]);
  const [newTracks, setNewTracks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [genres, setGenres] = useState([]);

  const [likes, setLikes] = useState([]);
  const [history, setHistory] = useState([]);
  const [playlists, setPlaylists] = useState([]);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showQueue, setShowQueue] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [profile, setProfile] = useState(null);

  const [toast, setToast] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
      loadCurrentUser();
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast("");
    }, 2500);

    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!audioRef.current) return;

    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    const audio = audioRef.current;
    const src = getAudio(currentTrack);

    if (!src) return;

    audio.src = src;
    audio.load();

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [currentTrack]);

  async function loadCurrentUser() {
    try {
      const data = await api("/api/auth/me");
      setUser(data.user || data);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }

  async function loadInitialData() {
    setLoading(true);
    setError("");

    try {
      const [
        tracksData,
        popularData,
        newData,
        recommendationsData,
        artistsData,
        albumsData,
      ] = await Promise.all([
        api("/api/tracks?limit=100"),
        api("/api/tracks?sort=popular&limit=30").catch(() => null),
        api("/api/tracks?sort=new&limit=30").catch(() => null),
        api("/api/recommendations?limit=30").catch(() => null),
        api("/api/artists").catch(() => null),
        api("/api/albums").catch(() => null),
      ]);

      const mainTracks =
        tracksData?.tracks ||
        tracksData?.items ||
        (Array.isArray(tracksData) ? tracksData : []);

      setTracks(mainTracks);

      setPopular(
        popularData?.tracks ||
          popularData?.items ||
          (Array.isArray(popularData) ? popularData : mainTracks)
      );

      setNewTracks(
        newData?.tracks ||
          newData?.items ||
          (Array.isArray(newData) ? newData : mainTracks)
      );

      setRecommendations(
        recommendationsData?.tracks ||
          recommendationsData?.items ||
          (Array.isArray(recommendationsData)
            ? recommendationsData
            : mainTracks)
      );

      setArtists(
        artistsData?.artists ||
          artistsData?.items ||
          (Array.isArray(artistsData) ? artistsData : [])
      );

      setAlbums(
        albumsData?.albums ||
          albumsData?.items ||
          (Array.isArray(albumsData) ? albumsData : [])
      );

      setGenres(
        [...new Set(mainTracks.map((track) => track.genre).filter(Boolean))]
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserData() {
    if (!localStorage.getItem(TOKEN_KEY)) return;

    try {
      const [likesData, historyData, playlistsData, profileData] =
        await Promise.all([
          api("/api/library/likes").catch(() => null),
          api("/api/history").catch(() => null),
          api("/api/playlists").catch(() => null),
          api("/api/profile/stats").catch(() => null),
        ]);

      setLikes(
        likesData?.tracks ||
          likesData?.items ||
          (Array.isArray(likesData) ? likesData : [])
      );

      setHistory(
        historyData?.tracks ||
          historyData?.items ||
          (Array.isArray(historyData) ? historyData : [])
      );

      setPlaylists(
        playlistsData?.playlists ||
          playlistsData?.items ||
          (Array.isArray(playlistsData) ? playlistsData : [])
      );

      setProfile(profileData);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  function showToast(message) {
    setToast(message);
  }

  function playTrack(track, list = null) {
    if (!track) return;

    const nextQueue = uniqueTracks(list?.length ? list : tracks);

    setQueue(nextQueue);

    const index = nextQueue.findIndex((item) => item.id === track.id);

    setQueueIndex(index >= 0 ? index : 0);
    setCurrentTrack(track);
    setIsPlaying(true);

    setTimeout(() => {
      audioRef.current?.play().catch(() => {});
    }, 50);
  }

  function togglePlay() {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      if (tracks.length) {
        playTrack(tracks[0], tracks);
      }

      return;
    }

    if (audio.paused) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  async function registerPlay(track) {
    if (!track?.id) return;

    try {
      await api(`/api/history/${track.id}`, {
        method: "POST",
      });
    } catch {
      // Не блокируем проигрывание музыки.
    }
  }

  async function handleAudioPlay() {
    setIsPlaying(true);

    if (currentTrack) {
      registerPlay(currentTrack);
    }
  }

  function nextTrack() {
    if (!queue.length) return;

    let nextIndex;

    if (shuffle) {
      if (queue.length === 1) {
        nextIndex = 0;
      } else {
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === queueIndex);
      }
    } else {
      nextIndex = queueIndex + 1;

      if (nextIndex >= queue.length) {
        if (!repeat) {
          setIsPlaying(false);
          return;
        }

        nextIndex = 0;
      }
    }

    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
    setIsPlaying(true);
  }

  function previousTrack() {
    if (!queue.length) return;

    if (audioRef.current && audioRef.current.currentTime > 5) {
      audioRef.current.currentTime = 0;
      return;
    }

    let previousIndex = queueIndex - 1;

    if (previousIndex < 0) {
      previousIndex = repeat ? queue.length - 1 : 0;
    }

    setQueueIndex(previousIndex);
    setCurrentTrack(queue[previousIndex]);
    setIsPlaying(true);
  }

  function handleEnded() {
    if (repeat && currentTrack && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }

    nextTrack();
  }

  function seek(value) {
    if (!audioRef.current) return;

    const position = Number(value);

    audioRef.current.currentTime = position;
    setProgress(position);
  }

  async function toggleLike(track) {
    if (!user) {
      setAuthMode("login");
      return;
    }

    const liked = likes.some((item) => item.id === track.id);

    try {
      await api(`/api/library/likes/${track.id}`, {
        method: "PUT",
        body: JSON.stringify({
          liked: !liked,
        }),
      });

      if (liked) {
        setLikes((items) => items.filter((item) => item.id !== track.id));
        showToast("Удалено из избранного");
      } else {
        setLikes((items) => [...items, track]);
        showToast("Добавлено в избранное");
      }
    } catch (err) {
      showToast(err.message);
    }
  }

  function isLiked(track) {
    return likes.some((item) => item.id === track?.id);
  }

  function handleAuthSuccess(account) {
    setUser(account);
    setAuthMode(null);
    loadUserData();
    showToast("Добро пожаловать в FENIX MUSIC");
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setLikes([]);
    setHistory([]);
    setPlaylists([]);
    setProfile(null);
    setPage("home");
    showToast("Вы вышли из аккаунта");
  }

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

    return tracks.filter((track) => {
      return (
        String(track.title || "").toLowerCase().includes(query) ||
        String(track.artist || "").toLowerCase().includes(query) ||
        String(track.album || "").toLowerCase().includes(query) ||
        String(track.genre || "").toLowerCase().includes(query)
      );
    });
  }, [search, tracks]);

  function getPageTracks() {
    switch (page) {
      case "popular":
        return popular;

      case "new":
        return newTracks;

      case "recommendations":
        return recommendations;

      case "likes":
        return likes;

      case "history":
        return history;

      case "tracks":
        return tracks;

      default:
        return tracks;
    }
  }

  function openPage(nextPage) {
    setPage(nextPage);
    setSearch("");
  }

  return (
    <div className="fenix-app">
      <audio
        ref={audioRef}
        onPlay={handleAudioPlay}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setProgress(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
          }
        }}
      />

      <Sidebar
        page={page}
        openPage={openPage}
        user={user}
        onLogin={() => setAuthMode("login")}
        onRegister={() => setAuthMode("register")}
        onLogout={logout}
        onSettings={() => setShowSettings(true)}
      />

      <main className="main-content">
        <header className="topbar">
          <div className="navigation-buttons">
            <button
              className="icon-button"
              onClick={() => window.history.back()}
            >
              <ChevronLeft size={20} />
            </button>

            <button
              className="icon-button"
              onClick={() => window.history.forward()}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="search-box">
            <Search size={19} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Что хочешь послушать?"
            />

            {search && (
              <button
                className="search-clear"
                onClick={() => setSearch("")}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="topbar-user">
            {user ? (
              <button
                className="user-chip"
                onClick={() => openPage("profile")}
              >
                <Avatar user={user} />
                <span>{user.username}</span>
              </button>
            ) : (
              <>
                <button
                  className="secondary-button"
                  onClick={() => setAuthMode("login")}
                >
                  Войти
                </button>

                <button
                  className="primary-button"
                  onClick={() => setAuthMode("register")}
                >
                  Регистрация
                </button>
              </>
            )}
          </div>
        </header>

        <div className="content">
          {search ? (
            <SearchPage
              query={search}
              results={searchResults}
              onPlay={playTrack}
              onLike={toggleLike}
              isLiked={isLiked}
            />
          ) : (
            <>
              {page === "home" && (
                <HomePage
                  user={user}
                  recommendations={recommendations}
                  popular={popular}
                  newTracks={newTracks}
                  tracks={tracks}
                  onPlay={playTrack}
                  onLike={toggleLike}
                  isLiked={isLiked}
                  openPage={openPage}
                />
              )}

              {page === "popular" && (
                <TrackPage
                  title="Популярное"
                  subtitle="Треки, которые сейчас слушают"
                  tracks={popular}
                  onPlay={playTrack}
                  onLike={toggleLike}
                  isLiked={isLiked}
                />
              )}

              {page === "new" && (
                <TrackPage
                  title="Новинки"
                  subtitle="Свежая музыка в FENIX MUSIC"
                  tracks={newTracks}
                  onPlay={playTrack}
                  onLike={toggleLike}
                  isLiked={isLiked}
                />
              )}

              {page === "recommendations" && (
                <TrackPage
                  title="Для вас"
                  subtitle="Персональные рекомендации"
                  tracks={recommendations}
                  onPlay={playTrack}
                  onLike={toggleLike}
                  isLiked={isLiked}
                />
              )}

              {page === "tracks" && (
                <TrackPage
                  title="Вся музыка"
                  subtitle={`${tracks.length} треков`}
                  tracks={tracks}
                  onPlay={playTrack}
                  onLike={toggleLike}
                  isLiked={isLiked}
                />
              )}

              {page === "likes" && (
                <TrackPage
                  title="Избранное"
                  subtitle="Музыка, которую ты сохранил"
                  tracks={likes}
                  onPlay={playTrack}
                  onLike={toggleLike}
                  isLiked={isLiked}
                  emptyText={
                    user
                      ? "Здесь пока нет любимых треков"
                      : "Войди в аккаунт, чтобы использовать избранное"
                  }
                />
              )}

              {page === "history" && (
                <TrackPage
                  title="История"
                  subtitle="Недавно прослушанные треки"
                  tracks={history}
                  onPlay={playTrack}
                  onLike={toggleLike}
                  isLiked={isLiked}
                  emptyText="История прослушиваний пока пуста"
                />
              )}

              {page === "library" && (
                <LibraryPage
                  playlists={playlists}
                  likes={likes}
                  history={history}
                  user={user}
                  onCreate={() => setShowCreatePlaylist(true)}
                  onPlay={playTrack}
                  onLike={toggleLike}
                  isLiked={isLiked}
                  openPage={openPage}
                />
              )}

              {page === "artists" && (
                <ArtistsPage artists={artists} />
              )}

              {page === "albums" && (
                <AlbumsPage albums={albums} />
              )}

              {page === "profile" && (
                <ProfilePage
                  user={user}
                  profile={profile}
                  likes={likes}
                  history={history}
                  playlists={playlists}
                  onLogin={() => setAuthMode("login")}
                  onRegister={() => setAuthMode("register")}
                  onLogout={logout}
                  onSettings={() => setShowSettings(true)}
                />
              )}
            </>
          )}
        </div>
      </main>

      <Player
        track={currentTrack}
        playing={isPlaying}
        progress={progress}
        duration={duration}
        volume={volume}
        shuffle={shuffle}
        repeat={repeat}
        liked={isLiked(currentTrack)}
        onTogglePlay={togglePlay}
        onPrevious={previousTrack}
        onNext={nextTrack}
        onSeek={seek}
        onVolume={setVolume}
        onShuffle={() => setShuffle((value) => !value)}
        onRepeat={() => setRepeat((value) => !value)}
        onLike={() => currentTrack && toggleLike(currentTrack)}
        onQueue={() => setShowQueue(true)}
      />

      {showQueue && (
        <QueuePanel
          queue={queue}
          currentTrack={currentTrack}
          onPlay={(track) => playTrack(track, queue)}
          onClose={() => setShowQueue(false)}
        />
      )}

      {showCreatePlaylist && (
        <CreatePlaylistModal
          onClose={() => setShowCreatePlaylist(false)}
          onCreated={(playlist) => {
            setPlaylists((items) => [...items, playlist]);
            setShowCreatePlaylist(false);
            showToast("Плейлист создан");
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onUpdated={(updated) => {
            setUser(updated);
            showToast("Профиль обновлён");
          }}
        />
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          onClose={() => setAuthMode(null)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {loading && (
        <div className="loading-screen">
          <div className="loading-logo">
            <Music2 size={30} />
          </div>

          <div className="spinner" />

          <span>Загрузка FENIX MUSIC...</span>
        </div>
      )}

      {error && !loading && (
        <div className="error-toast">
          <span>{error}</span>

          <button onClick={loadInitialData}>
            <RefreshCw size={16} />
          </button>

          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* =========================================================
   SIDEBAR
========================================================= */

function Sidebar({
  page,
  openPage,
  user,
  onLogin,
  onRegister,
  onLogout,
  onSettings,
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Music2 size={25} />
        </div>

        <div>
          <strong>FENIX</strong>
          <span>MUSIC</span>
        </div>
      </div>

      <nav className="side-nav">
        <NavItem
          icon={<Home size={19} />}
          label="Главная"
          active={page === "home"}
          onClick={() => openPage("home")}
        />

        <NavItem
          icon={<Search size={19} />}
          label="Поиск"
          active={false}
          onClick={() =>
            document.querySelector(".search-box input")?.focus()
          }
        />

        <NavItem
          icon={<Library size={19} />}
          label="Моя библиотека"
          active={page === "library"}
          onClick={() => openPage("library")}
        />
      </nav>

      <div className="side-section">
        <div className="side-title">МУЗЫКА</div>

        <NavItem
          icon={<ListMusic size={18} />}
          label="Все треки"
          active={page === "tracks"}
          onClick={() => openPage("tracks")}
        />

        <NavItem
          icon={<Heart size={18} />}
          label="Избранное"
          active={page === "likes"}
          onClick={() => openPage("likes")}
        />

        <NavItem
          icon={<History size={18} />}
          label="История"
          active={page === "history"}
          onClick={() => openPage("history")}
        />

        <NavItem
          icon={<Mic2 size={18} />}
          label="Исполнители"
          active={page === "artists"}
          onClick={() => openPage("artists")}
        />

        <NavItem
          icon={<Disc3 size={18} />}
          label="Альбомы"
          active={page === "albums"}
          onClick={() => openPage("albums")}
        />
      </div>

      <div className="side-section">
        <div className="side-title">ОТКРЫТЬ</div>

        <NavItem
          icon={<Music2 size={18} />}
          label="Для вас"
          active={page === "recommendations"}
          onClick={() => openPage("recommendations")}
        />

        <NavItem
          icon={<Play size={18} />}
          label="Популярное"
          active={page === "popular"}
          onClick={() => openPage("popular")}
        />

        <NavItem
          icon={<RefreshCw size={18} />}
          label="Новинки"
          active={page === "new"}
          onClick={() => openPage("new")}
        />
      </div>

      <div className="sidebar-bottom">
        {user ? (
          <>
            <button
              className="sidebar-account"
              onClick={() => openPage("profile")}
            >
              <Avatar user={user} />

              <div>
                <strong>{user.username}</strong>
                <span>Профиль</span>
              </div>
            </button>

            <NavItem
              icon={<Settings size={18} />}
              label="Настройки"
              active={false}
              onClick={onSettings}
            />

            <NavItem
              icon={<LogOut size={18} />}
              label="Выйти"
              active={false}
              onClick={onLogout}
            />
          </>
        ) : (
          <div className="sidebar-auth">
            <div className="sidebar-auth-icon">
              <User size={22} />
            </div>

            <strong>Войди в FENIX MUSIC</strong>

            <span>
              Сохраняй любимую музыку и историю прослушивания.
            </span>

            <button
              className="primary-button full"
              onClick={onLogin}
            >
              Войти
            </button>

            <button
              className="ghost-button full"
              onClick={onRegister}
            >
              Создать аккаунт
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* =========================================================
   HOME
========================================================= */

function HomePage({
  user,
  recommendations,
  popular,
  newTracks,
  tracks,
  onPlay,
  onLike,
  isLiked,
  openPage,
}) {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">FENIX MUSIC</span>

          <h1>
            Музыка.
            <br />
            <span>Без границ.</span>
          </h1>

          <p>
            Слушай любимые треки, находи новых исполнителей
            и создавай свою музыкальную библиотеку.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button large"
              onClick={() => {
                if (tracks.length) onPlay(tracks[0], tracks);
              }}
            >
              <Play size={18} fill="currentColor" />
              Слушать музыку
            </button>

            {!user && (
              <button
                className="secondary-button large"
                onClick={() => openPage("library")}
              >
                Создать библиотеку
              </button>
            )}
          </div>
        </div>

        <div className="hero-decoration">
          <div className="hero-disc">
            <Disc3 size={190} strokeWidth={1} />
          </div>
        </div>
      </section>

      <TrackSection
        title="Для вас"
        subtitle="Подобрано специально для тебя"
        tracks={recommendations.slice(0, 6)}
        onPlay={onPlay}
        onLike={onLike}
        isLiked={isLiked}
        onMore={() => openPage("recommendations")}
      />

      <TrackSection
        title="Популярное"
        subtitle="Сейчас слушают чаще всего"
        tracks={popular.slice(0, 6)}
        onPlay={onPlay}
        onLike={onLike}
        isLiked={isLiked}
        onMore={() => openPage("popular")}
      />

      <TrackSection
        title="Новинки"
        subtitle="Свежие треки"
        tracks={newTracks.slice(0, 6)}
        onPlay={onPlay}
        onLike={onLike}
        isLiked={isLiked}
        onMore={() => openPage("new")}
      />
    </div>
  );
}

/* =========================================================
   TRACK PAGE
========================================================= */

function TrackPage({
  title,
  subtitle,
  tracks,
  onPlay,
  onLike,
  isLiked,
  emptyText = "Музыка пока отсутствует",
}) {
  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle} />

      {tracks.length ? (
        <div className="track-list">
          {tracks.map((track, index) => (
            <TrackRow
              key={`${track.id}-${index}`}
              track={track}
              index={index + 1}
              onPlay={() => onPlay(track, tracks)}
              onLike={() => onLike(track)}
              liked={isLiked(track)}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Music2 size={35} />} text={emptyText} />
      )}
    </div>
  );
}

function TrackSection({
  title,
  subtitle,
  tracks,
  onPlay,
  onLike,
  isLiked,
  onMore,
}) {
  if (!tracks.length) return null;

  return (
    <section className="track-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>

        {onMore && (
          <button className="text-button" onClick={onMore}>
            Показать всё
          </button>
        )}
      </div>

      <div className="track-grid">
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            onPlay={() => onPlay(track, tracks)}
            onLike={() => onLike(track)}
            liked={isLiked(track)}
          />
        ))}
      </div>
    </section>
  );
}

function TrackCard({ track, onPlay, onLike, liked }) {
  return (
    <article className="track-card">
      <div className="track-cover-wrap">
        {track.cover_url ? (
          <img
            className="track-cover"
            src={getCover(track)}
            alt={track.title}
          />
        ) : (
          <CoverPlaceholder />
        )}

        <button className="card-play" onClick={onPlay}>
          <Play size={21} fill="currentColor" />
        </button>

        <button
          className={`card-like ${liked ? "liked" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onLike();
          }}
        >
          <Heart size={17} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="track-card-info">
        <strong title={track.title}>{track.title}</strong>

        <span title={track.artist}>
          {track.artist || "Неизвестный исполнитель"}
        </span>
      </div>
    </article>
  );
}

function TrackRow({ track, index, onPlay, onLike, liked }) {
  return (
    <div className="track-row">
      <div className="track-number">
        <span>{index}</span>

        <button className="row-play" onClick={onPlay}>
          <Play size={16} fill="currentColor" />
        </button>
      </div>

      <div className="row-cover">
        {track.cover_url ? (
          <img src={getCover(track)} alt={track.title} />
        ) : (
          <CoverPlaceholder small />
        )}
      </div>

      <div className="row-main">
        <strong>{track.title}</strong>
        <span>{track.artist || "Неизвестный исполнитель"}</span>
      </div>

      <div className="row-album">
        {track.album || "Singles"}
      </div>

      <div className="row-genre">
        {track.genre || "Unknown"}
      </div>

      <button
        className={`row-like ${liked ? "liked" : ""}`}
        onClick={onLike}
      >
        <Heart size={17} fill={liked ? "currentColor" : "none"} />
      </button>

      <span className="row-duration">
        {track.duration_label || formatTime(track.duration)}
      </span>

      <button className="row-more">
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}

function CoverPlaceholder({ small = false }) {
  return (
    <div className={`cover-placeholder ${small ? "small" : ""}`}>
      <Music2 size={small ? 19 : 32} />
    </div>
  );
}

/* =========================================================
   SEARCH
========================================================= */

function SearchPage({
  query,
  results,
  onPlay,
  onLike,
  isLiked,
}) {
  return (
    <div className="page">
      <PageHeader
        title={`Результаты поиска`}
        subtitle={`По запросу «${query}» найдено: ${results.length}`}
      />

      {results.length ? (
        <div className="track-list">
          {results.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index + 1}
              onPlay={() => onPlay(track, results)}
              onLike={() => onLike(track)}
              liked={isLiked(track)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search size={35} />}
          text="Ничего не найдено"
        />
      )}
    </div>
  );
}

/* =========================================================
   LIBRARY
========================================================= */

function LibraryPage({
  playlists,
  likes,
  history,
  user,
  onCreate,
  onPlay,
  onLike,
  isLiked,
  openPage,
}) {
  return (
    <div className="page">
      <PageHeader
        title="Моя библиотека"
        subtitle={
          user
            ? "Твоя музыка, избранное и плейлисты"
            : "Войди, чтобы сохранять свою библиотеку"
        }
      />

      <div className="library-actions">
        <button
          className="primary-button"
          onClick={onCreate}
          disabled={!user}
        >
          <Plus size={18} />
          Новый плейлист
        </button>
      </div>

      <div className="library-stats">
        <button onClick={() => openPage("likes")}>
          <Heart size={24} />
          <strong>{likes.length}</strong>
          <span>Избранных треков</span>
        </button>

        <button onClick={() => openPage("history")}>
          <History size={24} />
          <strong>{history.length}</strong>
          <span>В истории</span>
        </button>

        <div>
          <ListMusic size={24} />
          <strong>{playlists.length}</strong>
          <span>Плейлистов</span>
        </div>
      </div>

      <div className="section-heading library-heading">
        <div>
          <h2>Плейлисты</h2>
          <p>Твои подборки</p>
        </div>
      </div>

      {playlists.length ? (
        <div className="playlist-grid">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ListMusic size={35} />}
          text={
            user
              ? "У тебя пока нет плейлистов"
              : "Войди, чтобы создавать плейлисты"
          }
        />
      )}

      {likes.length > 0 && (
        <TrackSection
          title="Избранное"
          subtitle="Твои любимые треки"
          tracks={likes.slice(0, 6)}
          onPlay={onPlay}
          onLike={onLike}
          isLiked={isLiked}
          onMore={() => openPage("likes")}
        />
      )}
    </div>
  );
}

function PlaylistCard({ playlist }) {
  return (
    <div className="playlist-card">
      <div className="playlist-cover">
        {playlist.cover_url ? (
          <img src={apiUrl(playlist.cover_url)} alt={playlist.name} />
        ) : (
          <ListMusic size={45} />
        )}
      </div>

      <strong>{playlist.name}</strong>

      <span>
        {playlist.description || "Плейлист FENIX MUSIC"}
      </span>
    </div>
  );
}

/* =========================================================
   ARTISTS / ALBUMS
========================================================= */

function ArtistsPage({ artists }) {
  return (
    <div className="page">
      <PageHeader
        title="Исполнители"
        subtitle="Исполнители твоей музыкальной библиотеки"
      />

      {artists.length ? (
        <div className="artist-grid">
          {artists.map((artist, index) => {
            const name =
              typeof artist === "string"
                ? artist
                : artist.name || artist.artist || "Unknown";

            return (
              <div className="artist-card" key={`${name}-${index}`}>
                <div className="artist-avatar">
                  <Mic2 size={38} />
                </div>

                <strong>{name}</strong>

                {artist.track_count != null && (
                  <span>{artist.track_count} треков</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Mic2 size={35} />}
          text="Исполнители пока отсутствуют"
        />
      )}
    </div>
  );
}

function AlbumsPage({ albums }) {
  return (
    <div className="page">
      <PageHeader
        title="Альбомы"
        subtitle="Музыкальные альбомы"
      />

      {albums.length ? (
        <div className="album-grid">
          {albums.map((album, index) => {
            const name =
              typeof album === "string"
                ? album
                : album.name || album.album || "Singles";

            const artist =
              typeof album === "object"
                ? album.artist || ""
                : "";

            return (
              <div className="album-card" key={`${name}-${index}`}>
                <div className="album-cover">
                  {album.cover_url ? (
                    <img
                      src={apiUrl(album.cover_url)}
                      alt={name}
                    />
                  ) : (
                    <Disc3 size={50} />
                  )}
                </div>

                <strong>{name}</strong>

                {artist && <span>{artist}</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Disc3 size={35} />}
          text="Альбомы пока отсутствуют"
        />
      )}
    </div>
  );
}

/* =========================================================
   PROFILE
========================================================= */

function ProfilePage({
  user,
  profile,
  likes,
  history,
  playlists,
  onLogin,
  onRegister,
  onLogout,
  onSettings,
}) {
  if (!user) {
    return (
      <div className="page profile-login">
        <div className="profile-login-card">
          <div className="profile-big-icon">
            <User size={50} />
          </div>

          <h1>Твой профиль FENIX</h1>

          <p>
            Войди или зарегистрируйся, чтобы сохранять музыку,
            историю и создавать плейлисты.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={onLogin}>
              <LogIn size={18} />
              Войти
            </button>

            <button
              className="secondary-button"
              onClick={onRegister}
            >
              <UserPlus size={18} />
              Регистрация
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalSeconds =
    profile?.total_listening_seconds ||
    profile?.listening_seconds ||
    0;

  return (
    <div className="page">
      <div className="profile-header">
        <Avatar user={user} large />

        <div className="profile-info">
          <span>ПРОФИЛЬ</span>

          <h1>{user.username}</h1>

          <p>{user.email}</p>

          {user.created_at && (
            <small>
              В FENIX MUSIC с{" "}
              {new Date(user.created_at).toLocaleDateString(
                "ru-RU"
              )}
            </small>
          )}
        </div>

        <div className="profile-actions">
          <button
            className="secondary-button"
            onClick={onSettings}
          >
            <Settings size={17} />
            Настройки
          </button>

          <button
            className="ghost-button"
            onClick={onLogout}
          >
            <LogOut size={17} />
            Выйти
          </button>
        </div>
      </div>

      <div className="profile-stat-grid">
        <div>
          <Heart size={22} />
          <strong>{likes.length}</strong>
          <span>Избранное</span>
        </div>

        <div>
          <History size={22} />
          <strong>{history.length}</strong>
          <span>Прослушиваний</span>
        </div>

        <div>
          <ListMusic size={22} />
          <strong>{playlists.length}</strong>
          <span>Плейлистов</span>
        </div>

        <div>
          <Music2 size={22} />
          <strong>{formatTime(totalSeconds)}</strong>
          <span>Время прослушивания</span>
        </div>
      </div>

      {user.bio && (
        <div className="bio-card">
          <h3>О себе</h3>
          <p>{user.bio}</p>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, large = false }) {
  if (user?.avatar_url) {
    return (
      <img
        className={`avatar ${large ? "large" : ""}`}
        src={apiUrl(user.avatar_url)}
        alt={user.username || "User"}
      />
    );
  }

  return (
    <div className={`avatar avatar-placeholder ${large ? "large" : ""}`}>
      {(user?.username || "F").slice(0, 1).toUpperCase()}
    </div>
  );
}

/* =========================================================
   PLAYER
========================================================= */

function Player({
  track,
  playing,
  progress,
  duration,
  volume,
  shuffle,
  repeat,
  liked,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onVolume,
  onShuffle,
  onRepeat,
  onLike,
  onQueue,
}) {
  if (!track) {
    return (
      <div className="player empty-player">
        <div className="empty-player-brand">
          <Music2 size={21} />
          <span>Выбери трек, чтобы начать прослушивание</span>
        </div>
      </div>
    );
  }

  return (
    <div className="player">
      <div className="player-track">
        <div className="player-cover">
          {track.cover_url ? (
            <img src={getCover(track)} alt={track.title} />
          ) : (
            <CoverPlaceholder small />
          )}
        </div>

        <div className="player-info">
          <strong>{track.title}</strong>
          <span>{track.artist || "Unknown Artist"}</span>
        </div>

        <button
          className={`player-like ${liked ? "liked" : ""}`}
          onClick={onLike}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button
            className={`control-button ${shuffle ? "active" : ""}`}
            onClick={onShuffle}
          >
            <Shuffle size={17} />
          </button>

          <button className="control-button" onClick={onPrevious}>
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button
            className="play-button"
            onClick={onTogglePlay}
          >
            {playing ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" />
            )}
          </button>

          <button className="control-button" onClick={onNext}>
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button
            className={`control-button ${repeat ? "active" : ""}`}
            onClick={onRepeat}
          >
            <Repeat size={17} />
          </button>
        </div>

        <div className="progress-row">
          <span>{formatTime(progress)}</span>

          <input
            className="progress-slider"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(progress, duration || 0)}
            onChange={(event) => seekValue(event, onSeek)}
          />

          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <button
          className="control-button"
          onClick={onQueue}
          title="Очередь"
        >
          <ListMusic size={19} />
        </button>

        <div className="volume-control">
          <button
            className="control-button"
            onClick={() =>
              onVolume(volume > 0 ? 0 : 1)
            }
          >
            {volume === 0 ? (
              <VolumeX size={19} />
            ) : (
              <Volume2 size={19} />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) =>
              onVolume(Number(event.target.value))
            }
          />
        </div>

        <button
          className="control-button"
          onClick={() => {
            const element = document.documentElement;

            if (!document.fullscreenElement) {
              element.requestFullscreen?.();
            } else {
              document.exitFullscreen?.();
            }
          }}
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
}

function seekValue(event, onSeek) {
  onSeek(Number(event.target.value));
}

/* =========================================================
   QUEUE
========================================================= */

function QueuePanel({
  queue,
  currentTrack,
  onPlay,
  onClose,
}) {
  return (
    <div className="overlay">
      <div className="queue-panel">
        <div className="modal-header">
          <div>
            <h2>Очередь</h2>
            <span>{queue.length} треков</span>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="queue-list">
          {queue.length ? (
            queue.map((track, index) => (
              <button
                className={`queue-item ${
                  currentTrack?.id === track.id ? "current" : ""
                }`}
                key={`${track.id}-${index}`}
                onClick={() => onPlay(track)}
              >
                <div className="queue-cover">
                  {track.cover_url ? (
                    <img
                      src={getCover(track)}
                      alt={track.title}
                    />
                  ) : (
                    <CoverPlaceholder small />
                  )}
                </div>

                <div>
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                </div>

                <span>
                  {track.duration_label ||
                    formatTime(track.duration)}
                </span>
              </button>
            ))
          ) : (
            <EmptyState
              icon={<ListMusic size={32} />}
              text="Очередь пуста"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   AUTH
========================================================= */

function AuthModal({
  mode,
  setMode,
  onClose,
  onSuccess,
}) {
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (mode === "register") {
      if (values.username.trim().length < 2) {
        setError("Введите имя пользователя");
        return;
      }

      if (values.password.length < 6) {
        setError("Пароль должен содержать минимум 6 символов");
        return;
      }

      if (values.password !== values.confirmPassword) {
        setError("Пароли не совпадают");
        return;
      }
    }

    setLoading(true);

    try {
      let data;

      if (mode === "register") {
        data = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username: values.username.trim(),
            email: values.email.trim(),
            password: values.password,
          }),
        });
      } else {
        data = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: values.email.trim(),
            password: values.password,
          }),
        });
      }

      const token = data.token || data.access_token;

      if (!token) {
        throw new Error("Сервер не вернул токен авторизации");
      }

      localStorage.setItem(TOKEN_KEY, token);

      onSuccess(data.user || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay">
      <div className="auth-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="auth-logo">
          <Music2 size={28} />
        </div>

        <h1>
          {mode === "register"
            ? "Создать аккаунт"
            : "С возвращением"}
        </h1>

        <p>
          {mode === "register"
            ? "Создай аккаунт FENIX MUSIC"
            : "Войди в свой аккаунт"}
        </p>

        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Имя пользователя
              <input
                value={values.username}
                onChange={(event) =>
                  update("username", event.target.value)
                }
                placeholder="FenixUser"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={values.email}
              onChange={(event) =>
                update("email", event.target.value)
              }
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              value={values.password}
              onChange={(event) =>
                update("password", event.target.value)
              }
              placeholder="Минимум 6 символов"
              required
            />
          </label>

          {mode === "register" && (
            <label>
              Повторите пароль
              <input
                type="password"
                value={values.confirmPassword}
                onChange={(event) =>
                  update(
                    "confirmPassword",
                    event.target.value
                  )
                }
                placeholder="Повторите пароль"
                required
              />
            </label>
          )}

          {error && <div className="form-error">{error}</div>}

          <button
            className="primary-button auth-submit"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <RefreshCw className="spin" size={18} />
                Подождите...
              </>
            ) : mode === "register" ? (
              <>
                <UserPlus size={18} />
                Зарегистрироваться
              </>
            ) : (
              <>
                <LogIn size={18} />
                Войти
              </>
            )}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "register" ? (
            <>
              Уже есть аккаунт?
              <button onClick={() => setMode("login")}>
                Войти
              </button>
            </>
          ) : (
            <>
              Нет аккаунта?
              <button onClick={() => setMode("register")}>
                Регистрация
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   CREATE PLAYLIST
========================================================= */

function CreatePlaylistModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Введите название плейлиста");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await api("/api/playlists", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          is_public: true,
        }),
      });

      onCreated(data.playlist || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>Новый плейлист</h2>
            <span>Создай свою подборку</span>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit}>
          <label>
            Название
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Мой плейлист"
              autoFocus
            />
          </label>

          <label>
            Описание
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Например: музыка для дороги"
              rows={4}
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Отмена
            </button>

            <button
              className="primary-button"
              disabled={loading}
              type="submit"
            >
              <Check size={17} />
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   SETTINGS
========================================================= */

function SettingsModal({
  user,
  onClose,
  onUpdated,
}) {
  const [username, setUsername] = useState(
    user?.username || ""
  );

  const [bio, setBio] = useState(user?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(
    user?.avatar_url || ""
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const data = await api("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          username: username.trim(),
          bio,
          avatar_url: avatarUrl.trim() || null,
        }),
      });

      onUpdated(data.user || data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>Настройки профиля</h2>
            <span>Измени данные своего аккаунта</span>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={save}>
          <label>
            Имя пользователя
            <input
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
            />
          </label>

          <label>
            О себе
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              placeholder="Расскажи немного о себе"
            />
          </label>

          <label>
            URL аватара
            <input
              value={avatarUrl}
              onChange={(event) =>
                setAvatarUrl(event.target.value)
              }
              placeholder="https://..."
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Отмена
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   COMMON
========================================================= */

function PageHeader({ title, subtitle }) {
  return (
    <div className="page-header">
      <span className="eyebrow">FENIX MUSIC</span>

      <h1>{title}</h1>

      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <strong>{text}</strong>
    </div>
  );
}

export default App;
