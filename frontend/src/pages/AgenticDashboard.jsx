// frontend/src/pages/AgenticDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  SimpleGrid,
  Flex,
  HStack,
  VStack,
  Badge,
  Icon,
  Spinner,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tooltip,
  useColorModeValue,
  useToast
} from '@chakra-ui/react';
import { 
  FiPlus, 
  FiCpu, 
  FiPlay, 
  FiEdit, 
  FiEye, 
  FiMoreVertical, 
  FiMessageCircle,
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiShare2,
  FiTool,
  FiRefreshCw,
  FiDatabase
} from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
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
    pending: FiActivity,
    canceled: FiAlertCircle
  };
  
  return (
    <Badge 
      colorScheme={statusColors[status] || 'gray'} 
      display="flex" 
      alignItems="center" 
      px={2} 
      py={1}
    >
      <Icon as={statusIcons[status] || FiActivity} mr={1} />
      {status}
    </Badge>
  );
};

const AgenticDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalWorkflows: 0,
    activeExecutions: 0,
    completedExecutions: 0,
    successRate: 0,
    averageExecutionTime: 0
  });
  const [recentExecutions, setRecentExecutions] = useState([]);
  const [agenticWorkflows, setAgenticWorkflows] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [toolUsageData, setToolUsageData] = useState([]);
  
  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch agentic workflows
      const workflowsResponse = await apiClient.get('/api/agentic/workflows');
      const allWorkflows = workflowsResponse || [];
      
      // Filter agentic workflows
      const agentic = [];
      for (const workflow of allWorkflows) {
        if (workflow.workflow_type === 'agentic') {
          agentic.push(workflow);
        } else if (workflow.template_id) {
          // Check if template is agentic
          const isAgentic = await isAgenticTemplate(workflow.template_id);
          if (isAgentic) {
            agentic.push(workflow);
          }
        }
      }
      
      setAgenticWorkflows(agentic);
      
      // Fetch recent executions
      const executionsResponse = await apiClient.get('/api/agentic-workflows/executions?limit=10');
      const executions = executionsResponse || [];
      setRecentExecutions(executions);
      
      // Calculate metrics
      const completed = executions.filter(e => e.status === 'completed').length;
      const failed = executions.filter(e => e.status === 'failed').length;
      const running = executions.filter(e => e.status === 'running').length;
      const total = executions.length;
      
      // Calculate average execution time
      let totalTime = 0;
      let completedCount = 0;
      
      executions.forEach(exec => {
        if (exec.status === 'completed' && exec.started_at && exec.completed_at) {
          const start = new Date(exec.started_at);
          const end = new Date(exec.completed_at);
          const duration = (end - start) / 1000; // in seconds
          totalTime += duration;
          completedCount++;
        }
      });
      
      const avgTime = completedCount > 0 ? totalTime / completedCount : 0;
      
      setMetrics({
        totalWorkflows: agentic.length,
        activeExecutions: running,
        completedExecutions: completed,
        successRate: total > 0 ? (completed / total * 100).toFixed(1) : 0,
        averageExecutionTime: avgTime.toFixed(1)
      });
      
      // Generate execution history (last 7 days)
      const historyData = generateExecutionHistory();
      setExecutionHistory(historyData);
      
      // Generate tool usage data
      const toolData = generateToolUsageData(executions);
      setToolUsageData(toolData);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load dashboard data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  
  // Check if a template is agentic
  const isAgenticTemplate = async (templateId) => {
    try {
      const template = await apiClient.get(`/api/templates/${templateId}`);
      return template && (
        template.workflow_type === 'agentic' || 
        template.config?.supervisor !== undefined
      );
    } catch (error) {
      console.error('Error checking if template is agentic:', error);
      return false;
    }
  };
  
  // Generate execution history data (mock data for now)
  const generateExecutionHistory = () => {
    const days = 7;
    const data = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.unshift({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: Math.floor(Math.random() * 10) + 5,
        failed: Math.floor(Math.random() * 3)
      });
    }
    
    return data;
  };
  
  // Generate tool usage data (mock data for now)
  const generateToolUsageData = (executions) => {
    const toolCounts = {
      'web_search': 0,
      'execute_code': 0,
      'retrieve_information': 0,
      'analyze_data': 0,
      'send_email': 0,
      'other': 0
    };
    
    // In a real app, you would analyze the execution results to count tool usage
    executions.forEach(execution => {
      if (execution.result?.decisions) {
        execution.result.decisions.forEach(decision => {
          if (decision.tool_name) {
            if (toolCounts[decision.tool_name] !== undefined) {
              toolCounts[decision.tool_name]++;
            } else {
              toolCounts.other++;
            }
          }
        });
      }
    });
    
    // If no real data, generate mock data
    if (Object.values(toolCounts).every(count => count === 0)) {
      toolCounts.web_search = Math.floor(Math.random() * 15) + 5;
      toolCounts.execute_code = Math.floor(Math.random() * 10) + 2;
      toolCounts.retrieve_information = Math.floor(Math.random() * 20) + 10;
      toolCounts.analyze_data = Math.floor(Math.random() * 8) + 3;
      toolCounts.send_email = Math.floor(Math.random() * 5);
      toolCounts.other = Math.floor(Math.random() * 4);
    }
    
    return Object.entries(toolCounts).map(([name, count]) => ({ name, count }));
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  
  // Navigate to create agentic workflow
  const handleCreateAgenticWorkflow = () => {
    navigate('/templates/new?type=agentic');
  };
  
  // Navigate to execution details
  const viewExecution = (execution) => {
    navigate(`/workflows/${execution.workflow_id}/execution/${execution.id}`);
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
        <Heading>Agentic Dashboard</Heading>
        <HStack>
          <Button
            leftIcon={<FiRefreshCw />}
            variant="outline"
            onClick={fetchDashboardData}
          >
            Refresh
          </Button>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="brand"
            onClick={handleCreateAgenticWorkflow}
          >
            Create Agentic Workflow
          </Button>
        </HStack>
      </Flex>
      
      {/* Stats Overview */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={6} mb={8}>
        <Card bg={cardBg}>
          <CardBody>
            <Stat>
              <HStack mb={2}>
                <Icon as={FiCpu} color="blue.500" />
                <StatLabel>Agentic Workflows</StatLabel>
              </HStack>
              <StatNumber>{metrics.totalWorkflows}</StatNumber>
              <StatHelpText>Total agentic workflows</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={cardBg}>
          <CardBody>
            <Stat>
              <HStack mb={2}>
                <Icon as={FiActivity} color="green.500" />
                <StatLabel>Active Executions</StatLabel>
              </HStack>
              <StatNumber>{metrics.activeExecutions}</StatNumber>
              <StatHelpText>Currently running</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={cardBg}>
          <CardBody>
            <Stat>
              <HStack mb={2}>
                <Icon as={FiCheckCircle} color="green.400" />
                <StatLabel>Completed</StatLabel>
              </HStack>
              <StatNumber>{metrics.completedExecutions}</StatNumber>
              <StatHelpText>Successful executions</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={cardBg}>
          <CardBody>
            <Stat>
              <HStack mb={2}>
                <Icon as={FiCheckCircle} color="green.500" />
                <StatLabel>Success Rate</StatLabel>
              </HStack>
              <StatNumber>{metrics.successRate}%</StatNumber>
              <StatHelpText>Overall success rate</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={cardBg}>
          <CardBody>
            <Stat>
              <HStack mb={2}>
                <Icon as={FiActivity} color="purple.500" />
                <StatLabel>Avg. Execution Time</StatLabel>
              </HStack>
              <StatNumber>{metrics.averageExecutionTime}s</StatNumber>
              <StatHelpText>Average execution time</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>
      
      <Tabs colorScheme="brand" isLazy>
        <TabList>
          <Tab><Icon as={FiCpu} mr={2} /> Agentic Workflows</Tab>
          <Tab><Icon as={FiActivity} mr={2} /> Recent Executions</Tab>
          <Tab><Icon as={FiShare2} mr={2} /> Analytics</Tab>
        </TabList>
        
        <TabPanels>
          {/* Agentic Workflows Tab */}
          <TabPanel p={0} pt={4}>
            {agenticWorkflows.length > 0 ? (
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
                {agenticWorkflows.map((workflow) => (
                  <Card key={workflow.id} boxShadow="md" _hover={{ boxShadow: 'lg' }} bg={cardBg}>
                    <CardBody>
                      <Flex direction="column" height="100%">
                        <Flex justify="space-between" align="flex-start" mb={2}>
                          <Badge colorScheme="purple">Agentic</Badge>
                          
                          <Menu>
                            <MenuButton
                              as={IconButton}
                              icon={<FiMoreVertical />}
                              variant="ghost"
                              size="sm"
                              aria-label="Workflow options"
                            />
                            <MenuList>
                              <MenuItem 
                                icon={<FiPlay />} 
                                onClick={() => navigate(`/workflows/${workflow.id}/run`)}
                              >
                                Run Workflow
                              </MenuItem>
                              <MenuItem 
                                icon={<FiEdit />} 
                                onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
                              >
                                Edit
                              </MenuItem>
                              <MenuItem 
                                icon={<FiEye />} 
                                onClick={() => navigate(`/workflows/${workflow.id}`)}
                              >
                                View Details
                              </MenuItem>
                            </MenuList>
                          </Menu>
                        </Flex>
                        
                        <Heading size="md" mb={2}>{workflow.name}</Heading>
                        
                        <Text fontSize="sm" color="gray.600" mb={4} flex="1">
                          {workflow.description || 'No description provided'}
                        </Text>
                        
                        <Flex justify="space-between" align="center" mt="auto">
                          <HStack>
                            <Icon as={FiMessageCircle} color="gray.500" />
                            <Text fontSize="sm" color="gray.500">
                              {workflow.agents_count || 0} agents
                            </Text>
                          </HStack>
                          
                          <Button
                            rightIcon={<FiPlay />}
                            size="sm"
                            colorScheme="brand"
                            onClick={() => navigate(`/workflows/${workflow.id}/run`)}
                          >
                            Run
                          </Button>
                        </Flex>
                      </Flex>
                    </CardBody>
                  </Card>
                ))}
              </SimpleGrid>
            ) : (
              <Flex 
                direction="column" 
                align="center" 
                justify="center" 
                py={10} 
                border="1px" 
                borderColor="gray.200" 
                borderRadius="md"
              >
                <Icon as={FiCpu} fontSize="4xl" color="gray.400" mb={4} />
                <Text color="gray.500" mb={4}>
                  No agentic workflows available. Create your first workflow to get started.
                </Text>
                <Button 
                  colorScheme="brand" 
                  leftIcon={<FiPlus />}
                  onClick={handleCreateAgenticWorkflow}
                >
                  Create Agentic Workflow
                </Button>
              </Flex>
            )}
          </TabPanel>
          
          {/* Recent Executions Tab */}
          <TabPanel p={0} pt={4}>
            <Card bg={cardBg}>
              <CardHeader pb={2}>
                <Heading size="md">Recent Executions</Heading>
              </CardHeader>
              <CardBody>
                {recentExecutions.length > 0 ? (
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Workflow</Th>
                        <Th>Status</Th>
                        <Th>Started</Th>
                        <Th>Duration</Th>
                        <Th>Agents</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {recentExecutions.map((execution) => (
                        <Tr key={execution.id}>
                          <Td>
                            {execution.workflow_name || 'Unknown Workflow'}
                          </Td>
                          <Td><StatusBadge status={execution.status} /></Td>
                          <Td>{new Date(execution.started_at).toLocaleString()}</Td>
                          <Td>
                            {execution.completed_at 
                              ? Math.round((new Date(execution.completed_at) - new Date(execution.started_at)) / 1000) + 's'
                              : 'In progress'}
                          </Td>
                          <Td>
                            {execution.result?.decisions?.length || 0}
                          </Td>
                          <Td>
                            <HStack spacing={2}>
                              <Tooltip label="View Execution">
                                <IconButton
                                  icon={<FiEye />}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => viewExecution(execution)}
                                  aria-label="View execution"
                                />
                              </Tooltip>
                              
                              {execution.status === 'running' && (
                                <Tooltip label="Cancel Execution">
                                  <IconButton
                                    icon={<FiAlertCircle />}
                                    size="sm"
                                    variant="ghost"
                                    colorScheme="red"
                                    aria-label="Cancel execution"
                                  />
                                </Tooltip>
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ) : (
                  <Flex 
                    direction="column" 
                    align="center" 
                    justify="center" 
                    py={10}
                  >
                    <Icon as={FiActivity} fontSize="4xl" color="gray.400" mb={4} />
                    <Text color="gray.500">No recent executions found</Text>
                  </Flex>
                )}
              </CardBody>
            </Card>
          </TabPanel>
          
          {/* Analytics Tab */}
          <TabPanel p={0} pt={4}>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={6}>
              {/* Execution History Chart */}
              <Card bg={cardBg}>
                <CardHeader pb={2}>
                  <Heading size="md">Execution History</Heading>
                </CardHeader>
                <CardBody height="300px">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={executionHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip />
                      <Line 
                        type="monotone" 
                        dataKey="completed" 
                        stroke="#48BB78" 
                        name="Completed"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="failed" 
                        stroke="#E53E3E" 
                        name="Failed"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
              
              {/* Tool Usage Stats */}
              <Card bg={cardBg}>
                <CardHeader pb={2}>
                  <Heading size="md">Tool Usage</Heading>
                </CardHeader>
                <CardBody>
                  <VStack align="stretch" spacing={4}>
                    {toolUsageData.map((tool) => (
                      <Box key={tool.name}>
                        <Flex justify="space-between" mb={1}>
                          <HStack>
                            <Icon as={FiTool} color="blue.500" />
                            <Text fontWeight="medium">
                              {tool.name === 'retrieve_information' 
                                ? 'Knowledge Retrieval' 
                                : tool.name === 'web_search'
                                  ? 'Web Search'
                                  : tool.name === 'execute_code'
                                    ? 'Code Execution'
                                    : tool.name === 'analyze_data'
                                      ? 'Data Analysis'
                                      : tool.name === 'send_email'
                                        ? 'Email Sending'
                                        : tool.name}
                            </Text>
                          </HStack>
                          <Text fontWeight="bold">{tool.count}</Text>
                        </Flex>
                        <Box 
                          bg="gray.100" 
                          h="8px" 
                          borderRadius="full" 
                          overflow="hidden"
                        >
                          <Box 
                            bg={
                              tool.name === 'retrieve_information' 
                                ? 'teal.500' 
                                : tool.name === 'web_search'
                                  ? 'blue.500'
                                  : tool.name === 'execute_code'
                                    ? 'green.500'
                                    : tool.name === 'analyze_data'
                                      ? 'purple.500'
                                      : tool.name === 'send_email'
                                        ? 'orange.500'
                                        : 'gray.500'
                            }
                            h="100%" 
                            width={`${Math.min(tool.count / Math.max(...toolUsageData.map(t => t.count)) * 100, 100)}%`}
                          />
                        </Box>
                      </Box>
                    ))}
                  </VStack>
                </CardBody>
              </Card>
            </SimpleGrid>
            
            {/* Agent Interaction Stats */}
            <Card bg={cardBg}>
              <CardHeader pb={2}>
                <Heading size="md">Agent Statistics</Heading>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                  <Card variant="outline">
                    <CardBody>
                      <Stat>
                        <StatLabel>Avg. Message Count</StatLabel>
                        <StatNumber>12.3</StatNumber>
                        <StatHelpText>Per agentic execution</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                  
                  <Card variant="outline">
                    <CardBody>
                      <Stat>
                        <StatLabel>Avg. Decision Count</StatLabel>
                        <StatNumber>5.7</StatNumber>
                        <StatHelpText>Decisions per execution</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                  
                  <Card variant="outline">
                    <CardBody>
                      <Stat>
                        <StatLabel>Avg. Agent Interactions</StatLabel>
                        <StatNumber>8.2</StatNumber>
                        <StatHelpText>Inter-agent communication</StatHelpText>
                      </Stat>
                    </CardBody>
                  </Card>
                </SimpleGrid>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default AgenticDashboard;
