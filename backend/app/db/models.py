# app/db/models.py
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    templates = relationship("Template", back_populates="created_by")
    workflows = relationship("Workflow", back_populates="created_by")

class Template(Base):
    __tablename__ = "templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    workflow_type = Column(String, nullable=False)  # 'supervisor', 'swarm',  'rag', or 'hybrid'
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    config = Column(JSONB, nullable=False)  # Store JSON configuration
    rag_enabled = Column(Boolean, default=False)
    vector_store_id = Column(UUID(as_uuid=True), ForeignKey("vector_stores.id"), nullable=True)
    
    # Relationships
    created_by = relationship("User", back_populates="templates")
    workflows = relationship("Workflow", back_populates="template")

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.id"))
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String, default="created")  # created, running, completed, failed
    config = Column(JSONB, nullable=False)  # Workflow-specific configuration

    # Relationships
    template = relationship("Template", back_populates="workflows")
    created_by = relationship("User", back_populates="workflows")
    executions = relationship("WorkflowExecution", back_populates="workflow")

class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"))
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="running")  # running, completed, failed
    input_data = Column(JSONB, nullable=True, default={})  # Input parameters
    result = Column(JSONB, nullable=True, default={})  # Execution result
    error = Column(Text, nullable=True)  # Error message if failed
    checkpoint_path = Column(String, nullable=True)  # Path to checkpoint file

    # Relationships
    workflow = relationship("Workflow", back_populates="executions")
    logs = relationship("ExecutionLog", back_populates="execution")

class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("workflow_executions.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    level = Column(String, default="info")  # info, warning, error
    agent = Column(String, nullable=True)  # Agent name if applicable
    message = Column(Text, nullable=False)
    data = Column(JSONB, nullable=True)  # Additional structured data

    # Relationships
    execution = relationship("WorkflowExecution", back_populates="logs")

# Create indexes for common queries
# Note: These are SQLAlchemy event listeners that will create indexes when tables are created
from sqlalchemy import event, text

@event.listens_for(Template.__table__, "after_create")
def create_template_indexes(target, connection, **kw):
    # First enable the pg_trgm extension
    connection.execute(text('CREATE EXTENSION IF NOT EXISTS pg_trgm;'))
    # Index for searching templates by name
    connection.execute(text('CREATE INDEX idx_template_name ON templates USING gin (name gin_trgm_ops);'))
    # Index for filtering templates by workflow_type
    connection.execute(text('CREATE INDEX idx_template_workflow_type ON templates (workflow_type);'))

@event.listens_for(WorkflowExecution.__table__, "after_create")
def create_execution_indexes(target, connection, **kw):
    # First enable the pg_trgm extension
    connection.execute(text('CREATE EXTENSION IF NOT EXISTS pg_trgm;'))    
    # Index for filtering executions by status
    connection.execute(text('CREATE INDEX idx_execution_status ON workflow_executions (status);'))
    # Index for sorting executions by start time
    connection.execute(text('CREATE INDEX idx_execution_started_at ON workflow_executions (started_at DESC);'))
