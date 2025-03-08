from typing import Dict, List, Any, Optional, Union
import json
import logging
from enum import Enum
from pydantic import BaseModel, Field

# LangChain imports
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain.agents.format_scratchpad import format_to_openai_function_messages
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.tools import Tool
from langchain_core.messages import HumanMessage, AIMessage

# LangGraph imports
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.utils import pydantic_to_dict

logger = logging.getLogger(__name__)

class AgentRole(str, Enum):
    SUPERVISOR = "supervisor"
    WORKER = "worker"
    CRITIC = "critic"
    EXECUTOR = "executor"
    PLANNER = "planner"
    RESEARCHER = "researcher"
    CUSTOM = "custom"

class WorkflowType(str, Enum):
    SUPERVISOR = "supervisor"
    SWARM = "swarm"

class AgentModelProvider(str, Enum):
    VERTEX_AI = "vertex_ai"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    CUSTOM = "custom"

# Pydantic models for template structures
class ToolDefinition(BaseModel):
    name: str
    description: str
    function_name: str
    parameters: Optional[Dict[str, Any]] = None

class AgentConfig(BaseModel):
    name: str
    role: AgentRole
    model_provider: AgentModelProvider
    model_name: str
    prompt_template: str
    system_message: Optional[str] = None
    tools: Optional[List[str]] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None

class SupervisorTemplate(BaseModel):
    name: str
    description: Optional[str] = None
    supervisor: AgentConfig
    workers: List[AgentConfig]
    tools: Optional[List[ToolDefinition]] = None
    workflow_config: Dict[str, Any] = Field(default_factory=dict)

class SwarmTemplate(BaseModel):
    name: str
    description: Optional[str] = None
    agents: List[AgentConfig]
    tools: Optional[List[ToolDefinition]] = None
    workflow_config: Dict[str, Any] = Field(default_factory=dict)

class TemplateEngine:
    """Template Engine for creating and managing agent workflows"""
    
    def __init__(self):
        self.templates = {}
        self.tools_registry = {}
    
    def register_tool(self, tool_definition: ToolDefinition, tool_func):
        """Register a tool implementation with the engine"""
        self.tools_registry[tool_definition.name] = {
            "definition": tool_definition,
            "function": tool_func
        }
    
    def register_supervisor_template(self, template: SupervisorTemplate):
        """Register a supervisor-based workflow template"""
        self.templates[template.name] = {
            "type": WorkflowType.SUPERVISOR,
            "template": template
        }
        return template.name
    
    def register_swarm_template(self, template: SwarmTemplate):
        """Register a swarm-based workflow template"""
        self.templates[template.name] = {
            "type": WorkflowType.SWARM,
            "template": template
        }
        return template.name
    
    def get_template(self, template_name: str):
        """Get a template by name"""
        if template_name not in self.templates:
            raise ValueError(f"Template {template_name} not found")
        return self.templates[template_name]
    
    def _get_llm(self, provider: str, model_name: str, **kwargs):
        """Factory method to get LLM based on provider"""
        if provider == AgentModelProvider.VERTEX_AI:
            from langchain_google_vertexai import ChatVertexAI
            return ChatVertexAI(model_name=model_name, **kwargs)
        elif provider == AgentModelProvider.OPENAI:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(model=model_name, **kwargs)
        elif provider == AgentModelProvider.ANTHROPIC:
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(model=model_name, **kwargs)
        else:
            raise ValueError(f"Unsupported model provider: {provider}")
    
    def _create_agent_tools(self, tool_names: List[str]):
        """Create tools for an agent based on registered tool definitions"""
        tools = []
        for tool_name in tool_names:
            if tool_name not in self.tools_registry:
                logger.warning(f"Tool {tool_name} not found in registry, skipping")
                continue
            
            tool_info = self.tools_registry[tool_name]
            tools.append(
                Tool(
                    name=tool_info["definition"].name,
                    description=tool_info["definition"].description,
                    func=tool_info["function"]
                )
            )
        return tools
    
    def create_supervisor_workflow(self, template_name: str):
        """Create a supervisor-worker workflow based on a template"""
        template_info = self.get_template(template_name)
        if template_info["type"] != WorkflowType.SUPERVISOR:
            raise ValueError(f"Template {template_name} is not a supervisor template")
        
        template = template_info["template"]
        
        # Create supervisor agent
        supervisor_config = template.supervisor
        supervisor_llm = self._get_llm(
            supervisor_config.model_provider,
            supervisor_config.model_name,
            temperature=supervisor_config.temperature,
            max_tokens=supervisor_config.max_tokens
        )
        
        # Create worker agents
        worker_agents = {}
        for worker_config in template.workers:
            worker_llm = self._get_llm(
                worker_config.model_provider,
                worker_config.model_name,
                temperature=worker_config.temperature,
                max_tokens=worker_config.max_tokens
            )
            
            worker_tools = []
            if worker_config.tools:
                worker_tools = self._create_agent_tools(worker_config.tools)
            
            worker_prompt = ChatPromptTemplate.from_template(worker_config.prompt_template)
            
            if worker_tools:
                # Create agent with tools if tools are specified
                worker_agent = create_openai_functions_agent(
                    worker_llm,
                    worker_tools,
                    worker_prompt
                )
                worker_executor = AgentExecutor(agent=worker_agent, tools=worker_tools)
                worker_chain = lambda x, agent=worker_executor: agent.invoke(x)
            else:
                # Simple chain if no tools
                worker_chain = worker_prompt | worker_llm | StrOutputParser()
            
            worker_agents[worker_config.name] = worker_chain
        
        # Create supervisor tools (access to worker agents)
        supervisor_tools = []
        for worker_name, worker_chain in worker_agents.items():
            supervisor_tools.append(
                Tool(
                    name=worker_name,
                    description=f"Delegate task to {worker_name} agent",
                    func=lambda query, agent=worker_chain: agent({"input": query})
                )
            )
        
        # Add any additional tools from template
        if template.tools:
            for tool_def in template.tools:
                if tool_def.name in self.tools_registry:
                    supervisor_tools.append(
                        Tool(
                            name=tool_def.name,
                            description=tool_def.description,
                            func=self.tools_registry[tool_def.name]["function"]
                        )
                    )
        
        # Build LangGraph workflow for supervisor
        class SupervisorState(BaseModel):
            messages: List[Dict[str, Any]] = Field(default_factory=list)
            next: Optional[str] = None
        
        # Define supervisor node
        def supervisor_node(state):
            # Extract the messages
            messages = state["messages"]
            # Format the messages for the supervisor
            supervisor_prompt = ChatPromptTemplate.from_template(supervisor_config.prompt_template)
            response = supervisor_llm.invoke(supervisor_prompt.format_messages(input=messages[-1]["content"]))
            
            # Determine the next worker
            # This is simplified - in a real implementation you'd parse the response
            # to determine which worker to call next
            content = response.content
            
            # Simple parsing logic - find worker mentions
            next_worker = None
            for worker_name in worker_agents.keys():
                if worker_name.lower() in content.lower():
                    next_worker = worker_name
                    break
            
            return {"messages": messages + [{"role": "assistant", "content": content}], "next": next_worker or "end"}
        
        # Worker node function factory
        def create_worker_node(worker_name):
            worker_chain = worker_agents[worker_name]
            
            def worker_node(state):
                messages = state["messages"]
                user_message = messages[-2]["content"]  # Get the original user query
                response = worker_chain({"input": user_message})
                
                if isinstance(response, str):
                    worker_response = response
                else:
                    # Handle different response formats
                    worker_response = response.get("output", str(response))
                
                return {
                    "messages": messages + [{"role": "function", "name": worker_name, "content": worker_response}],
                    "next": "supervisor"  # Return to supervisor after worker completes
                }
            
            return worker_node
        
        # Create the graph
        workflow = StateGraph(SupervisorState)
        
        # Add nodes
        workflow.add_node("supervisor", supervisor_node)
        for worker_name in worker_agents:
            workflow.add_node(worker_name, create_worker_node(worker_name))
        
        # Add edges
        # From supervisor to all workers
        for worker_name in worker_agents:
            workflow.add_conditional_edges(
                "supervisor",
                lambda state, worker=worker_name: state["next"] == worker,
                {worker_name: "supervisor comes next"}
            )
        
        # From supervisor to end
        workflow.add_conditional_edges(
            "supervisor",
            lambda state: state["next"] == "end",
            {END: "conversation ended"}
        )
        
        # Set the entry point
        workflow.set_entry_point("supervisor")
        
        # Add checkpointing
        checkpoint_dir = template.workflow_config.get("checkpoint_dir")
        if checkpoint_dir:
            memory = MemorySaver()
            compiled_workflow = workflow.compile(checkpointer=memory)
        else:
            compiled_workflow = workflow.compile()
        
        return compiled_workflow
    
    def create_swarm_workflow(self, template_name: str):
        """Create a swarm workflow based on a template"""
        template_info = self.get_template(template_name)
        if template_info["type"] != WorkflowType.SWARM:
            raise ValueError(f"Template {template_name} is not a swarm template")
        
        template = template_info["template"]
        
        # Create agents
        agents = {}
        for agent_config in template.agents:
            agent_llm = self._get_llm(
                agent_config.model_provider,
                agent_config.model_name,
                temperature=agent_config.temperature,
                max_tokens=agent_config.max_tokens
            )
            
            agent_prompt = ChatPromptTemplate.from_template(agent_config.prompt_template)
            agent_chain = agent_prompt | agent_llm | StrOutputParser()
            agents[agent_config.name] = agent_chain
        
        # Define the swarm state
        class SwarmState(BaseModel):
            input: str
            outputs: Dict[str, str] = Field(default_factory=dict)
            current_agent: Optional[str] = None
            iterations: int = 0
            final_output: Optional[str] = None
        
        # Configure interaction pattern based on workflow_config
        interaction_type = template.workflow_config.get("interaction_type", "sequential")
        
        if interaction_type == "sequential":
            # Sequential flow through agents
            workflow = StateGraph(SwarmState)
            agent_names = [agent.name for agent in template.agents]
            
            # Create node functions for each agent
            for i, agent_name in enumerate(agent_names):
                agent_chain = agents[agent_name]
                
                def create_agent_node(agent_name, agent_chain, is_last=False):
                    def agent_node(state):
                        # Prepare context with previous agent outputs
                        context = {
                            "input": state.input,
                            "previous_outputs": state.outputs
                        }
                        
                        # Get response from the agent
                        response = agent_chain.invoke(context)
                        
                        # Update state
                        new_outputs = {**state.outputs, agent_name: response}
                        
                        # If this is the last agent, set final output
                        final_output = None
                        if is_last:
                            final_output = "\n\n".join([f"{k}: {v}" for k, v in new_outputs.items()])
                        
                        return SwarmState(
                            input=state.input,
                            outputs=new_outputs,
                            current_agent=agent_name,
                            iterations=state.iterations + 1,
                            final_output=final_output
                        )
                    
                    return agent_node
                
                is_last = (i == len(agent_names) - 1)
                workflow.add_node(agent_name, create_agent_node(agent_name, agent_chain, is_last))
            
            # Connect agents in sequence
            for i in range(len(agent_names) - 1):
                workflow.add_edge(agent_names[i], agent_names[i + 1])
            
            # Final node goes to END
            workflow.add_edge(agent_names[-1], END)
            
            # Set entry point
            workflow.set_entry_point(agent_names[0])
            
        elif interaction_type == "hub_and_spoke":
            # Hub and spoke model with a central coordinator
            hub_agent_name = template.workflow_config.get("hub_agent")
            if not hub_agent_name or hub_agent_name not in agents:
                raise ValueError("Hub agent not specified or not found in template agents")
            
            spoke_agents = [name for name in agents.keys() if name != hub_agent_name]
            workflow = StateGraph(SwarmState)
            
            # Hub node function
            def hub_node(state):
                hub_chain = agents[hub_agent_name]
                
                # For the first iteration, just process the input
                if state.iterations == 0:
                    response = hub_chain.invoke({"input": state.input})
                    return SwarmState(
                        input=state.input,
                        outputs={**state.outputs, f"{hub_agent_name}_iteration_{state.iterations}": response},
                        current_agent=hub_agent_name,
                        iterations=state.iterations + 1
                    )
                else:
                    # Process with all previous outputs
                    response = hub_chain.invoke({
                        "input": state.input, 
                        "previous_outputs": state.outputs
                    })
                    
                    # Check if we've reached max iterations
                    max_iterations = template.workflow_config.get("max_iterations", 3)
                    
                    if state.iterations >= max_iterations:
                        # Final synthesis
                        final_response = hub_chain.invoke({
                            "input": state.input,
                            "all_outputs": state.outputs,
                            "task": "synthesize_final_answer"
                        })
                        
                        return SwarmState(
                            input=state.input,
                            outputs=state.outputs,
                            current_agent=hub_agent_name,
                            iterations=state.iterations,
                            final_output=final_response
                        )
                    
                    return SwarmState(
                        input=state.input,
                        outputs={**state.outputs, f"{hub_agent_name}_iteration_{state.iterations}": response},
                        current_agent=hub_agent_name,
                        iterations=state.iterations + 1
                    )
            
            # Spoke node function factory
            def create_spoke_node(agent_name):
                agent_chain = agents[agent_name]
                
                def spoke_node(state):
                    # Get the latest hub output
                    hub_key = f"{hub_agent_name}_iteration_{state.iterations - 1}"
                    hub_output = state.outputs.get(hub_key, "")
                    
                    # Process with hub's output
                    response = agent_chain.invoke({
                        "input": state.input,
                        "hub_output": hub_output
                    })
                    
                    return SwarmState(
                        input=state.input,
                        outputs={**state.outputs, agent_name: response},
                        current_agent=agent_name,
                        iterations=state.iterations
                    )
                
                return spoke_node
            
            # Add nodes
            workflow.add_node(hub_agent_name, hub_node)
            for spoke_name in spoke_agents:
                workflow.add_node(spoke_name, create_spoke_node(spoke_name))
            
            # Add edges
            # From hub to all spokes
            for spoke_name in spoke_agents:
                workflow.add_conditional_edges(
                    hub_agent_name,
                    lambda state, s=spoke_name: state.iterations > 0 and state.iterations < template.workflow_config.get("max_iterations", 3),
                    {spoke_name: "hub to spoke"}
                )
            
            # From all spokes back to hub
            for spoke_name in spoke_agents:
                workflow.add_edge(spoke_name, hub_agent_name)
            
            # From hub to end when iterations are exhausted or task is complete
            workflow.add_conditional_edges(
                hub_agent_name,
                lambda state: state.iterations >= template.workflow_config.get("max_iterations", 3) or state.final_output is not None,
                {END: "task complete"}
            )
            
            # Set entry point
            workflow.set_entry_point(hub_agent_name)
        
        # Add checkpointing
        checkpoint_dir = template.workflow_config.get("checkpoint_dir")
        if checkpoint_dir:
            memory = MemorySaver()
            compiled_workflow = workflow.compile(checkpointer=memory)
        else:
            compiled_workflow = workflow.compile()
        
        return compiled_workflow
    
    def run_workflow(self, workflow, input_data: Dict[str, Any]):
        """Run a compiled workflow with input data"""
        # Prepare input based on workflow type
        if isinstance(input_data, dict) and "query" in input_data:
            if "messages" in workflow.get_graph().get_inputs_schema().model_json_schema()["properties"]:
                # For supervisor workflow
                initial_state = {"messages": [{"role": "user", "content": input_data["query"]}]}
            else:
                # For swarm workflow
                initial_state = {"input": input_data["query"], "outputs": {}, "iterations": 0}
        else:
            raise ValueError("Input data must contain a 'query' field")
        
        # Execute workflow
        result = workflow.invoke(initial_state)
        return result

# Example of a built-in tool implementation
def search_web(query: str) -> str:
    """Simulated web search tool"""
    return f"Web search results for: {query}\n1. Result 1\n2. Result 2\n3. Result 3"
