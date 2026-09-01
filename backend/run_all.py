import asyncio
import os

import uvicorn

from backend.telegram_bot.bot import main as bot_main


async def run_api():
    config = uvicorn.Config(
        "backend.server:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "10000")),
        log_level="info",
    )
    server = uvicorn.Server(config)
    await server.serve()


async def main():
    await asyncio.gather(
        run_api(),
        bot_main(),
    )


if __name__ == "__main__":
    asyncio.run(main())
