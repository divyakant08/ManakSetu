import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import (
    routes_upload,
    routes_search,
    routes_preload_search,
    routes_custom_search,
    routes_gap_analysis,
    routes_summary,
    routes_penalties,
    routes_cml,
    routes_cml_vision,
    routes_analytics,
    routes_export,
)
from app.core.config import settings

app = FastAPI(
    title="ManakSetu API",
    description="AI-powered Bureau of Indian Standards compliance analysis platform with enterprise intelligence",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
)

settings.STORED_DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
settings.TEMP_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Mount API routers
app.include_router(routes_upload.router, prefix="/api", tags=["Documents"])
app.include_router(routes_search.router, prefix="/api", tags=["Search"])
app.include_router(routes_preload_search.router, prefix="/api", tags=["Preloaded Search"])
app.include_router(routes_custom_search.router, prefix="/api", tags=["Custom Search"])
app.include_router(routes_gap_analysis.router, prefix="/api", tags=["Gap Analysis"])
app.include_router(routes_summary.router, prefix="/api", tags=["Summary"])
app.include_router(routes_penalties.router, prefix="/api", tags=["Penalties"])
app.include_router(routes_cml.router, prefix="/api", tags=["CM/L Verification"])
app.include_router(routes_cml_vision.router, prefix="/api", tags=["Enhanced CM/L Vision & Registry"])
app.include_router(routes_analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(routes_export.router, prefix="/api", tags=["Export"])

app.mount(
    "/stored_documents",
    StaticFiles(directory=str(settings.STORED_DOCUMENTS_DIR)),
    name="stored_documents",
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors (does not swallow /docs schema failures)."""
    if request.url.path in {"/openapi.json", "/docs", "/redoc", "/docs/oauth2-redirect"}:
        raise exc
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )
@app.get("/")
async def root():
    return {
        "message": "BIS Standard Compliance Portal Enterprise API",
        "version": "2.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )