# Fenix Music 2.0

## Flow
Telegram bot -> PostgreSQL -> Telegram channel -> `/api/tracks` -> web player.

Send an audio file to the bot. The backend stores Telegram `file_id`, inserts the track, posts it to the channel, and the site discovers it automatically every 10 seconds.

## Environment
Copy `backend/.env.example` to `.env` and set:
- DATABASE_URL
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHANNEL_ID
- PUBLIC_API_URL

The bot must be an administrator of the target channel with permission to post audio.

## Run
Backend:
`cd backend && npm install && npm start`

Frontend:
`cd frontend && npm install && npm start`

For production, build the frontend with `npm run build` and serve it from your chosen static host. Set `REACT_APP_API_URL` if frontend/backend are on different domains.

## Authentication
Registration creates a DB user and stores a salted scrypt password hash. Login verifies the hash and issues a 30-day server session token. CAPTCHA is regenerated for registration attempts.
