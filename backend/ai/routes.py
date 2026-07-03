from fastapi import APIRouter, UploadFile, File, Form, Depends, Request
from sqlalchemy.orm import Session
from backend.ai.service import handle_user_input
from backend.database import get_db
from backend.authentication.dependencies import get_current_user
from backend.ai.models import Message
from backend.ai.service import get_or_create_conversation
import shutil
import uuid
import os
from pathlib import Path

router = APIRouter()


@router.post("/chat")
async def chat(
    message: str = Form(...),
    image: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    image_path = None

    if image:
        file_name = f"{uuid.uuid4()}.jpg"
        image_path = Path(f"uploads/{current_user.id}_{file_name}")
        image_path.parent.mkdir(parents=True, exist_ok=True)
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

    response = handle_user_input(
        db=db,
        user_id=current_user.id,
        user_message=message,
        image_path=image_path
    )
    return {
        "response": response
    }

@router.get("/history")
def get_chat_history(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    conversation = get_or_create_conversation(db, current_user.id)

    messages = (
        db.query(Message)
        .filter_by(conversation_id=conversation.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    history = []
    for msg in messages:
        image_url = None
        if msg.image_path:
            image_url = (
                str(request.base_url)
                + str(msg.image_path).replace("\\", "/")
            )
        history.append({

            "role": msg.role,

            "content": msg.content,

            "image": image_url

        })

    return history