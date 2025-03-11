from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_active_user
from app.db.models import User  # Don't try to import Settings from here
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter()

# Define a model for the settings data structure
class SettingsModel(BaseModel):
    apiKeys: Dict[str, Any]
    tools: Dict[str, Any]
    system: Dict[str, Any]

# Global variable to store settings (in a real app, use database)
GLOBAL_SETTINGS = {
    "apiKeys": {
        "vertexAI": {
            "enabled": True,
            "projectId": "",
            "location": "us-central1",
            "apiEndpoint": ""
        },
        "openAI": {
            "enabled": False,
            "apiKey": ""
        },
        "anthropic": {
            "enabled": False,
            "apiKey": ""
        }
    },
    "tools": {
        "webSearch": {
            "enabled": True,
            "provider": "google",
            "apiKey": ""
        },
        "codeExecution": {
            "enabled": True,
            "timeoutSeconds": 30,
            "maxMemoryMB": 512
        },
        "dataAnalysis": {
            "enabled": True
        }
    },
    "system": {
        "logLevel": "info",
        "maxConcurrentExecutions": 5,
        "defaultCheckpointDir": "./checkpoints",
        "maxExecutionTimeMinutes": 30,
        "cleanupOldExecutions": True,
        "cleanupThresholdDays": 7
    }
}

@router.get("")
async def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return GLOBAL_SETTINGS

@router.put("")
async def update_settings(
    settings: SettingsModel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    global GLOBAL_SETTINGS
    GLOBAL_SETTINGS = settings.dict()
    return GLOBAL_SETTINGS
