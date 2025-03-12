import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card, 
  CardBody,
  CardHeader,
  Heading,
  Text,
  Flex,
  VStack,
  HStack,
  Badge,
  Divider,
  Tag,
  Button,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useColorModeValue,
  Icon,
  SimpleGrid,
  IconButton,
  Tooltip,
  Select,
  Switch,
  FormControl,
  FormLabel
} from '@chakra-ui/react';
import { 
  FiUsers, 
  FiMessageCircle, 
  FiCpu, 
  FiActivity, 
  FiGitBranch, 
  FiArrowRight, 
  FiInfo,
  FiMaximize2,
  FiMinimize2,
  FiDownload,
  FiShare2,
  FiZoomIn,
  FiZoomOut,
  FiRefreshCw
} from 'react-icons/fi';

// Import Recharts for visualization
import {
  ResponsiveContainer,
  Sankey,
  Tooltip as RechartsTooltip,
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend,
  BarChart,
  Bar
} from 'recharts';

const HybridWorkflowVisualization = ({ executionData, logs = [] }) => {
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activePeerId, setActivePeerId] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [graphZoom, setGraphZoom] = useState(1);
  const [showRealTimeView, setShowRealTimeView] = useState(false);
  const [filterByIteration, setFilterByIteration] = useState(0); // 0 means all iterations
  const graphContainerRef = useRef(null);
  
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const nodeColor = useColorModeValue('white', 'gray.700');
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  
  // Extract data from execution result
  const { outputs = {}, execution_graph = {}, agent_usage = [], final_output = '' } = executionData?.result || {};
  
  // Organize teams and agents
  const teams = [];
  const peerAgents = [];
  const allIterations = [];
  
  // Process outputs to organize teams and peer agents
  useEffect(() => {
    // Reset selections when data changes
    setActiveTeamId(null);
    setActivePeerId(null);
    
    // Process the outputs data
    processOutputs();
  }, [executionData, outputs]);
  
  const processOutputs = () => {
    // Process teams
    Object.entries(outputs).forEach(([key, value]) => {
      if (key.startsWith('team:')) {
        const teamId = key.split(':')[1];
        teams.push({
          id: teamId,
          name: `Team ${teamId}`,
          supervisor: {
            output: value.supervisor_output || '',
            usage: agent_usage.find(a => a.team === teamId && a.role === 'supervisor')
          },
          workers: Object.entries(value.worker_outputs || {}).map(([workerId, output]) => ({
            id: workerId,
            output,
            usage: agent_usage.find(a => a.agent === workerId)
          })),
          finalOutput: value.final_output || '',
          // Track history if available
          history: value.history || []
        });
        
        // Extract iterations if this team has history
        if (value.history && value.history.length > 0) {
          value.history.forEach(item => {
            if (item.iteration && !allIterations.includes(item.iteration)) {
              allIterations.push(item.iteration);
            }
          });
        }
      } else if (key.startsWith('agent:')) {
        const agentId = key.split(':')[1];
        let agentOutput, agentHistory = [];
        
        // Check if the output has a structured format with history
        if (typeof value === 'object' && value !== null && 'output' in value) {
          agentOutput = value.output;
          agentHistory = value.history || [];
          
          // Extract iterations from history
          agentHistory.forEach(item => {
            if (item.iteration && !allIterations.includes(item.iteration)) {
              allIterations.push(item.iteration);
            }
          });
        } else {
          agentOutput = value;
        }
        
        peerAgents.push({
          id: agentId,
          output: agentOutput,
          usage: agent_usage.find(a => a.agent === agentId),
          history: agentHistory
        });
      }
    });
    
    // Sort iterations if we found any
    allIterations.sort((a, b) => a - b);
  };
  
  // Get detailed execution logs
  const getAgentLogs = (agentId) => {
    return logs.filter(log => log.agent === agentId);
  };
  
  // Format execution graph data for visualization
  const prepareGraphData = () => {
    if (!execution_graph || Object.keys(execution_graph).length === 0) {
      return { nodes: [], links: [] };
    }
    
    const nodes = new Set();
    const links = [];
    
    // Add all sources and targets to nodes
    Object.entries(execution_graph).forEach(([source, targets]) => {
      nodes.add(source);
      
      if (Array.isArray(targets)) {
        targets.forEach(target => {
          nodes.add(target);
          links.push({ source, target, value: 1 });
        });
      }
    });
    
    // Convert nodes to array format needed by Sankey diagram
    const nodeArray = Array.from(nodes).map(id => ({
      name: id,
      // Determine node category (supervisor, worker, peer)
      category: id.includes('supervisor') ? 'supervisor' : 
                agent_usage.find(a => a.agent === id)?.role || 'unknown'
    }));
    
    return {
      nodes: nodeArray,
      links: links
    };
  };
  
  // Prepare performance data
  const preparePerformanceData = () => {
    // Group by iteration
    const iterationData = {};
    
    agent_usage.forEach(usage => {
      const iteration = usage.iteration || 1;
      if (!iterationData[iteration]) {
        iterationData[iteration] = {
          iteration,
          supervisorOutputLength: 0,
          workerOutputLength: 0,
          peerOutputLength: 0,
          totalOutputLength: 0,
          agentCount: 0
        };
      }
      
      iterationData[iteration].totalOutputLength += usage.output_length || 0;
      iterationData[iteration].agentCount += 1;
      
      if (usage.role === 'supervisor') {
        iterationData[iteration].supervisorOutputLength += usage.output_length || 0;
      } else if (usage.role === 'worker') {
        iterationData[iteration].workerOutputLength += usage.output_length || 0;
      } else {
        iterationData[iteration].peerOutputLength += usage.output_length || 0;
      }
    });
    
    return Object.values(iterationData);
  };
  
  // Filter teams and agents by iteration if needed
  const filteredTeams = teams.filter(team => {
    if (filterByIteration === 0) return true; // Show all
    
    // Check if this team has data for the selected iteration
    return team.history && team.history.some(h => h.iteration === filterByIteration - 1);
  });
  
  const filteredPeerAgents = peerAgents.filter(agent => {
    if (filterByIteration === 0) return true; // Show all
    
    // Check if this agent has data for the selected iteration
    return agent.history && agent.history.some(h => h.iteration === filterByIteration - 1);
  });
  
  // Get output for a specific iteration if available
  const getOutputForIteration = (team, iteration) => {
    if (iteration === 0 || !team.history) {
      // Return current output for iteration 0 (most recent)
      return {
        supervisorOutput: team.supervisor?.output || '',
        finalOutput: team.finalOutput || '',
        workerOutputs: team.workers || []
      };
    }
    
    // Find the history entry for this iteration
    const historyItem = team.history.find(h => h.iteration === iteration - 1);
    if (!historyItem) return null;
    
    return {
      supervisorOutput: historyItem.supervisor_output || '',
      finalOutput: historyItem.final_output || '',
      // Worker outputs might not be in history, use current ones as fallback
      workerOutputs: team.workers || []
    };
  };
  
  const getPeerOutputForIteration = (agent, iteration) => {
    if (iteration === 0 || !agent.history) {
      // Return current output for iteration 0
      return agent.output;
    }
    
    // Find the history entry for this iteration
    const historyItem = agent.history.find(h => h.iteration === iteration - 1);
    if (!historyItem) return null;
    
    return historyItem.output || '';
  };
  
  // Download execution result as JSON
  const downloadExecutionData = () => {
    const dataStr = JSON.stringify(executionData.result, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `hybrid-execution-${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  return (
    <Box>
      <HStack mb={4} justify="space-between">
        <HStack>
          <Icon as={FiUsers} color="purple.500" boxSize={6} />
          <Heading size="md">Hybrid Workflow Visualization</Heading>
        </HStack>
        <HStack spacing={2}>
          <IconButton 
            icon={<FiDownload />} 
            aria-label="Download execution data" 
            size="sm"
            onClick={downloadExecutionData}
            title="Download execution data"
          />
          {allIterations.length > 0 && (
            <Select 
              size="sm" 
              width="180px" 
              value={filterByIteration}
              onChange={(e) => setFilterByIteration(Number(e.target.value))}
            >
              <option value={0}>All Iterations</option>
              {allIterations.map((iteration, idx) => (
                <option key={idx} value={iteration + 1}>Iteration {iteration + 1}</option>
              ))}
              <option value={allIterations.length + 1}>Final Result</option>
            </Select>
          )}
        </HStack>
      </HStack>
      
      <Tabs isLazy colorScheme="purple" index={activeTab} onChange={setActiveTab}>
        <TabList>
          <Tab><Icon as={FiUsers} mr={2} /> Teams & Agents</Tab>
          <Tab><Icon as={FiGitBranch} mr={2} /> Communication Flow</Tab>
          <Tab><Icon as={FiActivity} mr={2} /> Performance</Tab>
        </TabList>
        
        <TabPanels>
          {/* Teams and Agents Panel */}
          <TabPanel p={4}>
            <VStack spacing={6} align="stretch">
              {/* Teams Section */}
              <Box>
                <Heading size="md" mb={4}>Teams ({filteredTeams.length})</Heading>
                
                {filteredTeams.length === 0 ? (
                  <Card p={4} variant="outline">
                    <Text color="gray.500">No teams in this execution</Text>
                  </Card>
                ) : (
                  <Accordion allowToggle>
                    {filteredTeams.map((team, index) => {
                      const iterationOutput = getOutputForIteration(team, filterByIteration);
                      if (!iterationOutput) return null;
                      
                      return (
                        <AccordionItem key={index} borderWidth="1px" borderRadius="md" mb={3}
                          borderColor={activeTeamId === team.id ? "purple.400" : borderColor}
                        >
                          <h2>
                            <AccordionButton 
                              onClick={() => {
                                setActiveTeamId(prevId => prevId === team.id ? null : team.id);
                                setActivePeerId(null); // Clear peer selection
                              }}
                            >
                              <Box flex="1" textAlign="left" fontWeight="bold">
                                {team.name}
                              </Box>
                              <AccordionIcon />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4}>
                            {/* Supervisor */}
                            <Box mb={4}>
                              <HStack mb={2}>
                                <Badge colorScheme="blue">Supervisor</Badge>
                                <Text fontWeight="medium">{team.supervisor?.usage?.agent}</Text>
                              </HStack>
                              <Card variant="outline" mb={2}>
                                <CardBody>
                                  <Text whiteSpace="pre-wrap">{iterationOutput.supervisorOutput}</Text>
                                </CardBody>
                              </Card>
                              <HStack>
                                <Tag size="sm" colorScheme="gray">
                                  {team.supervisor?.usage?.model || 'Unknown Model'}
                                </Tag>
                                <Tag size="sm" colorScheme="gray">
                                  {iterationOutput.supervisorOutput?.length || 0} chars
                                </Tag>
                              </HStack>
                            </Box>
                            
                            <Divider my={4} />
                            
                            {/* Workers */}
                            <Box mb={4}>
                              <Heading size="sm" mb={3}>Workers ({team.workers.length})</Heading>
                              
                              {team.workers.map((worker, wIndex) => (
                                <Box key={wIndex} mb={4}>
                                  <HStack mb={2}>
                                    <Badge colorScheme="green">{worker.usage?.role || 'worker'}</Badge>
                                    <Text fontWeight="medium">{worker.id}</Text>
                                  </HStack>
                                  <Card variant="outline" mb={2}>
                                    <CardBody>
                                      <Text whiteSpace="pre-wrap">{worker.output}</Text>
                                    </CardBody>
                                  </Card>
                                  <HStack>
                                    <Tag size="sm" colorScheme="gray">
                                      {worker.usage?.model || 'Unknown Model'}
                                    </Tag>
                                    <Tag size="sm" colorScheme="gray">
                                      {worker.output?.length || 0} chars
                                    </Tag>
                                  </HStack>
                                </Box>
                              ))}
                            </Box>
                            
                            <Divider my={4} />
                            
                            {/* Team Final Output */}
                            <Box>
                              <Heading size="sm" mb={3}>Team Final Output</Heading>
                              <Card variant="outline" mb={2} borderColor="purple.200">
                                <CardBody>
                                  <Text whiteSpace="pre-wrap">{iterationOutput.finalOutput}</Text>
                                </CardBody>
                              </Card>
                            </Box>
                          </AccordionPanel>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </Box>
              
              {/* Peer Agents Section */}
              <Box>
                <Heading size="md" mb={4}>Peer Agents ({filteredPeerAgents.length})</Heading>
                
                {filteredPeerAgents.length === 0 ? (
                  <Card p={4} variant="outline">
                    <Text color="gray.500">No independent peer agents in this execution</Text>
                  </Card>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {filteredPeerAgents.map((agent, index) => {
                      const iterationOutput = getPeerOutputForIteration(agent, filterByIteration);
                      if (iterationOutput === null) return null;
                      
                      return (
                        <Card key={index} variant="outline" 
                          borderColor={activePeerId === agent.id ? "purple.400" : borderColor}
                          onClick={() => {
                            setActivePeerId(prevId => prevId === agent.id ? null : agent.id);
                            setActiveTeamId(null); // Clear team selection
                          }}
                          cursor="pointer"
                          _hover={{ borderColor: "purple.300" }}
                        >
                          <CardHeader pb={2}>
                            <HStack>
                              <Badge colorScheme="purple">{agent.usage?.role || 'peer'}</Badge>
                              <Text fontWeight="medium">{agent.id}</Text>
                            </HStack>
                          </CardHeader>
                          <CardBody>
                            <Text whiteSpace="pre-wrap" mb={3}>{iterationOutput}</Text>
                            <HStack>
                              <Tag size="sm" colorScheme="gray">
                                {agent.usage?.model || 'Unknown Model'}
                              </Tag>
                              <Tag size="sm" colorScheme="gray">
                                {iterationOutput?.length || 0} chars
                              </Tag>
                            </HStack>
                          </CardBody>
                        </Card>
                      );
                    })}
                  </VStack>
                )}
              </Box>
              
              {/* Final Output Section */}
              <Box>
                <Heading size="md" mb={4}>Final Output</Heading>
                <Card variant="filled" bg="purple.50" borderRadius="md">
                  <CardBody>
                    <Text whiteSpace="pre-wrap">{final_output}</Text>
                  </CardBody>
                </Card>
              </Box>
            </VStack>
          </TabPanel>
          
          {/* Communication Flow Panel */}
          <TabPanel p={4}>
            <VStack spacing={4} align="stretch">
              <Card>
                <CardHeader>
                  <HStack justifyContent="space-between">
                    <Heading size="md">Communication Flow</Heading>
                    <HStack>
                      <IconButton
                        icon={<FiZoomIn />}
                        size="sm"
                        aria-label="Zoom in"
                        onClick={() => setGraphZoom(prev => Math.min(prev + 0.2, 2))}
                      />
                      <IconButton
                        icon={<FiZoomOut />}
                        size="sm"
                        aria-label="Zoom out"
                        onClick={() => setGraphZoom(prev => Math.max(prev - 0.2, 0.5))}
                      />
                      <IconButton
                        icon={<FiRefreshCw />}
                        size="sm"
                        aria-label="Reset zoom"
                        onClick={() => setGraphZoom(1)}
                      />
                    </HStack>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Box ref={graphContainerRef} height="400px" position="relative">
                    {Object.keys(execution_graph).length > 0 ? (
                      <Box 
                        height="100%" 
                        transform={`scale(${graphZoom})`} 
                        transformOrigin="center center"
                        transition="transform 0.2s"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <Sankey
                            data={prepareGraphData()}
                            nodeWidth={15}
                            nodePadding={10}
                            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                            link={{ stroke: '#d2d2d2' }}
                            node={{
                              fill: '#8884d8',
                              strokeWidth: 2,
                            }}
                          >
                            <RechartsTooltip />
                          </Sankey>
                        </ResponsiveContainer>
                      </Box>
                    ) : (
                      <Flex 
                        height="100%" 
                        alignItems="center" 
                        justifyContent="center"
                        border="1px dashed"
                        borderColor="gray.200"
                        borderRadius="md"
                      >
                        <Text color="gray.500">No communication graph data available</Text>
                      </Flex>
                    )}
                  </Box>
                  
                  <Box mt={6} borderWidth="1px" borderRadius="md" p={4} bg={bgColor}>
                    <VStack align="stretch" spacing={3}>
                      <Heading size="sm">Communication Paths</Heading>
                      {Object.entries(execution_graph).length > 0 ? (
                        Object.entries(execution_graph).map(([source, targets], idx) => (
                          <Box key={idx} pl={4}>
                            <Text fontWeight="medium">{source}</Text>
                            <Box pl={6} mt={2}>
                              {Array.isArray(targets) && targets.length > 0 ? (
                                targets.map((target, tIdx) => (
                                  <HStack key={tIdx} spacing={2} mb={1}>
                                    <Icon as={FiArrowRight} />
                                    <Text>{target}</Text>
                                  </HStack>
                                ))
                              ) : (
                                <Text color="gray.500">No outgoing connections</Text>
                              )}
                            </Box>
                          </Box>
                        ))
                      ) : (
                        <Text color="gray.500">No communication paths data available</Text>
                      )}
                    </VStack>
                  </Box>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>
          
          {/* Performance Panel */}
          <TabPanel p={4}>
            <VStack spacing={4} align="stretch">
              <Card>
                <CardHeader>
                  <Heading size="md">Execution Performance</Heading>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={2} spacing={4} mb={6}>
                    <Card variant="outline">
                      <CardBody>
                        <VStack align="start">
                          <Text color="gray.500" fontSize="sm">Total Agents</Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            {agent_usage?.length || 0}
                          </Text>
                        </VStack>
                      </CardBody>
                    </Card>
                    
                    <Card variant="outline">
                      <CardBody>
                        <VStack align="start">
                          <Text color="gray.500" fontSize="sm">Total Teams</Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            {teams.length || 0}
                          </Text>
                        </VStack>
                      </CardBody>
                    </Card>
                    
                    <Card variant="outline">
                      <CardBody>
                        <VStack align="start">
                          <Text color="gray.500" fontSize="sm">Execution Time</Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            {executionData?.result?.execution_time?.toFixed(2) || 0}s
                          </Text>
                        </VStack>
                      </CardBody>
                    </Card>
                    
                    <Card variant="outline">
                      <CardBody>
                        <VStack align="start">
                          <Text color="gray.500" fontSize="sm">Total Output Size</Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            {agent_usage.reduce((sum, usage) => sum + (usage.output_length || 0), 0).toLocaleString()} chars
                          </Text>
                        </VStack>
                      </CardBody>
                    </Card>
                  </SimpleGrid>
                  
                  <Divider my={4} />
                  
                  <Box height="300px">
                    <Heading size="sm" mb={4}>Output by Iteration</Heading>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={preparePerformanceData()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="iteration" label={{ value: 'Iteration', position: 'insideBottom', offset: -10 }} />
                        <YAxis label={{ value: 'Output Characters', angle: -90, position: 'insideLeft' }} />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="supervisorOutputLength" name="Supervisor Output" fill="#8884d8" />
                        <Bar dataKey="workerOutputLength" name="Worker Output" fill="#82ca9d" />
                        <Bar dataKey="peerOutputLength" name="Peer Agent Output" fill="#ffc658" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                  
                  <Divider my={4} />
                  
                  <Heading size="sm" mb={4}>Agent Performance</Heading>
                  <Box height="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={agent_usage.map((usage, index) => ({
                          agent: usage.agent,
                          index,
                          outputLength: usage.output_length || 0,
                          iteration: usage.iteration || 1,
                          model: usage.model || 'unknown'
                        }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="iteration" />
                        <YAxis />
                        <RechartsTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <Box bg="white" p={2} borderRadius="md" borderWidth="1px">
                                  <Text fontWeight="bold">{payload[0].payload.agent}</Text>
                                  <Text>Output: {payload[0].value} chars</Text>
                                  <Text fontSize="xs">Model: {payload[0].payload.model}</Text>
                                </Box>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="outputLength" name="Output Length" stroke="#8884d8" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                  
                  <Divider my={4} />
                  
                  <Heading size="sm" mb={4}>Agent Usage Details</Heading>
                  {agent_usage && agent_usage.length > 0 ? (
                    <Box overflowX="auto">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Agent</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Role</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Team</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Iteration</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Model</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Output Length</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agent_usage.map((usage, idx) => (
                            <tr key={idx} style={{ 
                              borderTop: '1px solid', 
                              borderColor: borderColor 
                            }}>
                              <td style={{ padding: '8px' }}>{usage.agent}</td>
                              <td style={{ padding: '8px' }}>
                                <Badge colorScheme={
                                  usage.role === 'supervisor' ? 'blue' : 
                                  usage.role === 'worker' ? 'green' : 
                                  usage.role === 'peer' ? 'purple' : 'gray'
                                }>
                                  {usage.role}
                                </Badge>
                              </td>
                              <td style={{ padding: '8px' }}>{usage.team || '-'}</td>
                              <td style={{ padding: '8px' }}>{usage.iteration || 1}</td>
                              <td style={{ padding: '8px' }}>{usage.model || 'Unknown'}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{usage.output_length?.toLocaleString() || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  ) : (
                    <Text color="gray.500">No agent usage data available</Text>
                  )}
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default HybridWorkflowVisualization;
