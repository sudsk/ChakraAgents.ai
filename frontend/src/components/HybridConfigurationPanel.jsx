// frontend/src/components/HybridConfigurationPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  FormHelperText,
  Heading,
  HStack,
  Icon,
  Input,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TabList,
  TabPanel,
  TabPanels,
  Text,
  Textarea,
  VStack,
  useToast,
  ButtonGroup,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Badge,
  SimpleGrid,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon
} from '@chakra-ui/react';
import { 
  FiUsers, FiPlus, FiTrash2, FiMove, FiLink, FiCpu, FiGrid, FiMessageSquare, 
  FiLayers, FiX, FiArrowRight, FiEdit, FiSettings, FiEye, FiDownload, FiUpload, FiCheck
} from 'react-icons/fi';

const HybridConfigurationPanel = ({ config, onChange, isEditing = true, agents = [], tools = [], providers  }) => {
  const defaultProviders = [
      { value: 'vertex_ai', label: 'Vertex AI' },
      { value: 'openai', label: 'OpenAI' },
      { value: 'anthropic', label: 'Anthropic' },
      { value: 'custom', label: 'Custom Provider' }
  ];  
  // Use provided providers or fallback to default
  const modelProviders = providers || defaultProviders; 
  
  const [hybridConfig, setHybridConfig] = useState({
    teams: config?.teams || [],
    peer_agents: config?.peer_agents || [],
    coordination: config?.coordination || {
      type: 'sequential',
      final_agent: null
    },
    tools: config?.tools || [],
    workflow_config: config?.workflow_config || {
      max_iterations: 3,
      checkpoint_dir: './checkpoints/hybrid'
    }
  });
  
  // Keep track of selected agent for editing
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(null);
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(null);
  const [selectedAgentType, setSelectedAgentType] = useState(null); // 'team-supervisor', 'team-worker', 'peer'
  
  const toast = useToast();
  
  // Update parent component when configuration changes
  useEffect(() => {
    if (onChange) {
      onChange(hybridConfig);
    }
  }, [hybridConfig, onChange]);
  
  // Add a new team
  const addTeam = () => {
    const teamId = `team_${Date.now().toString(36)}`;
    const newTeam = {
      id: teamId,
      name: `Team ${hybridConfig.teams.length + 1}`,
      description: 'A specialized team with supervisor and workers',
      supervisor: {
        name: `supervisor_${teamId}`,
        role: 'supervisor',
        model_provider: 'vertex_ai',
        model_name: 'gemini-1.5-pro',
        prompt_template: `You are a supervisor agent coordinating a team of specialized workers.
Your task is to analyze the following query, break it down into subtasks, and coordinate with your workers to solve it.

Query: {input}

Context from other teams/agents: {context}`,
        temperature: 0.3,
        system_message: 'You are a supervisor agent. Your role is to coordinate your team effectively and synthesize their outputs into a coherent response.'
      },
      workers: []
    };
    
    setHybridConfig(prev => ({
      ...prev,
      teams: [...prev.teams, newTeam]
    }));
    
    // Select the new team's supervisor for editing
    setSelectedTeamIndex(hybridConfig.teams.length);
    setSelectedAgentIndex(0);
    setSelectedAgentType('team-supervisor');
  };
  
  // Add a worker to a team
  const addWorker = (teamIndex) => {
    const teamId = hybridConfig.teams[teamIndex].id;
    const workerId = `worker_${Date.now().toString(36)}`;
    const newWorker = {
      name: workerId,
      role: 'worker',
      model_provider: 'vertex_ai',
      model_name: 'gemini-1.5-flash',
      prompt_template: `You are a specialized worker agent in a team.

Task from supervisor: {supervisor_response}
Original query: {input}
Previous worker outputs: {worker_outputs}
Retrieved information: {retrieved_information}

Provide your specialized analysis or solution based on your role.`,
      temperature: 0.7,
      system_message: 'You are a worker agent specialized in a particular domain. Focus on your area of expertise to provide valuable insights.'
    };
    
    const updatedTeams = [...hybridConfig.teams];
    updatedTeams[teamIndex].workers = [...updatedTeams[teamIndex].workers, newWorker];
    
    setHybridConfig(prev => ({
      ...prev,
      teams: updatedTeams
    }));
    
    // Select the new worker for editing
    setSelectedTeamIndex(teamIndex);
    setSelectedAgentIndex(updatedTeams[teamIndex].workers.length - 1);
    setSelectedAgentType('team-worker');
  };
  
  // Add a peer agent
  const addPeerAgent = () => {
    const agentId = `agent_${Date.now().toString(36)}`;
    const newAgent = {
      name: agentId,
      role: 'peer',
      model_provider: 'vertex_ai',
      model_name: 'gemini-1.5-flash',
      prompt_template: `You are an independent peer agent working on a collaborative task.

Query: {input}
Context from other agents/teams: {context}
Retrieved information: {retrieved_information}

Analyze the problem from your perspective and provide your insights.`,
      temperature: 0.7,
      system_message: 'You are a peer agent with a unique perspective. Contribute your specialized knowledge to the collaborative effort.'
    };
    
    setHybridConfig(prev => ({
      ...prev,
      peer_agents: [...prev.peer_agents, newAgent]
    }));
    
    // Select the new peer agent for editing
    setSelectedTeamIndex(null);
    setSelectedAgentIndex(hybridConfig.peer_agents.length);
    setSelectedAgentType('peer');
  };
  
  // Delete a team
  const deleteTeam = (teamIndex) => {
    const updatedTeams = [...hybridConfig.teams];
    updatedTeams.splice(teamIndex, 1);
    
    setHybridConfig(prev => ({
      ...prev,
      teams: updatedTeams
    }));
    
    // Clear selection if the selected team was deleted
    if (selectedTeamIndex === teamIndex && selectedAgentType.startsWith('team-')) {
      setSelectedTeamIndex(null);
      setSelectedAgentIndex(null);
      setSelectedAgentType(null);
    }
  };
  
  // Delete a worker
  const deleteWorker = (teamIndex, workerIndex) => {
    const updatedTeams = [...hybridConfig.teams];
    updatedTeams[teamIndex].workers.splice(workerIndex, 1);
    
    setHybridConfig(prev => ({
      ...prev,
      teams: updatedTeams
    }));
    
    // Clear selection if the selected worker was deleted
    if (selectedTeamIndex === teamIndex && 
        selectedAgentIndex === workerIndex && 
        selectedAgentType === 'team-worker') {
      setSelectedAgentIndex(null);
    }
  };
  
  // Delete a peer agent
  const deletePeerAgent = (agentIndex) => {
    const updatedAgents = [...hybridConfig.peer_agents];
    updatedAgents.splice(agentIndex, 1);
    
    setHybridConfig(prev => ({
      ...prev,
      peer_agents: updatedAgents
    }));
    
    // Clear selection if the selected peer agent was deleted
    if (selectedAgentType === 'peer' && selectedAgentIndex === agentIndex) {
      setSelectedAgentIndex(null);
      setSelectedAgentType(null);
    }
  };
  
  // Update agent fields
  const updateAgent = (field, value) => {
    if (!selectedAgentType) return;
    
    if (selectedAgentType === 'team-supervisor') {
      const updatedTeams = [...hybridConfig.teams];
      updatedTeams[selectedTeamIndex].supervisor = {
        ...updatedTeams[selectedTeamIndex].supervisor,
        [field]: value
      };
      
      setHybridConfig(prev => ({
        ...prev,
        teams: updatedTeams
      }));
    } else if (selectedAgentType === 'team-worker') {
      const updatedTeams = [...hybridConfig.teams];
      updatedTeams[selectedTeamIndex].workers[selectedAgentIndex] = {
        ...updatedTeams[selectedTeamIndex].workers[selectedAgentIndex],
        [field]: value
      };
      
      setHybridConfig(prev => ({
        ...prev,
        teams: updatedTeams
      }));
    } else if (selectedAgentType === 'peer') {
      const updatedAgents = [...hybridConfig.peer_agents];
      updatedAgents[selectedAgentIndex] = {
        ...updatedAgents[selectedAgentIndex],
        [field]: value
      };
      
      setHybridConfig(prev => ({
        ...prev,
        peer_agents: updatedAgents
      }));
    }
  };
  
  // Update coordination configuration
  const updateCoordination = (field, value) => {
    setHybridConfig(prev => ({
      ...prev,
      coordination: {
        ...prev.coordination,
        [field]: value
      }
    }));
  };
  
  // Update workflow configuration
  const updateWorkflowConfig = (field, value) => {
    setHybridConfig(prev => ({
      ...prev,
      workflow_config: {
        ...prev.workflow_config,
        [field]: value
      }
    }));
  };
  
  // Add or remove a tool from an agent
  const toggleAgentTool = (toolName) => {
    if (!selectedAgentType) return;
    
    let agentTools = [];
    
    // Get current tools
    if (selectedAgentType === 'team-supervisor') {
      agentTools = hybridConfig.teams[selectedTeamIndex].supervisor.tools || [];
    } else if (selectedAgentType === 'team-worker') {
      agentTools = hybridConfig.teams[selectedTeamIndex].workers[selectedAgentIndex].tools || [];
    } else if (selectedAgentType === 'peer') {
      agentTools = hybridConfig.peer_agents[selectedAgentIndex].tools || [];
    }
    
    // Add or remove tool
    let updatedTools;
    if (agentTools.includes(toolName)) {
      updatedTools = agentTools.filter(t => t !== toolName);
    } else {
      updatedTools = [...agentTools, toolName];
    }
    
    // Update the agent
    updateAgent('tools', updatedTools);
  };
  
  // Export configuration as JSON
  const exportConfig = () => {
    const jsonStr = JSON.stringify(hybridConfig, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hybrid-workflow-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Configuration Exported',
      description: 'Hybrid workflow configuration has been exported',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };
  
  // Import configuration from JSON
  const importConfig = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        setHybridConfig(config);
        
        toast({
          title: 'Configuration Imported',
          description: 'Hybrid workflow configuration has been imported',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        console.error('Error importing configuration:', error);
        
        toast({
          title: 'Import Error',
          description: 'Failed to import configuration. Invalid JSON format.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };
    
    reader.readAsText(file);
  };
  
  // Get currently selected agent
  const getSelectedAgent = () => {
    if (!selectedAgentType) return null;
    
    if (selectedAgentType === 'team-supervisor') {
      return hybridConfig.teams[selectedTeamIndex]?.supervisor;
    } else if (selectedAgentType === 'team-worker') {
      return hybridConfig.teams[selectedTeamIndex]?.workers[selectedAgentIndex];
    } else if (selectedAgentType === 'peer') {
      return hybridConfig.peer_agents[selectedAgentIndex];
    }
    
    return null;
  };
  
  // Get all agent IDs for coordination selection
  const getAllAgentIds = () => {
    const agentIds = [];
    
    // Team supervisors
    hybridConfig.teams.forEach(team => {
      agentIds.push({
        id: team.supervisor.name,
        name: `${team.name} - Supervisor`,
        type: 'supervisor'
      });
    });
    
    // Team workers
    hybridConfig.teams.forEach(team => {
      team.workers.forEach(worker => {
        agentIds.push({
          id: worker.name,
          name: `${team.name} - ${worker.name}`,
          type: 'worker'
        });
      });
    });
    
    // Peer agents
    hybridConfig.peer_agents.forEach(agent => {
      agentIds.push({
        id: agent.name,
        name: agent.name,
        type: 'peer'
      });
    });
    
    // Team IDs
    hybridConfig.teams.forEach(team => {
      agentIds.push({
        id: team.id,
        name: `${team.name} (Entire Team)`,
        type: 'team'
      });
    });
    
    return agentIds;
  };
  
  const selectedAgent = getSelectedAgent();
  const allAgentIds = getAllAgentIds();
  
  return (
    <Box>
      <HStack mb={6} justifyContent="space-between">
        <HStack>
          <Icon as={FiUsers} color="purple.500" boxSize={6} />
          <Heading size="md">Hybrid Workflow Configuration</Heading>
        </HStack>
        <HStack>
          <Button 
            leftIcon={<FiDownload />} 
            size="sm" 
            variant="outline" 
            onClick={exportConfig}
            isDisabled={!isEditing}
          >
            Export
          </Button>
          <Button
            as="label"
            leftIcon={<FiUpload />}
            size="sm"
            variant="outline"
            htmlFor="import-config"
            cursor="pointer"
            isDisabled={!isEditing}
          >
            Import
            <input
              id="import-config"
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={importConfig}
              disabled={!isEditing}
            />
          </Button>
        </HStack>
      </HStack>
      
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
        {/* Left column - Workflow structure */}
        <Box>
          <Tabs colorScheme="purple" variant="enclosed">
            <TabList>
              <Tab><Icon as={FiUsers} mr={2} /> Teams</Tab>
              <Tab><Icon as={FiCpu} mr={2} /> Peer Agents</Tab>
              <Tab><Icon as={FiSettings} mr={2} /> Coordination</Tab>
            </TabList>
            
            <TabPanels>
              {/* Teams Panel */}
              <TabPanel p={0} pt={4}>
                <Box mb={4}>
                  <HStack justifyContent="space-between">
                    <Heading size="sm">Teams</Heading>
                    <Button
                      size="sm"
                      leftIcon={<FiPlus />}
                      colorScheme="purple"
                      variant="outline"
                      onClick={addTeam}
                      isDisabled={!isEditing}
                    >
                      Add Team
                    </Button>
                  </HStack>
                </Box>
                
                {hybridConfig.teams.length === 0 ? (
                  <Card variant="outline" p={6}>
                    <VStack spacing={4}>
                      <Text color="gray.500">No teams defined yet</Text>
                      <Button
                        leftIcon={<FiPlus />}
                        colorScheme="purple"
                        onClick={addTeam}
                        isDisabled={!isEditing}
                      >
                        Add First Team
                      </Button>
                    </VStack>
                  </Card>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {hybridConfig.teams.map((team, teamIndex) => (
                      <Card key={teamIndex} variant="outline">
                        <CardHeader pb={0}>
                          <HStack justifyContent="space-between">
                            <Heading size="sm">{team.name}</Heading>
                            {isEditing && (
                              <ButtonGroup size="sm" variant="ghost">
                                <IconButton
                                  icon={<FiTrash2 />}
                                  aria-label="Delete team"
                                  colorScheme="red"
                                  onClick={() => deleteTeam(teamIndex)}
                                />
                              </ButtonGroup>
                            )}
                          </HStack>
                          <Text fontSize="sm" color="gray.600">{team.description}</Text>
                        </CardHeader>
                        <CardBody>
                          <VStack align="stretch" spacing={3}>
                            <HStack>
                              <Badge colorScheme="blue">Supervisor</Badge>
                              <Text fontSize="sm" fontWeight="medium">
                                {team.supervisor.name}
                              </Text>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTeamIndex(teamIndex);
                                  setSelectedAgentIndex(0);
                                  setSelectedAgentType('team-supervisor');
                                }}
                              >
                                {selectedTeamIndex === teamIndex && selectedAgentType === 'team-supervisor'
                                  ? 'Editing'
                                  : 'Edit'
                                }
                              </Button>
                            </HStack>
                            
                            <Divider />
                            
                            <HStack justifyContent="space-between">
                              <Heading size="xs">Workers ({team.workers.length})</Heading>
                              <Button
                                size="xs"
                                leftIcon={<FiPlus />}
                                onClick={() => addWorker(teamIndex)}
                                isDisabled={!isEditing}
                              >
                                Add Worker
                              </Button>
                            </HStack>
                            
                            {team.workers.length === 0 ? (
                              <Text fontSize="sm" color="gray.500">No workers in this team</Text>
                            ) : (
                              <VStack align="stretch" spacing={2}>
                                {team.workers.map((worker, workerIndex) => (
                                  <HStack key={workerIndex} justifyContent="space-between">
                                    <HStack>
                                      <Badge colorScheme="green">{worker.role}</Badge>
                                      <Text fontSize="sm">{worker.name}</Text>
                                    </HStack>
                                    <HStack>
                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => {
                                          setSelectedTeamIndex(teamIndex);
                                          setSelectedAgentIndex(workerIndex);
                                          setSelectedAgentType('team-worker');
                                        }}
                                      >
                                        {selectedTeamIndex === teamIndex && 
                                         selectedAgentIndex === workerIndex && 
                                         selectedAgentType === 'team-worker'
                                          ? 'Editing'
                                          : 'Edit'
                                        }
                                      </Button>
                                      {isEditing && (
                                        <IconButton
                                          icon={<FiTrash2 />}
                                          aria-label="Delete worker"
                                          size="xs"
                                          variant="ghost"
                                          colorScheme="red"
                                          onClick={() => deleteWorker(teamIndex, workerIndex)}
                                        />
                                      )}
                                    </HStack>
                                  </HStack>
                                ))}
                              </VStack>
                            )}
                          </VStack>
                        </CardBody>
                      </Card>
                    ))}
                  </VStack>
                )}
              </TabPanel>
              
              {/* Peer Agents Panel */}
              <TabPanel p={0} pt={4}>
                <Box mb={4}>
                  <HStack justifyContent="space-between">
                    <Heading size="sm">Peer Agents</Heading>
                    <Button
                      size="sm"
                      leftIcon={<FiPlus />}
                      colorScheme="purple"
                      variant="outline"
                      onClick={addPeerAgent}
                      isDisabled={!isEditing}
                    >
                      Add Peer Agent
                    </Button>
                  </HStack>
                </Box>
                
                {hybridConfig.peer_agents.length === 0 ? (
                  <Card variant="outline" p={6}>
                    <VStack spacing={4}>
                      <Text color="gray.500">No peer agents defined yet</Text>
                      <Button
                        leftIcon={<FiPlus />}
                        colorScheme="purple"
                        onClick={addPeerAgent}
                        isDisabled={!isEditing}
                      >
                        Add First Peer Agent
                      </Button>
                    </VStack>
                  </Card>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {hybridConfig.peer_agents.map((agent, agentIndex) => (
                      <Card key={agentIndex} variant="outline">
                        <CardBody>
                          <HStack justifyContent="space-between">
                            <HStack>
                              <Badge colorScheme="purple">{agent.role}</Badge>
                              <Text fontWeight="medium">{agent.name}</Text>
                              <Text fontSize="sm" color="gray.600">
                                {agent.model_provider}/{agent.model_name}
                              </Text>
                            </HStack>
                            <HStack>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTeamIndex(null);
                                  setSelectedAgentIndex(agentIndex);
                                  setSelectedAgentType('peer');
                                }}
                              >
                                {selectedAgentIndex === agentIndex && selectedAgentType === 'peer'
                                  ? 'Editing'
                                  : 'Edit'
                                }
                              </Button>
                              {isEditing && (
                                <IconButton
                                  icon={<FiTrash2 />}
                                  aria-label="Delete agent"
                                  size="sm"
                                  variant="ghost"
                                  colorScheme="red"
                                  onClick={() => deletePeerAgent(agentIndex)}
                                />
                              )}
                            </HStack>
                          </HStack>
                        </CardBody>
                      </Card>
                    ))}
                  </VStack>
                )}
              </TabPanel>
              
              {/* Coordination Panel */}
              <TabPanel p={0} pt={4}>
                <Card variant="outline">
                  <CardBody>
                    <VStack align="stretch" spacing={4}>
                      <FormControl>
                        <FormLabel>Coordination Type</FormLabel>
                        <Select
                          value={hybridConfig.coordination.type}
                          onChange={(e) => updateCoordination('type', e.target.value)}
                          isDisabled={!isEditing}
                        >
                          <option value="sequential">Sequential</option>
                          <option value="parallel">Parallel</option>
                          <option value="dynamic">Dynamic (Task-based)</option>
                        </Select>
                        <FormHelperText>
                          {hybridConfig.coordination.type === 'sequential' && 
                            'Process teams first, then peer agents in order'}
                          {hybridConfig.coordination.type === 'parallel' &&
                            'Execute all teams and agents concurrently'}
                          {hybridConfig.coordination.type === 'dynamic' &&
                            'Start with a coordinator who dynamically delegates tasks'}
                        </FormHelperText>
                      </FormControl>
                      
                      {hybridConfig.coordination.type === 'dynamic' && (
                        <FormControl>
                          <FormLabel>Coordinator</FormLabel>
                          <Select
                            value={hybridConfig.coordination.coordinator || ''}
                            onChange={(e) => updateCoordination('coordinator', e.target.value)}
                            isDisabled={!isEditing}
                          >
                            <option value="">Select a coordinator</option>
                            {allAgentIds
                              .filter(agent => agent.type === 'supervisor' || agent.type === 'peer')
                              .map((agent, idx) => (
                                <option key={idx} value={agent.id}>{agent.name}</option>
                              ))
                            }
                          </Select>
                          <FormHelperText>
                            Agent that will start the process and delegate tasks
                          </FormHelperText>
                        </FormControl>
                      )}
                      
                      <FormControl>
                        <FormLabel>Final Synthesizer</FormLabel>
                        <Select
                          value={hybridConfig.coordination.final_agent || ''}
                          onChange={(e) => updateCoordination('final_agent', e.target.value)}
                          isDisabled={!isEditing}
                        >
                          <option value="">Auto-synthesize (default)</option>
                          {allAgentIds.map((agent, idx) => (
                            <option key={idx} value={agent.id}>{agent.name}</option>
                          ))}
                        </Select>
                        <FormHelperText>
                          Agent responsible for creating the final combined output
                        </FormHelperText>
                      </FormControl>
                      
                      <Divider />
                      
                      <Heading size="sm">Communication Paths</Heading>
                      <Text fontSize="sm" color="gray.600">
                        Define specific communication paths between agents or use automatic routing
                      </Text>
                      
                      <Box bg="gray.50" p={4} borderRadius="md">
                        <Text fontSize="sm" fontStyle="italic">
                          Communication paths are automatically determined based on your coordination type.
                          For advanced manual configuration, use the JSON Editor.
                        </Text>
                      </Box>
                    </VStack>
                  </CardBody>
                </Card>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
        
        {/* Right column - Agent properties */}
        <Box>
          {selectedAgent ? (
            <Card>
              <CardHeader pb={2}>
                <HStack justifyContent="space-between">
                  <Heading size="sm">
                    Agent Configuration: {selectedAgent.name}
                  </Heading>
                  <HStack>
                    <Badge colorScheme={
                      selectedAgentType === 'team-supervisor' ? 'blue' : 
                      selectedAgentType === 'team-worker' ? 'green' : 'purple'
                    }>
                      {selectedAgent.role}
                    </Badge>
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedAgentIndex(null);
                          setSelectedAgentType(null);
                          setSelectedTeamIndex(null);
                        }}
                      >
                        Close
                      </Button>
                    )}
                  </HStack>
                </HStack>
              </CardHeader>
              
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl isRequired isDisabled={!isEditing}>
                      <FormLabel>Agent Name</FormLabel>
                      <Input
                        value={selectedAgent.name}
                        onChange={(e) => updateAgent('name', e.target.value)}
                      />
                    </FormControl>
                    
                    <FormControl isRequired isDisabled={!isEditing || selectedAgentType === 'team-supervisor'}>
                      <FormLabel>Role</FormLabel>
                      <Input
                        value={selectedAgent.role}
                        onChange={(e) => updateAgent('role', e.target.value)}
                      />
                    </FormControl>
                  </SimpleGrid>
                  
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl isRequired isDisabled={!isEditing}>
                      <FormLabel>Model Provider</FormLabel>
                      <Select
                        value={selectedAgent.model_provider}
                        onChange={(e) => updateAgent('model_provider', e.target.value)}
                      >
                        {providers.map((provider, idx) => (
                          <option key={idx} value={provider.value}>{provider.label}</option>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <FormControl isRequired isDisabled={!isEditing}>
                      <FormLabel>Model Name</FormLabel>
                      <Select
                        value={selectedAgent.model_name}
                        onChange={(e) => updateAgent('model_name', e.target.value)}
                      >
                        {agents
                          .filter(model => model.provider === selectedAgent.model_provider)
                          .map((model, idx) => (
                            <option key={idx} value={model.value}>{model.label}</option>
                          ))
                        }
                      </Select>
                    </FormControl>
                  </SimpleGrid>
                  
                  <FormControl isDisabled={!isEditing}>
                    <FormLabel>Temperature</FormLabel>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={selectedAgent.temperature || 0.7}
                      onChange={(e) => updateAgent('temperature', parseFloat(e.target.value))}
                    />
                    <FormHelperText>
                      0 = deterministic, 1 = creative
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl isDisabled={!isEditing}>
                    <FormLabel>System Message</FormLabel>
                    <Textarea
                      value={selectedAgent.system_message || ''}
                      onChange={(e) => updateAgent('system_message', e.target.value)}
                      rows={3}
                    />
                    <FormHelperText>
                      System message to guide the agent's behavior
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl isRequired isDisabled={!isEditing}>
                    <FormLabel>Prompt Template</FormLabel>
                    <Textarea
                      value={selectedAgent.prompt_template || ''}
                      onChange={(e) => updateAgent('prompt_template', e.target.value)}
                      rows={6}
                    />
                    <FormHelperText>
                      Available variables: {'{input}'}, {'{context}'}
                      {selectedAgentType === 'team-worker' && ', {supervisor_response}, {worker_outputs}'}
                    </FormHelperText>
                  </FormControl>
                  
                  <Box>
                    <FormLabel>Tools</FormLabel>
                    <SimpleGrid columns={2} spacing={3}>
                      {tools.map((tool, idx) => (
                        <Box 
                          key={idx} 
                          p={3} 
                          borderWidth="1px" 
                          borderRadius="md" 
                          borderColor={
                            selectedAgent.tools && selectedAgent.tools.includes(tool.name) 
                              ? "purple.500" 
                              : "gray.200"
                          }
                          _hover={{ borderColor: "purple.300" }}
                          cursor={isEditing ? "pointer" : "default"}
                          onClick={() => isEditing && toggleAgentTool(tool.name)}
                          bg={
                            selectedAgent.tools && selectedAgent.tools.includes(tool.name) 
                              ? "purple.50" 
                              : "white"
                          }
                        >
                          <HStack justify="space-between">
                            <Text fontWeight="medium">{tool.name}</Text>
                            {selectedAgent.tools && selectedAgent.tools.includes(tool.name) && (
                              <Icon as={FiCheck} color="purple.500" />
                            )}
                          </HStack>
                          <Text fontSize="sm" color="gray.600">{tool.description}</Text>
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <VStack spacing={4} align="center" py={8}>
                  <Icon as={FiCpu} fontSize="4xl" color="gray.400" />
                  <Text color="gray.500">
                    Select a team, supervisor, worker or peer agent to edit its configuration
                  </Text>
                </VStack>
              </CardBody>
            </Card>
          )}
          
          {isEditing && (
            <Card mt={4}>
              <CardHeader pb={0}>
                <Heading size="sm">Workflow Settings</Heading>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Max Iterations</FormLabel>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={hybridConfig.workflow_config.max_iterations || 3}
                      onChange={(e) => updateWorkflowConfig('max_iterations', parseInt(e.target.value))}
                    />
                    <FormHelperText>
                      Maximum number of interaction cycles
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Checkpoint Directory</FormLabel>
                    <Input
                      value={hybridConfig.workflow_config.checkpoint_dir || './checkpoints/hybrid'}
                      onChange={(e) => updateWorkflowConfig('checkpoint_dir', e.target.value)}
                    />
                    <FormHelperText>
                      Directory to store workflow state checkpoints
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
              </CardBody>
            </Card>
          )}
        </Box>
      </SimpleGrid>
    </Box>
  );
};

export default HybridConfigurationPanel;
