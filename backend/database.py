from sqlalchemy import create_engine, DateTime
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import sessionmaker, declarative_base , Session
from datetime import timezone

DB_url="sqlite:///./backend/cleanconnect.db"
engine = create_engine(DB_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class UTCDateTime(TypeDecorator): # use this instead of DateTime for every datetime column
    # SQLite has no timezone support, so datetimes are stored as naive UTC
    # and given back as timezone-aware UTC. The API then sends them with an
    # offset (+00:00) and the frontend can convert them to IST correctly.
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect): # python -> database
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect): # database -> python
        if value is not None:
            value = value.replace(tzinfo=timezone.utc)
        return value

def get_db(): # Dependency to get a database session
    db = SessionLocal() # Create a new database session
    try:
        yield db   # Yield the session to the caller
    finally:
        db.close()  # Ensure the session is closed after use