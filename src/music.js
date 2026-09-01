```js
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");

/*
=========================================================
FENIX MUSIC — MUSIC STORAGE
=========================================================

Этот модуль отвечает только за физические аудиофайлы.

Хранилище:

    backend/
    └── storage/
        └── music/

Файлы НЕ хранятся в PostgreSQL.

PostgreSQL хранит:
    audio_url

Например:

    /api/tracks/15/audio

При запросе backend отдаёт настоящий MP3-файл.

Поддерживается:
    - MP3
    - WAV
    - OGG
    - M4A
    - AAC
    - FLAC
    - WEBM

Поддерживается HTTP Range:
    bytes=0-1024

Это важно для:
    - перемотки
    - продолжения воспроизведения
    - мобильного Safari
    - Chrome
    - Firefox
    - HTML5 Audio
=========================================================
*/


// =======================================================
// PATHS
// =======================================================

const STORAGE_ROOT =
  process.env.MUSIC_STORAGE_PATH ||
  path.join(
    __dirname,
    "..",
    "storage",
    "music"
  );


// =======================================================
// SUPPORTED FORMATS
// =======================================================

const MIME_TYPES = {
  ".mp3": "audio/mpeg",
  ".mpeg": "audio/mpeg",
  ".mp4": "audio/mp4",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".webm": "audio/webm",
  ".flac": "audio/flac",
};


// =======================================================
// INIT STORAGE
// =======================================================

function ensureStorage() {
  fs.mkdirSync(
    STORAGE_ROOT,
    {
      recursive: true,
    }
  );

  return STORAGE_ROOT;
}


// =======================================================
// SAFE EXTENSION
// =======================================================

function getExtension(filename = "") {
  const ext = path
    .extname(filename)
    .toLowerCase();

  if (!MIME_TYPES[ext]) {
    return ".mp3";
  }

  return ext;
}


// =======================================================
// MIME
// =======================================================

function getMimeType(filename = "") {
  const ext =
    path.extname(filename)
      .toLowerCase();

  return (
    MIME_TYPES[ext] ||
    "application/octet-stream"
  );
}


// =======================================================
// SAFE FILE NAME
// =======================================================

function safeFilename(filename = "") {
  const ext =
    getExtension(filename);

  return (
    crypto
      .randomBytes(24)
      .toString("hex") +
    ext
  );
}


// =======================================================
// FILE PATH
// =======================================================

function getFilePath(filename) {
  ensureStorage();

  const clean =
    path.basename(filename);

  const full =
    path.resolve(
      STORAGE_ROOT,
      clean
    );

  const root =
    path.resolve(
      STORAGE_ROOT
    );

  if (
    full !== root &&
    !full.startsWith(
      root + path.sep
    )
  ) {
    throw new Error(
      "Invalid music file path"
    );
  }

  return full;
}


// =======================================================
// SAVE BUFFER
// =======================================================

async function saveBuffer(
  buffer,
  originalName = "audio.mp3"
) {
  if (
    !buffer ||
    !Buffer.isBuffer(buffer)
  ) {
    throw new TypeError(
      "saveBuffer expects Buffer"
    );
  }

  ensureStorage();

  const filename =
    safeFilename(
      originalName
    );

  const filepath =
    getFilePath(
      filename
    );

  await fs.promises.writeFile(
    filepath,
    buffer
  );

  return {
    filename,
    filepath,
    size: buffer.length,
    mime: getMimeType(
      filename
    ),
  };
}


// =======================================================
// SAVE STREAM
// =======================================================

async function saveStream(
  stream,
  originalName = "audio.mp3"
) {
  ensureStorage();

  const filename =
    safeFilename(
      originalName
    );

  const filepath =
    getFilePath(
      filename
    );

  const output =
    fs.createWriteStream(
      filepath
    );

  try {
    await pipeline(
      stream,
      output
    );
  } catch (error) {

    try {
      await fs.promises.unlink(
        filepath
      );
    } catch {}

    throw error;
  }

  const stat =
    await fs.promises.stat(
      filepath
    );

  return {
    filename,
    filepath,
    size: stat.size,
    mime: getMimeType(
      filename
    ),
  };
}


// =======================================================
// SAVE TELEGRAM FILE
// =======================================================

async function saveFromUrl(
  url,
  originalName = "audio.mp3"
) {
  if (!url) {
    throw new Error(
      "Audio URL is required"
    );
  }

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Audio download failed: ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Audio response has no body"
    );
  }

  return saveStream(
    response.body,
    originalName
  );
}


// =======================================================
// CHECK FILE
// =======================================================

async function fileExists(
  filename
) {
  try {

    const filepath =
      getFilePath(
        filename
      );

    await fs.promises.access(
      filepath,
      fs.constants.F_OK
    );

    return true;

  } catch {
    return false;
  }
}


// =======================================================
// FILE INFO
// =======================================================

async function getFileInfo(
  filename
) {
  const filepath =
    getFilePath(
      filename
    );

  const stat =
    await fs.promises.stat(
      filepath
    );

  return {
    filename,
    filepath,
    size: stat.size,
    mime: getMimeType(
      filename
    ),
    createdAt:
      stat.birthtime,
    modifiedAt:
      stat.mtime,
  };
}


// =======================================================
// DELETE
// =======================================================

async function deleteFile(
  filename
) {
  const filepath =
    getFilePath(
      filename
    );

  try {

    await fs.promises.unlink(
      filepath
    );

    return true;

  } catch (error) {

    if (
      error.code ===
      "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}


// =======================================================
// STREAM AUDIO
// =======================================================

async function streamAudio(
  req,
  res,
  filename
) {
  try {

    const filepath =
      getFilePath(
        filename
      );

    const stat =
      await fs.promises.stat(
        filepath
      );

    const size =
      stat.size;

    const mime =
      getMimeType(
        filename
      );

    res.setHeader(
      "Content-Type",
      mime
    );

    res.setHeader(
      "Accept-Ranges",
      "bytes"
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );

    /*
    =====================================================
    NO RANGE
    =====================================================
    */

    if (!req.headers.range) {

      res.setHeader(
        "Content-Length",
        size
      );

      res.status(200);

      const stream =
        fs.createReadStream(
          filepath
        );

      stream.on(
        "error",
        (error) => {
          console.error(
            "Audio stream error:",
            error
          );

          if (!res.headersSent) {
            res.status(500);
          }

          res.end();
        }
      );

      stream.pipe(res);

      return;
    }


    /*
    =====================================================
    RANGE
    =====================================================
    */

    const range =
      req.headers.range;

    const match =
      range.match(
        /bytes=(\d*)-(\d*)/
      );

    if (!match) {

      res.status(416);

      res.setHeader(
        "Content-Range",
        `bytes */${size}`
      );

      res.end();

      return;
    }

    let start =
      match[1] === ""
        ? null
        : Number(match[1]);

    let end =
      match[2] === ""
        ? null
        : Number(match[2]);


    /*
    bytes=-500
    */

    if (
      start === null &&
      end !== null
    ) {
      const length =
        Math.min(
          end,
          size
        );

      start =
        size - length;

      end =
        size - 1;
    }


    /*
    bytes=500-
    */

    if (
      start !== null &&
      end === null
    ) {
      end =
        size - 1;
    }


    /*
    Validate
    */

    if (
      start === null ||
      end === null ||
      start < 0 ||
      end < start ||
      start >= size
    ) {

      res.status(416);

      res.setHeader(
        "Content-Range",
        `bytes */${size}`
      );

      res.end();

      return;
    }


    /*
    Clamp end
    */

    end =
      Math.min(
        end,
        size - 1
      );

    const chunkSize =
      end - start + 1;


    /*
    Headers
    */

    res.status(206);

    res.setHeader(
      "Content-Length",
      chunkSize
    );

    res.setHeader(
      "Content-Range",
      `bytes ${start}-${end}/${size}`
    );


    /*
    Stream
    */

    const stream =
      fs.createReadStream(
        filepath,
        {
          start,
          end,
        }
      );

    stream.on(
      "error",
      (error) => {
        console.error(
          "Audio range stream error:",
          error
        );

        if (!res.headersSent) {
          res.status(500);
        }

        res.end();
      }
    );

    stream.pipe(res);

  } catch (error) {

    if (
      error.code ===
      "ENOENT"
    ) {

      if (!res.headersSent) {
        res.status(404).json({
          ok: false,
          error:
            "Аудиофайл не найден",
        });
      }

      return;
    }

    console.error(
      "streamAudio error:",
      error
    );

    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error:
          "Ошибка чтения аудиофайла",
      });
    }
  }
}


// =======================================================
// LIST FILES
// =======================================================

async function listFiles() {
  ensureStorage();

  const entries =
    await fs.promises.readdir(
      STORAGE_ROOT,
      {
        withFileTypes: true,
      }
    );

  const result = [];

  for (
    const entry of entries
  ) {

    if (!entry.isFile()) {
      continue;
    }

    const ext =
      path.extname(
        entry.name
      ).toLowerCase();

    if (
      !MIME_TYPES[ext]
    ) {
      continue;
    }

    const filepath =
      path.join(
        STORAGE_ROOT,
        entry.name
      );

    const stat =
      await fs.promises.stat(
        filepath
      );

    result.push({
      filename:
        entry.name,

      size:
        stat.size,

      mime:
        getMimeType(
          entry.name
        ),

      modifiedAt:
        stat.mtime,
    });
  }

  return result;
}


// =======================================================
// STORAGE STATS
// =======================================================

async function storageStats() {
  const files =
    await listFiles();

  let total =
    0;

  for (
    const file of files
  ) {
    total +=
      Number(
        file.size || 0
      );
  }

  return {
    files:
      files.length,

    bytes:
      total,

    megabytes:
      Number(
        (
          total /
          1024 /
          1024
        ).toFixed(2)
      ),
  };
}


// =======================================================
// PUBLIC URL
// =======================================================

function audioUrl(
  filename,
  baseUrl = ""
) {
  if (!filename) {
    return "";
  }

  const clean =
    path.basename(
      filename
    );

  const prefix =
    String(
      baseUrl || ""
    ).replace(
      /\/$/,
      ""
    );

  return (
    prefix +
    "/api/music/" +
    encodeURIComponent(
      clean
    )
  );
}


// =======================================================
// EXPORT
// =======================================================

module.exports = {
  STORAGE_ROOT,

  MIME_TYPES,

  ensureStorage,

  getExtension,

  getMimeType,

  safeFilename,

  getFilePath,

  saveBuffer,

  saveStream,

  saveFromUrl,

  fileExists,

  getFileInfo,

  deleteFile,

  streamAudio,

  listFiles,

  storageStats,

  audioUrl,
};
```
