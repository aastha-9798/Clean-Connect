from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base, UTCDateTime
from datetime import datetime, timezone
import uuid

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(UTCDateTime, default=lambda: datetime.now(timezone.utc)) # lambda so the time is taken per row, not once at import
    user = relationship("User")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete")



class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    image_path = Column(String, nullable=True)
    conversation = relationship("Conversation", back_populates="messages")
    created_at = Column(UTCDateTime, default=lambda: datetime.now(timezone.utc))