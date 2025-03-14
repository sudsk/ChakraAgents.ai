# backend/app/api/agentic.py
# At the top of each router file, add:
from app.core.security import get_current_active_user

from typing import Dict, List, Any, Optional, Union
from uuid import UUID
from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, ConfigDict

from app.core.security import get_current_active_user
from app.db.models import Workflow, WorkflowExecution, ExecutionLog, User, Template
from app.db.session import get_db
from app.engine.agentic_workflow_engine import AgenticWorkflowEngine
from app.engine.agent_prompt_creator import AgentPromptCreator
from app.engine.agent_decision_parser import AgentDecisionParser
from app.engine.tools.tool_registry import tool_registry
from app.engine.optimizations import (
    cached_llm_call,
    throttled_api_call,
    WorkflowCheckpointer,
    ProgressiveResponse
)

router = APIRouter(prefix="/agentic", tags=["agentic-api"])

logger = logging.getLogger(__name__)

# Pydantic models for API
class AgenticExecutionCreate(BaseModel):
    workflow_id: UUID
    input_data: Optional[Dict[str, Any]] = None
    options: Optional[Dict[str, Any]] = None

class AgenticDecision(BaseModel):
    agent_name: str
    action_type: str
    target: Optional[str] = None
    content: Optional[str] = None
    reasoning: Optional[str] = None
    tool_name: Optional[str] = None
    tool_params: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(from_attributes=True)

class AgenticExecutionResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    input_data: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_graph: Optional[Dict[str, List[str]]] = None
    decisions: Optional[List[Dict[str, Any]]] = None
    
    model_config = ConfigDict(from_attributes=True)

class ToolRequest(BaseModel):
    tool_name: str
    parameters: Dict[str, Any]

class ToolResponse(BaseModel):
    result: Any
    success: bool
    error: Optional[str] = None
    execution_time: Optional[float] = None

class ValidationRequest(BaseModel):
    config: Dict[str, Any]

class ValidationResponse(BaseModel):
    valid: bool
    message: str
    enhanced_config: Optional[Dict[str, Any]] = None
    workflow_type: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_id: UUID
    config: Dict[str, Any]

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

class WorkflowResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    template_id: UUID
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime
    status: str
    config: Dict[str, Any]
    
    model_config = ConfigDict(from_attributes=True)

class ToolDefinition(BaseModel):
    name: str
    description: str
    function_name: str
    parameters: Dict[str, Any]
    
    model_config = ConfigDict(from_attributes=True)

# Initialize the agentic workflow engine
agentic_engine = AgenticWorkflowEngine()
workflow_checkpointer = WorkflowCheckpointer()

#
# Workflows endpoints
#
@router.get("/workflows", response_model=List[WorkflowResponse])
async def get_workflows(
    skip: int = 0, 
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get all agentic workflows.
    """
    workflows = db.query(Workflow).filter(
        Workflow.created_by_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    return workflows

@router.post("/workflows", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow_in: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new agentic workflow.
    """
    # Check if template exists
    template = db.query(Template).filter(Template.id == workflow_in.template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    # Create workflow
    workflow = Workflow(
        name=workflow_in.name,
        description=workflow_in.description,
        template_id=workflow_in.template_id,
        created_by_id=current_user.id,
        status="created",
        config=workflow_in.config,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    
    return workflow

@router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get a specific agentic workflow.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )
    
    # Check if user has access
    if workflow.created_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    return workflow

@router.put("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: UUID,
    workflow_in: WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update an agentic workflow.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )
    
    # Check if user has access
    if workflow.created_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    # Update fields
    if workflow_in.name is not None:
        workflow.name = workflow_in.name
    if workflow_in.description is not None:
        workflow.description = workflow_in.description
    if workflow_in.config is not None:
        workflow.config = workflow_in.config
    
    workflow.updated_at = datetime.utcnow()
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    
    return workflow

@router.delete("/workflows/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete an agentic workflow.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )
    
    # Check if user has access
    if workflow.created_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    
    db.delete(workflow)
    db.commit()
    
    return None

@router.post("/workflows/{workflow_id}/run", response_model=AgenticExecutionResponse)
async def run_workflow(
    workflow_id: UUID,
    execution_in: AgenticExecutionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Run an agentic workflow.
    """
    # Check if workflow exists and user has access
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
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
        workflow_id=workflow_id,
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
    
    return AgenticExecutionResponse(
        id=execution.id,
        workflow_id=workflow_id,
        started_at=execution.started_at,
        status=execution.status,
        input_data=execution.input_data,
    )

#
# Executions endpoints
#
@router.get("/executions", response_model=List[AgenticExecutionResponse])
async def list_executions(
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
    
    return executions

@router.get("/executions/{execution_id}", response_model=AgenticExecutionResponse)
async def get_execution(
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
    
    return execution

@router.post("/executions/{execution_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_execution(
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

@router.get("/executions/{execution_id}/decisions", response_model=List[AgenticDecision])
async def get_execution_decisions(
    execution_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get decision history for a specific execution.
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
    
    # Get decisions from execution result
    if not execution.result or "decisions" not in execution.result:
        return []
    
    decisions = []
    for decision_data in execution.result.get("decisions", []):
        try:
            decision = AgenticDecision(
                agent_name=decision_data.get("agent_name", "unknown"),
                action_type=decision_data.get("action_type", "unknown"),
                target=decision_data.get("target"),
                content=decision_data.get("content"),
                reasoning=decision_data.get("reasoning"),
                tool_name=decision_data.get("tool_name"),
                tool_params=decision_data.get("tool_params", {}),
                timestamp=datetime.fromisoformat(decision_data.get("timestamp")) if "timestamp" in decision_data else datetime.utcnow()
            )
            decisions.append(decision)
        except Exception as e:
            logger.error(f"Error parsing decision: {e}")
    
    return decisions

#
# Tools endpoints
#
@router.get("/tools", response_model=List[ToolDefinition])
async def get_tools(
    current_user: User = Depends(get_current_active_user),
):
    """
    Get all available tools.
    """
    tools = tool_registry.get_all_tool_definitions()
    return tools

@router.post("/tools/test", response_model=ToolResponse)
async def test_tool(
    tool_request: ToolRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Test a tool with provided parameters.
    """
    try:
        result = await tool_registry.execute_tool(tool_request.tool_name, tool_request.parameters)
        return result
    except Exception as e:
        logger.exception(f"Error testing tool: {e}")
        return {
            "result": None,
            "success": False,
            "error": str(e),
            "execution_time": 0
        }

#
# Validation endpoint
#
@router.post("/validate", response_model=ValidationResponse)
async def validate_workflow(
    validation_request: ValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Validate an agentic workflow configuration.
    """
    try:
        validation_result = await agentic_engine.validate_workflow(validation_request.config)
        return validation_result
    except Exception as e:
        logger.exception(f"Error validating workflow: {e}")
        return {
            "valid": False,
            "message": f"Validation error: {str(e)}"
        }

#
# Background execution function
#
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
