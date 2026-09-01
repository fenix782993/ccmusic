import asyncio
import os
import sys

import uvicorn

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


async def run_api():
    config = uvicorn.Config(
        "backend.server:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "10000")),
        log_level="info",
    )
    server = uvicorn.Server(config)
    await server.serve()


async def run_bot():
    from backend.telegram_bot.bot import main as bot_main
    await bot_main()


async def main():
    print("[RUN_ALL] Starting FENIX MUSIC API + Telegram Bot", flush=True)
    await asyncio.gather(run_api(), run_bot())


if __name__ == "__main__":
    asyncio.run(main())
