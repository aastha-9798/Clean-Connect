from fastapi import APIRouter, UploadFile, File, Form, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import literal_column
from backend.ai.service import handle_user_input
from backend.database import get_db
from backend.authentication.dependencies import get_current_user
from backend.ai.models import Message
from backend.ai.service import get_or_create_conversation
from backend.images import save_image

router = APIRouter()


@router.post("/chat")
def chat( # plain def (not async): FastAPI runs it in a thread pool, so the slow Gemini call doesn't block other requests
    message: str = Form(...),
    image: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    image_path = None

    if image:
        image_path = save_image(image.file.read()) # checks size and real image format, then saves it

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
        .order_by(Message.created_at.asc(), literal_column("messages.rowid").asc()) # rowid breaks ties in insertion order
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