"use strict";

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");

const {
  ensureStorage,
  MUSIC_DIR,
  COVERS_DIR,
  createMusicMiddleware,
  createCoverMiddleware,
  normalizeTrack,
  saveAudioBuffer,
  saveCoverBuffer,
  deleteAudio,
  deleteCover,
  audioExists,
  storageInfo
} = require("./music");

const app = express();

const PORT = Number(process.env.PORT || 10000);

const DATABASE_URL =
  process.env.DATABASE_URL || "";

if (!DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL is not configured."
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb"
  })
);

app.use(cookieParser());

ensureStorage();

/* =========================================================
   HELPERS
========================================================= */

async function q(text, params = []) {
  return pool.query(text, params);
}

function makeToken() {
  return crypto
    .randomBytes(48)
    .toString("hex");
}

function makeCaptcha() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i++) {
    result +=
      chars[
        crypto.randomInt(0, chars.length)
      ];
  }

  return result;
}

function safeUser(user) {
  if (!user) {
    return null;
  }

  const {
    password_hash,
    ...safe
  } = user;

  return safe;
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 64);
}

function isValidUsername(username) {
  return /^[a-zA-Zа-яА-Я0-9_.-]{2,64}$/.test(
    username
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function publicTrack(track) {
  return normalizeTrack(track);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production",
    maxAge:
      30 * 24 * 60 * 60 * 1000,
    path: "/"
  };
}

function setSessionCookie(res, token) {
  res.cookie(
    "fenix_session",
    token,
    cookieOptions()
  );
}

async function getSessionToken(req) {
  const cookieToken =
    req.cookies?.fenix_session;

  if (cookieToken) {
    return cookieToken;
  }

  const authorization =
    req.headers.authorization || "";

  if (
    authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return authorization.slice(7).trim();
  }

  return null;
}

async function currentUser(req) {
  const token =
    await getSessionToken(req);

  if (!token) {
    return null;
  }

  const result = await q(
    `
      SELECT
        u.*
      FROM sessions s
      INNER JOIN users u
        ON u.id = s.user_id
      WHERE
        s.token = $1
        AND s.expires_at > NOW()
      LIMIT 1
    `,
    [token]
  );

  return result.rows[0] || null;
}

async function requireUser(
  req,
  res,
  next
) {
  try {
    const user =
      await currentUser(req);

    if (!user) {
      return res.status(401).json({
        ok: false,
        error:
          "Требуется авторизация"
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(
      "AUTH MIDDLEWARE ERROR:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        "Ошибка проверки авторизации"
    });
  }
}

function validateTrackId(id) {
  return /^\d+$/.test(
    String(id || "")
  );
}

/* =========================================================
   DATABASE
========================================================= */

async function createTables() {
  /*
   * ВАЖНО:
   * Все связанные ID здесь BIGINT.
   *
   * Это предотвращает прошлую ошибку:
   *
   * uuid vs bigint
   *
   * sessions.user_id -> users.id
   */

  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS tracks (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      artist_name TEXT NOT NULL DEFAULT 'Unknown',
      album_name TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      audio_url TEXT NOT NULL DEFAULT '',
      audio_filename TEXT,
      cover_filename TEXT,
      duration INTEGER NOT NULL DEFAULT 0,
      plays_count BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id BIGINT NOT NULL,
      track_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      PRIMARY KEY (user_id, track_id),

      CONSTRAINT favorites_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

      CONSTRAINT favorites_track_fk
        FOREIGN KEY (track_id)
        REFERENCES tracks(id)
        ON DELETE CASCADE
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      track_id BIGINT NOT NULL,
      played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT history_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

      CONSTRAINT history_track_fk
        FOREIGN KEY (track_id)
        REFERENCES tracks(id)
        ON DELETE CASCADE
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT sessions_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS captchas (
      id TEXT PRIMARY KEY,
      answer TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  /*
   * Настройки пользователя.
   */

  await q(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id BIGINT PRIMARY KEY,

      theme TEXT NOT NULL DEFAULT 'dark',
      quality TEXT NOT NULL DEFAULT 'high',

      autoplay BOOLEAN NOT NULL DEFAULT true,
      auto_next BOOLEAN NOT NULL DEFAULT true,
      notifications BOOLEAN NOT NULL DEFAULT true,

      language TEXT NOT NULL DEFAULT 'ru',

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT settings_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);
}

async function ensureColumn(
  table,
  column,
  definition
) {
  /*
   * Имена здесь захардкожены внутри нашего
   * кода, поэтому используются только наши
   * значения.
   */

  await q(
    `
      ALTER TABLE ${table}
      ADD COLUMN IF NOT EXISTS ${column}
      ${definition}
    `
  );
}

async function migrateDatabase() {
  /*
   * Миграции для старой БД.
   */

  await ensureColumn(
    "users",
    "bio",
    "TEXT NOT NULL DEFAULT ''"
  );

  await ensureColumn(
    "users",
    "avatar_url",
    "TEXT NOT NULL DEFAULT ''"
  );

  await ensureColumn(
    "tracks",
    "artist_name",
    "TEXT NOT NULL DEFAULT 'Unknown'"
  );

  await ensureColumn(
    "tracks",
    "album_name",
    "TEXT NOT NULL DEFAULT ''"
  );

  await ensureColumn(
    "tracks",
    "cover_url",
    "TEXT NOT NULL DEFAULT ''"
  );

  await ensureColumn(
    "tracks",
    "audio_url",
    "TEXT NOT NULL DEFAULT ''"
  );

  await ensureColumn(
    "tracks",
    "audio_filename",
    "TEXT"
  );

  await ensureColumn(
    "tracks",
    "cover_filename",
    "TEXT"
  );

  await ensureColumn(
    "tracks",
    "duration",
    "INTEGER NOT NULL DEFAULT 0"
  );

  await ensureColumn(
    "tracks",
    "plays_count",
    "BIGINT NOT NULL DEFAULT 0"
  );

  /*
   * Удаляем старые тестовые треки
   * только если они имеют наши тестовые
   * названия.
   */

  await q(`
    DELETE FROM tracks
    WHERE title IN (
      'Fenix Intro',
      'Night Drive',
      'Neon Dreams'
    )
    AND (
      audio_url = ''
      OR audio_url IS NULL
    )
  `);

  /*
   * Чистим просроченные сессии/CAPTCHA.
   */

  await q(`
    DELETE FROM sessions
    WHERE expires_at < NOW()
  `);

  await q(`
    DELETE FROM captchas
    WHERE expires_at < NOW()
  `);
}

async function initDatabase() {
  console.log(
    "Connecting to PostgreSQL..."
  );

  await q("SELECT NOW()");

  await createTables();

  await migrateDatabase();

  console.log(
    "PostgreSQL database initialized."
  );
}

/* =========================================================
   BASIC ROUTES
========================================================= */

app.get("/", async (req, res) => {
  const frontendPath =
    path.join(
      __dirname,
      "..",
      "frontend",
      "build",
      "index.html"
    );

  try {
    await require("fs").promises.access(
      frontendPath
    );

    return res.sendFile(frontendPath);
  } catch {
    return res.status(200).send(`
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8">
          <meta
            name="viewport"
            content="width=device-width,initial-scale=1"
          >
          <title>Fenix Music</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              background: #09090b;
              color: #fff;
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            main {
              text-align: center;
              padding: 30px;
            }

            h1 {
              font-size: 42px;
              margin-bottom: 10px;
            }

            p {
              color: #a1a1aa;
            }
          </style>
        </head>
        <body>
          <main>
            <h1>FENIX MUSIC</h1>
            <p>
              Backend работает.
              Frontend ещё не собран.
            </p>
          </main>
        </body>
      </html>
    `);
  }
});

app.get("/api", (req, res) => {
  res.json({
    ok: true,
    service: "Fenix Music Backend",
    version: "3.0.0",
    status: "online",
    api: "/api",
    health: "/api/health",
    tracks: "/api/tracks",
    auth: {
      me: "/api/auth/me",
      captcha: "/api/auth/captcha",
      register: "/api/auth/register",
      login: "/api/auth/login",
      logout: "/api/auth/logout"
    }
  });
});

app.get(
  "/api/health",
  async (req, res) => {
    try {
      await q("SELECT 1");

      res.json({
        ok: true,
        status: "healthy",
        database: "online",
        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "HEALTH ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        status: "error",
        database: "offline",
        error: error.message
      });
    }
  }
);

/* =========================================================
   STORAGE
========================================================= */

app.use(
  "/media/music",
  createMusicMiddleware()
);

app.use(
  "/media/covers",
  createCoverMiddleware()
);

app.get(
  "/api/storage",
  async (req, res) => {
    try {
      const info =
        await storageInfo();

      res.json({
        ok: true,
        storage: info,
        musicDirectory: MUSIC_DIR,
        coversDirectory: COVERS_DIR
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

/* =========================================================
   AUTH / CAPTCHA
========================================================= */

app.get(
  "/api/auth/captcha",
  async (req, res) => {
    try {
      const id =
        crypto.randomUUID();

      const answer =
        makeCaptcha();

      await q(
        `
          INSERT INTO captchas
            (id, answer, expires_at)
          VALUES
            ($1, $2, NOW() + INTERVAL '10 minutes')
        `,
        [id, answer]
      );

      res.json({
        ok: true,
        id,
        text: answer,
        expires_in: 600
      });
    } catch (error) {
      console.error(
        "CAPTCHA ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось создать CAPTCHA"
      });
    }
  }
);

app.get(
  "/api/auth/me",
  async (req, res) => {
    try {
      const user =
        await currentUser(req);

      if (!user) {
        return res.json({
          ok: true,
          user: null
        });
      }

      const settings =
        await q(
          `
            SELECT
              theme,
              quality,
              autoplay,
              auto_next AS "autoNext",
              notifications,
              language
            FROM user_settings
            WHERE user_id = $1
          `,
          [user.id]
        );

      res.json({
        ok: true,
        user: safeUser(user),
        settings:
          settings.rows[0] || {
            theme: "dark",
            quality: "high",
            autoplay: true,
            autoNext: true,
            notifications: true,
            language: "ru"
          }
      });
    } catch (error) {
      console.error(
        "ME ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить аккаунт"
      });
    }
  }
);

app.post(
  "/api/auth/register",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
        username,
        email,
        password,
        captcha,
        captcha_id
      } = req.body || {};

      const cleanUsername =
        normalizeUsername(username);

      const cleanEmail =
        normalizeEmail(email);

      if (
        !cleanUsername ||
        !cleanEmail ||
        !password
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Заполните все поля"
        });
      }

      if (
        !isValidUsername(
          cleanUsername
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный username"
        });
      }

      if (
        !isValidEmail(cleanEmail)
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный email"
        });
      }

      if (
        String(password).length < 6
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Пароль должен содержать минимум 6 символов"
        });
      }

      if (
        !captcha_id ||
        !captcha
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Введите CAPTCHA"
        });
      }

      const captchaResult =
        await client.query(
          `
            SELECT *
            FROM captchas
            WHERE
              id = $1
              AND expires_at > NOW()
            LIMIT 1
          `,
          [captcha_id]
        );

      if (
        !captchaResult.rows[0] ||
        String(
          captchaResult.rows[0].answer
        ).toUpperCase() !==
          String(captcha)
            .trim()
            .toUpperCase()
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Неверная CAPTCHA"
        });
      }

      const exists =
        await client.query(
          `
            SELECT id
            FROM users
            WHERE
              LOWER(email) = LOWER($1)
              OR LOWER(username) = LOWER($2)
            LIMIT 1
          `,
          [
            cleanEmail,
            cleanUsername
          ]
        );

      if (exists.rows.length) {
        return res.status(409).json({
          ok: false,
          error:
            "Username или email уже используется"
        });
      }

      const passwordHash =
        await bcrypt.hash(
          String(password),
          12
        );

      await client.query(
        "BEGIN"
      );

      const userResult =
        await client.query(
          `
            INSERT INTO users
              (
                username,
                email,
                password_hash
              )
            VALUES
              ($1, $2, $3)
            RETURNING *
          `,
          [
            cleanUsername,
            cleanEmail,
            passwordHash
          ]
        );

      const user =
        userResult.rows[0];

      const sessionToken =
        makeToken();

      await client.query(
        `
          INSERT INTO sessions
            (
              token,
              user_id,
              expires_at
            )
          VALUES
            (
              $1,
              $2,
              NOW() + INTERVAL '30 days'
            )
        `,
        [
          sessionToken,
          user.id
        ]
      );

      await client.query(
        `
          INSERT INTO user_settings
            (user_id)
          VALUES
            ($1)
          ON CONFLICT (user_id)
          DO NOTHING
        `,
        [user.id]
      );

      await client.query(
        `
          DELETE FROM captchas
          WHERE id = $1
        `,
        [captcha_id]
      );

      await client.query(
        "COMMIT"
      );

      setSessionCookie(
        res,
        sessionToken
      );

      return res.status(201).json({
        ok: true,
        user: safeUser(user),
        token: sessionToken
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}

      console.error(
        "REGISTER ERROR:",
        error
      );

      if (
        error.code === "23505"
      ) {
        return res.status(409).json({
          ok: false,
          error:
            "Username или email уже используется"
        });
      }

      return res.status(500).json({
        ok: false,
        error:
          "Ошибка регистрации"
      });
    } finally {
      client.release();
    }
  }
);

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const {
        login,
        email,
        username,
        password
      } = req.body || {};

      const key =
        String(
          login ||
          email ||
          username ||
          ""
        ).trim();

      if (!key || !password) {
        return res.status(400).json({
          ok: false,
          error:
            "Введите логин и пароль"
        });
      }

      const result =
        await q(
          `
            SELECT *
            FROM users
            WHERE
              LOWER(email) = LOWER($1)
              OR LOWER(username) = LOWER($1)
            LIMIT 1
          `,
          [key]
        );

      const user =
        result.rows[0];

      if (!user) {
        return res.status(401).json({
          ok: false,
          error:
            "Неверный логин или пароль"
        });
      }

      const valid =
        await bcrypt.compare(
          String(password),
          user.password_hash
        );

      if (!valid) {
        return res.status(401).json({
          ok: false,
          error:
            "Неверный логин или пароль"
        });
      }

      const sessionToken =
        makeToken();

      await q(
        `
          INSERT INTO sessions
            (
              token,
              user_id,
              expires_at
            )
          VALUES
            (
              $1,
              $2,
              NOW() + INTERVAL '30 days'
            )
        `,
        [
          sessionToken,
          user.id
        ]
      );

      await q(
        `
          INSERT INTO user_settings
            (user_id)
          VALUES
            ($1)
          ON CONFLICT (user_id)
          DO NOTHING
        `,
        [user.id]
      );

      setSessionCookie(
        res,
        sessionToken
      );

      res.json({
        ok: true,
        user: safeUser(user),
        token: sessionToken
      });
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Ошибка входа"
      });
    }
  }
);

app.post(
  "/api/auth/logout",
  async (req, res) => {
    try {
      const token =
        await getSessionToken(req);

      if (token) {
        await q(
          `
            DELETE FROM sessions
            WHERE token = $1
          `,
          [token]
        );
      }

      res.clearCookie(
        "fenix_session",
        {
          httpOnly: true,
          sameSite: "lax",
          secure:
            process.env.NODE_ENV ===
            "production",
          path: "/"
        }
      );

      res.json({
        ok: true
      });
    } catch (error) {
      console.error(
        "LOGOUT ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Ошибка выхода"
      });
    }
  }
);

/* =========================================================
   PROFILE
========================================================= */

app.put(
  "/api/auth/profile",
  requireUser,
  async (req, res) => {
    try {
      const {
        username,
        bio
      } = req.body || {};

      let cleanUsername =
        normalizeUsername(
          username
        );

      if (!cleanUsername) {
        cleanUsername =
          req.user.username;
      }

      if (
        !isValidUsername(
          cleanUsername
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный username"
        });
      }

      const result =
        await q(
          `
            UPDATE users
            SET
              username = $1,
              bio = COALESCE($2, bio)
            WHERE id = $3
            RETURNING *
          `,
          [
            cleanUsername,
            bio == null
              ? null
              : String(bio).slice(
                  0,
                  1000
                ),
            req.user.id
          ]
        );

      res.json({
        ok: true,
        user: safeUser(
          result.rows[0]
        )
      });
    } catch (error) {
      console.error(
        "PROFILE ERROR:",
        error
      );

      if (
        error.code === "23505"
      ) {
        return res.status(409).json({
          ok: false,
          error:
            "Этот username уже занят"
        });
      }

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить профиль"
      });
    }
  }
);

/* =========================================================
   SETTINGS
========================================================= */

app.get(
  "/api/settings",
  requireUser,
  async (req, res) => {
    try {
      const result =
        await q(
          `
            SELECT
              theme,
              quality,
              autoplay,
              auto_next AS "autoNext",
              notifications,
              language
            FROM user_settings
            WHERE user_id = $1
          `,
          [req.user.id]
        );

      res.json({
        ok: true,
        settings:
          result.rows[0] || {
            theme: "dark",
            quality: "high",
            autoplay: true,
            autoNext: true,
            notifications: true,
            language: "ru"
          }
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить настройки"
      });
    }
  }
);

app.put(
  "/api/settings",
  requireUser,
  async (req, res) => {
    try {
      const {
        theme,
        quality,
        autoplay,
        autoNext,
        notifications,
        language
      } = req.body || {};

      const result =
        await q(
          `
            INSERT INTO user_settings
              (
                user_id,
                theme,
                quality,
                autoplay,
                auto_next,
                notifications,
                language,
                updated_at
              )
            VALUES
              (
                $1,
                COALESCE($2, 'dark'),
                COALESCE($3, 'high'),
                COALESCE($4, true),
                COALESCE($5, true),
                COALESCE($6, true),
                COALESCE($7, 'ru'),
                NOW()
              )
            ON CONFLICT (user_id)
            DO UPDATE SET
              theme =
                COALESCE(
                  EXCLUDED.theme,
                  user_settings.theme
                ),
              quality =
                COALESCE(
                  EXCLUDED.quality,
                  user_settings.quality
                ),
              autoplay =
                COALESCE(
                  EXCLUDED.autoplay,
                  user_settings.autoplay
                ),
              auto_next =
                COALESCE(
                  EXCLUDED.auto_next,
                  user_settings.auto_next
                ),
              notifications =
                COALESCE(
                  EXCLUDED.notifications,
                  user_settings.notifications
                ),
              language =
                COALESCE(
                  EXCLUDED.language,
                  user_settings.language
                ),
              updated_at = NOW()
            RETURNING
              theme,
              quality,
              autoplay,
              auto_next AS "autoNext",
              notifications,
              language
          `,
          [
            req.user.id,
            theme || "dark",
            quality || "high",
            typeof autoplay ===
            "boolean"
              ? autoplay
              : true,
            typeof autoNext ===
            "boolean"
              ? autoNext
              : true,
            typeof notifications ===
            "boolean"
              ? notifications
              : true,
            language || "ru"
          ]
        );

      res.json({
        ok: true,
        settings:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "SETTINGS ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить настройки"
      });
    }
  }
);

/* =========================================================
   TRACKS
========================================================= */

app.get(
  "/api/tracks",
  async (req, res) => {
    try {
      const result =
        await q(
          `
            SELECT
              id,
              title,
              artist_name,
              album_name,
              cover_url,
              audio_url,
              audio_filename,
              cover_filename,
              duration,
              plays_count,
              created_at
            FROM tracks
            ORDER BY created_at DESC, id DESC
          `
        );

      res.json({
        ok: true,
        tracks:
          result.rows.map(
            publicTrack
          )
      });
    } catch (error) {
      console.error(
        "TRACKS ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить треки"
      });
    }
  }
);

app.get(
  "/api/tracks/:id",
  async (req, res) => {
    try {
      if (
        !validateTrackId(
          req.params.id
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID трека"
        });
      }

      const result =
        await q(
          `
            SELECT *
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [req.params.id]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден"
        });
      }

      res.json({
        ok: true,
        track:
          publicTrack(
            result.rows[0]
          )
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Ошибка получения трека"
      });
    }
  }
);

/*
 * Реальный audio endpoint.
 *
 * Если audio_filename существует
 * локально — отдаём файл через redirect
 * на /media/music/...
 *
 * Если старый трек имеет внешний
 * audio_url — используем его.
 */

app.get(
  "/api/tracks/:id/audio",
  async (req, res) => {
    try {
      if (
        !validateTrackId(
          req.params.id
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID трека"
        });
      }

      const result =
        await q(
          `
            SELECT
              id,
              audio_url,
              audio_filename
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [req.params.id]
        );

      const track =
        result.rows[0];

      if (!track) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден"
        });
      }

      if (
        track.audio_filename &&
        (await audioExists(
          track.audio_filename
        ))
      ) {
        return res.redirect(
          `/media/music/${encodeURIComponent(
            path.basename(
              track.audio_filename
            )
          )}`
        );
      }

      if (track.audio_url) {
        return res.redirect(
          track.audio_url
        );
      }

      return res.status(404).json({
        ok: false,
        error:
          "У трека нет аудиофайла"
      });
    } catch (error) {
      console.error(
        "AUDIO ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Ошибка воспроизведения"
      });
    }
  }
);

app.post(
  "/api/tracks/:id/play",
  async (req, res) => {
    try {
      if (
        !validateTrackId(
          req.params.id
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID трека"
        });
      }

      const result =
        await q(
          `
            UPDATE tracks
            SET
              plays_count =
                COALESCE(
                  plays_count,
                  0
                ) + 1
            WHERE id = $1
            RETURNING plays_count
          `,
          [req.params.id]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден"
        });
      }

      res.json({
        ok: true,
        plays_count:
          Number(
            result.rows[0]
              .plays_count
          )
      });
    } catch (error) {
      console.error(
        "PLAY ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось засчитать прослушивание"
      });
    }
  }
);

/* =========================================================
   FAVORITES
========================================================= */

app.get(
  "/api/favorites",
  requireUser,
  async (req, res) => {
    try {
      const result =
        await q(
          `
            SELECT
              t.*
            FROM favorites f
            INNER JOIN tracks t
              ON t.id = f.track_id
            WHERE f.user_id = $1
            ORDER BY
              f.created_at DESC
          `,
          [req.user.id]
        );

      res.json({
        ok: true,
        tracks:
          result.rows.map(
            publicTrack
          )
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить избранное"
      });
    }
  }
);

app.post(
  "/api/favorites",
  requireUser,
  async (req, res) => {
    try {
      const trackId =
        req.body?.track_id;

      if (
        !validateTrackId(trackId)
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный track_id"
        });
      }

      const track =
        await q(
          `
            SELECT id
            FROM tracks
            WHERE id = $1
          `,
          [trackId]
        );

      if (!track.rows[0]) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден"
        });
      }

      await q(
        `
          INSERT INTO favorites
            (
              user_id,
              track_id
            )
          VALUES
            ($1, $2)
          ON CONFLICT
            (user_id, track_id)
          DO NOTHING
        `,
        [
          req.user.id,
          trackId
        ]
      );

      res.json({
        ok: true
      });
    } catch (error) {
      console.error(
        "FAVORITE ADD ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось добавить в избранное"
      });
    }
  }
);

app.delete(
  "/api/favorites/:id",
  requireUser,
  async (req, res) => {
    try {
      if (
        !validateTrackId(
          req.params.id
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID трека"
        });
      }

      await q(
        `
          DELETE FROM favorites
          WHERE
            user_id = $1
            AND track_id = $2
        `,
        [
          req.user.id,
          req.params.id
        ]
      );

      res.json({
        ok: true
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось удалить из избранного"
      });
    }
  }
);

/* =========================================================
   HISTORY
========================================================= */

app.get(
  "/api/history",
  requireUser,
  async (req, res) => {
    try {
      const result =
        await q(
          `
            SELECT
              t.*,
              h.played_at
            FROM history h
            INNER JOIN tracks t
              ON t.id = h.track_id
            WHERE h.user_id = $1
            ORDER BY
              h.played_at DESC
            LIMIT 200
          `,
          [req.user.id]
        );

      res.json({
        ok: true,
        tracks:
          result.rows.map(
            publicTrack
          )
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить историю"
      });
    }
  }
);

app.post(
  "/api/history",
  requireUser,
  async (req, res) => {
    try {
      const trackId =
        req.body?.track_id;

      if (
        !validateTrackId(trackId)
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный track_id"
        });
      }

      const track =
        await q(
          `
            SELECT id
            FROM tracks
            WHERE id = $1
          `,
          [trackId]
        );

      if (!track.rows[0]) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден"
        });
      }

      await q(
        `
          INSERT INTO history
            (
              user_id,
              track_id
            )
          VALUES
            ($1, $2)
        `,
        [
          req.user.id,
          trackId
        ]
      );

      await q(
        `
          UPDATE tracks
          SET
            plays_count =
              COALESCE(
                plays_count,
                0
              ) + 1
          WHERE id = $1
        `,
        [trackId]
      );

      res.json({
        ok: true
      });
    } catch (error) {
      console.error(
        "HISTORY ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить историю"
      });
    }
  }
);

/* =========================================================
   BOT / TRACK UPLOAD API
========================================================= */

/*
 * Этот endpoint предназначен для нашего
 * Telegram-бота.
 *
 * Бот сможет отправить:
 *
 * multipart/form-data
 *
 * audio
 * cover
 *
 * title
 * artist_name
 * album_name
 * duration
 * admin_key
 *
 * Для multipart нужен multer.
 *
 * Мы подключаем его лениво здесь,
 * чтобы основной backend не падал,
 * если пакет ещё не установлен.
 */

let multer;

try {
  multer = require("multer");
} catch {
  multer = null;
}

if (multer) {
  const upload = multer({
    storage:
      multer.memoryStorage(),
    limits: {
      fileSize:
        100 * 1024 * 1024
    }
  });

  app.post(
    "/api/admin/tracks/upload",
    upload.fields([
      {
        name: "audio",
        maxCount: 1
      },
      {
        name: "cover",
        maxCount: 1
      }
    ]),
    async (req, res) => {
      try {
        const adminKey =
          process.env.BOT_UPLOAD_KEY;

        if (
          !adminKey ||
          req.body?.admin_key !==
            adminKey
        ) {
          return res.status(403).json({
            ok: false,
            error:
              "Недействительный ключ загрузки"
          });
        }

        const audio =
          req.files?.audio?.[0];

        const cover =
          req.files?.cover?.[0];

        if (!audio) {
          return res.status(400).json({
            ok: false,
            error:
              "Аудиофайл не найден"
          });
        }

        const audioFile =
          await saveAudioBuffer(
            audio.buffer,
            audio.originalname
          );

        let coverFile = null;

        try {
          if (cover) {
            coverFile =
              await saveCoverBuffer(
                cover.buffer,
                cover.originalname
              );
          }

          const title =
            String(
              req.body?.title ||
                "Без названия"
            )
              .trim()
              .slice(0, 255);

          const artistName =
            String(
              req.body?.artist_name ||
                "Unknown"
            )
              .trim()
              .slice(0, 255);

          const albumName =
            String(
              req.body?.album_name ||
                ""
            )
              .trim()
              .slice(0, 255);

          const duration =
            Math.max(
              0,
              Number.parseInt(
                req.body?.duration,
                10
              ) || 0
            );

          const result =
            await q(
              `
                INSERT INTO tracks
                  (
                    title,
                    artist_name,
                    album_name,
                    cover_url,
                    audio_url,
                    audio_filename,
                    cover_filename,
                    duration
                  )
                VALUES
                  (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                  )
                RETURNING *
              `,
              [
                title,
                artistName,
                albumName,
                coverFile
                  ? coverFile.url
                  : "",
                audioFile.url,
                audioFile.filename,
                coverFile
                  ? coverFile.filename
                  : null,
                duration
              ]
            );

          res.status(201).json({
            ok: true,
            track:
              publicTrack(
                result.rows[0]
              )
          });
        } catch (error) {
          await deleteAudio(
            audioFile.filename
          );

          if (coverFile) {
            await deleteCover(
              coverFile.filename
            );
          }

          throw error;
        }
      } catch (error) {
        console.error(
          "BOT UPLOAD ERROR:",
          error
        );

        res.status(500).json({
          ok: false,
          error:
            "Не удалось загрузить трек"
        });
      }
    }
  );
}

/* =========================================================
   ADMIN TRACK DELETE
========================================================= */

app.delete(
  "/api/admin/tracks/:id",
  async (req, res) => {
    try {
      const adminKey =
        process.env.BOT_UPLOAD_KEY;

      if (
        !adminKey ||
        req.headers["x-bot-key"] !==
          adminKey
      ) {
        return res.status(403).json({
          ok: false,
          error:
            "Доступ запрещён"
        });
      }

      if (
        !validateTrackId(
          req.params.id
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID"
        });
      }

      const result =
        await q(
          `
            DELETE FROM tracks
            WHERE id = $1
            RETURNING
              id,
              audio_filename,
              cover_filename
          `,
          [req.params.id]
        );

      const track =
        result.rows[0];

      if (!track) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден"
        });
      }

      if (track.audio_filename) {
        await deleteAudio(
          track.audio_filename
        );
      }

      if (track.cover_filename) {
        await deleteCover(
          track.cover_filename
        );
      }

      res.json({
        ok: true,
        deleted:
          String(track.id)
      });
    } catch (error) {
      console.error(
        "ADMIN DELETE ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось удалить трек"
      });
    }
  }
);

/* =========================================================
   404 API
========================================================= */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      ok: false,
      error:
        "API route not found",
      method: req.method,
      path: req.originalUrl
    });
  }
);

/* =========================================================
   FRONTEND
========================================================= */

const frontendBuild =
  path.join(
    __dirname,
    "..",
    "frontend",
    "build"
  );

const frontendIndex =
  path.join(
    frontendBuild,
    "index.html"
  );

app.use(
  express.static(
    frontendBuild,
    {
      index: false,
      maxAge:
        process.env.NODE_ENV ===
        "production"
          ? "1h"
          : 0
    }
  )
);

/*
 * Express 5:
 * Используем {*path}, а не старый "*",
 * чтобы не получить path-to-regexp error.
 */

app.get(
  "/{*path}",
  (req, res) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/media")
    ) {
      return res.status(404).send(
        "Not Found"
      );
    }

    res.sendFile(
      frontendIndex,
      (error) => {
        if (error) {
          console.error(
            "FRONTEND ERROR:",
            error.message
          );

          res.status(200).send(`
            <!doctype html>
            <html lang="ru">
              <head>
                <meta charset="utf-8">
                <meta
                  name="viewport"
                  content="width=device-width,initial-scale=1"
                >
                <title>Fenix Music</title>
                <style>
                  * {
                    box-sizing: border-box;
                  }

                  html,
                  body {
                    margin: 0;
                    min-height: 100%;
                  }

                  body {
                    min-height: 100vh;
                    background:
                      radial-gradient(
                        circle at top,
                        #18181b,
                        #09090b 55%
                      );
                    color: white;
                    font-family:
                      Arial,
                      sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  }

                  .box {
                    width: min(
                      90%,
                      560px
                    );
                    text-align: center;
                    padding: 40px;
                    border: 1px solid
                      rgba(
                        255,
                        255,
                        255,
                        .08
                      );
                    border-radius: 24px;
                    background:
                      rgba(
                        24,
                        24,
                        27,
                        .8
                      );
                  }

                  h1 {
                    margin: 0 0 12px;
                    font-size: 42px;
                  }

                  p {
                    color:
                      #a1a1aa;
                    line-height: 1.6;
                  }

                  code {
                    color:
                      #f87171;
                  }
                </style>
              </head>
              <body>
                <div class="box">
                  <h1>
                    FENIX MUSIC
                  </h1>

                  <p>
                    Backend запущен,
                    но frontend ещё
                    не собран.
                  </p>

                  <p>
                    Выполни
                    <code>
                      npm run build
                    </code>
                    перед запуском.
                  </p>
                </div>
              </body>
            </html>
          `);
        }
      }
    );
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "UNHANDLED ERROR:",
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
        "Внутренняя ошибка сервера"
    });
  }
);

/* =========================================================
   START
========================================================= */

async function start() {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "       FENIX MUSIC BACKEND 3.0"
  );
  console.log(
    "========================================"
  );

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
        "🔥 FENIX MUSIC BACKEND ONLINE"
      );
      console.log(
        `🌐 PORT: ${PORT}`
      );
      console.log(
        `🎵 API: /api`
      );
      console.log(
        `❤️ TRACKS: /api/tracks`
      );
      console.log(
        `🔐 AUTH: /api/auth`
      );
      console.log(
        `🎧 MEDIA: /media/music`
      );
      console.log(
        `🖼️ COVERS: /media/covers`
      );
      console.log(
        "========================================"
      );
      console.log("");
    }
  );
}

start().catch(
  async (error) => {
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
    console.error(
      error
    );
    console.error(
      "========================================"
    );

    try {
      await pool.end();
    } catch {}

    process.exit(1);
  }
);

process.on(
  "SIGTERM",
  async () => {
    console.log(
      "SIGTERM received."
    );

    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  }
);

process.on(
  "SIGINT",
  async () => {
    console.log(
      "SIGINT received."
    );

    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  }
);

module.exports = {
  app,
  pool,
  initDatabase
};
