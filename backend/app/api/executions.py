# backend/app/api/executions.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from uuid import UUID
import asyncio
from datetime import datetime

from app.db.session import get_db
from app.db.models import WorkflowExecution, Workflow, User
from app.core.security import get_current_active_user
from app.engine.template_engine import template_engine

from pydantic import BaseModel, ConfigDict  # Add ConfigDict here

router = APIRouter(prefix="/workflow-executions", tags=["executions"])

# Pydantic models for API
class ExecutionCreate(BaseModel):
    workflow_id: UUID
    input_data: Optional[Dict[str, Any]] = None

class ExecutionUpdate(BaseModel):
    status: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ExecutionLogCreate(BaseModel):
    level: str
    agent: Optional[str] = None
    message: str
    data: Optional[Dict[str, Any]] = None

class ExecutionLogResponse(BaseModel):
    id: UUID
    execution_id: UUID
    timestamp: datetime
    level: str
    agent: Optional[str] = None
    message: str
    data: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)
    
class ExecutionResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    input_data: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    logs: Optional[List[ExecutionLogResponse]] = None

    model_config = ConfigDict(from_attributes=True)
    
@router.post("/", response_model=Dict[str, Any])
async def create_workflow_execution(
    execution_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create and start a new workflow execution"""
    workflow_id = execution_data.get("workflow_id")
    if not workflow_id:
        raise HTTPException(status_code=400, detail="workflow_id is required")
    
    # Get the workflow
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail=f"Workflow with id {workflow_id} not found")
    
    # Create execution record
    execution = WorkflowExecution(
        workflow_id=workflow_id,
        status="running",
        input_data=execution_data.get("input_data", {}),
        created_by=current_user.id
    )
    
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # Start execution in background
    background_tasks.add_task(
        run_workflow_execution,
        execution_id=str(execution.id),
        workflow_id=str(workflow_id),
        input_data=execution_data.get("input_data", {}),
        db=db
    )
    
    return {
        "id": str(execution.id),
        "workflow_id": str(workflow_id),
        "status": "running",
        "started_at": execution.created_at.isoformat()
    }

@router.get("/{execution_id}", response_model=Dict[str, Any])
async def get_workflow_execution(
    execution_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a workflow execution by ID"""
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail=f"Execution with id {execution_id} not found")
    
    # Get the workflow
    workflow = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
    
    result = {
        "id": str(execution.id),
        "workflow_id": str(execution.workflow_id),
        "status": execution.status,
        "input_data": execution.input_data or {},
        "result": execution.result,
        "started_at": execution.created_at.isoformat() if execution.created_at else None,
        "workflow_name": workflow.name if workflow else "Unknown"
    }
    
    if execution.completed_at:
        result["completed_at"] = execution.completed_at.isoformat()
    
    return result

@router.get("/recent", response_model=List[ExecutionResponse])
async def get_recent_executions(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get recent workflow executions"""
    # Join with workflow to filter by user
    executions = (
        db.query(WorkflowExecution)
        .join(Workflow, WorkflowExecution.workflow_id == Workflow.id)
        .filter(Workflow.created_by_id == current_user.id)
        .order_by(WorkflowExecution.started_at.desc())
        .limit(limit)
        .all()
    )    

    # Add workflow names for frontend convenience
    for execution in executions:
        workflow = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
        if workflow:
            execution.workflow_name = workflow.name
    
    return executions
    
async def run_workflow_execution(execution_id: str, workflow_id: str, input_data: Dict[str, Any], db: Session):
    """Run a workflow execution asynchronously"""
    try:
        # Get the workflow
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise ValueError(f"Workflow with id {workflow_id} not found")
        
        # Get the execution
        execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
        if not execution:
            raise ValueError(f"Execution with id {execution_id} not found")
        
        # Execute the workflow
        result = await template_engine.execute_workflow(
            workflow={
                "id": str(workflow.id),
                "name": workflow.name,
                "template_id": str(workflow.template_id),
                "template": workflow.config  # This should contain the template data
            },
            input_data=input_data
        )
        
        # Update the execution record
        execution.status = "completed" if result.get("success", False) else "failed"
        execution.result = result
        execution.completed_at = db.func.now()
        
        db.add(execution)
        db.commit()
        
    except Exception as e:
        # Update execution with error
        try:
            execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
            if execution:
                execution.status = "failed"
                execution.result = {"error": str(e), "success": False}
                execution.completed_at = db.func.now()
                
                db.add(execution)
                db.commit()
        except Exception as inner_e:
            print(f"Error updating execution record: {str(inner_e)}")
