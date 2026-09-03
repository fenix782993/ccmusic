# FENIX MUSIC V5 — PC + Mobile

Полный single-service проект: FastAPI + PostgreSQL + один `frontend/index.html`.

## Дизайн

Интерфейс сделан в стиле референса: тёмный premium UI, оранжевый FENIX, адаптивный iPhone/Android/PC layout, нижний плеер, полноэкранный плеер, поиск, коллекция, профиль, админка и радио.

## Музыка

Никаких выдуманных треков в интерфейсе нет.

Для постоянной музыки проекта используйте:

`backend/media/music/`

Пример:

`The Weeknd - Blinding Lights.mp3`

При старте сервер сканирует `audio`, `music` и `uploads` и добавляет новые файлы в БД.

Также администратор может загружать музыку через UI.

## Render

Build:

`pip install -r requirements.txt`

Start:

`python -m backend.run_all`

## Админ

Render Environment:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_USERNAME`

Если `FenixAdmin` уже существует в PostgreSQL, сервер использует существующего пользователя вместо создания дубля. Это исправляет `duplicate key value violates unique constraint idx_users_username_lower`.

## Telegram

Настройте `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `PUBLIC_URL`.

## Frontend

Вся UI-часть находится в одном файле:

`frontend/index.html`

React и `lucide-react` не требуются.
