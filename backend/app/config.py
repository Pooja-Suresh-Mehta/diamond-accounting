import os
from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

_BASE_DIR = Path(__file__).resolve().parent.parent
_DB_PATH = _BASE_DIR / "poojan_gems.db"

# Default to SQLite for local dev; override DATABASE_URL env var for production PostgreSQL
_DEFAULT_DB = f"sqlite+aiosqlite:///{_DB_PATH}"


class Settings(BaseSettings):
    APP_NAME: str = "Poojan Gems - Diamond Inventory"
    DATABASE_URL: str = _DEFAULT_DB
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-in-production-use-openssl-rand-hex-32")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    CORS_ORIGINS: str = ""  # Comma-separated origins for production

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
