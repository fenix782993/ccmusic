import asyncio
import logging
import os
import re
import uuid
from pathlib import Path

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery,
    Message,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
)
from sqlalchemy import func, or_

from backend.server import (
    SessionLocal,
    Track,
    User,
    Like,
    History,
    Playlist,
    PlaylistTrack,
    scan_music,
    MUSIC_DIR,
    COVER_DIR,
    normalize_saved_path,
    metadata_from_file,
    resolve_audio_path,
)

from .keyboards import (
    main_menu,
    admin_menu,
    cancel_menu,
    after_upload_menu,
    track_menu,
    profile_menu,
    library_menu,
    back_menu,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

log = logging.getLogger("fenix_music_bot")


BOT_TOKEN = ""
ADMIN_IDS = set()

bot = None
dp = Dispatcher()


AUDIO_EXTENSIONS = {
    ".mp3",
    ".m4a",
    ".aac",
    ".ogg",
    ".wav",
    ".flac",
    ".opus",
}


class States(StatesGroup):
    waiting_audio = State()
    waiting_cover = State()
    waiting_search = State()
    waiting_edit = State()


def load_config():
    global BOT_TOKEN
    global ADMIN_IDS
    global bot

    BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

    raw_admin_ids = os.getenv(
        "TELEGRAM_ADMIN_IDS",
        "",
    )

    ADMIN_IDS = set()

    for value in raw_admin_ids.split(","):
        value = value.strip()

        if value.isdigit():
            ADMIN_IDS.add(int(value))

    if not BOT_TOKEN:
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN is not configured"
        )

    if not ADMIN_IDS:
        log.warning(
            "[BOT] TELEGRAM_ADMIN_IDS is empty. "
            "Admin panel will be unavailable."
        )

    bot = Bot(token=BOT_TOKEN)


def is_admin(uid: int) -> bool:
    return uid in ADMIN_IDS


def db():
    return SessionLocal()


def fmt(seconds: int) -> str:
    seconds = int(seconds or 0)
    return f"{seconds // 60}:{seconds % 60:02d}"


def track_text(t: Track) -> str:
    return (
        f"🎵 <b>{t.title}</b>\n"
        f"👤 {t.artist}\n"
        f"💿 {t.album}\n"
        f"🎼 {t.genre or 'Pop'}\n"
        f"⏱ {fmt(t.duration)}\n"
        f"▶️ Прослушиваний: {t.plays or 0}"
    )


def list_keyboard(rows, back="home"):
    buttons = []

    for t in rows:
        buttons.append(
            [
                InlineKeyboardButton(
                    text=(
                        f"🎵 {t.title[:35]} — "
                        f"{t.artist[:25]}"
                    ),
                    callback_data=f"track:{t.id}",
                )
            ]
        )

    buttons.append(
        [
            InlineKeyboardButton(
                text="⬅️ Назад",
                callback_data=back,
            )
        ]
    )

    return InlineKeyboardMarkup(
        inline_keyboard=buttons
    )


def track_action_keyboard(
    track_id: int,
    liked: bool = False,
    back="music",
):
    like_text = "💔 Убрать из избранного" if liked else "❤️ В избранное"

    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=like_text,
                    callback_data=f"like:{track_id}",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🎵 Открыть",
                    callback_data=f"track:{track_id}",
                )
            ],
            [
                InlineKeyboardButton(
                    text="⬅️ Назад",
                    callback_data=back,
                )
            ],
        ]
    )


def user_from_telegram(d, telegram_id: int):
    """
    На текущей схеме server.py отдельного telegram_id ещё нет.

    Поэтому Telegram-пользователь определяется:
    1. по username Telegram, если он совпадает с username сайта;
    2. иначе возвращается None.

    Это позволяет работать с существующей БД без изменения схемы.
    """
    tg_user = None

    try:
        tg_user = getattr(d, "_telegram_user", None)
    except Exception:
        pass

    return None


def find_user_by_telegram(d, message: Message):
    """
    Ищет пользователя сайта по Telegram username.

    Если username Telegram совпадает с username FENIX MUSIC,
    аккаунты считаются связанными.
    """
    username = (
        message.from_user.username
        if message.from_user
        else None
    )

    if not username:
        return None

    username = username.strip().lstrip("@")

    if not username:
        return None

    return (
        d.query(User)
        .filter(
            func.lower(User.username)
            == username.lower()
        )
        .first()
    )


def user_tracks_liked(d, user_id: int):
    rows = (
        d.query(Track)
        .join(
            Like,
            Like.track_id == Track.id,
        )
        .filter(
            Like.user_id == user_id
        )
        .order_by(
            Like.created_at.desc(),
            Track.id.desc(),
        )
        .limit(50)
        .all()
    )

    return rows


def user_history_tracks(d, user_id: int):
    rows = (
        d.query(History)
        .filter(
            History.user_id == user_id
        )
        .order_by(
            History.played_at.desc()
        )
        .limit(50)
        .all()
    )

    result = []

    seen = set()

    for row in rows:
        if row.track_id in seen:
            continue

        track = d.get(
            Track,
            row.track_id,
        )

        if track:
            result.append(track)
            seen.add(track.id)

    return result


def user_playlists(d, user_id: int):
    return (
        d.query(Playlist)
        .filter(
            Playlist.user_id == user_id
        )
        .order_by(
            Playlist.created_at.desc()
        )
        .all()
    )


# =========================================================
# START
# =========================================================


@dp.message(CommandStart())
async def start(message: Message):
    uid = message.from_user.id

    await message.answer(
        "🔥 <b>FENIX MUSIC</b>\n\n"
        "🎧 Музыкальная платформа.\n"
        "Выбери нужный раздел:",
        reply_markup=main_menu(
            is_admin(uid)
        ),
    )


# =========================================================
# ADMIN
# =========================================================


@dp.message(Command("admin"))
async def admin_cmd(message: Message):
    uid = message.from_user.id

    if not is_admin(uid):
        await message.answer(
            "⛔ Доступ запрещён."
        )
        return

    await message.answer(
        "⚙️ <b>Админ-панель FENIX MUSIC</b>",
        reply_markup=admin_menu(),
    )


@dp.callback_query(F.data == "admin")
async def admin(c: CallbackQuery):
    if not is_admin(c.from_user.id):
        await c.answer(
            "⛔ Доступ запрещён",
            show_alert=True,
        )
        return

    await c.message.edit_text(
        "⚙️ <b>Админ-панель</b>\n\n"
        "Управление музыкальной библиотекой.",
        reply_markup=admin_menu(),
    )

    await c.answer()


# =========================================================
# HOME
# =========================================================


@dp.callback_query(F.data == "home")
async def home(
    c: CallbackQuery,
    state: FSMContext,
):
    await state.clear()

    await c.message.edit_text(
        "🔥 <b>FENIX MUSIC</b>\n\n"
        "Выбери действие:",
        reply_markup=main_menu(
            is_admin(c.from_user.id)
        ),
    )

    await c.answer()


# =========================================================
# GLOBAL STATS
# =========================================================


@dp.callback_query(F.data == "stats")
async def stats(c: CallbackQuery):
    d = db()

    try:
        users = (
            d.query(
                func.count(User.id)
            ).scalar()
            or 0
        )

        tracks = (
            d.query(
                func.count(Track.id)
            ).scalar()
            or 0
        )

        plays = (
            d.query(
                func.coalesce(
                    func.sum(Track.plays),
                    0,
                )
            ).scalar()
            or 0
        )

        likes = (
            d.query(
                func.count(Like.id)
            ).scalar()
            or 0
        )

        playlists = (
            d.query(
                func.count(Playlist.id)
            ).scalar()
            or 0
        )

        if is_admin(c.from_user.id):
            text = (
                "📊 <b>Статистика FENIX MUSIC</b>\n\n"
                f"👥 Пользователей: <b>{users}</b>\n"
                f"🎵 Песен: <b>{tracks}</b>\n"
                f"▶️ Прослушиваний: <b>{plays}</b>\n"
                f"❤️ Лайков: <b>{likes}</b>\n"
                f"📚 Плейлистов: <b>{playlists}</b>"
            )

            keyboard = admin_menu()

        else:
            user = find_user_by_telegram(
                d,
                c.message,
            )

            if not user:
                text = (
                    "📊 <b>Статистика</b>\n\n"
                    "Чтобы получить личную статистику, "
                    "используй Telegram username, "
                    "совпадающий с username аккаунта FENIX MUSIC."
                )

                keyboard = main_menu()

            else:
                history_count = (
                    d.query(History)
                    .filter_by(
                        user_id=user.id
                    )
                    .count()
                )

                liked = (
                    d.query(Like)
                    .filter_by(
                        user_id=user.id
                    )
                    .count()
                )

                playlist_count = (
                    d.query(Playlist)
                    .filter_by(
                        user_id=user.id
                    )
                    .count()
                )

                minutes = int(
                    (
                        d.query(
                            func.coalesce(
                                func.sum(
                                    Track.duration
                                ),
                                0,
                            )
                        )
                        .join(
                            History,
                            History.track_id
                            == Track.id,
                        )
                        .filter(
                            History.user_id
                            == user.id
                        )
                        .scalar()
                        or 0
                    )
                    / 60
                )

                text = (
                    "📊 <b>Твоя статистика</b>\n\n"
                    f"👤 {user.username}\n\n"
                    f"▶️ Треков прослушано: "
                    f"<b>{history_count}</b>\n"
                    f"❤️ В избранном: "
                    f"<b>{liked}</b>\n"
                    f"📚 Плейлистов: "
                    f"<b>{playlist_count}</b>\n"
                    f"⏱ Прослушано минут: "
                    f"<b>{minutes}</b>"
                )

                keyboard = profile_menu()

        await c.message.edit_text(
            text,
            reply_markup=keyboard,
        )

    finally:
        d.close()

    await c.answer()


# =========================================================
# MUSIC / NEW / POPULAR
# =========================================================


@dp.callback_query(
    F.data.in_(
        {
            "music",
            "new",
            "popular",
        }
    )
)
async def music_list(c: CallbackQuery):
    d = db()

    try:
        q = d.query(Track)

        if c.data == "popular":
            q = q.order_by(
                Track.plays.desc(),
                Track.id.desc(),
            )
            title = "🔥 <b>Популярные</b>"
            back = "home"

        elif c.data == "new":
            q = q.order_by(
                Track.created_at.desc(),
                Track.id.desc(),
            )
            title = "🆕 <b>Новые</b>"
            back = "home"

        else:
            q = q.order_by(
                Track.id.desc()
            )
            title = "🎵 <b>Все песни</b>"
            back = "home"

        rows = q.limit(30).all()

        await c.message.edit_text(
            title
            + f"\n\nНайдено: {len(rows)}",
            reply_markup=(
                list_keyboard(
                    rows,
                    back=back,
                )
                if rows
                else main_menu(
                    is_admin(
                        c.from_user.id
                    )
                )
            ),
        )

    finally:
        d.close()

    await c.answer()


# =========================================================
# TRACK
# =========================================================


@dp.callback_query(
    F.data.startswith("track:")
)
async def show_track(c: CallbackQuery):
    try:
        tid = int(
            c.data.split(
                ":",
                1,
            )[1]
        )
    except (
        ValueError,
        IndexError,
    ):
        await c.answer(
            "Ошибка",
            show_alert=True,
        )
        return

    d = db()

    try:
        t = d.get(
            Track,
            tid,
        )

        if not t:
            await c.answer(
                "Песня не найдена",
                show_alert=True,
            )
            return

        liked = False

        user = find_user_by_telegram(
            d,
            c.message,
        )

        if user:
            liked = (
                d.query(Like)
                .filter_by(
                    user_id=user.id,
                    track_id=t.id,
                )
                .first()
                is not None
            )

        await c.message.edit_text(
            track_text(t),
            reply_markup=(
                track_action_keyboard(
                    t.id,
                    liked=liked,
                )
                if not is_admin(
                    c.from_user.id
                )
                else track_menu(t.id)
            ),
        )

    finally:
        d.close()

    await c.answer()


# =========================================================
# LIKE
# =========================================================


@dp.callback_query(
    F.data.startswith("like:")
)
async def toggle_like(c: CallbackQuery):
    try:
        tid = int(
            c.data.split(
                ":",
                1,
            )[1]
        )
    except (
        ValueError,
        IndexError,
    ):
        await c.answer(
            "Ошибка",
            show_alert=True,
        )
        return

    d = db()

    try:
        user = find_user_by_telegram(
            d,
            c.message,
        )

        if not user:
            await c.answer(
                "❗ Telegram не связан с аккаунтом FENIX MUSIC.",
                show_alert=True,
            )
            return

        track = d.get(
            Track,
            tid,
        )

        if not track:
            await c.answer(
                "Песня не найдена",
                show_alert=True,
            )
            return

        item = (
            d.query(Like)
            .filter_by(
                user_id=user.id,
                track_id=tid,
            )
            .first()
        )

        if item:
            d.delete(item)
            liked = False
            message = "💔 Убрано из избранного"
        else:
            d.add(
                Like(
                    user_id=user.id,
                    track_id=tid,
                )
            )
            liked = True
            message = "❤️ Добавлено в избранное"

        d.commit()

        await c.message.edit_text(
            track_text(track),
            reply_markup=track_action_keyboard(
                tid,
                liked=liked,
            ),
        )

        await c.answer(message)

    finally:
        d.close()


# =========================================================
# FAVORITES
# =========================================================


@dp.callback_query(F.data == "favorites")
async def favorites(c: CallbackQuery):
    d = db()

    try:
        user = find_user_by_telegram(
            d,
            c.message,
        )

        if not user:
            await c.message.edit_text(
                "❤️ <b>Избранное</b>\n\n"
                "Telegram ещё не связан с аккаунтом FENIX MUSIC.\n\n"
                "Username Telegram должен совпадать "
                "с username аккаунта сайта.",
                reply_markup=main_menu(
                    is_admin(
                        c.from_user.id
                    )
                ),
            )
            await c.answer()
            return

        rows = user_tracks_liked(
            d,
            user.id,
        )

        if not rows:
            await c.message.edit_text(
                "❤️ <b>Избранное</b>\n\n"
                "Здесь пока ничего нет.",
                reply_markup=library_menu(),
            )
            await c.answer()
            return

        await c.message.edit_text(
            f"❤️ <b>Избранное</b>\n\n"
            f"Треков: {len(rows)}",
            reply_markup=list_keyboard(
                rows,
                back="home",
            ),
        )

    finally:
        d.close()

    await c.answer()


# =========================================================
# HISTORY
# =========================================================


@dp.callback_query(F.data == "history")
async def history(c: CallbackQuery):
    d = db()

    try:
        user = find_user_by_telegram(
            d,
            c.message,
        )

        if not user:
            await c.message.edit_text(
                "🕘 <b>История</b>\n\n"
                "Telegram не связан с аккаунтом FENIX MUSIC.",
                reply_markup=main_menu(
                    is_admin(
                        c.from_user.id
                    )
                ),
            )
            await c.answer()
            return

        rows = user_history_tracks(
            d,
            user.id,
        )

        if not rows:
            await c.message.edit_text(
                "🕘 <b>История</b>\n\n"
                "История прослушиваний пуста.",
                reply_markup=library_menu(),
            )
            await c.answer()
            return

        await c.message.edit_text(
            f"🕘 <b>История</b>\n\n"
            f"Уникальных треков: {len(rows)}",
            reply_markup=list_keyboard(
                rows,
                back="home",
            ),
        )

    finally:
        d.close()

    await c.answer()


# =========================================================
# PLAYLISTS
# =========================================================


@dp.callback_query(F.data == "playlists")
async def playlists(c: CallbackQuery):
    d = db()

    try:
        user = find_user_by_telegram(
            d,
            c.message,
        )

        if not user:
            await c.message.edit_text(
                "📚 <b>Плейлисты</b>\n\n"
                "Telegram не связан с аккаунтом FENIX MUSIC.",
                reply_markup=main_menu(
                    is_admin(
                        c.from_user.id
                    )
                ),
            )
            await c.answer()
            return

        rows = user_playlists(
            d,
            user.id,
        )

        if not rows:
            await c.message.edit_text(
                "📚 <b>Плейлисты</b>\n\n"
                "У тебя пока нет плейлистов.\n\n"
                "Создавать и редактировать их можно "
                "на сайте FENIX MUSIC.",
                reply_markup=library_menu(),
            )
            await c.answer()
            return

        buttons = []

        for playlist in rows:
            count = (
                d.query(
                    func.count(
                        PlaylistTrack.id
                    )
                )
                .filter(
                    PlaylistTrack.playlist_id
                    == playlist.id
                )
                .scalar()
                or 0
            )

            buttons.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"📚 {playlist.name[:35]} "
                            f"({count})"
                        ),
                        callback_data=(
                            f"playlist:{playlist.id}"
                        ),
                    )
                ]
            )

        buttons.append(
            [
                InlineKeyboardButton(
                    text="⬅️ Назад",
                    callback_data="home",
                )
            ]
        )

        await c.message.edit_text(
            "📚 <b>Мои плейлисты</b>\n\n"
            f"Плейлистов: {len(rows)}",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=buttons
            ),
        )

    finally:
        d.close()

    await c.answer()


@dp.callback_query(
    F.data.startswith("playlist:")
)
async def show_playlist(c: CallbackQuery):
    try:
        pid = int(
            c.data.split(
                ":",
                1,
            )[1]
        )
    except (
        ValueError,
        IndexError,
    ):
        await c.answer(
            "Ошибка",
            show_alert=True,
        )
        return

    d = db()

    try:
        user = find_user_by_telegram(
            d,
            c.message,
        )

        if not user:
            await c.answer(
                "Аккаунт не связан",
                show_alert=True,
            )
            return

        playlist = (
            d.query(Playlist)
            .filter_by(
                id=pid,
                user_id=user.id,
            )
            .first()
        )

        if not playlist:
            await c.answer(
                "Плейлист не найден",
                show_alert=True,
            )
            return

        tracks = []

        entries = (
            d.query(PlaylistTrack)
            .filter_by(
                playlist_id=pid
            )
            .order_by(
                PlaylistTrack.position
            )
            .all()
        )

        for entry in entries:
            track = d.get(
                Track,
                entry.track_id,
            )

            if track:
                tracks.append(track)

        if not tracks:
            await c.message.edit_text(
                f"📚 <b>{playlist.name}</b>\n\n"
                "Плейлист пуст.",
                reply_markup=library_menu(),
            )
            await c.answer()
            return

        await c.message.edit_text(
            f"📚 <b>{playlist.name}</b>\n\n"
            f"Треков: {len(tracks)}",
            reply_markup=list_keyboard(
                tracks,
                back="playlists",
            ),
        )

    finally:
        d.close()

    await c.answer()


# =========================================================
# PROFILE
# =========================================================


@dp.callback_query(F.data == "profile")
async def profile(c: CallbackQuery):
    d = db()

    try:
        user = find_user_by_telegram(
            d,
            c.message,
        )

        if not user:
            await c.message.edit_text(
                "👤 <b>Профиль</b>\n\n"
                "Telegram не связан с аккаунтом FENIX MUSIC.\n\n"
                "Чтобы связать их сейчас, используй "
                "одинаковый username Telegram и сайта.",
                reply_markup=main_menu(
                    is_admin(
                        c.from_user.id
                    )
                ),
            )
            await c.answer()
            return

        liked = (
            d.query(Like)
            .filter_by(
                user_id=user.id
            )
            .count()
        )

        history_count = (
            d.query(History)
            .filter_by(
                user_id=user.id
            )
            .count()
        )

        playlist_count = (
            d.query(Playlist)
            .filter_by(
                user_id=user.id
            )
            .count()
        )

        await c.message.edit_text(
            "👤 <b>Профиль FENIX MUSIC</b>\n\n"
            f"👤 Username: <b>{user.username}</b>\n"
            f"📧 Email: <code>{user.email}</code>\n\n"
            f"❤️ Избранное: <b>{liked}</b>\n"
            f"🕘 Прослушиваний: <b>{history_count}</b>\n"
            f"📚 Плейлистов: <b>{playlist_count}</b>",
            reply_markup=profile_menu(),
        )

    finally:
        d.close()

    await c.answer()


# =========================================================
# SEARCH
# =========================================================


@dp.callback_query(F.data == "search")
async def search_start(
    c: CallbackQuery,
    state: FSMContext,
):
    await state.set_state(
        States.waiting_search
    )

    await c.message.edit_text(
        "🔎 <b>Поиск FENIX MUSIC</b>\n\n"
        "Напиши название песни, "
        "исполнителя, альбом или жанр.",
        reply_markup=cancel_menu(),
    )

    await c.answer()


@dp.message(
    States.waiting_search,
    F.text,
)
async def search(
    message: Message,
    state: FSMContext,
):
    q = message.text.strip()

    if not q:
        await message.answer(
            "❌ Введи поисковый запрос."
        )
        return

    pattern = f"%{q}%"

    d = db()

    try:
        rows = (
            d.query(Track)
            .filter(
                or_(
                    Track.title.ilike(pattern),
                    Track.artist.ilike(pattern),
                    Track.album.ilike(pattern),
                    Track.genre.ilike(pattern),
                )
            )
            .order_by(
                Track.plays.desc(),
                Track.id.desc(),
            )
            .limit(30)
            .all()
        )

        if not rows:
            await message.answer(
                "❌ Ничего не найдено.\n\n"
                f"Запрос: <b>{q}</b>",
                reply_markup=main_menu(
                    is_admin(
                        message.from_user.id
                    )
                ),
            )
            return

        await message.answer(
            f"🔎 <b>Результаты поиска</b>\n\n"
            f"Запрос: <b>{q}</b>\n"
            f"Найдено: <b>{len(rows)}</b>",
            reply_markup=list_keyboard(
                rows,
                back="home",
            ),
        )

    finally:
        d.close()
        await state.clear()


# =========================================================
# UPLOAD
# =========================================================


@dp.callback_query(F.data == "upload")
async def upload_start(
    c: CallbackQuery,
    state: FSMContext,
):
    if not is_admin(
        c.from_user.id
    ):
        await c.answer(
            "⛔ Доступ запрещён",
            show_alert=True,
        )
        return

    await state.set_state(
        States.waiting_audio
    )

    await c.message.edit_text(
        "⬆️ <b>Добавление песни</b>\n\n"
        "Отправь MP3 как аудио или документ.\n\n"
        "ID3-теги будут прочитаны автоматически.",
        reply_markup=cancel_menu(),
    )

    await c.answer()


@dp.message(
    States.waiting_audio,
    F.audio,
)
async def receive_audio(
    message: Message,
    state: FSMContext,
):
    await save_telegram_audio(
        message,
        message.audio.file_name,
        message.audio,
        state,
    )


@dp.message(
    States.waiting_audio,
    F.document,
)
async def receive_document(
    message: Message,
    state: FSMContext,
):
    name = (
        message.document.file_name
        or "audio.mp3"
    )

    if (
        Path(name)
        .suffix
        .lower()
        not in AUDIO_EXTENSIONS
    ):
        await message.answer(
            "❌ Нужен аудиофайл:\n"
            "MP3/M4A/AAC/OGG/WAV/FLAC/OPUS."
        )
        return

    await save_telegram_audio(
        message,
        name,
        message.document,
        state,
    )


async def save_telegram_audio(
    message: Message,
    original_name: str,
    tg_file,
    state: FSMContext,
):
    if not is_admin(
        message.from_user.id
    ):
        return

    original_name = (
        original_name
        or "audio.mp3"
    )

    clean_name = re.sub(
        r"[^\w\-. ()А-Яа-яЁё]+",
        "_",
        Path(original_name).name,
        flags=re.UNICODE,
    )

    suffix = (
        Path(clean_name)
        .suffix
        .lower()
    )

    if suffix not in AUDIO_EXTENSIONS:
        await message.answer(
            "❌ Неподдерживаемый формат."
        )
        return

    filename = (
        f"{uuid.uuid4().hex}_"
        f"{clean_name}"
    )

    target = MUSIC_DIR / filename

    try:
        await bot.download(
            tg_file,
            destination=target,
        )

        if not target.exists():
            raise RuntimeError(
                "Telegram file was not saved"
            )

        (
            title,
            artist,
            album,
            genre,
            duration,
        ) = metadata_from_file(
            target
        )

        d = db()

        try:
            normalized = (
                normalize_saved_path(
                    target
                )
            )

            existing = (
                d.query(Track)
                .filter(
                    Track.audio_path
                    == normalized
                )
                .first()
            )

            if existing:
                target.unlink(
                    missing_ok=True
                )

                await message.answer(
                    "⚠️ Этот файл уже есть "
                    "в библиотеке.",
                    reply_markup=after_upload_menu(
                        existing.id
                    ),
                )

                return

            t = Track(
                title=title,
                artist=artist,
                album=album,
                genre=genre,
                duration=duration,
                audio_path=normalized,
                plays=0,
            )

            d.add(t)
            d.commit()
            d.refresh(t)

            await state.update_data(
                track_id=t.id
            )

            await message.answer(
                "✅ <b>Песня добавлена</b>\n\n"
                + track_text(t),
                reply_markup=after_upload_menu(
                    t.id
                ),
            )

        finally:
            d.close()

    except Exception as exc:
        target.unlink(
            missing_ok=True
        )

        log.exception(
            "Telegram upload failed"
        )

        await message.answer(
            "❌ Ошибка загрузки:\n"
            f"<code>{str(exc)[:1500]}</code>"
        )

    finally:
        await state.clear()


# =========================================================
# COVER
# =========================================================


@dp.callback_query(
    F.data.startswith("cover:")
)
async def cover_start(
    c: CallbackQuery,
    state: FSMContext,
):
    if not is_admin(
        c.from_user.id
    ):
        await c.answer(
            "⛔ Доступ запрещён",
            show_alert=True,
        )
        return

    try:
        tid = int(
            c.data.split(
                ":",
                1,
            )[1]
        )
    except (
        ValueError,
        IndexError,
    ):
        await c.answer(
            "Ошибка",
            show_alert=True,
        )
        return

    d = db()

    try:
        if not d.get(
            Track,
            tid,
        ):
            await c.answer(
                "Песня не найдена",
                show_alert=True,
            )
            return
    finally:
        d.close()

    await state.set_state(
        States.waiting_cover
    )

    await state.update_data(
        track_id=tid
    )

    await c.message.edit_text(
        "🖼 <b>Новая обложка</b>\n\n"
        "Отправь JPG/PNG/WEBP.",
        reply_markup=cancel_menu(),
    )

    await c.answer()


@dp.message(
    States.waiting_cover,
    F.photo,
)
async def receive_cover(
    message: Message,
    state: FSMContext,
):
    if not is_admin(
        message.from_user.id
    ):
        return

    data = await state.get_data()
    tid = data.get("track_id")

    if not tid:
        await state.clear()
        await message.answer(
            "❌ Песня не выбрана."
        )
        return

    target = (
        COVER_DIR
        / f"{tid}_{uuid.uuid4().hex}.jpg"
    )

    try:
        await bot.download(
            message.photo[-1],
            destination=target,
        )

        d = db()

        try:
            t = d.get(
                Track,
                tid,
            )

            if not t:
                await message.answer(
                    "❌ Песня не найдена."
                )
                return

            if (
                t.cover_url
                and t.cover_url.startswith(
                    "/api/media/covers/"
                )
            ):
                old_cover = (
                    COVER_DIR
                    / Path(
                        t.cover_url
                    ).name
                )

                old_cover.unlink(
                    missing_ok=True
                )

            t.cover_url = (
                "/api/media/covers/"
                f"{target.name}"
            )

            d.commit()

            await message.answer(
                "✅ <b>Обложка сохранена</b>\n\n"
                + track_text(t),
                reply_markup=after_upload_menu(
                    t.id
                ),
            )

        finally:
            d.close()

    except Exception as exc:
        target.unlink(
            missing_ok=True
        )

        log.exception(
            "Cover upload failed"
        )

        await message.answer(
            "❌ Ошибка загрузки обложки:\n"
            f"<code>{str(exc)[:1000]}</code>"
        )

    finally:
        await state.clear()


# =========================================================
# EDIT
# =========================================================


@dp.callback_query(
    F.data.startswith("edit:")
)
async def edit_start(
    c: CallbackQuery,
    state: FSMContext,
):
    if not is_admin(
        c.from_user.id
    ):
        await c.answer(
            "⛔ Доступ запрещён",
            show_alert=True,
        )
        return

    try:
        tid = int(
            c.data.split(
                ":",
                1,
            )[1]
        )
    except (
        ValueError,
        IndexError,
    ):
        await c.answer(
            "Ошибка",
            show_alert=True,
        )
        return

    await state.set_state(
        States.waiting_edit
    )

    await state.update_data(
        track_id=tid
    )

    await c.message.edit_text(
        "✏️ <b>Редактирование</b>\n\n"
        "Отправь данные одной строкой:\n\n"
        "<b>Название | Исполнитель | Альбом | Жанр</b>\n\n"
        "Пример:\n"
        "TAKETAKE | Избранный | Single | Pop",
        reply_markup=cancel_menu(),
    )

    await c.answer()


@dp.message(
    States.waiting_edit,
    F.text,
)
async def receive_edit(
    message: Message,
    state: FSMContext,
):
    if not is_admin(
        message.from_user.id
    ):
        return

    data = await state.get_data()
    tid = data.get("track_id")

    parts = [
        x.strip()
        for x in message.text.split("|")
    ]

    if len(parts) < 4:
        await message.answer(
            "❌ Формат:\n"
            "Название | Исполнитель | "
            "Альбом | Жанр"
        )
        return

    d = db()

    try:
        t = d.get(
            Track,
            tid,
        )

        if not t:
            await message.answer(
                "❌ Песня не найдена."
            )
            return

        t.title = parts[0][:255]
        t.artist = parts[1][:255]
        t.album = parts[2][:255]
        t.genre = parts[3][:100]

        d.commit()

        await message.answer(
            "✅ <b>Данные обновлены</b>\n\n"
            + track_text(t),
            reply_markup=after_upload_menu(
                t.id
            ),
        )

    finally:
        d.close()
        await state.clear()


# =========================================================
# DELETE
# =========================================================


@dp.callback_query(
    F.data.startswith("delete:")
)
async def delete(c: CallbackQuery):
    if not is_admin(
        c.from_user.id
    ):
        await c.answer(
            "⛔ Доступ запрещён",
            show_alert=True,
        )
        return

    try:
        tid = int(
            c.data.split(
                ":",
                1,
            )[1]
        )
    except (
        ValueError,
        IndexError,
    ):
        await c.answer(
            "Ошибка",
            show_alert=True,
        )
        return

    d = db()

    try:
        t = d.get(
            Track,
            tid,
        )

        if not t:
            await c.answer(
                "Песня не найдена",
                show_alert=True,
            )
            return

        path = resolve_audio_path(
            t.audio_path
        )

        if path:
            path.unlink(
                missing_ok=True
            )

        if (
            t.cover_url
            and t.cover_url.startswith(
                "/api/media/covers/"
            )
        ):
            (
                COVER_DIR
                / Path(
                    t.cover_url
                ).name
            ).unlink(
                missing_ok=True
            )

        d.delete(t)
        d.commit()

        await c.message.edit_text(
            "🗑 <b>Песня удалена.</b>",
            reply_markup=admin_menu(),
        )

    finally:
        d.close()

    await c.answer()


# =========================================================
# SCAN
# =========================================================


@dp.callback_query(F.data == "scan")
async def scan(c: CallbackQuery):
    if not is_admin(
        c.from_user.id
    ):
        await c.answer(
            "⛔ Доступ запрещён",
            show_alert=True,
        )
        return

    d = db()

    try:
        result = scan_music(d)

        await c.message.edit_text(
            "🔄 <b>Сканирование завершено</b>\n\n"
            f"🎵 Файлов: {result['found']}\n"
            f"➕ Добавлено: {result['added']}\n"
            f"✏️ Обновлено: {result['updated']}",
            reply_markup=admin_menu(),
        )

    finally:
        d.close()

    await c.answer()


# =========================================================
# CANCEL
# =========================================================


@dp.callback_query(F.data == "cancel")
async def cancel(
    c: CallbackQuery,
    state: FSMContext,
):
    await state.clear()

    await c.message.edit_text(
        "❌ <b>Отменено.</b>",
        reply_markup=(
            admin_menu()
            if is_admin(
                c.from_user.id
            )
            else main_menu()
        ),
    )

    await c.answer()


# =========================================================
# FALLBACK AUDIO
# =========================================================


@dp.message(F.audio)
async def audio_without_upload_mode(
    message: Message,
):
    if not is_admin(
        message.from_user.id
    ):
        return

    await message.answer(
        "🎵 Файл получен.\n\n"
        "Сначала открой:\n"
        "/admin → ⬆️ Добавить песню\n\n"
        "Затем отправь MP3 ещё раз."
    )


@dp.message(F.document)
async def document_without_upload_mode(
    message: Message,
):
    if not is_admin(
        message.from_user.id
    ):
        return

    name = (
        message.document.file_name
        or ""
    )

    if (
        Path(name).suffix.lower()
        in AUDIO_EXTENSIONS
    ):
        await message.answer(
            "🎵 Файл получен.\n\n"
            "Открой /admin → "
            "⬆️ Добавить песню "
            "и отправь этот файл ещё раз."
        )


# =========================================================
# MAIN
# =========================================================


async def main():
    global bot

    load_config()

    log.info(
        "[BOT] Connecting to Telegram..."
    )

    me = await bot.get_me()

    log.info(
        "[BOT] FENIX MUSIC Telegram Bot: "
        "@%s (id=%s)",
        me.username,
        me.id,
    )

    log.info(
        "[BOT] Admin IDs: %s",
        sorted(ADMIN_IDS),
    )

    await bot.delete_webhook(
        drop_pending_updates=False
    )

    try:
        await dp.start_polling(
            bot,
            allowed_updates=(
                dp.resolve_used_update_types()
            ),
        )

    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
