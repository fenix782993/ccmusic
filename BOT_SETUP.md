services:
  - type: worker
    name: fenix-music-bot
    runtime: python
    plan: free
    buildCommand: "python -m pip install --upgrade pip && python -m pip install -r backend/requirements.txt"
    startCommand: "python -m backend.telegram_bot.bot"
    envVars:
      - key: PYTHON_VERSION
        value: "3.12.8"
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: TELEGRAM_BOT_TOKEN
        sync: false
      - key: TELEGRAM_ADMIN_IDS
        sync: false
