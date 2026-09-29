import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.ai_engine import generate_ai_response
from app.services.rag_service import BROAD_MAX_CHARS, BROAD_TOP_K, retrieve_chunks

router = APIRouter()


class GapAnalysisRequest(BaseModel):
    specs: str
    standard_hint: Optional[str] = None
    language: str = "English"


LANGUAGE_INSTRUCTIONS = {
    "English": "Respond entirely in English.",
    "Hindi": "Respond entirely in Hindi (हिन्दी).",
    "Marathi": "Respond entirely in Marathi (मराठी).",
    "Gujarati": "Respond entirely in Gujarati (ગુજરાતી).",
    "Bengali": "Respond entirely in Bengali (বাংলা).",
    "Tamil": "Respond entirely in Tamil (தமிழ்).",
}


@router.post("/gap-analysis")
async def run_predictive_gap_analysis(request: GapAnalysisRequest):
    """Evaluate product technical specifications against indexed BIS standard limits.
    
    Performs predictive gap analysis and returns parameter-by-parameter PASS/WARNING/FAIL status.
    """
    if not request.specs or not request.specs.strip():
        raise HTTPException(status_code=400, detail="Technical specifications input cannot be empty.")

    retrieval_query = " ".join(
        part for part in [request.specs, request.standard_hint or ""] if part
    )
    combined_text, doc_names, _chunks = retrieve_chunks(
        retrieval_query,
        top_k=BROAD_TOP_K,
        max_chars=BROAD_MAX_CHARS,
    )

    if not combined_text or not doc_names:
        raise HTTPException(
            status_code=400,
            detail="No standards loaded in the repository. Please ensure stored_documents contains BIS PDF files.",
        )

    lang_instruction = LANGUAGE_INSTRUCTIONS.get(request.language, LANGUAGE_INSTRUCTIONS["English"])

    prompt = f"""You are a Bureau of Indian Standards (BIS) Senior Technical Auditor & Product Certification Engineer.

{lang_instruction}

TASK: Perform a rigorous, predictive Compliance Gap Analysis by evaluating the user's Technical Specifications against the official BIS Standards loaded below.

--- BEGIN RETRIEVED CLAUSES ---
{combined_text}
--- END RETRIEVED CLAUSES ---

USER PRODUCT TECHNICAL SPECIFICATIONS:
\"\"\"
{request.specs}
\"\"\"

Optional Standard Context Hint: {request.standard_hint or "Auto-match against all repository standards"}

INSTRUCTIONS:
1. Parse every technical parameter from the user's input (e.g., Voltage, Material, Temperature, pH, TDS, Microbial count, Dimensions, Thickness, Tensile strength, Marking, Shelf life, etc.).
2. For each parameter, find the mandatory requirement / limit specified in the relevant BIS standard (e.g. IS 14543, IS 13252, IS 1786, IS 694, etc.).
3. Determine the status for each parameter:
   - "PASS": User value satisfies the BIS standard requirement/tolerance.
   - "WARNING": Borderline value, advisory requirement, missing tolerance data, or requires specific laboratory batch testing.
   - "FAIL": User value directly violates or exceeds the BIS standard limit.
4. Calculate an overall compliance score (0 to 100), overall status ("COMPLIANT", "NON_COMPLIANT", or "NEEDS_REVIEW"), and brief executive summary with key risks and remedies.

You MUST respond ONLY with a valid, parseable JSON object matching this EXACT schema (do not wrap with any other text, no markdown backticks):
{{
    "overall_status": "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW",
    "compliance_score": 85,
    "summary": "Executive summary of the gap analysis findings...",
    "critical_failures_count": 1,
    "warnings_count": 1,
    "passed_count": 3,
    "applicable_standard": "IS 14543:2004",
    "parameters": [
        {{
            "parameter": "Total Dissolved Solids (TDS)",
            "user_value": "600 mg/L",
            "bis_limit": "Max 500 mg/L (Clause 4.2 Table 1)",
            "status": "FAIL",
            "clause": "IS 14543:2004 Table 1 Clause 4.2",
            "observation": "Input value of 600 mg/L exceeds the statutory maximum limit of 500 mg/L.",
            "remedy": "Adjust RO membrane filtration or blending stage to reduce TDS below 500 mg/L."
        }},
        {{
            "parameter": "pH Value",
            "user_value": "7.2",
            "bis_limit": "6.5 - 8.5",
            "status": "PASS",
            "clause": "IS 14543:2004 Table 1",
            "observation": "pH 7.2 falls comfortably within the acceptable range of 6.5 to 8.5.",
            "remedy": "Maintain current remineralization dosing."
        }}
    ]
}}
"""

    try:
        raw_response = await generate_ai_response(prompt)
        cleaned = raw_response.strip()
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'\s*```$', '', cleaned)

        # Parse JSON
        parsed_data = json.loads(cleaned)
        parsed_data["documents_evaluated"] = doc_names
        return parsed_data

    except json.JSONDecodeError:
        # Fallback if model included formatting artifacts
        return {
            "overall_status": "NEEDS_REVIEW",
            "compliance_score": 50,
            "summary": "Gap analysis completed with raw text output.",
            "critical_failures_count": 0,
            "warnings_count": 1,
            "passed_count": 0,
            "applicable_standard": doc_names[0] if doc_names else "BIS Standard",
            "parameters": [
                {
                    "parameter": "Technical Review",
                    "user_value": request.specs[:80] + "...",
                    "bis_limit": "Refer to official standard clauses",
                    "status": "WARNING",
                    "clause": "BIS Repository",
                    "observation": raw_response[:300],
                    "remedy": "Conduct detailed manual laboratory evaluation.",
                }
            ],
            "documents_evaluated": doc_names,
            "raw_text": raw_response,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gap analysis error: {str(e)}")
