import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import {
  Album,
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Disc3,
  Heart,
  Home as HomeIcon,
  Library as LibraryIcon,
  ListMusic,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Repeat2,
  Sparkles,
  UserRound,
  Volume2,
  X,
  LogOut,
  Music2,
  Trash2,
} from "lucide-react";

import { api, mediaUrl } from "./index.js";
import "./styles.css";

/* =========================================================
   RADIO
========================================================= */

const RADIO = [
  {
    id: "groove",
    name: "Groove Salad",
    desc: "Chill electronic • SomaFM",
    genre: "CHILL",
    url: "https://ice1.somafm.com/groovesalad-128-mp3",
    icon: "🌌",
  },
  {
    id: "indie",
    name: "Indie Pop Rocks!",
    desc: "Alternative & indie",
    genre: "INDIE",
    url: "https://ice1.somafm.com/indiepop-128-mp3",
    icon: "🎸",
  },
  {
    id: "defcon",
    name: "DEF CON Radio",
    desc: "Electronic • cyber",
    genre: "ELECTRONIC",
    url: "https://ice1.somafm.com/defcon-128-mp3",
    icon: "⚡",
  },
  {
    id: "drone",
    name: "Drone Zone",
    desc: "Ambient soundscapes",
    genre: "AMBIENT",
    url: "https://ice1.somafm.com/dronezone-128-mp3",
    icon: "🌫️",
  },
  {
    id: "metal",
    name: "Metal Detector",
    desc: "Heavy metal 24/7",
    genre: "METAL",
    url: "https://ice1.somafm.com/metal-128-mp3",
    icon: "🤘",
  },
  {
    id: "chill",
    name: "Chillits",
    desc: "Downtempo & chill",
    genre: "DOWNTEMPO",
    url: "https://ice1.somafm.com/chillits-128-mp3",
    icon: "🌙",
  },
];

const MIX = [
  ["Микс дня", "Твои треки в новом порядке", "🎧"],
  ["Ночной микс", "Спокойно. Глубоко. Красиво.", "🌙"],
  ["Энергия", "Для дороги и тренировок", "⚡"],
  ["Альтернатива", "Гитары и живой звук", "🎸"],
  ["Фокус", "Музыка для концентрации", "🧠"],
];

/* =========================================================
   HELPERS
========================================================= */

function formatTime(seconds) {
  const value = Math.floor(Number(seconds) || 0);

  return `${Math.floor(value / 60)}:${String(value % 60).padStart(
    2,
    "0"
  )}`;
}

function shuffleArray(items) {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

/* =========================================================
   COMMON COMPONENTS
========================================================= */

function Cover({ track, className = "" }) {
  const [broken, setBroken] = useState(false);

  const cover = track?.cover_url || track?.cover || "";
  const url = cover ? mediaUrl(cover) : "";

  return (
    <div className={`cover-fallback ${className}`}>
      {url && !broken ? (
        <img
          src={url}
          alt=""
          onError={() => setBroken(true)}
        />
      ) : (
        <span>
          {track?.genre?.toUpperCase() === "METAL" ? "🤘" : "♪"}
        </span>
      )}
    </div>
  );
}

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
  active,
  onClick,
  badge,
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span>{icon}</span>
      {label}
      {badge > 0 && <em>{badge}</em>}
    </button>
  );
}

function PageTitle({
  icon,
  label,
  title,
  text,
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">
        {icon} {label}
      </span>

      <h1>{title}</h1>

      {text && <p>{text}</p>}
    </div>
  );
}

function Section({
  title,
  children,
  action,
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>

      {children}
    </section>
  );
}

function Empty({
  icon = <Disc3 size={40} />,
  text,
  sub,
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{text}</h3>
      <p>{sub}</p>
    </div>
  );
}

/* =========================================================
   TRACK ROW
========================================================= */

function TrackRow({
  t,
  i,
  current,
  playing,
  play,
  liked,
  toggleLike,
  queue,
}) {
  const isCurrent = current?.id === t.id;

  return (
    <div className={`track-row ${isCurrent ? "active" : ""}`}>
      <span className="idx">
        {isCurrent && playing ? (
          <span className="eq">
            <i />
            <i />
            <i />
          </span>
        ) : (
          i + 1
        )}
      </span>

      <Cover track={t} />

      <button
        className="row-play"
        type="button"
        onClick={() => play(t)}
      >
        {isCurrent && playing ? (
          <Pause size={14} />
        ) : (
          <Play size={14} />
        )}
      </button>

      <div className="track-main">
        <b>{t.title || "Без названия"}</b>
        <span>{t.artist || "Неизвестный исполнитель"}</span>
      </div>

      <span className="album-name">
        {t.album || "FENIX MUSIC"}
      </span>

      <button
        className={`icon ${liked?.has(t.id) ? "liked" : ""}`}
        type="button"
        onClick={() => toggleLike(t.id)}
        title="Добавить в любимые"
      >
        <Heart
          size={16}
          fill={liked?.has(t.id) ? "currentColor" : "none"}
        />
      </button>

      <button
        className="icon"
        type="button"
        onClick={() => queue(t)}
        title="Добавить в очередь"
      >
        <MoreHorizontal size={18} />
      </button>

      <span className="duration">
        {t.duration_label ||
          (typeof t.duration === "number"
            ? formatTime(t.duration)
            : t.duration) ||
          "0:00"}
      </span>
    </div>
  );
}

/* =========================================================
   MUSIC CARD
========================================================= */

function MusicCard({ t, play }) {
  return (
    <div className="music-card">
      <div className="card-cover">
        <Cover track={t} />

        <button
          className="float-play"
          type="button"
          onClick={() => play(t)}
          title="Слушать"
        >
          <Play size={16} fill="currentColor" />
        </button>
      </div>

      <b>{t.title || "Без названия"}</b>
      <span>{t.artist || "Неизвестный исполнитель"}</span>
    </div>
  );
}

/* =========================================================
   MIX CARD
========================================================= */

function MixCard({
  mix,
  tracks,
  play,
}) {
  const action = () => {
    if (!tracks.length) return;

    const randomTrack =
      tracks[Math.floor(Math.random() * tracks.length)];

    play(randomTrack);
  };

  return (
    <button
      className="mix-card"
      type="button"
      onClick={action}
    >
      <div className="mix-icon">{mix[2]}</div>

      <div>
        <b>{mix[0]}</b>
        <span>{mix[1]}</span>
      </div>

      <span className="mix-play">
        <Play size={16} fill="currentColor" />
      </span>
    </button>
  );
}

/* =========================================================
   HOME
========================================================= */

function HomePage({
  tracks,
  ...props
}) {
  const shuffled = useMemo(
    () => shuffleArray(tracks),
    [tracks]
  );

  const popular = useMemo(
    () =>
      [...tracks]
        .sort(
          (a, b) =>
            Number(b.plays || 0) -
            Number(a.plays || 0)
        )
        .slice(0, 10),
    [tracks]
  );

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} />
            FENIX MUSIC
          </span>

          <h1>
            Твоя музыка.
            <br />
            <b>Без лишнего.</b>
          </h1>

          <p>
            Все твои треки, любимые исполнители
            и радио — в одном музыкальном пространстве.
          </p>

          <div className="hero-actions">
            <button
              className="primary"
              type="button"
              onClick={() => {
                if (!tracks.length) return;

                props.play(
                  tracks[
                    Math.floor(
                      Math.random() * tracks.length
                    )
                  ]
                );
              }}
            >
              <Play size={17} fill="currentColor" />
              Слушать
            </button>

            <button
              className="secondary"
              type="button"
              onClick={props.shuffleAll}
            >
              <Shuffle size={16} />
              Случайный микс
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="vinyl">
            <Disc3 size={115} />
          </div>
        </div>
      </section>

      <Section title="Для вас">
        <div className="mix-grid">
          {MIX.map((mix) => (
            <MixCard
              key={mix[0]}
              mix={mix}
              tracks={tracks}
              play={props.play}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Треки в случайном порядке"
        action={
          <button
            className="link-btn"
            type="button"
            onClick={props.shuffleAll}
          >
            Перемешать
            <Shuffle size={13} />
          </button>
        }
      >
        {shuffled.length ? (
          <div className="cards">
            {shuffled.slice(0, 6).map((track) => (
              <MusicCard
                key={track.id}
                t={track}
                play={props.play}
              />
            ))}
          </div>
        ) : (
          <Empty
            text="Музыки пока нет"
            sub="Добавь треки в backend/media/music."
          />
        )}
      </Section>

      <Section title="Популярное">
        {popular.length ? (
          <div className="track-list">
            {popular.map((track, index) => (
              <TrackRow
                key={track.id}
                t={track}
                i={index}
                {...props}
              />
            ))}
          </div>
        ) : (
          <Empty
            text="Каталог пуст"
            sub="Добавь музыку в папку music."
          />
        )}
      </Section>
    </>
  );
}

/* =========================================================
   BROWSE
========================================================= */

function BrowsePage({
  tracks,
  ...props
}) {
  const mixedTracks = useMemo(
    () => shuffleArray(tracks),
    [tracks]
  );

  return (
    <>
      <PageTitle
        icon={<Sparkles size={14} />}
        label="ОБЗОР"
        title="Откройте новую музыку"
        text="Каталог FENIX MUSIC автоматически собирается из папки music."
      />

      <Section
        title={`Все треки · ${tracks.length}`}
        action={
          <button
            className="link-btn"
            type="button"
            onClick={() =>
              props.play(
                mixedTracks[
                  Math.floor(
                    Math.random() * mixedTracks.length
                  )
                ]
              )
            }
            disabled={!mixedTracks.length}
          >
            Случайный трек
            <Shuffle size={13} />
          </button>
        }
      >
        {mixedTracks.length ? (
          <div className="track-list">
            {mixedTracks.map((track, index) => (
              <TrackRow
                key={track.id}
                t={track}
                i={index}
                {...props}
              />
            ))}
          </div>
        ) : (
          <Empty
            text="Каталог пока пуст"
            sub="Добавь MP3, FLAC, WAV, M4A или другие аудиофайлы в backend/media/music."
          />
        )}
      </Section>
    </>
  );
}

/* =========================================================
   SEARCH
========================================================= */

function SearchPage({
  q,
  tracks,
  ...props
}) {
  return (
    <>
      <PageTitle
        icon={<Search size={14} />}
        label="ПОИСК"
        title={
          q
            ? `Результаты для «${q}»`
            : "Поиск музыки"
        }
        text="Ищем по названию, исполнителю, альбому и жанру."
      />

      <Section title={`Треки · ${tracks.length}`}>
        {tracks.length ? (
          <div className="track-list">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                t={track}
                i={index}
                {...props}
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={<Search size={40} />}
            text="Ничего не найдено"
            sub="Попробуйте другое название или исполнителя."
          />
        )}
      </Section>
    </>
  );
}

/* =========================================================
   LIBRARY
========================================================= */

function LibraryPage({
  title,
  items,
  ...props
}) {
  const playRandom = () => {
    if (!items.length) return;

    props.play(
      items[
        Math.floor(Math.random() * items.length)
      ]
    );
  };

  return (
    <>
      <div className="collection">
        <div className="collection-art">
          <Heart size={52} fill="currentColor" />
        </div>

        <div>
          <span className="eyebrow">
            FENIX LIBRARY
          </span>

          <h1>{title}</h1>

          <p>{items.length} треков</p>

          <div className="actions">
            <button
              className="primary"
              type="button"
              onClick={playRandom}
              disabled={!items.length}
            >
              <Play size={16} fill="currentColor" />
              Слушать
            </button>

            {items.length > 1 && (
              <button
                className="secondary"
                type="button"
                onClick={playRandom}
              >
                <Shuffle size={16} />
                Перемешать
              </button>
            )}
          </div>
        </div>
      </div>

      <Section title="Треки">
        {items.length ? (
          <div className="track-list">
            {items.map((track, index) => (
              <TrackRow
                key={`${track.id}-${index}`}
                t={track}
                i={index}
                {...props}
              />
            ))}
          </div>
        ) : (
          <Empty
            text="Здесь пока пусто"
            sub="Нажимай ❤️ у понравившихся треков."
          />
        )}
      </Section>
    </>
  );
}

/* =========================================================
   ARTISTS
========================================================= */

function ArtistsPage({
  tracks,
  play,
}) {
  const artists = [
    ...new Set(
      tracks
        .map((track) => track.artist)
        .filter(Boolean)
    ),
  ];

  return (
    <>
      <PageTitle
        icon={<UserRound size={14} />}
        label="ИСПОЛНИТЕЛИ"
        title="Исполнители"
        text={`${artists.length} исполнителей в твоём каталоге.`}
      />

      {artists.length ? (
        <div className="artist-grid">
          {artists.map((artist) => {
            const artistTracks = tracks.filter(
              (track) => track.artist === artist
            );

            const firstTrack = artistTracks[0];

            return (
              <button
                className="artist-box"
                key={artist}
                type="button"
                onClick={() => play(firstTrack)}
              >
                <Cover
                  track={firstTrack}
                  className="artist-cover"
                />

                <div>
                  <b>{artist}</b>
                  <span>
                    {artistTracks.length} треков
                  </span>
                </div>

                <Play size={17} />
              </button>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={<UserRound size={40} />}
          text="Исполнителей пока нет"
          sub="Добавь музыку в каталог."
        />
      )}
    </>
  );
}

/* =========================================================
   ALBUMS
========================================================= */

function AlbumsPage({
  tracks,
  play,
}) {
  const albums = [
    ...new Map(
      tracks.map((track) => [
        `${track.album || "FENIX MUSIC"}::${
          track.artist || "Unknown"
        }`,
        track,
      ])
    ).values(),
  ];

  return (
    <>
      <PageTitle
        icon={<Album size={14} />}
        label="АЛЬБОМЫ"
        title="Альбомы"
        text={`${albums.length} альбомов.`}
      />

      {albums.length ? (
        <div className="album-grid">
          {albums.map((track) => (
            <button
              className="album-box"
              key={`${track.album}-${track.artist}`}
              type="button"
              onClick={() => play(track)}
            >
              <Cover track={track} />

              <b>
                {track.album || "FENIX MUSIC"}
              </b>

              <span>
                {track.artist || "Unknown Artist"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Album size={40} />}
          text="Альбомов пока нет"
          sub="Добавь музыку в каталог."
        />
      )}
    </>
  );
}

/* =========================================================
   RADIO
========================================================= */

function RadioPage({
  radioPlaying,
  setRadioPlaying,
}) {
  return (
    <>
      <PageTitle
        icon={<Radio size={14} />}
        label="FENIX RADIO"
        title="Радио без пауз"
        text="Разные интернет-станции для любого настроения."
      />

      <div className="radio-grid">
        {RADIO.map((station) => {
          const active =
            radioPlaying?.id === station.id;

          return (
            <button
              className={`radio-card ${
                active ? "active" : ""
              }`}
              key={station.id}
              type="button"
              onClick={() =>
                setRadioPlaying(
                  active ? null : station
                )
              }
            >
              <div className="radio-icon">
                {station.icon}
              </div>

              <div>
                <span>{station.genre}</span>
                <b>{station.name}</b>
                <small>{station.desc}</small>
              </div>

              <span className="radio-play">
                {active ? (
                  <Pause size={18} />
                ) : (
                  <Play
                    size={18}
                    fill="currentColor"
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {radioPlaying && (
        <div className="radio-now">
          <div>
            <span>СЕЙЧАС В ЭФИРЕ</span>
            <b>{radioPlaying.name}</b>
            <small>{radioPlaying.desc}</small>
          </div>

          <button
            className="primary"
            type="button"
            onClick={() => setRadioPlaying(null)}
          >
            <Pause size={16} />
            Остановить
          </button>
        </div>
      )}
    </>
  );
}

/* =========================================================
   PLAYLISTS
========================================================= */

function PlaylistsPage({
  playlists,
  setPlaylists,
  ...props
}) {
  const create = async () => {
    if (!props.user) {
      props.openLogin();
      return;
    }

    const name = window.prompt(
      "Название нового плейлиста"
    );

    if (!name?.trim()) return;

    try {
      const item = await api("/playlists", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      setPlaylists((items) => [
        ...items,
        {
          ...item,
          tracks: [],
        },
      ]);
    } catch (error) {
      window.alert(
        error?.message ||
          "Не удалось создать плейлист"
      );
    }
  };

  const remove = async (playlist) => {
    if (
      !window.confirm(
        `Удалить плейлист «${playlist.name}»?`
      )
    ) {
      return;
    }

    try {
      await api(`/playlists/${playlist.id}`, {
        method: "DELETE",
      });

      setPlaylists((items) =>
        items.filter(
          (item) => item.id !== playlist.id
        )
      );
    } catch (error) {
      window.alert(
        error?.message ||
          "Не удалось удалить плейлист"
      );
    }
  };

  return (
    <>
      <PageTitle
        icon={<ListMusic size={14} />}
        label="ПЛЕЙЛИСТЫ"
        title="Твои плейлисты"
        text="Создавай коллекции и добавляй в них музыку."
      />

      <button
        className="primary"
        type="button"
        onClick={create}
      >
        <Plus size={16} />
        Создать плейлист
      </button>

      {playlists.length ? (
        <div className="playlist-grid">
          {playlists.map((playlist) => (
            <div
              className="playlist-box"
              key={playlist.id}
            >
              <div className="playlist-art">
                <ListMusic size={35} />
              </div>

              <div>
                <b>{playlist.name}</b>

                <span>
                  {playlist.tracks?.length || 0} треков
                </span>
              </div>

              <button
                className="icon"
                type="button"
                onClick={() => remove(playlist)}
                title="Удалить"
              >
                <Trash2 size={16} />
              </button>

              {playlist.tracks?.length > 0 && (
                <button
                  className="secondary small"
                  type="button"
                  onClick={() =>
                    props.play(
                      playlist.tracks[0]
                    )
                  }
                >
                  <Play size={14} />
                  Слушать
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={<ListMusic size={40} />}
          text="Плейлистов ещё нет"
          sub="Создай первый плейлист кнопкой выше."
        />
      )}
    </>
  );
}

/* =========================================================
   PROFILE
========================================================= */

function ProfilePage({
  user,
  stats,
  onLogout,
}) {
  return (
    <>
      <PageTitle
        icon={<UserRound size={14} />}
        label="ПРОФИЛЬ"
        title={user?.username || "Гость"}
        text={
          user?.email ||
          "Войди, чтобы сохранять библиотеку."
        }
      />

      {user ? (
        <>
          <div className="profile-card">
            <div className="avatar-big">
              {(user.username || "F")
                .slice(0, 1)
                .toUpperCase()}
            </div>

            <div>
              <h2>{user.username}</h2>
              <span>{user.email}</span>
            </div>

            <button
              className="secondary"
              type="button"
              onClick={onLogout}
            >
              <LogOut size={15} />
              Выйти
            </button>
          </div>

          <div className="stats">
            {[
              [
                stats?.minutes_listened || 0,
                "Минут прослушано",
              ],
              [
                stats?.tracks_played || 0,
                "Прослушиваний",
              ],
              [
                stats?.liked_tracks || 0,
                "Любимых треков",
              ],
              [
                stats?.playlists || 0,
                "Плейлистов",
              ],
            ].map(([value, label]) => (
              <div key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty
          icon={<UserRound size={40} />}
          text="Войди в аккаунт"
          sub="Так будут доступны лайки, история и плейлисты."
        />
      )}
    </>
  );
}

/* =========================================================
   SETTINGS
========================================================= */

function SettingsPage({
  settings,
  setSettings,
}) {
  const options = [
    [
      "autoplay",
      "Автовоспроизведение",
      "После окончания трека включать следующий",
    ],
    [
      "shuffle",
      "Случайное воспроизведение",
      "Не придерживаться порядка каталога",
    ],
    [
      "compact",
      "Компактный список",
      "Показывать больше треков на экране",
    ],
    [
      "notifications",
      "Уведомления",
      "Уведомлять о новых релизах",
    ],
  ];

  return (
    <>
      <PageTitle
        icon={<Settings size={14} />}
        label="НАСТРОЙКИ"
        title="Настройки"
        text="Управляй воспроизведением и интерфейсом."
      />

      <div className="settings">
        {options.map(([id, title, description]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              setSettings((current) => ({
                ...current,
                [id]: !current[id],
              }))
            }
          >
            <div>
              <b>{title}</b>
              <span>{description}</span>
            </div>

            <span
              className={`toggle ${
                settings[id] ? "on" : ""
              }`}
            >
              <i />
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/* =========================================================
   QUEUE
========================================================= */

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
          className="icon"
          type="button"
          onClick={onClose}
        >
          <X />
        </button>
      </div>

      {current && (
        <>
          <small>Сейчас играет</small>

          <div className="q-current">
            <Cover track={current} />

            <div>
              <b>{current.title}</b>
              <span>{current.artist}</span>
            </div>
          </div>
        </>
      )}

      <small>Далее</small>

      {items.length ? (
        items.map((track) => (
          <div
            className="q-item"
            key={track.id}
            onClick={() => play(track)}
          >
            <Cover track={track} />

            <div>
              <b>{track.title}</b>
              <span>{track.artist}</span>
            </div>

            <button
              className="icon"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                remove(track.id);
              }}
            >
              <X size={15} />
            </button>
          </div>
        ))
      ) : (
        <p className="muted">
          Очередь пуста.
        </p>
      )}
    </div>
  );
}

/* =========================================================
   LOGIN
========================================================= */

function LoginModal({
  onClose,
  onDone,
}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setError("Заполни email и пароль.");
      return;
    }

    if (
      mode === "register" &&
      !username.trim()
    ) {
      setError("Укажи username.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const data =
        mode === "login"
          ? await api("/auth/login", {
              method: "POST",
              body: JSON.stringify({
                email,
                password,
              }),
            })
          : await api("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                email,
                username,
                password,
              }),
            });

      localStorage.setItem(
        "fenix_token",
        data.token
      );

      onDone(data.user);
    } catch (error) {
      setError(
        error?.message ||
          "Ошибка авторизации."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back">
      <div className="modal">
        <button
          className="icon close"
          type="button"
          onClick={onClose}
        >
          <X />
        </button>

        <div className="modal-logo">
          <Music2 />
          FENIX MUSIC
        </div>

        <h2>
          {mode === "login"
            ? "С возвращением"
            : "Создать аккаунт"}
        </h2>

        <p>
          {mode === "login"
            ? "Войди и продолжи слушать."
            : "Сохраняй лайки, историю и плейлисты."}
        </p>

        {mode === "register" && (
          <input
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            placeholder="Username"
          />
        )}

        <input
          type="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          placeholder="Email"
        />

        <input
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          placeholder="Пароль"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submit();
            }
          }}
        />

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <button
          className="primary full-btn"
          type="button"
          disabled={busy}
          onClick={submit}
        >
          {busy
            ? "Подождите…"
            : mode === "login"
            ? "Войти"
            : "Зарегистрироваться"}
        </button>

        <button
          className="switch-auth"
          type="button"
          onClick={() => {
            setMode(
              mode === "login"
                ? "register"
                : "login"
            );
            setError("");
          }}
        >
          {mode === "login"
            ? "Нет аккаунта? Регистрация"
            : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   FULL PLAYER
========================================================= */

function FullPlayer({
  current,
  playing,
  setPlaying,
  liked,
  toggleLike,
  next,
  prev,
  close,
  progress,
  seek,
  repeat,
  setRepeat,
  shuffle,
  setShuffle,
  currentTime,
  duration,
}) {
  return (
    <div className="full">
      <div className="full-bg" />

      <div className="fullbar">
        <button
          className="icon"
          type="button"
          onClick={close}
        >
          <ChevronLeft />
        </button>

        <span>Сейчас играет</span>

        <MoreHorizontal />
      </div>

      <div className="fullcontent">
        <Cover
          track={current}
          className="full-cover"
        />

        <div className="fullmeta">
          <div>
            <h1>{current.title}</h1>
            <p>
              {current.artist} •{" "}
              {current.album || "FENIX MUSIC"}
            </p>
          </div>

          <button
            className={`icon ${
              liked.has(current.id)
                ? "liked"
                : ""
            }`}
            type="button"
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

        <div className="fullprogress">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={seek}
          />

          <span>
            <small>
              {formatTime(currentTime)}
            </small>

            <small>
              {formatTime(duration)}
            </small>
          </span>
        </div>

        <div className="fullcontrols">
          <button
            type="button"
            className={
              shuffle
                ? "control-active"
                : ""
            }
            onClick={() =>
              setShuffle((value) => !value)
            }
          >
            <Shuffle />
          </button>

          <button
            type="button"
            onClick={prev}
          >
            <SkipBack size={27} />
          </button>

          <button
            type="button"
            className="full-play"
            onClick={() =>
              setPlaying((value) => !value)
            }
          >
            {playing ? (
              <Pause size={27} />
            ) : (
              <Play
                size={27}
                fill="currentColor"
              />
            )}
          </button>

          <button
            type="button"
            onClick={next}
          >
            <SkipForward size={27} />
          </button>

          <button
            type="button"
            className={
              repeat
                ? "control-active"
                : ""
            }
            onClick={() =>
              setRepeat((value) => !value)
            }
          >
            <Repeat2 />
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [page, setPage] = useState("home");

  const [tracks, setTracks] = useState([]);
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);

  const [liked, setLiked] = useState(
    new Set()
  );

  const [queueItems, setQueueItems] = useState(
    []
  );

  const [queueOpen, setQueueOpen] =
    useState(false);

  const [fullscreen, setFullscreen] =
    useState(false);

  const [search, setSearch] = useState("");

  const [mobile, setMobile] =
    useState(false);

  const [user, setUser] = useState(null);

  const [login, setLogin] =
    useState(false);

  const [history, setHistory] =
    useState([]);

  const [playlists, setPlaylists] =
    useState([]);

  const [stats, setStats] =
    useState(null);

  const [radioPlaying, setRadioPlaying] =
    useState(null);

  const [settings, setSettings] =
    useState({
      autoplay: true,
      shuffle: false,
      compact: false,
      notifications: false,
    });

  const [progress, setProgress] =
    useState(0);

  const [volume, setVolume] =
    useState(0.75);

  const [repeat, setRepeat] =
    useState(false);

  const [shuffle, setShuffle] =
    useState(false);

  const [currentTime, setCurrentTime] =
    useState(0);

  const [duration, setDuration] =
    useState(0);

  const audioRef = useRef(null);
  const radioRef = useRef(null);

  /* -------------------------------------------------------
     LOAD
  ------------------------------------------------------- */

  const loadTracks = async () => {
    try {
      const data = await api(
        "/tracks?limit=500&shuffle=true"
      );

      setTracks(
        Array.isArray(data)
          ? data
          : data?.items || []
      );
    } catch {
      setTracks([]);
    }
  };

  const loadUserData = async () => {
    try {
      const [
        likesData,
        historyData,
        playlistData,
        statsData,
      ] = await Promise.all([
        api("/library/likes"),
        api("/history"),
        api("/playlists"),
        api("/profile/stats"),
      ]);

      setLiked(
        new Set(likesData?.track_ids || [])
      );

      setHistory(historyData || []);
      setPlaylists(playlistData || []);
      setStats(statsData);
    } catch {
      // Пользовательские данные необязательны.
    }
  };

  useEffect(() => {
    loadTracks();

    const token =
      localStorage.getItem("fenix_token");

    if (!token) return;

    api("/auth/me")
      .then((currentUser) => {
        setUser(currentUser);
        loadUserData();
      })
      .catch(() => {
        localStorage.removeItem(
          "fenix_token"
        );
      });
  }, []);

  /* -------------------------------------------------------
     VOLUME
  ------------------------------------------------------- */

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }

    if (radioRef.current) {
      radioRef.current.volume = volume;
    }
  }, [volume]);

  /* -------------------------------------------------------
     TRACK CHANGE
  ------------------------------------------------------- */

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !current) return;

    const source = current.audio_url
      ? mediaUrl(current.audio_url)
      : current.audio_path
      ? mediaUrl(
          `/media/audio/${encodeURIComponent(
            current.id
          )}`
        )
      : "";

    if (!source) {
      setPlaying(false);
      return;
    }

    audio.src = source;
    audio.load();

    if (playing) {
      audio
        .play()
        .catch(() => setPlaying(false));
    }
  }, [current]);

  /* -------------------------------------------------------
     RADIO
  ------------------------------------------------------- */

  useEffect(() => {
    const radio = radioRef.current;

    if (!radio) return;

    if (radioPlaying) {
      radio.src = radioPlaying.url;

      radio
        .play()
        .catch(() => {});
    } else {
      radio.pause();
      radio.removeAttribute("src");
    }
  }, [radioPlaying]);

  /* -------------------------------------------------------
     PLAY
  ------------------------------------------------------- */

  const play = (track) => {
    if (!track) return;

    if (current?.id === track.id) {
      setPlaying((value) => !value);
      return;
    }

    setCurrent(track);
    setPlaying(true);
    setProgress(0);
    setCurrentTime(0);

    api(`/history/${track.id}`, {
      method: "POST",
    }).catch(() => {});

    setHistory((items) =>
      [
        {
          track,
        },
        ...items,
      ].slice(0, 100)
    );
  };

  /* -------------------------------------------------------
     AUDIO EVENTS
  ------------------------------------------------------- */

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    const handleTime = () => {
      setCurrentTime(
        Number(audio.currentTime || 0)
      );

      setDuration(
        Number(audio.duration || 0)
      );

      setProgress(
        audio.duration
          ? (audio.currentTime /
              audio.duration) *
              100
          : 0
      );
    };

    const handleLoaded = () => {
      setDuration(
        Number(audio.duration || 0)
      );
    };

    const handleEnded = () => {
      if (repeat) {
        audio.currentTime = 0;

        audio.play().catch(() => {});

        return;
      }

      if (queueItems.length) {
        const [nextTrack, ...rest] =
          queueItems;

        setQueueItems(rest);
        setCurrent(nextTrack);
        setPlaying(true);

        return;
      }

      if (shuffle && tracks.length) {
        const randomTrack =
          tracks[
            Math.floor(
              Math.random() * tracks.length
            )
          ];

        play(randomTrack);
        return;
      }

      if (settings.autoplay && current) {
        const index = tracks.findIndex(
          (track) =>
            track.id === current.id
        );

        if (index >= 0 && tracks.length > 1) {
          const nextIndex =
            (index + 1) % tracks.length;

          play(tracks[nextIndex]);

          return;
        }
      }

      setPlaying(false);
    };

    audio.addEventListener(
      "timeupdate",
      handleTime
    );

    audio.addEventListener(
      "loadedmetadata",
      handleLoaded
    );

    audio.addEventListener(
      "ended",
      handleEnded
    );

    return () => {
      audio.removeEventListener(
        "timeupdate",
        handleTime
      );

      audio.removeEventListener(
        "loadedmetadata",
        handleLoaded
      );

      audio.removeEventListener(
        "ended",
        handleEnded
      );
    };
  }, [
    current,
    queueItems,
    repeat,
    shuffle,
    tracks,
    settings.autoplay,
  ]);

  /* -------------------------------------------------------
     PLAY / PAUSE
  ------------------------------------------------------- */

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    if (playing) {
      audio
        .play()
        .catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing]);

  /* -------------------------------------------------------
     SEEK
  ------------------------------------------------------- */

  const seek = (event) => {
    const audio = audioRef.current;

    if (!audio?.duration) return;

    const value = Number(
      event.target.value
    );

    audio.currentTime =
      (value / 100) * audio.duration;
  };

  /* -------------------------------------------------------
     NEXT / PREVIOUS
  ------------------------------------------------------- */

  const next = () => {
    if (!tracks.length) return;

    if (queueItems.length) {
      const [nextTrack, ...rest] =
        queueItems;

      setQueueItems(rest);
      setCurrent(nextTrack);
      setPlaying(true);

      return;
    }

    if (shuffle) {
      play(
        tracks[
          Math.floor(
            Math.random() * tracks.length
          )
        ]
      );

      return;
    }

    const index = tracks.findIndex(
      (track) =>
        track.id === current?.id
    );

    play(
      tracks[
        index >= 0
          ? (index + 1) % tracks.length
          : 0
      ]
    );
  };

  const prev = () => {
    if (!tracks.length) return;

    const index = tracks.findIndex(
      (track) =>
        track.id === current?.id
    );

    play(
      tracks[
        index >= 0
          ? (index - 1 + tracks.length) %
            tracks.length
          : tracks.length - 1
      ]
    );
  };

  /* -------------------------------------------------------
     LIKES
  ------------------------------------------------------- */

  const toggleLike = async (id) => {
    const previous = new Set(liked);
    const nextLiked = new Set(liked);

    const value =
      !nextLiked.has(id);

    if (value) {
      nextLiked.add(id);
    } else {
      nextLiked.delete(id);
    }

    setLiked(nextLiked);

    try {
      await api(`/library/likes/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          liked: value,
        }),
      });
    } catch {
      setLiked(previous);
    }
  };

  /* -------------------------------------------------------
     QUEUE
  ------------------------------------------------------- */

  const addQueue = (track) => {
    if (!track) return;

    setQueueItems((items) =>
      items.some(
        (item) => item.id === track.id
      )
        ? items
        : [...items, track]
    );

    setQueueOpen(true);
  };

  const shuffleAll = () => {
    if (!tracks.length) return;

    const mixed = shuffleArray(tracks);

    play(mixed[0]);

    setQueueItems(mixed.slice(1));
  };

  /* -------------------------------------------------------
     NAVIGATION
  ------------------------------------------------------- */

  const nav = (target) => {
    setPage(target);
    setMobile(false);
  };

  const logout = () => {
    localStorage.removeItem(
      "fenix_token"
    );

    setUser(null);
    setLiked(new Set());
    setPlaylists([]);
    setStats(null);
    setHistory([]);
    setPage("home");
  };

  /* -------------------------------------------------------
     SEARCH
  ------------------------------------------------------- */

  const filtered = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) return tracks;

    return tracks.filter((track) =>
      `${track.title || ""} ${
        track.artist || ""
      } ${track.album || ""} ${
        track.genre || ""
      }`
        .toLowerCase()
        .includes(query)
    );
  }, [search, tracks]);

  /* -------------------------------------------------------
     SHARED PROPS
  ------------------------------------------------------- */

  const trackProps = {
    current,
    playing,
    play,
    liked,
    toggleLike,
    queue: addQueue,
  };

  return (
    <div className="app">
      <audio
        ref={audioRef}
        preload="metadata"
      />

      <audio
        ref={radioRef}
        preload="none"
      />

      {/* SIDEBAR */}

      <aside
        className={`sidebar ${
          mobile ? "open" : ""
        }`}
      >
        <div className="side-top">
          <Logo />

          <button
            className="mobile-close"
            type="button"
            onClick={() =>
              setMobile(false)
            }
          >
            <X />
          </button>
        </div>

        <div className="nav-section">
          <span className="nav-label">
            МУЗЫКА
          </span>

          <NavItem
            icon={<HomeIcon />}
            label="Главная"
            active={page === "home"}
            onClick={() => nav("home")}
          />

          <NavItem
            icon={<Sparkles />}
            label="Обзор"
            active={page === "browse"}
            onClick={() => nav("browse")}
          />

          <NavItem
            icon={<Radio />}
            label="Радио"
            active={page === "radio"}
            onClick={() => nav("radio")}
          />

          <NavItem
            icon={<Search />}
            label="Поиск"
            active={page === "search"}
            onClick={() => nav("search")}
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
            onClick={() =>
              nav("favorites")
            }
            badge={liked.size}
          />

          <NavItem
            icon={<ListMusic />}
            label="Плейлисты"
            active={page === "playlists"}
            onClick={() =>
              nav("playlists")
            }
          />

          <NavItem
            icon={<Album />}
            label="Альбомы"
            active={page === "albums"}
            onClick={() =>
              nav("albums")
            }
          />

          <NavItem
            icon={<UserRound />}
            label="Исполнители"
            active={page === "artists"}
            onClick={() =>
              nav("artists")
            }
          />

          <NavItem
            icon={<Clock3 />}
            label="История"
            active={page === "history"}
            onClick={() =>
              nav("history")
            }
          />
        </div>

        <div className="side-bottom">
          <NavItem
            icon={<UserRound />}
            label="Профиль"
            active={page === "profile"}
            onClick={() =>
              nav("profile")
            }
          />

          <NavItem
            icon={<Settings />}
            label="Настройки"
            active={page === "settings"}
            onClick={() =>
              nav("settings")
            }
          />
        </div>
      </aside>

      {/* MAIN */}

      <main>
        <header>
          <button
            className="mobile-menu"
            type="button"
            onClick={() =>
              setMobile(true)
            }
          >
            <Menu />
          </button>

          <div className="back">
            <button
              type="button"
              onClick={() =>
                window.history.back()
              }
            >
              <ChevronLeft />
            </button>

            <button
              type="button"
              onClick={() =>
                window.history.forward()
              }
            >
              <ChevronRight />
            </button>
          </div>

          <div className="search">
            <Search size={18} />

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
                <X size={16} />
              </button>
            )}
          </div>

          <div className="top-actions">
            <button
              className="icon"
              type="button"
              title="Уведомления"
            >
              <Bell size={18} />
            </button>

            <button
              className="icon"
              type="button"
              title="Библиотека"
              onClick={() =>
                nav("favorites")
              }
            >
              <LibraryIcon size={18} />
            </button>

            <button
              className="user"
              type="button"
              onClick={() =>
                nav("profile")
              }
            >
              <span className="avatar-small">
                {(user?.username || "G")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>

              <span>
                {user?.username || "Гость"}
              </span>
            </button>
          </div>
        </header>

        <div className="content">
          {page === "home" && (
            <HomePage
              tracks={tracks}
              {...trackProps}
              shuffleAll={shuffleAll}
            />
          )}

          {page === "browse" && (
            <BrowsePage
              tracks={tracks}
              {...trackProps}
            />
          )}

          {page === "search" && (
            <SearchPage
              q={search}
              tracks={filtered}
              {...trackProps}
            />
          )}

          {page === "favorites" && (
            <LibraryPage
              title="Любимые треки"
              items={tracks.filter(
                (track) =>
                  liked.has(track.id)
              )}
              {...trackProps}
            />
          )}

          {page === "history" && (
            <LibraryPage
              title="История прослушиваний"
              items={history
                .map((item) => item.track)
                .filter(Boolean)}
              {...trackProps}
            />
          )}

          {page === "artists" && (
            <ArtistsPage
              tracks={tracks}
              play={play}
            />
          )}

          {page === "albums" && (
            <AlbumsPage
              tracks={tracks}
              play={play}
            />
          )}

          {page === "radio" && (
            <RadioPage
              radioPlaying={radioPlaying}
              setRadioPlaying={
                setRadioPlaying
              }
            />
          )}

          {page === "playlists" && (
            <PlaylistsPage
              playlists={playlists}
              setPlaylists={setPlaylists}
              play={play}
              user={user}
              openLogin={() =>
                setLogin(true)
              }
            />
          )}

          {page === "profile" && (
            <ProfilePage
              user={user}
              stats={stats}
              onLogout={logout}
            />
          )}

          {page === "settings" && (
            <SettingsPage
              settings={settings}
              setSettings={setSettings}
            />
          )}
        </div>
      </main>

      {/* DESKTOP PLAYER */}

      {current && (
        <>
          <footer className="player">
            <div
              className="now"
              onClick={() =>
                setFullscreen(true)
              }
            >
              <Cover track={current} />

              <div>
                <b>{current.title}</b>
                <span>{current.artist}</span>
              </div>

              <button
                className={`icon ${
                  liked.has(current.id)
                    ? "liked"
                    : ""
                }`}
                type="button"
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

            <div className="pc">
              <div className="controls">
                <button
                  type="button"
                  onClick={() =>
                    setShuffle(
                      (value) => !value
                    )
                  }
                  className={
                    shuffle
                      ? "control-active"
                      : ""
                  }
                >
                  <Shuffle size={17} />
                </button>

                <button
                  type="button"
                  onClick={prev}
                >
                  <SkipBack size={19} />
                </button>

                <button
                  className="play-btn"
                  type="button"
                  onClick={() =>
                    setPlaying(
                      (value) => !value
                    )
                  }
                >
                  {playing ? (
                    <Pause size={19} />
                  ) : (
                    <Play size={19} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={next}
                >
                  <SkipForward size={19} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setRepeat(
                      (value) => !value
                    )
                  }
                  className={
                    repeat
                      ? "control-active"
                      : ""
                  }
                >
                  <Repeat2 size={17} />
                </button>
              </div>

              <div className="progress">
                <span>
                  {formatTime(currentTime)}
                </span>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={seek}
                />

                <span>
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            <div className="pr">
              <Volume2 size={18} />

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

              <button
                className="icon"
                type="button"
                onClick={() =>
                  setQueueOpen(true)
                }
              >
                <ListMusic size={19} />
              </button>
            </div>
          </footer>

          {/* MOBILE PLAYER */}

          <div
            className="mobile-player"
            onClick={() =>
              setFullscreen(true)
            }
          >
            <Cover track={current} />

            <div>
              <b>{current.title}</b>
              <span>{current.artist}</span>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setPlaying(
                  (value) => !value
                );
              }}
            >
              {playing ? <Pause /> : <Play />}
            </button>
          </div>
        </>
      )}

      {/* QUEUE */}

      {queueOpen && current && (
        <Queue
          items={queueItems}
          current={current}
          onClose={() =>
            setQueueOpen(false)
          }
          play={play}
          remove={(id) =>
            setQueueItems((items) =>
              items.filter(
                (track) =>
                  track.id !== id
              )
            )
          }
        />
      )}

      {/* FULL PLAYER */}

      {fullscreen && current && (
        <FullPlayer
          current={current}
          playing={playing}
          setPlaying={setPlaying}
          liked={liked}
          toggleLike={toggleLike}
          next={next}
          prev={prev}
          close={() =>
            setFullscreen(false)
          }
          progress={progress}
          seek={seek}
          repeat={repeat}
          setRepeat={setRepeat}
          shuffle={shuffle}
          setShuffle={setShuffle}
          currentTime={currentTime}
          duration={duration}
        />
      )}

      {/* LOGIN */}

      {login && (
        <LoginModal
          onClose={() =>
            setLogin(false)
          }
          onDone={(currentUser) => {
            setUser(currentUser);
            setLogin(false);
            loadUserData();
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   START
========================================================= */

createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
