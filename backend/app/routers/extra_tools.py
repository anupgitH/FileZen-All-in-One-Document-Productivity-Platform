import io
import tempfile
from pathlib import Path

import fitz
from PIL import Image
from pdf2docx import Converter
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api", tags=["Extra Tools"])

MAX_PDF_SIZE = 50 * 1024 * 1024
MAX_IMAGE_SIZE = 20 * 1024 * 1024


@router.post("/pdf/compress")
async def compress_pdf(file: UploadFile = File(...)):
    """Optimize a PDF and return the compressed file."""

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    data = await file.read()

    if len(data) > MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="PDF must be 50 MB or smaller.")

    try:
        with fitz.open(stream=data, filetype="pdf") as document:
            if document.needs_pass:
                raise HTTPException(
                    status_code=400,
                    detail="Password-protected PDFs are not supported.",
                )

            output = io.BytesIO()
            document.save(
                output,
                garbage=4,
                deflate=True,
                clean=True,
            )

        compressed = output.getvalue()

        return StreamingResponse(
            io.BytesIO(compressed),
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="compressed.pdf"',
                "X-Original-Size": str(len(data)),
                "X-Compressed-Size": str(len(compressed)),
            },
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not compress PDF: {exc}",
        ) from exc


@router.post("/image/resize")
async def resize_image(
    file: UploadFile = File(...),
    width: int = Form(...),
    height: int = Form(...),
):
    """Resize an image to the specified dimensions."""

    if not 1 <= width <= 10000 or not 1 <= height <= 10000:
        raise HTTPException(
            status_code=400,
            detail="Width and height must be between 1 and 10000 pixels.",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Please select an image.")

    data = await file.read()

    if len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be 20 MB or smaller.")

    try:
        with Image.open(io.BytesIO(data)) as original:
            # Preserve transparency for PNG output.
            has_alpha = (
                original.mode in ("RGBA", "LA")
                or "transparency" in original.info
            )

            image = original.convert("RGBA" if has_alpha else "RGB")
            image = image.resize(
                (width, height),
                Image.Resampling.LANCZOS,
            )

            output = io.BytesIO()

            if has_alpha:
                image.save(output, format="PNG", optimize=True)
                media_type = "image/png"
                filename = "resized.png"
            else:
                image.save(output, format="JPEG", quality=90, optimize=True)
                media_type = "image/jpeg"
                filename = "resized.jpg"

        output.seek(0)

        return StreamingResponse(
            output,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not resize image: {exc}",
        ) from exc


@router.post("/pdf/to-word")
async def pdf_to_word(file: UploadFile = File(...)):
    """Convert a text-based PDF to an editable DOCX document."""

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    data = await file.read()

    if len(data) > 30 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF must be 30 MB or smaller.")

    try:
        with fitz.open(stream=data, filetype="pdf") as document:
            if document.needs_pass:
                raise HTTPException(
                    status_code=400,
                    detail="Password-protected PDFs are not supported.",
                )

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "input.pdf"
            docx_path = Path(temp_dir) / "converted.docx"
            pdf_path.write_bytes(data)

            converter = Converter(str(pdf_path))
            try:
                converter.convert(str(docx_path))
            finally:
                converter.close()

            if not docx_path.exists():
                raise RuntimeError("Word document was not generated.")

            result = docx_path.read_bytes()

        return StreamingResponse(
            io.BytesIO(result),
            media_type=(
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
            headers={
                "Content-Disposition": 'attachment; filename="converted.docx"',
            },
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not convert PDF to Word: {exc}",
        ) from exc