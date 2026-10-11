"""Rules for what happens around and after a drive: check-in, "after" photos, completion and auto-cancel."""
from datetime import datetime, timedelta, timezone
from math import radians, sin, cos, asin, sqrt
from sqlalchemy.orm import Session
from fastapi import Request

from backend.drives.models import Drive
from backend.images import image_url, report_image_urls

CHECK_IN_OPENS_BEFORE = timedelta(minutes=30)  # check-in opens this long before the drive starts
CHECK_IN_CLOSES_AFTER = timedelta(hours=6)     # ...and stays open this long after it starts (drives are long)
CHECK_IN_RADIUS_M = 200                        # how close to the drive location a check-in must be
MAX_LOCATION_ACCURACY_M = 250                  # readings vaguer than this are rejected (laptops use Wi-Fi location, often ±50-250 m)
COMPLETION_WINDOW = timedelta(days=2)          # drives not completed this long after the start are cancelled
MAX_DRIVE_PHOTOS = 10                          # "after" photos per drive (the report's photos don't count)
MAX_PHOTOS_PER_PERSON = 2                      # "after" photos per attendee

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def check_in_opens_at(drive: Drive) -> datetime:
    return drive.scheduled_at - CHECK_IN_OPENS_BEFORE

def check_in_closes_at(drive: Drive) -> datetime:
    return drive.scheduled_at + CHECK_IN_CLOSES_AFTER

def completion_deadline(drive: Drive) -> datetime:
    """After this moment a planned drive is cancelled, and no more photos can be added."""
    return drive.scheduled_at + COMPLETION_WINDOW

def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in metres between two points on the Earth (haversine formula)."""
    earth_radius_m = 6_371_000
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = radians(lon2 - lon1)
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return 2 * earth_radius_m * asin(sqrt(a))

def cancel_overdue_drives(db: Session) -> None:
    """Cancels planned drives that weren't completed within COMPLETION_WINDOW of their start.

    There's no background scheduler, so this runs at the start of every request that
    shows or acts on drives. A cancelled drive leaves the feed (it stays in profiles)
    and its report becomes open again so someone else can organise a drive.
    """
    cutoff = now_utc() - COMPLETION_WINDOW
    overdue = db.query(Drive).filter(Drive.status == "planned", Drive.scheduled_at < cutoff).all()
    for drive in overdue:
        drive.status = "cancelled"
        if drive.report and drive.report.status == "in_progress":
            drive.report.status = "pending"
        print("Drive auto-cancelled (not completed in time):", drive.id)
    if overdue:
        db.commit()

def after_image_urls(request: Request, drive: Drive) -> list[str]:
    return [image_url(request, img.image_path) for img in drive.after_images]

def drive_summary(request: Request, drive: Drive) -> dict:
    """The drive as shown in the feed and drive dialog (no per-user information)."""
    report = drive.report
    images = report_image_urls(request, report)
    return {
        "drive_id": drive.id,
        "organized_by": drive.organizer.username,
        "organizer_id": drive.user_id, # lets the frontend show organizer-only actions
        "description": drive.description,
        "scheduled_at": drive.scheduled_at,
        "status": drive.status,
        "completed_at": drive.completed_at,
        "participant_count": len(drive.participants),
        "checked_in_count": sum(1 for p in drive.participants if p.checked_in),
        "latitude": drive.latitude,
        "longitude": drive.longitude,
        "image": images[0] if images else None, # cover photo ("before")
        "images": images,                       # the report's photos ("before")
        "after_images": after_image_urls(request, drive),
        "check_in_opens_at": check_in_opens_at(drive),
        "check_in_closes_at": check_in_closes_at(drive),
        "completion_deadline": completion_deadline(drive),
        "report": {
            "id": report.id,
            "description": report.description
        }
    }
