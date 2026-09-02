import os
import threading
import uvicorn

from backend.server import app

def run_bot():
    from backend.telegram_bot.bot import run_bot
    run_bot()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))

    bot_thread = threading.Thread(
        target=run_bot,
        daemon=True,
    )
    bot_thread.start()

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
    )
