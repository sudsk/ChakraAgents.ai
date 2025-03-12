// frontend/src/components/HybridWorkflowVisualization.jsx
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
  SimpleGrid
} from '@chakra-ui/react';
import { 
  FiUsers, 
  FiMessageCircle, 
  FiCpu, 
  FiActivity, 
  FiGitBranch, 
  FiArrowRight, 
  FiInfo
} from 'react-icons/fi';

// Import a simple react flow renderer for the graph visualization
// Note: You would need to install @reactflow/core, possibly simplified version for small visualizations
// The following implementation is a placeholder - for production, integrate a proper graph visualization

const HybridWorkflowVisualization = ({ executionData, logs = [] }) => {
  const [activeTeamId, setActiveTeamId] = useState(null);
  const graphRef = useRef(null);
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const nodeColor = useColorModeValue('white', 'gray.700');
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  
  // Extract data from execution result
  const { outputs = {}, execution_graph = {}, agent_usage = [], final_output = '' } = executionData?.result || {};
  
  // Organize teams and agents
  const teams = [];
  const peerAgents = [];
  
  // Process outputs to organize teams and peer agents
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
        finalOutput: value.final_output || ''
      });
    } else if (key.startsWith('agent:')) {
      const agentId = key.split(':')[1];
      peerAgents.push({
        id: agentId,
        output: value,
        usage: agent_usage.find(a => a.agent === agentId)
      });
    }
  });
  
  // Simple flow chart visualization
  useEffect(() => {
    if (!graphRef.current || !execution_graph) return;
    
    // This is a simplified placeholder - in production, use a proper graph library
    // Just draw some lines to demonstrate the concept
    const canvas = graphRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // For now, just visualize with a text description instead of an actual graph
  }, [execution_graph, graphRef]);
  
  // Get detailed execution logs
  const getAgentLogs = (agentId) => {
    return logs.filter(log => log.agent === agentId);
  };
  
  return (
    <Box>
      <Tabs isLazy colorScheme="purple">
        <TabList>
          <Tab><Icon as={FiUsers} mr={2} /> Teams & Agents</Tab>
          <Tab><Icon as={FiGitBranch} mr={2} /> Workflow Graph</Tab>
          <Tab><Icon as={FiActivity} mr={2} /> Performance</Tab>
        </TabList>
        
        <TabPanels>
          {/* Teams and Agents Panel */}
          <TabPanel p={4}>
            <VStack spacing={6} align="stretch">
              {/* Teams Section */}
              <Box>
                <Heading size="md" mb={4}>Teams ({teams.length})</Heading>
                
                {teams.length === 0 ? (
                  <Card p={4} variant="outline">
                    <Text color="gray.500">No teams in this execution</Text>
                  </Card>
                ) : (
                  <Accordion allowToggle>
                    {teams.map((team, index) => (
                      <AccordionItem key={index} borderWidth="1px" borderRadius="md" mb={3}>
                        <h2>
                          <AccordionButton>
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
                                <Text whiteSpace="pre-wrap">{team.supervisor?.output}</Text>
                              </CardBody>
                            </Card>
                            <HStack>
                              <Tag size="sm" colorScheme="gray">
                                {team.supervisor?.usage?.model || 'Unknown Model'}
                              </Tag>
                              <Tag size="sm" colorScheme="gray">
                                {team.supervisor?.output?.length || 0} chars
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
                                <Text whiteSpace="pre-wrap">{team.finalOutput}</Text>
                              </CardBody>
                            </Card>
                          </Box>
                        </AccordionPanel>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </Box>
              
              {/* Peer Agents Section */}
              <Box>
                <Heading size="md" mb={4}>Peer Agents ({peerAgents.length})</Heading>
                
                {peerAgents.length === 0 ? (
                  <Card p={4} variant="outline">
                    <Text color="gray.500">No independent peer agents in this execution</Text>
                  </Card>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {peerAgents.map((agent, index) => (
                      <Card key={index} variant="outline">
                        <CardHeader pb={2}>
                          <HStack>
                            <Badge colorScheme="purple">{agent.usage?.role || 'peer'}</Badge>
                            <Text fontWeight="medium">{agent.id}</Text>
                          </HStack>
                        </CardHeader>
                        <CardBody>
                          <Text whiteSpace="pre-wrap" mb={3}>{agent.output}</Text>
                          <HStack>
                            <Tag size="sm" colorScheme="gray">
                              {agent.usage?.model || 'Unknown Model'}
                            </Tag>
                            <Tag size="sm" colorScheme="gray">
                              {agent.output?.length || 0} chars
                            </Tag>
                          </HStack>
                        </CardBody>
                      </Card>
                    ))}
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
          
          {/* Workflow Graph Panel */}
          <TabPanel p={4}>
            <VStack spacing={4} align="stretch">
              <Card>
                <CardHeader>
                  <Heading size="md">Workflow Execution Graph</Heading>
                </CardHeader>
                <CardBody>
                  <Box borderWidth="1px" borderRadius="md" p={4} bg={bgColor} mb={4}>
                    {execution_graph && Object.keys(execution_graph).length > 0 ? (
                      <VStack align="stretch" spacing={3}>
                        <Heading size="sm">Communication Paths</Heading>
                        {Object.entries(execution_graph).map(([source, targets], idx) => (
                          <Box key={idx} pl={4}>
                            <Text fontWeight="medium">{source}</Text>
                            <Box pl={6} mt={2}>
                              {Array.isArray(targets) || targets instanceof Set ? (
                                [...targets].map((target, tIdx) => (
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
                        ))}
                      </VStack>
                    ) : (
                      <Text color="gray.500">No execution graph data available</Text>
                    )}
                  </Box>
                  
                  <Box height="300px" position="relative" borderWidth="1px" borderRadius="md">
                    <Text 
                      position="absolute" 
                      top="50%" 
                      left="50%" 
                      transform="translate(-50%, -50%)" 
                      color="gray.500"
                    >
                      Interactive graph visualization would be rendered here
                    </Text>
                    <canvas ref={graphRef} width="100%" height="100%" />
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
                            {Object.values(outputs).reduce((sum, output) => {
                              if (typeof output === 'string') {
                                return sum + output.length;
                              } else if (output?.supervisor_output) {
                                // Team output
                                const supervisorLen = output.supervisor_output?.length || 0;
                                const workersLen = Object.values(output.worker_outputs || {})
                                  .reduce((s, w) => s + (w?.length || 0), 0);
                                const finalLen = output.final_output?.length || 0;
                                return sum + supervisorLen + workersLen + finalLen;
                              }
                              return sum;
                            }, 0).toLocaleString()}
                          </Text>
                        </VStack>
                      </CardBody>
                    </Card>
                  </SimpleGrid>
                  
                  <Divider my={4} />
                  
                  <Heading size="sm" mb={4}>Agent Usage</Heading>
                  {agent_usage && agent_usage.length > 0 ? (
                    <Box overflowX="auto">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Agent</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Role</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Team</th>
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
                              <td style={{ padding: '8px' }}>{usage.model || 'Unknown'}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{usage.output_length.toLocaleString()}</td>
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
