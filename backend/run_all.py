import asyncio
import os
import sys

import uvicorn


# Корень проекта
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Добавляем backend в Python PATH
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


async def run_bot():
    """
    Запускает Telegram-бота.
    Импортируем bot напрямую из backend/telegram_bot/.
    """
    from telegram_bot.bot import main as bot_main

    await bot_main()


def run_api():
    """
    Запускает FastAPI.
    """
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "10000")),
        reload=False,
    )


async def main():
    """
    Одновременно запускает API и Telegram-бота.
    """

    api_task = asyncio.create_task(
        asyncio.to_thread(run_api)
    )

    bot_task = asyncio.create_task(
        run_bot()
    )

    await asyncio.gather(
        api_task,
        bot_task,
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass



if __name__ == "__main__":
    asyncio.run(main())
