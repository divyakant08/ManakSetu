from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from app.core.config import settings
from app.services.pdf_service import save_uploaded_file, list_documents, delete_document

router = APIRouter()


@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    """Upload one or more PDF documents."""
    uploaded = []
    errors = []
    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            errors.append(f"{file.filename}: Not a PDF file")
            continue
        try:
            name = await save_uploaded_file(file)
            uploaded.append(name)
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")

    return {
        "uploaded": uploaded,
        "errors": errors,
        "message": f"Successfully uploaded {len(uploaded)} file(s)",
    }


@router.get("/documents")
async def get_documents():
    """Return list of all stored PDF documents."""
    docs = list_documents()
    return {"documents": docs, "count": len(docs)}


def _safe_pdf_name(filename: str) -> str:
    return Path(filename).name


def _pdf_file_response(path: Path, filename: str) -> FileResponse:
    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="inline",
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/documents/{filename}/view")
async def view_document(filename: str):
    """Stream PDF document for interactive browser viewing (desktop + mobile)."""
    safe_name = _safe_pdf_name(filename)
    file_path = settings.STORED_DOCUMENTS_DIR / safe_name
    if file_path.exists() and file_path.is_file():
        return _pdf_file_response(file_path, safe_name)

    temp_path = settings.TEMP_UPLOADS_DIR / safe_name
    if temp_path.exists() and temp_path.is_file():
        return _pdf_file_response(temp_path, safe_name)

    raise HTTPException(status_code=404, detail=f"Document '{safe_name}' not found.")


@router.delete("/documents/{filename}")
async def remove_document(filename: str):
    """Delete a stored PDF document."""
    safe_name = _safe_pdf_name(filename)
    success = delete_document(safe_name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Document '{safe_name}' not found")
    return {"message": f"Document '{safe_name}' deleted successfully"}
