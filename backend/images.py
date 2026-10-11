from fastapi import HTTPException, Request
from PIL import Image, ImageOps
import io
import os
import uuid
#It ignores the client’s filename and declared type. It checks the actual bytes with Pillow,
#  allows only JPEG, PNG and WEBP, and picks the file extension from the real format.
#  It also re-saves the image, which removes the EXIF location data while keeping phone photos the right way up.

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_IMAGES = 5  # most images allowed in one upload (per report)
MAX_DIMENSION = 1600  # longest side in pixels; bigger photos are scaled down when saved to save disk space
ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}  # format detected by Pillow -> extension to save with

def _validate_image(contents: bytes, max_dimension: int = MAX_DIMENSION) -> tuple[Image.Image, str]:
    """Checks uploaded bytes are a real JPEG/PNG/WEBP under the size limit.

    The file name and content type sent by the client are never trusted: the real
    format is detected from the bytes, so a .html or .svg file can't be uploaded
    as an "image" and then served from /uploads.
    Returns the image (upright and scaled down if needed) and its format.
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
        img.thumbnail((max_dimension, max_dimension))  # only ever shrinks, keeps the aspect ratio
    except HTTPException:
        raise
    except Exception:  # not an image, corrupted, or too large to decode safely
        raise HTTPException(status_code=400, detail="Invalid file type. Only images are allowed.")
    return img, img_format

def _store_image(img: Image.Image, img_format: str) -> str:
    os.makedirs("uploads", exist_ok=True)
    file_path = os.path.join("uploads", str(uuid.uuid4()) + ALLOWED_FORMATS[img_format])

    # re-encoding writes only the pixels, which also strips EXIF metadata such as the phone's GPS location
    save_options = {"quality": 90} if img_format in ("JPEG", "WEBP") else {}
    img.save(file_path, format=img_format, **save_options)
    return file_path

def save_image(contents: bytes, max_dimension: int = MAX_DIMENSION) -> str:
    """Validates one uploaded image, saves a clean copy in uploads/ and returns its path."""
    img, img_format = _validate_image(contents, max_dimension)
    return _store_image(img, img_format)

def save_images(contents_list: list[bytes], max_count: int = MAX_IMAGES) -> list[str]:
    """Validates and saves 1 to max_count uploaded images, returning their paths in order.

    Every image is checked before any is saved, so one bad file doesn't leave
    the others behind on disk.
    """
    if not 1 <= len(contents_list) <= max_count:
        raise HTTPException(status_code=400, detail=f"Upload between 1 and {max_count} images.")

    validated = []
    for number, contents in enumerate(contents_list, start=1):
        try:
            validated.append(_validate_image(contents))
        except HTTPException as error:
            raise HTTPException(status_code=400, detail=f"Image {number}: {error.detail}")

    paths = []
    try:
        for img, img_format in validated:
            paths.append(_store_image(img, img_format))
    except Exception:
        delete_images(paths)
        raise
    return paths

def delete_images(paths: list[str]) -> None:
    for path in paths:
        try:
            os.remove(path)
        except OSError:
            pass

def image_url(request: Request, path: str) -> str:
    """Builds the public URL for a file saved in uploads/."""
    return str(request.base_url) + path.replace("\\", "/")

def report_image_urls(request: Request, report) -> list[str]:
    """URLs of all photos of a report, cover first."""
    return [image_url(request, img.image_path) for img in report.images]
