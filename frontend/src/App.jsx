import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const API_BASE = "https://ccmusice.onrender.com";

const FALLBACK_TRACKS = [
  {
    id: "demo-1",
    title: "Neon Dreams",
    artist_name: "Fenix Music",
    album_name: "Fenix Originals",
    duration: 218,
    plays_count: 12453,
    audio_url: "",
    cover_url: "",
  },
  {
    id: "demo-2",
    title: "Night Drive",
    artist_name: "Fenix Music",
    album_name: "Night Collection",
    duration: 194,
    plays_count: 9832,
    audio_url: "",
    cover_url: "",
  },
  {
    id: "demo-3",
    title: "After Dark",
    artist_name: "Fenix Music",
    album_name: "After Dark",
    duration: 231,
    plays_count: 8421,
    audio_url: "",
    cover_url: "",
  },
  {
    id: "demo-4",
    title: "Red Lights",
    artist_name: "Fenix Music",
    album_name: "Neon City",
    duration: 207,
    plays_count: 7314,
    audio_url: "",
    cover_url: "",
  },
  {
    id: "demo-5",
    title: "Midnight",
    artist_name: "Fenix Music",
    album_name: "Midnight",
    duration: 245,
    plays_count: 6211,
    audio_url: "",
    cover_url: "",
  },
  {
    id: "demo-6",
    title: "Electric Heart",
    artist_name: "Fenix Music",
    album_name: "Electric",
    duration: 201,
    plays_count: 5842,
    audio_url: "",
    cover_url: "",
  },
  {
    id: "demo-7",
    title: "Lost In The City",
    artist_name: "Fenix Music",
    album_name: "City Lights",
    duration: 226,
    plays_count: 5121,
    audio_url: "",
    cover_url: "",
  },
  {
    id: "demo-8",
    title: "Zero Gravity",
    artist_name: "Fenix Music",
    album_name: "Gravity",
    duration: 238,
    plays_count: 4877,
    audio_url: "",
    cover_url: "",
  },
];

const NAVIGATION = [
  {
    id: "home",
    title: "Главная",
    icon: "⌂",
  },
  {
    id: "for-you",
    title: "Для вас",
    icon: "✦",
  },
  {
    id: "new",
    title: "Новинки",
    icon: "◈",
  },
  {
    id: "popular",
    title: "Популярное",
    icon: "🔥",
  },
  {
    id: "mixes",
    title: "Миксы",
    icon: "♫",
  },
];

const LIBRARY_NAV = [
  {
    id: "history",
    title: "История",
    icon: "↶",
  },
  {
    id: "favorites",
    title: "Избранное",
    icon: "♡",
  },
];

function apiUrl(value) {
  if (!value) {
    return API_BASE;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return `${API_BASE}${value.startsWith("/") ? "" : "/"}${value}`;
}

async function apiFetch(endpoint, options = {}) {
  const response = await fetch(apiUrl(endpoint), {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      ok: false,
      error: text || `HTTP ${response.status}`,
    };
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        `Ошибка сервера: ${response.status}`
    );
  }

  return data;
}

function formatTime(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("ru-RU").format(number);
}

function getInitials(value) {
  const text = String(value || "F").trim();

  if (!text) {
    return "F";
  }

  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function randomCaptcha() {
  return String(
    Math.floor(1000 + Math.random() * 9000)
  );
}

function Cover({
  track,
  size = "medium",
  playing = false,
}) {
  const [imageFailed, setImageFailed] = useState(false);

  const cover =
    track?.cover_url && !imageFailed
      ? apiUrl(track.cover_url)
      : "";

  return (
    <div
      className={`fm-cover fm-cover-${size} ${
        playing ? "is-playing" : ""
      }`}
    >
      {cover ? (
        <img
          src={cover}
          alt={track?.title || "Fenix Music"}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="fm-cover-generated">
          <div className="fm-cover-glow" />
          <span>F</span>
        </div>
      )}

      {playing ? (
        <div className="fm-cover-equalizer">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : null}
    </div>
  );
}

function PlayButton({
  track,
  active,
  playing,
  onPlay,
  large = false,
}) {
  return (
    <button
      type="button"
      className={`fm-play-button ${
        large ? "large" : ""
      } ${active ? "active" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onPlay(track);
      }}
      aria-label={
        active && playing
          ? "Пауза"
          : "Воспроизвести"
      }
    >
      {active && playing ? "Ⅱ" : "▶"}
    </button>
  );
}

function TrackCard({
  track,
  currentTrack,
  isPlaying,
  onPlay,
  onFavorite,
  isFavorite,
}) {
  const active = currentTrack?.id === track.id;

  return (
    <article className="fm-track-card">
      <div className="fm-track-card-cover">
        <Cover
          track={track}
          size="large"
          playing={active && isPlaying}
        />

        <PlayButton
          track={track}
          active={active}
          playing={isPlaying}
          onPlay={onPlay}
          large
        />
      </div>

      <div className="fm-track-card-body">
        <div className="fm-track-card-title">
          {track.title}
        </div>

        <div className="fm-track-card-artist">
          {track.artist_name || "Fenix Music"}
        </div>
      </div>

      <button
        type="button"
        className={`fm-favorite-button ${
          isFavorite ? "active" : ""
        }`}
        onClick={() => onFavorite(track)}
        aria-label="Добавить в избранное"
      >
        {isFavorite ? "♥" : "♡"}
      </button>
    </article>
  );
}

function TrackRow({
  track,
  index,
  currentTrack,
  isPlaying,
  onPlay,
  onFavorite,
  isFavorite,
}) {
  const active = currentTrack?.id === track.id;

  return (
    <div
      className={`fm-track-row ${
        active ? "active" : ""
      }`}
      onDoubleClick={() => onPlay(track)}
    >
      <div className="fm-track-number">
        {active && isPlaying ? (
          <div className="fm-row-equalizer">
            <i />
            <i />
            <i />
          </div>
        ) : (
          index + 1
        )}
      </div>

      <button
        type="button"
        className="fm-track-row-main"
        onClick={() => onPlay(track)}
      >
        <Cover
          track={track}
          size="small"
          playing={active && isPlaying}
        />

        <div className="fm-track-row-info">
          <strong>{track.title}</strong>
          <span>
            {track.artist_name || "Fenix Music"}
          </span>
        </div>
      </button>

      <div className="fm-track-row-album">
        {track.album_name || "Single"}
      </div>

      <div className="fm-track-row-plays">
        {formatNumber(track.plays_count || 0)}
      </div>

      <button
        type="button"
        className={`fm-row-heart ${
          isFavorite ? "active" : ""
        }`}
        onClick={() => onFavorite(track)}
      >
        {isFavorite ? "♥" : "♡"}
      </button>

      <span className="fm-track-row-duration">
        {formatTime(track.duration)}
      </span>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
}) {
  return (
    <div className="fm-section-header">
      <div>
        <h2>{title}</h2>

        {subtitle ? (
          <p>{subtitle}</p>
        ) : null}
      </div>

      {action ? (
        <button
          type="button"
          className="fm-section-action"
          onClick={onAction}
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

function SearchOverlay({
  open,
  query,
  setQuery,
  tracks,
  currentTrack,
  isPlaying,
  onPlay,
  onFavorite,
  isFavorite,
  onClose,
}) {
  const results = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return tracks.slice(0, 8);
    }

    return tracks.filter((track) => {
      const text = [
        track.title,
        track.artist_name,
        track.album_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(value);
    });
  }, [query, tracks]);

  if (!open) {
    return null;
  }

  return (
    <div className="fm-search-overlay">
      <div className="fm-search-panel">
        <div className="fm-search-panel-header">
          <div className="fm-search-panel-input">
            <span>⌕</span>

            <input
              autoFocus
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Что хочешь послушать?"
            />

            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
              >
                ×
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="fm-search-close"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        <div className="fm-search-results">
          <div className="fm-search-result-title">
            {query
              ? `Результаты для «${query}»`
              : "Популярные треки"}
          </div>

          {results.length ? (
            results.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlay={onPlay}
                onFavorite={onFavorite}
                isFavorite={isFavorite(track)}
              />
            ))
          ) : (
            <div className="fm-empty">
              <div className="fm-empty-icon">
                ⌕
              </div>
              <h3>Ничего не найдено</h3>
              <p>
                Попробуй другое название трека,
                артиста или альбома.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthModal({
  open,
  mode,
  onClose,
  onModeChange,
  onSubmit,
  loading,
  error,
  captcha,
  captchaInput,
  setCaptchaInput,
  refreshCaptcha,
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setUsername("");
      setEmail("");
      setPassword("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const registration = mode === "register";

  function submit(event) {
    event.preventDefault();

    onSubmit({
      username,
      email,
      password,
      captcha: captchaInput,
    });
  }

  return (
    <div
      className="fm-modal-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="fm-auth-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <button
          type="button"
          className="fm-modal-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className="fm-auth-brand">
          <div className="fm-auth-logo">F</div>

          <div>
            <strong>FENIX</strong>
            <span>MUSIC</span>
          </div>
        </div>

        <div className="fm-auth-heading">
          <h2>
            {registration
              ? "Создать аккаунт"
              : "С возвращением"}
          </h2>

          <p>
            {registration
              ? "Собери свою музыкальную коллекцию"
              : "Войди и продолжи слушать музыку"}
          </p>
        </div>

        <form
          className="fm-auth-form"
          onSubmit={submit}
        >
          {registration ? (
            <label className="fm-field">
              <span>Имя пользователя</span>

              <input
                type="text"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="FenixUser"
                autoComplete="username"
                required
              />
            </label>
          ) : null}

          <label className="fm-field">
            <span>Email</span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="fm-field">
            <span>Пароль</span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Введите пароль"
              autoComplete={
                registration
                  ? "new-password"
                  : "current-password"
              }
              required
            />
          </label>

          <div className="fm-captcha">
            <div className="fm-captcha-heading">
              <div>
                <strong>Проверка</strong>
                <span>
                  Введите 4 цифры с картинки
                </span>
              </div>

              <button
                type="button"
                onClick={refreshCaptcha}
                title="Обновить CAPTCHA"
              >
                ↻
              </button>
            </div>

            <div className="fm-captcha-display">
              <div className="fm-captcha-noise">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>

              <strong>{captcha || "----"}</strong>
            </div>

            <input
              className="fm-captcha-input"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={captchaInput}
              onChange={(event) =>
                setCaptchaInput(
                  event.target.value.replace(
                    /[^0-9]/g,
                    ""
                  )
                )
              }
              placeholder="0000"
              required
            />
          </div>

          {error ? (
            <div className="fm-auth-error">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="fm-auth-submit"
            disabled={loading}
          >
            {loading
              ? "Проверяем..."
              : registration
              ? "Создать аккаунт"
              : "Войти"}
          </button>
        </form>

        <div className="fm-auth-switch">
          <span>
            {registration
              ? "Уже есть аккаунт?"
              : "Нет аккаунта?"}
          </span>

          <button
            type="button"
            onClick={() =>
              onModeChange(
                registration ? "login" : "register"
              )
            }
          >
            {registration
              ? "Войти"
              : "Зарегистрироваться"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QueuePanel({
  open,
  queue,
  currentTrack,
  onPlay,
  onRemove,
  onClose,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fm-queue-panel">
      <div className="fm-queue-header">
        <div>
          <strong>Очередь</strong>
          <span>{queue.length} треков</span>
        </div>

        <button
          type="button"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="fm-queue-list">
        {queue.length === 0 ? (
          <div className="fm-queue-empty">
            Очередь пуста
          </div>
        ) : (
          queue.map((track, index) => {
            const active =
              currentTrack?.id === track.id;

            return (
              <div
                className={`fm-queue-item ${
                  active ? "active" : ""
                }`}
                key={`${track.id}-${index}`}
              >
                <span>{index + 1}</span>

                <button
                  type="button"
                  onClick={() => onPlay(track)}
                >
                  <Cover
                    track={track}
                    size="tiny"
                    playing={active}
                  />

                  <div>
                    <strong>{track.title}</strong>
                    <small>
                      {track.artist_name ||
                        "Fenix Music"}
                    </small>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onRemove(track)}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FullPlayer({
  open,
  track,
  isPlaying,
  progress,
  duration,
  volume,
  shuffle,
  repeat,
  favorite,
  onClose,
  onToggle,
  onPrevious,
  onNext,
  onSeek,
  onVolume,
  onShuffle,
  onRepeat,
  onFavorite,
}) {
  if (!open || !track) {
    return null;
  }

  return (
    <div className="fm-full-player">
      <div className="fm-full-player-top">
        <button
          type="button"
          onClick={onClose}
          className="fm-full-player-close"
        >
          ↓
        </button>

        <span>СЕЙЧАС ИГРАЕТ</span>

        <button
          type="button"
          onClick={onFavorite}
          className={`fm-full-heart ${
            favorite ? "active" : ""
          }`}
        >
          {favorite ? "♥" : "♡"}
        </button>
      </div>

      <div className="fm-full-player-content">
        <div className="fm-full-cover">
          <Cover
            track={track}
            size="huge"
            playing={isPlaying}
          />
        </div>

        <div className="fm-full-info">
          <span>FENIX MUSIC</span>
          <h2>{track.title}</h2>
          <p>
            {track.artist_name || "Fenix Music"}
          </p>
        </div>

        <div className="fm-full-progress">
          <input
            type="range"
            min="0"
            max={Math.max(
              duration || track.duration || 1,
              1
            )}
            step="0.1"
            value={Math.min(
              progress,
              duration || track.duration || 1
            )}
            onChange={(event) =>
              onSeek(Number(event.target.value))
            }
          />

          <div>
            <span>{formatTime(progress)}</span>
            <span>
              {formatTime(
                duration || track.duration
              )}
            </span>
          </div>
        </div>

        <div className="fm-full-controls">
          <button
            type="button"
            className={shuffle ? "active" : ""}
            onClick={onShuffle}
          >
            🔀
          </button>

          <button
            type="button"
            onClick={onPrevious}
          >
            ◀
          </button>

          <button
            type="button"
            className="fm-full-play"
            onClick={onToggle}
          >
            {isPlaying ? "Ⅱ" : "▶"}
          </button>

          <button
            type="button"
            onClick={onNext}
          >
            ▶
          </button>

          <button
            type="button"
            className={repeat ? "active" : ""}
            onClick={onRepeat}
          >
            🔁
          </button>
        </div>

        <div className="fm-full-volume">
          <span>🔊</span>

          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) =>
              onVolume(Number(event.target.value))
            }
          />

          <span>{volume}%</span>
        </div>
      </div>
    </div>
  );
}

function PlayerBar({
  track,
  isPlaying,
  progress,
  duration,
  volume,
  shuffle,
  repeat,
  favorite,
  queueOpen,
  onToggle,
  onPrevious,
  onNext,
  onSeek,
  onVolume,
  onShuffle,
  onRepeat,
  onFavorite,
  onQueue,
  onFullPlayer,
}) {
  if (!track) {
    return null;
  }

  return (
    <div className="fm-player-bar">
      <div className="fm-player-bar-progress">
        <input
          type="range"
          min="0"
          max={Math.max(
            duration || track.duration || 1,
            1
          )}
          step="0.1"
          value={Math.min(
            progress,
            duration || track.duration || 1
          )}
          onChange={(event) =>
            onSeek(Number(event.target.value))
          }
        />
      </div>

      <div className="fm-player-inner">
        <button
          type="button"
          className="fm-player-track"
          onClick={onFullPlayer}
        >
          <Cover
            track={track}
            size="player"
            playing={isPlaying}
          />

          <div>
            <strong>{track.title}</strong>
            <span>
              {track.artist_name || "Fenix Music"}
            </span>
          </div>
        </button>

        <div className="fm-player-center">
          <div className="fm-player-main-controls">
            <button
              type="button"
              className={shuffle ? "active" : ""}
              onClick={onShuffle}
            >
              🔀
            </button>

            <button
              type="button"
              onClick={onPrevious}
            >
              ◀
            </button>

            <button
              type="button"
              className="fm-player-main-play"
              onClick={onToggle}
            >
              {isPlaying ? "Ⅱ" : "▶"}
            </button>

            <button
              type="button"
              onClick={onNext}
            >
              ▶
            </button>

            <button
              type="button"
              className={repeat ? "active" : ""}
              onClick={onRepeat}
            >
              🔁
            </button>
          </div>

          <div className="fm-player-time">
            <span>{formatTime(progress)}</span>
            <span>
              {formatTime(
                duration || track.duration
              )}
            </span>
          </div>
        </div>

        <div className="fm-player-actions">
          <button
            type="button"
            className={favorite ? "active" : ""}
            onClick={onFavorite}
          >
            {favorite ? "♥" : "♡"}
          </button>

          <button
            type="button"
            className={
              queueOpen ? "active" : ""
            }
            onClick={onQueue}
          >
            ☷
          </button>

          <span>🔊</span>

          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) =>
              onVolume(Number(event.target.value))
            }
          />

          <button
            type="button"
            onClick={onFullPlayer}
          >
            ⛶
          </button>
        </div>
      </div>
    </div>
  );
}

function HomePage({
  tracks,
  currentTrack,
  isPlaying,
  favorites,
  historyTracks,
  popularTracks,
  onPlay,
  onFavorite,
  goTo,
}) {
  return (
    <>
      <section className="fm-hero">
        <div className="fm-hero-background">
          <div className="fm-hero-circle circle-one" />
          <div className="fm-hero-circle circle-two" />
          <div className="fm-hero-grid" />
        </div>

        <div className="fm-hero-copy">
          <span className="fm-eyebrow">
            FENIX MUSIC
          </span>

          <h1>
            Музыка
            <br />
            <em>без границ.</em>
          </h1>

          <p>
            Открывай новые треки, создавай свою
            коллекцию и слушай музыку, которая
            подходит именно тебе.
          </p>

          <div className="fm-hero-buttons">
            <button
              type="button"
              className="fm-primary-button"
              onClick={() =>
                tracks[0] && onPlay(tracks[0])
              }
            >
              ▶ Начать слушать
            </button>

            <button
              type="button"
              className="fm-secondary-button"
              onClick={() => goTo("for-you")}
            >
              ✦ Для вас
            </button>
          </div>
        </div>

        <div className="fm-hero-art">
          <div className="fm-hero-disc">
            <div className="fm-disc-center">
              F
            </div>
          </div>

          <div className="fm-floating-note note-one">
            ♪
          </div>
          <div className="fm-floating-note note-two">
            ♫
          </div>
          <div className="fm-floating-note note-three">
            ♪
          </div>
        </div>
      </section>

      {historyTracks.length ? (
        <section className="fm-section">
          <SectionHeader
            title="Продолжить слушать"
            action="Показать всё"
            onAction={() => goTo("history")}
          />

          <div className="fm-card-grid">
            {historyTracks
              .slice(0, 4)
              .map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onPlay={onPlay}
                  onFavorite={onFavorite}
                  isFavorite={favorites.includes(
                    track.id
                  )}
                />
              ))}
          </div>
        </section>
      ) : null}

      <section className="fm-section">
        <SectionHeader
          title="Популярное"
          subtitle="То, что сейчас слушают чаще всего"
          action="Все треки"
          onAction={() => goTo("popular")}
        />

        <div className="fm-card-grid">
          {popularTracks
            .slice(0, 6)
            .map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlay={onPlay}
                onFavorite={onFavorite}
                isFavorite={favorites.includes(
                  track.id
                )}
              />
            ))}
        </div>
      </section>

      <section className="fm-section">
        <SectionHeader
          title="Все треки"
          subtitle={`${tracks.length} треков в каталоге`}
        />

        <div className="fm-track-list">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlay={onPlay}
              onFavorite={onFavorite}
              isFavorite={favorites.includes(
                track.id
              )}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function ForYouPage({
  tracks,
  currentTrack,
  isPlaying,
  favorites,
  onPlay,
  onFavorite,
  goTo,
}) {
  const recommendations = tracks.slice(0, 8);

  return (
    <>
      <div className="fm-page-heading">
        <span className="fm-eyebrow">
          ПЕРСОНАЛЬНО
        </span>

        <h1>Для вас</h1>

        <p>
          Музыка, подобранная под твой вкус.
        </p>
      </div>

      <section className="fm-feature-grid">
        <button
          type="button"
          className="fm-feature-card feature-red"
          onClick={() =>
            recommendations[0] &&
            onPlay(recommendations[0])
          }
        >
          <span>🔥</span>
          <strong>Твой вечер</strong>
          <small>
            Музыка для спокойного вечера
          </small>
          <b>▶</b>
        </button>

        <button
          type="button"
          className="fm-feature-card feature-dark"
          onClick={() => goTo("mixes")}
        >
          <span>✦</span>
          <strong>Fenix Mix</strong>
          <small>
            Персональная подборка
          </small>
          <b>→</b>
        </button>

        <button
          type="button"
          className="fm-feature-card feature-purple"
          onClick={() =>
            recommendations[2] &&
            onPlay(recommendations[2])
          }
        >
          <span>🌙</span>
          <strong>Night Vibes</strong>
          <small>
            Ночные треки
          </small>
          <b>▶</b>
        </button>
      </section>

      <section className="fm-section">
        <SectionHeader
          title="Рекомендуем"
          subtitle="На основе твоей активности"
        />

        <div className="fm-card-grid">
          {recommendations.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlay={onPlay}
              onFavorite={onFavorite}
              isFavorite={favorites.includes(
                track.id
              )}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function PopularPage({
  tracks,
  currentTrack,
  isPlaying,
  favorites,
  onPlay,
  onFavorite,
}) {
  const sorted = [...tracks].sort(
    (a, b) =>
      Number(b.plays_count || 0) -
      Number(a.plays_count || 0)
  );

  return (
    <>
      <div className="fm-page-heading">
        <span className="fm-eyebrow">
          ТОП МУЗЫКИ
        </span>

        <h1>Популярное</h1>

        <p>
          Самые прослушиваемые треки Fenix Music.
        </p>
      </div>

      <section className="fm-section">
        <div className="fm-top-three">
          {sorted.slice(0, 3).map((track, index) => (
            <div
              className={`fm-top-card place-${index + 1}`}
              key={track.id}
            >
              <span className="fm-top-place">
                #{index + 1}
              </span>

              <Cover
                track={track}
                size="large"
                playing={
                  currentTrack?.id === track.id &&
                  isPlaying
                }
              />

              <div>
                <strong>{track.title}</strong>
                <span>
                  {track.artist_name ||
                    "Fenix Music"}
                </span>
                <small>
                  {formatNumber(
                    track.plays_count || 0
                  )}{" "}
                  прослушиваний
                </small>
              </div>

              <PlayButton
                track={track}
                active={
                  currentTrack?.id === track.id
                }
                playing={isPlaying}
                onPlay={onPlay}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="fm-section">
        <SectionHeader title="Чарт Fenix Music" />

        <div className="fm-track-list">
          {sorted.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlay={onPlay}
              onFavorite={onFavorite}
              isFavorite={favorites.includes(
                track.id
              )}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function NewPage({
  tracks,
  currentTrack,
  isPlaying,
  favorites,
  onPlay,
  onFavorite,
}) {
  return (
    <>
      <div className="fm-page-heading">
        <span className="fm-eyebrow">
          СВЕЖИЕ РЕЛИЗЫ
        </span>

        <h1>Новинки</h1>

        <p>
          Новые треки и свежие музыкальные находки.
        </p>
      </div>

      <section className="fm-new-release">
        <div className="fm-new-release-art">
          <Cover
            track={tracks[0]}
            size="huge"
            playing={
              currentTrack?.id === tracks[0]?.id &&
              isPlaying
            }
          />
        </div>

        <div className="fm-new-release-copy">
          <span>НОВЫЙ РЕЛИЗ</span>

          <h2>
            {tracks[0]?.title || "Fenix Music"}
          </h2>

          <p>
            {tracks[0]?.artist_name ||
              "Fenix Music"}
          </p>

          <button
            type="button"
            className="fm-primary-button"
            onClick={() =>
              tracks[0] && onPlay(tracks[0])
            }
          >
            ▶ Слушать
          </button>
        </div>
      </div>

      <section className="fm-section">
        <SectionHeader title="Свежие треки" />

        <div className="fm-card-grid">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlay={onPlay}
              onFavorite={onFavorite}
              isFavorite={favorites.includes(
                track.id
              )}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function MixesPage({
  tracks,
  onPlay,
}) {
  const mixes = [
    {
      title: "Night Drive",
      text: "Ночная поездка",
      icon: "🌙",
    },
    {
      title: "Energy",
      text: "Максимум энергии",
      icon: "⚡",
    },
    {
      title: "Chill",
      text: "Расслабленный вайб",
      icon: "☁",
    },
    {
      title: "Neon City",
      text: "Огни большого города",
      icon: "🌃",
    },
    {
      title: "Focus",
      text: "Концентрация",
      icon: "◉",
    },
    {
      title: "Late Night",
      text: "После полуночи",
      icon: "🌌",
    },
  ];

  return (
    <>
      <div className="fm-page-heading">
        <span className="fm-eyebrow">
          ПОДБОРКИ
        </span>

        <h1>Миксы</h1>

        <p>
          Готовые подборки под любое настроение.
        </p>
      </div>

      <div className="fm-mix-grid">
        {mixes.map((mix, index) => (
          <button
            type="button"
            className="fm-mix-card"
            key={mix.title}
            onClick={() =>
              tracks[index % tracks.length] &&
              onPlay(tracks[index % tracks.length])
            }
          >
            <div className="fm-mix-icon">
              {mix.icon}
            </div>

            <div>
              <strong>{mix.title}</strong>
              <span>{mix.text}</span>
            </div>

            <b>▶</b>
          </button>
        ))}
      </div>

      <section className="fm-section">
        <SectionHeader title="Твой микс" />

        <div className="fm-mix-player-card">
          <div className="fm-mix-art">
            <Cover
              track={tracks[0]}
              size="large"
            />
          </div>

          <div>
            <span>FENIX MIX</span>
            <h2>Музыка для тебя</h2>
            <p>
              Персональная подборка из лучших
              треков каталога.
            </p>

            <button
              type="button"
              className="fm-primary-button"
              onClick={() =>
                tracks[0] && onPlay(tracks[0])
              }
            >
              ▶ Запустить микс
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function LibraryPage({
  title,
  subtitle,
  tracks,
  currentTrack,
  isPlaying,
  favorites,
  onPlay,
  onFavorite,
}) {
  return (
    <>
      <div className="fm-page-heading">
        <span className="fm-eyebrow">
          ТВОЯ КОЛЛЕКЦИЯ
        </span>

        <h1>{title}</h1>

        <p>{subtitle}</p>
      </div>

      {tracks.length === 0 ? (
        <div className="fm-empty fm-large-empty">
          <div className="fm-empty-icon">
            {title === "Избранное" ? "♡" : "↶"}
          </div>

          <h3>
            {title === "Избранное"
              ? "Избранное пока пусто"
              : "История пока пуста"}
          </h3>

          <p>
            {title === "Избранное"
              ? "Нажимай на сердце возле треков, чтобы сохранить их здесь."
              : "Запусти музыку, и недавно прослушанные треки появятся здесь."}
          </p>
        </div>
      ) : (
        <section className="fm-section">
          <div className="fm-track-list">
            {tracks.map((track, index) => (
              <TrackRow
                key={`${track.id}-${index}`}
                track={track}
                index={index}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlay={onPlay}
                onFavorite={onFavorite}
                isFavorite={favorites.includes(
                  track.id
                )}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ProfilePage({
  user,
  onLogin,
  onLogout,
}) {
  if (!user) {
    return (
      <div className="fm-profile-login">
        <div className="fm-profile-login-icon">
          F
        </div>

        <h1>Твой профиль</h1>

        <p>
          Войди в аккаунт, чтобы сохранять
          коллекцию, историю и настройки.
        </p>

        <button
          type="button"
          className="fm-primary-button"
          onClick={onLogin}
        >
          Войти
        </button>
      </div>
    );
  }

  const username =
    user.username ||
    user.name ||
    "Fenix User";

  return (
    <div className="fm-profile-page">
      <div className="fm-profile-cover">
        <div className="fm-profile-avatar">
          {getInitials(username)}
        </div>
      </div>

      <div className="fm-profile-main">
        <span className="fm-eyebrow">
          ПРОФИЛЬ
        </span>

        <h1>{username}</h1>

        <p>
          {user.email || "Пользователь Fenix Music"}
        </p>

        <div className="fm-profile-stats">
          <div>
            <strong>Fenix</strong>
            <span>Аккаунт</span>
          </div>

          <div>
            <strong>Music</strong>
            <span>Коллекция</span>
          </div>

          <div>
            <strong>∞</strong>
            <span>Музыка</span>
          </div>
        </div>

        <button
          type="button"
          className="fm-danger-button"
          onClick={onLogout}
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

function SettingsPage({
  volume,
  setVolume,
}) {
  const [autoplay, setAutoplay] = useState(true);
  const [quality, setQuality] = useState("auto");
  const [notifications, setNotifications] =
    useState(true);

  return (
    <>
      <div className="fm-page-heading">
        <span className="fm-eyebrow">
          FENIX MUSIC
        </span>

        <h1>Настройки</h1>

        <p>
          Управление приложением и
          воспроизведением.
        </p>
      </div>

      <div className="fm-settings">
        <div className="fm-settings-group">
          <h3>Воспроизведение</h3>

          <label className="fm-setting-row">
            <div>
              <strong>
                Автоматическое воспроизведение
              </strong>
              <span>
                Продолжать очередь после окончания
                трека
              </span>
            </div>

            <input
              type="checkbox"
              checked={autoplay}
              onChange={(event) =>
                setAutoplay(event.target.checked)
              }
            />
          </label>

          <div className="fm-setting-row">
            <div>
              <strong>Качество музыки</strong>
              <span>
                Выбери качество аудио
              </span>
            </div>

            <select
              value={quality}
              onChange={(event) =>
                setQuality(event.target.value)
              }
            >
              <option value="auto">
                Автоматически
              </option>
              <option value="high">
                Высокое
              </option>
              <option value="medium">
                Среднее
              </option>
              <option value="low">
                Экономия трафика
              </option>
            </select>
          </div>

          <div className="fm-setting-row">
            <div>
              <strong>Громкость</strong>
              <span>
                Текущая громкость {volume}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) =>
                setVolume(Number(event.target.value))
              }
            />
          </div>
        </div>

        <div className="fm-settings-group">
          <h3>Уведомления</h3>

          <label className="fm-setting-row">
            <div>
              <strong>
                Новые релизы
              </strong>
              <span>
                Уведомлять о новых треках
              </span>
            </div>

            <input
              type="checkbox"
              checked={notifications}
              onChange={(event) =>
                setNotifications(
                  event.target.checked
                )
              }
            />
          </label>
        </div>

        <div className="fm-settings-about">
          <strong>Fenix Music</strong>
          <span>Версия 3.0</span>
          <small>
            Твоя музыкальная вселенная.
          </small>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] =
    useState("");

  const [currentTrack, setCurrentTrack] =
    useState(null);
  const [isPlaying, setIsPlaying] =
    useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);

  const [favorites, setFavorites] =
    useState([]);
  const [history, setHistory] =
    useState([]);

  const [queue, setQueue] = useState([]);
  const [shuffle, setShuffle] =
    useState(false);
  const [repeat, setRepeat] =
    useState(false);

  const [queueOpen, setQueueOpen] =
    useState(false);
  const [fullPlayerOpen, setFullPlayerOpen] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);
  const [search, setSearch] =
    useState("");

  const [authOpen, setAuthOpen] =
    useState(false);
  const [authMode, setAuthMode] =
    useState("login");
  const [authLoading, setAuthLoading] =
    useState(false);
  const [authError, setAuthError] =
    useState("");

  const [captcha, setCaptcha] =
    useState("");
  const [captchaId, setCaptchaId] =
    useState("");
  const [captchaInput, setCaptchaInput] =
    useState("");

  const [user, setUser] =
    useState(null);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const audioRef = useRef(null);

  const catalog = useMemo(() => {
    return tracks.length
      ? tracks
      : FALLBACK_TRACKS;
  }, [tracks]);

  const popularTracks = useMemo(() => {
    return [...catalog].sort(
      (a, b) =>
        Number(b.plays_count || 0) -
        Number(a.plays_count || 0)
    );
  }, [catalog]);

  const historyTracks = useMemo(() => {
    return history
      .map((id) =>
        catalog.find(
          (track) => track.id === id
        )
      )
      .filter(Boolean);
  }, [catalog, history]);

  const favoriteTracks = useMemo(() => {
    return catalog.filter((track) =>
      favorites.includes(track.id)
    );
  }, [catalog, favorites]);

  const currentIndex = currentTrack
    ? catalog.findIndex(
        (track) =>
          track.id === currentTrack.id
      )
    : -1;

  const loadMusic = useCallback(async () => {
    setLoading(true);
    setBackendError("");

    try {
      const data = await apiFetch("/api/music");

      if (Array.isArray(data.tracks)) {
        setTracks(data.tracks);
      } else {
        setTracks([]);
      }
    } catch (error) {
      setBackendError(
        error?.message ||
          "Backend музыки недоступен"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCaptcha = useCallback(async () => {
    setAuthError("");

    try {
      const data = await apiFetch(
        "/api/captcha"
      );

      if (
        data &&
        data.code !== undefined
      ) {
        setCaptcha(String(data.code));
        setCaptchaId(
          data.captcha_id
            ? String(data.captcha_id)
            : ""
        );
        setCaptchaInput("");
        return;
      }

      throw new Error(
        "CAPTCHA не получена"
      );
    } catch {
      setCaptcha(randomCaptcha());
      setCaptchaId("");
      setCaptchaInput("");
    }
  }, []);

  useEffect(() => {
    loadMusic();

    const savedFavorites =
      localStorage.getItem(
        "fenix_music_favorites"
      );

    const savedHistory =
      localStorage.getItem(
        "fenix_music_history"
      );

    const savedUser =
      localStorage.getItem(
        "fenix_music_user"
      );

    if (savedFavorites) {
      try {
        setFavorites(
          JSON.parse(savedFavorites)
        );
      } catch {
        setFavorites([]);
      }
    }

    if (savedHistory) {
      try {
        setHistory(
          JSON.parse(savedHistory)
        );
      } catch {
        setHistory([]);
      }
    }

    if (savedUser) {
      try {
        setUser(
          JSON.parse(savedUser)
        );
      } catch {
        setUser(null);
      }
    }
  }, [loadMusic]);

  useEffect(() => {
    localStorage.setItem(
      "fenix_music_favorites",
      JSON.stringify(favorites)
    );
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(
      "fenix_music_history",
      JSON.stringify(history)
    );
  }, [history]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.volume =
      volume / 100;
  }, [volume]);

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    if (!currentTrack.audio_url) {
      return;
    }

    const audio = audioRef.current;

    audio.src = apiUrl(
      currentTrack.audio_url
    );

    audio.load();

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    if (
      isPlaying &&
      currentTrack.audio_url
    ) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  function addHistory(track) {
    setHistory((previous) => {
      const next = [
        track.id,
        ...previous.filter(
          (id) => id !== track.id
        ),
      ];

      return next.slice(0, 50);
    });
  }

  function playTrack(track) {
    if (!track) {
      return;
    }

    setCurrentTrack(track);
    setProgress(0);
    setDuration(
      Number(track.duration) || 0
    );
    setIsPlaying(true);
    addHistory(track);

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
  }

  function togglePlayback() {
    if (!currentTrack) {
      if (catalog[0]) {
        playTrack(catalog[0]);
      }

      return;
    }

    if (
      !currentTrack.audio_url &&
      !isPlaying
    ) {
      setIsPlaying(true);
      return;
    }

    setIsPlaying((value) => !value);
  }

  function chooseNextTrack() {
    if (!catalog.length) {
      return;
    }

    if (repeat && currentTrack) {
      setProgress(0);
      setIsPlaying(true);

      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }

      return;
    }

    let nextIndex = 0;

    if (shuffle) {
      if (catalog.length === 1) {
        nextIndex = 0;
      } else {
        do {
          nextIndex = Math.floor(
            Math.random() *
              catalog.length
          );
        } while (
          nextIndex === currentIndex
        );
      }
    } else if (currentIndex >= 0) {
      nextIndex =
        (currentIndex + 1) %
        catalog.length;
    }

    playTrack(catalog[nextIndex]);
  }

  function choosePreviousTrack() {
    if (!catalog.length) {
      return;
    }

    if (
      audioRef.current &&
      audioRef.current.currentTime > 5
    ) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      return;
    }

    let previousIndex;

    if (currentIndex <= 0) {
      previousIndex =
        catalog.length - 1;
    } else {
      previousIndex = currentIndex - 1;
    }

    playTrack(catalog[previousIndex]);
  }

  function toggleFavorite(track) {
    if (!track) {
      return;
    }

    setFavorites((previous) => {
      if (previous.includes(track.id)) {
        return previous.filter(
          (id) => id !== track.id
        );
      }

      return [...previous, track.id];
    });
  }

  function isFavorite(track) {
    return favorites.includes(track.id);
  }

  function addToQueue(track) {
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
  }

  function removeFromQueue(track) {
    setQueue((previous) =>
      previous.filter(
        (item) => item.id !== track.id
      )
    );
  }

  function openLogin() {
    setAuthMode("login");
    setAuthError("");
    setAuthOpen(true);
    loadCaptcha();
  }

  function openRegister() {
    setAuthMode("register");
    setAuthError("");
    setAuthOpen(true);
    loadCaptcha();
  }

  async function submitAuth(values) {
    setAuthLoading(true);
    setAuthError("");

    if (
      String(values.captcha) !==
      String(captcha)
    ) {
      setAuthError(
        "Неверная CAPTCHA. Обновите код."
      );

      setCaptchaInput("");
      setCaptcha(randomCaptcha());
      setAuthLoading(false);
      return;
    }

    try {
      const endpoint =
        authMode === "register"
          ? "/api/auth/register"
          : "/api/auth/login";

      const payload = {
        email: values.email,
        password: values.password,
        captcha: values.captcha,
        captcha_id: captchaId,
      };

      if (authMode === "register") {
        payload.username =
          values.username;
      }

      const data = await apiFetch(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload
          ),
        }
      );

      const account =
        data.user ||
        data.profile ||
        data.account ||
        data;

      if (account) {
        setUser(account);

        localStorage.setItem(
          "fenix_music_user",
          JSON.stringify(account)
        );
      }

      setAuthOpen(false);
      setCaptchaInput("");
    } catch (error) {
      setAuthError(
        error?.message ||
          "Не удалось выполнить вход"
      );

      await loadCaptcha();
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(
      "fenix_music_user"
    );
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setSidebarOpen(false);
    setQueueOpen(false);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleAudioTimeUpdate(event) {
    const audio = event.currentTarget;

    setProgress(audio.currentTime);

    if (
      Number.isFinite(audio.duration) &&
      audio.duration > 0
    ) {
      setDuration(audio.duration);
    }
  }

  function handleAudioLoaded(event) {
    const value =
      event.currentTarget.duration;

    if (
      Number.isFinite(value) &&
      value > 0
    ) {
      setDuration(value);
    }
  }

  function handleAudioEnded() {
    if (repeat) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(
          () => {}
        );
      }

      setProgress(0);
      return;
    }

    chooseNextTrack();
  }

  function seek(value) {
    setProgress(value);

    if (audioRef.current) {
      audioRef.current.currentTime =
        value;
    }
  }

  function renderPage() {
    if (page === "for-you") {
      return (
        <ForYouPage
          tracks={catalog}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          favorites={favorites}
          onPlay={playTrack}
          onFavorite={toggleFavorite}
          goTo={navigate}
        />
      );
    }

    if (page === "new") {
      return (
        <NewPage
          tracks={catalog}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          favorites={favorites}
          onPlay={playTrack}
          onFavorite={toggleFavorite}
        />
      );
    }

    if (page === "popular") {
      return (
        <PopularPage
          tracks={catalog}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          favorites={favorites}
          onPlay={playTrack}
          onFavorite={toggleFavorite}
        />
      );
    }

    if (page === "mixes") {
      return (
        <MixesPage
          tracks={catalog}
          onPlay={playTrack}
        />
      );
    }

    if (page === "history") {
      return (
        <LibraryPage
          title="История"
          subtitle="Недавно прослушанные треки"
          tracks={historyTracks}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          favorites={favorites}
          onPlay={playTrack}
          onFavorite={toggleFavorite}
        />
      );
    }

    if (page === "favorites") {
      return (
        <LibraryPage
          title="Избранное"
          subtitle="Треки, которые ты сохранил"
          tracks={favoriteTracks}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          favorites={favorites}
          onPlay={playTrack}
          onFavorite={toggleFavorite}
        />
      );
    }

    if (page === "profile") {
      return (
        <ProfilePage
          user={user}
          onLogin={openLogin}
          onLogout={logout}
        />
      );
    }

    if (page === "settings") {
      return (
        <SettingsPage
          volume={volume}
          setVolume={setVolume}
        />
      );
    }

    return (
      <HomePage
        tracks={catalog}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        favorites={favorites}
        historyTracks={historyTracks}
        popularTracks={popularTracks}
        onPlay={playTrack}
        onFavorite={toggleFavorite}
        goTo={navigate}
      />
    );
  }

  return (
    <div className="fm-app">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioLoaded}
        onEnded={handleAudioEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <aside
        className={`fm-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="fm-sidebar-brand">
          <button
            type="button"
            onClick={() => navigate("home")}
            className="fm-brand-button"
          >
            <div className="fm-brand-logo">
              F
            </div>

            <div className="fm-brand-text">
              <strong>FENIX</strong>
              <span>MUSIC</span>
            </div>
          </button>
        </div>

        <div className="fm-sidebar-label">
          МУЗЫКА
        </div>

        <nav className="fm-sidebar-nav">
          {NAVIGATION.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`fm-nav-item ${
                page === item.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                navigate(item.id)
              }
            >
              <span>{item.icon}</span>
              <strong>{item.title}</strong>
            </button>
          ))}
        </nav>

        <div className="fm-sidebar-label">
          ТВОЯ МУЗЫКА
        </div>

        <nav className="fm-sidebar-nav">
          {LIBRARY_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`fm-nav-item ${
                page === item.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                navigate(item.id)
              }
            >
              <span>{item.icon}</span>
              <strong>{item.title}</strong>
            </button>
          ))}
        </nav>

        <div className="fm-sidebar-spacer" />

        <button
          type="button"
          className="fm-premium-card"
          onClick={() =>
            navigate("for-you")
          }
        >
          <span>✦</span>
          <strong>Fenix Premium</strong>
          <small>
            Больше музыки и возможностей
          </small>
        </button>

        <div className="fm-sidebar-account">
          {user ? (
            <button
              type="button"
              className="fm-account-button"
              onClick={() =>
                navigate("profile")
              }
            >
              <div className="fm-avatar">
                {getInitials(
                  user.username ||
                    user.name ||
                    user.email
                )}
              </div>

              <div>
                <strong>
                  {user.username ||
                    user.name ||
                    "Пользователь"}
                </strong>
                <span>Профиль</span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              className="fm-login-sidebar"
              onClick={openLogin}
            >
              <span>↪</span>
              <div>
                <strong>Войти</strong>
                <small>
                  Синхронизировать музыку
                </small>
              </div>
            </button>
          )}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="fm-mobile-backdrop"
          onClick={() =>
            setSidebarOpen(false)
          }
          aria-label="Закрыть меню"
        />
      ) : null}

      <main className="fm-main">
        <header className="fm-header">
          <button
            type="button"
            className="fm-mobile-menu"
            onClick={() =>
              setSidebarOpen(
                (value) => !value
              )
            }
          >
            ☰
          </button>

          <div className="fm-header-search">
            <button
              type="button"
              onClick={() =>
                setSearchOpen(true)
              }
            >
              <span>⌕</span>
              <span>
                {search ||
                  "Поиск музыки, артистов и альбомов"}
              </span>
            </button>
          </div>

          <div className="fm-header-actions">
            <button
              type="button"
              className="fm-header-icon"
              onClick={() =>
                navigate("history")
              }
              title="История"
            >
              ↶
            </button>

            <button
              type="button"
              className="fm-header-icon"
              onClick={() =>
                navigate("favorites")
              }
              title="Избранное"
            >
              ♡
            </button>

            {user ? (
              <button
                type="button"
                className="fm-header-avatar"
                onClick={() =>
                  navigate("profile")
                }
              >
                {getInitials(
                  user.username ||
                    user.name ||
                    user.email
                )}
              </button>
            ) : (
              <button
                type="button"
                className="fm-header-login"
                onClick={openLogin}
              >
                Войти
              </button>
            )}
          </div>
        </header>

        {backendError ? (
          <div className="fm-backend-notice">
            <div>
              <strong>
                Музыкальный сервер
              </strong>

              <span>
                {backendError}
              </span>
            </div>

            <button
              type="button"
              onClick={loadMusic}
            >
              Повторить
            </button>
          </div>
        ) : null}

        <div className="fm-content">
          {loading && tracks.length === 0 ? (
            <div className="fm-loading-screen">
              <div className="fm-loading-logo">
                F
              </div>

              <div className="fm-spinner" />

              <span>
                Загружаем Fenix Music...
              </span>
            </div>
          ) : (
            renderPage()
          )}
        </div>
      </main>

      <QueuePanel
        open={queueOpen}
        queue={queue}
        currentTrack={currentTrack}
        onPlay={playTrack}
        onRemove={removeFromQueue}
        onClose={() =>
          setQueueOpen(false)
        }
      />

      <PlayerBar
        track={currentTrack}
        isPlaying={isPlaying}
        progress={progress}
        duration={duration}
        volume={volume}
        shuffle={shuffle}
        repeat={repeat}
        favorite={
          currentTrack
            ? favorites.includes(
                currentTrack.id
              )
            : false
        }
        queueOpen={queueOpen}
        onToggle={togglePlayback}
        onPrevious={
          choosePreviousTrack
        }
        onNext={chooseNextTrack}
        onSeek={seek}
        onVolume={setVolume}
        onShuffle={() =>
          setShuffle(
            (value) => !value
          )
        }
        onRepeat={() =>
          setRepeat(
            (value) => !value
          )
        }
        onFavorite={() =>
          currentTrack &&
          toggleFavorite(currentTrack)
        }
        onQueue={() =>
          setQueueOpen(
            (value) => !value
          )
        }
        onFullPlayer={() =>
          setFullPlayerOpen(true)
        }
      />

      <FullPlayer
        open={fullPlayerOpen}
        track={currentTrack}
        isPlaying={isPlaying}
        progress={progress}
        duration={duration}
        volume={volume}
        shuffle={shuffle}
        repeat={repeat}
        favorite={
          currentTrack
            ? favorites.includes(
                currentTrack.id
              )
            : false
        }
        onClose={() =>
          setFullPlayerOpen(false)
        }
        onToggle={togglePlayback}
        onPrevious={
          choosePreviousTrack
        }
        onNext={chooseNextTrack}
        onSeek={seek}
        onVolume={setVolume}
        onShuffle={() =>
          setShuffle(
            (value) => !value
          )
        }
        onRepeat={() =>
          setRepeat(
            (value) => !value
          )
        }
        onFavorite={() =>
          currentTrack &&
          toggleFavorite(currentTrack)
        }
      />

      <SearchOverlay
        open={searchOpen}
        query={search}
        setQuery={setSearch}
        tracks={catalog}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlay={playTrack}
        onFavorite={toggleFavorite}
        isFavorite={isFavorite}
        onClose={() =>
          setSearchOpen(false)
        }
      />

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() =>
          setAuthOpen(false)
        }
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError("");
          loadCaptcha();
        }}
        onSubmit={submitAuth}
        loading={authLoading}
        error={authError}
        captcha={captcha}
        captchaInput={captchaInput}
        setCaptchaInput={setCaptchaInput}
        refreshCaptcha={loadCaptcha}
      />

      <footer className="fm-footer">
        <span>FENIX MUSIC</span>
        <span>Музыка. Твой мир.</span>

        <button
          type="button"
          onClick={() =>
            navigate("settings")
          }
        >
          ⚙ Настройки
        </button>
      </footer>
    </div>
  );
}
