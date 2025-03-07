# app/api/executions.py
from typing import Dict, List, Optional, Any
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.models import Workflow, WorkflowExecution, ExecutionLog, User, Template
from app.db.session import get_db
import app.engine.template_engine as engine  # Import the template engine module
from pydantic import BaseModel

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

    class Config:
        orm_mode = True

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

    class Config:
        orm_mode = True

async def execute_workflow_background(
    workflow_id: UUID,
    execution_id: UUID,
    input_data: Dict[str, Any],
    db: Session,
):
    """
    Execute a workflow in the background.
    This function would use the template engine to run the workflow.
    """
    try:
        # Get workflow and template
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise ValueError(f"Workflow with ID {workflow_id} not found")
        
        template = db.query(Template).filter(Template.id == workflow.template_id).first()
        if not template:
            raise ValueError(f"Template with ID {workflow.template_id} not found")
        
        # Update status to running
        execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
        execution.status = "running"
        db.commit()
        
        # Initialize the template engine and run the workflow
        # This is a simplified placeholder - actual implementation would depend on your engine
        # engine_instance = engine.TemplateEngine()
        # result = await engine_instance.execute_workflow(template, workflow, input_data)
        
        # For demonstration, we'll create a mock result
        import asyncio
        import random
        # Simulate processing time
        await asyncio.sleep(5)
        
        # Generate a mock result
        result = {
            "success": random.choice([True, True, True, False]),  # 75% success rate
            "outputs": {
                "agent1": "This is output from agent 1",
                "agent2": "This is output from agent 2"
            },
            "final_output": "Final synthesis of all agent outputs"
        }
        
        # Update execution with result
        execution.completed_at = datetime.utcnow()
        execution.status = "completed" if result["success"] else "failed"
        execution.result = result
        if not result["success"]:
            execution.error = "Workflow execution failed"
        
        # Add log entries
        log_entry = ExecutionLog(
            execution_id=execution_id,
            level="info",
            agent="system",
            message="Workflow execution completed",
            data={"success": result["success"]}
        )
        db.add(log_entry)
        db.commit()
        
    except Exception as e:
        # Handle errors
        execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
        if execution:
            execution.status = "failed"
            execution.error = str(e)
            execution.completed_at = datetime.utcnow()
            
            log_entry = ExecutionLog(
                execution_id=execution_id,
                level="error",
                agent="system",
                message=f"Workflow execution failed: {str(e)}",
            )
            db.add(log_entry)
            db.commit()

@router.get("/recent", response_model=List[ExecutionResponse])
def get_recent_executions(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get recent workflow executions for the current user.
    """
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

@router.post("", response_model=ExecutionResponse, status_code=status.HTTP_201_CREATED)
async def create_execution(
    execution_in: ExecutionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new workflow execution and start it in the background.
    """
    # Check if workflow exists and user has access
    workflow = db.query(Workflow).filter(Workflow.id == execution_in.workflow_id).first()
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
    
    # Create execution record
    execution = WorkflowExecution(
        workflow_id=execution_in.workflow_id,
        status="pending",
        input_data=execution_in.input_data,
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # Add an initial log entry
    log_entry = ExecutionLog(
        execution_id=execution.id,
        level="info",
        agent="system",
        message="Workflow execution initiated",
    )
    db.add(log_entry)
    db.commit()
    
    # Start execution in background
    background_tasks.add_task(
        execute_workflow_background,
        workflow_id=workflow.id,
        execution_id=execution.id,
        input_data=execution_in.input_data or {},
        db=db,
    )
    
    return execution

@router.get("/{execution_id}", response_model=ExecutionResponse)
def get_execution(
    execution_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get details of a specific workflow execution.
    """
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )
    
    # Check if user has access to this execution
    workflow = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
    if not workflow or (workflow.created_by_id != current_user.id and not current_user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    # Get logs for the execution
    logs = db.query(ExecutionLog).filter(ExecutionLog.execution_id == execution_id).order_by(ExecutionLog.timestamp).all()
    execution.logs = logs
    
    # Add workflow name for frontend convenience
    if workflow:
        execution.workflow_name = workflow.name
    
    return execution

@router.post("/{execution_id}/logs", response_model=ExecutionLogResponse)
def add_execution_log(
    execution_id: UUID,
    log_in: ExecutionLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Add a log entry to a workflow execution.
    """
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )
    
    # Check if user has access to this execution
    workflow = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
    if not workflow or (workflow.created_by_id != current_user.id and not current_user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    log_entry = ExecutionLog(
        execution_id=execution_id,
        level=log_in.level,
        agent=log_in.agent,
        message=log_in.message,
        data=log_in.data,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    
    return log_entry
