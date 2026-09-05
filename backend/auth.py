import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import jwt
from passlib.context import CryptContext

JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "30"))
pwd_context = CryptContext(schemes=["bcrypt", "pbkdf2_sha256"], deprecated="auto")

def hash_password(password: str) -> str:
    if not isinstance(password, str): password = str(password)
    if not password: raise ValueError("Password cannot be empty")
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    if not password or not password_hash: return False
    try: return pwd_context.verify(password, password_hash)
    except Exception: return False

def create_access_token(user_id: int, email: str | None, is_admin: bool = False, expires_days: Optional[int] = None) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=expires_days or JWT_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "user_id": int(user_id), "email": email or "", "is_admin": bool(is_admin), "iat": now, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload if isinstance(payload, dict) else None
    except Exception: return None

def create_token(user_id: int, email: str | None, is_admin: bool = False, expires_days: Optional[int] = None) -> str:
    return create_access_token(user_id, email, is_admin, expires_days)

def decode_token(token: str): return decode_access_token(token)
def get_user_id_from_token(token: str):
    p = decode_access_token(token); return int(p["user_id"]) if p and p.get("user_id") else None
def get_email_from_token(token: str):
    p = decode_access_token(token); return p.get("email") if p else None
def is_admin_token(token: str):
    p = decode_access_token(token); return bool(p and p.get("is_admin"))
def is_token_valid(token: str): return decode_access_token(token) is not None
