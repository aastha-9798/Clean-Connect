from backend.database import Base, UTCDateTime
from sqlalchemy import Column, String, ForeignKey, Text , Float, Integer, Boolean
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
    latitude= Column(Float, nullable=False, index=True) # indexed for the map's area queries
    longitude= Column(Float, nullable=False, index=True)
    status= Column(String, default="planned", nullable=False) # planned -> completed, or cancelled if not completed in time
    completed_at = Column(UTCDateTime, nullable=True)
    created_at = Column(
        UTCDateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    participants = relationship("Participation", back_populates="drive", cascade="all, delete-orphan")
    # photos taken at the drive by checked-in attendees, oldest first
    after_images = relationship(
        "DriveImage",
        back_populates="drive",
        order_by="DriveImage.created_at",
        cascade="all, delete-orphan"
    )
    report = relationship("Report")
    organizer = relationship("User")

class Participation(Base):
    __tablename__="participation"
    user_id= Column(String, ForeignKey("users.id"), primary_key=True)
    drive_id= Column(String, ForeignKey("drives.id"), primary_key=True)
    joined_at = Column(
        UTCDateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    # set when the participant checks in on site (their location was within range); nothing else is stored
    checked_in = Column(Boolean, default=False, nullable=False)
    drive = relationship("Drive", back_populates="participants")
    user = relationship("User", back_populates="participations")

    #participation object is user_id drive_id joined_at checked_in

class DriveImage(Base):  #"after" photos of a drive (up to 10 per drive, 2 per person)
    __tablename__ = "drive_images"
    id = Column(Integer, primary_key=True)
    drive_id = Column(String, ForeignKey("drives.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    image_path = Column(String, nullable=False)
    created_at = Column(
        UTCDateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    drive = relationship("Drive", back_populates="after_images")
