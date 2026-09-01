import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    CallbackQuery,
    FSInputFile,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

from backend.server import (
    SessionLocal,
    User,
    Track,
    Like,
    History,
    Playlist,
    PlaylistTrack,
    scan_music,
    resolve_audio_path,
)


# ============================================================
# CONFIG
# ============================================================

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

ADMIN_IDS_RAW = os.getenv(
    "TELEGRAM_ADMIN_IDS",
    "",
).strip()

ADMIN_IDS = {
    int(x.strip())
    for x in ADMIN_IDS_RAW.split(",")
    if x.strip().isdigit()
}

if not BOT_TOKEN:
    raise RuntimeError(
        "TELEGRAM_BOT_TOKEN is not configured"
    )


logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
)

logger = logging.getLogger("fenix_music_bot")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()


# ============================================================
# HELPERS
# ============================================================

def utcnow():
    return datetime.now(timezone.utc)


def is_telegram_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


def get_user_by_telegram(
    telegram_id: int,
):
    db = SessionLocal()

    try:
        return (
            db.query(User)
            .filter(
                User.telegram_id
                == str(telegram_id)
            )
            .first()
        )

    finally:
        db.close()


def get_track(track_id: int):
    db = SessionLocal()

    try:
        return db.get(
            Track,
            track_id,
        )

    finally:
        db.close()


def format_duration(seconds: int):
    seconds = int(seconds or 0)

    return (
        f"{seconds // 60}:"
        f"{seconds % 60:02d}"
    )


def track_text(track: Track):
    return (
        f"🎵 <b>{track.title}</b>\n"
        f"👤 {track.artist}\n"
        f"💿 {track.album}\n"
        f"🎼 {track.genre or 'Pop'}\n"
        f"⏱ {format_duration(track.duration)}\n"
        f"▶️ Прослушиваний: {track.plays or 0}"
    )


def back_button(
    callback: str = "home",
):
    return InlineKeyboardButton(
        text="⬅️ Назад",
        callback_data=callback,
    )


# ============================================================
# MAIN MENU
# ============================================================

def main_menu(
    linked: bool = False,
    admin: bool = False,
):

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
                text="🆕 Новинки",
                callback_data="new",
            ),
            InlineKeyboardButton(
                text="📊 Чарты",
                callback_data="charts",
            ),
        ],
        [
            InlineKeyboardButton(
                text="🔎 Поиск",
                callback_data="search",
            ),
            InlineKeyboardButton(
                text="🎤 Lyrics",
                callback_data="lyrics",
            ),
        ],
    ]

    if linked:

        rows.extend(
            [
                [
                    InlineKeyboardButton(
                        text="❤️ Избранное",
                        callback_data="favorites",
                    ),
                    InlineKeyboardButton(
                        text="📜 История",
                        callback_data="history",
                    ),
                ],
                [
                    InlineKeyboardButton(
                        text="📂 Плейлисты",
                        callback_data="playlists",
                    ),
                    InlineKeyboardButton(
                        text="👤 Профиль",
                        callback_data="profile",
                    ),
                ],
                [
                    InlineKeyboardButton(
                        text="📈 Статистика",
                        callback_data="stats",
                    ),
                ],
            ]
        )

    else:

        rows.append(
            [
                InlineKeyboardButton(
                    text="🔗 Привязать аккаунт",
                    callback_data="link_help",
                )
            ]
        )

    if admin:

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


# ============================================================
# TRACK MENU
# ============================================================

def track_menu(
    track_id: int,
    liked: bool = False,
    admin: bool = False,
):

    like_text = (
        "💔 Убрать из избранного"
        if liked
        else "❤️ В избранное"
    )

    rows = [
        [
            InlineKeyboardButton(
                text="▶️ Слушать",
                callback_data=f"listen:{track_id}",
            )
        ],
        [
            InlineKeyboardButton(
                text=like_text,
                callback_data=f"like:{track_id}",
            )
        ],
        [
            InlineKeyboardButton(
                text="🎤 Lyrics",
                callback_data=f"lyrics:{track_id}",
            )
        ],
    ]

    if admin:

        rows.append(
            [
                InlineKeyboardButton(
                    text="🗑 Удалить",
                    callback_data=f"delete:{track_id}",
                )
            ]
        )

    rows.append(
        [
            back_button("music")
        ]
    )

    return InlineKeyboardMarkup(
        inline_keyboard=rows
    )


# ============================================================
# START
# ============================================================

@dp.message(CommandStart())
async def cmd_start(
    message: Message,
):

    args = (
        message.text.split(maxsplit=1)[1].strip()
        if message.text
        and len(message.text.split(maxsplit=1)) > 1
        else None
    )

    telegram_id = message.from_user.id

    # --------------------------------------------------------
    # Secure account linking
    # --------------------------------------------------------

    if args:

        db = SessionLocal()

        try:

            user = (
                db.query(User)
                .filter(
                    User.telegram_link_token
                    == args
                )
                .first()
            )

            if not user:

                await message.answer(
                    "❌ Код привязки недействителен "
                    "или уже использован."
                )

                return

            expires = (
                user.telegram_link_expires_at
            )

            if (
                not expires
                or expires < utcnow()
            ):

                user.telegram_link_token = None
                user.telegram_link_expires_at = None

                db.commit()

                await message.answer(
                    "⌛ Код привязки истёк.\n\n"
                    "Создай новый код на сайте FENIX MUSIC."
                )

                return

            # If Telegram account is already linked
            # to another user — refuse.
            existing = (
                db.query(User)
                .filter(
                    User.telegram_id
                    == str(telegram_id),
                    User.id != user.id,
                )
                .first()
            )

            if existing:

                await message.answer(
                    "❌ Этот Telegram уже "
                    "привязан к другому аккаунту."
                )

                return

            user.telegram_id = str(
                telegram_id
            )

            user.telegram_link_token = None
            user.telegram_link_expires_at = None

            db.commit()

            await message.answer(
                "✅ <b>Аккаунт успешно привязан!</b>\n\n"
                f"👤 {user.username}\n"
                f"📧 {user.email}\n\n"
                "Теперь Telegram и сайт FENIX MUSIC "
                "используют один аккаунт.",
                reply_markup=main_menu(
                    linked=True,
                    admin=(
                        bool(user.is_admin)
                        or is_telegram_admin(
                            telegram_id
                        )
                    ),
                ),
            )

            return

        finally:

            db.close()

    # --------------------------------------------------------
    # Existing linked user
    # --------------------------------------------------------

    user = get_user_by_telegram(
        telegram_id
    )

    if user:

        await message.answer(
            f"🔥 <b>FENIX MUSIC</b>\n\n"
            f"Привет, <b>{user.username}</b>!\n"
            "Выбери раздел:",
            reply_markup=main_menu(
                linked=True,
                admin=(
                    bool(user.is_admin)
                    or is_telegram_admin(
                        telegram_id
                    )
                ),
            ),
        )

        return

    # --------------------------------------------------------
    # Not linked
    # --------------------------------------------------------

    await message.answer(
        "🔥 <b>FENIX MUSIC</b>\n\n"
        "Добро пожаловать!\n\n"
        "Чтобы использовать Избранное, Историю, "
        "Плейлисты и Статистику, сначала привяжи "
        "Telegram к аккаунту сайта.",
        reply_markup=main_menu(
            linked=False,
            admin=is_telegram_admin(
                telegram_id
            ),
        ),
    )


# ============================================================
# /link TOKEN
# ============================================================

@dp.message(Command("link"))
async def cmd_link(
    message: Message,
):

    parts = (
        message.text.split(maxsplit=1)
        if message.text
        else []
    )

    if len(parts) < 2:

        await message.answer(
            "🔗 <b>Привязка аккаунта</b>\n\n"
            "Использование:\n"
            "<code>/link ВАШ_КОД</code>\n\n"
            "Код создаётся в профиле "
            "на сайте FENIX MUSIC."
        )

        return

    token = parts[1].strip()

    telegram_id = message.from_user.id

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_link_token
                == token
            )
            .first()
        )

        if not user:

            await message.answer(
                "❌ Код не найден."
            )

            return

        if (
            not user.telegram_link_expires_at
            or user.telegram_link_expires_at
            < utcnow()
        ):

            user.telegram_link_token = None
            user.telegram_link_expires_at = None

            db.commit()

            await message.answer(
                "⌛ Код уже истёк.\n"
                "Создай новый код на сайте."
            )

            return

        existing = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(telegram_id),
                User.id != user.id,
            )
            .first()
        )

        if existing:

            await message.answer(
                "❌ Этот Telegram уже "
                "привязан к другому аккаунту."
            )

            return

        user.telegram_id = str(
            telegram_id
        )

        user.telegram_link_token = None
        user.telegram_link_expires_at = None

        db.commit()

        await message.answer(
            "✅ <b>Готово!</b>\n\n"
            f"Аккаунт <b>{user.username}</b> "
            "успешно привязан.",
            reply_markup=main_menu(
                linked=True,
                admin=(
                    bool(user.is_admin)
                    or is_telegram_admin(
                        telegram_id
                    )
                ),
            ),
        )

    finally:

        db.close()


# ============================================================
# UNLINK
# ============================================================

@dp.message(Command("unlink"))
async def cmd_unlink(
    message: Message,
):

    telegram_id = message.from_user.id

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(telegram_id)
            )
            .first()
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
            "🔓 Telegram отвязан от аккаунта."
        )

    finally:

        db.close()


# ============================================================
# HOME
# ============================================================

@dp.callback_query(F.data == "home")
async def cb_home(
    callback: CallbackQuery,
):

    user = get_user_by_telegram(
        callback.from_user.id
    )

    await callback.message.edit_text(
        "🔥 <b>FENIX MUSIC</b>\n\n"
        "Главное меню:",
        reply_markup=main_menu(
            linked=bool(user),
            admin=(
                bool(user and user.is_admin)
                or is_telegram_admin(
                    callback.from_user.id
                )
            ),
        ),
    )

    await callback.answer()


# ============================================================
# MUSIC
# ============================================================

@dp.callback_query(F.data == "music")
async def cb_music(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        tracks = (
            db.query(Track)
            .order_by(
                Track.created_at.desc(),
                Track.id.desc(),
            )
            .limit(20)
            .all()
        )

        if not tracks:

            await callback.message.edit_text(
                "🎵 Музыка пока отсутствует.",
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[
                        [
                            back_button()
                        ]
                    ]
                ),
            )

            return

        rows = []

        for track in tracks:

            rows.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"🎵 {track.title[:30]} — "
                            f"{track.artist[:25]}"
                        ),
                        callback_data=f"track:{track.id}",
                    )
                ]
            )

        rows.append(
            [
                back_button()
            ]
        )

        await callback.message.edit_text(
            "🎵 <b>Последние треки</b>\n\n"
            "Выбери песню:",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# POPULAR
# ============================================================

@dp.callback_query(F.data == "popular")
async def cb_popular(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        tracks = (
            db.query(Track)
            .order_by(
                Track.plays.desc(),
                Track.created_at.desc(),
            )
            .limit(20)
            .all()
        )

        rows = []

        for i, track in enumerate(
            tracks,
            1,
        ):

            rows.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"{i}. {track.title[:27]} "
                            f"— {track.artist[:20]}"
                        ),
                        callback_data=(
                            f"track:{track.id}"
                        ),
                    )
                ]
            )

        rows.append(
            [
                back_button()
            ]
        )

        await callback.message.edit_text(
            "🔥 <b>Популярные треки</b>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# NEW
# ============================================================

@dp.callback_query(F.data == "new")
async def cb_new(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        tracks = (
            db.query(Track)
            .order_by(
                Track.created_at.desc(),
                Track.id.desc(),
            )
            .limit(20)
            .all()
        )

        rows = []

        for track in tracks:

            rows.append(
                [
                    InlineKeyboardButton(
                        text=(
                            f"🆕 {track.title[:30]} "
                            f"— {track.artist[:20]}"
                        ),
                        callback_data=(
                            f"track:{track.id}"
                        ),
                    )
                ]
            )

        rows.append(
            [
                back_button()
            ]
        )

        await callback.message.edit_text(
            "🆕 <b>Новинки</b>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
        )

    finally:

        db.close()

    await callback.answer()


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
        callback.data.split(":")[1]
    )

    db = SessionLocal()

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

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
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
            reply_markup=track_menu(
                track.id,
                liked=liked,
                admin=(
                    bool(
                        user
                        and user.is_admin
                    )
                    or is_telegram_admin(
                        callback.from_user.id
                    )
                ),
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# LISTEN
# ============================================================

@dp.callback_query(
    F.data.startswith("listen:")
)
async def cb_listen(
    callback: CallbackQuery,
):

    track_id = int(
        callback.data.split(":")[1]
    )

    db = SessionLocal()

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
                "Аудиофайл не найден",
                show_alert=True,
            )

            return

        # Telegram play count
        track.plays = (
            int(track.plays or 0)
            + 1
        )

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if user:

            db.add(
                History(
                    user_id=user.id,
                    track_id=track.id,
                )
            )

        db.commit()

        audio = FSInputFile(
            path
        )

        await callback.message.answer_audio(
            audio=audio,
            title=track.title,
            performer=track.artist,
            duration=int(
                track.duration or 0
            ),
        )

    finally:

        db.close()

    await callback.answer(
        "▶️ Отправляю трек"
    )


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
        callback.data.split(":")[1]
    )

    telegram_id = callback.from_user.id

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(telegram_id)
            )
            .first()
        )

        if not user:

            await callback.answer(
                "Сначала привяжи аккаунт.",
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
                track_id=track_id,
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
                    track_id=track_id,
                )
            )

            liked = True

        db.commit()

        await callback.message.edit_reply_markup(
            reply_markup=track_menu(
                track_id,
                liked=liked,
                admin=(
                    bool(user.is_admin)
                    or is_telegram_admin(
                        telegram_id
                    )
                ),
            )
        )

        await callback.answer(
            "❤️ Добавлено"
            if liked
            else "💔 Убрано"
        )

    finally:

        db.close()


# ============================================================
# FAVORITES
# ============================================================

@dp.callback_query(F.data == "favorites")
async def cb_favorites(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if not user:

            await callback.answer(
                "Сначала привяжи аккаунт.",
                show_alert=True,
            )

            return

        likes = (
            db.query(Like)
            .filter_by(
                user_id=user.id
            )
            .order_by(
                Like.created_at.desc()
            )
            .all()
        )

        rows = []

        for item in likes:

            track = db.get(
                Track,
                item.track_id,
            )

            if track:

                rows.append(
                    [
                        InlineKeyboardButton(
                            text=(
                                f"❤️ {track.title[:30]}"
                            ),
                            callback_data=(
                                f"track:{track.id}"
                            ),
                        )
                    ]
                )

        if not rows:

            text = (
                "❤️ <b>Избранное</b>\n\n"
                "Пока здесь ничего нет."
            )

        else:

            text = (
                "❤️ <b>Избранное</b>\n\n"
                "Твои любимые треки:"
            )

        rows.append(
            [
                back_button()
            ]
        )

        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# HISTORY
# ============================================================

@dp.callback_query(F.data == "history")
async def cb_history(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if not user:

            await callback.answer(
                "Сначала привяжи аккаунт.",
                show_alert=True,
            )

            return

        rows_db = (
            db.query(History)
            .filter_by(
                user_id=user.id
            )
            .order_by(
                History.played_at.desc()
            )
            .limit(20)
            .all()
        )

        rows = []

        for item in rows_db:

            track = db.get(
                Track,
                item.track_id,
            )

            if track:

                rows.append(
                    [
                        InlineKeyboardButton(
                            text=(
                                f"📜 {track.title[:30]}"
                            ),
                            callback_data=(
                                f"track:{track.id}"
                            ),
                        )
                    ]
                )

        if not rows:

            text = (
                "📜 <b>История</b>\n\n"
                "История прослушиваний пуста."
            )

        else:

            text = (
                "📜 <b>История</b>\n\n"
                "Последние прослушанные треки:"
            )

        rows.append(
            [
                back_button()
            ]
        )

        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# PLAYLISTS
# ============================================================

@dp.callback_query(F.data == "playlists")
async def cb_playlists(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if not user:

            await callback.answer(
                "Сначала привяжи аккаунт.",
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
                            f"📂 {playlist.name[:30]} "
                            f"({count})"
                        ),
                        callback_data=(
                            f"playlist:{playlist.id}"
                        ),
                    )
                ]
            )

        if not rows:

            text = (
                "📂 <b>Плейлисты</b>\n\n"
                "У тебя пока нет плейлистов.\n"
                "Создать их можно на сайте."
            )

        else:

            text = (
                "📂 <b>Плейлисты</b>\n\n"
                "Твои плейлисты:"
            )

        rows.append(
            [
                back_button()
            ]
        )

        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# PLAYLIST
# ============================================================

@dp.callback_query(
    F.data.startswith("playlist:")
)
async def cb_playlist(
    callback: CallbackQuery,
):

    playlist_id = int(
        callback.data.split(":")[1]
    )

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if not user:

            await callback.answer(
                "Сначала привяжи аккаунт.",
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
                "Плейлист не найден.",
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

            if track:

                rows.append(
                    [
                        InlineKeyboardButton(
                            text=(
                                f"🎵 {track.title[:30]}"
                            ),
                            callback_data=(
                                f"track:{track.id}"
                            ),
                        )
                    ]
                )

        rows.append(
            [
                back_button("playlists")
            ]
        )

        await callback.message.edit_text(
            f"📂 <b>{playlist.name}</b>\n\n"
            f"{playlist.description or ''}",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# PROFILE
# ============================================================

@dp.callback_query(F.data == "profile")
async def cb_profile(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if not user:

            await callback.answer(
                "Сначала привяжи аккаунт.",
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
            f"👤 Username: <b>{user.username}</b>\n"
            f"📧 Email: {user.email}\n\n"
            f"❤️ Избранное: {liked}\n"
            f"📜 Прослушиваний: {history}\n"
            f"📂 Плейлистов: {playlists}\n"
            f"🔗 Telegram: подключён",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="📈 Статистика",
                            callback_data="stats",
                        )
                    ],
                    [
                        InlineKeyboardButton(
                            text="🔓 Отвязать Telegram",
                            callback_data="unlink_confirm",
                        )
                    ],
                    [
                        back_button()
                    ],
                ]
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# UNLINK CONFIRM
# ============================================================

@dp.callback_query(
    F.data == "unlink_confirm"
)
async def cb_unlink_confirm(
    callback: CallbackQuery,
):

    await callback.message.edit_text(
        "⚠️ <b>Отвязать Telegram?</b>\n\n"
        "После отвязки Telegram перестанет "
        "иметь доступ к твоему аккаунту FENIX MUSIC.",
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🔓 Да, отвязать",
                        callback_data="unlink_yes",
                    ),
                    InlineKeyboardButton(
                        text="❌ Отмена",
                        callback_data="profile",
                    ),
                ]
            ]
        ),
    )

    await callback.answer()


@dp.callback_query(
    F.data == "unlink_yes"
)
async def cb_unlink_yes(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if user:

            user.telegram_id = None
            user.telegram_link_token = None
            user.telegram_link_expires_at = None

            db.commit()

        await callback.message.edit_text(
            "🔓 <b>Telegram отвязан.</b>\n\n"
            "Чтобы привязать его снова, "
            "создай новый код на сайте.",
            reply_markup=main_menu(
                linked=False,
                admin=is_telegram_admin(
                    callback.from_user.id
                ),
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# STATS
# ============================================================

@dp.callback_query(F.data == "stats")
async def cb_stats(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if not user:

            await callback.answer(
                "Сначала привяжи аккаунт.",
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

        total_seconds = (
            db.query(
                Track.duration
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
            .all()
        )

        seconds = sum(
            int(x[0] or 0)
            for x in total_seconds
        )

        await callback.message.edit_text(
            "📈 <b>Твоя статистика</b>\n\n"
            f"🎵 Треков прослушано: {played}\n"
            f"⏱ Время: {seconds // 60} мин\n"
            f"❤️ Избранное: {liked}\n"
            f"📂 Плейлисты: {playlists}",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        back_button(
                            "profile"
                        )
                    ]
                ]
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# CHARTS
# ============================================================

@dp.callback_query(F.data == "charts")
async def cb_charts(
    callback: CallbackQuery,
):

    await callback.message.edit_text(
        "📊 <b>Чарты FENIX MUSIC</b>\n\n"
        "Выбери период:",
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🔥 Всё время",
                        callback_data="chart:all",
                    )
                ],
                [
                    InlineKeyboardButton(
                        text="📅 Сегодня",
                        callback_data="chart:day",
                    ),
                    InlineKeyboardButton(
                        text="📆 Неделя",
                        callback_data="chart:week",
                    ),
                ],
                [
                    InlineKeyboardButton(
                        text="🗓 Месяц",
                        callback_data="chart:month",
                    )
                ],
                [
                    back_button()
                ],
            ]
        ),
    )

    await callback.answer()


@dp.callback_query(
    F.data.startswith("chart:")
)
async def cb_chart_period(
    callback: CallbackQuery,
):

    period = callback.data.split(":")[1]

    db = SessionLocal()

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

            values = [
                (
                    track,
                    int(
                        track.plays
                        or 0
                    ),
                )
                for track in rows
            ]

        else:

            days = {
                "day": 1,
                "week": 7,
                "month": 30,
            }.get(period, 7)

            cutoff = (
                utcnow()
                - __import__(
                    "datetime"
                ).timedelta(
                    days=days
                )
            )

            values = (
                db.query(
                    Track,
                    __import__(
                        "sqlalchemy"
                    ).func.count(
                        History.id
                    ).label(
                        "plays"
                    ),
                )
                .join(
                    History,
                    History.track_id
                    == Track.id,
                )
                .filter(
                    History.played_at
                    >= cutoff
                )
                .group_by(
                    Track.id
                )
                .order_by(
                    __import__(
                        "sqlalchemy"
                    ).func.count(
                        History.id
                    ).desc()
                )
                .limit(20)
                .all()
            )

        labels = {
            "all": "🔥 Всё время",
            "day": "📅 Сегодня",
            "week": "📆 Неделя",
            "month": "🗓 Месяц",
        }

        text = (
            f"📊 <b>{labels.get(period, period)}</b>\n\n"
        )

        if not values:

            text += "Пока нет данных."

        else:

            for index, row in enumerate(
                values,
                1,
            ):

                track = row[0]
                plays = int(row[1] or 0)

                medals = {
                    1: "🥇",
                    2: "🥈",
                    3: "🥉",
                }

                medal = medals.get(
                    index,
                    f"{index}.",
                )

                text += (
                    f"{medal} "
                    f"<b>{track.title}</b> — "
                    f"{track.artist}\n"
                    f"   ▶️ {plays}\n\n"
                )

        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="🔥 Всё",
                            callback_data="chart:all",
                        ),
                        InlineKeyboardButton(
                            text="📅 День",
                            callback_data="chart:day",
                        ),
                    ],
                    [
                        InlineKeyboardButton(
                            text="📆 Неделя",
                            callback_data="chart:week",
                        ),
                        InlineKeyboardButton(
                            text="🗓 Месяц",
                            callback_data="chart:month",
                        ),
                    ],
                    [
                        back_button(
                            "charts"
                        )
                    ],
                ]
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# LYRICS LIST
# ============================================================

@dp.callback_query(F.data == "lyrics")
async def cb_lyrics_list(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        tracks = (
            db.query(Track)
            .filter(
                Track.lyrics.isnot(None),
                Track.lyrics != "",
            )
            .order_by(
                Track.title.asc()
            )
            .limit(30)
            .all()
        )

        rows = [
            [
                InlineKeyboardButton(
                    text=f"🎤 {track.title[:35]}",
                    callback_data=(
                        f"lyrics:{track.id}"
                    ),
                )
            ]
            for track in tracks
        ]

        if not rows:

            text = (
                "🎤 <b>Lyrics</b>\n\n"
                "Текстов песен пока нет."
            )

        else:

            text = (
                "🎤 <b>Lyrics</b>\n\n"
                "Выбери трек:"
            )

        rows.append(
            [
                back_button()
            ]
        )

        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# LYRICS TRACK
# ============================================================

@dp.callback_query(
    F.data.startswith("lyrics:")
)
async def cb_lyrics_track(
    callback: CallbackQuery,
):

    track_id = int(
        callback.data.split(":")[1]
    )

    db = SessionLocal()

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

        lyrics = (
            track.lyrics
            or "Текст отсутствует."
        )

        # Telegram message limit protection.
        if len(lyrics) > 3800:

            lyrics = (
                lyrics[:3800]
                + "\n\n…"
            )

        await callback.message.edit_text(
            f"🎤 <b>{track.title}</b>\n"
            f"👤 {track.artist}\n\n"
            f"{lyrics}",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="▶️ Слушать",
                            callback_data=(
                                f"listen:{track.id}"
                            ),
                        )
                    ],
                    [
                        back_button(
                            f"track:{track.id}"
                        )
                    ],
                ]
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# LINK HELP
# ============================================================

@dp.callback_query(
    F.data == "link_help"
)
async def cb_link_help(
    callback: CallbackQuery,
):

    await callback.message.edit_text(
        "🔗 <b>Привязка аккаунта</b>\n\n"
        "1. Открой сайт FENIX MUSIC.\n"
        "2. Войди в свой аккаунт.\n"
        "3. Открой профиль/настройки.\n"
        "4. Нажми «Привязать Telegram».\n"
        "5. Скопируй полученный код.\n"
        "6. Отправь сюда:\n\n"
        "<code>/link ТВОЙ_КОД</code>\n\n"
        "⏱ Код действует 10 минут.",
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    back_button()
                ]
            ]
        ),
    )

    await callback.answer()


# ============================================================
# SEARCH
# ============================================================

@dp.callback_query(F.data == "search")
async def cb_search(
    callback: CallbackQuery,
):

    await callback.message.edit_text(
        "🔎 <b>Поиск</b>\n\n"
        "Отправь название трека, исполнителя "
        "или альбома следующим сообщением.",
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    back_button()
                ]
            ]
        ),
    )

    await callback.answer()


@dp.message(
    F.text,
    ~F.text.startswith("/"),
)
async def text_search(
    message: Message,
):

    query = (
        message.text or ""
    ).strip()

    if not query:
        return

    # Don't treat normal text as search if
    # user just writes a short menu phrase.
    db = SessionLocal()

    try:

        pattern = f"%{query}%"

        tracks = (
            db.query(Track)
            .filter(
                __import__(
                    "sqlalchemy"
                ).or_(
                    Track.title.ilike(pattern),
                    Track.artist.ilike(pattern),
                    Track.album.ilike(pattern),
                )
            )
            .limit(20)
            .all()
        )

        rows = [
            [
                InlineKeyboardButton(
                    text=(
                        f"🎵 {track.title[:30]} — "
                        f"{track.artist[:20]}"
                    ),
                    callback_data=(
                        f"track:{track.id}"
                    ),
                )
            ]
            for track in tracks
        ]

        if not rows:

            await message.answer(
                f"🔎 По запросу "
                f"<b>{query}</b> ничего не найдено."
            )

            return

        rows.append(
            [
                back_button()
            ]
        )

        await message.answer(
            f"🔎 <b>Результаты поиска:</b>\n"
            f"<i>{query}</i>",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=rows
            ),
        )

    finally:

        db.close()


# ============================================================
# ADMIN
# ============================================================

def admin_menu():

    return InlineKeyboardMarkup(
        inline_keyboard=[
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
                    text="🆕 Новинки",
                    callback_data="new",
                ),
                InlineKeyboardButton(
                    text="📊 Статистика",
                    callback_data="admin_stats",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="🔄 Сканировать музыку",
                    callback_data="scan",
                )
            ],
            [
                back_button()
            ],
        ]
    )


def admin_allowed(
    telegram_id: int,
    user: Optional[User],
):

    return (
        is_telegram_admin(telegram_id)
        or bool(
            user
            and user.is_admin
        )
    )


@dp.callback_query(F.data == "admin")
async def cb_admin(
    callback: CallbackQuery,
):

    user = get_user_by_telegram(
        callback.from_user.id
    )

    if not admin_allowed(
        callback.from_user.id,
        user,
    ):

        await callback.answer(
            "Нет доступа.",
            show_alert=True,
        )

        return

    await callback.message.edit_text(
        "⚙️ <b>Админ-панель FENIX MUSIC</b>\n\n"
        "Управление музыкальной библиотекой:",
        reply_markup=admin_menu(),
    )

    await callback.answer()


# ============================================================
# ADMIN STATS
# ============================================================

@dp.callback_query(
    F.data == "admin_stats"
)
async def cb_admin_stats(
    callback: CallbackQuery,
):

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if not admin_allowed(
            callback.from_user.id,
            user,
        ):

            await callback.answer(
                "Нет доступа.",
                show_alert=True,
            )

            return

        users = db.query(User).count()
        tracks = db.query(Track).count()
        likes = db.query(Like).count()
        history = db.query(History).count()
        playlists = db.query(Playlist).count()

        plays = sum(
            int(x[0] or 0)
            for x in db.query(
                Track.plays
            ).all()
        )

        lyrics = (
            db.query(Track)
            .filter(
                Track.lyrics.isnot(None),
                Track.lyrics != "",
            )
            .count()
        )

        telegram = (
            db.query(User)
            .filter(
                User.telegram_id.isnot(None)
            )
            .count()
        )

        await callback.message.edit_text(
            "📊 <b>Статистика FENIX MUSIC</b>\n\n"
            f"👤 Пользователей: {users}\n"
            f"🎵 Треков: {tracks}\n"
            f"▶️ Прослушиваний: {plays}\n"
            f"❤️ Лайков: {likes}\n"
            f"📜 Историй: {history}\n"
            f"📂 Плейлистов: {playlists}\n"
            f"🎤 Треков с lyrics: {lyrics}\n"
            f"🔗 Telegram подключён: {telegram}",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        back_button(
                            "admin"
                        )
                    ]
                ]
            ),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# ADMIN SCAN
# ============================================================

@dp.callback_query(F.data == "scan")
async def cb_scan(
    callback: CallbackQuery,
):

    user = get_user_by_telegram(
        callback.from_user.id
    )

    if not admin_allowed(
        callback.from_user.id,
        user,
    ):

        await callback.answer(
            "Нет доступа.",
            show_alert=True,
        )

        return

    await callback.answer(
        "🔄 Сканирую..."
    )

    db = SessionLocal()

    try:

        result = scan_music(
            db
        )

    finally:

        db.close()

    await callback.message.edit_text(
        "🔄 <b>Сканирование завершено</b>\n\n"
        f"🎵 Найдено: {result['found']}\n"
        f"➕ Добавлено: {result['added']}\n"
        f"🔄 Обновлено: {result['updated']}",
        reply_markup=admin_menu(),
    )


# ============================================================
# ADMIN DELETE
# ============================================================

@dp.callback_query(
    F.data.startswith("delete:")
)
async def cb_delete(
    callback: CallbackQuery,
):

    track_id = int(
        callback.data.split(":")[1]
    )

    db = SessionLocal()

    try:

        user = (
            db.query(User)
            .filter(
                User.telegram_id
                == str(
                    callback.from_user.id
                )
            )
            .first()
        )

        if not admin_allowed(
            callback.from_user.id,
            user,
        ):

            await callback.answer(
                "Нет доступа.",
                show_alert=True,
            )

            return

        track = db.get(
            Track,
            track_id,
        )

        if not track:

            await callback.answer(
                "Трек не найден.",
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

        db.delete(track)
        db.commit()

        await callback.message.edit_text(
            "🗑 <b>Трек удалён.</b>",
            reply_markup=admin_menu(),
        )

    finally:

        db.close()

    await callback.answer()


# ============================================================
# FALLBACK
# ============================================================

@dp.callback_query()
async def unknown_callback(
    callback: CallbackQuery,
):

    await callback.answer(
        "Раздел пока недоступен."
    )


# ============================================================
# POLLING
# ============================================================

async def main():

    logger.info(
        "FENIX MUSIC Telegram Bot V8 starting..."
    )

    me = await bot.get_me()

    logger.info(
        "Telegram bot: @%s",
        me.username,
    )

    # Prevent stale webhook from interfering
    await bot.delete_webhook(
        drop_pending_updates=False
    )

    logger.info(
        "Telegram polling started"
    )

    try:

        await dp.start_polling(
            bot
        )

    finally:

        await bot.session.close()


if __name__ == "__main__":

    asyncio.run(
        main()
    )
