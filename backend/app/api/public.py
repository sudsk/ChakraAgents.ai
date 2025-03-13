# app/api/public.py
from typing import Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.db.models import Workflow, Deployment, WorkflowExecution, Template, DeploymentStat
from app.db.session import get_db
from app.engine.workflow_engine import WorkflowEngine

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
    
    try:
        # Execute workflow
        result = await engine.execute_workflow(
            template=template,
            workflow=workflow,
            input_data=request.input_data
        )
        
        # Calculate latency
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Update execution record
        execution.status = "completed" if result.get("success", False) else "failed"
        execution.result = result
        execution.completed_at = db.func.now()
        
        if not result.get("success", False):
            execution.error = result.get("error", "Unknown error")
        
        db.add(execution)
        db.commit()
        
        # Estimate token usage (in a real implementation, this would come from the LLM provider)
        # Here we're using a simple heuristic based on character count
        input_tokens = len(str(request.input_data)) // 4  # Rough estimate
        output_tokens = len(str(result)) // 4  # Rough estimate
        
        # Log usage stats in background
        background_tasks.add_task(
            log_usage_stats,
            deployment_id=deployment.id,
            execution_id=execution.id,
            success=result.get("success", False),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            db=db
        )
        
        # Send webhook notification if configured
        background_tasks.add_task(
            send_webhook_notifications,
            deployment_id=deployment.id,
            execution_id=execution.id,
            status=execution.status,
            result=result,
            db=db
        )
        
        return WorkflowExecutionResponse(
            execution_id=execution.id,
            status=execution.status,
            result=result,
            error=execution.error
        )
        
    except Exception as e:
        # Handle execution errors
        execution.status = "failed"
        execution.error = str(e)
        execution.completed_at = db.func.now()
        db.add(execution)
        db.commit()
        
        # Calculate latency even for errors
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Log usage stats in background
        background_tasks.add_task(
            log_usage_stats,
            deployment_id=deployment.id,
            execution_id=execution.id,
            success=False,
            input_tokens=len(str(request.input_data)) // 4,  # Rough estimate
            output_tokens=0,
            latency_ms=latency_ms,
            db=db
        )
        
        return WorkflowExecutionResponse(
            execution_id=execution.id,
            status="failed",
            error=str(e)
        )

async def send_webhook_notifications(
    deployment_id: UUID,
    execution_id: UUID,
    status: str,
    result: Dict[str, Any],
    db: Session
):
    """
    Send webhook notifications for the execution.
    This is run as a background task after the execution completes.
    """
    import httpx
    import json
    from app.db.models import Integration
    
    # Find webhooks for this deployment that should receive this event
    webhooks = db.query(Integration).filter(
        Integration.deployment_id == deployment_id,
        Integration.integration_type == "webhook"
    ).all()
    
    for webhook in webhooks:
        # Check if this webhook should receive notifications for this status
        events = webhook.config.get("events", [])
        if status.lower() not in events and "all" not in events:
            continue
        
        # Prepare webhook payload
        payload = {
            "execution_id": str(execution_id),
            "status": status,
            "timestamp": db.func.now().isoformat(),
            "result": result if status == "completed" else None,
            "error": result.get("error") if status == "failed" else None
        }
        
        # Get webhook URL
        url = webhook.config.get("url")
        if not url:
            continue
        
        # Get webhook secret for HMAC validation (if configured)
        secret = webhook.config.get("secret")
        
        headers = {
            "Content-Type": "application/json"
        }
        
        # Add HMAC signature if secret is configured
        if secret:
            import hmac
            import hashlib
            
            payload_bytes = json.dumps(payload).encode()
            signature = hmac.new(
                secret.encode(),
                payload_bytes,
                hashlib.sha256
            ).hexdigest()
            
            headers["X-ChakraAgents-Signature"] = signature
        
        # Send the webhook
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=10.0
                )
        except Exception as e:
            # Log webhook failure but don't fail the request
            print(f"Webhook notification to {url} failed: {str(e)}")

@router.get("/deployments/{deployment_id}/status", response_model=Dict[str, Any])
async def get_deployment_status(
    deployment_id: UUID,
    deployment: Deployment = Depends(get_deployment_from_api_key),
    db: Session = Depends(get_db),
):
    """
    Get the status of a deployment.
    This endpoint can be used by client applications to verify connectivity and authentication.
    """
    # Verify the deployment ID matches the API key's deployment
    if str(deployment.id) != str(deployment_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API key not authorized for this deployment",
        )
    
    # Get the workflow
    workflow = db.query(Workflow).filter(Workflow.id == deployment.workflow_id).first()
    
    # Get recent executions
    recent_executions = db.query(WorkflowExecution)\
        .filter(WorkflowExecution.workflow_id == deployment.workflow_id)\
        .order_by(WorkflowExecution.started_at.desc())\
        .limit(5)\
        .all()
    
    return {
        "status": deployment.status,
        "workflow_id": str(deployment.workflow_id),
        "workflow_name": workflow.name if workflow else "Unknown",
        "version": deployment.version,
        "recent_executions": [
            {
                "id": str(exec.id),
                "status": exec.status,
                "started_at": exec.started_at.isoformat() if exec.started_at else None,
                "completed_at": exec.completed_at.isoformat() if exec.completed_at else None,
            }
            for exec in recent_executions
        ]
    }
