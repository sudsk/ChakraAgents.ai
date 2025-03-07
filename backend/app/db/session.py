# app/db/session.py
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Create SQLAlchemy engine
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Create sessionmaker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get DB session
def get_db() -> Generator:
    """
    Get a database session.
    This is a FastAPI dependency to be used in API endpoints.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create async database connection (for background tasks)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# If an async database URL is provided, create an async engine
if hasattr(settings, "ASYNC_DATABASE_URL") and settings.ASYNC_DATABASE_URL:
    async_engine = create_async_engine(settings.ASYNC_DATABASE_URL)
    AsyncSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=async_engine, class_=AsyncSession
    )

    async def get_async_db() -> AsyncSession:
        """
        Get an async database session.
        This is for async background tasks.
        """
        async with AsyncSessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()
else:
    # Fallback if no async DB URL is provided
    AsyncSessionLocal = None
    
    async def get_async_db() -> Generator:
        """
        Fallback if no async DB URL is provided.
        """
        raise NotImplementedError("Async database not configured")
