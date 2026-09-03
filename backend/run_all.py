import asyncio
import os
import sys
import threading
from pathlib import Path

from dotenv import load_dotenv
import uvicorn

BASE_DIR = Path(__file__).resolve().parent.parent
os.chdir(BASE_DIR)
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

load_dotenv(BASE_DIR / ".env")

def run_bot():
    if not os.getenv("TELEGRAM_BOT_TOKEN"):
        print("[BOT] TELEGRAM_BOT_TOKEN is empty; bot disabled.")
        return
    try:
        from backend.telegram_bot.bot import run
        asyncio.run(run())
    except Exception as exc:
        print(f"[BOT] disabled after startup error: {exc}")

if __name__ == "__main__":
    if os.getenv("TELEGRAM_BOT_TOKEN"):
        threading.Thread(target=run_bot, daemon=True, name="fenix-telegram-bot").start()
    else:
        print("[BOT] TELEGRAM_BOT_TOKEN is empty; bot disabled.")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.server:app", host="0.0.0.0", port=port, proxy_headers=True)
