from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.database import engine, Base, get_db
from backend.config import CORS_ORIGINS, USE_SUPABASE_STORAGE, UPLOAD_DIR
from backend.authentication.routes import router as auth_router
from backend.reports.routes import router as reports_router
from backend.drives.models import Participation, Drive
from backend.drives.routes import router as drives_router
from backend.user.routes import router as user_router
from backend.ai.routes import router as ai_router
from backend.map.routes import router as map_router
import os

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,  # the frontend's address in production (CORS_ORIGINS), "*" locally
    allow_credentials=False,     # the app sends tokens in the Authorization header, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

if not USE_SUPABASE_STORAGE:
    # local development: photos are saved in uploads/ and served from /uploads
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR))

# Create tables
Base.metadata.create_all(bind=engine)

# Include authentication routes
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(reports_router, prefix="/reports", tags=["Reports"])
app.include_router(drives_router, prefix="/drives", tags=["Drives"])
app.include_router(user_router, prefix="/user", tags=["User"])
app.include_router(ai_router, prefix="/ai", tags=["AI"])
app.include_router(map_router, prefix="/map", tags=["Map"])

@app.get("/")
def root():
    return {"message": "Clean Connect backend running"}

@app.get("/health")
def health(db: Session = Depends(get_db)):
    """Pinged every few minutes in production: keeps the free Render service awake,
    and the small query keeps the free Supabase database from pausing."""
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
