from fastapi import APIRouter, HTTPException , Depends , Request
from backend.database import get_db
from backend.authentication.dependencies import get_current_user
from backend.drives.models import Participation , Drive
from backend.reports.models import Report
from backend.images import report_image_urls


from sqlalchemy.orm import Session 

router=APIRouter()

@router.get("/me/reports")
def get_my_reports(
    request:Request,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user),
):
    reports = db.query(Report).filter(Report.user_id == curr_user.id).all()
    result = []
    for report in reports:
        images = report_image_urls(request, report)
        result.append({
            "id": report.id,
            "image_url": images[0] if images else None, # cover photo
            "images": images,
            "latitude": report.latitude,
            "longitude": report.longitude,
            "description": report.description,
            "status": report.status,
            "created_at": report.created_at,
            # a report with a drive can't be deleted, so the profile page disables its delete button
            "has_drive": db.query(Drive).filter(Drive.report_id == report.id).first() is not None
        })
    return result



@router.get("/me/drives")
def get_my_drives(
    request: Request,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    participations = db.query(Participation).filter(Participation.user_id == curr_user.id).all()

    drives_data = []

    for p in participations:
        drive = db.query(Drive).filter(Drive.id == p.drive_id).first()

        if not drive:
            continue

        report = db.query(Report).filter(Report.id == drive.report_id).first()

        if not report:
            continue

        participant_count = db.query(Participation).filter(Participation.drive_id == drive.id).count()

        images = report_image_urls(request, report)

        drives_data.append({
            "drive_id": drive.id,
            "description": drive.description,
            "scheduled_at": drive.scheduled_at,
            "status": drive.status,
            "is_organizer": drive.user_id == curr_user.id,
            "participant_count": participant_count,
            "latitude": report.latitude,
            "longitude": report.longitude,
            "image": images[0] if images else None, # cover photo
            "images": images,
            "report": {
                "id": report.id,
                "description": report.description
            },
            "joined_at": p.joined_at
        })

    return drives_data