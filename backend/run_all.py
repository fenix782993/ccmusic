import asyncio
import importlib
import os
import sys
import traceback

import uvicorn


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


async def run_api():
    """
    Запуск FastAPI.
    API является основным процессом FENIX MUSIC.
    """
    config = uvicorn.Config(
        "backend.server:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "10000")),
        log_level="info",
    )

    server = uvicorn.Server(config)

    print("[RUN_ALL] Starting FastAPI...", flush=True)

    await server.serve()


async def run_bot():
    """
    Запуск Telegram-бота.

    Если Telegram Bot ещё не загружен в репозиторий,
    API продолжит работать.
    """

    try:
        bot_module = importlib.import_module(
            "backend.telegram_bot.bot"
        )

        bot_main = getattr(
            bot_module,
            "main",
            None
        )

        if bot_main is None:
            print(
                "[BOT] ERROR: function main() "
                "was not found in backend.telegram_bot.bot",
                flush=True,
            )
            return

        print(
            "[BOT] Telegram Bot module loaded",
            flush=True,
        )

        await bot_main()

    except ModuleNotFoundError as exc:
        if (
            exc.name == "backend.telegram_bot"
            or exc.name.startswith(
                "backend.telegram_bot."
            )
        ):
            print(
                "[BOT] Telegram Bot files are missing.",
                flush=True,
            )

            print(
                "[BOT] Expected:",
                flush=True,
            )

            print(
                "       backend/telegram_bot/bot.py",
                flush=True,
            )

            print(
                "[BOT] API will continue running.",
                flush=True,
            )

            return

        print(
            "[BOT] Module error:",
            str(exc),
            flush=True,
        )

        traceback.print_exc()

    except Exception as exc:
        print(
            "[BOT] Telegram Bot crashed:",
            str(exc),
            flush=True,
        )

        traceback.print_exc()

        print(
            "[BOT] API will continue running.",
            flush=True,
        )


async def main():
    print(
        "[RUN_ALL] Starting FENIX MUSIC API + Telegram Bot",
        flush=True,
    )

    api_task = asyncio.create_task(
        run_api()
    )

    bot_task = asyncio.create_task(
        run_bot()
    )

    # Бот больше не может положить весь Render-сервис.
    bot_task.add_done_callback(
        lambda task: (
            print(
                "[BOT] Bot task finished.",
                flush=True,
            )
            if not task.cancelled()
            else print(
                "[BOT] Bot task cancelled.",
                flush=True,
            )
        )
    )

    await api_task


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(
            "[RUN_ALL] Stopped",
            flush=True,
        )
