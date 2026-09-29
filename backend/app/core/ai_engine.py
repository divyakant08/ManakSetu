import asyncio
import json
import os
from collections.abc import AsyncIterator, Iterator

from app.core.config import settings

FALLBACK_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
]


def get_client():
    """Lazily construct a Gemini client. Never runs at module import / OpenAPI load."""
    api_key = os.getenv("GEMINI_API_KEY") or settings.GEMINI_API_KEY
    if not api_key or api_key == "YOUR_KEY_HERE":
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Please set your Google Gemini API key in backend/.env"
        )
    from google import genai
    return genai.Client(api_key=api_key)


def should_try_next_model(error_str: str) -> bool:
    """Determine if an error is transient (e.g. 503 high demand, 429 quota, 404 not found, 500 internal)."""
    err_lower = error_str.lower()
    retry_triggers = [
        "503", "unavailable", "high demand", "spike", "overloaded",
        "404", "not_found", "not found",
        "429", "resource_exhausted", "quota",
        "500", "internal", "temporary", "timeout",
    ]
    return any(trigger in err_lower for trigger in retry_triggers)


def _model_list() -> list[str]:
    primary_model = settings.GEMINI_MODEL
    seen = set()
    models_to_try = []
    for model_name in [primary_model] + FALLBACK_MODELS:
        if model_name and model_name not in seen:
            seen.add(model_name)
            models_to_try.append(model_name)
    return models_to_try


def _chunk_text(chunk) -> str:
    text = getattr(chunk, "text", None)
    if text:
        return text
    try:
        candidates = getattr(chunk, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                value = getattr(part, "text", None)
                if value:
                    return value
    except Exception:
        return ""
    return ""


def _generate_content_sync(prompt: str) -> str:
    client = get_client()
    last_error = None
    for model_name in _model_list():
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                return response.text
        except Exception as e:
            err_str = str(e)
            last_error = e
            if should_try_next_model(err_str):
                continue
            raise RuntimeError(f"Gemini API error ({model_name}): {err_str}")
    raise RuntimeError(f"Gemini API capacity error on all models tried: {str(last_error)}")


async def generate_ai_response(prompt: str) -> str:
    """Generate a response from Google Gemini AI with automatic resilient model fallback."""
    return await asyncio.to_thread(_generate_content_sync, prompt)


def _iter_stream(prompt: str) -> Iterator[str]:
    client = get_client()
    last_error = None
    for model_name in _model_list():
        try:
            stream = client.models.generate_content_stream(
                model=model_name,
                contents=prompt,
            )
            yielded = False
            for chunk in stream:
                text = _chunk_text(chunk)
                if text:
                    yielded = True
                    yield text
            if yielded:
                return
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                yield response.text
                return
        except Exception as e:
            err_str = str(e)
            last_error = e
            if should_try_next_model(err_str):
                continue
            raise RuntimeError(f"Gemini API error ({model_name}): {err_str}")
    raise RuntimeError(f"Gemini API capacity error on all models tried: {str(last_error)}")


async def generate_ai_response_stream(prompt: str) -> AsyncIterator[str]:
    """Yield Gemini tokens as they arrive, with the same model fallback chain."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[str | None | BaseException] = asyncio.Queue()

    def producer():
        try:
            for piece in _iter_stream(prompt):
                loop.call_soon_threadsafe(queue.put_nowait, piece)
            loop.call_soon_threadsafe(queue.put_nowait, None)
        except BaseException as exc:
            loop.call_soon_threadsafe(queue.put_nowait, exc)

    worker = asyncio.create_task(asyncio.to_thread(producer))
    try:
        while True:
            item = await queue.get()
            if item is None:
                break
            if isinstance(item, BaseException):
                raise item
            yield item
    finally:
        await worker


def sse_pack(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def generate_ai_vision_response(prompt: str, image_bytes: bytes, mime_type: str) -> str:
    """Generate a response from Google Gemini AI with image input and automatic fallback."""
    def _run() -> str:
        client = get_client()
        from google.genai import types

        part = types.Part.from_bytes(
            data=image_bytes,
            mime_type=mime_type,
        )
        last_error = None
        for model_name in _model_list():
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[prompt, part],
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                err_str = str(e)
                last_error = e
                if should_try_next_model(err_str):
                    continue
                raise RuntimeError(f"Gemini Vision API error ({model_name}): {err_str}")
        raise RuntimeError(f"Gemini Vision API capacity error on all models tried: {str(last_error)}")

    return await asyncio.to_thread(_run)
