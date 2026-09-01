import asyncio
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Optional

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, FSInputFile, Message
from sqlalchemy import func

from backend.server import (
    SessionLocal,
    Track,
    User,
    scan_music,
    MUSIC_DIR,
    COVER_DIR,
)
from backend.telegram_bot.keyboards import (
    main_menu,
    admin_menu,
    cancel_menu,
    after_upload_menu,
    track_menu,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("fenix_music_bot")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

# Comma-separated Telegram numeric IDs:
# TELEGRAM_ADMIN_IDS=123456789,987654321
ADMIN_IDS = {
    int(x.strip())
    for x in os.getenv("TELEGRAM_ADMIN_IDS", "").split(",")
    if x.strip().isdigit()
}

if not BOT_TOKEN:
    log.warning("TELEGRAM_BOT_TOKEN is not set. Bot cannot start.")

bot = Bot(BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()


class UploadStates(StatesGroup):
    waiting_audio = State()
    waiting_cover = State()
    waiting_title = State()
    waiting_artist = State()
    waiting_album = State()
    waiting_genre = State()


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


def get_db():
    return SessionLocal()


def clean_text(value: Optional[str], fallback: str) -> str:
    value = (value or "").strip()
    return value or fallback


def parse_filename(filename: str):
    stem = Path(filename).stem
    if " - " in stem:
        artist, title = stem.split(" - ", 1)
        return clean_text(artist, "Unknown Artist"), clean_text(title, "Unknown Track")
    return "Unknown Artist", clean_text(stem, "Unknown Track")


def metadata_from_file(path: Path):
    artist, title = parse_filename(path.name)
    album = "Unknown Album"
    genre = ""
    duration = 0
    try:
        from mutagen import File as MutagenFile
        audio = MutagenFile(str(path), easy=False)
        if audio:
            duration = int(float(getattr(audio.info, "length", 0) or 0))
            tags = audio.tags
            if tags:
                def tag(*names):
                    for name in names:
                        if name in tags:
                            v = tags[name]
                            return str(v[0] if isinstance(v, list) else v)
                    return None
                artist = clean_text(tag("artist", "ARTIST", "\xa9ART"), artist)
                title = clean_text(tag("title", "TITLE", "\xa9nam"), title)
                album = clean_text(tag("album", "ALBUM", "\xa9alb"), album)
                genre = clean_text(tag("genre", "GENRE", "\xa9gen"), "")
    except Exception as exc:
        log.warning("Metadata read failed: %s", exc)
    return title, artist, album, genre, duration


def find_track(db, track_id: int):
    return db.query(Track).filter(Track.id == track_id).first()


def format_duration(seconds: int) -> str:
    seconds = int(seconds or 0)
    return f"{seconds // 60}:{seconds % 60:02d}"


def track_text(track: Track) -> str:
    return (
        f"🎵 <b>{track.title}</b>\n"
        f"👤 {track.artist or 'Unknown Artist'}\n"
        f"💿 {track.album or 'Unknown Album'}\n"
        f"🎼 {track.genre or '—'}\n"
        f"⏱ {format_duration(track.duration)}\n"
        f"▶️ Прослушиваний: {track.plays or 0}"
    )


@dp.message(CommandStart())
async def start(message: Message):
    text = (
        "🔥 <b>FENIX MUSIC</b>\n\n"
        "Музыкальный бот проекта.\n"
        "Здесь можно управлять музыкой и добавлять новые треки.\n\n"
    )
    if is_admin(message.from_user.id):
        text += "🔐 У тебя есть доступ администратора."
    else:
        text += "🎧 Добро пожаловать!"
    await message.answer(text, reply_markup=main_menu())


@dp.message(Command("admin"))
async def admin_command(message: Message):
    if not is_admin(message.from_user.id):
        await message.answer("⛔ Доступ запрещён.")
        return
    await message.answer(
        "⚙️ <b>Админ-панель FENIX MUSIC</b>",
        reply_markup=admin_menu(),
    )


@dp.callback_query(F.data == "home")
async def home(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "🔥 <b>FENIX MUSIC</b>\n\nВыбери действие:",
        reply_markup=main_menu(),
    )
    await callback.answer()


@dp.callback_query(F.data == "admin")
async def admin_panel(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещён.", show_alert=True)
        return
    await callback.message.edit_text(
        "⚙️ <b>Админ-панель</b>\n\n"
        "Управление музыкой FENIX MUSIC.",
        reply_markup=admin_menu(),
    )
    await callback.answer()


@dp.callback_query(F.data == "stats")
async def stats(callback: CallbackQuery):
    db = get_db()
    try:
        users = db.query(func.count(User.id)).scalar() or 0
        tracks = db.query(func.count(Track.id)).scalar() or 0
        plays = db.query(func.coalesce(func.sum(Track.plays), 0)).scalar() or 0
        await callback.message.edit_text(
            "📊 <b>FENIX MUSIC — статистика</b>\n\n"
            f"👥 Пользователей: <b>{users}</b>\n"
            f"🎵 Песен: <b>{tracks}</b>\n"
            f"▶️ Прослушиваний: <b>{plays}</b>",
            reply_markup=admin_menu() if is_admin(callback.from_user.id) else main_menu(),
        )
    finally:
        db.close()
    await callback.answer()


@dp.callback_query(F.data.in_({"music", "new", "popular"}))
async def list_tracks(callback: CallbackQuery):
    db = get_db()
    try:
        query = db.query(Track)
        if callback.data == "popular":
            query = query.order_by(Track.plays.desc(), Track.id.desc())
            title = "🔥 <b>Популярные песни</b>"
        elif callback.data == "new":
            query = query.order_by(Track.created_at.desc(), Track.id.desc())
            title = "🆕 <b>Новые песни</b>"
        else:
            query = query.order_by(Track.id.desc())
            title = "🎵 <b>Все песни</b>"
        tracks = query.limit(30).all()
        if not tracks:
            text = title + "\n\nПока песен нет."
            await callback.message.edit_text(
                text,
                reply_markup=admin_menu() if is_admin(callback.from_user.id) else main_menu(),
            )
            return
        buttons = []
        for track in tracks:
            buttons.append([
                __import__("aiogram").types.InlineKeyboardButton(
                    text=f"🎵 {track.title[:35]} — {track.artist[:25]}",
                    callback_data=f"track:{track.id}",
                )
            ])
        buttons.append([
            __import__("aiogram").types.InlineKeyboardButton(
                text="⬅️ Назад",
                callback_data="admin" if is_admin(callback.from_user.id) else "home",
            )
        ])
        from aiogram.types import InlineKeyboardMarkup
        await callback.message.edit_text(
            title + f"\n\nНайдено: {len(tracks)}",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        )
    finally:
        db.close()
    await callback.answer()


@dp.callback_query(F.data.startswith("track:"))
async def show_track(callback: CallbackQuery):
    track_id = int(callback.data.split(":", 1)[1])
    db = get_db()
    try:
        track = find_track(db, track_id)
        if not track:
            await callback.answer("Песня не найдена.", show_alert=True)
            return
        await callback.message.edit_text(
            track_text(track),
            reply_markup=track_menu(track.id),
        )
        if track.audio_path:
            path = Path(track.audio_path)
            if not path.is_absolute():
                path = Path.cwd() / path
            if path.exists():
                await callback.message.answer_audio(
                    FSInputFile(str(path)),
                    title=track.title,
                    performer=track.artist,
                )
    finally:
        db.close()
    await callback.answer()


@dp.callback_query(F.data == "upload")
async def upload_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещён.", show_alert=True)
        return
    await state.set_state(UploadStates.waiting_audio)
    await callback.message.edit_text(
        "⬆️ <b>Добавление песни</b>\n\n"
        "Отправь сюда MP3, M4A, AAC, OGG, WAV, FLAC или OPUS.\n\n"
        "Можно просто отправить аудиофайл — название, исполнитель и альбом "
        "будут взяты из тегов.",
        reply_markup=cancel_menu(),
    )
    await callback.answer()


@dp.message(UploadStates.waiting_audio, F.audio)
async def receive_audio(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    audio = message.audio
    ext = Path(audio.file_name or ".mp3").suffix.lower()
    allowed = {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac", ".opus"}
    if ext not in allowed:
        await message.answer("❌ Неподдерживаемый формат.")
        return

    filename = re.sub(r"[^a-zA-Z0-9а-яА-ЯёЁ._ -]+", "_", audio.file_name or f"{uuid.uuid4().hex}.mp3")
    filename = f"{uuid.uuid4().hex}_{filename}"
    target = MUSIC_DIR / filename

    await bot.download(audio, destination=target)

    title, artist, album, genre, duration = metadata_from_file(target)

    db = get_db()
    try:
        relative = str(target.resolve().relative_to(Path.cwd().resolve())).replace("\\", "/")
        track = Track(
            title=title,
            artist=artist,
            album=album,
            genre=genre,
            duration=duration,
            audio_path=relative,
            plays=0,
        )
        db.add(track)
        db.commit()
        db.refresh(track)

        await state.update_data(track_id=track.id)

        await message.answer(
            "✅ <b>Песня добавлена</b>\n\n" + track_text(track),
            reply_markup=after_upload_menu(track.id),
        )
    except Exception as exc:
        db.rollback()
        target.unlink(missing_ok=True)
        log.exception("Upload DB error")
        await message.answer(f"❌ Не удалось сохранить песню:\n<code>{exc}</code>")
    finally:
        db.close()

    await state.clear()


@dp.message(UploadStates.waiting_audio)
async def wrong_audio(message: Message):
    await message.answer("🎵 Отправь именно аудиофайл.")


@dp.callback_query(F.data.startswith("cover:"))
async def cover_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещён.", show_alert=True)
        return
    track_id = int(callback.data.split(":", 1)[1])
    db = get_db()
    try:
        if not find_track(db, track_id):
            await callback.answer("Песня не найдена.", show_alert=True)
            return
    finally:
        db.close()
    await state.set_state(UploadStates.waiting_cover)
    await state.update_data(track_id=track_id)
    await callback.message.edit_text(
        "🖼 <b>Обложка</b>\n\nОтправь фотографию JPG/PNG/WEBP.",
        reply_markup=cancel_menu(),
    )
    await callback.answer()


@dp.message(UploadStates.waiting_cover, F.photo)
async def receive_cover(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    track_id = data.get("track_id")
    photo = message.photo[-1]
    filename = f"{track_id}_{uuid.uuid4().hex}.jpg"
    target = COVER_DIR / filename
    await bot.download(photo, destination=target)

    db = get_db()
    try:
        track = find_track(db, track_id)
        if not track:
            await message.answer("❌ Песня не найдена.")
            return
        track.cover_url = f"/media/covers/{filename}"
        db.commit()
        await message.answer(
            "✅ Обложка сохранена.\n\n" + track_text(track),
            reply_markup=after_upload_menu(track.id),
        )
    finally:
        db.close()
    await state.clear()


@dp.callback_query(F.data.startswith("delete:"))
async def delete_track(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещён.", show_alert=True)
        return
    track_id = int(callback.data.split(":", 1)[1])
    db = get_db()
    try:
        track = find_track(db, track_id)
        if not track:
            await callback.answer("Песня не найдена.", show_alert=True)
            return

        path = Path(track.audio_path or "")
        if not path.is_absolute():
            path = Path.cwd() / path

        db.delete(track)
        db.commit()

        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass

        await callback.message.edit_text(
            "🗑 <b>Песня удалена.</b>",
            reply_markup=admin_menu(),
        )
    finally:
        db.close()
    await callback.answer()


@dp.callback_query(F.data == "scan")
async def scan_callback(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещён.", show_alert=True)
        return
    db = get_db()
    try:
        result = scan_music(db)
        await callback.message.edit_text(
            "🔄 <b>Сканирование завершено</b>\n\n"
            f"🎵 Найдено файлов: {result.get('found', 0)}\n"
            f"➕ Добавлено: {result.get('added', 0)}\n"
            f"✏️ Обновлено: {result.get('updated', 0)}",
            reply_markup=admin_menu(),
        )
    finally:
        db.close()
    await callback.answer()


@dp.callback_query(F.data == "search")
async def search_start(callback: CallbackQuery, state: FSMContext):
    await state.set_state("search")
    await callback.message.edit_text(
        "🔎 Напиши название песни, исполнителя или альбом.",
        reply_markup=cancel_menu(),
    )
    await callback.answer()


@dp.message(F.text, lambda message: message.text and message.text.startswith("/"))
async def ignore_unknown_command(message: Message):
    pass


@dp.message(lambda message: message.text and message.text.strip())
async def text_search(message: Message, state: FSMContext):
    current_state = await state.get_state()
    if current_state != "search":
        return

    q = message.text.strip()
    db = get_db()
    try:
        pattern = f"%{q}%"
        tracks = (
            db.query(Track)
            .filter(
                (Track.title.ilike(pattern)) |
                (Track.artist.ilike(pattern)) |
                (Track.album.ilike(pattern)) |
                (Track.genre.ilike(pattern))
            )
            .order_by(Track.plays.desc())
            .limit(20)
            .all()
        )
        if not tracks:
            await message.answer("❌ Ничего не найдено.", reply_markup=main_menu())
            return
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
        buttons = [
            [InlineKeyboardButton(
                text=f"🎵 {t.title[:35]} — {t.artist[:25]}",
                callback_data=f"track:{t.id}"
            )]
            for t in tracks
        ]
        buttons.append([InlineKeyboardButton(text="🏠 Главное меню", callback_data="home")])
        await message.answer(
            f"🔎 Результаты для <b>{q}</b>",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        )
    finally:
        db.close()
    await state.clear()


@dp.callback_query(F.data == "cancel")
async def cancel(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "❌ Действие отменено.",
        reply_markup=admin_menu() if is_admin(callback.from_user.id) else main_menu(),
    )
    await callback.answer()


async def main():
    if not BOT_TOKEN:
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN is not configured"
        )

    log.info("Starting FENIX MUSIC Telegram Bot")
    log.info("Admin IDs: %s", sorted(ADMIN_IDS))

    await dp.start_polling(
        bot,
        allowed_updates=dp.resolve_used_update_types(),
    )


if __name__ == "__main__":
    asyncio.run(main())
