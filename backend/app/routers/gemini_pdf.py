
import os
import time

from dotenv import load_dotenv
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from google import genai
from google.genai import types

load_dotenv()

router = APIRouter(
    prefix="/api/ai",
    tags=["Gemini AI PDF Chat"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MAX_PDF_SIZE = 20 * 1024 * 1024  # 20 MB
MAX_RETRIES = 3

client = (
    genai.Client(api_key=GEMINI_API_KEY)
    if GEMINI_API_KEY
    else None
)


@router.post("/chat-with-pdf")
async def chat_with_pdf(
    file: UploadFile = File(...),
    question: str = Form(...),
):
    """Answer questions about an uploaded PDF using Gemini."""

    try:
        if client is None:
            raise HTTPException(
                status_code=500,
                detail="GEMINI_API_KEY is missing from backend/.env",
            )

        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Please upload a PDF file.",
            )

        question = question.strip()
        if not question:
            raise HTTPException(
                status_code=400,
                detail="Please enter a question.",
            )

        pdf_bytes = await file.read()

        if not pdf_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded PDF is empty.",
            )

        if len(pdf_bytes) > MAX_PDF_SIZE:
            raise HTTPException(
                status_code=413,
                detail="PDF must be 20 MB or smaller.",
            )

        contents = [
            types.Part.from_bytes(
                data=pdf_bytes,
                mime_type="application/pdf",
            ),
            (
                "You are FileZen's AI PDF assistant. Answer using "
                "the uploaded document. Be clear and accurate. Do not "
                "invent unsupported facts. If the document does not "
                "contain the answer, say so.\n\n"
                f"Question: {question}"
            ),
        ]

        response = None

        for attempt in range(MAX_RETRIES):
            try:
                response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=contents,
                )
                break

            except Exception as exc:
                error_text = str(exc).upper()
                temporary_error = any(
                    marker in error_text
                    for marker in (
                        "503",
                        "UNAVAILABLE",
                        "429",
                        "RESOURCE_EXHAUSTED",
                        "500",
                        "INTERNAL",
                    )
                )

                if not temporary_error:
                    raise

                if attempt == MAX_RETRIES - 1:
                    raise HTTPException(
                        status_code=503,
                        detail=(
                            "Gemini is temporarily unavailable or busy. "
                            "Please try again shortly."
                        ),
                    ) from exc

                time.sleep(2 ** (attempt + 1))

        answer = response.text if response else None

        if not answer:
            raise HTTPException(
                status_code=502,
                detail="Gemini returned an empty response.",
            )

        return {
            "success": True,
            "filename": file.filename,
            "question": question,
            "answer": answer,
            "model": GEMINI_MODEL,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(f"Gemini PDF chat error: {exc}")

        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini could not process the PDF. "
                "Check the backend terminal for details."
            ),
        ) from exc

    finally:
        await file.close()
