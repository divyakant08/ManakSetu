import json
import re
from pathlib import Path

import pymupdf as fitz

from app.core.config import settings
from app.services.pdf_service import list_documents

CHUNK_SIZE = 1100
CHUNK_OVERLAP = 180
DEFAULT_TOP_K = 5
MAX_CONTEXT_CHARS = 16_000
BROAD_TOP_K = 8
BROAD_MAX_CHARS = 24_000

_TOKEN_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._-]{1,}", re.UNICODE)
_CLAUSE_RE = re.compile(r"\b(?:clause|section|table|annex(?:ure)?)\s*[\dA-Z.]+", re.IGNORECASE)

_memory_index: dict[str, dict] = {}


def _cache_dir() -> Path:
    path = Path(__file__).resolve().parent.parent.parent / ".rag_cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _cache_path(doc_name: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "_", doc_name)
    return _cache_dir() / f"{safe}.json"


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in _TOKEN_RE.findall(text or "")]


def _split_windows(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    cleaned = re.sub(r"\n{3,}", "\n\n", (text or "").strip())
    if not cleaned:
        return []
    if len(cleaned) <= size:
        return [cleaned]

    windows: list[str] = []
    start = 0
    length = len(cleaned)
    while start < length:
        end = min(start + size, length)
        if end < length:
            break_at = cleaned.rfind("\n", start + size // 2, end)
            if break_at > start:
                end = break_at
        piece = cleaned[start:end].strip()
        if piece:
            windows.append(piece)
        if end >= length:
            break
        start = max(end - overlap, start + 1)
    return windows


def _extract_pages(doc_path: Path) -> list[tuple[int, str]]:
    pages: list[tuple[int, str]] = []
    pdf = fitz.open(str(doc_path))
    try:
        for page_num in range(len(pdf)):
            text = pdf[page_num].get_text("text") or ""
            if text.strip():
                pages.append((page_num + 1, text))
    finally:
        pdf.close()
    return pages


def _build_chunks(doc_name: str, pages: list[tuple[int, str]]) -> list[dict]:
    chunks: list[dict] = []
    for page_num, text in pages:
        for window in _split_windows(text):
            tokens = tokenize(window)
            if not tokens:
                continue
            chunks.append(
                {
                    "doc": doc_name,
                    "page": page_num,
                    "text": window,
                    "tokens": tokens,
                }
            )
    return chunks


def invalidate_document(doc_name: str | None = None) -> None:
    if doc_name:
        _memory_index.pop(doc_name, None)
        cache_file = _cache_path(doc_name)
        if cache_file.exists():
            cache_file.unlink()
        return
    _memory_index.clear()
    cache_dir = _cache_dir()
    for item in cache_dir.glob("*.json"):
        item.unlink()


def _load_disk_cache(doc_name: str, mtime: float, size: int) -> list[dict] | None:
    cache_file = _cache_path(doc_name)
    if not cache_file.exists():
        return None
    try:
        payload = json.loads(cache_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if payload.get("mtime") != mtime or payload.get("size") != size:
        return None
    chunks = payload.get("chunks")
    return chunks if isinstance(chunks, list) else None


def _save_disk_cache(doc_name: str, mtime: float, size: int, chunks: list[dict]) -> None:
    payload = {"mtime": mtime, "size": size, "chunks": chunks}
    try:
        _cache_path(doc_name).write_text(json.dumps(payload), encoding="utf-8")
    except OSError:
        pass


def index_document(doc_name: str, file_path: Path | None = None) -> list[dict]:
    path = file_path or (settings.STORED_DOCUMENTS_DIR / doc_name)
    if not path.exists() or not path.is_file():
        return []

    stat = path.stat()
    cached = _memory_index.get(doc_name)
    if cached and cached.get("mtime") == stat.st_mtime and cached.get("size") == stat.st_size:
        return cached["chunks"]

    disk_chunks = _load_disk_cache(doc_name, stat.st_mtime, stat.st_size)
    if disk_chunks is not None:
        _memory_index[doc_name] = {
            "mtime": stat.st_mtime,
            "size": stat.st_size,
            "chunks": disk_chunks,
        }
        return disk_chunks

    pages = _extract_pages(path)
    chunks = _build_chunks(doc_name, pages)
    _memory_index[doc_name] = {
        "mtime": stat.st_mtime,
        "size": stat.st_size,
        "chunks": chunks,
    }
    _save_disk_cache(doc_name, stat.st_mtime, stat.st_size, chunks)
    return chunks


def resolve_documents(selected_documents: list[str] | None = None) -> list[str]:
    available = list_documents()
    if not available:
        return []
    if not selected_documents:
        return available
    normalized = [name for name in selected_documents if name and str(name).upper() != "ALL"]
    if not normalized:
        return available
    selected = set(normalized)
    return [name for name in available if name in selected]


def _score_chunk(query: str, query_tokens: set[str], chunk: dict) -> float:
    chunk_tokens = set(chunk.get("tokens") or [])
    if not chunk_tokens:
        return 0.0
    overlap = query_tokens & chunk_tokens
    score = float(len(overlap))
    text = chunk.get("text") or ""
    lowered = text.lower()
    for token in query_tokens:
        if len(token) >= 4 and token in lowered:
            score += 0.35
    if _CLAUSE_RE.search(text):
        score += 1.5
    phrase = re.sub(r"\s+", " ", query.strip().lower())[:80]
    if phrase and phrase in lowered:
        score += 4.0
    doc_stem = Path(chunk.get("doc") or "").stem.lower()
    for token in query_tokens:
        if token in doc_stem:
            score += 0.75
    return score


def retrieve_chunks(
    query: str,
    selected_documents: list[str] | None = None,
    top_k: int = DEFAULT_TOP_K,
    max_chars: int = MAX_CONTEXT_CHARS,
    file_map: dict[str, Path] | None = None,
) -> tuple[str, list[str], list[dict]]:
    if file_map:
        documents = list(file_map.keys())
        all_chunks: list[dict] = []
        for name, path in file_map.items():
            all_chunks.extend(index_document(name, path))
    else:
        documents = resolve_documents(selected_documents)
        all_chunks = []
        for name in documents:
            all_chunks.extend(index_document(name))

    if not all_chunks:
        return "", documents, []

    query_tokens = set(tokenize(query or ""))
    ranked = sorted(
        all_chunks,
        key=lambda chunk: _score_chunk(query or "", query_tokens, chunk),
        reverse=True,
    )

    selected: list[dict] = []
    used_chars = 0
    seen = set()
    for chunk in ranked:
        key = (chunk.get("doc"), chunk.get("page"), (chunk.get("text") or "")[:80])
        if key in seen:
            continue
        text = chunk.get("text") or ""
        if not text:
            continue
        if selected and used_chars + len(text) > max_chars:
            break
        selected.append(chunk)
        used_chars += len(text)
        seen.add(key)
        if len(selected) >= top_k:
            break

    if not selected:
        selected = all_chunks[:top_k]

    parts = []
    for chunk in selected:
        parts.append(
            f"\n--- Doc: {chunk['doc']} | Page {chunk['page']} ---\n{chunk['text']}"
        )
    doc_names = list(dict.fromkeys(chunk["doc"] for chunk in selected)) or documents
    return "".join(parts), doc_names, selected


def get_corpus_text(
    selected_documents: list[str] | None = None,
    max_chars: int = 80_000,
) -> tuple[str, list[str]]:
    documents = resolve_documents(selected_documents)
    if not documents:
        return "", []

    parts: list[str] = []
    total = 0
    for name in documents:
        for chunk in index_document(name):
            segment = f"\n--- Doc: {chunk['doc']} | Page {chunk['page']} ---\n{chunk['text']}"
            if total + len(segment) > max_chars:
                parts.append("\n--- [TEXT TRUNCATED] ---")
                return "".join(parts), documents
            parts.append(segment)
            total += len(segment)
    return "".join(parts), documents
