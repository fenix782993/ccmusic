# FENIX MUSIC Telegram Bot

## Files

- `backend/telegram_bot/bot.py` — bot + admin panel + MP3/cover upload
- `backend/telegram_bot/keyboards.py` — Telegram keyboards
- `render-worker.yaml` — optional separate Render Worker

## Environment variables

Required:

`TELEGRAM_BOT_TOKEN` — token from BotFather.

`TELEGRAM_ADMIN_IDS` — comma-separated numeric Telegram user IDs.

`DATABASE_URL` — the SAME PostgreSQL Internal Database URL used by the FENIX MUSIC Web Service.

Example:

`TELEGRAM_ADMIN_IDS=123456789`

## Local launch

From repository root:

`python -m backend.telegram_bot.bot`

## Render

Create a separate Background Worker and use:

Build:
`python -m pip install --upgrade pip && python -m pip install -r backend/requirements.txt`

Start:
`python -m backend.telegram_bot.bot`

The worker must use the same `DATABASE_URL` as the web service.

## Important storage note

This first version stores uploaded MP3 files and covers in `backend/media/`.

Render Free Web Service and Worker do not share a persistent filesystem. Therefore, if the bot is deployed as a separate Worker, files uploaded there are not automatically visible to the Web Service.

For a production setup, move audio/covers to object storage, or run the bot and API in one service with a persistent storage strategy.

The PostgreSQL records are shared, but the physical MP3 files are not.
