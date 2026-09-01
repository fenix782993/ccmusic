"use strict";

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 10000);

const ROOT_DIR = path.join(__dirname, "..");

const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const FRONTEND_DIST = path.join(FRONTEND_DIR, "dist");

const MUSIC_DIR =
  process.env.MUSIC_DIR ||
  path.join(ROOT_DIR, "music");

const DATA_DIR =
  process.env.DATA_DIR ||
  path.join(ROOT_DIR, "data");

const MUSIC_DB_FILE =
  process.env.MUSIC_DB_FILE ||
  path.join(DATA_DIR, "music.json");

const MAX_AUDIO_SIZE =
  Number(process.env.MAX_AUDIO_SIZE || 250 * 1024 * 1024);

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac",
  ".webm",
]);

const MIME_TYPES = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

const captchaStore = new Map();

let musicDatabase = {
  tracks: [],
};

function log(...args) {
  console.log(
    new Date().toISOString(),
    ...args
  );
}

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true,
    });
  }
}

function ensureStorage() {
  ensureDirectory(MUSIC_DIR);
  ensureDirectory(DATA_DIR);

  if (!fs.existsSync(MUSIC_DB_FILE)) {
    fs.writeFileSync(
      MUSIC_DB_FILE,
      JSON.stringify(
        {
          tracks: [],
        },
        null,
        2
      ),
      "utf8"
    );
  }

  loadMusicDatabase();
}

function loadMusicDatabase() {
  try {
    if (!fs.existsSync(MUSIC_DB_FILE)) {
      musicDatabase = {
        tracks: [],
      };

      return;
    }

    const raw = fs.readFileSync(
      MUSIC_DB_FILE,
      "utf8"
    );

    const parsed = JSON.parse(raw);

    if (
      parsed &&
      Array.isArray(parsed.tracks)
    ) {
      musicDatabase = parsed;
    } else {
      musicDatabase = {
        tracks: [],
      };
    }
  } catch (error) {
    console.error(
      "Music database load error:",
      error
    );

    musicDatabase = {
      tracks: [],
    };
  }
}

function saveMusicDatabase() {
  try {
    ensureDirectory(DATA_DIR);

    const tempFile =
      MUSIC_DB_FILE + ".tmp";

    fs.writeFileSync(
      tempFile,
      JSON.stringify(
        musicDatabase,
        null,
        2
      ),
      "utf8"
    );

    fs.renameSync(
      tempFile,
      MUSIC_DB_FILE
    );

    return true;
  } catch (error) {
    console.error(
      "Music database save error:",
      error
    );

    return false;
  }
}

function safeName(name) {
  return String(name || "audio")
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function isAudioFile(fileName) {
  const ext =
    path.extname(fileName)
      .toLowerCase();

  return AUDIO_EXTENSIONS.has(ext);
}

function getMimeType(fileName) {
  const ext =
    path.extname(fileName)
      .toLowerCase();

  return (
    MIME_TYPES[ext] ||
    "application/octet-stream"
  );
}

function generateId() {
  return crypto.randomUUID();
}

function generateCaptchaCode() {
  return String(
    Math.floor(
      1000 +
        Math.random() * 9000
    )
  );
}

function createCaptcha() {
  const captchaId =
    generateId();

  const code =
    generateCaptchaCode();

  captchaStore.set(
    captchaId,
    {
      code,
      createdAt: Date.now(),
      attempts: 0,
    }
  );

  return {
    captcha_id: captchaId,
    code,
    expires_in: 300,
  };
}

function cleanupCaptchaStore() {
  const now = Date.now();

  for (const [
    captchaId,
    captcha,
  ] of captchaStore.entries()) {
    if (
      now - captcha.createdAt >
      5 * 60 * 1000
    ) {
      captchaStore.delete(
        captchaId
      );
    }
  }
}

setInterval(
  cleanupCaptchaStore,
  60 * 1000
).unref();

function getFileInfo(fileName) {
  const cleanName = safeName(
    path.basename(fileName)
  );

  const fullPath = path.join(
    MUSIC_DIR,
    cleanName
  );

  if (
    !fs.existsSync(fullPath)
  ) {
    return null;
  }

  let stat;

  try {
    stat =
      fs.statSync(fullPath);
  } catch {
    return null;
  }

  if (!stat.isFile()) {
    return null;
  }

  if (
    !isAudioFile(cleanName)
  ) {
    return null;
  }

  return {
    file: cleanName,
    path: fullPath,
    size: stat.size,
    mime: getMimeType(cleanName),
    modified_at:
      stat.mtime.toISOString(),
  };
}

function getPhysicalMusicFiles() {
  ensureDirectory(MUSIC_DIR);

  let entries = [];

  try {
    entries =
      fs.readdirSync(
        MUSIC_DIR,
        {
          withFileTypes: true,
        }
      );
  } catch (error) {
    console.error(
      "Music directory read error:",
      error
    );

    return [];
  }

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        isAudioFile(
          entry.name
        )
    )
    .map(
      (entry) => {
        const info =
          getFileInfo(
            entry.name
          );

        return info;
      }
    )
    .filter(Boolean);
}

function makeTrackFromFile(
  fileName
) {
  const file =
    getFileInfo(fileName);

  if (!file) {
    return null;
  }

  const extension =
    path.extname(
      file.file
    );

  const baseName =
    path.basename(
      file.file,
      extension
    );

  let existing =
    musicDatabase.tracks.find(
      (track) =>
        track.file_name ===
        file.file
    );

  if (!existing) {
    existing = {
      id: generateId(),
      title: baseName,
      artist_name:
        "Fenix Music",
      album_name:
        "Fenix Music",
      cover_url:
        "/music-cover.svg",
      audio_url:
        "/api/music/audio/" +
        encodeURIComponent(
          file.file
        ),
      duration: 0,
      plays_count: 0,
      favorite: false,
      file_name:
        file.file,
      mime: file.mime,
      size: file.size,
      created_at:
        new Date().toISOString(),
    };

    musicDatabase.tracks.push(
      existing
    );

    saveMusicDatabase();
  }

  existing.title =
    existing.title ||
    baseName;

  existing.artist_name =
    existing.artist_name ||
    "Fenix Music";

  existing.album_name =
    existing.album_name ||
    "Fenix Music";

  existing.cover_url =
    existing.cover_url ||
    "/music-cover.svg";

  existing.audio_url =
    "/api/music/audio/" +
    encodeURIComponent(
      file.file
    );

  existing.mime =
    file.mime;

  existing.size =
    file.size;

  existing.file_name =
    file.file;

  return {
    ...existing,
  };
}

function getTracks() {
  const files =
    getPhysicalMusicFiles();

  const tracks =
    files
      .map((file) =>
        makeTrackFromFile(
          file.file
        )
      )
      .filter(Boolean);

  const physicalNames =
    new Set(
      files.map(
        (file) => file.file
      )
    );

  const before =
    musicDatabase.tracks.length;

  musicDatabase.tracks =
    musicDatabase.tracks.filter(
      (track) =>
        physicalNames.has(
          track.file_name
        )
    );

  if (
    musicDatabase.tracks.length !==
    before
  ) {
    saveMusicDatabase();
  }

  return tracks;
}

function findAudioFile(
  fileName
) {
  if (!fileName) {
    return null;
  }

  const requested =
    safeName(
      path.basename(
        decodeURIComponent(
          String(fileName)
        )
      )
    );

  const fullPath =
    path.join(
      MUSIC_DIR,
      requested
    );

  const musicRoot =
    path.resolve(
      MUSIC_DIR
    );

  const resolved =
    path.resolve(
      fullPath
    );

  if (
    resolved !== musicRoot &&
    !resolved.startsWith(
      musicRoot +
        path.sep
    )
  ) {
    return null;
  }

  if (
    !fs.existsSync(
      resolved
    )
  ) {
    return null;
  }

  let stat;

  try {
    stat =
      fs.statSync(
        resolved
      );
  } catch {
    return null;
  }

  if (
    !stat.isFile() ||
    !isAudioFile(
      requested
    )
  ) {
    return null;
  }

  return {
    file: requested,
    path: resolved,
    mime: getMimeType(
      requested
    ),
    size: stat.size,
  };
}

function registerMusicRoutes() {
  app.get(
    "/api/music",
    (req, res) => {
      try {
        const tracks =
          getTracks();

        res.json({
          ok: true,
          tracks,
          count:
            tracks.length,
        });
      } catch (error) {
        console.error(
          "GET /api/music:",
          error
        );

        res.status(500).json({
          ok: false,
          error:
            "Не удалось получить музыку",
          tracks: [],
        });
      }
    }
  );

  app.get(
    "/api/music/tracks",
    (req, res) => {
      try {
        const tracks =
          getTracks();

        res.json({
          ok: true,
          tracks,
          count:
            tracks.length,
        });
      } catch (error) {
        console.error(
          "GET /api/music/tracks:",
          error
        );

        res.status(500).json({
          ok: false,
          error:
            "Не удалось получить треки",
          tracks: [],
        });
      }
    }
  );

  app.get(
    "/api/music/stats",
    (req, res) => {
      try {
        const tracks =
          getTracks();

        const totalPlays =
          tracks.reduce(
            (sum, track) =>
              sum +
              Number(
                track.plays_count ||
                  0
              ),
            0
          );

        res.json({
          ok: true,
          tracks:
            tracks.length,
          total_plays:
            totalPlays,
        });
      } catch (error) {
        res.status(500).json({
          ok: false,
          error:
            "Не удалось получить статистику",
        });
      }
    }
  );

  app.get(
    "/api/music/audio/:file",
    streamAudio
  );
}

function streamAudio(
  req,
  res
) {
  try {
    const fileName =
      req.params.file;

    const audio =
      findAudioFile(
        fileName
      );

    if (!audio) {
      return res.status(404).json({
        ok: false,
        error:
          "Аудиофайл не найден",
      });
    }

    const stat =
      fs.statSync(
        audio.path
      );

    const range =
      req.headers.range;

    res.setHeader(
      "Accept-Ranges",
      "bytes"
    );

    res.setHeader(
      "Content-Type",
      audio.mime
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600"
    );

    if (!range) {
      res.setHeader(
        "Content-Length",
        stat.size
      );

      return fs
        .createReadStream(
          audio.path
        )
        .pipe(res);
    }

    const match =
      /^bytes=(\d*)-(\d*)$/.exec(
        range
      );

    if (!match) {
      res.setHeader(
        "Content-Range",
        `bytes */${stat.size}`
      );

      return res
        .status(416)
        .end();
    }

    let start =
      match[1]
        ? Number(match[1])
        : 0;

    let end =
      match[2]
        ? Number(match[2])
        : stat.size - 1;

    if (
      !Number.isFinite(
        start
      ) ||
      !Number.isFinite(
        end
      )
    ) {
      res.setHeader(
        "Content-Range",
        `bytes */${stat.size}`
      );

      return res
        .status(416)
        .end();
    }

    if (
      !match[1] &&
      match[2]
    ) {
      const suffixLength =
        Number(match[2]);

      if (
        suffixLength <= 0
      ) {
        res.setHeader(
          "Content-Range",
          `bytes */${stat.size}`
        );

        return res
          .status(416)
          .end();
      }

      start = Math.max(
        0,
        stat.size -
          suffixLength
      );

      end =
        stat.size - 1;
    }

    if (
      start < 0 ||
      start >= stat.size ||
      end < start
    ) {
      res.setHeader(
        "Content-Range",
        `bytes */${stat.size}`
      );

      return res
        .status(416)
        .end();
    }

    end = Math.min(
      end,
      stat.size - 1
    );

    const chunkSize =
      end - start + 1;

    res.status(206);

    res.setHeader(
      "Content-Range",
      `bytes ${start}-${end}/${stat.size}`
    );

    res.setHeader(
      "Content-Length",
      chunkSize
    );

    return fs
      .createReadStream(
        audio.path,
        {
          start,
          end,
        }
      )
      .pipe(res);
  } catch (error) {
    console.error(
      "Audio streaming error:",
      error
    );

    if (
      !res.headersSent
    ) {
      return res
        .status(500)
        .json({
          ok: false,
          error:
            "Ошибка воспроизведения аудио",
        });
    }
  }
}

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

app.disable("x-powered-by");

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service:
        "Fenix Music",
      status:
        "online",
      time:
        new Date().toISOString(),
    });
  }
);

app.get(
  "/api",
  (req, res) => {
    res.json({
      ok: true,
      name:
        "Fenix Music API",
      version:
        "3.0.0",
      status:
        "online",
      endpoints: {
        health:
          "/api/health",
        captcha:
          "/api/captcha",
        music:
          "/api/music",
        tracks:
          "/api/music/tracks",
        audio:
          "/api/music/audio/:file",
      },
    });
  }
);

app.get(
  "/api/captcha",
  (req, res) => {
    try {
      const captcha =
        createCaptcha();

      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );

      res.setHeader(
        "Pragma",
        "no-cache"
      );

      res.setHeader(
        "Expires",
        "0"
      );

      res.json({
        ok: true,
        captcha_id:
          captcha.captcha_id,
        code:
          captcha.code,
        expires_in:
          captcha.expires_in,
      });
    } catch (error) {
      console.error(
        "CAPTCHA generation error:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось создать CAPTCHA",
      });
    }
  }
);

app.post(
  "/api/captcha",
  (req, res) => {
    try {
      const captcha =
        createCaptcha();

      res.setHeader(
        "Cache-Control",
        "no-store"
      );

      res.json({
        ok: true,
        captcha_id:
          captcha.captcha_id,
        code:
          captcha.code,
        expires_in:
          captcha.expires_in,
      });
    } catch (error) {
      console.error(
        "CAPTCHA generation error:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось создать CAPTCHA",
      });
    }
  }
);

app.post(
  "/api/captcha/verify",
  (req, res) => {
    try {
      const {
        captcha_id,
        code,
      } = req.body || {};

      if (
        !captcha_id ||
        !code
      ) {
        return res.status(400).json({
          ok: false,
          valid: false,
          error:
            "Введите CAPTCHA",
        });
      }

      const captcha =
        captchaStore.get(
          String(captcha_id)
        );

      if (!captcha) {
        return res.status(400).json({
          ok: false,
          valid: false,
          error:
            "CAPTCHA устарела. Получите новую.",
          regenerate: true,
        });
      }

      if (
        Date.now() -
          captcha.createdAt >
        5 * 60 * 1000
      ) {
        captchaStore.delete(
          String(captcha_id)
        );

        return res.status(400).json({
          ok: false,
          valid: false,
          error:
            "CAPTCHA истекла. Получите новую.",
          regenerate: true,
        });
      }

      captcha.attempts += 1;

      if (
        captcha.attempts > 10
      ) {
        captchaStore.delete(
          String(captcha_id)
        );

        return res.status(429).json({
          ok: false,
          valid: false,
          error:
            "Слишком много попыток. Получите новую CAPTCHA.",
          regenerate: true,
        });
      }

      const userCode =
        String(code)
          .trim();

      const valid =
        userCode ===
        captcha.code;

      if (valid) {
        captchaStore.delete(
          String(captcha_id)
        );

        return res.json({
          ok: true,
          valid: true,
          message:
            "CAPTCHA пройдена",
        });
      }

      return res.status(400).json({
        ok: true,
        valid: false,
        error:
          "Неверный код CAPTCHA",
      });
    } catch (error) {
      console.error(
        "CAPTCHA verification error:",
        error
      );

      res.status(500).json({
        ok: false,
        valid: false,
        error:
          "Ошибка проверки CAPTCHA",
      });
    }
  }
);

app.post(
  "/api/captcha/check",
  (req, res) => {
    try {
      const {
        captcha_id,
        code,
      } = req.body || {};

      const captcha =
        captchaStore.get(
          String(captcha_id || "")
        );

      if (!captcha) {
        return res.status(400).json({
          ok: false,
          valid: false,
          error:
            "CAPTCHA устарела",
          regenerate: true,
        });
      }

      if (
        Date.now() -
          captcha.createdAt >
        5 * 60 * 1000
      ) {
        captchaStore.delete(
          String(captcha_id)
        );

        return res.status(400).json({
          ok: false,
          valid: false,
          error:
            "CAPTCHA истекла",
          regenerate: true,
        });
      }

      const valid =
        String(code || "")
          .trim() ===
        captcha.code;

      if (valid) {
        captchaStore.delete(
          String(captcha_id)
        );
      }

      res.json({
        ok: true,
        valid,
      });
    } catch (error) {
      console.error(
        "CAPTCHA check error:",
        error
      );

      res.status(500).json({
        ok: false,
        valid: false,
        error:
          "Ошибка проверки CAPTCHA",
      });
    }
  }
);

registerMusicRoutes();

app.post(
  "/api/music/play",
  (req, res) => {
    try {
      const {
        id,
        file_name,
      } = req.body || {};

      let track = null;

      if (id) {
        track =
          musicDatabase.tracks.find(
            (item) =>
              item.id ===
              String(id)
          );
      }

      if (
        !track &&
        file_name
      ) {
        track =
          musicDatabase.tracks.find(
            (item) =>
              item.file_name ===
              safeName(
                file_name
              )
          );
      }

      if (!track) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден",
        });
      }

      track.plays_count =
        Number(
          track.plays_count || 0
        ) + 1;

      saveMusicDatabase();

      res.json({
        ok: true,
        track,
      });
    } catch (error) {
      console.error(
        "Music play error:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить прослушивание",
      });
    }
  }
);

app.post(
  "/api/music/favorite",
  (req, res) => {
    try {
      const {
        id,
        favorite,
      } = req.body || {};

      const track =
        musicDatabase.tracks.find(
          (item) =>
            item.id ===
            String(id || "")
        );

      if (!track) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден",
        });
      }

      track.favorite =
        Boolean(favorite);

      saveMusicDatabase();

      res.json({
        ok: true,
        favorite:
          track.favorite,
        track,
      });
    } catch (error) {
      console.error(
        "Favorite error:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить избранное",
      });
    }
  }
);

app.get(
  "/api/music/favorites",
  (req, res) => {
    try {
      const tracks =
        getTracks().filter(
          (track) =>
            track.favorite ===
            true
        );

      res.json({
        ok: true,
        tracks,
        count:
          tracks.length,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить избранное",
        tracks: [],
      });
    }
  }
);

app.get(
  "/api/music/recent",
  (req, res) => {
    try {
      const tracks =
        getTracks()
          .filter(
            (track) =>
              Number(
                track.plays_count ||
                  0
              ) > 0
          )
          .sort(
            (a, b) =>
              Number(
                b.plays_count ||
                  0
              ) -
              Number(
                a.plays_count ||
                  0
              )
          );

      res.json({
        ok: true,
        tracks,
        count:
          tracks.length,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить историю",
        tracks: [],
      });
    }
  }
);

app.get(
  "/api/music/search",
  (req, res) => {
    try {
      const query =
        String(
          req.query.q || ""
        )
          .trim()
          .toLowerCase();

      const tracks =
        getTracks();

      if (!query) {
        return res.json({
          ok: true,
          tracks,
          count:
            tracks.length,
        });
      }

      const result =
        tracks.filter(
          (track) => {
            const text = [
              track.title,
              track.artist_name,
              track.album_name,
              track.file_name,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return text.includes(
              query
            );
          }
        );

      res.json({
        ok: true,
        tracks: result,
        count:
          result.length,
      });
    } catch (error) {
      console.error(
        "Music search error:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Ошибка поиска",
        tracks: [],
      });
    }
  }
);

app.get(
  "/api/music/cover",
  (req, res) => {
    const cover =
      path.join(
        ROOT_DIR,
        "music-cover.svg"
      );

    if (
      fs.existsSync(cover)
    ) {
      return res.sendFile(
        cover
      );
    }

    res.status(404).end();
  }
);

app.get(
  "/music-cover.svg",
  (req, res) => {
    const cover =
      path.join(
        ROOT_DIR,
        "music-cover.svg"
      );

    if (
      fs.existsSync(cover)
    ) {
      return res.sendFile(
        cover
      );
    }

    res
      .type("svg")
      .send(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
          <rect width="512" height="512" fill="#111"/>
          <circle cx="256" cy="256" r="160" fill="#e11"/>
          <circle cx="256" cy="256" r="55" fill="#111"/>
          <path d="M310 105v210" stroke="#fff" stroke-width="28" stroke-linecap="round"/>
          <path d="M310 105h95" stroke="#fff" stroke-width="28" stroke-linecap="round"/>
          <path d="M405 105v120" stroke="#fff" stroke-width="28" stroke-linecap="round"/>
        </svg>`
      );
  }
);

if (
  fs.existsSync(
    FRONTEND_DIST
  )
) {
  app.use(
    express.static(
      FRONTEND_DIST,
      {
        index: false,
        maxAge:
          process.env.NODE_ENV ===
          "production"
            ? "1h"
            : 0,
      }
    )
  );

  app.get(
    /^\/(?!api(?:\/|$)).*/,
    (req, res) => {
      const indexFile =
        path.join(
          FRONTEND_DIST,
          "index.html"
        );

      if (
        fs.existsSync(
          indexFile
        )
      ) {
        return res.sendFile(
          indexFile
        );
      }

      return res.status(404).send(
        "Frontend index.html не найден."
      );
    }
  );

  log(
    "Frontend:",
    FRONTEND_DIST
  );
} else {
  log(
    "Frontend dist не найден. Backend работает без frontend."
  );
}

app.use(
  (req, res) => {
    if (
      req.path.startsWith(
        "/api/"
      )
    ) {
      return res.status(404).json({
        ok: false,
        error:
          "API endpoint не найден",
        path: req.path,
      });
    }

    return res.status(404).send(
      "Страница не найдена"
    );
  }
);

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500).json({
      ok: false,
      error:
        "Внутренняя ошибка сервера",
    });
  }
);

ensureStorage();

const server =
  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      log(
        `Fenix Music запущен на порту ${PORT}`
      );

      log(
        `Music directory: ${MUSIC_DIR}`
      );

      log(
        `Music tracks: ${getTracks().length}`
      );

      log(
        `Frontend dist: ${
          fs.existsSync(
            FRONTEND_DIST
          )
        }`
      );
    }
  );

server.on(
  "error",
  (error) => {
    console.error(
      "Server error:",
      error
    );

    process.exit(1);
  }
);

process.on(
  "SIGTERM",
  () => {
    log(
      "SIGTERM received. Shutting down..."
    );

    server.close(
      () => {
        process.exit(0);
      }
    );
  }
);

process.on(
  "SIGINT",
  () => {
    log(
      "SIGINT received. Shutting down..."
    );

    server.close(
      () => {
        process.exit(0);
      }
    );
  }
);

module.exports = {
  app,
  server,
  MUSIC_DIR,
  DATA_DIR,
  ensureStorage,
  getTracks,
  findAudioFile,
  streamAudio,
  createCaptcha,
};
