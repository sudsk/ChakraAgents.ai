# app/engine/core/workflow_engine.py
import logging
import json
import asyncio
import os
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import uuid
from pathlib import Path

from app.engine.providers.llm_provider_manager import llm_provider_manager
from app.core.config import settings
from app.db.models import Template, Workflow, WorkflowExecution, ExecutionLog
from app.engine.tools.rag_tool import RAGTool
from app.db.vector_store import VectorStoreManager

logger = logging.getLogger(__name__)

class WorkflowEngine:
    """Base engine for executing all types of workflows based on templates"""
    
    def __init__(self):
        self.llm_provider = llm_provider_manager
        self.rag_tool = RAGTool(vector_store_manager=VectorStoreManager())
        self.registered_tools = {
            "retrieve_information": self.rag_tool.retrieve_information
        }   

    async def execute_workflow(self, template: Template, workflow: Workflow, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a workflow with the given input data using its template"""
        logger.info(f"Executing workflow: {workflow.name} (ID: {workflow.id})")
        
        start_time = datetime.now()
        
        try:
            # Extract configuration from template and workflow
            workflow_type = template.workflow_type
            template_config = template.config
            workflow_config = workflow.config
            
            # Merge template and workflow configs, with workflow config taking precedence
            merged_config = self._merge_configs(template_config, workflow_config)      

            # Create checkpoint directory if needed
            checkpoint_dir = merged_config.get("workflow_config", {}).get("checkpoint_dir", settings.CHECKPOINT_DIR)
            os.makedirs(checkpoint_dir, exist_ok=True)
            
            # Execute based on workflow type
            if workflow_type == "rag":
                # Special workflow type for RAG-only flows
                query = input_data.get("query", "")
                if not query:
                    raise ValueError("No query provided in input data for RAG workflow")
                result = await self.execute_rag_workflow(query, merged_config)
            elif workflow_type == "supervisor":
                result = await self.execute_supervisor_workflow(merged_config, input_data)
            elif workflow_type == "swarm":
                result = await self.execute_swarm_workflow(merged_config, input_data)
            else:
                raise ValueError(f"Unsupported workflow type: {workflow_type}")
            
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"Workflow execution completed in {execution_time:.2f} seconds")
            
            return {
                "success": True,
                "execution_time": execution_time,
                **result
            }
            
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
        
    async def execute_rag_workflow(self, query: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a simple RAG workflow without complex agent interactions"""
        logger.info("Executing RAG workflow")
        
        try:
            # Get configuration for RAG workflow
            model_provider = config.get("model_provider", "vertex_ai")
            model_name = config.get("model_name", "gemini-1.5-pro")
            system_message = config.get("system_message", "")
            temperature = config.get("temperature", 0.3)
            num_results = config.get("num_results", 5)
            
            # Retrieve relevant information
            logger.info(f"Retrieving information for query: {query}")
            context = await self.execute_tool("retrieve_information", query=query, num_results=num_results)
            
            # Create prompt with context
            prompt = f"""Please answer the following question based on the provided context.
If the context doesn't contain relevant information, say so and answer based on your general knowledge.

Question: {query}

Context:
{context}
"""
            
            # Generate response
            logger.info(f"Generating RAG response using {model_provider}/{model_name}")
            response = await self.llm_provider.generate_response(
                provider_name=model_provider,
                model_name=model_name,
                prompt=prompt,
                system_message=system_message,
                temperature=temperature
            )
            
            return {
                "success": True,
                "messages": [
                    {"role": "user", "content": query},
                    {"role": "assistant", "content": response.get("content", "")}
                ],
                "context": context,
                "model": f"{model_provider}/{model_name}"
            }
            
        except Exception as e:
            logger.exception(f"Error executing RAG workflow: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def execute_supervisor_workflow(self, config: Dict[str, Any], input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a supervisor-worker type workflow"""
        logger.info("Executing supervisor workflow")
        
        supervisor = config.get("supervisor", {})
        workers = config.get("workers", [])
        tools = config.get("tools", [])
        workflow_config = config.get("workflow_config", {})
        
        if not supervisor:
            raise ValueError("Supervisor template missing supervisor configuration")
        
        if not workers:
            raise ValueError("Supervisor template has no workers")
        
        # Get query from input data
        query = input_data.get("query", "")
        if not query:
            raise ValueError("No query provided in input data")
        
        # 1. Process with supervisor to determine which workers to use
        supervisor_model_provider = supervisor.get("model_provider", "vertex_ai")
        supervisor_model_name = supervisor.get("model_name", "gemini-1.5-pro")
        supervisor_prompt_template = supervisor.get("prompt_template", "")
        supervisor_system_message = supervisor.get("system_message", "")
        
        # Replace placeholders in prompt template
        supervisor_prompt = supervisor_prompt_template.replace("{input}", query)
        
        # Add available workers information to prompt
        workers_info = "\n\nAvailable workers:\n" + "\n".join([
            f"- {worker.get('name', 'unnamed')}: {worker.get('role', 'worker')} - {worker.get('description', 'No description')}"
            for worker in workers
        ])
        supervisor_prompt += workers_info

        # Add available tools information if any
        if tools:
            tools_info = "\n\nAvailable tools:\n" + "\n".join([
                f"- {tool.get('name', 'unnamed')}: {tool.get('description', 'No description')}" 
                for tool in tools
            ])
            supervisor_prompt += tools_info
            
        # Get supervisor response
        supervisor_response = await self.llm_provider.generate_response(
            provider_name=supervisor_model_provider,
            model_name=supervisor_model_name,
            prompt=supervisor_prompt,
            system_message=supervisor_system_message,
            temperature=supervisor.get("temperature", 0.7),
            max_tokens=supervisor.get("max_tokens")
        )
        
        logger.info(f"Supervisor response received")
        
        # 2. Process with workers based on supervisor's decision
        worker_outputs = {}
        worker_usage = []
        
        max_iterations = workflow_config.get("max_iterations", 3)
        current_iteration = 0

        # Parse supervisor response to identify which workers to use
        # For now, we'll use a simple approach and use all workers
        # In a more advanced implementation, you could parse the response to determine this
        selected_workers = workers

        while current_iteration < max_iterations:
            current_iteration += 1
            logger.info(f"Starting worker iteration {current_iteration}/{max_iterations}")
            
            for worker in selected_workers:
                worker_name = worker.get("name", f"worker_{uuid.uuid4().hex[:8]}")
                worker_role = worker.get("role", "worker")
                worker_model_provider = worker.get("model_provider", "vertex_ai")
                worker_model_name = worker.get("model_name", "gemini-1.5-flash")
                worker_prompt_template = worker.get("prompt_template", "")
                worker_system_message = worker.get("system_message", "")
            
                # Replace placeholders in prompt template
                worker_prompt = worker_prompt_template.replace("{input}", query)
                worker_prompt = worker_prompt.replace("{supervisor_response}", supervisor_response.get("content", ""))
                
                # Add context from other workers if available
                if worker_outputs:
                    context = "\n\n".join([f"{name}: {output}" for name, output in worker_outputs.items()])
                    worker_prompt = worker_prompt.replace("{worker_outputs}", context)
                else:
                    worker_prompt = worker_prompt.replace("{worker_outputs}", "No worker outputs yet")

                # Check if worker has tools and process them
                worker_tools = worker.get("tools", [])
                if worker_tools and "retrieve_information" in worker_tools:
                    # Worker has RAG capabilities, retrieve relevant information
                    logger.info(f"Worker {worker_name} is using RAG capabilities")
                    rag_results = await self.execute_tool("retrieve_information", query=query, num_results=5)
                    worker_prompt = worker_prompt.replace("{retrieved_information}", rag_results)
                else:
                    worker_prompt = worker_prompt.replace("{retrieved_information}", "No information retrieved")
                    
                logger.info(f"Executing worker: {worker_name}")
                
                # Get worker response
                worker_response = await self.llm_provider.generate_response(
                    provider_name=worker_model_provider,
                    model_name=worker_model_name,
                    prompt=worker_prompt,
                    system_message=worker_system_message,
                    temperature=worker.get("temperature", 0.7),
                    max_tokens=worker.get("max_tokens")
                )

                worker_output = worker_response.get("content", "")
                worker_outputs[worker_name] = worker_output
                
                worker_usage.append({
                    "iteration": current_iteration,
                    "worker": worker_name,
                    "role": worker_role,
                    "model": f"{worker_model_provider}/{worker_model_name}",
                    "output_length": len(worker_output)
                })
                
                logger.info(f"Worker {worker_name} completed")
            
            # In future iterations, could selectively re-run certain workers
            # For now, we'll break after one iteration
            break
            
        # 3. Final response: Have supervisor synthesize worker outputs
        if current_iteration > 0 and len(worker_outputs) > 0:
            synthesis_prompt = f"Based on your initial analysis and the work from your team, provide a final response to: {query}\n\n"
            synthesis_prompt += "Worker outputs:\n"
            synthesis_prompt += "\n\n".join([f"{name}: {output}" for name, output in worker_outputs.items()])
            
            final_response = await self.llm_provider.generate_response(
                provider_name=supervisor_model_provider,
                model_name=supervisor_model_name,
                prompt=synthesis_prompt,
                system_message=supervisor_system_message,
                temperature=supervisor.get("temperature", 0.5),  # Lower temperature for synthesis
                max_tokens=supervisor.get("max_tokens")
            )
            
            final_output = final_response.get("content", "")
        else:
            final_output = supervisor_response.get("content", "")
            
        # 4. Return the combined results
        return {
            "messages": [
                {"role": "user", "content": query},
                {"role": "assistant", "content": final_output}
            ],
            "outputs": worker_outputs,
            "worker_usage": worker_usage,
            "iterations": current_iteration
        }        
    
    async def execute_swarm_workflow(self, config: Dict[str, Any], input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a swarm type workflow"""
        logger.info("Executing swarm workflow")
        
        agents = config.get("agents", [])
        tools = config.get("tools", [])
        workflow_config = config.get("workflow_config", {})
        
        if not agents:
            raise ValueError("Swarm template has no agents")
        
        # Get query from input data
        query = input_data.get("query", "")
        if not query:
            raise ValueError("No query provided in input data")
        
        # Process the query with each agent
        agent_outputs = {}
        agent_usage = []
        max_iterations = workflow_config.get("max_iterations", 3)
        interaction_type = workflow_config.get("interaction_type", "sequential")
        
        if interaction_type == "sequential":
            # Sequential processing - each agent processes in turn
            previous_outputs = {}
            
            for iteration in range(max_iterations):
                logger.info(f"Starting sequential iteration {iteration+1}/{max_iterations}")
                iteration_outputs = {}
                
                for agent in agents:
                    agent_name = agent.get("name", f"agent_{uuid.uuid4().hex[:8]}")
                    agent_role = agent.get("role", "agent")
                    agent_model_provider = agent.get("model_provider", "vertex_ai")
                    agent_model_name = agent.get("model_name", "gemini-1.5-flash")
                    agent_prompt_template = agent.get("prompt_template", "")
                    agent_system_message = agent.get("system_message", "")
                    
                    # Replace placeholders in prompt template
                    agent_prompt = agent_prompt_template.replace("{input}", query)
                    
                    # Add previous outputs to context if any
                    if previous_outputs:
                        previous_outputs_text = "\n\n".join([f"{name}: {output}" for name, output in previous_outputs.items()])
                        agent_prompt = agent_prompt.replace("{previous_outputs}", previous_outputs_text)
                    else:
                        agent_prompt = agent_prompt.replace("{previous_outputs}", "No previous outputs")

                    # Check if agent has RAG capabilities
                    agent_tools = agent.get("tools", [])
                    if agent_tools and "retrieve_information" in agent_tools:
                        # Agent has RAG capabilities, retrieve relevant information
                        logger.info(f"Agent {agent_name} is using RAG capabilities")
                        rag_results = await self.execute_tool("retrieve_information", query=query, num_results=5)
                        agent_prompt = agent_prompt.replace("{retrieved_information}", rag_results)
                    else:
                        agent_prompt = agent_prompt.replace("{retrieved_information}", "No information retrieved")
                        
                    logger.info(f"Executing agent: {agent_name}")
                    
                    # Get agent response
                    agent_response = await self.llm_provider.generate_response(
                        provider_name=agent_model_provider,
                        model_name=agent_model_name,
                        prompt=agent_prompt,
                        system_message=agent_system_message,
                        temperature=agent.get("temperature", 0.7),
                        max_tokens=agent.get("max_tokens")
                    )
                    
                    output = agent_response.get("content", "")
                    
                    agent_usage.append({
                        "iteration": iteration + 1,
                        "agent": agent_name,
                        "role": agent_role,
                        "model": f"{agent_model_provider}/{agent_model_name}",
                        "output_length": len(output)
                    })
                    
                    iteration_outputs[agent_name] = output
                    logger.info(f"Agent {agent_name} completed")
                
                # Update agent outputs and previous outputs for next iteration
                agent_outputs.update(iteration_outputs)
                previous_outputs = iteration_outputs
                
                # Check if we should continue iterations
                if iteration == max_iterations - 1:
                    break
                
                # Check if any agent requested to stop
                stop_iteration = any("STOP" in output.upper() for output in iteration_outputs.values())
                if stop_iteration:
                    logger.info("Stopping iterations due to agent request")
                    break
            
            # Generate a final synthesis
            final_agent = agents[-1]  # Use the last agent for synthesis
            final_prompt = f"Synthesize the following outputs to provide a final, comprehensive answer to the query: '{query}'\n\n"
            final_prompt += "\n\n".join([f"{name}: {output}" for name, output in agent_outputs.items()])
            
            final_response = await self.llm_provider.generate_response(
                provider_name=final_agent.get("model_provider", "vertex_ai"),
                model_name=final_agent.get("model_name", "gemini-1.5-pro"),
                prompt=final_prompt,
                temperature=0.5
            )
            
            final_output = final_response.get("content", "")
            
        elif interaction_type == "hub_and_spoke":
            # Hub and spoke - one central agent coordinates
            logger.info("Executing hub and spoke workflow")
            
            hub_agent_name = workflow_config.get("hub_agent")
            if not hub_agent_name:
                # Use the first agent as hub if not specified
                hub_agent_name = agents[0].get("name", "hub")
            
            hub_agent = next((a for a in agents if a.get("name") == hub_agent_name), agents[0])
            spoke_agents = [a for a in agents if a.get("name") != hub_agent_name]
            
            # First, hub agent processes the query
            hub_prompt_template = hub_agent.get("prompt_template", "")
            hub_system_message = hub_agent.get("system_message", "")
            hub_prompt = hub_prompt_template.replace("{input}", query)
            
            logger.info(f"Executing hub agent: {hub_agent_name}")
            
            hub_response = await self.llm_provider.generate_response(
                provider_name=hub_agent.get("model_provider", "vertex_ai"),
                model_name=hub_agent.get("model_name", "gemini-1.5-pro"),
                prompt=hub_prompt,
                system_message=hub_system_message,
                temperature=hub_agent.get("temperature", 0.7),
                max_tokens=hub_agent.get("max_tokens")
            )
            
            hub_output = hub_response.get("content", "")
            agent_outputs[hub_agent_name] = hub_output
            
            agent_usage.append({
                "iteration": 1,
                "agent": hub_agent_name,
                "role": hub_agent.get("role", "hub"),
                "model": f"{hub_agent.get('model_provider')}/{hub_agent.get('model_name')}",
                "output_length": len(hub_output)
            })
            
            logger.info(f"Hub agent completed")
            
            # Then, each spoke agent processes with the hub's output
            for i, agent in enumerate(spoke_agents):
                agent_name = agent.get("name", f"agent_{uuid.uuid4().hex[:8]}")
                agent_role = agent.get("role", "spoke")
                agent_prompt_template = agent.get("prompt_template", "")
                agent_system_message = agent.get("system_message", "")
                
                # Replace placeholders in prompt template
                agent_prompt = agent_prompt_template.replace("{input}", query)
                agent_prompt = agent_prompt.replace("{hub_output}", hub_output)

                # Check if agent has RAG capabilities
                agent_tools = agent.get("tools", [])
                if agent_tools and "retrieve_information" in agent_tools:
                    # Agent has RAG capabilities, retrieve relevant information
                    logger.info(f"Spoke agent {agent_name} is using RAG capabilities")
                    rag_results = await self.execute_tool("retrieve_information", query=query, num_results=5)
                    agent_prompt = agent_prompt.replace("{retrieved_information}", rag_results)
                else:
                    agent_prompt = agent_prompt.replace("{retrieved_information}", "No information retrieved")
                    
                logger.info(f"Executing spoke agent: {agent_name}")
                
                # Get agent response
                agent_response = await self.llm_provider.generate_response(
                    provider_name=agent.get("model_provider", "vertex_ai"),
                    model_name=agent.get("model_name", "gemini-1.5-flash"),
                    prompt=agent_prompt,
                    system_message=agent_system_message,
                    temperature=agent.get("temperature", 0.7),
                    max_tokens=agent.get("max_tokens")
                )
                
                output = agent_response.get("content", "")
                agent_outputs[agent_name] = output
                
                agent_usage.append({
                    "iteration": 1,
                    "agent": agent_name,
                    "role": agent_role,
                    "model": f"{agent.get('model_provider')}/{agent.get('model_name')}",
                    "output_length": len(output)
                })
                
                logger.info(f"Spoke agent {agent_name} completed")
            
            # Additional iterations if needed
            for iteration in range(1, max_iterations):
                # Skip additional iterations in this implementation
                # In a more advanced version, you could implement multi-round hub-spoke interactions
                pass
            
            # Finally, hub synthesizes all outputs
            final_prompt = f"Synthesize all outputs to provide a final answer to the query: '{query}'\n\n"
            final_prompt += "Your previous analysis:\n" + hub_output + "\n\n"
            final_prompt += "Other agents' analyses:\n"
            final_prompt += "\n\n".join([f"{name}: {output}" for name, output in agent_outputs.items() if name != hub_agent_name])
            
            final_response = await self.llm_provider.generate_response(
                provider_name=hub_agent.get("model_provider", "vertex_ai"),
                model_name=hub_agent.get("model_name", "gemini-1.5-pro"),
                prompt=final_prompt,
                temperature=0.5
            )
            
            final_output = final_response.get("content", "")
        else:
            raise ValueError(f"Unsupported interaction type: {interaction_type}")
        
        # Return the results
        return {
            "outputs": agent_outputs,
            "final_output": final_output,
            "agent_usage": agent_usage
        }

    async def save_execution_checkpoint(self, execution_id: uuid.UUID, state: Dict[str, Any], checkpoint_dir: str = None) -> str:
        """Save execution state to a checkpoint file"""
        if checkpoint_dir is None:
            checkpoint_dir = settings.CHECKPOINT_DIR
        
        os.makedirs(checkpoint_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{execution_id}_{timestamp}.json"
        filepath = os.path.join(checkpoint_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump(state, f, indent=2)
        
        logger.info(f"Saved checkpoint to {filepath}")
        return filepath
    
    async def load_execution_checkpoint(self, filepath: str) -> Dict[str, Any]:
        """Load execution state from a checkpoint file"""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Checkpoint file not found: {filepath}")
        
        with open(filepath, 'r') as f:
            state = json.load(f)
        
        logger.info(f"Loaded checkpoint from {filepath}")
        return state

    async def execute_tool(self, tool_name: str, **params) -> Any:
        """Execute a tool by name with the given parameters"""
        if tool_name not in self.registered_tools:
            raise ValueError(f"Tool '{tool_name}' not registered")
        
        logger.info(f"Executing tool: {tool_name} with params: {params}")
        try:
            result = self.registered_tools[tool_name](**params)
            if asyncio.iscoroutine(result):
                result = await result
            return result
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {str(e)}")
            return f"Error executing tool {tool_name}: {str(e)}"
            
    def register_tool(self, name: str, func):
        """Register a new tool function"""
        self.registered_tools[name] = func
        logger.info(f"Registered tool: {name}")
    
    async def deploy_as_api(self, workflow_id: str, version: str = "v1") -> Dict[str, Any]:
        """Deploy a workflow as an API endpoint"""
        logger.info(f"Deploying workflow {workflow_id} as API endpoint")
        
        # This would be implemented to:
        # 1. Generate a unique API key
        # 2. Register the endpoint in the API gateway
        # 3. Create a deployment record
        # 4. Return the endpoint URL and API key
        
        # Simplified implementation for now
        api_key = f"wf_{uuid.uuid4().hex[:16]}"
        endpoint_url = f"/api/{version}/workflows/{workflow_id}/execute"
        
        return {
            "api_key": api_key,
            "endpoint_url": endpoint_url,
            "version": version,
            "status": "active"
        }
