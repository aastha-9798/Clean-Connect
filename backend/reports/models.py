from sqlalchemy import Column, String, ForeignKey, Integer, Text, Float
from sqlalchemy.orm import relationship
from backend.database import Base, UTCDateTime
from datetime import datetime , timezone

class Report(Base):  #stores all the reports uploaded by users
    __tablename__ = "reports"
    id = Column(Integer , primary_key=True)
    user_id= Column(String, ForeignKey("users.id"), index=True)
    image_path = Column(String, nullable=False)
    latitude= Column(Float, nullable=False)
    longitude= Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    status= Column(String, default="pending", nullable=False)
    created_at = Column(
        UTCDateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    user= relationship("User", back_populates="reports")