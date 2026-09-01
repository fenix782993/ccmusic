import asyncio
import json
import logging
import os
import uuid

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    Message,
    CallbackQuery,
    FSInputFile,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)

from sqlalchemy import func

from backend.server import (
    SessionLocal,
    User,
    Track,
    Like,
    History,
    Playlist,
    PlaylistTrack,
    resolve_audio_path,
    scan_music,
    metadata_from_file,
    AUDIO_DIR,
    COVER_DIR,
)


# ============================================================
# CONFIG
# ============================================================

BOT_TOKEN = os.getenv(
    "TELEGRAM_BOT_TOKEN",
    "",
).strip()

if not BOT_TOKEN:
    raise RuntimeError(
        "TELEGRAM_BOT_TOKEN is not configured"
    )


TELEGRAM_ADMIN_IDS = set()

for value in os.getenv(
    "TELEGRAM_ADMIN_IDS",
    "",
).split(","):

    value = value.strip()

    if not value:
        continue

    try:
        TELEGRAM_ADMIN_IDS.add(int(value))
    except ValueError:
        pass


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format=(
        "%(asctime)s | "
        "%(levelname)s | "
        "%(name)s | "
        "%(message)s"
    ),
)

logger = logging.getLogger(
    "fenix_music_bot"
)


# ============================================================
# BOT
# ============================================================

bot = Bot(
    token=BOT_TOKEN,
)

dp = Dispatcher()


# ============================================================
# FSM
# ============================================================

class SearchState(StatesGroup):
    waiting_query = State()


class PlaylistState(StatesGroup):
    waiting_name = State()
    waiting_description = State()


class UploadState(StatesGroup):
    waiting_audio = State()


# ============================================================
# HELPERS
# ============================================================

def db_session():
    return SessionLocal()


def tg_id(message_or_callback) -> str:
    user = (
        message_or_callback.from_user
        if hasattr(
            message_or_callback,
            "from_user",
        )
        else None
    )

    return str(
        user.id
        if user
        else 0
    )


def is_env_admin(
    tg_user_id: int,
) -> bool:

    return tg_user_id in TELEGRAM_ADMIN_IDS


def get_user_by_telegram(
    db,
    telegram_id: str,
):
    return (
        db.query(User)
        .filter(
            User.telegram_id == str(
                telegram_id
            )
        )
        .first()
    )


def get_user_by_link_token(
    db,
    token: str,
):
    return (
        db.query(User)
        .filter(
            User.telegram_link_token == token
        )
        .first()
    )


def is_admin_user(
    user,
    telegram_id: int,
) -> bool:

    if not user:
        return is_env_admin(
            telegram_id
        )

    return bool(
        user.is_admin
        or is_env_admin(telegram_id)
    )


def duration_label(
    seconds: int,
) -> str:

    seconds = int(
        seconds or 0
    )

    return (
        f"{seconds // 60}:"
        f"{seconds % 60:02d}"
    )


def escape_html(
    value,
) -> str:

    value = str(
        value or ""
    )

    return (
        value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def track_text(
    track: Track,
    rank: Optional[int] = None,
) -> str:

    prefix = (
        f"#{rank} "
        if rank
        else ""
    )

    lyrics = bool(
        (track.lyrics or "").strip()
    )

    return (
        f"🎵 <b>{prefix}"
        f"{escape_html(track.title)}</b>\n"
        f"👤 {escape_html(track.artist)}\n"
        f"💿 {escape_html(track.album)}\n"
        f"🎼 {escape_html(track.genre or 'Pop')}\n"
        f"⏱ {duration_label(track.duration)}\n"
        f"▶️ Прослушиваний: "
        f"<b>{int(track.plays or 0)}</b>"
        f"\n"
        f"{'📝 Текст доступен' if lyrics else ''}"
    ).strip()


def parse_lyrics(
    track: Track,
) -> str:

    text = (
        track.lyrics
        or ""
    ).strip()

    if text:
        return text

    synced = (
        track.lyrics_sync
        or ""
    ).strip()

    if not synced:
        return ""

    try:

        data = json.loads(
            synced
        )

        if not isinstance(
            data,
            list,
        ):
            return ""

        lines = []

        for item in data:

            if not isinstance(
                item,
                dict,
            ):
                continue

            text = str(
                item.get(
                    "text",
                    "",
                )
            ).strip()

            if text:
                lines.append(text)

        return "\n".join(lines)

    except Exception:
        return ""


# ============================================================
# KEYBOARDS
# ============================================================

def main_menu(
    user=None,
    telegram_id: int = 0,
) -> InlineKeyboardMarkup:

    rows = [
        [
            InlineKeyboardButton(
                text="🎵 Музыка",
                callback_data="music",
            ),
            InlineKeyboardButton(
                text="🔥 Популярные",
                callback_data="popular",
            ),
        ],
        [
            InlineKeyboardButton(
                text="🆕 Новые",
                callback_data="new",
            ),
            InlineKeyboardButton(
                text="🔎 Поиск",
                callback_data="search",
            ),
        ],
        [
            InlineKeyboardButton(
                text="❤️ Избранное",
                callback_data="favorites",
            ),
            InlineKeyboardButton(
                text="📂 Плейлисты",
                callback_data="playlists",
            ),
        ],
        [
            InlineKeyboardButton(
                text="🕘 История",
                callback_data="history",
            ),
            InlineKeyboardButton(
                text="👤 Профиль",
                callback_data="profile",
            ),
        ],
        [
            InlineKeyboardButton(
                text="📊 Статистика",
                callback_data="stats",
            ),
            InlineKeyboardButton(
                text="📈 Чарты",
                callback_data="charts",
            ),
        ],
    ]

    if is_admin_user(
        user,
        telegram_id,
    ):

        rows.append(
            [
                InlineKeyboardButton(
                    text="⚙️ Админ-панель",
                    callback_data="admin",
                )
            ]
        )

    return InlineKeyboardMarkup(
        inline_keyboard=rows
    )


def back_home_keyboard():

    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🏠 Главное меню",
                    callback_data="home",
                )
            ]
        ]
    )


def track_keyboard(
    track_id: int,
    liked: bool = False,
    show_playlist: bool = True,
    show_lyrics: bool = True,
):

    rows = [
        [
            InlineKeyboardButton(
                text="▶️ Слушать",
                callback_data=f"play:{track_id}",
            ),
            InlineKeyboardButton(
                text=(
                    "💔 Убрать"
                    if liked
                    else "❤️ В избранное"
                ),
                callback_data=f"like:{track_id}",
            ),
        ]
    ]

    if show_lyrics:
        rows.append(
            [
                InlineKeyboardButton(
                    text="📝 Текст",
                    callback_data=f"lyrics:{track_id}",
                )
            ]
        )

    if show_playlist:
        rows.append(
            [
                InlineKeyboardButton(
                    text="📂 В плейлист",
                    callback_data=f"addpl:{track_id}",
                )
            ]
        )

    rows.append(
        [
            InlineKeyboardButton(
                text="⬅️ Назад",
                callback_data="music",
            )
        ]
    )

    return InlineKeyboardMarkup(
        inline_keyboard=rows
    )


def charts_keyboard():

    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🔥 Всё время",
                    callback_data="charts:all",
                )
            ],
            [
                InlineKeyboardButton(
                    text="📅 Сегодня",
                    callback_data="charts:day",
                ),
                InlineKeyboardButton(
                    text="📆 Неделя",
                    callback_data="charts:week",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="🗓 Месяц",
                    callback_data="charts:month",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🏠 Меню",
                    callback_data="home",
                )
            ],
        ]
    )


def admin_menu():

    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="⬆️ Добавить песню",
                    callback_data="upload",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🎵 Все песни",
                    callback_data="music",
                ),
                InlineKeyboardButton(
                    text="🔥 Популярные",
                    callback_data="popular",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="🆕 Новые",
                    callback_data="new",
                ),
                InlineKeyboardButton(
                    text="🔄 Сканировать",
                    callback_data="scan",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="📊 Статистика",
                    callback_data="admin_stats",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🏠 Главное меню",
                    callback_data="home",
                )
            ],
        ]
    )


def playlist_keyboard(
    playlist_id: int,
):

    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎵 Треки",
                    callback_data=f"playlist:{playlist_id}",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🗑 Удалить",
                    callback_data=f"delpl:{playlist_id}",
                )
            ],
            [
                InlineKeyboardButton(
                    text="⬅️ Плейлисты",
                    callback_data="playlists",
                )
            ],
        ]
    )


# ============================================================
# USER RESOLUTION
# ============================================================

async def require_linked_user(
    message: Message,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                message.from_user.id
            ),
        )

        if not user:

            await message.answer(
                "🔐 <b>Telegram не привязан</b>\n\n"
                "Открой профиль на сайте FENIX MUSIC "
                "и создай код привязки Telegram.\n\n"
                "После этого отправь сюда:\n"
                "<code>/link ТВОЙ_КОД</code>",
                parse_mode="HTML",
            )

            return None

        return user

    finally:

        db.close()


# ============================================================
# START
# ============================================================

@dp.message(
    CommandStart()
)
async def cmd_start(
    message: Message,
):

    args = (
        message.text or ""
    ).split(
        maxsplit=1
    )

    # /start TOKEN
    # Оставляем deep-link привязку рабочей.
    if len(args) > 1:

        token = args[1].strip()

        await link_account(
            message,
            token,
        )

        return

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                message.from_user.id
            ),
        )

        # ====================================================
        # ГЛАВНОЕ ИЗМЕНЕНИЕ:
        # обычный /start БОЛЬШЕ НЕ ПОКАЗЫВАЕТ
        # инструкцию Telegram-привязки.
        #
        # Даже если пользователь не привязан,
        # ему сразу показывается главное меню.
        # ====================================================

        if user:

            text = (
                "🎵 <b>FENIX MUSIC</b>\n\n"
                f"Привет, "
                f"<b>{escape_html(user.username)}</b>! 👋\n\n"
                "Выбирай действие:"
            )

        else:

            text = (
                "🎵 <b>FENIX MUSIC</b>\n\n"
                "Добро пожаловать! 👋\n\n"
                "Выбирай нужный раздел:"
            )

        await message.answer(
            text,
            reply_markup=main_menu(
                user,
                message.from_user.id,
            ),
            parse_mode="HTML",
        )

    finally:

        db.close()


# ============================================================
# LINK
# ============================================================

@dp.message(
    Command("link")
)
async def cmd_link(
    message: Message,
):

    parts = (
        message.text or ""
    ).split(
        maxsplit=1
    )

    if len(parts) != 2:

        await message.answer(
            "❌ Использование:\n"
            "<code>/link TOKEN</code>",
            parse_mode="HTML",
        )

        return

    await link_account(
        message,
        parts[1].strip(),
    )


async def link_account(
    message: Message,
    token: str,
):

    if not token:

        await message.answer(
            "❌ Пустой код привязки."
        )

        return

    db = db_session()

    try:

        user = get_user_by_link_token(
            db,
            token,
        )

        if not user:

            await message.answer(
                "❌ Код привязки недействителен.\n\n"
                "Создай новый код на сайте."
            )

            return

        expires = (
            user.telegram_link_expires_at
        )

        if not expires:

            await message.answer(
                "❌ Код привязки уже недействителен."
            )

            return

        if expires.tzinfo is None:

            expires = expires.replace(
                tzinfo=timezone.utc
            )

        if expires < datetime.now(
            timezone.utc
        ):

            user.telegram_link_token = None
            user.telegram_link_expires_at = None

            db.commit()

            await message.answer(
                "⌛ Код привязки истёк.\n\n"
                "Создай новый код на сайте."
            )

            return

        telegram_id = str(
            message.from_user.id
        )

        another = (
            db.query(User)
            .filter(
                User.telegram_id == telegram_id,
                User.id != user.id,
            )
            .first()
        )

        if another:

            await message.answer(
                "⚠️ Этот Telegram уже привязан "
                "к другому аккаунту FENIX MUSIC.\n\n"
                "Сначала отвяжи его от предыдущего аккаунта."
            )

            return

        if user.telegram_id:

            await message.answer(
                "⚠️ Этот аккаунт уже привязан "
                "к Telegram.\n\n"
                "Используй /unlink, если хочешь "
                "перепривязать его."
            )

            return

        user.telegram_id = telegram_id
        user.telegram_link_token = None
        user.telegram_link_expires_at = None

        db.commit()

        await message.answer(
            "✅ <b>Telegram успешно привязан!</b>\n\n"
            f"Аккаунт: "
            f"<b>{escape_html(user.username)}</b>\n"
            f"Telegram ID: "
            f"<code>{telegram_id}</code>\n\n"
            "Теперь тебе доступны "
            "избранное, история, плейлисты, "
            "статистика и синхронизация.",
            reply_markup=main_menu(
                user,
                message.from_user.id,
            ),
            parse_mode="HTML",
        )

    except Exception:

        db.rollback()

        logger.exception(
            "Telegram link error"
        )

        await message.answer(
            "❌ Ошибка привязки.\n"
            "Попробуй создать новый код."
        )

    finally:

        db.close()


# ============================================================
# UNLINK
# ============================================================

@dp.message(
    Command("unlink")
)
async def cmd_unlink(
    message: Message,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                message.from_user.id
            ),
        )

        if not user:

            await message.answer(
                "ℹ️ Telegram не привязан."
            )

            return

        user.telegram_id = None
        user.telegram_link_token = None
        user.telegram_link_expires_at = None

        db.commit()

        await message.answer(
            "✅ Telegram отвязан от аккаунта."
        )

    finally:

        db.close()


# ============================================================
# HOME
# ============================================================

@dp.callback_query(
    F.data == "home"
)
async def cb_home(
    callback: CallbackQuery,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        await callback.message.edit_text(
            "🎵 <b>FENIX MUSIC</b>\n\n"
            "Главное меню:",
            reply_markup=main_menu(
                user,
                callback.from_user.id,
            ),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# MUSIC LIST
# ============================================================

async def show_music(
    callback: CallbackQuery,
    mode: str = "all",
):

    db = db_session()

    try:

        query = db.query(Track)

        if mode == "popular":

            query = query.order_by(
                Track.plays.desc(),
                Track.id.desc(),
            )

            title = "🔥 <b>Популярные</b>"

        elif mode == "new":

            query = query.order_by(
                Track.created_at.desc(),
                Track.id.desc(),
            )

            title = "🆕 <b>Новые релизы</b>"

        else:

            query = query.order_by(
                Track.created_at.desc(),
                Track.id.desc(),
            )

            title = "🎵 <b>Музыка</b>"

        tracks = (
            query
            .limit(30)
            .all()
        )

        if not tracks:

            await callback.message.edit_text(
                f"{title}\n\n"
                "Музыка пока отсутствует.",
                reply_markup=back_home_keyboard(),
                parse_mode="HTML",
            )

            await callback.answer()

            return

        rows = []

        for track in tracks:

            rows.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"🎵 {track.artist} — "
                            f"{track.title}"
                        )[:64],
                        callback_data=f"track:{track.id}",
                    )
                ]
            )

        rows.append(
            [
                InlineKeyboardButton(
                    text="🏠 Меню",
                    callback_data="home",
                )
            ]
        )

        await callback.message.edit_text(
            f"{title}\n\n"
            f"Найдено: <b>{len(tracks)}</b>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


@dp.callback_query(
    F.data == "music"
)
async def cb_music(
    callback: CallbackQuery,
):

    await show_music(
        callback,
        "all",
    )


@dp.callback_query(
    F.data == "popular"
)
async def cb_popular(
    callback: CallbackQuery,
):

    await show_music(
        callback,
        "popular",
    )


@dp.callback_query(
    F.data == "new"
)
async def cb_new(
    callback: CallbackQuery,
):

    await show_music(
        callback,
        "new",
    )


# ============================================================
# TRACK
# ============================================================

@dp.callback_query(
    F.data.startswith("track:")
)
async def cb_track(
    callback: CallbackQuery,
):

    track_id = int(
        callback.data.split(
            ":",
            1,
        )[1]
    )

    db = db_session()

    try:

        track = db.get(
            Track,
            track_id,
        )

        if not track:

            await callback.answer(
                "Трек не найден",
                show_alert=True,
            )

            return

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        liked = False

        if user:

            liked = bool(
                db.query(Like)
                .filter_by(
                    user_id=user.id,
                    track_id=track.id,
                )
                .first()
            )

        await callback.message.edit_text(
            track_text(track),
            reply_markup=track_keyboard(
                track.id,
                liked=liked,
                show_lyrics=bool(
                    (track.lyrics or "").strip()
                    or
                    (track.lyrics_sync or "").strip()
                ),
            ),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# PLAY TRACK
# ============================================================

@dp.callback_query(
    F.data.startswith("play:")
)
async def cb_play(
    callback: CallbackQuery,
):

    track_id = int(
        callback.data.split(
            ":",
            1,
        )[1]
    )

    db = db_session()

    try:

        track = db.get(
            Track,
            track_id,
        )

        if not track:

            await callback.answer(
                "Трек не найден",
                show_alert=True,
            )

            return

        path = resolve_audio_path(
            track.audio_path
        )

        if not path:

            await callback.answer(
                "Аудиофайл отсутствует",
                show_alert=True,
            )

            return

        track.plays = (
            int(track.plays or 0)
            + 1
        )

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if user:

            db.add(
                History(
                    user_id=user.id,
                    track_id=track.id,
                )
            )

        db.commit()

        await callback.answer(
            "🎵 Отправляю трек..."
        )

        await callback.message.answer_audio(
            audio=FSInputFile(
                str(path)
            ),
            title=track.title,
            performer=track.artist,
            duration=int(
                track.duration or 0
            ),
        )

    except Exception:

        db.rollback()

        logger.exception(
            "Play error"
        )

        await callback.answer(
            "Ошибка отправки аудио",
            show_alert=True,
        )

    finally:

        db.close()


# ============================================================
# LIKE
# ============================================================

@dp.callback_query(
    F.data.startswith("like:")
)
async def cb_like(
    callback: CallbackQuery,
):

    track_id = int(
        callback.data.split(
            ":",
            1,
        )[1]
    )

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Сначала привяжи Telegram",
                show_alert=True,
            )

            return

        track = db.get(
            Track,
            track_id,
        )

        if not track:

            await callback.answer(
                "Трек не найден",
                show_alert=True,
            )

            return

        existing = (
            db.query(Like)
            .filter_by(
                user_id=user.id,
                track_id=track.id,
            )
            .first()
        )

        if existing:

            db.delete(existing)
            liked = False

        else:

            db.add(
                Like(
                    user_id=user.id,
                    track_id=track.id,
                )
            )

            liked = True

        db.commit()

        await callback.message.edit_reply_markup(
            reply_markup=track_keyboard(
                track.id,
                liked=liked,
                show_lyrics=bool(
                    (track.lyrics or "").strip()
                    or
                    (track.lyrics_sync or "").strip()
                ),
            )
        )

        await callback.answer(
            "❤️ Добавлено в избранное"
            if liked
            else "💔 Убрано из избранного"
        )

    finally:

        db.close()


# ============================================================
# LYRICS
# ============================================================

@dp.callback_query(
    F.data.startswith("lyrics:")
)
async def cb_lyrics(
    callback: CallbackQuery,
):

    track_id = int(
        callback.data.split(
            ":",
            1,
        )[1]
    )

    db = db_session()

    try:

        track = db.get(
            Track,
            track_id,
        )

        if not track:

            await callback.answer(
                "Трек не найден",
                show_alert=True,
            )

            return

        lyrics = parse_lyrics(
            track
        )

        if not lyrics:

            await callback.answer(
                "Текст отсутствует",
                show_alert=True,
            )

            return

        text = (
            f"📝 <b>{escape_html(track.title)}</b>\n"
            f"👤 {escape_html(track.artist)}\n\n"
            f"{escape_html(lyrics)}"
        )

        if len(text) > 4000:
            text = text[:3950] + "\n\n…"

        await callback.message.answer(
            text,
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# FAVORITES
# ============================================================

@dp.callback_query(
    F.data == "favorites"
)
async def cb_favorites(
    callback: CallbackQuery,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Telegram не привязан",
                show_alert=True,
            )

            return

        rows = (
            db.query(Track)
            .join(
                Like,
                Like.track_id == Track.id,
            )
            .filter(
                Like.user_id == user.id
            )
            .order_by(
                Like.created_at.desc()
            )
            .limit(50)
            .all()
        )

        if not rows:

            await callback.message.edit_text(
                "❤️ <b>Избранное</b>\n\n"
                "Здесь пока ничего нет.",
                reply_markup=back_home_keyboard(),
                parse_mode="HTML",
            )

            await callback.answer()

            return

        buttons = []

        for track in rows:

            buttons.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"❤️ {track.artist} — "
                            f"{track.title}"
                        )[:64],
                        callback_data=f"track:{track.id}",
                    )
                ]
            )

        buttons.append(
            [
                InlineKeyboardButton(
                    text="🏠 Меню",
                    callback_data="home",
                )
            ]
        )

        await callback.message.edit_text(
            "❤️ <b>Избранное</b>\n\n"
            f"Треков: <b>{len(rows)}</b>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=buttons
            ),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# HISTORY
# ============================================================

@dp.callback_query(
    F.data == "history"
)
async def cb_history(
    callback: CallbackQuery,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Telegram не привязан",
                show_alert=True,
            )

            return

        rows = (
            db.query(History)
            .filter_by(
                user_id=user.id
            )
            .order_by(
                History.played_at.desc()
            )
            .limit(50)
            .all()
        )

        if not rows:

            await callback.message.edit_text(
                "🕘 <b>История</b>\n\n"
                "История прослушиваний пуста.",
                reply_markup=back_home_keyboard(),
                parse_mode="HTML",
            )

            await callback.answer()

            return

        buttons = []

        for row in rows:

            track = db.get(
                Track,
                row.track_id,
            )

            if not track:
                continue

            buttons.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"🕘 {track.artist} — "
                            f"{track.title}"
                        )[:64],
                        callback_data=f"track:{track.id}",
                    )
                ]
            )

        buttons.append(
            [
                InlineKeyboardButton(
                    text="🏠 Меню",
                    callback_data="home",
                )
            ]
        )

        await callback.message.edit_text(
            "🕘 <b>История прослушиваний</b>\n\n"
            f"Записей: <b>{len(rows)}</b>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=buttons
            ),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# PLAYLISTS
# ============================================================

@dp.callback_query(
    F.data == "playlists"
)
async def cb_playlists(
    callback: CallbackQuery,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Telegram не привязан",
                show_alert=True,
            )

            return

        playlists = (
            db.query(Playlist)
            .filter_by(
                user_id=user.id
            )
            .order_by(
                Playlist.created_at.desc()
            )
            .all()
        )

        rows = []

        for playlist in playlists:

            count = (
                db.query(
                    PlaylistTrack
                )
                .filter_by(
                    playlist_id=playlist.id
                )
                .count()
            )

            rows.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"📂 {playlist.name} "
                            f"({count})"
                        )[:64],
                        callback_data=(
                            f"playlist:{playlist.id}"
                        ),
                    )
                ]
            )

        rows.append(
            [
                InlineKeyboardButton(
                    text="➕ Создать плейлист",
                    callback_data="newplaylist",
                )
            ]
        )

        rows.append(
            [
                InlineKeyboardButton(
                    text="🏠 Меню",
                    callback_data="home",
                )
            ]
        )

        await callback.message.edit_text(
            "📂 <b>Мои плейлисты</b>\n\n"
            f"Плейлистов: <b>{len(playlists)}</b>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


@dp.callback_query(
    F.data == "newplaylist"
)
async def cb_newplaylist(
    callback: CallbackQuery,
    state: FSMContext,
):

    user = await require_linked_user(
        callback.message
    )

    if not user:

        await callback.answer()

        return

    await state.set_state(
        PlaylistState.waiting_name
    )

    await callback.message.answer(
        "📂 <b>Создание плейлиста</b>\n\n"
        "Отправь название плейлиста.",
        parse_mode="HTML",
    )

    await callback.answer()


@dp.message(
    PlaylistState.waiting_name
)
async def playlist_name(
    message: Message,
    state: FSMContext,
):

    name = (
        message.text or ""
    ).strip()

    if len(name) < 1:

        await message.answer(
            "❌ Название не может быть пустым."
        )

        return

    await state.update_data(
        playlist_name=name[:255]
    )

    await state.set_state(
        PlaylistState.waiting_description
    )

    await message.answer(
        "📝 Теперь отправь описание.\n\n"
        "Если описание не нужно — отправь <code>-</code>.",
        parse_mode="HTML",
    )


@dp.message(
    PlaylistState.waiting_description
)
async def playlist_description(
    message: Message,
    state: FSMContext,
):

    data = await state.get_data()

    name = data.get(
        "playlist_name",
        "Мой плейлист",
    )

    description = (
        message.text or ""
    ).strip()

    if description == "-":
        description = ""

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                message.from_user.id
            ),
        )

        if not user:

            await message.answer(
                "❌ Telegram больше не привязан."
            )

            await state.clear()

            return

        playlist = Playlist(
            user_id=user.id,
            name=name,
            description=description[:2000],
            is_public=True,
        )

        db.add(playlist)
        db.commit()
        db.refresh(playlist)

        await state.clear()

        await message.answer(
            "✅ <b>Плейлист создан!</b>\n\n"
            f"📂 {escape_html(playlist.name)}",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="📂 Открыть",
                            callback_data=(
                                f"playlist:{playlist.id}"
                            ),
                        )
                    ],
                    [
                        InlineKeyboardButton(
                            text="🏠 Меню",
                            callback_data="home",
                        )
                    ],
                ]
            ),
            parse_mode="HTML",
        )

    finally:

        db.close()


# ============================================================
# OPEN PLAYLIST
# ============================================================

@dp.callback_query(
    F.data.startswith("playlist:")
)
async def cb_playlist(
    callback: CallbackQuery,
):

    playlist_id = int(
        callback.data.split(
            ":",
            1,
        )[1]
    )

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Telegram не привязан",
                show_alert=True,
            )

            return

        playlist = (
            db.query(Playlist)
            .filter_by(
                id=playlist_id,
                user_id=user.id,
            )
            .first()
        )

        if not playlist:

            await callback.answer(
                "Плейлист не найден",
                show_alert=True,
            )

            return

        items = (
            db.query(PlaylistTrack)
            .filter_by(
                playlist_id=playlist.id
            )
            .order_by(
                PlaylistTrack.position
            )
            .all()
        )

        rows = []

        for item in items:

            track = db.get(
                Track,
                item.track_id,
            )

            if not track:
                continue

            rows.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"🎵 {track.artist} — "
                            f"{track.title}"
                        )[:64],
                        callback_data=f"track:{track.id}",
                    )
                ]
            )

        rows.append(
            [
                InlineKeyboardButton(
                    text="⬅️ Плейлисты",
                    callback_data="playlists",
                )
            ]
        )

        description = escape_html(
            playlist.description or ""
        )

        text = (
            f"📂 <b>{escape_html(playlist.name)}</b>\n\n"
            f"{description}\n\n"
            f"Треков: <b>{len(items)}</b>"
        )

        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# ADD TO PLAYLIST
# ============================================================

@dp.callback_query(
    F.data.startswith("addpl:")
)
async def cb_add_playlist(
    callback: CallbackQuery,
):

    track_id = int(
        callback.data.split(
            ":",
            1,
        )[1]
    )

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Telegram не привязан",
                show_alert=True,
            )

            return

        playlists = (
            db.query(Playlist)
            .filter_by(
                user_id=user.id
            )
            .order_by(
                Playlist.created_at.desc()
            )
            .all()
        )

        if not playlists:

            await callback.message.answer(
                "📂 У тебя нет плейлистов.\n\n"
                "Сначала создай его в разделе "
                "«Плейлисты»."
            )

            await callback.answer()

            return

        rows = []

        for playlist in playlists:

            rows.append(
                [
                    InlineKeyboardButton(
                        text=f"📂 {playlist.name}"[:64],
                        callback_data=(
                            f"putpl:{playlist.id}:{track_id}"
                        ),
                    )
                ]
            )

        rows.append(
            [
                InlineKeyboardButton(
                    text="❌ Отмена",
                    callback_data=f"track:{track_id}",
                )
            ]
        )

        await callback.message.edit_text(
            "📂 <b>Выбери плейлист</b>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


@dp.callback_query(
    F.data.startswith("putpl:")
)
async def cb_put_playlist(
    callback: CallbackQuery,
):

    _, playlist_id, track_id = (
        callback.data.split(":")
    )

    playlist_id = int(
        playlist_id
    )

    track_id = int(
        track_id
    )

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Telegram не привязан",
                show_alert=True,
            )

            return

        playlist = (
            db.query(Playlist)
            .filter_by(
                id=playlist_id,
                user_id=user.id,
            )
            .first()
        )

        track = db.get(
            Track,
            track_id,
        )

        if not playlist or not track:

            await callback.answer(
                "Плейлист или трек не найден",
                show_alert=True,
            )

            return

        exists = (
            db.query(PlaylistTrack)
            .filter_by(
                playlist_id=playlist.id,
                track_id=track.id,
            )
            .first()
        )

        if exists:

            await callback.answer(
                "Трек уже есть в плейлисте",
                show_alert=True,
            )

            return

        position = (
            db.query(
                func.count(
                    PlaylistTrack.id
                )
            )
            .filter_by(
                playlist_id=playlist.id
            )
            .scalar()
            or 0
        )

        db.add(
            PlaylistTrack(
                playlist_id=playlist.id,
                track_id=track.id,
                position=position,
            )
        )

        db.commit()

        await callback.answer(
            "✅ Добавлено в плейлист",
            show_alert=True,
        )

        await callback.message.edit_text(
            track_text(track),
            reply_markup=track_keyboard(
                track.id,
                liked=bool(
                    db.query(Like)
                    .filter_by(
                        user_id=user.id,
                        track_id=track.id,
                    )
                    .first()
                ),
                show_lyrics=bool(
                    (track.lyrics or "").strip()
                    or
                    (track.lyrics_sync or "").strip()
                ),
            ),
            parse_mode="HTML",
        )

    finally:

        db.close()


# ============================================================
# DELETE PLAYLIST
# ============================================================

@dp.callback_query(
    F.data.startswith("delpl:")
)
async def cb_delete_playlist(
    callback: CallbackQuery,
):

    playlist_id = int(
        callback.data.split(
            ":",
            1,
        )[1]
    )

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Telegram не привязан",
                show_alert=True,
            )

            return

        playlist = (
            db.query(Playlist)
            .filter_by(
                id=playlist_id,
                user_id=user.id,
            )
            .first()
        )

        if not playlist:

            await callback.answer(
                "Плейлист не найден",
                show_alert=True,
            )

            return

        db.delete(playlist)
        db.commit()

        await callback.answer(
            "🗑 Плейлист удалён"
        )

        await cb_playlists(
            callback
        )

    finally:

        db.close()


# ============================================================
# PROFILE
# ============================================================

@dp.callback_query(
    F.data == "profile"
)
async def cb_profile(
    callback: CallbackQuery,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Telegram не привязан",
                show_alert=True,
            )

            return

        liked = (
            db.query(Like)
            .filter_by(
                user_id=user.id
            )
            .count()
        )

        history = (
            db.query(History)
            .filter_by(
                user_id=user.id
            )
            .count()
        )

        playlists = (
            db.query(Playlist)
            .filter_by(
                user_id=user.id
            )
            .count()
        )

        await callback.message.edit_text(
            "👤 <b>Профиль</b>\n\n"
            f"🆔 ID: <code>{user.id}</code>\n"
            f"👤 Username: "
            f"<b>{escape_html(user.username)}</b>\n"
            f"📧 Email: "
            f"<code>{escape_html(user.email)}</code>\n\n"
            f"❤️ Избранное: <b>{liked}</b>\n"
            f"🕘 Прослушиваний: <b>{history}</b>\n"
            f"📂 Плейлистов: <b>{playlists}</b>\n"
            f"🔗 Telegram: <b>привязан</b>",
            reply_markup=back_home_keyboard(),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# STATS
# ============================================================

@dp.callback_query(
    F.data == "stats"
)
async def cb_stats(
    callback: CallbackQuery,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not user:

            await callback.answer(
                "Telegram не привязан",
                show_alert=True,
            )

            return

        liked = (
            db.query(Like)
            .filter_by(
                user_id=user.id
            )
            .count()
        )

        played = (
            db.query(History)
            .filter_by(
                user_id=user.id
            )
            .count()
        )

        playlists = (
            db.query(Playlist)
            .filter_by(
                user_id=user.id
            )
            .count()
        )

        minutes = (
            db.query(
                func.coalesce(
                    func.sum(
                        Track.duration
                    ),
                    0,
                )
            )
            .join(
                History,
                History.track_id == Track.id,
            )
            .filter(
                History.user_id == user.id
            )
            .scalar()
            or 0
        )

        await callback.message.edit_text(
            "📊 <b>Твоя статистика</b>\n\n"
            f"🎵 Треков прослушано: "
            f"<b>{played}</b>\n"
            f"⏱ Время: "
            f"<b>{int(minutes) // 60} мин.</b>\n"
            f"❤️ Избранных треков: "
            f"<b>{liked}</b>\n"
            f"📂 Плейлистов: "
            f"<b>{playlists}</b>",
            reply_markup=back_home_keyboard(),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# CHARTS
# ============================================================

@dp.callback_query(
    F.data == "charts"
)
async def cb_charts(
    callback: CallbackQuery,
):

    await callback.message.edit_text(
        "📈 <b>Чарты FENIX MUSIC</b>\n\n"
        "Выбери период:",
        reply_markup=charts_keyboard(),
        parse_mode="HTML",
    )

    await callback.answer()


@dp.callback_query(
    F.data.startswith("charts:")
)
async def cb_chart_period(
    callback: CallbackQuery,
):

    period = callback.data.split(
        ":",
        1,
    )[1]

    db = db_session()

    try:

        if period == "all":

            rows = (
                db.query(Track)
                .order_by(
                    Track.plays.desc(),
                    Track.id.desc(),
                )
                .limit(20)
                .all()
            )

        else:

            days = {
                "day": 1,
                "week": 7,
                "month": 30,
            }.get(period)

            if not days:

                await callback.answer(
                    "Неверный период",
                    show_alert=True,
                )

                return

            cutoff = (
                datetime.now(
                    timezone.utc
                )
                - timedelta(
                    days=days
                )
            )

            rows = (
                db.query(
                    Track,
                    func.count(
                        History.id
                    ).label("count"),
                )
                .join(
                    History,
                    History.track_id == Track.id,
                )
                .filter(
                    History.played_at >= cutoff
                )
                .group_by(
                    Track.id
                )
                .order_by(
                    func.count(
                        History.id
                    ).desc(),
                    Track.id.desc(),
                )
                .limit(20)
                .all()
            )

        if not rows:

            await callback.message.edit_text(
                "📈 <b>Чарты</b>\n\n"
                "За этот период прослушиваний нет.",
                reply_markup=charts_keyboard(),
                parse_mode="HTML",
            )

            await callback.answer()

            return

        lines = []

        for index, item in enumerate(
            rows,
            start=1,
        ):

            if period == "all":

                track = item

                plays = int(
                    track.plays or 0
                )

            else:

                track, count = item

                plays = int(
                    count or 0
                )

            lines.append(
                f"<b>{index}.</b> "
                f"{escape_html(track.artist)} — "
                f"{escape_html(track.title)} "
                f"• <b>{plays}</b> ▶️"
            )

        period_name = {
            "all": "всё время",
            "day": "сегодня",
            "week": "неделя",
            "month": "месяц",
        }.get(
            period,
            period,
        )

        await callback.message.edit_text(
            "📈 <b>Чарты</b>\n\n"
            f"Период: <b>{period_name}</b>\n\n"
            + "\n".join(lines),
            reply_markup=charts_keyboard(),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# SEARCH
# ============================================================

@dp.callback_query(
    F.data == "search"
)
async def cb_search(
    callback: CallbackQuery,
    state: FSMContext,
):

    await state.set_state(
        SearchState.waiting_query
    )

    await callback.message.answer(
        "🔎 <b>Поиск музыки</b>\n\n"
        "Отправь название трека, исполнителя "
        "или альбом.",
        parse_mode="HTML",
    )

    await callback.answer()


@dp.message(
    SearchState.waiting_query
)
async def search_query(
    message: Message,
    state: FSMContext,
):

    query_text = (
        message.text or ""
    ).strip()

    if not query_text:

        await message.answer(
            "❌ Введи поисковый запрос."
        )

        return

    db = db_session()

    try:

        pattern = (
            f"%{query_text}%"
        )

        tracks = (
            db.query(Track)
            .filter(
                (
                    Track.title.ilike(pattern)
                    |
                    Track.artist.ilike(pattern)
                    |
                    Track.album.ilike(pattern)
                    |
                    Track.genre.ilike(pattern)
                )
            )
            .limit(30)
            .all()
        )

        await state.clear()

        if not tracks:

            await message.answer(
                "🔎 <b>Ничего не найдено.</b>\n\n"
                f"Запрос: "
                f"<code>{escape_html(query_text)}</code>",
                reply_markup=back_home_keyboard(),
                parse_mode="HTML",
            )

            return

        rows = []

        for track in tracks:

            rows.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"🎵 {track.artist} — "
                            f"{track.title}"
                        )[:64],
                        callback_data=f"track:{track.id}",
                    )
                ]
            )

        rows.append(
            [
                InlineKeyboardButton(
                    text="🏠 Меню",
                    callback_data="home",
                )
            ]
        )

        await message.answer(
            "🔎 <b>Результаты поиска</b>\n\n"
            f"Запрос: "
            f"<code>{escape_html(query_text)}</code>\n"
            f"Найдено: <b>{len(tracks)}</b>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
            parse_mode="HTML",
        )

    finally:

        db.close()


# ============================================================
# ADMIN CHECK
# ============================================================

async def require_admin(
    message: Message,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                message.from_user.id
            ),
        )

        if not is_admin_user(
            user,
            message.from_user.id,
        ):

            await message.answer(
                "⛔ Недостаточно прав."
            )

            return None

        return user

    finally:

        db.close()


# ============================================================
# ADMIN MENU
# ============================================================

@dp.callback_query(
    F.data == "admin"
)
async def cb_admin(
    callback: CallbackQuery,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not is_admin_user(
            user,
            callback.from_user.id,
        ):

            await callback.answer(
                "⛔ Нет доступа",
                show_alert=True,
            )

            return

        await callback.message.edit_text(
            "⚙️ <b>Админ-панель FENIX MUSIC</b>\n\n"
            "Управление музыкой и системой:",
            reply_markup=admin_menu(),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# ADMIN STATS
# ============================================================

@dp.callback_query(
    F.data == "admin_stats"
)
async def cb_admin_stats(
    callback: CallbackQuery,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not is_admin_user(
            user,
            callback.from_user.id,
        ):

            await callback.answer(
                "⛔ Нет доступа",
                show_alert=True,
            )

            return

        users = db.query(
            User
        ).count()

        tracks = db.query(
            Track
        ).count()

        plays = int(
            db.query(
                func.coalesce(
                    func.sum(
                        Track.plays
                    ),
                    0,
                )
            ).scalar()
            or 0
        )

        likes = db.query(
            Like
        ).count()

        playlists = db.query(
            Playlist
        ).count()

        telegram = (
            db.query(User)
            .filter(
                User.telegram_id.isnot(None)
            )
            .count()
        )

        lyrics = (
            db.query(Track)
            .filter(
                Track.lyrics.isnot(None),
                Track.lyrics != "",
            )
            .count()
        )

        await callback.message.edit_text(
            "📊 <b>Статистика FENIX MUSIC</b>\n\n"
            f"👤 Пользователей: <b>{users}</b>\n"
            f"🎵 Треков: <b>{tracks}</b>\n"
            f"▶️ Прослушиваний: <b>{plays}</b>\n"
            f"❤️ Лайков: <b>{likes}</b>\n"
            f"📂 Плейлистов: <b>{playlists}</b>\n"
            f"🔗 Telegram: <b>{telegram}</b>\n"
            f"📝 С текстами: <b>{lyrics}</b>",
            reply_markup=admin_menu(),
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


# ============================================================
# ADMIN SCAN
# ============================================================

@dp.callback_query(
    F.data == "scan"
)
async def cb_scan(
    callback: CallbackQuery,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not is_admin_user(
            user,
            callback.from_user.id,
        ):

            await callback.answer(
                "⛔ Нет доступа",
                show_alert=True,
            )

            return

        result = scan_music(
            db
        )

        await callback.message.edit_text(
            "🔄 <b>Сканирование завершено</b>\n\n"
            f"📁 Найдено: <b>{result['found']}</b>\n"
            f"➕ Добавлено: <b>{result['added']}</b>\n"
            f"♻️ Обновлено: <b>{result['updated']}</b>",
            reply_markup=admin_menu(),
            parse_mode="HTML",
        )

        await callback.answer()

    except Exception:

        db.rollback()

        logger.exception(
            "Scan error"
        )

        await callback.answer(
            "Ошибка сканирования",
            show_alert=True,
        )

    finally:

        db.close()


# ============================================================
# ADMIN UPLOAD
# ============================================================

@dp.callback_query(
    F.data == "upload"
)
async def cb_upload(
    callback: CallbackQuery,
    state: FSMContext,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not is_admin_user(
            user,
            callback.from_user.id,
        ):

            await callback.answer(
                "⛔ Нет доступа",
                show_alert=True,
            )

            return

        await state.set_state(
            UploadState.waiting_audio
        )

        await callback.message.answer(
            "⬆️ <b>Загрузка музыки</b>\n\n"
            "Отправь MP3/M4A/OGG/WAV/FLAC/OPUS "
            "как аудио или документ.\n\n"
            "Метаданные будут взяты из файла.",
            parse_mode="HTML",
        )

        await callback.answer()

    finally:

        db.close()


@dp.message(
    UploadState.waiting_audio,
    F.audio
)
async def upload_audio(
    message: Message,
    state: FSMContext,
):

    await process_upload(
        message,
        state,
        message.audio.file_name
        if message.audio
        else "audio.mp3",
        message.audio.file_id
        if message.audio
        else None,
    )


@dp.message(
    UploadState.waiting_audio,
    F.document
)
async def upload_document(
    message: Message,
    state: FSMContext,
):

    document = message.document

    if not document:
        return

    filename = (
        document.file_name
        or "audio.mp3"
    )

    allowed = {
        ".mp3",
        ".m4a",
        ".aac",
        ".ogg",
        ".wav",
        ".flac",
        ".opus",
    }

    if Path(
        filename
    ).suffix.lower() not in allowed:

        await message.answer(
            "❌ Этот формат не поддерживается."
        )

        return

    await process_upload(
        message,
        state,
        filename,
        document.file_id,
    )


async def process_upload(
    message: Message,
    state: FSMContext,
    filename: str,
    file_id: Optional[str],
):

    if not file_id:

        await message.answer(
            "❌ Не удалось получить файл."
        )

        return

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                message.from_user.id
            ),
        )

        if not is_admin_user(
            user,
            message.from_user.id,
        ):

            await message.answer(
                "⛔ Нет доступа."
            )

            await state.clear()

            return

        safe_name = Path(
            filename
        ).name

        target = (
            AUDIO_DIR
            / (
                f"{uuid.uuid4().hex}_"
                f"{safe_name}"
            )
        )

        telegram_file = await bot.get_file(
            file_id
        )

        await bot.download_file(
            telegram_file.file_path,
            destination=str(target),
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

        try:

            relative_path = target.relative_to(
                Path.cwd()
            )

            audio_path = str(
                relative_path
            )

        except ValueError:

            audio_path = target.as_posix()

        track = Track(
            title=title,
            artist=artist,
            album=album,
            genre=genre,
            duration=duration,
            audio_path=audio_path,
            plays=0,
        )

        db.add(track)
        db.commit()
        db.refresh(track)

        await state.clear()

        await message.answer(
            "✅ <b>Трек загружен</b>\n\n"
            f"🎵 {escape_html(track.title)}\n"
            f"👤 {escape_html(track.artist)}\n"
            f"💿 {escape_html(track.album)}\n"
            f"🎼 {escape_html(track.genre)}\n"
            f"⏱ {duration_label(track.duration)}\n\n"
            f"ID: <code>{track.id}</code>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="▶️ Проверить",
                            callback_data=f"track:{track.id}",
                        )
                    ],
                    [
                        InlineKeyboardButton(
                            text="⚙️ Админка",
                            callback_data="admin",
                        )
                    ],
                ]
            ),
            parse_mode="HTML",
        )

    except Exception:

        db.rollback()

        logger.exception(
            "Upload error"
        )

        await message.answer(
            "❌ Ошибка загрузки файла."
        )

    finally:

        db.close()


# ============================================================
# ADMIN DELETE TRACK
# ============================================================

@dp.callback_query(
    F.data.startswith("delete:")
)
async def cb_delete_track(
    callback: CallbackQuery,
):

    track_id = int(
        callback.data.split(
            ":",
            1,
        )[1]
    )

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                callback.from_user.id
            ),
        )

        if not is_admin_user(
            user,
            callback.from_user.id,
        ):

            await callback.answer(
                "⛔ Нет доступа",
                show_alert=True,
            )

            return

        track = db.get(
            Track,
            track_id,
        )

        if not track:

            await callback.answer(
                "Трек не найден",
                show_alert=True,
            )

            return

        path = resolve_audio_path(
            track.audio_path
        )

        if path:

            try:
                path.unlink(
                    missing_ok=True
                )
            except Exception:
                pass

        if (
            track.cover_url
            and track.cover_url.startswith(
                "/api/media/covers/"
            )
        ):

            try:

                (
                    COVER_DIR
                    / Path(
                        track.cover_url
                    ).name
                ).unlink(
                    missing_ok=True
                )

            except Exception:
                pass

        db.delete(track)
        db.commit()

        await callback.answer(
            "🗑 Трек удалён"
        )

        await show_music(
            callback,
            "all",
        )

    finally:

        db.close()


# ============================================================
# COMMANDS
# ============================================================

@dp.message(
    Command("music")
)
async def cmd_music(
    message: Message,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                message.from_user.id
            ),
        )

        tracks = (
            db.query(Track)
            .order_by(
                Track.created_at.desc()
            )
            .limit(30)
            .all()
        )

        rows = [
            [
                InlineKeyboardButton(
                    text=(
                        f"🎵 {t.artist} — "
                        f"{t.title}"
                    )[:64],
                    callback_data=f"track:{t.id}",
                )
            ]
            for t in tracks
        ]

        rows.append(
            [
                InlineKeyboardButton(
                    text="🏠 Меню",
                    callback_data="home",
                )
            ]
        )

        await message.answer(
            "🎵 <b>Музыка</b>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
            parse_mode="HTML",
        )

    finally:

        db.close()


@dp.message(
    Command("charts")
)
async def cmd_charts(
    message: Message,
):

    await message.answer(
        "📈 <b>Чарты</b>\n\n"
        "Выбери период:",
        reply_markup=charts_keyboard(),
        parse_mode="HTML",
    )


@dp.message(
    Command("profile")
)
async def cmd_profile(
    message: Message,
):

    db = db_session()

    try:

        user = get_user_by_telegram(
            db,
            str(
                message.from_user.id
            ),
        )

        if not user:

            await message.answer(
                "🔐 Telegram не привязан."
            )

            return

        await message.answer(
            "👤 <b>Профиль</b>\n\n"
            f"Username: <b>{escape_html(user.username)}</b>\n"
            f"ID: <code>{user.id}</code>\n"
            f"Telegram ID: <code>{user.telegram_id}</code>",
            reply_markup=back_home_keyboard(),
            parse_mode="HTML",
        )

    finally:

        db.close()


# ============================================================
# UNKNOWN COMMAND
# ============================================================

@dp.message(
    F.text.startswith("/")
)
async def unknown_command(
    message: Message,
):

    await message.answer(
        "❓ Неизвестная команда.\n\n"
        "Используй /start"
    )


# ============================================================
# ERROR HANDLER
# ============================================================

@dp.errors()
async def global_error_handler(
    event,
):

    logger.exception(
        "Unhandled Telegram update error: %s",
        event.exception,
    )

    return True


# ============================================================
# POLLING
# ============================================================

async def main():

    logger.info(
        "Starting FENIX MUSIC Telegram Bot V8"
    )

    logger.info(
        "Telegram admin IDs: %s",
        sorted(
            TELEGRAM_ADMIN_IDS
        ),
    )

    # Удаляем старый webhook.
    await bot.delete_webhook(
        drop_pending_updates=True
    )

    await dp.start_polling(
        bot,
        allowed_updates=dp.resolve_used_update_types(),
    )


if __name__ == "__main__":

    asyncio.run(
        main()
    )
