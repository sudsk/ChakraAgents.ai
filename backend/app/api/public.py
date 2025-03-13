# app/api/public.py
from typing import Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.db.models import Workflow, Deployment, WorkflowExecution, Template, DeploymentStat
from app.db.session import get_db
from app.engine.core.workflow_engine import WorkflowEngine

router = APIRouter()

# Pydantic models for API
class WorkflowExecutionRequest(BaseModel):
    input_data: Dict[str, Any]
    
    model_config = ConfigDict(extra="allow")  # Allow extra fields

class WorkflowExecutionResponse(BaseModel):
    execution_id: UUID
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

def get_deployment_from_api_key(api_key: str = Header(...), db: Session = Depends(get_db)):
    """
    Get the deployment associated with the provided API key.
    This is used to authenticate requests to the public API.
    """
    if not api_key.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format. Must start with 'Bearer '",
        )
    
    # Extract the key part
    key = api_key.replace("Bearer ", "")
    
    # Find deployment with this API key
    deployment = db.query(Deployment).filter(Deployment.api_key == key, Deployment.status == "active").first()
    
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    return deployment

async def log_usage_stats(
    deployment_id: UUID,
    execution_id: UUID,
    success: bool,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    db: Session
):
    """
    Log usage statistics for a deployment execution.
    This is run as a background task after the execution completes.
    """
    from datetime import datetime
    
    # Get today's date (without time)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Try to find existing stat for today
    stat = db.query(DeploymentStat).filter(
        DeploymentStat.deployment_id == deployment_id,
        DeploymentStat.date == today
    ).first()
    
    if stat:
        # Update existing stat
        stat.requests_count += 1
        if success:
            stat.successful_count += 1
        else:
            stat.failed_count += 1
        stat.input_tokens += input_tokens
        stat.output_tokens += output_tokens
        stat.total_latency += latency_ms
    else:
        # Create new stat
        stat = DeploymentStat(
            deployment_id=deployment_id,
            date=today,
            requests_count=1,
            successful_count=1 if success else 0,
            failed_count=0 if success else 1,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_latency=latency_ms
        )
        db.add(stat)
    
    db.commit()

@router.post("/workflows/{workflow_id}/execute", response_model=WorkflowExecutionResponse)
async def execute_workflow(
    workflow_id: UUID,
    request: WorkflowExecutionRequest,
    background_tasks: BackgroundTasks,
    deployment: Deployment = Depends(get_deployment_from_api_key),
    db: Session = Depends(get_db),
):
    """
    Execute a workflow via the public API.
    This endpoint is used by client applications integrated with ChakraAgents.ai.
    Authentication is done via API key in the Authorization header.
    """
    # Verify the workflow ID matches the deployment's workflow
    if str(deployment.workflow_id) != str(workflow_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API key not authorized for this workflow",
        )
    
    # Get the workflow and template
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )
    
    template = db.query(Template).filter(Template.id == workflow.template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    # Create execution record
    execution = WorkflowExecution(
        workflow_id=workflow_id,
        status="running",
        input_data=request.input_data,
        started_at=db.func.now()
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # Initialize engine and execute workflow
    engine = WorkflowEngine()
    import time
    start_time = time.time()
