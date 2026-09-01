"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");

const MUSIC_DIR = path.join(__dirname, "..", "storage", "music");
const COVERS_DIR = path.join(__dirname, "..", "storage", "covers");

function ensureStorage() {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

ensureStorage();

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".oga",
  ".m4a",
  ".aac",
  ".flac",
  ".webm"
]);

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

function cleanName(value, fallback = "file") {
  return String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 120) || fallback;
}

function extensionFromName(name, fallback = ".bin") {
  const ext = path.extname(String(name || "")).toLowerCase();

  if (!ext) {
    return fallback;
  }

  return ext;
}

function isAudioFile(filename) {
  return AUDIO_EXTENSIONS.has(
    extensionFromName(filename)
  );
}

function isImageFile(filename) {
  return IMAGE_EXTENSIONS.has(
    extensionFromName(filename)
  );
}

function makeId() {
  return crypto.randomBytes(16).toString("hex");
}

function audioFilePath(filename) {
  return path.join(MUSIC_DIR, filename);
}

function coverFilePath(filename) {
  return path.join(COVERS_DIR, filename);
}

function audioUrl(filename) {
  return `/media/music/${encodeURIComponent(filename)}`;
}

function coverUrl(filename) {
  return `/media/covers/${encodeURIComponent(filename)}`;
}

/*
 * Сохраняет Buffer с аудиофайлом.
 */
async function saveAudioBuffer(buffer, originalName) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Audio buffer is required");
  }

  const ext = extensionFromName(
    originalName,
    ".mp3"
  );

  if (!AUDIO_EXTENSIONS.has(ext)) {
    throw new Error(
      `Неподдерживаемый формат аудио: ${ext}`
    );
  }

  const filename =
    `${Date.now()}_${makeId()}` +
    ext;

  const destination =
    audioFilePath(filename);

  await fs.promises.writeFile(
    destination,
    buffer
  );

  return {
    filename,
    path: destination,
    url: audioUrl(filename),
    size: buffer.length
  };
}

/*
 * Сохраняет аудио из обычного Readable stream.
 */
async function saveAudioStream(
  stream,
  originalName
) {
  if (!stream) {
    throw new Error("Audio stream is required");
  }

  const ext = extensionFromName(
    originalName,
    ".mp3"
  );

  if (!AUDIO_EXTENSIONS.has(ext)) {
    throw new Error(
      `Неподдерживаемый формат аудио: ${ext}`
    );
  }

  const filename =
    `${Date.now()}_${makeId()}` +
    ext;

  const destination =
    audioFilePath(filename);

  await pipeline(
    stream,
    fs.createWriteStream(destination)
  );

  const stat =
    await fs.promises.stat(destination);

  return {
    filename,
    path: destination,
    url: audioUrl(filename),
    size: stat.size
  };
}

/*
 * Сохраняет обложку.
 */
async function saveCoverBuffer(
  buffer,
  originalName
) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Cover buffer is required");
  }

  const ext = extensionFromName(
    originalName,
    ".jpg"
  );

  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(
      `Неподдерживаемый формат изображения: ${ext}`
    );
  }

  const filename =
    `${Date.now()}_${makeId()}` +
    ext;

  const destination =
    coverFilePath(filename);

  await fs.promises.writeFile(
    destination,
    buffer
  );

  return {
    filename,
    path: destination,
    url: coverUrl(filename),
    size: buffer.length
  };
}

/*
 * Удаление аудио.
 */
async function deleteAudio(filename) {
  if (!filename) {
    return false;
  }

  const safeFilename =
    path.basename(filename);

  const file =
    audioFilePath(safeFilename);

  try {
    await fs.promises.unlink(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

/*
 * Удаление обложки.
 */
async function deleteCover(filename) {
  if (!filename) {
    return false;
  }

  const safeFilename =
    path.basename(filename);

  const file =
    coverFilePath(safeFilename);

  try {
    await fs.promises.unlink(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

/*
 * Проверяет существование файла.
 */
async function audioExists(filename) {
  if (!filename) {
    return false;
  }

  try {
    await fs.promises.access(
      audioFilePath(path.basename(filename)),
      fs.constants.F_OK
    );

    return true;
  } catch {
    return false;
  }
}

async function coverExists(filename) {
  if (!filename) {
    return false;
  }

  try {
    await fs.promises.access(
      coverFilePath(path.basename(filename)),
      fs.constants.F_OK
    );

    return true;
  } catch {
    return false;
  }
}

/*
 * Возвращает абсолютный путь к аудио,
 * только если файл реально существует.
 */
async function resolveAudioPath(filename) {
  if (!filename) {
    return null;
  }

  const safeFilename =
    path.basename(filename);

  if (!(await audioExists(safeFilename))) {
    return null;
  }

  return audioFilePath(safeFilename);
}

/*
 * Возвращает абсолютный путь к обложке.
 */
async function resolveCoverPath(filename) {
  if (!filename) {
    return null;
  }

  const safeFilename =
    path.basename(filename);

  if (!(await coverExists(safeFilename))) {
    return null;
  }

  return coverFilePath(safeFilename);
}

/*
 * Информация о хранилище.
 */
async function storageInfo() {
  ensureStorage();

  const musicFiles =
    await fs.promises.readdir(MUSIC_DIR);

  const coverFiles =
    await fs.promises.readdir(COVERS_DIR);

  let musicSize = 0;
  let coverSize = 0;

  for (const filename of musicFiles) {
    try {
      const stat =
        await fs.promises.stat(
          audioFilePath(filename)
        );

      if (stat.isFile()) {
        musicSize += stat.size;
      }
    } catch {}
  }

  for (const filename of coverFiles) {
    try {
      const stat =
        await fs.promises.stat(
          coverFilePath(filename)
        );

      if (stat.isFile()) {
        coverSize += stat.size;
      }
    } catch {}
  }

  return {
    musicFiles: musicFiles.length,
    coverFiles: coverFiles.length,
    musicBytes: musicSize,
    coverBytes: coverSize,
    totalBytes: musicSize + coverSize
  };
}

/*
 * Нормализует данные трека перед записью в БД.
 *
 * audioFile и coverFile приходят из saveAudioBuffer/
 * saveAudioStream/saveCoverBuffer.
 */
function buildTrackData({
  title,
  artistName,
  albumName,
  duration,
  audioFile,
  coverFile
}) {
  return {
    title:
      String(title || "Без названия")
        .trim()
        .slice(0, 255),

    artist_name:
      String(artistName || "Unknown")
        .trim()
        .slice(0, 255),

    album_name:
      String(albumName || "")
        .trim()
        .slice(0, 255),

    duration:
      Math.max(
        0,
        Number.parseInt(duration, 10) || 0
      ),

    audio_filename:
      audioFile?.filename || null,

    audio_url:
      audioFile?.url || "",

    cover_filename:
      coverFile?.filename || null,

    cover_url:
      coverFile?.url || ""
  };
}

/*
 * Приводит строку из PostgreSQL к данным,
 * которые ожидает frontend.
 */
function normalizeTrack(track) {
  if (!track) {
    return null;
  }

  return {
    ...track,

    id: track.id != null
      ? String(track.id)
      : track.id,

    title:
      track.title || "Без названия",

    artist_name:
      track.artist_name || "Unknown",

    album_name:
      track.album_name || "",

    cover_url:
      track.cover_url || "",

    audio_url:
      track.audio_url || "",

    duration:
      Number(track.duration || 0),

    plays_count:
      Number(track.plays_count || 0)
  };
}

/*
 * Добавляет middleware для статических
 * музыкальных файлов.
 *
 * Использование в index.js:
 *
 * const {
 *   createMusicMiddleware
 * } = require("./music");
 *
 * app.use(
 *   "/media/music",
 *   createMusicMiddleware()
 * );
 */
function createMusicMiddleware() {
  const express = require("express");

  return express.static(MUSIC_DIR, {
    fallthrough: false,
    index: false,
    maxAge: "1h"
  });
}

/*
 * Middleware для обложек.
 */
function createCoverMiddleware() {
  const express = require("express");

  return express.static(COVERS_DIR, {
    fallthrough: false,
    index: false,
    maxAge: "1h"
  });
}

/*
 * Удобная функция для удаления
 * файлов, если создание трека
 * в PostgreSQL завершилось ошибкой.
 */
async function cleanupFiles({
  audioFilename,
  coverFilename
} = {}) {
  const result = {
    audioDeleted: false,
    coverDeleted: false
  };

  if (audioFilename) {
    result.audioDeleted =
      await deleteAudio(audioFilename);
  }

  if (coverFilename) {
    result.coverDeleted =
      await deleteCover(coverFilename);
  }

  return result;
}

/*
 * Экспортируем всё, что понадобится
 * src/index.js и боту.
 */
module.exports = {
  MUSIC_DIR,
  COVERS_DIR,

  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,

  ensureStorage,

  cleanName,
  extensionFromName,

  isAudioFile,
  isImageFile,

  makeId,

  audioFilePath,
  coverFilePath,

  audioUrl,
  coverUrl,

  saveAudioBuffer,
  saveAudioStream,
  saveCoverBuffer,

  deleteAudio,
  deleteCover,

  audioExists,
  coverExists,

  resolveAudioPath,
  resolveCoverPath,

  storageInfo,

  buildTrackData,
  normalizeTrack,

  createMusicMiddleware,
  createCoverMiddleware,

  cleanupFiles
};
