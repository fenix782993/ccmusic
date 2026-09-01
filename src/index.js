"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const cookieParser = require("cookie-parser");

const app = express();

const PORT = Number(process.env.PORT || 10000);

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL не задан.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/* =========================================================
   MIDDLEWARE
========================================================= */

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "5mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb",
  })
);

app.use(cookieParser());

/* =========================================================
   DATABASE
========================================================= */

async function q(text, params = []) {
  return pool.query(text, params);
}

async function initDatabase() {
  console.log("Initializing PostgreSQL database...");

  /*
   * USERS
   *
   * ВАЖНО:
   * ID везде BIGINT.
   */
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  /*
   * MIGRATION:
   * Если tracks существовала от старой версии без plays_count,
   * добавляем колонку.
   */
  await q(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS plays_count BIGINT NOT NULL DEFAULT 0
  `);

  /*
   * FAVORITES
   */
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

  /*
   * HISTORY
   */
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

  /*
   * =======================================================
   * SESSIONS
   *
   * У тебя была ошибка:
   *
   * user_id UUID
   * users.id BIGINT
   *
   * Поэтому PostgreSQL не мог создать FK.
   *
   * Удаляем ТОЛЬКО sessions.
   * Пользователи, треки, история и избранное не удаляются.
   * =======================================================
   */

  await q(`
    DROP TABLE IF EXISTS sessions
  `);

  await q(`
    CREATE TABLE sessions (
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
   * Индексы
   */
  await q(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON sessions(user_id)
  `);

  await q(`
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
    ON sessions(expires_at)
  `);

  await q(`
    CREATE INDEX IF NOT EXISTS idx_history_user_id
    ON history(user_id)
  `);

  await q(`
    CREATE INDEX IF NOT EXISTS idx_history_track_id
    ON history(track_id)
  `);

  /*
   * Тестовые треки.
   *
   * Добавляем только если таблица пустая.
   */
  const count = await q(`
    SELECT COUNT(*)::int AS count
    FROM tracks
  `);

  if (Number(count.rows[0].count) === 0) {
    console.log("Adding initial tracks...");

    await q(
      `
      INSERT INTO tracks (
        title,
        artist_name,
        album_name,
        cover_url,
        audio_url,
        duration
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      ),
      (
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      ),
      (
        $13,
        $14,
        $15,
        $16,
        $17,
        $18
      )
      `,
      [
        "Fenix Intro",
        "Fenix Music",
        "Fenix",
        "https://placehold.co/700x700/18181b/ffffff?text=FX",
        "",
        0,

        "Night Drive",
        "Fenix Music",
        "Fenix",
        "https://placehold.co/700x700/18181b/ffffff?text=NIGHT",
        "",
        0,

        "Neon Dreams",
        "Fenix Music",
        "Fenix",
        "https://placehold.co/700x700/18181b/ffffff?text=NEON",
        "",
        0,
      ]
    );
  }

  /*
   * Удаляем старые CAPTCHA.
   */
  await q(`
    DELETE FROM captchas
    WHERE expires_at < NOW()
  `);

  /*
   * Удаляем старые сессии.
   */
  await q(`
    DELETE FROM sessions
    WHERE expires_at < NOW()
  `);

  console.log("✅ PostgreSQL database initialized.");
}

/* =========================================================
   HELPERS
========================================================= */

function createToken() {
  return crypto.randomBytes(48).toString("hex");
}

function createCaptcha() {
  return crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();
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

async function currentUser(req) {
  try {
    const sessionToken =
      req.cookies?.fenix_session;

    if (!sessionToken) {
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
      [sessionToken]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error(
      "currentUser error:",
      error.message
    );

    return null;
  }
}

async function requireUser(req, res, next) {
  const user = await currentUser(req);

  if (!user) {
    return res.status(401).json({
      ok: false,
      error: "Требуется авторизация",
    });
  }

  req.user = user;

  next();
}

function setSessionCookie(res, token) {
  res.cookie(
    "fenix_session",
    token,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    }
  );
}

function clearSessionCookie(res) {
  res.clearCookie(
    "fenix_session",
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    }
  );
}

/* =========================================================
   BASIC
========================================================= */

app.get("/api", (req, res) => {
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

app.get("/api/health", async (req, res) => {
  try {
    await q("SELECT 1");

    res.json({
      ok: true,
      status: "healthy",
      database: "online",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Health error:",
      error.message
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
   AUTH — ME
========================================================= */

app.get(
  "/api/auth/me",
  async (req, res) => {
    const user = await currentUser(req);

    res.json({
      ok: true,
      user: safeUser(user),
    });
  }
);

/* =========================================================
   CAPTCHA
========================================================= */

app.get(
  "/api/auth/captcha",
  async (req, res) => {
    try {
      await q(`
        DELETE FROM captchas
        WHERE expires_at < NOW()
      `);

      const id = crypto.randomUUID();
      const answer = createCaptcha();

      await q(
        `
        INSERT INTO captchas (
          id,
          answer,
          expires_at
        )
        VALUES (
          $1,
          $2,
          NOW() + INTERVAL '10 minutes'
        )
        `,
        [
          id,
          answer,
        ]
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

/* =========================================================
   REGISTER
========================================================= */

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

      const cleanCaptcha =
        String(captcha || "")
          .trim()
          .toUpperCase();

      if (
        !cleanUsername ||
        !cleanEmail ||
        !password
      ) {
        return res.status(400).json({
          ok: false,
          error: "Заполните все поля",
        });
      }

      if (cleanUsername.length < 2) {
        return res.status(400).json({
          ok: false,
          error:
            "Username должен содержать минимум 2 символа",
        });
      }

      if (cleanUsername.length > 64) {
        return res.status(400).json({
          ok: false,
          error:
            "Username слишком длинный",
        });
      }

      if (String(password).length < 6) {
        return res.status(400).json({
          ok: false,
          error:
            "Пароль должен содержать минимум 6 символов",
        });
      }

      /*
       * CAPTCHA
       */
      const captchaResult = await q(
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
        captchaResult.rows[0].answer !==
          cleanCaptcha
      ) {
        return res.status(400).json({
          ok: false,
          error: "Неверная CAPTCHA",
        });
      }

      /*
       * Проверяем пользователя.
       */
      const existing = await q(
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
          cleanUsername,
        ]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          ok: false,
          error:
            "Username или email уже используется",
        });
      }

      /*
       * Password hash
       */
      const passwordHash =
        await bcrypt.hash(
          String(password),
          12
        );

      /*
       * User
       */
      const userResult = await q(
        `
        INSERT INTO users (
          username,
          email,
          password_hash
        )
        VALUES (
          $1,
          $2,
          $3
        )
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

      /*
       * CAPTCHA больше не нужна.
       */
      await q(
        `
        DELETE FROM captchas
        WHERE id = $1
        `,
        [captcha_id]
      );

      /*
       * Session
       */
      const sessionToken =
        createToken();

      await q(
        `
        INSERT INTO sessions (
          token,
          user_id,
          expires_at
        )
        VALUES (
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

      setSessionCookie(
        res,
        sessionToken
      );

      res.status(201).json({
        ok: true,
        user: safeUser(user),
        token: sessionToken,
      });
    } catch (error) {
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
            "Username или email уже используется",
        });
      }

      res.status(500).json({
        ok: false,
        error:
          "Ошибка регистрации",
      });
    }
  }
);

/* =========================================================
   LOGIN
========================================================= */

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

      const key = String(
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

      const result = await q(
        `
        SELECT *
        FROM users
        WHERE
          LOWER(email) = $1
          OR LOWER(username) = $1
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
            "Неверный логин или пароль",
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
            "Неверный логин или пароль",
        });
      }

      /*
       * Удаляем старые сессии пользователя.
       */
      await q(
        `
        DELETE FROM sessions
        WHERE
          user_id = $1
          OR expires_at < NOW()
        `,
        [user.id]
      );

      const sessionToken =
        createToken();

      await q(
        `
        INSERT INTO sessions (
          token,
          user_id,
          expires_at
        )
        VALUES (
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

      setSessionCookie(
        res,
        sessionToken
      );

      res.json({
        ok: true,
        user: safeUser(user),
        token: sessionToken,
      });
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error: "Ошибка входа",
      });
    }
  }
);

/* =========================================================
   LOGOUT
========================================================= */

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

      clearSessionCookie(res);

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "LOGOUT ERROR:",
        error
      );

      clearSessionCookie(res);

      res.json({
        ok: true,
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
        bio,
      } = req.body || {};

      const newUsername =
        String(
          username ??
            req.user.username
        ).trim();

      const newBio =
        String(
          bio ??
            req.user.bio ??
            ""
        ).trim();

      if (!newUsername) {
        return res.status(400).json({
          ok: false,
          error:
            "Username не может быть пустым",
        });
      }

      if (newUsername.length > 64) {
        return res.status(400).json({
          ok: false,
          error:
            "Username слишком длинный",
        });
      }

      const result = await q(
        `
        UPDATE users
        SET
          username = $1,
          bio = $2
        WHERE id = $3
        RETURNING *
        `,
        [
          newUsername,
          newBio,
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
        "PROFILE ERROR:",
        error
      );

      if (
        error.code === "23505"
      ) {
        return res.status(409).json({
          ok: false,
          error:
            "Этот username уже занят",
        });
      }

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить профиль",
      });
    }
  }
);

/* =========================================================
   CHANGE PASSWORD
========================================================= */

app.post(
  "/api/auth/password",
  requireUser,
  async (req, res) => {
    try {
      const {
        currentPassword,
        password,
        newPassword,
      } = req.body || {};

      const nextPassword =
        newPassword ||
        password;

      if (!nextPassword) {
        return res.status(400).json({
          ok: false,
          error:
            "Новый пароль не указан",
        });
      }

      if (
        String(nextPassword).length < 6
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Пароль должен содержать минимум 6 символов",
        });
      }

      const userResult = await q(
        `
        SELECT *
        FROM users
        WHERE id = $1
        `,
        [req.user.id]
      );

      const user =
        userResult.rows[0];

      if (!user) {
        return res.status(404).json({
          ok: false,
          error:
            "Пользователь не найден",
        });
      }

      if (currentPassword) {
        const valid =
          await bcrypt.compare(
            String(currentPassword),
            user.password_hash
          );

        if (!valid) {
          return res.status(401).json({
            ok: false,
            error:
              "Текущий пароль неверный",
          });
        }
      }

      const hash =
        await bcrypt.hash(
          String(nextPassword),
          12
        );

      await q(
        `
        UPDATE users
        SET password_hash = $1
        WHERE id = $2
        `,
        [
          hash,
          req.user.id,
        ]
      );

      /*
       * После смены пароля
       * удаляем старые сессии.
       */
      await q(
        `
        DELETE FROM sessions
        WHERE user_id = $1
        `,
        [req.user.id]
      );

      clearSessionCookie(res);

      res.json({
        ok: true,
        message:
          "Пароль изменён",
      });
    } catch (error) {
      console.error(
        "PASSWORD ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось изменить пароль",
      });
    }
  }
);

/* =========================================================
   LOGOUT ALL DEVICES
========================================================= */

app.post(
  "/api/auth/logout-all",
  requireUser,
  async (req, res) => {
    try {
      await q(
        `
        DELETE FROM sessions
        WHERE user_id = $1
        `,
        [req.user.id]
      );

      clearSessionCookie(res);

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "LOGOUT ALL ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось завершить сессии",
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
      const result = await q(
        `
        SELECT
          id,
          title,
          artist_name,
          album_name,
          cover_url,
          audio_url,
          duration,
          plays_count,
          created_at
        FROM tracks
        ORDER BY id DESC
        `
      );

      res.json({
        ok: true,
        tracks: result.rows,
      });
    } catch (error) {
      console.error(
        "TRACKS ERROR:",
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

/* =========================================================
   SINGLE TRACK
========================================================= */

app.get(
  "/api/tracks/:id",
  async (req, res) => {
    try {
      const result = await q(
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
          error: "Трек не найден",
        });
      }

      res.json({
        ok: true,
        track: result.rows[0],
      });
    } catch (error) {
      console.error(
        "TRACK ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить трек",
      });
    }
  }
);

/* =========================================================
   TRACK AUDIO
========================================================= */

app.get(
  "/api/tracks/:id/audio",
  async (req, res) => {
    try {
      const result = await q(
        `
        SELECT
          id,
          audio_url
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
          error: "Трек не найден",
        });
      }

      if (!track.audio_url) {
        return res.status(404).json({
          ok: false,
          error:
            "У трека отсутствует audio_url",
        });
      }

      return res.redirect(
        track.audio_url
      );
    } catch (error) {
      console.error(
        "AUDIO ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить аудио",
      });
    }
  }
);

/* =========================================================
   PLAY TRACK
========================================================= */

app.post(
  "/api/tracks/:id/play",
  async (req, res) => {
    try {
      const result = await q(
        `
        UPDATE tracks
        SET plays_count = plays_count + 1
        WHERE id = $1
        RETURNING id, plays_count
        `,
        [req.params.id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          error: "Трек не найден",
        });
      }

      res.json({
        ok: true,
        track_id: result.rows[0].id,
        plays_count:
          result.rows[0].plays_count,
      });
    } catch (error) {
      console.error(
        "PLAY ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось засчитать прослушивание",
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
      const result = await q(
        `
        SELECT
          t.*
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
      console.error(
        "FAVORITES GET ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        tracks: [],
        error:
          "Не удалось получить избранное",
      });
    }
  }
);

/* =========================================================
   ADD FAVORITE
========================================================= */

app.post(
  "/api/favorites",
  requireUser,
  async (req, res) => {
    try {
      const trackId =
        req.body?.track_id;

      if (!trackId) {
        return res.status(400).json({
          ok: false,
          error:
            "track_id обязателен",
        });
      }

      const track = await q(
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
          error: "Трек не найден",
        });
      }

      await q(
        `
        INSERT INTO favorites (
          user_id,
          track_id
        )
        VALUES (
          $1,
          $2
        )
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
      });
    } catch (error) {
      console.error(
        "FAVORITE ADD ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось добавить в избранное",
      });
    }
  }
);

/* =========================================================
   REMOVE FAVORITE
========================================================= */

app.delete(
  "/api/favorites/:id",
  requireUser,
  async (req, res) => {
    try {
      await q(
        `
        DELETE FROM favorites
        WHERE
          user_id = $1
          AND track_id = $2
        `,
        [
          req.user.id,
          req.params.id,
        ]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "FAVORITE DELETE ERROR:",
        error
      );

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
      const result = await q(
        `
        SELECT
          t.*,
          h.played_at
        FROM history h
        INNER JOIN tracks t
          ON t.id = h.track_id
        WHERE h.user_id = $1
        ORDER BY h.played_at DESC
        LIMIT 200
        `,
        [req.user.id]
      );

      res.json({
        ok: true,
        tracks: result.rows,
      });
    } catch (error) {
      console.error(
        "HISTORY GET ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        tracks: [],
        error:
          "Не удалось получить историю",
      });
    }
  }
);

/* =========================================================
   ADD HISTORY
========================================================= */

app.post(
  "/api/history",
  requireUser,
  async (req, res) => {
    try {
      const trackId =
        req.body?.track_id;

      if (!trackId) {
        return res.status(400).json({
          ok: false,
          error:
            "track_id обязателен",
        });
      }

      const track = await q(
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
          error: "Трек не найден",
        });
      }

      await q(
        `
        INSERT INTO history (
          user_id,
          track_id
        )
        VALUES (
          $1,
          $2
        )
        `,
        [
          req.user.id,
          trackId,
        ]
      );

      await q(
        `
        UPDATE tracks
        SET plays_count = plays_count + 1
        WHERE id = $1
        `,
        [trackId]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "HISTORY ADD ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить историю",
      });
    }
  }
);

/* =========================================================
   FRONTEND
========================================================= */

/*
 * Render может запускать backend из разных рабочих директорий.
 *
 * Поэтому НЕ используем один жёсткий путь.
 *
 * Проверяем:
 *
 * /project/src/frontend/build
 * /project/src/frontend/dist
 * /project/frontend/build
 * /project/frontend/dist
 * /project/src/backend/frontend/build
 * /project/src/backend/frontend/dist
 */

const possibleFrontendDirs = [
  path.resolve(
    __dirname,
    "..",
    "..",
    "frontend",
    "build"
  ),

  path.resolve(
    __dirname,
    "..",
    "..",
    "frontend",
    "dist"
  ),

  path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "frontend",
    "build"
  ),

  path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "frontend",
    "dist"
  ),

  path.resolve(
    process.cwd(),
    "frontend",
    "build"
  ),

  path.resolve(
    process.cwd(),
    "frontend",
    "dist"
  ),

  path.resolve(
    process.cwd(),
    "build"
  ),

  path.resolve(
    process.cwd(),
    "dist"
  ),
];

let frontendDir = null;

for (
  const candidate of possibleFrontendDirs
) {
  const indexFile =
    path.join(
      candidate,
      "index.html"
    );

  if (
    fs.existsSync(indexFile)
  ) {
    frontendDir = candidate;
    break;
  }
}

if (frontendDir) {
  console.log(
    "✅ Frontend found:"
  );

  console.log(
    frontendDir
  );

  console.log(
    "Frontend index:"
  );

  console.log(
    path.join(
      frontendDir,
      "index.html"
    )
  );

  app.use(
    express.static(frontendDir, {
      index: false,
      maxAge:
        process.env.NODE_ENV ===
        "production"
          ? "1h"
          : 0,
    })
  );
} else {
  console.warn(
    "⚠️ FRONTEND BUILD NOT FOUND."
  );

  console.warn(
    "Checked directories:"
  );

  for (
    const dir of possibleFrontendDirs
  ) {
    console.warn(
      " - " + dir
    );
  }
}

/* =========================================================
   FRONTEND ROOT
========================================================= */

app.get(
  "/",
  (req, res) => {
    if (!frontendDir) {
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
              background: #09090b;
              color: white;
              font-family: Arial, sans-serif;
            }
            div {
              text-align: center;
              padding: 30px;
            }
            h1 {
              margin-bottom: 10px;
            }
            p {
              color: #a1a1aa;
            }
          </style>
        </head>
        <body>
          <div>
            <h1>Fenix Music Backend</h1>
            <p>
              Backend работает, но frontend build не найден.
            </p>
            <p>
              Проверь сборку frontend.
            </p>
          </div>
        </body>
        </html>
      `);
    }

    const indexFile =
      path.join(
        frontendDir,
        "index.html"
      );

    res.sendFile(indexFile);
  }
);

/* =========================================================
   SPA FALLBACK
========================================================= */

/*
 * Все НЕ-API маршруты должны отдавать
 * React index.html.
 *
 * Например:
 *
 * /
 * /profile
 * /settings
 * /security
 * /login
 * /library
 * /favorites
 */

app.get(
  /^\/(?!api(?:\/|$)).*/,
  (req, res) => {
    if (!frontendDir) {
      return res.status(503).send(
        "Frontend build not found"
      );
    }

    const indexFile =
      path.join(
        frontendDir,
        "index.html"
      );

    if (
      !fs.existsSync(indexFile)
    ) {
      return res.status(503).send(
        "Frontend index.html not found"
      );
    }

    res.sendFile(indexFile);
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
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "GLOBAL ERROR:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      ok: false,
      error:
        "Internal server error",
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
    "🔥 FENIX MUSIC BACKEND"
  );
  console.log(
    "========================================"
  );

  console.log(
    "Node:",
    process.version
  );

  console.log(
    "PORT:",
    PORT
  );

  console.log(
    "NODE_ENV:",
    process.env.NODE_ENV ||
      "development"
  );

  console.log(
    "Working directory:",
    process.cwd()
  );

  console.log(
    "Backend directory:",
    __dirname
  );

  console.log("");
  console.log(
    "Connecting to PostgreSQL..."
  );

  await q("SELECT NOW()");

  console.log(
    "✅ PostgreSQL connection OK"
  );

  await initDatabase();

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
          "🔥 FENIX MUSIC ONLINE"
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

        if (frontendDir) {
          console.log(
            "Frontend: " +
              frontendDir
          );
        } else {
          console.log(
            "Frontend: NOT FOUND"
          );
        }

        console.log(
          "========================================"
        );
        console.log("");
      }
    );

  server.on(
    "error",
    (error) => {
      console.error(
        "SERVER ERROR:",
        error
      );
    }
  );
}

/* =========================================================
   PROCESS HANDLERS
========================================================= */

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "UNHANDLED REJECTION:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );

    process.exit(1);
  }
);

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

/* =========================================================
   RUN
========================================================= */

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
