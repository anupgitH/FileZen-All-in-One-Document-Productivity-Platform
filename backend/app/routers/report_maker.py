from io import BytesIO
from datetime import date
from xml.sax.saxutils import escape

from fastapi import APIRouter
from fastapi import HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    HRFlowable,
)

router = APIRouter(
    prefix="/api/reports",
    tags=["Report Maker"],
)


class ReportRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(default="User", max_length=100)
    organization: str = Field(default="", max_length=200)
    report_type: str = Field(default="Project Report", max_length=100)
    abstract: str = Field(default="", max_length=5000)
    introduction: str = Field(default="", max_length=10000)
    objectives: str = Field(default="", max_length=5000)
    methodology: str = Field(default="", max_length=10000)
    results: str = Field(default="", max_length=10000)
    conclusion: str = Field(default="", max_length=10000)


@router.post("/generate")
def generate_report(payload: ReportRequest):
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=payload.title,
        author=payload.author,
    )

    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            fontSize=24,
            leading=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#17365D"),
            spaceAfter=20,
        )
    )

    story = []

    story.append(Spacer(1, 1.5 * inch))
    story.append(
        Paragraph(escape(payload.title), styles["ReportTitle"])
    )
    story.append(
        Paragraph(
            escape(payload.report_type),
            styles["Heading2"],
        )
    )
    story.append(Spacer(1, 0.3 * inch))

    if payload.organization.strip():
        story.append(
            Paragraph(
                escape(payload.organization),
                styles["Normal"],
            )
        )

    story.append(
        Paragraph(
            f"Prepared by: {escape(payload.author)}",
            styles["Normal"],
        )
    )
    story.append(
        Paragraph(
            f"Date: {date.today().strftime('%d %B %Y')}",
            styles["Normal"],
        )
    )

    story.append(Spacer(1, 1.0 * inch))
    story.append(HRFlowable(width="100%", thickness=1))
    story.append(Spacer(1, 0.3 * inch))

    sections = [
        ("Abstract", payload.abstract),
        ("Introduction", payload.introduction),
        ("Objectives", payload.objectives),
        ("Methodology", payload.methodology),
        ("Results and Discussion", payload.results),
        ("Conclusion", payload.conclusion),
    ]

    for heading, content in sections:
        if content.strip():
            story.append(
                Paragraph(escape(heading), styles["Heading1"])
            )
            story.append(Spacer(1, 0.1 * inch))

            paragraphs = content.split("\n")

            for paragraph in paragraphs:
                if paragraph.strip():
                    story.append(
                        Paragraph(
                            escape(paragraph),
                            styles["BodyText"],
                        )
                    )
                    story.append(Spacer(1, 0.12 * inch))

    try:
        doc.build(story)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate the report PDF.",
        ) from exc

    pdf = buffer.getvalue()
    buffer.close()

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="filezen-report.pdf"',
            "Cache-Control": "no-store",
        },
    )