
from io import BytesIO

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pypdf import PdfReader, PdfWriter
from PIL import Image, UnidentifiedImageError

router = APIRouter(prefix="/api/pdf", tags=["PDF Tools"])

MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_TOTAL_IMAGE_SIZE = 30 * 1024 * 1024
MAX_IMAGES = 20


async def read_pdf(file: UploadFile) -> BytesIO:
    data = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if not data:
        raise HTTPException(400, "Please upload a PDF file")

    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(413, "Maximum PDF size is 20 MB")

    if not data.startswith(b"%PDF-"):
        raise HTTPException(400, "The uploaded file is not a PDF")

    return BytesIO(data)


@router.post("/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(400, "Upload at least two PDF files")

    writer = PdfWriter()

    try:
        for file in files:
            pdf_data = await read_pdf(file)
            reader = PdfReader(pdf_data, strict=True)

            if reader.is_encrypted:
                raise HTTPException(
                    400, "Encrypted PDFs are not supported"
                )

            for page in reader.pages:
                writer.add_page(page)

        output = BytesIO()
        writer.write(output)
        output.seek(0)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Unable to merge these PDF files")

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="filezen-merged.pdf"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/split/{page_number}")
async def split_pdf(
    page_number: int,
    file: UploadFile = File(...),
):
    pdf_data = await read_pdf(file)

    try:
        reader = PdfReader(pdf_data, strict=True)

        if reader.is_encrypted:
            raise HTTPException(
                400, "Encrypted PDFs are not supported"
            )

        if page_number < 1 or page_number > len(reader.pages):
            raise HTTPException(
                400,
                f"Page number must be between 1 and {len(reader.pages)}",
            )

        writer = PdfWriter()
        writer.add_page(reader.pages[page_number - 1])

        output = BytesIO()
        writer.write(output)
        output.seek(0)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Unable to split this PDF")

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="filezen-page.pdf"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/image-to-pdf")
async def images_to_pdf(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(400, "Please upload at least one image")

    if len(files) > MAX_IMAGES:
        raise HTTPException(
            400, f"Maximum {MAX_IMAGES} images per PDF"
        )

    allowed_extensions = (".jpg", ".jpeg", ".png")
    total_size = 0
    images = []

    try:
        for file in files:
            filename = (file.filename or "").lower()

            if not filename.endswith(allowed_extensions):
                raise HTTPException(
                    400, "Only JPG, JPEG and PNG images are supported"
                )

            data = await file.read(MAX_IMAGE_SIZE + 1)
            await file.close()

            if not data:
                raise HTTPException(400, "An uploaded image is empty")

            if len(data) > MAX_IMAGE_SIZE:
                raise HTTPException(
                    413, "Each image must be 10 MB or smaller"
                )

            total_size += len(data)

            if total_size > MAX_TOTAL_IMAGE_SIZE:
                raise HTTPException(
                    413, "Total image size must be 30 MB or smaller"
                )

            try:
                with Image.open(BytesIO(data)) as source:
                    source.verify()

                with Image.open(BytesIO(data)) as source:
                    source.load()
                    images.append(source.convert("RGB"))

            except (UnidentifiedImageError, OSError, ValueError):
                raise HTTPException(
                    400, f"Invalid or unreadable image: {filename}"
                )

        output = BytesIO()
        images[0].save(
            output,
            format="PDF",
            save_all=True,
            append_images=images[1:],
            resolution=150,
        )
        output.seek(0)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            400, "Unable to convert the uploaded images"
        )
    finally:
        for image in images:
            image.close()

        for file in files:
            await file.close()

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="filezen-images.pdf"',
            "Cache-Control": "no-store",
        },
    )
