
DROP TABLE IF EXISTS listening_history CASCADE;
DROP TABLE IF EXISTS playlist_tracks CASCADE;
DROP TABLE IF EXISTS playlists CASCADE;
DROP TABLE IF EXISTS tracks CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS artists CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
 id SERIAL PRIMARY KEY,
 username VARCHAR(50) UNIQUE NOT NULL,
 email VARCHAR(100) UNIQUE NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 avatar_url TEXT DEFAULT '',
 subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free','premium','premium_plus')),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artists (
 id SERIAL PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 bio TEXT,
 avatar_url TEXT
);

CREATE TABLE albums (
 id SERIAL PRIMARY KEY,
 title VARCHAR(150) NOT NULL,
 artist_id INT REFERENCES artists(id) ON DELETE CASCADE,
 cover_url TEXT,
 release_date DATE
);

CREATE TABLE tracks (
 id SERIAL PRIMARY KEY,
 title VARCHAR(150) NOT NULL,
 artist_id INT REFERENCES artists(id) ON DELETE CASCADE,
 album_id INT REFERENCES albums(id) ON DELETE SET NULL,
 duration INT NOT NULL DEFAULT 0,
 audio_url TEXT NOT NULL DEFAULT '',
 genre VARCHAR(50),
 plays_count INT DEFAULT 0,
 is_premium BOOLEAN DEFAULT FALSE,
 telegram_file_id TEXT,
 telegram_channel_id TEXT,
 telegram_message_id BIGINT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlists (
 id SERIAL PRIMARY KEY,
 user_id INT REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(100) NOT NULL,
 cover_url TEXT,
 is_public BOOLEAN DEFAULT TRUE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlist_tracks (
 playlist_id INT REFERENCES playlists(id) ON DELETE CASCADE,
 track_id INT REFERENCES tracks(id) ON DELETE CASCADE,
 added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE listening_history (
 id SERIAL PRIMARY KEY,
 user_id INT REFERENCES users(id) ON DELETE CASCADE,
 track_id INT REFERENCES tracks(id) ON DELETE CASCADE,
 played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tracks_genre ON tracks(genre);
CREATE INDEX idx_tracks_created ON tracks(created_at DESC);
CREATE INDEX idx_history_user ON listening_history(user_id);
CREATE INDEX idx_tracks_telegram_file ON tracks(telegram_file_id);
