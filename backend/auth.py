import os
import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone


JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "change-me-in-production",
)

ACCESS_MINUTES = int(
    os.getenv("ACCESS_MINUTES", "10080")
)


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(
        data
    ).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (
        4 - len(data) % 4
    )

    return base64.urlsafe_b64decode(
        (data + padding).encode("ascii")
    )


def _sign(data: str) -> str:
    signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        data.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    return _b64encode(signature)


def hash_password(password: str) -> str:
    """
    Хеширование пароля через bcrypt.
    Passlib не используется.
    """

    import bcrypt

    if not password:
        raise ValueError(
            "Password cannot be empty"
        )

    hashed = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    )

    return hashed.decode("utf-8")


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    """
    Проверка bcrypt-пароля.
    """

    import bcrypt

    if not password or not password_hash:
        return False

    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )

    except (
        ValueError,
        TypeError,
        UnicodeError,
    ):
        return False


def create_access_token(
    user_id: int,
    email: str,
    is_admin: bool = False,
) -> str:
    """
    Создание JWT HS256 без python-jose.
    """

    now = datetime.now(
        timezone.utc
    )

    expires = now + timedelta(
        minutes=ACCESS_MINUTES
    )

    header = {
        "alg": "HS256",
        "typ": "JWT",
    }

    payload = {
        "sub": str(user_id),
        "user_id": user_id,
        "email": email,
        "is_admin": bool(is_admin),
        "iat": int(
            now.timestamp()
        ),
        "exp": int(
            expires.timestamp()
        ),
    }

    header_json = json.dumps(
        header,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")

    payload_json = json.dumps(
        payload,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")

    header_encoded = _b64encode(
        header_json
    )

    payload_encoded = _b64encode(
        payload_json
    )

    unsigned_token = (
        f"{header_encoded}."
        f"{payload_encoded}"
    )

    signature = _sign(
        unsigned_token
    )

    return (
        f"{unsigned_token}."
        f"{signature}"
    )


def decode_access_token(
    token: str,
):
    """
    Проверка и декодирование JWT.
    """

    if not token:
        return None

    try:
        parts = token.split(".")

        if len(parts) != 3:
            return None

        header_encoded = parts[0]
        payload_encoded = parts[1]
        signature = parts[2]

        unsigned_token = (
            f"{header_encoded}."
            f"{payload_encoded}"
        )

        expected_signature = _sign(
            unsigned_token
        )

        if not hmac.compare_digest(
            signature,
            expected_signature,
        ):
            return None

        header = json.loads(
            _b64decode(
                header_encoded
            ).decode("utf-8")
        )

        if header.get("alg") != "HS256":
            return None

        payload = json.loads(
            _b64decode(
                payload_encoded
            ).decode("utf-8")
        )

        expiration = payload.get("exp")

        if expiration is not None:
            now_timestamp = int(
                datetime.now(
                    timezone.utc
                ).timestamp()
            )

            if now_timestamp >= int(
                expiration
            ):
                return None

        return payload

    except (
        ValueError,
        TypeError,
        KeyError,
        UnicodeError,
        json.JSONDecodeError,
    ):
        return None


def get_user_id_from_token(
    token: str,
):
    payload = decode_access_token(
        token
    )

    if not payload:
        return None

    user_id = payload.get(
        "user_id"
    )

    if user_id is None:
        user_id = payload.get(
            "sub"
        )

    try:
        return int(user_id)

    except (
        TypeError,
        ValueError,
    ):
        return None
