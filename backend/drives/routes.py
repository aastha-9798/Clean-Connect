from fastapi import APIRouter, Depends, HTTPException , Request, UploadFile, File
from backend.database import get_db #actual session provider
from sqlalchemy.orm import Session, selectinload #session type hint

from backend.authentication.dependencies import get_current_user
from backend.reports.models import Report
from backend.drives.models import Drive , Participation, DriveImage
from backend.drives.schemas import CreateDriveRequest, CheckInRequest
from backend.drives import rules
from backend.images import report_image_urls, save_images, delete_images

router = APIRouter()

def get_drive_or_404(db: Session, drive_id: str) -> Drive:
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="drive does not exist")
    return drive

def get_participation(db: Session, drive_id: str, user_id: str) -> Participation | None:
    return db.query(Participation).filter((Participation.drive_id == drive_id) & (Participation.user_id == user_id)).first()

@router.post("/")
def create_drive(
    drive_data: CreateDriveRequest,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user),
):
    rules.cancel_overdue_drives(db)
    report= db.query(Report).filter(Report.id== drive_data.report_id).first()
    if not report:
        raise HTTPException(status_code=404 , detail="Report does not exist")
    if report.status == "resolved":
        raise HTTPException(status_code=409 , detail="This spot has already been cleaned up")

    existing_drive= db.query(Drive).filter((Drive.report_id== drive_data.report_id) & (Drive.status=="planned")).first()
    if existing_drive:
        raise HTTPException(status_code=409 , detail="Drive already exists")

    if drive_data.scheduled_at < rules.now_utc():
        raise HTTPException(status_code=400 , detail="Invalid time ")

    new_drive = Drive(
        report_id= drive_data.report_id,
        user_id=curr_user.id,
        description= drive_data.description,
        scheduled_at=drive_data.scheduled_at,
        latitude=report.latitude,
        longitude=report.longitude
    )
    db.add(new_drive)
    db.flush()

    new_participation = Participation(
        user_id=curr_user.id,
        drive_id=new_drive.id
    )

    db.add(new_participation)
    report.status = "in_progress" # a cleanup is now planned for this spot
    db.commit()

    db.refresh(new_drive)
    db.refresh(new_participation)
    print("Drive created with ID:", new_drive.id , "by user:", curr_user.username)

    return{
        "id": new_drive.id,
        "report_id": new_drive.report_id,
        "latitude": new_drive.latitude,
        "longitude": new_drive.longitude,
        "description": new_drive.description,
        "status": new_drive.status,
        "created_at": new_drive.created_at,
        "scheduled_at": new_drive.scheduled_at
    }

@router.post("/{drive_id}/join")
def join_drive(
    drive_id:str,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    rules.cancel_overdue_drives(db)
    drive = get_drive_or_404(db, drive_id)
    if drive.status != "planned":
        raise HTTPException(status_code=409 , detail="This drive is no longer open to join")

    existing_participation = get_participation(db, drive.id, curr_user.id)
    if existing_participation:
        raise HTTPException(status_code=400 , detail="User already participated in this drive")

    new_participation=Participation(
        user_id= curr_user.id,
        drive_id= drive.id
    )
    db.add(new_participation)
    db.commit()
    db.refresh(new_participation)

    return {
        "message": "participated successfully",
        "drive_id": new_participation.drive_id
    }

@router.delete("/{drive_id}/leave")
def leave_drive(
    drive_id:str,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    drive = get_drive_or_404(db, drive_id)

    participation = get_participation(db, drive_id, curr_user.id)
    if not participation:
        raise HTTPException(status_code=404 , detail="participation does not exist")
    if drive.user_id == curr_user.id:
        raise HTTPException(status_code=403 , detail="Drive organizer cannot leave the drive")
    if participation.checked_in:
        raise HTTPException(status_code=409 , detail="You've already checked in to this drive")
    db.delete(participation)
    db.commit()
    return {
        "message": "participation removed successfully"
    }

@router.delete("/{drive_id}")
def delete_drive(
    drive_id: str,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    rules.cancel_overdue_drives(db)
    drive = get_drive_or_404(db, drive_id)
    if drive.user_id != curr_user.id:
        raise HTTPException(status_code=403, detail="Only the organizer can delete this drive")
    if drive.status != "planned":
        raise HTTPException(status_code=409, detail="Only planned drives can be deleted")

    file_paths = [img.image_path for img in drive.after_images]
    if drive.report.status == "in_progress":
        drive.report.status = "pending" # the spot is open again for someone else to organise
    db.delete(drive) # its participations and "after" photos are deleted with it
    db.commit()
    delete_images(file_paths)
    print("Drive deleted:", drive_id, "by user:", curr_user.username)
    return {
        "message": "Drive deleted successfully"
    }

@router.get("/{drive_id}/me")
def my_drive_state(
    drive_id: str,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    """What the logged-in user can do on this drive (shown in the drive dialog)."""
    rules.cancel_overdue_drives(db)
    drive = get_drive_or_404(db, drive_id)
    participation = get_participation(db, drive.id, curr_user.id)
    return {
        "is_organizer": drive.user_id == curr_user.id,
        "is_participant": participation is not None,
        "checked_in": bool(participation and participation.checked_in),
        "my_photo_count": sum(1 for img in drive.after_images if img.user_id == curr_user.id)
    }

@router.post("/{drive_id}/check-in")
def check_in(
    drive_id: str,
    location: CheckInRequest,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    rules.cancel_overdue_drives(db)
    drive = get_drive_or_404(db, drive_id)
    if drive.status != "planned":
        raise HTTPException(status_code=409, detail="Check-in is only possible for planned drives")

    now = rules.now_utc()
    if now < rules.check_in_opens_at(drive):
        raise HTTPException(status_code=409, detail="Check-in opens 30 minutes before the drive starts")
    if now > rules.check_in_closes_at(drive):
        raise HTTPException(status_code=409, detail="Check-in for this drive has closed")

    # the location is only used for these two checks and is not stored
    if location.accuracy > rules.MAX_LOCATION_ACCURACY_M:
        raise HTTPException(
            status_code=400,
            detail=f"Your location isn't precise enough right now (±{round(location.accuracy)} m). "
                   "Move outdoors or turn on precise location, then try again."
        )
    distance = rules.distance_m(location.latitude, location.longitude, drive.latitude, drive.longitude)
    if distance > rules.CHECK_IN_RADIUS_M:
        raise HTTPException(
            status_code=400,
            detail=f"You seem to be about {round(distance)} m away. "
                   f"Check-in works within {rules.CHECK_IN_RADIUS_M} m of the drive location."
        )

    participation = get_participation(db, drive.id, curr_user.id)
    joined_now = participation is None
    if joined_now: # walk-ins are welcome: checking in also joins the drive
        participation = Participation(user_id=curr_user.id, drive_id=drive.id)
        db.add(participation)
    participation.checked_in = True
    db.commit()
    print("Checked in:", curr_user.username, "to drive", drive.id)
    return {
        "checked_in": True,
        "joined_now": joined_now
    }

@router.get("/{drive_id}/attendees")
def get_attendees(
    drive_id: str,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    """Participants and whether they checked in (organizer only)."""
    drive = get_drive_or_404(db, drive_id)
    if drive.user_id != curr_user.id:
        raise HTTPException(status_code=403, detail="Only the organizer can see the attendee list")
    return [
        {
            "user_id": p.user_id,
            "username": p.user.username,
            "checked_in": p.checked_in,
            "is_organizer": p.user_id == drive.user_id
        }
        for p in sorted(drive.participants, key=lambda p: (not p.checked_in, p.joined_at))
    ]

@router.delete("/{drive_id}/check-in/{user_id}")
def remove_check_in(
    drive_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    """Lets the organizer undo a check-in that looks wrong; that person's "after" photos are removed too."""
    drive = get_drive_or_404(db, drive_id)
    if drive.user_id != curr_user.id:
        raise HTTPException(status_code=403, detail="Only the organizer can remove a check-in")
    if drive.status != "planned":
        raise HTTPException(status_code=409, detail="Check-ins can only be changed while the drive is planned")
    participation = get_participation(db, drive.id, user_id)
    if not participation or not participation.checked_in:
        raise HTTPException(status_code=404, detail="This person hasn't checked in")

    participation.checked_in = False
    their_images = [img for img in drive.after_images if img.user_id == user_id]
    file_paths = [img.image_path for img in their_images]
    for img in their_images:
        db.delete(img)
    db.commit()
    delete_images(file_paths)
    return {
        "message": "Check-in removed"
    }

@router.post("/{drive_id}/photos")
async def add_after_photos(
    drive_id: str,
    request: Request,
    images: list[UploadFile] = File(...), # up to 2 photos, all sent under the field name "images"
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    rules.cancel_overdue_drives(db)
    drive = get_drive_or_404(db, drive_id)
    if drive.status not in ("planned", "completed"):
        raise HTTPException(status_code=409, detail="Photos can't be added to a cancelled drive")
    if rules.now_utc() > rules.completion_deadline(drive):
        raise HTTPException(status_code=409, detail="Photos can no longer be added to this drive")
    participation = get_participation(db, drive.id, curr_user.id)
    if not participation or not participation.checked_in:
        raise HTTPException(status_code=403, detail="Only people who checked in can add photos")

    my_count = sum(1 for img in drive.after_images if img.user_id == curr_user.id)
    my_left = rules.MAX_PHOTOS_PER_PERSON - my_count
    drive_left = rules.MAX_DRIVE_PHOTOS - len(drive.after_images)
    if my_left <= 0:
        raise HTTPException(status_code=400, detail=f"You've already added {rules.MAX_PHOTOS_PER_PERSON} photos to this drive")
    if drive_left <= 0:
        raise HTTPException(status_code=400, detail=f"This drive already has {rules.MAX_DRIVE_PHOTOS} photos")
    allowed = min(my_left, drive_left)
    if len(images) > allowed:
        raise HTTPException(status_code=400, detail=f"You can add {allowed} more photo{'s' if allowed != 1 else ''}")

    contents_list = [await image.read() for image in images]
    file_paths = save_images(contents_list, max_count=allowed) # checks size and real format, then saves them
    for path in file_paths:
        db.add(DriveImage(drive_id=drive.id, user_id=curr_user.id, image_path=path))
    try:
        db.commit()
    except Exception:
        db.rollback()
        delete_images(file_paths)
        raise
    db.refresh(drive)
    return {
        "after_images": rules.after_image_urls(request, drive),
        "my_photo_count": my_count + len(file_paths)
    }

@router.post("/{drive_id}/complete")
def complete_drive(
    drive_id: str,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user)
):
    rules.cancel_overdue_drives(db)
    drive = get_drive_or_404(db, drive_id)
    if drive.user_id != curr_user.id:
        raise HTTPException(status_code=403, detail="Only the organizer can mark the drive as completed")
    if drive.status != "planned":
        raise HTTPException(status_code=409, detail=f"This drive is already {drive.status}")
    if rules.now_utc() < drive.scheduled_at:
        raise HTTPException(status_code=409, detail="The drive can be completed once it has started")
    if not drive.after_images:
        raise HTTPException(status_code=409, detail="Add at least one \"after\" photo before completing the drive")

    drive.status = "completed"
    drive.completed_at = rules.now_utc()
    drive.report.status = "resolved"
    db.commit()
    print("Drive completed:", drive.id, "by user:", curr_user.username)
    return {
        "message": "Drive marked as completed",
        "completed_at": drive.completed_at
    }

@router.get("/feed")
def get_feed(
    request: Request,
    db: Session = Depends(get_db)
):
    rules.cancel_overdue_drives(db)
    drive_loading = (
        selectinload(Drive.report).selectinload(Report.images),
        selectinload(Drive.organizer),
        selectinload(Drive.participants),
        selectinload(Drive.after_images),
    )

    active_drives = (
        db.query(Drive).options(*drive_loading)
        .filter(Drive.status == "planned")
        .order_by(Drive.scheduled_at)
        .all()
    )
    completed_drives = (
        db.query(Drive).options(*drive_loading)
        .filter(Drive.status == "completed")
        .order_by(Drive.completed_at.desc())
        .all()
    )
    # reports with no planned or completed drive (cancelled drives leave their report open again)
    open_reports = (
        db.query(Report).options(selectinload(Report.images), selectinload(Report.user))
        .filter(Report.status == "pending")
        .order_by(Report.created_at.desc())
        .all()
    )

    reports = []
    for report in open_reports:
        images = report_image_urls(request, report)
        reports.append({
            "id": report.id,
            "reported_by": report.user.username,
            "reported_by_id": report.user_id, # lets the frontend show "Delete" to the reporter only
            "date_reported": report.created_at,
            "description": report.description,
            "latitude": report.latitude,
            "longitude": report.longitude,
            "status": report.status,
            "image": images[0] if images else None, # cover photo
            "images": images
        })

    return {
        "drives": [rules.drive_summary(request, drive) for drive in active_drives],
        "completed_drives": [rules.drive_summary(request, drive) for drive in completed_drives],
        "reports": reports
    }



#  REST mapping
# POST → create
# GET → read
# PUT/PATCH → update
# DELETE → remove
