from datetime import datetime, timedelta , timezone
from jose import JWTError, jwt
import os
from dotenv import load_dotenv

load_dotenv() #reads the .env file and loads the environment variables into the system, allowing us to access them using os.getenv()


SECRET_KEY = os.getenv("SECRET_KEY") #retrieves the value of the environment variable named
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY not set in environment variables")
ALGORITHM = "HS256"


ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(user_id: str):
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(user_id: str):
    expire = datetime.now(timezone.utc)+ timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)