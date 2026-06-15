"""Central config — loads .env via python-dotenv (no pydantic-settings dependency)."""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    MOSS_PROJECT_ID: str = os.getenv("MOSS_PROJECT_ID", "")
    MOSS_PROJECT_KEY: str = os.getenv("MOSS_PROJECT_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./mantis.db")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")


settings = Settings()
