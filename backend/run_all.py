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


BOT_MODULE = "backend.telegram_bot.bot"
BOT_RESTART_DELAY = int(os.getenv("BOT_RESTART_DELAY", "5"))


async def run_api():
    """
    Постоянный запуск FastAPI.
    API является основным процессом FENIX MUSIC.
    """

    port = int(os.getenv("PORT", "10000"))

    config = uvicorn.Config(
        "backend.server:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True,
    )

    server = uvicorn.Server(config)

    print(
        f"[RUN_ALL] Starting FastAPI on port {port}...",
        flush=True,
    )

    await server.serve()


async def run_bot_once():
    """
    Один запуск Telegram-бота.
    """

    print(
        "[BOT] Loading Telegram Bot module...",
        flush=True,
    )

    try:
        bot_module = importlib.import_module(BOT_MODULE)

    except ModuleNotFoundError as exc:
        print(
            f"[BOT] ModuleNotFoundError: {exc}",
            flush=True,
        )

        if (
            exc.name == "backend.telegram_bot"
            or exc.name.startswith("backend.telegram_bot.")
        ):
            print(
                "[BOT] ERROR: Telegram bot files are missing.",
                flush=True,
            )

            print(
                "[BOT] Required structure:",
                flush=True,
            )

            print(
                "       backend/telegram_bot/__init__.py",
                flush=True,
            )

            print(
                "       backend/telegram_bot/bot.py",
                flush=True,
            )

            print(
                "       backend/telegram_bot/keyboards.py",
                flush=True,
            )

            return False

        traceback.print_exc()
        return False

    except Exception as exc:
        print(
            f"[BOT] Import error: {exc}",
            flush=True,
        )

        traceback.print_exc()
        return False

    bot_main = getattr(bot_module, "main", None)

    if bot_main is None:
        print(
            "[BOT] ERROR: main() was not found in "
            "backend.telegram_bot.bot",
            flush=True,
        )

        return False

    print(
        "[BOT] Telegram Bot module loaded successfully.",
        flush=True,
    )

    try:
        await bot_main()

        print(
            "[BOT] Bot main() finished.",
            flush=True,
        )

        return True

    except asyncio.CancelledError:
        print(
            "[BOT] Bot task cancelled.",
            flush=True,
        )

        raise

    except Exception as exc:
        print(
            f"[BOT] Telegram Bot crashed: {exc}",
            flush=True,
        )

        traceback.print_exc()

        return False


async def run_bot():
    """
    Постоянный watchdog Telegram-бота.

    Если бот падает из-за временной ошибки Telegram/API/сети,
    он автоматически запускается снова.
    """

    print(
        "[BOT] Telegram Bot watchdog started.",
        flush=True,
    )

    while True:
        try:
            result = await run_bot_once()

            if result:
                print(
                    "[BOT] Bot stopped normally.",
                    flush=True,
                )
            else:
                print(
                    "[BOT] Bot did not start or stopped with an error.",
                    flush=True,
                )

        except asyncio.CancelledError:
            print(
                "[BOT] Watchdog cancelled.",
                flush=True,
            )

            raise

        except Exception as exc:
            print(
                f"[BOT] Watchdog error: {exc}",
                flush=True,
            )

            traceback.print_exc()

        print(
            f"[BOT] Restarting in {BOT_RESTART_DELAY} seconds...",
            flush=True,
        )

        await asyncio.sleep(BOT_RESTART_DELAY)


async def main():
    print(
        "========================================",
        flush=True,
    )

    print(
        "[RUN_ALL] FENIX MUSIC",
        flush=True,
    )

    print(
        "[RUN_ALL] API + Telegram Bot",
        flush=True,
    )

    print(
        f"[RUN_ALL] BASE_DIR: {BASE_DIR}",
        flush=True,
    )

    print(
        f"[RUN_ALL] PROJECT_DIR: {PROJECT_DIR}",
        flush=True,
    )

    print(
        "========================================",
        flush=True,
    )

    api_task = asyncio.create_task(
        run_api(),
        name="fenix-api",
    )

    bot_task = asyncio.create_task(
        run_bot(),
        name="fenix-telegram-bot",
    )

    try:
        await asyncio.gather(
            api_task,
            bot_task,
        )

    except asyncio.CancelledError:
        print(
            "[RUN_ALL] Shutdown requested.",
            flush=True,
        )

        api_task.cancel()
        bot_task.cancel()

        await asyncio.gather(
            api_task,
            bot_task,
            return_exceptions=True,
        )

        raise

    except Exception as exc:
        print(
            f"[RUN_ALL] Fatal error: {exc}",
            flush=True,
        )

        traceback.print_exc()

        api_task.cancel()
        bot_task.cancel()

        await asyncio.gather(
            api_task,
            bot_task,
            return_exceptions=True,
        )

        raise


if __name__ == "__main__":
    try:
        asyncio.run(main())

    except KeyboardInterrupt:
        print(
            "[RUN_ALL] Stopped by user.",
            flush=True,
        )

    except Exception as exc:
        print(
            f"[RUN_ALL] Process stopped: {exc}",
            flush=True,
        )

        traceback.print_exc()
        raise
