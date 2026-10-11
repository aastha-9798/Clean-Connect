from fastapi import APIRouter, HTTPException, UploadFile, File , Form , Depends #depends used to use dependencies
from fastapi import Form
from fastapi import Request
from backend.database import get_db
from sqlalchemy.orm import Session #to type hint the database session
from backend.authentication.dependencies import get_current_user
from backend.reports.models import Report
from backend.reports.schemas import ReportResponse
from backend.images import save_image

router = APIRouter()

@router.post("/upload", response_model=ReportResponse)
async def get_data(
    request : Request,
    image: UploadFile= File(...), # ... means this field is required
    latitude: float= Form(...),
    longitude: float= Form(...),
    description: str= Form(None), # none means this field is optional
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user),
):
    if latitude < -90 or latitude > 90:
        raise HTTPException(status_code=400, detail="Invalid latitude value")
    if longitude < -180 or longitude > 180:
        raise HTTPException(status_code=400, detail="Invalid longitude value")

    contents= await image.read()
    file_path = save_image(contents) # checks size and real image format, then saves it

    report = Report(
        user_id= curr_user.id,
        image_path=file_path,
        latitude=latitude,
        longitude=longitude,
        description=description
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    print("Report created with ID:", report.id , "by user:", curr_user.username)

    #building image url to send in response
    image_url = str(request.base_url) + report.image_path.replace("\\", "/")
    return {
        "id": report.id,
        "username": report.user.username,
        "image_url": image_url,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "description": report.description,
        "status": report.status,
        "created_at": report.created_at
    }



