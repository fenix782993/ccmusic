'use strict';

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

/* =========================================================
   APP
========================================================= */

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '5mb',
  })
);

/* =========================================================
   ENV
========================================================= */

const PORT = Number(process.env.PORT || 5000);

const DATABASE_URL =
  process.env.DATABASE_URL || '';

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || '';

const CHANNEL_ID =
  process.env.TELEGRAM_CHANNEL_ID || '';

const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL ||
  `http://localhost:${PORT}`;

/* =========================================================
   DATABASE
========================================================= */

if (!DATABASE_URL) {
  console.error(
    'WARNING: DATABASE_URL is not configured.'
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl:
    process.env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: false,
        }
      : false,

  max: 10,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,
});

/* =========================================================
   DATABASE SCHEMA
========================================================= */

const SCHEMA = `
/* =========================
   USERS
========================= */

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    username TEXT NOT NULL,

    email TEXT NOT NULL,

    password_hash TEXT NOT NULL,

    avatar_url TEXT,

    bio TEXT,

    subscription_tier TEXT NOT NULL DEFAULT 'free',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* =========================
   USERS INDEXES
========================= */

CREATE UNIQUE INDEX IF NOT EXISTS
users_username_lower_unique
ON users (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS
users_email_lower_unique
ON users (LOWER(email));


/* =========================
   ARTISTS
========================= */

CREATE TABLE IF NOT EXISTS artists (
    id BIGSERIAL PRIMARY KEY,

    name TEXT NOT NULL,

    avatar_url TEXT,

    bio TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS
artists_name_lower_unique
ON artists (LOWER(name));


/* =========================
   ALBUMS
========================= */

CREATE TABLE IF NOT EXISTS albums (
    id BIGSERIAL PRIMARY KEY,

    title TEXT NOT NULL,

    artist_id BIGINT
        REFERENCES artists(id)
        ON DELETE SET NULL,

    cover_url TEXT,

    year INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


/* =========================
   TRACKS
========================= */

CREATE TABLE IF NOT EXISTS tracks (
    id BIGSERIAL PRIMARY KEY,

    title TEXT NOT NULL,

    artist_id BIGINT
        REFERENCES artists(id)
        ON DELETE SET NULL,

    album_id BIGINT
        REFERENCES albums(id)
        ON DELETE SET NULL,

    duration INTEGER NOT NULL DEFAULT 0,

    audio_url TEXT,

    cover_url TEXT,

    genre TEXT DEFAULT 'Music',

    telegram_file_id TEXT,

    telegram_channel_id TEXT,

    telegram_message_id BIGINT,

    plays_count BIGINT NOT NULL DEFAULT 0,

    is_premium BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


/* =========================
   TRACK INDEXES
========================= */

CREATE INDEX IF NOT EXISTS
tracks_created_at_idx
ON tracks(created_at DESC);

CREATE INDEX IF NOT EXISTS
tracks_plays_count_idx
ON tracks(plays_count DESC);

CREATE INDEX IF NOT EXISTS
tracks_genre_idx
ON tracks(genre);

CREATE INDEX IF NOT EXISTS
tracks_artist_idx
ON tracks(artist_id);

CREATE INDEX IF NOT EXISTS
tracks_album_idx
ON tracks(album_id);


/* =========================
   FAVORITES
========================= */

CREATE TABLE IF NOT EXISTS favorites (
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    track_id BIGINT NOT NULL
        REFERENCES tracks(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY(user_id, track_id)
);


/* =========================
   PLAYLISTS
========================= */

CREATE TABLE IF NOT EXISTS playlists (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    name TEXT NOT NULL,

    is_public BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


/* =========================
   PLAYLIST TRACKS
========================= */

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id BIGINT NOT NULL
        REFERENCES playlists(id)
        ON DELETE CASCADE,

    track_id BIGINT NOT NULL
        REFERENCES tracks(id)
        ON DELETE CASCADE,

    position INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY(playlist_id, track_id)
);


/* =========================
   LISTENING HISTORY
========================= */

CREATE TABLE IF NOT EXISTS listening_history (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    track_id BIGINT NOT NULL
        REFERENCES tracks(id)
        ON DELETE CASCADE,

    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
history_user_idx
ON listening_history(user_id, played_at DESC);


/* =========================
   NOTIFICATIONS
========================= */

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE CASCADE,

    title TEXT,

    message TEXT NOT NULL,

    read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


/* =========================
   SESSIONS
========================= */

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
sessions_user_idx
ON sessions(user_id);


/* =========================
   CAPTCHA
========================= */

CREATE TABLE IF NOT EXISTS captchas (
    id TEXT PRIMARY KEY,

    text TEXT NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/* =========================================================
   DB INITIALIZATION
========================================================= */

async function initDatabase() {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not configured'
    );
  }

  console.log(
    'Connecting to PostgreSQL...'
  );

  const client = await pool.connect();

  try {
    await client.query(SCHEMA);

    /*
      Compatibility migrations.
      Нужны, если Render DB уже существовала
      со старой структурой.
    */

    const migrations = [
      `
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url TEXT
      `,

      `
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bio TEXT
      `,

      `
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subscription_tier TEXT
      NOT NULL DEFAULT 'free'
      `,

      `
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
      NOT NULL DEFAULT NOW()
      `,

      `
      ALTER TABLE artists
      ADD COLUMN IF NOT EXISTS avatar_url TEXT
      `,

      `
      ALTER TABLE artists
      ADD COLUMN IF NOT EXISTS bio TEXT
      `,

      `
      ALTER TABLE albums
      ADD COLUMN IF NOT EXISTS cover_url TEXT
      `,

      `
      ALTER TABLE albums
      ADD COLUMN IF NOT EXISTS year INTEGER
      `,

      `
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS cover_url TEXT
      `,

      `
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS telegram_file_id TEXT
      `,

      `
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS telegram_channel_id TEXT
      `,

      `
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT
      `,

      `
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS plays_count BIGINT
      NOT NULL DEFAULT 0
      `,

      `
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS is_premium BOOLEAN
      NOT NULL DEFAULT FALSE
      `,

      `
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
      NOT NULL DEFAULT NOW()
      `,
    ];

    for (const migration of migrations) {
      try {
        await client.query(migration);
      } catch (error) {
        console.error(
          'Migration warning:',
          error.message
        );
      }
    }

    console.log(
      'PostgreSQL database initialized successfully.'
    );
  } finally {
    client.release();
  }
}

/* =========================================================
   PASSWORD
========================================================= */

function hashPassword(
  password,
  salt = crypto
    .randomBytes(16)
    .toString('hex')
) {
  const hash = crypto
    .scryptSync(
      password,
      salt,
      64
    )
    .toString('hex');

  return `${salt}:${hash}`;
}

function verifyPassword(
  password,
  stored
) {
  try {
    const parts =
      String(stored).split(':');

    const salt = parts[0];
    const key = parts[1];

    if (!salt || !key) {
      return false;
    }

    const hash = crypto
      .scryptSync(
        password,
        salt,
        64
      )
      .toString('hex');

    const a = Buffer.from(
      hash,
      'hex'
    );

    const b = Buffer.from(
      key,
      'hex'
    );

    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      a,
      b
    );
  } catch {
    return false;
  }
}

/* =========================================================
   AUTH HELPERS
========================================================= */

async function createSession(
  userId
) {
  const token =
    crypto
      .randomBytes(48)
      .toString('hex');

  const expiresAt =
    new Date(
      Date.now() +
        1000 * 60 * 60 * 24 * 30
    );

  await pool.query(
    `
    INSERT INTO sessions
      (token, user_id, expires_at)
    VALUES
      ($1, $2, $3)
    `,
    [
      token,
      userId,
      expiresAt,
    ]
  );

  return token;
}

async function getUserById(
  userId
) {
  const result =
    await pool.query(
      `
      SELECT
        id,
        username,
        email,
        avatar_url,
        bio,
        subscription_tier,
        created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

  return result.rows[0] || null;
}

async function auth(
  req,
  res,
  next
) {
  try {
    const header =
      req.headers.authorization || '';

    let token = '';

    if (
      header.startsWith(
        'Bearer '
      )
    ) {
      token =
        header.slice(7).trim();
    }

    if (!token) {
      return res
        .status(401)
        .json({
          error:
            'Необходим вход',
        });
    }

    const session =
      await pool.query(
        `
        SELECT
          token,
          user_id,
          expires_at
        FROM sessions
        WHERE token = $1
        LIMIT 1
        `,
        [token]
      );

    if (
      !session.rows.length
    ) {
      return res
        .status(401)
        .json({
          error:
            'Сессия недействительна',
        });
    }

    const row =
      session.rows[0];

    if (
      new Date(
        row.expires_at
      ).getTime() <
      Date.now()
    ) {
      await pool.query(
        `
        DELETE FROM sessions
        WHERE token = $1
        `,
        [token]
      );

      return res
        .status(401)
        .json({
          error:
            'Сессия истекла',
        });
    }

    const user =
      await getUserById(
        row.user_id
      );

    if (!user) {
      return res
        .status(401)
        .json({
          error:
            'Пользователь не найден',
        });
    }

    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error(
      'Auth error:',
      error
    );

    return res
      .status(500)
      .json({
        error:
          'Ошибка авторизации',
      });
  }
}

/* =========================================================
   HEALTH / ROOT
========================================================= */

app.get(
  '/',
  (req, res) => {
    res.json({
      service:
        'Fenix Music Backend',
      status: 'online',
      version: '2.0.0',
      node:
        process.version,
      endpoints: {
        health:
          '/api/health',
        tracks:
          '/api/tracks',
        auth:
          '/api/auth/login',
        register:
          '/api/auth/register',
      },
    });
  }
);

app.get(
  '/api',
  (req, res) => {
    res.json({
      name:
        'Fenix Music API',
      status: 'online',
      version: '2.0.0',
    });
  }
);

app.get(
  '/api/health',
  async (req, res) => {
    try {
      await pool.query(
        'SELECT 1'
      );

      res.json({
        status: 'ok',
        service:
          'Fenix Music API',
        database:
          'connected',
      });
    } catch (error) {
      console.error(
        'Health DB error:',
        error
      );

      res.status(503).json({
        status:
          'degraded',
        service:
          'Fenix Music API',
        database:
          'disconnected',
      });
    }
  }
);

/* =========================================================
   CAPTCHA
========================================================= */

function generateCaptchaText() {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let text = '';

  for (
    let i = 0;
    i < 6;
    i++
  ) {
    text +=
      chars[
        crypto.randomInt(
          chars.length
        )
      ];
  }

  return text;
}

app.get(
  '/api/auth/captcha',
  async (req, res) => {
    try {
      const id =
        crypto
          .randomBytes(16)
          .toString('hex');

      const text =
        generateCaptchaText();

      const expiresAt =
        new Date(
          Date.now() +
            5 * 60 * 1000
        );

      await pool.query(
        `
        INSERT INTO captchas
          (id, text, expires_at)
        VALUES
          ($1, $2, $3)
        `,
        [
          id,
          text,
          expiresAt,
        ]
      );

      res.json({
        id,
        text,
      });
    } catch (error) {
      console.error(
        'CAPTCHA error:',
        error
      );

      /*
        Fallback нужен, чтобы регистрация
        не ломалась, даже если таблица
        CAPTCHA временно недоступна.
      */

      res.json({
        id: null,
        text:
          generateCaptchaText(),
      });
    }
  }
);

/* =========================================================
   REGISTER
========================================================= */

app.post(
  '/api/auth/register',
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
          username || ''
        ).trim();

      const cleanEmail =
        String(
          email || ''
        )
          .trim()
          .toLowerCase();

      const cleanCaptcha =
        String(
          captcha || ''
        )
          .trim()
          .toUpperCase();

      if (
        !cleanUsername ||
        !cleanEmail ||
        !password ||
        !cleanCaptcha
      ) {
        return res
          .status(400)
          .json({
            error:
              'Заполните все поля',
          });
      }

      if (
        cleanUsername.length <
        3
      ) {
        return res
          .status(400)
          .json({
            error:
              'Username минимум 3 символа',
          });
      }

      if (
        password.length < 6
      ) {
        return res
          .status(400)
          .json({
            error:
              'Пароль минимум 6 символов',
          });
      }

      /* =========================
         CAPTCHA
      ========================= */

      let captchaRow = null;

      if (captcha_id) {
        const result =
          await pool.query(
            `
            SELECT
              id,
              text,
              expires_at
            FROM captchas
            WHERE id = $1
            LIMIT 1
            `,
            [captcha_id]
          );

        captchaRow =
          result.rows[0] ||
          null;
      }

      /*
        Совместимость с твоим App.js:
        если ID не пришёл, берём последнюю
        действующую CAPTCHA.
      */

      if (!captchaRow) {
        const result =
          await pool.query(
            `
            SELECT
              id,
              text,
              expires_at
            FROM captchas
            WHERE expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
            `
          );

        captchaRow =
          result.rows[0] ||
          null;
      }

      if (
        captchaRow
      ) {
        const valid =
          new Date(
            captchaRow.expires_at
          ).getTime() >
            Date.now() &&
          String(
            captchaRow.text
          )
            .trim()
            .toUpperCase() ===
            cleanCaptcha;

        if (!valid) {
          return res
            .status(400)
            .json({
              error:
                'Неверная CAPTCHA',
            });
        }

        await pool.query(
          `
          DELETE FROM captchas
          WHERE id = $1
          `,
          [captchaRow.id]
        );
      }

      /* =========================
         CHECK USER
      ========================= */

      const exists =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE
            LOWER(username) =
              LOWER($1)
            OR
            LOWER(email) =
              LOWER($2)
          LIMIT 1
          `,
          [
            cleanUsername,
            cleanEmail,
          ]
        );

      if (
        exists.rows.length
      ) {
        return res
          .status(409)
          .json({
            error:
              'Пользователь или email уже существует',
          });
      }

      /* =========================
         CREATE USER
      ========================= */

      const passwordHash =
        hashPassword(
          password
        );

      const result =
        await pool.query(
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
            avatar_url,
            bio,
            subscription_tier,
            created_at
          `,
          [
            cleanUsername,
            cleanEmail,
            passwordHash,
          ]
        );

      const user =
        result.rows[0];

      const token =
        await createSession(
          user.id
        );

      res.status(201).json({
        token,
        user,
      });
    } catch (error) {
      console.error(
        'Register error:',
        error
      );

      res.status(500).json({
        error:
          'Ошибка сервера',
      });
    }
  }
);

/* =========================================================
   LOGIN
========================================================= */

app.post(
  '/api/auth/login',
  async (req, res) => {
    try {
      const {
        login,
        email,
        username,
        password,
      } = req.body || {};

      const identifier =
        String(
          login ||
            email ||
            username ||
            ''
        ).trim();

      if (
        !identifier ||
        !password
      ) {
        return res
          .status(400)
          .json({
            error:
              'Введите логин и пароль',
          });
      }

      const result =
        await pool.query(
          `
          SELECT *
          FROM users
          WHERE
            LOWER(email) =
              LOWER($1)
            OR
            LOWER(username) =
              LOWER($1)
          LIMIT 1
          `,
          [identifier]
        );

      const user =
        result.rows[0];

      if (!user) {
        return res
          .status(401)
          .json({
            error:
              'Неверный логин или пароль',
          });
      }

      const valid =
        verifyPassword(
          password,
          user.password_hash
        );

      if (!valid) {
        return res
          .status(401)
          .json({
            error:
              'Неверный логин или пароль',
          });
      }

      const safeUser = {
        id:
          user.id,
        username:
          user.username,
        email:
          user.email,
        avatar_url:
          user.avatar_url,
        bio:
          user.bio,
        subscription_tier:
          user.subscription_tier,
        created_at:
          user.created_at,
      };

      const token =
        await createSession(
          user.id
        );

      res.json({
        token,
        user:
          safeUser,
      });
    } catch (error) {
      console.error(
        'Login error:',
        error
      );

      res.status(500).json({
        error:
          'Ошибка сервера',
      });
    }
  }
);

/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  '/api/auth/me',
  auth,
  async (req, res) => {
    res.json(
      req.user
    );
  }
);

/* =========================================================
   LOGOUT
========================================================= */

app.post(
  '/api/auth/logout',
  auth,
  async (req, res) => {
    try {
      await pool.query(
        `
        DELETE FROM sessions
        WHERE token = $1
        `,
        [req.token]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        'Logout error:',
        error
      );

      res.status(500).json({
        error:
          'Ошибка выхода',
      });
    }
  }
);

/* =========================================================
   UPDATE PROFILE
========================================================= */

app.patch(
  '/api/auth/profile',
  auth,
  async (req, res) => {
    try {
      const {
        username,
        bio,
        avatar_url,
      } = req.body || {};

      const cleanUsername =
        username !== undefined
          ? String(
              username
            ).trim()
          : req.user.username;

      const cleanBio =
        bio !== undefined
          ? String(bio)
          : req.user.bio;

      const cleanAvatar =
        avatar_url !== undefined
          ? String(
              avatar_url
            )
          : req.user.avatar_url;

      if (
        cleanUsername.length <
        3
      ) {
        return res
          .status(400)
          .json({
            error:
              'Username минимум 3 символа',
          });
      }

      const duplicate =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE
            LOWER(username) =
              LOWER($1)
            AND id <> $2
          LIMIT 1
          `,
          [
            cleanUsername,
            req.user.id,
          ]
        );

      if (
        duplicate.rows.length
      ) {
        return res
          .status(409)
          .json({
            error:
              'Такой username уже занят',
          });
      }

      const result =
        await pool.query(
          `
          UPDATE users
          SET
            username = $1,
            bio = $2,
            avatar_url = $3,
            updated_at = NOW()
          WHERE id = $4
          RETURNING
            id,
            username,
            email,
            avatar_url,
            bio,
            subscription_tier,
            created_at
          `,
          [
            cleanUsername,
            cleanBio,
            cleanAvatar,
            req.user.id,
          ]
        );

      res.json({
        user:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        'Profile update error:',
        error
      );

      res.status(500).json({
        error:
          'Ошибка обновления профиля',
      });
    }
  }
);

/* =========================================================
   TRACKS
========================================================= */

app.get(
  '/api/tracks',
  async (req, res) => {
    try {
      const search =
        String(
          req.query.search ||
            ''
        ).trim();

      const genre =
        String(
          req.query.genre ||
            ''
        ).trim();

      let sql = `
        SELECT
          t.id,
          t.title,
          t.duration,
          t.audio_url,
          COALESCE(
            t.cover_url,
            al.cover_url
          ) AS cover_url,
          t.genre,
          t.plays_count,
          t.plays_count AS plays,
          t.is_premium,
          t.created_at,

          a.name AS artist_name,
          a.avatar_url AS artist_avatar,

          al.title AS album_name,
          al.title AS album_title,
          al.cover_url AS album_cover_url,
          al.year

        FROM tracks t

        LEFT JOIN artists a
          ON t.artist_id = a.id

        LEFT JOIN albums al
          ON t.album_id = al.id
      `;

      const params = [];

      if (search) {
        sql += `
          WHERE
            t.title ILIKE $1
            OR
            COALESCE(
              a.name,
              ''
            ) ILIKE $1
            OR
            COALESCE(
              al.title,
              ''
            ) ILIKE $1
            OR
            COALESCE(
              t.genre,
              ''
            ) ILIKE $1
        `;

        params.push(
          `%${search}%`
        );
      } else if (genre) {
        sql += `
          WHERE t.genre = $1
        `;

        params.push(
          genre
        );
      }

      sql += `
        ORDER BY
          t.created_at DESC,
          t.plays_count DESC

        LIMIT 100
      `;

      const result =
        await pool.query(
          sql,
          params
        );

      res.json(
        result.rows
      );
    } catch (error) {
      console.error(
        'Tracks error:',
        error
      );

      res.status(500).json({
        error:
          'Server error',
        tracks: [],
      });
    }
  }
);

/* =========================================================
   SINGLE TRACK
========================================================= */

app.get(
  '/api/tracks/:id',
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            t.id,
            t.title,
            t.duration,
            t.audio_url,
            COALESCE(
              t.cover_url,
              al.cover_url
            ) AS cover_url,
            t.genre,
            t.plays_count,
            t.is_premium,
            t.created_at,

            a.name AS artist_name,
            a.avatar_url AS artist_avatar,

            al.title AS album_name,
            al.cover_url AS album_cover_url,
            al.year

          FROM tracks t

          LEFT JOIN artists a
            ON t.artist_id = a.id

          LEFT JOIN albums al
            ON t.album_id = al.id

          WHERE t.id = $1

          LIMIT 1
          `,
          [req.params.id]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(404)
          .json({
            error:
              'Track not found',
          });
      }

      res.json(
        result.rows[0]
      );
    } catch (error) {
      console.error(
        'Single track error:',
        error
      );

      res.status(500).json({
        error:
          'Server error',
      });
    }
  }
);

/* =========================================================
   AUDIO
========================================================= */

app.get(
  '/api/tracks/:id/audio',
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            telegram_file_id,
            audio_url
          FROM tracks
          WHERE id = $1
          LIMIT 1
          `,
          [req.params.id]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(404)
          .json({
            error:
              'Track not found',
          });
      }

      const track =
        result.rows[0];

      /* =========================
         TELEGRAM FILE
      ========================= */

      if (
        track.telegram_file_id &&
        BOT_TOKEN
      ) {
        const file =
          await telegram(
            'getFile',
            {
              file_id:
                track.telegram_file_id,
            }
          );

        if (
          !file ||
          !file.file_path
        ) {
          return res
            .status(502)
            .json({
              error:
                'Telegram file path unavailable',
            });
        }

        const telegramUrl =
          `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

        const response =
          await fetch(
            telegramUrl
          );

        if (
          !response.ok ||
          !response.body
        ) {
          return res
            .status(502)
            .json({
              error:
                'Unable to load Telegram audio',
            });
        }

        res.status(200);

        res.setHeader(
          'Content-Type',
          response.headers.get(
            'content-type'
          ) ||
            'audio/mpeg'
        );

        const contentLength =
          response.headers.get(
            'content-length'
          );

        if (
          contentLength
        ) {
          res.setHeader(
            'Content-Length',
            contentLength
          );
        }

        res.setHeader(
          'Cache-Control',
          'public, max-age=3600'
        );

        /*
          Node.js 18+ / Render:
          convert Web ReadableStream
          into Node Readable.
        */

        const { Readable } =
          require('stream');

        const stream =
          Readable.fromWeb(
            response.body
          );

        stream.on(
          'error',
          (error) => {
            console.error(
              'Audio stream error:',
              error
            );

            if (
              !res.headersSent
            ) {
              res.status(500);
            }

            res.end();
          }
        );

        stream.pipe(res);

        await pool.query(
          `
          UPDATE tracks
          SET
            plays_count =
              plays_count + 1
          WHERE id = $1
          `,
          [req.params.id]
        );

        return;
      }

      /* =========================
         DIRECT AUDIO URL
      ========================= */

      if (
        track.audio_url
      ) {
        await pool.query(
          `
          UPDATE tracks
          SET
            plays_count =
              plays_count + 1
          WHERE id = $1
          `,
          [req.params.id]
        );

        return res.redirect(
          track.audio_url
        );
      }

      return res
        .status(404)
        .json({
          error:
            'Audio file not found',
        });
    } catch (error) {
      console.error(
        'Audio endpoint error:',
        error
      );

      if (
        !res.headersSent
      ) {
        res.status(500).json({
          error:
            'Audio server error',
        });
      }
    }
  }
);

/* =========================================================
   TELEGRAM API
========================================================= */

async function telegram(
  method,
  body
) {
  if (!BOT_TOKEN) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is not configured'
    );
  }

  const response =
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify(body),
      }
    );

  const data =
    await response.json();

  if (!data.ok) {
    throw new Error(
      data.description ||
        'Telegram API error'
    );
  }

  return data.result;
}

/* =========================================================
   TELEGRAM MUSIC IMPORT
========================================================= */

let telegramOffset = 0;

async function processTelegramUpdate(
  update
) {
  const message =
    update.message;

  if (!message) {
    return;
  }

  const audio =
    message.audio ||
    (
      message.document &&
      String(
        message.document
          .mime_type || ''
      ).startsWith(
        'audio/'
      )
        ? message.document
        : null
    );

  if (!audio) {
    return;
  }

  try {
    const title =
      audio.title ||
      (
        audio.file_name
          ? audio.file_name.replace(
              /\.[^.]+$/,
              ''
            )
          : null
      ) ||
      'Без названия';

    const artist =
      audio.performer ||
      (
        message.caption
          ? message.caption
              .split('\n')[0]
          : null
      ) ||
      'Неизвестный исполнитель';

    const duration =
      Number(
        audio.duration || 0
      );

    const fileId =
      audio.file_id;

    /* =========================
       ARTIST
    ========================= */

    const existingArtist =
      await pool.query(
        `
        SELECT id
        FROM artists
        WHERE LOWER(name) =
          LOWER($1)
        LIMIT 1
        `,
        [artist]
      );

    let artistId;

    if (
      existingArtist.rows.length
    ) {
      artistId =
        existingArtist
          .rows[0].id;
    } else {
      const inserted =
        await pool.query(
          `
          INSERT INTO artists
            (name)
          VALUES
            ($1)
          RETURNING id
          `,
          [artist]
        );

      artistId =
        inserted.rows[0].id;
    }

    /* =========================
       TRACK
    ========================= */

    const trackResult =
      await pool.query(
        `
        INSERT INTO tracks
          (
            title,
            artist_id,
            duration,
            audio_url,
            genre,
            telegram_file_id
          )
        VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
        RETURNING id
        `,
        [
          title,
          artistId,
          duration,
          null,
          'Music',
          fileId,
        ]
      );

    const trackId =
      trackResult.rows[0].id;

    const audioUrl =
      `${PUBLIC_API_URL}/api/tracks/${trackId}/audio`;

    await pool.query(
      `
      UPDATE tracks
      SET audio_url = $1
      WHERE id = $2
      `,
      [
        audioUrl,
        trackId,
      ]
    );

    /* =========================
       CHANNEL
    ========================= */

    let channelMessageId =
      null;

    if (CHANNEL_ID) {
      const sent =
        await telegram(
          'sendAudio',
          {
            chat_id:
              CHANNEL_ID,

            audio:
              fileId,

            caption:
              `🎵 ${title}\n` +
              `👤 ${artist}\n` +
              `🆔 ID: ${trackId}`,
          }
        );

      channelMessageId =
        sent.message_id;

      await pool.query(
        `
        UPDATE tracks
        SET
          telegram_channel_id =
            $1,
          telegram_message_id =
            $2
        WHERE id = $3
        `,
        [
          String(
            CHANNEL_ID
          ),
          channelMessageId,
          trackId,
        ]
      );
    }

    /* =========================
       REPLY TO USER
    ========================= */

    await telegram(
      'sendMessage',
      {
        chat_id:
          message.chat.id,

        text:
          `✅ Трек добавлен!\n\n` +
          `🎵 ${title}\n` +
          `👤 ${artist}\n` +
          `🆔 ID: ${trackId}\n` +
          `🌐 ${audioUrl}` +
          (
            CHANNEL_ID
              ? `\n📢 Опубликован в канале.`
              : ''
          ),
      }
    );

    console.log(
      `Telegram track imported: ${trackId} - ${title}`
    );
  } catch (error) {
    console.error(
      'Telegram import error:',
      error
    );

    try {
      await telegram(
        'sendMessage',
        {
          chat_id:
            message.chat.id,

          text:
            `❌ Не удалось добавить трек:\n${error.message}`,
        }
      );
    } catch {}
  }
}

/* =========================================================
   TELEGRAM POLLING
========================================================= */

async function botLoop() {
  if (!BOT_TOKEN) {
    console.log(
      'Telegram polling disabled: TELEGRAM_BOT_TOKEN is not configured.'
    );

    return;
  }

  try {
    const updates =
      await telegram(
        'getUpdates',
        {
          offset:
            telegramOffset,

          timeout: 25,

          allowed_updates: [
            'message',
          ],
        }
      );

    for (
      const update of updates
    ) {
      telegramOffset =
        update.update_id + 1;

      await processTelegramUpdate(
        update
      );
    }
  } catch (error) {
    console.error(
      'Telegram polling error:',
      error.message
    );

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          3000
        )
    );
  }

  setImmediate(
    botLoop
  );
}

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        'Endpoint not found',
      path:
        req.originalUrl,
    });
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
      'Unhandled Express error:',
      error
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    res.status(500).json({
      error:
        'Internal server error',
    });
  }
);

/* =========================================================
   START
========================================================= */

async function start() {
  try {
    await initDatabase();

    app.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log(
          '========================================'
        );

        console.log(
          '🔥 FENIX MUSIC BACKEND'
        );

        console.log(
          `🚀 Port: ${PORT}`
        );

        console.log(
          `🌐 Public API: ${PUBLIC_API_URL}`
        );

        console.log(
          '🗄 PostgreSQL: connected'
        );

        console.log(
          `🤖 Telegram: ${
            BOT_TOKEN
              ? 'enabled'
              : 'disabled'
          }`
        );

        console.log(
          '========================================'
        );

        /*
          Запускаем Telegram после старта
          HTTP-сервера.
        */

        if (BOT_TOKEN) {
          botLoop();
        }
      }
    );
  } catch (error) {
    console.error(
      '========================================'
    );

    console.error(
      '❌ FENIX MUSIC BACKEND FAILED TO START'
    );

    console.error(
      error
    );

    console.error(
      '========================================'
    );

    process.exit(1);
  }
}

process.on(
  'SIGTERM',
  async () => {
    console.log(
      'SIGTERM received. Closing...'
    );

    await pool.end();

    process.exit(0);
  }
);

process.on(
  'SIGINT',
  async () => {
    console.log(
      'SIGINT received. Closing...'
    );

    await pool.end();

    process.exit(0);
  }
);

start();
