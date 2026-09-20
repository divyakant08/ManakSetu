import os
from app.core.config import settings

# Active candidate models to try in order on unavailability, capacity spikes, or 404/503 errors
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
        "500", "internal", "temporary", "timeout"
    ]
    return any(trigger in err_lower for trigger in retry_triggers)


async def generate_ai_response(prompt: str) -> str:
    """Generate a response from Google Gemini AI with automatic resilient model fallback."""
    client = get_client()
    primary_model = settings.GEMINI_MODEL
    
    # Deduplicate while preserving order with primary_model first
    seen = set()
    models_to_try = []
    for m in [primary_model] + FALLBACK_MODELS:
        if m and m not in seen:
            seen.add(m)
            models_to_try.append(m)

    last_error = None
    for model_name in models_to_try:
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
            # If model is unavailable (503/404/429/500), try next available model in list
            if should_try_next_model(err_str):
                continue
            raise RuntimeError(f"Gemini API error ({model_name}): {err_str}")

    raise RuntimeError(f"Gemini API capacity error on all models tried: {str(last_error)}")


async def generate_ai_vision_response(prompt: str, image_bytes: bytes, mime_type: str) -> str:
    """Generate a response from Google Gemini AI with image input and automatic fallback."""
    client = get_client()
    primary_model = settings.GEMINI_MODEL

    seen = set()
    models_to_try = []
    for m in [primary_model] + FALLBACK_MODELS:
        if m and m not in seen:
            seen.add(m)
            models_to_try.append(m)

    from google.genai import types

    part = types.Part.from_bytes(
        data=image_bytes,
        mime_type=mime_type,
    )

    last_error = None
    for model_name in models_to_try:
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
