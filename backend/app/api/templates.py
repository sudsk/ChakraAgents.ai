# app/api/templates.py
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.models import Template, User
from app.db.session import get_db
from pydantic import BaseModel, ConfigDict  # Add ConfigDict here

router = APIRouter(prefix="/templates", tags=["templates"])

# Pydantic models for API
class ToolDefinition(BaseModel):
    name: str
    description: str
    function_name: str
    parameters: dict

class AgentConfig(BaseModel):
    name: str
    role: str
    model_provider: str
    model_name: str
    prompt_template: str
    system_message: Optional[str] = None
    tools: Optional[List[str]] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None

class WorkflowConfig(BaseModel):
    max_iterations: int = 3
    checkpoint_dir: Optional[str] = None
    interaction_type: Optional[str] = None
    hub_agent: Optional[str] = None
    enable_logging: bool = False

class TemplateConfig(BaseModel):
    supervisor: Optional[AgentConfig] = None
    workers: Optional[List[AgentConfig]] = []
    agents: Optional[List[AgentConfig]] = []
    tools: Optional[List[ToolDefinition]] = []
    workflow_config: Optional[WorkflowConfig] = None

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    workflow_type: str
    config: TemplateConfig

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    workflow_type: Optional[str] = None
    config: Optional[TemplateConfig] = None

class TemplateResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    workflow_type: str
    created_by_id: UUID
    config: TemplateConfig
    
    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=List[TemplateResponse])
def get_templates(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get all templates.
    """
    templates = db.query(Template).offset(skip).limit(limit).all()
    return templates

@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    template_in: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new template.
    """
    template = Template(
        name=template_in.name,
        description=template_in.description,
        workflow_type=template_in.workflow_type,
        config=template_in.config.dict(exclude_unset=True),
        created_by_id=current_user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get a specific template by ID.
    """
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    return template

@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: UUID,
    template_in: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update a template.
    """
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    update_data = template_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "config" and value is not None:
            setattr(template, field, value)
        elif value is not None:
            setattr(template, field, value)
    
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a template.
    """
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    db.delete(template)
    db.commit()
    return None
