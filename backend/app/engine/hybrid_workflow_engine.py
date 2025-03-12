# backend/app/engine/hybrid_workflow_engine.py
import logging
import json
import asyncio
import os
from typing import Dict, List, Any, Optional, Union, Set, Tuple
from datetime import datetime
import uuid
from collections import defaultdict

from app.engine.llm_providers import llm_provider_manager
from app.core.config import settings
from app.db.models import Template, Workflow, WorkflowExecution, ExecutionLog
from app.engine.workflow_engine import WorkflowEngine

logger = logging.getLogger(__name__)

class HybridWorkflowEngine(WorkflowEngine):
    """Engine for executing hybrid agent architectures"""
    
    async def _execute_hybrid_workflow(self, config: Dict[str, Any], input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a hybrid workflow with mixed interaction patterns
        
        A hybrid workflow can contain:
        - Team structures with supervisors and workers
        - Peer collaboration between agents
        - Dynamic role assignment based on task requirements
        - Multiple teams working together
        """
        logger.info("Executing hybrid workflow")
        
        # Extract configuration
        teams = config.get("teams", [])
        peer_agents = config.get("peer_agents", [])
        coordination_config = config.get("coordination", {})
        tools = config.get("tools", [])
        workflow_config = config.get("workflow_config", {})
        
        # Validate configuration
        if not teams and not peer_agents:
            raise ValueError("Hybrid workflow must have at least one team or peer agent")
        
        # Get query from input data
        query = input_data.get("query", "")
        if not query:
            raise ValueError("No query provided in input data")
        
        # Initialize tracking structures
        all_agents = {}  # Map of agent_id -> agent_config
        team_outputs = {}  # Map of team_id -> team_outputs
        peer_outputs = {}  # Map of agent_id -> output
        agent_usage = []  # Track agent usage
        execution_graph = defaultdict(set)  # Track which agents communicated
        
        # Register all agents from teams
        for team in teams:
            team_id = team.get("id", f"team_{uuid.uuid4().hex[:8]}")
            
            # Register supervisor
            supervisor = team.get("supervisor")
            if supervisor:
                supervisor_id = supervisor.get("name", f"supervisor_{team_id}")
                all_agents[supervisor_id] = {
                    **supervisor,
                    "team_id": team_id,
                    "role": "supervisor"
                }
            
            # Register workers
            workers = team.get("workers", [])
            for worker in workers:
                worker_id = worker.get("name", f"worker_{uuid.uuid4().hex[:8]}")
                all_agents[worker_id] = {
                    **worker,
                    "team_id": team_id,
                    "role": "worker"
                }
        
        # Register peer agents
        for agent in peer_agents:
            agent_id = agent.get("name", f"peer_{uuid.uuid4().hex[:8]}")
            all_agents[agent_id] = {
                **agent,
                "team_id": None,
                "role": agent.get("role", "peer")
            }
        
        # Process execution plan
        # For hybrid workflows, we'll use a flexible "coordination" approach
        coordination_type = coordination_config.get("type", "sequential")
        logger.info(f"Using coordination type: {coordination_type}")
        
        if coordination_type == "sequential":
            # Process all teams first, then peer agents
            for team in teams:
                team_id = team.get("id", f"team_{uuid.uuid4().hex[:8]}")
                team_result = await self._process_team(
                    team, query, all_agents, team_outputs, peer_outputs, agent_usage, execution_graph
                )
                team_outputs[team_id] = team_result
            
            # Process peer agents
            for agent in peer_agents:
                agent_id = agent.get("name", f"peer_{uuid.uuid4().hex[:8]}")
                peer_result = await self._process_peer_agent(
                    agent, query, all_agents, team_outputs, peer_outputs, agent_usage, execution_graph
                )
                peer_outputs[agent_id] = peer_result
                
        elif coordination_type == "parallel":
            # Execute teams and peer agents in parallel
            team_tasks = []
            for team in teams:
                team_id = team.get("id", f"team_{uuid.uuid4().hex[:8]}")
                task = asyncio.create_task(self._process_team(
                    team, query, all_agents, team_outputs, peer_outputs, agent_usage, execution_graph
                ))
                team_tasks.append((team_id, task))
            
            peer_tasks = []
            for agent in peer_agents:
                agent_id = agent.get("name", f"peer_{uuid.uuid4().hex[:8]}")
                task = asyncio.create_task(self._process_peer_agent(
                    agent, query, all_agents, team_outputs, peer_outputs, agent_usage, execution_graph
                ))
                peer_tasks.append((agent_id, task))
            
            # Wait for all tasks to complete
            for team_id, task in team_tasks:
                team_outputs[team_id] = await task
            
            for agent_id, task in peer_tasks:
                peer_outputs[agent_id] = await task
                
        elif coordination_type == "dynamic":
            # Dynamic coordination where teams can delegate to other teams or peer agents
            # Start with the coordinator team or agent
            coordinator_id = coordination_config.get("coordinator")
            if not coordinator_id:
                raise ValueError("Dynamic coordination requires a coordinator")
            
            processed_agents = set()
            next_agents = [coordinator_id]
            
            while next_agents:
                current_agent_id = next_agents.pop(0)
                
                # Skip if already processed
                if current_agent_id in processed_agents:
                    continue
                
                processed_agents.add(current_agent_id)
                
                # Process the agent or team
                is_team = False
                for team in teams:
                    if team.get("id") == current_agent_id:
                        is_team = True
                        team_result = await self._process_team(
                            team, query, all_agents, team_outputs, peer_outputs, 
                            agent_usage, execution_graph
                        )
                        team_outputs[current_agent_id] = team_result
                        
                        # Check for delegations
                        delegations = self._extract_delegations(team_result.get("final_output", ""))
                        next_agents.extend(delegations)
                        break
                
                if not is_team and current_agent_id in all_agents:
                    # It's an individual agent
                    agent = all_agents[current_agent_id]
                    agent_config = {
                        "name": current_agent_id,
                        **agent
                    }
                    peer_result = await self._process_peer_agent(
                        agent_config, query, all_agents, team_outputs, peer_outputs, 
                        agent_usage, execution_graph
                    )
                    peer_outputs[current_agent_id] = peer_result
                    
                    # Check for delegations
                    delegations = self._extract_delegations(peer_result)
                    next_agents.extend(delegations)
        
        elif coordination_type == "iterative":
            # New coordination type: iterative refinement
            # Teams and agents build on each other's outputs in multiple rounds
            max_iterations = workflow_config.get("max_iterations", 3)
            
            for iteration in range(max_iterations):
                logger.info(f"Starting iteration {iteration+1}/{max_iterations}")
                
                # Process teams
                team_iteration_results = {}
                for team in teams:
                    team_id = team.get("id", f"team_{uuid.uuid4().hex[:8]}")
                    team_result = await self._process_team(
                        team, query, all_agents, team_outputs, peer_outputs, agent_usage, execution_graph,
                        iteration=iteration
                    )
                    team_iteration_results[team_id] = team_result
                
                # Update team outputs with latest results
                for team_id, result in team_iteration_results.items():
                    if team_id not in team_outputs:
                        team_outputs[team_id] = result
                    else:
                        # Merge results, keeping history
                        team_outputs[team_id] = {
                            "supervisor_output": result["supervisor_output"],
                            "worker_outputs": result["worker_outputs"],
                            "final_output": result["final_output"],
                            "history": team_outputs[team_id].get("history", []) + [{
                                "iteration": iteration,
                                "supervisor_output": team_outputs[team_id].get("supervisor_output"),
                                "final_output": team_outputs[team_id].get("final_output")
                            }]
                        }
                
                # Process peer agents
                peer_iteration_results = {}
                for agent in peer_agents:
                    agent_id = agent.get("name", f"peer_{uuid.uuid4().hex[:8]}")
                    peer_result = await self._process_peer_agent(
                        agent, query, all_agents, team_outputs, peer_outputs, agent_usage, execution_graph,
                        iteration=iteration
                    )
                    peer_iteration_results[agent_id] = peer_result
                
                # Update peer outputs with latest results
                for agent_id, result in peer_iteration_results.items():
                    if agent_id not in peer_outputs:
                        peer_outputs[agent_id] = result
                    else:
                        # Store history
                        if isinstance(peer_outputs[agent_id], dict) and "output" in peer_outputs[agent_id]:
                            peer_outputs[agent_id]["history"] = peer_outputs[agent_id].get("history", []) + [{
                                "iteration": iteration,
                                "output": peer_outputs[agent_id]["output"]
                            }]
                            peer_outputs[agent_id]["output"] = result
                        else:
                            # Convert to structured format if it wasn't already
                            peer_outputs[agent_id] = {
                                "output": result,
                                "history": [{
                                    "iteration": iteration,
                                    "output": peer_outputs[agent_id]
                                }]
                            }
                
                # Check for convergence or stopping criteria
                if iteration > 0:
                    should_stop = self._check_convergence(team_outputs, peer_outputs, iteration)
                    if should_stop:
                        logger.info(f"Stopping iterations early due to convergence at iteration {iteration+1}")
                        break
        
        else:
            raise ValueError(f"Unsupported coordination type: {coordination_type}")
        
        # Generate final output - use the designated final agent if specified
        final_agent_id = coordination_config.get("final_agent")
        if final_agent_id:
            if final_agent_id in all_agents:
                final_agent = all_agents[final_agent_id]
                final_prompt = self._create_final_prompt(
                    query, final_agent, team_outputs, peer_outputs
                )
                
                final_response = await self.llm_provider.generate_response(
                    provider_name=final_agent.get("model_provider", "vertex_ai"),
                    model_name=final_agent.get("model_name", "gemini-1.5-pro"),
                    prompt=final_prompt,
                    system_message=final_agent.get("system_message", ""),
                    temperature=final_agent.get("temperature", 0.5)
                )
                
                final_output = final_response.get("content", "")
                
                # Log usage
                agent_usage.append({
                    "iteration": 999,  # Use a high number to indicate final output
                    "agent": final_agent_id,
                    "role": "final",
                    "model": f"{final_agent.get('model_provider')}/{final_agent.get('model_name')}",
                    "output_length": len(final_output)
                })
            else:
                # If final agent not found, use the first team's output
                if team_outputs:
                    final_output = next(iter(team_outputs.values())).get("final_output", "")
                else:
                    # Fall back to the first peer agent
                    if peer_outputs:
                        first_peer_output = next(iter(peer_outputs.values()))
                        if isinstance(first_peer_output, dict) and "output" in first_peer_output:
                            final_output = first_peer_output["output"]
                        else:
                            final_output = first_peer_output
                    else:
                        final_output = "No output generated by any agent."
        else:
            # No final agent specified, create a synthesis
            synthesis_prompt = f"Synthesize all outputs to provide a final answer to the query: '{query}'\n\n"
            
            # Add team outputs
            if team_outputs:
                synthesis_prompt += "Team outputs:\n"
                for team_id, output in team_outputs.items():
                    team_final = output.get("final_output", "")
                    synthesis_prompt += f"Team {team_id}: {team_final}\n\n"
            
            # Add peer outputs
            if peer_outputs:
                synthesis_prompt += "Peer agent outputs:\n"
                for agent_id, output in peer_outputs.items():
                    if isinstance(output, dict) and "output" in output:
                        synthesis_prompt += f"{agent_id}: {output['output']}\n\n"
                    else:
                        synthesis_prompt += f"{agent_id}: {output}\n\n"
            
            # Get a default model for synthesis
            synthesis_response = await self.llm_provider.generate_response(
                provider_name="vertex_ai",
                model_name="gemini-1.5-pro",
                prompt=synthesis_prompt,
                temperature=0.5
            )
            
            final_output = synthesis_response.get("content", "")
        
        # Format outputs for result
        formatted_outputs = {}
        for team_id, output in team_outputs.items():
            formatted_outputs[f"team:{team_id}"] = output
        
        for agent_id, output in peer_outputs.items():
            formatted_outputs[f"agent:{agent_id}"] = output
        
        # Convert execution graph to serializable format
        serializable_graph = {}
        for source, targets in execution_graph.items():
            serializable_graph[source] = list(targets)
        
        # Return the combined results
        return {
            "final_output": final_output,
            "outputs": formatted_outputs,
            "agent_usage": agent_usage,
            "execution_graph": serializable_graph
        }
    
    async def _process_team(
        self, team: Dict[str, Any], query: str, 
        all_agents: Dict[str, Any], team_outputs: Dict[str, Any], 
        peer_outputs: Dict[str, Any], agent_usage: List[Dict[str, Any]],
        execution_graph: Dict[str, Set[str]], iteration: int = 0
    ) -> Dict[str, Any]:
        """Process a single team with supervisor and workers"""
        team_id = team.get("id", f"team_{uuid.uuid4().hex[:8]}")
        supervisor = team.get("supervisor")
        workers = team.get("workers", [])
        
        # Validate team structure
        if not supervisor:
            raise ValueError(f"Team {team_id} is missing a supervisor")
        
        if not workers:
            raise ValueError(f"Team {team_id} has no workers")
        
        # Initialize supervisor
        supervisor_id = supervisor.get("name", f"supervisor_{team_id}")
        supervisor_model_provider = supervisor.get("model_provider", "vertex_ai")
        supervisor_model_name = supervisor.get("model_name", "gemini-1.5-pro")
        supervisor_prompt_template = supervisor.get("prompt_template", "")
        supervisor_system_message = supervisor.get("system_message", "")
        
        # Create supervisor prompt
        supervisor_prompt = supervisor_prompt_template.replace("{input}", query)
        
        # Add context from peer agents and other teams if available
        if team_outputs or peer_outputs:
            context = self._create_context(team_id, supervisor_id, team_outputs, peer_outputs)
            supervisor_prompt = supervisor_prompt.replace("{context}", context)
        else:
            supervisor_prompt = supervisor_prompt.replace("{context}", "No context available yet")
        
        # Add iteration information if this is an iterative workflow
        if iteration > 0:
            iteration_context = f"\nThis is iteration {iteration+1}. "
            if team_id in team_outputs:
                prev_output = team_outputs[team_id].get("final_output", "")
                iteration_context += f"Your previous output was: {prev_output}\n"
            supervisor_prompt = supervisor_prompt.replace("{iteration}", iteration_context)
        else:
            supervisor_prompt = supervisor_prompt.replace("{iteration}", "")
        
        # Add available workers information
        workers_info = "\n\nAvailable workers:\n" + "\n".join([
            f"- {worker.get('name', f'worker_{idx}')} ({worker.get('role', 'worker')}): {worker.get('description', 'No description')}"
            for idx, worker in enumerate(workers)
        ])
        supervisor_prompt += workers_info
        
        # Get supervisor response
        supervisor_response = await self.llm_provider.generate_response(
            provider_name=supervisor_model_provider,
            model_name=supervisor_model_name,
            prompt=supervisor_prompt,
            system_message=supervisor_system_message,
            temperature=supervisor.get("temperature", 0.7),
            max_tokens=supervisor.get("max_tokens")
        )
        
        supervisor_output = supervisor_response.get("content", "")
        
        # Track usage
        agent_usage.append({
            "iteration": iteration + 1,
            "agent": supervisor_id,
            "team": team_id,
            "role": "supervisor",
            "model": f"{supervisor_model_provider}/{supervisor_model_name}",
            "output_length": len(supervisor_output)
        })
        
        # 2. Process with workers
        worker_outputs = {}
        
        # Parse supervisor response to determine which workers to use
        selected_workers = self._select_workers_from_supervisor_response(
            supervisor_output, workers
        )
        
        if not selected_workers:
            # If no workers could be determined from parsing, use all workers
            selected_workers = workers
        
        # Process each worker
        for worker in selected_workers:
            worker_id = worker.get("name", f"worker_{uuid.uuid4().hex[:8]}")
            worker_role = worker.get("role", "worker")
            worker_model_provider = worker.get("model_provider", "vertex_ai")
            worker_model_name = worker.get("model_name", "gemini-1.5-flash")
            worker_prompt_template = worker.get("prompt_template", "")
            worker_system_message = worker.get("system_message", "")
            
            # Create worker prompt
            worker_prompt = worker_prompt_template.replace("{input}", query)
            worker_prompt = worker_prompt.replace("{supervisor_response}", supervisor_output)
            
            # Add context from other workers if available
            if worker_outputs:
                context = "\n\n".join([f"{name}: {output}" for name, output in worker_outputs.items()])
                worker_prompt = worker_prompt.replace("{worker_outputs}", context)
            else:
                worker_prompt = worker_prompt.replace("{worker_outputs}", "No worker outputs yet")
            
            # Add iteration information if this is an iterative workflow
            worker_prompt = worker_prompt.replace("{iteration}", f"Iteration {iteration+1}" if iteration > 0 else "")
            
            # Check if worker has RAG capabilities
            worker_tools = worker.get("tools", [])
            if "retrieve_information" in worker_tools:
                rag_results = await self.execute_tool("retrieve_information", query=query, num_results=5)
                worker_prompt = worker_prompt.replace("{retrieved_information}", rag_results)
            else:
                worker_prompt = worker_prompt.replace("{retrieved_information}", "No information retrieved")
            
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
            worker_outputs[worker_id] = worker_output
            
            # Track usage
            agent_usage.append({
                "iteration": iteration + 1,
                "agent": worker_id,
                "team": team_id,
                "role": worker_role,
                "model": f"{worker_model_provider}/{worker_model_name}",
                "output_length": len(worker_output)
            })
            
            # Update execution graph to show supervisor->worker connection
            execution_graph[supervisor_id].add(worker_id)
        
        # 3. Final synthesis by supervisor
        synthesis_prompt = f"Based on your initial analysis and the work from your team, provide a final response to: {query}\n\n"
        synthesis_prompt += "Worker outputs:\n"
        synthesis_prompt += "\n\n".join([f"{name}: {output}" for name, output in worker_outputs.items()])
        
        synthesis_response = await self.llm_provider.generate_response(
            provider_name=supervisor_model_provider,
            model_name=supervisor_model_name,
            prompt=synthesis_prompt,
            system_message=supervisor_system_message,
            temperature=supervisor.get("temperature", 0.5)
        )
        
        final_output = synthesis_response.get("content", "")
        
        # Return team result
        return {
            "supervisor_output": supervisor_output,
            "worker_outputs": worker_outputs,
            "final_output": final_output
        }
    
    async def _process_peer_agent(
        self, agent: Dict[str, Any], query: str,
        all_agents: Dict[str, Any], team_outputs: Dict[str, Any],
        peer_outputs: Dict[str, Any], agent_usage: List[Dict[str, Any]],
        execution_graph: Dict[str, Set[str]], iteration: int = 0
    ) -> str:
        """Process a single peer agent"""
        agent_id = agent.get("name", f"agent_{uuid.uuid4().hex[:8]}")
        agent_role = agent.get("role", "peer")
        agent_model_provider = agent.get("model_provider", "vertex_ai")
        agent_model_name = agent.get("model_name", "gemini-1.5-flash")
        agent_prompt_template = agent.get("prompt_template", "")
        agent_system_message = agent.get("system_message", "")
        
        # Create agent prompt
        agent_prompt = agent_prompt_template.replace("{input}", query)
        
        # Add context from other agents and teams
        if team_outputs or peer_outputs:
            context = self._create_context(None, agent_id, team_outputs, peer_outputs)
            agent_prompt = agent_prompt.replace("{context}", context)
        else:
            agent_prompt = agent_prompt.replace("{context}", "No context available yet")
        
        # Add iteration information if this is an iterative workflow
        if iteration > 0:
            iteration_context = f"\nThis is iteration {iteration+1}. "
            # Check if we have a previous output for this agent
            if agent_id in peer_outputs:
                prev_output = peer_outputs[agent_id]
                if isinstance(prev_output, dict) and "output" in prev_output:
                    prev_output = prev_output["output"]
                iteration_context += f"Your previous output was: {prev_output}\n"
            agent_prompt = agent_prompt.replace("{iteration}", iteration_context)
        else:
            agent_prompt = agent_prompt.replace("{iteration}", "")
        
        # Check if agent has RAG capabilities
        agent_tools = agent.get("tools", [])
        if "retrieve_information" in agent_tools:
            rag_results = await self.execute_tool("retrieve_information", query=query, num_results=5)
            agent_prompt = agent_prompt.replace("{retrieved_information}", rag_results)
        else:
            agent_prompt = agent_prompt.replace("{retrieved_information}", "No information retrieved")
        
        # Get agent response
        agent_response = await self.llm_provider.generate_response(
            provider_name=agent_model_provider,
            model_name=agent_model_name,
            prompt=agent_prompt,
            system_message=agent_system_message,
            temperature=agent.get("temperature", 0.7),
            max_tokens=agent.get("max_tokens")
        )
        
        agent_output = agent_response.get("content", "")
        
        # Track usage
        agent_usage.append({
            "iteration": iteration + 1,
            "agent": agent_id,
            "team": None,
            "role": agent_role,
            "model": f"{agent_model_provider}/{agent_model_name}",
            "output_length": len(agent_output)
        })
        
        # Look for communication instructions from the agent
        for other_agent_id in all_agents:
            if other_agent_id != agent_id and other_agent_id in agent_output:
                # If the agent mentions another agent, consider it a communication path
                execution_graph[agent_id].add(other_agent_id)
        
        return agent_output
    
    def _select_workers_from_supervisor_response(self, supervisor_output: str, workers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parse supervisor response to determine which workers to use"""
        selected_workers = []
        worker_names = [worker.get("name") for worker in workers]
        
        # Look for explicit worker assignments
        if "WORKERS:" in supervisor_output or "ASSIGN:" in supervisor_output:
            # Check for WORKERS: or ASSIGN: format
            assignment_section = None
            if "WORKERS:" in supervisor_output:
                assignment_section = supervisor_output.split("WORKERS:")[1].split("\n\n")[0]
            elif "ASSIGN:" in supervisor_output:
                assignment_section = supervisor_output.split("ASSIGN:")[1].split("\n\n")[0]
            
            if assignment_section:
                # Parse worker names from the section
                for worker_name in worker_names:
                    if worker_name in assignment_section:
                        worker = next((w for w in workers if w.get("name") == worker_name), None)
                        if worker:
                            selected_workers.append(worker)
        
        # If no explicit assignments, look for worker names in the text
        if not selected_workers:
            for worker in workers:
                worker_name = worker.get("name")
                if worker_name in supervisor_output:
                    selected_workers.append(worker)
        
        return selected_workers
    
    def _create_context(
        self, current_team_id: Optional[str], current_agent_id: str,
        team_outputs: Dict[str, Any], peer_outputs: Dict[str, Any]
    ) -> str:
        """Create context from other agents and teams"""
        context_parts = []
        
        # Add team outputs (excluding current team)
        for team_id, output in team_outputs.items():
            if team_id != current_team_id:
                team_summary = output.get("final_output", "")
                if team_summary:
                    context_parts.append(f"Team {team_id}: {team_summary}")
        
        # Add peer outputs (excluding current agent)
        for agent_id, output in peer_outputs.items():
            if agent_id != current_agent_id:
                if isinstance(output, dict) and "output" in output:
                    context_parts.append(f"Agent {agent_id}: {output['output']}")
                else:
                    context_parts.append(f"Agent {agent_id}: {output}")
        
        if not context_parts:
            return "No prior context available."
        
        return "\n\n".join([
            "Context from other agents and teams:",
            *context_parts
        ])
    
    def _create_final_prompt(
        self, query: str, final_agent: Dict[str, Any],
        team_outputs: Dict[str, Any], peer_outputs: Dict[str, Any]
    ) -> str:
        """Create a prompt for the final synthesis agent"""
        prompt_template = final_agent.get("prompt_template", "")
        
        # If no template is provided, create a default one
        if not prompt_template:
            prompt = f"Based on all the information provided, create a comprehensive final response to: {query}\n\n"
        else:
            prompt = prompt_template.replace("{input}", query)
        
        # Add team outputs
        if team_outputs:
            prompt += "\nTeam outputs:\n"
            for team_id, output in team_outputs.items():
                team_final = output.get("final_output", "")
                prompt += f"Team {team_id}:\n{team_final}\n\n"
        
        # Add peer outputs
        if peer_outputs:
            prompt += "\nIndividual agent outputs:\n"
            for agent_id, output in peer_outputs.items():
                if isinstance(output, dict) and "output" in output:
                    prompt += f"Agent {agent_id}:\n{output['output']}\n\n"
                else:
                    prompt += f"Agent {agent_id}:\n{output}\n\n"
        
        return prompt
    
    def _extract_delegations(self, agent_output: str) -> List[str]:
        """
        Extract delegation instructions from agent output
        
        Example formats:
        - DELEGATE: agent1, team2
        - ASSIGN TO: agent1, team2
        """
        delegations = []
        
        # Check for delegation instructions in various formats
        delegation_markers = ["DELEGATE:", "ASSIGN TO:", "DELEGATING TO:"]
        for marker in delegation_markers:
            if marker in agent_output:
                parts = agent_output.split(marker)
                if len(parts) > 1:
                    delegation_line = parts[1].split("\n")[0].strip()
                    delegations.extend([d.strip() for d in delegation_line.split(",")])
        
        return delegations
    
    def _check_convergence(self, team_outputs: Dict[str, Any], peer_outputs: Dict[str, Any], iteration: int) -> bool:
        """Check if the outputs have converged and further iterations are unnecessary"""
        # If this is the first iteration, always continue
        if iteration == 0:
            return False
        
        # Check team outputs for convergence
        for team_id, output in team_outputs.items():
            if "history" in output and len(output["history"]) > 0:
                # Get the current and previous outputs
                current_output = output.get("final_output", "")
                previous_output = output["history"][-1].get("final_output", "")
                
                # If outputs are very different, continue iterations
                if self._calculate_difference(current_output, previous_output) > 0.3:
                    return False
        
        # Check peer outputs for convergence
        for agent_id, output in peer_outputs.items():
            if isinstance(output, dict) and "history" in output and len(output["history"]) > 0:
                # Get the current and previous outputs
                current_output = output.get("output", "")
                previous_output = output["history"][-1].get("output", "")
                
                # If outputs are very different, continue iterations
                if self._calculate_difference(current_output, previous_output) > 0.3:
                    return False
        
        # If we get here, outputs have likely converged
        return True
    
    def _calculate_difference(self, text1: str, text2: str) -> float:
        """Calculate a simple difference score between two text outputs"""
        # Very basic difference calculation based on length
        if not text1 or not text2:
            return 1.0
            
        len_diff = abs(len(text1) - len(text2)) / max(len(text1), len(text2))
        
        # Check for shared content (very simple approach)
        shared_words = set(text1.lower().split()) & set(text2.lower().split())
        word_similarity = len(shared_words) / max(len(text1.split()), len(text2.split()))
        
        # Combine metrics with more weight on word similarity
        return 0.3 * len_diff + 0.7 * (1 - word_similarity)
    
    async def _add_hybrid_execution_logs(self, db, execution_id, result: Dict[str, Any]):
        """Add hybrid workflow execution logs to the database"""
        # Log team outputs
        outputs = result.get("outputs", {})
        for output_key, output_value in outputs.items():
            if output_key.startswith("team:"):
                team_id = output_key.split(":")[1]
                
                # Log supervisor output
                supervisor_output = output_value.get("supervisor_output", "")
                if supervisor_output:
                    supervisor_log = ExecutionLog(
                        execution_id=execution_id,
                        level="info",
                        agent=f"supervisor_{team_id}",
                        message=f"Team {team_id} Supervisor",
                        data={"content": supervisor_output}
                    )
                    db.add(supervisor_log)
                
                # Log worker outputs
                worker_outputs = output_value.get("worker_outputs", {})
                for worker_id, worker_output in worker_outputs.items():
                    worker_log = ExecutionLog(
                        execution_id=execution_id,
                        level="info",
                        agent=worker_id,
                        message=f"Team {team_id} Worker",
                        data={"content": worker_output}
                    )
                    db.add(worker_log)
                
                # Log team final output
                team_final = output_value.get("final_output", "")
                if team_final:
                    team_log = ExecutionLog(
                        execution_id=execution_id,
                        level="info",
                        agent=f"team_{team_id}",
                        message=f"Team {team_id} Final Output",
                        data={"content": team_final}
                    )
                    db.add(team_log)
            
            elif output_key.startswith("agent:"):
                agent_id = output_key.split(":")[1]
                
                # Handle both string outputs and structured outputs
                if isinstance(output_value, dict) and "output" in output_value:
                    agent_output = output_value["output"]
                else:
                    agent_output = output_value
                    
                agent_log = ExecutionLog(
                    execution_id=execution_id,
                    level="info",
                    agent=agent_id,
                    message=f"Peer Agent Output",
                    data={"content": agent_output}
                )
                db.add(agent_log)
        
        # Log execution graph
        execution_graph = result.get("execution_graph", {})
        if execution_graph:
            graph_log = ExecutionLog(
                execution_id=execution_id,
                level="info",
                agent="system",
                message="Execution Graph",
                data={"graph": execution_graph}
            )
            db.add(graph_log)
        
        # Log agent usage statistics
        agent_usage = result.get("agent_usage", [])
        if agent_usage:
            usage_log = ExecutionLog(
                execution_id=execution_id,
                level="info",
                agent="system",
                message="Agent Usage Statistics",
                data={"usage": agent_usage}
            )
            db.add(usage_log)
        
        # Log final output
        final_output = result.get("final_output", "")
        if final_output:
            final_log = ExecutionLog(
                execution_id=execution_id,
                level="info",
                agent="system",
                message="Final Output",
                data={"content": final_output}
            )
            db.add(final_log)
        
        db.commit()
    
    async def execute_workflow(self, template: Template, workflow: Workflow, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Override execute_workflow to handle hybrid workflows"""
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
            if workflow_type == "hybrid":
                result = await self._execute_hybrid_workflow(merged_config, input_data)
            else:
                # Use parent class implementation for other workflow types
                return await super().execute_workflow(template, workflow, input_data)
            
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
