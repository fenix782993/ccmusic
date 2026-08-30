const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test DB Connection & Simple endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Fenix Music API' });
});

// Get tracks (Feed / Popular / Search)
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
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// User Profile & Stats endpoint simulation
app.get('/api/profile/:id', async (req, res) => {
  try {
    const { id } = req.id || 1; // Default mock user 1
    const user = await pool.query('SELECT id, username, email, avatar_url, subscription_tier FROM users WHERE id = $1', [req.params.id]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Fenix Music Backend running on port ${PORT}`));
