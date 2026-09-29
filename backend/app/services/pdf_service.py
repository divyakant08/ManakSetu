import os
from fastapi import UploadFile
from app.core.config import settings

MAX_COMBINED_TEXT_LENGTH = 500_000  # ~500K chars cap


async def save_uploaded_file(file: UploadFile) -> str:
    """Save an uploaded PDF file to the stored_documents directory."""
    file_path = settings.STORED_DOCUMENTS_DIR / file.filename
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    from app.services.rag_service import invalidate_document, index_document
    invalidate_document(file.filename)
    index_document(file.filename)
    return file.filename


def list_documents() -> list[str]:
    """Return a list of all stored PDF document filenames."""
    if not settings.STORED_DOCUMENTS_DIR.exists():
        return []
    return [
        f.name
        for f in settings.STORED_DOCUMENTS_DIR.iterdir()
        if f.is_file() and f.suffix.lower() == ".pdf"
    ]


def delete_document(filename: str) -> bool:
    """Delete a document from stored_documents. Returns True if successful."""
    file_path = settings.STORED_DOCUMENTS_DIR / filename
    if file_path.exists() and file_path.is_file():
        os.remove(file_path)
        from app.services.rag_service import invalidate_document
        invalidate_document(filename)
        return True
    return False


def extract_text_from_all_pdfs(selected_documents: list[str] | None = None) -> tuple[str, list[str]]:
    """Extract text from stored BIS PDFs with document/page markers.

    If selected_documents is provided and is not empty / ALL, only those files
    are extracted. Otherwise every PDF in stored_documents is used.
    """
    available = list_documents()
    if not available:
        return "", []

    if selected_documents:
        normalized = [name for name in selected_documents if name and name.upper() != "ALL"]
        if normalized:
            documents = [name for name in available if name in normalized]
        else:
            documents = available
    else:
        documents = available

    if not documents:
        return "", []

    from app.services.rag_service import get_corpus_text
    return get_corpus_text(documents, max_chars=MAX_COMBINED_TEXT_LENGTH)
