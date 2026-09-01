from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def main_menu(is_admin: bool = False):
    rows = [
        [InlineKeyboardButton(text="🎵 Музыка", callback_data="music"), InlineKeyboardButton(text="🔥 Популярные", callback_data="popular")],
        [InlineKeyboardButton(text="🆕 Новые", callback_data="new"), InlineKeyboardButton(text="🔎 Поиск", callback_data="search")],
    ]
    if is_admin:
        rows.append([InlineKeyboardButton(text="⚙️ Админ-панель", callback_data="admin")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def admin_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⬆️ Добавить песню", callback_data="upload")],
        [InlineKeyboardButton(text="🎵 Все песни", callback_data="music"), InlineKeyboardButton(text="🔥 Популярные", callback_data="popular")],
        [InlineKeyboardButton(text="🆕 Новые", callback_data="new"), InlineKeyboardButton(text="🔄 Сканировать", callback_data="scan")],
        [InlineKeyboardButton(text="📊 Статистика", callback_data="stats")],
        [InlineKeyboardButton(text="🏠 Главное меню", callback_data="home")],
    ])


def cancel_menu():
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")]])


def after_upload_menu(track_id: int):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🖼 Обложка", callback_data=f"cover:{track_id}"), InlineKeyboardButton(text="✏️ Данные", callback_data=f"edit:{track_id}")],
        [InlineKeyboardButton(text="🗑 Удалить", callback_data=f"delete:{track_id}")],
        [InlineKeyboardButton(text="🎵 Все песни", callback_data="music"), InlineKeyboardButton(text="⚙️ Админка", callback_data="admin")],
    ])


def track_menu(track_id: int):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🗑 Удалить", callback_data=f"delete:{track_id}")],
        [InlineKeyboardButton(text="🖼 Обложка", callback_data=f"cover:{track_id}"), InlineKeyboardButton(text="✏️ Данные", callback_data=f"edit:{track_id}")],
        [InlineKeyboardButton(text="⬅️ Назад", callback_data="music")],
    ])
