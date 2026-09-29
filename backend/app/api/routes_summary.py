from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.ai_engine import generate_ai_response
from app.services.rag_service import BROAD_MAX_CHARS, BROAD_TOP_K, retrieve_chunks

router = APIRouter()


class SummaryRequest(BaseModel):
    language: str = "English"
    selected_documents: Optional[list[str]] = None


LANGUAGE_INSTRUCTIONS = {
    "English": "Respond entirely in English.",
    "Hindi": "Respond entirely in Hindi (हिन्दी).",
    "Marathi": "Respond entirely in Marathi (मराठी).",
    "Gujarati": "Respond entirely in Gujarati (ગુજરાતી).",
    "Bengali": "Respond entirely in Bengali (বাংলা).",
    "Tamil": "Respond entirely in Tamil (தமிழ்).",
}


@router.post("/summary")
async def generate_summary(request: SummaryRequest):
    """Generate an executive compliance summary of selected official BIS documents."""
    combined_text, doc_names, _chunks = retrieve_chunks(
        "executive summary mandatory obligations testing certification applicability key clauses",
        request.selected_documents,
        top_k=BROAD_TOP_K,
        max_chars=BROAD_MAX_CHARS,
    )

    if not combined_text:
        raise HTTPException(
            status_code=400,
            detail="No matching official BIS standards found for the selected document scope.",
        )

    lang_instruction = LANGUAGE_INSTRUCTIONS.get(request.language, LANGUAGE_INSTRUCTIONS["English"])

    prompt = f"""You are a senior Bureau of Indian Standards (BIS) compliance expert.

{lang_instruction}

Generate a comprehensive **Executive Compliance Summary** for the following BIS standard document(s) only.

Structure your response in Markdown with EXACTLY these sections:

## Executive Summary
A brief 2-3 paragraph overview of the standard(s) scope and purpose.

## Key Metrics
- **Total Clauses Analyzed**: [count]
- **Mandatory Requirements**: [count]
- **High Risk Areas**: [count]
- **Compliance Score Estimate**: [percentage based on clarity and completeness]

## Key Obligations
Bulleted list of the most critical compliance obligations with clause references.

## High Risk Areas
Areas where non-compliance carries the highest legal or financial risk.

## Testing & Certification Requirements
Required tests, certifications, and laboratory standards.

## Applicability
Who this standard applies to (manufacturers, importers, sellers, etc.).

Documents analyzed: {', '.join(doc_names)}

--- BEGIN RETRIEVED CLAUSES ---
{combined_text}
--- END RETRIEVED CLAUSES ---

Provide a detailed, well-formatted executive summary:"""

    try:
        response = await generate_ai_response(prompt)
        return {"response": response, "documents_analyzed": doc_names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
