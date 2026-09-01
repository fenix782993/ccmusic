"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");

const {
  registerMusicRoutes,
  getTracks,
  getMusicDir,
  resolveAudio,
} = require("./music");

const app = express();

const PORT = Number(process.env.PORT || 10000);
const NODE_ENV = process.env.NODE_ENV || "production";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not configured");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

app.disable("x-powered-by");

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

app.use(cookieParser());

/* =========================================================
   PATHS
========================================================= */

const ROOT_DIR = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");

const POSSIBLE_BUILD_DIRS = [
  path.join(FRONTEND_DIR, "build"),
  path.join(FRONTEND_DIR, "dist"),
  path.join(ROOT_DIR, "build"),
  path.join(ROOT_DIR, "dist"),
];

function findFrontendBuild() {
  for (const dir of POSSIBLE_BUILD_DIRS) {
    const indexFile = path.join(dir, "index.html");

    if (fs.existsSync(indexFile)) {
      return dir;
    }
  }

  return null;
}

/* =========================================================
   DATABASE
========================================================= */

async function q(text, params = []) {
  return pool.query(text, params);
}

async function columnExists(table, column) {
  const result = await q(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [table, column]
  );

  return result.rowCount > 0;
}

async function ensureColumn(table, column, definition) {
  const exists = await columnExists(table, column);

  if (!exists) {
    console.log(`Adding missing column ${table}.${column}`);

    await q(
      `ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`
    );
  }
}

async function initDatabase() {
  console.log("Initializing PostgreSQL...");

  /*
   * USERS
   *
   * BIGINT is used everywhere.
   * This prevents the previous UUID/BIGINT foreign-key error.
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

  /*
   * Existing installations may have an older users table.
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

  /*
   * TRACKS
   */

  await q(`
    CREATE TABLE IF NOT EXISTS tracks (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      artist_name TEXT NOT NULL DEFAULT 'Unknown',
      album_name TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      audio_url TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL DEFAULT 0,
      plays_count BIGINT NOT NULL DEFAULT 0,
      file_name TEXT NOT NULL DEFAULT '',
      mime TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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
    "duration",
    "INTEGER NOT NULL DEFAULT 0"
  );

  await ensureColumn(
    "tracks",
    "plays_count",
    "BIGINT NOT NULL DEFAULT 0"
  );

  await ensureColumn(
    "tracks",
    "file_name",
    "TEXT NOT NULL DEFAULT ''"
  );

  await ensureColumn(
    "tracks",
    "mime",
    "TEXT NOT NULL DEFAULT ''"
  );

  /*
   * FAVORITES
   */

  await q(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id BIGINT NOT NULL,
      track_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      PRIMARY KEY (user_id, track_id),

      CONSTRAINT favorites_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

      CONSTRAINT favorites_track_id_fkey
        FOREIGN KEY (track_id)
        REFERENCES tracks(id)
        ON DELETE CASCADE
    )
  `);

  /*
   * HISTORY
   */

  await q(`
    CREATE TABLE IF NOT EXISTS history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      track_id BIGINT NOT NULL,
      played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT history_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

      CONSTRAINT history_track_id_fkey
        FOREIGN KEY (track_id)
        REFERENCES tracks(id)
        ON DELETE CASCADE
    )
  `);

  /*
   * SESSIONS
   *
   * IMPORTANT:
   * user_id is BIGINT, NOT UUID.
   */

  await q(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,

      CONSTRAINT sessions_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  /*
   * CAPTCHA
   */

  await q(`
    CREATE TABLE IF NOT EXISTS captchas (
      id TEXT PRIMARY KEY,
      answer TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  /*
   * Clean expired data.
   */

  await q(`
    DELETE FROM sessions
    WHERE expires_at < NOW()
  `);

  await q(`
    DELETE FROM captchas
    WHERE expires_at < NOW()
  `);

  /*
   * DO NOT insert demo tracks.
   *
   * Music is loaded from /music and can later be added by bot.
   */

  console.log("PostgreSQL initialized");
}

/* =========================================================
   AUTH HELPERS
========================================================= */

function createToken() {
  return crypto.randomBytes(48).toString("hex");
}

function createCaptchaText() {
  return crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();
}

function safeUser(user) {
  if (!user) return null;

  const {
    password_hash,
    ...result
  } = user;

  return result;
}

async function getCurrentUser(req) {
  try {
    const sessionToken =
      req.cookies?.fenix_session;

    if (!sessionToken) {
      return null;
    }

    const result = await q(
      `
        SELECT u.*
        FROM sessions s
        INNER JOIN users u
          ON u.id = s.user_id
        WHERE s.token = $1
          AND s.expires_at > NOW()
        LIMIT 1
      `,
      [sessionToken]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error(
      "getCurrentUser:",
      error.message
    );

    return null;
  }
}

async function requireUser(req, res, next) {
  const user = await getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      ok: false,
      error: "Требуется авторизация",
    });
  }

  req.user = user;

  next();
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  const buildDir = findFrontendBuild();

  if (!buildDir) {
    return res.status(503).send(`
      <!doctype html>
      <html lang="ru">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Fenix Music</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #050507;
            color: white;
            font-family: Arial, sans-serif;
          }
          .box {
            max-width: 600px;
            padding: 40px;
            text-align: center;
          }
          h1 {
            color: #ff3030;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>FENIX MUSIC</h1>
          <p>Backend работает.</p>
          <p>Frontend ещё не собран.</p>
        </div>
      </body>
      </html>
    `);
  }

  return res.sendFile(
    path.join(buildDir, "index.html")
  );
});

/* =========================================================
   API
========================================================= */

app.get("/api", (req, res) => {
  res.json({
    ok: true,
    service: "Fenix Music Backend",
    version: "3.0.0",
    status: "online",
    api: "/api",
    health: "/api/health",
    tracks: "/api/tracks",
    music: "/api/music",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await q("SELECT 1");

    res.json({
      ok: true,
      status: "healthy",
      database: "online",
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Health error:",
      error
    );

    res.status(500).json({
      ok: false,
      status: "error",
      database: "offline",
      error: error.message,
    });
  }
});

/* =========================================================
   AUTH
========================================================= */

app.get(
  "/api/auth/me",
  async (req, res) => {
    const user =
      await getCurrentUser(req);

    res.json({
      ok: true,
      user: safeUser(user),
    });
  }
);

app.get(
  "/api/auth/captcha",
  async (req, res) => {
    try {
      const id =
        crypto.randomUUID();

      const answer =
        createCaptchaText();

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
      });
    } catch (error) {
      console.error(
        "CAPTCHA error:",
        error
      );

      res.status(500).json({
        ok: false,
        error: "Не удалось создать CAPTCHA",
      });
    }
  }
);

app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const {
        username,
        email,
        password,
        captcha,
        captcha_id,
      } = req.body || {};

      const cleanUsername =
        String(username || "").trim();

      const cleanEmail =
        String(email || "")
          .trim()
          .toLowerCase();

      const cleanPassword =
        String(password || "");

      if (
        !cleanUsername ||
        !cleanEmail ||
        !cleanPassword
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Заполните все обязательные поля",
        });
      }

      if (cleanUsername.length < 3) {
        return res.status(400).json({
          ok: false,
          error:
            "Username должен содержать минимум 3 символа",
        });
      }

      if (cleanPassword.length < 6) {
        return res.status(400).json({
          ok: false,
          error:
            "Пароль должен содержать минимум 6 символов",
        });
      }

      if (!captcha_id || !captcha) {
        return res.status(400).json({
          ok: false,
          error: "Введите CAPTCHA",
        });
      }

      const captchaResult =
        await q(
          `
            SELECT *
            FROM captchas
            WHERE id = $1
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
          error: "Неверная CAPTCHA",
        });
      }

      const exists =
        await q(
          `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
               OR LOWER(username) = LOWER($2)
            LIMIT 1
          `,
          [
            cleanEmail,
            cleanUsername,
          ]
        );

      if (exists.rowCount > 0) {
        return res.status(409).json({
          ok: false,
          error:
            "Username или email уже используется",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          cleanPassword,
          12
        );

      const userResult =
        await q(
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
            passwordHash,
          ]
        );

      const user =
        userResult.rows[0];

      await q(
        "DELETE FROM captchas WHERE id = $1",
        [captcha_id]
      );

      const sessionToken =
        createToken();

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
          user.id,
        ]
      );

      res.cookie(
        "fenix_session",
        sessionToken,
        sessionCookieOptions()
      );

      res.status(201).json({
        ok: true,
        user: safeUser(user),
        token: sessionToken,
      });
    } catch (error) {
      console.error(
        "Register error:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Ошибка регистрации",
      });
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
        password,
      } = req.body || {};

      const key =
        String(
          login ||
          email ||
          username ||
          ""
        )
          .trim()
          .toLowerCase();

      if (!key || !password) {
        return res.status(400).json({
          ok: false,
          error:
            "Введите логин и пароль",
        });
      }

      const result =
        await q(
          `
            SELECT *
            FROM users
            WHERE LOWER(email) = $1
               OR LOWER(username) = $1
            LIMIT 1
          `,
          [key]
        );

      const user =
        result.rows[0];

      if (
        !user ||
        !(await bcrypt.compare(
          String(password),
          user.password_hash
        ))
      ) {
        return res.status(401).json({
          ok: false,
          error:
            "Неверный логин или пароль",
        });
      }

      const sessionToken =
        createToken();

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
          user.id,
        ]
      );

      res.cookie(
        "fenix_session",
        sessionToken,
        sessionCookieOptions()
      );

      res.json({
        ok: true,
        user: safeUser(user),
        token: sessionToken,
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Ошибка входа",
      });
    }
  }
);

app.post(
  "/api/auth/logout",
  async (req, res) => {
    try {
      const token =
        req.cookies?.fenix_session;

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
          path: "/",
        }
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Ошибка выхода",
      });
    }
  }
);

app.put(
  "/api/auth/profile",
  requireUser,
  async (req, res) => {
    try {
      const {
        username,
        bio,
        avatar_url,
      } = req.body || {};

      const newUsername =
        String(username || "").trim();

      const newBio =
        String(bio || "");

      const newAvatar =
        String(
          avatar_url || ""
        );

      if (
        newUsername &&
        newUsername.length < 3
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Username слишком короткий",
        });
      }

      if (newUsername) {
        const duplicate =
          await q(
            `
              SELECT id
              FROM users
              WHERE LOWER(username) =
                    LOWER($1)
                AND id <> $2
              LIMIT 1
            `,
            [
              newUsername,
              req.user.id,
            ]
          );

        if (duplicate.rowCount) {
          return res.status(409).json({
            ok: false,
            error:
              "Username уже используется",
          });
        }
      }

      const result =
        await q(
          `
            UPDATE users
            SET
              username =
                CASE
                  WHEN $1 <> ''
                  THEN $1
                  ELSE username
                END,
              bio = $2,
              avatar_url = $3
            WHERE id = $4
            RETURNING *
          `,
          [
            newUsername,
            newBio,
            newAvatar,
            req.user.id,
          ]
        );

      res.json({
        ok: true,
        user: safeUser(
          result.rows[0]
        ),
      });
    } catch (error) {
      console.error(
        "Profile error:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить профиль",
      });
    }
  }
);

/* =========================================================
   MUSIC
========================================================= */

registerMusicRoutes(app);

/*
 * Main tracks API.
 *
 * Tracks are taken from /music.
 */

app.get(
  "/api/tracks",
  async (req, res) => {
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
        "Tracks error:",
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
  "/api/tracks/:id",
  async (req, res) => {
    try {
      const id =
        String(req.params.id);

      const tracks =
        getTracks();

      const track =
        tracks.find(
          (item) =>
            String(item.id) === id
        );

      if (!track) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден",
        });
      }

      res.json({
        ok: true,
        track,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить трек",
      });
    }
  }
);

/*
 * Audio endpoint compatible with frontend.
 */

app.get(
  "/api/tracks/:id/audio",
  async (req, res) => {
    try {
      const id =
        String(req.params.id);

      const tracks =
        getTracks();

      const track =
        tracks.find(
          (item) =>
            String(item.id) === id
        );

      if (!track) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден",
        });
      }

      if (!track.file_name) {
        return res.status(404).json({
          ok: false,
          error:
            "Аудиофайл отсутствует",
        });
      }

      req.params.file =
        track.file_name;

      return resolveAudio(
        req,
        res
      );
    } catch (error) {
      console.error(
        "Track audio error:",
        error
      );

      if (!res.headersSent) {
        res.status(500).json({
          ok: false,
          error:
            "Ошибка воспроизведения",
        });
      }
    }
  }
);

app.post(
  "/api/tracks/:id/play",
  async (req, res) => {
    try {
      /*
       * Files in /music are the source of truth.
       * We store play count in PostgreSQL when
       * a matching DB track exists.
       */

      const id =
        Number(req.params.id);

      if (
        Number.isInteger(id)
      ) {
        await q(
          `
            UPDATE tracks
            SET plays_count =
              plays_count + 1
            WHERE id = $1
          `,
          [id]
        );
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      res.json({
        ok: true,
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
            SELECT t.*
            FROM favorites f
            INNER JOIN tracks t
              ON t.id = f.track_id
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
          `,
          [req.user.id]
        );

      res.json({
        ok: true,
        tracks: result.rows,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить избранное",
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
        Number(req.body?.track_id);

      if (!Number.isInteger(trackId)) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный track_id",
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
          trackId,
        ]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось добавить в избранное",
      });
    }
  }
);

app.delete(
  "/api/favorites/:id",
  requireUser,
  async (req, res) => {
    try {
      await q(
        `
          DELETE FROM favorites
          WHERE user_id = $1
            AND track_id = $2
        `,
        [
          req.user.id,
          Number(req.params.id),
        ]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось удалить из избранного",
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
            ORDER BY h.played_at DESC
            LIMIT 100
          `,
          [req.user.id]
        );

      res.json({
        ok: true,
        tracks: result.rows,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить историю",
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
        Number(req.body?.track_id);

      if (!Number.isInteger(trackId)) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный track_id",
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
          trackId,
        ]
      );

      await q(
        `
          UPDATE tracks
          SET plays_count =
            plays_count + 1
          WHERE id = $1
        `,
        [trackId]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить историю",
      });
    }
  }
);

/* =========================================================
   MUSIC STORAGE INFO
========================================================= */

app.get(
  "/api/music/storage",
  (req, res) => {
    try {
      const musicDir =
        getMusicDir();

      const files =
        fs
          .readdirSync(
            musicDir,
            {
              withFileTypes: true,
            }
          )
          .filter(
            (entry) =>
              entry.isFile()
          )
          .map(
            (entry) =>
              entry.name
          );

      res.json({
        ok: true,
        directory: musicDir,
        files,
        count: files.length,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить содержимое music",
      });
    }
  }
);

/* =========================================================
   API 404
========================================================= */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      ok: false,
      error: "API route not found",
      path: req.originalUrl,
    });
  }
);

/* =========================================================
   FRONTEND
========================================================= */

const buildDir =
  findFrontendBuild();

if (buildDir) {
  console.log(
    "Frontend build:",
    buildDir
  );

  app.use(
    express.static(
      buildDir,
      {
        index: false,
        maxAge:
          NODE_ENV === "production"
            ? "1h"
            : 0,
      }
    )
  );
} else {
  console.log(
    "⚠️ Frontend build not found"
  );
}

/*
 * IMPORTANT:
 *
 * Do NOT use:
 *
 * app.get("*", ...)
 *
 * Express/path-to-regexp in the current
 * dependency versions rejects that pattern.
 *
 * Instead we use a normal middleware fallback.
 */

app.use(
  (req, res, next) => {
    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      return next();
    }

    if (
      req.originalUrl.startsWith(
        "/api"
      )
    ) {
      return next();
    }

    const currentBuild =
      findFrontendBuild();

    if (!currentBuild) {
      return res.status(503).send(`
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
              background: #050507;
              color: white;
              font-family: Arial,sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .box {
              text-align: center;
              padding: 30px;
            }
            h1 {
              color: #ef3030;
              letter-spacing: 3px;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>FENIX MUSIC</h1>
            <p>Backend работает.</p>
            <p>Frontend ещё не собран.</p>
          </div>
        </body>
        </html>
      `);
    }

    return res.sendFile(
      path.join(
        currentBuild,
        "index.html"
      )
    );
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      ok: false,
      error:
        "Внутренняя ошибка сервера",
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
    "🔥 FENIX MUSIC BACKEND 3.0"
  );
  console.log(
    "========================================"
  );

  console.log(
    "Node:",
    process.version
  );

  console.log(
    "Environment:",
    NODE_ENV
  );

  console.log(
    "Port:",
    PORT
  );

  console.log(
    "Music directory:",
    getMusicDir()
  );

  console.log(
    "Connecting to PostgreSQL..."
  );

  await initDatabase();

  const tracks =
    getTracks();

  console.log(
    `Music files found: ${tracks.length}`
  );

  const server =
    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log("");
        console.log(
          "========================================"
        );
        console.log(
          "✅ FENIX MUSIC BACKEND ONLINE"
        );
        console.log(
          "========================================"
        );
        console.log(
          `PORT: ${PORT}`
        );
        console.log(
          "API: /api"
        );
        console.log(
          "Health: /api/health"
        );
        console.log(
          "Tracks: /api/tracks"
        );
        console.log(
          "Music: /api/music"
        );
        console.log(
          "========================================"
        );
      }
    );

  const shutdown =
    async (signal) => {
      console.log(
        `${signal} received. Shutting down...`
      );

      server.close(
        async () => {
          try {
            await pool.end();
          } catch (error) {
            console.error(
              error
            );
          }

          process.exit(0);
        }
      );
    };

  process.once(
    "SIGTERM",
    () => shutdown("SIGTERM")
  );

  process.once(
    "SIGINT",
    () => shutdown("SIGINT")
  );
}

start().catch(
  (error) => {
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
);
