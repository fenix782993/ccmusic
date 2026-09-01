from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def main_menu(is_admin: bool = False):
    rows = [
        [
            InlineKeyboardButton(text="🎵 Музыка", callback_data="music"),
            InlineKeyboardButton(text="🔥 Популярные", callback_data="popular"),
        ],
        [
            InlineKeyboardButton(text="🆕 Новые", callback_data="new"),
            InlineKeyboardButton(text="🔎 Поиск", callback_data="search"),
        ],
        [
            InlineKeyboardButton(text="❤️ Избранное", callback_data="favorites"),
            InlineKeyboardButton(text="📚 Плейлисты", callback_data="playlists"),
        ],
        [
            InlineKeyboardButton(text="🕘 История", callback_data="history"),
            InlineKeyboardButton(text="👤 Профиль", callback_data="profile"),
        ],
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="stats"),
        ],
    ]

    if is_admin:
        rows.append([
            InlineKeyboardButton(
                text="⚙️ Админ-панель",
                callback_data="admin"
            )
        ])

    return InlineKeyboardMarkup(inline_keyboard=rows)


def admin_menu():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="⬆️ Добавить песню",
                    callback_data="upload"
                )
            ],
            [
                InlineKeyboardButton(
                    text="🎵 Все песни",
                    callback_data="music"
                ),
                InlineKeyboardButton(
                    text="🔥 Популярные",
                    callback_data="popular"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="🆕 Новые",
                    callback_data="new"
                ),
                InlineKeyboardButton(
                    text="🔄 Сканировать",
                    callback_data="scan"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="📊 Статистика",
                    callback_data="stats"
                )
            ],
            [
                InlineKeyboardButton(
                    text="🏠 Главное меню",
                    callback_data="home"
                )
            ],
        ]
    )


def cancel_menu():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="❌ Отмена",
                    callback_data="cancel"
                )
            ]
        ]
    )


def after_upload_menu(track_id: int):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🖼 Обложка",
                    callback_data=f"cover:{track_id}"
                ),
                InlineKeyboardButton(
                    text="✏️ Данные",
                    callback_data=f"edit:{track_id}"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="🗑 Удалить",
                    callback_data=f"delete:{track_id}"
                )
            ],
            [
                InlineKeyboardButton(
                    text="🎵 Все песни",
                    callback_data="music"
                ),
                InlineKeyboardButton(
                    text="⚙️ Админка",
                    callback_data="admin"
                ),
            ],
        ]
    )


def track_menu(track_id: int):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="▶️ Открыть",
                    callback_data=f"track:{track_id}"
                )
            ],
            [
                InlineKeyboardButton(
                    text="🗑 Удалить",
                    callback_data=f"delete:{track_id}"
                )
            ],
            [
                InlineKeyboardButton(
                    text="🖼 Обложка",
                    callback_data=f"cover:{track_id}"
                ),
                InlineKeyboardButton(
                    text="✏️ Данные",
                    callback_data=f"edit:{track_id}"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="⬅️ Назад",
                    callback_data="music"
                )
            ],
        ]
    )


def profile_menu():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="❤️ Избранное",
                    callback_data="favorites"
                ),
                InlineKeyboardButton(
                    text="🕘 История",
                    callback_data="history"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="📚 Плейлисты",
                    callback_data="playlists"
                ),
                InlineKeyboardButton(
                    text="📊 Статистика",
                    callback_data="stats"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="🏠 Главное меню",
                    callback_data="home"
                )
            ],
        ]
    )


def library_menu():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="❤️ Избранное",
                    callback_data="favorites"
                )
            ],
            [
                InlineKeyboardButton(
                    text="📚 Плейлисты",
                    callback_data="playlists"
                )
            ],
            [
                InlineKeyboardButton(
                    text="🕘 История",
                    callback_data="history"
                )
            ],
            [
                InlineKeyboardButton(
                    text="🏠 Главное меню",
                    callback_data="home"
                )
            ],
        ]
    )


def back_menu(callback_data: str = "home"):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="⬅️ Назад",
                    callback_data=callback_data
                )
            ]
        ]
    )
