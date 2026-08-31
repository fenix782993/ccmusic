```jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/*
  FENIX MUSIC
  Full frontend App.js
  Без lucide-react.
*/

const API =
  process.env.REACT_APP_API_URL ||
  process.env.PUBLIC_API_URL ||
  "";

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800";

const DEMO_TRACKS = [
  {
    id: "demo-1",
    title: "Neon Horizon",
    artist_name: "CyberPulse",
    album_name: "Cyber Odyssey",
    genre: "Synthwave",
    duration: 214,
    plays: 1420932,
    cover_url:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
    audio_url:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "demo-2",
    title: "Midnight Rain",
    artist_name: "Aura",
    album_name: "Lost Frequencies",
    genre: "Lo-Fi",
    duration: 198,
    plays: 980000,
    cover_url:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
    audio_url:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: "demo-3",
    title: "Electric Dreams",
    artist_name: "Vektor",
    album_name: "Neon Grid",
    genre: "Electro",
    duration: 245,
    plays: 3200000,
    cover_url:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800",
    audio_url:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    id: "demo-4",
    title: "After Midnight",
    artist_name: "Nova",
    album_name: "Night Drive",
    genre: "Chill",
    duration: 231,
    plays: 740000,
    cover_url:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800",
    audio_url:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
];

const ICONS = {
  home: "⌂",
  search: "⌕",
  library: "▤",
  heart: "♡",
  heartFill: "♥",
  play: "▶",
  pause: "Ⅱ",
  previous: "◀◀",
  next: "▶▶",
  shuffle: "⇄",
  repeat: "↻",
  volume: "🔊",
  mute: "🔇",
  user: "●",
  menu: "☰",
  close: "×",
  settings: "⚙",
  bell: "🔔",
  clock: "◷",
  crown: "♛",
  telegram: "➤",
  plus: "+",
  trash: "⌫",
  edit: "✎",
  lock: "🔒",
  shield: "◇",
  refresh: "↻",
  check: "✓",
  arrow: "→",
  music: "♫",
  album: "◉",
  radio: "◉",
  upload: "↑",
  download: "↓",
  more: "⋯",
};

function Icon({ name, className = "" }) {
  return (
    <span className={`fenix-icon ${className}`} aria-hidden="true">
      {ICONS[name] || "•"}
    </span>
  );
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  const secondsPart = String(seconds % 60).padStart(2, "0");

  return `${minutes}:${secondsPart}`;
}

function apiUrl(path) {
  return `${API}${path}`;
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage может быть отключён браузером.
  }
}

function randomCaptcha() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

function normalizeTrack(track) {
  return {
    ...track,
    id: track.id ?? track.track_id,
    title: track.title || track.name || "Без названия",
    artist_name:
      track.artist_name ||
      track.artist ||
      track.author ||
      "Неизвестный артист",
    album_name:
      track.album_name ||
      track.album ||
      "Без альбома",
    genre: track.genre || "Music",
    duration: Number(track.duration || 0),
    plays: Number(track.plays || track.play_count || 0),
    cover_url:
      track.cover_url ||
      track.cover ||
      track.album_cover_url ||
      DEFAULT_COVER,
    audio_url:
      track.audio_url ||
      track.stream_url ||
      track.url ||
      "",
  };
}

/* =========================
   MAIN APP
========================= */

export default function App() {
  const audioRef = useRef(null);

  const [page, setPage] = useState("home");

  const [tracks, setTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [apiError, setApiError] = useState("");

  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);

  const [search, setSearch] = useState("");

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(
    Number(localStorage.getItem("fenix_volume") || 0.8)
  );

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");

  const [queue, setQueue] = useState([]);
  const [queueOpen, setQueueOpen] = useState(false);

  const [fullPlayer, setFullPlayer] = useState(false);

  const [favorites, setFavorites] = useState(() =>
    readStorage("fenix_favorites", [])
  );

  const [history, setHistory] = useState(() =>
    readStorage("fenix_history", [])
  );

  const [playlists, setPlaylists] = useState(() =>
    readStorage("fenix_playlists", [])
  );

  const [notifications, setNotifications] = useState(() =>
    readStorage("fenix_notifications", [])
  );

  const [settings, setSettings] = useState(() =>
    readStorage("fenix_settings", {
      theme: "dark",
      quality: "high",
      autoplay: true,
      autoNext: true,
      notifications: true,
      language: "ru",
    })
  );

  const [user, setUser] = useState(() =>
    readStorage("fenix_user", null)
  );

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const [mobileMenu, setMobileMenu] = useState(false);

  /* =========================
     STORAGE
  ========================= */

  useEffect(() => {
    saveStorage("fenix_user", user);
  }, [user]);

  useEffect(() => {
    saveStorage("fenix_favorites", favorites);
  }, [favorites]);

  useEffect(() => {
    saveStorage("fenix_history", history);
  }, [history]);

  useEffect(() => {
    saveStorage("fenix_playlists", playlists);
  }, [playlists]);

  useEffect(() => {
    saveStorage("fenix_notifications", notifications);
  }, [notifications]);

  useEffect(() => {
    saveStorage("fenix_settings", settings);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("fenix_volume", String(volume));
  }, [volume]);

  /* =========================
     LOAD TRACKS
  ========================= */

  const loadTracks = async () => {
    try {
      setApiError("");

      const response = await fetch(apiUrl("/api/tracks"), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Ошибка API");
      }

      const data = await response.json();

      let list = [];

      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data.tracks)) {
        list = data.tracks;
      } else if (Array.isArray(data.items)) {
        list = data.items;
      }

      setTracks(list.map(normalizeTrack));
    } catch {
      setTracks((previous) =>
        previous.length ? previous : DEMO_TRACKS
      );

      setApiError(
        "API музыки временно недоступен. Показана локальная библиотека."
      );
    } finally {
      setLoadingTracks(false);
    }
  };

  useEffect(() => {
    loadTracks();

    const timer = setInterval(() => {
      loadTracks();
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  /* =========================
     AUDIO
  ========================= */

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    const source =
      currentTrack.audio_url ||
      `${API}/api/tracks/${currentTrack.id}/audio`;

    if (source && audio.src !== new URL(source, window.location.origin).href) {
      audio.src = source;
      audio.load();
    }

    if (playing) {
      audio.play().catch(() => {
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [currentTrack, playing]);

  const playTrack = (track, list = tracks) => {
    const normalized = normalizeTrack(track);

    setCurrentTrack(normalized);
    setPlaying(true);

    setQueue(
      list && list.length
        ? list.map(normalizeTrack)
        : [normalized]
    );

    setHistory((previous) => {
      const cleaned = previous.filter(
        (item) => String(item.id) !== String(normalized.id)
      );

      return [
        {
          ...normalized,
          played_at: Date.now(),
        },
        ...cleaned,
      ].slice(0, 100);
    });
  };

  const nextTrack = () => {
    if (!currentTrack) {
      return;
    }

    const list = queue.length ? queue : tracks;

    if (!list.length) {
      return;
    }

    if (repeat === "one") {
      const audio = audioRef.current;

      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }

      setPlaying(true);
      return;
    }

    let index = list.findIndex(
      (item) => String(item.id) === String(currentTrack.id)
    );

    if (index < 0) {
      index = 0;
    }

    if (shuffle) {
      index = Math.floor(Math.random() * list.length);
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
  };

  const previousTrack = () => {
    const list = queue.length ? queue : tracks;

    if (!list.length) {
      return;
    }

    let index = list.findIndex(
      (item) => String(item.id) === String(currentTrack?.id)
    );

    if (index < 0) {
      index = 0;
    }

    index -= 1;

    if (index < 0) {
      index = list.length - 1;
    }

    playTrack(list[index], list);
  };

  const togglePlaying = () => {
    if (!currentTrack) {
      if (tracks[0]) {
        playTrack(tracks[0], tracks);
      }

      return;
    }

    setPlaying((value) => !value);
  };

  const seek = (event) => {
    const value = Number(event.target.value);

    if (!audioRef.current || !audioRef.current.duration) {
      return;
    }

    audioRef.current.currentTime =
      value * audioRef.current.duration;

    setPosition(value * audioRef.current.duration);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) {
      return;
    }

    setPosition(audioRef.current.currentTime || 0);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) {
      return;
    }

    setDuration(
      Number(
        audioRef.current.duration ||
          currentTrack?.duration ||
          0
      )
    );
  };

  const handleEnded = () => {
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
  };

  /* =========================
     FAVORITES
  ========================= */

  const isFavorite = (track) => {
    if (!track) {
      return false;
    }

    return favorites.some(
      (item) => String(item.id) === String(track.id)
    );
  };

  const toggleFavorite = (track) => {
    const normalized = normalizeTrack(track);

    setFavorites((previous) => {
      const exists = previous.some(
        (item) => String(item.id) === String(normalized.id)
      );

      if (exists) {
        return previous.filter(
          (item) => String(item.id) !== String(normalized.id)
        );
      }

      return [...previous, normalized];
    });
  };

  /* =========================
     SEARCH
  ========================= */

  const filteredTracks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return tracks;
    }

    return tracks.filter((track) => {
      const text = [
        track.title,
        track.artist_name,
        track.album_name,
        track.genre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }, [tracks, search]);

  /* =========================
     USER
  ========================= */

  const logout = () => {
    localStorage.removeItem("fenix_token");
    localStorage.removeItem("fenix_user");

    setUser(null);
    setPage("home");
  };

  /* =========================
     RENDER
  ========================= */

  return (
    <div className={`fenix-app theme-${settings.theme}`}>
      <aside
        className={`sidebar ${
          mobileMenu ? "sidebar-open" : ""
        }`}
      >
        <div className="brand">
          <div className="brand-logo">FX</div>

          <div className="brand-text">
            <strong>FENIX MUSIC</strong>
            <small>HI-RES STREAMING</small>
          </div>

          <button
            className="sidebar-close"
            onClick={() => setMobileMenu(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="nav-group">
          <span className="nav-label">Меню</span>

          <NavItem
            icon="home"
            label="Главная"
            active={page === "home"}
            onClick={() => {
              setPage("home");
              setMobileMenu(false);
            }}
          />

          <NavItem
            icon="search"
            label="Поиск"
            active={page === "search"}
            onClick={() => {
              setPage("search");
              setMobileMenu(false);
            }}
          />

          <NavItem
            icon="radio"
            label="Рекомендации"
            active={page === "recommendations"}
            onClick={() => {
              setPage("recommendations");
              setMobileMenu(false);
            }}
          />
        </div>

        <div className="nav-group">
          <span className="nav-label">Медиатека</span>

          <NavItem
            icon="library"
            label="Библиотека"
            active={page === "library"}
            onClick={() => setPage("library")}
          />

          <NavItem
            icon="heart"
            label="Избранное"
            active={page === "favorites"}
            badge={favorites.length}
            onClick={() => setPage("favorites")}
          />

          <NavItem
            icon="clock"
            label="История"
            active={page === "history"}
            onClick={() => setPage("history")}
          />

          <NavItem
            icon="music"
            label="Плейлисты"
            active={page === "playlists"}
            onClick={() => setPage("playlists")}
          />

          <NavItem
            icon="album"
            label="Альбомы"
            active={page === "albums"}
            onClick={() => setPage("albums")}
          />

          <NavItem
            icon="user"
            label="Артисты"
            active={page === "artists"}
            onClick={() => setPage("artists")}
          />
        </div>

        <div className="sidebar-bottom">
          <button
            className="premium-side"
            onClick={() => setPage("premium")}
          >
            <Icon name="crown" />
            <span>Fenix Premium</span>
          </button>

          <button
            className="sidebar-account"
            onClick={() =>
              setPage(user ? "profile" : "login")
            }
          >
            <div className="mini-avatar">
              {(user?.username || "FX")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <span>
              <b>{user?.username || "Гость"}</b>
              <small>
                {user ? "Открыть профиль" : "Войти в аккаунт"}
              </small>
            </span>
          </button>

          <button
            className="settings-side"
            onClick={() => setPage("settings")}
          >
            <Icon name="settings" />
            Настройки
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <Icon name={mobileMenu ? "close" : "menu"} />
          </button>

          <div className="mobile-brand">
            <span>FENIX</span>
          </div>

          <div className="top-search">
            <Icon name="search" />

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);

                if (event.target.value.trim()) {
                  setPage("search");
                }
              }}
              placeholder="Что хотите послушать?"
            />
          </div>

          <div className="top-actions">
            <button
              className="telegram-button"
              onClick={() => setPage("telegram")}
            >
              <Icon name="telegram" />
              Telegram
            </button>

            <button
              className="notification-button"
              onClick={() => setPage("notifications")}
            >
              <Icon name="bell" />

              {notifications.length > 0 && (
                <i>{notifications.length}</i>
              )}
            </button>

            <button
              className="premium-button"
              onClick={() => setPage("premium")}
            >
              💎 Premium
            </button>

            <button
              className="top-avatar"
              onClick={() =>
                setPage(user ? "profile" : "login")
              }
            >
              {(user?.username || "FX")
                .slice(0, 2)
                .toUpperCase()}
            </button>
          </div>
        </header>

        <div className="page-container">
          {apiError && (
            <div className="api-warning">
              {apiError}
            </div>
          )}

          {page === "home" && (
            <HomePage
              tracks={tracks}
              visibleTracks={filteredTracks}
              history={history}
              loading={loadingTracks}
              playTrack={playTrack}
              toggleFavorite={toggleFavorite}
              isFavorite={isFavorite}
              setPage={setPage}
            />
          )}

          {page === "search" && (
            <SearchPage
              search={search}
              setSearch={setSearch}
              tracks={filteredTracks}
              playTrack={playTrack}
              toggleFavorite={toggleFavorite}
              isFavorite={isFavorite}
            />
          )}

          {page === "recommendations" && (
            <RecommendationsPage
              tracks={tracks}
              history={history}
              playTrack={playTrack}
              toggleFavorite={toggleFavorite}
              isFavorite={isFavorite}
            />
          )}

          {page === "library" && (
            <LibraryPage
              favorites={favorites}
              history={history}
              playlists={playlists}
              tracks={tracks}
              playTrack={playTrack}
              setPage={setPage}
            />
          )}

          {page === "favorites" && (
            <TrackListPage
              title="Избранное"
              subtitle={`${favorites.length} сохранённых треков`}
              tracks={favorites}
              playTrack={playTrack}
              toggleFavorite={toggleFavorite}
              isFavorite={isFavorite}
            />
          )}

          {page === "history" && (
            <TrackListPage
              title="История"
              subtitle="Недавно прослушанные треки"
              tracks={history}
              playTrack={playTrack}
              toggleFavorite={toggleFavorite}
              isFavorite={isFavorite}
            />
          )}

          {page === "playlists" && (
            <PlaylistsPage
              playlists={playlists}
              setPlaylists={setPlaylists}
              tracks={tracks}
              playTrack={playTrack}
            />
          )}

          {page === "albums" && (
            <AlbumsPage
              tracks={tracks}
              playTrack={playTrack}
            />
          )}

          {page === "artists" && (
            <ArtistsPage
              tracks={tracks}
              playTrack={playTrack}
            />
          )}

          {page === "notifications" && (
            <NotificationsPage
              notifications={notifications}
              setNotifications={setNotifications}
            />
          )}

          {page === "telegram" && <TelegramPage />}

          {page === "premium" && <PremiumPage />}

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
              openAuth={() => {
                setAuthMode("login");
                setAuthOpen(true);
              }}
            />
          )}

          {page === "login" && (
            <LoginPage
              onLogin={() => {
                setAuthMode("login");
                setAuthOpen(true);
              }}
              onRegister={() => {
                setAuthMode("register");
                setAuthOpen(true);
              }}
            />
          )}
        </div>
      </main>

      <MobileNavigation
        page={page}
        setPage={setPage}
      />

      {currentTrack && (
        <PlayerBar
          track={currentTrack}
          playing={playing}
          position={position}
          duration={
            duration ||
            currentTrack.duration ||
            0
          }
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

      {currentTrack && queueOpen && (
        <QueuePanel
          queue={queue.length ? queue : tracks}
          currentTrack={currentTrack}
          playTrack={playTrack}
          close={() => setQueueOpen(false)}
        />
      )}

      {currentTrack && fullPlayer && (
        <FullPlayer
          track={currentTrack}
          playing={playing}
          position={position}
          duration={
            duration ||
            currentTrack.duration ||
            0
          }
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

      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          close={() => setAuthOpen(false)}
          onSuccess={(account, token) => {
            if (token) {
              localStorage.setItem(
                "fenix_token",
                token
              );
            }

            setUser(account);
            setAuthOpen(false);
            setPage("home");
          }}
        />
      )}
    </div>
  );
}

/* =========================
   NAVIGATION
========================= */

function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <Icon name={icon} />

      <span>{label}</span>

      {badge > 0 && (
        <em>{badge}</em>
      )}
    </button>
  );
}

function MobileNavigation({
  page,
  setPage,
}) {
  return (
    <nav className="mobile-navigation">
      <button
        className={page === "home" ? "active" : ""}
        onClick={() => setPage("home")}
      >
        <Icon name="home" />
        <span>Главная</span>
      </button>

      <button
        className={page === "search" ? "active" : ""}
        onClick={() => setPage("search")}
      >
        <Icon name="search" />
        <span>Поиск</span>
      </button>

      <button
        className={page === "library" ? "active" : ""}
        onClick={() => setPage("library")}
      >
        <Icon name="library" />
        <span>Моя музыка</span>
      </button>

      <button
        className={page === "favorites" ? "active" : ""}
        onClick={() => setPage("favorites")}
      >
        <Icon name="heart" />
        <span>Избранное</span>
      </button>

      <button
        className={page === "profile" ? "active" : ""}
        onClick={() => setPage("profile")}
      >
        <Icon name="user" />
        <span>Профиль</span>
      </button>
    </nav>
  );
}

/* =========================
   HOME
========================= */

function HomePage({
  tracks,
  visibleTracks,
  history,
  loading,
  playTrack,
  toggleFavorite,
  isFavorite,
  setPage,
}) {
  return (
    <div className="page">
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            ✦ FENIX MUSIC
          </span>

          <h1>
            Твоя музыка.
            <br />
            <span>Твоя вселенная.</span>
          </h1>

          <p>
            Слушай любимые треки, открывай новых
            артистов и собирай собственную музыкальную
            библиотеку.
          </p>

          <div className="hero-buttons">
            {visibleTracks[0] && (
              <button
                className="primary-button"
                onClick={() =>
                  playTrack(
                    visibleTracks[0],
                    visibleTracks
                  )
                }
              >
                <Icon name="play" />
                Слушать сейчас
              </button>
            )}

            <button
              className="secondary-button"
              onClick={() =>
                setPage("recommendations")
              }
            >
              ✦ Для вас
            </button>
          </div>
        </div>

        <div className="hero-art">
          {tracks[0] && (
            <img
              src={tracks[0].cover_url}
              alt=""
            />
          )}
        </div>
      </section>

      <MusicSection
        title="Для вас"
        subtitle="Персональные рекомендации"
        tracks={visibleTracks.slice(0, 6)}
        playTrack={playTrack}
        toggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
      />

      <MusicSection
        title="Новинки"
        subtitle="Свежие релизы"
        tracks={tracks.slice(0, 6)}
        playTrack={playTrack}
        toggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
      />

      <MusicSection
        title="Популярное"
        subtitle="Сейчас слушают чаще всего"
        tracks={[...tracks]
          .sort(
            (a, b) =>
              Number(b.plays || 0) -
              Number(a.plays || 0)
          )
          .slice(0, 6)}
        playTrack={playTrack}
        toggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
      />

      <MusicSection
        title="Миксы"
        subtitle="Подборки специально для тебя"
        tracks={[...tracks]
          .reverse()
          .slice(0, 6)}
        playTrack={playTrack}
        toggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
      />

      {history.length > 0 && (
        <MusicSection
          title="Недавно прослушанное"
          subtitle="Продолжить слушать"
          tracks={history.slice(0, 6)}
          playTrack={playTrack}
          toggleFavorite={toggleFavorite}
          isFavorite={isFavorite}
        />
      )}

      {loading && (
        <div className="empty-state">
          Загрузка музыкального каталога…
        </div>
      )}
    </div>
  );
}

function MusicSection({
  title,
  subtitle,
  tracks,
  playTrack,
  toggleFavorite,
  isFavorite,
}) {
  return (
    <section className="music-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>

          {subtitle && (
            <span>{subtitle}</span>
          )}
        </div>

        <button>
          Показать всё →
        </button>
      </div>

      {tracks.length > 0 ? (
        <div className="track-grid">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              playTrack={playTrack}
              toggleFavorite={toggleFavorite}
              isFavorite={isFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state small">
          Пока нет треков.
        </div>
      )}
    </section>
  );
}

function TrackCard({
  track,
  playTrack,
  toggleFavorite,
  isFavorite,
}) {
  return (
    <article className="track-card">
      <button
        className="track-cover"
        onClick={() => playTrack(track)}
      >
        <img
          src={track.cover_url || DEFAULT_COVER}
          alt=""
        />

        <span className="track-play">
          <Icon name="play" />
        </span>
      </button>

      <div className="track-card-info">
        <button
          className="track-title"
          onClick={() => playTrack(track)}
        >
          {track.title}
        </button>

        <span>
          {track.artist_name}
        </span>

        <div className="track-meta">
          <small>{track.genre}</small>
          <small>
            {formatTime(track.duration)}
          </small>
        </div>

        <button
          className={`favorite-button ${
            isFavorite(track)
              ? "liked"
              : ""
          }`}
          onClick={() =>
            toggleFavorite(track)
          }
        >
          <Icon
            name={
              isFavorite(track)
                ? "heartFill"
                : "heart"
            }
          />
        </button>
      </div>
    </article>
  );
}

/* =========================
   SEARCH
========================= */

function SearchPage({
  search,
  setSearch,
  tracks,
  playTrack,
  toggleFavorite,
  isFavorite,
}) {
  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          FENIX SEARCH
        </span>

        <h1>Поиск</h1>

        <p>
          Найди трек, артиста, альбом или
          свою любимую музыку.
        </p>
      </div>

      <div className="large-search">
        <Icon name="search" />

        <input
          autoFocus
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Трек, артист, альбом, жанр…"
        />
      </div>

      {search && (
        <p className="search-result-count">
          Найдено: {tracks.length}
        </p>
      )}

      <div className="track-grid">
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            playTrack={playTrack}
            toggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
          />
        ))}
      </div>

      {!tracks.length && (
        <div className="empty-state">
          Ничего не найдено.
        </div>
      )}
    </div>
  );
}

/* =========================
   RECOMMENDATIONS
========================= */

function RecommendationsPage({
  tracks,
  history,
  playTrack,
  toggleFavorite,
  isFavorite,
}) {
  const genres = [
    ...new Set(
      history
        .map((item) => item.genre)
        .filter(Boolean)
    ),
  ];

  const recommendations = genres.length
    ? tracks.filter((track) =>
        genres.includes(track.genre)
      )
    : tracks;

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          PERSONAL MIX
        </span>

        <h1>Для вас</h1>

        <p>
          Рекомендации формируются на основе
          истории прослушиваний.
        </p>
      </div>

      {genres.length > 0 && (
        <div className="genre-tags">
          {genres.map((genre) => (
            <span key={genre}>
              {genre}
            </span>
          ))}
        </div>
      )}

      <div className="track-grid">
        {recommendations.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            playTrack={playTrack}
            toggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
          />
        ))}
      </div>
    </div>
  );
}

/* =========================
   LIBRARY
========================= */

function LibraryPage({
  favorites,
  history,
  playlists,
  tracks,
  playTrack,
  setPage,
}) {
  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          YOUR LIBRARY
        </span>

        <h1>Библиотека</h1>

        <p>
          Всё сохранённое и недавно прослушанное.
        </p>
      </div>

      <div className="library-grid">
        <LibraryTile
          icon="heart"
          title="Избранное"
          description={`${favorites.length} треков`}
          onClick={() => setPage("favorites")}
        />

        <LibraryTile
          icon="clock"
          title="История"
          description={`${history.length} прослушанных`}
          onClick={() => setPage("history")}
        />

        <LibraryTile
          icon="music"
          title="Плейлисты"
          description={`${playlists.length} плейлистов`}
          onClick={() => setPage("playlists")}
        />

        <LibraryTile
          icon="album"
          title="Альбомы"
          description="Музыкальные альбомы"
          onClick={() => setPage("albums")}
        />
      </div>

      <MusicSection
        title="Продолжить слушать"
        subtitle="Музыка из каталога"
        tracks={tracks.slice(0, 6)}
        playTrack={playTrack}
        toggleFavorite={() => {}}
        isFavorite={() => false}
      />
    </div>
  );
}

function LibraryTile({
  icon,
  title,
  description,
  onClick,
}) {
  return (
    <button
      className="library-tile"
      onClick={onClick}
    >
      <Icon name={icon} />

      <strong>{title}</strong>

      <small>{description}</small>

      <span>Открыть →</span>
    </button>
  );
}

/* =========================
   TRACK LIST
========================= */

function TrackListPage({
  title,
  subtitle,
  tracks,
  playTrack,
  toggleFavorite,
  isFavorite,
}) {
  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          FENIX MUSIC
        </span>

        <h1>{title}</h1>

        <p>{subtitle}</p>

        {tracks[0] && (
          <button
            className="primary-button"
            onClick={() =>
              playTrack(tracks[0], tracks)
            }
          >
            <Icon name="play" />
            Слушать всё
          </button>
        )}
      </div>

      <div className="track-list">
        {tracks.map((track, index) => (
          <div
            className="track-list-row"
            key={`${track.id}-${index}`}
          >
            <span className="track-number">
              {index + 1}
            </span>

            <img
              src={track.cover_url || DEFAULT_COVER}
              alt=""
            />

            <button
              className="track-list-main"
              onClick={() =>
                playTrack(track, tracks)
              }
            >
              <b>{track.title}</b>
              <small>
                {track.artist_name}
              </small>
            </button>

            <span className="track-list-grow" />

            <span className="track-list-duration">
              {formatTime(track.duration)}
            </span>

            <button
              className={`icon-button ${
                isFavorite(track)
                  ? "liked"
                  : ""
              }`}
              onClick={() =>
                toggleFavorite(track)
              }
            >
              <Icon
                name={
                  isFavorite(track)
                    ? "heartFill"
                    : "heart"
                }
              />
            </button>

            <button
              className="round-play"
              onClick={() =>
                playTrack(track, tracks)
              }
            >
              <Icon name="play" />
            </button>
          </div>
        ))}
      </div>

      {!tracks.length && (
        <div className="empty-state">
          Здесь пока ничего нет.
        </div>
      )}
    </div>
  );
}

/* =========================
   PLAYLISTS
========================= */

function PlaylistsPage({
  playlists,
  setPlaylists,
  tracks,
  playTrack,
}) {
  const [name, setName] = useState("");
  const [publicPlaylist, setPublicPlaylist] =
    useState(false);

  const createPlaylist = () => {
    const cleanName = name.trim();

    if (!cleanName) {
      return;
    }

    const playlist = {
      id: Date.now(),
      name: cleanName,
      public: publicPlaylist,
      tracks: [],
      created_at: Date.now(),
    };

    setPlaylists((previous) => [
      ...previous,
      playlist,
    ]);

    setName("");
    setPublicPlaylist(false);
  };

  const deletePlaylist = (id) => {
    setPlaylists((previous) =>
      previous.filter(
        (playlist) => playlist.id !== id
      )
    );
  };

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          YOUR PLAYLISTS
        </span>

        <h1>Плейлисты</h1>

        <p>
          Создавай публичные и приватные
          музыкальные подборки.
        </p>
      </div>

      <div className="create-playlist">
        <input
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          placeholder="Название нового плейлиста"
        />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={publicPlaylist}
            onChange={(event) =>
              setPublicPlaylist(
                event.target.checked
              )
            }
          />
          <span>Публичный</span>
        </label>

        <button
          className="primary-button"
          onClick={createPlaylist}
        >
          <Icon name="plus" />
          Создать
        </button>
      </div>

      <div className="playlist-grid">
        {playlists.map((playlist) => (
          <article
            className="playlist-card"
            key={playlist.id}
          >
            <div className="playlist-cover">
              <Icon name="music" />
            </div>

            <h3>{playlist.name}</h3>

            <span>
              {playlist.public
                ? "Публичный"
                : "Приватный"}
              {" · "}
              {playlist.tracks?.length || 0}{" "}
              треков
            </span>

            <div className="playlist-actions">
              {playlist.tracks?.length > 0 && (
                <button
                  onClick={() =>
                    playTrack(
                      playlist.tracks[0],
                      playlist.tracks
                    )
                  }
                >
                  ▶ Слушать
                </button>
              )}

              <button
                className="danger-text"
                onClick={() =>
                  deletePlaylist(playlist.id)
                }
              >
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>

      {!playlists.length && (
        <div className="empty-state">
          Создай свой первый плейлист.
        </div>
      )}
    </div>
  );
}

/* =========================
   ARTISTS
========================= */

function ArtistsPage({
  tracks,
  playTrack,
}) {
  const artists = useMemo(() => {
    const map = new Map();

    tracks.forEach((track) => {
      const name =
        track.artist_name ||
        "Неизвестный артист";

      if (!map.has(name)) {
        map.set(name, track);
      }
    });

    return [...map.values()];
  }, [tracks]);

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          ARTISTS
        </span>

        <h1>Артисты</h1>

        <p>
          Исполнители из твоего музыкального
          каталога.
        </p>
      </div>

      <div className="artist-grid">
        {artists.map((track) => (
          <article
            className="artist-card"
            key={
              track.artist_name ||
              track.id
            }
            onClick={() =>
              playTrack(track, tracks)
            }
          >
            <img
              src={
                track.artist_avatar ||
                track.cover_url ||
                DEFAULT_COVER
              }
              alt=""
            />

            <h3>
              {track.artist_name}
            </h3>

            <span>
              Слушать артиста →
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

/* =========================
   ALBUMS
========================= */

function AlbumsPage({
  tracks,
  playTrack,
}) {
  const albums = useMemo(() => {
    const map = new Map();

    tracks.forEach((track) => {
      const name =
        track.album_name ||
        "Без альбома";

      if (!map.has(name)) {
        map.set(name, track);
      }
    });

    return [...map.values()];
  }, [tracks]);

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          ALBUMS
        </span>

        <h1>Альбомы</h1>

        <p>
          Все доступные релизы.
        </p>
      </div>

      <div className="album-grid">
        {albums.map((track) => (
          <article
            className="album-card"
            key={track.album_name || track.id}
            onClick={() =>
              playTrack(track, tracks)
            }
          >
            <img
              src={
                track.album_cover_url ||
                track.cover_url ||
                DEFAULT_COVER
              }
              alt=""
            />

            <h3>
              {track.album_name}
            </h3>

            <span>
              {track.artist_name}
            </span>

            <small>
              {track.year || "—"}
            </small>
          </article>
        ))}
      </div>
    </div>
  );
}

/* =========================
   NOTIFICATIONS
========================= */

function NotificationsPage({
  notifications,
  setNotifications,
}) {
  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">
            NOTIFICATIONS
          </span>

          <h1>Уведомления</h1>
        </div>

        {notifications.length > 0 && (
          <button
            className="secondary-button"
            onClick={() =>
              setNotifications([])
            }
          >
            Очистить
          </button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="notification-list">
          {notifications.map(
            (notification, index) => (
              <article
                className="notification-card"
                key={
                  notification.id ||
                  index
                }
              >
                <div className="notification-icon">
                  <Icon name="bell" />
                </div>

                <div>
                  <b>
                    {notification.title ||
                      "Новое уведомление"}
                  </b>

                  <p>
                    {notification.text ||
                      "В Fenix Music появилось что-то новое."}
                  </p>
                </div>
              </article>
            )
          )}
        </div>
      ) : (
        <div className="empty-state">
          Новых уведомлений нет.
        </div>
      )}
    </div>
  );
}

/* =========================
   TELEGRAM
========================= */

function TelegramPage() {
  return (
    <div className="page">
      <div className="telegram-hero">
        <div className="telegram-big-icon">
          <Icon name="telegram" />
        </div>

        <div>
          <span className="eyebrow">
            TELEGRAM INTEGRATION
          </span>

          <h1>
            Музыка из Telegram
          </h1>

          <p>
            Отправляй песни боту. Backend
            сохраняет Telegram file_id,
            метаданные и публикует трек в
            канал. После этого сайт
            автоматически подхватывает новую
            запись через API.
          </p>
        </div>
      </div>

      <div className="integration-steps">
        <IntegrationStep
          number="01"
          title="Отправь песню"
          text="Загрузи аудио своему Telegram-боту."
        />

        <IntegrationStep
          number="02"
          title="Бот сохраняет"
          text="Backend получает file_id, название, исполнителя и обложку."
        />

        <IntegrationStep
          number="03"
          title="Публикация"
          text="Песня отправляется в музыкальный Telegram-канал."
        />

        <IntegrationStep
          number="04"
          title="Сайт"
          text="API автоматически обновляет каталог."
        />
      </div>

      <div className="integration-note">
        <Icon name="check" />
        <span>
          Автоподхват новых песен выполняется
          frontend через периодический запрос
          /api/tracks.
        </span>
      </div>
    </div>
  );
}

function IntegrationStep({
  number,
  title,
  text,
}) {
  return (
    <article className="integration-step">
      <b>{number}</b>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

/* =========================
   PREMIUM
========================= */

function PremiumPage() {
  return (
    <div className="page premium-page">
      <div className="premium-heading">
        <div className="premium-crown">
          <Icon name="crown" />
        </div>

        <span className="eyebrow">
          FENIX PREMIUM
        </span>

        <h1>
          Музыка без ограничений.
        </h1>

        <p>
          Больше качества. Больше музыки.
          Больше возможностей.
        </p>
      </div>

      <div className="plans">
        <PremiumPlan
          name="FREE"
          price="0 ₽"
          features={[
            "Рекомендации",
            "Обычное качество",
            "История прослушиваний",
          ]}
        />

        <PremiumPlan
          name="PREMIUM"
          price="299 ₽ / месяц"
          hot
          features={[
            "Без рекламы",
            "Высокое качество",
            "Эксклюзивные подборки",
            "Расширенная статистика",
            "Приоритетные функции",
          ]}
        />

        <PremiumPlan
          name="PREMIUM+"
          price="499 ₽ / месяц"
          features={[
            "Максимальное качество",
            "AI-рекомендации",
            "Расширенная статистика",
            "Эксклюзивные релизы",
            "Все Premium-возможности",
          ]}
        />
      </div>
    </div>
  );
}

function PremiumPlan({
  name,
  price,
  features,
  hot,
}) {
  return (
    <article
      className={`premium-plan ${
        hot ? "hot" : ""
      }`}
    >
      {hot && (
        <span className="popular-badge">
          ПОПУЛЯРНЫЙ
        </span>
      )}

      <h3>{name}</h3>

      <strong>{price}</strong>

      <div className="premium-features">
        {features.map((feature) => (
          <span key={feature}>
            <Icon name="check" />
            {feature}
          </span>
        ))}
      </div>

      <button
        className={
          hot
            ? "primary-button"
            : "secondary-button"
        }
      >
        Выбрать
      </button>
    </article>
  );
}

/* =========================
   PROFILE
========================= */

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

  const saveProfile = () => {
    const updated = {
      ...(user || {}),
      username,
      bio,
    };

    setUser(updated);
  };

  if (!user) {
    return (
      <LoginPage
        onLogin={() => setPage("login")}
        onRegister={() => setPage("login")}
      />
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
          {(
            username ||
            "FX"
          )
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
          Выйти
        </button>
      </div>
    </div>
  );
}

/* =========================
   SETTINGS
========================= */

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

/* =========================
   SECURITY
========================= */

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

          <button className="secondary-button">
            Выйти со всех устройств
          </button>
        </article>

        <article>
          <Icon name="lock" />

          <h3>
            Пароль
          </h3>

          <p>
            Пароль должен проверяться
            backend и храниться в базе
            только как защищённый hash.
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
            новая CAPTCHA.
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

/* =========================
   LOGIN PAGE
========================= */

function LoginPage({
  onLogin,
  onRegister,
}) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="auth-logo">
          FX
        </div>

        <span className="eyebrow">
          FENIX MUSIC
        </span>

        <h1>
          Музыка начинается здесь
        </h1>

        <p>
          Войди в аккаунт, чтобы
          сохранить избранное,
          историю, настройки и
          плейлисты.
        </p>

        <button
          className="primary-button wide"
          onClick={onLogin}
        >
          Войти
        </button>

        <button
          className="secondary-button wide"
          onClick={onRegister}
        >
          Создать аккаунт
        </button>
      </div>
    </div>
  );
}

/* =========================
   AUTH MODAL
========================= */

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

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [serverCaptcha, setServerCaptcha] =
    useState(null);

  const getCaptcha = async () => {
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

      const data = await response.json();

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
  };

  useEffect(() => {
    if (mode === "register") {
      getCaptcha();
    }
  }, [mode]);

  const submit = async (event) => {
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
          body: JSON.stringify(payload),
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

      const token =
        data.token ||
        data.access_token ||
        data.session_token ||
        null;

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

      onSuccess(
        account,
        token
      );
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
  };

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
            ? "Сохраняй музыку, историю, настройки и плейлисты."
            : "Вход проверяется через backend."}
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
                    "------"}
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
              ? "Проверяем…"
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

/* =========================
   PLAYER
========================= */

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
      ? position / duration
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
              shuffle ? "control-active" : ""
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
          ☷
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

/* =========================
   QUEUE
========================= */

function QueuePanel({
  queue,
  currentTrack,
  playTrack,
  close,
}) {
  return (
    <div className="queue-panel">
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

/* =========================
   FULL PLAYER
========================= */

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
      ? position / duration
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
            shuffle ? "control-active" : ""
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
```
