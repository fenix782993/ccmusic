# FENIX MUSIC Telegram Bot

## Render Environment

Add:

- `TELEGRAM_BOT_TOKEN` — token from BotFather
- `TELEGRAM_ADMIN_IDS` — comma-separated numeric Telegram IDs
- `DATABASE_URL` — the same PostgreSQL connection string used by the web service

## Start

`python -m backend.run_all`

The same Web Service runs FastAPI and the Telegram bot. Uploaded music is saved to `backend/media/music` and registered in the same PostgreSQL database.

## Important

Render Free local filesystem is ephemeral. For permanent music storage, connect object storage later. The bot and website are otherwise fully connected through the same service and database.
