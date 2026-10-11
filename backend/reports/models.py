from sqlalchemy import Column, String, ForeignKey, Integer, Text, Float
from sqlalchemy.orm import relationship
from backend.database import Base, UTCDateTime
from datetime import datetime , timezone

class Report(Base):  #stores all the reports uploaded by users
    __tablename__ = "reports"
    id = Column(Integer , primary_key=True)
    user_id= Column(String, ForeignKey("users.id"), index=True)
    latitude= Column(Float, nullable=False, index=True) # indexed for the map's area queries
    longitude= Column(Float, nullable=False, index=True)
    description = Column(Text, nullable=True)
    status= Column(String, default="pending", nullable=False)
    created_at = Column(
        UTCDateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    user= relationship("User", back_populates="reports")
    # photos of the report in upload order; the first one is the cover shown on cards
    images = relationship(
        "ReportImage",
        back_populates="report",
        order_by="ReportImage.position",
        cascade="all, delete-orphan"
    )

class ReportImage(Base):  #one row per photo of a report (1 to 5 per report)
    __tablename__ = "report_images"
    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    image_path = Column(String, nullable=False)
    position = Column(Integer, nullable=False)  # 0 = cover photo
    created_at = Column(
        UTCDateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    report = relationship("Report", back_populates="images")
