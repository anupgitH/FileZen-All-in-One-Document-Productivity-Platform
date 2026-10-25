from io import BytesIO
from uuid import uuid4

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError
from pillow_heif import register_heif_opener

# CairoSVG requires the native Cairo library.
# Keep the backend running if Cairo is unavailable.
try:
    import cairosvg
except (ImportError, OSError):
    cairosvg = None

# Register HEIC/HEIF decoding support in Pillow.
register_heif_opener()

router = APIRouter(prefix="/api/convert", tags=["Conversion"])

FORMATS = {
    "png": "PNG",
    "jpg": "JPEG",
    "webp": "WEBP",
    "bmp": "BMP",
    "gif": "GIF",
    "tiff": "TIFF",
    "svg": "SVG",
    "heic": "HEIF",
}

MAX_SIZE = 15 * 1024 * 1024
MAX_PIXELS = 25_000_000
MAX_SVG_SIZE = 5 * 1024 * 1024


def check_dimensions(image: Image.Image) -> None:
    """Reject images with excessive pixel dimensions."""
    if image.width * image.height > MAX_PIXELS:
        raise HTTPException(
            status_code=413,
            detail="Image dimensions too large. Maximum is 25 million pixels.",
        )


def raster_to_rgb(image: Image.Image) -> Image.Image:
    """Convert an image to RGB, compositing transparency onto white."""
    if image.mode in ("RGB", "L"):
        return image

    if "A" in image.getbands() or image.mode == "P":
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background

    return image.convert("RGB")


def encode_heic(image: Image.Image, output: BytesIO) -> None:
    """Encode HEIC if the installed Pillow plugin supports writing."""
    try:
        image.save(output, format="HEIF")
    except (OSError, ValueError, KeyError, RuntimeError) as exc:
        raise HTTPException(
            status_code=501,
            detail=(
                "HEIC output encoding is unavailable in this environment. "
                "Choose PNG, JPG, WEBP, BMP, GIF, or TIFF instead."
            ),
        ) from exc


def rasterize_svg(raw: bytes) -> Image.Image:
    """Convert SVG data to a Pillow image."""
    if len(raw) > MAX_SVG_SIZE:
        raise HTTPException(
            status_code=413,
            detail="SVG files must be 5 MB or smaller.",
        )

    if cairosvg is None:
        raise HTTPException(
            status_code=501,
            detail=(
                "SVG raster conversion requires Cairo. "
                "On macOS, install it using: brew install cairo"
            ),
        )

    try:
        png_bytes = cairosvg.svg2png(bytestring=raw)

        with Image.open(BytesIO(png_bytes)) as image:
            check_dimensions(image)
            image.load()
            return image.copy()

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid or unsupported SVG file.",
        ) from exc


def is_svg_file(filename: str, raw: bytes) -> bool:
    """Detect SVG files using their filename or document content."""
    if filename.lower().endswith(".svg"):
        return True

    prefix = raw.lstrip()[:8192].lower()

    return (
        prefix.startswith(b"<svg")
        or (
            prefix.startswith(b"<?xml")
            and b"<svg" in prefix
        )
    )


def convert_raster(
    image: Image.Image,
    target_format: str,
    output: BytesIO,
) -> None:
    """Encode a Pillow image in the requested output format."""
    if target_format == "SVG":
        raise HTTPException(
            status_code=400,
            detail=(
                "Raster images cannot be converted into true vector SVG files. "
                "Choose PNG, JPG, WEBP, BMP, GIF, TIFF, or HEIC."
            ),
        )

    if target_format == "HEIF":
        encode_heic(raster_to_rgb(image), output)
        return

    if target_format == "JPEG":
        image = raster_to_rgb(image)

    elif target_format == "BMP":
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

    elif target_format == "GIF":
        # GIF supports a maximum of 256 colors per frame.
        if image.mode not in ("RGB", "RGBA", "P", "L"):
            image = image.convert("RGBA")

        image = image.convert(
            "P",
            palette=Image.Palette.ADAPTIVE,
            colors=256,
        )

    image.save(output, format=target_format)


@router.post("/image/{target_format}")
async def convert_image(
    target_format: str,
    file: UploadFile = File(...),
):
    """Convert an uploaded image to the requested format."""
    target_format = target_format.lower()

    if target_format not in FORMATS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported output format. Choose PNG, JPG, WEBP, BMP, "
                "GIF, TIFF, SVG, or HEIC."
            ),
        )

    try:
        raw = await file.read(MAX_SIZE + 1)
        filename = file.filename or ""
    finally:
        await file.close()

    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Please upload an image.",
        )

    if len(raw) > MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum file size is 15 MB.",
        )

    output = BytesIO()
    svg_input = is_svg_file(filename, raw)

    try:
        if svg_input:
            if target_format == "svg":
                # Preserve the original SVG document.
                output.write(raw)
            else:
                image = rasterize_svg(raw)
                convert_raster(
                    image,
                    FORMATS[target_format],
                    output,
                )

        else:
            with Image.open(BytesIO(raw)) as source:
                check_dimensions(source)
                source.load()
                image = source.copy()

            convert_raster(
                image,
                FORMATS[target_format],
                output,
            )

    except HTTPException:
        raise

    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid image file. Supported inputs include PNG, JPG, "
                "WEBP, BMP, GIF, TIFF, SVG, and HEIC/HEIF."
            ),
        ) from exc

    except (OSError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Unable to process image. Check the file and format.",
        ) from exc

    finally:
        pass

    output.seek(0)

    extension = "jpg" if target_format == "jpg" else target_format

    media_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "webp": "image/webp",
        "bmp": "image/bmp",
        "gif": "image/gif",
        "tiff": "image/tiff",
        "svg": "image/svg+xml",
        "heic": "image/heic",
    }

    return StreamingResponse(
        output,
        media_type=media_types[target_format],
        headers={
            "Content-Disposition": (
                f'attachment; filename="filezen-{uuid4().hex[:8]}.{extension}"'
            ),
            "Cache-Control": "no-store",
        },
    )