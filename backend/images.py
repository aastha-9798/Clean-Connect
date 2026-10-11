from fastapi import HTTPException
from PIL import Image, ImageOps
import io
import os
import uuid
#It ignores the client’s filename and declared type. It checks the actual bytes with Pillow,
#  allows only JPEG, PNG and WEBP, and picks the file extension from the real format.
#  It also re-saves the image, which removes the EXIF location data while keeping phone photos the right way up.

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}  # format detected by Pillow -> extension to save with

def save_image(contents: bytes) -> str:
    """Validates uploaded image bytes, saves a clean copy in uploads/ and returns its path.

    The file name and content type sent by the client are never trusted: the real
    format is detected from the bytes, so a .html or .svg file can't be uploaded
    as an "image" and then served from /uploads.
    """
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds the limit of 5MB.")

    try:
        with Image.open(io.BytesIO(contents)) as img:
            img.verify()  # checks the file is a real, undamaged image
        img = Image.open(io.BytesIO(contents))  # verify() leaves the image unusable, so open it again
        img_format = img.format
        if img_format not in ALLOWED_FORMATS:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG and WEBP images are allowed.")
        img = ImageOps.exif_transpose(img)  # keep phone photos the right way up once EXIF is dropped
    except HTTPException:
        raise
    except Exception:  # not an image, corrupted, or too large to decode safely
        raise HTTPException(status_code=400, detail="Invalid file type. Only images are allowed.")

    os.makedirs("uploads", exist_ok=True)
    file_path = os.path.join("uploads", str(uuid.uuid4()) + ALLOWED_FORMATS[img_format])

    # re-encoding writes only the pixels, which also strips EXIF metadata such as the phone's GPS location
    save_options = {"quality": 90} if img_format in ("JPEG", "WEBP") else {}
    img.save(file_path, format=img_format, **save_options)
    return file_path
