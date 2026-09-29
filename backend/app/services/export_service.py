import io
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Footer
        footer_text = f"ManakSetu — Page {self._pageNumber} of {page_count}"
        self.drawCentredString(letter[0] / 2.0, 30, footer_text)
        
        # Bottom rule
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(40, 45, letter[0] - 40, 45)
        self.restoreState()


def generate_compliance_pdf(title: str, content: str, doc_names: list[str] = None, metadata: dict = None) -> bytes:
    """Generate a high-grade compliance audit PDF report."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=40,
        bottomMargin=55,
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    header_title_style = ParagraphStyle(
        'DocHeaderTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0B2545'),
    )
    
    sub_title_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#D4AF37'),
    )
    
    section_h1 = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#0B2545'),
        spaceBefore=14,
        spaceAfter=6,
    )

    section_h2 = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#13315C'),
        spaceBefore=10,
        spaceAfter=4,
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=6,
    )
    
    bullet_style = ParagraphStyle(
        'BulletDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        leftIndent=15,
        spaceAfter=3,
    )

    story = []

    # Portal Header Block
    story.append(Paragraph("BUREAU OF INDIAN STANDARDS (BIS)", sub_title_style))
    story.append(Paragraph(f"<b>{title.upper()}</b>", header_title_style))
    story.append(Paragraph("AI-Powered Statutory Compliance Audit & Assessment", ParagraphStyle(
        'SubSub', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=9, textColor=colors.HexColor('#64748b')
    )))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#D4AF37"), spaceBefore=2, spaceAfter=10))

    # Metadata table
    docs_str = ", ".join(doc_names) if doc_names else "All Active Standards"
    meta_data = [
        [Paragraph("<b>Target Standards:</b>", body_style), Paragraph(docs_str, body_style)],
        [Paragraph("<b>Audit Engine:</b>", body_style), Paragraph("Gemini Intelligence Multi-Standard Analyzer", body_style)],
        [Paragraph("<b>Classification:</b>", body_style), Paragraph("Official Regulatory Intelligence Digest", body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[120, 410])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # Parse content lines
    lines = content.split("\n")
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            story.append(Spacer(1, 4))
            continue
        
        # Clean markdown headers
        if line.startswith("## "):
            h_text = line.replace("## ", "").strip()
            # Remove emojis for cleaner PDF rendering
            clean_h = "".join([c for c in h_text if ord(c) < 65536])
            story.append(Paragraph(clean_h, section_h1))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=2, spaceAfter=6))
        elif line.startswith("### "):
            h_text = line.replace("### ", "").strip()
            clean_h = "".join([c for c in h_text if ord(c) < 65536])
            story.append(Paragraph(clean_h, section_h2))
        elif line.startswith("# "):
            h_text = line.replace("# ", "").strip()
            clean_h = "".join([c for c in h_text if ord(c) < 65536])
            story.append(Paragraph(clean_h, section_h1))
        elif line.startswith("- ") or line.startswith("* "):
            bullet_text = line[2:].strip()
            # Convert markdown bold to html bold
            bullet_text = bullet_text.replace("**", "<b>", 1)
            while "**" in bullet_text:
                bullet_text = bullet_text.replace("**", "</b>", 1)
            story.append(Paragraph(f"• {bullet_text}", bullet_style))
        else:
            p_text = line
            p_text = p_text.replace("**", "<b>", 1)
            while "**" in p_text:
                p_text = p_text.replace("**", "</b>", 1)
            story.append(Paragraph(p_text, body_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()


def generate_compliance_excel(title: str, content: str, doc_names: list[str] = None) -> bytes:
    """Generate a structured compliance audit workbook."""
    output = io.BytesIO()

    # Extract bullet points, sections, and structured rows from markdown content
    sections = []
    current_section = "General Findings"
    rows = []

    lines = content.split("\n")
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("## ") or line.startswith("# "):
            current_section = line.lstrip("#").strip()
        elif line.startswith("- ") or line.startswith("* "):
            point = line.lstrip("-*").strip()
            rows.append({
                "Section": current_section,
                "Compliance Item / Finding": point,
                "Applicable Standards": ", ".join(doc_names) if doc_names else "General",
                "Review Status": "Extracted & Verified",
            })
        elif ":" in line and len(line) < 200:
            parts = line.split(":", 1)
            rows.append({
                "Section": current_section,
                "Compliance Item / Finding": f"{parts[0].strip()}: {parts[1].strip()}",
                "Applicable Standards": ", ".join(doc_names) if doc_names else "General",
                "Review Status": "Key Attribute",
            })

    if not rows:
        rows.append({
            "Section": "Summary",
            "Compliance Item / Finding": content[:1000],
            "Applicable Standards": ", ".join(doc_names) if doc_names else "General",
            "Review Status": "Complete",
        })

    df_findings = pd.DataFrame(rows)

    summary_df = pd.DataFrame([
        {"Metric": "Audit Report Title", "Value": title},
        {"Metric": "Standards Included", "Value": ", ".join(doc_names) if doc_names else "All Active"},
        {"Metric": "Total Audit Items", "Value": len(rows)},
        {"Metric": "Compliance Framework", "Value": "Bureau of Indian Standards (BIS) Act & Regulations"},
        {"Metric": "Export Timestamp", "Value": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")},
    ])

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        summary_df.to_excel(writer, sheet_name="Audit Summary", index=False)
        df_findings.to_excel(writer, sheet_name="Compliance Checklist", index=False)

    output.seek(0)
    return output.getvalue()
