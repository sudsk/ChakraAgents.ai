# app/core/config.py
import os
from typing import Any, Dict, List, Optional, Union

from pydantic import AnyHttpUrl, PostgresDsn, field_validator, ConfigDict
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # General settings
    APP_NAME: str = "Agentic AI Service"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"
    
    # API Settings
    API_V1_STR: str = "/api"
    API_V1_PREFIX: str = "/api/v1"
    
    # CORS
    CORS_ORIGINS: List[AnyHttpUrl] = []
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Database
    DATABASE_URL: str

    # Add this field
    # ASYNC_DATABASE_URL: Optional[str] = None
    
    @field_validator("DATABASE_URL", mode='before')
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        # This function validates the DATABASE_URL format
        # and can handle different database types
        if v.startswith("postgres://"):
            # If it's a PostgreSQL URL, convert it to the SQLAlchemy format
            return v.replace("postgres://", "postgresql://", 1)
        return v
    
    # LLM Provider settings
    VERTEX_AI_PROJECT_ID: Optional[str] = None
    VERTEX_AI_LOCATION: str = "us-central1"
    
    OPENAI_API_KEY: Optional[str] = None
    
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # Tool settings
    ENABLE_WEB_SEARCH: bool = True
    WEB_SEARCH_API_KEY: Optional[str] = None
    
    # Storage
    CHECKPOINT_DIR: str = "./checkpoints"
    
    # Logging
    LOG_LEVEL: str = "info"
    
    # Workflow settings
    MAX_EXECUTION_TIME_MINUTES: int = 30
    MAX_CONCURRENT_EXECUTIONS: int = 5
    
    model_config = ConfigDict(
        # Load settings from environment variables
        env_file=".env",
        case_sensitive=True
    )        

# Create settings instance
settings = Settings()
