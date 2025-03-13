# backend/app/engine/agentic_workflow_engine.py
import logging
import json
import asyncio
import os
from typing import Dict, List, Any, Optional, Union, TypedDict, Annotated, Literal, cast
from datetime import datetime
import uuid
from pathlib import Path
import inspect

from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage, FunctionMessage
from langchain_core.tools import BaseTool, tool
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable, RunnableConfig

from app.engine.llm_providers import llm_provider_manager
from app.core.config import settings
from app.db.models import Template, Workflow, WorkflowExecution, ExecutionLog
from app.engine.tools.enhanced_rag_tool import EnhancedRAGTool
from app.db.vector_store import VectorStoreManager
from app.engine.langgraph_workflow_runner import LangGraphWorkflowRunner
from app.engine.agent_prompt_creator import AgentPromptCreator
from app.engine.agent_decision_parser import AgentDecisionParser

logger = logging.getLogger(__name__)

class AgenticWorkflowEngine:
    """
    Enhanced workflow engine that uses LangGraph for dynamic agentic decision making
    """
    
    def __init__(self):
        self.llm_provider = llm_provider_manager
        self.vector_store = VectorStoreManager()
        self.rag_tool = EnhancedRAGTool(vector_store_manager=self.vector_store)
        
        # Register available tools
        self.available_tools = {
            "retrieve_information": self.rag_tool.retrieve_information,
            "web_search": self._web_search_tool,
            "execute_code": self._code_execution_tool,
            "analyze_data": self._data_analysis_tool,
        }
        
        # Additional configuration
        self.checkpoint_dir = settings.CHECKPOINT_DIR
        os.makedirs(self.checkpoint_dir, exist_ok=True)

    async def execute_workflow(self, template: Template, workflow: Workflow, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a workflow with the given input data using its template with agentic capabilities"""
        logger.info(f"Executing agentic workflow: {workflow.name} (ID: {workflow.id})")
        
        start_time = datetime.now()
        
        try:
            # Extract configuration from template and workflow
            workflow_type = template.workflow_type
            template_config = template.config
            workflow_config = workflow.config
            
            # Merge template and workflow configs, with workflow config taking precedence
            merged_config = self._merge_configs(template_config, workflow_config)
            
            # Create checkpoint directory if needed
            checkpoint_dir = merged_config.get("workflow_config", {}).get("checkpoint_dir", self.checkpoint_dir)
            os.makedirs(checkpoint_dir, exist_ok=True)
            
            # Create LangGraph workflow runner with agentic capabilities
            execution_id = str(uuid.uuid4())
            workflow_runner = LangGraphWorkflowRunner(template, workflow)
            
            # Execute the workflow using LangGraph
            logger.info(f"Starting agentic workflow execution for {workflow_type}")
            
            # Execute the workflow
            result = await workflow_runner.execute(input_data, execution_id=execution_id)
            
            # Calculate execution time
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"Workflow execution completed in {execution_time:.2f} seconds")
            
            # Add execution time to the result
            result["execution_time"] = execution_time
            result["success"] = True
            
            return result
            
        except Exception as e:
            logger.exception(f"Error executing workflow: {str(e)}")
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return {
                "success": False,
                "error": str(e),
                "execution_time": execution_time
            }

    def _merge_configs(self, template_config: Dict[str, Any], workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        """Merge template and workflow configurations, with workflow config taking precedence"""
        merged = template_config.copy()
        
        # Deep merge the configs
        for key, value in workflow_config.items():
            if isinstance(value, dict) and key in merged and isinstance(merged[key], dict):
                merged[key] = self._merge_configs(merged[key], value)
            else:
                merged[key] = value
                
        return merged
    
    # Tool implementations
    async def _web_search_tool(self, query: str) -> str:
        """Simple web search tool implementation"""
        logger.info(f"Executing web search for: {query}")
        # In a real implementation, this would call a search API
        return f"Web search results for: {query}\n- Result 1\n- Result 2\n- Result 3"
    
    async def _code_execution_tool(self, code: str) -> str:
        """Execute Python code and return the result"""
        logger.info(f"Executing code: {code[:100]}...")
        try:
            # In a real implementation, this would use a sandboxed environment
            result = "Code execution is disabled for security reasons."
            return f"Code execution result:\n{result}"
        except Exception as e:
            return f"Error executing code: {str(e)}"
    
    async def _data_analysis_tool(self, data_source: str, analysis_type: str) -> str:
        """Analyze data and return the result"""
        logger.info(f"Analyzing data from {data_source} using {analysis_type}")
        # In a real implementation, this would use pandas/numpy
        return f"Analysis of {data_source} using {analysis_type}:\n- Finding 1\n- Finding 2\n- Finding 3"

    async def deploy_as_api(self, workflow_id: str, version: str = "v1") -> Dict[str, Any]:
        """Deploy a workflow as an API endpoint"""
        logger.info(f"Deploying workflow {workflow_id} as API endpoint")
        
        # This would be implemented to:
        # 1. Generate a unique API key
        # 2. Register the endpoint in the API gateway
        # 3. Create a deployment record
        # 4. Return the endpoint URL and API key
        
        # Simplified implementation
        api_key = f"wf_{uuid.uuid4().hex[:16]}"
        endpoint_url = f"/api/{version}/workflows/{workflow_id}/execute"
        
        return {
            "api_key": api_key,
            "endpoint_url": endpoint_url,
            "version": version,
            "status": "active"
        }

    async def validate_workflow(self, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate a workflow configuration for agentic capabilities
        
        Args:
            workflow_config: The workflow configuration to validate
            
        Returns:
            Dictionary with validation results
        """
        try:
            # Check for required components
            if not workflow_config.get("supervisor"):
                return {
                    "valid": False,
                    "message": "Supervisor agent is required for agentic workflows"
                }
            
            supervisor = workflow_config.get("supervisor", {})
            if not supervisor.get("name") or not supervisor.get("model_provider") or not supervisor.get("model_name"):
                return {
                    "valid": False,
                    "message": "Supervisor agent requires name, model_provider, and model_name"
                }
            
            # Check worker agents if present
            workers = workflow_config.get("workers", [])
            for i, worker in enumerate(workers):
                if not worker.get("name") or not worker.get("model_provider") or not worker.get("model_name"):
                    return {
                        "valid": False,
                        "message": f"Worker agent at index {i} requires name, model_provider, and model_name"
                    }
            
            # Validate execution graph if present
            execution_graph = workflow_config.get("execution_graph", {})
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
            
            # Enhance the configuration with agentic capabilities
            enhanced_config = workflow_config.copy()
            enhanced_config = AgentPromptCreator.enhance_template_with_agentic_capabilities(enhanced_config)
            
            return {
                "valid": True,
                "message": "Configuration is valid",
                "enhanced_config": enhanced_config
            }
        except Exception as e:
            logger.exception(f"Error validating workflow: {str(e)}")
            return {
                "valid": False,
                "message": f"Validation error: {str(e)}"
            }
