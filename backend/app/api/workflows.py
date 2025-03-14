# app/api/workflows.py

from typing import Dict, List, Optional, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.models import Workflow, Template, User
from app.db.session import get_db
from pydantic import BaseModel, ConfigDict  # Add ConfigDict here

router = APIRouter(prefix="/workflows", tags=["workflows"])

# Pydantic models for API
class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_id: UUID
    config: Dict[str, Any] = {}

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    status: Optional[str] = None

class WorkflowResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    template_id: UUID
    created_by_id: UUID
    status: str
    config: Dict[str, Any]
    
    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=List[WorkflowResponse])
def get_workflows(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get all workflows for the current user.
    """
    workflows = db.query(Workflow).filter(Workflow.created_by_id == current_user.id).offset(skip).limit(limit).all()
    return workflows

@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow(
    workflow_in: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new workflow.
    """
    # Check if template exists
    template = db.query(Template).filter(Template.id == workflow_in.template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    workflow = Workflow(
        name=workflow_in.name,
        description=workflow_in.description,
        template_id=workflow_in.template_id,
        config=workflow_in.config,
        created_by_id=current_user.id,
        status="created",
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow

@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get a specific workflow by ID.
    """
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
    return workflow

@router.put("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(
    workflow_id: UUID,
    workflow_in: WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update a workflow.
    """
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
    
    update_data = workflow_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        if value is not None:
            setattr(workflow, field, value)
    
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow

@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    workflow_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a workflow.
    """
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
    
    db.delete(workflow)
    db.commit()
    return None
