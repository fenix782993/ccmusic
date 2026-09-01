from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

def main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎵 Музыка", callback_data="music"),
         InlineKeyboardButton(text="📊 Статистика", callback_data="stats")],
        [InlineKeyboardButton(text="🔥 Популярные", callback_data="popular"),
         InlineKeyboardButton(text="🆕 Новые", callback_data="new")],
        [InlineKeyboardButton(text="🔎 Поиск", callback_data="search"),
         InlineKeyboardButton(text="⚙️ Админ-панель", callback_data="admin")],
    ])

def admin_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⬆️ Добавить песню", callback_data="upload")],
        [InlineKeyboardButton(text="🎵 Все песни", callback_data="music"),
         InlineKeyboardButton(text="🔥 Популярные", callback_data="popular")],
        [InlineKeyboardButton(text="🔄 Сканировать", callback_data="scan"),
         InlineKeyboardButton(text="📊 Статистика", callback_data="stats")],
        [InlineKeyboardButton(text="🏠 Главное меню", callback_data="home")],
    ])

def cancel_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")]
    ])

def after_upload_menu(track_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🖼 Добавить обложку", callback_data=f"cover:{track_id}")],
        [InlineKeyboardButton(text="✏️ Изменить данные", callback_data=f"edit:{track_id}")],
        [InlineKeyboardButton(text="🎵 К списку песен", callback_data="music")],
        [InlineKeyboardButton(text="🏠 Админ-панель", callback_data="admin")],
    ])

def track_menu(track_id: int, liked=False) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="▶️ Открыть", callback_data=f"track:{track_id}")],
        [InlineKeyboardButton(text=("💔 Убрать лайк" if liked else "❤️ Лайк"),
                               callback_data=f"like:{track_id}")],
        [InlineKeyboardButton(text="🗑 Удалить", callback_data=f"delete:{track_id}")],
    ])
