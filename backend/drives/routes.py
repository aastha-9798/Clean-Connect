from fastapi import APIRouter, Depends, HTTPException , Request
from backend.database import get_db #actual session provider
from sqlalchemy.orm import Session, selectinload #session type hint
from datetime import datetime , timezone

from backend.authentication.dependencies import get_current_user
from backend.reports.models import Report
from backend.drives.models import Drive , Participation
from backend.drives.schemas import CreateDriveRequest
from backend.authentication.models import User
from backend.images import report_image_urls

router = APIRouter()

@router.post("/")
def create_drive(
    drive_data: CreateDriveRequest,
    db: Session = Depends(get_db),
    curr_user = Depends(get_current_user),
):
    report= db.query(Report).filter(Report.id== drive_data.report_id).first()
    if not report:
        raise HTTPException(status_code=404 , detail="Report does not exist")
    
    existing_drive= db.query(Drive).filter((Drive.report_id== drive_data.report_id) & (Drive.status=="planned")).first()
    if existing_drive:
        raise HTTPException(status_code=409 , detail="Drive already exists")
    
    if drive_data.scheduled_at < datetime.now(timezone.utc):
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
    drive= db.query(Drive).filter(Drive.id== drive_id).first()
    if not drive :
        raise HTTPException(status_code=404 , detail="drive does not exist")
    
    existing_participation = db.query(Participation).filter((Participation.user_id==curr_user.id) & (Participation.drive_id== drive.id)).first()
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
    drive= db.query(Drive).filter(Drive.id== drive_id).first()
    if not drive :
        raise HTTPException(status_code=404 , detail="drive does not exist")
    
    participation = db.query(Participation).filter((Participation.drive_id==drive_id) & (Participation.user_id==curr_user.id)).first()
    if not participation:
        raise HTTPException(status_code=404 , detail="participation does not exist")
    if drive.user_id == curr_user.id:
        raise HTTPException(status_code=403 , detail="Drive organizer cannot leave the drive")
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
    drive = db.query(Drive).filter(Drive.id == drive_id).first()
    if not drive:
        raise HTTPException(status_code=404, detail="drive does not exist")
    if drive.user_id != curr_user.id:
        raise HTTPException(status_code=403, detail="Only the organizer can delete this drive")
    if drive.status != "planned":
        raise HTTPException(status_code=409, detail="Only planned drives can be deleted")

    db.delete(drive) # its participations are deleted with it; the report shows as open again in the feed
    db.commit()
    print("Drive deleted:", drive_id, "by user:", curr_user.username)
    return {
        "message": "Drive deleted successfully"
    }

@router.get("/feed")
def get_feed(
    request: Request,
    db: Session = Depends(get_db)
):
    reports = db.query(Report).options(selectinload(Report.images)).all() # load every report's photos in one extra query

    with_drives = []
    without_drives = []

    for report in reports:
        drive = db.query(Drive).filter((Drive.report_id == report.id) &(Drive.status == "planned")).first()
        reported_by= db.query(User).filter(User.id == report.user_id).first()
        images = report_image_urls(request, report)
        
        if drive:
            count = db.query(Participation).filter(Participation.drive_id == drive.id).count()
            created_by=db.query(User).filter(User.id == drive.user_id ).first()
            
            with_drives.append({
                "drive_id": drive.id,
                "organized_by": created_by.username,
                "organizer_id": drive.user_id, # lets the frontend show "Delete" to the organizer only
                "description": drive.description,
                "scheduled_at": drive.scheduled_at,
                "participant_count": count,
                "latitude": report.latitude,
                "longitude": report.longitude,
                "image": images[0] if images else None, # cover photo
                "images": images,
                "report": {
                    "id": report.id,
                    "description": report.description
                }
            })

        else:
            without_drives.append({
                "id": report.id,
                "reported_by": reported_by.username,
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
        "drives": with_drives,
        "reports": without_drives
    }



#  REST mapping
# POST → create
# GET → read
# PUT/PATCH → update
# DELETE → remove