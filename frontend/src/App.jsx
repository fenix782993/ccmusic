import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "";

function apiUrl(path) {
return `${API_BASE}${path}`;
}

async function api(path, options = {}) {
const response = await fetch(apiUrl(path), {
credentials: "include",
headers: {
"Content-Type": "application/json",
...(options.headers || {}),
},
...options,
});

let data = {};

try {
data = await response.json();
} catch {
data = {};
}

if (!response.ok) {
throw new Error(data.error || `Ошибка HTTP ${response.status}`);
}

return data;
}

function formatTime(seconds) {
const value = Number(seconds) || 0;

const minutes = Math.floor(value / 60);
const secs = Math.floor(value % 60);

return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getTrackCover(track) {
return (
track?.cover_url ||
"/music-cover.svg"
);
}

function App() {
const audioRef = useRef(null);

const [tracks, setTracks] = useState([]);
const [favorites, setFavorites] = useState([]);
const [history, setHistory] = useState([]);

const [user, setUser] = useState(null);

const [currentTrack, setCurrentTrack] = useState(null);

const [playing, setPlaying] = useState(false);
const [loading, setLoading] = useState(true);

const [currentTime, setCurrentTime] = useState(0);
const [duration, setDuration] = useState(0);
const [volume, setVolume] = useState(1);

const [repeat, setRepeat] = useState(false);
const [shuffle, setShuffle] = useState(false);

const [search, setSearch] = useState("");
const [page, setPage] = useState("home");

const [authOpen, setAuthOpen] = useState(false);
const [authMode, setAuthMode] = useState("login");

const [username, setUsername] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");

const [captchaId, setCaptchaId] = useState("");
const [captchaText, setCaptchaText] = useState("");
const [captchaAnswer, setCaptchaAnswer] = useState("");

const [toast, setToast] = useState("");

const [mobileMenu, setMobileMenu] = useState(false);

const [fullscreenPlayer, setFullscreenPlayer] = useState(false);

const [queue, setQueue] = useState([]);

const filteredTracks = useMemo(() => {
const value = search.trim().toLowerCase();

```
if (!value) {
  return tracks;
}

return tracks.filter((track) => {
  return (
    String(track.title || "")
      .toLowerCase()
      .includes(value) ||
    String(track.artist_name || "")
      .toLowerCase()
      .includes(value) ||
    String(track.album_name || "")
      .toLowerCase()
      .includes(value)
  );
});
```

}, [tracks, search]);

const favoriteIds = useMemo(() => {
return new Set(
favorites.map((track) => String(track.id))
);
}, [favorites]);

useEffect(() => {
loadEverything();
}, []);

useEffect(() => {
if (!toast) return;

```
const timer = setTimeout(() => {
  setToast("");
}, 3000);

return () => clearTimeout(timer);
```

}, [toast]);

useEffect(() => {
if (audioRef.current) {
audioRef.current.volume = volume;
}
}, [volume]);

async function loadEverything() {
setLoading(true);

```
try {
  const music = await api("/api/music");

  setTracks(
    Array.isArray(music.tracks)
      ? music.tracks
      : []
  );
} catch {
  try {
    const data = await api("/api/tracks");

    setTracks(
      Array.isArray(data.tracks)
        ? data.tracks
        : []
    );
  } catch {
    setTracks([]);
  }
}

try {
  const me = await api("/api/auth/me");
  setUser(me.user || null);
} catch {
  setUser(null);
}

try {
  if (user) {
    const fav = await api("/api/favorites");
    setFavorites(fav.tracks || []);

    const hist = await api("/api/history");
    setHistory(hist.tracks || []);
  }
} catch {}

setLoading(false);
```

}

async function loadUserData() {
if (!user) {
setFavorites([]);
setHistory([]);
return;
}

```
try {
  const fav = await api("/api/favorites");
  setFavorites(fav.tracks || []);
} catch {}

try {
  const hist = await api("/api/history");
  setHistory(hist.tracks || []);
} catch {}
```

}

useEffect(() => {
loadUserData();
}, [user]);

async function loadCaptcha() {
try {
const data = await api("/api/auth/captcha");

```
  setCaptchaId(data.id || "");
  setCaptchaText(data.text || "");
  setCaptchaAnswer("");
} catch {
  setCaptchaId("");
  setCaptchaText("");
}
```

}

function openLogin() {
setAuthMode("login");
setAuthOpen(true);
setPassword("");
}

function openRegister() {
setAuthMode("register");
setAuthOpen(true);
setPassword("");
loadCaptcha();
}

async function submitAuth(event) {
event.preventDefault();

```
try {
  if (authMode === "register") {
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

    setUser(data.user || null);
    setAuthOpen(false);
    setToast("Аккаунт успешно создан");
  } else {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        login: email || username,
        email,
        username,
        password,
      }),
    });

    setUser(data.user || null);
    setAuthOpen(false);
    setToast("Добро пожаловать в Fenix Music");
  }

  setPassword("");
  await loadUserData();
} catch (error) {
  setToast(error.message);

  if (authMode === "register") {
    loadCaptcha();
  }
}
```

}

async function logout() {
try {
await api("/api/auth/logout", {
method: "POST",
});
} catch {}

```
setUser(null);
setFavorites([]);
setHistory([]);
setToast("Вы вышли из аккаунта");
```

}

function getAudioUrl(track) {
if (!track) return "";

```
if (track.audio_url) {
  return track.audio_url;
}

if (track.file_name) {
  return `/api/music/audio/${encodeURIComponent(
    track.file_name
  )}`;
}

return `/api/tracks/${track.id}/audio`;
```

}

async function playTrack(track) {
if (!track) return;

```
try {
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

    audioRef.current.addEventListener(
      "timeupdate",
      () => {
        setCurrentTime(
          audioRef.current?.currentTime || 0
        );
      }
    );

    audioRef.current.addEventListener(
      "loadedmetadata",
      () => {
        setDuration(
          audioRef.current?.duration || 0
        );
      }
    );

    audioRef.current.addEventListener(
      "ended",
      () => {
        handleNext();
      }
    );

    audioRef.current.addEventListener(
      "play",
      () => setPlaying(true)
    );

    audioRef.current.addEventListener(
      "pause",
      () => setPlaying(false)
    );
  }

  const audio = audioRef.current;

  const sameTrack =
    currentTrack &&
    String(currentTrack.id) ===
      String(track.id);

  if (sameTrack) {
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }

    return;
  }

  audio.pause();

  const source = getAudioUrl(track);

  if (!source) {
    throw new Error(
      "У этого трека нет аудиофайла"
    );
  }

  audio.src = source;
  audio.currentTime = 0;

  setCurrentTrack(track);
  setCurrentTime(0);
  setDuration(
    Number(track.duration) || 0
  );

  await audio.play();

  try {
    await api(
      `/api/tracks/${track.id}/play`,
      {
        method: "POST",
      }
    );
  } catch {}

  if (user) {
    try {
      await api("/api/history", {
        method: "POST",
        body: JSON.stringify({
          track_id: track.id,
        }),
      });

      const hist = await api("/api/history");
      setHistory(hist.tracks || []);
    } catch {}
  }

  setQueue((old) => {
    const exists = old.some(
      (item) =>
        String(item.id) ===
        String(track.id)
    );

    if (exists) return old;

    return [...old, track];
  });
} catch (error) {
  setPlaying(false);
  setToast(
    `Не удалось воспроизвести: ${error.message}`
  );
}
```

}

function pauseTrack() {
if (!audioRef.current) return;

```
audioRef.current.pause();
```

}

function togglePlay() {
if (!currentTrack) {
if (tracks.length) {
playTrack(tracks[0]);
}

```
  return;
}

if (!audioRef.current) {
  playTrack(currentTrack);
  return;
}

if (audioRef.current.paused) {
  audioRef.current.play().catch(() => {});
} else {
  audioRef.current.pause();
}
```

}

function getCurrentIndex() {
const source =
page === "favorites"
? favorites
: filteredTracks;

```
return source.findIndex(
  (track) =>
    String(track.id) ===
    String(currentTrack?.id)
);
```

}

function handleNext() {
const source =
page === "favorites"
? favorites
: filteredTracks.length
? filteredTracks
: tracks;

```
if (!source.length) return;

let nextIndex;

if (shuffle) {
  nextIndex = Math.floor(
    Math.random() * source.length
  );
} else {
  const currentIndex = getCurrentIndex();

  nextIndex =
    currentIndex < 0
      ? 0
      : currentIndex + 1;
}

if (nextIndex >= source.length) {
  if (!repeat) {
    setPlaying(false);
    return;
  }

  nextIndex = 0;
}

playTrack(source[nextIndex]);
```

}

function handlePrevious() {
const source =
page === "favorites"
? favorites
: filteredTracks.length
? filteredTracks
: tracks;

```
if (!source.length) return;

const currentIndex = getCurrentIndex();

let previousIndex =
  currentIndex <= 0
    ? source.length - 1
    : currentIndex - 1;

playTrack(source[previousIndex]);
```

}

function seek(event) {
const value = Number(event.target.value);

```
if (!audioRef.current) return;

audioRef.current.currentTime = value;
setCurrentTime(value);
```

}

async function toggleFavorite(track) {
if (!user) {
setToast(
"Войдите в аккаунт, чтобы добавлять музыку в избранное"
);
openLogin();
return;
}

```
const id = String(track.id);
const exists = favoriteIds.has(id);

try {
  if (exists) {
    await api(
      `/api/favorites/${track.id}`,
      {
        method: "DELETE",
      }
    );

    setFavorites((old) =>
      old.filter(
        (item) =>
          String(item.id) !== id
      )
    );
  } else {
    await api("/api/favorites", {
      method: "POST",
      body: JSON.stringify({
        track_id: track.id,
      }),
    });

    setFavorites((old) => [
      track,
      ...old.filter(
        (item) =>
          String(item.id) !== id
      ),
    ]);
  }
} catch (error) {
  setToast(error.message);
}
```

}

function go(pageName) {
setPage(pageName);
setMobileMenu(false);
window.scrollTo({
top: 0,
behavior: "smooth",
});
}

const displayedTracks =
page === "favorites"
? favorites
: page === "history"
? history
: filteredTracks;

return ( <div className="fenix-app"> <header className="topbar">
<div
className="brand"
onClick={() => go("home")}
> <div className="brand-logo">
FX </div>

```
      <div className="brand-text">
        <strong>FENIX</strong>
        <span>MUSIC</span>
      </div>
    </div>

    <div className="search-box">
      <span>⌕</span>

      <input
        value={search}
        onChange={(event) =>
          setSearch(event.target.value)
        }
        placeholder="Найти трек, артиста или альбом..."
      />
    </div>

    <div className="top-actions">
      {user ? (
        <button
          className="profile-button"
          onClick={() => go("profile")}
        >
          <span className="avatar">
            {String(
              user.username || "U"
            )
              .charAt(0)
              .toUpperCase()}
          </span>

          <span>
            {user.username}
          </span>
        </button>
      ) : (
        <>
          <button
            className="login-button"
            onClick={openLogin}
          >
            Войти
          </button>

          <button
            className="register-button"
            onClick={openRegister}
          >
            Регистрация
          </button>
        </>
      )}

      <button
        className="mobile-button"
        onClick={() =>
          setMobileMenu(!mobileMenu)
        }
      >
        ☰
      </button>
    </div>
  </header>

  <div className="layout">
    <aside
      className={
        mobileMenu
          ? "sidebar mobile-open"
          : "sidebar"
      }
    >
      <nav>
        <button
          className={
            page === "home"
              ? "nav-item active"
              : "nav-item"
          }
          onClick={() => go("home")}
        >
          <span>⌂</span>
          Главная
        </button>

        <button
          className={
            page === "search"
              ? "nav-item active"
              : "nav-item"
          }
          onClick={() => go("search")}
        >
          <span>⌕</span>
          Поиск
        </button>

        <button
          className={
            page === "favorites"
              ? "nav-item active"
              : "nav-item"
          }
          onClick={() => go("favorites")}
        >
          <span>♥</span>
          Избранное
        </button>

        <button
          className={
            page === "history"
              ? "nav-item active"
              : "nav-item"
          }
          onClick={() => go("history")}
        >
          <span>◷</span>
          История
        </button>

        <button
          className={
            page === "library"
              ? "nav-item active"
              : "nav-item"
          }
          onClick={() => go("library")}
        >
          <span>▣</span>
          Библиотека
        </button>
      </nav>

      <div className="sidebar-title">
        FENIX MUSIC
      </div>

      <nav>
        <button
          className="nav-item"
          onClick={() => {
            setPage("artists");
            setMobileMenu(false);
          }}
        >
          <span>♬</span>
          Артисты
        </button>

        <button
          className="nav-item"
          onClick={() => {
            setPage("albums");
            setMobileMenu(false);
          }}
        >
          <span>▤</span>
          Альбомы
        </button>

        <button
          className="nav-item"
          onClick={() => {
            setPage("playlists");
            setMobileMenu(false);
          }}
        >
          <span>☷</span>
          Плейлисты
        </button>
      </nav>

      <div className="sidebar-bottom">
        <div className="online-status">
          <span></span>
          Fenix Music Online
        </div>

        <div className="version">
          v4.0
        </div>
      </div>
    </aside>

    <main className="content">
      {loading ? (
        <div className="loading-screen">
          <div className="loading-logo">
            FX
          </div>

          <h2>FENIX MUSIC</h2>

          <p>
            Загружаем музыкальную вселенную...
          </p>

          <div className="loader"></div>
        </div>
      ) : (
        <>
          {page === "home" && (
            <Home
              tracks={tracks}
              favorites={favoriteIds}
              currentTrack={currentTrack}
              playing={playing}
              onPlay={playTrack}
              onFavorite={toggleFavorite}
              onOpenAll={() =>
                go("library")
              }
            />
          )}

          {page === "search" && (
            <section className="page-section">
              <PageHeader
                title="Поиск"
                subtitle={
                  search
                    ? `Результаты для «${search}»`
                    : "Найди свою музыку"
                }
              />

              <TrackGrid
                tracks={filteredTracks}
                currentTrack={currentTrack}
                playing={playing}
                favorites={favoriteIds}
                onPlay={playTrack}
                onFavorite={toggleFavorite}
              />
            </section>
          )}

          {page === "favorites" && (
            <section className="page-section">
              <PageHeader
                title="Избранное"
                subtitle={
                  user
                    ? "Твои любимые треки"
                    : "Войди, чтобы сохранять музыку"
                }
              />

              {user ? (
                <TrackGrid
                  tracks={favorites}
                  currentTrack={currentTrack}
                  playing={playing}
                  favorites={favoriteIds}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                />
              ) : (
                <EmptyState
                  icon="♥"
                  title="Избранное пусто"
                  text="Авторизуйся и сохраняй любимые треки."
                  button="Войти"
                  onClick={openLogin}
                />
              )}
            </section>
          )}

          {page === "history" && (
            <section className="page-section">
              <PageHeader
                title="История"
                subtitle="Недавно прослушанные треки"
              />

              {user ? (
                <TrackList
                  tracks={history}
                  currentTrack={currentTrack}
                  playing={playing}
                  favorites={favoriteIds}
                  onPlay={playTrack}
                  onFavorite={toggleFavorite}
                />
              ) : (
                <EmptyState
                  icon="◷"
                  title="История недоступна"
                  text="Войди в аккаунт, чтобы сохранять историю прослушиваний."
                  button="Войти"
                  onClick={openLogin}
                />
              )}
            </section>
          )}

          {page === "library" && (
            <section className="page-section">
              <PageHeader
                title="Библиотека"
                subtitle={`${tracks.length} треков в Fenix Music`}
              />

              <div className="library-tabs">
                <button className="library-tab active">
                  Все треки
                </button>

                <button
                  className="library-tab"
                  onClick={() =>
                    go("favorites")
                  }
                >
                  Избранное
                </button>

                <button
                  className="library-tab"
                  onClick={() =>
                    go("history")
                  }
                >
                  История
                </button>
              </div>

              <TrackGrid
                tracks={filteredTracks}
                currentTrack={currentTrack}
                playing={playing}
                favorites={favoriteIds}
                onPlay={playTrack}
                onFavorite={toggleFavorite}
              />
            </section>
          )}

          {page === "profile" && (
            <Profile
              user={user}
              onLogout={logout}
              favorites={favorites}
              history={history}
              onOpenFavorites={() =>
                go("favorites")
              }
              onOpenHistory={() =>
                go("history")
              }
            />
          )}

          {(page === "artists" ||
            page === "albums" ||
            page === "playlists") && (
            <ComingSoon
              page={page}
              tracks={tracks}
              onPlay={playTrack}
            />
          )}
        </>
      )}
    </main>
  </div>

  {currentTrack && (
    <Player
      track={currentTrack}
      playing={playing}
      currentTime={currentTime}
      duration={duration}
      volume={volume}
      repeat={repeat}
      shuffle={shuffle}
      fullscreen={fullscreenPlayer}
      onPlay={togglePlay}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onSeek={seek}
      onVolume={setVolume}
      onRepeat={() =>
        setRepeat(!repeat)
      }
      onShuffle={() =>
        setShuffle(!shuffle)
      }
      onFullscreen={() =>
        setFullscreenPlayer(
          !fullscreenPlayer
        )
      }
      onFavorite={toggleFavorite}
      favorite={favoriteIds.has(
        String(currentTrack.id)
      )}
    />
  )}

  {authOpen && (
    <AuthModal
      mode={authMode}
      username={username}
      email={email}
      password={password}
      captchaText={captchaText}
      captchaAnswer={captchaAnswer}
      onUsername={setUsername}
      onEmail={setEmail}
      onPassword={setPassword}
      onCaptcha={setCaptchaAnswer}
      onSubmit={submitAuth}
      onClose={() =>
        setAuthOpen(false)
      }
      onChangeMode={() => {
        if (authMode === "login") {
          setAuthMode("register");
          loadCaptcha();
        } else {
          setAuthMode("login");
        }
      }}
      onRefreshCaptcha={loadCaptcha}
    />
  )}

  {toast && (
    <div className="toast">
      {toast}
    </div>
  )}
</div>
```

);
}

function Home({
tracks,
favorites,
currentTrack,
playing,
onPlay,
onFavorite,
onOpenAll,
}) {
const popular = [...tracks]
.sort(
(a, b) =>
Number(b.plays_count || 0) -
Number(a.plays_count || 0)
)
.slice(0, 8);

const newest = tracks.slice(0, 8);

return ( <div className="home"> <section className="hero"> <div className="hero-glow"></div>

```
    <div className="hero-content">
      <div className="hero-badge">
        ✦ FENIX MUSIC
      </div>

      <h1>
        Твоя музыка.
        <br />
        <span>Твой мир.</span>
      </h1>

      <p>
        Слушай любимые треки,
        открывай новых артистов
        и создавай свою музыкальную
        вселенную.
      </p>

      <button
        className="hero-button"
        onClick={onOpenAll}
      >
        Открыть библиотеку
        <span>→</span>
      </button>
    </div>

    <div className="hero-art">
      <div className="disc disc-one"></div>
      <div className="disc disc-two"></div>

      <div className="hero-cover">
        <span>FX</span>
      </div>
    </div>
  </section>

  <MusicSection
    title="Для вас"
    subtitle="Подобрано специально для тебя"
    tracks={newest}
    favorites={favorites}
    currentTrack={currentTrack}
    playing={playing}
    onPlay={onPlay}
    onFavorite={onFavorite}
  />

  <MusicSection
    title="Популярное"
    subtitle="Самые прослушиваемые треки"
    tracks={popular}
    favorites={favorites}
    currentTrack={currentTrack}
    playing={playing}
    onPlay={onPlay}
    onFavorite={onFavorite}
  />

  <section className="feature-row">
    <div className="feature-card">
      <div className="feature-icon">
        ◉
      </div>

      <div>
        <strong>
          Новая музыка
        </strong>

        <span>
          Свежие релизы появляются
          автоматически
        </span>
      </div>
    </div>

    <div className="feature-card">
      <div className="feature-icon">
        ♫
      </div>

      <div>
        <strong>
          Твоя библиотека
        </strong>

        <span>
          Избранное и история всегда
          под рукой
        </span>
      </div>
    </div>

    <div className="feature-card">
      <div className="feature-icon">
        ⚡
      </div>

      <div>
        <strong>
          Быстрый плеер
        </strong>

        <span>
          Музыка играет без остановки
        </span>
      </div>
    </div>
  </section>
</div>
```

);
}

function MusicSection({
title,
subtitle,
tracks,
favorites,
currentTrack,
playing,
onPlay,
onFavorite,
}) {
return ( <section className="music-section"> <div className="section-heading"> <div> <h2>{title}</h2> <p>{subtitle}</p> </div>

```
    <button>Смотреть все →</button>
  </div>

  <TrackGrid
    tracks={tracks}
    favorites={favorites}
    currentTrack={currentTrack}
    playing={playing}
    onPlay={onPlay}
    onFavorite={onFavorite}
  />
</section>
```

);
}

function TrackGrid({
tracks,
currentTrack,
playing,
favorites,
onPlay,
onFavorite,
}) {
if (!tracks.length) {
return ( <EmptyState
     icon="♫"
     title="Музыки пока нет"
     text="Когда новые аудиофайлы появятся в каталоге, они автоматически отобразятся здесь."
   />
);
}

return ( <div className="track-grid">
{tracks.map((track) => (
<TrackCard
key={track.id || track.file_name}
track={track}
currentTrack={currentTrack}
playing={playing}
favorite={favorites.has(
String(track.id)
)}
onPlay={onPlay}
onFavorite={onFavorite}
/>
))} </div>
);
}

function TrackCard({
track,
currentTrack,
playing,
favorite,
onPlay,
onFavorite,
}) {
const active =
currentTrack &&
String(currentTrack.id) ===
String(track.id);

return (
<article
className={
active
? "track-card active"
: "track-card"
}
> <div className="cover-wrap">
<img
className="track-cover"
src={getTrackCover(track)}
alt=""
onError={(event) => {
event.currentTarget.src =
"/music-cover.svg";
}}
/>

```
    <button
      className="cover-play"
      onClick={() => onPlay(track)}
    >
      {active && playing ? "Ⅱ" : "▶"}
    </button>

    <button
      className={
        favorite
          ? "favorite-button active"
          : "favorite-button"
      }
      onClick={(event) => {
        event.stopPropagation();
        onFavorite(track);
      }}
    >
      {favorite ? "♥" : "♡"}
    </button>
  </div>

  <div className="track-info">
    <strong title={track.title}>
      {track.title || "Без названия"}
    </strong>

    <span>
      {track.artist_name ||
        "Fenix Music"}
    </span>

    {track.album_name && (
      <small>
        {track.album_name}
      </small>
    )}
  </div>
</article>
```

);
}

function TrackList({
tracks,
currentTrack,
playing,
favorites,
onPlay,
onFavorite,
}) {
if (!tracks.length) {
return ( <EmptyState
     icon="♫"
     title="Здесь пока пусто"
     text="Начни слушать музыку, и здесь появятся треки."
   />
);
}

return ( <div className="track-list">
{tracks.map((track, index) => {
const active =
currentTrack &&
String(currentTrack.id) ===
String(track.id);

```
    const favorite =
      favorites.has(
        String(track.id)
      );

    return (
      <div
        className={
          active
            ? "list-track active"
            : "list-track"
        }
        key={`${track.id}-${index}`}
      >
        <span className="track-number">
          {index + 1}
        </span>

        <img
          src={getTrackCover(track)}
          alt=""
        />

        <div className="list-track-info">
          <strong>
            {track.title}
          </strong>

          <span>
            {track.artist_name}
          </span>
        </div>

        <span className="list-album">
          {track.album_name}
        </span>

        <span className="list-duration">
          {formatTime(track.duration)}
        </span>

        <button
          className={
            favorite
              ? "list-heart active"
              : "list-heart"
          }
          onClick={() =>
            onFavorite(track)
          }
        >
          {favorite ? "♥" : "♡"}
        </button>

        <button
          className="list-play"
          onClick={() =>
            onPlay(track)
          }
        >
          {active && playing
            ? "Ⅱ"
            : "▶"}
        </button>
      </div>
    );
  })}
</div>
```

);
}

function Player({
track,
playing,
currentTime,
duration,
volume,
repeat,
shuffle,
fullscreen,
onPlay,
onNext,
onPrevious,
onSeek,
onVolume,
onRepeat,
onShuffle,
onFullscreen,
onFavorite,
favorite,
}) {
if (fullscreen) {
return ( <div className="fullscreen-player"> <div className="fullscreen-background"></div>

```
    <button
      className="close-fullscreen"
      onClick={onFullscreen}
    >
      ×
    </button>

    <div className="fullscreen-content">
      <div className="fullscreen-cover">
        <img
          src={getTrackCover(track)}
          alt=""
        />
      </div>

      <div className="fullscreen-meta">
        <span>СЕЙЧАС ИГРАЕТ</span>

        <h2>{track.title}</h2>

        <p>{track.artist_name}</p>

        <div className="fullscreen-progress">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={Math.min(
              currentTime,
              duration || currentTime
            )}
            onChange={onSeek}
          />

          <div>
            <span>
              {formatTime(currentTime)}
            </span>

            <span>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="fullscreen-controls">
          <button
            className={
              shuffle
                ? "control active"
                : "control"
            }
            onClick={onShuffle}
          >
            ⤨
          </button>

          <button
            className="control"
            onClick={onPrevious}
          >
            |◀
          </button>

          <button
            className="big-play"
            onClick={onPlay}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>

          <button
            className="control"
            onClick={onNext}
          >
            ▶|
          </button>

          <button
            className={
              repeat
                ? "control active"
                : "control"
            }
            onClick={onRepeat}
          >
            ↻
          </button>
        </div>

        <button
          className={
            favorite
              ? "fullscreen-favorite active"
              : "fullscreen-favorite"
          }
          onClick={() =>
            onFavorite(track)
          }
        >
          {favorite
            ? "♥ В избранном"
            : "♡ Добавить в избранное"}
        </button>
      </div>
    </div>
  </div>
);
```

}

return ( <div className="player"> <div className="player-track"> <img
       src={getTrackCover(track)}
       alt=""
     />

```
    <div>
      <strong>{track.title}</strong>
      <span>{track.artist_name}</span>
    </div>
  </div>

  <div className="player-main">
    <div className="player-controls">
      <button
        className={
          shuffle
            ? "player-small active"
            : "player-small"
        }
        onClick={onShuffle}
      >
        ⤨
      </button>

      <button
        className="player-small"
        onClick={onPrevious}
      >
        |◀
      </button>

      <button
        className="player-play"
        onClick={onPlay}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>

      <button
        className="player-small"
        onClick={onNext}
      >
        ▶|
      </button>

      <button
        className={
          repeat
            ? "player-small active"
            : "player-small"
        }
        onClick={onRepeat}
      >
        ↻
      </button>
    </div>

    <div className="progress-row">
      <span>
        {formatTime(currentTime)}
      </span>

      <input
        type="range"
        min="0"
        max={duration || 0}
        value={Math.min(
          currentTime,
          duration || currentTime
        )}
        onChange={onSeek}
      />

      <span>
        {formatTime(duration)}
      </span>
    </div>
  </div>

  <div className="player-actions">
    <button
      className={
        favorite
          ? "player-icon active"
          : "player-icon"
      }
      onClick={() =>
        onFavorite(track)
      }
    >
      {favorite ? "♥" : "♡"}
    </button>

    <span className="volume-icon">
      🔊
    </span>

    <input
      className="volume-range"
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
    />

    <button
      className="player-icon"
      onClick={onFullscreen}
    >
      ⛶
    </button>
  </div>
</div>
```

);
}

function PageHeader({
title,
subtitle,
}) {
return ( <div className="page-header"> <div> <span className="page-kicker">
FENIX MUSIC </span>

```
    <h1>{title}</h1>

    <p>{subtitle}</p>
  </div>
</div>
```

);
}

function Profile({
user,
onLogout,
favorites,
history,
onOpenFavorites,
onOpenHistory,
}) {
if (!user) {
return ( <EmptyState
     icon="◎"
     title="Профиль"
     text="Войди в аккаунт, чтобы открыть профиль."
   />
);
}

return ( <section className="profile-page"> <PageHeader
     title="Профиль"
     subtitle="Твоя учетная запись Fenix Music"
   />

```
  <div className="profile-card">
    <div className="profile-avatar">
      {String(user.username || "U")
        .charAt(0)
        .toUpperCase()}
    </div>

    <div className="profile-info">
      <span>ПОЛЬЗОВАТЕЛЬ</span>

      <h2>{user.username}</h2>

      <p>{user.email}</p>

      {user.bio && (
        <div className="profile-bio">
          {user.bio}
        </div>
      )}
    </div>

    <button
      className="logout-button"
      onClick={onLogout}
    >
      Выйти
    </button>
  </div>

  <div className="profile-stats">
    <button
      onClick={onOpenFavorites}
    >
      <strong>
        {favorites.length}
      </strong>
      <span>Избранных треков</span>
    </button>

    <button
      onClick={onOpenHistory}
    >
      <strong>
        {history.length}
      </strong>
      <span>Прослушиваний</span>
    </button>
  </div>
</section>
```

);
}

function AuthModal({
mode,
username,
email,
password,
captchaText,
captchaAnswer,
onUsername,
onEmail,
onPassword,
onCaptcha,
onSubmit,
onClose,
onChangeMode,
onRefreshCaptcha,
}) {
const register =
mode === "register";

return ( <div
   className="modal-backdrop"
   onMouseDown={onClose}
 >
<div
className="auth-modal"
onMouseDown={(event) =>
event.stopPropagation()
}
> <button
       className="modal-close"
       onClick={onClose}
     >
× </button>

```
    <div className="auth-logo">
      FX
    </div>

    <span className="auth-kicker">
      FENIX MUSIC
    </span>

    <h2>
      {register
        ? "Создать аккаунт"
        : "С возвращением"}
    </h2>

    <p>
      {register
        ? "Создай свой профиль и сохраняй музыку."
        : "Войди в свою музыкальную вселенную."}
    </p>

    <form onSubmit={onSubmit}>
      {register && (
        <label>
          <span>Username</span>

          <input
            value={username}
            onChange={(event) =>
              onUsername(
                event.target.value
              )
            }
            placeholder="Твой никнейм"
            required
          />
        </label>
      )}

      <label>
        <span>
          {register
            ? "Email"
            : "Email или username"}
        </span>

        <input
          type={
            register
              ? "email"
              : "text"
          }
          value={email}
          onChange={(event) =>
            onEmail(event.target.value)
          }
          placeholder={
            register
              ? "you@example.com"
              : "username или email"
          }
          required
        />
      </label>

      <label>
        <span>Пароль</span>

        <input
          type="password"
          value={password}
          onChange={(event) =>
            onPassword(
              event.target.value
            )
          }
          placeholder="Минимум 6 символов"
          required
        />
      </label>

      {register && (
        <div className="captcha-box">
          <div className="captcha-top">
            <span>
              CAPTCHA
            </span>

            <button
              type="button"
              onClick={onRefreshCaptcha}
            >
              Обновить
            </button>
          </div>

          <div className="captcha-code">
            {captchaText || "------"}
          </div>

          <input
            value={captchaAnswer}
            onChange={(event) =>
              onCaptcha(
                event.target.value
              )
            }
            placeholder="Введите код"
            required
          />
        </div>
      )}

      <button
        className="auth-submit"
        type="submit"
      >
        {register
          ? "Создать аккаунт"
          : "Войти"}
      </button>
    </form>

    <button
      className="auth-switch"
      onClick={onChangeMode}
    >
      {register
        ? "Уже есть аккаунт? Войти"
        : "Нет аккаунта? Зарегистрироваться"}
    </button>
  </div>
</div>
```

);
}

function EmptyState({
icon,
title,
text,
button,
onClick,
}) {
return ( <div className="empty-state"> <div className="empty-icon">
{icon} </div>

```
  <h2>{title}</h2>

  <p>{text}</p>

  {button && (
    <button
      className="hero-button"
      onClick={onClick}
    >
      {button}
    </button>
  )}
</div>
```

);
}

function ComingSoon({
page,
tracks,
onPlay,
}) {
const names = {
artists: "Артисты",
albums: "Альбомы",
playlists: "Плейлисты",
};

return ( <section className="page-section"> <PageHeader
     title={names[page]}
     subtitle="Музыкальный раздел Fenix Music"
   />

```
  <div className="coming-card">
    <div className="coming-logo">
      FX
    </div>

    <h2>
      {names[page]}
    </h2>

    <p>
      Раздел подключен к музыкальной
      системе. Здесь появятся полноценные
      каталоги после добавления соответствующих
      данных.
    </p>

    {tracks.length > 0 && (
      <button
        className="hero-button"
        onClick={() =>
          onPlay(tracks[0])
        }
      >
        ▶ Слушать музыку
      </button>
    )}
  </div>
</section>
```

);
}

export default App;
