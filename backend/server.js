const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Создаем папку для загрузок
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.existsSync(uploadsDir) || fs.mkdirSync(uploadsDir, { recursive: true });
}

// Раздаем статику собранного фронтенда (например, из папки dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Telegram-бот: команда /start
bot.start((ctx) => {
  ctx.reply(
    '🔥 Добро пожаловать в официальный бот **Fenix Music**!\n\n' +
    'Здесь вы можете загружать свои треки в нашу медиатеку.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('🎵 Открыть Fenix Music', 'https://ccmusic-w6eg.onrender.com')]
      ])
    }
  );
});

// Обработка аудио от ботов
bot.on('audio', async (ctx) => {
  try {
    const audio = ctx.message.audio;
    const fileLink = await ctx.telegram.getFileLink(audio.file_id);
    const response = await fetch(fileLink.href);
    const buffer = await response.arrayBuffer();
    const fileName = audio.file_name || `track_${Date.now()}.mp3`;

    fs.writeFileSync(path.join(uploadsDir, fileName), Buffer.from(buffer));
    ctx.reply(`✅ Трек *${fileName}* успешно добавлен!`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(error);
    ctx.reply('❌ Ошибка при загрузке трека.');
  }
});

// Все остальные запросы отправляем на React-приложение (для роутинга)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Запуск бота и сервера
bot.launch().then(() => console.log('🤖 Бот запущен!'));

app.listen(PORT, () => {
  console.log(`Сервер и сайт запущены на порту ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
