# backend/app/engine/agent_prompt_creator.py
from typing import Dict, List, Any, Optional, Union
import logging
import json

logger = logging.getLogger(__name__)

class AgentPromptCreator:
    """
    Creates prompts for agents with agentic capabilities such as
    task delegation, tool usage, and autonomous decision-making.
    """
    
    @staticmethod
    def enhance_template_with_agentic_capabilities(template_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhance a template configuration with agentic capabilities.
        
        Args:
            template_config: The original template configuration
            
        Returns:
            Enhanced template configuration with agentic capabilities
        """
        enhanced_config = template_config.copy()
        
        # Add agentic capabilities to supervisor if it exists
        if 'supervisor' in enhanced_config:
            enhanced_config['supervisor'] = AgentPromptCreator._enhance_agent_config(
                enhanced_config['supervisor'], 
                is_supervisor=True
            )
        
        # Add agentic capabilities to workers if they exist
        if 'workers' in enhanced_config and isinstance(enhanced_config['workers'], list):
            enhanced_workers = []
            for worker in enhanced_config['workers']:
                enhanced_workers.append(
                    AgentPromptCreator._enhance_agent_config(worker, is_supervisor=False)
                )
            enhanced_config['workers'] = enhanced_workers
        
        # Add agentic capabilities to swarm agents if they exist
        if 'agents' in enhanced_config and isinstance(enhanced_config['agents'], list):
            enhanced_agents = []
            for agent in enhanced_config['agents']:
                enhanced_agents.append(
                    AgentPromptCreator._enhance_agent_config(agent, is_supervisor=False)
                )
            enhanced_config['agents'] = enhanced_agents
            
        return enhanced_config
    
    @staticmethod
    def _enhance_agent_config(agent_config: Dict[str, Any], is_supervisor: bool = False) -> Dict[str, Any]:
        """
        Enhance an individual agent configuration with agentic capabilities.
        
        Args:
            agent_config: The original agent configuration
            is_supervisor: Whether this agent is a supervisor
            
        Returns:
            Enhanced agent configuration
        """
        enhanced_agent = agent_config.copy()
        
        # Skip if agentic enhancements are explicitly disabled
        if enhanced_agent.get('agentic_system_message') is False:
            return enhanced_agent
        
        # Determine agent capabilities
        can_delegate = enhanced_agent.get('can_delegate', True)
        can_use_tools = enhanced_agent.get('can_use_tools', True)
        can_finalize = enhanced_agent.get('can_finalize', is_supervisor)
        autonomous_decisions = enhanced_agent.get('autonomous_decisions', True)
        
        # Enhance system message with agentic capabilities
        system_message = enhanced_agent.get('system_message', '')
        
        # Add agentic system message if not already present
        if not AgentPromptCreator._has_agentic_instructions(system_message):
            agentic_instructions = AgentPromptCreator.get_agentic_system_instructions(
                can_delegate=can_delegate,
                can_use_tools=can_use_tools,
                can_finalize=can_finalize,
                autonomous_decisions=autonomous_decisions,
                is_supervisor=is_supervisor
            )
            
            # Append agentic instructions to existing system message
            if system_message:
                enhanced_agent['system_message'] = f"{system_message}\n\n{agentic_instructions}"
            else:
                enhanced_agent['system_message'] = agentic_instructions
        
        # Enhance prompt template with agentic placeholders
        prompt_template = enhanced_agent.get('prompt_template', '')
        
        # Replace {make_decision} placeholder with detailed instructions
        if '{make_decision}' in prompt_template:
            decision_instructions = AgentPromptCreator.get_decision_instructions(
                can_delegate=can_delegate,
                can_use_tools=can_use_tools,
                can_finalize=can_finalize,
                is_supervisor=is_supervisor
            )
            enhanced_agent['prompt_template'] = prompt_template.replace(
                '{make_decision}', 
                decision_instructions
            )
        
        # Replace {available_tools} with actual tool information if needed
        if '{available_tools}' in enhanced_agent['prompt_template']:
            # This would be populated at runtime with actual tool information
            enhanced_agent['prompt_template'] = enhanced_agent['prompt_template'].replace(
                '{available_tools}',
                "You'll be provided with available tools at runtime."
            )
        
        # Replace {available_agents} with actual agent information if needed
        if '{available_agents}' in enhanced_agent['prompt_template']:
            # This would be populated at runtime with actual agent information
            enhanced_agent['prompt_template'] = enhanced_agent['prompt_template'].replace(
                '{available_agents}',
                "You'll be provided with available agents at runtime."
            )
        
        return enhanced_agent
    
    @staticmethod
    def _has_agentic_instructions(system_message: str) -> bool:
        """
        Check if a system message already has agentic instructions.
        
        Args:
            system_message: The system message to check
            
        Returns:
            Whether the system message already has agentic instructions
        """
        agentic_keywords = [
            "delegate to",
            "you can decide to",
            "you can use tools",
            "you can provide a final",
            "[ACTION:",
            "[TOOL:",
            "decision format",
            "Following this format"
        ]
        
        # Check if any of the keywords are in the system message
        for keyword in agentic_keywords:
            if keyword in system_message:
                return True
                
        return False
    
    @staticmethod
    def get_agentic_system_instructions(
        can_delegate: bool = True, 
        can_use_tools: bool = True, 
        can_finalize: bool = True,
        autonomous_decisions: bool = True,
        is_supervisor: bool = False
    ) -> str:
        """
        Get detailed system instructions for agentic capabilities.
        
        Args:
            can_delegate: Whether the agent can delegate tasks
            can_use_tools: Whether the agent can use tools
            can_finalize: Whether the agent can finalize the workflow
            autonomous_decisions: Whether the agent can make autonomous decisions
            is_supervisor: Whether this agent is a supervisor
            
        Returns:
            System instructions for agentic capabilities
        """
        instructions = [
            "## Agentic Decision Making",
            "You are an agentic AI that can make autonomous decisions about how to best accomplish tasks."
        ]
        
        if can_delegate:
            if is_supervisor:
                instructions.append("- You can delegate tasks to specialized workers by specifying [ACTION: delegate to worker_name]")
            else:
                instructions.append("- You can delegate to other agents by specifying [ACTION: delegate to agent_name]")
        
        if can_use_tools:
            instructions.append("- You can use tools by specifying [TOOL: tool_name] followed by the parameters in JSON format")
            
        if can_finalize:
            instructions.append("- You can provide a final answer by specifying [ACTION: final]")
        
        instructions.append("\n## Decision Format")
        instructions.append("When making a decision, use this format:")
        
        if can_delegate:
            instructions.append("""
To delegate:
[ACTION: delegate to agent_name]
[CONTENT:
Your message to the agent, explaining what you want them to do.
]
""")
        
        if can_use_tools:
            instructions.append("""
To use a tool:
[TOOL: tool_name]
{
    "param1": "value1",
    "param2": "value2"
}
[/TOOL]
""")
            
        if can_finalize:
            instructions.append("""
To provide a final answer:
[ACTION: final]
Your final answer or conclusion here.
""")
            
        if autonomous_decisions:
            instructions.append("\nYou should make your own decisions about which action to take based on the context and user query.")
        
        return "\n".join(instructions)
    
    @staticmethod
    def get_decision_instructions(
        can_delegate: bool = True, 
        can_use_tools: bool = True, 
        can_finalize: bool = True,
        is_supervisor: bool = False
    ) -> str:
        """
        Get concise decision instructions for a prompt template.
        
        Args:
            can_delegate: Whether the agent can delegate tasks
            can_use_tools: Whether the agent can use tools
            can_finalize: Whether the agent can finalize the workflow
            is_supervisor: Whether this agent is a supervisor
            
        Returns:
            Decision instructions for a prompt template
        """
        instructions = ["Based on the above, choose one of the following actions:"]
        
        if can_delegate:
            if is_supervisor:
                instructions.append("- Delegate to a worker agent by writing [ACTION: delegate to worker_name]")
            else:
                instructions.append("- Delegate to another agent by writing [ACTION: delegate to agent_name]")
        
        if can_use_tools:
            instructions.append("- Use a tool by writing [TOOL: tool_name] followed by parameters in JSON")
            
        if can_finalize:
            instructions.append("- Provide a final answer by writing [ACTION: final]")
            
        return "\n".join(instructions)
    
    @staticmethod
    def format_runtime_placeholders(
        prompt: str,
        available_agents: Optional[List[str]] = None,
        available_tools: Optional[List[Dict[str, Any]]] = None,
        previous_decisions: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Format runtime placeholders in a prompt template.
        
        Args:
            prompt: The prompt template
            available_agents: List of available agent names
            available_tools: List of available tool definitions
            previous_decisions: List of previous decision records
            
        Returns:
            Formatted prompt with placeholders replaced
        """
        formatted_prompt = prompt
        
        # Replace {available_agents} with actual agent information
        if '{available_agents}' in formatted_prompt and available_agents:
            agents_list = "\n".join([f"- {agent}" for agent in available_agents])
            available_agents_text = f"Available agents:\n{agents_list}"
            formatted_prompt = formatted_prompt.replace('{available_agents}', available_agents_text)
        
        # Replace {available_tools} with actual tool information
        if '{available_tools}' in formatted_prompt and available_tools:
            tools_text = "Available tools:\n"
            for tool in available_tools:
                tools_text += f"- {tool['name']}: {tool['description']}\n"
                tools_text += f"  Parameters: {json.dumps(tool['parameters'])}\n"
            formatted_prompt = formatted_prompt.replace('{available_tools}', tools_text)
        
        # Replace {previous_decisions} with actual decision history
        if '{previous_decisions}' in formatted_prompt and previous_decisions:
            decisions_text = "Previous decisions:\n"
            for i, decision in enumerate(previous_decisions):
                decisions_text += f"{i+1}. Agent '{decision['agent']}' decided to {decision['action']}"
                if decision['action'] == 'delegate' and decision.get('target'):
                    decisions_text += f" to {decision['target']}"
                elif decision['action'] == 'use_tool' and decision.get('tool_name'):
                    decisions_text += f" tool '{decision['tool_name']}'"
                decisions_text += "\n"
            formatted_prompt = formatted_prompt.replace('{previous_decisions}', decisions_text)
        
        return formatted_prompt
