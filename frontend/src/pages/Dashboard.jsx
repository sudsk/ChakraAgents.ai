import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  SimpleGrid, 
  Stat, 
  StatLabel, 
  StatNumber, 
  StatHelpText, 
  Flex, 
  Badge, 
  Tab, 
  Tabs, 
  TabList, 
  TabPanel, 
  TabPanels,
  Card,
  CardBody,
  CardHeader,
  Button,
  Spinner,
  Select,
  HStack,
  VStack,
  Icon,
  Divider
} from '@chakra-ui/react';
import { FiCpu, FiActivity, FiCheckCircle, FiAlertCircle, FiEdit, FiPlay, FiClipboard, FiFileText, FiEye } from 'react-icons/fi';
import { LineChart, PieChart, BarChart, Line, Bar, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

// Helper component for status badges
const StatusBadge = ({ status }) => {
  const statusColors = {
    running: 'blue',
    completed: 'green',
    failed: 'red',
    pending: 'yellow'
  };
  
  return (
    <Badge colorScheme={statusColors[status] || 'gray'} borderRadius="full" px={2}>
      {status}
    </Badge>
  );
};

// Stat card component
const StatCard = ({ title, value, icon, iconColor, helpText }) => {
  return (
    <Card>
      <CardBody>
        <Flex align="center" mb={2}>
          <Box mr={3} color={iconColor}>
            <Icon as={icon} fontSize="2xl" />
          </Box>
          <Text fontWeight="medium">{title}</Text>
        </Flex>
        <StatNumber fontSize="3xl" fontWeight="bold" my={1}>{value}</StatNumber>
        <Text fontSize="sm" color="gray.500">{helpText}</Text>
      </CardBody>
    </Card>
  );
};

const AgentDashboard = () => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [workflowExecutions, setWorkflowExecutions] = useState([]);
  const [metrics, setMetrics] = useState({
    totalTemplates: 0,
    activeWorkflows: 0,
    successRate: 0,
    avgResponseTime: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('templates');
  const navigate = useNavigate();
  
  useEffect(() => {
    // Fetch templates
    fetch('/api/templates')
      .then(response => response.json())
      .then(data => {
        setTemplates(data);
        setMetrics(prev => ({...prev, totalTemplates: data.length}));
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching templates:', error);
        setLoading(false);
      });
      
    // Fetch recent executions
    fetch('/api/workflow-executions/recent')
      .then(response => response.json())
      .then(data => {
        setWorkflowExecutions(data);
        
        // Calculate success rate
        const succeeded = data.filter(exec => exec.status === 'completed').length;
        const successRate = data.length > 0 ? (succeeded / data.length * 100).toFixed(1) : 0;
        
        // Calculate average response time
        const completedExecutions = data.filter(exec => exec.completed_at && exec.started_at);
        let totalResponseTime = 0;
        
        completedExecutions.forEach(exec => {
          const start = new Date(exec.started_at);
          const end = new Date(exec.completed_at);
          const responseTime = (end - start) / 1000; // in seconds
          totalResponseTime += responseTime;
        });
        
        const avgResponseTime = completedExecutions.length > 0 
          ? (totalResponseTime / completedExecutions.length).toFixed(1) 
          : 0;
        
        setMetrics(prev => ({
          ...prev, 
          successRate,
          avgResponseTime,
          activeWorkflows: data.filter(exec => exec.status === 'running').length
        }));
      })
      .catch(error => {
        console.error('Error fetching executions:', error);
      });
  }, []);
  
  // Sample data for metrics
  const executionData = [
    { name: 'Mon', executions: 12, success: 11, failed: 1 },
    { name: 'Tue', executions: 19, success: 16, failed: 3 },
    { name: 'Wed', executions: 15, success: 13, failed: 2 },
    { name: 'Thu', executions: 21, success: 19, failed: 2 },
    { name: 'Fri', executions: 18, success: 15, failed: 3 },
    { name: 'Sat', executions: 14, success: 14, failed: 0 },
    { name: 'Sun', executions: 13, success: 12, failed: 1 },
  ];
  
  const templateUsageData = [
    { name: 'Research Assistant', value: 45 },
    { name: 'Writing Assistant', value: 30 },
    { name: 'Product Team', value: 25 },
  ];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
  
  const handleEditTemplate = (template) => {
    navigate(`/templates/${template.id}`);
  };
  
  const handleRunTemplate = (template) => {
    navigate(`/workflows/new?templateId=${template.id}`);
  };
  
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
      <Heading mb={6}>Agent Dashboard</Heading>
      
      {/* Stats Overview */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <StatCard
          icon={FiCpu}
          iconColor="blue.500"
          title="Total Templates"
          value={metrics.totalTemplates}
          helpText="Available templates"
        />
        <StatCard
          icon={FiActivity}
          iconColor="green.500"
          title="Active Workflows"
          value={metrics.activeWorkflows}
          helpText="Currently running"
        />
        <StatCard
          icon={FiCheckCircle}
          iconColor="green.400"
          title="Success Rate"
          value={`${metrics.successRate}%`}
          helpText="Last 30 days"
        />
        <StatCard
          icon={FiActivity}
          iconColor="purple.400"
          title="Avg Response Time"
          value={`${metrics.avgResponseTime}s`}
          helpText="Response time"
        />
      </SimpleGrid>
      
      {/* Main Content Tabs */}
      <Tabs colorScheme="brand" onChange={(index) => setActiveTab(['templates', 'executions', 'analytics'][index])}>
        <TabList>
          <Tab>Templates</Tab>
          <Tab>Recent Executions</Tab>
          <Tab>Analytics</Tab>
        </TabList>
        
        <TabPanels>
          {/* Templates Panel */}
          <TabPanel p={0} pt={4}>
            <Box mb={4}>
              <HStack>
                <Select 
                  placeholder="Filter by type" 
                  w="200px"
                  onChange={(e) => console.log(e.target.value)}
                >
                  <option value="supervisor">Supervisor</option>
                  <option value="swarm">Swarm</option>
                </Select>
                <Button 
                  colorScheme="brand" 
                  leftIcon={<FiCpu />}
                  onClick={() => navigate('/templates/new')}
                >
                  New Template
                </Button>
              </HStack>
            </Box>
            
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
              {templates.map((template) => (
                <Card 
                  key={template.id} 
                  bg={selectedTemplate?.id === template.id ? 'blue.50' : 'white'}
                  borderColor={selectedTemplate?.id === template.id ? 'blue.500' : 'gray.200'}
                  borderWidth="1px"
                  cursor="pointer"
                  onClick={() => setSelectedTemplate(template)}
                  _hover={{ shadow: 'md' }}
                >
                  <CardBody>
                    <Flex justify="space-between" align="flex-start">
                      <Box>
                        <Heading size="md" mb={1}>{template.name}</Heading>
                        <Text fontSize="sm" color="gray.600" mb={2}>
                          {template.description || 'No description provided'}
                        </Text>
                        <Badge 
                          colorScheme={template.workflow_type === 'supervisor' ? 'blue' : 'purple'}
                          mb={2}
                        >
                          {template.workflow_type}
                        </Badge>
                      </Box>
                      <HStack>
                        <Button 
                          size="sm" 
                          leftIcon={<FiEdit />} 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTemplate(template);
                          }}
                        >
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          colorScheme="brand" 
                          leftIcon={<FiPlay />} 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunTemplate(template);
                          }}
                        >
                          Run
                        </Button>
                      </HStack>
                    </Flex>
                    
                    {selectedTemplate?.id === template.id && (
                      <Box mt={4}>
                        <Divider mb={4} />
                        <Heading size="xs" mb={2}>Template Configuration</Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <Box>
                            <Text fontSize="xs" fontWeight="bold" color="gray.500">Type</Text>
                            <Text fontSize="sm">{template.workflow_type}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" fontWeight="bold" color="gray.500">Created</Text>
                            <Text fontSize="sm">{new Date(template.created_at).toLocaleDateString()}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" fontWeight="bold" color="gray.500">Agents</Text>
                            <Text fontSize="sm">
                              {template.workflow_type === 'supervisor' 
                                ? `1 supervisor, ${template.config.workers?.length || 0} workers` 
                                : `${template.config.agents?.length || 0} agents`}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" fontWeight="bold" color="gray.500">Tools</Text>
                            <Text fontSize="sm">{template.config.tools?.length || 0} tools</Text>
                          </Box>
                        </SimpleGrid>
                      </Box>
                    )}
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
            
            {templates.length === 0 && (
              <Flex 
                direction="column" 
                align="center" 
                justify="center" 
                py={10} 
                border="1px" 
                borderColor="gray.200" 
                borderRadius="md"
              >
                <Icon as={FiFileText} fontSize="4xl" color="gray.400" mb={4} />
                <Text color="gray.500" mb={2}>No templates available</Text>
                <Button 
                  colorScheme="brand" 
                  size="sm" 
                  leftIcon={<FiCpu />}
                  onClick={() => navigate('/templates/new')}
                >
                  Create New Template
                </Button>
              </Flex>
            )}
          </TabPanel>
          
          {/* Recent Executions Panel */}
          <TabPanel p={0} pt={4}>
            <Box mb={4}>
              <HStack>
                <Select 
                  placeholder="Filter by status" 
                  w="200px"
                  onChange={(e) => console.log(e.target.value)}
                >
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </Select>
              </HStack>
            </Box>
            
            {workflowExecutions.length > 0 ? (
              <SimpleGrid columns={{ base: 1, lg: 1 }} spacing={4}>
                {workflowExecutions.map((execution) => (
                  <Card key={execution.id} _hover={{ shadow: 'md' }}>
                    <CardBody>
                      <Flex justify="space-between" align="center">
                        <Box>
                          <Heading size="sm" mb={1}>{execution.workflow_name || 'Unnamed Workflow'}</Heading>
                          <Text fontSize="xs" color="gray.500">
                            Started: {new Date(execution.started_at).toLocaleTimeString()} - {new Date(execution.started_at).toLocaleDateString()}
                          </Text>
                          {execution.completed_at && (
                            <Text fontSize="xs" color="gray.500">
                              Completed: {new Date(execution.completed_at).toLocaleTimeString()} - {new Date(execution.completed_at).toLocaleDateString()}
                            </Text>
                          )}
                        </Box>
                        
                        <Flex align="center">
                          <StatusBadge status={execution.status} />
                          <Button 
                            size="sm" 
                            leftIcon={<FiEye />} 
                            ml={3}
                            onClick={() => viewExecution(execution)}
                          >
                            View
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
                <Icon as={FiClipboard} fontSize="4xl" color="gray.400" mb={4} />
                <Text color="gray.500" mb={2}>No recent executions</Text>
                <Button 
                  colorScheme="brand" 
                  size="sm" 
                  leftIcon={<FiPlay />}
                  onClick={() => navigate('/workflows')}
                >
                  Run a Workflow
                </Button>
              </Flex>
            )}
          </TabPanel>
          
          {/* Analytics Panel */}
          <TabPanel p={0} pt={4}>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={6}>
              <Card>
                <CardHeader>
                  <Heading size="md">Weekly Executions</Heading>
                </CardHeader>
                <CardBody height="300px">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={executionData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="success" fill="#38A169" name="Successful" />
                      <Bar dataKey="failed" fill="#E53E3E" name="Failed" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
              
              <Card>
                <CardHeader>
                  <Heading size="md">Template Usage</Heading>
                </CardHeader>
                <CardBody height="300px">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={templateUsageData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {templateUsageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
            </SimpleGrid>
            
            <Card>
              <CardHeader>
                <Heading size="md">Response Time Trend</Heading>
              </CardHeader>
              <CardBody height="300px">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { name: '1', time: 1.2 },
                      { name: '2', time: 1.5 },
                      { name: '3', time: 0.9 },
                      { name: '4', time: 1.3 },
                      { name: '5', time: 1.1 },
                      { name: '6', time: 0.8 },
                      { name: '7', time: 1.0 },
                    ]}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" label={{ value: 'Day', position: 'insideBottomRight', offset: -10 }} />
                    <YAxis label={{ value: 'Response Time (s)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="time" stroke="#8884d8" activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default AgentDashboard;
