import io
import json
import os
import tempfile
import zipfile
from pathlib import Path

import fitz
from PIL import Image
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from playwright.async_api import async_playwright

router = APIRouter(prefix="/api/pdf", tags=["Advanced PDF Tools"])

MAX_FILE_SIZE = 50 * 1024 * 1024


async def read_upload(file: UploadFile) -> bytes:
    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File exceeds the 50 MB limit.",
        )

    return data


def open_pdf(data: bytes, password: str = "") -> fitz.Document:
    try:
        doc = fitz.open(stream=data, filetype="pdf")

        if doc.needs_pass:
            if not password or not doc.authenticate(password):
                doc.close()
                raise HTTPException(
                    status_code=400,
                    detail="PDF password is missing or incorrect.",
                )

        return doc

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to open PDF: {exc}",
        )


def pdf_response(data: bytes, filename: str):
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


def zip_response(data: bytes, filename: str):
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


def require_pages(doc: fitz.Document):
    if doc.page_count == 0:
        raise HTTPException(status_code=400, detail="PDF has no pages.")


# 1. PDF TO JPG
@router.post("/to-jpg")
async def pdf_to_jpg(
    file: UploadFile = File(...),
    dpi: int = Form(150),
    password: str = Form(""),
):
    if not 50 <= dpi <= 300:
        raise HTTPException(
            status_code=400,
            detail="DPI must be between 50 and 300.",
        )

    data = await read_upload(file)
    doc = open_pdf(data, password)

    try:
        require_pages(doc)

        output = io.BytesIO()

        with zipfile.ZipFile(
            output,
            mode="w",
            compression=zipfile.ZIP_DEFLATED,
        ) as archive:
            for index, page in enumerate(doc):
                pix = page.get_pixmap(
                    matrix=fitz.Matrix(dpi / 72, dpi / 72),
                    alpha=False,
                )

                image = Image.frombytes(
                    "RGB",
                    [pix.width, pix.height],
                    pix.samples,
                )

                image_data = io.BytesIO()
                image.save(image_data, format="JPEG", quality=90)

                archive.writestr(
                    f"page_{index + 1}.jpg",
                    image_data.getvalue(),
                )

        return zip_response(output.getvalue(), "pdf-images.zip")

    finally:
        doc.close()


# 2. JPG TO PDF
@router.post("/from-jpg")
async def jpg_to_pdf(
    files: list[UploadFile] = File(...),
):
    if not files:
        raise HTTPException(status_code=400, detail="Upload JPG images.")

    if len(files) > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum 100 images per conversion.",
        )

    images = []

    try:
        for file in files:
            data = await read_upload(file)

            try:
                image = Image.open(io.BytesIO(data))
                image.load()
                images.append(image.convert("RGB"))
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail=f"{file.filename} is not a valid image.",
                )

        output = io.BytesIO()
        images[0].save(
            output,
            format="PDF",
            save_all=True,
            append_images=images[1:],
        )

        return pdf_response(output.getvalue(), "images.pdf")

    finally:
        for image in images:
            image.close()


# 3. SIGN PDF
# Accepts a signature image and places it at the requested page position.
@router.post("/sign")
async def sign_pdf(
    file: UploadFile = File(...),
    signature: UploadFile = File(...),
    page_number: int = Form(1),
    x: float = Form(350),
    y: float = Form(650),
    width: float = Form(150),
    height: float = Form(60),
    password: str = Form(""),
):
    pdf_data = await read_upload(file)
    signature_data = await read_upload(signature)

    doc = open_pdf(pdf_data, password)

    try:
        require_pages(doc)

        if not 1 <= page_number <= doc.page_count:
            raise HTTPException(
                status_code=400,
                detail="Page number is out of range.",
            )

        if width <= 0 or height <= 0:
            raise HTTPException(
                status_code=400,
                detail="Signature width and height must be positive.",
            )

        try:
            with Image.open(io.BytesIO(signature_data)) as image:
                image.verify()
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Signature must be a valid image.",
            )

        page = doc[page_number - 1]
        rect = fitz.Rect(x, y, x + width, y + height)

        if not page.rect.contains(rect):
            raise HTTPException(
                status_code=400,
                detail="Signature position must be inside the page.",
            )

        page.insert_image(
            rect,
            stream=signature_data,
            keep_proportion=True,
            overlay=True,
        )

        return pdf_response(
            doc.tobytes(garbage=4, deflate=True),
            "signed.pdf",
        )

    finally:
        doc.close()


# 4. WATERMARK PDF
@router.post("/watermark")
async def watermark_pdf(
    file: UploadFile = File(...),
    text: str = Form("CONFIDENTIAL"),
    opacity: float = Form(0.25),
    font_size: float = Form(40),
    password: str = Form(""),
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Watermark text is required.")

    if not 0.05 <= opacity <= 1:
        raise HTTPException(
            status_code=400,
            detail="Opacity must be between 0.05 and 1.",
        )

    if not 8 <= font_size <= 100:
        raise HTTPException(
            status_code=400,
            detail="Font size must be between 8 and 100.",
        )

    data = await read_upload(file)
    doc = open_pdf(data, password)

    try:
        require_pages(doc)

        for page in doc:
            rect = page.rect
            point = fitz.Point(rect.width / 2, rect.height / 2)

            page.insert_text(
                point,
                text.strip(),
                fontsize=font_size,
                fontname="helv",
                color=(0.55, 0.55, 0.55),
                fill_opacity=opacity,
                overlay=True,
                rotate=45,
                morph=(
                    point,
                    fitz.Matrix(1, 0, 0, 1, 0, 0),
                ),
            )

        return pdf_response(
            doc.tobytes(garbage=4, deflate=True),
            "watermarked.pdf",
        )

    finally:
        doc.close()


# 5. ROTATE PDF
@router.post("/rotate")
async def rotate_pdf(
    file: UploadFile = File(...),
    angle: int = Form(90),
    page_numbers: str = Form("all"),
    password: str = Form(""),
):
    if angle not in (90, 180, 270):
        raise HTTPException(
            status_code=400,
            detail="Angle must be 90, 180, or 270 degrees.",
        )

    data = await read_upload(file)
    doc = open_pdf(data, password)

    try:
        require_pages(doc)

        if page_numbers.strip().lower() == "all":
            selected = list(range(doc.page_count))
        else:
            try:
                selected = [
                    int(number.strip()) - 1
                    for number in page_numbers.split(",")
                ]
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Use page numbers like 1,3,5 or all.",
                )

        if not selected:
            raise HTTPException(status_code=400, detail="No pages selected.")

        if any(page < 0 or page >= doc.page_count for page in selected):
            raise HTTPException(
                status_code=400,
                detail="A selected page number is out of range.",
            )

        for index in selected:
            page = doc[index]
            page.set_rotation((page.rotation + angle) % 360)

        return pdf_response(
            doc.tobytes(garbage=4, deflate=True),
            "rotated.pdf",
        )

    finally:
        doc.close()


# 6. HTML TO PDF
@router.post("/html-to-pdf")
async def html_to_pdf(
    html_content: str = Form(...),
):
    if not html_content.strip():
        raise HTTPException(status_code=400, detail="HTML content is required.")

    if len(html_content.encode("utf-8")) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="HTML content exceeds the 2 MB limit.",
        )

    browser = None

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch()

            page = await browser.new_page()
            await page.set_content(
                html_content,
                wait_until="networkidle",
                timeout=30000,
            )

            result = await page.pdf(
                format="A4",
                print_background=True,
                margin={
                    "top": "15mm",
                    "right": "15mm",
                    "bottom": "15mm",
                    "left": "15mm",
                },
            )

        return pdf_response(result, "html-document.pdf")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"HTML-to-PDF conversion failed: {exc}",
        )
    finally:
        if browser:
            await browser.close()


# 7. UNLOCK PDF
# Requires the correct password; does not crack or bypass unknown passwords.
@router.post("/unlock")
async def unlock_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
):
    data = await read_upload(file)
    doc = open_pdf(data, password)

    try:
        require_pages(doc)

        output = doc.tobytes(
            encryption=fitz.PDF_ENCRYPT_NONE,
            garbage=4,
            deflate=True,
        )

        return pdf_response(output, "unlocked.pdf")

    finally:
        doc.close()


# 8. PROTECT PDF
@router.post("/protect")
async def protect_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
):
    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Use a password of at least 6 characters.",
        )

    data = await read_upload(file)
    doc = open_pdf(data)

    try:
        require_pages(doc)

        output = doc.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw=password,
            user_pw=password,
            garbage=4,
            deflate=True,
        )

        return pdf_response(output, "protected.pdf")

    finally:
        doc.close()


# 9. ORGANIZE PDF
# Supply a JSON array of original page numbers in the desired order.
# Example: [3,1,2] puts page 3 first, followed by pages 1 and 2.
@router.post("/organize")
async def organize_pdf(
    file: UploadFile = File(...),
    page_order: str = Form(...),
    password: str = Form(""),
):
    data = await read_upload(file)
    doc = open_pdf(data, password)

    try:
        require_pages(doc)

        try:
            order = json.loads(page_order)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail='Page order must be JSON, for example [3,1,2].',
            )

        if (
            not isinstance(order, list)
            or not order
            or any(type(number) is not int for number in order)
        ):
            raise HTTPException(
                status_code=400,
                detail="Provide a non-empty list of page numbers.",
            )

        if any(number < 1 or number > doc.page_count for number in order):
            raise HTTPException(
                status_code=400,
                detail="Page order contains an invalid page number.",
            )

        result = fitz.open()

        try:
            for number in order:
                result.insert_pdf(doc, from_page=number - 1, to_page=number - 1)

            output = result.tobytes(garbage=4, deflate=True)

        finally:
            result.close()

        return pdf_response(output, "organized.pdf")

    finally:
        doc.close()


# 10. REPAIR PDF
# Best-effort recovery; not every damaged file can be repaired.
@router.post("/repair")
async def repair_pdf(
    file: UploadFile = File(...),
):
    data = await read_upload(file)
    doc = None

    try:
        doc = fitz.open(stream=data, filetype="pdf")

        if doc.needs_pass:
            raise HTTPException(
                status_code=400,
                detail="The PDF is password-protected. Unlock it first.",
            )

        if doc.page_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No recoverable pages were found.",
            )

        output = doc.tobytes(
            garbage=4,
            deflate=True,
            clean=True,
        )

        return pdf_response(output, "repaired.pdf")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not repair this PDF: {exc}",
        )
    finally:
        if doc is not None:
            doc.close()