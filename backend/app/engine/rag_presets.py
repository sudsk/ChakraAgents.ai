# backend/app/engine/rag_presets.py
from typing import Dict, Any, List
from app.engine.tools.rag_tool import RAGTool

def create_rag_template() -> Dict[str, Any]:
    """Create a basic RAG template"""
    retrieve_tool = RAGTool().get_tool_definition()
    
    return {
        "name": "RAG Assistant",
        "description": "A simple retrieval-augmented generation assistant",
        "workflow_type": "rag",
        "config": {
            "model_provider": "vertex_ai",
            "model_name": "gemini-1.5-pro",
            "system_message": "You are a helpful assistant with access to a knowledge base. Answer questions based on the retrieved information when available. If the retrieved information doesn't contain the answer, state that clearly before providing your best response.",
            "temperature": 0.3,
            "num_results": 5,
            "tools": [retrieve_tool],
            "workflow_config": {
                "max_iterations": 1,
                "checkpoint_dir": "./checkpoints/rag_assistant"
            }
        }
    }

def create_supervisor_rag_template() -> Dict[str, Any]:
    """Create a RAG template with supervisor-worker architecture"""
    retrieve_tool = RAGTool().get_tool_definition()
    
    return {
        "name": "RAG Research Team",
        "description": "A supervisor-coordinated team with RAG capabilities",
        "workflow_type": "supervisor",
        "config": {
            "supervisor": {
                "name": "research_supervisor",
                "role": "supervisor",
                "model_provider": "vertex_ai",
                "model_name": "gemini-1.5-pro",
                "prompt_template": """You are a research supervisor coordinating a team of specialized agents.
Your job is to break down the user's research question into sub-tasks and assign them to the appropriate workers.
Analyze the research question and determine what information is needed.

User question: {input}""",
                "system_message": "You are a research team supervisor. Coordinate your team effectively to produce a well-researched, accurate response.",
                "temperature": 0.3
            },
            "workers": [
                {
                    "name": "knowledge_retriever",
                    "role": "researcher",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-flash",
                    "prompt_template": """You are a knowledge retriever with access to a database of information.
Your job is to search for factual information related to the given query.
Focus on retrieving accurate, relevant information.

Supervisor's task: {supervisor_response}

User query: {input}

Retrieved information: {retrieved_information}

Provide a concise summary of the key facts found in the retrieved information.
""",
                    "tools": ["retrieve_information"],
                    "temperature": 0.3
                },
                {
                    "name": "analyst",
                    "role": "analyzer",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-pro",
                    "prompt_template": """You are a data analyst and critical thinker.
Your job is to analyze the information retrieved by the knowledge retriever and identify key insights.
Evaluate the information for relevance, accuracy, and completeness.

Supervisor's task: {supervisor_response}
User query: {input}
Other workers' outputs: {worker_outputs}

Provide a critical analysis of the information and identify any gaps or inconsistencies.
""",
                    "temperature": 0.4
                },
                {
                    "name": "response_writer",
                    "role": "writer",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-pro",
                    "prompt_template": """You are a response writer.
Your job is to craft a comprehensive, well-structured response to the user's query.
Base your response on the information provided by the knowledge retriever and the analyst.

User query: {input}
Supervisor's task: {supervisor_response}
Other workers' outputs: {worker_outputs}

Write a clear, informative response that addresses the user's query.
""",
                    "temperature": 0.5
                }
            ],
            "tools": [retrieve_tool],
            "workflow_config": {
                "max_iterations": 1,
                "checkpoint_dir": "./checkpoints/rag_supervisor"
            }
        }
    }

def create_swarm_rag_template() -> Dict[str, Any]:
    """Create a RAG template with swarm architecture"""
    retrieve_tool = RAGTool().get_tool_definition()
    
    return {
        "name": "RAG Collaborative Swarm",
        "description": "A collaborative swarm of agents with RAG capabilities",
        "workflow_type": "swarm",
        "config": {
            "agents": [
                {
                    "name": "knowledge_agent",
                    "role": "researcher",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-flash",
                    "prompt_template": """You are a knowledge agent with access to a database of information.
Your job is to retrieve and summarize factual information related to the given query.

User query: {input}
Retrieved information: {retrieved_information}

Provide a concise summary of the key facts found in the retrieved information.
Previous outputs from team: {previous_outputs}
""",
                    "tools": ["retrieve_information"],
                    "temperature": 0.3
                },
                {
                    "name": "context_agent",
                    "role": "context_provider",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-flash",
                    "prompt_template": """You are a context agent.
Your job is to provide broader context and background information for the query.

User query: {input}
Previous outputs from team: {previous_outputs}

Provide relevant background information, historical context, or key concepts related to the query.
""",
                    "temperature": 0.4
                },
                {
                    "name": "synthesis_agent",
                    "role": "synthesizer",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-pro",
                    "prompt_template": """You are a synthesis agent.
Your job is to combine the information from the knowledge agent and context agent into a comprehensive response.

User query: {input}
Previous outputs from team: {previous_outputs}

Create a well-structured, informative response that incorporates both factual information and broader context.
""",
                    "temperature": 0.5
                }
            ],
            "tools": [retrieve_tool],
            "workflow_config": {
                "interaction_type": "sequential",
                "max_iterations": 1,
                "checkpoint_dir": "./checkpoints/rag_swarm"
            }
        }
    }

def create_hub_spoke_rag_template() -> Dict[str, Any]:
    """Create a RAG template with hub-and-spoke architecture"""
    retrieve_tool = RAGTool().get_tool_definition()
    
    return {
        "name": "RAG Hub-and-Spoke Team",
        "description": "A hub-coordinated team with RAG capabilities",
        "workflow_type": "swarm",
        "config": {
            "agents": [
                {
                    "name": "coordinator",
                    "role": "hub",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-pro",
                    "prompt_template": """You are a research coordinator managing a team of specialized agents.
Your job is to analyze the user's query, identify the key aspects that need investigation, and coordinate the research effort.

User query: {input}

Break down this query into specific areas that need to be researched and specify what each specialist should focus on.
""",
                    "temperature": 0.3
                },
                {
                    "name": "fact_retriever",
                    "role": "researcher",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-flash",
                    "prompt_template": """You are a fact retriever with access to a knowledge base.
Your job is to search for and provide factual information related to your assigned aspect of the query.

User query: {input}
Coordinator's instructions: {hub_output}
Retrieved information: {retrieved_information}

Provide a detailed report on the factual information you've found.
""",
                    "tools": ["retrieve_information"],
                    "temperature": 0.3
                },
                {
                    "name": "analyst",
                    "role": "analyzer",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-flash",
                    "prompt_template": """You are an analyst.
Your job is to analyze the implications and significance of the user's query.

User query: {input}
Coordinator's instructions: {hub_output}

Provide an analysis of the significance, implications, and broader context of this query.
""",
                    "temperature": 0.4
                },
                {
                    "name": "critic",
                    "role": "critic",
                    "model_provider": "vertex_ai",
                    "model_name": "gemini-1.5-flash",
                    "prompt_template": """You are a critic and quality controller.
Your job is to identify potential issues, biases, or limitations in the research approach.

User query: {input}
Coordinator's instructions: {hub_output}

Identify potential blind spots, biases, or limitations in how this query might be approached.
""",
                    "temperature": 0.4
                }
            ],
            "tools": [retrieve_tool],
            "workflow_config": {
                "interaction_type": "hub_and_spoke",
                "hub_agent": "coordinator",
                "max_iterations": 1,
                "checkpoint_dir": "./checkpoints/rag_hub_spoke"
            }
        }
    }
