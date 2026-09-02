import asyncio
import os
import threading

import uvicorn


def start_bot():
    from .telegram_bot.bot import run
    asyncio.run(run())


if __name__ == "__main__":
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if token:
        thread = threading.Thread(target=start_bot, name="fenix-telegram-bot", daemon=True)
        thread.start()
    else:
        print("[BOT] TELEGRAM_BOT_TOKEN is not set")

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=port,
        proxy_headers=True,
        forwarded_allow_ips="*",
    )
