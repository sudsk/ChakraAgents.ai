# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, templates, workflows, executions, settings as settings_router
from app.core.config import settings
from app.db.session import engine
from app.db.models import Base

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="API for managing agentic AI workflows",
    version="1.0.0",
)

# Configure CORS
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # If no specific origins are set, allow all origins in development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Create database tables
@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}

# Include routers
app.include_router(auth.router, prefix=settings.API_V1_STR, tags=["authentication"])
app.include_router(templates.router, prefix=settings.API_V1_STR, tags=["templates"])
app.include_router(workflows.router, prefix=settings.API_V1_STR, tags=["workflows"])
app.include_router(executions.router, prefix=settings.API_V1_STR, tags=["executions"])
app.include_router(settings_router.router, prefix=settings.API_V1_STR, tags=["settings"])

# Add exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
