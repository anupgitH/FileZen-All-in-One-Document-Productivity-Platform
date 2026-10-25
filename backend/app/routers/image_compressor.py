from io import BytesIO

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image

router = APIRouter(prefix="/api/image", tags=["Image Compressor"])

MAX_UPLOAD_SIZE = 20 * 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


@router.post("/compress-to-kb")
async def compress_to_kb(
    file: UploadFile = File(...),
    target_kb: int = Form(...),
):
    if target_kb < 1 or target_kb > 10000:
        raise HTTPException(
            status_code=400,
            detail="Target size must be between 1 and 10000 KB.",
        )

    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum upload size is 20 MB.",
        )

    try:
        image = Image.open(BytesIO(data))
        image.load()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    if image.format not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, PNG, or WebP image.",
        )

    original_size = len(data)
    target_bytes = target_kb * 1024

    # JPEG is useful for targeting a specific file size.
    # Transparency is flattened onto white when necessary.
    if image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    ):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.getchannel("A"))
        image = background
    else:
        image = image.convert("RGB")

    # Try progressively lower JPEG quality settings.
    best_data = None

    for quality in range(90, 9, -5):
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=quality, optimize=True)
        candidate = buffer.getvalue()

        if best_data is None or len(candidate) < len(best_data):
            best_data = candidate

        if len(candidate) <= target_bytes:
            best_data = candidate
            break

    # If quality reduction isn't enough, progressively reduce dimensions.
    if len(best_data) > target_bytes:
        resized = image.copy()

        for _ in range(10):
            new_width = max(1, int(resized.width * 0.8))
            new_height = max(1, int(resized.height * 0.8))

            if new_width == resized.width and new_height == resized.height:
                break

            resized = resized.resize(
                (new_width, new_height),
                Image.Resampling.LANCZOS,
            )

            for quality in (75, 60, 45, 30, 15, 10):
                buffer = BytesIO()
                resized.save(
                    buffer,
                    format="JPEG",
                    quality=quality,
                    optimize=True,
                )
                candidate = buffer.getvalue()

                if len(candidate) < len(best_data):
                    best_data = candidate

                if len(candidate) <= target_bytes:
                    best_data = candidate
                    break

            if len(best_data) <= target_bytes:
                break

    compressed_size = len(best_data)
    percent_saved = (
        max(0, (original_size - compressed_size) / original_size * 100)
        if original_size
        else 0
    )

    return Response(
        content=best_data,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": 'attachment; filename="compressed.jpg"',
            "X-Original-Size": str(original_size),
            "X-Compressed-Size": str(compressed_size),
            "X-Target-KB": str(target_kb),
            "X-Percent-Saved": f"{percent_saved:.2f}",
            "Access-Control-Expose-Headers": (
                "Content-Disposition, X-Original-Size, "
                "X-Compressed-Size, X-Target-KB, X-Percent-Saved"
            ),
        },
    )