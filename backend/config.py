"""Settings read from environment variables (or the .env file locally).

Locally nothing needs to be set: the app uses SQLite and saves photos in uploads/.
In production (see DEPLOY.md) the database is Supabase Postgres and photos go to Supabase Storage.
"""
import os
from dotenv import load_dotenv

load_dotenv()

def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        return "sqlite:///./backend/cleanconnect.db"
    # Supabase hands out postgres:// or postgresql:// URLs; SQLAlchemy needs the psycopg (v3) driver named
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url

DATABASE_URL = _database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

# Supabase Storage for photos; when SUPABASE_URL isn't set, photos are saved on the local disk
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()  # server-side only, never sent to the browser
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "uploads").strip()
USE_SUPABASE_STORAGE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

UPLOAD_DIR = "uploads"  # local photo folder (development only)

# Sites allowed to call the API from a browser, comma-separated (e.g. https://cleanconnect.vercel.app)
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
