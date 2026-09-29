from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.ai_engine import generate_ai_response
from app.services.rag_service import BROAD_MAX_CHARS, BROAD_TOP_K, retrieve_chunks

router = APIRouter()


class PenaltiesRequest(BaseModel):
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


@router.post("/penalties")
async def extract_penalties(request: PenaltiesRequest):
    """Extract penalties, legal obligations, and compliance risk assessment."""
    combined_text, doc_names, _chunks = retrieve_chunks(
        "penalties imprisonment fine offence seizure compounding BIS Act Section 29 30 non-compliance liability",
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

    prompt = f"""You are a senior legal analyst specializing in Bureau of Indian Standards (BIS) Act, Rules, and Regulations.

{lang_instruction}

Analyze the following BIS standard document(s) and extract ALL legal penalties, obligations, and compliance risks.

Structure your response in Markdown with EXACTLY these sections:

## ⚖️ Legal Framework
Overview of the governing act/rules (BIS Act 2016, relevant rules, etc.)

## 🚨 Penal Clauses
For each penalty found, provide:
- **Clause Reference**: Specific section/clause number
- **Offence**: Description of the violation
- **Fine Range**: Minimum to maximum monetary penalty
- **Imprisonment**: Duration if applicable
- **Severity**: 🔴 HIGH / 🟡 MEDIUM / 🟢 LOW

## 📋 Mandatory Compliance Obligations
List all mandatory requirements with their clause references and consequences of non-compliance.

## 🎯 Compliance Risk Score
Provide an overall risk assessment:
- **Overall Risk Level**: HIGH / MEDIUM / LOW
- **Risk Score**: X/100
- **Critical Non-Compliance Areas**: List the top 3 areas

## 📌 Compliance Checklist
A checklist of key compliance items manufacturers/importers must verify.

## 💡 Recommendations
Practical steps to achieve and maintain compliance.

Documents analyzed: {', '.join(doc_names)}

--- BEGIN RETRIEVED CLAUSES ---
{combined_text}
--- END RETRIEVED CLAUSES ---

Provide a thorough legal analysis:"""

    try:
        response = await generate_ai_response(prompt)
        return {"response": response, "documents_analyzed": doc_names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
