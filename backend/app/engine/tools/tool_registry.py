# backend/app/engine/tools/tool_registry.py
from typing import Dict, List, Any, Optional, Callable, Awaitable, Union
import logging
import importlib
import inspect
import json
import os
import asyncio
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class ToolParameter(BaseModel):
    """Definition of a parameter for a tool"""
    type: str
    description: str
    required: bool = True
    default: Optional[Any] = None
    enum: Optional[List[Any]] = None

class ToolDefinition(BaseModel):
    """Definition of a tool with its parameters and metadata"""
    name: str
    description: str
    function_name: str
    parameters: Dict[str, Dict[str, Any]]
    requires_confirmation: bool = False
    always_available: bool = True
    result_format: Optional[str] = None

class ToolRegistry:
    """
    Central registry for all tools available to agents.
    This class manages tool registration, validation, and execution.
    """
    
    def __init__(self):
        self.tools: Dict[str, Dict[str, Any]] = {}
        self._load_default_tools()
    
    def _load_default_tools(self):
        """Load the default set of tools"""
        try:
            # Register web search tool
            self.register_tool(
                name="web_search",
                description="Search the web for information on a topic",
                function_name="search_web",
                parameters={
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results to return",
                        "default": 5
                    }
                },
                handler=self._web_search_handler
            )
            
            # Register code execution tool
            self.register_tool(
                name="execute_code",
                description="Execute Python code and return the result",
                function_name="execute_python",
                parameters={
                    "code": {
                        "type": "string",
                        "description": "Python code to execute"
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Maximum execution time in seconds",
                        "default": 30
                    }
                },
                handler=self._code_execution_handler,
                requires_confirmation=True
            )
            
            # Register data analysis tool
            self.register_tool(
                name="analyze_data",
                description="Analyze data using pandas",
                function_name="analyze_data",
                parameters={
                    "data_source": {
                        "type": "string",
                        "description": "Path or URL to data source"
                    },
                    "analysis_type": {
                        "type": "string",
                        "description": "Type of analysis to perform",
                        "enum": ["summary", "correlation", "visualization"]
                    }
                },
                handler=self._data_analysis_handler
            )
            
            # Register file operations tool
            self.register_tool(
                name="file_operations",
                description="Read or write files",
                function_name="file_ops",
                parameters={
                    "operation": {
                        "type": "string", 
                        "description": "Operation to perform",
                        "enum": ["read", "write", "append"]
                    },
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write (for write/append operations)",
                        "required": False
                    }
                },
                handler=self._file_operations_handler,
                requires_confirmation=True
            )
            
            logger.info(f"Loaded {len(self.tools)} default tools")
        except Exception as e:
            logger.error(f"Error loading default tools: {e}")
    
    def register_tool(self, name: str, description: str, function_name: str, 
                     parameters: Dict[str, Dict[str, Any]], handler: Callable, 
                     requires_confirmation: bool = False, always_available: bool = True,
                     result_format: Optional[str] = None) -> None:
        """
        Register a new tool with the registry
        
        Args:
            name: Tool name (must be unique)
            description: Human-readable description of what the tool does
            function_name: Name of the function to call
            parameters: Dictionary of parameter definitions
            handler: Callable or coroutine function that implements the tool
            requires_confirmation: Whether this tool requires user confirmation before execution
            always_available: Whether this tool is always available to all agents
            result_format: Optional format string for the result (for documentation)
        """
        if name in self.tools:
            logger.warning(f"Tool {name} already registered, overwriting")
        
        # Create the tool definition
        tool_def = ToolDefinition(
            name=name,
            description=description,
            function_name=function_name,
            parameters=parameters,
            requires_confirmation=requires_confirmation,
            always_available=always_available,
            result_format=result_format
        )
        
        # Register the tool
        self.tools[name] = {
            "definition": tool_def.dict(),
            "handler": handler,
            "is_async": asyncio.iscoroutinefunction(handler)
        }
        
        logger.info(f"Registered tool: {name}")
    
    def get_tool_definition(self, name: str) -> Optional[Dict[str, Any]]:
        """Get the definition of a registered tool"""
        if name not in self.tools:
            logger.warning(f"Tool {name} not found in registry")
            return None
        
        return self.tools[name]["definition"]
    
    def get_all_tool_definitions(self) -> List[Dict[str, Any]]:
        """Get definitions of all registered tools"""
        return [tool["definition"] for tool in self.tools.values()]
    
    def get_tools_for_agent(self, agent_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Get tool definitions available for a specific agent based on its configuration
        
        Args:
            agent_config: The agent's configuration
            
        Returns:
            List of tool definitions available to this agent
        """
        if "tools" not in agent_config or not agent_config["tools"]:
            return []
        
        requested_tools = agent_config["tools"]
        available_tools = []
        
        for tool_name in requested_tools:
            if tool_name in self.tools:
                available_tools.append(self.tools[tool_name]["definition"])
            else:
                logger.warning(f"Tool {tool_name} requested by agent but not found in registry")
        
        return available_tools
    
    async def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool with the given parameters
        
        Args:
            tool_name: Name of the tool to execute
            parameters: Parameters to pass to the tool
            
        Returns:
            Result of the tool execution
        """
        if tool_name not in self.tools:
            return {"error": f"Tool {tool_name} not found", "success": False}
        
        tool = self.tools[tool_name]
        tool_def = tool["definition"]
        handler = tool["handler"]
        is_async = tool["is_async"]
        
        # Validate parameters
        param_errors = []
        processed_params = {}
        
        for param_name, param_def in tool_def["parameters"].items():
            required = param_def.get("required", True)
            
            if param_name not in parameters:
                if required:
                    param_errors.append(f"Missing required parameter: {param_name}")
                else:
                    # Use default value if available
                    if "default" in param_def:
                        processed_params[param_name] = param_def["default"]
                continue
            
            # Get the parameter value
            value = parameters[param_name]
            
            # Validate parameter type
            param_type = param_def.get("type", "string")
            try:
                if param_type == "string":
                    processed_params[param_name] = str(value)
                elif param_type == "integer":
                    processed_params[param_name] = int(value)
                elif param_type == "number":
                    processed_params[param_name] = float(value)
                elif param_type == "boolean":
                    processed_params[param_name] = bool(value)
                elif param_type == "array":
                    if not isinstance(value, list):
                        param_errors.append(f"Parameter {param_name} must be an array")
                    else:
                        processed_params[param_name] = value
                elif param_type == "object":
                    if not isinstance(value, dict):
                        param_errors.append(f"Parameter {param_name} must be an object")
                    else:
                        processed_params[param_name] = value
                else:
                    # Unknown type, just pass it through
                    processed_params[param_name] = value
            except (ValueError, TypeError):
                param_errors.append(f"Invalid type for parameter {param_name}: expected {param_type}")
            
            # Validate enum values if specified
            if "enum" in param_def and value not in param_def["enum"]:
                param_errors.append(f"Value for {param_name} must be one of: {', '.join(map(str, param_def['enum']))}")
        
        if param_errors:
            return {
                "error": "Parameter validation errors: " + "; ".join(param_errors),
                "success": False
            }
        
        try:
            # Execute the tool
            start_time = datetime.now()
            
            if is_async:
                result = await handler(**processed_params)
            else:
                result = handler(**processed_params)
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Format the result
            if isinstance(result, dict):
                result["success"] = result.get("success", True)
                result["execution_time"] = execution_time
                return result
            else:
                return {
                    "result": result,
                    "success": True,
                    "execution_time": execution_time
                }
                
        except Exception as e:
            logger.exception(f"Error executing tool {tool_name}: {e}")
            return {
                "error": f"Tool execution error: {str(e)}",
                "success": False
            }
    
    # Default tool handlers
    async def _web_search_handler(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """Handler for web search tool"""
        logger.info(f"Web search for: {query}")
        
        # This would be replaced with an actual API call in production
        # For development, return mock results
        mock_results = [
            {
                "title": f"Result {i+1} for {query}",
                "snippet": f"This is a snippet of text from result {i+1} about {query}...",
                "url": f"https://example.com/result{i+1}"
            }
            for i in range(min(num_results, 10))
        ]
        
        return {
            "results": mock_results,
            "query": query,
            "success": True
        }
    
    async def _code_execution_handler(self, code: str, timeout: int = 30) -> Dict[str, Any]:
        """Handler for code execution tool"""
        logger.info(f"Executing code (timeout: {timeout}s)")
        
        try:
            # For security reasons, we'll just log the code in development
            # In production, this would use a secure sandbox
            logger.debug(f"Code to execute: {code}")
            
            # Simulate execution
            await asyncio.sleep(0.5)
            
            return {
                "output": "Code execution simulated for development purposes. Here would be the output.",
                "success": True
            }
        except Exception as e:
            return {
                "error": f"Code execution failed: {str(e)}",
                "success": False
            }
    
    async def _data_analysis_handler(self, data_source: str, analysis_type: str) -> Dict[str, Any]:
        """Handler for data analysis tool"""
        logger.info(f"Analyzing data from {data_source} using {analysis_type}")
        
        # This would integrate with pandas, numpy, etc. in production
        mock_analysis = {
            "summary": {
                "count": 100,
                "mean": 42.5,
                "median": 41.2,
                "std": 12.3
            },
            "correlation": None,
            "visualization": None
        }
        
        if analysis_type == "summary":
            return {
                "analysis": mock_analysis["summary"],
                "type": analysis_type,
                "source": data_source,
                "success": True
            }
        elif analysis_type == "correlation":
            return {
                "analysis": {
                    "correlation_matrix": "Correlation matrix would be here in production"
                },
                "type": analysis_type,
                "source": data_source,
                "success": True
            }
        elif analysis_type == "visualization":
            return {
                "analysis": {
                    "visualization_type": "In production, this would contain visualization data or a URL"
                },
                "type": analysis_type,
                "source": data_source,
                "success": True
            }
        else:
            return {
                "error": f"Unknown analysis type: {analysis_type}",
                "success": False
            }
    
    async def _file_operations_handler(self, operation: str, file_path: str, content: Optional[str] = None) -> Dict[str, Any]:
        """Handler for file operations tool"""
        logger.info(f"File operation: {operation} on {file_path}")
        
        # This would be a real implementation in production
        # For now, just simulate operations
        if operation == "read":
            return {
                "content": f"This would be the content of {file_path} in production",
                "success": True
            }
        elif operation in ["write", "append"]:
            if not content:
                return {
                    "error": "Content is required for write/append operations",
                    "success": False
                }
            
            logger.debug(f"Would {operation} to {file_path}: {content[:50]}...")
            return {
                "bytes_written": len(content),
                "success": True
            }
        else:
            return {
                "error": f"Unknown operation: {operation}",
                "success": False
            }

# Create a global tool registry instance
tool_registry = ToolRegistry()

# Export the tool registry
__all__ = ["tool_registry", "ToolDefinition", "ToolParameter"]
