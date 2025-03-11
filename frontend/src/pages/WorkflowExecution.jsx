/* eslint-disable no-unused-vars */
import apiClient from '../services/api';
import React, { useState, useEffect } from 'react';
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
  Spinner,
  VStack,
  HStack,
  Badge,
  Icon,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Code,
  Tooltip,
  Progress,
  IconButton,
  useToast,
  SimpleGrid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td
} from '@chakra-ui/react';
import { 
  FiArrowLeft, FiCpu, FiActivity, FiMessageCircle, FiCheckCircle, 
  FiAlertCircle, FiClock, FiRepeat, FiChevronRight, FiDownload,
  FiInfo, FiSettings
} from 'react-icons/fi';

// Status badge component
const StatusBadge = ({ status }) => {
  const statusColors = {
    running: 'blue',
    completed: 'green',
    failed: 'red',
    pending: 'yellow'
  };
  
  const statusIcons = {
    running: FiActivity,
    completed: FiCheckCircle,
    failed: FiAlertCircle,
    pending: FiClock
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

const WorkflowExecution = () => {
  const { id, executionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [execution, setExecution] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  
  // Fetch execution data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch execution
        const executionData = await apiClient.get(`/api/workflow-executions/${executionId}`);
        setExecution(executionData);
        
        // Fetch workflow
        const workflowData = await apiClient.get(`/api/workflows/${id}`);
        setWorkflow(workflowData);
        
        // Fetch template
        const templateData = await apiClient.get(`/api/templates/${workflowData.template_id}`);
        setTemplate(templateData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch execution data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // For running executions, poll for updates
    const pollInterval = setInterval(() => {
      if (execution?.status === 'running') {
        fetch(`/api/workflow-executions/${executionId}`)
          .then(response => response.json())
          .then(data => {
            setExecution(data);
            if (data.status !== 'running') {
              clearInterval(pollInterval);
            }
          })
          .catch(error => console.error('Polling error:', error));
      }
    }, 5000);
    
    return () => clearInterval(pollInterval);
  }, [id, executionId, toast, execution?.status]);
  
  const downloadResult = () => {
    if (!execution?.result) return;
    
    const fileName = `execution-${executionId}-result.json`;
    const jsonStr = JSON.stringify(execution.result, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // Format date nicely
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
      return `${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  };
  
  // Extract simulated agent messages for UI display
  const getAgentMessages = () => {
    if (!execution?.result) return [];
    
    // This would need to be adapted based on the actual execution result structure
    try {
      // Example structure for supervisor workflow
      if (template?.workflow_type === 'supervisor') {
        const messages = [];
        
        // Extract supervisor messages
        if (execution.result.messages) {
          execution.result.messages.forEach(msg => {
            if (msg.role === 'assistant') {
              messages.push({
                agent: 'supervisor',
                content: msg.content,
                timestamp: Date.now() // Actual timestamp if available
              });
            }
          });
        }
        
        // Extract other agent interactions if available
        if (execution.result.actions) {
          execution.result.actions.forEach(action => {
            messages.push({
              agent: action.agent || 'worker',
              content: action.result || 'Task completed',
              timestamp: Date.now() // Actual timestamp if available
            });
          });
        }
        
        return messages;
      } else {
        // Example structure for swarm workflow
        const messages = [];
        
        if (execution.result.outputs) {
          Object.entries(execution.result.outputs).forEach(([agent, content]) => {
            messages.push({
              agent,
              content,
              timestamp: Date.now() // Actual timestamp if available
            });
          });
        }
        
        if (execution.result.final_output) {
          messages.push({
            agent: 'final',
            content: execution.result.final_output,
            timestamp: Date.now() // Actual timestamp if available
          });
        }
        
        return messages;
      }
    } catch (error) {
      console.error('Error parsing agent messages:', error);
      return [];
    }
  };
  
  if (loading) {
    return (
      <Flex justify="center" align="center" height="500px" width="100%">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }
  
  const agentMessages = getAgentMessages();
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <HStack>
          <IconButton
            icon={<FiArrowLeft />}
            onClick={() => navigate('/workflows')}
            aria-label="Back to workflows"
          />
          <Heading>Workflow Execution</Heading>
        </HStack>
        
        <HStack>
          <StatusBadge status={execution?.status || 'unknown'} />
          {execution?.status === 'completed' && (
            <Tooltip label="Download Result">
              <IconButton
                icon={<FiDownload />}
                onClick={downloadResult}
                aria-label="Download result"
              />
            </Tooltip>
          )}
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
          <Tab><Icon as={FiCpu} mr={2} /> Execution Details</Tab>
          <Tab><Icon as={FiSettings} mr={2} /> Configuration</Tab>
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
                
                {agentMessages.length > 0 ? (
                  <Box>
                    {agentMessages.map((message, index) => (
                      <Card 
                        key={index} 
                        mb={4} 
                        variant="outline"
                        borderWidth={activeMessageIndex === index ? "2px" : "1px"}
                        borderColor={activeMessageIndex === index ? "brand.500" : "gray.200"}
                      >
                        <CardBody>
                          <HStack mb={3}>
                            <Badge colorScheme={message.agent === 'supervisor' ? 'blue' : 'green'}>
                              {message.agent}
                            </Badge>
                            <Text fontSize="xs" color="gray.500">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </Text>
                          </HStack>
                          
                          <Text whiteSpace="pre-wrap">{message.content}</Text>
                        </CardBody>
                      </Card>
                    ))}
                  </Box>
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
                
                <Accordion allowToggle>
                  <AccordionItem>
                    <h2>
                      <AccordionButton>
                        <Box flex="1" textAlign="left" fontWeight="medium">
                          Execution Timeline
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Event</Th>
                            <Th>Timestamp</Th>
                            <Th>Details</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          <Tr>
                            <Td>Execution Started</Td>
                            <Td>{formatDate(execution?.started_at)}</Td>
                            <Td>Workflow initiated</Td>
                          </Tr>
                          {execution?.status === 'completed' && (
                            <Tr>
                              <Td>Execution Completed</Td>
                              <Td>{formatDate(execution?.completed_at)}</Td>
                              <Td>All tasks finished successfully</Td>
                            </Tr>
                          )}
                          {execution?.status === 'failed' && (
                            <Tr>
                              <Td color="red.500">Execution Failed</Td>
                              <Td>{formatDate(execution?.completed_at)}</Td>
                              <Td color="red.500">
                                {execution?.result?.error || 'Unknown error occurred'}
                              </Td>
                            </Tr>
                          )}
                        </Tbody>
                      </Table>
                    </AccordionPanel>
                  </AccordionItem>
                  
                  <AccordionItem>
                    <h2>
                      <AccordionButton>
                        <Box flex="1" textAlign="left" fontWeight="medium">
                          Raw Execution Data
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      <Code p={3} borderRadius="md" w="100%" bg="gray.50" maxH="400px" overflow="auto">
                        {JSON.stringify(execution, null, 2)}
                      </Code>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </CardBody>
            </Card>
          </TabPanel>
          
          {/* Configuration Tab */}
          <TabPanel p={0} pt={4}>
            <Card>
              <CardHeader>
                <Heading size="md">Configuration</Heading>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <Box>
                    <Text fontWeight="bold" mb={3}>Template Details</Text>
                    <VStack align="start" spacing={2} pl={2}>
                      <HStack>
                        <Text fontWeight="medium" color="gray.600">Name:</Text>
                        <Text>{template?.name || 'Unknown'}</Text>
                      </HStack>
                      <HStack>
                        <Text fontWeight="medium" color="gray.600">Type:</Text>
                        <Badge colorScheme={template?.workflow_type === 'supervisor' ? 'blue' : 'purple'}>
                          {template?.workflow_type || 'Unknown'}
                        </Badge>
                      </HStack>
                      <HStack>
                        <Text fontWeight="medium" color="gray.600">Description:</Text>
                        <Text>{template?.description || 'No description'}</Text>
                      </HStack>
                    </VStack>
                  </Box>
                  
                  <Box>
                    <Text fontWeight="bold" mb={3}>Workflow Settings</Text>
                    <VStack align="start" spacing={2} pl={2}>
                      <HStack>
                        <Text fontWeight="medium" color="gray.600">Max Iterations:</Text>
                        <Text>{template?.config?.workflow_config?.max_iterations || 3}</Text>
                      </HStack>
                      {template?.workflow_type === 'swarm' && (
                        <HStack>
                          <Text fontWeight="medium" color="gray.600">Interaction Type:</Text>
                          <Text>{template?.config?.workflow_config?.interaction_type || 'sequential'}</Text>
                        </HStack>
                      )}
                      <HStack>
                        <Text fontWeight="medium" color="gray.600">Checkpointing:</Text>
                        <Badge colorScheme={template?.config?.workflow_config?.checkpoint_dir ? 'green' : 'gray'}>
                          {template?.config?.workflow_config?.checkpoint_dir ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </HStack>
                    </VStack>
                  </Box>
                </SimpleGrid>
                
                <Divider my={6} />
                
                <Accordion allowToggle>
                  <AccordionItem>
                    <h2>
                      <AccordionButton>
                        <Box flex="1" textAlign="left" fontWeight="medium">
                          {template?.workflow_type === 'supervisor' ? 'Agent Configuration' : 'Swarm Configuration'}
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      {template?.workflow_type === 'supervisor' ? (
                        <Box>
                          <Box mb={4}>
                            <Text fontWeight="bold" mb={2}>Supervisor Agent</Text>
                            <Card variant="outline" mb={3}>
                              <CardBody>
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                                  <HStack>
                                    <Text fontWeight="medium" color="gray.600">Name:</Text>
                                    <Text>{template?.config?.supervisor?.name || 'supervisor'}</Text>
                                  </HStack>
                                  <HStack>
                                    <Text fontWeight="medium" color="gray.600">Model:</Text>
                                    <Text>{template?.config?.supervisor?.model_name || 'Unknown'}</Text>
                                  </HStack>
                                  <HStack>
                                    <Text fontWeight="medium" color="gray.600">Provider:</Text>
                                    <Text>{template?.config?.supervisor?.model_provider || 'Unknown'}</Text>
                                  </HStack>
                                  <HStack>
                                    <Text fontWeight="medium" color="gray.600">Temperature:</Text>
                                    <Text>{template?.config?.supervisor?.temperature || 0.7}</Text>
                                  </HStack>
                                </SimpleGrid>
                              </CardBody>
                            </Card>
                          </Box>
                          
                          <Box>
                            <Text fontWeight="bold" mb={2}>Worker Agents</Text>
                            {template?.config?.workers?.map((worker, index) => (
                              <Card key={index} variant="outline" mb={3}>
                                <CardBody>
                                  <HStack mb={2}>
                                    <Badge colorScheme="green">{worker.role}</Badge>
                                    <Text fontWeight="bold">{worker.name}</Text>
                                  </HStack>
                                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                                    <HStack>
                                      <Text fontWeight="medium" color="gray.600">Model:</Text>
                                      <Text>{worker.model_name || 'Unknown'}</Text>
                                    </HStack>
                                    <HStack>
                                      <Text fontWeight="medium" color="gray.600">Provider:</Text>
                                      <Text>{worker.model_provider || 'Unknown'}</Text>
                                    </HStack>
                                    <HStack>
                                      <Text fontWeight="medium" color="gray.600">Temperature:</Text>
                                      <Text>{worker.temperature || 0.7}</Text>
                                    </HStack>
                                    <HStack>
                                      <Text fontWeight="medium" color="gray.600">Tools:</Text>
                                      <Text>{worker.tools?.length || 0} tools</Text>
                                    </HStack>
                                  </SimpleGrid>
                                </CardBody>
                              </Card>
                            ))}
                          </Box>
                        </Box>
                      ) : (
                        <Box>
                          <Text fontWeight="bold" mb={2}>Swarm Agents</Text>
                          {template?.config?.agents?.map((agent, index) => (
                            <Card key={index} variant="outline" mb={3}>
                              <CardBody>
                                <HStack mb={2}>
                                  <Badge colorScheme="purple">{agent.role}</Badge>
                                  <Text fontWeight="bold">{agent.name}</Text>
                                  {template?.config?.workflow_config?.hub_agent === agent.name && (
                                    <Badge colorScheme="orange">Hub Agent</Badge>
                                  )}
                                </HStack>
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                                  <HStack>
                                    <Text fontWeight="medium" color="gray.600">Model:</Text>
                                    <Text>{agent.model_name || 'Unknown'}</Text>
                                  </HStack>
                                  <HStack>
                                    <Text fontWeight="medium" color="gray.600">Provider:</Text>
                                    <Text>{agent.model_provider || 'Unknown'}</Text>
                                  </HStack>
                                  <HStack>
                                    <Text fontWeight="medium" color="gray.600">Temperature:</Text>
                                    <Text>{agent.temperature || 0.7}</Text>
                                  </HStack>
                                  <HStack>
                                    <Text fontWeight="medium" color="gray.600">Tools:</Text>
                                    <Text>{agent.tools?.length || 0} tools</Text>
                                  </HStack>
                                </SimpleGrid>
                              </CardBody>
                            </Card>
                          ))}
                        </Box>
                      )}
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default WorkflowExecution;
