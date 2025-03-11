# backend/app/engine/template_engine.py
import logging
import json
import asyncio
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import uuid

from app.engine.llm_providers import llm_provider_manager
from app.core.config import settings

logger = logging.getLogger(__name__)

class TemplateEngine:
    """Engine for processing templates and executing workflows"""
    
    def __init__(self):
        self.llm_provider = llm_provider_manager
    
    async def execute_workflow(self, workflow: Dict[str, Any], input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a workflow with the given input data"""
        logger.info(f"Executing workflow: {workflow['name']}")
        
        start_time = datetime.now()
        
        try:
            # Get template from workflow
            template_id = workflow.get("template_id")
            if not template_id:
                raise ValueError("Workflow has no template_id")
            
            # In a real implementation, you'd fetch the template from the database
            # For now, we'll use mock data if needed
            template = workflow.get("template", {})
            
            workflow_type = template.get("workflow_type", "supervisor")
            
            if workflow_type == "supervisor":
                result = await self._execute_supervisor_workflow(template, workflow, input_data)
            else:  # swarm or other types
                result = await self._execute_swarm_workflow(template, workflow, input_data)
            
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"Workflow execution completed in {execution_time:.2f} seconds")
            
            return {
                "success": True,
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
    
    async def _execute_supervisor_workflow(self, template: Dict[str, Any], workflow: Dict[str, Any], input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a supervisor-worker type workflow"""
        config = template.get("config", {})
        supervisor = config.get("supervisor", {})
        workers = config.get("workers", [])
        
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
        
        # Get supervisor response
        supervisor_response = await self.llm_provider.generate_response(
            provider_name=supervisor_model_provider,
            model_name=supervisor_model_name,
            prompt=supervisor_prompt,
            system_message=supervisor_system_message,
            temperature=supervisor.get("temperature", 0.7),
            max_tokens=supervisor.get("max_tokens")
        )
        
        # 2. Process with workers based on supervisor's decision
        worker_outputs = {}
        
        # For demonstration, we'll use all workers
        # In a more advanced implementation, you could parse the supervisor's response
        # to determine which workers to use
        for worker in workers:
            worker_name = worker.get("name", f"worker_{uuid.uuid4().hex[:8]}")
            worker_model_provider = worker.get("model_provider", "vertex_ai")
            worker_model_name = worker.get("model_name", "gemini-1.5-flash")
            worker_prompt_template = worker.get("prompt_template", "")
            worker_system_message = worker.get("system_message", "")
            
            # Replace placeholders in prompt template
            # Include supervisor's response for context
            worker_prompt = worker_prompt_template.replace("{input}", query)
            worker_prompt = worker_prompt.replace("{supervisor_response}", supervisor_response.get("content", ""))
            
            # Get worker response
            worker_response = await self.llm_provider.generate_response(
                provider_name=worker_model_provider,
                model_name=worker_model_name,
                prompt=worker_prompt,
                system_message=worker_system_message,
                temperature=worker.get("temperature", 0.7),
                max_tokens=worker.get("max_tokens")
            )
            
            worker_outputs[worker_name] = worker_response.get("content", "")
        
        # 3. Return the combined results
        return {
            "messages": [
                {"role": "user", "content": query},
                {"role": "assistant", "content": supervisor_response.get("content", "")}
            ],
            "outputs": worker_outputs
        }
    
    async def _execute_swarm_workflow(self, template: Dict[str, Any], workflow: Dict[str, Any], input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a swarm type workflow"""
        config = template.get("config", {})
        agents = config.get("agents", [])
        workflow_config = config.get("workflow_config", {})
        
        if not agents:
            raise ValueError("Swarm template has no agents")
        
        # Get query from input data
        query = input_data.get("query", "")
        if not query:
            raise ValueError("No query provided in input data")
        
        # Process the query with each agent
        agent_outputs = {}
        max_iterations = workflow_config.get("max_iterations", 3)
        interaction_type = workflow_config.get("interaction_type", "sequential")
        
        if interaction_type == "sequential":
            # Sequential processing - each agent processes in turn
            previous_outputs = {}
            
            for agent in agents:
                agent_name = agent.get("name", f"agent_{uuid.uuid4().hex[:8]}")
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
                agent_outputs[agent_name] = output
                previous_outputs[agent_name] = output
            
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
            
            # Then, each spoke agent processes with the hub's output
            for agent in spoke_agents:
                agent_name = agent.get("name", f"agent_{uuid.uuid4().hex[:8]}")
                agent_prompt_template = agent.get("prompt_template", "")
                agent_system_message = agent.get("system_message", "")
                
                # Replace placeholders in prompt template
                agent_prompt = agent_prompt_template.replace("{input}", query)
                agent_prompt = agent_prompt.replace("{hub_output}", hub_output)
                
                # Get agent response
                agent_response = await self.llm_provider.generate_response(
                    provider_name=agent.get("model_provider", "vertex_ai"),
                    model_name=agent.get("model_name", "gemini-1.5-flash"),
                    prompt=agent_prompt,
                    system_message=agent_system_message,
                    temperature=agent.get("temperature", 0.7),
                    max_tokens=agent.get("max_tokens")
                )
                
                agent_outputs[agent_name] = agent_response.get("content", "")
            
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
            "final_output": final_output
        }

# Create a global instance
template_engine = TemplateEngine()
