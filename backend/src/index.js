```js
// src/index.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 3000);

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "fenix-music-change-this-secret";

const DATABASE_URL =
  process.env.DATABASE_URL || "";

const FRONTEND_DIR =
  process.env.FRONTEND_DIR ||
  path.join(__dirname, "..", "frontend", "dist");

const PUBLIC_DIR =
  process.env.PUBLIC_DIR ||
  path.join(__dirname, "..", "public");

const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  path.join(PUBLIC_DIR, "uploads");

/* =========================================================
   DIRECTORIES
========================================================= */

for (const dir of [
  PUBLIC_DIR,
  UPLOADS_DIR,
]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
}

/* =========================================================
   DATABASE
========================================================= */

let pool = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,

    ssl:
      process.env.NODE_ENV === "production"
        ? {
            rejectUnauthorized: false,
          }
        : false,
  });
} else {
  console.warn(
    "DATABASE_URL не задан. Backend запущен без PostgreSQL."
  );
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "20mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb",
  })
);

/* =========================================================
   STATIC FILES
========================================================= */

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(
    "/uploads",
    express.static(UPLOADS_DIR)
  );

  app.use(
    "/public",
    express.static(PUBLIC_DIR)
  );
}

if (fs.existsSync(FRONTEND_DIR)) {
  app.use(
    express.static(FRONTEND_DIR)
  );
}

/* =========================================================
   HELPERS
========================================================= */

function randomCaptcha() {
  return crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .slice(0, 6);
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: "30d",
    }
  );
}

function normalizeUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    bio: row.bio || "",
    avatar_url: row.avatar_url || null,
    created_at: row.created_at,
  };
}

function authRequired(req, res, next) {
  try {
    const header =
      req.headers.authorization || "";

    let token = "";

    if (header.startsWith("Bearer ")) {
      token = header.slice(7);
    }

    if (!token && req.cookies?.fenix_token) {
      token = req.cookies.fenix_token;
    }

    if (!token) {
      return res.status(401).json({
        error: "Требуется авторизация.",
      });
    }

    const payload = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = payload;

    next();
  } catch {
    return res.status(401).json({
      error: "Недействительная сессия.",
    });
  }
}

/* =========================================================
   DATABASE INIT
========================================================= */

async function initDatabase() {
  if (!pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      artist_name VARCHAR(255) DEFAULT 'Unknown Artist',
      album_name VARCHAR(255) DEFAULT 'Unknown Album',
      genre VARCHAR(100) DEFAULT 'Unknown',
      duration INTEGER DEFAULT 0,
      plays BIGINT DEFAULT 0,
      cover_url TEXT,
      audio_url TEXT,
      artist_avatar TEXT,
      album_cover_url TEXT,
      year INTEGER,
      telegram_file_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlists (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id BIGINT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlist_id, track_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, track_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS listening_history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS captcha (
      id UUID PRIMARY KEY,
      code VARCHAR(20) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  console.log("PostgreSQL database ready.");
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", async (req, res) => {
  let database = "disabled";

  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = "connected";
    } catch {
      database = "error";
    }
  }

  res.json({
    ok: true,
    service: "fenix-music-backend",
    version: "2.0.0",
    database,
    time: new Date().toISOString(),
  });
});

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  const indexFile = path.join(
    FRONTEND_DIR,
    "index.html"
  );

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  return res.status(200).send(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport"
          content="width=device-width, initial-scale=1.0" />
        <title>Fenix Music</title>
      </head>

      <body
        style="
          margin:0;
          background:#090909;
          color:white;
          font-family:Arial,sans-serif;
          display:flex;
          align-items:center;
          justify-content:center;
          min-height:100vh;
        "
      >
        <div style="text-align:center">
          <h1>FENIX MUSIC</h1>
          <p>Backend работает.</p>
          <p>
            Frontend не найден в:
            <br />
            ${FRONTEND_DIR}
          </p>
        </div>
      </body>
    </html>
  `);
});

/* =========================================================
   TRACKS
========================================================= */

app.get("/api/tracks", async (req, res) => {
  if (!pool) {
    return res.json([]);
  }

  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        artist_name,
        album_name,
        genre,
        duration,
        plays,
        cover_url,
        audio_url,
        artist_avatar,
        album_cover_url,
        year,
        telegram_file_id,
        created_at
      FROM tracks
      ORDER BY created_at DESC, id DESC
    `);

    res.json(
      result.rows.map((track) => ({
        ...track,
        id: String(track.id),
        duration: Number(track.duration || 0),
        plays: Number(track.plays || 0),

        cover_url:
          track.cover_url ||
          "/public/default-cover.jpg",

        audio_url:
          track.audio_url ||
          `/api/tracks/${track.id}/audio`,
      }))
    );
  } catch (error) {
    console.error(
      "GET /api/tracks:",
      error
    );

    res.status(500).json({
      error: "Не удалось получить треки.",
    });
  }
});

/* =========================================================
   SINGLE TRACK
========================================================= */

app.get(
  "/api/tracks/:id",
  async (req, res) => {
    if (!pool) {
      return res.status(404).json({
        error: "Трек не найден.",
      });
    }

    try {
      const result = await pool.query(
        `
        SELECT *
        FROM tracks
        WHERE id = $1
        LIMIT 1
        `,
        [req.params.id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          error: "Трек не найден.",
        });
      }

      const track = result.rows[0];

      res.json({
        ...track,
        id: String(track.id),
        duration: Number(
          track.duration || 0
        ),
        plays: Number(
          track.plays || 0
        ),
        cover_url:
          track.cover_url ||
          "/public/default-cover.jpg",
        audio_url:
          track.audio_url ||
          `/api/tracks/${track.id}/audio`,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Ошибка сервера.",
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
    if (!pool) {
      return res.status(404).send(
        "Audio unavailable"
      );
    }

    try {
      const result = await pool.query(
        `
        SELECT audio_url
        FROM tracks
        WHERE id = $1
        LIMIT 1
        `,
        [req.params.id]
      );

      if (!result.rows.length) {
        return res.status(404).send(
          "Track not found"
        );
      }

      const audioUrl =
        result.rows[0].audio_url;

      if (!audioUrl) {
        return res.status(404).send(
          "Audio not found"
        );
      }

      /*
       * Если audio_url уже является URL,
       * перенаправляем браузер.
       */
      if (
        audioUrl.startsWith("http://") ||
        audioUrl.startsWith("https://")
      ) {
        return res.redirect(audioUrl);
      }

      const cleanPath =
        audioUrl.startsWith("/")
          ? audioUrl.slice(1)
          : audioUrl;

      const filePath = path.resolve(
        PUBLIC_DIR,
        cleanPath.replace(
          /^public[\\/]/,
          ""
        )
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).send(
          "Audio file not found"
        );
      }

      res.sendFile(filePath);
    } catch (error) {
      console.error(
        "Audio error:",
        error
      );

      res.status(500).send(
        "Audio server error"
      );
    }
  }
);

/* =========================================================
   CAPTCHA
========================================================= */

app.get(
  "/api/auth/captcha",
  async (req, res) => {
    const code = randomCaptcha();

    const id = crypto.randomUUID();

    const expiresAt =
      new Date(
        Date.now() + 10 * 60 * 1000
      );

    if (pool) {
      try {
        await pool.query(
          `
          INSERT INTO captcha
          (id, code, expires_at)
          VALUES ($1, $2, $3)
          `,
          [
            id,
            code,
            expiresAt,
          ]
        );
      } catch (error) {
        console.error(
          "Captcha DB error:",
          error
        );
      }
    }

    res.json({
      id,
      captcha_id: id,
      text: code,
      code,
      expires_at:
        expiresAt.toISOString(),
    });
  }
);

/* =========================================================
   REGISTER
========================================================= */

app.post(
  "/api/auth/register",
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({
        error:
          "PostgreSQL не подключён.",
      });
    }

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
          error:
            "Заполни все обязательные поля.",
        });
      }

      if (
        cleanUsername.length < 3 ||
        cleanUsername.length > 50
      ) {
        return res.status(400).json({
          error:
            "Username должен содержать от 3 до 50 символов.",
        });
      }

      if (cleanPassword.length < 6) {
        return res.status(400).json({
          error:
            "Пароль должен содержать минимум 6 символов.",
        });
      }

      /*
       * CAPTCHA
       */
      if (captcha_id) {
        const captchaResult =
          await pool.query(
            `
            SELECT *
            FROM captcha
            WHERE id = $1
            LIMIT 1
            `,
            [captcha_id]
          );

        if (
          !captchaResult.rows.length
        ) {
          return res.status(400).json({
            error:
              "CAPTCHA устарела. Получи новую.",
          });
        }

        const captchaRow =
          captchaResult.rows[0];

        if (
          new Date(
            captchaRow.expires_at
          ).getTime() <
          Date.now()
        ) {
          return res.status(400).json({
            error:
              "CAPTCHA истекла.",
          });
        }

        if (
          String(
            captcha || ""
          )
            .trim()
            .toUpperCase() !==
          String(
            captchaRow.code
          )
            .trim()
            .toUpperCase()
        ) {
          return res.status(400).json({
            error:
              "Неверная CAPTCHA.",
          });
        }

        await pool.query(
          `
          DELETE FROM captcha
          WHERE id = $1
          `,
          [captcha_id]
        );
      }

      /*
       * Проверяем username/email
       */
      const exists =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE LOWER(username) = LOWER($1)
             OR LOWER(email) = LOWER($2)
          LIMIT 1
          `,
          [
            cleanUsername,
            cleanEmail,
          ]
        );

      if (exists.rows.length) {
        return res.status(409).json({
          error:
            "Username или Email уже используется.",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          cleanPassword,
          12
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
          VALUES ($1, $2, $3)
          RETURNING
            id,
            username,
            email,
            bio,
            avatar_url,
            created_at
          `,
          [
            cleanUsername,
            cleanEmail,
            passwordHash,
          ]
        );

      const user =
        normalizeUser(
          result.rows[0]
        );

      const token =
        createToken(user);

      res.status(201).json({
        ok: true,
        token,
        access_token: token,
        user,
        account: user,
      });
    } catch (error) {
      console.error(
        "REGISTER ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Не удалось создать аккаунт.",
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
    if (!pool) {
      return res.status(503).json({
        error:
          "PostgreSQL не подключён.",
      });
    }

    try {
      const {
        login,
        username,
        email,
        password,
      } = req.body || {};

      const identifier =
        String(
          login ||
            email ||
            username ||
            ""
        ).trim();

      const cleanPassword =
        String(password || "");

      if (
        !identifier ||
        !cleanPassword
      ) {
        return res.status(400).json({
          error:
            "Введите логин и пароль.",
        });
      }

      const result =
        await pool.query(
          `
          SELECT *
          FROM users
          WHERE
            LOWER(username) = LOWER($1)
            OR LOWER(email) = LOWER($1)
          LIMIT 1
          `,
          [identifier]
        );

      if (!result.rows.length) {
        return res.status(401).json({
          error:
            "Неверный логин или пароль.",
        });
      }

      const row =
        result.rows[0];

      const valid =
        await bcrypt.compare(
          cleanPassword,
          row.password_hash
        );

      if (!valid) {
        return res.status(401).json({
          error:
            "Неверный логин или пароль.",
        });
      }

      const user =
        normalizeUser(row);

      const token =
        createToken(user);

      res.json({
        ok: true,
        token,
        access_token: token,
        user,
        account: user,
      });
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Ошибка авторизации.",
      });
    }
  }
);

/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  "/api/auth/me",
  authRequired,
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({
        error:
          "PostgreSQL не подключён.",
      });
    }

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

      if (!result.rows.length) {
        return res.status(404).json({
          error:
            "Пользователь не найден.",
        });
      }

      res.json({
        user: normalizeUser(
          result.rows[0]
        ),
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Не удалось получить профиль.",
      });
    }
  }
);

/* =========================================================
   UPDATE PROFILE
========================================================= */

app.patch(
  "/api/auth/profile",
  authRequired,
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({
        error:
          "PostgreSQL не подключён.",
      });
    }

    try {
      const {
        username,
        bio,
        avatar_url,
      } = req.body || {};

      const cleanUsername =
        String(
          username || ""
        ).trim();

      const cleanBio =
        String(
          bio || ""
        ).trim();

      const result =
        await pool.query(
          `
          UPDATE users
          SET
            username =
              COALESCE(NULLIF($1, ''), username),
            bio = $2,
            avatar_url = $3
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
            cleanUsername,
            cleanBio,
            avatar_url || null,
            req.user.id,
          ]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          error:
            "Пользователь не найден.",
        });
      }

      res.json({
        ok: true,
        user: normalizeUser(
          result.rows[0]
        ),
      });
    } catch (error) {
      console.error(
        "PROFILE UPDATE:",
        error
      );

      res.status(500).json({
        error:
          "Не удалось сохранить профиль.",
      });
    }
  }
);

/* =========================================================
   FAVORITES
========================================================= */

app.get(
  "/api/favorites",
  authRequired,
  async (req, res) => {
    if (!pool) {
      return res.json([]);
    }

    try {
      const result =
        await pool.query(
          `
          SELECT
            t.*
          FROM favorites f
          JOIN tracks t
            ON t.id = f.track_id
          WHERE f.user_id = $1
          ORDER BY f.created_at DESC
          `,
          [req.user.id]
        );

      res.json(
        result.rows.map((track) => ({
          ...track,
          id: String(track.id),
          duration: Number(
            track.duration || 0
          ),
          plays: Number(
            track.plays || 0
          ),
        }))
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
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
    if (!pool) {
      return res.status(503).json({
        error:
          "PostgreSQL не подключён.",
      });
    }

    try {
      await pool.query(
        `
        INSERT INTO favorites
        (user_id, track_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [
          req.user.id,
          req.params.trackId,
        ]
      );

      res.json({
        ok: true,
        favorite: true,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Не удалось сохранить трек.",
      });
    }
  }
);

app.delete(
  "/api/favorites/:trackId",
  authRequired,
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({
        error:
          "PostgreSQL не подключён.",
      });
    }

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
      console.error(error);

      res.status(500).json({
        error:
          "Не удалось удалить трек.",
      });
    }
  }
);

/* =========================================================
   LISTENING HISTORY
========================================================= */

app.get(
  "/api/history",
  authRequired,
  async (req, res) => {
    if (!pool) {
      return res.json([]);
    }

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

      res.json(
        result.rows.map((track) => ({
          ...track,
          id: String(track.id),
          duration: Number(
            track.duration || 0
          ),
          plays: Number(
            track.plays || 0
          ),
        }))
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
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
    if (!pool) {
      return res.status(503).json({
        error:
          "PostgreSQL не подключён.",
      });
    }

    try {
      await pool.query(
        `
        INSERT INTO listening_history
        (user_id, track_id)
        VALUES ($1, $2)
        `,
        [
          req.user.id,
          req.params.trackId,
        ]
      );

      await pool.query(
        `
        UPDATE tracks
        SET plays = plays + 1
        WHERE id = $1
        `,
        [req.params.trackId]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Не удалось сохранить историю.",
      });
    }
  }
);

/* =========================================================
   PLAYLISTS
========================================================= */

app.get(
  "/api/playlists",
  authRequired,
  async (req, res) => {
    if (!pool) {
      return res.json([]);
    }

    try {
      const result =
        await pool.query(
          `
          SELECT
            p.id,
            p.name,
            p.is_public,
            p.created_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', t.id,
                  'title', t.title,
                  'artist_name', t.artist_name,
                  'album_name', t.album_name,
                  'genre', t.genre,
                  'duration', t.duration,
                  'cover_url', t.cover_url,
                  'audio_url', t.audio_url
                )
                ORDER BY pt.position
              )
              FILTER (WHERE t.id IS NOT NULL),
              '[]'
            ) AS tracks
          FROM playlists p
          LEFT JOIN playlist_tracks pt
            ON pt.playlist_id = p.id
          LEFT JOIN tracks t
            ON t.id = pt.track_id
          WHERE p.user_id = $1
          GROUP BY
            p.id
          ORDER BY
            p.created_at DESC
          `,
          [req.user.id]
        );

      res.json(
        result.rows.map(
          (playlist) => ({
            id: String(
              playlist.id
            ),
            name: playlist.name,
            public:
              playlist.is_public,
            created_at:
              playlist.created_at,
            tracks:
              playlist.tracks || [],
          })
        )
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
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
    if (!pool) {
      return res.status(503).json({
        error:
          "PostgreSQL не подключён.",
      });
    }

    try {
      const {
        name,
        public: isPublic,
      } = req.body || {};

      const cleanName =
        String(
          name || ""
        ).trim();

      if (!cleanName) {
        return res.status(400).json({
          error:
            "Название плейлиста обязательно.",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO playlists
          (
            user_id,
            name,
            is_public
          )
          VALUES ($1, $2, $3)
          RETURNING *
          `,
          [
            req.user.id,
            cleanName,
            Boolean(isPublic),
          ]
        );

      res.status(201).json({
        ok: true,
        playlist: {
          id: String(
            result.rows[0].id
          ),
          name:
            result.rows[0].name,
          public:
            result.rows[0]
              .is_public,
          tracks: [],
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
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
    if (!pool) {
      return res.status(503).json({
        error:
          "PostgreSQL не подключён.",
      });
    }

    try {
      await pool.query(
        `
        DELETE FROM playlists
        WHERE id = $1
          AND user_id = $2
        `,
        [
          req.params.id,
          req.user.id,
        ]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Не удалось удалить плейлист.",
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
      error: "API endpoint not found.",
      path: req.originalUrl,
    });
  }
);

/* =========================================================
   SPA FALLBACK
========================================================= */

app.get(
  "*",
  (req, res, next) => {
    if (
      req.path.startsWith("/api/")
    ) {
      return next();
    }

    const indexFile =
      path.join(
        FRONTEND_DIR,
        "index.html"
      );

    if (
      fs.existsSync(indexFile)
    ) {
      return res.sendFile(
        indexFile
      );
    }

    res.status(404).send(
      "Frontend not found."
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

    res.status(500).json({
      error:
        "Internal server error.",
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
      "0.0.0.0",
      () => {
        console.log("");
        console.log(
          "========================================"
        );
        console.log(
          "        FENIX MUSIC BACKEND"
        );
        console.log(
          "========================================"
        );
        console.log(
          `Server: http://0.0.0.0:${PORT}`
        );
        console.log(
          `Health: http://0.0.0.0:${PORT}/api/health`
        );
        console.log(
          `Frontend: ${FRONTEND_DIR}`
        );
        console.log(
          `Uploads: ${UPLOADS_DIR}`
        );
        console.log(
          `PostgreSQL: ${
            pool
              ? "enabled"
              : "disabled"
          }`
        );
        console.log(
          "========================================"
        );
        console.log("");
      }
    );
  } catch (error) {
    console.error(
      "FATAL START ERROR:",
      error
    );

    process.exit(1);
  }
}

start();
```
