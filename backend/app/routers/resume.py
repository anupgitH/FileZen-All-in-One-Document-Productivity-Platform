import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/resume", tags=["Resume Builder"])

MAX_SOURCE_BYTES = 100_000
COMPILE_TIMEOUT_SECONDS = 120

FORBIDDEN_TEX = re.compile(
    r"\\(?:write18|immediate|input|include|openin|openout|read|"
    r"directlua|latelua)\b",
    re.IGNORECASE,
)


class CompileRequest(BaseModel):
    source: str = Field(min_length=1, max_length=100_000)


@router.post("/compile")
def compile_resume(payload: CompileRequest):
    source = payload.source

    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="LaTeX source is too large.",
        )

    if (
        "\\documentclass" not in source
        or "\\begin{document}" not in source
        or "\\end{document}" not in source
    ):
        raise HTTPException(
            status_code=400,
            detail="Provide a complete LaTeX document.",
        )

    if FORBIDDEN_TEX.search(source):
        raise HTTPException(
            status_code=400,
            detail="This LaTeX source uses a restricted command.",
        )

    compiler = shutil.which("tectonic")

    if not compiler:
        raise HTTPException(
            status_code=503,
            detail="Tectonic is not installed or is not on the backend PATH.",
        )

    with tempfile.TemporaryDirectory(prefix="filezen-resume-") as temp:
        workdir = Path(temp)
        tex_file = workdir / "resume.tex"
        pdf_file = workdir / "resume.pdf"
        tex_file.write_text(source, encoding="utf-8")

        env = os.environ.copy()
        env.pop("TEXINPUTS", None)
        env.pop("TEXMFHOME", None)
        env.pop("TEXMFCONFIG", None)

        try:
            result = subprocess.run(
                [
                    compiler,
                    "--untrusted",
                    "--keep-logs",
                    "--outdir",
                    str(workdir),
                    str(tex_file),
                ],
                cwd=workdir,
                env=env,
                capture_output=True,
                text=True,
                timeout=COMPILE_TIMEOUT_SECONDS,
                check=False,
            )

        except subprocess.TimeoutExpired as exc:
            print(
                f"Resume compilation exceeded "
                f"{COMPILE_TIMEOUT_SECONDS} seconds."
            )
            raise HTTPException(
                status_code=408,
                detail="LaTeX compilation timed out. Check compiler logs and try again.",
            ) from exc

        if result.returncode != 0 or not pdf_file.is_file():
            log = (
                (result.stderr or "")
                + "\n"
                + (result.stdout or "")
            )[-4000:]

            print("Resume compilation failed:", log)

            raise HTTPException(
                status_code=422,
                detail=f"LaTeX compilation failed:\n{log}",
            )

        pdf_bytes = pdf_file.read_bytes()

        if not pdf_bytes.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=500,
                detail="Compiler did not produce a valid PDF.",
            )

        if len(pdf_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Generated PDF exceeds the 10 MB limit.",
            )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="resume.pdf"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )