from typing import Dict, List, Any, Optional, Union
import json
import logging
from enum import Enum
from pydantic import BaseModel, Field

# LangChain imports
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser, PydanticOutputParser
from langchain.agents import AgentExecutor, create_react_agent
from langchain.memory import ConversationBufferMemory
from langchain_google_vertexai import VertexAI
from langchain_core.tools import Tool
from langchain_core.messages import HumanMessage, AIMessage

# LangGraph imports
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor
from langgraph.checkpoint import JsonCheckpoint

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
            return VertexAI(model_name=model_name, **kwargs)
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
                # Create ReAct agent if tools are specified
                worker_agent = create_react_agent(
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
        
        # Create the supervisor agent
        supervisor_prompt = ChatPromptTemplate.from_template(supervisor_config.prompt_template)
        
        # Build LangGraph workflow
        tool_executor = ToolExecutor(supervisor_tools)
        
        # Define state schema
        class AgentState(BaseModel):
            messages: List[Dict[str, str]]
            action: Optional[Dict[str, str]] = None
            
        # Define supervisor node
        def supervisor_node(state):
            messages = state["messages"]
            return supervisor_llm.invoke(supervisor_prompt.format_messages(messages=messages))
        
        # Define routing function
        def route_to_tool(state):
            action = state["action"]
            if action.tool == "_end_":
                return END
            return action.tool
        
        # Build graph
        workflow_builder = StateGraph({"messages": [], "action": None})
        workflow_builder.add_node("supervisor", supervisor_node)
        workflow_builder.add_node("tool_executor", tool_executor)
        
        # Add connections
        workflow_builder.add_edge("supervisor", route_to_tool)
        for tool_name in [w.name for w in template.workers]:
            workflow_builder.add_edge(tool_name, "supervisor")
        
        # Add any checkpoint configuration if specified
        checkpoint_dir = template.workflow_config.get("checkpoint_dir")
        if checkpoint_dir:
            checkpoint = JsonCheckpoint(checkpoint_dir)
            workflow = workflow_builder.compile(checkpointer=checkpoint)
        else:
            workflow = workflow_builder.compile()
        
        return workflow
    
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
        
        # Build state graph
        class SwarmState(BaseModel):
            input: str
            outputs: Dict[str, str] = Field(default_factory=dict)
            final_output: Optional[str] = None
        
        workflow_builder = StateGraph(SwarmState)
        
        # Configure interaction pattern based on workflow_config
        interaction_type = template.workflow_config.get("interaction_type", "sequential")
        
        if interaction_type == "sequential":
            # Simple sequential flow through all agents
            agent_names = list(agents.keys())
            
            # Add each agent as a node
            for agent_name, agent_chain in agents.items():
                workflow_builder.add_node(
                    agent_name,
                    lambda state, agent=agent_chain, name=agent_name: SwarmState(
                        input=state.input,
                        outputs={
                            **state.outputs,
                            name: agent.invoke({"input": state.input, "previous_outputs": state.outputs})
                        },
                        final_output=state.final_output
                    )
                )
            
            # Connect agents in sequence
            for i in range(len(agent_names) - 1):
                workflow_builder.add_edge(agent_names[i], agent_names[i + 1])
                
            # Add final node
            workflow_builder.add_node(
                "final",
                lambda state: SwarmState(
                    input=state.input,
                    outputs=state.outputs,
                    final_output="\n\n".join([f"{k}: {v}" for k, v in state.outputs.items()])
                )
            )
            workflow_builder.add_edge(agent_names[-1], "final")
            workflow_builder.add_edge("final", END)
            
        elif interaction_type == "hub_and_spoke":
            # Hub and spoke model with a central coordinator
            hub_agent = template.workflow_config.get("hub_agent")
            if not hub_agent or hub_agent not in agents:
                raise ValueError("Hub agent not specified or not found in template agents")
            
            spoke_agents = [name for name in agents.keys() if name != hub_agent]
            
            # Add hub node
            workflow_builder.add_node(
                hub_agent,
                lambda state, agent=agents[hub_agent], name=hub_agent: SwarmState(
                    input=state.input,
                    outputs={
                        **state.outputs,
                        name: agent.invoke({"input": state.input, "previous_outputs": state.outputs})
                    },
                    final_output=state.final_output
                )
            )
            
            # Add spoke nodes
            for agent_name in spoke_agents:
                workflow_builder.add_node(
                    agent_name,
                    lambda state, agent=agents[agent_name], name=agent_name: SwarmState(
                        input=state.input,
                        outputs={
                            **state.outputs,
                            name: agent.invoke({"input": state.input, "hub_output": state.outputs.get(hub_agent, "")})
                        },
                        final_output=state.final_output
                    )
                )
                
                # Connect hub to spoke and back
                workflow_builder.add_edge(hub_agent, agent_name)
                workflow_builder.add_edge(agent_name, hub_agent)
            
            # Add final processing in hub
            workflow_builder.add_node(
                "final",
                lambda state: SwarmState(
                    input=state.input,
                    outputs=state.outputs,
                    final_output=agents[hub_agent].invoke({
                        "input": state.input, 
                        "all_outputs": state.outputs,
                        "task": "synthesize_final_answer"
                    })
                )
            )
            
            # Add conditional edge to determine when to end
            def should_end(state):
                # Check if we've completed enough iterations
                max_iterations = template.workflow_config.get("max_iterations", 3)
                hub_outputs = [v for k, v in state.outputs.items() if k.startswith(f"{hub_agent}_iteration_")]
                if len(hub_outputs) >= max_iterations:
                    return "final"
                return hub_agent
            
            workflow_builder.add_conditional_edges(hub_agent, should_end)
            workflow_builder.add_edge("final", END)
        
        # Add any checkpoint configuration if specified
        checkpoint_dir = template.workflow_config.get("checkpoint_dir")
        if checkpoint_dir:
            checkpoint = JsonCheckpoint(checkpoint_dir)
            workflow = workflow_builder.compile(checkpointer=checkpoint)
        else:
            workflow = workflow_builder.compile()
        
        return workflow
    
    def run_workflow(self, workflow, input_data: Dict[str, Any]):
        """Run a compiled workflow with input data"""
        # Prepare input based on workflow type
        if isinstance(input_data, dict) and "query" in input_data:
            messages = [{"role": "user", "content": input_data["query"]}]
            initial_state = {"messages": messages, "action": None}
        else:
            initial_state = {"input": input_data.get("query", ""), "outputs": {}}
        
        # Execute workflow
        result = workflow.invoke(initial_state)
        return result

# Example of a built-in tool implementation
def search_web(query: str) -> str:
    """Simulated web search tool"""
    return f"Web search results for: {query}\n1. Result 1\n2. Result 2\n3. Result 3"
