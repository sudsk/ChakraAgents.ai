# backend/app/api/routes/agentic_workflow_routes.py
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, status
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.security import get_current_active_user
from app.db.models import Workflow, WorkflowExecution, ExecutionLog, User, Template
from app.db.session import get_db
from app.engine.agentic_workflow_engine import AgenticWorkflowEngine
from app.engine.agent_prompt_creator import AgentPromptCreator

from datetime import datetime

# Initialize the router
router = APIRouter(prefix="/api/agentic-workflows", tags=["agentic-workflows"])

# Helper functions
def has_cycle(graph):
    """
    Check if the execution graph has cycles using DFS.
    
    Args:
        graph: Dictionary representing the directed graph
        
    Returns:
        Boolean indicating whether the graph has cycles
    """
    visited = set()
    rec_stack = set()
    
    def dfs(node):
        visited.add(node)
        rec_stack.add(node)
        
        # Visit neighbors
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True
        
        # Remove from recursion stack
        rec_stack.remove(node)
        return False
    
    # Check each node
    for node in graph:
        if node not in visited:
            if dfs(node):
                return True
    
    return False

# Pydantic models for API
class AgenticExecutionCreate(BaseModel):
    workflow_id: UUID
    input_data: Optional[Dict[str, Any]] = None
    options: Optional[Dict[str, Any]] = None

class AgenticExecutionResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    started_at: str
    completed_at: Optional[str] = None
    status: str
    input_data: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_graph: Optional[Dict[str, List[str]]] = None
    
    class Config:
        from_attributes = True

# Initialize the agentic workflow engine
agentic_engine = AgenticWorkflowEngine()

@router.post("/executions", response_model=AgenticExecutionResponse, status_code=status.HTTP_201_CREATED)
async def create_agentic_execution(
    execution_in: AgenticExecutionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new agentic workflow execution and start it in the background.
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
        message="Agentic workflow execution initiated",
    )
    db.add(log_entry)
    db.commit()
    
    # Start execution in background
    background_tasks.add_task(
        execute_agentic_workflow_background,
        workflow_id=workflow.id,
        execution_id=execution.id,
        input_data=execution_in.input_data or {"query": ""},
        options=execution_in.options or {},
        db=db,
    )
    
    # Add workflow name for frontend convenience
    setattr(execution, "workflow_name", workflow.name)
    
    return execution

@router.get("/executions/{execution_id}", response_model=AgenticExecutionResponse)
async def get_agentic_execution(
    execution_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get details of a specific agentic workflow execution.
    """
    # Get execution record
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
        setattr(execution, "workflow_name", workflow.name)
    
    return execution

@router.get("/executions", response_model=List[AgenticExecutionResponse])
async def list_agentic_executions(
    limit: int = 10,
    offset: int = 0,
    workflow_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List agentic workflow executions with optional filtering by workflow.
    """
    # Build query
    query = db.query(WorkflowExecution).join(
        Workflow, WorkflowExecution.workflow_id == Workflow.id
    ).filter(Workflow.created_by_id == current_user.id)
    
    # Filter by workflow if specified
    if workflow_id:
        query = query.filter(WorkflowExecution.workflow_id == workflow_id)
    
    # Order by most recent first
    query = query.order_by(WorkflowExecution.started_at.desc())
    
    # Apply pagination
    executions = query.offset(offset).limit(limit).all()
    
    # Add workflow names
    for execution in executions:
        workflow = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
        if workflow:
            setattr(execution, "workflow_name", workflow.name)
    
    return executions

async def execute_agentic_workflow_background(
    workflow_id: UUID,
    execution_id: UUID,
    input_data: Dict[str, Any],
    options: Dict[str, Any],
    db: Session,
):
    """
    Execute an agentic workflow in the background.
    This function uses the agentic workflow engine to run the workflow.
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
            message="Agentic workflow execution started",
        )
        db.add(start_log)
        db.commit()
        
        # Enhance the template with agentic capabilities
        enhanced_template = Template(
            id=template.id,
            name=template.name,
            description=template.description,
            workflow_type=template.workflow_type,
            created_by_id=template.created_by_id,
            config=AgentPromptCreator.enhance_template_with_agentic_capabilities(template.config)
        )
        
        # Execute the workflow
        result = await agentic_engine.execute_workflow(enhanced_template, workflow, input_data)
        
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
        
        # Add execution graph if available
        if result.get("execution_graph"):
            graph_log = ExecutionLog(
                execution_id=execution_id,
                level="info",
                agent="system",
                message="Execution Graph",
                data={"graph": result.get("execution_graph")}
            )
            db.add(graph_log)
        
        # Add agent logs
        for agent_name, agent_output in result.get("outputs", {}).items():
            agent_log = ExecutionLog(
                execution_id=execution_id,
                level="info",
                agent=agent_name,
                message=f"Agent output: {agent_name}",
                data={"content": agent_output}
            )
            db.add(agent_log)
        
        # Add decision log if available
        if result.get("decisions"):
            for i, decision in enumerate(result.get("decisions")):
                decision_log = ExecutionLog(
                    execution_id=execution_id,
                    level="info",
                    agent=decision.get("agent", "unknown"),
                    message=f"Decision {i+1}: {decision.get('action_type', 'unknown')}",
                    data=decision
                )
                db.add(decision_log)
        
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

@router.post("/executions/{execution_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_agentic_execution(
    execution_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Cancel a running agentic workflow execution.
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

@router.post("/validate", response_model=Dict[str, Any])
async def validate_agentic_workflow(
    workflow: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Validate an agentic workflow configuration.
    """
    try:
        # Perform basic validation
        if not workflow.get("name"):
            return {
                "valid": False,
                "message": "Workflow name is required"
            }
        
        # Check if supervisor exists
        if not workflow.get("config", {}).get("supervisor"):
            return {
                "valid": False,
                "message": "Supervisor agent is required for agentic workflows"
            }
        
        # Check agent configurations
        supervisor = workflow.get("config", {}).get("supervisor", {})
        if not supervisor.get("name") or not supervisor.get("model_provider") or not supervisor.get("model_name"):
            return {
                "valid": False,
                "message": "Supervisor agent requires name, model_provider, and model_name"
            }
        
        # Check worker agents if present
        workers = workflow.get("config", {}).get("workers", [])
        for i, worker in enumerate(workers):
            if not worker.get("name") or not worker.get("model_provider") or not worker.get("model_name"):
                return {
                    "valid": False,
                    "message": f"Worker agent at index {i} requires name, model_provider, and model_name"
                }
        
        # Check execution graph if present
        execution_graph = workflow.get("config", {}).get("execution_graph", {})
        all_agents = [supervisor.get("name")] + [worker.get("name") for worker in workers]
        
        for source, targets in execution_graph.items():
            if source not in all_agents:
                return {
                    "valid": False,
                    "message": f"Agent '{source}' in execution graph does not exist"
                }
            
            for target in targets:
                if target not in all_agents:
                    return {
                        "valid": False,
                        "message": f"Target agent '{target}' in execution graph does not exist"
                    }
        
        # Check for cyclic dependencies in the execution graph
        if execution_graph and has_cycle(execution_graph):
            return {
                "valid": False,
                "message": "Execution graph contains cycles, which could lead to infinite loops"
            }
        
        # Enhance the configuration with agentic capabilities
        enhanced_config = workflow.copy()
        enhanced_config["config"] = AgentPromptCreator.enhance_template_with_agentic_capabilities(workflow.get("config", {}))
        
        # Return success
        return {
            "valid": True,
            "message": "Workflow configuration is valid",
            "enhanced_config": enhanced_config
        }
