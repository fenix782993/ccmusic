"use strict";

const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const cookieParser = require("cookie-parser");

const app = express();

const PORT = Number(process.env.PORT || 10000);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not configured");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "5mb",
  })
);

app.use(cookieParser());

/* =========================================================
   DATABASE
========================================================= */

async function query(text, params = []) {
  return pool.query(text, params);
}

async function initDatabase() {
  console.log("Initializing PostgreSQL...");

  /*
   IMPORTANT:
   users.id = BIGINT
   sessions.user_id = BIGINT

   Это специально сделано одинаковыми типами,
   чтобы не было ошибки uuid/bigint.
  */

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
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

  await query(`
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

  await query(`
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

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,

      CONSTRAINT sessions_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS captchas (
      id TEXT PRIMARY KEY,
      answer TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  /*
   Старые базы могут иметь таблицы без новых колонок.
   Добавляем их безопасно.
  */

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''
  `);

  await query(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Unknown'
  `);

  await query(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS artist_name TEXT NOT NULL DEFAULT 'Unknown'
  `);

  await query(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS album_name TEXT NOT NULL DEFAULT ''
  `);

  await query(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT ''
  `);

  await query(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS audio_url TEXT NOT NULL DEFAULT ''
  `);

  await query(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 0
  `);

  await query(`
    ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS plays_count BIGINT NOT NULL DEFAULT 0
  `);

  /*
   Если tracks уже существовала с несовместимым типом id,
   новые FK выше могут быть невозможны.
   Для чистого нового проекта это не возникает.
  */

  const countResult = await query(`
    SELECT COUNT(*)::int AS count
    FROM tracks
  `);

  const trackCount = Number(countResult.rows[0].count);

  if (trackCount === 0) {
    console.log("Adding demo tracks...");

    await query(`
      INSERT INTO tracks
        (title, artist_name, album_name, cover_url, audio_url, duration)
      VALUES
        (
          'Fenix Intro',
          'Fenix Music',
          'Fenix',
          'https://placehold.co/700x700/18181b/ffffff?text=FX',
          '',
          0
        ),
        (
          'Night Drive',
          'Fenix Music',
          'Fenix',
          'https://placehold.co/700x700/18181b/ffffff?text=NIGHT',
          '',
          0
        ),
        (
          'Neon Dreams',
          'Fenix Music',
          'Fenix',
          'https://placehold.co/700x700/18181b/ffffff?text=NEON',
          '',
          0
        )
    `);
  }

  console.log("PostgreSQL initialized.");
}

/* =========================================================
   HELPERS
========================================================= */

function createToken() {
  return crypto.randomBytes(48).toString("hex");
}

function createCaptcha() {
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

async function getCurrentUser(req) {
  try {
    const token = req.cookies.fenix_session;

    if (!token) {
      return null;
    }

    const result = await query(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.bio,
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

    return result.rows[0] || null;
  } catch (error) {
    console.error("getCurrentUser:", error.message);
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

/* =========================================================
   API
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
    await query("SELECT 1");

    res.json({
      ok: true,
      status: "healthy",
      database: "online",
      service: "Fenix Music Backend",
    });
  } catch (error) {
    console.error("Health:", error);

    res.status(500).json({
      ok: false,
      status: "error",
      database: "offline",
      error: error.message,
    });
  }
});

/* =========================================================
   AUTH ME
========================================================= */

app.get("/api/auth/me", async (req, res) => {
  const user = await getCurrentUser(req);

  res.json({
    ok: true,
    user: safeUser(user),
  });
});

/* =========================================================
   CAPTCHA
========================================================= */

app.get("/api/auth/captcha", async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const answer = createCaptcha();

    await query(
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
      captcha: answer,
      captcha_id: id,
    });
  } catch (error) {
    console.error("Captcha:", error);

    res.status(500).json({
      ok: false,
      error: "Не удалось создать CAPTCHA",
    });
  }
});

/* =========================================================
   REGISTER
========================================================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      captcha,
      captcha_id,
    } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Заполните все поля",
      });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        ok: false,
        error: "Username должен содержать минимум 3 символа",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        ok: false,
        error: "Пароль должен содержать минимум 6 символов",
      });
    }

    if (!captcha_id || !captcha) {
      return res.status(400).json({
        ok: false,
        error: "CAPTCHA обязательна",
      });
    }

    const captchaResult = await query(
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
      String(captchaResult.rows[0].answer).toUpperCase() !==
        String(captcha).trim().toUpperCase()
    ) {
      return res.status(400).json({
        ok: false,
        error: "Неверная CAPTCHA",
      });
    }

    const exists = await query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER($1)
           OR LOWER(username) = LOWER($2)
        LIMIT 1
      `,
      [cleanEmail, cleanUsername]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({
        ok: false,
        error: "Username или email уже используется",
      });
    }

    const passwordHash = await bcrypt.hash(
      String(password),
      12
    );

    const userResult = await query(
      `
        INSERT INTO users
          (username, email, password_hash)
        VALUES
          ($1, $2, $3)
        RETURNING
          id,
          username,
          email,
          bio,
          created_at
      `,
      [
        cleanUsername,
        cleanEmail,
        passwordHash,
      ]
    );

    const user = userResult.rows[0];

    await query(
      "DELETE FROM captchas WHERE id = $1",
      [captcha_id]
    );

    const sessionToken = createToken();

    await query(
      `
        INSERT INTO sessions
          (token, user_id, expires_at)
        VALUES
          ($1, $2, NOW() + INTERVAL '30 days')
      `,
      [sessionToken, user.id]
    );

    res.cookie(
      "fenix_session",
      sessionToken,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      }
    );

    res.status(201).json({
      ok: true,
      user: safeUser(user),
      token: sessionToken,
    });
  } catch (error) {
    console.error("REGISTER:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "Username или email уже используется",
      });
    }

    res.status(500).json({
      ok: false,
      error: "Ошибка регистрации",
    });
  }
});

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const {
      login,
      email,
      username,
      password,
    } = req.body || {};

    const key = String(
      login || email || username || ""
    ).trim();

    if (!key || !password) {
      return res.status(400).json({
        ok: false,
        error: "Введите логин и пароль",
      });
    }

    const result = await query(
      `
        SELECT *
        FROM users
        WHERE LOWER(email) = LOWER($1)
           OR LOWER(username) = LOWER($1)
        LIMIT 1
      `,
      [key]
    );

    const user = result.rows[0];

    if (
      !user ||
      !(await bcrypt.compare(
        String(password),
        user.password_hash
      ))
    ) {
      return res.status(401).json({
        ok: false,
        error: "Неверный логин или пароль",
      });
    }

    const sessionToken = createToken();

    await query(
      `
        INSERT INTO sessions
          (token, user_id, expires_at)
        VALUES
          ($1, $2, NOW() + INTERVAL '30 days')
      `,
      [sessionToken, user.id]
    );

    res.cookie(
      "fenix_session",
      sessionToken,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      }
    );

    res.json({
      ok: true,
      user: safeUser(user),
      token: sessionToken,
    });
  } catch (error) {
    console.error("LOGIN:", error);

    res.status(500).json({
      ok: false,
      error: "Ошибка входа",
    });
  }
});

/* =========================================================
   LOGOUT
========================================================= */

app.post("/api/auth/logout", async (req, res) => {
  try {
    const token = req.cookies.fenix_session;

    if (token) {
      await query(
        "DELETE FROM sessions WHERE token = $1",
        [token]
      );
    }

    res.clearCookie("fenix_session", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    res.json({
      ok: true,
    });
  } catch (error) {
    console.error("LOGOUT:", error);

    res.status(500).json({
      ok: false,
      error: "Ошибка выхода",
    });
  }
});

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

      const cleanUsername =
        username === undefined
          ? req.user.username
          : String(username).trim();

      const cleanBio =
        bio === undefined
          ? req.user.bio
          : String(bio);

      if (cleanUsername.length < 3) {
        return res.status(400).json({
          ok: false,
          error: "Username слишком короткий",
        });
      }

      const result = await query(
        `
          UPDATE users
          SET
            username = $1,
            bio = $2
          WHERE id = $3
          RETURNING
            id,
            username,
            email,
            bio,
            created_at
        `,
        [
          cleanUsername,
          cleanBio,
          req.user.id,
        ]
      );

      res.json({
        ok: true,
        user: result.rows[0],
      });
    } catch (error) {
      console.error("PROFILE:", error);

      if (error.code === "23505") {
        return res.status(409).json({
          ok: false,
          error: "Этот username уже занят",
        });
      }

      res.status(500).json({
        ok: false,
        error: "Не удалось сохранить профиль",
      });
    }
  }
);

/* =========================================================
   TRACKS
========================================================= */

app.get("/api/tracks", async (req, res) => {
  try {
    const result = await query(`
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
    `);

    res.json({
      ok: true,
      tracks: result.rows,
    });
  } catch (error) {
    console.error("TRACKS:", error);

    res.status(500).json({
      ok: false,
      error: "Не удалось загрузить треки",
      tracks: [],
    });
  }
});

app.get("/api/tracks/:id", async (req, res) => {
  try {
    const result = await query(
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
    console.error("TRACK:", error);

    res.status(500).json({
      ok: false,
      error: "Ошибка загрузки трека",
    });
  }
});

/* =========================================================
   AUDIO
========================================================= */

app.get(
  "/api/tracks/:id/audio",
  async (req, res) => {
    try {
      const result = await query(
        `
          SELECT audio_url
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

      const audioUrl =
        result.rows[0].audio_url;

      if (!audioUrl) {
        return res.status(404).json({
          ok: false,
          error: "У трека нет audio_url",
        });
      }

      res.redirect(audioUrl);
    } catch (error) {
      console.error("AUDIO:", error);

      res.status(500).json({
        ok: false,
        error: "Ошибка загрузки аудио",
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
      const result = await query(
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
        plays_count:
          result.rows[0].plays_count,
      });
    } catch (error) {
      console.error("PLAY:", error);

      res.status(500).json({
        ok: false,
        error: "Не удалось засчитать прослушивание",
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
      const result = await query(
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

      res.json({
        ok: true,
        tracks: result.rows,
      });
    } catch (error) {
      console.error("FAVORITES GET:", error);

      res.status(500).json({
        ok: false,
        error: "Не удалось загрузить избранное",
        tracks: [],
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
        req.body && req.body.track_id;

      if (!trackId) {
        return res.status(400).json({
          ok: false,
          error: "track_id обязателен",
        });
      }

      const track = await query(
        "SELECT id FROM tracks WHERE id = $1",
        [trackId]
      );

      if (!track.rows[0]) {
        return res.status(404).json({
          ok: false,
          error: "Трек не найден",
        });
      }

      await query(
        `
          INSERT INTO favorites
            (user_id, track_id)
          VALUES
            ($1, $2)
          ON CONFLICT
            (user_id, track_id)
          DO NOTHING
        `,
        [req.user.id, trackId]
      );

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error("FAVORITES POST:", error);

      res.status(500).json({
        ok: false,
        error: "Не удалось добавить в избранное",
      });
    }
  }
);

app.delete(
  "/api/favorites/:id",
  requireUser,
  async (req, res) => {
    try {
      await query(
        `
          DELETE FROM favorites
          WHERE user_id = $1
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
      console.error("FAVORITES DELETE:", error);

      res.status(500).json({
        ok: false,
        error: "Не удалось удалить из избранного",
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
      const result = await query(
        `
          SELECT
            t.*,
            h.played_at
          FROM history h
          JOIN tracks t
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
      console.error("HISTORY GET:", error);

      res.status(500).json({
        ok: false,
        error: "Не удалось загрузить историю",
        tracks: [],
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
        req.body && req.body.track_id;

      if (!trackId) {
        return res.status(400).json({
          ok: false,
          error: "track_id обязателен",
        });
      }

      const track = await query(
        "SELECT id FROM tracks WHERE id = $1",
        [trackId]
      );

      if (!track.rows[0]) {
        return res.status(404).json({
          ok: false,
          error: "Трек не найден",
        });
      }

      await query(
        `
          INSERT INTO history
            (user_id, track_id)
          VALUES
            ($1, $2)
        `,
        [req.user.id, trackId]
      );

      await query(
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
      console.error("HISTORY POST:", error);

      res.status(500).json({
        ok: false,
        error: "Не удалось сохранить историю",
      });
    }
  }
);

/* =========================================================
   WEBSITE
   НИКАКОГО App.js / React / frontend/build НЕ НУЖНО
========================================================= */

const HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="theme-color" content="#09090b">
<title>Fenix Music</title>

<style>
*{
  box-sizing:border-box;
}

html,body{
  margin:0;
  padding:0;
  min-height:100%;
  background:#09090b;
  color:#fff;
  font-family:Inter,-apple-system,BlinkMacSystemFont,
  "Segoe UI",Roboto,Arial,sans-serif;
}

body{
  min-height:100vh;
}

button,
input,
textarea,
select{
  font:inherit;
}

button{
  cursor:pointer;
}

button:disabled{
  opacity:.5;
  cursor:not-allowed;
}

.app{
  min-height:100vh;
  padding:25px;
  padding-bottom:110px;
}

.nav{
  max-width:1200px;
  margin:0 auto 30px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}

.nav button{
  background:#18181b;
  border:1px solid #27272a;
  color:#fff;
  padding:11px 17px;
  border-radius:12px;
}

.nav button:hover{
  background:#27272a;
}

.nav button.active{
  background:#dc2626;
  border-color:#dc2626;
}

.page{
  max-width:1200px;
  margin:auto;
}

.hero{
  padding:35px 0;
}

.eyebrow{
  display:inline-block;
  color:#a1a1aa;
  font-size:12px;
  font-weight:700;
  letter-spacing:2px;
}

h1{
  font-size:42px;
  margin:8px 0;
}

h2{
  font-size:28px;
}

.muted{
  color:#a1a1aa;
}

.grid{
  display:grid;
  grid-template-columns:
    repeat(auto-fill,minmax(190px,1fr));
  gap:18px;
}

.card{
  background:#111113;
  border:1px solid #27272a;
  border-radius:18px;
  padding:14px;
  transition:.2s;
}

.card:hover{
  transform:translateY(-2px);
  border-color:#3f3f46;
}

.cover{
  width:100%;
  aspect-ratio:1;
  object-fit:cover;
  border-radius:13px;
  background:#18181b;
}

.card h3{
  margin:13px 0 5px;
}

.card p{
  margin:0 0 14px;
}

.primary{
  background:#dc2626!important;
  border-color:#dc2626!important;
  color:white!important;
}

.card button,
.form button,
.player button,
.profile button{
  border:1px solid #27272a;
  background:#18181b;
  color:#fff;
  padding:10px 14px;
  border-radius:10px;
}

.form{
  max-width:500px;
  background:#111113;
  border:1px solid #27272a;
  padding:25px;
  border-radius:20px;
}

.form input,
.form textarea,
.form select{
  width:100%;
  padding:13px;
  margin:8px 0 15px;
  background:#09090b;
  color:#fff;
  border:1px solid #27272a;
  border-radius:11px;
  outline:none;
}

.form textarea{
  min-height:120px;
  resize:vertical;
}

.form input:focus,
.form textarea:focus{
  border-color:#dc2626;
}

.profile{
  display:grid;
  grid-template-columns:120px 1fr;
  gap:25px;
  margin-bottom:30px;
}

.avatar{
  width:120px;
  height:120px;
  border-radius:50%;
  background:#dc2626;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:35px;
  font-weight:800;
}

.stat-grid{
  display:grid;
  grid-template-columns:
    repeat(3,1fr);
  gap:15px;
  margin:25px 0;
}

.stat{
  background:#111113;
  border:1px solid #27272a;
  padding:20px;
  border-radius:16px;
}

.stat strong{
  display:block;
  font-size:28px;
}

.player{
  position:fixed;
  z-index:20;
  left:0;
  right:0;
  bottom:0;
  min-height:75px;
  padding:12px 20px;
  background:rgba(17,17,19,.96);
  backdrop-filter:blur(15px);
  border-top:1px solid #27272a;
  display:flex;
  align-items:center;
  gap:15px;
}

.player-info{
  flex:1;
  min-width:0;
}

.player-info strong,
.player-info span{
  display:block;
  overflow:hidden;
  white-space:nowrap;
  text-overflow:ellipsis;
}

.player-controls{
  display:flex;
  gap:7px;
}

.player-controls button{
  border-radius:50%;
  width:42px;
  height:42px;
  padding:0;
}

.empty{
  padding:40px;
  text-align:center;
  color:#a1a1aa;
  border:1px dashed #27272a;
  border-radius:18px;
}

.error{
  color:#f87171;
  background:#2b1111;
  border:1px solid #7f1d1d;
  padding:12px;
  border-radius:10px;
  margin:10px 0;
}

.success{
  color:#86efac;
}

@media(max-width:700px){
  .app{
    padding:15px;
    padding-bottom:120px;
  }

  h1{
    font-size:32px;
  }

  .grid{
    grid-template-columns:
      repeat(2,minmax(0,1fr));
    gap:10px;
  }

  .profile{
    grid-template-columns:80px 1fr;
  }

  .avatar{
    width:80px;
    height:80px;
    font-size:25px;
  }

  .stat-grid{
    grid-template-columns:1fr;
  }

  .player{
    padding:10px;
  }

  .player-controls button{
    width:38px;
    height:38px;
  }
}
</style>
</head>

<body>

<div id="root"></div>

<script>
"use strict";

const root = document.getElementById("root");

let tracks = [];
let user = null;
let currentTrack = null;
let audio = new Audio();

audio.volume = 1;

function esc(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

async function api(url, options = {}){
  const response = await fetch(
    "/api" + url,
    {
      credentials:"include",
      ...options,
      headers:{
        "Content-Type":"application/json",
        ...(options.headers || {})
      }
    }
  );

  const data =
    await response.json().catch(() => ({}));

  if(!response.ok){
    throw new Error(
      data.error ||
      data.message ||
      "Ошибка запроса"
    );
  }

  return data;
}

async function load(){
  try{
    const tracksData =
      await api("/tracks");

    tracks =
      Array.isArray(tracksData.tracks)
        ? tracksData.tracks
        : [];
  }catch(error){
    console.error(error);
    tracks = [];
  }

  try{
    const me =
      await api("/auth/me");

    user = me.user || null;
  }catch(error){
    user = null;
  }

  render("home");
}

function render(page){
  root.innerHTML = \`
    <div class="app">

      <nav class="nav">
        <button
          class="\${page==="home"?"active":""}"
          onclick="render('home')">
          Главная
        </button>

        <button
          class="\${page==="favorites"?"active":""}"
          onclick="render('favorites')">
          Избранное
        </button>

        <button
          class="\${page==="history"?"active":""}"
          onclick="render('history')">
          История
        </button>

        <button
          class="\${page==="profile"?"active":""}"
          onclick="render('profile')">
          Профиль
        </button>

        <button
          class="\${page==="settings"?"active":""}"
          onclick="render('settings')">
          Настройки
        </button>
      </nav>

      <main class="page" id="page"></main>

    </div>
  \`;

  const pageElement =
    document.getElementById("page");

  if(page==="home"){
    home(pageElement);
  }

  if(page==="favorites"){
    favorites(pageElement);
  }

  if(page==="history"){
    history(pageElement);
  }

  if(page==="profile"){
    profile(pageElement);
  }

  if(page==="settings"){
    settings(pageElement);
  }

  renderPlayer();
}

function home(el){
  el.innerHTML = \`
    <section class="hero">
      <span class="eyebrow">
        FENIX MUSIC
      </span>

      <h1>
        Музыка начинается здесь
      </h1>

      <p class="muted">
        Твоя музыкальная вселенная.
      </p>
    </section>

    <h2>Музыка</h2>

    <div class="grid">
      \${tracks.length
        ? tracks.map(trackCard).join("")
        : '<div class="empty">Треков пока нет.</div>'
      }
    </div>
  \`;
}

function trackCard(track){
  const cover =
    track.cover_url ||
    "https://placehold.co/700x700/18181b/ffffff?text=FX";

  return \`
    <article class="card">

      <img
        class="cover"
        src="\${esc(cover)}"
        alt=""
      >

      <h3>
        \${esc(track.title)}
      </h3>

      <p class="muted">
        \${esc(track.artist_name || "Unknown")}
      </p>

      <button
        class="primary"
        onclick="playTrack(\${Number(track.id)})">
        ▶ Слушать
      </button>

      <button
        onclick="addFavorite(\${Number(track.id)})">
        ♥
      </button>

    </article>
  \`;
}

async function playTrack(id){
  const track =
    tracks.find(
      x => Number(x.id) === Number(id)
    );

  if(!track){
    return;
  }

  currentTrack = track;

  const source =
    track.audio_url ||
    "/api/tracks/" + id + "/audio";

  audio.src = source;

  try{
    await audio.play();
  }catch(error){
    console.warn(
      "Автовоспроизведение заблокировано браузером"
    );
  }

  try{
    await api(
      "/history",
      {
        method:"POST",
        body:JSON.stringify({
          track_id:id
        })
      }
    );
  }catch(error){
    console.warn(error);
  }

  renderPlayer();
}

function renderPlayer(){
  const old =
    document.querySelector(".player");

  if(old){
    old.remove();
  }

  if(!currentTrack){
    return;
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    \`
      <footer class="player">

        <div class="player-info">
          <strong>
            \${esc(currentTrack.title)}
          </strong>

          <span class="muted">
            \${esc(currentTrack.artist_name || "")}
          </span>
        </div>

        <div class="player-controls">

          <button
            onclick="previousTrack()">
            ◀
          </button>

          <button
            class="primary"
            onclick="toggleAudio()">
            ▶
          </button>

          <button
            onclick="nextTrack()">
            ▶
          </button>

        </div>

      </footer>
    \`
  );
}

function toggleAudio(){
  if(audio.paused){
    audio.play().catch(() => {});
  }else{
    audio.pause();
  }
}

function nextTrack(){
  if(!currentTrack || !tracks.length){
    return;
  }

  const index =
    tracks.findIndex(
      x => Number(x.id) === Number(currentTrack.id)
    );

  const next =
    tracks[(index + 1) % tracks.length];

  if(next){
    playTrack(next.id);
  }
}

function previousTrack(){
  if(!currentTrack || !tracks.length){
    return;
  }

  const index =
    tracks.findIndex(
      x => Number(x.id) === Number(currentTrack.id)
    );

  const previous =
    tracks[
      (index - 1 + tracks.length) %
      tracks.length
    ];

  if(previous){
    playTrack(previous.id);
  }
}

async function addFavorite(id){
  try{
    await api(
      "/favorites",
      {
        method:"POST",
        body:JSON.stringify({
          track_id:id
        })
      }
    );

    alert("Добавлено в избранное");
  }catch(error){
    alert(error.message);
  }
}

async function favorites(el){
  if(!user){
    el.innerHTML = \`
      <h1>Избранное</h1>
      <div class="empty">
        Войди в аккаунт,
        чтобы использовать избранное.
      </div>
    \`;
    return;
  }

  try{
    const data =
      await api("/favorites");

    const list =
      data.tracks || [];

    el.innerHTML = \`
      <h1>Избранное</h1>

      <div class="grid">
        \${list.length
          ? list.map(trackCard).join("")
          : '<div class="empty">Избранное пусто.</div>'
        }
      </div>
    \`;
  }catch(error){
    el.innerHTML =
      '<div class="error">' +
      esc(error.message) +
      '</div>';
  }
}

async function history(el){
  if(!user){
    el.innerHTML = \`
      <h1>История</h1>
      <div class="empty">
        Войди в аккаунт,
        чтобы увидеть историю.
      </div>
    \`;
    return;
  }

  try{
    const data =
      await api("/history");

    const list =
      data.tracks || [];

    el.innerHTML = \`
      <h1>История</h1>

      <div class="grid">
        \${list.length
          ? list.map(trackCard).join("")
          : '<div class="empty">История пуста.</div>'
        }
      </div>
    \`;
  }catch(error){
    el.innerHTML =
      '<div class="error">' +
      esc(error.message) +
      '</div>';
  }
}

function profile(el){
  if(!user){
    el.innerHTML = \`
      <div class="form">

        <span class="eyebrow">
          FENIX MUSIC
        </span>

        <h1>Войти</h1>

        <input
          id="loginInput"
          placeholder="Email или username"
        >

        <input
          id="loginPassword"
          type="password"
          placeholder="Пароль"
        >

        <button
          class="primary"
          onclick="login()">
          Войти
        </button>

        <hr>

        <h2>Создать аккаунт</h2>

        <input
          id="registerUsername"
          placeholder="Username"
        >

        <input
          id="registerEmail"
          type="email"
          placeholder="Email"
        >

        <input
          id="registerPassword"
          type="password"
          placeholder="Пароль"
        >

        <button
          class="primary"
          onclick="register()">
          Создать аккаунт
        </button>

      </div>
    \`;

    return;
  }

  const username =
    user.username || "FX";

  const initials =
    username
      .slice(0,2)
      .toUpperCase();

  el.innerHTML = \`
    <div class="profile">

      <div class="avatar">
        \${esc(initials)}
      </div>

      <div>
        <span class="eyebrow">
          PROFILE
        </span>

        <h1>
          \${esc(username)}
        </h1>

        <p class="muted">
          \${esc(user.email || "")}
        </p>
      </div>

    </div>

    <div class="stat-grid">

      <div class="stat">
        <strong>
          —
        </strong>
        <span class="muted">
          прослушиваний
        </span>
      </div>

      <div class="stat">
        <strong>
          —
        </strong>
        <span class="muted">
          избранных
        </span>
      </div>

      <div class="stat">
        <strong>
          FX
        </strong>
        <span class="muted">
          Fenix Music
        </span>
      </div>

    </div>

    <div class="form">

      <h2>
        Редактирование профиля
      </h2>

      <input
        id="profileUsername"
        value="\${esc(user.username || "")}"
        placeholder="Username"
      >

      <textarea
        id="profileBio"
        placeholder="Расскажи о себе"
      >\${esc(user.bio || "")}</textarea>

      <button
        class="primary"
        onclick="saveProfile()">
        Сохранить
      </button>

      <button
        onclick="logout()">
        Выйти
      </button>

    </div>
  \`;
}

async function login(){
  const loginValue =
    document.getElementById("loginInput").value;

  const password =
    document.getElementById("loginPassword").value;

  try{
    const data =
      await api(
        "/auth/login",
        {
          method:"POST",
          body:JSON.stringify({
            login:loginValue,
            email:loginValue,
            password
          })
        }
      );

    user = data.user;

    render("profile");
  }catch(error){
    alert(error.message);
  }
}

async function register(){
  const username =
    document.getElementById(
      "registerUsername"
    ).value;

  const email =
    document.getElementById(
      "registerEmail"
    ).value;

  const password =
    document.getElementById(
      "registerPassword"
    ).value;

  try{
    const captcha =
      await api("/auth/captcha");

    const answer =
      prompt(
        "Введите CAPTCHA: " +
        captcha.text
      );

    if(answer === null){
      return;
    }

    const data =
      await api(
        "/auth/register",
        {
          method:"POST",
          body:JSON.stringify({
            username,
            email,
            password,
            captcha:answer,
            captcha_id:captcha.id
          })
        }
      );

    user = data.user;

    render("profile");
  }catch(error){
    alert(error.message);
  }
}

async function saveProfile(){
  const username =
    document.getElementById(
      "profileUsername"
    ).value;

  const bio =
    document.getElementById(
      "profileBio"
    ).value;

  try{
    const data =
      await api(
        "/auth/profile",
        {
          method:"PUT",
          body:JSON.stringify({
            username,
            bio
          })
        }
      );

    user = data.user;

    render("profile");
  }catch(error){
    alert(error.message);
  }
}

async function logout(){
  try{
    await api(
      "/auth/logout",
      {
        method:"POST"
      }
    );
  }catch(error){
    console.warn(error);
  }

  user = null;
  currentTrack = null;
  audio.pause();

  render("profile");
}

function settings(el){
  el.innerHTML = \`
    <h1>Настройки</h1>

    <div class="form">

      <h2>Внешний вид</h2>

      <p>
        Тема:
        <strong>Тёмная</strong>
      </p>

      <p>
        Интерфейс:
        <strong>Fenix Music</strong>
      </p>

      <h2>Звук</h2>

      <p>
        Качество:
        <strong>Высокое</strong>
      </p>

      <p>
        Автоплей:
        <strong class="success">
          Включён
        </strong>
      </p>

      <p>
        Автоматический переход:
        <strong class="success">
          Включён
        </strong>
      </p>

    </div>
  \`;
}

load();

</script>

</body>
</html>`;

/* =========================================================
   WEBSITE ROUTE
========================================================= */

/*
   ВАЖНО:
   Сайт отдаётся прямо из index.js.

   Поэтому:
   frontend/build/index.html
   App.js
   React

   НЕ НУЖНЫ.
*/

app.get("/", (req, res) => {
  res
    .status(200)
    .type("html")
    .send(HTML);
});

/*
   Дополнительные frontend routes.
*/

app.get(
  ["/home", "/favorites", "/history", "/profile", "/settings"],
  (req, res) => {
    res
      .status(200)
      .type("html")
      .send(HTML);
  }
);

/* =========================================================
   API 404
========================================================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    error: "API route not found",
    path: req.path,
  });
});

/* =========================================================
   GLOBAL ERROR
========================================================= */

app.use((error, req, res, next) => {
  console.error("GLOBAL ERROR:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    ok: false,
    error: "Internal server error",
  });
});

/* =========================================================
   START
========================================================= */

async function start() {
  try {
    console.log("");
    console.log("========================================");
    console.log("🔥 FENIX MUSIC BACKEND");
    console.log("========================================");

    console.log("Connecting to PostgreSQL...");

    await initDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log("");
        console.log("========================================");
        console.log("✅ FENIX MUSIC ONLINE");
        console.log("========================================");
        console.log(
          "PORT:",
          PORT
        );
        console.log(
          "API:",
          "/api"
        );
        console.log(
          "HEALTH:",
          "/api/health"
        );
        console.log(
          "TRACKS:",
          "/api/tracks"
        );
        console.log(
          "SITE:",
          "/"
        );
        console.log("========================================");
        console.log("");
      }
    );
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("❌ FENIX MUSIC BACKEND FAILED TO START");
    console.error("========================================");
    console.error(error);
    console.error("========================================");

    process.exit(1);
  }
}

process.on(
  "SIGTERM",
  async () => {
    console.log("SIGTERM received");

    await pool.end();

    process.exit(0);
  }
);

process.on(
  "SIGINT",
  async () => {
    console.log("SIGINT received");

    await pool.end();

    process.exit(0);
  }
);

start();
