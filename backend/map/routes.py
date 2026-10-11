from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.drives.models import Drive
from backend.drives import rules
from backend.reports.models import Report
from backend.reports.summary import report_summary

router = APIRouter()

MAX_ITEMS_PER_TYPE = 300  # keeps a zoomed-out map from loading everything at once

@router.get("/items")
def get_map_items(
    request: Request,
    min_lat: float = Query(ge=-90, le=90),
    max_lat: float = Query(ge=-90, le=90),
    min_lng: float = Query(ge=-180, le=180),
    max_lng: float = Query(ge=-180, le=180),
    include_cleaned: bool = False, # "Recently cleaned" checkbox on the map page
    db: Session = Depends(get_db)
):
    """Planned drives, open reports and (optionally) completed drives inside the visible map area.

    Items have the same shape as in the feed, so the map can open the usual report and drive dialogs.
    """
    if min_lat > max_lat or min_lng > max_lng:
        raise HTTPException(status_code=400, detail="Invalid map area")
    rules.cancel_overdue_drives(db)

    drive_loading = (
        selectinload(Drive.report).selectinload(Report.images),
        selectinload(Drive.organizer),
        selectinload(Drive.participants),
        selectinload(Drive.after_images),
    )
    def drives_in_area(status: str) -> list[Drive]:
        return (
            db.query(Drive).options(*drive_loading)
            .filter(
                Drive.status == status,
                Drive.latitude.between(min_lat, max_lat),
                Drive.longitude.between(min_lng, max_lng)
            )
            .limit(MAX_ITEMS_PER_TYPE)
            .all()
        )

    open_reports = (
        db.query(Report).options(selectinload(Report.images), selectinload(Report.user))
        .filter(
            Report.status == "pending",
            Report.latitude.between(min_lat, max_lat),
            Report.longitude.between(min_lng, max_lng)
        )
        .limit(MAX_ITEMS_PER_TYPE)
        .all()
    )

    return {
        "drives": [rules.drive_summary(request, drive) for drive in drives_in_area("planned")],
        "reports": [report_summary(request, report) for report in open_reports],
        "completed_drives": (
            [rules.drive_summary(request, drive) for drive in drives_in_area("completed")]
            if include_cleaned else []
        )
    }
