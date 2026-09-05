import os
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext


# ============================================================
# JWT CONFIG
# ============================================================

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "change-this-secret-in-production",
).strip()

if not JWT_SECRET:
    JWT_SECRET = "change-this-secret-in-production"

JWT_ALGORITHM = "HS256"

JWT_EXPIRE_MINUTES = int(
    os.getenv(
        "JWT_EXPIRE_MINUTES",
        "43200",
    )
)


# ============================================================
# PASSWORD CONFIG
# ============================================================

# Используем PBKDF2 вместо bcrypt.
#
# Это убирает проблему:
# AttributeError: module 'bcrypt' has no attribute '__about__'
#
# Также PBKDF2 не имеет ограничения bcrypt в 72 байта.
#

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)


# ============================================================
# PASSWORD HASH
# ============================================================

def hash_password(password: str) -> str:
    """
    Хеширует пароль пользователя.

    Пароль НЕ обрезается до 72 байт.
    """

    if password is None:
        raise ValueError(
            "Password is required"
        )

    password = str(password)

    if len(password) < 6:
        raise ValueError(
            "Password must contain at least 6 characters"
        )

    return pwd_context.hash(
        password
    )


# ============================================================
# PASSWORD VERIFY
# ============================================================

def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    """
    Проверяет пароль пользователя.
    """

    if not password:
        return False

    if not password_hash:
        return False

    try:
        return pwd_context.verify(
            password,
            password_hash,
        )
    except Exception as exc:
        print(
            f"Password verification warning: {exc}"
        )
        return False


# ============================================================
# JWT CREATE
# ============================================================

def create_access_token(
    user_id: int,
    email: str,
    is_admin: bool = False,
):
    """
    Создаёт JWT-токен пользователя.
    """

    now = datetime.now(
        timezone.utc
    )

    expires = (
        now
        + timedelta(
            minutes=JWT_EXPIRE_MINUTES
        )
    )

    payload = {
        "user_id": int(user_id),
        "sub": str(user_id),
        "email": email,
        "is_admin": bool(is_admin),
        "iat": now,
        "exp": expires,
    }

    token = jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )

    return token


# ============================================================
# JWT DECODE
# ============================================================

def decode_access_token(
    token: str,
):
    """
    Проверяет и расшифровывает JWT.
    """

    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[
                JWT_ALGORITHM
            ],
        )

        return payload

    except jwt.ExpiredSignatureError:
        print(
            "JWT warning: token expired"
        )
        return None

    except jwt.InvalidTokenError:
        print(
            "JWT warning: invalid token"
        )
        return None

    except Exception as exc:
        print(
            f"JWT decode warning: {exc}"
        )
        return None
