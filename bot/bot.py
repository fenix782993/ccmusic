```python
import os
import asyncio
import logging
from pathlib import Path

import aiohttp
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    FSInputFile,
)
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup


# =========================================================
# CONFIG
# =========================================================

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()

BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "https://ccmusice.onrender.com",
).rstrip("/")

ADMIN_IDS = {
    int(x.strip())
    for x in os.getenv("ADMIN_IDS", "").split(",")
    if x.strip().isdigit()
}

UPLOAD_DIR = Path(
    os.getenv("UPLOAD_DIR", "uploads")
)

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

if not BOT_TOKEN:
    raise RuntimeError(
        "BOT_TOKEN environment variable is not configured"
    )


# =========================================================
# LOGGING
# =========================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)

logger = logging.getLogger("fenix-music-bot")


# =========================================================
# BOT
# =========================================================

bot = Bot(
    token=BOT_TOKEN
)

dp = Dispatcher()


# =========================================================
# STATES
# =========================================================

class AddTrackState(StatesGroup):
    waiting_audio = State()
    waiting_title = State()
    waiting_artist = State()
    waiting_album = State()
    waiting_cover = State()


# =========================================================
# HELPERS
# =========================================================

def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


def admin_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎵 Добавить песню",
                    callback_data="track_add",
                )
            ],
            [
                InlineKeyboardButton(
                    text="📚 Список треков",
                    callback_data="track_list",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🔄 Проверить backend",
                    callback_data="backend_check",
                )
            ],
        ]
    )


async def backend_get(
    endpoint: str,
):
    url = f"{BACKEND_URL}{endpoint}"

    timeout = aiohttp.ClientTimeout(
        total=60
    )

    async with aiohttp.ClientSession(
        timeout=timeout
    ) as session:

        async with session.get(url) as response:

            text = await response.text()

            try:
                import json

                data = json.loads(text)
            except Exception:
                data = {
                    "raw": text
                }

            return response.status, data


async def backend_post(
    endpoint: str,
    payload: dict,
):
    url = f"{BACKEND_URL}{endpoint}"

    timeout = aiohttp.ClientTimeout(
        total=120
    )

    async with aiohttp.ClientSession(
        timeout=timeout
    ) as session:

        async with session.post(
            url,
            json=payload,
        ) as response:

            text = await response.text()

            try:
                import json

                data = json.loads(text)
            except Exception:
                data = {
                    "raw": text
                }

            return response.status, data


async def backend_upload(
    filepath: Path,
    metadata: dict,
):
    """
    Загружает файл на backend.

    Backend endpoint:
        POST /api/admin/tracks/upload

    multipart:
        audio
        title
        artist_name
        album_name
        cover_url
    """

    url = (
        f"{BACKEND_URL}"
        "/api/admin/tracks/upload"
    )

    timeout = aiohttp.ClientTimeout(
        total=600
    )

    form = aiohttp.FormData()

    form.add_field(
        "audio",
        filepath.open(
            "rb"
        ),
        filename=filepath.name,
        content_type=(
            "audio/mpeg"
        ),
    )

    form.add_field(
        "title",
        metadata.get(
            "title",
            filepath.stem,
        ),
    )

    form.add_field(
        "artist_name",
        metadata.get(
            "artist_name",
            "Unknown",
        ),
    )

    form.add_field(
        "album_name",
        metadata.get(
            "album_name",
            "",
        ),
    )

    form.add_field(
        "cover_url",
        metadata.get(
            "cover_url",
            "",
        ),
    )

    async with aiohttp.ClientSession(
        timeout=timeout
    ) as session:

        async with session.post(
            url,
            data=form,
        ) as response:

            text = await response.text()

            try:
                import json

                data = json.loads(text)
            except Exception:
                data = {
                    "raw": text
                }

            return response.status, data


# =========================================================
# START
# =========================================================

@dp.message(CommandStart())
async def start_command(
    message: Message,
):

    if not is_admin(
        message.from_user.id
    ):
        await message.answer(
            "🔥 Fenix Music\n\n"
            "Бот музыкальной платформы.\n"
            "Доступ администратора отсутствует."
        )
        return

    await message.answer(
        "🔥 <b>FENIX MUSIC</b>\n\n"
        "Панель управления музыкой.",
        reply_markup=admin_keyboard(),
        parse_mode="HTML",
    )


# =========================================================
# ADMIN
# =========================================================

@dp.message(Command("admin"))
async def admin_command(
    message: Message,
):

    if not is_admin(
        message.from_user.id
    ):
        return

    await message.answer(
        "🔥 <b>Админ-панель Fenix Music</b>",
        reply_markup=admin_keyboard(),
        parse_mode="HTML",
    )


# =========================================================
# ADD TRACK
# =========================================================

@dp.callback_query(
    F.data == "track_add"
)
async def track_add(
    callback: CallbackQuery,
    state: FSMContext,
):

    if not is_admin(
        callback.from_user.id
    ):
        await callback.answer(
            "Нет доступа",
            show_alert=True,
        )
        return

    await state.set_state(
        AddTrackState.waiting_audio
    )

    await callback.message.answer(
        "🎵 <b>Добавление трека</b>\n\n"
        "Отправь мне аудиофайл.\n\n"
        "Поддерживается MP3 и другие "
        "аудиоформаты Telegram.",
        parse_mode="HTML",
    )

    await callback.answer()


@dp.message(
    AddTrackState.waiting_audio,
    F.audio,
)
async def receive_audio(
    message: Message,
    state: FSMContext,
):

    if not is_admin(
        message.from_user.id
    ):
        return

    audio = message.audio

    if not audio:
        await message.answer(
            "❌ Аудиофайл не найден."
        )
        return

    filename = (
        audio.file_name
        or f"{audio.file_id}.mp3"
    )

    safe_name = (
        filename
        .replace("/", "_")
        .replace("\\", "_")
        .replace("..", "_")
    )

    filepath = (
        UPLOAD_DIR /
        safe_name
    )

    await message.answer(
        "⬇️ Загружаю аудио..."
    )

    try:

        telegram_file = await bot.get_file(
            audio.file_id
        )

        await bot.download_file(
            telegram_file.file_path,
            destination=filepath,
        )

    except Exception as error:

        logger.exception(
            "Audio download failed"
        )

        await message.answer(
            f"❌ Ошибка загрузки:\n"
            f"<code>{error}</code>",
            parse_mode="HTML",
        )

        return

    await state.update_data(
        filepath=str(filepath),
        original_filename=filename,
        duration=audio.duration or 0,
    )

    await state.set_state(
        AddTrackState.waiting_title
    )

    await message.answer(
        "📝 Теперь отправь <b>название трека</b>.",
        parse_mode="HTML",
    )


@dp.message(
    AddTrackState.waiting_audio
)
async def wrong_audio(
    message: Message,
):

    await message.answer(
        "❌ Отправь именно аудиофайл."
    )


# =========================================================
# TITLE
# =========================================================

@dp.message(
    AddTrackState.waiting_title
)
async def receive_title(
    message: Message,
    state: FSMContext,
):

    title = (
        message.text or ""
    ).strip()

    if not title:
        await message.answer(
            "❌ Название не может быть пустым."
        )
        return

    await state.update_data(
        title=title
    )

    await state.set_state(
        AddTrackState.waiting_artist
    )

    await message.answer(
        "🎤 Отправь имя <b>исполнителя</b>.",
        parse_mode="HTML",
    )


# =========================================================
# ARTIST
# =========================================================

@dp.message(
    AddTrackState.waiting_artist
)
async def receive_artist(
    message: Message,
    state: FSMContext,
):

    artist = (
        message.text or ""
    ).strip()

    if not artist:
        artist = "Unknown"

    await state.update_data(
        artist_name=artist
    )

    await state.set_state(
        AddTrackState.waiting_album
    )

    await message.answer(
        "💿 Отправь название альбома.\n\n"
        "Если альбома нет — напиши <b>нет</b>.",
        parse_mode="HTML",
    )


# =========================================================
# ALBUM
# =========================================================

@dp.message(
    AddTrackState.waiting_album
)
async def receive_album(
    message: Message,
    state: FSMContext,
):

    album = (
        message.text or ""
    ).strip()

    if album.lower() in {
        "нет",
        "no",
        "-",
        "none",
    }:
        album = ""

    await state.update_data(
        album_name=album
    )

    await state.set_state(
        AddTrackState.waiting_cover
    )

    await message.answer(
        "🖼 Отправь URL обложки.\n\n"
        "Если обложки нет — напиши <b>нет</b>.",
        parse_mode="HTML",
    )


# =========================================================
# COVER
# =========================================================

@dp.message(
    AddTrackState.waiting_cover
)
async def receive_cover(
    message: Message,
    state: FSMContext,
):

    cover = (
        message.text or ""
    ).strip()

    if cover.lower() in {
        "нет",
        "no",
        "-",
        "none",
    }:
        cover = ""

    data = await state.get_data()

    filepath = Path(
        data["filepath"]
    )

    metadata = {
        "title": data.get(
            "title",
            filepath.stem,
        ),
        "artist_name": data.get(
            "artist_name",
            "Unknown",
        ),
        "album_name": data.get(
            "album_name",
            "",
        ),
        "cover_url": cover,
    }

    await message.answer(
        "🚀 Загружаю трек в Fenix Music..."
    )

    try:

        status, result = (
            await backend_upload(
                filepath,
                metadata,
            )
        )

        if status >= 400:

            await message.answer(
                "❌ Backend отклонил трек.\n\n"
                f"<code>{result}</code>",
                parse_mode="HTML",
            )

            return

        track = (
            result.get("track")
            or result.get("data")
            or result
        )

        await message.answer(
            "✅ <b>Трек добавлен!</b>\n\n"
            f"🎵 {metadata['title']}\n"
            f"🎤 {metadata['artist_name']}\n"
            f"💿 {metadata['album_name'] or '—'}\n\n"
            f"ID: <code>{track.get('id', '—')}</code>",
            parse_mode="HTML",
            reply_markup=admin_keyboard(),
        )

    except Exception as error:

        logger.exception(
            "Track upload failed"
        )

        await message.answer(
            "❌ Не удалось связаться с backend.\n\n"
            f"<code>{error}</code>",
            parse_mode="HTML",
        )

    finally:

        await state.clear()

        try:
            if filepath.exists():
                filepath.unlink()
        except Exception:
            pass


# =========================================================
# TRACK LIST
# =========================================================

@dp.callback_query(
    F.data == "track_list"
)
async def track_list(
    callback: CallbackQuery,
):

    if not is_admin(
        callback.from_user.id
    ):
        await callback.answer(
            "Нет доступа",
            show_alert=True,
        )
        return

    await callback.answer()

    try:

        status, data = (
            await backend_get(
                "/api/tracks"
            )
        )

        if status >= 400:

            await callback.message.answer(
                "❌ Backend вернул ошибку."
            )
            return

        tracks = data.get(
            "tracks",
            []
        )

        if not tracks:

            await callback.message.answer(
                "📭 В Fenix Music пока нет треков."
            )
            return

        lines = [
            "🎵 <b>FENIX MUSIC — ТРЕКИ</b>",
            "",
        ]

        for track in tracks[:30]:

            track_id = track.get(
                "id",
                "?"
            )

            title = track.get(
                "title",
                "Без названия"
            )

            artist = track.get(
                "artist_name",
                "Unknown"
            )

            plays = track.get(
                "plays_count",
                0
            )

            lines.append(
                f"#{track_id} — "
                f"<b>{title}</b>\n"
                f"🎤 {artist} | ▶️ {plays}"
            )

        if len(tracks) > 30:
            lines.append(
                f"\n… и ещё {len(tracks)-30}"
            )

        await callback.message.answer(
            "\n".join(lines),
            parse_mode="HTML",
        )

    except Exception as error:

        logger.exception(
            "Track list failed"
        )

        await callback.message.answer(
            f"❌ Ошибка:\n"
            f"<code>{error}</code>",
            parse_mode="HTML",
        )


# =========================================================
# BACKEND CHECK
# =========================================================

@dp.callback_query(
    F.data == "backend_check"
)
async def backend_check(
    callback: CallbackQuery,
):

    if not is_admin(
        callback.from_user.id
    ):
        await callback.answer(
            "Нет доступа",
            show_alert=True,
        )
        return

    await callback.answer()

    try:

        status, data = (
            await backend_get(
                "/api/health"
            )
        )

        if status == 200:

            await callback.message.answer(
                "🟢 <b>Backend ONLINE</b>\n\n"
                f"Status: <code>{status}</code>\n"
                f"Database: "
                f"<code>{data.get('database', 'unknown')}</code>",
                parse_mode="HTML",
            )

        else:

            await callback.message.answer(
                "🔴 <b>Backend ERROR</b>\n\n"
                f"HTTP: <code>{status}</code>\n"
                f"<code>{data}</code>",
                parse_mode="HTML",
            )

    except Exception as error:

        await callback.message.answer(
            "🔴 <b>Backend недоступен</b>\n\n"
            f"<code>{error}</code>",
            parse_mode="HTML",
        )


# =========================================================
# CANCEL
# =========================================================

@dp.message(Command("cancel"))
async def cancel(
    message: Message,
    state: FSMContext,
):

    await state.clear()

    await message.answer(
        "❌ Добавление отменено.",
        reply_markup=admin_keyboard()
        if is_admin(
            message.from_user.id
        )
        else None,
    )


# =========================================================
# FALLBACK
# =========================================================

@dp.message()
async def fallback(
    message: Message,
):

    if is_admin(
        message.from_user.id
    ):

        await message.answer(
            "🔥 Fenix Music\n\n"
            "Используй /admin.",
            reply_markup=admin_keyboard(),
        )


# =========================================================
# MAIN
# =========================================================

async def main():

    logger.info(
        "========================================"
    )

    logger.info(
        "FENIX MUSIC BOT STARTING"
    )

    logger.info(
        "Backend: %s",
        BACKEND_URL,
    )

    logger.info(
        "Admins: %s",
        len(ADMIN_IDS),
    )

    logger.info(
        "========================================"
    )

    await dp.start_polling(
        bot
    )


if __name__ == "__main__":

    try:
        asyncio.run(
            main()
        )

    except KeyboardInterrupt:

        logger.info(
            "Bot stopped"
        )
```
