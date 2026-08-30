const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'fenix_super_secret_key';

// Middleware auth
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Failed to authenticate token' });
    req.userId = decoded.id;
    req.isAdmin = decoded.isAdmin;
    next();
  });
}

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, username, email, subscription_tier',
      [username, email, phone, hashed]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, isAdmin: false }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, subscription_tier: user.subscription_tier, is_admin: user.is_admin } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin / Subscription by phone activation
app.post('/api/admin/subscription', verifyToken, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Access denied. Admins only.' });
  try {
    const { phone, tier } = req.body; // tier: 'premium' or 'premium_plus'
    const result = await pool.query(
      'UPDATE users SET subscription_tier = $1 WHERE phone = $2 RETURNING id, username, phone, subscription_tier',
      [tier, phone]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User with this phone not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get tracks & Search
app.get('/api/tracks', async (req, res) => {
  try {
    const { search, genre } = req.query;
    let query = `
      SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_url 
      FROM tracks t
      JOIN artists a ON t.artist_id = a.id
      LEFT JOIN albums al ON t.album_id = al.id
    `;
    let params = [];
    if (search) {
      query += ` WHERE t.title ILIKE $1 OR a.name ILIKE $1`;
      params.push(`%${search}%`);
    } else if (genre) {
      query += ` WHERE t.genre = $1`;
      params.push(genre);
    }
    query += ` ORDER BY t.plays_count DESC LIMIT 50`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Artist & Album details
app.get('/api/artists/:id', async (req, res) => {
  try {
    const artist = await pool.query('SELECT * FROM artists WHERE id = $1', [req.params.id]);
    const tracks = await pool.query('SELECT t.*, a.cover_url FROM tracks t LEFT JOIN albums a ON t.album_id = a.id WHERE t.artist_id = $1', [req.params.id]);
    const albums = await pool.query('SELECT * FROM albums WHERE artist_id = $1', [req.params.id]);
    res.json({ artist: artist.rows[0], tracks: tracks.rows, albums: albums.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audio Range Streaming endpoint simulation
app.get('/api/stream/:id', async (req, res) => {
  // In production, this proxies or serves from S3 with Range headers
  res.json({ streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Fenix Music V2 Backend running on port ${PORT}`));
