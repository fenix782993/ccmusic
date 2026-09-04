# backend/auth.py

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from passlib.context import CryptContext


# ============================================================
# CONFIG
# ============================================================

JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Время жизни токена по умолчанию — 30 дней
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "30"))


# ============================================================
# PASSWORD HASHING
# ============================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    """
    Хеширует пароль пользователя.
    """
    if not isinstance(password, str):
        password = str(password)

    if not password:
        raise ValueError("Password cannot be empty")

    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """
    Проверяет пароль пользователя против сохранённого хеша.
    """
    if not password or not password_hash:
        return False

    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


# ============================================================
# JWT
# ============================================================

def create_access_token(
    user_id: int,
    email: str,
    is_admin: bool = False,
    expires_days: Optional[int] = None,
) -> str:
    """
    Создаёт JWT-токен пользователя.

    Payload содержит:
        sub      — ID пользователя в виде строки
        user_id  — ID пользователя
        email    — email
        is_admin — является ли пользователь администратором
        iat      — время создания
        exp      — время окончания
    """

    if expires_days is None:
        expires_days = JWT_EXPIRE_DAYS

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=expires_days)

    payload = {
        "sub": str(user_id),
        "user_id": int(user_id),
        "email": email,
        "is_admin": bool(is_admin),
        "iat": now,
        "exp": expires_at,
    }

    token = jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )

    return token


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """
    Расшифровывает и проверяет JWT.

    Возвращает payload при успешной проверке.
    Возвращает None, если токен:
        - неправильный
        - просроченный
        - подделанный
        - пустой
    """

    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        if not isinstance(payload, dict):
            return None

        return payload

    except jwt.ExpiredSignatureError:
        return None

    except jwt.InvalidTokenError:
        return None

    except Exception:
        return None


# ============================================================
# COMPATIBILITY HELPERS
# ============================================================

def create_token(
    user_id: int,
    email: str,
    is_admin: bool = False,
    expires_days: Optional[int] = None,
) -> str:
    """
    Совместимый алиас для старого кода.
    """

    return create_access_token(
        user_id=user_id,
        email=email,
        is_admin=is_admin,
        expires_days=expires_days,
    )


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """
    Совместимый алиас для старого кода.
    """

    return decode_access_token(token)


# ============================================================
# TOKEN USER DATA
# ============================================================

def get_user_id_from_token(token: str) -> Optional[int]:
    """
    Получает ID пользователя из JWT.
    """

    payload = decode_access_token(token)

    if not payload:
        return None

    user_id = payload.get("user_id")

    if user_id is None:
        user_id = payload.get("sub")

    if user_id is None:
        return None

    try:
        return int(user_id)
    except (TypeError, ValueError):
        return None


def get_email_from_token(token: str) -> Optional[str]:
    """
    Получает email из JWT.
    """

    payload = decode_access_token(token)

    if not payload:
        return None

    email = payload.get("email")

    if not email:
        return None

    return str(email)


def is_admin_token(token: str) -> bool:
    """
    Проверяет, является ли токен токеном администратора.
    """

    payload = decode_access_token(token)

    if not payload:
        return False

    return bool(payload.get("is_admin", False))


# ============================================================
# TOKEN VALIDATION
# ============================================================

def is_token_valid(token: str) -> bool:
    """
    Возвращает True, если JWT действителен.
    """

    return decode_access_token(token) is not None


# ============================================================
# EXPORTS
# ============================================================

__all__ = [
    "JWT_SECRET",
    "JWT_ALGORITHM",
    "JWT_EXPIRE_DAYS",
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "create_token",
    "decode_token",
    "get_user_id_from_token",
    "get_email_from_token",
    "is_admin_token",
    "is_token_valid",
]ы
