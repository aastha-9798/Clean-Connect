from backend.database import Base, UTCDateTime
from sqlalchemy import Column, String, ForeignKey, Text , Float, Integer
from datetime import datetime , timezone
from sqlalchemy.orm import relationship
import uuid

class Drive(Base):
    __tablename__="drives"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    scheduled_at = Column(UTCDateTime, nullable=False)
    latitude= Column(Float, nullable=False)
    longitude= Column(Float, nullable=False)
    status= Column(String, default="planned", nullable=False)
    created_at = Column(
        UTCDateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    participants = relationship("Participation", back_populates="drive")

class Participation(Base):
    __tablename__="participation"
    user_id= Column(String, ForeignKey("users.id"), primary_key=True)
    drive_id= Column(String, ForeignKey("drives.id"), primary_key=True)
    joined_at = Column(
        UTCDateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    drive = relationship("Drive", back_populates="participants")
    user = relationship("User", back_populates="participations")

    #participation object is user_id drive_id joined_at
    