# app/api/executions.py
from typing import Dict, List, Optional, Any
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy.future import select

from app.core.security import get_current_active_user
from app.db.models import Workflow, WorkflowExecution, ExecutionLog, User, Template
from app.db.session import get_db
from app.engine.workflow_engine import WorkflowEngine
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
    workflow_name: Optional[str] = None  # Added for frontend convenience

    model_config = ConfigDict(from_attributes=True)

async def execute_workflow_background(
    workflow_id: UUID,
    execution_id: UUID,
    input_data: Dict[str, Any],
    db: Session,
):
    """
    Execute a workflow in the background.
    This function uses the workflow engine to run the workflow.
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
        
        # Add log entry for execution start
        start_log = ExecutionLog(
            execution_id=execution_id,
            level="info",
            agent="system",
            message="Workflow execution started",
        )
        db.add(start_log)
        db.commit()
        
        # Initialize the workflow engine and run the workflow
        engine = WorkflowEngine()
        
        # Log milestone
        milestone_log = ExecutionLog(
            execution_id=execution_id,
            level="info",
            agent="system",
            message="Initializing workflow execution",
            data={"workflow_type": template.workflow_type}
        )
        db.add(milestone_log)
        db.commit()
        
        # Execute the workflow
        result = await engine.execute_workflow(template, workflow, input_data)
        
        # Update execution with result
        execution.completed_at = datetime.utcnow()
        execution.status = "completed" if result.get("success", False) else "failed"
        execution.result = result
        
        if not result.get("success", False):
            execution.error = result.get("error", "Workflow execution failed")
            
            # Add error log
            error_log = ExecutionLog(
                execution_id=execution_id,
                level="error",
                agent="system",
                message=f"Workflow execution failed: {result.get('error', 'Unknown error')}",
            )
            db.add(error_log)
        
        # Add completion log
        complete_log = ExecutionLog(
            execution_id=execution_id,
            level="info",
            agent="system",
            message="Workflow execution completed",
            data={
                "success": result.get("success", False),
                "execution_time": result.get("execution_time", 0)
            }
        )
        db.add(complete_log)
        
        # Add agent logs if available
        if template.workflow_type == "supervisor":
            # Add supervisor logs
            supervisor_log = ExecutionLog(
                execution_id=execution_id,
                level="info",
                agent="supervisor",
                message="Supervisor response",
                data={"content": result.get("messages", [{}])[-1].get("content", "") if result.get("messages") else ""}
            )
            db.add(supervisor_log)
            
            # Add worker logs
            for worker_name, worker_output in result.get("outputs", {}).items():
                worker_log = ExecutionLog(
                    execution_id=execution_id,
                    level="info",
                    agent=worker_name,
                    message=f"Worker response: {worker_name}",
                    data={"content": worker_output}
                )
                db.add(worker_log)
        else:  # swarm
            # Add agent logs
            for agent_name, agent_output in result.get("outputs", {}).items():
                agent_log = ExecutionLog(
                    execution_id=execution_id,
                    level="info",
                    agent=agent_name,
                    message=f"Agent response: {agent_name}",
                    data={"content": agent_output}
                )
                db.add(agent_log)
                
            # Add final output log
            final_log = ExecutionLog(
                execution_id=execution_id,
                level="info",
                agent="system",
                message="Final output",
                data={"content": result.get("final_output", "")}
            )
            db.add(final_log)
        
        # Save a checkpoint of the final state if configured
        checkpoint_dir = template.config.get("workflow_config", {}).get("checkpoint_dir")
        if checkpoint_dir:
            try:
                checkpoint_path = await engine.save_execution_checkpoint(
                    execution_id=execution_id,
                    state=result,
                    checkpoint_dir=checkpoint_dir
                )
                execution.checkpoint_path = checkpoint_path
            except Exception as checkpoint_error:
                # Log the error but don't fail the execution
                error_log = ExecutionLog(
                    execution_id=execution_id,
                    level="warning",
                    agent="system",
                    message=f"Failed to save checkpoint: {str(checkpoint_error)}",
                )
                db.add(error_log)
        
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
    The system supports various workflow types:
    - "supervisor": A hierarchical system with a supervisor agent coordinating worker agents
    - "swarm": A collaborative system where agents work together as peers
    - "rag": A specialized workflow for Retrieval-Augmented Generation
    
    For RAG-enabled workflows, agents with the "retrieve_information" tool will automatically
    access the vector store to retrieve relevant information based on the query.    
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
        input_data=execution_in.input_data or {"query": ""},
        started_at=datetime.utcnow()
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
        input_data=execution_in.input_data or {"query": ""},
        db=db,
    )
    
    # Add workflow name for frontend convenience
    execution.workflow_name = workflow.name
    
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

@router.delete("/{execution_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_execution(
    execution_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Cancel a running workflow execution.
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
    
    # Can only cancel running or pending executions
    if execution.status not in ["running", "pending"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel execution with status: {execution.status}",
        )
    
    # Mark as canceled
    execution.status = "canceled"
    execution.completed_at = datetime.utcnow()
    
    # Add log entry
    log_entry = ExecutionLog(
        execution_id=execution_id,
        level="warning",
        agent="system",
        message="Execution canceled by user",
    )
    db.add(log_entry)
    db.commit()
    
    return None

@router.get("/{execution_id}/logs", response_model=List[ExecutionLogResponse])
def get_execution_logs(
    execution_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get logs for a specific workflow execution.
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
    
    logs = db.query(ExecutionLog).filter(ExecutionLog.execution_id == execution_id).order_by(ExecutionLog.timestamp).all()
    return logs
