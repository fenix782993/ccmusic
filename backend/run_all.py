import asyncio, os, threading, uvicorn
from dotenv import load_dotenv
load_dotenv()

def run_bot():
    if not os.getenv("TELEGRAM_BOT_TOKEN"):
        print("[BOT] TELEGRAM_BOT_TOKEN is empty; bot disabled.")
        return
    from .telegram_bot.bot import run
    asyncio.run(run())

if __name__ == "__main__":
    threading.Thread(target=run_bot, daemon=True).start()
    port=int(os.getenv("PORT","8000"))
    uvicorn.run("backend.server:app",host="0.0.0.0",port=port)
