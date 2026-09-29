import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.ai_engine import generate_ai_response, generate_ai_response_stream, sse_pack
from app.core.config import settings
from app.services.rag_service import retrieve_chunks

router = APIRouter()

LANGUAGE_INSTRUCTIONS = {
    "English": "Respond entirely in English.",
    "Hindi": "Respond entirely in Hindi (हिन्दी).",
    "Marathi": "Respond entirely in Marathi (मराठी).",
    "Gujarati": "Respond entirely in Gujarati (ગુજરાતી).",
    "Bengali": "Respond entirely in Bengali (বাংলা).",
    "Tamil": "Respond entirely in Tamil (தமிழ்).",
}


def build_custom_prompt(filename: str, query: str, language: str, combined_text: str) -> str:
    lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["English"])
    return f"""You are a Bureau of Indian Standards (BIS) and International Technical Standards Compliance Specialist.

{lang_instruction}

The user has uploaded a custom technical/regulatory document: `{filename}`.
Analyze the retrieved clauses from this document and answer the user's specific query.

CRITICAL INSTRUCTIONS:
- Reference specific pages using syntax `[Doc: {filename} | Page X]` so the reader can jump directly to the relevant clause.
- Highlight key regulatory compliance requirements, testing parameters, and obligations.
- If the document references BIS standards (IS numbers) or international equivalents (ISO/IEC/ASTM), identify them clearly.
- Use ONLY the retrieved clauses below. Do not invent page numbers.

--- BEGIN RETRIEVED CLAUSES ({filename}) ---
{combined_text}
--- END RETRIEVED CLAUSES ---

User Query: {query}

Provide a comprehensive, well-structured compliance answer:"""


@router.post("/search/custom")
async def custom_document_search(
    file: UploadFile = File(...),
    query: str = Form(...),
    language: str = Form("English"),
    stream: str = Form("true"),
):
    """Analyze a custom ad-hoc PDF upload and answer compliance queries against it."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for custom analysis.")

    temp_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    temp_path = settings.TEMP_UPLOADS_DIR / temp_filename
    should_stream = str(stream).lower() not in {"false", "0", "no"}

    try:
        contents = await file.read()
        with open(temp_path, "wb") as handle:
            handle.write(contents)

        combined_text, doc_names, _chunks = retrieve_chunks(
            query,
            file_map={file.filename: Path(temp_path)},
        )
        if not combined_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not extract readable text from the uploaded PDF. It might be scanned without OCR or protected.",
            )

        prompt = build_custom_prompt(file.filename, query, language, combined_text)
        payload_meta = {
            "filename": file.filename,
            "temp_file": temp_filename,
            "documents_searched": doc_names or [file.filename],
        }

        if not should_stream:
            response = await generate_ai_response(prompt)
            return {
                "response": response,
                "filename": file.filename,
                "temp_file": temp_filename,
                "status": "success",
            }

        async def event_stream():
            yield sse_pack({"type": "meta", **payload_meta, "search_type": "custom_search"})
            assembled = []
            try:
                async for piece in generate_ai_response_stream(prompt):
                    assembled.append(piece)
                    yield sse_pack({"type": "delta", "text": piece})
                yield sse_pack({
                    "type": "done",
                    "response": "".join(assembled),
                    **payload_meta,
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Custom search failed: {str(e)}")
