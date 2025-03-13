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
    # vector_store_id = Column(UUID(as_uuid=True), ForeignKey("vector_stores.id"), nullable=True)
    vector_store_id = Column(String, nullable=True)  # Optional reference to a specific vector store
    
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

class VectorStore(Base):
    __tablename__ = "vector_stores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    store_type = Column(String, nullable=False)  # 'chroma', 'faiss', etc.
    embedding_model = Column(String, nullable=False)  # 'vertex_ai', 'openai', etc.
    embedding_dimensions = Column(Integer, nullable=False, default=768)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    config = Column(JSONB, nullable=False, default={})  # Store store-specific configuration
    path = Column(String)  # Path to vector store files if local
    
    # Relationships
    created_by = relationship("User", back_populates="vector_stores")
    documents = relationship("Document", back_populates="vector_store")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # pdf, txt, etc.
    file_size = Column(Integer)  # Size in bytes
    num_chunks = Column(Integer)  # Number of chunks created
    status = Column(String, default="uploaded")  # uploaded, processing, indexed, error
    error_message = Column(Text)  # Error message if processing failed
    #metadata = Column(JSONB, nullable=False, default={})  # Document metadata
    vector_store_id = Column(UUID(as_uuid=True), ForeignKey("vector_stores.id"))
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    vector_store = relationship("VectorStore", back_populates="documents")
    created_by = relationship("User", back_populates="documents")


# Update User model to include these relationships
User.vector_stores = relationship("VectorStore", back_populates="created_by")
User.documents = relationship("Document", back_populates="created_by")

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
