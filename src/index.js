"use strict";

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const cookieParser = require("cookie-parser");

const {
  registerMusicRoutes,
  ensureMusicDir,
  getTracks,
} = require("./music");

const app = express();

const PORT = Number(process.env.PORT || 10000);

const NODE_ENV =
  process.env.NODE_ENV || "production";

const DATABASE_URL =
  process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL is not configured"
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl:
    NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
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

const ROOT_DIR = path.join(
  __dirname,
  ".."
);

const FRONTEND_DIR = path.join(
  ROOT_DIR,
  "frontend"
);

const FRONTEND_BUILD = path.join(
  FRONTEND_DIR,
  "build"
);

const FRONTEND_INDEX = path.join(
  FRONTEND_BUILD,
  "index.html"
);

/* =========================================================
   DATABASE
========================================================= */

async function q(text, params = []) {
  return pool.query(text, params);
}

async function initDatabase() {
  console.log(
    "Initializing PostgreSQL database..."
  );

  /*
   * USERS
   *
   * id = BIGINT
   *
   * Все таблицы, которые ссылаются
   * на users.id, используют BIGINT.
   */
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,

      username VARCHAR(64)
        NOT NULL
        UNIQUE,

      email VARCHAR(255)
        NOT NULL
        UNIQUE,

      password_hash TEXT
        NOT NULL,

      bio TEXT
        NOT NULL
        DEFAULT '',

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    )
  `);

  /*
   * TRACKS
   */
  await q(`
    CREATE TABLE IF NOT EXISTS tracks (
      id BIGSERIAL PRIMARY KEY,

      title TEXT
        NOT NULL,

      artist_name TEXT
        NOT NULL
        DEFAULT 'Unknown',

      album_name TEXT
        NOT NULL
        DEFAULT '',

      cover_url TEXT
        NOT NULL
        DEFAULT '',

      audio_url TEXT
        NOT NULL
        DEFAULT '',

      duration INTEGER
        NOT NULL
        DEFAULT 0,

      plays_count BIGINT
        NOT NULL
        DEFAULT 0,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    )
  `);

  /*
   * На случай старой БД:
   * добавляем недостающие колонки.
   */

  await q(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS
    plays_count BIGINT NOT NULL DEFAULT 0
  `);

  await q(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS
    duration INTEGER NOT NULL DEFAULT 0
  `);

  await q(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS
    cover_url TEXT NOT NULL DEFAULT ''
  `);

  await q(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS
    audio_url TEXT NOT NULL DEFAULT ''
  `);

  await q(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS
    artist_name TEXT NOT NULL DEFAULT 'Unknown'
  `);

  await q(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS
    album_name TEXT NOT NULL DEFAULT ''
  `);

  /*
   * FAVORITES
   */
  await q(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id BIGINT NOT NULL,
      track_id BIGINT NOT NULL,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      PRIMARY KEY (
        user_id,
        track_id
      ),

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

      played_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

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
   * SESSIONS
   *
   * ВАЖНО:
   * user_id BIGINT.
   *
   * Это исправляет твою прошлую ошибку:
   *
   * uuid and bigint
   */
  await q(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,

      user_id BIGINT NOT NULL,

      expires_at TIMESTAMPTZ
        NOT NULL,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      CONSTRAINT sessions_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  /*
   * CAPTCHAS
   */
  await q(`
    CREATE TABLE IF NOT EXISTS captchas (
      id TEXT PRIMARY KEY,

      answer TEXT NOT NULL,

      expires_at TIMESTAMPTZ
        NOT NULL,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    )
  `);

  /*
   * SETTINGS
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

      updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      CONSTRAINT user_settings_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  /*
   * INDEXES
   */
  await q(`
    CREATE INDEX IF NOT EXISTS
    idx_sessions_user_id
    ON sessions(user_id)
  `);

  await q(`
    CREATE INDEX IF NOT EXISTS
    idx_sessions_expires
    ON sessions(expires_at)
  `);

  await q(`
    CREATE INDEX IF NOT EXISTS
    idx_history_user_id
    ON history(user_id)
  `);

  await q(`
    CREATE INDEX IF NOT EXISTS
    idx_history_track_id
    ON history(track_id)
  `);

  await q(`
    CREATE INDEX IF NOT EXISTS
    idx_favorites_user_id
    ON favorites(user_id)
  `);

  /*
   * Удаляем старые CAPTCHA
   */
  await q(`
    DELETE FROM captchas
    WHERE expires_at < NOW()
  `);

  console.log(
    "PostgreSQL database initialized"
  );
}

/* =========================================================
   AUTH HELPERS
========================================================= */

function makeToken() {
  return crypto
    .randomBytes(48)
    .toString("hex");
}

function makeCaptcha() {
  return crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase();
}

function safeUser(user) {
  if (!user) {
    return null;
  }

  const {
    password_hash,
    ...result
  } = user;

  return result;
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
      error
    );

    return null;
  }
}

async function createSession(userId) {
  const token = makeToken();

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
    [token, userId]
  );

  return token;
}

function setSessionCookie(
  res,
  token
) {
  res.cookie(
    "fenix_session",
    token,
    {
      httpOnly: true,

      secure:
        NODE_ENV === "production",

      sameSite: "lax",

      maxAge:
        30 * 24 * 60 * 60 * 1000,

      path: "/",
    }
  );
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
          "Требуется авторизация",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error:
        "Ошибка авторизации",
    });
  }
}

/* =========================================================
   BASIC
========================================================= */

app.get(
  "/api",
  async (req, res) => {
    res.json({
      ok: true,

      service:
        "Fenix Music Backend",

      version: "3.0.0",

      status: "online",

      api: "/api",

      health:
        "/api/health",

      tracks:
        "/api/tracks",

      music:
        "/api/music",

      auth:
        "/api/auth",
    });
  }
);

app.get(
  "/api/health",
  async (req, res) => {
    try {
      await q("SELECT 1");

      res.json({
        ok: true,

        status: "healthy",

        database: "online",

        service:
          "Fenix Music Backend",

        version: "3.0.0",

        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Health error:",
        error
      );

      res.status(500).json({
        ok: false,

        status: "unhealthy",

        database: "offline",

        error: error.message,
      });
    }
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

      const id =
        crypto.randomUUID();

      const answer =
        makeCaptcha();

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
        [id, answer]
      );

      res.json({
        ok: true,

        id,

        captcha_id: id,

        text: answer,
      });
    } catch (error) {
      console.error(
        "CAPTCHA error:",
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

/* =========================================================
   AUTH ME
========================================================= */

app.get(
  "/api/auth/me",
  async (req, res) => {
    try {
      const user =
        await currentUser(req);

      res.json({
        ok: true,

        user:
          safeUser(user),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,

        error:
          "Не удалось проверить сессию",
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
        String(
          username || ""
        ).trim();

      const cleanEmail =
        String(
          email || ""
        ).trim()
        .toLowerCase();

      const cleanPassword =
        String(password || "");

      const cleanCaptcha =
        String(
          captcha || ""
        )
        .trim()
        .toUpperCase();

      if (
        !cleanUsername ||
        !cleanEmail ||
        !cleanPassword
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Заполните все поля",
        });
      }

      if (
        cleanUsername.length < 2
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Username слишком короткий",
        });
      }

      if (
        cleanUsername.length > 64
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Username слишком длинный",
        });
      }

      if (
        !/^[a-zA-Z0-9_.-]+$/.test(
          cleanUsername
        )
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Username может содержать только буквы, цифры, _, . и -",
        });
      }

      if (
        cleanPassword.length < 6
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Пароль должен содержать минимум 6 символов",
        });
      }

      if (
        !captcha_id ||
        !cleanCaptcha
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Введите CAPTCHA",
        });
      }

      const captchaResult =
        await q(
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

      const captchaRow =
        captchaResult.rows[0];

      if (
        !captchaRow ||
        String(
          captchaRow.answer
        ).toUpperCase() !==
          cleanCaptcha
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Неверная CAPTCHA",
        });
      }

      const existing =
        await q(
          `
            SELECT id
            FROM users
            WHERE
              lower(email) = lower($1)
              OR lower(username) = lower($2)
            LIMIT 1
          `,
          [
            cleanEmail,
            cleanUsername,
          ]
        );

      if (existing.rows.length) {
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

      await q(
        `
          DELETE FROM captchas
          WHERE id = $1
        `,
        [captcha_id]
      );

      await q(
        `
          INSERT INTO user_settings (
            user_id
          )
          VALUES ($1)
          ON CONFLICT (user_id)
          DO NOTHING
        `,
        [user.id]
      );

      const sessionToken =
        await createSession(
          user.id
        );

      setSessionCookie(
        res,
        sessionToken
      );

      res.status(201).json({
        ok: true,

        user:
          safeUser(user),

        token:
          sessionToken,
      });
    } catch (error) {
      console.error(
        "Register error:",
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
            "Введите логин и пароль",
        });
      }

      const result =
        await q(
          `
            SELECT *
            FROM users
            WHERE
              lower(email) = lower($1)
              OR lower(username) = lower($1)
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

      const sessionToken =
        await createSession(
          user.id
        );

      setSessionCookie(
        res,
        sessionToken
      );

      res.json({
        ok: true,

        user:
          safeUser(user),

        token:
          sessionToken,
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
      console.error(
        "Logout error:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Ошибка выхода",
      });
    }
  }
);

/* =========================================================
   PROFILE
========================================================= */

app.get(
  "/api/auth/profile",
  requireUser,
  async (req, res) => {
    res.json({
      ok: true,

      user:
        safeUser(req.user),
    });
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
      } = req.body || {};

      let newUsername =
        username === undefined
          ? req.user.username
          : String(username).trim();

      const newBio =
        bio === undefined
          ? req.user.bio
          : String(bio);

      if (
        !newUsername ||
        newUsername.length < 2
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Некорректный username",
        });
      }

      if (
        !/^[a-zA-Z0-9_.-]+$/.test(
          newUsername
        )
      ) {
        return res.status(400).json({
          ok: false,

          error:
            "Некорректный username",
        });
      }

      const duplicate =
        await q(
          `
            SELECT id
            FROM users
            WHERE
              lower(username) =
              lower($1)
              AND id <> $2
            LIMIT 1
          `,
          [
            newUsername,
            req.user.id,
          ]
        );

      if (duplicate.rows.length) {
        return res.status(409).json({
          ok: false,

          error:
            "Этот username уже занят",
        });
      }

      const result =
        await q(
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

        user:
          safeUser(
            result.rows[0]
          ),
      });
    } catch (error) {
      console.error(
        "Profile update error:",
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
              auto_next,
              notifications,
              language
            FROM user_settings
            WHERE user_id = $1
            LIMIT 1
          `,
          [req.user.id]
        );

      let settings =
        result.rows[0];

      if (!settings) {
        const inserted =
          await q(
            `
              INSERT INTO user_settings (
                user_id
              )
              VALUES ($1)
              RETURNING
                theme,
                quality,
                autoplay,
                auto_next,
                notifications,
                language
            `,
            [req.user.id]
          );

        settings =
          inserted.rows[0];
      }

      res.json({
        ok: true,

        settings: {
          theme:
            settings.theme,

          quality:
            settings.quality,

          autoplay:
            settings.autoplay,

          autoNext:
            settings.auto_next,

          notifications:
            settings.notifications,

          language:
            settings.language,
        },
      });
    } catch (error) {
      console.error(
        "Settings GET error:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Не удалось получить настройки",
      });
    }
  }
);

app.put(
  "/api/settings",
  requireUser,
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const theme =
        body.theme === "light"
          ? "light"
          : "dark";

      const quality =
        ["normal", "high", "max"]
          .includes(body.quality)
          ? body.quality
          : "high";

      const autoplay =
        body.autoplay !== undefined
          ? Boolean(body.autoplay)
          : true;

      const autoNext =
        body.autoNext !== undefined
          ? Boolean(body.autoNext)
          : true;

      const notifications =
        body.notifications !== undefined
          ? Boolean(
              body.notifications
            )
          : true;

      const language =
        body.language === "en"
          ? "en"
          : "ru";

      const result =
        await q(
          `
            INSERT INTO user_settings (
              user_id,
              theme,
              quality,
              autoplay,
              auto_next,
              notifications,
              language,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              NOW()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
              theme = EXCLUDED.theme,
              quality = EXCLUDED.quality,
              autoplay = EXCLUDED.autoplay,
              auto_next = EXCLUDED.auto_next,
              notifications =
                EXCLUDED.notifications,
              language =
                EXCLUDED.language,
              updated_at = NOW()
            RETURNING
              theme,
              quality,
              autoplay,
              auto_next,
              notifications,
              language
          `,
          [
            req.user.id,
            theme,
            quality,
            autoplay,
            autoNext,
            notifications,
            language,
          ]
        );

      const settings =
        result.rows[0];

      res.json({
        ok: true,

        settings: {
          theme:
            settings.theme,

          quality:
            settings.quality,

          autoplay:
            settings.autoplay,

          autoNext:
            settings.auto_next,

          notifications:
            settings.notifications,

          language:
            settings.language,
        },
      });
    } catch (error) {
      console.error(
        "Settings PUT error:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Не удалось сохранить настройки",
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
            SELECT *
            FROM tracks
            ORDER BY
              created_at DESC,
              id DESC
          `
        );

      res.json({
        ok: true,

        tracks:
          result.rows,

        count:
          result.rows.length,
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
            "Трек не найден",
        });
      }

      res.json({
        ok: true,

        track:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,

        error:
          "Ошибка получения трека",
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
      const result =
        await q(
          `
            SELECT
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

          error:
            "Трек не найден",
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
        "Track audio error:",
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
   PLAY
========================================================= */

app.post(
  "/api/tracks/:id/play",
  async (req, res) => {
    try {
      const result =
        await q(
          `
            UPDATE tracks
            SET
              plays_count =
                plays_count + 1
            WHERE id = $1
            RETURNING
              id,
              plays_count
          `,
          [req.params.id]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,

          error:
            "Трек не найден",
        });
      }

      res.json({
        ok: true,

        track:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Play error:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Не удалось записать прослушивание",
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
            WHERE
              f.user_id = $1
            ORDER BY
              f.created_at DESC
          `,
          [req.user.id]
        );

      res.json({
        ok: true,

        tracks:
          result.rows,
      });
    } catch (error) {
      console.error(error);

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
        req.body?.track_id;

      if (!trackId) {
        return res.status(400).json({
          ok: false,

          error:
            "track_id обязателен",
        });
      }

      const track =
        await q(
          `
            SELECT id
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [trackId]
        );

      if (!track.rows[0]) {
        return res.status(404).json({
          ok: false,

          error:
            "Трек не найден",
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
        "Favorite add error:",
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
        "Favorite delete error:",
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
      const result =
        await q(
          `
            SELECT
              t.*,
              h.played_at
            FROM history h
            INNER JOIN tracks t
              ON t.id = h.track_id
            WHERE
              h.user_id = $1
            ORDER BY
              h.played_at DESC
            LIMIT 100
          `,
          [req.user.id]
        );

      res.json({
        ok: true,

        tracks:
          result.rows,
      });
    } catch (error) {
      console.error(error);

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
        req.body?.track_id;

      if (!trackId) {
        return res.status(400).json({
          ok: false,

          error:
            "track_id обязателен",
        });
      }

      const track =
        await q(
          `
            SELECT id
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [trackId]
        );

      if (!track.rows[0]) {
        return res.status(404).json({
          ok: false,

          error:
            "Трек не найден",
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
          SET
            plays_count =
              plays_count + 1
          WHERE id = $1
        `,
        [trackId]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "History error:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Не удалось записать историю",
      });
    }
  }
);

/* =========================================================
   MUSIC FILE SYSTEM
========================================================= */

ensureMusicDir();

registerMusicRoutes(app);

/*
 * Дополнительный endpoint для frontend.
 *
 * Музыка берётся из:
 *
 * /music/*.mp3
 * /music/*.wav
 * /music/*.m4a
 * /music/*.ogg
 * ...
 */

app.get(
  "/api/music/library",
  async (req, res) => {
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
        "Music library error:",
        error
      );

      res.status(500).json({
        ok: false,

        error:
          "Не удалось получить музыкальную библиотеку",
      });
    }
  }
);

/* =========================================================
   FRONTEND
========================================================= */

function frontendExists() {
  try {
    return (
      require("fs").existsSync(
        FRONTEND_INDEX
      )
    );
  } catch {
    return false;
  }
}

/*
 * Статические файлы React.
 */

app.use(
  express.static(
    FRONTEND_BUILD,
    {
      index: false,

      maxAge:
        NODE_ENV === "production"
          ? "1d"
          : 0,
    }
  )
);

/*
 * Корневой сайт.
 */

app.get(
  "/",
  (req, res) => {
    if (
      frontendExists()
    ) {
      return res.sendFile(
        FRONTEND_INDEX
      );
    }

    res.status(503).send(`
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
            display: flex;
            align-items: center;
            justify-content: center;
            background:
              radial-gradient(
                circle at top,
                #18181b,
                #050507 65%
              );
            color: white;
            font-family:
              Inter,
              Arial,
              sans-serif;
          }

          .box {
            width: min(
              520px,
              calc(100% - 32px)
            );
            padding: 40px;
            border: 1px solid
              rgba(255,255,255,.08);
            border-radius: 24px;
            background:
              rgba(18,18,22,.9);
            box-shadow:
              0 30px 80px
              rgba(0,0,0,.5);
            text-align: center;
          }

          .logo {
            width: 72px;
            height: 72px;
            margin: 0 auto 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 20px;
            background:
              linear-gradient(
                135deg,
                #ff3030,
                #9f1239
              );
            font-weight: 900;
            font-size: 26px;
          }

          h1 {
            margin: 0 0 12px;
          }

          p {
            color: #a1a1aa;
            line-height: 1.6;
          }

          code {
            display: inline-block;
            margin-top: 10px;
            padding: 8px 12px;
            border-radius: 8px;
            background: #09090b;
            color: #f87171;
          }
        </style>
      </head>

      <body>
        <div class="box">
          <div class="logo">
            FX
          </div>

          <h1>
            Fenix Music
          </h1>

          <p>
            Backend работает.
            Frontend ещё не собран.
          </p>

          <p>
            Render должен выполнить
            <code>npm run build</code>
            для frontend.
          </p>

          <p>
            API уже работает:
            <code>/api/health</code>
          </p>
        </div>
      </body>
      </html>
    `);
  }
);

/*
 * React SPA fallback.
 *
 * Важно:
 * API обрабатываются раньше.
 */

app.get(
  "*",
  (req, res) => {
    if (
      req.path.startsWith(
        "/api/"
      )
    ) {
      return res.status(404).json({
        ok: false,

        error:
          "API route not found",
      });
    }

    if (
      frontendExists()
    ) {
      return res.sendFile(
        FRONTEND_INDEX
      );
    }

    res.status(503).send(`
      <!doctype html>
      <html lang="ru">
      <head>
        <meta charset="utf-8">
        <title>Fenix Music</title>
      </head>
      <body
        style="
          margin:0;
          background:#09090b;
          color:#fff;
          font-family:Arial;
          display:flex;
          align-items:center;
          justify-content:center;
          min-height:100vh;
        "
      >
        <div style="text-align:center">
          <h1>FENIX MUSIC</h1>
          <p>
            Backend работает.
            Frontend ещё не собран.
          </p>
        </div>
      </body>
      </html>
    `);
  }
);

/* =========================================================
   404 JSON
========================================================= */

app.use(
  (err, req, res, next) => {
    console.error(
      "Express error:",
      err
    );

    if (
      res.headersSent
    ) {
      return next(err);
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
    "Environment:",
    NODE_ENV
  );
  console.log(
    "Port:",
    PORT
  );
  console.log(
    "Frontend:",
    FRONTEND_BUILD
  );
  console.log(
    "Music:",
    path.join(
      ROOT_DIR,
      "music"
    )
  );
  console.log(
    "========================================"
  );
  console.log("");

  console.log(
    "Connecting to PostgreSQL..."
  );

  await q("SELECT NOW()");

  console.log(
    "PostgreSQL connection OK"
  );

  await initDatabase();

  ensureMusicDir();

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
        `🌐 PORT: ${PORT}`
      );

      console.log(
        `📡 API: /api`
      );

      console.log(
        `❤️ HEALTH: /api/health`
      );

      console.log(
        `🎵 MUSIC: /api/music`
      );

      console.log(
        `🎧 TRACKS: /api/tracks`
      );

      console.log(
        `🔐 AUTH: /api/auth`
      );

      console.log(
        `🎨 FRONTEND: ${
          frontendExists()
            ? "READY"
            : "NOT BUILT"
        }`
      );

      console.log(
        `🎼 MUSIC DIR: ${path.join(
          ROOT_DIR,
          "music"
        )}`
      );

      console.log(
        "========================================"
      );
      console.log("");
    }
  );
}

/* =========================================================
   PROCESS
========================================================= */

process.on(
  "SIGTERM",
  async () => {
    console.log(
      "SIGTERM received..."
    );

    await pool.end();

    process.exit(0);
  }
);

process.on(
  "SIGINT",
  async () => {
    console.log(
      "SIGINT received..."
    );

    await pool.end();

    process.exit(0);
  }
);

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "UNHANDLED REJECTION:",
      error
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
    console.error(
      error
    );
    console.error(
      "========================================"
    );

    process.exit(1);
  }
);
