from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from backend.database import get_db
from backend.authentication import models, schemas
from backend.authentication.dependencies import get_current_user, security
from backend.authentication.auth_utils import hash_password, verify_password
from backend.authentication.jwt_utils import (
    create_access_token,
    create_refresh_token,
    SECRET_KEY,
    ALGORITHM
)

router = APIRouter()

@router.get("/")
def root():
    return { "message": "auth system running"}

@router.post("/signup")
def signup(curr_user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if email already exists
    existing_user = db.query(models.User).filter(models.User.email == curr_user.email).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Hash password
    hashed_pw = hash_password(curr_user.password)

    # Create new user object
    new_user = models.User(
        email=curr_user.email,
        username=curr_user.username,
        password_hash=hashed_pw  
    )

    # Add to database
    db.add(new_user) #stages the new user to be added to the database
    db.commit() #commits the transaction to save the new user in the database
    db.refresh(new_user) #refreshes the new_user object with the data from the database, including the generated id
    print(f"New user created: {new_user.email} with id {new_user.id}")

    return {"message": "User created successfully"}

@router.post("/login")
def login(curr_user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == curr_user.email).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(curr_user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(db_user.id)
    refresh_token = create_refresh_token(db_user.id)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.get("/me")
def read_me(current_user: models.User = Depends(get_current_user)): #here models.User is the type hint for current_user
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username
    }

@router.post("/refresh")
def refresh_token(
    creds: HTTPAuthorizationCredentials= Depends(security),
    db: Session= Depends(get_db)
):
    token= creds.credentials
    try:
        payload= jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id=payload.get("sub")
        token_type= payload.get("type")
        
        if user_id is None or token_type !="refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user= db.query(models.User).filter(models.User.id==user_id).first()

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid token" )
    
    new_access_token= create_access_token(user.id)
    return{
        "access_token": new_access_token,
        "token_type": "bearer"
    }


