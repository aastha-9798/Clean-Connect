from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base
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
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

#mount uploads directory to serve images
app.mount("/uploads", StaticFiles(directory="uploads"))

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
