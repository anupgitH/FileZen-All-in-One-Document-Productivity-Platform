
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ==================================================
# Existing FileZen Routers
# ==================================================

from app.routers.pdf_tools import router as pdf_router
from app.routers.converter import router as converter_router
from app.routers.word_converter import router as word_router
from app.routers.extra_tools import router as extra_tools_router
from app.routers.document_tools import router as document_tools_router

# ==================================================
# Advanced PDF and Document Tools
# ==================================================

from app.routers.advanced_pdf import router as advanced_pdf_router
from app.routers.advanced_document_tools import (
    router as advanced_document_tools_router,
)

# ==================================================
# Storage and Productivity Tools
# ==================================================

from app.routers.local_storage import router as local_storage_router
from app.routers.resume import router as resume_router
from app.routers.report_maker import router as report_maker_router
from app.routers.image_compressor import (
    router as image_compressor_router,
)

# ==================================================
# Gemini AI PDF Chat
# Endpoint: POST /api/ai/chat-with-pdf
# ==================================================

from app.routers.gemini_pdf import router as gemini_pdf_router

# ==================================================
# FastAPI Application
# ==================================================

app = FastAPI(
    title="FileZen API",
    description=(
        "FileZen document platform with file conversion, "
        "PDF and document tools, local storage, resume building, "
        "image compression, report generation, and Gemini AI PDF chat."
    ),
    version="1.3.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ==================================================
# CORS Configuration
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# Register All Routers
# ==================================================

routers = [
    pdf_router,
    converter_router,
    word_router,
    extra_tools_router,
    document_tools_router,
    advanced_pdf_router,
    advanced_document_tools_router,
    local_storage_router,
    resume_router,
    report_maker_router,
    image_compressor_router,
    gemini_pdf_router,
]

for router in routers:
    app.include_router(router)

# ==================================================
# Root Endpoint
# ==================================================

@app.get("/", tags=["General"])
def home():
    return {
        "app": "FileZen API",
        "message": "Convert files. Keep it simple!",
        "status": "running",
        "version": app.version,
        "docs": "/docs",
    }

# ==================================================
# Health Check
# ==================================================

@app.get("/api/health", tags=["General"])
def health():
    return {
        "status": "healthy",
        "app": "FileZen API",
        "version": app.version,
    }
