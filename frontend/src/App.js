import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./App.css";

/*
============================================================
 FENIX MUSIC
 Финальный App.js
 Без lucide-react.
 Один audio element.
 React 18/19 compatible.
============================================================
*/

const API = (
  process.env.REACT_APP_API_URL ||
  process.env.PUBLIC_API_URL ||
  ""
).replace(/\/+$/, "");

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

/* ============================================================
   ICONS
============================================================ */

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
    <span
      className={`fenix-icon ${className}`}
      aria-hidden="true"
    >
      {ICONS[name] || "•"}
    </span>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function formatTime(value) {
  const seconds = Math.max(
    0,
    Math.floor(Number(value) || 0)
  );

  const minutes = Math.floor(seconds / 60);
  const secondsPart = String(seconds % 60).padStart(
    2,
    "0"
  );

  return `${minutes}:${secondsPart}`;
}

function apiUrl(path) {
  if (!path) return API;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API}${path.startsWith("/") ? path : `/${path}`}`;
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
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {
    // localStorage может быть недоступен.
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function randomCaptcha() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

function normalizeTrack(track = {}) {
  return {
    ...track,

    id:
      track.id ??
      track.track_id ??
      track._id ??
      Math.random().toString(36),

    title:
      track.title ||
      track.name ||
      "Без названия",

    artist_name:
      track.artist_name ||
      track.artist ||
      track.author ||
      track.performer ||
      "Неизвестный артист",

    album_name:
      track.album_name ||
      track.album ||
      "Без альбома",

    genre:
      track.genre ||
      "Music",

    duration:
      Number(
        track.duration ||
        track.duration_seconds ||
        0
      ),

    plays:
      Number(
        track.plays ||
        track.play_count ||
        track.listen_count ||
        0
      ),

    cover_url:
      track.cover_url ||
      track.cover ||
      track.album_cover_url ||
      track.thumbnail ||
      DEFAULT_COVER,

    audio_url:
      track.audio_url ||
      track.stream_url ||
      track.streamUrl ||
      track.audio ||
      track.url ||
      "",
  };
}

function normalizeTrackList(data) {
  let list = [];

  if (Array.isArray(data)) {
    list = data;
  } else if (Array.isArray(data?.tracks)) {
    list = data.tracks;
  } else if (Array.isArray(data?.items)) {
    list = data.items;
  } else if (Array.isArray(data?.results)) {
    list = data.results;
  } else if (Array.isArray(data?.data)) {
    list = data.data;
  }

  return list.map(normalizeTrack);
}

async function requestJSON(
  path,
  options = {}
) {
  const token =
    localStorage.getItem("fenix_token");

  const headers = {
    ...(options.headers || {}),
  };

  if (
    options.body &&
    typeof options.body !== "string"
  ) {
    headers["Content-Type"] =
      "application/json";

    options = {
      ...options,
      body: JSON.stringify(
        options.body
      ),
    };
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    apiUrl(path),
    {
      ...options,
      headers,
      credentials: "include",
    }
  );

  const text =
    await response.text();

  let data = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`
    );

    error.status =
      response.status;

    throw error;
  }

  return data;
}

/* ============================================================
   APP
============================================================ */

export default function App() {
  const audioRef = useRef(null);

  const positionSaveTimer =
    useRef(null);

  const [page, setPage] =
    useState("home");

  const [tracks, setTracks] =
    useState([]);

  const [loadingTracks, setLoadingTracks] =
    useState(true);

  const [apiError, setApiError] =
    useState("");

  const [currentTrack, setCurrentTrack] =
    useState(null);

  const [playing, setPlaying] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [position, setPosition] =
    useState(0);

  const [duration, setDuration] =
    useState(0);

  const [volume, setVolume] =
    useState(() => {
      const stored =
        Number(
          localStorage.getItem(
            "fenix_volume"
          )
        );

      if (
        Number.isFinite(stored) &&
        stored >= 0 &&
        stored <= 1
      ) {
        return stored;
      }

      return 0.8;
    });

  const [shuffle, setShuffle] =
    useState(() =>
      readStorage(
        "fenix_shuffle",
        false
      )
    );

  const [repeat, setRepeat] =
    useState(() =>
      readStorage(
        "fenix_repeat",
        "off"
      )
    );

  const [queue, setQueue] =
    useState(() =>
      readStorage(
        "fenix_queue",
        []
      )
    );

  const [queueOpen, setQueueOpen] =
    useState(false);

  const [fullPlayer, setFullPlayer] =
    useState(false);

  const [favorites, setFavorites] =
    useState(() =>
      readStorage(
        "fenix_favorites",
        []
      )
    );

  const [history, setHistory] =
    useState(() =>
      readStorage(
        "fenix_history",
        []
      )
    );

  const [playlists, setPlaylists] =
    useState(() =>
      readStorage(
        "fenix_playlists",
        []
      )
    );

  const [notifications, setNotifications] =
    useState(() =>
      readStorage(
        "fenix_notifications",
        []
      )
    );

  const [settings, setSettings] =
    useState(() =>
      readStorage(
        "fenix_settings",
        {
          theme: "dark",
          quality: "high",
          autoplay: true,
          autoNext: true,
          notifications: true,
          language: "ru",
        }
      )
    );

  const [user, setUser] =
    useState(() =>
      readStorage(
        "fenix_user",
        null
      )
    );

  const [authOpen, setAuthOpen] =
    useState(false);

  const [authMode, setAuthMode] =
    useState("login");

  const [mobileMenu, setMobileMenu] =
    useState(false);

  const [toast, setToast] =
    useState(null);

  /* ==========================================================
     TOAST
  ========================================================== */

  const showToast = useCallback(
    (message, type = "info") => {
      setToast({
        id: Date.now(),
        message,
        type,
      });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 3200);

    return () =>
      clearTimeout(timer);
  }, [toast]);

  /* ==========================================================
     STORAGE
  ========================================================== */

  useEffect(() => {
    saveStorage(
      "fenix_user",
      user
    );
  }, [user]);

  useEffect(() => {
    saveStorage(
      "fenix_favorites",
      favorites
    );
  }, [favorites]);

  useEffect(() => {
    saveStorage(
      "fenix_history",
      history
    );
  }, [history]);

  useEffect(() => {
    saveStorage(
      "fenix_playlists",
      playlists
    );
  }, [playlists]);

  useEffect(() => {
    saveStorage(
      "fenix_notifications",
      notifications
    );
  }, [notifications]);

  useEffect(() => {
    saveStorage(
      "fenix_settings",
      settings
    );
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(
      "fenix_volume",
      String(volume)
    );
  }, [volume]);

  useEffect(() => {
    saveStorage(
      "fenix_shuffle",
      shuffle
    );
  }, [shuffle]);

  useEffect(() => {
    saveStorage(
      "fenix_repeat",
      repeat
    );
  }, [repeat]);

  useEffect(() => {
    saveStorage(
      "fenix_queue",
      queue
    );
  }, [queue]);

  /* ==========================================================
     LOAD SESSION
  ========================================================== */

  useEffect(() => {
    const token =
      localStorage.getItem(
        "fenix_token"
      );

    if (!token) {
      return;
    }

    const checkSession =
      async () => {
        try {
          const data =
            await requestJSON(
              "/api/auth/me"
            );

          const account =
            data.user ||
            data.account ||
            data;

          if (
            account &&
            (
              account.id ||
              account.user_id ||
              account.username ||
              account.email
            )
          ) {
            setUser(account);
          }
        } catch {
          /*
           Не удаляем токен мгновенно:
           backend может не иметь /api/auth/me.
          */
        }
      };

    checkSession();
  }, []);

  /* ==========================================================
     LOAD TRACKS
  ========================================================== */

  const loadTracks =
    useCallback(
      async (
        silent = false
      ) => {
        if (!silent) {
          setLoadingTracks(true);
        }

        try {
          setApiError("");

          const candidates = [
            "/api/tracks",
            "/tracks",
          ];

          let result = null;
          let lastError = null;

          for (
            const endpoint of candidates
          ) {
            try {
              result =
                await requestJSON(
                  endpoint
                );

              break;
            } catch (error) {
              lastError = error;
            }
          }

          if (!result) {
            throw (
              lastError ||
              new Error(
                "API недоступен"
              )
            );
          }

          const list =
            normalizeTrackList(
              result
            );

          setTracks(
            list.length
              ? list
              : DEMO_TRACKS
          );
        } catch {
          setTracks(
            previous =>
              previous.length
                ? previous
                : DEMO_TRACKS
          );

          setApiError(
            "API музыки временно недоступен. Показана локальная библиотека."
          );
        } finally {
          setLoadingTracks(false);
        }
      },
      []
    );

  useEffect(() => {
    loadTracks();

    const timer =
      setInterval(() => {
        loadTracks(true);
      }, 10000);

    return () =>
      clearInterval(timer);
  }, [loadTracks]);

  /* ==========================================================
     VOLUME
  ========================================================== */

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.volume =
      Math.max(
        0,
        Math.min(1, volume)
      );
  }, [volume]);

  /* ==========================================================
     RESTORE LAST TRACK
  ========================================================== */

  useEffect(() => {
    const saved =
      readStorage(
        "fenix_current_track",
        null
      );

    if (!saved) {
      return;
    }

    setCurrentTrack(
      normalizeTrack(saved)
    );

    const savedPosition =
      Number(
        localStorage.getItem(
          "fenix_current_position"
        ) || 0
      );

    if (
      Number.isFinite(
        savedPosition
      )
    ) {
      setPosition(
        savedPosition
      );
    }
  }, []);

  /* ==========================================================
     AUDIO SOURCE
  ========================================================== */

  useEffect(() => {
    const audio =
      audioRef.current;

    if (
      !audio ||
      !currentTrack
    ) {
      return;
    }

    let source =
      currentTrack.audio_url;

    if (!source) {
      source =
        apiUrl(
          `/api/tracks/${encodeURIComponent(
            currentTrack.id
          )}/audio`
        );
    }

    if (!source) {
      setPlaying(false);
      return;
    }

    const absoluteSource =
      /^https?:\/\//i.test(
        source
      )
        ? source
        : apiUrl(source);

    if (
      audio.dataset.source !==
      absoluteSource
    ) {
      audio.dataset.source =
        absoluteSource;

      audio.src =
        absoluteSource;

      audio.load();

      const savedTrack =
        readStorage(
          "fenix_current_track",
          null
        );

      const savedPosition =
        Number(
          localStorage.getItem(
            "fenix_current_position"
          ) || 0
        );

      if (
        savedTrack &&
        String(savedTrack.id) ===
          String(currentTrack.id) &&
        savedPosition > 0
      ) {
        const restore =
          () => {
            try {
              if (
                Number.isFinite(
                  audio.duration
                ) &&
                savedPosition <
                  audio.duration
              ) {
                audio.currentTime =
                  savedPosition;
                setPosition(
                  savedPosition
                );
              }
            } catch {
              // ignore
            }
          };

        audio.addEventListener(
          "loadedmetadata",
          restore,
          { once: true }
        );
      }
    }

    if (playing) {
      audio
        .play()
        .catch(() => {
          setPlaying(false);
        });
    } else {
      audio.pause();
    }
  }, [
    currentTrack,
    playing,
  ]);

  /* ==========================================================
     CURRENT TRACK STORAGE
  ========================================================== */

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    saveStorage(
      "fenix_current_track",
      currentTrack
    );
  }, [currentTrack]);

  /* ==========================================================
     POSITION STORAGE
  ========================================================== */

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    if (positionSaveTimer.current) {
      clearTimeout(
        positionSaveTimer.current
      );
    }

    positionSaveTimer.current =
      setTimeout(() => {
        localStorage.setItem(
          "fenix_current_position",
          String(position)
        );
      }, 300);

    return () => {
      if (
        positionSaveTimer.current
      ) {
        clearTimeout(
          positionSaveTimer.current
        );
      }
    };
  }, [
    position,
    currentTrack,
  ]);

  /* ==========================================================
     PLAY TRACK
  ========================================================== */

  const playTrack =
    useCallback(
      (
        track,
        list = tracks
      ) => {
        const normalized =
          normalizeTrack(track);

        setCurrentTrack(
          normalized
        );

        setPlaying(true);

        const normalizedList =
          list?.length
            ? list.map(
                normalizeTrack
              )
            : [normalized];

        setQueue(
          normalizedList
        );

        setPosition(0);

        setDuration(
          Number(
            normalized.duration ||
              0
          )
        );

        setHistory(previous => {
          const cleaned =
            previous.filter(
              item =>
                String(
                  item.id
                ) !==
                String(
                  normalized.id
                )
            );

          return [
            {
              ...normalized,
              played_at:
                Date.now(),
            },
            ...cleaned,
          ].slice(0, 100);
        });

        localStorage.setItem(
          "fenix_current_position",
          "0"
        );
      },
      [tracks]
    );

  /* ==========================================================
     NEXT
  ========================================================== */

  const nextTrack =
    useCallback(() => {
      if (!currentTrack) {
        return;
      }

      const list =
        queue.length
          ? queue
          : tracks;

      if (!list.length) {
        return;
      }

      if (repeat === "one") {
        const audio =
          audioRef.current;

        if (audio) {
          audio.currentTime = 0;

          audio
            .play()
            .catch(() => {});
        }

        setPlaying(true);
        return;
      }

      let index =
        list.findIndex(
          item =>
            String(item.id) ===
            String(
              currentTrack.id
            )
        );

      if (index < 0) {
        index = 0;
      }

      if (shuffle) {
        if (list.length > 1) {
          let next =
            Math.floor(
              Math.random() *
                list.length
            );

          if (
            next === index
          ) {
            next =
              (next + 1) %
              list.length;
          }

          index = next;
        }
      } else {
        index += 1;
      }

      if (
        index >=
        list.length
      ) {
        if (
          repeat === "all"
        ) {
          index = 0;
        } else {
          setPlaying(false);
          return;
        }
      }

      const next =
        normalizeTrack(
          list[index]
        );

      setCurrentTrack(next);
      setPosition(0);
      setDuration(
        Number(
          next.duration || 0
        )
      );
      setPlaying(true);

      setHistory(previous => {
        const cleaned =
          previous.filter(
            item =>
              String(item.id) !==
              String(next.id)
          );

        return [
          {
            ...next,
            played_at:
              Date.now(),
          },
          ...cleaned,
        ].slice(0, 100);
      });

      localStorage.setItem(
        "fenix_current_position",
        "0"
      );
    }, [
      currentTrack,
      queue,
      tracks,
      repeat,
      shuffle,
    ]);

  /* ==========================================================
     PREVIOUS
  ========================================================== */

  const previousTrack =
    useCallback(() => {
      const audio =
        audioRef.current;

      if (
        audio &&
        audio.currentTime > 5
      ) {
        audio.currentTime = 0;
        setPosition(0);
        return;
      }

      const list =
        queue.length
          ? queue
          : tracks;

      if (!list.length) {
        return;
      }

      let index =
        list.findIndex(
          item =>
            String(item.id) ===
            String(
              currentTrack?.id
            )
        );

      if (index < 0) {
        index = 0;
      }

      index -= 1;

      if (index < 0) {
        index =
          list.length - 1;
      }

      const previous =
        normalizeTrack(
          list[index]
        );

      setCurrentTrack(
        previous
      );

      setPosition(0);

      setDuration(
        Number(
          previous.duration || 0
        )
      );

      setPlaying(true);
    }, [
      queue,
      tracks,
      currentTrack,
    ]);

  /* ==========================================================
     PLAY / PAUSE
  ========================================================== */

  const togglePlaying =
    useCallback(() => {
      if (!currentTrack) {
        if (tracks[0]) {
          playTrack(
            tracks[0],
            tracks
          );
        }

        return;
      }

      setPlaying(
        value => !value
      );
    }, [
      currentTrack,
      tracks,
      playTrack,
    ]);

  /* ==========================================================
     SEEK
  ========================================================== */

  const seek = useCallback(
    event => {
      const value =
        Number(
          event.target.value
        );

      const audio =
        audioRef.current;

      if (
        !audio ||
        !Number.isFinite(
          audio.duration
        ) ||
        audio.duration <= 0
      ) {
        return;
      }

      const nextPosition =
        value *
        audio.duration;

      audio.currentTime =
        nextPosition;

      setPosition(
        nextPosition
      );
    },
    []
  );

  /* ==========================================================
     AUDIO EVENTS
  ========================================================== */

  const handleTimeUpdate =
    () => {
      const audio =
        audioRef.current;

      if (!audio) {
        return;
      }

      setPosition(
        audio.currentTime || 0
      );
    };

  const handleLoadedMetadata =
    () => {
      const audio =
        audioRef.current;

      if (!audio) {
        return;
      }

      const value =
        Number(
          audio.duration ||
            currentTrack?.duration ||
            0
        );

      setDuration(value);
    };

  const handleEnded = () => {
    if (
      repeat === "one"
    ) {
      const audio =
        audioRef.current;

      if (audio) {
        audio.currentTime = 0;

        audio
          .play()
          .catch(() => {});
      }

      setPlaying(true);
      return;
    }

    if (settings.autoNext) {
      nextTrack();
    } else {
      setPlaying(false);
    }
  };

  /* ==========================================================
     FAVORITES
  ========================================================== */

  const isFavorite =
    useCallback(
      track => {
        if (!track) {
          return false;
        }

        return favorites.some(
          item =>
            String(item.id) ===
            String(track.id)
        );
      },
      [favorites]
    );

  const toggleFavorite =
    useCallback(
      async track => {
        const normalized =
          normalizeTrack(
            track
          );

        const exists =
          favorites.some(
            item =>
              String(item.id) ===
              String(
                normalized.id
              )
          );

        setFavorites(
          previous => {
            if (exists) {
              return previous.filter(
                item =>
                  String(
                    item.id
                  ) !==
                  String(
                    normalized.id
                  )
              );
            }

            return [
              normalized,
              ...previous,
            ];
          }
        );

        showToast(
          exists
            ? "Удалено из избранного"
            : "Добавлено в избранное",
          "success"
        );

        const token =
          localStorage.getItem(
            "fenix_token"
          );

        if (!token) {
          return;
        }

        try {
          if (exists) {
            await requestJSON(
              `/api/favorites/${encodeURIComponent(
                normalized.id
              )}`,
              {
                method: "DELETE",
              }
            );
          } else {
            await requestJSON(
              "/api/favorites",
              {
                method: "POST",
                body: {
                  track_id:
                    normalized.id,
                },
              }
            );
          }
        } catch {
          // Локальное состояние сохраняется,
          // даже если endpoint отсутствует.
        }
      },
      [
        favorites,
        showToast,
      ]
    );

  /* ==========================================================
     SEARCH
  ========================================================== */

  const filteredTracks =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return tracks;
      }

      return tracks.filter(
        track => {
          const text = [
            track.title,
            track.artist_name,
            track.album_name,
            track.genre,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return text.includes(
            query
          );
        }
      );
    }, [
      tracks,
      search,
    ]);

  /* ==========================================================
     LOGOUT
  ========================================================== */

  const logout = useCallback(
    async () => {
      try {
        await requestJSON(
          "/api/auth/logout",
          {
            method: "POST",
          }
        );
      } catch {
        // backend endpoint может отсутствовать
      }

      removeStorage(
        "fenix_token"
      );

      removeStorage(
        "fenix_user"
      );

      setUser(null);
      setPage("home");

      showToast(
        "Вы вышли из аккаунта",
        "success"
      );
    },
    [showToast]
  );

  /* ==========================================================
     PAGE NAVIGATION
  ========================================================== */

  const navigate = useCallback(
    nextPage => {
      setPage(nextPage);
      setMobileMenu(false);
    },
    []
  );

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div
      className={`fenix-app theme-${settings.theme}`}
    >
      {/* ======================================================
          SINGLE AUDIO ELEMENT
      ====================================================== */}

      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={
          handleTimeUpdate
        }
        onLoadedMetadata={
          handleLoadedMetadata
        }
        onEnded={handleEnded}
        onPlay={() =>
          setPlaying(true)
        }
        onPause={() =>
          setPlaying(false)
        }
        onError={() => {
          setPlaying(false);

          if (
            currentTrack?.audio_url
          ) {
            showToast(
              "Не удалось загрузить аудиофайл",
              "error"
            );
          }
        }}
      />

      <Toast toast={toast} />

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className={`sidebar ${
          mobileMenu
            ? "sidebar-open"
            : ""
        }`}
      >
        <div className="brand">
          <div className="brand-logo">
            FX
          </div>

          <div className="brand-text">
            <strong>
              FENIX MUSIC
            </strong>

            <small>
              HI-RES STREAMING
            </small>
          </div>

          <button
            className="sidebar-close"
            onClick={() =>
              setMobileMenu(false)
            }
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="nav-group">
          <span className="nav-label">
            Меню
          </span>

          <NavItem
            icon="home"
            label="Главная"
            active={
              page === "home"
            }
            onClick={() =>
              navigate("home")
            }
          />

          <NavItem
            icon="search"
            label="Поиск"
            active={
              page === "search"
            }
            onClick={() =>
              navigate("search")
            }
          />

          <NavItem
            icon="radio"
            label="Рекомендации"
            active={
              page ===
              "recommendations"
            }
            onClick={() =>
              navigate(
                "recommendations"
              )
            }
          />
        </div>

        <div className="nav-group">
          <span className="nav-label">
            Медиатека
          </span>

          <NavItem
            icon="library"
            label="Библиотека"
            active={
              page === "library"
            }
            onClick={() =>
              navigate("library")
            }
          />

          <NavItem
            icon="heart"
            label="Избранное"
            active={
              page ===
              "favorites"
            }
            badge={
              favorites.length
            }
            onClick={() =>
              navigate(
                "favorites"
              )
            }
          />

          <NavItem
            icon="clock"
            label="История"
            active={
              page === "history"
            }
            onClick={() =>
              navigate("history")
            }
          />

          <NavItem
            icon="music"
            label="Плейлисты"
            active={
              page ===
              "playlists"
            }
            onClick={() =>
              navigate(
                "playlists"
              )
            }
          />

          <NavItem
            icon="album"
            label="Альбомы"
            active={
              page === "albums"
            }
            onClick={() =>
              navigate("albums")
            }
          />

          <NavItem
            icon="user"
            label="Артисты"
            active={
              page === "artists"
            }
            onClick={() =>
              navigate("artists")
            }
          />
        </div>

        <div className="sidebar-bottom">
          <button
            className="premium-side"
            onClick={() =>
              navigate("premium")
            }
          >
            <Icon name="crown" />
            <span>
              Fenix Premium
            </span>
          </button>

          <button
            className="sidebar-account"
            onClick={() =>
              navigate(
                user
                  ? "profile"
                  : "login"
              )
            }
          >
            <div className="mini-avatar">
              {(
                user?.username ||
                "FX"
              )
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <span>
              <b>
                {user?.username ||
                  "Гость"}
              </b>

              <small>
                {user
                  ? "Открыть профиль"
                  : "Войти в аккаунт"}
              </small>
            </span>
          </button>

          <button
            className="settings-side"
            onClick={() =>
              navigate(
                "settings"
              )
            }
          >
            <Icon name="settings" />
            Настройки
          </button>
        </div>
      </aside>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenu(
                value => !value
              )
            }
          >
            <Icon
              name={
                mobileMenu
                  ? "close"
                  : "menu"
              }
            />
          </button>

          <div className="mobile-brand">
            <span>
              FENIX
            </span>
          </div>

          <div className="top-search">
            <Icon name="search" />

            <input
              value={search}
              onChange={event => {
                const value =
                  event.target
                    .value;

                setSearch(value);

                if (
                  value.trim()
                ) {
                  setPage(
                    "search"
                  );
                }
              }}
              placeholder="Что хотите послушать?"
            />
          </div>

          <div className="top-actions">
            <button
              className="telegram-button"
              onClick={() =>
                navigate(
                  "telegram"
                )
              }
            >
              <Icon name="telegram" />
              Telegram
            </button>

            <button
              className="notification-button"
              onClick={() =>
                navigate(
                  "notifications"
                )
              }
            >
              <Icon name="bell" />

              {notifications.length >
                0 && (
                <i>
                  {
                    notifications.length
                  }
                </i>
              )}
            </button>

            <button
              className="premium-button"
              onClick={() =>
                navigate(
                  "premium"
                )
              }
            >
              💎 Premium
            </button>

            <button
              className="top-avatar"
              onClick={() =>
                navigate(
                  user
                    ? "profile"
                    : "login"
                )
              }
            >
              {(
                user?.username ||
                "FX"
              )
                .slice(0, 2)
                .toUpperCase()}
            </button>
          </div>
        </header>

        <div className="page-container">
          {apiError && (
            <div className="api-warning">
              <span>
                {apiError}
              </span>

              <button
                onClick={() =>
                  loadTracks()
                }
              >
                Повторить
              </button>
            </div>
          )}

          {page === "home" && (
            <HomePage
              tracks={tracks}
              visibleTracks={
                filteredTracks
              }
              history={history}
              loading={
                loadingTracks
              }
              playTrack={
                playTrack
              }
              toggleFavorite={
                toggleFavorite
              }
              isFavorite={
                isFavorite
              }
              setPage={
                navigate
              }
            />
          )}

          {page === "search" && (
            <SearchPage
              search={search}
              setSearch={
                setSearch
              }
              tracks={
                filteredTracks
              }
              playTrack={
                playTrack
              }
              toggleFavorite={
                toggleFavorite
              }
              isFavorite={
                isFavorite
              }
            />
          )}

          {page ===
            "recommendations" && (
            <RecommendationsPage
              tracks={tracks}
              history={history}
              playTrack={
                playTrack
              }
              toggleFavorite={
                toggleFavorite
              }
              isFavorite={
                isFavorite
              }
            />
          )}

          {page ===
            "library" && (
            <LibraryPage
              favorites={
                favorites
              }
              history={
                history
              }
              playlists={
                playlists
              }
              tracks={tracks}
              playTrack={
                playTrack
              }
              setPage={
                navigate
              }
            />
          )}

          {page ===
            "favorites" && (
            <TrackListPage
              title="Избранное"
              subtitle={`${favorites.length} сохранённых треков`}
              tracks={favorites}
              playTrack={
                playTrack
              }
              toggleFavorite={
                toggleFavorite
              }
              isFavorite={
                isFavorite
              }
            />
          )}

          {page ===
            "history" && (
            <TrackListPage
              title="История"
              subtitle="Недавно прослушанные треки"
              tracks={history}
              playTrack={
                playTrack
              }
              toggleFavorite={
                toggleFavorite
              }
              isFavorite={
                isFavorite
              }
            />
          )}

          {page ===
            "playlists" && (
            <PlaylistsPage
              playlists={
                playlists
              }
              setPlaylists={
                setPlaylists
              }
              tracks={tracks}
              playTrack={
                playTrack
              }
              token={
                Boolean(
                  localStorage.getItem(
                    "fenix_token"
                  )
                )
              }
            />
          )}

          {page === "albums" && (
            <AlbumsPage
              tracks={tracks}
              playTrack={
                playTrack
              }
            />
          )}

          {page === "artists" && (
            <ArtistsPage
              tracks={tracks}
              playTrack={
                playTrack
              }
            />
          )}

          {page ===
            "notifications" && (
            <NotificationsPage
              notifications={
                notifications
              }
              setNotifications={
                setNotifications
              }
            />
          )}

          {page === "telegram" && (
            <TelegramPage />
          )}

          {page === "premium" && (
            <PremiumPage />
          )}

          {page === "profile" && (
            <ProfilePage
              user={user}
              setUser={
                setUser
              }
              history={
                history
              }
              favorites={
                favorites
              }
              logout={logout}
              setPage={
                navigate
              }
            />
          )}

          {page === "settings" && (
            <SettingsPage
              settings={
                settings
              }
              setSettings={
                setSettings
              }
              logout={logout}
            />
          )}

          {page === "security" && (
            <SecurityPage
              user={user}
              openAuth={() => {
                setAuthMode(
                  "login"
                );

                setAuthOpen(
                  true
                );
              }}
            />
          )}

          {page === "login" && (
            <LoginPage
              onLogin={() => {
                setAuthMode(
                  "login"
                );

                setAuthOpen(
                  true
                );
              }}
              onRegister={() => {
                setAuthMode(
                  "register"
                );

                setAuthOpen(
                  true
                );
              }}
            />
          )}
        </div>
      </main>

      {/* ======================================================
          MOBILE NAV
      ====================================================== */}

      <MobileNavigation
        page={page}
        setPage={navigate}
      />

      {/* ======================================================
          PLAYER
      ====================================================== */}

      {currentTrack && (
        <PlayerBar
          track={
            currentTrack
          }
          playing={playing}
          position={position}
          duration={
            duration ||
            currentTrack.duration ||
            0
          }
          volume={volume}
          setVolume={
            setVolume
          }
          shuffle={shuffle}
          setShuffle={
            setShuffle
          }
          repeat={repeat}
          setRepeat={
            setRepeat
          }
          togglePlaying={
            togglePlaying
          }
          nextTrack={
            nextTrack
          }
          previousTrack={
            previousTrack
          }
          seek={seek}
          openFull={() =>
            setFullPlayer(
              true
            )
          }
          openQueue={() =>
            setQueueOpen(
              true
            )
          }
          favorite={
            isFavorite(
              currentTrack
            )
          }
          onFavorite={() =>
            toggleFavorite(
              currentTrack
            )
          }
        />
      )}

      {/* ======================================================
          QUEUE
      ====================================================== */}

      {currentTrack &&
        queueOpen && (
          <QueuePanel
            queue={
              queue.length
                ? queue
                : tracks
            }
            currentTrack={
              currentTrack
            }
            playTrack={
              playTrack
            }
            close={() =>
              setQueueOpen(
                false
              )
            }
          />
        )}

      {/* ======================================================
          FULL PLAYER
      ====================================================== */}

      {currentTrack &&
        fullPlayer && (
          <FullPlayer
            track={
              currentTrack
            }
            playing={playing}
            position={position}
            duration={
              duration ||
              currentTrack.duration ||
              0
            }
            shuffle={
              shuffle
            }
            setShuffle={
              setShuffle
            }
            repeat={repeat}
            setRepeat={
              setRepeat
            }
            togglePlaying={
              togglePlaying
            }
            nextTrack={
              nextTrack
            }
            previousTrack={
              previousTrack
            }
            seek={seek}
            close={() =>
              setFullPlayer(
                false
              )
            }
            favorite={
              isFavorite(
                currentTrack
              )
            }
            onFavorite={() =>
              toggleFavorite(
                currentTrack
              )
            }
          />
        )}

      {/* ======================================================
          AUTH
      ====================================================== */}

      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={
            setAuthMode
          }
          close={() =>
            setAuthOpen(
              false
            )
          }
          onSuccess={(
            account,
            token
          ) => {
            if (token) {
              localStorage.setItem(
                "fenix_token",
                token
              );
            }

            setUser(account);
            setAuthOpen(false);
            setPage("home");

            showToast(
              "Добро пожаловать в Fenix Music",
              "success"
            );
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   NAVIGATION
============================================================ */

function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
}) {
  return (
    <button
      className={`nav-item ${
        active ? "active" : ""
      }`}
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
        className={
          page === "home"
            ? "active"
            : ""
        }
        onClick={() =>
          setPage("home")
        }
      >
        <Icon name="home" />
        <span>Главная</span>
      </button>

      <button
        className={
          page === "search"
            ? "active"
            : ""
        }
        onClick={() =>
          setPage("search")
        }
      >
        <Icon name="search" />
        <span>Поиск</span>
      </button>

      <button
        className={
          page === "library"
            ? "active"
            : ""
        }
        onClick={() =>
          setPage("library")
        }
      >
        <Icon name="library" />
        <span>Моя музыка</span>
      </button>

      <button
        className={
          page === "favorites"
            ? "active"
            : ""
        }
        onClick={() =>
          setPage(
            "favorites"
          )
        }
      >
        <Icon name="heart" />
        <span>Избранное</span>
      </button>

      <button
        className={
          page === "profile"
            ? "active"
            : ""
        }
        onClick={() =>
          setPage(
            "profile"
          )
        }
      >
        <Icon name="user" />
        <span>Профиль</span>
      </button>
    </nav>
  );
}

/* ============================================================
   HOME
============================================================ */

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
  const first =
    visibleTracks[0] ||
    tracks[0];

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
            <span>
              Твоя вселенная.
            </span>
          </h1>

          <p>
            Слушай любимые треки,
            открывай новых
            артистов и собирай
            собственную
            музыкальную
            библиотеку.
          </p>

          <div className="hero-buttons">
            {first && (
              <button
                className="primary-button"
                onClick={() =>
                  playTrack(
                    first,
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
                setPage(
                  "recommendations"
                )
              }
            >
              ✦ Для вас
            </button>
          </div>
        </div>

        <div className="hero-art">
          {first && (
            <img
              src={
                first.cover_url ||
                DEFAULT_COVER
              }
              alt=""
            />
          )}
        </div>
      </section>

      <MusicSection
        title="Для вас"
        subtitle="Персональные рекомендации"
        tracks={
          visibleTracks.slice(
            0,
            6
          )
        }
        playTrack={
          playTrack
        }
        toggleFavorite={
          toggleFavorite
        }
        isFavorite={
          isFavorite
        }
      />

      <MusicSection
        title="Новинки"
        subtitle="Свежие релизы"
        tracks={tracks.slice(
          0,
          6
        )}
        playTrack={
          playTrack
        }
        toggleFavorite={
          toggleFavorite
        }
        isFavorite={
          isFavorite
        }
      />

      <MusicSection
        title="Популярное"
        subtitle="Сейчас слушают чаще всего"
        tracks={[...tracks]
          .sort(
            (a, b) =>
              Number(
                b.plays || 0
              ) -
              Number(
                a.plays || 0
              )
          )
          .slice(0, 6)}
        playTrack={
          playTrack
        }
        toggleFavorite={
          toggleFavorite
        }
        isFavorite={
          isFavorite
        }
      />

      <MusicSection
        title="Миксы"
        subtitle="Подборки специально для тебя"
        tracks={[...tracks]
          .reverse()
          .slice(0, 6)}
        playTrack={
          playTrack
        }
        toggleFavorite={
          toggleFavorite
        }
        isFavorite={
          isFavorite
        }
      />

      {history.length >
        0 && (
        <MusicSection
          title="Недавно прослушанное"
          subtitle="Продолжить слушать"
          tracks={history.slice(
            0,
            6
          )}
          playTrack={
            playTrack
          }
          toggleFavorite={
            toggleFavorite
          }
          isFavorite={
            isFavorite
          }
        />
      )}

      {loading && (
        <div className="empty-state">
          Загрузка музыкального
          каталога…
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
            <span>
              {subtitle}
            </span>
          )}
        </div>

        <button type="button">
          Показать всё →
        </button>
      </div>

      {tracks.length >
      0 ? (
        <div className="track-grid">
          {tracks.map(
            track => (
              <TrackCard
                key={
                  track.id
                }
                track={
                  track
                }
                playTrack={
                  playTrack
                }
                toggleFavorite={
                  toggleFavorite
                }
                isFavorite={
                  isFavorite
                }
              />
            )
          )}
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
  const liked =
    isFavorite(track);

  return (
    <article className="track-card">
      <button
        className="track-cover"
        onClick={() =>
          playTrack(track)
        }
      >
        <img
          src={
            track.cover_url ||
            DEFAULT_COVER
          }
          alt=""
          loading="lazy"
        />

        <span className="track-play">
          <Icon name="play" />
        </span>
      </button>

      <div className="track-card-info">
        <button
          className="track-title"
          onClick={() =>
            playTrack(track)
          }
        >
          {track.title}
        </button>

        <span>
          {track.artist_name}
        </span>

        <div className="track-meta">
          <small>
            {track.genre}
          </small>

          <small>
            {formatTime(
              track.duration
            )}
          </small>
        </div>

        <button
          className={`favorite-button ${
            liked
              ? "liked"
              : ""
          }`}
          onClick={() =>
            toggleFavorite(
              track
            )
          }
          aria-label="Избранное"
        >
          <Icon
            name={
              liked
                ? "heartFill"
                : "heart"
            }
          />
        </button>
      </div>
    </article>
  );
}

/* ============================================================
   SEARCH
============================================================ */

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
          Найди трек, артиста,
          альбом или свою
          любимую музыку.
        </p>
      </div>

      <div className="large-search">
        <Icon name="search" />

        <input
          autoFocus
          value={search}
          onChange={event =>
            setSearch(
              event.target
                .value
            )
          }
          placeholder="Трек, артист, альбом, жанр…"
        />
      </div>

      {search && (
        <p className="search-result-count">
          Найдено:{" "}
          {tracks.length}
        </p>
      )}

      <div className="track-grid">
        {tracks.map(
          track => (
            <TrackCard
              key={
                track.id
              }
              track={track}
              playTrack={
                playTrack
              }
              toggleFavorite={
                toggleFavorite
              }
              isFavorite={
                isFavorite
              }
            />
          )
        )}
      </div>

      {!tracks.length && (
        <div className="empty-state">
          Ничего не найдено.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   RECOMMENDATIONS
============================================================ */

function RecommendationsPage({
  tracks,
  history,
  playTrack,
  toggleFavorite,
  isFavorite,
}) {
  const genres =
    useMemo(
      () => [
        ...new Set(
          history
            .map(
              item =>
                item.genre
            )
            .filter(Boolean)
        ),
      ],
      [history]
    );

  const recommendations =
    genres.length
      ? tracks.filter(
          track =>
            genres.includes(
              track.genre
            )
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
          Рекомендации
          формируются на основе
          истории
          прослушиваний.
        </p>
      </div>

      {genres.length >
        0 && (
        <div className="genre-tags">
          {genres.map(
            genre => (
              <span
                key={genre}
              >
                {genre}
              </span>
            )
          )}
        </div>
      )}

      <div className="track-grid">
        {recommendations.map(
          track => (
            <TrackCard
              key={
                track.id
              }
              track={track}
              playTrack={
                playTrack
              }
              toggleFavorite={
                toggleFavorite
              }
              isFavorite={
                isFavorite
              }
            />
          )
        )}
      </div>

      {!recommendations.length && (
        <div className="empty-state">
          Пока недостаточно
          данных для
          рекомендаций.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LIBRARY
============================================================ */

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
          Всё сохранённое и
          недавно
          прослушанное.
        </p>
      </div>

      <div className="library-grid">
        <LibraryTile
          icon="heart"
          title="Избранное"
          description={`${favorites.length} треков`}
          onClick={() =>
            setPage(
              "favorites"
            )
          }
        />

        <LibraryTile
          icon="clock"
          title="История"
          description={`${history.length} прослушанных`}
          onClick={() =>
            setPage(
              "history"
            )
          }
        />

        <LibraryTile
          icon="music"
          title="Плейлисты"
          description={`${playlists.length} плейлистов`}
          onClick={() =>
            setPage(
              "playlists"
            )
          }
        />

        <LibraryTile
          icon="album"
          title="Альбомы"
          description="Музыкальные альбомы"
          onClick={() =>
            setPage(
              "albums"
            )
          }
        />
      </div>

      <MusicSection
        title="Продолжить слушать"
        subtitle="Музыка из каталога"
        tracks={tracks.slice(
          0,
          6
        )}
        playTrack={
          playTrack
        }
        toggleFavorite={() => {}}
        isFavorite={() =>
          false
        }
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

      <strong>
        {title}
      </strong>

      <small>
        {description}
      </small>

      <span>
        Открыть →
      </span>
    </button>
  );
}

/* ============================================================
   TRACK LIST
============================================================ */

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

        <p>
          {subtitle}
        </p>

        {tracks[0] && (
          <button
            className="primary-button"
            onClick={() =>
              playTrack(
                tracks[0],
                tracks
              )
            }
          >
            <Icon name="play" />
            Слушать всё
          </button>
        )}
      </div>

      <div className="track-list">
        {tracks.map(
          (
            track,
            index
          ) => {
            const liked =
              isFavorite(
                track
              );

            return (
              <div
                className="track-list-row"
                key={`${track.id}-${index}`}
              >
                <span className="track-number">
                  {index +
                    1}
                </span>

                <img
                  src={
                    track.cover_url ||
                    DEFAULT_COVER
                  }
                  alt=""
                  loading="lazy"
                />

                <button
                  className="track-list-main"
                  onClick={() =>
                    playTrack(
                      track,
                      tracks
                    )
                  }
                >
                  <b>
                    {track.title}
                  </b>

                  <small>
                    {
                      track.artist_name
                    }
                  </small>
                </button>

                <span className="track-list-grow" />

                <span className="track-list-duration">
                  {formatTime(
                    track.duration
                  )}
                </span>

                <button
                  className={`icon-button ${
                    liked
                      ? "liked"
                      : ""
                  }`}
                  onClick={() =>
                    toggleFavorite(
                      track
                    )
                  }
                >
                  <Icon
                    name={
                      liked
                        ? "heartFill"
                        : "heart"
                    }
                  />
                </button>

                <button
                  className="round-play"
                  onClick={() =>
                    playTrack(
                      track,
                      tracks
                    )
                  }
                >
                  <Icon name="play" />
                </button>
              </div>
            );
          }
        )}
      </div>

      {!tracks.length && (
        <div className="empty-state">
          Здесь пока ничего
          нет.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PLAYLISTS
============================================================ */

function PlaylistsPage({
  playlists,
  setPlaylists,
  tracks,
  playTrack,
  token,
}) {
  const [name, setName] =
    useState("");

  const [
    publicPlaylist,
    setPublicPlaylist,
  ] = useState(false);

  const [
    selectedPlaylist,
    setSelectedPlaylist,
  ] = useState(null);

  const createPlaylist =
    async () => {
      const cleanName =
        name.trim();

      if (!cleanName) {
        return;
      }

      const playlist = {
        id: `local-${Date.now()}`,
        name: cleanName,
        public:
          publicPlaylist,
        tracks: [],
        created_at:
          Date.now(),
      };

      setPlaylists(
        previous => [
          ...previous,
          playlist,
        ]
      );

      setName("");
      setPublicPlaylist(
        false
      );

      if (token) {
        try {
          const data =
            await requestJSON(
              "/api/playlists",
              {
                method:
                  "POST",
                body: {
                  name: cleanName,
                  public:
                    publicPlaylist,
                },
              }
            );

          if (
            data?.playlist
          ) {
            setPlaylists(
              previous =>
                previous.map(
                  item =>
                    item.id ===
                    playlist.id
                      ? {
                          ...item,
                          ...data.playlist,
                        }
                      : item
                )
            );
          }
        } catch {
          // local fallback
        }
      }
    };

  const deletePlaylist =
    async id => {
      setPlaylists(
        previous =>
          previous.filter(
            playlist =>
              String(
                playlist.id
              ) !==
              String(id)
          )
      );

      if (token) {
        try {
          await requestJSON(
            `/api/playlists/${encodeURIComponent(
              id
            )}`,
            {
              method:
                "DELETE",
            }
          );
        } catch {
          // local fallback
        }
      }
    };

  const addTrack =
    playlistId => {
      if (!tracks.length) {
        return;
      }

      const track =
        normalizeTrack(
          tracks[0]
        );

      setPlaylists(
        previous =>
          previous.map(
            playlist => {
              if (
                String(
                  playlist.id
                ) !==
                String(
                  playlistId
                )
              ) {
                return playlist;
              }

              const exists =
                (
                  playlist.tracks ||
                  []
                ).some(
                  item =>
                    String(
                      item.id
                    ) ===
                    String(
                      track.id
                    )
                );

              if (exists) {
                return playlist;
              }

              return {
                ...playlist,
                tracks: [
                  ...(playlist.tracks ||
                    []),
                  track,
                ],
              };
            }
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
          Создавай публичные и
          приватные музыкальные
          подборки.
        </p>
      </div>

      <div className="create-playlist">
        <input
          value={name}
          onChange={event =>
            setName(
              event.target.value
            )
          }
          placeholder="Название нового плейлиста"
        />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={
              publicPlaylist
            }
            onChange={event =>
              setPublicPlaylist(
                event.target
                  .checked
              )
            }
          />

          <span>
            Публичный
          </span>
        </label>

        <button
          className="primary-button"
          onClick={
            createPlaylist
          }
        >
          <Icon name="plus" />
          Создать
        </button>
      </div>

      <div className="playlist-grid">
        {playlists.map(
          playlist => (
            <article
              className={`playlist-card ${
                selectedPlaylist ===
                playlist.id
                  ? "selected"
                  : ""
              }`}
              key={
                playlist.id
              }
            >
              <button
                className="playlist-cover"
                onClick={() =>
                  setSelectedPlaylist(
                    selectedPlaylist ===
                      playlist.id
                      ? null
                      : playlist.id
                  )
                }
              >
                <Icon name="music" />
              </button>

              <h3>
                {playlist.name}
              </h3>

              <span>
                {playlist.public
                  ? "Публичный"
                  : "Приватный"}
                {" · "}
                {
                  playlist
                    .tracks
                    ?.length ||
                  0
                }{" "}
                треков
              </span>

              <div className="playlist-actions">
                {playlist
                  .tracks
                  ?.length >
                  0 && (
                  <button
                    onClick={() =>
                      playTrack(
                        playlist
                          .tracks[0],
                        playlist.tracks
                      )
                    }
                  >
                    ▶ Слушать
                  </button>
                )}

                <button
                  onClick={() =>
                    addTrack(
                      playlist.id
                    )
                  }
                >
                  + Трек
                </button>

                <button
                  className="danger-text"
                  onClick={() =>
                    deletePlaylist(
                      playlist.id
                    )
                  }
                >
                  Удалить
                </button>
              </div>

              {selectedPlaylist ===
                playlist.id && (
                <div className="playlist-track-preview">
                  {playlist
                    .tracks
                    ?.length ? (
                    playlist.tracks.map(
                      track => (
                        <button
                          key={
                            track.id
                          }
                          onClick={() =>
                            playTrack(
                              track,
                              playlist.tracks
                            )
                          }
                        >
                          <img
                            src={
                              track.cover_url ||
                              DEFAULT_COVER
                            }
                            alt=""
                          />

                          <span>
                            {
                              track.title
                            }
                          </span>
                        </button>
                      )
                    )
                  ) : (
                    <small>
                      В плейлисте
                      пока нет
                      треков.
                    </small>
                  )}
                </div>
              )}
            </article>
          )
        )}
      </div>

      {!playlists.length && (
        <div className="empty-state">
          Создай свой первый
          плейлист.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ARTISTS
============================================================ */

function ArtistsPage({
  tracks,
  playTrack,
}) {
  const artists =
    useMemo(() => {
      const map =
        new Map();

      tracks.forEach(
        track => {
          const name =
            track.artist_name ||
            "Неизвестный артист";

          if (
            !map.has(name)
          ) {
            map.set(
              name,
              track
            );
          }
        }
      );

      return [
        ...map.values(),
      ];
    }, [tracks]);

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          ARTISTS
        </span>

        <h1>Артисты</h1>

        <p>
          Исполнители из твоего
          музыкального каталога.
        </p>
      </div>

      <div className="artist-grid">
        {artists.map(
          track => (
            <article
              className="artist-card"
              key={
                track.artist_name ||
                track.id
              }
              onClick={() =>
                playTrack(
                  track,
                  tracks
                )
              }
            >
              <img
                src={
                  track.artist_avatar ||
                  track.cover_url ||
                  DEFAULT_COVER
                }
                alt=""
                loading="lazy"
              />

              <h3>
                {
                  track.artist_name
                }
              </h3>

              <span>
                Слушать артиста →
              </span>
            </article>
          )
        )}
      </div>

      {!artists.length && (
        <div className="empty-state">
          Артистов пока нет.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ALBUMS
============================================================ */

function AlbumsPage({
  tracks,
  playTrack,
}) {
  const albums =
    useMemo(() => {
      const map =
        new Map();

      tracks.forEach(
        track => {
          const name =
            track.album_name ||
            "Без альбома";

          if (
            !map.has(name)
          ) {
            map.set(
              name,
              track
            );
          }
        }
      );

      return [
        ...map.values(),
      ];
    }, [tracks]);

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          ALBUMS
        </span>

        <h1>Альбомы</h1>

        <p>
          Все доступные
          релизы.
        </p>
      </div>

      <div className="album-grid">
        {albums.map(
          track => (
            <article
              className="album-card"
              key={
                track.album_name ||
                track.id
              }
              onClick={() =>
                playTrack(
                  track,
                  tracks
                )
              }
            >
              <img
                src={
                  track.album_cover_url ||
                  track.cover_url ||
                  DEFAULT_COVER
                }
                alt=""
                loading="lazy"
              />

              <h3>
                {
                  track.album_name
                }
              </h3>

              <span>
                {
                  track.artist_name
                }
              </span>

              <small>
                {track.year ||
                  "—"}
              </small>
            </article>
          )
        )}
      </div>
    </div>
  );
}

/* ============================================================
   NOTIFICATIONS
============================================================ */

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

          <h1>
            Уведомления
          </h1>
        </div>

        {notifications.length >
          0 && (
          <button
            className="secondary-button"
            onClick={() =>
              setNotifications(
                []
              )
            }
          >
            Очистить
          </button>
        )}
      </div>

      {notifications.length >
      0 ? (
        <div className="notification-list">
          {notifications.map(
            (
              notification,
              index
            ) => (
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
          Новых уведомлений
          нет.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TELEGRAM
============================================================ */

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
            Отправляй песни
            боту. Backend
            сохраняет Telegram
            file_id, метаданные
            и публикует трек в
            канал. После этого
            сайт автоматически
            подхватывает новую
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
          Автоподхват новых
          песен выполняется
          frontend через
          периодический запрос
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

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>
    </article>
  );
}

/* ============================================================
   PREMIUM
============================================================ */

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
          Музыка без
          ограничений.
        </h1>

        <p>
          Больше качества.
          Больше музыки.
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

      <strong>
        {price}
      </strong>

      <div className="premium-features">
        {features.map(
          feature => (
            <span
              key={feature}
            >
              <Icon name="check" />
              {feature}
            </span>
          )
        )}
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

/* ============================================================
   PROFILE
============================================================ */

function ProfilePage({
  user,
  setUser,
  history,
  favorites,
  logout,
  setPage,
}) {
  const [username, setUsername] =
    useState(
      user?.username || ""
    );

  const [bio, setBio] =
    useState(
      user?.bio || ""
    );

  useEffect(() => {
    setUsername(
      user?.username || ""
    );

    setBio(
      user?.bio || ""
    );
  }, [user]);

  const saveProfile =
    async () => {
      const updated = {
        ...(user || {}),
        username:
          username.trim(),
        bio: bio.trim(),
      };

      setUser(updated);

      const token =
        localStorage.getItem(
          "fenix_token"
        );

      if (token) {
        try {
          const data =
            await requestJSON(
              "/api/auth/profile",
              {
                method:
                  "PATCH",
                body: {
                  username:
                    username.trim(),
                  bio: bio.trim(),
                },
              }
            );

          if (
            data?.user
          ) {
            setUser(
              data.user
            );
          }
        } catch {
          // local fallback
        }
      }
    };

  if (!user) {
    return (
      <LoginPage
        onLogin={() =>
          setPage("login")
        }
        onRegister={() =>
          setPage("login")
        }
      />
    );
  }

  const totalSeconds =
    history.reduce(
      (total, track) =>
        total +
        Number(
          track.duration || 0
        ),
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
          Редактирование
          профиля
        </h2>

        <label>
          Username

          <input
            value={username}
            onChange={event =>
              setUsername(
                event.target
                  .value
              )
            }
          />
        </label>

        <label>
          Описание

          <textarea
            value={bio}
            onChange={event =>
              setBio(
                event.target
                  .value
              )
            }
            placeholder="Расскажи о себе"
          />
        </label>

        <button
          className="primary-button"
          onClick={
            saveProfile
          }
        >
          Сохранить
        </button>
      </div>

      <div className="profile-links">
        <button
          onClick={() =>
            setPage(
              "settings"
            )
          }
        >
          <Icon name="settings" />
          Настройки
        </button>

        <button
          onClick={() =>
            setPage(
              "security"
            )
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

/* ============================================================
   SETTINGS
============================================================ */

function SettingsPage({
  settings,
  setSettings,
  logout,
}) {
  const update = (
    key,
    value
  ) => {
    setSettings(
      previous => ({
        ...previous,
        [key]: value,
      })
    );
  };

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">
          SETTINGS
        </span>

        <h1>
          Настройки
        </h1>

        <p>
          Настрой Fenix Music
          под себя.
        </p>
      </div>

      <div className="settings-card">
        <SettingRow title="Тема">
          <select
            value={
              settings.theme
            }
            onChange={event =>
              update(
                "theme",
                event.target
                  .value
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
            value={
              settings.quality
            }
            onChange={event =>
              update(
                "quality",
                event.target
                  .value
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
          value={
            settings.autoplay
          }
          onChange={value =>
            update(
              "autoplay",
              value
            )
          }
        />

        <ToggleRow
          title="Автоматический переход"
          value={
            settings.autoNext
          }
          onChange={value =>
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
          onChange={value =>
            update(
              "notifications",
              value
            )
          }
        />

        <SettingRow title="Язык">
          <select
            value={
              settings.language
            }
            onChange={event =>
              update(
                "language",
                event.target
                  .value
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
        aria-label={title}
      >
        <i />
      </button>
    </div>
  );
}

/* ============================================================
   SECURITY
============================================================ */

function SecurityPage({
  user,
  openAuth,
}) {
  const [
    busyLogout,
    setBusyLogout,
  ] = useState(false);

  const logoutAll =
    async () => {
      setBusyLogout(true);

      try {
        await requestJSON(
          "/api/auth/logout-all",
          {
            method:
              "POST",
          }
        );
      } catch {
        // backend endpoint optional
      }

      removeStorage(
        "fenix_token"
      );

      removeStorage(
        "fenix_user"
      );

      window.location.reload();
    };

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
            после входа и не
            требует повторной
            регистрации при
            каждом открытии
            сайта.
          </p>

          <button
            className="secondary-button"
            onClick={
              logoutAll
            }
            disabled={
              busyLogout
            }
          >
            {busyLogout
              ? "Выходим…"
              : "Выйти со всех устройств"}
          </button>
        </article>

        <article>
          <Icon name="lock" />

          <h3>
            Пароль
          </h3>

          <p>
            Пароль должен
            проверяться backend
            и храниться в базе
            только как
            защищённый hash.
          </p>

          <button
            className="secondary-button"
            onClick={
              openAuth
            }
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
            При регистрации
            используется новая
            CAPTCHA. При
            серверной проверке
            код дополнительно
            проверяется backend.
          </p>

          <span className="security-ok">
            <Icon name="check" />
            Защита включена
          </span>
        </article>
      </div>

      {!user && (
        <div className="empty-state">
          Войди в аккаунт для
          управления
          безопасностью.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LOGIN
============================================================ */

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
          Музыка начинается
          здесь
        </h1>

        <p>
          Войди в аккаунт,
          чтобы сохранить
          избранное, историю,
          настройки и
          плейлисты.
        </p>

        <button
          className="primary-button wide"
          onClick={
            onLogin
          }
        >
          Войти
        </button>

        <button
          className="secondary-button wide"
          onClick={
            onRegister
          }
        >
          Создать аккаунт
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   AUTH MODAL
============================================================ */

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

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    captchaText,
    setCaptchaText,
  ] = useState("");

  const [
    captchaAnswer,
    setCaptchaAnswer,
  ] = useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    serverCaptcha,
    setServerCaptcha,
  ] = useState(null);

  const getCaptcha =
    useCallback(
      async () => {
        setError("");

        try {
          const data =
            await requestJSON(
              "/api/auth/captcha"
            );

          setServerCaptcha(
            data
          );

          const text =
            data.text ||
            data.code ||
            data.captcha ||
            data.question ||
            "";

          if (text) {
            setCaptchaText(
              String(text)
            );
          } else {
            setCaptchaText(
              randomCaptcha()
            );
          }
        } catch {
          setServerCaptcha(
            null
          );

          setCaptchaText(
            randomCaptcha()
          );
        }

        setCaptchaAnswer("");
      },
      []
    );

  useEffect(() => {
    if (
      mode ===
      "register"
    ) {
      getCaptcha();
    }
  }, [
    mode,
    getCaptcha,
  ]);

  const submit =
    async event => {
      event.preventDefault();

      setError("");

      if (
        mode ===
        "register"
      ) {
        if (
          !username.trim()
        ) {
          setError(
            "Введите username."
          );
          return;
        }

        if (
          password !==
          confirmPassword
        ) {
          setError(
            "Пароли не совпадают."
          );
          return;
        }

        if (
          password.length <
          6
        ) {
          setError(
            "Пароль должен содержать минимум 6 символов."
          );
          return;
        }

        if (
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
      }

      setBusy(true);

      try {
        const endpoint =
          mode ===
          "register"
            ? "/api/auth/register"
            : "/api/auth/login";

        const payload =
          mode ===
          "register"
            ? {
                username:
                  username.trim(),
                email:
                  email.trim(),
                password,
                captcha:
                  captchaAnswer.trim(),
                captcha_id:
                  serverCaptcha?.id ||
                  serverCaptcha?.captcha_id ||
                  undefined,
              }
            : {
                login:
                  email.trim() ||
                  username.trim(),
                email:
                  email.trim(),
                username:
                  username.trim(),
                password,
              };

        const data =
          await requestJSON(
            endpoint,
            {
              method:
                "POST",
              body: payload,
            }
          );

        const token =
          data.token ||
          data.access_token ||
          data.session_token ||
          null;

        const account =
          data.user ||
          data.account ||
          {
            id:
              data.id ||
              data.user_id,
            username:
              data.username ||
              username.trim(),
            email:
              data.email ||
              email.trim(),
          };

        onSuccess(
          account,
          token
        );
      } catch (err) {
        setError(
          err?.message ||
            "Сервер авторизации недоступен."
        );

        if (
          mode ===
          "register"
        ) {
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
        onMouseDown={event =>
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
          {mode ===
          "register"
            ? "CREATE ACCOUNT"
            : "WELCOME BACK"}
        </span>

        <h2>
          {mode ===
          "register"
            ? "Создай свой аккаунт"
            : "С возвращением"}
        </h2>

        <p>
          {mode ===
          "register"
            ? "Сохраняй музыку, историю, настройки и плейлисты."
            : "Вход проверяется через backend."}
        </p>

        <form
          onSubmit={submit}
        >
          {mode ===
            "register" && (
            <input
              value={
                username
              }
              onChange={event =>
                setUsername(
                  event.target
                    .value
                )
              }
              placeholder="Имя пользователя"
              autoComplete="username"
              required
            />
          )}

          <input
            value={email}
            onChange={event =>
              setEmail(
                event.target
                  .value
              )
            }
            type={
              mode ===
              "register"
                ? "email"
                : "text"
            }
            placeholder={
              mode ===
              "register"
                ? "Email"
                : "Email или username"
            }
            autoComplete={
              mode ===
              "register"
                ? "email"
                : "username"
            }
            required
          />

          <input
            value={
              password
            }
            onChange={event =>
              setPassword(
                event.target
                  .value
              )
            }
            type="password"
            placeholder="Пароль"
            minLength={6}
            autoComplete={
              mode ===
              "register"
                ? "new-password"
                : "current-password"
            }
            required
          />

          {mode ===
            "register" && (
            <input
              value={
                confirmPassword
              }
              onChange={event =>
                setConfirmPassword(
                  event.target
                    .value
                )
              }
              type="password"
              placeholder="Повтори пароль"
              minLength={6}
              autoComplete="new-password"
              required
            />
          )}

          {mode ===
            "register" && (
            <>
              <div className="captcha-box">
                <strong>
                  {captchaText ||
                    "------"}
                </strong>

                <button
                  type="button"
                  onClick={
                    getCaptcha
                  }
                  aria-label="Новая CAPTCHA"
                >
                  <Icon name="refresh" />
                </button>
              </div>

              <input
                value={
                  captchaAnswer
                }
                onChange={event =>
                  setCaptchaAnswer(
                    event.target
                      .value
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
            disabled={
              busy
            }
            type="submit"
          >
            {busy
              ? "Проверяем…"
              : mode ===
                "register"
              ? "Создать аккаунт"
              : "Войти"}
          </button>
        </form>

        <button
          className="auth-switch"
          onClick={() => {
            setError("");

            setMode(
              mode ===
                "register"
                ? "login"
                : "register"
            );
          }}
        >
          {mode ===
          "register"
            ? "Уже есть аккаунт? Войти"
            : "Нет аккаунта? Регистрация"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   PLAYER BAR
============================================================ */

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
  favorite,
  onFavorite,
}) {
  const progress =
    duration > 0
      ? Math.max(
          0,
          Math.min(
            1,
            position /
              duration
          )
        )
      : 0;

  return (
    <footer className="player-bar">
      <button
        className="now-playing"
        onClick={
          openFull
        }
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
            {
              track.artist_name
            }
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
              setShuffle(
                value =>
                  !value
              )
            }
            aria-label="Перемешивание"
          >
            <Icon name="shuffle" />
          </button>

          <button
            onClick={
              previousTrack
            }
            aria-label="Предыдущий"
          >
            <Icon name="previous" />
          </button>

          <button
            className="player-play"
            onClick={
              togglePlaying
            }
            aria-label={
              playing
                ? "Пауза"
                : "Воспроизвести"
            }
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
            onClick={
              nextTrack
            }
            aria-label="Следующий"
          >
            <Icon name="next" />
          </button>

          <button
            className={
              repeat !==
              "off"
                ? "control-active"
                : ""
            }
            onClick={() => {
              setRepeat(
                repeat ===
                  "off"
                  ? "all"
                  : repeat ===
                    "all"
                  ? "one"
                  : "off"
              );
            }}
            aria-label="Повтор"
          >
            <Icon name="repeat" />
          </button>
        </div>

        <div className="player-progress">
          <span>
            {formatTime(
              position
            )}
          </span>

          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={
              progress
            }
            onChange={
              seek
            }
            aria-label="Прогресс"
          />

          <span>
            {formatTime(
              duration
            )}
          </span>
        </div>
      </div>

      <div className="player-right">
        <button
          className={
            favorite
              ? "control-active"
              : ""
          }
          onClick={
            onFavorite
          }
          aria-label="Избранное"
        >
          <Icon
            name={
              favorite
                ? "heartFill"
                : "heart"
            }
          />
        </button>

        <button
          onClick={
            openQueue
          }
          aria-label="Очередь"
        >
          ☷
        </button>

        <Icon
          name={
            volume > 0
              ? "volume"
              : "mute"
          }
        />

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={event =>
            setVolume(
              Number(
                event.target
                  .value
              )
            )
          }
          aria-label="Громкость"
        />
      </div>
    </footer>
  );
}

/* ============================================================
   QUEUE
============================================================ */

function QueuePanel({
  queue,
  currentTrack,
  playTrack,
  close,
}) {
  return (
    <div className="queue-panel">
      <div className="queue-heading">
        <h2>
          Очередь
        </h2>

        <button
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="queue-list">
        {queue.map(
          (
            track,
            index
          ) => (
            <button
              className={`queue-item ${
                String(
                  track.id
                ) ===
                String(
                  currentTrack.id
                )
                  ? "active"
                  : ""
              }`}
              key={`${track.id}-${index}`}
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
                  {
                    track.artist_name
                  }
                </small>
              </span>

              <Icon name="play" />
            </button>
          )
        )}
      </div>

      {!queue.length && (
        <div className="empty-state small">
          Очередь пуста.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   FULL PLAYER
============================================================ */

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
  favorite,
  onFavorite,
}) {
  const progress =
    duration > 0
      ? Math.max(
          0,
          Math.min(
            1,
            position /
              duration
          )
        )
      : 0;

  return (
    <div className="full-player">
      <button
        className="full-player-close"
        onClick={close}
        aria-label="Закрыть"
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

        <h1>
          {track.title}
        </h1>

        <p>
          {track.album_name}
        </p>
      </div>

      <button
        className={`full-favorite ${
          favorite
            ? "liked"
            : ""
        }`}
        onClick={
          onFavorite
        }
      >
        <Icon
          name={
            favorite
              ? "heartFill"
              : "heart"
          }
        />
      </button>

      <div className="full-progress">
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={
            progress
          }
          onChange={
            seek
          }
        />

        <div>
          <span>
            {formatTime(
              position
            )}
          </span>

          <span>
            {formatTime(
              duration
            )}
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
            setShuffle(
              value =>
                !value
            )
          }
        >
          <Icon name="shuffle" />
        </button>

        <button
          onClick={
            previousTrack
          }
        >
          <Icon name="previous" />
        </button>

        <button
          className="full-play-button"
          onClick={
            togglePlaying
          }
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
          onClick={
            nextTrack
          }
        >
          <Icon name="next" />
        </button>

        <button
          className={
            repeat !==
            "off"
              ? "control-active"
              : ""
          }
          onClick={() =>
            setRepeat(
              repeat ===
                "off"
                ? "all"
                : repeat ===
                  "all"
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

/* ============================================================
   TOAST
============================================================ */

function Toast({
  toast,
}) {
  if (!toast) {
    return null;
  }

  return (
    <div
      className={`fenix-toast ${
        toast.type || "info"
      }`}
    >
      <span>
        {toast.type ===
        "success"
          ? "✓"
          : toast.type ===
            "error"
          ? "!"
          : "i"}
      </span>

      <strong>
        {toast.message}
      </strong>
    </div>
  );
}
