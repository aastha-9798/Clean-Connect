from fastapi import APIRouter, HTTPException, UploadFile, File , Form , Depends #depends used to use dependencies
from fastapi import Form
from fastapi import Request
from backend.database import get_db
from sqlalchemy.orm import Session #to type hint the database session
from backend.authentication.dependencies import get_current_user
from backend.reports.models import Report, ReportImage
from backend.drives.models import Drive
from backend.reports.schemas import ReportResponse
from backend.images import save_images, delete_images, report_image_urls

router = APIRouter()

@router.post("/upload", response_model=ReportResponse)
async def get_data(
    request : Request,
    images: list[UploadFile]= File(...), # 1 to 5 photos, all sent under the field name "images"
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

    contents_list = [await image.read() for image in images]
    file_paths = save_images(contents_list) # checks count, size and real format of every image, then saves them

    report = Report(
        user_id= curr_user.id,
        latitude=latitude,
        longitude=longitude,
        description=description,
        images=[
            ReportImage(image_path=path, position=position)
            for position, path in enumerate(file_paths)
        ]
    )
    try:
        db.add(report)
        db.commit()
    except Exception:
        db.rollback()
        delete_images(file_paths) # don't leave saved files behind if the report couldn't be stored
        raise
    db.refresh(report)
    print("Report created with ID:", report.id , "by user:", curr_user.username)

    #building image urls to send in response
    urls = report_image_urls(request, report)
    return {
        "id": report.id,
        "username": report.user.username,
        "image_url": urls[0],
        "images": urls,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "description": report.description,
        "status": report.status,
        "created_at": report.created_at
    }


@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report does not exist")
    if report.user_id != curr_user.id:
        raise HTTPException(status_code=403, detail="Only the person who reported this can delete it")
    # a drive (planned or done) depends on this report, so it has to be deleted first
    if db.query(Drive).filter(Drive.report_id == report.id).first():
        raise HTTPException(status_code=409, detail="This report has a cleanup drive. Delete the drive first.")

    file_paths = [img.image_path for img in report.images]
    db.delete(report) # its image rows are deleted with it
    db.commit()
    delete_images(file_paths) # remove the photo files only once the database change is saved
    print("Report deleted:", report_id, "by user:", curr_user.username)
    return {
        "message": "Report deleted successfully"
    }
