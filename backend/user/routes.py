from fastapi import APIRouter, HTTPException , Depends , Request
from backend.database import get_db
from backend.authentication.dependencies import get_current_user
from backend.drives.models import Participation , Drive
from backend.drives import rules
from backend.reports.models import Report
from backend.images import report_image_urls


from sqlalchemy.orm import Session, selectinload

router=APIRouter()

@router.get("/me/reports")
def get_my_reports(
    request:Request,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user),
):
    rules.cancel_overdue_drives(db)
    reports = (
        db.query(Report).options(selectinload(Report.images))
        .filter(Report.user_id == curr_user.id)
        .order_by(Report.created_at.desc())
        .all()
    )
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
            "status": report.status, # pending -> in_progress (drive planned) -> resolved (drive completed)
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
    """Every drive the user joined or organised, including completed and cancelled ones."""
    rules.cancel_overdue_drives(db)
    participations = (
        db.query(Participation)
        .options(
            selectinload(Participation.drive).selectinload(Drive.report).selectinload(Report.images),
            selectinload(Participation.drive).selectinload(Drive.organizer),
            selectinload(Participation.drive).selectinload(Drive.participants),
            selectinload(Participation.drive).selectinload(Drive.after_images),
        )
        .filter(Participation.user_id == curr_user.id)
        .all()
    )

    drives_data = []
    for p in sorted(participations, key=lambda p: p.drive.scheduled_at, reverse=True):
        drives_data.append({
            **rules.drive_summary(request, p.drive),
            "is_organizer": p.drive.user_id == curr_user.id,
            "checked_in": p.checked_in, # shown as "Attended" on the profile
            "joined_at": p.joined_at
        })

    return drives_data
