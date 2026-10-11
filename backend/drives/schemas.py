from pydantic import BaseModel, field_validator
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30), "IST")

class CreateDriveRequest(BaseModel):
    report_id:int
    description:str
    scheduled_at:datetime

    @field_validator("scheduled_at")
    @classmethod
    def assume_ist(cls, value: datetime) -> datetime:
        # the app is India-oriented, so a time sent without an offset is read as IST
        if value.tzinfo is None:
            value = value.replace(tzinfo=IST)
        return value
