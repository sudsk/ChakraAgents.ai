# backend/app/engine/langgraph_workflow_runner.py
import logging
import asyncio
import os
import json
from datetime import datetime
import uuid
from typing import Dict, List, Any, Optional, Annotated, TypedDict, cast

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable, RunnableConfig
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint import MemorySaver

from app.engine.llm_providers import llm_provider_manager
from app.engine.agent_decision_parser import AgentDecisionParser, AgentDecision
from app.db.models import Template, Workflow, WorkflowExecution

logger = logging.getLogger(__name__)

# Define state types using TypedDict for better type safety
class AgentState(TypedDict):
    """Represents the state of an agent in the workflow"""
    messages: List[Dict[str, Any]]     # Messages exchanged with the agent
    next_agent: Optional[str]          # Which agent to route to next
    tools_used: List[str]              # Which tools the agent has used
    outputs: Dict[str, Any]            # Results produced by the agent
    metadata: Dict[str, Any]           # Additional metadata

class WorkflowState(TypedDict):
    """Overall workflow state containing all agent states and global info"""
    agents: Dict[str, AgentState]      # States for all agents
    input: Dict[str, Any]              # Initial input to the workflow
    current_agent: str                 # Current active agent
    history: List[Dict[str, Any]]      # History of agent activations
    final_output: Optional[Any]        # Final output of the workflow
    execution_graph: Dict[str, List[str]]  # Dynamic execution graph
    iteration: int                     # Current iteration count
    metadata: Dict[str, Any]           # Additional workflow metadata
    decisions: List[Dict[str, Any]]    # List of agent decisions taken

class LangGraphWorkflowRunner:
    """
    Runner for agentic workflows using LangGraph for dynamic agent routing
    """
    
    def __init__(self, template: Template, workflow: Workflow):
        self.template = template
        self.workflow = workflow
        self.llm_provider = llm_provider_manager
        self.execution_id = None
        self.checkpoint_dir = os.environ.get("CHECKPOINT_DIR", "./checkpoints")
        self.decision_parser = AgentDecisionParser()
        
        # Get workflow type and initialize the appropriate graph
        self.workflow_type = template.workflow_type
        
        # Load available tools
        self.available_tools = self._load_available_tools()
        
        # Set a reasonable default for max iterations
        self.max_iterations = self.workflow.config.get("workflow_config", {}).get("max_iterations", 5)
        
        # Create the checkpoint directory
        os.makedirs(self.checkpoint_dir, exist_ok=True)
    
    def _load_available_tools(self) -> Dict[str, Any]:
        """Load available tools from the template configuration"""
        tools = {}
        for tool_config in self.template.config.get("tools", []):
            # We would integrate with actual tool implementations here
            # For now, we'll just store the tool definitions
            tool_name = tool_config.get("name")
            if tool_name:
                tools[tool_name] = {
                    "definition": tool_config,
                    "function": self._get_placeholder_tool_function(tool_name)
                }
        
        # Add retrieve_information tool if RAG is enabled
        if self.template.config.get("rag_enabled", False):
            tools["retrieve_information"] = {
                "definition": {
                    "name": "retrieve_information",
                    "description": "Retrieve relevant information from the knowledge base",
                    "parameters": {
                        "query": {"type": "string", "description": "The search query"},
                        "num_results": {"type": "integer", "description": "Number of results"}
                    }
                },
                "function": self._get_placeholder_tool_function("retrieve_information")
            }
        
        return tools
    
    def _get_placeholder_tool_function(self, tool_name: str):
        """Get a placeholder function for a tool"""
        async def tool_function(**kwargs):
            # In a real implementation, this would call the actual tool
            return f"Result from {tool_name} with params: {kwargs}"
        
        return tool_function
    
    async def execute(self, input_data: Dict[str, Any], execution_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Execute the workflow with the given input data
        
        Args:
            input_data: Input data for the workflow (e.g. {"query": "What is..."})
            execution_id: Optional ID for the execution (for tracking)
            
        Returns:
            The final workflow state and results
        """
        self.execution_id = execution_id or str(uuid.uuid4())
        
        try:
            logger.info(f"Starting workflow execution {self.execution_id}")
            
            # Get configuration values
            config = self.template.config
            self.max_iterations = config.get("workflow_config", {}).get("max_iterations", 5)
            
            # Create the LangGraph based on workflow type
            if self.workflow_type == "supervisor" or self.workflow_type == "agentic":
                graph = self._create_supervisor_graph(config)
            elif self.workflow_type == "swarm":
                graph = self._create_swarm_graph(config)
            elif self.workflow_type == "rag":
                graph = self._create_rag_graph(config)
            else:
                raise ValueError(f"Unsupported workflow type: {self.workflow_type}")
            
            # Create initial state
            initial_state = self._create_initial_state(input_data)
            
            # Create memory saver for checkpointing
            memory_saver = MemorySaver()
            
            # Execute the workflow
            logger.info(f"Executing {self.workflow_type} workflow with LangGraph")
            
            # Set up config for the run
            config = {"configurable": {"thread_id": self.execution_id}}
            
            # Run the workflow
            final_state = await graph.ainvoke(
                initial_state, 
                config=config,
                saver=memory_saver
            )
            
            # Process final state to get the result
            result = self._process_final_state(final_state)
            
            return result
            
        except Exception as e:
            logger.exception(f"Error executing workflow: {str(e)}")
            raise
    
    def _create_supervisor_graph(self, config: Dict[str, Any]) -> StateGraph:
        """Create a LangGraph for supervisor workflow"""
        # Create the state graph
        workflow_graph = StateGraph(WorkflowState)
        
        # Add supervisor agent node
        supervisor_config = config.get("supervisor", {})
        supervisor_name = supervisor_config.get("name", "supervisor")
        
        workflow_graph.add_node(supervisor_name, self._create_agent_node(supervisor_config))
        
        # Add worker agent nodes
        for worker_config in config.get("workers", []):
            worker_name = worker_config.get("name")
            if worker_name:
                workflow_graph.add_node(worker_name, self._create_agent_node(worker_config))
        
        # Add router node for decision routing
        workflow_graph.add_node("router", self._create_router_node())
        
        # Add final output node
        workflow_graph.add_node("final", self._create_final_node())
        
        # Add conditional edges based on agent decisions
        workflow_graph.add_edge(supervisor_name, "router")
        
        # Router decides where to go next
        workflow_graph.add_conditional_edges(
            "router",
            self._get_next_agent,
            {
                "final": "final",
                **{worker.get("name"): worker.get("name") for worker in config.get("workers", [])}
            }
        )
        
        # Workers report back to supervisor
        for worker_config in config.get("workers", []):
            worker_name = worker_config.get("name")
            if worker_name:
                workflow_graph.add_edge(worker_name, "router")
        
        # Final node
        workflow_graph.add_edge("final", END)
        
        # Compile and return the graph
        return workflow_graph.compile()
    
    def _create_swarm_graph(self, config: Dict[str, Any]) -> StateGraph:
        """Create a LangGraph for swarm workflow"""
        # Create the state graph
        workflow_graph = StateGraph(WorkflowState)
        
        # Add agent nodes
        for agent_config in config.get("agents", []):
            agent_name = agent_config.get("name")
            if agent_name:
                workflow_graph.add_node(agent_name, self._create_agent_node(agent_config))
        
        # Add router node for decision routing
        workflow_graph.add_node("router", self._create_router_node())
        
        # Add final output node
        workflow_graph.add_node("final", self._create_final_node())
        
        # Get interaction type
        interaction_type = config.get("workflow_config", {}).get("interaction_type", "sequential")
        
        if interaction_type == "sequential":
            # In sequential mode, each agent goes to router
            for agent_config in config.get("agents", []):
                agent_name = agent_config.get("name")
                if agent_name:
                    workflow_graph.add_edge(agent_name, "router")
            
            # Router decides next agent
            workflow_graph.add_conditional_edges(
                "router",
                self._get_next_agent,
                {
                    "final": "final",
                    **{agent.get("name"): agent.get("name") for agent in config.get("agents", [])}
                }
            )
            
        elif interaction_type == "hub_and_spoke":
            # Hub and spoke mode
            hub_agent = config.get("workflow_config", {}).get("hub_agent")
            
            if not hub_agent and config.get("agents"):
                # Default to first agent as hub if not specified
                hub_agent = config.get("agents")[0].get("name")
            
            # Hub routes through router
            workflow_graph.add_edge(hub_agent, "router")
            
            # Spokes route back to hub
            for agent_config in config.get("agents", []):
                agent_name = agent_config.get("name")
                if agent_name and agent_name != hub_agent:
                    workflow_graph.add_edge(agent_name, "router")
            
            # Router decides next agent
            workflow_graph.add_conditional_edges(
                "router",
                self._get_next_agent,
                {
                    "final": "final",
                    **{agent.get("name"): agent.get("name") for agent in config.get("agents", [])}
                }
            )
        
        # Final node
        workflow_graph.add_edge("final", END)
        
        # Compile and return the graph
        return workflow_graph.compile()
    
    def _create_rag_graph(self, config: Dict[str, Any]) -> StateGraph:
        """Create a LangGraph for RAG workflow"""
        # Create the state graph
        workflow_graph = StateGraph(WorkflowState)
        
        # For RAG workflow, create a single agent node
        agent_name = "rag_agent"
        rag_config = {
            "name": agent_name,
            "role": "rag",
            "model_provider": config.get("model_provider", "vertex_ai"),
            "model_name": config.get("model_name", "gemini-1.5-pro"),
            "system_message": config.get("system_message", ""),
            "tools": ["retrieve_information"]
        }
        
        workflow_graph.add_node(agent_name, self._create_agent_node(rag_config))
        
        # Add router node
        workflow_graph.add_node("router", self._create_router_node())
        
        # Add final output node
        workflow_graph.add_node("final", self._create_final_node())
        
        # Add edges
        workflow_graph.add_edge(agent_name, "router")
        
        # Router decides next step
        workflow_graph.add_conditional_edges(
            "router",
            self._get_next_agent,
            {
                "final": "final",
                agent_name: agent_name
            }
        )
        
        # Final node
        workflow_graph.add_edge("final", END)
        
        # Compile and return the graph
        return workflow_graph.compile()
    
    def _create_agent_node(self, agent_config: Dict[str, Any]):
        """Create a function for processing an agent node in the graph"""
        agent_name = agent_config.get("name", "agent")
        
        async def agent_function(state: WorkflowState) -> WorkflowState:
            # Get agent state
            agent_state = state["agents"].get(agent_name, {})
            
            # Skip if no messages to process
            if not agent_state.get("messages"):
                return state
            
            # Get agent configuration
            model_provider = agent_config.get("model_provider", "vertex_ai")
            model_name = agent_config.get("model_name", "gemini-1.5-pro")
            system_message = agent_config.get("system_message", "")
            prompt_template = agent_config.get("prompt_template", "")
            temperature = agent_config.get("temperature", 0.7)
            
            # Build the prompt
            prompt = self._build_agent_prompt(
                prompt_template=prompt_template,
                agent_state=agent_state,
                state=state,
                agent_config=agent_config
            )
            
            # Get tool definitions if agent has tools
            tools = []
            if agent_config.get("tools"):
                for tool_name in agent_config.get("tools", []):
                    if tool_name in self.available_tools:
                        tools.append(self.available_tools[tool_name]["definition"])
            
            # Generate the agent's response
            logger.info(f"Generating response for agent {agent_name}")
            try:
                response = await self.llm_provider.generate_response(
                    provider_name=model_provider,
                    model_name=model_name,
                    prompt=prompt,
                    system_message=system_message,
                    temperature=temperature,
                    tools=tools
                )
                
                # Process the response to get next agent
                return self._process_agent_response(state, agent_name, response)
                
            except Exception as e:
                logger.error(f"Error generating response for agent {agent_name}: {str(e)}")
                
                # Update state with error
                new_state = dict(state)
                new_state["agents"] = dict(state["agents"])
                new_state["agents"][agent_name] = dict(state["agents"].get(agent_name, {}))
                new_state["agents"][agent_name]["outputs"] = {
                    "error": str(e),
                    "final": f"Error: {str(e)}"
                }
                
                # Add to history
                history_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "agent": agent_name,
                    "action": "error",
                    "error": str(e)
                }
                new_state["history"] = state.get("history", []) + [history_entry]
                
                return new_state
        
        return agent_function
    
    def _create_router_node(self):
        """Create the router node function for the graph"""
        
        def router_function(state: WorkflowState) -> WorkflowState:
            # Get current agent
            current_agent = state.get("current_agent")
            if not current_agent:
                # Default to first agent if none specified
                agents = list(state.get("agents", {}).keys())
                if agents:
                    current_agent = agents[0]
                else:
                    # No agents, route to final
                    new_state = dict(state)
                    agent_state = new_state["agents"].get(current_agent, {})
                    agent_state["next_agent"] = "final"
                    return new_state
            
            # Get agent state
            agent_state = state["agents"].get(current_agent, {})
            
            # Get routing decision (next agent)
            next_agent = agent_state.get("next_agent")
            
            # Update iteration count
            new_state = dict(state)
            new_state["iteration"] = state.get("iteration", 0) + 1
            
            # Check if we've reached max iterations
            if new_state["iteration"] > self.max_iterations:
                logger.info(f"Reached max iterations ({self.max_iterations}), forcing to final")
                
                # Force next agent to final
                agents = new_state["agents"]
                agents[current_agent] = dict(agents[current_agent])
                agents[current_agent]["next_agent"] = "final"
                
                # Add to history
                history_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "agent": current_agent,
                    "action": "max_iterations_reached",
                    "next": "final"
                }
                new_state["history"] = state.get("history", []) + [history_entry]
                
                return new_state
            
            # Check execution graph constraints if enabled
            if self.workflow.config.get("override_agent_decisions", False) and self.workflow.config.get("execution_graph"):
                execution_graph = self.workflow.config.get("execution_graph", {})
                
                # If current agent is in the graph and next agent is not in allowed targets
                if current_agent in execution_graph and next_agent != "final":
                    allowed_targets = execution_graph.get(current_agent, [])
                    if next_agent not in allowed_targets:
                        logger.warning(f"Agent {current_agent} tried to delegate to {next_agent} but it's not allowed by execution graph")
                        
                        # If there are allowed targets, choose the first one
                        if allowed_targets:
                            agents = new_state["agents"]
                            agents[current_agent] = dict(agents[current_agent])
                            agents[current_agent]["next_agent"] = allowed_targets[0]
                            
                            # Add to history
                            history_entry = {
                                "timestamp": datetime.now().isoformat(),
                                "agent": current_agent,
                                "action": "graph_constraint_applied",
                                "original_next": next_agent,
                                "corrected_next": allowed_targets[0]
                            }
                            new_state["history"] = state.get("history", []) + [history_entry]
                            
                            return new_state
            
            # Add to history
            history_entry = {
                "timestamp": datetime.now().isoformat(),
                "agent": current_agent,
                "action": "route",
                "next": next_agent
            }
            new_state["history"] = state.get("history", []) + [history_entry]
            
            return new_state
        
        return router_function
    
    def _create_final_node(self):
        """Create the final output node function for the graph"""
        
        def final_function(state: WorkflowState) -> WorkflowState:
            logger.info("Generating final output")
            
            new_state = dict(state)
            
            # Generate final output based on workflow type
            if self.workflow_type == "supervisor" or self.workflow_type == "agentic":
                # For supervisor, use the supervisor's final output
                supervisor_name = None
                for agent_name, agent_data in state["agents"].items():
                    if agent_data.get("metadata", {}).get("role") == "supervisor":
                        supervisor_name = agent_name
                        break
                
                if supervisor_name:
                    final_output = state["agents"][supervisor_name].get("outputs", {}).get("final", "")
                    new_state["final_output"] = final_output
            
            elif self.workflow_type == "swarm":
                # For swarm, use the last agent's output or combine all outputs
                # This depends on the specific swarm configuration
                interaction_type = self.template.config.get("workflow_config", {}).get("interaction_type")
                
                if interaction_type == "hub_and_spoke":
                    # Use hub agent's final output
                    hub_agent = self.template.config.get("workflow_config", {}).get("hub_agent")
                    if hub_agent and hub_agent in state["agents"]:
                        final_output = state["agents"][hub_agent].get("outputs", {}).get("final", "")
                        new_state["final_output"] = final_output
                else:
                    # Use last agent's output in sequential mode
                    history = state.get("history", [])
                    agents = [entry["agent"] for entry in history if "agent" in entry]
                    
                    if agents:
                        last_agent = agents[-1]
                        final_output = state["agents"][last_agent].get("outputs", {}).get("final", "")
                        new_state["final_output"] = final_output
            
            elif self.workflow_type == "rag":
                # For RAG, use the RAG agent's output
                rag_agent = "rag_agent"
                final_output = state["agents"][rag_agent].get("outputs", {}).get("final", "")
                new_state["final_output"] = final_output
            
            # If no specific output was generated, create one from all agent outputs
            if not new_state.get("final_output"):
                parts = []
                
                for agent_name, agent_data in state["agents"].items():
                    output = agent_data.get("outputs", {}).get("final", "")
                    if output:
                        parts.append(f"{agent_name}: {output}")
                
                if parts:
                    new_state["final_output"] = "\n\n".join(parts)
                else:
                    new_state["final_output"] = "No output was generated by any agent."
            
            # Add to history
            history_entry = {
                "timestamp": datetime.now().isoformat(),
                "action": "final_output"
            }
            new_state["history"] = state.get("history", []) + [history_entry]
            
            return new_state
        
        return final_function
    
    def _get_next_agent(self, state: WorkflowState) -> str:
        """
        Conditional routing function for deciding the next agent
        
        This function is used by the router to determine where to route execution next.
        """
        # Get current agent
        current_agent = state.get("current_agent")
        if not current_agent:
            # Default to first agent if none specified
            return list(state.get("agents", {}).keys())[0]
        
        # Get agent state
        agent_state = state["agents"].get(current_agent, {})
        
        # Get next agent from the agent's state
        next_agent = agent_state.get("next_agent")
        
        if next_agent and next_agent != "final":
            # Make sure the next agent exists
            if next_agent in state["agents"]:
                # Update current agent in the state
                state["current_agent"] = next_agent
                return next_agent
        
        # Default to final if no valid next agent
        return "final"
