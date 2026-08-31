const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Подключение к базе данных PostgreSQL (Render автоматически создает DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Создаем таблицу для треков при запуске, если её еще нет
pool.query(`
  CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    file_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Ошибка создания таблицы:', err));

// ID вашего закрытого канала, куда бот будет скидывать треки
const CHANNEL_ID = process.env.CHANNEL_ID;

// Раздаем статику фронтенда (папка build после сборки)
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

bot.start((ctx) => {
  ctx.reply(
    '🔥 Добро пожаловать в официальный бот **Fenix Music**!\n\n' +
    'Просто отправьте сюда аудиофайл (трек), и он автоматически появится на нашем сайте.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('🎵 Открыть сайт Fenix Music', 'https://ccmusice.onrender.com')]
      ])
    }
  );
});

// Автоматическая обработка и сохранение трека
bot.on('audio', async (ctx) => {
  console.log('🎉 СРАБОТАЛ ЕВЕНТ AUDIO! Получен файл от пользователя:', ctx.from.id);
  try {
    const audio = ctx.message.audio;
    const fileId = audio.file_id;
    const title = audio.title || audio.file_name || `Трек_${Date.now()}`;
    console.log('Название трека:', title);

    if (!CHANNEL_ID) {
      console.log('ОШИБКА: Не задан CHANNEL_ID!');
      return ctx.reply('⚠️ Ошибка конфигурации: не указан CHANNEL_ID в переменных окружения бота.');
    }

    // 1. Пересылаем трек в закрытый канал для надежного хранения
    const forwardedMsg = await ctx.telegram.forwardMessage(CHANNEL_ID, ctx.chat.id, ctx.message.message_id);
    const channelFileId = forwardedMsg.audio.file_id;

    // 2. Автоматически сохраняем в базу данных PostgreSQL
    await pool.query(
      'INSERT INTO tracks (title, file_id) VALUES ($1, $2)',
      [title, channelFileId]
    );

    ctx.reply(`✅ Трек *"${title}"* успешно добавлен в медиатеку и опубликован на сайте!`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА ВНУТРИ АУДИО:', error);
    ctx.reply('❌ Произошла ошибка при сохранении трека. Попробуйте еще раз.');
  }
});

// API для получения списка треков на сайт
app.get('/api/tracks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tracks ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения треков:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (fs.existsSync(distDir)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Fenix Music Server & Bot is running!');
  });
}

bot.launch().then(() => {
  console.log('🤖 Telegram-бот запущен и готов сохранять треки!');
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
