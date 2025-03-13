# app/api/deployments.py
from typing import Dict, List, Optional, Any
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.core.security import get_current_active_user
from app.db.models import Workflow, Deployment, Integration, User
from app.db.session import get_db
from app.engine.workflow_engine import WorkflowEngine

router = APIRouter(prefix="/deployments", tags=["deployments"])

# Pydantic models for API
class DeploymentCreate(BaseModel):
    workflow_id: UUID
    version: Optional[str] = "v1"
    description: Optional[str] = None

class WebhookCreate(BaseModel):
    url: str
    events: List[str] = ["completed", "failed"]
    secret: Optional[str] = None

class ApiKeyCreate(BaseModel):
    name: str
    expires_at: Optional[datetime] = None

class DeploymentResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    version: str
    status: str
    api_key: str
    endpoint_url: str
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime
    description: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class WebhookResponse(BaseModel):
    id: UUID
    deployment_id: UUID
    url: str
    events: List[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ApiKeyResponse(BaseModel):
    id: UUID
    name: str
    key: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=List[DeploymentResponse])
def get_deployments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get all deployments for the current user.
    """
    deployments = db.query(Deployment).filter(
        Deployment.created_by_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    return deployments

@router.post("", response_model=DeploymentResponse, status_code=status.HTTP_201_CREATED)
async def create_deployment(
    deployment_in: DeploymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Deploy a workflow as an API endpoint.
    This creates a new deployment with an API key and endpoint URL.
    """
    # Check if workflow exists and user has access
    workflow = db.query(Workflow).filter(Workflow.id == deployment_in.workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )
    if workflow.created_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    # Deploy the workflow using the engine
    engine = WorkflowEngine()
    deployment_result = await engine.deploy_as_api(
        workflow_id=str(workflow.id),
        version=deployment_in.version
    )
    
    # Create deployment record
    deployment = Deployment(
        workflow_id=workflow.id,
        version=deployment_in.version,
        status="active",
        api_key=deployment_result["api_key"],
        endpoint_url=deployment_result["endpoint_url"],
        created_by_id=current_user.id,
        description=deployment_in.description
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    
    return deployment

@router.get("/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get details of a specific deployment.
    """
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found",
        )
    
    # Check if user has access to this deployment
    if deployment.created_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    return deployment

@router.delete("/{deployment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deployment(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Deactivate a deployment.
    """
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found",
        )
    
    # Check if user has access to this deployment
    if deployment.created_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    # Soft delete - just change status to "inactive"
    deployment.status = "inactive"
    db.commit()
    
    return None

@router.post("/{deployment_id}/webhooks", response_model=WebhookResponse)
def create_webhook(
    deployment_id: UUID,
    webhook_in: WebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a webhook for a deployment.
    """
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found",
        )
    
    # Check if user has access to this deployment
    if deployment.created_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    # Create integration record of type webhook
    integration = Integration(
        deployment_id=deployment_id,
        integration_type="webhook",
        config={
            "url": webhook_in.url,
            "events": webhook_in.events,
            "secret": webhook_in.secret
        },
        created_by_id=current_user.id
    )
    db.add(integration)
    db.commit()
    db.refresh(integration)
    
    # Transform to webhook response
    webhook_response = WebhookResponse(
        id=integration.id,
        deployment_id=deployment_id,
        url=webhook_in.url,
        events=webhook_in.events,
        created_at=integration.created_at
    )
    
    return webhook_response

@router.post("/{deployment_id}/apikeys", response_model=ApiKeyResponse)
def create_api_key(
    deployment_id: UUID,
    apikey_in: ApiKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new API key for a deployment.
    """
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found",
        )
    
    # Check if user has access to this deployment
    if deployment.created_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    # Generate a new API key
    import secrets
    api_key = f"wf_{secrets.token_hex(16)}"
    
    # Create integration record of type apikey
    integration = Integration(
        deployment_id=deployment_id,
        integration_type="apikey",
        config={
            "name": apikey_in.name,
            "key": api_key,
            "expires_at": apikey_in.expires_at.isoformat() if apikey_in.expires_at else None
        },
        created_by_id=current_user.id
    )
    db.add(integration)
    db.commit()
    db.refresh(integration)
    
    # Transform to API key response
    apikey_response = ApiKeyResponse(
        id=integration.id,
        name=apikey_in.name,
        key=api_key,  # Only return the full key on creation
        created_at=integration.created_at,
        expires_at=apikey_in.expires_at
    )
    
    return apikey_response

@router.get("/{deployment_id}/stats", response_model=Dict[str, Any])
def get_deployment_stats(
    deployment_id: UUID,
    timeframe: str = "7d",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get usage statistics for a deployment.
    """
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found",
        )
    
    # Check if user has access to this deployment
    if deployment.created_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    # This would be implemented to query execution stats
    # For now, return sample data
    return {
        "total_requests": 127,
        "successful_requests": 124,
        "failed_requests": 3,
        "average_latency": 1.24,  # seconds
        "token_usage": {
            "input_tokens": 12500,
            "output_tokens": 34200
        },
        "daily_requests": [
            {"date": "2025-03-07", "count": 15},
            {"date": "2025-03-08", "count": 23},
            {"date": "2025-03-09", "count": 18},
            {"date": "2025-03-10", "count": 25},
            {"date": "2025-03-11", "count": 17},
            {"date": "2025-03-12", "count": 19},
            {"date": "2025-03-13", "count": 10}
        ]
    }
