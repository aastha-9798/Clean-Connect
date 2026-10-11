from google import genai
from google.genai import types, errors
import os
from dotenv import load_dotenv
from collections.abc import Iterator
from backend.ai.models import Conversation, Message
from backend.database import SessionLocal

# Load environment variables
load_dotenv()

# Create client
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# Tried in order: if a model is busy (503), rate-limited (429) or unavailable, the next one answers instead.
# Each model has its own free-tier quota, so falling back makes "busy" errors much rarer.
# gemini-3.5-flash is first because it was the fastest reliable one in testing (first words in ~1.5-2.5s).
MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-flash-latest"]
FALLBACK_ERROR_CODES = (404, 429, 500, 503)
HISTORY_LIMIT = 6  # how many earlier messages are sent to the model as context

# Sent once per request as the model's standing instructions, separate from the conversation itself
SYSTEM_INSTRUCTION = """You are a friendly waste management assistant.

Your job:
- Help users understand and manage waste
- Answer questions clearly and simply

Rules:
- Use simple, everyday language
- Be friendly and helpful
- Avoid technical terms
- If user provides image , respond in its context

Response length rules:
- If the user asks a simple question → keep answer short (2–3 sentences)
- If the user asks for instructions (e.g., "how to", "steps", "what should I do") → give a slightly longer answer (4–6 lines max), in bulleted points / steps
- Do NOT give very long or complex explanations"""

# Simple waste questions don't need the model to "think" first, and thinking adds seconds before the reply starts,
# so the lowest level is used. Not every model accepts "minimal"; those that reject it are switched to "low" here.
_thinking_level_for_model: dict[str, types.ThinkingLevel] = {}

def _generation_config(model: str) -> types.GenerateContentConfig:
    if model.startswith("gemini-2"):
        thinking = types.ThinkingConfig(thinking_budget=0)  # Gemini 2.x turns thinking off with a budget of 0
    else:
        level = _thinking_level_for_model.get(model, types.ThinkingLevel.MINIMAL)
        thinking = types.ThinkingConfig(thinking_level=level)
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        thinking_config=thinking,
    )

def _is_unsupported_thinking_level(error: errors.APIError, model: str) -> bool:
    return (
        error.code == 400
        and "thinking level" in (error.message or "").lower()
        and _thinking_level_for_model.get(model) != types.ThinkingLevel.LOW
    )


class ChatError(Exception):
    """The reply couldn't be generated; the message is safe to show to the user."""


def get_or_create_conversation(db, user_id):
    conversation = db.query(Conversation).filter_by(user_id=user_id).first()

    if not conversation:
        conversation = Conversation(user_id=user_id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    return conversation

def save_message(db, conversation_id, role, content, image_path=None):
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        image_path=image_path
    )
    db.add(message)
    db.commit()

def get_last_messages(db, conversation_id, limit=HISTORY_LIMIT):
    messages = (
        db.query(Message)
        .filter_by(conversation_id=conversation_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
        .all()
    )

    return list(reversed(messages))  # important: oldest → newest

def build_contents(history, user_message, image=None) -> list[types.Content]:
    """Turns the conversation into the role-tagged messages Gemini expects.

    Earlier messages are sent as text only; the image (if any) is attached to the new message.
    """
    contents = []
    for msg in history:
        role = "user" if msg.role == "user" else "model"
        if not contents and role == "model":
            continue  # the conversation sent to the model must start with a user message
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.content)]))

    parts = [types.Part.from_text(text=user_message)]
    if image:
        parts.append(types.Part.from_bytes(data=image.data, mime_type=image.mime_type))
    contents.append(types.Content(role="user", parts=parts))
    return contents

def _stream_from_models(contents) -> Iterator[str]:
    """Streams the reply from the first model in MODELS that can answer.

    Falls back to the next model when one is busy, rate-limited or unavailable,
    and retries a model with a higher thinking level if it rejects "minimal".
    Raises ChatError with a user-friendly message if no model can answer.
    """
    last_error = None
    for model in MODELS:
        while True:
            received_text = False
            try:
                for chunk in client.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=_generation_config(model)
                ):
                    if chunk.text:
                        received_text = True
                        yield chunk.text
                return
            except errors.APIError as error:
                print(f"Gemini error ({model}):", error.code, error.message)
                if received_text:
                    # part of the answer is already on the user's screen, so another model can't take over now
                    raise ChatError("The reply was interrupted. Please try again.")
                if _is_unsupported_thinking_level(error, model):
                    _thinking_level_for_model[model] = types.ThinkingLevel.LOW
                    continue  # same model again with the "low" level
                if error.code not in FALLBACK_ERROR_CODES:
                    raise ChatError("Sorry, the assistant couldn't answer that. Please try again.")
                last_error = error
                break  # try the next model

    if last_error is not None and last_error.code == 429:
        raise ChatError("The assistant has reached its usage limit for now. Please try again in a few minutes.")
    raise ChatError("The assistant is busy right now. Please try again in a moment.")

def stream_reply(user_id, user_message, image=None) -> Iterator[str]:
    """Yields the assistant's reply piece by piece as Gemini writes it.

    Both messages are saved only once the whole reply has arrived. Uses its own
    database session because it keeps running after the route function has returned.
    Raises ChatError with a user-friendly message if Gemini fails.
    """
    db = SessionLocal()
    try:
        conversation = get_or_create_conversation(db, user_id)
        history = get_last_messages(db, conversation.id)
        contents = build_contents(history, user_message, image)

        reply_parts = []
        for text in _stream_from_models(contents):
            reply_parts.append(text)
            yield text

        bot_reply = "".join(reply_parts)
        if not bot_reply:
            raise ChatError("Sorry, the assistant couldn't answer that. Please try again.")

        save_message(db, conversation.id, "user", user_message, image.path if image else None)
        save_message(db, conversation.id, "assistant", bot_reply)
    finally:
        db.close()
