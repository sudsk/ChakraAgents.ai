# backend/app/engine/engine_factory.py
from typing import Dict, Any, Optional

from app.engine.workflow_engine import WorkflowEngine
from app.engine.hybrid_workflow_engine import HybridWorkflowEngine

class WorkflowEngineFactory:
    """Factory for creating workflow engines based on workflow type"""
    
    _instance = None
    _engines = {}
    
    @classmethod
    def get_instance(cls):
        """Get or create the singleton instance"""
        if cls._instance is None:
            cls._instance = WorkflowEngineFactory()
        return cls._instance
    
    def get_engine(self, workflow_type: str) -> WorkflowEngine:
        """Get the appropriate workflow engine for the given workflow type"""
        if workflow_type not in self._engines:
            if workflow_type == "hybrid":
                self._engines[workflow_type] = HybridWorkflowEngine()
            else:
                self._engines[workflow_type] = WorkflowEngine()
        
        return self._engines[workflow_type]

# Convenience function to get an engine
def get_workflow_engine(workflow_type: str) -> WorkflowEngine:
    """Get the appropriate workflow engine for the given workflow type"""
    return WorkflowEngineFactory.get_instance().get_engine(workflow_type)
