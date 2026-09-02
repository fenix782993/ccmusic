import os
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt


JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"

ACCESS_MINUTES = int(
    os.getenv("ACCESS_MINUTES", "10080")
)


def hash_password(password: str) -> str:
    """
    Хеширование пароля через bcrypt напрямую.
    Passlib не используется.
    """
    if not password:
        raise ValueError("Password cannot be empty")

    hashed = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    )

    return hashed.decode("utf-8")


def verify_password(
    password: str,
    password_hash: str
) -> bool:
    """
    Проверка bcrypt-хеша.
    """
    if not password or not password_hash:
        return False

    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


def create_access_token(
    user_id: int,
    email: str,
    is_admin: bool = False,
):
    """
    Создание JWT.
    """

    now = datetime.now(timezone.utc)

    expire = now + timedelta(
        minutes=ACCESS_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "user_id": user_id,
        "email": email,
        "is_admin": bool(is_admin),
        "iat": int(now.timestamp()),
        "exp": expire,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str):
    """
    Декодирование JWT.
    """

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        return payload

    except JWTError:
        return None


def get_user_id_from_token(token: str):
    """
    Получение ID пользователя из JWT.
    """

    payload = decode_access_token(token)

    if not payload:
        return None

    user_id = payload.get("user_id")

    if user_id is None:
        user_id = payload.get("sub")

    try:
        return int(user_id)
    except (TypeError, ValueError):
        return None
