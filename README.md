# FENIX MUSIC — FULL REAL

Полный self-contained проект: FastAPI + SQLAlchemy + Telegram bot (aiogram 3) + responsive frontend.

## Возможности
- Регистрация и вход через Telegram-бота по одноразовой deep-link ссылке.
- Локальная регистрация по email/паролю.
- PostgreSQL или SQLite.
- Каталог треков.
- Поиск.
- Избранное.
- История.
- Плейлисты.
- Очередь и полноценный HTML5-плеер.
- MP3/M4A/AAC/OGG/WAV/FLAC/OPUS.
- HTTP Range для нормальной перемотки аудио.
- Обложки.
- Радио-раздел.
- Адаптивный интерфейс для телефона, планшета и ПК.
- Render-ready.
- Единое файловое хранилище для web и bot: запускать web и bot в одном Render service либо использовать один Persistent Disk.
- Админ-загрузка треков.
- Telegram-бот умеет добавлять аудиофайлы в каталог.

## Радио
В `backend/radio.py` добавлены:
- Retro FM — предоставленный HLS stream.
- Русское Радио — предоставленный MP3 stream.
- Радио Дача — текущий MP3 endpoint listen13.vdfm.ru:8000/dacha.

Если конкретный внешний поток изменится, замените URL в `backend/radio.py`.

## Локальный запуск

### Backend
Python 3.12:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
copy .env.example .env
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000
```

Откройте:
http://127.0.0.1:8000

### Telegram bot
Если хотите отдельный процесс локально:
```bash
python -m backend.telegram_bot.bot
```

На Render рекомендуется запускать web и bot вместе через `backend/run_all.py`, чтобы они видели один Persistent Disk.

## .env
Минимально:
```env
DATABASE_URL=sqlite:///./data/fenix.db
JWT_SECRET=change-me
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
ADMIN_EMAIL=admin@fenix.local
ADMIN_PASSWORD=change-me
MEDIA_DIR=./media
```

Для PostgreSQL:
```env
DATABASE_URL=postgresql+psycopg://user:password@host:5432/fenixmusic
```

## Render
`render.yaml` уже содержит один Web Service и Persistent Disk. Build собирает frontend, а запуск идёт через `backend/run_all.py`.

Важно: Render Persistent Disk хранит MP3/обложки между деплоями. Web и Telegram bot внутри одного сервиса используют один и тот же `/opt/render/project/src/media`.

## Telegram auth
На сайте нажмите "Войти через Telegram". Сервер создаст одноразовый токен и выдаст ссылку:
`https://t.me/<BOT>?start=auth_<token>`

Бот открывает подтверждение. После подтверждения аккаунт создаётся/связывается с Telegram ID. Сайт проверяет токен и авторизует пользователя.

## Лицензии музыки
Проект не содержит коммерческие аудиофайлы. Загружайте только музыку/контент, на который у вас есть права. Радио URL являются внешними потоками и могут меняться владельцами.
