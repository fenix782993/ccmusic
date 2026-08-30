-- Fenix Music Database Schema V2
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
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT DEFAULT '',
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'premium_plus')),
    is_admin BOOLEAN DEFAULT FALSE,
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
    duration INT NOT NULL,
    audio_url TEXT NOT NULL,
    genre VARCHAR(50),
    plays_count INT DEFAULT 0,
    is_premium BOOLEAN DEFAULT FALSE,
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
