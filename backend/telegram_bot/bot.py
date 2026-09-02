import os
import secrets
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

frfrom backend.database import SessionLocal, init_db
from backend.models import User, TelegramAuth, Track
from backend.server import AUDIO_DIR

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:8000")
BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "FenixMusicRabot").lstrip("@")


def menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌐 Открыть FENIX MUSIC", url=PUBLIC_URL)],
        [InlineKeyboardButton(text="👤 Мой профиль", callback_data="profile")],
        [InlineKeyboardButton(text="🎵 Мои загрузки", callback_data="uploads")],
    ])


async def start(message: Message):
    db = SessionLocal()
    try:
        parts = (message.text or "").split(maxsplit=1)
        arg = parts[1].strip() if len(parts) > 1 else ""

        if arg.startswith("auth_"):
            token = arg[5:]
            auth = db.query(TelegramAuth).filter(
                TelegramAuth.token == token
            ).first()

            expires = auth.expires_at if auth else None
            if expires and expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)

            if not auth or auth.used or not expires or expires < datetime.now(timezone.utc):
                await message.answer("❌ Ссылка авторизации недействительна или истекла.")
                return

            tg = message.from_user
            user = db.query(User).filter(
                User.telegram_id == tg.id
            ).first()

            if not user:
                user = User(
                    username=tg.username or tg.first_name or f"tg_{tg.id}",
                    telegram_id=tg.id,
                )
                db.add(user)
                db.flush()

            auth.telegram_id = tg.id
            auth.username = tg.username or tg.first_name
            auth.user_id = user.id
            auth.used = True
            db.commit()

            await message.answer(
                "✅ Telegram подтверждён. Вернитесь в FENIX MUSIC — вход выполнится автоматически.",
                reply_markup=menu(),
            )
            return

        await message.answer(
            "🔥 FENIX MUSIC\n\nМузыка, радио, плейлисты и ваш личный профиль.",
            reply_markup=menu(),
        )

    except Exception as exc:
        db.rollback()
        print(f"[BOT] /start error: {exc}")
        await message.answer("❌ Не удалось завершить авторизацию. Попробуйте ещё раз.")
    finally:
        db.close()


async def profile(cb: CallbackQuery):
    db = SessionLocal()
    try:
        user = db.query(User).filter(
            User.telegram_id == cb.from_user.id
        ).first()

        if not user:
            await cb.answer("Сначала войдите через FENIX MUSIC.", show_alert=True)
            return

        count = db.query(Track).count()
        await cb.message.answer(
            f"👤 {user.username}\n"
            f"ID: {user.id}\n"
            f"🎵 Треков в каталоге: {count}"
        )
        await cb.answer()
    finally:
        db.close()


async def uploads(cb: CallbackQuery):
    db = SessionLocal()
    try:
        user = db.query(User).filter(
            User.telegram_id == cb.from_user.id
        ).first()

        if not user:
            await cb.answer("Сначала войдите через FENIX MUSIC.", show_alert=True)
            return

        await cb.message.answer(
            "🎵 Отправьте мне аудиофайл — он будет добавлен в каталог FENIX MUSIC."
        )
        await cb.answer()
    finally:
        db.close()


async def audio(message: Message):
    if not message.audio:
        return

    db = SessionLocal()
    try:
        tg = message.from_user
        user = db.query(User).filter(
            User.telegram_id == tg.id
        ).first()

        if not user:
            user = User(
                username=tg.username or tg.first_name or f"tg_{tg.id}",
                telegram_id=tg.id,
            )
            db.add(user)
            db.flush()

        name = message.audio.file_name or f"{message.audio.file_unique_id}.mp3"
        ext = Path(name).suffix.lower()

        allowed = {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac", ".opus"}
        if ext not in allowed:
            await message.answer("❌ Неподдерживаемый формат.")
            return

        AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        dest = AUDIO_DIR / f"{secrets.token_hex(12)}{ext}"

        await message.bot.download(message.audio, destination=dest)

        base_dir = Path(__file__).resolve().parents[2]
        relative_audio = str(dest.relative_to(base_dir)).replace("\\", "/")

        track = Track(
            title=Path(name).stem,
            artist=tg.username or tg.first_name or "Telegram",
            album="",
            genre="",
            duration=0,
            audio_path=relative_audio,
        )
        db.add(track)
        db.commit()
        db.refresh(track)

        await message.answer(
            f"✅ Загружено в FENIX MUSIC\n🎵 {Path(name).stem}\nID: {track.id}"
        )

    except Exception as exc:
        db.rollback()
        print(f"[BOT] audio upload error: {exc}")
        await message.answer(f"❌ Ошибка загрузки: {exc}")
    finally:
        db.close()


async def run():
    if not TOKEN:
        print("[BOT] TELEGRAM_BOT_TOKEN is not set — bot is disabled")
        return

    init_db()
    bot = Bot(TOKEN)
    dp = Dispatcher()

    dp.message.register(start, CommandStart())
    dp.callback_query.register(profile, F.data == "profile")
    dp.callback_query.register(uploads, F.data == "uploads")
    dp.message.register(audio, F.audio)

    try:
        await bot.delete_webhook(drop_pending_updates=True)
        print(f"[BOT] @{BOT_USERNAME} started in polling mode")
        await dp.start_polling(
            bot,
            allowed_updates=dp.resolve_used_update_types(),
        )
    finally:
        await bot.session.close()
