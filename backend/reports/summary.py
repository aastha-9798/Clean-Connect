from fastapi import Request

from backend.reports.models import Report
from backend.images import report_image_urls

def report_summary(request: Request, report: Report) -> dict:
    """An open report as shown in the feed, on the map and in the report dialog."""
    images = report_image_urls(request, report)
    return {
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
    }
