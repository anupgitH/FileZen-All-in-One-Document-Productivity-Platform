import io
import os
import re
import tempfile
from pathlib import Path

import fitz
from PIL import Image
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

router = APIRouter(prefix="/api/documents", tags=["Advanced Document Tools"])


async def read_pdf(file: UploadFile) -> bytes:
    data = await file.read()

    if not data.startswith(b"%PDF"):
        raise HTTPException(400, "Please upload a valid PDF file.")

    return data


def pdf_response(data: bytes, filename: str):
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


def markdown_response(data: str, filename: str):
    return Response(
        content=data.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.post("/page-numbers")
async def add_page_numbers(file: UploadFile = File(...)):
    data = await read_pdf(file)

    try:
        doc = fitz.open(stream=data, filetype="pdf")

        for index, page in enumerate(doc):
            page.insert_text(
                (page.rect.width / 2 - 15, page.rect.height - 25),
                str(index + 1),
                fontsize=11,
                color=(0.25, 0.25, 0.25),
            )

        output = doc.tobytes()
        doc.close()
        return pdf_response(output, "numbered.pdf")

    except Exception as exc:
        raise HTTPException(400, f"Could not add page numbers: {exc}")


@router.post("/scan-to-pdf")
async def scan_to_pdf(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(400, "Upload at least one image.")

    images = []

    try:
        for file in files:
            raw = await file.read()

            try:
                image = Image.open(io.BytesIO(raw)).convert("RGB")
                images.append(image)
            except Exception:
                raise HTTPException(
                    400, f"{file.filename} is not a supported image."
                )

        if not images:
            raise HTTPException(400, "No valid images were uploaded.")

        output = io.BytesIO()
        images[0].save(
            output,
            format="PDF",
            save_all=True,
            append_images=images[1:],
            resolution=150,
        )

        for image in images:
            image.close()

        return pdf_response(output.getvalue(), "scanned.pdf")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Could not create PDF: {exc}")


@router.post("/crop-pdf")
async def crop_pdf(
    file: UploadFile = File(...),
    left: float = 20,
    top: float = 20,
    right: float = 20,
    bottom: float = 20,
):
    data = await read_pdf(file)

    if min(left, top, right, bottom) < 0:
        raise HTTPException(400, "Crop margins cannot be negative.")

    try:
        doc = fitz.open(stream=data, filetype="pdf")

        for page in doc:
            rect = page.rect
            crop = fitz.Rect(
                rect.x0 + left,
                rect.y0 + top,
                rect.x1 - right,
                rect.y1 - bottom,
            )

            if crop.width <= 0 or crop.height <= 0:
                raise HTTPException(
                    400, "Crop margins are too large for this page."
                )

            page.set_cropbox(crop)

        output = doc.tobytes()
        doc.close()
        return pdf_response(output, "cropped.pdf")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Could not crop PDF: {exc}")


@router.post("/pdf-to-markdown")
async def pdf_to_markdown(file: UploadFile = File(...)):
    data = await read_pdf(file)

    try:
        doc = fitz.open(stream=data, filetype="pdf")
        sections = []

        for index, page in enumerate(doc):
            text = page.get_text("text").strip()
            sections.append(f"## Page {index + 1}\n\n{text}")

        doc.close()

        markdown = "\n\n---\n\n".join(sections)
        return markdown_response(markdown, "document.md")

    except Exception as exc:
        raise HTTPException(
            400, f"Could not extract Markdown from PDF: {exc}"
        )


def not_implemented(tool_name: str):
    raise HTTPException(
        status_code=501,
        detail=(
            f"{tool_name} is not implemented yet. "
            "Its processing logic must be added before use."
        ),
    )


@router.post("/ocr-pdf")
async def ocr_pdf(file: UploadFile = File(...)):
    not_implemented("OCR PDF")


@router.post("/compare-pdf")
async def compare_pdf(files: list[UploadFile] = File(...)):
    if len(files) != 2:
        raise HTTPException(400, "Upload exactly two PDF files.")
    not_implemented("Compare PDF")


@router.post("/redact-pdf")
async def redact_pdf(file: UploadFile = File(...)):
    not_implemented("Redact PDF")


@router.post("/pdf-forms")
async def pdf_forms(file: UploadFile = File(...)):
    not_implemented("PDF Forms")


@router.post("/ai-summarize")
async def ai_summarize(file: UploadFile = File(...)):
    not_implemented("AI Summarizer")


@router.post("/translate-pdf")
async def translate_pdf(file: UploadFile = File(...)):
    not_implemented("Translate PDF")