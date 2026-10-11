"""Where photo files are kept: the local uploads/ folder in development,
a public Supabase Storage bucket in production (Render's free disk is wiped on every deploy).

The database stores each photo's path (local) or object name (Supabase);
public_url() turns it into the address the browser loads.
"""
import os
import httpx
from fastapi import HTTPException, Request

from backend.config import (
    USE_SUPABASE_STORAGE, SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET, UPLOAD_DIR
)

def _supabase_request(method: str, url: str, **kwargs) -> httpx.Response:
    # Newer sb_secret_ keys go only in the "apikey" header; legacy service_role keys are
    # JWTs ("eyJ...") and also need "Authorization: Bearer". If the gateway asks for an
    # Authorization header anyway, retry once with it.
    headers = {"apikey": SUPABASE_SERVICE_KEY, **kwargs.pop("headers", {})}
    use_bearer = SUPABASE_SERVICE_KEY.startswith("eyJ")
    for attempt in (1, 2):
        if use_bearer:
            headers["Authorization"] = f"Bearer {SUPABASE_SERVICE_KEY}"
        response = httpx.request(method, url, headers=headers, timeout=30, **kwargs)
        wants_bearer = response.status_code in (400, 401, 403) and "authorization" in response.text.lower()
        if attempt == 1 and wants_bearer and not use_bearer:
            use_bearer = True
            continue
        return response
    return response

def save_file(name: str, data: bytes, content_type: str) -> str:
    """Stores a new file and returns the path to keep in the database."""
    if USE_SUPABASE_STORAGE:
        response = _supabase_request(
            "POST",
            f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{name}",
            content=data,
            headers={"Content-Type": content_type, "x-upsert": "false"}
        )
        if response.status_code >= 300:
            print("Supabase Storage upload failed:", response.status_code, response.text[:300])
            raise HTTPException(status_code=502, detail="Couldn't save the photo. Please try again.")
        return name

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    path = os.path.join(UPLOAD_DIR, name)
    with open(path, "wb") as f:
        f.write(data)
    return path

def delete_files(paths: list[str]) -> None:
    """Removes stored files; failures are logged, not raised (the database change already happened)."""
    if not paths:
        return
    if USE_SUPABASE_STORAGE:
        try:
            response = _supabase_request(
                "DELETE",
                f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}",
                json={"prefixes": paths}
            )
            if response.status_code >= 300:
                print("Supabase Storage delete failed:", response.status_code, response.text[:300])
        except httpx.HTTPError as error:
            print("Supabase Storage delete failed:", error)
        return

    for path in paths:
        try:
            os.remove(path)
        except OSError:
            pass

def public_url(request: Request, path: str) -> str:
    """The address the browser uses to load a stored photo."""
    if USE_SUPABASE_STORAGE:
        return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{path}"
    return str(request.base_url) + path.replace("\\", "/")
