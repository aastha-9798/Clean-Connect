from fastapi import APIRouter, UploadFile, File, Form, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import literal_column
from backend.ai.service import stream_reply, ChatError
from backend.database import get_db
from backend.authentication.dependencies import get_current_user
from backend.ai.models import Message
from backend.ai.service import get_or_create_conversation
from backend.images import save_image
import json

router = APIRouter()

CHAT_IMAGE_MAX_DIMENSION = 1024  # chat photos only need to be big enough for the model to understand them


@router.post("/chat")
def chat( # plain def (not async): FastAPI runs it in a thread pool, so the slow Gemini call doesn't block other requests
    message: str = Form(...),
    image: UploadFile = File(None),
    current_user = Depends(get_current_user)
):
    image_path = None

    if image:
        # checks size and real image format, then saves it
        image_path = save_image(image.file.read(), max_dimension=CHAT_IMAGE_MAX_DIMENSION)

    def events():
        # The reply is streamed as it's written, one JSON object per line:
        #   {"type": "chunk", "text": "..."}  a piece of the reply
        #   {"type": "done"}                  the reply is complete and saved
        #   {"type": "error", "message": "..."}  something went wrong (shown to the user)
        try:
            for text in stream_reply(current_user.id, message, image_path):
                yield json.dumps({"type": "chunk", "text": text}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
        except ChatError as error:
            yield json.dumps({"type": "error", "message": str(error)}) + "\n"
        except Exception as error:
            print("Chat error:", repr(error))
            yield json.dumps({"type": "error", "message": "Sorry, something went wrong. Please try again."}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")

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