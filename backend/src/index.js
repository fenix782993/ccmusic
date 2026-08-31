"use strict";

/*
=========================================================
 FENIX MUSIC BACKEND 2.0.0
 Один файл: src/index.js

 Поддерживает App.js:
 - GET /
 - GET /api
 - GET /api/health
 - GET /api/tracks
 - GET /api/tracks/:id/audio
 - GET /api/auth/captcha
 - POST /api/auth/register
 - POST /api/auth/login
 - GET /api/auth/me
 - GET /api/profile
 - PUT /api/profile
 - GET /api/favorites
 - POST /api/favorites
 - DELETE /api/favorites/:trackId
 - POST /api/history
 - GET /api/history
 - GET /api/playlists
 - POST /api/playlists
 - PUT /api/playlists/:id
 - DELETE /api/playlists/:id
 - GET /api/notifications
 - POST /api/notifications
 - PATCH /api/notifications/read
 - DELETE /api/notifications
 - POST /api/tracks/:id/play
=========================================================
*/

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT || 10000);

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRESQL_URL;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.FRONTEND_URLS ||
  "*";

if (!DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL is not configured."
  );
  process.exit(1);
}

/* ======================================================
   EXPRESS
====================================================== */

app.disable("x-powered-by");

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

/* ======================================================
   POSTGRES
====================================================== */

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (error) => {
  console.error(
    "PostgreSQL pool error:",
    error
  );
});

/* ======================================================
   HELPERS
====================================================== */

function jsonError(
  res,
  status,
  message,
  extra = {}
) {
  return res.status(status).json({
    ok: false,
    error: message,
    ...extra,
  });
}

function randomId() {
  return crypto.randomUUID();
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function parseTrack(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title || "Без названия",

    artist_name:
      row.artist_name ||
      row.artist ||
      "Неизвестный артист",

    album_name:
      row.album_name ||
      row.album ||
      "Без альбома",

    genre: row.genre || "Неизвестно",

    duration: safeNumber(
      row.duration,
      0
    ),

    year:
      row.year !== null &&
      row.year !== undefined
        ? row.year
        : null,

    cover_url:
      row.cover_url ||
      row.album_cover_url ||
      null,

    album_cover_url:
      row.album_cover_url ||
      row.cover_url ||
      null,

    artist_avatar:
      row.artist_avatar ||
      null,

    audio_url:
      row.audio_url ||
      null,

    plays: safeNumber(
      row.plays_count,
      0
    ),

    plays_count: safeNumber(
      row.plays_count,
      0
    ),

    created_at:
      row.created_at || null,

    updated_at:
      row.updated_at || null,
  };
}

function getBearerToken(req) {
  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

function getToken(req) {
  return (
    getBearerToken(req) ||
    req.headers["x-auth-token"] ||
    req.query.token ||
    null
  );
}

/*
  Для этого простого backend токены хранятся
  в PostgreSQL в таблице sessions.
*/

async function getUserFromRequest(req) {
  const token = getToken(req);

  if (!token) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.email,
        u.bio,
        u.avatar_url,
        u.created_at,
        s.token
      FROM sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE s.token = $1
        AND (
          s.expires_at IS NULL
          OR s.expires_at > NOW()
        )
      LIMIT 1
    `,
    [token]
  );

  return result.rows[0] || null;
}

async function requireAuth(
  req,
  res,
  next
) {
  try {
    const user =
      await getUserFromRequest(req);

    if (!user) {
      return jsonError(
        res,
        401,
        "Требуется авторизация."
      );
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(
      "AUTH MIDDLEWARE:",
      error
    );

    return jsonError(
      res,
      500,
      "Ошибка проверки авторизации."
    );
  }
}

/* ======================================================
   DATABASE
====================================================== */

async function tableExists(
  tableName
) {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName]
  );

  return result.rows[0].exists;
}

async function columnExists(
  tableName,
  columnName
) {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName]
  );

  return result.rows[0].exists;
}

async function addColumnIfMissing(
  tableName,
  columnName,
  definition
) {
  if (
    !(await tableExists(tableName))
  ) {
    return;
  }

  const exists =
    await columnExists(
      tableName,
      columnName
    );

  if (!exists) {
    console.log(
      `Adding ${tableName}.${columnName}`
    );

    await pool.query(
      `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`
    );
  }
}

async function initDatabase() {
  console.log(
    "Connecting to PostgreSQL..."
  );

  const client =
    await pool.connect();

  try {
    await client.query(
      "SELECT 1"
    );

    console.log(
      "PostgreSQL connection OK"
    );

    /*
    =====================================================
    USERS
    =====================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username VARCHAR(32) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        bio TEXT DEFAULT '',
        avatar_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /*
    Старые базы могли не иметь этих колонок.
    Добавляем безопасно.
    */

    await addColumnIfMissing(
      "users",
      "bio",
      "TEXT DEFAULT ''"
    );

    await addColumnIfMissing(
      "users",
      "avatar_url",
      "TEXT"
    );

    await addColumnIfMissing(
      "users",
      "created_at",
      "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    );

    await addColumnIfMissing(
      "users",
      "updated_at",
      "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    );

    /*
    =====================================================
    TRACKS
    =====================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id BIGSERIAL PRIMARY KEY,

        title TEXT NOT NULL DEFAULT 'Без названия',

        artist_name TEXT NOT NULL DEFAULT 'Неизвестный артист',

        album_name TEXT DEFAULT 'Без альбома',

        genre TEXT DEFAULT 'Неизвестно',

        duration INTEGER NOT NULL DEFAULT 0,

        year INTEGER,

        cover_url TEXT,

        album_cover_url TEXT,

        artist_avatar TEXT,

        audio_url TEXT,

        audio_file_url TEXT,

        telegram_file_id TEXT,

        plays_count BIGINT NOT NULL DEFAULT 0,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /*
    ВАЖНО:
    Создаём plays_count ДО индекса.
    Это исправляет твою предыдущую ошибку:
    column "plays_count" does not exist
    */

    await addColumnIfMissing(
      "tracks",
      "title",
      "TEXT NOT NULL DEFAULT 'Без названия'"
    );

    await addColumnIfMissing(
      "tracks",
      "artist_name",
      "TEXT NOT NULL DEFAULT 'Неизвестный артист'"
    );

    await addColumnIfMissing(
      "tracks",
      "album_name",
      "TEXT DEFAULT 'Без альбома'"
    );

    await addColumnIfMissing(
      "tracks",
      "genre",
      "TEXT DEFAULT 'Неизвестно'"
    );

    await addColumnIfMissing(
      "tracks",
      "duration",
      "INTEGER NOT NULL DEFAULT 0"
    );

    await addColumnIfMissing(
      "tracks",
      "year",
      "INTEGER"
    );

    await addColumnIfMissing(
      "tracks",
      "cover_url",
      "TEXT"
    );

    await addColumnIfMissing(
      "tracks",
      "album_cover_url",
      "TEXT"
    );

    await addColumnIfMissing(
      "tracks",
      "artist_avatar",
      "TEXT"
    );

    await addColumnIfMissing(
      "tracks",
      "audio_url",
      "TEXT"
    );

    await addColumnIfMissing(
      "tracks",
      "audio_file_url",
      "TEXT"
    );

    await addColumnIfMissing(
      "tracks",
      "telegram_file_id",
      "TEXT"
    );

    await addColumnIfMissing(
      "tracks",
      "plays_count",
      "BIGINT NOT NULL DEFAULT 0"
    );

    await addColumnIfMissing(
      "tracks",
      "created_at",
      "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    );

    await addColumnIfMissing(
      "tracks",
      "updated_at",
      "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    );

    /*
    =====================================================
    SESSIONS
    =====================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )
    `);

    /*
    =====================================================
    FAVORITES
    =====================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, track_id)
      )
    `);

    /*
    =====================================================
    HISTORY
    =====================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS listening_history (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /*
    =====================================================
    PLAYLISTS
    =====================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /*
    =====================================================
    PLAYLIST TRACKS
    =====================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id BIGSERIAL PRIMARY KEY,
        playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(playlist_id, track_id)
      )
    `);

    /*
    =====================================================
    NOTIFICATIONS
    =====================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Новое уведомление',
        text TEXT NOT NULL DEFAULT '',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /*
    =====================================================
    CAPTCHA
    =====================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS captchas (
        id UUID PRIMARY KEY,
        code VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);

    /*
    =====================================================
    INDEXES
    =====================================================
    */

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tracks_plays
      ON tracks(plays_count DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tracks_created
      ON tracks(created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_history_user
      ON listening_history(user_id, played_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_favorites_user
      ON favorites(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_user
      ON playlists(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user
      ON notifications(user_id, created_at DESC)
    `);

    /*
    =====================================================
    UNIQUE USERS
    =====================================================
    */

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      idx_users_email_unique
      ON users(LOWER(email))
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      idx_users_username_unique
      ON users(LOWER(username))
    `);

    console.log(
      "Database initialization completed."
    );
  } finally {
    client.release();
  }
}

/* ======================================================
   ROOT
====================================================== */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Fenix Music Backend",
    version: "2.0.0",
    status: "online",
    api: "/api",
    health: "/api/health",
    tracks: "/api/tracks",
  });
});

app.get("/api", (req, res) => {
  res.json({
    ok: true,
    service: "Fenix Music API",
    version: "2.0.0",
    status: "online",

    endpoints: {
      health: "GET /api/health",
      tracks: "GET /api/tracks",
      audio: "GET /api/tracks/:id/audio",

      captcha:
        "GET /api/auth/captcha",

      register:
        "POST /api/auth/register",

      login:
        "POST /api/auth/login",

      me:
        "GET /api/auth/me",

      profile:
        "GET /api/profile",

      favorites:
        "GET /api/favorites",

      history:
        "GET /api/history",

      playlists:
        "GET /api/playlists",

      notifications:
        "GET /api/notifications",
    },
  });
});

/* ======================================================
   HEALTH
====================================================== */

app.get(
  "/api/health",
  async (req, res) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      res.json({
        ok: true,
        status: "online",
        database: "online",
        service:
          "Fenix Music Backend",
        version: "2.0.0",
        time:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "HEALTH:",
        error
      );

      res.status(503).json({
        ok: false,
        status: "degraded",
        database: "offline",
        error: error.message,
      });
    }
  }
);

/* ======================================================
   TRACKS
====================================================== */

app.get(
  "/api/tracks",
  async (req, res) => {
    try {
      const limit = Math.min(
        Math.max(
          Number(req.query.limit) ||
            100,
          1
        ),
        500
      );

      const offset = Math.max(
        Number(req.query.offset) ||
          0,
        0
      );

      const search =
        String(
          req.query.search || ""
        ).trim();

      let result;

      if (search) {
        result = await pool.query(
          `
            SELECT *
            FROM tracks
            WHERE
              title ILIKE $1
              OR artist_name ILIKE $1
              OR album_name ILIKE $1
              OR genre ILIKE $1
            ORDER BY created_at DESC
            LIMIT $2
            OFFSET $3
          `,
          [
            `%${search}%`,
            limit,
            offset,
          ]
        );
      } else {
        result = await pool.query(
          `
            SELECT *
            FROM tracks
            ORDER BY created_at DESC
            LIMIT $1
            OFFSET $2
          `,
          [limit, offset]
        );
      }

      const tracks =
        result.rows.map(parseTrack);

      res.json({
        ok: true,
        tracks,
        data: tracks,
        items: tracks,
        total: tracks.length,
      });
    } catch (error) {
      console.error(
        "GET /api/tracks:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось получить треки.",
        {
          details:
            process.env.NODE_ENV ===
            "production"
              ? undefined
              : error.message,
        }
      );
    }
  }
);

/* ======================================================
   SINGLE TRACK
====================================================== */

app.get(
  "/api/tracks/:id",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT *
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [req.params.id]
        );

      if (!result.rows.length) {
        return jsonError(
          res,
          404,
          "Трек не найден."
        );
      }

      res.json({
        ok: true,
        track: parseTrack(
          result.rows[0]
        ),
      });
    } catch (error) {
      console.error(
        "GET TRACK:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка получения трека."
      );
    }
  }
);

/* ======================================================
   AUDIO
====================================================== */

app.get(
  "/api/tracks/:id/audio",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              title,
              audio_url,
              audio_file_url
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [req.params.id]
        );

      if (!result.rows.length) {
        return jsonError(
          res,
          404,
          "Трек не найден."
        );
      }

      const track =
        result.rows[0];

      const audioUrl =
        track.audio_url ||
        track.audio_file_url ||
        null;

      if (!audioUrl) {
        return jsonError(
          res,
          404,
          "Для этого трека аудиофайл не указан."
        );
      }

      /*
        Если audio_url внешний URL,
        перенаправляем браузер на него.
      */

      return res.redirect(
        audioUrl
      );
    } catch (error) {
      console.error(
        "AUDIO:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка получения аудио."
      );
    }
  }
);

/* ======================================================
   PLAY COUNT
====================================================== */

app.post(
  "/api/tracks/:id/play",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            UPDATE tracks
            SET
              plays_count =
                COALESCE(plays_count, 0) + 1,
              updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `,
          [req.params.id]
        );

      if (!result.rows.length) {
        return jsonError(
          res,
          404,
          "Трек не найден."
        );
      }

      res.json({
        ok: true,
        track: parseTrack(
          result.rows[0]
        ),
      });
    } catch (error) {
      console.error(
        "PLAY COUNT:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось обновить счётчик."
      );
    }
  }
);

/* ======================================================
   CAPTCHA
====================================================== */

function createCaptchaCode() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i++) {
    result +=
      chars[
        Math.floor(
          Math.random() *
            chars.length
        )
      ];
  }

  return result;
}

app.get(
  "/api/auth/captcha",
  async (req, res) => {
    try {
      await pool.query(
        `
          DELETE FROM captchas
          WHERE expires_at < NOW()
        `
      );

      const id = randomId();

      const code =
        createCaptchaCode();

      await pool.query(
        `
          INSERT INTO captchas (
            id,
            code,
            expires_at
          )
          VALUES (
            $1,
            $2,
            NOW() + INTERVAL '10 minutes'
          )
        `,
        [id, code]
      );

      res.json({
        ok: true,
        id,
        captcha_id: id,
        text: code,
        code,
      });
    } catch (error) {
      console.error(
        "CAPTCHA:",
        error
      );

      /*
        Даже если база CAPTCHA временно
        недоступна, frontend сможет показать
        fallback CAPTCHA.
      */

      const code =
        createCaptchaCode();

      res.json({
        ok: true,
        id: null,
        captcha_id: null,
        text: code,
        code,
      });
    }
  }
);

/* ======================================================
   REGISTER
====================================================== */

app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const username =
        normalizeUsername(
          req.body.username
        );

      const email =
        normalizeEmail(
          req.body.email
        );

      const password =
        String(
          req.body.password || ""
        );

      const captcha =
        String(
          req.body.captcha || ""
        )
          .trim()
          .toUpperCase();

      const captchaId =
        req.body.captcha_id ||
        req.body.captchaId ||
        null;

      if (
        username.length < 3
      ) {
        return jsonError(
          res,
          400,
          "Username должен содержать минимум 3 символа."
        );
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        return jsonError(
          res,
          400,
          "Некорректный email."
        );
      }

      if (
        password.length < 6
      ) {
        return jsonError(
          res,
          400,
          "Пароль должен содержать минимум 6 символов."
        );
      }

      /*
      CAPTCHA проверяем только если
      frontend получил серверную CAPTCHA.
      */

      if (captchaId) {
        const captchaResult =
          await pool.query(
            `
              SELECT *
              FROM captchas
              WHERE id = $1
                AND expires_at > NOW()
              LIMIT 1
            `,
            [captchaId]
          );

        if (
          !captchaResult.rows.length
        ) {
          return jsonError(
            res,
            400,
            "CAPTCHA устарела. Получи новую."
          );
        }

        if (
          captchaResult.rows[0].code !==
          captcha
        ) {
          return jsonError(
            res,
            400,
            "Неверная CAPTCHA."
          );
        }

        await pool.query(
          `
            DELETE FROM captchas
            WHERE id = $1
          `,
          [captchaId]
        );
      }

      const existing =
        await pool.query(
          `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
               OR LOWER(username) = LOWER($2)
            LIMIT 1
          `,
          [
            email,
            username,
          ]
        );

      if (existing.rows.length) {
        return jsonError(
          res,
          409,
          "Пользователь с таким email или username уже существует."
        );
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const userId =
        randomId();

      const result =
        await pool.query(
          `
            INSERT INTO users (
              id,
              username,
              email,
              password_hash,
              bio
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              ''
            )
            RETURNING
              id,
              username,
              email,
              bio,
              avatar_url,
              created_at
          `,
          [
            userId,
            username,
            email,
            passwordHash,
          ]
        );

      const token =
        crypto.randomBytes(48)
          .toString("hex");

      await pool.query(
        `
          INSERT INTO sessions (
            id,
            user_id,
            token,
            expires_at
          )
          VALUES (
            $1,
            $2,
            $3,
            NOW() + INTERVAL '30 days'
          )
        `,
        [
          randomId(),
          userId,
          token,
        ]
      );

      res.status(201).json({
        ok: true,
        token,
        access_token: token,
        user: result.rows[0],
        account: result.rows[0],
      });
    } catch (error) {
      console.error(
        "REGISTER:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка регистрации."
      );
    }
  }
);

/* ======================================================
   LOGIN
====================================================== */

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const login =
        String(
          req.body.login ||
          req.body.email ||
          req.body.username ||
          ""
        ).trim();

      const password =
        String(
          req.body.password || ""
        );

      if (!login || !password) {
        return jsonError(
          res,
          400,
          "Введите логин и пароль."
        );
      }

      const result =
        await pool.query(
          `
            SELECT *
            FROM users
            WHERE
              LOWER(email) = LOWER($1)
              OR LOWER(username) = LOWER($1)
            LIMIT 1
          `,
          [login]
        );

      if (!result.rows.length) {
        return jsonError(
          res,
          401,
          "Неверный логин или пароль."
        );
      }

      const user =
        result.rows[0];

      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!valid) {
        return jsonError(
          res,
          401,
          "Неверный логин или пароль."
        );
      }

      const token =
        crypto.randomBytes(48)
          .toString("hex");

      await pool.query(
        `
          INSERT INTO sessions (
            id,
            user_id,
            token,
            expires_at
          )
          VALUES (
            $1,
            $2,
            $3,
            NOW() + INTERVAL '30 days'
          )
        `,
        [
          randomId(),
          user.id,
          token,
        ]
      );

      const account = {
        id: user.id,
        username: user.username,
        email: user.email,
        bio: user.bio || "",
        avatar_url:
          user.avatar_url ||
          null,
        created_at:
          user.created_at,
      };

      res.json({
        ok: true,
        token,
        access_token: token,
        user: account,
        account,
      });
    } catch (error) {
      console.error(
        "LOGIN:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка авторизации."
      );
    }
  }
);

/* ======================================================
   ME
====================================================== */

app.get(
  "/api/auth/me",
  requireAuth,
  async (req, res) => {
    res.json({
      ok: true,
      user: {
        id: req.user.id,
        username:
          req.user.username,
        email: req.user.email,
        bio:
          req.user.bio || "",
        avatar_url:
          req.user.avatar_url ||
          null,
        created_at:
          req.user.created_at,
      },
    });
  }
);

/* ======================================================
   LOGOUT
====================================================== */

app.post(
  "/api/auth/logout",
  async (req, res) => {
    try {
      const token =
        getToken(req);

      if (token) {
        await pool.query(
          `
            DELETE FROM sessions
            WHERE token = $1
          `,
          [token]
        );
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "LOGOUT:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка выхода."
      );
    }
  }
);

/* ======================================================
   PROFILE
====================================================== */

app.get(
  "/api/profile",
  requireAuth,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              username,
              email,
              bio,
              avatar_url,
              created_at
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [req.user.id]
        );

      res.json({
        ok: true,
        user:
          result.rows[0] ||
          null,
      });
    } catch (error) {
      console.error(
        "PROFILE:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка профиля."
      );
    }
  }
);

app.put(
  "/api/profile",
  requireAuth,
  async (req, res) => {
    try {
      const username =
        normalizeUsername(
          req.body.username
        );

      const bio =
        String(
          req.body.bio || ""
        ).slice(0, 1000);

      if (
        username.length < 3
      ) {
        return jsonError(
          res,
          400,
          "Username должен содержать минимум 3 символа."
        );
      }

      const duplicate =
        await pool.query(
          `
            SELECT id
            FROM users
            WHERE LOWER(username) = LOWER($1)
              AND id <> $2
            LIMIT 1
          `,
          [
            username,
            req.user.id,
          ]
        );

      if (duplicate.rows.length) {
        return jsonError(
          res,
          409,
          "Этот username уже занят."
        );
      }

      const result =
        await pool.query(
          `
            UPDATE users
            SET
              username = $1,
              bio = $2,
              updated_at = NOW()
            WHERE id = $3
            RETURNING
              id,
              username,
              email,
              bio,
              avatar_url,
              created_at
          `,
          [
            username,
            bio,
            req.user.id,
          ]
        );

      res.json({
        ok: true,
        user:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "UPDATE PROFILE:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось сохранить профиль."
      );
    }
  }
);

/* ======================================================
   FAVORITES
====================================================== */

app.get(
  "/api/favorites",
  requireAuth,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT t.*
            FROM favorites f
            JOIN tracks t
              ON t.id = f.track_id
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
          `,
          [req.user.id]
        );

      const tracks =
        result.rows.map(parseTrack);

      res.json({
        ok: true,
        favorites: tracks,
        tracks,
        data: tracks,
      });
    } catch (error) {
      console.error(
        "GET FAVORITES:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка избранного."
      );
    }
  }
);

app.post(
  "/api/favorites",
  requireAuth,
  async (req, res) => {
    try {
      const trackId =
        req.body.track_id ||
        req.body.trackId ||
        req.body.id;

      if (!trackId) {
        return jsonError(
          res,
          400,
          "Не указан track_id."
        );
      }

      await pool.query(
        `
          INSERT INTO favorites (
            user_id,
            track_id
          )
          VALUES ($1, $2)
          ON CONFLICT (
            user_id,
            track_id
          )
          DO NOTHING
        `,
        [
          req.user.id,
          trackId,
        ]
      );

      res.json({
        ok: true,
        favorite: true,
      });
    } catch (error) {
      console.error(
        "ADD FAVORITE:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось добавить в избранное."
      );
    }
  }
);

app.delete(
  "/api/favorites/:trackId",
  requireAuth,
  async (req, res) => {
    try {
      await pool.query(
        `
          DELETE FROM favorites
          WHERE user_id = $1
            AND track_id = $2
        `,
        [
          req.user.id,
          req.params.trackId,
        ]
      );

      res.json({
        ok: true,
        favorite: false,
      });
    } catch (error) {
      console.error(
        "DELETE FAVORITE:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось удалить из избранного."
      );
    }
  }
);

/* ======================================================
   HISTORY
====================================================== */

app.get(
  "/api/history",
  requireAuth,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              t.*,
              h.played_at
            FROM listening_history h
            JOIN tracks t
              ON t.id = h.track_id
            WHERE h.user_id = $1
            ORDER BY h.played_at DESC
            LIMIT 100
          `,
          [req.user.id]
        );

      const history =
        result.rows.map(
          (row) => ({
            ...parseTrack(row),
            played_at:
              row.played_at,
          })
        );

      res.json({
        ok: true,
        history,
        tracks: history,
        data: history,
      });
    } catch (error) {
      console.error(
        "GET HISTORY:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка истории."
      );
    }
  }
);

app.post(
  "/api/history",
  requireAuth,
  async (req, res) => {
    try {
      const trackId =
        req.body.track_id ||
        req.body.trackId ||
        req.body.id;

      if (!trackId) {
        return jsonError(
          res,
          400,
          "Не указан track_id."
        );
      }

      await pool.query(
        `
          INSERT INTO listening_history (
            user_id,
            track_id
          )
          VALUES ($1, $2)
        `,
        [
          req.user.id,
          trackId,
        ]
      );

      /*
      Ограничиваем историю 100 записями.
      */

      await pool.query(
        `
          DELETE FROM listening_history
          WHERE user_id = $1
            AND id NOT IN (
              SELECT id
              FROM listening_history
              WHERE user_id = $1
              ORDER BY played_at DESC
              LIMIT 100
            )
        `,
        [req.user.id]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "ADD HISTORY:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось сохранить историю."
      );
    }
  }
);

/* ======================================================
   PLAYLISTS
====================================================== */

async function getPlaylistWithTracks(
  playlistId,
  userId
) {
  const playlistResult =
    await pool.query(
      `
        SELECT
          id,
          name,
          is_public,
          created_at,
          updated_at
        FROM playlists
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [
        playlistId,
        userId,
      ]
    );

  if (
    !playlistResult.rows.length
  ) {
    return null;
  }

  const playlist =
    playlistResult.rows[0];

  const tracksResult =
    await pool.query(
      `
        SELECT t.*
        FROM playlist_tracks pt
        JOIN tracks t
          ON t.id = pt.track_id
        WHERE pt.playlist_id = $1
        ORDER BY pt.position ASC, pt.added_at ASC
      `,
      [playlistId]
    );

  return {
    id: playlist.id,
    name: playlist.name,
    public:
      playlist.is_public,
    is_public:
      playlist.is_public,
    created_at:
      playlist.created_at,
    updated_at:
      playlist.updated_at,
    tracks:
      tracksResult.rows.map(
        parseTrack
      ),
  };
}

app.get(
  "/api/playlists",
  requireAuth,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              p.id,
              p.name,
              p.is_public,
              p.created_at,
              p.updated_at,
              COUNT(pt.id)::INTEGER AS track_count
            FROM playlists p
            LEFT JOIN playlist_tracks pt
              ON pt.playlist_id = p.id
            WHERE p.user_id = $1
            GROUP BY p.id
            ORDER BY p.created_at DESC
          `,
          [req.user.id]
        );

      const playlists =
        result.rows.map(
          (row) => ({
            id: row.id,
            name: row.name,
            public:
              row.is_public,
            is_public:
              row.is_public,
            tracks: [],
            track_count:
              Number(
                row.track_count || 0
              ),
            created_at:
              row.created_at,
            updated_at:
              row.updated_at,
          })
        );

      res.json({
        ok: true,
        playlists,
        data: playlists,
      });
    } catch (error) {
      console.error(
        "GET PLAYLISTS:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка плейлистов."
      );
    }
  }
);

app.post(
  "/api/playlists",
  requireAuth,
  async (req, res) => {
    try {
      const name =
        String(
          req.body.name || ""
        )
          .trim()
          .slice(0, 120);

      const isPublic =
        Boolean(
          req.body.public ??
          req.body.is_public ??
          false
        );

      if (!name) {
        return jsonError(
          res,
          400,
          "Введите название плейлиста."
        );
      }

      const id =
        randomId();

      const result =
        await pool.query(
          `
            INSERT INTO playlists (
              id,
              user_id,
              name,
              is_public
            )
            VALUES (
              $1,
              $2,
              $3,
              $4
            )
            RETURNING *
          `,
          [
            id,
            req.user.id,
            name,
            isPublic,
          ]
        );

      res.status(201).json({
        ok: true,
        playlist: {
          id:
            result.rows[0].id,
          name:
            result.rows[0].name,
          public:
            result.rows[0]
              .is_public,
          is_public:
            result.rows[0]
              .is_public,
          tracks: [],
          created_at:
            result.rows[0]
              .created_at,
        },
      });
    } catch (error) {
      console.error(
        "CREATE PLAYLIST:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось создать плейлист."
      );
    }
  }
);

app.get(
  "/api/playlists/:id",
  requireAuth,
  async (req, res) => {
    try {
      const playlist =
        await getPlaylistWithTracks(
          req.params.id,
          req.user.id
        );

      if (!playlist) {
        return jsonError(
          res,
          404,
          "Плейлист не найден."
        );
      }

      res.json({
        ok: true,
        playlist,
      });
    } catch (error) {
      console.error(
        "GET PLAYLIST:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка плейлиста."
      );
    }
  }
);

app.put(
  "/api/playlists/:id",
  requireAuth,
  async (req, res) => {
    try {
      const name =
        req.body.name !== undefined
          ? String(
              req.body.name
            )
              .trim()
              .slice(0, 120)
          : null;

      const publicValue =
        req.body.public !==
        undefined
          ? Boolean(
              req.body.public
            )
          : req.body.is_public !==
            undefined
          ? Boolean(
              req.body.is_public
            )
          : null;

      const result =
        await pool.query(
          `
            UPDATE playlists
            SET
              name =
                COALESCE($1, name),
              is_public =
                COALESCE($2, is_public),
              updated_at = NOW()
            WHERE id = $3
              AND user_id = $4
            RETURNING *
          `,
          [
            name,
            publicValue,
            req.params.id,
            req.user.id,
          ]
        );

      if (!result.rows.length) {
        return jsonError(
          res,
          404,
          "Плейлист не найден."
        );
      }

      res.json({
        ok: true,
        playlist:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "UPDATE PLAYLIST:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка изменения плейлиста."
      );
    }
  }
);

app.post(
  "/api/playlists/:id/tracks",
  requireAuth,
  async (req, res) => {
    try {
      const trackId =
        req.body.track_id ||
        req.body.trackId;

      if (!trackId) {
        return jsonError(
          res,
          400,
          "Не указан track_id."
        );
      }

      const playlist =
        await pool.query(
          `
            SELECT id
            FROM playlists
            WHERE id = $1
              AND user_id = $2
            LIMIT 1
          `,
          [
            req.params.id,
            req.user.id,
          ]
        );

      if (!playlist.rows.length) {
        return jsonError(
          res,
          404,
          "Плейлист не найден."
        );
      }

      const positionResult =
        await pool.query(
          `
            SELECT COALESCE(
              MAX(position) + 1,
              0
            ) AS position
            FROM playlist_tracks
            WHERE playlist_id = $1
          `,
          [req.params.id]
        );

      const position =
        Number(
          positionResult.rows[0]
            .position
        ) || 0;

      await pool.query(
        `
          INSERT INTO playlist_tracks (
            playlist_id,
            track_id,
            position
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (
            playlist_id,
            track_id
          )
          DO NOTHING
        `,
        [
          req.params.id,
          trackId,
          position,
        ]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "ADD PLAYLIST TRACK:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось добавить трек."
      );
    }
  }
);

app.delete(
  "/api/playlists/:id/tracks/:trackId",
  requireAuth,
  async (req, res) => {
    try {
      const playlist =
        await pool.query(
          `
            SELECT id
            FROM playlists
            WHERE id = $1
              AND user_id = $2
            LIMIT 1
          `,
          [
            req.params.id,
            req.user.id,
          ]
        );

      if (!playlist.rows.length) {
        return jsonError(
          res,
          404,
          "Плейлист не найден."
        );
      }

      await pool.query(
        `
          DELETE FROM playlist_tracks
          WHERE playlist_id = $1
            AND track_id = $2
        `,
        [
          req.params.id,
          req.params.trackId,
        ]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "DELETE PLAYLIST TRACK:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось удалить трек."
      );
    }
  }
);

app.delete(
  "/api/playlists/:id",
  requireAuth,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            DELETE FROM playlists
            WHERE id = $1
              AND user_id = $2
            RETURNING id
          `,
          [
            req.params.id,
            req.user.id,
          ]
        );

      if (!result.rows.length) {
        return jsonError(
          res,
          404,
          "Плейлист не найден."
        );
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "DELETE PLAYLIST:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось удалить плейлист."
      );
    }
  }
);

/* ======================================================
   NOTIFICATIONS
====================================================== */

app.get(
  "/api/notifications",
  requireAuth,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              title,
              text,
              is_read,
              created_at
            FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 100
          `,
          [req.user.id]
        );

      const notifications =
        result.rows.map(
          (row) => ({
            id: row.id,
            title: row.title,
            text: row.text,
            is_read:
              row.is_read,
            created_at:
              row.created_at,
          })
        );

      res.json({
        ok: true,
        notifications,
        data: notifications,
      });
    } catch (error) {
      console.error(
        "GET NOTIFICATIONS:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка уведомлений."
      );
    }
  }
);

app.post(
  "/api/notifications",
  requireAuth,
  async (req, res) => {
    try {
      const title =
        String(
          req.body.title ||
            "Новое уведомление"
        ).slice(0, 200);

      const text =
        String(
          req.body.text || ""
        ).slice(0, 2000);

      const result =
        await pool.query(
          `
            INSERT INTO notifications (
              id,
              user_id,
              title,
              text
            )
            VALUES (
              $1,
              $2,
              $3,
              $4
            )
            RETURNING *
          `,
          [
            randomId(),
            req.user.id,
            title,
            text,
          ]
        );

      res.status(201).json({
        ok: true,
        notification:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "CREATE NOTIFICATION:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось создать уведомление."
      );
    }
  }
);

app.patch(
  "/api/notifications/read",
  requireAuth,
  async (req, res) => {
    try {
      await pool.query(
        `
          UPDATE notifications
          SET is_read = TRUE
          WHERE user_id = $1
        `,
        [req.user.id]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "READ NOTIFICATIONS:",
        error
      );

      return jsonError(
        res,
        500,
        "Ошибка уведомлений."
      );
    }
  }
);

app.delete(
  "/api/notifications",
  requireAuth,
  async (req, res) => {
    try {
      await pool.query(
        `
          DELETE FROM notifications
          WHERE user_id = $1
        `,
        [req.user.id]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "DELETE NOTIFICATIONS:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось очистить уведомления."
      );
    }
  }
);

/* ======================================================
   ADMIN / TRACK CREATION
====================================================== */

/*
  Эти endpoints не нужны непосредственно
  твоему frontend, но позволяют добавлять музыку
  в PostgreSQL без отдельного файла.

  Защита через ADMIN_KEY из переменной окружения.

  POST /api/admin/tracks
*/

function requireAdmin(
  req,
  res,
  next
) {
  const configuredKey =
    process.env.ADMIN_KEY;

  if (!configuredKey) {
    return jsonError(
      res,
      403,
      "ADMIN_KEY не настроен."
    );
  }

  const supplied =
    req.headers["x-admin-key"] ||
    req.body.admin_key ||
    req.query.admin_key;

  if (
    String(supplied || "") !==
    String(configuredKey)
  ) {
    return jsonError(
      res,
      403,
      "Доступ запрещён."
    );
  }

  next();
}

app.post(
  "/api/admin/tracks",
  requireAdmin,
  async (req, res) => {
    try {
      const title =
        String(
          req.body.title || ""
        ).trim();

      const artistName =
        String(
          req.body.artist_name ||
            req.body.artist ||
            "Неизвестный артист"
        ).trim();

      const albumName =
        String(
          req.body.album_name ||
            req.body.album ||
            "Без альбома"
        ).trim();

      const genre =
        String(
          req.body.genre ||
            "Неизвестно"
        ).trim();

      const duration =
        Math.max(
          Number(
            req.body.duration
          ) || 0,
          0
        );

      const year =
        req.body.year
          ? Number(
              req.body.year
            )
          : null;

      const coverUrl =
        req.body.cover_url ||
        null;

      const albumCoverUrl =
        req.body.album_cover_url ||
        coverUrl ||
        null;

      const artistAvatar =
        req.body.artist_avatar ||
        null;

      const audioUrl =
        req.body.audio_url ||
        req.body.audio_file_url ||
        null;

      const telegramFileId =
        req.body.telegram_file_id ||
        null;

      if (!title) {
        return jsonError(
          res,
          400,
          "Название трека обязательно."
        );
      }

      const result =
        await pool.query(
          `
            INSERT INTO tracks (
              title,
              artist_name,
              album_name,
              genre,
              duration,
              year,
              cover_url,
              album_cover_url,
              artist_avatar,
              audio_url,
              audio_file_url,
              telegram_file_id
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,
              $7,$8,$9,$10,$10,$11
            )
            RETURNING *
          `,
          [
            title,
            artistName,
            albumName,
            genre,
            duration,
            year,
            coverUrl,
            albumCoverUrl,
            artistAvatar,
            audioUrl,
            telegramFileId,
          ]
        );

      res.status(201).json({
        ok: true,
        track: parseTrack(
          result.rows[0]
        ),
      });
    } catch (error) {
      console.error(
        "ADMIN CREATE TRACK:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось создать трек."
      );
    }
  }
);

/* ======================================================
   ADMIN TRACK DELETE
====================================================== */

app.delete(
  "/api/admin/tracks/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
            DELETE FROM tracks
            WHERE id = $1
            RETURNING id
          `,
          [req.params.id]
        );

      if (!result.rows.length) {
        return jsonError(
          res,
          404,
          "Трек не найден."
        );
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "ADMIN DELETE TRACK:",
        error
      );

      return jsonError(
        res,
        500,
        "Не удалось удалить трек."
      );
    }
  }
);

/* ======================================================
   404
====================================================== */

app.use(
  (req, res) => {
    res.status(404).json({
      ok: false,
      error: "Not Found",
      path: req.path,
      method: req.method,
    });
  }
);

/* ======================================================
   GLOBAL ERROR
====================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "GLOBAL ERROR:",
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
        "Internal Server Error",
    });
  }
);

/* ======================================================
   START
====================================================== */

async function start() {
  try {
    await initDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log("");
        console.log(
          "========================================"
        );
        console.log(
          "🔥 FENIX MUSIC BACKEND 2.0.0"
        );
        console.log(
          "========================================"
        );
        console.log(
          `🚀 PORT: ${PORT}`
        );
        console.log(
          "🌐 API: /api"
        );
        console.log(
          "❤️ HEALTH: /api/health"
        );
        console.log(
          "🎵 TRACKS: /api/tracks"
        );
        console.log(
          "🔊 AUDIO: /api/tracks/:id/audio"
        );
        console.log(
          "🔐 AUTH: /api/auth/*"
        );
        console.log(
          "========================================"
        );
        console.log("");
      }
    );
  } catch (error) {
    console.error("");
    console.error(
      "========================================"
    );
    console.error(
      "❌ FENIX MUSIC BACKEND FAILED TO START"
    );
    console.error(
      "========================================"
    );
    console.error(error);
    console.error(
      "========================================"
    );

    process.exit(1);
  }
}

process.on(
  "SIGTERM",
  async () => {
    console.log(
      "SIGTERM received."
    );

    await pool.end();

    process.exit(0);
  }
);

process.on(
  "SIGINT",
  async () => {
    console.log(
      "SIGINT received."
    );

    await pool.end();

    process.exit(0);
  }
);

start();
