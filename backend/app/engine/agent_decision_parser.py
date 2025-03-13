# backend/app/engine/agent_decision_parser.py
import re
import logging
from typing import Dict, Any, Optional, Union, List, Tuple

logger = logging.getLogger(__name__)

class AgentDecision:
    """
    Represents a decision made by an agent about what action to take next
    """
    def __init__(
        self,
        agent_name: str,
        action_type: str,
        target: Optional[str] = None,
        content: Optional[str] = None,
        reasoning: str = "",
        tool_name: Optional[str] = None,
        tool_params: Optional[Dict[str, Any]] = None
    ):
        self.agent_name = agent_name
        self.action_type = action_type  # 'delegate', 'respond', 'use_tool', 'final'
        self.target = target  # Target agent for delegation
        self.content = content  # Content to send
        self.reasoning = reasoning  # Reasoning behind the decision
        self.tool_name = tool_name  # Tool to use
        self.tool_params = tool_params or {}  # Parameters for the tool
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert decision to dictionary"""
        return {
            "agent_name": self.agent_name,
            "action_type": self.action_type,
            "target": self.target,
            "content": self.content,
            "reasoning": self.reasoning,
            "tool_name": self.tool_name,
            "tool_params": self.tool_params
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AgentDecision':
        """Create decision from dictionary"""
        return cls(
            agent_name=data.get("agent_name", ""),
            action_type=data.get("action_type", ""),
            target=data.get("target"),
            content=data.get("content"),
            reasoning=data.get("reasoning", ""),
            tool_name=data.get("tool_name"),
            tool_params=data.get("tool_params", {})
        )

class AgentDecisionParser:
    """
    Parses agent outputs to determine their intended actions and decisions
    """
    
    @staticmethod
    def parse_agent_decision(
        content: str, 
        agent_name: str, 
        agent_role: str,
        context: Dict[str, Any]
    ) -> AgentDecision:
        """
        Parse an agent's response to extract the next action decision
        
        This function tries multiple strategies to determine what the agent wants to do next:
        1. Look for explicit action annotations like [ACTION: target]
        2. Look for explicit tool usage like [TOOL: tool_name]
        3. Parse natural language to infer the intention
        4. Use the agent's role and context to determine the default next step
        
        Args:
            content: The agent's response text
            agent_name: The name of the agent
            agent_role: The role of the agent (supervisor, worker, etc.)
            context: Additional context information (workflow type, available agents, etc.)
            
        Returns:
            AgentDecision: The parsed decision
        """
        decision = AgentDecision(
            agent_name=agent_name,
            action_type="respond",  # Default action
            content=content,
            reasoning="Default response"
        )
        
        try:
            # Strategy 1: Look for explicit action annotations
            action_match = re.search(r'\[ACTION:?\s*([^\]]+)\]', content, re.IGNORECASE)
            if action_match:
                action = action_match.group(1).strip().lower()
                
                # Check if it's a delegation to a specific agent
                delegate_match = re.search(r'delegate(?:\s+to)?\s+([a-zA-Z0-9_]+)', action, re.IGNORECASE)
                if delegate_match:
                    target_agent = delegate_match.group(1).strip()
                    
                    # Validate target agent exists in workflow
                    available_agents = context.get("available_agents", [])
                    if target_agent in available_agents:
                        # Get content to send to the target agent
                        content_match = re.search(r'\[CONTENT:?\s*([^\]]+(?:\n(?!\[)[^\]]*)*)\]', content, re.DOTALL)
                        content_to_send = content_match.group(1).strip() if content_match else content
                        
                        decision = AgentDecision(
                            agent_name=agent_name,
                            action_type="delegate",
                            target=target_agent,
                            content=content_to_send,
                            reasoning=f"Agent explicitly requested delegation to {target_agent}"
                        )
                        return decision
                
                # Check if it's a final response
                if any(word in action for word in ["final", "complete", "done", "finish"]):
                    decision = AgentDecision(
                        agent_name=agent_name,
                        action_type="final",
                        content=content,
                        reasoning="Agent explicitly marked this as the final response"
                    )
                    return decision
            
            # Strategy 2: Look for explicit tool usage
            tool_match = re.search(r'\[TOOL:?\s*([^\]]+)\](.*?)(?:\[/TOOL\]|\Z)', content, re.DOTALL | re.IGNORECASE)
            if tool_match:
                tool_name = tool_match.group(1).strip()
                tool_params_str = tool_match.group(2).strip()
                
                # Get tool parameters as JSON if possible
                import json
                tool_params = {}
                try:
                    # Clean up the parameters string to extract JSON
                    params_str = tool_params_str.strip()
                    if params_str:
                        # Try to parse as JSON
                        tool_params = json.loads(params_str)
                except json.JSONDecodeError:
                    # If not valid JSON, extract parameters heuristically
                    param_matches = re.findall(r'(\w+)\s*:\s*([^,\n]+)', tool_params_str)
                    for key, value in param_matches:
                        tool_params[key.strip()] = value.strip()
                
                decision = AgentDecision(
                    agent_name=agent_name,
                    action_type="use_tool",
                    tool_name=tool_name,
                    tool_params=tool_params,
                    content=content,
                    reasoning=f"Agent explicitly requested to use tool: {tool_name}"
                )
                return decision
            
            # Strategy 3: Parse natural language intentions
            # Look for phrases like "I'll ask [agent]" or "Let's delegate to [agent]"
            available_agents = context.get("available_agents", [])
            for target_agent in available_agents:
                # Skip the current agent
                if target_agent == agent_name:
                    continue
                
                # Look for delegation phrases
                delegation_patterns = [
                    rf"(?i)ask\s+{target_agent}",
                    rf"(?i)delegate\s+to\s+{target_agent}",
                    rf"(?i)let\s+{target_agent}",
                    rf"(?i)have\s+{target_agent}",
                    rf"(?i){target_agent}\s+should",
                    rf"(?i){target_agent}\s+will",
                    rf"(?i){target_agent}\s+can",
                    rf"(?i)pass\s+to\s+{target_agent}",
                    rf"(?i)hand\s+(this|it)\s+(?:over|off)\s+to\s+{target_agent}"
                ]
                
                for pattern in delegation_patterns:
                    if re.search(pattern, content):
                        decision = AgentDecision(
                            agent_name=agent_name,
                            action_type="delegate",
                            target=target_agent,
                            content=content,
                            reasoning=f"Agent implicitly indicated delegation to {target_agent} through natural language"
                        )
                        return decision
            
            # Look for phrases indicating final response
            final_patterns = [
                r"(?i)final\s+answer",
                r"(?i)in\s+conclusion",
                r"(?i)to\s+summarize",
                r"(?i)in\s+summary",
                r"(?i)my\s+final\s+response",
                r"(?i)the\s+answer\s+is"
            ]
            
            for pattern in final_patterns:
                if re.search(pattern, content):
                    decision = AgentDecision(
                        agent_name=agent_name,
                        action_type="final",
                        content=content,
                        reasoning="Agent used language indicating a final response"
                    )
                    return decision
            
            # Look for patterns indicating tool usage
            tool_usage_patterns = [
                r"(?i)I will use the ([a-zA-Z0-9_]+) tool",
                r"(?i)Using the ([a-zA-Z0-9_]+) tool",
                r"(?i)Let me ([a-zA-Z0-9_]+) this",
                r"(?i)I'll ([a-zA-Z0-9_]+) this"
            ]
            
            for pattern in tool_usage_patterns:
                tool_usage_match = re.search(pattern, content)
                if tool_usage_match:
                    potential_tool = tool_usage_match.group(1).strip().lower()
                    tools_available = context.get("tools_available", [])
                    
                    # Check if this matches an available tool
                    for tool in tools_available:
                        if potential_tool in tool.lower():
                            decision = AgentDecision(
                                agent_name=agent_name,
                                action_type="use_tool",
                                tool_name=tool,
                                content=content,
                                reasoning=f"Agent implicitly indicated using tool: {tool}"
                            )
                            return decision
            
            # Strategy 4: Use agent's role and context for default behavior
            workflow_type = context.get("workflow_type", "")
            
            if agent_role == "supervisor":
                # Supervisor behavior depends on workflow pattern
                if workflow_type == "supervisor" or workflow_type == "agentic":
                    # In supervisor-worker pattern, supervisors typically delegate first
                    workers = context.get("workers", [])
                    if workers and context.get("iteration", 0) == 0:
                        # First iteration, likely wants to delegate
                        # Choose first worker as default if none is explicitly mentioned
                        decision = AgentDecision(
                            agent_name=agent_name,
                            action_type="delegate",
                            target=workers[0],
                            content=content,
                            reasoning="Supervisor implicitly delegating in first iteration"
                        )
                        return decision
                    else:
                        # After workers have been used, likely wants to provide final answer
                        decision = AgentDecision(
                            agent_name=agent_name,
                            action_type="final",
                            content=content,
                            reasoning="Supervisor providing final response after worker delegations"
                        )
                        return decision
            
            elif agent_role == "worker" or agent_role == "spoke":
                # Workers typically report back to supervisor
                if workflow_type == "supervisor" or workflow_type == "agentic" or workflow_type == "hub_and_spoke":
                    # Find the supervisor or hub agent
                    supervisor = None
                    for agent in context.get("available_agents", []):
                        if context.get("agent_roles", {}).get(agent) == "supervisor" or agent == context.get("hub_agent"):
                            supervisor = agent
                            break
                    
                    if supervisor:
                        decision = AgentDecision(
                            agent_name=agent_name,
                            action_type="delegate",
                            target=supervisor,
                            content=content,
                            reasoning=f"Worker reporting back to {supervisor}"
                        )
                        return decision
            
            # Default: If no specific decision can be inferred, keep the default response action
            return decision
            
        except Exception as e:
            logger.error(f"Error parsing agent decision: {str(e)}")
            # If parsing fails, use a safe default: just respond
            return AgentDecision(
                agent_name=agent_name,
                action_type="respond",
                content=content,
                reasoning=f"Decision parsing failed: {str(e)}"
            )
