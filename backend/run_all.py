import asyncio
import os
import threading
import uvicorn
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE_DIR)
if BASE_DIR not in os.sys.path:
    os.sys.path.insert(0, BASE_DIR)


def run_bot():
    if not os.getenv("TELEGRAM_BOT_TOKEN"):
        print("[BOT] TELEGRAM_BOT_TOKEN is empty; bot disabled.")
        return
    try:
        from backend.telegram_bot.bot import run
        asyncio.run(run())
    except Exception as exc:
        print(f"[BOT] startup error: {exc}")


if __name__ == "__main__":
    threading.Thread(target=run_bot, daemon=True).start()
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.server:app", host="0.0.0.0", port=port)
