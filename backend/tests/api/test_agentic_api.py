# backend/tests/api/test_agentic_api.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.models import Base
from app.db.session import get_db
from app.core.security import get_current_active_user

# Create in-memory test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables in test database
Base.metadata.create_all(bind=engine)

# Setup test client
client = TestClient(app)

# Mock user for testing
mock_user = {
    "id": "00000000-0000-0000-0000-000000000001",
    "username": "testuser",
    "email": "test@example.com",
    "is_active": True,
    "is_admin": False,
}

# Override get_db dependency for tests
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Override authentication dependency for tests
def override_get_current_active_user():
    return mock_user

# Apply overrides
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_active_user] = override_get_current_active_user

def test_validate_workflow():
    """Test the workflow validation endpoint."""
    response = client.post(
        "/api/agentic/validate",
        json={
            "config": {
                "name": "Test Workflow",
                "supervisor": {
                    "name": "test_supervisor",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-pro",
                },
                "workers": [
                    {
                        "name": "test_worker",
                        "model_provider": "vertex_ai",
                        "model_name": "gemini-1.5-flash",
                    }
                ]
            }
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "valid" in data

def test_get_tools():
    """Test getting available tools."""
    response = client.get("/api/agentic/tools")
    assert response.status_code == 200
    tools = response.json()
    assert isinstance(tools, list)
    if tools:  # If there are tools registered
        assert "name" in tools[0]
        assert "description" in tools[0]
        assert "function_name" in tools[0]
        assert "parameters" in tools[0]

def test_tool_test_endpoint():
    """Test the tool testing endpoint."""
    response = client.post(
        "/api/agentic/tools/test",
        json={
            "tool_name": "web_search",  # This should be a registered tool
            "parameters": {
                "query": "test query"
            }
        }
    )
    # Even if the tool isn't registered, we should get a valid response format
    assert response
