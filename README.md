# FENIX MUSIC — FULL

Полноценная V3/FULL основа музыкальной платформы: React/Vite frontend + FastAPI + PostgreSQL + JWT + библиотека + плейлисты + история + поиск + загрузка аудио/обложек + админ API + Render + Docker.

## Структура

```text
fenix-music/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.js
│       └── styles.css
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── media/
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── render.yaml
├── package.json
└── README.md
```

## Возможности

### Frontend
- FENIX MUSIC premium dark/red UI
- Home / For You / Browse / Radio
- Search
- Tracks / artists / albums / playlists
- Favorites
- History
- Profile + stats
- Settings
- Queue
- Mini player
- Fullscreen player
- Responsive mobile UI
- Login / registration через API
- JWT token в localStorage

### Backend
- PostgreSQL/SQLite через SQLAlchemy
- JWT authentication
- bcrypt password hashing
- Users
- Admin users
- Tracks
- Search
- Recommendations
- Likes
- Listening history
- Playlists + playlist tracks
- Artist/album aggregation
- User statistics
- Audio upload
- Cover upload
- Audio streaming endpoint
- Admin track/user/stat endpoints
- CORS

## Локальный запуск без Docker

### Backend

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r backend/requirements.txt
uvicorn backend.server:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:8000
API docs: http://localhost:8000/docs

Для frontend можно создать `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api
```

## Docker

```bash
docker compose up --build
```

PostgreSQL: localhost:5432
API: http://localhost:8000

Локальный admin из compose:

```text
email: admin@fenixmusic.local
password: admin123456
```

После первого запуска обязательно поменяй пароль/секрет для реального сервера.

## Render

`render.yaml` создаёт Web Service + PostgreSQL + persistent disk для media.

В Render задай:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

`JWT_SECRET` генерируется автоматически.

Для отдельного frontend deployment:

```env
VITE_API_URL=https://YOUR-API.onrender.com/api
```

## Админ API

После входа admin используй Bearer JWT:

- `GET /api/admin/stats`
- `GET /api/admin/users`
- `POST /api/admin/tracks` — multipart: title, artist, album, genre, duration, audio, cover
- `DELETE /api/admin/tracks/{track_id}`

## Важное про музыку

Демо-каталог содержит только метаданные и внешние изображения. Реальные аудиофайлы загружаются через admin upload. Не загружай музыку, на которую у тебя нет прав.

Для большой production-библиотеки лучше вынести audio/covers в S3/R2/Bunny Storage/CDN. Render disk подходит для V1/V2 и небольшого каталога, но не является идеальной архитектурой для большой музыкальной платформы.
