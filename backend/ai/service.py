from google import genai
import os
from dotenv import load_dotenv
from PIL import Image
from pathlib import Path
from backend.ai.models import Conversation, Message
from sqlalchemy import literal_column

# Load environment variables
load_dotenv()

# Create client
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

conversation = []



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

def get_last_messages(db, conversation_id, limit=6):
    messages = (
        db.query(Message)
        .filter_by(conversation_id=conversation_id)
        .order_by(Message.created_at.desc(), literal_column("messages.rowid").desc()) # rowid breaks ties in insertion order
        .limit(limit)
        .all()
    )

    return list(reversed(messages))  # important: oldest → newest

def build_context(messages):
    conversation = []

    for msg in messages:
        if msg.role == "user":
            if msg.image_path:
                conversation.append(f"User: {msg.content}")
            else:
                conversation.append(f"User: {msg.content}")
        else:
            conversation.append(f"Assistant: {msg.content}")

    return "\n".join(conversation)


def handle_user_input(db, user_id, user_message, image_path=None):
    conversation = get_or_create_conversation(db,user_id)
    messages= get_last_messages(db, conversation.id, 6)
    context= build_context(messages)
    current_input = f"User: {user_message}"
    context = context + "\n" + current_input
    
    prompt = f"""
        You are a friendly waste management assistant.

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
        - Do NOT give very long or complex explanations

        Conversation:
        {context}

        Assistant:
        """

    if image_path:
        
        image = Image.open(image_path)
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=[prompt, image]
        )

    else:
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt
        )

    bot_reply = response.text

    save_message(
        db,
        conversation.id,
        "user",
        user_message,
        str(image_path) if image_path else None
    )

    save_message(
        db,
        conversation.id,
        "assistant",
        bot_reply
    )

    return bot_reply