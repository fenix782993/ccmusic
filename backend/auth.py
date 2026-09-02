import os, secrets
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
ACCESS_MINUTES = int(os.getenv("ACCESS_MINUTES", "10080"))
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd.verify(password, hashed)
    except Exception:
        return False

def make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": exp}, JWT_SECRET, algorithm="HS256")

def read_token(token: str):
    try:
        return int(jwt.decode(token, JWT_SECRET, algorithms=["HS256"])["sub"])
    except Exception:
        return None

def random_token() -> str:
    return secrets.token_urlsafe(32)
