"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MUSIC_DIR =
  process.env.MUSIC_DIR ||
  path.join(__dirname, "..", "music");

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac",
  ".webm",
]);

function ensureStorage() {
  if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, {
      recursive: true,
    });
  }
}

function ensureMusicDir() {
  ensureStorage();
}

function safeName(name) {
  return String(name || "audio")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function isAudioFile(fileName) {
  const ext = path
    .extname(String(fileName))
    .toLowerCase();

  return AUDIO_EXTENSIONS.has(ext);
}

function getMimeType(fileName) {
  const ext = path
    .extname(String(fileName))
    .toLowerCase();

  const types = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
  };

  return (
    types[ext] ||
    "application/octet-stream"
  );
}

function getMusicDir() {
  ensureStorage();
  return MUSIC_DIR;
}

function listAudioFiles() {
  ensureStorage();

  return fs
    .readdirSync(MUSIC_DIR, {
      withFileTypes: true,
    })
    .filter(
      (entry) =>
        entry.isFile() &&
        isAudioFile(entry.name)
    )
    .map((entry) => {
      const fullPath = path.join(
        MUSIC_DIR,
        entry.name
      );

      const stat = fs.statSync(fullPath);

      return {
        file: entry.name,
        path: fullPath,
        size: stat.size,
        modified_at:
          stat.mtime.toISOString(),
        mime: getMimeType(entry.name),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.modified_at) -
        new Date(a.modified_at)
    );
}

function findAudioFile(fileName) {
  ensureStorage();

  if (!fileName) {
    return null;
  }

  const requested = safeName(
    path.basename(String(fileName))
  );

  if (!isAudioFile(requested)) {
    return null;
  }

  const fullPath = path.join(
    MUSIC_DIR,
    requested
  );

  if (
    fs.existsSync(fullPath) &&
    fs.statSync(fullPath).isFile()
  ) {
    return {
      file: requested,
      path: fullPath,
      mime: getMimeType(requested),
    };
  }

  return null;
}

function makeTrackFromFile(fileName) {
  const file = findAudioFile(fileName);

  if (!file) {
    return null;
  }

  const baseName = path.basename(
    file.file,
    path.extname(file.file)
  );

  const id = crypto
    .createHash("sha1")
    .update(file.file)
    .digest("hex")
    .slice(0, 16);

  return {
    id,

    title: baseName,

    artist_name: "Fenix Music",

    album_name: "Fenix Music",

    cover_url:
      "/music-cover.svg",

    audio_url:
      "/api/music/audio/" +
      encodeURIComponent(file.file),

    duration: 0,

    plays_count: 0,

    file_name: file.file,

    mime: file.mime,

    size: fs.statSync(file.path).size,
  };
}

function getTracks() {
  ensureStorage();

  return listAudioFiles()
    .map((item) =>
      makeTrackFromFile(item.file)
    )
    .filter(Boolean);
}

function resolveAudio(req, res) {
  try {
    const fileName =
      req.params.file ||
      req.params.filename ||
      req.params.name;

    const audio =
      findAudioFile(fileName);

    if (!audio) {
      return res.status(404).json({
        ok: false,
        error: "Аудиофайл не найден",
      });
    }

    const stat = fs.statSync(
      audio.path
    );

    const range = req.headers.range;

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

      const stream =
        fs.createReadStream(
          audio.path
        );

      stream.on("error", (error) => {
        console.error(
          "Audio stream error:",
          error
        );

        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy();
        }
      });

      return stream.pipe(res);
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

    let start = match[1]
      ? Number(match[1])
      : 0;

    let end = match[2]
      ? Number(match[2])
      : stat.size - 1;

    if (!Number.isFinite(start)) {
      start = 0;
    }

    if (!Number.isFinite(end)) {
      end = stat.size - 1;
    }

    if (
      start < 0 ||
      end < 0 ||
      start >= stat.size ||
      end >= stat.size ||
      start > end
    ) {
      res.setHeader(
        "Content-Range",
        `bytes */${stat.size}`
      );

      return res
        .status(416)
        .end();
    }

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

    const stream =
      fs.createReadStream(
        audio.path,
        {
          start,
          end,
        }
      );

    stream.on("error", (error) => {
      console.error(
        "Audio range stream error:",
        error
      );

      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy();
      }
    });

    return stream.pipe(res);
  } catch (error) {
    console.error(
      "Audio streaming error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        error:
          "Ошибка воспроизведения аудио",
      });
    }

    res.destroy();
  }
}

function registerMusicRoutes(app) {
  ensureStorage();

  app.get(
    "/api/music",
    (req, res) => {
      try {
        const tracks =
          getTracks();

        res.json({
          ok: true,
          tracks,
          count: tracks.length,
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
          count: tracks.length,
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
        });
      }
    }
  );

  app.get(
    "/api/music/audio/:file",
    resolveAudio
  );
}

module.exports = {
  MUSIC_DIR,
  AUDIO_EXTENSIONS,

  ensureStorage,
  ensureMusicDir,

  getMusicDir,
  listAudioFiles,
  findAudioFile,

  makeTrackFromFile,
  getTracks,

  resolveAudio,
  registerMusicRoutes,
};
