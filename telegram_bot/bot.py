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
from aiogram.types import CallbackQuery, Message, InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy import func, or_

from backend.server import SessionLocal, Track, User, scan_music, MUSIC_DIR, COVER_DIR, normalize_saved_path, metadata_from_file
from .keyboards import main_menu, admin_menu, cancel_menu, after_upload_menu, track_menu

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
log = logging.getLogger("fenix_music_bot")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
ADMIN_IDS = {int(x.strip()) for x in os.getenv("TELEGRAM_ADMIN_IDS", "").split(",") if x.strip().isdigit()}
bot = Bot(BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()


class States(StatesGroup):
    waiting_audio = State()
    waiting_cover = State()
    waiting_search = State()
    waiting_edit = State()


def is_admin(uid: int) -> bool:
    return uid in ADMIN_IDS


def db():
    return SessionLocal()


def fmt(seconds: int) -> str:
    seconds = int(seconds or 0)
    return f"{seconds // 60}:{seconds % 60:02d}"


def track_text(t: Track) -> str:
    return (f"🎵 <b>{t.title}</b>\n"
            f"👤 {t.artist}\n"
            f"💿 {t.album}\n"
            f"🎼 {t.genre or 'Pop'}\n"
            f"⏱ {fmt(t.duration)}\n"
            f"▶️ Прослушиваний: {t.plays or 0}")


def list_keyboard(rows):
    buttons = [[InlineKeyboardButton(text=f"🎵 {t.title[:35]} — {t.artist[:25]}", callback_data=f"track:{t.id}")] for t in rows]
    buttons.append([InlineKeyboardButton(text="⬅️ Назад", callback_data="admin")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


@dp.message(CommandStart())
async def start(message: Message):
    await message.answer(
        "🔥 <b>FENIX MUSIC</b>\n\n🎧 Управление музыкальной библиотекой.",
        reply_markup=main_menu(is_admin(message.from_user.id)),
    )


@dp.message(Command("admin"))
async def admin_cmd(message: Message):
    if not is_admin(message.from_user.id):
        await message.answer("⛔ Доступ запрещён.")
        return
    await message.answer("⚙️ <b>Админ-панель FENIX MUSIC</b>", reply_markup=admin_menu())


@dp.callback_query(F.data == "home")
async def home(c: CallbackQuery, state: FSMContext):
    await state.clear()
    await c.message.edit_text("🔥 <b>FENIX MUSIC</b>\n\nВыбери действие:", reply_markup=main_menu(is_admin(c.from_user.id)))
    await c.answer()


@dp.callback_query(F.data == "admin")
async def admin(c: CallbackQuery):
    if not is_admin(c.from_user.id):
        await c.answer("⛔ Доступ запрещён", show_alert=True); return
    await c.message.edit_text("⚙️ <b>Админ-панель</b>\n\nУправление музыкой.", reply_markup=admin_menu())
    await c.answer()


@dp.callback_query(F.data == "stats")
async def stats(c: CallbackQuery):
    if not is_admin(c.from_user.id):
        await c.answer("⛔ Доступ запрещён", show_alert=True); return
    d = db()
    try:
        users = d.query(func.count(User.id)).scalar() or 0
        tracks = d.query(func.count(Track.id)).scalar() or 0
        plays = d.query(func.coalesce(func.sum(Track.plays), 0)).scalar() or 0
        await c.message.edit_text(f"📊 <b>Статистика</b>\n\n👥 Пользователей: <b>{users}</b>\n🎵 Песен: <b>{tracks}</b>\n▶️ Прослушиваний: <b>{plays}</b>", reply_markup=admin_menu())
    finally:
        d.close()
    await c.answer()


@dp.callback_query(F.data.in_({"music", "new", "popular"}))
async def music_list(c: CallbackQuery):
    d = db()
    try:
        q = d.query(Track)
        if c.data == "popular":
            q = q.order_by(Track.plays.desc(), Track.id.desc()); title = "🔥 <b>Популярные</b>"
        elif c.data == "new":
            q = q.order_by(Track.created_at.desc(), Track.id.desc()); title = "🆕 <b>Новые</b>"
        else:
            q = q.order_by(Track.id.desc()); title = "🎵 <b>Все песни</b>"
        rows = q.limit(30).all()
        await c.message.edit_text(title + f"\n\nНайдено: {len(rows)}", reply_markup=list_keyboard(rows) if rows else admin_menu())
    finally:
        d.close()
    await c.answer()


@dp.callback_query(F.data.startswith("track:"))
async def show_track(c: CallbackQuery):
    try: tid = int(c.data.split(":", 1)[1])
    except ValueError: await c.answer("Ошибка", show_alert=True); return
    d = db()
    try:
        t = d.get(Track, tid)
        if not t:
            await c.answer("Песня не найдена", show_alert=True); return
        await c.message.edit_text(track_text(t), reply_markup=track_menu(t.id))
    finally: d.close()
    await c.answer()


@dp.callback_query(F.data == "upload")
async def upload_start(c: CallbackQuery, state: FSMContext):
    if not is_admin(c.from_user.id):
        await c.answer("⛔ Доступ запрещён", show_alert=True); return
    await state.set_state(States.waiting_audio)
    await c.message.edit_text("⬆️ <b>Добавление песни</b>\n\nОтправь MP3 как аудио или документ. Теги ID3 будут прочитаны автоматически.", reply_markup=cancel_menu())
    await c.answer()


@dp.message(States.waiting_audio, F.audio)
async def receive_audio(message: Message, state: FSMContext):
    await save_telegram_audio(message, message.audio.file_name, message.audio, state)


@dp.message(States.waiting_audio, F.document)
async def receive_document(message: Message, state: FSMContext):
    name = message.document.file_name or "audio.mp3"
    if Path(name).suffix.lower() not in {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac", ".opus"}:
        await message.answer("❌ Нужен аудиофайл: MP3/M4A/AAC/OGG/WAV/FLAC/OPUS."); return
    await save_telegram_audio(message, name, message.document, state)


async def save_telegram_audio(message: Message, original_name: str, tg_file, state: FSMContext):
    if not is_admin(message.from_user.id): return
    suffix = Path(original_name or ".mp3").suffix.lower() or ".mp3"
    filename = f"{uuid.uuid4().hex}_{re.sub(r'[^\\w\\-. ()А-Яа-яЁё]+', '_', Path(original_name or 'audio.mp3').name)}"
    target = MUSIC_DIR / filename
    try:
        await bot.download(tg_file, destination=target)
        title, artist, album, genre, duration = metadata_from_file(target)
        d = db()
        try:
            # Same physical file cannot create duplicates.
            existing = d.query(Track).filter(Track.audio_path == normalize_saved_path(target)).first()
            if existing:
                target.unlink(missing_ok=True)
                await message.answer("⚠️ Этот файл уже есть в библиотеке.", reply_markup=after_upload_menu(existing.id)); return
            t = Track(title=title, artist=artist, album=album, genre=genre, duration=duration, audio_path=normalize_saved_path(target), plays=0)
            d.add(t); d.commit(); d.refresh(t)
            await state.update_data(track_id=t.id)
            await message.answer("✅ <b>Песня добавлена</b>\n\n" + track_text(t), reply_markup=after_upload_menu(t.id))
        finally: d.close()
    except Exception as exc:
        target.unlink(missing_ok=True)
        log.exception("Telegram upload failed")
        await message.answer(f"❌ Ошибка загрузки:\n<code>{str(exc)[:1500]}</code>")
    finally:
        await state.clear()


@dp.callback_query(F.data.startswith("cover:"))
async def cover_start(c: CallbackQuery, state: FSMContext):
    if not is_admin(c.from_user.id): await c.answer("⛔ Доступ запрещён", show_alert=True); return
    tid = int(c.data.split(":",1)[1])
    d=db()
    try:
        if not d.get(Track, tid): await c.answer("Песня не найдена", show_alert=True); return
    finally: d.close()
    await state.set_state(States.waiting_cover); await state.update_data(track_id=tid)
    await c.message.edit_text("🖼 Отправь изображение JPG/PNG/WEBP.", reply_markup=cancel_menu()); await c.answer()


@dp.message(States.waiting_cover, F.photo)
async def receive_cover(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id): return
    data=await state.get_data(); tid=data.get("track_id")
    target=COVER_DIR/f"{tid}_{uuid.uuid4().hex}.jpg"
    await bot.download(message.photo[-1], destination=target)
    d=db()
    try:
        t=d.get(Track,tid)
        if not t: await message.answer("❌ Песня не найдена."); return
        if t.cover_url and t.cover_url.startswith("/api/media/covers/"):
            (COVER_DIR/Path(t.cover_url).name).unlink(missing_ok=True)
        t.cover_url=f"/api/media/covers/{target.name}"; d.commit()
        await message.answer("✅ Обложка сохранена.\n\n"+track_text(t), reply_markup=after_upload_menu(t.id))
    finally: d.close(); await state.clear()


@dp.callback_query(F.data.startswith("edit:"))
async def edit_start(c: CallbackQuery, state: FSMContext):
    if not is_admin(c.from_user.id): await c.answer("⛔ Доступ запрещён", show_alert=True); return
    tid=int(c.data.split(":",1)[1]); await state.set_state(States.waiting_edit); await state.update_data(track_id=tid)
    await c.message.edit_text("✏️ Отправь данные одной строкой:\n\n<b>Название | Исполнитель | Альбом | Жанр</b>\n\nПример: TAKETAKE | Избранный | Single | Pop", reply_markup=cancel_menu()); await c.answer()


@dp.message(States.waiting_edit, F.text)
async def receive_edit(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id): return
    data=await state.get_data(); tid=data.get("track_id"); parts=[x.strip() for x in message.text.split("|")]
    if len(parts)<4: await message.answer("❌ Формат: Название | Исполнитель | Альбом | Жанр"); return
    d=db()
    try:
        t=d.get(Track,tid)
        if not t: await message.answer("❌ Песня не найдена."); return
        t.title,t.artist,t.album,t.genre=[x[:255] for x in parts[:3]]+[parts[3][:100]]; d.commit()
        await message.answer("✅ Данные обновлены.\n\n"+track_text(t), reply_markup=after_upload_menu(t.id))
    finally: d.close(); await state.clear()


@dp.callback_query(F.data.startswith("delete:"))
async def delete(c: CallbackQuery):
    if not is_admin(c.from_user.id): await c.answer("⛔ Доступ запрещён", show_alert=True); return
    tid=int(c.data.split(":",1)[1]); d=db()
    try:
        t=d.get(Track,tid)
        if not t: await c.answer("Песня не найдена", show_alert=True); return
        path=Path(t.audio_path or "")
        if not path.is_absolute(): path=Path.cwd()/path
        path.unlink(missing_ok=True)
        if t.cover_url and t.cover_url.startswith("/api/media/covers/"): (COVER_DIR/Path(t.cover_url).name).unlink(missing_ok=True)
        d.delete(t); d.commit(); await c.message.edit_text("🗑 <b>Песня удалена.</b>", reply_markup=admin_menu())
    finally: d.close()
    await c.answer()


@dp.callback_query(F.data == "scan")
async def scan(c: CallbackQuery):
    if not is_admin(c.from_user.id): await c.answer("⛔ Доступ запрещён", show_alert=True); return
    d=db()
    try:
        r=scan_music(d); await c.message.edit_text(f"🔄 <b>Сканирование</b>\n\n🎵 Файлов: {r['found']}\n➕ Добавлено: {r['added']}\n✏️ Обновлено: {r['updated']}", reply_markup=admin_menu())
    finally: d.close()
    await c.answer()


@dp.callback_query(F.data == "search")
async def search_start(c: CallbackQuery, state: FSMContext):
    await state.set_state(States.waiting_search); await c.message.edit_text("🔎 Напиши название, исполнителя или альбом.", reply_markup=cancel_menu()); await c.answer()


@dp.message(States.waiting_search, F.text)
async def search(message: Message, state: FSMContext):
    q=message.text.strip(); pattern=f"%{q}%"; d=db()
    try:
        rows=d.query(Track).filter(or_(Track.title.ilike(pattern),Track.artist.ilike(pattern),Track.album.ilike(pattern),Track.genre.ilike(pattern))).order_by(Track.plays.desc()).limit(20).all()
        if not rows: await message.answer("❌ Ничего не найдено.", reply_markup=main_menu(is_admin(message.from_user.id))); return
        await message.answer(f"🔎 <b>Результаты:</b> {q}", reply_markup=list_keyboard(rows))
    finally: d.close(); await state.clear()


@dp.callback_query(F.data == "cancel")
async def cancel(c: CallbackQuery, state: FSMContext):
    await state.clear(); await c.message.edit_text("❌ Отменено.", reply_markup=admin_menu() if is_admin(c.from_user.id) else main_menu()); await c.answer()


async def main():
    if not BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
    log.info("[BOT] Starting FENIX MUSIC Telegram Bot")
    log.info("[BOT] Admin IDs: %s", sorted(ADMIN_IDS))
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())
