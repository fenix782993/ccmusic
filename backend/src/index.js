'use strict';

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 5000);
const DATABASE_URL = process.env.DATABASE_URL;

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || '';

const CHANNEL_ID =
  process.env.TELEGRAM_CHANNEL_ID || '';

const PUBLIC_API_URL =
  (process.env.PUBLIC_API_URL || '')
    .replace(/\/$/, '');

if (!DATABASE_URL) {
  console.error(
    '❌ DATABASE_URL is not configured'
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const sessions = new Map();
const captchas = new Map();

let telegramOffset = 0;
let server = null;
let telegramLoopRunning = false;

/* =========================================================
   HELPERS
========================================================= */

function apiBase() {
  return (
    PUBLIC_API_URL ||
    `http://localhost:${PORT}`
  );
}

function cleanString(value, max = 500) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function safeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio || '',
    avatar_url:
      user.avatar_url || '',
    subscription_tier:
      user.subscription_tier || 'free',
    created_at:
      user.created_at || null,
  };
}

function normalizeTrack(row) {
  if (!row) {
    return null;
  }

  const plays = Number(
    row.plays ??
    row.plays_count ??
    row.play_count ??
    0
  );

  return {
    ...row,

    id: row.id,

    title:
      row.title ||
      row.name ||
      'Без названия',

    artist_name:
      row.artist_name ||
      row.artist ||
      'Неизвестный артист',

    album_name:
      row.album_name ||
      row.album_title ||
      row.album ||
      'Без альбома',

    genre:
      row.genre ||
      'Music',

    duration:
      Number(row.duration || 0),

    plays,

    play_count: plays,

    cover_url:
      row.cover_url ||
      row.album_cover_url ||
      row.cover ||
      '',

    audio_url:
      row.audio_url || '',

    is_premium:
      Boolean(row.is_premium),
  };
}

function hashPassword(
  password,
  salt = crypto
    .randomBytes(16)
    .toString('hex')
) {
  const hash =
    crypto
      .scryptSync(
        String(password),
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
      String(stored || '')
        .split(':');

    if (parts.length !== 2) {
      return false;
    }

    const [
      salt,
      key,
    ] = parts;

    const actual =
      crypto.scryptSync(
        String(password),
        salt,
        64
      );

    const expected =
      Buffer.from(
        key,
        'hex'
      );

    return (
      actual.length ===
        expected.length &&
      crypto.timingSafeEqual(
        actual,
        expected
      )
    );
  } catch {
    return false;
  }
}

function createSession(user) {
  const token =
    crypto
      .randomBytes(32)
      .toString('hex');

  sessions.set(token, {
    userId: user.id,

    expires:
      Date.now() +
      30 *
        24 *
        60 *
        60 *
        1000,
  });

  return token;
}

function getBearerToken(req) {
  const header =
    req.headers.authorization || '';

  if (
    !header.startsWith('Bearer ')
  ) {
    return '';
  }

  return header
    .slice(7)
    .trim();
}

/* =========================================================
   AUTH
========================================================= */

async function auth(
  req,
  res,
  next
) {
  try {
    const token =
      getBearerToken(req);

    const session =
      sessions.get(token);

    if (
      !session ||
      session.expires < Date.now()
    ) {
      if (token) {
        sessions.delete(token);
      }

      return res
        .status(401)
        .json({
          error:
            'Необходим вход',
        });
    }

    const result =
      await pool.query(
        `
        SELECT
          id,
          username,
          email,
          bio,
          avatar_url,
          subscription_tier,
          created_at
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [session.userId]
      );

    if (!result.rows[0]) {
      sessions.delete(token);

      return res
        .status(401)
        .json({
          error:
            'Пользователь не найден',
        });
    }

    req.user =
      result.rows[0];

    req.token =
      token;

    next();
  } catch (error) {
    console.error(
      'Auth error:',
      error
    );

    res
      .status(500)
      .json({
        error:
          'Ошибка авторизации',
      });
  }
}

async function optionalAuth(
  req,
  _res,
  next
) {
  try {
    const token =
      getBearerToken(req);

    const session =
      sessions.get(token);

    if (
      session &&
      session.expires >= Date.now()
    ) {
      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            email,
            bio,
            avatar_url,
            subscription_tier,
            created_at
          FROM users
          WHERE id = $1
          LIMIT 1
          `,
          [session.userId]
        );

      req.user =
        result.rows[0] ||
        null;

      req.token =
        token;
    }
  } catch (error) {
    console.error(
      'Optional auth error:',
      error.message
    );
  }

  next();
}

/* =========================================================
   CAPTCHA
========================================================= */

function captchaText() {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let value = '';

  for (
    let i = 0;
    i < 6;
    i++
  ) {
    value +=
      chars[
        crypto.randomInt(
          chars.length
        )
      ];
  }

  return value;
}

function cleanupCaptchas() {
  const now =
    Date.now();

  for (
    const [id, item]
    of captchas
  ) {
    if (
      item.expires <= now
    ) {
      captchas.delete(id);
    }
  }
}

/* =========================================================
   DATABASE
========================================================= */

async function columnExists(
  table,
  column
) {
  const result =
    await pool.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
      `,
      [
        table,
        column,
      ]
    );

  return (
    result.rowCount > 0
  );
}

async function addColumnIfMissing(
  table,
  column,
  definition
) {
  if (
    !(await columnExists(
      table,
      column
    ))
  ) {
    await pool.query(
      `
      ALTER TABLE ${table}
      ADD COLUMN ${column} ${definition}
      `
    );

    console.log(
      `  + added ${table}.${column}`
    );
  }
}

async function initDatabase() {
  console.log(
    'Connecting to PostgreSQL...'
  );

  const client =
    await pool.connect();

  try {
    await client.query(
      'SELECT 1'
    );

    await client.query(
      'BEGIN'
    );

    /* =========================
       USERS
    ========================= */

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(64) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        bio TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        subscription_tier VARCHAR(32) NOT NULL DEFAULT 'free',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /* =========================
       ARTISTS
    ========================= */

    await client.query(`
      CREATE TABLE IF NOT EXISTS artists (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        avatar_url TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /* =========================
       ALBUMS
    ========================= */

    await client.query(`
      CREATE TABLE IF NOT EXISTS albums (
        id BIGSERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist_id BIGINT,
        cover_url TEXT DEFAULT '',
        year INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /* =========================
       TRACKS

       IMPORTANT:
       plays_count is created here
       before any index can use it.
    ========================= */

    await client.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id BIGSERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist_id BIGINT,
        album_id BIGINT,
        duration INTEGER NOT NULL DEFAULT 0,
        audio_url TEXT DEFAULT '',
        genre VARCHAR(100) NOT NULL DEFAULT 'Music',
        plays_count BIGINT NOT NULL DEFAULT 0,
        is_premium BOOLEAN NOT NULL DEFAULT FALSE,
        telegram_file_id TEXT,
        telegram_channel_id TEXT,
        telegram_message_id BIGINT,
        cover_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /* =========================
       PLAYLISTS
    ========================= */

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        name VARCHAR(255) NOT NULL,
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /* =========================
       PLAYLIST TRACKS
    ========================= */

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id BIGINT NOT NULL,
        track_id BIGINT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (playlist_id, track_id)
      )
    `);

    /* =========================
       FAVORITES
    ========================= */

    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_id BIGINT NOT NULL,
        track_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, track_id)
      )
    `);

    /* =========================
       HISTORY
    ========================= */

    await client.query(`
      CREATE TABLE IF NOT EXISTS listening_history (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        track_id BIGINT NOT NULL,
        played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /* =====================================================
       SAFE MIGRATIONS
    ===================================================== */

    const migrations = [
      [
        'users',
        'bio',
        `TEXT DEFAULT ''`,
      ],

      [
        'users',
        'avatar_url',
        `TEXT DEFAULT ''`,
      ],

      [
        'users',
        'subscription_tier',
        `VARCHAR(32) NOT NULL DEFAULT 'free'`,
      ],

      [
        'users',
        'created_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ],

      [
        'users',
        'updated_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ],

      [
        'artists',
        'avatar_url',
        `TEXT DEFAULT ''`,
      ],

      [
        'artists',
        'bio',
        `TEXT DEFAULT ''`,
      ],

      [
        'artists',
        'created_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ],

      [
        'albums',
        'artist_id',
        `BIGINT`,
      ],

      [
        'albums',
        'cover_url',
        `TEXT DEFAULT ''`,
      ],

      [
        'albums',
        'year',
        `INTEGER`,
      ],

      [
        'albums',
        'created_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ],

      [
        'tracks',
        'artist_id',
        `BIGINT`,
      ],

      [
        'tracks',
        'album_id',
        `BIGINT`,
      ],

      [
        'tracks',
        'duration',
        `INTEGER NOT NULL DEFAULT 0`,
      ],

      [
        'tracks',
        'audio_url',
        `TEXT DEFAULT ''`,
      ],

      [
        'tracks',
        'genre',
        `VARCHAR(100) NOT NULL DEFAULT 'Music'`,
      ],

      [
        'tracks',
        'plays_count',
        `BIGINT NOT NULL DEFAULT 0`,
      ],

      [
        'tracks',
        'is_premium',
        `BOOLEAN NOT NULL DEFAULT FALSE`,
      ],

      [
        'tracks',
        'telegram_file_id',
        `TEXT`,
      ],

      [
        'tracks',
        'telegram_channel_id',
        `TEXT`,
      ],

      [
        'tracks',
        'telegram_message_id',
        `BIGINT`,
      ],

      [
        'tracks',
        'cover_url',
        `TEXT DEFAULT ''`,
      ],

      [
        'tracks',
        'created_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ],

      [
        'tracks',
        'updated_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ],

      [
        'playlists',
        'user_id',
        `BIGINT`,
      ],

      [
        'playlists',
        'is_public',
        `BOOLEAN NOT NULL DEFAULT FALSE`,
      ],

      [
        'playlists',
        'created_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ],

      [
        'playlist_tracks',
        'position',
        `INTEGER NOT NULL DEFAULT 0`,
      ],

      [
        'favorites',
        'created_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ],

      [
        'listening_history',
        'played_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ],
    ];

    for (
      const [
        table,
        column,
        definition,
      ]
      of migrations
    ) {
      await addColumnIfMissing(
        table,
        column,
        definition
      );
    }

    /* =====================================================
       OLD COLUMN COMPATIBILITY
    ===================================================== */

    const hasOldPlayCount =
      await columnExists(
        'tracks',
        'play_count'
      );

    const hasPlaysCount =
      await columnExists(
        'tracks',
        'plays_count'
      );

    if (
      hasOldPlayCount &&
      hasPlaysCount
    ) {
      await client.query(`
        UPDATE tracks
        SET plays_count =
          COALESCE(
            NULLIF(plays_count, 0),
            play_count,
            0
          )
      `);
    }

    /* =====================================================
       INDEXES

       Only create indexes AFTER all columns exist.
    ===================================================== */

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      idx_users_email_lower
      ON users (LOWER(email))
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      idx_users_username_lower
      ON users (LOWER(username))
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_artists_name
      ON artists (LOWER(name))
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_tracks_artist
      ON tracks (artist_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_tracks_album
      ON tracks (album_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_tracks_genre
      ON tracks (genre)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_tracks_plays_count
      ON tracks (plays_count DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_playlists_user
      ON playlists (user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_playlist_tracks_playlist
      ON playlist_tracks (playlist_id, position)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_favorites_user
      ON favorites (user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_history_user_played
      ON listening_history (
        user_id,
        played_at DESC
      )
    `);

    await client.query(
      'COMMIT'
    );

    console.log(
      '✅ PostgreSQL database ready'
    );
  } catch (error) {
    await client
      .query('ROLLBACK')
      .catch(() => {});

    throw error;
  } finally {
    client.release();
  }
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
  '/',
  (_req, res) => {
    res.json({
      ok: true,
      name: 'FENIX MUSIC BACKEND',
      version: '2.0.0',
      status: 'online',
      api: apiBase(),
    });
  }
);

app.get(
  '/api/health',
  async (_req, res) => {
    try {
      await pool.query(
        'SELECT 1'
      );

      res.json({
        ok: true,
        status: 'online',
        database: 'connected',
        service: 'fenix-music-backend',
      });
    } catch (error) {
      console.error(
        'Health error:',
        error
      );

      res
        .status(503)
        .json({
          ok: false,
          status: 'offline',
          database: 'error',
        });
    }
  }
);

/* =========================================================
   AUTH CAPTCHA
========================================================= */

app.get(
  '/api/auth/captcha',
  (_req, res) => {
    cleanupCaptchas();

    const id =
      crypto
        .randomBytes(16)
        .toString('hex');

    const text =
      captchaText();

    captchas.set(id, {
      text,
      expires:
        Date.now() +
        5 * 60 * 1000,
    });

    res.json({
      id,
      captcha_id: id,
      text,
      code: text,
      captcha: text,
    });
  }
);

/* =========================================================
   REGISTER
========================================================= */

app.post(
  '/api/auth/register',
  async (req, res) => {
    try {
      const username =
        cleanString(
          req.body?.username,
          64
        );

      const email =
        cleanString(
          req.body?.email,
          255
        ).toLowerCase();

      const password =
        String(
          req.body?.password || ''
        );

      const captcha =
        cleanString(
          req.body?.captcha,
          20
        ).toUpperCase();

      const captchaId =
        cleanString(
          req.body?.captcha_id,
          100
        );

      if (
        !username ||
        !email ||
        !password
      ) {
        return res
          .status(400)
          .json({
            error:
              'Заполните все поля',
          });
      }

      if (
        password.length < 6
      ) {
        return res
          .status(400)
          .json({
            error:
              'Пароль должен содержать минимум 6 символов',
          });
      }

      const storedCaptcha =
        captchas.get(
          captchaId
        );

      if (
        !storedCaptcha ||
        storedCaptcha.expires <
          Date.now()
      ) {
        return res
          .status(400)
          .json({
            error:
              'CAPTCHA истекла',
          });
      }

      if (
        storedCaptcha.text !==
        captcha
      ) {
        captchas.delete(
          captchaId
        );

        return res
          .status(400)
          .json({
            error:
              'Неверная CAPTCHA',
          });
      }

      captchas.delete(
        captchaId
      );

      const exists =
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

      if (exists.rows[0]) {
        return res
          .status(409)
          .json({
            error:
              'Пользователь или email уже существует',
          });
      }

      const passwordHash =
        hashPassword(
          password
        );

      const result =
        await pool.query(
          `
          INSERT INTO users (
            username,
            email,
            password_hash
          )
          VALUES ($1, $2, $3)
          RETURNING
            id,
            username,
            email,
            bio,
            avatar_url,
            subscription_tier,
            created_at
          `,
          [
            username,
            email,
            passwordHash,
          ]
        );

      const user =
        result.rows[0];

      const token =
        createSession(
          user
        );

      res.status(201).json({
        ok: true,
        token,
        access_token: token,
        user: safeUser(user),
      });
    } catch (error) {
      console.error(
        'Register error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Ошибка регистрации',
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
      const login =
        cleanString(
          req.body?.login ||
          req.body?.email ||
          req.body?.username,
          255
        );

      const password =
        String(
          req.body?.password || ''
        );

      if (
        !login ||
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
          SELECT
            id,
            username,
            email,
            password_hash,
            bio,
            avatar_url,
            subscription_tier,
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
        !verifyPassword(
          password,
          user.password_hash
        )
      ) {
        return res
          .status(401)
          .json({
            error:
              'Неверный логин или пароль',
          });
      }

      const token =
        createSession(
          user
        );

      res.json({
        ok: true,
        token,
        access_token: token,
        user:
          safeUser(user),
      });
    } catch (error) {
      console.error(
        'Login error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Ошибка входа',
        });
    }
  }
);

/* =========================================================
   ME
========================================================= */

app.get(
  '/api/auth/me',
  auth,
  (req, res) => {
    res.json({
      user:
        safeUser(req.user),
    });
  }
);

/* =========================================================
   LOGOUT
========================================================= */

app.post(
  '/api/auth/logout',
  auth,
  (req, res) => {
    sessions.delete(
      req.token
    );

    res.json({
      ok: true,
    });
  }
);

/* =========================================================
   PROFILE
========================================================= */

app.put(
  '/api/profile',
  auth,
  async (req, res) => {
    try {
      const username =
        cleanString(
          req.body?.username,
          64
        );

      const bio =
        cleanString(
          req.body?.bio,
          1000
        );

      if (!username) {
        return res
          .status(400)
          .json({
            error:
              'Username не может быть пустым',
          });
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

      if (
        duplicate.rows[0]
      ) {
        return res
          .status(409)
          .json({
            error:
              'Этот username уже занят',
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
            subscription_tier,
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
          safeUser(
            result.rows[0]
          ),
      });
    } catch (error) {
      console.error(
        'Profile update error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Не удалось сохранить профиль',
        });
    }
  }
);

/* =========================================================
   TRACK SELECT
========================================================= */

const TRACK_SELECT = `
  SELECT
    t.id,
    t.title,
    t.duration,
    t.audio_url,
    t.genre,
    t.plays_count,
    t.is_premium,
    t.telegram_file_id,
    t.telegram_channel_id,
    t.telegram_message_id,
    t.cover_url,
    t.created_at,
    t.updated_at,

    a.name AS artist_name,
    a.avatar_url AS artist_avatar,

    al.title AS album_name,
    al.cover_url AS album_cover_url,
    al.year

  FROM tracks t

  LEFT JOIN artists a
    ON a.id = t.artist_id

  LEFT JOIN albums al
    ON al.id = t.album_id
`;

/* =========================================================
   TRACKS
========================================================= */

app.get(
  '/api/tracks',
  async (req, res) => {
    try {
      const search =
        cleanString(
          req.query?.search,
          255
        );

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query?.limit || 100
            ),
            1
          ),
          500
        );

      let query =
        `${TRACK_SELECT}`;

      const params = [];

      if (search) {
        params.push(
          `%${search}%`
        );

        query += `
          WHERE
            LOWER(t.title)
              LIKE LOWER($1)
            OR LOWER(COALESCE(a.name, ''))
              LIKE LOWER($1)
            OR LOWER(COALESCE(al.title, ''))
              LIKE LOWER($1)
            OR LOWER(COALESCE(t.genre, ''))
              LIKE LOWER($1)
        `;
      }

      params.push(limit);

      query += `
        ORDER BY
          t.created_at DESC,
          t.id DESC
        LIMIT $${params.length}
      `;

      const result =
        await pool.query(
          query,
          params
        );

      res.json(
        result.rows.map(
          normalizeTrack
        )
      );
    } catch (error) {
      console.error(
        'Tracks GET error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Не удалось получить треки',
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
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id)
      ) {
        return res
          .status(400)
          .json({
            error:
              'Неверный ID трека',
          });
      }

      const result =
        await pool.query(
          `
          ${TRACK_SELECT}
          WHERE t.id = $1
          LIMIT 1
          `,
          [id]
        );

      if (
        !result.rows[0]
      ) {
        return res
          .status(404)
          .json({
            error:
              'Трек не найден',
          });
      }

      res.json(
        normalizeTrack(
          result.rows[0]
        )
      );
    } catch (error) {
      console.error(
        'Track GET error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

/* =========================================================
   TRACK PLAY COUNT
========================================================= */

app.post(
  '/api/tracks/:id/play',
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id)
      ) {
        return res
          .status(400)
          .json({
            error:
              'Неверный ID трека',
          });
      }

      const result =
        await pool.query(
          `
          UPDATE tracks
          SET
            plays_count =
              COALESCE(
                plays_count,
                0
              ) + 1,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            plays_count
          `,
          [id]
        );

      if (
        !result.rows[0]
      ) {
        return res
          .status(404)
          .json({
            error:
              'Трек не найден',
          });
      }

      res.json({
        ok: true,
        plays:
          Number(
            result.rows[0]
              .plays_count
          ),
      });
    } catch (error) {
      console.error(
        'Play count error:',
        error
      );

      res
        .status(500)
        .json({
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
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id)
      ) {
        return res
          .status(400)
          .json({
            error:
              'Неверный ID',
          });
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            audio_url,
            telegram_file_id
          FROM tracks
          WHERE id = $1
          LIMIT 1
          `,
          [id]
        );

      const track =
        result.rows[0];

      if (!track) {
        return res
          .status(404)
          .json({
            error:
              'Трек не найден',
          });
      }

      /*
       * If a direct audio URL exists,
       * redirect browser to it.
       */

      if (
        track.audio_url &&
        !track.audio_url.includes(
          `/api/tracks/${id}/audio`
        )
      ) {
        return res.redirect(
          track.audio_url
        );
      }

      /*
       * Telegram file streaming.
       */

      if (
        BOT_TOKEN &&
        track.telegram_file_id
      ) {
        const file =
          await telegramApi(
            'getFile',
            {
              file_id:
                track.telegram_file_id,
            }
          );

        if (
          file &&
          file.file_path
        ) {
          const telegramUrl =
            `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

          return res.redirect(
            telegramUrl
          );
        }
      }

      return res
        .status(404)
        .json({
          error:
            'Аудиофайл недоступен',
        });
    } catch (error) {
      console.error(
        'Audio error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Не удалось получить аудио',
        });
    }
  }
);

/* =========================================================
   FAVORITES
========================================================= */

app.get(
  '/api/favorites',
  auth,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          ${TRACK_SELECT}
          JOIN favorites f
            ON f.track_id = t.id
          WHERE f.user_id = $1
          ORDER BY
            f.created_at DESC
          `,
          [req.user.id]
        );

      res.json(
        result.rows.map(
          normalizeTrack
        )
      );
    } catch (error) {
      console.error(
        'Favorites GET error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

app.post(
  '/api/favorites/:trackId',
  auth,
  async (req, res) => {
    try {
      const trackId =
        Number(
          req.params.trackId
        );

      if (
        !Number.isInteger(
          trackId
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'Неверный ID',
          });
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
        'Favorite add error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

app.delete(
  '/api/favorites/:trackId',
  auth,
  async (req, res) => {
    try {
      const trackId =
        Number(
          req.params.trackId
        );

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
      });
    } catch (error) {
      console.error(
        'Favorite delete error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

/* =========================================================
   HISTORY
========================================================= */

app.get(
  '/api/history',
  auth,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            h.id AS history_id,
            h.played_at,
            t.id,
            t.title,
            t.duration,
            t.audio_url,
            t.genre,
            t.plays_count,
            t.is_premium,
            t.cover_url,

            a.name AS artist_name,
            a.avatar_url AS artist_avatar,

            al.title AS album_name,
            al.cover_url AS album_cover_url,
            al.year

          FROM listening_history h

          JOIN tracks t
            ON t.id = h.track_id

          LEFT JOIN artists a
            ON a.id = t.artist_id

          LEFT JOIN albums al
            ON al.id = t.album_id

          WHERE h.user_id = $1

          ORDER BY
            h.played_at DESC

          LIMIT 100
          `,
          [req.user.id]
        );

      res.json(
        result.rows.map(
          row => ({
            ...normalizeTrack(
              row
            ),
            played_at:
              row.played_at,
          })
        )
      );
    } catch (error) {
      console.error(
        'History GET error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

app.post(
  '/api/history/:trackId',
  auth,
  async (req, res) => {
    try {
      const trackId =
        Number(
          req.params.trackId
        );

      if (
        !Number.isInteger(
          trackId
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'Неверный ID',
          });
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

      await pool.query(
        `
        UPDATE tracks
        SET
          plays_count =
            COALESCE(
              plays_count,
              0
            ) + 1,
          updated_at = NOW()
        WHERE id = $1
        `,
        [trackId]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        'History POST error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

/* =========================================================
   PLAYLISTS
========================================================= */

app.get(
  '/api/playlists',
  auth,
  async (req, res) => {
    try {
      const playlists =
        await pool.query(
          `
          SELECT
            id,
            name,
            is_public AS public,
            created_at
          FROM playlists
          WHERE user_id = $1
          ORDER BY
            created_at DESC
          `,
          [req.user.id]
        );

      const output = [];

      for (
        const playlist
        of playlists.rows
      ) {
        const tracks =
          await pool.query(
            `
            ${TRACK_SELECT}

            JOIN playlist_tracks pt
              ON pt.track_id = t.id

            WHERE pt.playlist_id = $1

            ORDER BY
              pt.position ASC,
              pt.track_id ASC
            `,
            [playlist.id]
          );

        output.push({
          ...playlist,
          tracks:
            tracks.rows.map(
              normalizeTrack
            ),
        });
      }

      res.json(output);
    } catch (error) {
      console.error(
        'Playlists GET error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

app.post(
  '/api/playlists',
  auth,
  async (req, res) => {
    try {
      const name =
        cleanString(
          req.body?.name,
          255
        );

      const isPublic =
        Boolean(
          req.body?.public ??
          req.body?.is_public
        );

      if (!name) {
        return res
          .status(400)
          .json({
            error:
              'Введите название плейлиста',
          });
      }

      const result =
        await pool.query(
          `
          INSERT INTO playlists (
            user_id,
            name,
            is_public
          )
          VALUES ($1, $2, $3)

          RETURNING
            id,
            name,
            is_public AS public,
            created_at
          `,
          [
            req.user.id,
            name,
            isPublic,
          ]
        );

      res
        .status(201)
        .json({
          ...result.rows[0],
          tracks: [],
        });
    } catch (error) {
      console.error(
        'Playlist create error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

app.delete(
  '/api/playlists/:id',
  auth,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const id =
        Number(
          req.params.id
        );

      await client.query(
        `
        DELETE FROM playlist_tracks
        WHERE playlist_id = $1
          AND EXISTS (
            SELECT 1
            FROM playlists
            WHERE id = $1
              AND user_id = $2
          )
        `,
        [
          id,
          req.user.id,
        ]
      );

      const result =
        await client.query(
          `
          DELETE FROM playlists
          WHERE id = $1
            AND user_id = $2
          RETURNING id
          `,
          [
            id,
            req.user.id,
          ]
        );

      await client.query(
        'COMMIT'
      );

      if (
        !result.rows[0]
      ) {
        return res
          .status(404)
          .json({
            error:
              'Плейлист не найден',
          });
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      await client
        .query(
          'ROLLBACK'
        )
        .catch(() => {});

      console.error(
        'Playlist delete error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    } finally {
      client.release();
    }
  }
);

app.post(
  '/api/playlists/:id/tracks',
  auth,
  async (req, res) => {
    try {
      const playlistId =
        Number(
          req.params.id
        );

      const trackId =
        Number(
          req.body?.track_id ||
          req.body?.trackId
        );

      if (
        !Number.isInteger(
          playlistId
        ) ||
        !Number.isInteger(
          trackId
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'Неверный ID',
          });
      }

      const owner =
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

      if (
        !owner.rows[0]
      ) {
        return res
          .status(404)
          .json({
            error:
              'Плейлист не найден',
          });
      }

      const pos =
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
          playlistId,
          trackId,
          Number(
            pos.rows[0]
              .position
          ),
        ]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        'Playlist track add error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

app.delete(
  '/api/playlists/:id/tracks/:trackId',
  auth,
  async (req, res) => {
    try {
      const playlistId =
        Number(
          req.params.id
        );

      const trackId =
        Number(
          req.params.trackId
        );

      const result =
        await pool.query(
          `
          DELETE FROM playlist_tracks pt

          USING playlists p

          WHERE pt.playlist_id = p.id
            AND p.id = $1
            AND p.user_id = $2
            AND pt.track_id = $3

          RETURNING
            pt.track_id
          `,
          [
            playlistId,
            req.user.id,
            trackId,
          ]
        );

      if (
        !result.rows[0]
      ) {
        return res
          .status(404)
          .json({
            error:
              'Трек не найден в плейлисте',
          });
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        'Playlist track delete error:',
        error
      );

      res
        .status(500)
        .json({
          error:
            'Server error',
        });
    }
  }
);

/* =========================================================
   TELEGRAM API
========================================================= */

async function telegramApi(
  method,
  payload = {}
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
          JSON.stringify(
            payload
          ),
      }
    );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.description ||
      `Telegram API error ${response.status}`
    );
  }

  return data.result;
}

/* =========================================================
   TELEGRAM IMPORT
========================================================= */

async function processTelegramUpdate(
  update
) {
  const msg =
    update?.message;

  if (!msg) {
    return;
  }

  if (
    msg.from?.is_bot
  ) {
    return;
  }

  const audio =
    msg.audio ||
    (
      msg.document &&
      String(
        msg.document
          .mime_type || ''
      ).startsWith(
        'audio/'
      )
        ? msg.document
        : null
    );

  if (!audio) {
    return;
  }

  try {
    const title =
      cleanString(
        audio.title ||
        String(
          audio.file_name || ''
        ).replace(
          /\.[^.]+$/,
          ''
        ) ||
        'Без названия',
        255
      );

    const artist =
      cleanString(
        audio.performer ||
        String(
          msg.caption || ''
        ).split('\n')[0] ||
        'Неизвестный исполнитель',
        255
      );

    const duration =
      Math.max(
        0,
        Number(
          audio.duration || 0
        )
      );

    const fileId =
      audio.file_id;

    const genre =
      'Music';

    let artistId;

    const artistResult =
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

    if (
      artistResult.rows[0]
    ) {
      artistId =
        artistResult
          .rows[0].id;
    } else {
      artistId =
        (
          await pool.query(
            `
            INSERT INTO artists (
              name
            )
            VALUES ($1)
            RETURNING id
            `,
            [artist]
          )
        ).rows[0].id;
    }

    const insert =
      await pool.query(
        `
        INSERT INTO tracks (
          title,
          artist_id,
          duration,
          audio_url,
          genre,
          telegram_file_id
        )

        VALUES (
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
          '',
          genre,
          fileId,
        ]
      );

    const trackId =
      insert.rows[0].id;

    const audioUrl =
      `${apiBase()}/api/tracks/${trackId}/audio`;

    await pool.query(
      `
      UPDATE tracks

      SET
        audio_url = $1,
        updated_at = NOW()

      WHERE id = $2
      `,
      [
        audioUrl,
        trackId,
      ]
    );

    let channelMessageId =
      null;

    if (CHANNEL_ID) {
      const sent =
        await telegramApi(
          'sendAudio',
          {
            chat_id:
              CHANNEL_ID,

            audio:
              fileId,

            caption:
              `🎵 ${title}\n👤 ${artist}\n🆔 ID: ${trackId}`,
          }
        );

      channelMessageId =
        sent?.message_id ||
        null;

      if (
        channelMessageId
      ) {
        await pool.query(
          `
          UPDATE tracks

          SET
            telegram_channel_id = $1,
            telegram_message_id = $2,
            updated_at = NOW()

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
    }

    await telegramApi(
      'sendMessage',
      {
        chat_id:
          msg.chat.id,

        text:
          `✅ Трек добавлен!\n\n` +
          `🎵 ${title}\n` +
          `👤 ${artist}\n` +
          `🆔 ID: ${trackId}\n` +
          (
            CHANNEL_ID
              ? '📢 Опубликован в канале и появился на сайте.'
              : '🌐 Появился на сайте.'
          ),
      }
    );
  } catch (error) {
    console.error(
      'Telegram import error:',
      error
    );

    await telegramApi(
      'sendMessage',
      {
        chat_id:
          msg.chat.id,

        text:
          `❌ Не удалось добавить трек:\n${error.message}`,
      }
    ).catch(
      () => {}
    );
  }
}

/* =========================================================
   TELEGRAM POLLING
========================================================= */

async function botLoop() {
  if (
    !BOT_TOKEN ||
    telegramLoopRunning
  ) {
    return;
  }

  telegramLoopRunning =
    true;

  while (
    telegramLoopRunning
  ) {
    try {
      const updates =
        await telegramApi(
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
        const update
        of updates || []
      ) {
        telegramOffset =
          Number(
            update.update_id
          ) + 1;

        await processTelegramUpdate(
          update
        );
      }
    } catch (error) {
      console.error(
        'Telegram polling:',
        error.message
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            3000
          )
      );
    }
  }
}

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res
      .status(404)
      .json({
        error:
          'Route not found',

        method:
          req.method,

        path:
          req.path,
      });
  }
);

/* =========================================================
   EXPRESS ERROR
========================================================= */

app.use(
  (
    error,
    _req,
    res,
    _next
  ) => {
    console.error(
      'Unhandled Express error:',
      error
    );

    if (
      res.headersSent
    ) {
      return;
    }

    res
      .status(500)
      .json({
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

    server =
      app.listen(
        PORT,
        '0.0.0.0',
        () => {
          console.log(
            '========================================'
          );

          console.log(
            '🔥 FENIX MUSIC BACKEND ONLINE'
          );

          console.log(
            `🌐 Port: ${PORT}`
          );

          console.log(
            `🏠 Root: ${apiBase()}/`
          );

          console.log(
            `❤️ Health: ${apiBase()}/api/health`
          );

          console.log(
            `🎵 Tracks: ${apiBase()}/api/tracks`
          );

          console.log(
            `🤖 Telegram: ${
              BOT_TOKEN
                ? 'configured'
                : 'not configured'
            }`
          );

          console.log(
            '========================================'
          );
        }
      );

    if (BOT_TOKEN) {
      console.log(
        '🤖 Telegram bot polling enabled'
      );

      botLoop().catch(
        error =>
          console.error(
            'Telegram loop fatal:',
            error
          )
      );
    } else {
      console.log(
        'ℹ️ TELEGRAM_BOT_TOKEN not set; Telegram import disabled'
      );
    }
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

    await pool
      .end()
      .catch(() => {});

    process.exit(1);
  }
}

/* =========================================================
   SHUTDOWN
========================================================= */

async function shutdown(
  signal
) {
  console.log(
    `\n${signal} received. Shutting down...`
  );

  telegramLoopRunning =
    false;

  if (server) {
    await new Promise(
      resolve =>
        server.close(
          resolve
        )
    );
  }

  await pool
    .end()
    .catch(() => {});

  process.exit(0);
}

process.on(
  'SIGTERM',
  () =>
    shutdown('SIGTERM')
);

process.on(
  'SIGINT',
  () =>
    shutdown('SIGINT')
);

process.on(
  'unhandledRejection',
  error => {
    console.error(
      'Unhandled rejection:',
      error
    );
  }
);

process.on(
  'uncaughtException',
  error => {
    console.error(
      'Uncaught exception:',
      error
    );
  }
);

start();
