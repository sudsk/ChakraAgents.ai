// frontend/src/pages/AgenticWorkflowExecution.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  Flex,
  HStack,
  VStack,
  Badge,
  Icon,
  Divider,
  Spinner,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  IconButton,
  Code,
  Tooltip,
  useToast,
  SimpleGrid,
  Progress
} from '@chakra-ui/react';
import { 
  FiArrowLeft, FiCpu, FiActivity, FiMessageCircle, FiRefreshCw, 
  FiCheckCircle, FiAlertCircle, FiClock, FiInfo, FiDatabase,
  FiShare2, FiMapPin
} from 'react-icons/fi';
import apiClient from '../services/api';

// Status badge component
const StatusBadge = ({ status }) => {
  const statusColors = {
    running: 'blue',
    completed: 'green',
    failed: 'red',
    pending: 'yellow',
    canceled: 'orange'
  };
  
  const statusIcons = {
    running: FiActivity,
    completed: FiCheckCircle,
    failed: FiAlertCircle,
    pending: FiClock,
    canceled: FiInfo
  };
  
  return (
    <Badge 
      colorScheme={statusColors[status] || 'gray'} 
      display="flex" 
      alignItems="center" 
      px={2} 
      py={1}
    >
      <Icon as={statusIcons[status] || FiInfo} mr={1} />
      {status}
    </Badge>
  );
};

const AgenticWorkflowExecution = () => {
  const { id, executionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [execution, setExecution] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [agentMessages, setAgentMessages] = useState([]);
  const [executionGraph, setExecutionGraph] = useState({});
  const messagesEndRef = useRef(null);
  
  // Fetch execution data
  const fetchData = async () => {
    try {
      // Fetch execution from agentic API
      const executionData = await apiClient.get(`/api/agentic-workflows/executions/${executionId}`);
      setExecution(executionData);
      
      // Parse agent interactions
      processAgentInteractions(executionData);
      
      // Extract execution graph
      if (executionData.result?.execution_graph) {
        setExecutionGraph(executionData.result.execution_graph);
      }
      
      // Fetch workflow
      const workflowData = await apiClient.get(`/api/workflows/${id}`);
      setWorkflow(workflowData);
      
      // Fetch template
      if (workflowData) {
        const templateData = await apiClient.get(`/api/templates/${workflowData.template_id}`);
        setTemplate(templateData);
      }
      
      return executionData;
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch execution data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  // Process agent interactions from execution data
  const processAgentInteractions = (executionData) => {
    if (!executionData || !executionData.result) return;
    
    try {
      const messages = [];
      
      // Add user query as first message
      if (executionData.input_data && executionData.input_data.query) {
        messages.push({
          agent: 'user',
          role: 'user',
          content: executionData.input_data.query,
          timestamp: executionData.started_at
        });
      }
      
      // Add conversation messages if available
      if (executionData.result.messages && Array.isArray(executionData.result.messages)) {
        executionData.result.messages.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({
              agent: msg.role === 'user' ? 'user' : 'assistant',
              role: msg.role,
              content: msg.content,
              timestamp: new Date().toISOString()
            });
          }
        });
      }
      
      // Add agent outputs
      if (executionData.result.outputs && typeof executionData.result.outputs === 'object') {
        Object.entries(executionData.result.outputs).forEach(([agent, output]) => {
          // Skip empty outputs
          if (!output || (typeof output === 'string' && !output.trim())) return;
          
          // For objects, stringify them
          const content = typeof output === 'object' ? 
            JSON.stringify(output, null, 2) : output;
          
          messages.push({
            agent: agent,
            role: 'agent',
            content: content,
            timestamp: new Date().toISOString()
          });
        });
      }
      
      // Add final output if available
      if (executionData.result.final_output) {
        messages.push({
          agent: 'final',
          role: 'final',
          content: executionData.result.final_output,
          timestamp: new Date().toISOString()
        });
      }
      
      setAgentMessages(messages);
    } catch (error) {
      console.error('Error processing agent interactions:', error);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [executionId, id, toast]);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentMessages]);
  
  // Setup refresh interval for running executions
  useEffect(() => {
    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
    
    // If execution is running, poll for updates
    if (execution?.status === 'running' || execution?.status === 'pending') {
      const interval = setInterval(async () => {
        const executionData = await fetchData();
        
        // If execution completed or failed, stop polling
        if (executionData && (
          executionData.status === 'completed' || 
          executionData.status === 'failed' ||
          executionData.status === 'canceled'
        )) {
          clearInterval(interval);
          setRefreshInterval(null);
        }
      }, 5000);
      
      setRefreshInterval(interval);
      
      // Clean up interval on unmount
      return () => {
        clearInterval(interval);
      };
    }
  }, [execution?.status]);
  
  // Get agent color based on role
  const getAgentColor = (agent, role) => {
    if (role === 'user') return 'gray';
    if (role === 'final') return 'purple';
    if (agent === 'supervisor' || role === 'supervisor') return 'blue';
    if (agent.includes('worker') || role === 'worker') return 'green';
    if (role === 'rag') return 'teal';
    
    // Default color based on agent name for consistency
    const colors = ['blue', 'green', 'orange', 'purple', 'pink', 'cyan', 'teal'];
    const hash = agent.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Calculate execution duration
  const calculateDuration = () => {
    if (!execution) return 'N/A';
    
    const start = new Date(execution.started_at);
    const end = execution.completed_at ? new Date(execution.completed_at) : new Date();
    
    const durationMs = end - start;
    const seconds = Math.floor(durationMs / 1000);
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes} min ${remainingSeconds} sec`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hr ${remainingMinutes} min`;
    }
  };
  
  // Cancel a running execution
  const handleCancelExecution = async () => {
    try {
      await apiClient.post(`/api/agentic-workflows/executions/${executionId}/cancel`);
      
      toast({
        title: 'Execution canceled',
        description: 'The workflow execution has been canceled',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error canceling execution:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel execution',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  if (loading) {
    return (
      <Flex justify="center" align="center" height="500px" width="100%">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <HStack>
          <IconButton
            icon={<FiArrowLeft />}
            onClick={() => navigate('/workflows')}
            aria-label="Back to workflows"
          />
          <Heading>Agentic Workflow Execution</Heading>
        </HStack>
        
        <HStack>
          <StatusBadge status={execution?.status || 'unknown'} />
          {(execution?.status === 'running' || execution?.status === 'pending') && (
            <Button
              colorScheme="orange"
              size="sm"
              onClick={handleCancelExecution}
            >
              Cancel Execution
            </Button>
          )}
          <Tooltip label="Refresh">
            <IconButton
              icon={<FiRefreshCw />}
              aria-label="Refresh"
              onClick={fetchData}
            />
          </Tooltip>
        </HStack>
      </Flex>
      
      {execution && (
        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6} mb={6}>
          <Card>
            <CardBody>
              <VStack align="start" spacing={1}>
                <Text color="gray.500" fontSize="sm">Workflow</Text>
                <Text fontWeight="bold">{workflow?.name || 'Unknown Workflow'}</Text>
              </VStack>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody>
              <VStack align="start" spacing={1}>
                <Text color="gray.500" fontSize="sm">Started</Text>
                <Text fontWeight="bold">{formatDate(execution.started_at)}</Text>
              </VStack>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody>
              <VStack align="start" spacing={1}>
                <Text color="gray.500" fontSize="sm">Duration</Text>
                <Text fontWeight="bold">{calculateDuration()}</Text>
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>
      )}
      
      <Tabs colorScheme="brand">
        <TabList>
          <Tab><Icon as={FiMessageCircle} mr={2} /> Agent Interactions</Tab>
          <Tab><Icon as={FiShare2} mr={2} /> Execution Graph</Tab>
          <Tab><Icon as={FiCpu} mr={2} /> Execution Details</Tab>
        </TabList>
        
        <TabPanels>
          {/* Agent Interactions Tab */}
          <TabPanel p={0} pt={4}>
            <Card>
              <CardHeader>
                <Heading size="md">Agent Interactions</Heading>
              </CardHeader>
              <CardBody>
                {execution?.status === 'running' && (
                  <Box mb={4}>
                    <Progress isIndeterminate colorScheme="blue" />
                    <Text mt={2} color="blue.500" fontStyle="italic" textAlign="center">
                      Execution in progress...
                    </Text>
                  </Box>
                )}
                
                <Box
                  bg="gray.50"
                  borderRadius="md"
                  p={4}
                  maxH="600px"
                  overflowY="auto"
                >
                  {agentMessages.length > 0 ? (
                    <VStack spacing={4} align="stretch">
                      {agentMessages.map((message, index) => (
                        <Box 
                          key={index}
                          bg="white"
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor="gray.200"
                          p={4}
                          boxShadow="sm"
                        >
                          <HStack mb={2} spacing={2}>
                            <Badge colorScheme={getAgentColor(message.agent, message.role)}>
                              {message.agent}
                            </Badge>
                            {message.role === 'final' && (
                              <Badge colorScheme="purple">Final Output</Badge>
                            )}
                            {typeof message.timestamp === 'string' && (
                              <Text fontSize="xs" color="gray.500">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </Text>
                            )}
                          </HStack>
                          <Text whiteSpace="pre-wrap">{message.content}</Text>
                        </Box>
                      ))}
                      <div ref={messagesEndRef} />
                    </VStack>
                  ) : (
                    <Flex 
                      direction="column" 
                      align="center" 
                      justify="center" 
                      py={10}
                      borderWidth="1px"
                      borderStyle="dashed"
                      borderColor="gray.200"
                      borderRadius="md"
                    >
                      <Icon as={FiMessageCircle} fontSize="3xl" color="gray.400" mb={3} />
                      <Text color="gray.500">
                        {execution?.status === 'running' 
                          ? 'Waiting for agent interactions...' 
                          : 'No agent interactions available'}
                      </Text>
                    </Flex>
                  )}
                </Box>
              </CardBody>
            </Card>
          </TabPanel>
          
          {/* Execution Graph Tab */}
          <TabPanel p={0} pt={4}>
            <Card>
              <CardHeader>
                <HStack justify="space-between">
                  <Heading size="md">Execution Graph</Heading>
                  <Badge colorScheme="purple">Dynamic Agent Routing</Badge>
                </HStack>
              </CardHeader>
              <CardBody height="500px">
                {Object.keys(executionGraph).length > 0 ? (
                  <AgenticExecutionGraph 
                    executionGraph={executionGraph}
                    agentData={execution?.result?.agent_usage || []}
                  />
                ) : (
                  <Flex 
                    direction="column" 
                    align="center" 
                    justify="center" 
                    height="100%"
                    borderWidth="1px"
                    borderStyle="dashed"
                    borderColor="gray.200"
                    borderRadius="md"
                  >
                    <Icon as={FiShare2} fontSize="3xl" color="gray.400" mb={3} />
                    <Text color="gray.500">
                      {execution?.status === 'running' 
                        ? 'Building execution graph...' 
                        : 'No execution graph available'}
                    </Text>
                  </Flex>
                )}
              </CardBody>
            </Card>
          </TabPanel>
          
          {/* Execution Details Tab */}
          <TabPanel p={0} pt={4}>
            <Card>
              <CardHeader>
                <Heading size="md">Execution Details</Heading>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
                  <Box>
                    <Text fontWeight="bold" mb={2}>Input</Text>
                    <Code p={3} borderRadius="md" w="100%" bg="gray.50">
                      {execution?.input_data 
                        ? JSON.stringify(execution.input_data, null, 2) 
                        : 'No input data provided'}
                    </Code>
                  </Box>
                  
                  <Box>
                    <Text fontWeight="bold" mb={2}>Result</Text>
                    <Code p={3} borderRadius="md" w="100%" bg="gray.50" maxH="200px" overflow="auto">
                      {execution?.result 
                        ? JSON.stringify(execution.result, null, 2) 
                        : execution?.status === 'running' 
                          ? 'Execution in progress...' 
                          : 'No result available'}
                    </Code>
                  </Box>
                </SimpleGrid>
                
                <Divider my={4} />
                
                <Box mb={4}>
                  <Text fontWeight="bold" mb={2}>Agent Usage</Text>
                  {execution?.result?.agent_usage ? (
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      {execution.result.agent_usage.map((agent, index) => (
                        <Card key={index} size="sm" variant="outline">
                          <CardBody>
                            <HStack mb={2}>
                              <Badge colorScheme={getAgentColor(agent.agent, agent.role)}>
                                {agent.role}
                              </Badge>
                              <Text fontWeight="bold">{agent.agent}</Text>
                            </HStack>
                            <HStack spacing={4} fontSize="sm">
                              <Text>Model: {agent.model}</Text>
                              <Text>Messages: {agent.messages_processed || 0}</Text>
                              {agent.tools_used && agent.tools_used.length > 0 && (
                                <HStack>
                                  <Text>Tools:</Text>
                                  {agent.tools_used.map((tool, idx) => (
                                    <Badge key={idx} colorScheme="gray" size="sm">{tool}</Badge>
                                  ))}
                                </HStack>
                              )}
                            </HStack>
                          </CardBody>
                        </Card>
                      ))}
                    </SimpleGrid>
                  ) : (
                    <Text color="gray.500">No agent usage data available</Text>
                  )}
                </Box>
                
                <Divider my={4} />
                
                <HStack spacing={4} mt={4}>
                  <Text fontWeight="bold">Execution Time:</Text>
                  <Text>{execution?.result?.execution_time ? `${execution.result.execution_time.toFixed(2)} seconds` : 'N/A'}</Text>
                </HStack>
                
                {execution?.error && (
                  <Box mt={4} p={3} bg="red.50" borderRadius="md">
                    <Text fontWeight="bold" color="red.500">Error:</Text>
                    <Text color="red.500">{execution.error}</Text>
                  </Box>
                )}
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

// Component for visualizing the execution graph
const AgenticExecutionGraph = ({ executionGraph, agentData = [] }) => {
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 });
  
  // Process graph data
  useEffect(() => {
    if (!executionGraph || Object.keys(executionGraph).length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    
    // Get all unique nodes
    const nodes = new Set();
    
    // Add all sources and targets
    Object.entries(executionGraph).forEach(([source, targets]) => {
      nodes.add(source);
      
      if (Array.isArray(targets)) {
        targets.forEach(target => nodes.add(target));
      }
    });
    
    const nodeArray = Array.from(nodes);
    
    // Position nodes in a circle
    const nodePositions = {};
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) / 2.5;
    
    nodeArray.forEach((node, index) => {
      const angle = (index / nodeArray.length) * 2 * Math.PI;
      nodePositions[node] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        agent: node
      };
    });
    
    // Draw edges
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;
    
    Object.entries(executionGraph).forEach(([source, targets]) => {
      if (!Array.isArray(targets)) return;
      
      const sourcePos = nodePositions[source];
      if (!sourcePos) return;
      
      targets.forEach(target => {
        const targetPos = nodePositions[target];
        if (!targetPos) return;
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();
        
        // Draw arrow
        const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
        const arrowLength = 10;
        
        ctx.beginPath();
        ctx.moveTo(
          targetPos.x - 15 * Math.cos(angle),
          targetPos.y - 15 * Math.sin(angle)
        );
        ctx.lineTo(
          targetPos.x - 15 * Math.cos(angle) - arrowLength * Math.cos(angle - Math.PI/6),
          targetPos.y - 15 * Math.sin(angle) - arrowLength * Math.sin(angle + Math.PI/6)
        );
        ctx.lineTo(
          targetPos.x - 15 * Math.cos(angle) - arrowLength * Math.cos(angle + Math.PI/6),
          targetPos.y - 15 * Math.sin(angle) - arrowLength * Math.sin(angle - Math.PI/6)
        );
        ctx.fillStyle = '#aaa';
        ctx.fill();
      });
    });
    
    // Draw nodes
    Object.entries(nodePositions).forEach(([node, pos]) => {
      // Get agent info
      const agentInfo = agentData.find(a => a.agent === node);
      
      // Node color based on agent role
      let color = '#3182CE'; // default blue
      
      if (agentInfo) {
        if (agentInfo.role === 'supervisor') color = '#8884d8';
        else if (agentInfo.role === 'worker') color = '#82ca9d';
        else if (agentInfo.role === 'hub') color = '#ff7c43';
        else if (agentInfo.role === 'rag') color = '#ffa600';
      }
      
      // Draw circle for node
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw label
      ctx.font = '12px Arial';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.fillText(node.length > 15 ? node.slice(0, 13) + '...' : node, pos.x, pos.y + 30);
    });
    
  }, [executionGraph, agentData, dimensions]);
  
  // Update dimensions when component mounts
  useEffect(() => {
    const updateDimensions = () => {
      const container = canvasRef.current?.parentNode;
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        setDimensions({ 
          width: width || 800, 
          height: height || 450
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);
  
  return (
    <Box position="relative" height="100%" bg="white" borderRadius="md">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ width: '100%', height: '100%' }}
      />
      
      {(!executionGraph || Object.keys(executionGraph).length === 0) && (
        <Flex
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          justify="center"
          align="center"
        >
          <Text color="gray.500">No graph data available</Text>
        </Flex>
      )}
    </Box>
  );
};

export default AgenticWorkflowExecution;
