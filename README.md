# Fenix Music FULL

Один Render Web Service: Express раздает API и frontend/build.

## Render
Root Directory: пусто
Build Command:
npm install && cd frontend && npm install && npm run build

Start Command:
npm start

Environment:
DATABASE_URL = Internal Database URL PostgreSQL
NODE_ENV = production

## Важно
Аудио должно иметь прямой URL в `tracks.audio_url`. Без него `/api/tracks/:id/audio`
вернет 404 — это нормально, потому что backend не может сам создать музыкальные файлы.

После запуска:
/
 /api
 /api/health
 /api/tracks
