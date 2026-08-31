"use strict";

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const crypto = require("crypto");

/*
=========================================================
 FENIX MUSIC BACKEND 2.0.0
 Node.js + Express + PostgreSQL
=========================================================
*/

const app = express();

const PORT = Number(process.env.PORT || 10000);

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRESQL_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not configured");
  process.exit(1);
}

/*
=========================================================
 DATABASE
=========================================================
*/

const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,

  max: 10,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

/*
=========================================================
 MIDDLEWARE
=========================================================
*/

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  next();
});

/*
=========================================================
 HELPERS
=========================================================
*/

function now() {
  return new Date();
}

function randomToken(size = 48) {
  return crypto
    .randomBytes(size)
    .toString("hex");
}

function randomCaptcha(length = 6) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result +=
      chars[
        Math.floor(
          Math.random() * chars.length
        )
      ];
  }

  return result;
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 50);
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 255);
}

function safeString(value, max = 1000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function getBearerToken(req) {
  const authorization =
    req.headers.authorization || "";

  if (
    authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return authorization.slice(7).trim();
  }

  if (req.headers["x-session-token"]) {
    return String(
      req.headers["x-session-token"]
    );
  }

  if (req.cookies?.fenix_token) {
    return req.cookies.fenix_token;
  }

  return null;
}

function userResponse(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio || "",
    avatar_url:
      user.avatar_url || null,
    created_at: user.created_at,
  };
}

function normalizeTrack(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,

    title:
      row.title ||
      "Без названия",

    artist_name:
      row.artist_name ||
      "Неизвестный артист",

    album_name:
      row.album_name ||
      "",

    genre:
      row.genre ||
      "",

    year:
      row.year ||
      null,

    duration:
      Number(row.duration || 0),

    plays:
      Number(
        row.plays ??
          row.plays_count ??
          0
      ),

    plays_count:
      Number(
        row.plays_count ??
          row.plays ??
          0
      ),

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

    telegram_file_id:
      row.telegram_file_id ||
      null,

    created_at:
      row.created_at ||
      null,
  };
}

/*
=========================================================
 PASSWORD HASH
 Native Node.js crypto.
 No bcrypt package required.
=========================================================
*/

function hashPassword(password) {
  return new Promise(
    (resolve, reject) => {
      const salt =
        crypto.randomBytes(16).toString(
          "hex"
        );

      crypto.scrypt(
        String(password),
        salt,
        64,
        {
          N: 16384,
          r: 8,
          p: 1,
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(
            `scrypt:${salt}:${derivedKey.toString(
              "hex"
            )}`
          );
        }
      );
    }
  );
}

function verifyPassword(
  password,
  stored
) {
  return new Promise(
    (resolve, reject) => {
      try {
        if (
          !stored ||
          !String(stored).startsWith(
            "scrypt:"
          )
        ) {
          resolve(false);
          return;
        }

        const parts =
          String(stored).split(":");

        if (parts.length !== 3) {
          resolve(false);
          return;
        }

        const salt = parts[1];
        const originalHash =
          parts[2];

        crypto.scrypt(
          String(password),
          salt,
          64,
          {
            N: 16384,
            r: 8,
            p: 1,
          },
          (error, derivedKey) => {
            if (error) {
              reject(error);
              return;
            }

            const calculated =
              derivedKey.toString(
                "hex"
              );

            try {
              const a =
                Buffer.from(
                  originalHash,
                  "hex"
                );

              const b =
                Buffer.from(
                  calculated,
                  "hex"
                );

              if (
                a.length !== b.length
              ) {
                resolve(false);
                return;
              }

              resolve(
                crypto.timingSafeEqual(
                  a,
                  b
                )
              );
            } catch {
              resolve(false);
            }
          }
        );
      } catch {
        resolve(false);
      }
    }
  );
}

/*
=========================================================
 DATABASE INITIALIZATION
=========================================================
*/

async function initDatabase() {
  console.log(
    "Connecting to PostgreSQL..."
  );

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    /*
    -----------------------------------------------------
    USERS
    -----------------------------------------------------
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        bio TEXT DEFAULT '',
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    /*
    Existing databases can have missing columns.
    */

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS
      username VARCHAR(50)
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS
      email VARCHAR(255)
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS
      password_hash TEXT
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS
      bio TEXT DEFAULT ''
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS
      avatar_url TEXT
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS
      created_at TIMESTAMPTZ DEFAULT NOW()
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `);

    /*
    -----------------------------------------------------
    TRACKS
    -----------------------------------------------------
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id BIGSERIAL PRIMARY KEY,

        title VARCHAR(255) NOT NULL,

        artist_name VARCHAR(255)
          DEFAULT 'Неизвестный артист',

        album_name VARCHAR(255)
          DEFAULT '',

        genre VARCHAR(100)
          DEFAULT '',

        year INTEGER,

        duration DOUBLE PRECISION
          DEFAULT 0,

        plays_count BIGINT
          DEFAULT 0,

        cover_url TEXT,

        album_cover_url TEXT,

        artist_avatar TEXT,

        audio_url TEXT,

        telegram_file_id TEXT,

        created_at TIMESTAMPTZ
          DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      title VARCHAR(255)
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      artist_name VARCHAR(255)
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      album_name VARCHAR(255)
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      genre VARCHAR(100)
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      year INTEGER
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      duration DOUBLE PRECISION
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      plays_count BIGINT DEFAULT 0
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      cover_url TEXT
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      album_cover_url TEXT
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      artist_avatar TEXT
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      audio_url TEXT
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      telegram_file_id TEXT
    `);

    await client.query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS
      created_at TIMESTAMPTZ
        DEFAULT NOW()
    `);

    /*
    -----------------------------------------------------
    SESSIONS
    -----------------------------------------------------

    Your previous error was:

    user_id UUID
    users.id BIGINT

    We recreate sessions using BIGINT.
    -----------------------------------------------------
    */

    await client.query(`
      DROP TABLE IF EXISTS sessions
    `);

    await client.query(`
      CREATE TABLE sessions (
        id BIGSERIAL PRIMARY KEY,

        user_id BIGINT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        token TEXT NOT NULL UNIQUE,

        created_at TIMESTAMPTZ
          DEFAULT NOW(),

        expires_at TIMESTAMPTZ
          NOT NULL
      )
    `);

    /*
    -----------------------------------------------------
    FAVORITES
    -----------------------------------------------------
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id BIGSERIAL PRIMARY KEY,

        user_id BIGINT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        track_id BIGINT NOT NULL
          REFERENCES tracks(id)
          ON DELETE CASCADE,

        created_at TIMESTAMPTZ
          DEFAULT NOW(),

        UNIQUE(user_id, track_id)
      )
    `);

    /*
    -----------------------------------------------------
    HISTORY
    -----------------------------------------------------
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS listening_history (
        id BIGSERIAL PRIMARY KEY,

        user_id BIGINT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        track_id BIGINT NOT NULL
          REFERENCES tracks(id)
          ON DELETE CASCADE,

        played_at TIMESTAMPTZ
          DEFAULT NOW()
      )
    `);

    /*
    -----------------------------------------------------
    PLAYLISTS
    -----------------------------------------------------
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id BIGSERIAL PRIMARY KEY,

        user_id BIGINT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        name VARCHAR(255) NOT NULL,

        public BOOLEAN
          DEFAULT FALSE,

        created_at TIMESTAMPTZ
          DEFAULT NOW()
      )
    `);

    /*
    -----------------------------------------------------
    PLAYLIST TRACKS
    -----------------------------------------------------
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id BIGSERIAL PRIMARY KEY,

        playlist_id BIGINT NOT NULL
          REFERENCES playlists(id)
          ON DELETE CASCADE,

        track_id BIGINT NOT NULL
          REFERENCES tracks(id)
          ON DELETE CASCADE,

        position INTEGER
          DEFAULT 0,

        UNIQUE(playlist_id, track_id)
      )
    `);

    /*
    -----------------------------------------------------
    NOTIFICATIONS
    -----------------------------------------------------
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGSERIAL PRIMARY KEY,

        user_id BIGINT
          REFERENCES users(id)
          ON DELETE CASCADE,

        title VARCHAR(255),

        text TEXT,

        is_read BOOLEAN
          DEFAULT FALSE,

        created_at TIMESTAMPTZ
          DEFAULT NOW()
      )
    `);

    /*
    -----------------------------------------------------
    CAPTCHA
    -----------------------------------------------------
    */

    await client.query(`
      CREATE TABLE IF NOT EXISTS captchas (
        id BIGSERIAL PRIMARY KEY,

        code VARCHAR(20) NOT NULL,

        created_at TIMESTAMPTZ
          DEFAULT NOW(),

        expires_at TIMESTAMPTZ
          NOT NULL
      )
    `);

    /*
    -----------------------------------------------------
    INDEXES
    -----------------------------------------------------
    */

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_tracks_created
      ON tracks(created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_tracks_plays
      ON tracks(plays_count DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_history_user
      ON listening_history(user_id, played_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_favorites_user
      ON favorites(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS
      idx_sessions_token
      ON sessions(token)
    `);

    await client.query("COMMIT");

    console.log(
      "✅ PostgreSQL database initialized"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/*
=========================================================
 ROOT
=========================================================
*/

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

/*
=========================================================
 API ROOT
=========================================================
*/

app.get("/api", (req, res) => {
  res.json({
    ok: true,

    service:
      "Fenix Music Backend",

    version: "2.0.0",

    status: "online",

    endpoints: {
      root: "/",
      health: "/api/health",

      tracks: "/api/tracks",
      track:
        "/api/tracks/:id",
      audio:
        "/api/tracks/:id/audio",

      captcha:
        "/api/auth/captcha",

      register:
        "/api/auth/register",

      login:
        "/api/auth/login",

      me:
        "/api/auth/me",

      favorites:
        "/api/favorites",

      history:
        "/api/history",

      playlists:
        "/api/playlists",

      notifications:
        "/api/notifications",
    },
  });
});

/*
=========================================================
 HEALTH
=========================================================
*/

app.get(
  "/api/health",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          "SELECT NOW() AS time"
        );

      res.json({
        ok: true,
        status: "healthy",
        database: "connected",
        time: result.rows[0].time,
      });
    } catch (error) {
      res.status(503).json({
        ok: false,
        status: "unhealthy",
        database: "disconnected",
        error:
          error.message,
      });
    }
  }
);

/*
=========================================================
 TRACKS
 GET /api/tracks
=========================================================
*/

app.get(
  "/api/tracks",
  async (req, res) => {
    try {
      const search =
        safeString(
          req.query.search,
          255
        );

      const genre =
        safeString(
          req.query.genre,
          100
        );

      const limit = Math.min(
        Math.max(
          Number(req.query.limit) ||
            100,
          1
        ),
        500
      );

      const offset = Math.max(
        Number(req.query.offset) || 0,
        0
      );

      const params = [];

      const conditions = [];

      if (search) {
        params.push(
          `%${search}%`
        );

        conditions.push(`
          (
            title ILIKE $${params.length}
            OR artist_name ILIKE $${params.length}
            OR album_name ILIKE $${params.length}
            OR genre ILIKE $${params.length}
          )
        `);
      }

      if (genre) {
        params.push(genre);

        conditions.push(
          `genre = $${params.length}`
        );
      }

      const where =
        conditions.length
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";

      params.push(limit);

      const limitIndex =
        params.length;

      params.push(offset);

      const offsetIndex =
        params.length;

      const query = `
        SELECT
          id,
          title,
          artist_name,
          album_name,
          genre,
          year,
          duration,
          plays_count,
          cover_url,
          album_cover_url,
          artist_avatar,
          audio_url,
          telegram_file_id,
          created_at
        FROM tracks

        ${where}

        ORDER BY created_at DESC, id DESC

        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `;

      const result =
        await pool.query(
          query,
          params
        );

      res.json({
        ok: true,

        tracks:
          result.rows.map(
            normalizeTrack
          ),

        items:
          result.rows.map(
            normalizeTrack
          ),

        total:
          result.rows.length,
      });
    } catch (error) {
      console.error(
        "GET /api/tracks:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить треки.",
      });
    }
  }
);

/*
=========================================================
 GET SINGLE TRACK
=========================================================
*/

app.get(
  "/api/tracks/:id",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          ok: false,
          error: "Неверный ID трека.",
        });
      }

      const result =
        await pool.query(
          `
          SELECT *
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
        track: normalizeTrack(
          result.rows[0]
        ),
      });
    } catch (error) {
      console.error(
        "GET /api/tracks/:id:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Ошибка получения трека.",
      });
    }
  }
);

/*
=========================================================
 AUDIO
 GET /api/tracks/:id/audio
=========================================================
*/

app.get(
  "/api/tracks/:id/audio",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          ok: false,
          error: "Неверный ID трека.",
        });
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            audio_url
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

      const audioUrl =
        result.rows[0].audio_url;

      if (!audioUrl) {
        return res.status(404).json({
          ok: false,
          error:
            "У этого трека отсутствует audio_url.",
        });
      }

      /*
      Redirect browser <audio> to the
      actual audio file.
      */

      res.redirect(
        302,
        audioUrl
      );
    } catch (error) {
      console.error(
        "GET /api/tracks/:id/audio:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить аудио.",
      });
    }
  }
);

/*
=========================================================
 TRACK PLAY
 POST /api/tracks/:id/play
=========================================================
*/

app.post(
  "/api/tracks/:id/play",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          ok: false,
          error: "Неверный ID.",
        });
      }

      await pool.query(
        `
        UPDATE tracks
        SET plays_count =
          COALESCE(plays_count, 0) + 1
        WHERE id = $1
        `,
        [id]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "POST play:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось обновить статистику.",
      });
    }
  }
);

/*
=========================================================
 CAPTCHA
 GET /api/auth/captcha
=========================================================
*/

app.get(
  "/api/auth/captcha",
  async (req, res) => {
    try {
      const code =
        randomCaptcha(6);

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

        id:
          result.rows[0].id,

        captcha_id:
          result.rows[0].id,

        text:
          result.rows[0].code,

        code:
          result.rows[0].code,

        expires_at:
          result.rows[0].expires_at,
      });
    } catch (error) {
      console.error(
        "CAPTCHA:",
        error
      );

      /*
      Fallback still lets frontend work
      if captcha table has an issue.
      */

      const code =
        randomCaptcha(6);

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

/*
=========================================================
 REGISTER
 POST /api/auth/register
=========================================================
*/

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
        safeString(
          req.body.captcha,
          20
        ).toUpperCase();

      const captchaId =
        req.body.captcha_id
          ? Number(
              req.body.captcha_id
            )
          : null;

      if (
        username.length < 3
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Username должен содержать минимум 3 символа.",
        });
      }

      if (
        !email ||
        !email.includes("@")
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Укажи корректный email.",
        });
      }

      if (
        password.length < 6
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Пароль должен содержать минимум 6 символов.",
        });
      }

      /*
      CAPTCHA.
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
          return res.status(400).json({
            ok: false,
            error:
              "CAPTCHA истекла. Получи новую.",
          });
        }

        if (
          String(
            captchaResult.rows[0].code
          ).toUpperCase() !==
          captcha
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "Неверная CAPTCHA.",
          });
        }

        await pool.query(
          `
          DELETE FROM captchas
          WHERE id = $1
          `,
          [captchaId]
        );
      }

      /*
      Existing account.
      */

      const existing =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE LOWER(username) =
                LOWER($1)
             OR LOWER(email) =
                LOWER($2)
          LIMIT 1
          `,
          [
            username,
            email,
          ]
        );

      if (existing.rows.length) {
        return res.status(409).json({
          ok: false,
          error:
            "Username или email уже используется.",
        });
      }

      const passwordHash =
        await hashPassword(
          password
        );

      const result =
        await pool.query(
          `
          INSERT INTO users
            (
              username,
              email,
              password_hash,
              bio
            )
          VALUES
            ($1, $2, $3, '')
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
            passwordHash,
          ]
        );

      const user =
        result.rows[0];

      const token =
        randomToken(48);

      await pool.query(
        `
        INSERT INTO sessions
          (
            user_id,
            token,
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
          user.id,
          token,
        ]
      );

      res.status(201).json({
        ok: true,

        token,

        access_token:
          token,

        session_token:
          token,

        user:
          userResponse(user),

        account:
          userResponse(user),
      });
    } catch (error) {
      console.error(
        "REGISTER:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Ошибка регистрации.",
      });
    }
  }
);

/*
=========================================================
 LOGIN
 POST /api/auth/login
=========================================================
*/

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const login =
        safeString(
          req.body.login ||
            req.body.email ||
            req.body.username,
          255
        );

      const password =
        String(
          req.body.password || ""
        );

      if (!login || !password) {
        return res.status(400).json({
          ok: false,
          error:
            "Заполни данные для входа.",
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
          WHERE
            LOWER(email) =
              LOWER($1)
            OR
            LOWER(username) =
              LOWER($1)
          LIMIT 1
          `,
          [login]
        );

      if (!result.rows.length) {
        return res.status(401).json({
          ok: false,
          error:
            "Неверный логин или пароль.",
        });
      }

      const user =
        result.rows[0];

      const valid =
        await verifyPassword(
          password,
          user.password_hash
        );

      if (!valid) {
        return res.status(401).json({
          ok: false,
          error:
            "Неверный логин или пароль.",
        });
      }

      const token =
        randomToken(48);

      await pool.query(
        `
        INSERT INTO sessions
          (
            user_id,
            token,
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
          user.id,
          token,
        ]
      );

      res.json({
        ok: true,

        token,

        access_token:
          token,

        session_token:
          token,

        user:
          userResponse(user),

        account:
          userResponse(user),
      });
    } catch (error) {
      console.error(
        "LOGIN:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Ошибка авторизации.",
      });
    }
  }
);

/*
=========================================================
 AUTH MIDDLEWARE
=========================================================
*/

async function authRequired(
  req,
  res,
  next
) {
  try {
    const token =
      getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        error:
          "Требуется авторизация.",
      });
    }

    const result =
      await pool.query(
        `
        SELECT
          s.user_id,

          u.id,
          u.username,
          u.email,
          u.bio,
          u.avatar_url,
          u.created_at

        FROM sessions s

        JOIN users u
          ON u.id = s.user_id

        WHERE s.token = $1
          AND s.expires_at > NOW()

        LIMIT 1
        `,
        [token]
      );

    if (!result.rows.length) {
      return res.status(401).json({
        ok: false,
        error:
          "Сессия истекла или недействительна.",
      });
    }

    req.user =
      result.rows[0];

    req.sessionToken =
      token;

    next();
  } catch (error) {
    console.error(
      "AUTH:",
      error
    );

    res.status(500).json({
      ok: false,
      error:
        "Ошибка проверки авторизации.",
    });
  }
}

/*
=========================================================
 GET ME
=========================================================
*/

app.get(
  "/api/auth/me",
  authRequired,
  async (req, res) => {
    res.json({
      ok: true,

      user:
        userResponse(
          req.user
        ),
    });
  }
);

/*
=========================================================
 LOGOUT
=========================================================
*/

app.post(
  "/api/auth/logout",
  authRequired,
  async (req, res) => {
    try {
      await pool.query(
        `
        DELETE FROM sessions
        WHERE token = $1
        `,
        [req.sessionToken]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Ошибка выхода.",
      });
    }
  }
);

/*
=========================================================
 FAVORITES
=========================================================
*/

app.get(
  "/api/favorites",
  authRequired,
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

      res.json({
        ok: true,

        favorites:
          result.rows.map(
            normalizeTrack
          ),

        tracks:
          result.rows.map(
            normalizeTrack
          ),
      });
    } catch (error) {
      console.error(
        "GET favorites:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить избранное.",
      });
    }
  }
);

app.post(
  "/api/favorites/:trackId",
  authRequired,
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
        return res.status(400).json({
          ok: false,
          error:
            "Неверный ID трека.",
        });
      }

      const existing =
        await pool.query(
          `
          SELECT id
          FROM favorites
          WHERE user_id = $1
            AND track_id = $2
          LIMIT 1
          `,
          [
            req.user.id,
            trackId,
          ]
        );

      if (existing.rows.length) {
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

        return res.json({
          ok: true,
          favorite: false,
        });
      }

      await pool.query(
        `
        INSERT INTO favorites
          (user_id, track_id)
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
      });
    } catch (error) {
      console.error(
        "POST favorite:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось изменить избранное.",
      });
    }
  }
);

/*
=========================================================
 HISTORY
=========================================================
*/

app.get(
  "/api/history",
  authRequired,
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
            ...normalizeTrack(row),
            played_at:
              row.played_at,
          })
        );

      res.json({
        ok: true,
        history,
      });
    } catch (error) {
      console.error(
        "GET history:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить историю.",
      });
    }
  }
);

app.post(
  "/api/history/:trackId",
  authRequired,
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
        return res.status(400).json({
          ok: false,
          error:
            "Неверный ID трека.",
        });
      }

      await pool.query(
        `
        INSERT INTO listening_history
          (
            user_id,
            track_id
          )
        VALUES
          (
            $1,
            $2
          )
        `,
        [
          req.user.id,
          trackId,
        ]
      );

      await pool.query(
        `
        UPDATE tracks
        SET plays_count =
          COALESCE(plays_count, 0) + 1
        WHERE id = $1
        `,
        [trackId]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "POST history:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить историю.",
      });
    }
  }
);

/*
=========================================================
 PLAYLISTS
=========================================================
*/

app.get(
  "/api/playlists",
  authRequired,
  async (req, res) => {
    try {
      const playlists =
        await pool.query(
          `
          SELECT
            p.id,
            p.name,
            p.public,
            p.created_at,

            COUNT(pt.id)::INTEGER
              AS track_count

          FROM playlists p

          LEFT JOIN playlist_tracks pt
            ON pt.playlist_id = p.id

          WHERE p.user_id = $1

          GROUP BY
            p.id

          ORDER BY
            p.created_at DESC
          `,
          [req.user.id]
        );

      res.json({
        ok: true,
        playlists:
          playlists.rows,
      });
    } catch (error) {
      console.error(
        "GET playlists:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить плейлисты.",
      });
    }
  }
);

app.post(
  "/api/playlists",
  authRequired,
  async (req, res) => {
    try {
      const name =
        safeString(
          req.body.name,
          255
        );

      const isPublic =
        Boolean(
          req.body.public
        );

      if (!name) {
        return res.status(400).json({
          ok: false,
          error:
            "Укажи название плейлиста.",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO playlists
            (
              user_id,
              name,
              public
            )
          VALUES
            (
              $1,
              $2,
              $3
            )
          RETURNING *
          `,
          [
            req.user.id,
            name,
            isPublic,
          ]
        );

      res.status(201).json({
        ok: true,
        playlist:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "POST playlist:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось создать плейлист.",
      });
    }
  }
);

app.delete(
  "/api/playlists/:id",
  authRequired,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      const result =
        await pool.query(
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

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          error:
            "Плейлист не найден.",
        });
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "DELETE playlist:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось удалить плейлист.",
      });
    }
  }
);

/*
=========================================================
 ADD TRACK TO PLAYLIST
=========================================================
*/

app.post(
  "/api/playlists/:id/tracks/:trackId",
  authRequired,
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

      const ownership =
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
        !ownership.rows.length
      ) {
        return res.status(404).json({
          ok: false,
          error:
            "Плейлист не найден.",
        });
      }

      await pool.query(
        `
        INSERT INTO playlist_tracks
          (
            playlist_id,
            track_id
          )
        VALUES
          (
            $1,
            $2
          )
        ON CONFLICT
          (playlist_id, track_id)
        DO NOTHING
        `,
        [
          playlistId,
          trackId,
        ]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "ADD playlist track:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось добавить трек.",
      });
    }
  }
);

/*
=========================================================
 PROFILE
=========================================================
*/

app.get(
  "/api/profile",
  authRequired,
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
          userResponse(
            result.rows[0]
          ),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить профиль.",
      });
    }
  }
);

app.put(
  "/api/profile",
  authRequired,
  async (req, res) => {
    try {
      const username =
        normalizeUsername(
          req.body.username
        );

      const bio =
        safeString(
          req.body.bio,
          2000
        );

      const avatarUrl =
        safeString(
          req.body.avatar_url,
          2000
        ) || null;

      if (
        username.length < 3
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Username слишком короткий.",
        });
      }

      const duplicate =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE LOWER(username) =
                LOWER($1)
            AND id <> $2
          LIMIT 1
          `,
          [
            username,
            req.user.id,
          ]
        );

      if (duplicate.rows.length) {
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
            avatar_url = $3,
            updated_at = NOW()
          WHERE id = $4

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
            avatarUrl,
            req.user.id,
          ]
        );

      res.json({
        ok: true,
        user:
          userResponse(
            result.rows[0]
          ),
      });
    } catch (error) {
      console.error(
        "PUT profile:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось сохранить профиль.",
      });
    }
  }
);

/*
=========================================================
 NOTIFICATIONS
=========================================================
*/

app.get(
  "/api/notifications",
  authRequired,
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

      res.json({
        ok: true,

        notifications:
          result.rows,
      });
    } catch (error) {
      console.error(
        "GET notifications:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось получить уведомления.",
      });
    }
  }
);

app.delete(
  "/api/notifications",
  authRequired,
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
      res.status(500).json({
        ok: false,
        error:
          "Не удалось очистить уведомления.",
      });
    }
  }
);

/*
=========================================================
 ADMIN/IMPORT TRACK
=========================================================

Можно использовать позже для добавления музыки.
Защиты администратора здесь намеренно нет:
не публикуй этот endpoint наружу без своей
админской авторизации.
=========================================================
*/

app.post(
  "/api/tracks",
  async (req, res) => {
    try {
      const title =
        safeString(
          req.body.title,
          255
        );

      if (!title) {
        return res.status(400).json({
          ok: false,
          error:
            "Название трека обязательно.",
        });
      }

      const artistName =
        safeString(
          req.body.artist_name,
          255
        ) ||
        "Неизвестный артист";

      const albumName =
        safeString(
          req.body.album_name,
          255
        );

      const genre =
        safeString(
          req.body.genre,
          100
        );

      const year =
        req.body.year
          ? Number(
              req.body.year
            )
          : null;

      const duration =
        Number(
          req.body.duration || 0
        );

      const coverUrl =
        safeString(
          req.body.cover_url,
          4000
        ) || null;

      const albumCoverUrl =
        safeString(
          req.body.album_cover_url,
          4000
        ) || null;

      const artistAvatar =
        safeString(
          req.body.artist_avatar,
          4000
        ) || null;

      const audioUrl =
        safeString(
          req.body.audio_url,
          4000
        ) || null;

      const telegramFileId =
        safeString(
          req.body.telegram_file_id,
          1000
        ) || null;

      const result =
        await pool.query(
          `
          INSERT INTO tracks
            (
              title,
              artist_name,
              album_name,
              genre,
              year,
              duration,
              plays_count,
              cover_url,
              album_cover_url,
              artist_avatar,
              audio_url,
              telegram_file_id
            )
          VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              0,
              $7,
              $8,
              $9,
              $10,
              $11
            )
          RETURNING *
          `,
          [
            title,
            artistName,
            albumName,
            genre,
            year,
            duration,
            coverUrl,
            albumCoverUrl,
            artistAvatar,
            audioUrl,
            telegramFileId,
          ]
        );

      res.status(201).json({
        ok: true,

        track:
          normalizeTrack(
            result.rows[0]
          ),
      });
    } catch (error) {
      console.error(
        "POST /api/tracks:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Не удалось создать трек.",
      });
    }
  }
);

/*
=========================================================
 404
=========================================================
*/

app.use(
  (req, res) => {
    res.status(404).json({
      ok: false,

      error: "Not Found",

      path: req.originalUrl,

      method: req.method,

      service:
        "Fenix Music Backend",

      api: "/api",
    });
  }
);

/*
=========================================================
 ERROR HANDLER
=========================================================
*/

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
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
        "Внутренняя ошибка сервера.",
    });
  }
);

/*
=========================================================
 START
=========================================================
*/

async function start() {
  try {
    await initDatabase();

    /*
    Clean expired sessions/captchas
    */

    setInterval(
      async () => {
        try {
          await pool.query(`
            DELETE FROM sessions
            WHERE expires_at < NOW()
          `);

          await pool.query(`
            DELETE FROM captchas
            WHERE expires_at < NOW()
          `);
        } catch (error) {
          console.error(
            "Cleanup error:",
            error.message
          );
        }
      },
      60 * 60 * 1000
    );

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
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
          `✅ Server listening on port ${PORT}`
        );
        console.log(
          "✅ PostgreSQL connected"
        );
        console.log(
          "✅ API: /api"
        );
        console.log(
          "✅ Health: /api/health"
        );
        console.log(
          "✅ Tracks: /api/tracks"
        );
        console.log(
          "✅ Audio: /api/tracks/:id/audio"
        );
        console.log(
          "✅ CAPTCHA: /api/auth/captcha"
        );
        console.log(
          "✅ Register: /api/auth/register"
        );
        console.log(
          "✅ Login: /api/auth/login"
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
    console.error(
      error
    );
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
      "SIGTERM received"
    );

    await pool.end();

    process.exit(0);
  }
);

process.on(
  "SIGINT",
  async () => {
    console.log(
      "SIGINT received"
    );

    await pool.end();

    process.exit(0);
  }
);

start();
