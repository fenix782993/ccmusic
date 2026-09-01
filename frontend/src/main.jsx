
import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";

import {
  Album,
  Bell,
  ChevronDown,
  Clock3,
  Disc3,
  Download,
  Heart,
  Home,
  Library,
  ListMusic,
  Menu,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat2,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Volume2,
  X,
  MoreHorizontal,
} from "lucide-react";

import "./styles.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const IMG = [
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1521337581100-8ca9a73a5f79?auto=format&fit=crop&w=1000&q=85",
];

const DEMO = [
  {
    id: 1,
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    duration: "3:20",
    cover: IMG[0],
  },
  {
    id: 2,
    title: "Save Your Tears",
    artist: "The Weeknd",
    album: "After Hours",
    duration: "3:35",
    cover: IMG[1],
  },
  {
    id: 3,
    title: "Starboy",
    artist: "The Weeknd, Daft Punk",
    album: "Starboy",
    duration: "3:50",
    cover: IMG[2],
  },
  {
    id: 4,
    title: "Die For You",
    artist: "The Weeknd",
    album: "Starboy",
    duration: "4:20",
    cover: IMG[3],
  },
  {
    id: 5,
    title: "I Feel It Coming",
    artist: "The Weeknd, Daft Punk",
    album: "Starboy",
    duration: "4:29",
    cover: IMG[4],
  },
  {
    id: 6,
    title: "After Hours",
    artist: "The Weeknd",
    album: "After Hours",
    duration: "6:01",
    cover: IMG[5],
  },
];

const MIX = [
  ["Микс дня", "Обновлено сегодня", IMG[0]],
  ["Энергия утра", "Для продуктивности", IMG[1]],
  ["Рок драйв", "Лучшее из рока", IMG[2]],
  ["Душевный вечер", "Спокойные треки", IMG[3]],
  ["Громкие новинки", "Самое свежее", IMG[4]],
];

const ARTISTS = [
  {
    name: "The Weeknd",
    image: IMG[0],
    listeners: "28 984 321",
  },
  {
    name: "Post Malone",
    image: IMG[1],
    listeners: "24 102 008",
  },
  {
    name: "Drake",
    image: IMG[2],
    listeners: "31 882 412",
  },
  {
    name: "Dua Lipa",
    image: IMG[3],
    listeners: "22 500 190",
  },
  {
    name: "Travis Scott",
    image: IMG[4],
    listeners: "26 740 912",
  },
];

function Logo() {
  return (
    <div className="logo">
      <span className="logo-mark">F</span>
      <span>
        FENIX <b>MUSIC</b>
      </span>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  badge,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span>{icon}</span>
      <span>{label}</span>

      {badge ? <em>{badge}</em> : null}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        <button type="button">Показать все</button>
      </div>

      {children}
    </section>
  );
}

function MusicCard({ track, play }) {
  return (
    <div className="music-card">
      <div className="cover-wrap">
        <img src={track.cover} alt={track.title} />

        <button
          type="button"
          className="floating-play"
          onClick={() => play(track)}
        >
          <Play size={17} fill="currentColor" />
        </button>
      </div>

      <strong>{track.title}</strong>
      <span>{track.artist}</span>
    </div>
  );
}

function MixCard({ mix, play }) {
  return (
    <div
      className="mix-card"
      onClick={() => {
        const track =
          DEMO[Math.floor(Math.random() * DEMO.length)];

        play(track);
      }}
    >
      <img src={mix[2]} alt={mix[0]} />

      <div className="mix-overlay" />

      <div className="mix-info">
        <b>{mix[0]}</b>
        <span>{mix[1]}</span>
      </div>

      <button
        type="button"
        className="floating-play"
        onClick={(event) => {
          event.stopPropagation();

          const track =
            DEMO[Math.floor(Math.random() * DEMO.length)];

          play(track);
        }}
      >
        <Play size={17} fill="currentColor" />
      </button>
    </div>
  );
}

function TrackRow({
  track,
  index,
  current,
  playing,
  play,
  liked,
  toggleLike,
  addQueue,
}) {
  const isCurrent = current?.id === track.id;

  return (
    <div
      className={`track-row ${
        isCurrent ? "active" : ""
      }`}
    >
      <div className="track-index">
        {isCurrent && playing ? (
          <span className="equalizer">
            <i />
            <i />
            <i />
          </span>
        ) : (
          index + 1
        )}
      </div>

      <img
        className="tiny-cover"
        src={track.cover}
        alt={track.title}
      />

      <button
        type="button"
        className="row-play"
        onClick={() => play(track)}
      >
        {isCurrent && playing ? (
          <Pause size={15} />
        ) : (
          <Play size={15} />
        )}
      </button>

      <div className="track-main">
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </div>

      <span className="album-name">
        {track.album}
      </span>

      <button
        type="button"
        className={`icon-btn ${
          liked ? "liked" : ""
        }`}
        onClick={() => toggleLike(track.id)}
      >
        <Heart
          size={17}
          fill={liked ? "currentColor" : "none"}
        />
      </button>

      <button
        type="button"
        className="icon-btn"
        onClick={() => addQueue(track)}
      >
        <MoreHorizontal size={18} />
      </button>

      <span className="duration">
        {track.duration}
      </span>
    </div>
  );
}

function HomePage({
  play,
  current,
  playing,
  liked,
  toggleLike,
  addQueue,
}) {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} />
            FENIX FOR YOU
          </span>

          <h1>
            Музыка,
            <br />
            <b>которая звучит как ты.</b>
          </h1>

          <p>
            Персональные рекомендации, новые релизы
            и любимые треки в одном месте.
          </p>

          <button
            type="button"
            className="primary"
            onClick={() => play(DEMO[0])}
          >
            <Play size={17} fill="currentColor" />
            Слушать
          </button>
        </div>

        <div className="hero-art">
          <div className="hero-glow" />

          <img
            src={IMG[0]}
            alt="Fenix Music"
          />
        </div>
      </section>

      <Section title="Для вас">
        <div className="cards">
          {MIX.map((mix) => (
            <MixCard
              key={mix[0]}
              mix={mix}
              play={play}
            />
          ))}
        </div>
      </Section>

      <Section title="Продолжить слушать">
        <div className="cards">
          {DEMO.slice(0, 5).map((track) => (
            <MusicCard
              key={track.id}
              track={track}
              play={play}
            />
          ))}
        </div>
      </Section>

      <Section title="Популярное сейчас">
        <div className="cards">
          {DEMO.slice(1).map((track) => (
            <MusicCard
              key={track.id}
              track={track}
              play={play}
            />
          ))}
        </div>
      </Section>

      <Section title="Популярные исполнители">
        <div className="artist-row">
          {ARTISTS.map((artist) => (
            <div
              className="artist-card"
              key={artist.name}
            >
              <img
                src={artist.image}
                alt={artist.name}
              />

              <strong>{artist.name}</strong>

              <span>
                {artist.listeners} слушателей
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Недавно прослушанное">
        <div className="track-list">
          {DEMO.slice(0, 5).map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              current={current}
              playing={playing}
              play={play}
              liked={liked.has(track.id)}
              toggleLike={toggleLike}
              addQueue={addQueue}
            />
          ))}
        </div>
      </Section>
    </>
  );
}

function SearchPage({
  query,
  tracks,
  play,
  current,
  playing,
  liked,
  toggleLike,
  addQueue,
}) {
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">
          <Search size={14} />
          ПОИСК
        </span>

        <h1>
          {query
            ? `Результаты для «${query}»`
            : "Поиск музыки"}
        </h1>

        <p>
          Треки, альбомы, исполнители и плейлисты.
        </p>
      </div>

      <div className="filters">
        {[
          "Все",
          "Треки",
          "Исполнители",
          "Альбомы",
          "Плейлисты",
        ].map((item, index) => (
          <button
            type="button"
            className={`filter ${
              index === 0 ? "active" : ""
            }`}
            key={item}
          >
            {item}
          </button>
        ))}

        <button type="button" className="filter">
          <SlidersHorizontal size={14} />
          Фильтры
        </button>
      </div>

      <Section title="Треки">
        {tracks.length ? (
          <div className="track-list">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                current={current}
                playing={playing}
                play={play}
                liked={liked.has(track.id)}
                toggleLike={toggleLike}
                addQueue={addQueue}
              />
            ))}
          </div>
        ) : (
          <Empty
            text="Ничего не найдено"
            sub="Попробуйте изменить запрос."
          />
        )}
      </Section>
    </>
  );
}

function Empty({ text, sub }) {
  return (
    <div className="empty">
      <Disc3 size={38} />

      <h3>{text}</h3>

      <p>{sub}</p>
    </div>
  );
}

function CollectionPage({
  title,
  subtitle,
  items,
  play,
  current,
  playing,
  liked,
  toggleLike,
  addQueue,
}) {
  return (
    <>
      <div className="collection-head">
        <div className="collection-art">
          <Heart
            size={48}
            fill="currentColor"
          />
        </div>

        <div>
          <span className="eyebrow">
            FENIX LIBRARY
          </span>

          <h1>{title}</h1>

          <p>{subtitle}</p>

          <div className="head-actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (items.length) {
                  play(items[0]);
                }
              }}
            >
              <Play size={17} fill="currentColor" />
              Play
            </button>

            <button
              type="button"
              className="secondary"
            >
              <Shuffle size={17} />
              Перемешать
            </button>
          </div>
        </div>
      </div>

      <Section title="Треки">
        {items.length ? (
          <div className="track-list">
            {items.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                current={current}
                playing={playing}
                play={play}
                liked={liked.has(track.id)}
                toggleLike={toggleLike}
                addQueue={addQueue}
              />
            ))}
          </div>
        ) : (
          <Empty
            text="Здесь пока пусто"
            sub="Добавьте музыку в библиотеку."
          />
        )}
      </Section>
    </>
  );
}

function BrowsePage({ play, radio = false }) {
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">
          {radio ? (
            <Radio size={14} />
          ) : (
            <Sparkles size={14} />
          )}

          {radio ? "FENIX RADIO" : "ОБЗОР"}
        </span>

        <h1>
          {radio
            ? "Радио без пауз."
            : "Откройте новую музыку."}
        </h1>

        <p>
          {radio
            ? "Станции под настроение и жанр."
            : "Подборки, чарты и свежие релизы."}
        </p>
      </div>

      <Section title="В центре внимания">
        <div className="feature-grid">
          {MIX.slice(0, 3).map((mix) => (
            <MixCard
              key={mix[0]}
              mix={mix}
              play={play}
            />
          ))}
        </div>
      </Section>

      <Section title="Новые релизы">
        <div className="cards">
          {DEMO.map((track) => (
            <MusicCard
              key={track.id}
              track={track}
              play={play}
            />
          ))}
        </div>
      </Section>
    </>
  );
}

function ArtistsPage() {
  return (
    <>
      <PageTitle
        icon={<UserRound size={14} />}
        label="ИСПОЛНИТЕЛИ"
        title="Ваши исполнители"
      />

      <div className="artist-grid">
        {ARTISTS.concat(ARTISTS.slice(0, 2)).map(
          (artist, index) => (
            <div
              className="artist-large"
              key={`${artist.name}-${index}`}
            >
              <img
                src={artist.image}
                alt={artist.name}
              />

              <div>
                <h3>{artist.name}</h3>

                <span>
                  {artist.listeners} слушателей
                </span>
              </div>

              <button
                type="button"
                className="icon-btn"
              >
                <Play
                  size={18}
                  fill="currentColor"
                />
              </button>
            </div>
          )
        )}
      </div>
    </>
  );
}

function AlbumsPage({ play }) {
  return (
    <>
      <PageTitle
        icon={<Album size={14} />}
        label="АЛЬБОМЫ"
        title="Альбомы"
      />

      <div className="album-grid">
        {DEMO.map((track) => (
          <div
            className="album-card"
            key={track.id}
            onClick={() => play(track)}
          >
            <img
              src={track.cover}
              alt={track.album}
            />

            <div>
              <strong>{track.album}</strong>

              <span>
                {track.artist} • 2026
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PlaylistsPage({ play }) {
  const playlists = [
    "Мой плейлист",
    "Тренировки",
    "Релакс",
    "Дорога",
    "Рок классика",
  ];

  return (
    <>
      <PageTitle
        icon={<ListMusic size={14} />}
        label="ПЛЕЙЛИСТЫ"
        title="Ваши плейлисты"
      />

      <button
        type="button"
        className="primary create-big"
      >
        <Plus size={18} />
        Создать плейлист
      </button>

      <div className="playlist-grid">
        {playlists.map((name, index) => (
          <div
            className="playlist-card"
            key={name}
            onClick={() =>
              play(DEMO[index % DEMO.length])
            }
          >
            <div className="playlist-cover">
              <img
                src={IMG[index % IMG.length]}
                alt={name}
              />

              <button type="button">
                <Play
                  size={18}
                  fill="currentColor"
                />
              </button>
            </div>

            <strong>{name}</strong>

            <span>
              {5 + index * 3} треков
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function ProfilePage() {
  const stats = [
    ["12 540", "Минут прослушано"],
    ["3 479", "Треков прослушано"],
    ["152", "Подписки"],
    ["24", "Плейлисты"],
  ];

  return (
    <>
      <PageTitle
        icon={<UserRound size={14} />}
        label="FENIX PROFILE"
        title="FenixUser"
      />

      <div className="profile-hero">
        <img src={IMG[2]} alt="FenixUser" />

        <div>
          <h1>FenixUser</h1>

          <p>
            Premium • участник с 2026
          </p>
        </div>

        <button
          type="button"
          className="secondary"
        >
          Редактировать
        </button>
      </div>

      <div className="stats-grid">
        {stats.map(([value, label]) => (
          <div className="stat" key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <Section title="Любимые исполнители">
        <div className="artist-row">
          {ARTISTS.slice(0, 3).map((artist) => (
            <div
              className="artist-card"
              key={artist.name}
            >
              <img
                src={artist.image}
                alt={artist.name}
              />

              <strong>{artist.name}</strong>

              <span>Любимый артист</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function SettingsPage() {
  const settings = [
    "Аккаунт",
    "Воспроизведение",
    "Качество звука",
    "Уведомления",
    "Приватность",
    "Внешний вид",
    "Язык",
  ];

  return (
    <>
      <PageTitle
        icon={<Settings size={14} />}
        label="НАСТРОЙКИ"
        title="Настройки"
      />

      <div className="settings-list">
        {settings.map((item) => (
          <div
            className="setting"
            key={item}
          >
            <div>
              <strong>{item}</strong>

              <span>
                Управление параметрами
              </span>
            </div>

            <ChevronDown size={18} />
          </div>
        ))}
      </div>
    </>
  );
}

function PageTitle({ icon, label, title }) {
  return (
    <div className="page-title">
      <span className="eyebrow">
        {icon}
        {label}
      </span>

      <h1>{title}</h1>

      <p>
        Откройте новую музыку и управляйте
        своей библиотекой.
      </p>
    </div>
  );
}

function Player({
  current,
  playing,
  play,
  liked,
  toggleLike,
  setQueueOpen,
  setFullscreen,
}) {
  return (
    <footer className="player">
      <div
        className="now-playing"
        onClick={() => setFullscreen(true)}
      >
        <img
          src={current.cover}
          alt={current.title}
        />

        <div>
          <strong>{current.title}</strong>
          <span>{current.artist}</span>
        </div>

        <button
          type="button"
          className={`icon-btn ${
            liked.has(current.id)
              ? "liked"
              : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            toggleLike(current.id);
          }}
        >
          <Heart
            size={17}
            fill={
              liked.has(current.id)
                ? "currentColor"
                : "none"
            }
          />
        </button>
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button type="button">
            <Shuffle size={17} />
          </button>

          <button type="button">
            <SkipBack size={19} />
          </button>

          <button
            type="button"
            className="main-play"
            onClick={() => play(current)}
          >
            {playing ? (
              <Pause size={19} />
            ) : (
              <Play
                size={19}
                fill="currentColor"
              />
            )}
          </button>

          <button type="button">
            <SkipForward size={19} />
          </button>

          <button type="button">
            <Repeat2 size={17} />
          </button>
        </div>

        <div className="progress">
          <span>1:32</span>

          <div className="progress-line">
            <i />
          </div>

          <span>{current.duration}</span>
        </div>
      </div>

      <div className="player-right">
        <Volume2 size={18} />

        <div className="volume-line">
          <i />
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={() => setQueueOpen(true)}
        >
          <ListMusic size={19} />
        </button>
      </div>
    </footer>
  );
}

function MobilePlayer({
  current,
  playing,
  play,
  setFullscreen,
}) {
  return (
    <div
      className="mobile-player"
      onClick={() => setFullscreen(true)}
    >
      <img
        src={current.cover}
        alt={current.title}
      />

      <div>
        <b>{current.title}</b>
        <span>{current.artist}</span>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          play(current);
        }}
      >
        {playing ? (
          <Pause size={18} />
        ) : (
          <Play
            size={18}
            fill="currentColor"
          />
        )}
      </button>
    </div>
  );
}

function Queue({
  items,
  current,
  onClose,
  play,
  remove,
}) {
  return (
    <div className="drawer">
      <div className="drawer-head">
        <div>
          <span className="eyebrow">
            PLAYER
          </span>

          <h2>Очередь</h2>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
        >
          <X />
        </button>
      </div>

      <p className="queue-label">
        Сейчас играет
      </p>

      <div className="queue-current">
        <img
          src={current.cover}
          alt={current.title}
        />

        <div>
          <b>{current.title}</b>
          <span>{current.artist}</span>
        </div>

        <span className="red-dot" />
      </div>

      <p className="queue-label">
        Далее в очереди
      </p>

      {items.map((track) => (
        <div
          className="queue-item"
          key={track.id}
          onClick={() => play(track)}
        >
          <img
            src={track.cover}
            alt={track.title}
          />

          <div>
            <b>{track.title}</b>
            <span>{track.artist}</span>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={(event) => {
              event.stopPropagation();
              remove(track.id);
            }}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

function FullscreenPlayer({
  current,
  playing,
  play,
  liked,
  toggleLike,
  onClose,
}) {
  return (
    <div className="full-player">
      <div
        className="full-bg"
        style={{
          backgroundImage: `url(${current.cover})`,
        }}
      />

      <div className="full-top">
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
        >
          <ChevronDown />
        </button>

        <span>Сейчас играет</span>

        <button
          type="button"
          className="icon-btn"
        >
          <MoreHorizontal />
        </button>
      </div>

      <div className="full-content">
        <img
          className="full-cover"
          src={current.cover}
          alt={current.title}
        />

        <div className="full-meta">
          <div>
            <h1>{current.title}</h1>
            <p>{current.artist}</p>
          </div>

          <button
            type="button"
            className={`icon-btn ${
              liked.has(current.id)
                ? "liked"
                : ""
            }`}
            onClick={() =>
              toggleLike(current.id)
            }
          >
            <Heart
              fill={
                liked.has(current.id)
                  ? "currentColor"
                  : "none"
              }
            />
          </button>
        </div>

        <div className="full-progress">
          <div>
            <i />
          </div>

          <span>
            <small>1:32</small>
            <small>{current.duration}</small>
          </span>
        </div>

        <div className="full-controls">
          <button type="button">
            <Shuffle />
          </button>

          <button type="button">
            <SkipBack size={28} />
          </button>

          <button
            type="button"
            className="full-play"
            onClick={() => play(current)}
          >
            {playing ? (
              <Pause size={28} />
            ) : (
              <Play
                size={28}
                fill="currentColor"
              />
            )}
          </button>

          <button type="button">
            <SkipForward size={28} />
          </button>

          <button type="button">
            <Repeat2 />
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState("home");

  const [current, setCurrent] =
    useState(DEMO[0]);

  const [playing, setPlaying] =
    useState(false);

  const [liked, setLiked] =
    useState(new Set([1]));

  const [queue, setQueue] =
    useState(DEMO.slice(1, 5));

  const [queueOpen, setQueueOpen] =
    useState(false);

  const [fullscreen, setFullscreen] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [mobileNav, setMobileNav] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const play = (track) => {
    if (current?.id === track.id) {
      setPlaying((value) => !value);
      return;
    }

    setCurrent(track);
    setPlaying(true);
  };

  const toggleLike = (id) => {
    setLiked((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const addQueue = (track) => {
    setQueue((previous) => {
      if (
        previous.some(
          (item) => item.id === track.id
        )
      ) {
        return previous;
      }

      return [...previous, track];
    });

    setQueueOpen(true);
  };

  const removeQueue = (id) => {
    setQueue((previous) =>
      previous.filter(
        (track) => track.id !== id
      )
    );
  };

  const filteredTracks = useMemo(() => {
    const value = search
      .trim()
      .toLowerCase();

    if (!value) {
      return DEMO;
    }

    return DEMO.filter((track) =>
      `${track.title} ${track.artist} ${track.album}`
        .toLowerCase()
        .includes(value)
    );
  }, [search]);

  const navigate = (target) => {
    setPage(target);
    setMobileNav(false);
  };

  return (
    <div className="app">
      <aside
        className={`sidebar ${
          mobileNav ? "mobile-open" : ""
        }`}
      >
        <div className="side-top">
          <Logo />

          <button
            type="button"
            className="mobile-close"
            onClick={() => setMobileNav(false)}
          >
            <X />
          </button>
        </div>

        <div className="nav-section">
          <span className="nav-label">
            МУЗЫКА
          </span>

          <NavItem
            icon={<Home />}
            label="Главная"
            active={page === "home"}
            onClick={() => navigate("home")}
          />

          <NavItem
            icon={<Sparkles />}
            label="Обзор"
            active={page === "browse"}
            onClick={() => navigate("browse")}
          />

          <NavItem
            icon={<Radio />}
            label="Радио"
            active={page === "radio"}
            onClick={() => navigate("radio")}
          />

          <NavItem
            icon={<Search />}
            label="Поиск"
            active={page === "search"}
            onClick={() => navigate("search")}
          />
        </div>

        <div className="nav-section">
          <span className="nav-label">
            МОЯ МУЗЫКА
          </span>

          <NavItem
            icon={<Heart />}
            label="Любимые треки"
            active={page === "favorites"}
            badge={liked.size}
            onClick={() =>
              navigate("favorites")
            }
          />

          <NavItem
            icon={<ListMusic />}
            label="Плейлисты"
            active={page === "playlists"}
            onClick={() =>
              navigate("playlists")
            }
          />

          <NavItem
            icon={<Album />}
            label="Альбомы"
            active={page === "albums"}
            onClick={() =>
              navigate("albums")
            }
          />

          <NavItem
            icon={<UserRound />}
            label="Исполнители"
            active={page === "artists"}
            onClick={() =>
              navigate("artists")
            }
          />

          <NavItem
            icon={<Clock3 />}
            label="История"
            active={page === "history"}
            onClick={() =>
              navigate("history")
            }
          />
        </div>

        <div className="nav-section playlists">
          <span className="nav-label">
            ПЛЕЙЛИСТЫ
          </span>

          {[
            "Мой плейлист",
            "Тренировки",
            "Релакс",
            "Дорога",
            "Рок классика",
          ].map((name) => (
            <NavItem
              key={name}
              icon={<ListMusic />}
              label={name}
            />
          ))}
        </div>

        <button
          type="button"
          className="create-playlist"
        >
          <Plus size={18} />
          Создать плейлист
        </button>

        <div className="sidebar-bottom">
          <NavItem
            icon={<Settings />}
            label="Настройки"
            active={page === "settings"}
            onClick={() =>
              navigate("settings")
            }
          />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu"
            onClick={() => setMobileNav(true)}
          >
            <Menu />
          </button>

          <div className="back-buttons">
            <button
              type="button"
              className="round-btn"
            >
              ‹
            </button>

            <button
              type="button"
              className="round-btn"
            >
              ›
            </button>
          </div>

          <div className="search-box">
            <Search size={19} />

            <input
              value={search}
              onChange={(event) => {
                const value =
                  event.target.value;

                setSearch(value);

                if (value.trim()) {
                  setPage("search");
                }
              }}
              placeholder="Что хотите послушать?"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
              >
                <X size={17} />
              </button>
            )}
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="icon-btn"
            >
              <Bell size={19} />
            </button>

            <button
              type="button"
              className="icon-btn"
            >
              <Download size={18} />
            </button>

            <div
              className="profile-trigger"
              onClick={() =>
                setProfileOpen(
                  (value) => !value
                )
              }
            >
              <img
                src={IMG[2]}
                alt="FenixUser"
              />

              <span>FenixUser</span>

              <ChevronDown size={15} />

              {profileOpen && (
                <div className="profile-menu">
                  <b>FenixUser</b>
                  <span>Premium</span>

                  <hr />

                  <button
                    type="button"
                    onClick={() =>
                      navigate("profile")
                    }
                  >
                    Профиль
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("settings")
                    }
                  >
                    Настройки
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content">
          {page === "home" && (
            <HomePage
              play={play}
              current={current}
              playing={playing}
              liked={liked}
              toggleLike={toggleLike}
              addQueue={addQueue}
            />
          )}

          {page === "search" && (
            <SearchPage
              query={search}
              tracks={filteredTracks}
              play={play}
              current={current}
              playing={playing}
              liked={liked}
              toggleLike={toggleLike}
              addQueue={addQueue}
            />
          )}

          {page === "favorites" && (
            <CollectionPage
              title="Любимые треки"
              subtitle={`${liked.size} трека • 18 мин`}
              items={DEMO.filter((track) =>
                liked.has(track.id)
              )}
              play={play}
              current={current}
              playing={playing}
              liked={liked}
              toggleLike={toggleLike}
              addQueue={addQueue}
            />
          )}

          {page === "history" && (
            <CollectionPage
              title="История прослушиваний"
              subtitle="Ваши последние прослушивания"
              items={DEMO}
              play={play}
              current={current}
              playing={playing}
              liked={liked}
              toggleLike={toggleLike}
              addQueue={addQueue}
            />
          )}

          {page === "browse" && (
            <BrowsePage play={play} />
          )}

          {page === "radio" && (
            <BrowsePage
              play={play}
              radio
            />
          )}

          {page === "artists" && (
            <ArtistsPage />
          )}

          {page === "albums" && (
            <AlbumsPage play={play} />
          )}

          {page === "playlists" && (
            <PlaylistsPage play={play} />
          )}

          {page === "profile" && (
            <ProfilePage />
          )}

          {page === "settings" && (
            <SettingsPage />
          )}
        </div>
      </main>

      <Player
        current={current}
        playing={playing}
        play={play}
        liked={liked}
        toggleLike={toggleLike}
        setQueueOpen={setQueueOpen}
        setFullscreen={setFullscreen}
      />

      <MobilePlayer
        current={current}
        playing={playing}
        play={play}
        setFullscreen={setFullscreen}
      />

      {queueOpen && (
        <Queue
          items={queue}
          current={current}
          onClose={() =>
            setQueueOpen(false)
          }
          play={play}
          remove={removeQueue}
        />
      )}

      {fullscreen && (
        <FullscreenPlayer
          current={current}
          playing={playing}
          play={play}
          liked={liked}
          toggleLike={toggleLike}
          onClose={() =>
            setFullscreen(false)
          }
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

export { API_URL };
