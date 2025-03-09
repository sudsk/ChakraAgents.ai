from typing import Dict, List, Any, Optional
from template_engine import (
    TemplateEngine, 
    SupervisorTemplate, 
    SwarmTemplate, 
    AgentConfig, 
    ToolDefinition,
    AgentRole,
    AgentModelProvider,
    WorkflowType
)

def register_default_templates(engine: TemplateEngine):
    """Register default templates with the engine"""
    
    # Register some basic tools
    web_search_tool = ToolDefinition(
        name="web_search",
        description="Search the web for information on a topic",
        function_name="search_web",
        parameters={
            "query": {
                "type": "string",
                "description": "The search query"
            }
        }
    )
    
    code_execution_tool = ToolDefinition(
        name="execute_code",
        description="Execute Python code and return the result",
        function_name="execute_python",
        parameters={
            "code": {
                "type": "string",
                "description": "Python code to execute"
            }
        }
    )
    
    data_analysis_tool = ToolDefinition(
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
                "description": "Type of analysis to perform"
            }
        }
    )
    
    # Register the tools
    engine.register_tool(web_search_tool, lambda query: f"Web search results for: {query}")
    engine.register_tool(code_execution_tool, lambda code: f"Result of code execution: {code[:20]}...")
    engine.register_tool(data_analysis_tool, lambda data_source, analysis_type: f"Analysis of {data_source} using {analysis_type}")
    
    # Register supervisor template: Research Assistant
    research_supervisor = AgentConfig(
        name="research_supervisor",
        role=AgentRole.SUPERVISOR,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-pro",
        prompt_template="""You are a research supervisor coordinating a team of specialized agents.
Your job is to break down the user's research question into sub-tasks and assign them to the appropriate agents.
Analyze the research question, determine what information is needed, and assign tasks to the available agents.
After receiving results from agents, synthesize the information and provide a comprehensive answer.

User question: {input}

Available agents:
- information_retriever: Searches the web for relevant facts and information
- analyst: Analyzes data and generates insights
- fact_checker: Verifies factual claims and identifies potential biases

Think carefully about how to delegate tasks. You may use multiple agents and assign them different aspects of the question.
""",
        temperature=0.2
    )
    
    information_retriever = AgentConfig(
        name="information_retriever",
        role=AgentRole.WORKER,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-flash",
        prompt_template="""You are an information retrieval specialist.
Your job is to search for factual information related to the given query.
Focus on finding accurate, up-to-date information from reliable sources.
Provide a concise summary of the key facts and cite your sources where possible.

Query: {input}
""",
        tools=["web_search"],
        temperature=0.3
    )
    
    analyst = AgentConfig(
        name="analyst",
        role=AgentRole.WORKER,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-pro",
        prompt_template="""You are a data analyst.
Your job is to examine data, identify patterns, and generate insights based on the provided query.
Use analytical thinking to interpret the information and explain your findings clearly.
When appropriate, suggest additional analyses that could be valuable.

Query: {input}
""",
        tools=["analyze_data", "execute_code"],
        temperature=0.4
    )
    
    fact_checker = AgentConfig(
        name="fact_checker",
        role=AgentRole.WORKER,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-flash",
        prompt_template="""You are a fact-checking specialist.
Your job is to verify factual claims by cross-referencing information from multiple sources.
Identify potential biases, misinformation, or areas where information is incomplete.
Rate the reliability of the information and explain your reasoning.

Claims to verify: {input}
""",
        tools=["web_search"],
        temperature=0.2
    )
    
    research_assistant_template = SupervisorTemplate(
        name="research_assistant",
        description="A research assistant that coordinates specialized agents to answer complex questions",
        supervisor=research_supervisor,
        workers=[information_retriever, analyst, fact_checker],
        tools=[web_search_tool, code_execution_tool, data_analysis_tool],
        workflow_config={
            "max_iterations": 5,
            "checkpoint_dir": "./checkpoints/research_assistant"
        }
    )
    
    engine.register_supervisor_template(research_assistant_template)
    
    # Register swarm template: Collaborative Writing Assistant
    content_planner = AgentConfig(
        name="content_planner",
        role=AgentRole.PLANNER,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-pro",
        prompt_template="""You are a content planner.
Your job is to create an outline for a piece of content based on the user's request.
Think carefully about the structure, key points, and flow of the content.
Create a detailed outline that will guide the writing process.

Content request: {input}
Previous outputs from team: {previous_outputs}
""",
        temperature=0.4
    )
    
    writer = AgentConfig(
        name="writer",
        role=AgentRole.EXECUTOR,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-pro",
        prompt_template="""You are a creative writer.
Your job is to produce high-quality, engaging content based on the outline and request.
Follow the outline structure but add creative elements and engaging language.
Focus on clarity, flow, and maintaining the reader's interest.

Content request: {input}
Outline: {previous_outputs}
""",
        temperature=0.7
    )
    
    editor = AgentConfig(
        name="editor",
        role=AgentRole.CRITIC,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-pro",
        prompt_template="""You are an editor.
Your job is to review and improve the written content.
Check for clarity, coherence, grammar, style, and adherence to the original request.
Provide specific feedback and make direct improvements to the text.

Original request: {input}
Content to edit: {previous_outputs}
""",
        temperature=0.3
    )
    
    fact_researcher = AgentConfig(
        name="fact_researcher",
        role=AgentRole.RESEARCHER,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-flash",
        prompt_template="""You are a fact researcher.
Your job is to find and verify factual information that should be included in the content.
Search for relevant statistics, quotes, examples, or references that would strengthen the content.
Provide accurate information with sources where possible.

Content topic: {input}
Additional context: {previous_outputs}
""",
        tools=["web_search"],
        temperature=0.3
    )
    
    writing_assistant_template = SwarmTemplate(
        name="writing_assistant",
        description="A collaborative writing assistant with multiple specialized agents",
        agents=[content_planner, writer, editor, fact_researcher],
        tools=[web_search_tool],
        workflow_config={
            "interaction_type": "sequential",
            "checkpoint_dir": "./checkpoints/writing_assistant"
        }
    )
    
    engine.register_swarm_template(writing_assistant_template)
    
    # Register hub-and-spoke swarm template: Product Development Team
    product_manager = AgentConfig(
        name="product_manager",
        role=AgentRole.SUPERVISOR,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-pro",
        prompt_template="""You are a product manager coordinating a product development team.
Your job is to understand the product requirements, coordinate with specialists, and synthesize their input.
Break down the product request into specific questions for each team member.
After receiving their input, create a cohesive product specification.

Product request: {input}
Team input: {previous_outputs}
""",
        temperature=0.4
    )
    
    ux_designer = AgentConfig(
        name="ux_designer",
        role=AgentRole.WORKER,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-pro",
        prompt_template="""You are a UX designer.
Your job is to create user experience concepts based on the product requirements.
Consider user needs, workflows, interaction patterns, and accessibility.
Provide sketches, wireframes descriptions, or detailed UX recommendations.

Product request: {input}
PM's notes: {hub_output}
""",
        temperature=0.6
    )
    
    developer = AgentConfig(
        name="developer",
        role=AgentRole.WORKER,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-pro",
        prompt_template="""You are a software developer.
Your job is to provide technical recommendations and implementation strategies.
Consider the architecture, technology stack, potential challenges, and development approach.
Provide clear technical specifications and code examples where appropriate.

Product request: {input}
PM's notes: {hub_output}
""",
        tools=["execute_code"],
        temperature=0.4
    )
    
    market_researcher = AgentConfig(
        name="market_researcher",
        role=AgentRole.RESEARCHER,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-flash",
        prompt_template="""You are a market researcher.
Your job is to analyze market trends, competitive landscape, and user needs.
Research similar products, identify gaps in the market, and provide insights on positioning.
Use data and examples to support your recommendations.

Product request: {input}
PM's notes: {hub_output}
""",
        tools=["web_search"],
        temperature=0.4
    )
    
    product_team_template = SwarmTemplate(
        name="product_development_team",
        description="A product development team with a PM coordinating designers, developers, and researchers",
        agents=[product_manager, ux_designer, developer, market_researcher],
        tools=[web_search_tool, code_execution_tool],
        workflow_config={
            "interaction_type": "hub_and_spoke",
            "hub_agent": "product_manager",
            "max_iterations": 3,
            "checkpoint_dir": "./checkpoints/product_team"
        }
    )
    
    engine.register_swarm_template(product_team_template)
    
    return {
        "research_assistant": research_assistant_template,
        "writing_assistant": writing_assistant_template,
        "product_development_team": product_team_template
    }

# Add to backend/app/engine/template_presets.py
def create_rag_assistant_template(engine):
    """Create a RAG-enabled assistant template"""
    research_agent = AgentConfig(
        name="rag_assistant",
        role=AgentRole.RESEARCHER,
        model_provider=AgentModelProvider.VERTEX_AI,
        model_name="gemini-1.5-pro",
        prompt_template="""You are a research assistant with access to a knowledge base.
First, search the knowledge base for relevant information about the user's query.
Then, provide a comprehensive answer based on the retrieved information.
If the knowledge base doesn't contain relevant information, say so and provide your best answer.

User query: {input}
""",
        tools=["retrieve_information", "web_search"],
        temperature=0.3
    )
    
    rag_template = SwarmTemplate(
        name="rag_assistant",
        description="A research assistant with RAG capabilities",
        agents=[research_agent],
        tools=[engine.tools_registry["retrieve_information"]["definition"], 
               engine.tools_registry["web_search"]["definition"]],
        workflow_config={
            "interaction_type": "sequential",
            "max_iterations": 1,
            "checkpoint_dir": "./checkpoints/rag_assistant"
        }
    )
    
    engine.register_swarm_template(rag_template)
    return rag_template
