from pydantic import BaseModel
from datetime import datetime

class ReportResponse(BaseModel):
    id: int
    username: str
    image_url: str  # cover photo (the first image)
    images: list[str]  # all photo URLs in upload order
    latitude: float
    longitude: float
    description: str | None
    status: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }
