const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Раздаем статику фронтенда из папки dist (если она собрана)
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

bot.start((ctx) => {
  ctx.reply(
    '🔥 Добро пожаловать в официальный бот **Fenix Music**!\n\n' +
    'Здесь вы можете загружать свои треки напрямую в нашу медиатеку, просто отправив аудиофайл в этот чат.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('🎵 Открыть сайт Fenix Music', 'https://ccmusice.onrender.com')]
      ])
    }
  );
});

bot.on('audio', async (ctx) => {
  try {
    const audio = ctx.message.audio;
    const fileId = audio.file_id;
    const fileName = audio.file_name || `track_${Date.now()}.mp3`;
    
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href);
    const buffer = await response.arrayBuffer();
    const filePath = path.join(uploadsDir, fileName);
    
    fs.writeFileSync(filePath, Buffer.from(buffer));

    ctx.reply(`✅ Трек *${fileName}* успешно загружен и добавлен в медиатеку Fenix Music!`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(error);
    ctx.reply('❌ Ошибка при загрузке трека. Попробуйте еще раз.');
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
    res.send('Fenix Music Server & Bot is running! Frontend dist folder not found yet.');
  });
}

bot.launch().then(() => {
  console.log('🤖 Telegram-бот запущен!');
});

app.listen(PORT, () => {
  console.log(`Сервер и сайт запущены на порту ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
