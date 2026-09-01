import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = "https://ccmusice.onrender.com";

const DEMO_TRACKS = [
  {
    id: 1,
    title: "Fenix Night",
    artist: "Fenix Music",
    album: "Fenix",
    cover: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80",
    duration: "3:42",
  },
  {
    id: 2,
    title: "Neon Dreams",
    artist: "Fenix Music",
    album: "Neon",
    cover: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=600&q=80",
    duration: "4:08",
  },
  {
    id: 3,
    title: "After Midnight",
    artist: "Fenix Music",
    album: "Night Drive",
    cover: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=600&q=80",
    duration: "3:27",
  },
  {
    id: 4,
    title: "Red Lights",
    artist: "Fenix Music",
    album: "City Lights",
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
    duration: "3:51",
  },
  {
    id: 5,
    title: "City Pulse",
    artist: "Fenix Music",
    album: "Pulse",
    cover: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80",
    duration: "3:36",
  },
  {
    id: 6,
    title: "Dark Horizon",
    artist: "Fenix Music",
    album: "Horizon",
    cover: "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=600&q=80",
    duration: "4:16",
  },
  {
    id: 7,
    title: "Electric Heart",
    artist: "Fenix Music",
    album: "Electric",
    cover: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=600&q=80",
    duration: "3:58",
  },
  {
    id: 8,
    title: "Lost In Sound",
    artist: "Fenix Music",
    album: "Sound",
    cover: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&q=80",
    duration: "4:21",
  },
];

const NAVIGATION = [
  { id: "home", label: "Главная", icon: "home" },
  { id: "search", label: "Поиск", icon: "search" },
  { id: "popular", label: "Популярное", icon: "fire" },
];

const LIBRARY_NAVIGATION = [
  { id: "library", label: "Библиотека", icon: "library" },
  { id: "favorites", label: "Избранное", icon: "heart" },
  { id: "history", label: "История", icon: "history" },
];

function Icon({ name, size = 22, strokeWidth = 1.9 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V21h13V9.5" />
          <path d="M9.5 21v-6h5v6" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 5 5" />
        </svg>
      );

    case "fire":
      return (
        <svg {...common}>
          <path d="M12 22c4.4 0 7-3 7-7.1 0-3.5-2-6.2-5.1-8.9.1 2.5-1.1 4.2-2.5 5.2.1-3.8-1.6-6.6-4.1-8.8.1 3.4-2.3 5.5-2.3 9.1C5 17.7 7.8 22 12 22Z" />
        </svg>
      );

    case "library":
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" />
          <path d="M4 5.5v12" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
        </svg>
      );

    case "heart":
      return (
        <svg {...common}>
          <path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z" />
        </svg>
      );

    case "history":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      );

    case "play":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M8 5.4v13.2a1.4 1.4 0 0 0 2.2 1.1l9-6.6a1.4 1.4 0 0 0 0-2.2l-9-6.6A1.4 1.4 0 0 0 8 5.4Z" />
        </svg>
      );

    case "pause":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <rect x="7" y="5" width="3.5" height="14" rx="1" />
          <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
        </svg>
      );

    case "next":
      return (
        <svg {...common}>
          <path d="m5 5 9 7-9 7V5Z" fill="currentColor" stroke="none" />
          <path d="M19 5v14" />
        </svg>
      );

    case "previous":
      return (
        <svg {...common}>
          <path d="m19 5-9 7 9 7V5Z" fill="currentColor" stroke="none" />
          <path d="M5 5v14" />
        </svg>
      );

    case "shuffle":
      return (
        <svg {...common}>
          <path d="M16 3h5v5" />
          <path d="m21 3-6 6" />
          <path d="M3 7h2.5c4.8 0 5.2 10 11 10H21" />
          <path d="m18 14 3 3-3 3" />
          <path d="M3 17h2.5c1.6 0 2.8-.7 3.8-1.8" />
        </svg>
      );

    case "repeat":
      return (
        <svg {...common}>
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V9a3 3 0 0 1 3-3h15" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v2a3 3 0 0 1-3 3H3" />
        </svg>
      );

    case "volume":
      return (
        <svg {...common}>
          <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
          <path d="M16 9.5a4 4 0 0 1 0 5" />
          <path d="M18.5 7a7.5 7.5 0 0 1 0 10" />
        </svg>
      );

    case "volume-off":
      return (
        <svg {...common}>
          <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
          <path d="m18 9 4 6" />
          <path d="m22 9-4 6" />
        </svg>
      );

    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );

    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );

    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.5-4L3 9" />
          <path d="M3 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.5 4L21 15" />
          <path d="M21 20v-5h-5" />
        </svg>
      );

    case "menu":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      );

    case "queue":
      return (
        <svg {...common}>
          <path d="M4 6h11" />
          <path d="M4 11h11" />
          <path d="M4 16h7" />
          <path d="M17 14v5" />
          <path d="M17 19a2 2 0 1 0 2-2" />
          <path d="M17 14h4" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function Logo({ compact = false }) {
  return (
    <div className={`fm-logo ${compact ? "fm-logo-compact" : ""}`}>
      <div className="fm-logo-mark">F</div>
      {!compact && (
        <div className="fm-logo-text">
          <strong>FENIX</strong>
          <span>MUSIC</span>
        </div>
      )}
    </div>
  );
}

function TrackCover({ track, size = "medium", playing = false }) {
  return (
    <div className={`fm-cover fm-cover-${size} ${playing ? "is-playing" : ""}`}>
      <img src={track.cover} alt={track.title} />
      {playing && (
        <div className="fm-cover-playing">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title, subtitle, onMore }) {
  return (
    <div className="fm-section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {onMore && (
        <button className="fm-see-all" onClick={onMore}>
          Показать всё
          <Icon name="arrow" size={17} />
        </button>
      )}
    </div>
  );
}

function TrackCard({ track, active, favorite, onPlay, onFavorite }) {
  return (
    <article className={`fm-track-card ${active ? "active" : ""}`}>
      <div
        className="fm-track-card-cover-wrap"
        onClick={() => onPlay(track)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") onPlay(track);
        }}
      >
        <TrackCover track={track} size="large" playing={active} />
        <button
          className="fm-card-play"
          onClick={(event) => {
            event.stopPropagation();
            onPlay(track);
          }}
          aria-label="Воспроизвести"
        >
          <Icon name={active ? "pause" : "play"} size={21} />
        </button>
      </div>

      <div className="fm-track-card-info">
        <button className="fm-track-name" onClick={() => onPlay(track)}>
          {track.title}
        </button>
        <span>{track.artist}</span>
      </div>

      <button
        className={`fm-favorite-button ${favorite ? "liked" : ""}`}
        onClick={() => onFavorite(track.id)}
        aria-label="Избранное"
      >
        <Icon name="heart" size={19} />
      </button>
    </article>
  );
}

function TrackRow({ track, index, active, favorite, onPlay, onFavorite }) {
  return (
    <div className={`fm-track-row ${active ? "active" : ""}`}>
      <div className="fm-track-number">
        {active ? <Icon name="pause" size={17} /> : index + 1}
      </div>

      <button className="fm-row-cover" onClick={() => onPlay(track)}>
        <TrackCover track={track} size="small" playing={active} />
      </button>

      <button className="fm-row-title" onClick={() => onPlay(track)}>
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </button>

      <span className="fm-row-album">{track.album}</span>

      <span className="fm-row-duration">{track.duration}</span>

      <button
        className={`fm-row-heart ${favorite ? "liked" : ""}`}
        onClick={() => onFavorite(track.id)}
      >
        <Icon name="heart" size={18} />
      </button>

      <button className="fm-row-more">
        <Icon name="more" size={19} />
      </button>
    </div>
  );
}

function PlaylistCard({ title, subtitle, image, onClick }) {
  return (
    <button className="fm-playlist-card" onClick={onClick}>
      <div className="fm-playlist-image">
        <img src={image} alt="" />
        <span className="fm-playlist-overlay">
          <Icon name="play" size={23} />
        </span>
      </div>
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </button>
  );
}

function HomePage({
  tracks,
  favorites,
  currentTrack,
  onPlay,
  onFavorite,
  onMore,
}) {
  const popular = tracks.slice(0, 4);
  const newTracks = tracks.slice(4, 8);

  return (
    <div className="fm-page">
      <section className="fm-hero">
        <div className="fm-hero-glow" />
        <div className="fm-hero-content">
          <span className="fm-eyebrow">FENIX MUSIC</span>
          <h1>
            Музыка,
            <br />
            <span>которая движет тобой.</span>
          </h1>
          <p>
            Открывай новые треки, создавай свою библиотеку и слушай любимую
            музыку в одном месте.
          </p>
          <div className="fm-hero-actions">
            <button className="fm-primary-button" onClick={() => onPlay(tracks[0])}>
              <Icon name="play" size={18} />
              Начать слушать
            </button>
            <button className="fm-secondary-button" onClick={onMore}>
              Найти музыку
              <Icon name="arrow" size={17} />
            </button>
          </div>
        </div>

        <div className="fm-hero-art">
          <div className="fm-hero-disc" />
          <img src={tracks[0].cover} alt="" />
        </div>
      </section>

      <section className="fm-section">
        <SectionTitle
          title="Популярное"
          subtitle="Треки, которые сейчас слушают"
          onMore={onMore}
        />
        <div className="fm-card-grid">
          {popular.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              active={currentTrack?.id === track.id}
              favorite={favorites.includes(track.id)}
              onPlay={onPlay}
              onFavorite={onFavorite}
            />
          ))}
        </div>
      </section>

      <section className="fm-section">
        <SectionTitle
          title="Новые релизы"
          subtitle="Свежая музыка для твоего плейлиста"
          onMore={onMore}
        />
        <div className="fm-card-grid">
          {newTracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              active={currentTrack?.id === track.id}
              favorite={favorites.includes(track.id)}
              onPlay={onPlay}
              onFavorite={onFavorite}
            />
          ))}
        </div>
      </section>

      <section className="fm-section">
        <SectionTitle
          title="Миксы для тебя"
          subtitle="Подборки под твоё настроение"
        />

        <div className="fm-playlist-grid">
          <PlaylistCard
            title="Night Drive"
            subtitle="Тёмный электронный вайб"
            image="https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=700&q=80"
            onClick={() => onPlay(tracks[1])}
          />
          <PlaylistCard
            title="Red Energy"
            subtitle="Музыка для движения"
            image="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=700&q=80"
            onClick={() => onPlay(tracks[2])}
          />
          <PlaylistCard
            title="After Hours"
            subtitle="После полуночи"
            image="https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=700&q=80"
            onClick={() => onPlay(tracks[3])}
          />
        </div>
      </section>
    </div>
  );
}

function PopularPage({ tracks, favorites, currentTrack, onPlay, onFavorite }) {
  return (
    <div className="fm-page">
      <div className="fm-page-title">
        <span className="fm-eyebrow">FENIX MUSIC</span>
        <h1>Популярное</h1>
        <p>Самые популярные треки прямо сейчас.</p>
      </div>

      <section className="fm-section fm-list-section">
        <div className="fm-track-list">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              active={currentTrack?.id === track.id}
              favorite={favorites.includes(track.id)}
              onPlay={onPlay}
              onFavorite={onFavorite}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SearchPage({ tracks, favorites, currentTrack, onPlay, onFavorite }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return tracks;

    return tracks.filter(
      (track) =>
        track.title.toLowerCase().includes(value) ||
        track.artist.toLowerCase().includes(value) ||
        track.album.toLowerCase().includes(value)
    );
  }, [query, tracks]);

  return (
    <div className="fm-page">
      <div className="fm-search-big">
        <Icon name="search" size={28} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Что хочешь послушать?"
        />
        {query && (
          <button onClick={() => setQuery("")}>
            <Icon name="close" size={21} />
          </button>
        )}
      </div>

      <div className="fm-page-title compact">
        <h1>{query ? "Результаты поиска" : "Найди свою музыку"}</h1>
        <p>
          {query
            ? `Найдено треков: ${results.length}`
            : "Ищи треки, исполнителей и альбомы."}
        </p>
      </div>

      {results.length > 0 ? (
        <div className="fm-track-list">
          {results.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              active={currentTrack?.id === track.id}
              favorite={favorites.includes(track.id)}
              onPlay={onPlay}
              onFavorite={onFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="fm-empty">
          <Icon name="search" size={42} />
          <h2>Ничего не найдено</h2>
          <p>Попробуй изменить поисковый запрос.</p>
        </div>
      )}
    </div>
  );
}

function LibraryPage({ tracks, favorites, currentTrack, onPlay, onFavorite }) {
  const favoriteTracks = tracks.filter((track) => favorites.includes(track.id));

  return (
    <div className="fm-page">
      <div className="fm-page-title">
        <span className="fm-eyebrow">МОЯ МУЗЫКА</span>
        <h1>Библиотека</h1>
        <p>Твоя музыка всегда рядом.</p>
      </div>

      <section className="fm-section">
        <SectionTitle title="Избранное" subtitle={`${favoriteTracks.length} треков`} />

        {favoriteTracks.length ? (
          <div className="fm-track-list">
            {favoriteTracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                active={currentTrack?.id === track.id}
                favorite
                onPlay={onPlay}
                onFavorite={onFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="fm-empty">
            <Icon name="heart" size={42} />
            <h2>Пока здесь пусто</h2>
            <p>Добавляй любимые треки в свою библиотеку.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function HistoryPage({ tracks, currentTrack, onPlay }) {
  return (
    <div className="fm-page">
      <div className="fm-page-title">
        <span className="fm-eyebrow">МОЯ МУЗЫКА</span>
        <h1>История</h1>
        <p>Треки, которые ты слушал недавно.</p>
      </div>

      <div className="fm-track-list">
        {tracks.slice(0, 5).map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            index={index}
            active={currentTrack?.id === track.id}
            favorite={false}
            onPlay={onPlay}
            onFavorite={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

function ProfilePage({ user, onLogin }) {
  return (
    <div className="fm-page">
      <div className="fm-profile">
        <div className="fm-profile-avatar">
          {user?.username?.slice(0, 1).toUpperCase() || "F"}
        </div>
        <div>
          <span className="fm-eyebrow">ПРОФИЛЬ</span>
          <h1>{user?.username || "Гость"}</h1>
          <p>
            {user
              ? "Добро пожаловать в Fenix Music."
              : "Войди, чтобы сохранять свою музыку."}
          </p>
        </div>
      </div>

      {!user && (
        <button className="fm-primary-button fm-profile-login" onClick={onLogin}>
          <Icon name="user" size={18} />
          Войти в аккаунт
        </button>
      )}

      <div className="fm-stat-grid">
        <div className="fm-stat">
          <strong>0</strong>
          <span>Плейлистов</span>
        </div>
        <div className="fm-stat">
          <strong>0</strong>
          <span>Любимых треков</span>
        </div>
        <div className="fm-stat">
          <strong>0</strong>
          <span>Часов музыки</span>
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="fm-page">
      <div className="fm-page-title">
        <span className="fm-eyebrow">ТВОЁ</span>
        <h1>Настройки</h1>
        <p>Настрой Fenix Music под себя.</p>
      </div>

      <div className="fm-settings">
        <div className="fm-setting-row">
          <div className="fm-setting-icon">
            <Icon name="volume" size={21} />
          </div>
          <div>
            <strong>Качество музыки</strong>
            <span>Автоматически</span>
          </div>
          <Icon name="chevron" size={19} />
        </div>

        <div className="fm-setting-row">
          <div className="fm-setting-icon">
            <Icon name="history" size={21} />
          </div>
          <div>
            <strong>История прослушивания</strong>
            <span>Включена</span>
          </div>
          <Icon name="chevron" size={19} />
        </div>

        <div className="fm-setting-row">
          <div className="fm-setting-icon">
            <Icon name="settings" size={21} />
          </div>
          <div>
            <strong>Интерфейс</strong>
            <span>Тёмная тема</span>
          </div>
          <Icon name="chevron" size={19} />
        </div>
      </div>
    </div>
  );
}

function AuthModal({ mode, onClose, onSuccess }) {
  const [authMode, setAuthMode] = useState(mode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [serverCaptcha, setServerCaptcha] = useState("");
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateLocalCaptcha = useCallback(() => {
    const value = String(Math.floor(1000 + Math.random() * 9000));
    setServerCaptcha(value);
    setCaptchaId("");
    setCaptchaImage("");
    setCaptchaCode("");
  }, []);

  const loadCaptcha = useCallback(async () => {
    setLoadingCaptcha(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/captcha`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("CAPTCHA server unavailable");
      }

      const data = await response.json();

      if (!data?.ok || !data?.code) {
        throw new Error("Invalid CAPTCHA response");
      }

      setCaptchaId(data.captcha_id || "");
      setServerCaptcha(String(data.code));
      setCaptchaImage(data.image || data.captcha_image || "");
      setCaptchaCode("");
    } catch {
      generateLocalCaptcha();
    } finally {
      setLoadingCaptcha(false);
    }
  }, [generateLocalCaptcha]);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  useEffect(() => {
    setAuthMode(mode);
  }, [mode]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (captchaCode !== serverCaptcha) {
      setError("Неверный код CAPTCHA.");
      await loadCaptcha();
      return;
    }

    if (!username.trim() && authMode === "register") {
      setError("Введите имя пользователя.");
      return;
    }

    if (!email.trim()) {
      setError("Введите email.");
      return;
    }

    if (password.length < 4) {
      setError("Пароль должен содержать минимум 4 символа.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        authMode === "login" ? "/api/auth/login" : "/api/auth/register";

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          captcha_id: captchaId,
          captcha_code: captchaCode,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.detail || data?.message || "Ошибка авторизации");
      }

      onSuccess(
        data.user || {
          username: username.trim() || email.split("@")[0],
          email: email.trim(),
        }
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          "Не удалось выполнить запрос. Проверь API сервера."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fm-modal-backdrop" onMouseDown={onClose}>
      <div
        className="fm-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="fm-modal-close" onClick={onClose}>
          <Icon name="close" size={23} />
        </button>

        <div className="fm-modal-logo">
          <Logo compact />
        </div>

        <div className="fm-modal-heading">
          <h2>{authMode === "login" ? "С возвращением" : "Создай аккаунт"}</h2>
          <p>
            {authMode === "login"
              ? "Войди в Fenix Music и продолжи слушать."
              : "Создай аккаунт и сохраняй свою музыку."}
          </p>
        </div>

        <form className="fm-auth-form" onSubmit={submit}>
          {authMode === "register" && (
            <label>
              <span>Имя пользователя</span>
              <div className="fm-input">
                <Icon name="user" size={19} />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="FenixUser"
                  autoComplete="username"
                />
              </div>
            </label>
          )}

          <label>
            <span>Email</span>
            <div className="fm-input">
              <Icon name="mail" size={19} />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />
            </div>
          </label>

          <label>
            <span>Пароль</span>
            <div className="fm-input">
              <Icon name="lock" size={19} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
              />
            </div>
          </label>

          <div className="fm-captcha">
            <div className="fm-captcha-header">
              <span>Введите 4 цифры</span>
              <button type="button" onClick={loadCaptcha}>
                <Icon name="refresh" size={18} />
              </button>
            </div>

            <div className="fm-captcha-code">
              {loadingCaptcha ? (
                <span className="fm-captcha-loading">Загрузка...</span>
              ) : captchaImage ? (
                <img src={captchaImage} alt="CAPTCHA" />
              ) : (
                serverCaptcha.split("").map((digit, index) => (
                  <span key={`${digit}-${index}`}>{digit}</span>
                ))
              )}
            </div>

            <input
              className="fm-captcha-input"
              value={captchaCode}
              onChange={(event) =>
                setCaptchaCode(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              autoComplete="off"
            />
          </div>

          {error && <div className="fm-form-error">{error}</div>}

          <button className="fm-auth-submit" disabled={loading}>
            {loading
              ? "Подождите..."
              : authMode === "login"
                ? "Войти"
                : "Зарегистрироваться"}
          </button>
        </form>

        <div className="fm-auth-switch">
          <span>
            {authMode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}
          </span>
          <button
            onClick={() => {
              setError("");
              setCaptchaCode("");
              setAuthMode(authMode === "login" ? "register" : "login");
            }}
          >
            {authMode === "login" ? "Регистрация" : "Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QueuePanel({ queue, currentTrack, onPlay, onClose }) {
  return (
    <div className="fm-queue-panel">
      <div className="fm-queue-header">
        <div>
          <span>ПЛЕЕР</span>
          <h3>Очередь</h3>
        </div>
        <button onClick={onClose}>
          <Icon name="close" size={21} />
        </button>
      </div>

      <div className="fm-queue-list">
        {queue.map((track, index) => (
          <button
            key={`${track.id}-${index}`}
            className={`fm-queue-item ${
              currentTrack?.id === track.id ? "active" : ""
            }`}
            onClick={() => onPlay(track)}
          >
            <TrackCover
              track={track}
              size="small"
              playing={currentTrack?.id === track.id}
            />
            <div>
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
            </div>
            <span>{track.duration}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FullPlayer({
  track,
  playing,
  progress,
  volume,
  shuffle,
  repeat,
  onClose,
  onToggle,
  onNext,
  onPrevious,
  onProgress,
  onVolume,
  onShuffle,
  onRepeat,
  onFavorite,
  favorite,
  onQueue,
}) {
  return (
    <div className="fm-full-player">
      <div className="fm-full-player-top">
        <button onClick={onClose}>
          <Icon name="chevron" size={26} />
        </button>
        <span>СЕЙЧАС ИГРАЕТ</span>
        <button onClick={onQueue}>
          <Icon name="queue" size={22} />
        </button>
      </div>

      <div className="fm-full-player-art">
        <img src={track.cover} alt={track.title} />
      </div>

      <div className="fm-full-player-info">
        <div>
          <span>{track.artist}</span>
          <h1>{track.title}</h1>
        </div>
        <button
          className={favorite ? "liked" : ""}
          onClick={() => onFavorite(track.id)}
        >
          <Icon name="heart" size={27} />
        </button>
      </div>

      <div className="fm-progress-area">
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={(event) => onProgress(Number(event.target.value))}
        />
        <div>
          <span>0:00</span>
          <span>{track.duration}</span>
        </div>
      </div>

      <div className="fm-full-controls">
        <button className={shuffle ? "active" : ""} onClick={onShuffle}>
          <Icon name="shuffle" size={21} />
        </button>

        <button onClick={onPrevious}>
          <Icon name="previous" size={30} />
        </button>

        <button className="fm-big-play" onClick={onToggle}>
          <Icon name={playing ? "pause" : "play"} size={29} />
        </button>

        <button onClick={onNext}>
          <Icon name="next" size={30} />
        </button>

        <button className={repeat ? "active" : ""} onClick={onRepeat}>
          <Icon name="repeat" size={21} />
        </button>
      </div>

      <div className="fm-full-volume">
        <Icon name={volume === 0 ? "volume-off" : "volume"} size={19} />
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

function MiniPlayer({
  track,
  playing,
  progress,
  volume,
  shuffle,
  repeat,
  favorite,
  onToggle,
  onNext,
  onPrevious,
  onProgress,
  onVolume,
  onShuffle,
  onRepeat,
  onFavorite,
  onOpen,
  onQueue,
}) {
  return (
    <div className="fm-mini-player">
      <div className="fm-mini-track" onClick={onOpen}>
        <TrackCover track={track} size="small" playing={playing} />
        <div>
          <strong>{track.title}</strong>
          <span>{track.artist}</span>
        </div>
      </div>

      <div className="fm-mini-center">
        <div className="fm-mini-buttons">
          <button className={shuffle ? "active" : ""} onClick={onShuffle}>
            <Icon name="shuffle" size={17} />
          </button>

          <button onClick={onPrevious}>
            <Icon name="previous" size={21} />
          </button>

          <button className="fm-mini-play" onClick={onToggle}>
            <Icon name={playing ? "pause" : "play"} size={18} />
          </button>

          <button onClick={onNext}>
            <Icon name="next" size={21} />
          </button>

          <button className={repeat ? "active" : ""} onClick={onRepeat}>
            <Icon name="repeat" size={17} />
          </button>
        </div>

        <div className="fm-mini-progress">
          <span>0:00</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(event) => onProgress(Number(event.target.value))}
          />
          <span>{track.duration}</span>
        </div>
      </div>

      <div className="fm-mini-actions">
        <button
          className={favorite ? "liked" : ""}
          onClick={() => onFavorite(track.id)}
        >
          <Icon name="heart" size={19} />
        </button>

        <div className="fm-mini-volume">
          <Icon name={volume === 0 ? "volume-off" : "volume"} size={19} />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) => onVolume(Number(event.target.value))}
          />
        </div>

        <button onClick={onQueue}>
          <Icon name="queue" size={20} />
        </button>

        <button onClick={onOpen}>
          <Icon name="more" size={20} />
        </button>
      </div>
    </div>
  );
}

function Sidebar({ page, setPage, user, onLogin }) {
  return (
    <aside className="fm-sidebar">
      <div className="fm-sidebar-top">
        <Logo />
      </div>

      <nav className="fm-nav">
        <span className="fm-nav-label">МЕНЮ</span>

        {NAVIGATION.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? "active" : ""}
            onClick={() => setPage(item.id)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </button>
        ))}

        <span className="fm-nav-label fm-nav-label-spaced">МОЯ МУЗЫКА</span>

        {LIBRARY_NAVIGATION.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? "active" : ""}
            onClick={() => setPage(item.id)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </button>
        ))}

        <span className="fm-nav-label fm-nav-label-spaced">ТВОЁ</span>

        <button
          className={page === "profile" ? "active" : ""}
          onClick={() => setPage("profile")}
        >
          <Icon name="user" size={21} />
          <span>Профиль</span>
        </button>

        <button
          className={page === "settings" ? "active" : ""}
          onClick={() => setPage("settings")}
        >
          <Icon name="settings" size={21} />
          <span>Настройки</span>
        </button>
      </nav>

      {!user && (
        <div className="fm-sidebar-login">
          <div className="fm-sidebar-login-icon">
            <Icon name="heart" size={21} />
          </div>
          <strong>Сохраняй музыку</strong>
          <p>Войди, чтобы пользоваться библиотекой.</p>
          <button onClick={onLogin}>Войти</button>
        </div>
      )}

      {user && (
        <button
          className="fm-sidebar-user"
          onClick={() => setPage("profile")}
        >
          <div className="fm-user-avatar">
            {user.username?.slice(0, 1).toUpperCase() || "F"}
          </div>
          <div>
            <strong>{user.username || "Пользователь"}</strong>
            <span>Мой профиль</span>
          </div>
          <Icon name="chevron" size={17} />
        </button>
      )}
    </aside>
  );
}

function Header({ onSearch, onLogin, onMenu }) {
  return (
    <header className="fm-header">
      <button className="fm-mobile-menu" onClick={onMenu}>
        <Icon name="menu" size={23} />
      </button>

      <button className="fm-header-search" onClick={onSearch}>
        <Icon name="search" size={21} />
        <span>Что хочешь послушать?</span>
        <kbd>⌘ K</kbd>
      </button>

      <div className="fm-header-actions">
        <button className="fm-header-login" onClick={onLogin}>
          <Icon name="user" size={19} />
          Войти
        </button>
      </div>
    </header>
  );
}

function MobileNav({ page, setPage }) {
  const items = [
    { id: "home", label: "Главная", icon: "home" },
    { id: "search", label: "Поиск", icon: "search" },
    { id: "popular", label: "Популярное", icon: "fire" },
    { id: "library", label: "Моя музыка", icon: "library" },
  ];

  return (
    <nav className="fm-mobile-nav">
      {items.map((item) => (
        <button
          key={item.id}
          className={page === item.id ? "active" : ""}
          onClick={() => setPage(item.id)}
        >
          <Icon name={item.icon} size={21} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function App() {
  const [page, setPage] = useState("home");
  const [tracks] = useState(DEMO_TRACKS);
  const [favorites, setFavorites] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(DEMO_TRACKS[0]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [user, setUser] = useState(null);

  const queue = useMemo(() => {
    if (!currentTrack) return tracks;

    const currentIndex = tracks.findIndex(
      (track) => track.id === currentTrack.id
    );

    if (currentIndex < 0) return tracks;

    return [
      ...tracks.slice(currentIndex),
      ...tracks.slice(0, currentIndex),
    ];
  }, [tracks, currentTrack]);

  useEffect(() => {
    if (!playing) return undefined;

    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          return 0;
        }

        return value + 0.45;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [playing]);

  const playTrack = useCallback((track) => {
    setCurrentTrack(track);
    setPlaying(true);
    setProgress(0);
  }, []);

  const toggleFavorite = useCallback((id) => {
    setFavorites((items) =>
      items.includes(id)
        ? items.filter((item) => item !== id)
        : [...items, id]
    );
  }, []);

  const playNext = useCallback(() => {
    if (!currentTrack) return;

    if (shuffle) {
      const available = tracks.filter((track) => track.id !== currentTrack.id);
      const random =
        available[Math.floor(Math.random() * available.length)] || tracks[0];
      playTrack(random);
      return;
    }

    const index = tracks.findIndex((track) => track.id === currentTrack.id);
    const nextIndex = index + 1;

    if (nextIndex >= tracks.length) {
      if (repeat) {
        playTrack(tracks[0]);
      } else {
        setPlaying(false);
        setProgress(0);
      }
      return;
    }

    playTrack(tracks[nextIndex]);
  }, [currentTrack, shuffle, repeat, tracks, playTrack]);

  const playPrevious = useCallback(() => {
    if (!currentTrack) return;

    const index = tracks.findIndex((track) => track.id === currentTrack.id);
    const previousIndex = index - 1;

    if (previousIndex < 0) {
      playTrack(tracks[tracks.length - 1]);
      return;
    }

    playTrack(tracks[previousIndex]);
  }, [currentTrack, tracks, playTrack]);

  useEffect(() => {
    if (progress >= 100 && playing) {
      playNext();
    }
  }, [progress, playing, playNext]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPage("search");
      }

      if (event.code === "Space" && !["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openLogin = () => {
    setAuthMode("login");
    setAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode("register");
    setAuthOpen(true);
  };

  const handleAuthSuccess = (newUser) => {
    setUser(newUser);
    setAuthOpen(false);
    setPage("profile");
  };

  const renderPage = () => {
    if (page === "home") {
      return (
        <HomePage
          tracks={tracks}
          favorites={favorites}
          currentTrack={currentTrack}
          onPlay={playTrack}
          onFavorite={toggleFavorite}
          onMore={() => setPage("search")}
        />
      );
    }

    if (page === "search") {
      return (
        <SearchPage
          tracks={tracks}
          favorites={favorites}
          currentTrack={currentTrack}
          onPlay={playTrack}
          onFavorite={toggleFavorite}
        />
      );
    }

    if (page === "popular") {
      return (
        <PopularPage
          tracks={tracks}
          favorites={favorites}
          currentTrack={currentTrack}
          onPlay={playTrack}
          onFavorite={toggleFavorite}
        />
      );
    }

    if (page === "library" || page === "favorites") {
      return (
        <LibraryPage
          tracks={tracks}
          favorites={favorites}
          currentTrack={currentTrack}
          onPlay={playTrack}
          onFavorite={toggleFavorite}
        />
      );
    }

    if (page === "history") {
      return (
        <HistoryPage
          tracks={tracks}
          currentTrack={currentTrack}
          onPlay={playTrack}
        />
      );
    }

    if (page === "profile") {
      return <ProfilePage user={user} onLogin={openLogin} />;
    }

    if (page === "settings") {
      return <SettingsPage />;
    }

    return null;
  };

  return (
    <div className="fm-app">
      <Sidebar
        page={page}
        setPage={(value) => {
          setPage(value);
          setMobileSidebar(false);
        }}
        user={user}
        onLogin={openLogin}
      />

      {mobileSidebar && (
        <div
          className="fm-mobile-backdrop"
          onClick={() => setMobileSidebar(false)}
        />
      )}

      <div className={`fm-mobile-sidebar ${mobileSidebar ? "open" : ""}`}>
        <div className="fm-mobile-sidebar-header">
          <Logo />
          <button onClick={() => setMobileSidebar(false)}>
            <Icon name="close" size={23} />
          </button>
        </div>

        <Sidebar
          page={page}
          setPage={(value) => {
            setPage(value);
            setMobileSidebar(false);
          }}
          user={user}
          onLogin={openLogin}
        />
      </div>

      <main className="fm-main">
        <Header
          onSearch={() => setPage("search")}
          onLogin={openLogin}
          onMenu={() => setMobileSidebar(true)}
        />

        <div className="fm-content">{renderPage()}</div>
      </main>

      <MobileNav page={page} setPage={setPage} />

      {currentTrack && (
        <MiniPlayer
          track={currentTrack}
          playing={playing}
          progress={progress}
          volume={volume}
          shuffle={shuffle}
          repeat={repeat}
          favorite={favorites.includes(currentTrack.id)}
          onToggle={() => setPlaying((value) => !value)}
          onNext={playNext}
          onPrevious={playPrevious}
          onProgress={setProgress}
          onVolume={setVolume}
          onShuffle={() => setShuffle((value) => !value)}
          onRepeat={() => setRepeat((value) => !value)}
          onFavorite={toggleFavorite}
          onOpen={() => setFullPlayerOpen(true)}
          onQueue={() => setQueueOpen((value) => !value)}
        />
      )}

      {queueOpen && (
        <QueuePanel
          queue={queue}
          currentTrack={currentTrack}
          onPlay={playTrack}
          onClose={() => setQueueOpen(false)}
        />
      )}

      {fullPlayerOpen && currentTrack && (
        <FullPlayer
          track={currentTrack}
          playing={playing}
          progress={progress}
          volume={volume}
          shuffle={shuffle}
          repeat={repeat}
          favorite={favorites.includes(currentTrack.id)}
          onClose={() => setFullPlayerOpen(false)}
          onToggle={() => setPlaying((value) => !value)}
          onNext={playNext}
          onPrevious={playPrevious}
          onProgress={setProgress}
          onVolume={setVolume}
          onShuffle={() => setShuffle((value) => !value)}
          onRepeat={() => setRepeat((value) => !value)}
          onFavorite={toggleFavorite}
          onQueue={() => {
            setFullPlayerOpen(false);
            setQueueOpen(true);
          }}
        />
      )}

      {authOpen && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {!user && (
        <button
          className="fm-floating-register"
          onClick={openRegister}
          aria-label="Регистрация"
        >
          Регистрация
        </button>
      )}
    </div>
  );
}

export default App;
