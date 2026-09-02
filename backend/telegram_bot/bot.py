import os, asyncio, secrets
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy.orm import Session

from ..database import SessionLocal, init_db
from ..models import User, TelegramAuth, Track
from ..auth import hash_password
from ..server import AUDIO_DIR, resolve_path

TOKEN=os.getenv("TELEGRAM_BOT_TOKEN")

def menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌐 Открыть FENIX MUSIC", url=os.getenv("PUBLIC_URL","http://localhost:8000"))],
        [InlineKeyboardButton(text="👤 Мой профиль", callback_data="profile")],
        [InlineKeyboardButton(text="🎵 Мои загрузки", callback_data="uploads")],
    ])

async def start(message: Message):
    db=SessionLocal()
    try:
        arg=(message.text or "").split(maxsplit=1)[1] if len((message.text or "").split())>1 else ""
        if arg.startswith("auth_"):
            token=arg[5:]
            auth=db.query(TelegramAuth).filter(TelegramAuth.token==token).first()
            if not auth or auth.used or auth.expires_at < datetime.now(timezone.utc):
                await message.answer("❌ Ссылка авторизации недействительна или истекла.")
                return
            tg=message.from_user
            u=db.query(User).filter(User.telegram_id==tg.id).first()
            if not u:
                username=tg.username or tg.first_name or f"tg_{tg.id}"
                u=User(username=username,telegram_id=tg.id)
                db.add(u);db.commit();db.refresh(u)
            auth.telegram_id=tg.id
            auth.username=tg.username or tg.first_name
            auth.user_id=u.id
            auth.used=True
            db.commit()
            await message.answer("✅ Telegram подтверждён. Вернитесь на FENIX MUSIC — вход будет выполнен автоматически.",reply_markup=menu())
            return
        await message.answer("🔥 FENIX MUSIC\n\nМузыка, радио, плейлисты и ваш личный профиль.",reply_markup=menu())
    finally:
        db.close()

async def profile(cb: CallbackQuery):
    db=SessionLocal()
    try:
        u=db.query(User).filter(User.telegram_id==cb.from_user.id).first()
        if not u:
            await cb.answer("Сначала откройте ссылку входа с сайта.",show_alert=True); return
        count=db.query(Track).filter(Track.audio_path.like("media/%")).count()
        await cb.message.answer(f"👤 {u.username}\nID: {u.id}\n🎵 Треков в каталоге: {count}")
    finally:
        db.close()
    await cb.answer()

async def uploads(cb: CallbackQuery):
    db=SessionLocal()
    try:
        u=db.query(User).filter(User.telegram_id==cb.from_user.id).first()
        if not u:
            await cb.answer("Авторизуйтесь через сайт.",show_alert=True); return
        await cb.message.answer("🎵 Чтобы добавить песню, просто отправьте мне аудиофайл.")
    finally: db.close()
    await cb.answer()

async def audio(message: Message):
    if not message.audio:
        return
    db=SessionLocal()
    try:
        tg=message.from_user
        u=db.query(User).filter(User.telegram_id==tg.id).first()
        if not u:
            u=User(username=tg.username or tg.first_name or f"tg_{tg.id}",telegram_id=tg.id)
            db.add(u);db.commit();db.refresh(u)
        name=message.audio.file_name or f"{message.audio.file_unique_id}.mp3"
        ext=Path(name).suffix.lower()
        if ext not in {".mp3",".m4a",".aac",".ogg",".wav",".flac",".opus"}:
            await message.answer("❌ Неподдерживаемый формат."); return
        safe=f"{secrets.token_hex(12)}{ext}"
        dest=AUDIO_DIR/safe
        bot=message.bot
        await bot.download(message.audio,destination=dest)
        title=Path(name).stem
        tr=Track(title=title,artist=tg.username or tg.first_name or "Telegram",audio_path=dest.resolve().relative_to(AUDIO_DIR.parent.parent.resolve()).as_posix())
        db.add(tr);db.commit()
        await message.answer(f"✅ Загружено в FENIX MUSIC\n🎵 {title}\nID: {tr.id}")
    except Exception as e:
        await message.answer(f"❌ Ошибка загрузки: {e}")
    finally:
        db.close()

async def run():
    init_db()
    bot=Bot(TOKEN)
    dp=Dispatcher()
    dp.message.register(start,CommandStart())
    dp.message.register(start,Command("start"))
    dp.callback_query.register(profile,F.data=="profile")
    dp.callback_query.register(uploads,F.data=="uploads")
    dp.message.register(audio,F.audio)
    print("[BOT] FENIX MUSIC bot started")
    await dp.start_polling(bot)
