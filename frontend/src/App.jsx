import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `Ошибка API: ${response.status}`
    );
  }

  return data;
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getTrackTitle(track) {
  return (
    track?.title ||
    track?.name ||
    track?.file_name ||
    "Без названия"
  );
}

function getTrackArtist(track) {
  return (
    track?.artist_name ||
    track?.artist ||
    "Fenix Music"
  );
}

function getTrackCover(track) {
  return (
    track?.cover_url ||
    track?.cover ||
    "/music-cover.svg"
  );
}

function getTrackAudio(track) {
  return (
    track?.audio_url ||
    track?.url ||
    ""
  );
}

function Icon({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </span>
  );
}

function Logo() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontWeight: 900,
        letterSpacing: 1,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #ff1744, #8b001f)",
          boxShadow: "0 0 30px rgba(255,23,68,.3)",
          fontSize: 20,
        }}
      >
        🔥
      </div>

      <div>
        <div style={{ fontSize: 15 }}>
          FENIX
        </div>

        <div
          style={{
            fontSize: 10,
            color: "#777",
            letterSpacing: 3,
          }}
        >
          MUSIC
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  setPage,
}) {
  const items = [
    {
      id: "home",
      icon: "⌂",
      title: "Главная",
    },
    {
      id: "search",
      icon: "⌕",
      title: "Поиск",
    },
    {
      id: "library",
      icon: "♫",
      title: "Моя музыка",
    },
    {
      id: "favorites",
      icon: "♥",
      title: "Избранное",
    },
    {
      id: "history",
      icon: "◷",
      title: "История",
    },
  ];

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: 240,
        padding: 24,
        background: "rgba(8,8,11,.96)",
        borderRight:
          "1px solid rgba(255,255,255,.06)",
        zIndex: 50,
      }}
    >
      <Logo />

      <nav
        style={{
          marginTop: 45,
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {items.map((item) => {
          const active = page === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                width: "100%",
                border: 0,
                borderRadius: 12,
                padding: "13px 14px",
                background: active
                  ? "rgba(255,23,68,.13)"
                  : "transparent",
                color: active
                  ? "#ff3155"
                  : "#888",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 13,
                fontWeight: active ? 800 : 500,
              }}
            >
              <Icon>{item.icon}</Icon>
              {item.title}
            </button>
          );
        })}
      </nav>

      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          bottom: 30,
          color: "#444",
          fontSize: 11,
        }}
      >
        Fenix Music v3.0
      </div>
    </aside>
  );
}

function MobileNavigation({
  page,
  setPage,
}) {
  const items = [
    ["home", "⌂", "Главная"],
    ["search", "⌕", "Поиск"],
    ["library", "♫", "Музыка"],
    ["favorites", "♥", "Избранное"],
    ["history", "◷", "История"],
  ];

  return (
    <nav
      style={{
        position: "fixed",
        left: 10,
        right: 10,
        bottom: 10,
        zIndex: 100,
        padding: 8,
        borderRadius: 18,
        background: "rgba(12,12,16,.96)",
        border:
          "1px solid rgba(255,255,255,.08)",
        display: "none",
        justifyContent: "space-around",
        backdropFilter: "blur(20px)",
      }}
    >
      {items.map(([id, icon, title]) => (
        <button
          key={id}
          onClick={() => setPage(id)}
          style={{
            border: 0,
            background: "transparent",
            color:
              page === id ? "#ff3155" : "#777",
            padding: "7px 8px",
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 19 }}>
            {icon}
          </div>

          <div>{title}</div>
        </button>
      ))}
    </nav>
  );
}

function TopBar({
  search,
  setSearch,
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        height: 72,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "0 30px",
        background: "rgba(5,5,7,.8)",
        backdropFilter: "blur(20px)",
        borderBottom:
          "1px solid rgba(255,255,255,.05)",
      }}
    >
      <div
        style={{
          flex: 1,
          maxWidth: 600,
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 15,
            top: 11,
            color: "#777",
            fontSize: 22,
          }}
        >
          ⌕
        </span>

        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Поиск треков, артистов..."
          style={{
            width: "100%",
            height: 43,
            borderRadius: 12,
            border:
              "1px solid rgba(255,255,255,.07)",
            background: "#101014",
            color: "#fff",
            outline: "none",
            padding: "0 16px 0 45px",
          }}
        />
      </div>

      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "#17171c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        👤
      </div>
    </header>
  );
}

function TrackCard({
  track,
  onPlay,
  isCurrent,
  isPlaying,
}) {
  const title = getTrackTitle(track);
  const artist = getTrackArtist(track);
  const cover = getTrackCover(track);

  return (
    <article
      onClick={() => onPlay(track)}
      style={{
        padding: 10,
        borderRadius: 15,
        background:
          isCurrent
            ? "rgba(255,23,68,.09)"
            : "#0e0e12",
        border:
          isCurrent
            ? "1px solid rgba(255,23,68,.3)"
            : "1px solid rgba(255,255,255,.05)",
        cursor: "pointer",
        transition: "all .2s",
      }}
    >
      <div
        style={{
          aspectRatio: "1",
          borderRadius: 11,
          overflow: "hidden",
          position: "relative",
          background: "#18181d",
        }}
      >
        <img
          src={cover}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display =
              "none";
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(transparent, rgba(0,0,0,.65))",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background:
                "rgba(255,23,68,.92)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity:
                isCurrent && isPlaying ? 1 : 0.85,
            }}
          >
            {isCurrent && isPlaying
              ? "Ⅱ"
              : "▶"}
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 3px 3px" }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 14,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>

        <div
          style={{
            color: "#71717a",
            fontSize: 12,
            marginTop: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {artist}
        </div>
      </div>
    </article>
  );
}

function TrackList({
  tracks,
  onPlay,
  current,
  playing,
}) {
  if (!tracks.length) {
    return (
      <div
        style={{
          padding: 45,
          textAlign: "center",
          borderRadius: 16,
          background: "#0c0c10",
          color: "#666",
        }}
      >
        Музыка пока отсутствует
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fill,minmax(170px,1fr))",
        gap: 17,
      }}
    >
      {tracks.map((track, index) => (
        <TrackCard
          key={
            track.id ||
            track.file_name ||
            track.audio_url ||
            index
          }
          track={track}
          onPlay={onPlay}
          current={
            current?.id === track.id
          }
          isCurrent={
            current?.id === track.id
          }
          isPlaying={playing}
        />
      ))}
    </div>
  );
}

function HomePage({
  tracks,
  onPlay,
  current,
  playing,
  refresh,
}) {
  const popular = useMemo(() => {
    return [...tracks]
      .sort(
        (a, b) =>
          Number(b.plays_count || 0) -
          Number(a.plays_count || 0)
      )
      .slice(0, 6);
  }, [tracks]);

  const newest = tracks.slice(0, 6);

  return (
    <div>
      <section
        style={{
          minHeight: 390,
          borderRadius: 25,
          overflow: "hidden",
          padding: 45,
          display: "flex",
          alignItems: "center",
          position: "relative",
          background:
            "radial-gradient(circle at 75% 30%, rgba(255,23,68,.25), transparent 35%), linear-gradient(135deg,#15151b,#08080b)",
          border:
            "1px solid rgba(255,255,255,.06)",
        }}
      >
        <div style={{ maxWidth: 650 }}>
          <div
            style={{
              color: "#ff3155",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 4,
              marginBottom: 15,
            }}
          >
            FENIX MUSIC
          </div>

          <h1
            style={{
              fontSize:
                "clamp(45px,6vw,82px)",
              lineHeight: .95,
              margin: 0,
              letterSpacing: -4,
            }}
          >
            Музыка
            <br />
            <span style={{ color: "#ff3155" }}>
              начинается здесь
            </span>
          </h1>

          <p
            style={{
              color: "#85858e",
              maxWidth: 550,
              lineHeight: 1.7,
              marginTop: 25,
            }}
          >
            Твоя персональная музыкальная
            вселенная. Слушай треки,
            сохраняй любимые композиции
            и открывай новую музыку.
          </p>

          <button
            onClick={() => {
              if (tracks[0]) {
                onPlay(tracks[0]);
              }
            }}
            style={{
              marginTop: 10,
              background: "#ff1744",
              color: "#fff",
              border: 0,
              padding: "14px 23px",
              borderRadius: 11,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow:
                "0 10px 35px rgba(255,23,68,.25)",
            }}
          >
            ▶ Начать слушать
          </button>
        </div>

        <div
          style={{
            position: "absolute",
            right: "8%",
            width: 270,
            height: 270,
            borderRadius: "50%",
            background:
              "repeating-radial-gradient(circle,#111 0,#111 8px,#19191e 9px,#19191e 12px)",
            boxShadow:
              "0 0 100px rgba(255,23,68,.22)",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: "#ff1744",
              left: "50%",
              top: "50%",
              transform:
                "translate(-50%,-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
            }}
          >
            FX
          </div>
        </div>
      </section>

      <MusicSection
        title="Новинки"
        tracks={newest}
        onPlay={onPlay}
        current={current}
        playing={playing}
      />

      <MusicSection
        title="Популярное"
        tracks={popular}
        onPlay={onPlay}
        current={current}
        playing={playing}
      />

      <div
        style={{
          marginTop: 25,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={refresh}
          style={{
            background: "#15151a",
            border:
              "1px solid rgba(255,255,255,.07)",
            color: "#aaa",
            borderRadius: 10,
            padding: "10px 15px",
            cursor: "pointer",
          }}
        >
          ↻ Обновить музыку
        </button>
      </div>
    </div>
  );
}

function MusicSection({
  title,
  tracks,
  onPlay,
  current,
  playing,
}) {
  return (
    <section style={{ marginTop: 42 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 17,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 25,
          }}
        >
          {title}
        </h2>

        <span
          style={{
            color: "#555",
            fontSize: 12,
          }}
        >
          {tracks.length} треков
        </span>
      </div>

      <TrackList
        tracks={tracks}
        onPlay={onPlay}
        current={current}
        playing={playing}
      />
    </section>
  );
}

function SearchPage({
  tracks,
  query,
  onPlay,
  current,
  playing,
}) {
  const result = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return tracks;
    }

    return tracks.filter((track) => {
      const text = [
        getTrackTitle(track),
        getTrackArtist(track),
        track.album_name,
        track.file_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [tracks, query]);

  return (
    <div>
      <PageTitle
        title="Поиск"
        subtitle="Найди нужный трек или исполнителя"
      />

      <div
        style={{
          marginBottom: 25,
          color: "#777",
        }}
      >
        {query
          ? `Найдено: ${result.length}`
          : `Всего треков: ${tracks.length}`}
      </div>

      <TrackList
        tracks={result}
        onPlay={onPlay}
        current={current}
        playing={playing}
      />
    </div>
  );
}

function LibraryPage({
  tracks,
  onPlay,
  current,
  playing,
}) {
  return (
    <div>
      <PageTitle
        title="Моя музыка"
        subtitle="Все доступные композиции"
      />

      <TrackList
        tracks={tracks}
        onPlay={onPlay}
        current={current}
        playing={playing}
      />
    </div>
  );
}

function FavoritesPage({
  favorites,
  onPlay,
  current,
  playing,
}) {
  return (
    <div>
      <PageTitle
        title="Избранное"
        subtitle="Треки, которые ты сохранил"
      />

      <TrackList
        tracks={favorites}
        onPlay={onPlay}
        current={current}
        playing={playing}
      />
    </div>
  );
}

function HistoryPage({
  history,
  onPlay,
  current,
  playing,
}) {
  return (
    <div>
      <PageTitle
        title="История"
        subtitle="Недавно прослушанные треки"
      />

      <TrackList
        tracks={history}
        onPlay={onPlay}
        current={current}
        playing={playing}
      />
    </div>
  );
}

function PageTitle({
  title,
  subtitle,
}) {
  return (
    <div style={{ marginBottom: 30 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 35,
        }}
      >
        {title}
      </h1>

      <p
        style={{
          color: "#666",
          marginTop: 8,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function Player({
  track,
  playing,
  setPlaying,
  next,
  previous,
}) {
  const audioRef = useRef(null);
  const [volume, setVolume] =
    useState(1);
  const [progress, setProgress] =
    useState(0);
  const [duration, setDuration] =
    useState(0);

  useEffect(() => {
    if (!audioRef.current || !track) {
      return;
    }

    audioRef.current.load();

    if (playing) {
      audioRef.current
        .play()
        .catch((error) => {
          console.error(
            "Audio play error:",
            error
          );
          setPlaying(false);
        });
    }
  }, [track]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    if (playing) {
      audioRef.current
        .play()
        .catch(() => {
          setPlaying(false);
        });
    } else {
      audioRef.current.pause();
    }
  }, [playing, setPlaying]);

  if (!track) {
    return null;
  }

  const audio = getTrackAudio(track);

  function handleTimeUpdate() {
    if (!audioRef.current) {
      return;
    }

    setProgress(
      audioRef.current.currentTime || 0
    );
  }

  function handleLoadedMetadata() {
    if (!audioRef.current) {
      return;
    }

    setDuration(
      audioRef.current.duration || 0
    );
  }

  function handleSeek(event) {
    const value = Number(event.target.value);

    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = value;
    setProgress(value);
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: 94,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "10px 25px",
        background:
          "rgba(10,10,13,.97)",
        borderTop:
          "1px solid rgba(255,255,255,.08)",
        backdropFilter: "blur(25px)",
      }}
    >
      <audio
        ref={audioRef}
        src={audio}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={
          handleLoadedMetadata
        }
        onEnded={next}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 10,
          overflow: "hidden",
          background: "#18181c",
          flexShrink: 0,
        }}
      >
        <img
          src={getTrackCover(track)}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      <div
        style={{
          width: 200,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontWeight: 800,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {getTrackTitle(track)}
        </div>

        <div
          style={{
            color: "#666",
            fontSize: 12,
            marginTop: 4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {getTrackArtist(track)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <button
          onClick={previous}
          style={playerButtonStyle}
        >
          ◀
        </button>

        <button
          onClick={() =>
            setPlaying(!playing)
          }
          style={{
            ...playerButtonStyle,
            width: 46,
            height: 46,
            background: "#ff1744",
            color: "#fff",
          }}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>

        <button
          onClick={next}
          style={playerButtonStyle}
        >
          ▶
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            color: "#666",
            fontSize: 11,
            minWidth: 32,
          }}
        >
          {formatDuration(progress)}
        </span>

        <input
          type="range"
          min="0"
          max={duration || 0}
          value={Math.min(
            progress,
            duration || progress
          )}
          onChange={handleSeek}
          style={{
            flex: 1,
            accentColor: "#ff1744",
          }}
        />

        <span
          style={{
            color: "#666",
            fontSize: 11,
            minWidth: 32,
          }}
        >
          {formatDuration(duration)}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: 120,
        }}
      >
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
          style={{
            width: "100%",
            accentColor: "#ff1744",
          }}
        />
      </div>
    </div>
  );
}

const playerButtonStyle = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: 0,
  background: "#19191e",
  color: "#aaa",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function App() {
  const [tracks, setTracks] =
    useState([]);

  const [favorites, setFavorites] =
    useState([]);

  const [history, setHistory] =
    useState([]);

  const [current, setCurrent] =
    useState(null);

  const [playing, setPlaying] =
    useState(false);

  const [page, setPage] =
    useState("home");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadTracks() {
    try {
      setLoading(true);
      setError("");

      const data =
        await apiRequest(
          "/api/music"
        );

      setTracks(
        Array.isArray(data?.tracks)
          ? data.tracks
          : []
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Не удалось загрузить музыку"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadFavorites() {
    try {
      const data =
        await apiRequest(
          "/api/favorites"
        );

      setFavorites(
        Array.isArray(data?.tracks)
          ? data.tracks
          : []
      );
    } catch {
      setFavorites([]);
    }
  }

  async function loadHistory() {
    try {
      const data =
        await apiRequest(
          "/api/history"
        );

      setHistory(
        Array.isArray(data?.tracks)
          ? data.tracks
          : []
      );
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    loadTracks();
    loadFavorites();
    loadHistory();
  }, []);

  async function playTrack(track) {
    if (!track) {
      return;
    }

    setCurrent(track);
    setPlaying(true);

    try {
      await apiRequest(
        `/api/tracks/${track.id}/play`,
        {
          method: "POST",
        }
      );
    } catch {
      // Не блокируем воспроизведение,
      // если статистика не записалась.
    }

    try {
      await apiRequest(
        "/api/history",
        {
          method: "POST",
          body: JSON.stringify({
            track_id: track.id,
          }),
        }
      );
    } catch {
      // Авторизация может отсутствовать.
    }
  }

  function getCurrentIndex() {
    if (!current) {
      return -1;
    }

    return tracks.findIndex(
      (track) =>
        track.id === current.id
    );
  }

  function nextTrack() {
    if (!tracks.length) {
      return;
    }

    const index = getCurrentIndex();

    const nextIndex =
      index < 0
        ? 0
        : (index + 1) % tracks.length;

    playTrack(tracks[nextIndex]);
  }

  function previousTrack() {
    if (!tracks.length) {
      return;
    }

    const index = getCurrentIndex();

    const previousIndex =
      index <= 0
        ? tracks.length - 1
        : index - 1;

    playTrack(tracks[previousIndex]);
  }

  function renderPage() {
    if (loading) {
      return (
        <div
          style={{
            padding: 80,
            textAlign: "center",
            color: "#777",
          }}
        >
          <div
            style={{
              fontSize: 40,
              marginBottom: 15,
            }}
          >
            🔥
          </div>

          Загружаем Fenix Music...
        </div>
      );
    }

    if (error && page === "home") {
      return (
        <div
          style={{
            padding: 50,
            textAlign: "center",
            background: "#0c0c10",
            borderRadius: 18,
            color: "#aaa",
          }}
        >
          <div
            style={{
              fontSize: 35,
              marginBottom: 15,
            }}
          >
            ⚠️
          </div>

          <div>{error}</div>

          <button
            onClick={loadTracks}
            style={{
              marginTop: 18,
              padding: "10px 18px",
              borderRadius: 10,
              border: 0,
              background: "#ff1744",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Повторить
          </button>
        </div>
      );
    }

    switch (page) {
      case "search":
        return (
          <SearchPage
            tracks={tracks}
            query={search}
            onPlay={playTrack}
            current={current}
            playing={playing}
          />
        );

      case "library":
        return (
          <LibraryPage
            tracks={tracks}
            onPlay={playTrack}
            current={current}
            playing={playing}
          />
        );

      case "favorites":
        return (
          <FavoritesPage
            favorites={favorites}
            onPlay={playTrack}
            current={current}
            playing={playing}
          />
        );

      case "history":
        return (
          <HistoryPage
            history={history}
            onPlay={playTrack}
            current={current}
            playing={playing}
          />
        );

      default:
        return (
          <HomePage
            tracks={tracks}
            onPlay={playTrack}
            current={current}
            playing={playing}
            refresh={loadTracks}
          />
        );
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 80% 0%, rgba(255,23,68,.08), transparent 30%), #050507",
        color: "#fff",
        paddingBottom: current
          ? 115
          : 30,
      }}
    >
      <Sidebar
        page={page}
        setPage={setPage}
      />

      <div
        style={{
          marginLeft: 240,
          minHeight: "100vh",
        }}
      >
        <TopBar
          search={search}
          setSearch={setSearch}
        />

        <main
          style={{
            width: "min(1400px,92%)",
            margin: "0 auto",
            padding: "35px 0 60px",
          }}
        >
          {renderPage()}
        </main>
      </div>

      <MobileNavigation
        page={page}
        setPage={setPage}
      />

      <Player
        track={current}
        playing={playing}
        setPlaying={setPlaying}
        next={nextTrack}
        previous={previousTrack}
      />
    </div>
  );
}

export default App;
