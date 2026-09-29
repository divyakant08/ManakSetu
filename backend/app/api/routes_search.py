from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.ai_engine import generate_ai_response, generate_ai_response_stream, sse_pack
from app.services.rag_service import retrieve_chunks

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    language: str = "English"
    stream: bool = True


LANGUAGE_INSTRUCTIONS = {
    "English": "Respond entirely in English.",
    "Hindi": "Respond entirely in Hindi (हिन्दी).",
    "Marathi": "Respond entirely in Marathi (मराठी).",
    "Gujarati": "Respond entirely in Gujarati (ગુજરાતી).",
    "Bengali": "Respond entirely in Bengali (বাংলা).",
    "Tamil": "Respond entirely in Tamil (தமிழ்).",
}


def build_search_prompt(request: SearchRequest, combined_text: str, doc_names: list[str]) -> str:
    lang_instruction = LANGUAGE_INSTRUCTIONS.get(request.language, LANGUAGE_INSTRUCTIONS["English"])
    return f"""You are a senior Bureau of Indian Standards (BIS) compliance expert and legal analyst.

{lang_instruction}

Based on the retrieved BIS standard clauses below, answer the user's compliance query thoroughly and accurately.

Provide your response in well-structured Markdown format with:
- Clear section headings
- Specific clause references (e.g., "As per Clause 5.2.1...")
- Bullet points for key requirements
- Bold text for critical obligations
- Any relevant penalties or consequences for non-compliance
- Citations using `[Doc: <Document_Name.pdf> | Page <Page_Number>]`

Documents analyzed: {', '.join(doc_names)}

--- BEGIN RETRIEVED CLAUSES ---
{combined_text}
--- END RETRIEVED CLAUSES ---

User Query: {request.query}

Provide a comprehensive, well-formatted response:"""


@router.post("/search")
async def search_compliance(request: SearchRequest):
    """Search across all uploaded documents for compliance information."""
    combined_text, doc_names, _chunks = retrieve_chunks(request.query)

    if not combined_text:
        raise HTTPException(
            status_code=400,
            detail="No documents uploaded. Please upload BIS standard PDFs first.",
        )

    prompt = build_search_prompt(request, combined_text, doc_names)

    if not request.stream:
        try:
            response = await generate_ai_response(prompt)
            return {"response": response, "documents_searched": doc_names}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def event_stream():
        yield sse_pack({
            "type": "meta",
            "documents_searched": doc_names,
            "search_type": "search",
        })
        assembled = []
        try:
            async for piece in generate_ai_response_stream(prompt):
                assembled.append(piece)
                yield sse_pack({"type": "delta", "text": piece})
            yield sse_pack({
                "type": "done",
                "response": "".join(assembled),
                "documents_searched": doc_names,
            })
        except Exception as e:
            yield sse_pack({"type": "error", "detail": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
