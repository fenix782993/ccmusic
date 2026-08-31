"use strict";

/*
=========================================================
 FENIX MUSIC BACKEND 2.0.0
 ONE RENDER SERVICE
 BACKEND + REACT FRONTEND + POSTGRESQL
=========================================================

Expected structure:

fenix-music-backend/
├── package.json
├── src/
│   └── index.js
├── build/
│   ├── index.html
│   └── static/
│
OR:

fenix-music-backend/
├── frontend/
│   ├── package.json
│   ├── public/
│   └── src/
│       └── App.js
└── src/
    └── index.js

The server automatically looks for:
  ../build
  ../frontend/build
=========================================================
*/

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { Pool } = require("pg");

const app = express();

/* ======================================================
   CONFIG
====================================================== */

const PORT = Number(process.env.PORT || 10000);

const DATABASE_URL =
  process.env.DATABASE_URL || "";

const NODE_ENV =
  process.env.NODE_ENV || "development";

const isProduction =
  NODE_ENV === "production";

const SESSION_DAYS =
  Number(process.env.SESSION_DAYS || 30);

const MAX_TRACKS =
  Number(process.env.MAX_TRACKS || 500);

/* ======================================================
   POSTGRES
====================================================== */

if (!DATABASE_URL) {
  console.error("");
  console.error("========================================");
  console.error("❌ DATABASE_URL IS NOT SET");
  console.error("========================================");
  console.error("");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction
    ? {
        rejectUnauthorized: false,
      }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

/* ======================================================
   EXPRESS
====================================================== */

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

/*
 * Same-origin frontend is used in production.
 * CORS is kept permissive so the API can also be tested
 * externally.
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    res.header(
      "Access-Control-Allow-Origin",
      origin
    );
    res.header(
      "Access-Control-Allow-Credentials",
      "true"
    );
    res.header(
      "Vary",
      "Origin"
    );
  } else {
    res.header(
      "Access-Control-Allow-Origin",
      "*"
    );
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* ======================================================
   HELPERS
====================================================== */

function now() {
  return new Date();
}

function randomToken(bytes = 32) {
  return crypto
    .randomBytes(bytes)
    .toString("hex");
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function passwordHash(password) {
  /*
   * PBKDF2 is available in Node without extra packages.
   */
  const salt = crypto.randomBytes(16);

  const hash = crypto.pbkdf2Sync(
    String(password),
    salt,
    120000,
    64,
    "sha512"
  );

  return (
    salt.toString("hex") +
    ":" +
    hash.toString("hex")
  );
}

function passwordVerify(password, stored) {
  try {
    if (!stored || !stored.includes(":")) {
      return false;
    }

    const parts = stored.split(":");

    if (parts.length !== 2) {
      return false;
    }

    const salt = Buffer.from(
      parts[0],
      "hex"
    );

    const original = Buffer.from(
      parts[1],
      "hex"
    );

    const hash = crypto.pbkdf2Sync(
      String(password),
      salt,
      120000,
      64,
      "sha512"
    );

    if (
      original.length !== hash.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      original,
      hash
    );
  } catch {
    return false;
  }
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "")
    .trim();
}

function validUsername(username) {
  return (
    username.length >= 2 &&
    username.length <= 32 &&
    /^[a-zA-Z0-9_\-а-яА-ЯёЁ ]+$/.test(
      username
    )
  );
}

function validEmail(email) {
  return (
    email.length >= 5 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  );
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio || "",
    avatar_url: user.avatar_url || "",
    created_at: user.created_at,
  };
}

function getTokenFromRequest(req) {
  const authorization =
    req.headers.authorization || "";

  if (
    authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return authorization.slice(7).trim();
  }

  const cookie =
    req.headers.cookie || "";

  const match = cookie.match(
    /fenix_music_session=([^;]+)/
  );

  if (match) {
    return decodeURIComponent(
      match[1]
    );
  }

  return null;
}

function setSessionCookie(res, token) {
  const parts = [
    `fenix_music_session=${encodeURIComponent(
      token
    )}`,
    "Path=/",
    `Max-Age=${SESSION_DAYS * 86400}`,
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (isProduction) {
    parts.push("Secure");
  }

  res.setHeader(
    "Set-Cookie",
    parts.join("; ")
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    [
      "fenix_music_session=",
      "Path=/",
      "Max-Age=0",
      "HttpOnly",
      "SameSite=Lax",
      isProduction ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );
}

async function getUserFromToken(token) {
  if (!token) {
    return null;
  }

  const tokenHash = sha256(token);

  const result = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.email,
        u.bio,
        u.avatar_url,
        u.created_at
      FROM sessions s
      INNER JOIN users u
        ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > NOW()
      LIMIT 1
    `,
    [tokenHash]
  );

  return result.rows[0] || null;
}

async function authOptional(req, res, next) {
  try {
    const token =
      getTokenFromRequest(req);

    req.user =
      await getUserFromToken(token);

    next();
  } catch (error) {
    next(error);
  }
}

async function authRequired(req, res, next) {
  try {
    const token =
      getTokenFromRequest(req);

    const user =
      await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: "Необходима авторизация.",
      });
    }

    req.user = user;
    req.authToken = token;

    next();
  } catch (error) {
    next(error);
  }
}

function createCaptcha() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let text = "";

  for (let i = 0; i < 6; i++) {
    text +=
      chars[
        crypto.randomInt(
          0,
          chars.length
        )
      ];
  }

  return text;
}

function parseId(value) {
  const id = String(value || "");

  if (!/^\d+$/.test(id)) {
    return null;
  }

  return id;
}

/* ======================================================
   DATABASE INITIALIZATION
====================================================== */

async function initDatabase() {
  console.log(
    "Connecting to PostgreSQL..."
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
    ======================================================
    USERS
    ======================================================
    IMPORTANT:
    id = BIGSERIAL
    This MUST match sessions.user_id = BIGINT.
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(32) NOT NULL,
        email VARCHAR(254) NOT NULL,
        password_hash TEXT NOT NULL,
        bio TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /*
    ======================================================
    USERS UNIQUE INDEXES
    ======================================================
    */

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      users_email_unique_idx
      ON users (LOWER(email))
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      users_username_unique_idx
      ON users (LOWER(username))
    `);

    /*
    ======================================================
    SESSIONS
    ======================================================
    BIGINT -> BIGINT
    No UUID/BIGINT conflict.
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT sessions_user_id_fkey
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      sessions_token_hash_idx
      ON sessions(token_hash)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      sessions_user_id_idx
      ON sessions(user_id)
    `);

    /*
    ======================================================
    CAPTCHA
    ======================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS captchas (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(32) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      captchas_expires_idx
      ON captchas(expires_at)
    `);

    /*
    ======================================================
    TRACKS
    ======================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        artist_name TEXT NOT NULL DEFAULT 'Unknown Artist',
        album_name TEXT DEFAULT '',
        cover_url TEXT DEFAULT '',
        audio_url TEXT DEFAULT '',
        duration INTEGER NOT NULL DEFAULT 0,
        plays_count BIGINT NOT NULL DEFAULT 0,
        genre TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /*
    ======================================================
    HISTORY
    ======================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS listening_history (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        track_id BIGINT NOT NULL,
        listened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT listening_history_user_fkey
          FOREIGN KEY(user_id)
          REFERENCES users(id)
          ON DELETE CASCADE,

        CONSTRAINT listening_history_track_fkey
          FOREIGN KEY(track_id)
          REFERENCES tracks(id)
          ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      listening_history_user_idx
      ON listening_history(user_id, listened_at DESC)
    `);

    /*
    ======================================================
    FAVORITES
    ======================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        track_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT favorites_user_fkey
          FOREIGN KEY(user_id)
          REFERENCES users(id)
          ON DELETE CASCADE,

        CONSTRAINT favorites_track_fkey
          FOREIGN KEY(track_id)
          REFERENCES tracks(id)
          ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      favorites_user_track_idx
      ON favorites(user_id, track_id)
    `);

    /*
    ======================================================
    PLAYLISTS
    ======================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        cover_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT playlists_user_fkey
          FOREIGN KEY(user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    /*
    ======================================================
    PLAYLIST TRACKS
    ======================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id BIGSERIAL PRIMARY KEY,
        playlist_id BIGINT NOT NULL,
        track_id BIGINT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT playlist_tracks_playlist_fkey
          FOREIGN KEY(playlist_id)
          REFERENCES playlists(id)
          ON DELETE CASCADE,

        CONSTRAINT playlist_tracks_track_fkey
          FOREIGN KEY(track_id)
          REFERENCES tracks(id)
          ON DELETE CASCADE
      )
    `);

    /*
    ======================================================
    USER SETTINGS
    ======================================================
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id BIGINT PRIMARY KEY,

        theme VARCHAR(20) NOT NULL DEFAULT 'dark',
        quality VARCHAR(20) NOT NULL DEFAULT 'normal',
        autoplay BOOLEAN NOT NULL DEFAULT TRUE,
        auto_next BOOLEAN NOT NULL DEFAULT TRUE,
        notifications BOOLEAN NOT NULL DEFAULT TRUE,
        language VARCHAR(10) NOT NULL DEFAULT 'ru',

        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT user_settings_user_fkey
          FOREIGN KEY(user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    /*
    ======================================================
    EXTRA INDEXES
    ======================================================
    */

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      tracks_title_idx
      ON tracks(LOWER(title))
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      tracks_artist_idx
      ON tracks(LOWER(artist_name))
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      tracks_plays_idx
      ON tracks(plays_count DESC)
    `);

    /*
    ======================================================
    DATA MIGRATION
    ======================================================

    These ALTERs are deliberately AFTER CREATE TABLE.

    This fixes the previous:
      relation "users" does not exist

    and:
      column "plays_count" does not exist
    */

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT ''
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT ''
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS updated_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS album_name TEXT DEFAULT ''
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT ''
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS audio_url TEXT DEFAULT ''
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 0
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS plays_count
      BIGINT NOT NULL DEFAULT 0
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS genre TEXT DEFAULT ''
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS created_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS updated_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    /*
    ======================================================
    CLEAN OLD SESSIONS
    ======================================================
    */

    await client.query(`
      DELETE FROM sessions
      WHERE expires_at <= NOW()
    `);

    await client.query(`
      DELETE FROM captchas
      WHERE expires_at <= NOW()
    `);

    await client.query("COMMIT");

    console.log(
      "✓ PostgreSQL database initialized"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* ======================================================
   ROOT / API INFO
====================================================== */

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
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      status: "healthy",
      service: "Fenix Music Backend",
      version: "2.0.0",
      database: "connected",
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
    });
  }
});

/* ======================================================
   AUTH — CAPTCHA
====================================================== */

app.get(
  "/api/auth/captcha",
  async (req, res, next) => {
    try {
      const code =
        createCaptcha();

      const result =
        await pool.query(
          `
            INSERT INTO captchas
              (code, expires_at)
            VALUES
              ($1, NOW() + INTERVAL '10 minutes')
            RETURNING id, code, expires_at
          `,
          [code]
        );

      res.json({
        ok: true,
        id: result.rows[0].id,
        captcha_id:
          result.rows[0].id,
        text:
          result.rows[0].code,
        code:
          result.rows[0].code,
        captcha:
          result.rows[0].code,
        expires_at:
          result.rows[0].expires_at,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   AUTH — REGISTER
====================================================== */

app.post(
  "/api/auth/register",
  async (req, res, next) => {
    const client =
      await pool.connect();

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

      if (!validUsername(username)) {
        return res.status(400).json({
          ok: false,
          error:
            "Username должен содержать от 2 до 32 символов.",
        });
      }

      if (!validEmail(email)) {
        return res.status(400).json({
          ok: false,
          error:
            "Введите корректный email.",
        });
      }

      if (
        password.length < 6 ||
        password.length > 200
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Пароль должен содержать минимум 6 символов.",
        });
      }

      /*
       * CAPTCHA can be identified by ID.
       * If old frontend doesn't send ID,
       * use latest unused CAPTCHA.
       */

      let captchaResult;

      if (captchaId) {
        captchaResult =
          await client.query(
            `
              SELECT *
              FROM captchas
              WHERE id = $1
                AND used = FALSE
                AND expires_at > NOW()
              LIMIT 1
            `,
            [captchaId]
          );
      } else {
        captchaResult =
          await client.query(
            `
              SELECT *
              FROM captchas
              WHERE used = FALSE
                AND expires_at > NOW()
              ORDER BY created_at DESC
              LIMIT 1
            `
          );
      }

      const captchaRow =
        captchaResult.rows[0];

      if (
        !captchaRow ||
        String(captchaRow.code)
          .toUpperCase() !== captcha
      ) {
        return res.status(400).json({
          ok: false,
          error: "Неверная CAPTCHA.",
        });
      }

      await client.query(
        `
          UPDATE captchas
          SET used = TRUE
          WHERE id = $1
        `,
        [captchaRow.id]
      );

      const exists =
        await client.query(
          `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
               OR LOWER(username) = LOWER($2)
            LIMIT 1
          `,
          [email, username]
        );

      if (exists.rows.length) {
        return res.status(409).json({
          ok: false,
          error:
            "Пользователь с таким email или username уже существует.",
        });
      }

      const hash =
        passwordHash(password);

      await client.query("BEGIN");

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
            email,
            hash,
          ]
        );

      const user =
        userResult.rows[0];

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

      const token =
        randomToken(48);

      const tokenHash =
        sha256(token);

      await client.query(
        `
          INSERT INTO sessions
            (
              user_id,
              token_hash,
              expires_at
            )
          VALUES
            (
              $1,
              $2,
              NOW() + ($3 * INTERVAL '1 day')
            )
        `,
        [
          user.id,
          tokenHash,
          SESSION_DAYS,
        ]
      );

      await client.query("COMMIT");

      setSessionCookie(
        res,
        token
      );

      res.status(201).json({
        ok: true,
        token,
        access_token: token,
        session_token: token,
        user: publicUser(user),
        account: publicUser(user),
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}

      if (
        error.code === "23505"
      ) {
        return res.status(409).json({
          ok: false,
          error:
            "Email или username уже используется.",
        });
      }

      next(error);
    } finally {
      client.release();
    }
  }
);

/* ======================================================
   AUTH — LOGIN
====================================================== */

app.post(
  "/api/auth/login",
  async (req, res, next) => {
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
        return res.status(400).json({
          ok: false,
          error:
            "Введите логин и пароль.",
        });
      }

      const result =
        await pool.query(
          `
            SELECT
              id,
              username,
              email,
              password_hash,
              bio,
              avatar_url,
              created_at
            FROM users
            WHERE LOWER(email) = LOWER($1)
               OR LOWER(username) = LOWER($1)
            LIMIT 1
          `,
          [login]
        );

      const user =
        result.rows[0];

      if (
        !user ||
        !passwordVerify(
          password,
          user.password_hash
        )
      ) {
        return res.status(401).json({
          ok: false,
          error:
            "Неверный логин или пароль.",
        });
      }

      const token =
        randomToken(48);

      const tokenHash =
        sha256(token);

      await pool.query(
        `
          INSERT INTO sessions
            (
              user_id,
              token_hash,
              expires_at
            )
          VALUES
            (
              $1,
              $2,
              NOW() + ($3 * INTERVAL '1 day')
            )
        `,
        [
          user.id,
          tokenHash,
          SESSION_DAYS,
        ]
      );

      await pool.query(
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
        token
      );

      const safeUser =
        publicUser(user);

      res.json({
        ok: true,
        token,
        access_token: token,
        session_token: token,
        user: safeUser,
        account: safeUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   AUTH — ME
====================================================== */

app.get(
  "/api/auth/me",
  authRequired,
  async (req, res) => {
    res.json({
      ok: true,
      user: publicUser(
        req.user
      ),
      account: publicUser(
        req.user
      ),
    });
  }
);

/* ======================================================
   AUTH — LOGOUT
====================================================== */

app.post(
  "/api/auth/logout",
  authOptional,
  async (req, res, next) => {
    try {
      const token =
        getTokenFromRequest(req);

      if (token) {
        await pool.query(
          `
            DELETE FROM sessions
            WHERE token_hash = $1
          `,
          [sha256(token)]
        );
      }

      clearSessionCookie(res);

      res.json({
        ok: true,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   PROFILE
====================================================== */

app.get(
  "/api/profile",
  authRequired,
  async (req, res) => {
    res.json({
      ok: true,
      user: publicUser(
        req.user
      ),
    });
  }
);

app.put(
  "/api/profile",
  authRequired,
  async (req, res, next) => {
    try {
      const username =
        normalizeUsername(
          req.body.username ||
            req.user.username
        );

      const bio =
        String(
          req.body.bio || ""
        ).slice(0, 1000);

      if (!validUsername(username)) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный username.",
        });
      }

      const exists =
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

      if (exists.rows.length) {
        return res.status(409).json({
          ok: false,
          error:
            "Этот username уже занят.",
        });
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
        user: publicUser(
          result.rows[0]
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   SETTINGS
====================================================== */

app.get(
  "/api/settings",
  authRequired,
  async (req, res, next) => {
    try {
      await pool.query(
        `
          INSERT INTO user_settings
            (user_id)
          VALUES
            ($1)
          ON CONFLICT (user_id)
          DO NOTHING
        `,
        [req.user.id]
      );

      const result =
        await pool.query(
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
          `,
          [req.user.id]
        );

      const row =
        result.rows[0];

      res.json({
        ok: true,
        settings: {
          theme:
            row.theme,
          quality:
            row.quality,
          autoplay:
            row.autoplay,
          autoNext:
            row.auto_next,
          notifications:
            row.notifications,
          language:
            row.language,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

app.put(
  "/api/settings",
  authRequired,
  async (req, res, next) => {
    try {
      const theme =
        ["dark", "light"].includes(
          req.body.theme
        )
          ? req.body.theme
          : "dark";

      const quality =
        ["normal", "high", "max"].includes(
          req.body.quality
        )
          ? req.body.quality
          : "normal";

      const autoplay =
        typeof req.body.autoplay ===
        "boolean"
          ? req.body.autoplay
          : true;

      const autoNext =
        typeof req.body.autoNext ===
        "boolean"
          ? req.body.autoNext
          : true;

      const notifications =
        typeof req.body.notifications ===
        "boolean"
          ? req.body.notifications
          : true;

      const language =
        ["ru", "en"].includes(
          req.body.language
        )
          ? req.body.language
          : "ru";

      await pool.query(
        `
          INSERT INTO user_settings
            (
              user_id,
              theme,
              quality,
              autoplay,
              auto_next,
              notifications,
              language
            )
          VALUES
            ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id)
          DO UPDATE SET
            theme = EXCLUDED.theme,
            quality = EXCLUDED.quality,
            autoplay = EXCLUDED.autoplay,
            auto_next = EXCLUDED.auto_next,
            notifications = EXCLUDED.notifications,
            language = EXCLUDED.language,
            updated_at = NOW()
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

      res.json({
        ok: true,
        settings: {
          theme,
          quality,
          autoplay,
          autoNext,
          notifications,
          language,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   TRACKS
====================================================== */

app.get(
  "/api/tracks",
  async (req, res, next) => {
    try {
      const search =
        String(
          req.query.search ||
            req.query.q ||
            ""
        ).trim();

      const genre =
        String(
          req.query.genre || ""
        ).trim();

      const sort =
        String(
          req.query.sort || "new"
        );

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit || 50
            ),
            1
          ),
          MAX_TRACKS
        );

      let sql = `
        SELECT
          id,
          title,
          artist_name,
          album_name,
          cover_url,
          audio_url,
          duration,
          plays_count,
          genre,
          created_at,
          updated_at
        FROM tracks
      `;

      const values = [];
      const conditions = [];

      if (search) {
        values.push(
          `%${search}%`
        );

        conditions.push(`
          (
            title ILIKE $${values.length}
            OR artist_name ILIKE $${values.length}
            OR album_name ILIKE $${values.length}
          )
        `);
      }

      if (genre) {
        values.push(genre);

        conditions.push(
          `genre = $${values.length}`
        );
      }

      if (conditions.length) {
        sql +=
          " WHERE " +
          conditions.join(" AND ");
      }

      if (sort === "popular") {
        sql +=
          " ORDER BY plays_count DESC, id DESC";
      } else if (
        sort === "title"
      ) {
        sql +=
          " ORDER BY LOWER(title) ASC";
      } else {
        sql +=
          " ORDER BY created_at DESC, id DESC";
      }

      values.push(limit);

      sql +=
        ` LIMIT $${values.length}`;

      const result =
        await pool.query(
          sql,
          values
        );

      res.json({
        ok: true,
        tracks: result.rows,
        data: result.rows,
        items: result.rows,
        total: result.rows.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   TRACK BY ID
====================================================== */

app.get(
  "/api/tracks/:id",
  async (req, res, next) => {
    try {
      const id =
        parseId(req.params.id);

      if (!id) {
        return res.status(400).json({
          ok: false,
          error: "Некорректный ID трека.",
        });
      }

      const result =
        await pool.query(
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
              genre,
              created_at,
              updated_at
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [id]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          error: "Трек не найден.",
        });
      }

      res.json({
        ok: true,
        track:
          result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   TRACK AUDIO
====================================================== */

app.get(
  "/api/tracks/:id/audio",
  async (req, res, next) => {
    try {
      const id =
        parseId(req.params.id);

      if (!id) {
        return res.status(400).json({
          ok: false,
          error: "Некорректный ID трека.",
        });
      }

      const result =
        await pool.query(
          `
            SELECT
              id,
              title,
              audio_url
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [id]
        );

      const track =
        result.rows[0];

      if (!track) {
        return res.status(404).json({
          ok: false,
          error: "Трек не найден.",
        });
      }

      if (!track.audio_url) {
        return res.status(404).json({
          ok: false,
          error:
            "Для этого трека не указан audio_url.",
        });
      }

      /*
       * If audio is hosted externally,
       * redirect browser/player to it.
       */
      return res.redirect(
        302,
        track.audio_url
      );
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   PLAY TRACK
====================================================== */

app.post(
  "/api/tracks/:id/play",
  authOptional,
  async (req, res, next) => {
    const client =
      await pool.connect();

    try {
      const id =
        parseId(req.params.id);

      if (!id) {
        return res.status(400).json({
          ok: false,
          error: "Некорректный ID.",
        });
      }

      const result =
        await client.query(
          `
            SELECT *
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [id]
        );

      const track =
        result.rows[0];

      if (!track) {
        return res.status(404).json({
          ok: false,
          error: "Трек не найден.",
        });
      }

      await client.query(
        `
          UPDATE tracks
          SET
            plays_count =
              COALESCE(plays_count, 0) + 1,
            updated_at = NOW()
          WHERE id = $1
        `,
        [id]
      );

      if (req.user) {
        await client.query(
          `
            INSERT INTO listening_history
              (
                user_id,
                track_id
              )
            VALUES
              ($1, $2)
          `,
          [
            req.user.id,
            id,
          ]
        );
      }

      res.json({
        ok: true,
        trackId: id,
      });
    } catch (error) {
      next(error);
    } finally {
      client.release();
    }
  }
);

/* ======================================================
   HISTORY
====================================================== */

app.get(
  "/api/history",
  authRequired,
  async (req, res, next) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              t.id,
              t.title,
              t.artist_name,
              t.album_name,
              t.cover_url,
              t.audio_url,
              t.duration,
              t.plays_count,
              t.genre,
              h.listened_at
            FROM listening_history h
            INNER JOIN tracks t
              ON t.id = h.track_id
            WHERE h.user_id = $1
            ORDER BY h.listened_at DESC
            LIMIT 200
          `,
          [req.user.id]
        );

      res.json({
        ok: true,
        history:
          result.rows,
        tracks:
          result.rows,
        data:
          result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   FAVORITES
====================================================== */

app.get(
  "/api/favorites",
  authRequired,
  async (req, res, next) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              t.id,
              t.title,
              t.artist_name,
              t.album_name,
              t.cover_url,
              t.audio_url,
              t.duration,
              t.plays_count,
              t.genre,
              f.created_at AS favorited_at
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
        favorites:
          result.rows,
        tracks:
          result.rows,
        data:
          result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/favorites/:trackId",
  authRequired,
  async (req, res, next) => {
    try {
      const trackId =
        parseId(
          req.params.trackId
        );

      if (!trackId) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID трека.",
        });
      }

      const track =
        await pool.query(
          `
            SELECT id
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [trackId]
        );

      if (!track.rows.length) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден.",
        });
      }

      await pool.query(
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
        favorite: true,
        track_id: trackId,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/favorites/:trackId",
  authRequired,
  async (req, res, next) => {
    try {
      const trackId =
        parseId(
          req.params.trackId
        );

      if (!trackId) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID трека.",
        });
      }

      await pool.query(
        `
          DELETE FROM favorites
          WHERE user_id = $1
            AND track_id = $2
        `,
        [
          req.user.id,
          trackId,
        ]
      );

      res.json({
        ok: true,
        favorite: false,
        track_id: trackId,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/tracks/:id/favorite",
  authRequired,
  async (req, res, next) => {
    try {
      const id =
        parseId(req.params.id);

      if (!id) {
        return res.status(400).json({
          ok: false,
          error: "Некорректный ID.",
        });
      }

      const result =
        await pool.query(
          `
            SELECT 1
            FROM favorites
            WHERE user_id = $1
              AND track_id = $2
            LIMIT 1
          `,
          [
            req.user.id,
            id,
          ]
        );

      res.json({
        ok: true,
        favorite:
          result.rows.length > 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   SEARCH
====================================================== */

app.get(
  "/api/search",
  async (req, res, next) => {
    try {
      const q =
        String(
          req.query.q ||
            req.query.search ||
            ""
        ).trim();

      if (!q) {
        return res.json({
          ok: true,
          tracks: [],
          artists: [],
          albums: [],
        });
      }

      const search =
        `%${q}%`;

      const result =
        await pool.query(
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
              genre
            FROM tracks
            WHERE
              title ILIKE $1
              OR artist_name ILIKE $1
              OR album_name ILIKE $1
            ORDER BY
              plays_count DESC,
              title ASC
            LIMIT 100
          `,
          [search]
        );

      res.json({
        ok: true,
        tracks:
          result.rows,
        data:
          result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   POPULAR
====================================================== */

app.get(
  "/api/tracks/popular",
  async (req, res, next) => {
    try {
      const limit =
        Math.min(
          Number(
            req.query.limit || 50
          ),
          MAX_TRACKS
        );

      const result =
        await pool.query(
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
              genre
            FROM tracks
            ORDER BY
              plays_count DESC,
              id DESC
            LIMIT $1
          `,
          [limit]
        );

      res.json({
        ok: true,
        tracks:
          result.rows,
        data:
          result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   RECENT / NEW
====================================================== */

app.get(
  "/api/tracks/new",
  async (req, res, next) => {
    try {
      const limit =
        Math.min(
          Number(
            req.query.limit || 50
          ),
          MAX_TRACKS
        );

      const result =
        await pool.query(
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
              genre
            FROM tracks
            ORDER BY
              created_at DESC,
              id DESC
            LIMIT $1
          `,
          [limit]
        );

      res.json({
        ok: true,
        tracks:
          result.rows,
        data:
          result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   PLAYLISTS
====================================================== */

app.get(
  "/api/playlists",
  authRequired,
  async (req, res, next) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              p.id,
              p.name,
              p.description,
              p.cover_url,
              p.created_at,
              p.updated_at,
              COUNT(pt.id)::INTEGER AS track_count
            FROM playlists p
            LEFT JOIN playlist_tracks pt
              ON pt.playlist_id = p.id
            WHERE p.user_id = $1
            GROUP BY p.id
            ORDER BY p.updated_at DESC
          `,
          [req.user.id]
        );

      res.json({
        ok: true,
        playlists:
          result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/playlists",
  authRequired,
  async (req, res, next) => {
    try {
      const name =
        String(
          req.body.name || ""
        ).trim();

      const description =
        String(
          req.body.description || ""
        ).trim();

      if (
        name.length < 1 ||
        name.length > 100
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Название плейлиста некорректно.",
        });
      }

      const result =
        await pool.query(
          `
            INSERT INTO playlists
              (
                user_id,
                name,
                description
              )
            VALUES
              ($1, $2, $3)
            RETURNING *
          `,
          [
            req.user.id,
            name,
            description,
          ]
        );

      res.status(201).json({
        ok: true,
        playlist:
          result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/playlists/:id",
  authRequired,
  async (req, res, next) => {
    try {
      const id =
        parseId(req.params.id);

      if (!id) {
        return res.status(400).json({
          ok: false,
          error: "Некорректный ID.",
        });
      }

      const playlist =
        await pool.query(
          `
            SELECT
              id,
              name,
              description,
              cover_url,
              created_at,
              updated_at
            FROM playlists
            WHERE id = $1
              AND user_id = $2
            LIMIT 1
          `,
          [
            id,
            req.user.id,
          ]
        );

      if (!playlist.rows.length) {
        return res.status(404).json({
          ok: false,
          error:
            "Плейлист не найден.",
        });
      }

      const tracks =
        await pool.query(
          `
            SELECT
              t.id,
              t.title,
              t.artist_name,
              t.album_name,
              t.cover_url,
              t.audio_url,
              t.duration,
              t.plays_count,
              t.genre,
              pt.position
            FROM playlist_tracks pt
            INNER JOIN tracks t
              ON t.id = pt.track_id
            WHERE pt.playlist_id = $1
            ORDER BY pt.position ASC, pt.id ASC
          `,
          [id]
        );

      res.json({
        ok: true,
        playlist:
          playlist.rows[0],
        tracks:
          tracks.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/playlists/:id/tracks",
  authRequired,
  async (req, res, next) => {
    try {
      const playlistId =
        parseId(req.params.id);

      const trackId =
        parseId(
          req.body.track_id ||
            req.body.trackId
        );

      if (
        !playlistId ||
        !trackId
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID.",
        });
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
            playlistId,
            req.user.id,
          ]
        );

      if (!playlist.rows.length) {
        return res.status(404).json({
          ok: false,
          error:
            "Плейлист не найден.",
        });
      }

      const track =
        await pool.query(
          `
            SELECT id
            FROM tracks
            WHERE id = $1
            LIMIT 1
          `,
          [trackId]
        );

      if (!track.rows.length) {
        return res.status(404).json({
          ok: false,
          error:
            "Трек не найден.",
        });
      }

      const positionResult =
        await pool.query(
          `
            SELECT
              COALESCE(
                MAX(position),
                -1
              ) + 1 AS position
            FROM playlist_tracks
            WHERE playlist_id = $1
          `,
          [playlistId]
        );

      const position =
        Number(
          positionResult.rows[0]
            .position
        );

      const result =
        await pool.query(
          `
            INSERT INTO playlist_tracks
              (
                playlist_id,
                track_id,
                position
              )
            VALUES
              ($1, $2, $3)
            RETURNING *
          `,
          [
            playlistId,
            trackId,
            position,
          ]
        );

      await pool.query(
        `
          UPDATE playlists
          SET updated_at = NOW()
          WHERE id = $1
        `,
        [playlistId]
      );

      res.status(201).json({
        ok: true,
        item:
          result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/playlists/:playlistId/tracks/:trackId",
  authRequired,
  async (req, res, next) => {
    try {
      const playlistId =
        parseId(
          req.params.playlistId
        );

      const trackId =
        parseId(
          req.params.trackId
        );

      if (
        !playlistId ||
        !trackId
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID.",
        });
      }

      const result =
        await pool.query(
          `
            DELETE FROM playlist_tracks pt
            USING playlists p
            WHERE pt.playlist_id = p.id
              AND p.id = $1
              AND p.user_id = $2
              AND pt.track_id = $3
          `,
          [
            playlistId,
            req.user.id,
            trackId,
          ]
        );

      res.json({
        ok: true,
        deleted:
          result.rowCount > 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   ADMIN/SEED-FRIENDLY TRACK CREATION
======================================================

   This endpoint is intentionally simple.
   It can be protected later with an admin secret.

   It allows you to insert tracks into PostgreSQL
   without changing the database manually.
====================================================== */

app.post(
  "/api/tracks",
  async (req, res, next) => {
    try {
      const adminKey =
        process.env.ADMIN_KEY;

      if (adminKey) {
        const supplied =
          req.headers[
            "x-admin-key"
          ];

        if (
          supplied !== adminKey
        ) {
          return res.status(403).json({
            ok: false,
            error:
              "Недостаточно прав.",
          });
        }
      }

      const title =
        String(
          req.body.title || ""
        ).trim();

      const artistName =
        String(
          req.body.artist_name ||
            req.body.artist ||
            "Unknown Artist"
        ).trim();

      const albumName =
        String(
          req.body.album_name ||
            req.body.album ||
            ""
        ).trim();

      const coverUrl =
        String(
          req.body.cover_url ||
            req.body.cover ||
            ""
        ).trim();

      const audioUrl =
        String(
          req.body.audio_url ||
            req.body.audio ||
            ""
        ).trim();

      const duration =
        Math.max(
          Number(
            req.body.duration || 0
          ),
          0
        );

      const genre =
        String(
          req.body.genre || ""
        ).trim();

      if (!title) {
        return res.status(400).json({
          ok: false,
          error:
            "title обязателен.",
        });
      }

      const result =
        await pool.query(
          `
            INSERT INTO tracks
              (
                title,
                artist_name,
                album_name,
                cover_url,
                audio_url,
                duration,
                genre
              )
            VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
              )
            RETURNING *
          `,
          [
            title,
            artistName,
            albumName,
            coverUrl,
            audioUrl,
            duration,
            genre,
          ]
        );

      res.status(201).json({
        ok: true,
        track:
          result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   DELETE TRACK
====================================================== */

app.delete(
  "/api/tracks/:id",
  async (req, res, next) => {
    try {
      const adminKey =
        process.env.ADMIN_KEY;

      if (adminKey) {
        const supplied =
          req.headers[
            "x-admin-key"
          ];

        if (
          supplied !== adminKey
        ) {
          return res.status(403).json({
            ok: false,
            error:
              "Недостаточно прав.",
          });
        }
      }

      const id =
        parseId(req.params.id);

      if (!id) {
        return res.status(400).json({
          ok: false,
          error:
            "Некорректный ID.",
        });
      }

      const result =
        await pool.query(
          `
            DELETE FROM tracks
            WHERE id = $1
          `,
          [id]
        );

      res.json({
        ok: true,
        deleted:
          result.rowCount > 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ======================================================
   FRONTEND
====================================================== */

/*
 * IMPORTANT:
 *
 * __dirname = .../src
 *
 * ../build
 *      => project/build
 *
 * ../frontend/build
 *      => project/frontend/build
 */

const possibleBuildDirs = [
  path.resolve(
    __dirname,
    "../build"
  ),
  path.resolve(
    __dirname,
    "../frontend/build"
  ),
];

let frontendBuildDir = null;

for (const dir of possibleBuildDirs) {
  if (
    fs.existsSync(
      path.join(
        dir,
        "index.html"
      )
    )
  ) {
    frontendBuildDir = dir;
    break;
  }
}

if (frontendBuildDir) {
  console.log(
    `✓ React build found: ${frontendBuildDir}`
  );

  app.use(
    express.static(
      frontendBuildDir,
      {
        index: false,
        maxAge: isProduction
          ? "1h"
          : 0,
      }
    )
  );
} else {
  console.warn(
    "⚠ React build not found."
  );

  console.warn(
    "Expected:"
  );

  console.warn(
    `  ${possibleBuildDirs[0]}`
  );

  console.warn(
    `  ${possibleBuildDirs[1]}`
  );
}

/* ======================================================
   FRONTEND ROOT
====================================================== */

app.get(
  "/",
  (req, res) => {
    if (!frontendBuildDir) {
      return res.status(503).send(`
        <!doctype html>
        <html lang="ru">
        <head>
          <meta charset="utf-8">
          <meta name="viewport"
                content="width=device-width,initial-scale=1">
          <title>Fenix Music</title>
          <style>
            body {
              margin: 0;
              background: #09090b;
              color: white;
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }

            main {
              max-width: 700px;
              padding: 40px;
            }

            h1 {
              margin-bottom: 10px;
            }

            code {
              color: #f87171;
            }
          </style>
        </head>
        <body>
          <main>
            <h1>Fenix Music Backend работает</h1>
            <p>
              Backend запущен, но React build не найден.
            </p>
            <p>
              API:
              <code>/api</code>
            </p>
            <p>
              Health:
              <code>/api/health</code>
            </p>
          </main>
        </body>
        </html>
      `);
    }

    return res.sendFile(
      path.join(
        frontendBuildDir,
        "index.html"
      )
    );
  }
);

/* ======================================================
   REACT SPA FALLBACK
====================================================== */

if (frontendBuildDir) {
  app.get(
    "*",
    (req, res, next) => {
      /*
       * NEVER send React index.html for API requests.
       */
      if (
        req.path === "/api" ||
        req.path.startsWith("/api/")
      ) {
        return next();
      }

      return res.sendFile(
        path.join(
          frontendBuildDir,
          "index.html"
        )
      );
    }
  );
}

/* ======================================================
   404 API
====================================================== */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      ok: false,
      error: "API route not found.",
      path: req.originalUrl,
    });
  }
);

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */

app.use(
  (error, req, res, next) => {
    console.error(
      "API ERROR:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      ok: false,
      error:
        isProduction
          ? "Internal server error."
          : error.message,
    });
  }
);

/* ======================================================
   START
====================================================== */

async function start() {
  try {
    await initDatabase();

    /*
     * Check PostgreSQL one more time.
     */
    await pool.query(
      "SELECT 1"
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
            "🔥 FENIX MUSIC BACKEND 2.0.0"
          );
          console.log(
            "========================================"
          );
          console.log(
            `✓ PORT: ${PORT}`
          );
          console.log(
            `✓ ENV: ${NODE_ENV}`
          );
          console.log(
            "✓ PostgreSQL: connected"
          );

          if (frontendBuildDir) {
            console.log(
              `✓ Frontend: ${frontendBuildDir}`
            );
            console.log(
              "✓ React: enabled"
            );
          } else {
            console.log(
              "⚠ React: build not found"
            );
          }

          console.log(
            "========================================"
          );
          console.log(
            "API:"
          );
          console.log(
            "GET  /api"
          );
          console.log(
            "GET  /api/health"
          );
          console.log(
            "GET  /api/tracks"
          );
          console.log(
            "GET  /api/tracks/:id"
          );
          console.log(
            "GET  /api/tracks/:id/audio"
          );
          console.log(
            "POST /api/tracks/:id/play"
          );
          console.log(
            "GET  /api/auth/captcha"
          );
          console.log(
            "POST /api/auth/register"
          );
          console.log(
            "POST /api/auth/login"
          );
          console.log(
            "GET  /api/auth/me"
          );
          console.log(
            "POST /api/auth/logout"
          );
          console.log(
            "GET  /api/profile"
          );
          console.log(
            "PUT  /api/profile"
          );
          console.log(
            "GET  /api/settings"
          );
          console.log(
            "PUT  /api/settings"
          );
          console.log(
            "GET  /api/history"
          );
          console.log(
            "GET  /api/favorites"
          );
          console.log(
            "GET  /api/search"
          );
          console.log(
            "GET  /api/playlists"
          );
          console.log(
            "========================================"
          );
        }
      );

      /*
       * Graceful shutdown.
       */
      const shutdown =
        async () => {
          console.log(
            "Shutting down..."
          );

          server.close(
            async () => {
              await pool.end();

              console.log(
                "Server stopped."
              );

              process.exit(0);
            }
          );
        };

      process.on(
        "SIGTERM",
        shutdown
      );

      process.on(
        "SIGINT",
        shutdown
      );
    });
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
    console.error(
      error
    );
    console.error(
      "========================================"
    );

    await pool.end();

    process.exit(1);
  }
}

start();
