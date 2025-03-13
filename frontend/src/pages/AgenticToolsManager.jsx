// frontend/src/pages/AgenticToolsManager.jsx
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
  Flex,
  HStack,
  VStack,
  Badge,
  Icon,
  Input,
  Textarea,
  FormControl,
  FormLabel,
  FormHelperText,
  SimpleGrid,
  Select,
  Switch,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Code,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  IconButton,
  Spinner,
  useDisclosure,
  useToast,
  useColorModeValue,
  Divider
} from '@chakra-ui/react';
import { 
  FiPlus, 
  FiTool, 
  FiEdit, 
  FiTrash2, 
  FiPlay, 
  FiRefreshCw,
  FiList,
  FiX,
  FiSave,
  FiCode,
  FiCheck,
  FiSearch,
  FiFilter
} from 'react-icons/fi';
import apiClient from '../services/api';

// Main component for managing agentic tools
const AgenticToolsManager = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { 
    isOpen: isTestDrawerOpen, 
    onOpen: onOpenTestDrawer, 
    onClose: onCloseTestDrawer 
  } = useDisclosure();
  const { 
    isOpen: isDeleteAlertOpen, 
    onOpen: onOpenDeleteAlert, 
    onClose: onCloseDeleteAlert 
  } = useDisclosure();
  
  const cancelRef = React.useRef();
  const cardBg = useColorModeValue('white', 'gray.800');
  
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState([]);
  const [systemTools, setSystemTools] = useState([]);
  const [currentTool, setCurrentTool] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [testParameters, setTestParameters] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  
  // Initialize new tool template
  const defaultToolTemplate = {
    name: '',
    description: '',
    function_name: '',
    parameters: {},
    requires_confirmation: false,
    always_available: true
  };
  
  // Fetch tools
  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      // This would be the actual API call to fetch agentic tools
      const response = await apiClient.get('/api/agentic/tools');
      
      // In a real app, we would use the actual response
      // For now, mock the response
      const mockCustomTools = [
        {
          name: 'web_search',
          description: 'Search the web for information on a given query',
          function_name: 'search_web',
          parameters: {
            query: {
              type: 'string',
              description: 'The search query'
            },
            num_results: {
              type: 'integer',
              description: 'Number of results to return',
              default: 5
            }
          },
          requires_confirmation: false,
          always_available: true
        },
        {
          name: 'summarize_text',
          description: 'Summarize a long text into a shorter version',
          function_name: 'summarize_text',
          parameters: {
            text: {
              type: 'string',
              description: 'The text to summarize'
            },
            max_length: {
              type: 'integer',
              description: 'Maximum length of the summary in words',
              default: 100
            }
          },
          requires_confirmation: false,
          always_available: true
        }
      ];
      
      const mockSystemTools = [
        {
          name: 'retrieve_information',
          description: 'Retrieve relevant information from the knowledge base',
          function_name: 'retrieve_information',
          parameters: {
            query: {
              type: 'string',
              description: 'The retrieval query'
            },
            num_results: {
              type: 'integer',
              description: 'Number of results to return',
              default: 5
            }
          },
          requires_confirmation: false,
          always_available: true
        },
        {
          name: 'execute_code',
          description: 'Execute code in a sandbox environment',
          function_name: 'execute_code',
          parameters: {
            code: {
              type: 'string',
              description: 'The code to execute'
            },
            language: {
              type: 'string',
              description: 'The programming language',
              enum: ['python', 'javascript', 'bash']
            }
          },
          requires_confirmation: true,
          always_available: true
        }
      ];
      
      setTools(mockCustomTools);
      setSystemTools(mockSystemTools);
    } catch (error) {
      console.error('Error fetching tools:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load tools',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  
  // Initial data load
  useEffect(() => {
    fetchTools();
  }, [fetchTools]);
  
  // Create new tool
  const handleCreateTool = () => {
    setCurrentTool({
      ...defaultToolTemplate,
      name: `tool_${Date.now().toString(36)}`
    });
    onOpen();
  };
  
  // Edit existing tool
  const handleEditTool = (tool) => {
    setCurrentTool({...tool});
    onOpen();
  };
  
  // Save tool (create or update)
  const handleSaveTool = async () => {
    // Validate tool
    if (!currentTool.name || !currentTool.function_name || !currentTool.description) {
      toast({
        title: 'Validation Error',
        description: 'Name, function name, and description are required',
        status: 'warning',
        duration: 3000,
        isClosable: true
      });
      return;
    }
    
    try {
      // Check if we're updating or creating
      const isUpdate = tools.some(t => t.name === currentTool.name);
      
      if (isUpdate) {
        // Update existing tool
        await apiClient.put(`/api/agentic/tools/${currentTool.name}`, currentTool);
        
        // Update state
        setTools(tools.map(t => 
          t.name === currentTool.name ? currentTool : t
        ));
      } else {
        // Create new tool
        await apiClient.post('/api/agentic/tools', currentTool);
        
        // Add to state
        setTools([...tools, currentTool]);
      }
      
      // Close modal and reset current tool
      onClose();
      setCurrentTool(null);
      
      toast({
        title: 'Success',
        description: `Tool ${isUpdate ? 'updated' : 'created'} successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      console.error('Error saving tool:', error);
      toast({
        title: 'Error',
        description: error.message || `Failed to ${tools.some(t => t.name === currentTool.name) ? 'update' : 'create'} tool`,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    }
  };
  
  // Delete tool
  const handleDeleteTool = async () => {
    if (!selectedTool) return;
    
    try {
      await apiClient.delete(`/api/agentic/tools/${selectedTool.name}`);
      
      // Remove from state
      setTools(tools.filter(t => t.name !== selectedTool.name));
      
      // Reset selected tool if it was deleted
      if (selectedTool && selectedTool.name === selectedTool.name) {
        setSelectedTool(null);
      }
      
      onCloseDeleteAlert();
      
      toast({
        title: 'Success',
        description: 'Tool deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      console.error('Error deleting tool:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete tool',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    }
  };
  
  // Handle field changes in tool editor
  const handleToolInputChange = (field, value) => {
    setCurrentTool({
      ...currentTool,
      [field]: value
    });
  };
  
  // Handle parameter changes
  const handleParameterChange = (paramName, field, value) => {
    const updatedParams = {...currentTool.parameters};
    
    if (!updatedParams[paramName]) {
      updatedParams[paramName] = {};
    }
    
    updatedParams[paramName][field] = value;
    
    setCurrentTool({
      ...currentTool,
      parameters: updatedParams
    });
  };
  
  // Add new parameter
  const handleAddParameter = () => {
    // Find a unique parameter name
    let i = 1;
    let paramName = `param${i}`;
    while (currentTool.parameters[paramName]) {
      i++;
      paramName = `param${i}`;
    }
    
    setCurrentTool({
      ...currentTool,
      parameters: {
        ...currentTool.parameters,
        [paramName]: {
          type: 'string',
          description: ''
        }
      }
    });
  };
  
  // Remove parameter
  const handleRemoveParameter = (paramName) => {
    const updatedParams = {...currentTool.parameters};
    delete updatedParams[paramName];
    
    setCurrentTool({
      ...currentTool,
      parameters: updatedParams
    });
  };
  
  // Prepare for tool testing
  const handleTestTool = (tool) => {
    setSelectedTool(tool);
    
    // Initialize test parameters with defaults
    const initialParams = {};
    Object.entries(tool.parameters).forEach(([key, param]) => {
      initialParams[key] = param.default !== undefined ? param.default : '';
    });
    
    setTestParameters(initialParams);
    setTestResult(null);
    onOpenTestDrawer();
  };
  
  // Execute tool test
  const handleRunToolTest = async () => {
    if (!selectedTool) return;
    
    setTestLoading(true);
    setTestResult(null);
    
    try {
      // Make API call to test the tool
      const response = await apiClient.post('/api/agentic/tools/test', {
        tool_name: selectedTool.name,
        parameters: testParameters
      });
      
      // In a real app, we would use the actual response
      // For now, mock the response
      let mockResult;
      
      if (selectedTool.name === 'web_search') {
        mockResult = {
          success: true,
          result: [
            {
              title: "Understanding AI Agents and Multi-Agent Systems",
              snippet: "AI agents are autonomous entities that can perceive their environment, make decisions, and take actions to achieve specific goals...",
              url: "https://example.com/ai-agents-guide"
            },
            {
              title: "Building Agentic AI Systems: A Practical Guide",
              snippet: "This guide introduces the concept of agentic AI and provides practical examples for implementing agent-based systems...",
              url: "https://example.com/agentic-ai-systems"
            }
          ],
          execution_time: 1.24
        };
      } else if (selectedTool.name === 'summarize_text') {
        mockResult = {
          success: true,
          result: "This is a summarized version of the provided text, highlighting the key points while maintaining the core message and essential details. The summary has been condensed to fit within the requested length constraints.",
          execution_time: 0.86
        };
      } else if (selectedTool.name === 'retrieve_information') {
        mockResult = {
          success: true,
          result: [
            {
              content: "Agentic workflows enable AI systems to make autonomous decisions about which actions to take next...",
              source: "knowledge_base/ai_agents.pdf",
              relevance_score: 0.92
            },
            {
              content: "Multi-agent systems consist of multiple interacting agents that can collaborate to solve complex problems...",
              source: "knowledge_base/multi_agent_systems.md",
              relevance_score: 0.87
            }
          ],
          execution_time: 0.54
        };
      } else if (selectedTool.name === 'execute_code') {
        mockResult = {
          success: true,
          result: {
            output: "Hello, world!\n[1, 2, 3, 4, 5]\nCalculation complete: 42",
            execution_time: 0.12
          }
        };
      } else {
        // Generic mock result
        mockResult = {
          success: true,
          result: `Mock result for ${selectedTool.name} with parameters: ${JSON.stringify(testParameters)}`,
          execution_time: Math.random() * 2
        };
      }
      
      setTestResult(mockResult);
    } catch (error) {
      console.error('Error testing tool:', error);
      setTestResult({
        success: false,
        error: error.message || 'An error occurred while testing the tool'
      });
    } finally {
      setTestLoading(false);
    }
  };
  
  // Handle test parameter changes
  const handleTestParamChange = (paramName, value) => {
    setTestParameters({
      ...testParameters,
      [paramName]: value
    });
  };
  
  // Filter tools based on search text
  const filteredTools = [...tools, ...systemTools].filter(tool => {
    if (!filterText) return true;
    
    const searchText = filterText.toLowerCase();
    return (
      tool.name.toLowerCase().includes(searchText) ||
      tool.description.toLowerCase().includes(searchText) ||
      tool.function_name.toLowerCase().includes(searchText)
    );
  });
  
  // Helper to get parameter type badge color
  const getParamTypeBadgeColor = (type) => {
    switch (type) {
      case 'string': return 'blue';
      case 'integer': return 'green';
      case 'number': return 'cyan';
      case 'boolean': return 'purple';
      case 'array': return 'orange';
      case 'object': return 'red';
      default: return 'gray';
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
        <Heading>Agentic Tools</Heading>
        <HStack>
          <Button
            leftIcon={<FiRefreshCw />}
            variant="outline"
            onClick={fetchTools}
          >
            Refresh
          </Button>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="brand"
            onClick={handleCreateTool}
          >
            Create Tool
          </Button>
        </HStack>
      </Flex>
      
      <Flex mb={6}>
        <Input
          placeholder="Search tools..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          width="300px"
          mr={4}
        />
      </Flex>
      
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        {/* Tool List */}
        <Card bg={cardBg}>
          <CardHeader>
            <Heading size="md">Available Tools</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" spacing={4} maxH="600px" overflowY="auto">
              {filteredTools.map((tool) => (
                <Card 
                  key={tool.name}
                  variant="outline"
                  cursor="pointer"
                  onClick={() => setSelectedTool(tool)}
                  borderColor={selectedTool?.name === tool.name ? 'blue.500' : 'gray.200'}
                  _hover={{ shadow: 'md' }}
                >
                  <CardBody>
                    <Flex justify="space-between" align="flex-start">
                      <VStack align="start" spacing={1}>
                        <HStack>
                          <Icon as={FiTool} color="blue.500" />
                          <Heading size="sm">{tool.name}</Heading>
                        </HStack>
                        <Text fontSize="sm" color="gray.600">
                          {tool.description}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          Function: {tool.function_name}
                        </Text>
                      </VStack>
                      
                      <HStack>
                        {systemTools.some(t => t.name === tool.name) ? (
                          <Badge colorScheme="purple">System</Badge>
                        ) : (
                          <>
                            <IconButton
                              icon={<FiEdit />}
                              aria-label="Edit tool"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTool(tool);
                              }}
                            />
                            <IconButton
                              icon={<FiTrash2 />}
                              aria-label="Delete tool"
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTool(tool);
                                onOpenDeleteAlert();
                              }}
                            />
                          </>
                        )}
                        <IconButton
                          icon={<FiPlay />}
                          aria-label="Test tool"
                          size="sm"
                          colorScheme="green"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestTool(tool);
                          }}
                        />
                      </HStack>
                    </Flex>
                  </CardBody>
                </Card>
              ))}
              
              {filteredTools.length === 0 && (
                <Flex 
                  direction="column" 
                  align="center" 
                  justify="center" 
                  py={10} 
                  borderWidth="1px" 
                  borderStyle="dashed" 
                  borderRadius="md"
                >
                  <Icon as={FiTool} fontSize="4xl" color="gray.400" mb={4} />
                  <Text color="gray.500" mb={4}>
                    No tools matching your search
                  </Text>
                </Flex>
              )}
            </VStack>
          </CardBody>
        </Card>
        
        {/* Tool Details */}
        <Card bg={cardBg}>
          <CardHeader>
            <Heading size="md">Tool Details</Heading>
          </CardHeader>
          <CardBody>
            {selectedTool ? (
              <VStack align="stretch" spacing={4}>
                <Flex justify="space-between" align="center">
                  <Heading size="md">{selectedTool.name}</Heading>
                  <HStack>
                    {selectedTool.requires_confirmation && (
                      <Badge colorScheme="yellow">Requires Confirmation</Badge>
                    )}
                    {selectedTool.always_available && (
                      <Badge colorScheme="green">Always Available</Badge>
                    )}
                  </HStack>
                </Flex>
                
                <Box>
                  <Text fontWeight="bold" mb={1}>Description</Text>
                  <Text>{selectedTool.description}</Text>
                </Box>
                
                <Box>
                  <Text fontWeight="bold" mb={1}>Function Name</Text>
                  <Code p={2} borderRadius="md">{selectedTool.function_name}</Code>
                </Box>
                
                <Box>
                  <Text fontWeight="bold" mb={2}>Parameters</Text>
                  <VStack align="stretch" spacing={2}>
                    {Object.entries(selectedTool.parameters).map(([name, param]) => (
                      <Card key={name} variant="outline" size="sm">
                        <CardBody>
                          <Flex justify="space-between" align="center" mb={1}>
                            <HStack>
                              <Text fontWeight="bold">{name}</Text>
                              <Badge colorScheme={getParamTypeBadgeColor(param.type)}>
                                {param.type}
                              </Badge>
                            </HStack>
                            {param.required === false && (
                              <Badge>Optional</Badge>
                            )}
                          </Flex>
                          
                          <Text fontSize="sm">{param.description}</Text>
                          
                          {param.default !== undefined && (
                            <Text fontSize="xs" mt={1}>
                              Default: <Code>{JSON.stringify(param.default)}</Code>
                            </Text>
                          )}
                          
                          {param.enum && (
                            <Text fontSize="xs" mt={1}>
                              Allowed values: <Code>{param.enum.join(', ')}</Code>
                            </Text>
                          )}
                        </CardBody>
                      </Card>
                    ))}
                    
                    {Object.keys(selectedTool.parameters).length === 0 && (
                      <Text color="gray.500" fontSize="sm">No parameters defined</Text>
                    )}
                  </VStack>
                </Box>
                
                <Flex justify="flex-end">
                  <Button
                    leftIcon={<FiPlay />}
                    colorScheme="green"
                    onClick={() => handleTestTool(selectedTool)}
                  >
                    Test Tool
                  </Button>
                </Flex>
              </VStack>
            ) : (
              <Flex 
                direction="column" 
                align="center" 
                justify="center" 
                height="100%"
                minH="300px"
              >
                <Icon as={FiTool} fontSize="4xl" color="gray.400" mb={4} />
                <Text color="gray.500">
                  Select a tool to view details
                </Text>
              </Flex>
            )}
          </CardBody>
        </Card>
      </SimpleGrid>
      
      {/* Tool Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {currentTool && tools.some(t => t.name === currentTool.name) 
              ? `Edit Tool: ${currentTool.name}` 
              : 'Create New Tool'}
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody>
            {currentTool && (
              <VStack align="stretch" spacing={4}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Tool Name</FormLabel>
                    <Input
                      value={currentTool.name}
                      onChange={(e) => handleToolInputChange('name', e.target.value)}
                      placeholder="e.g., web_search"
                    />
                    <FormHelperText>
                      Unique identifier for the tool (no spaces, use underscores)
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl isRequired>
                    <FormLabel>Function Name</FormLabel>
                    <Input
                      value={currentTool.function_name}
                      onChange={(e) => handleToolInputChange('function_name', e.target.value)}
                      placeholder="e.g., search_web"
                    />
                    <FormHelperText>
                      The backend function that implements this tool
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
                
                <FormControl isRequired>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={currentTool.description}
                    onChange={(e) => handleToolInputChange('description', e.target.value)}
                    placeholder="Describe what this tool does and when to use it"
                    rows={3}
                  />
                </FormControl>
                
                <Box>
                  <Flex justify="space-between" align="center" mb={2}>
                    <Heading size="sm">Parameters</Heading>
                    <Button
                      leftIcon={<FiPlus />}
                      size="sm"
                      onClick={handleAddParameter}
                    >
                      Add Parameter
                    </Button>
                  </Flex>
                  
                  {Object.entries(currentTool.parameters).map(([name, param]) => (
                    <Card key={name} mb={4} variant="outline">
                      <CardBody>
                        <Flex justify="space-between" align="center" mb={2}>
                          <Heading size="xs">{name}</Heading>
                          <IconButton
                            icon={<FiTrash2 />}
                            aria-label="Remove parameter"
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleRemoveParameter(name)}
                          />
                        </Flex>
                        
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                          <FormControl>
                            <FormLabel>Parameter Name</FormLabel>
                            <Input
                              value={name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                if (newName !== name) {
                                  const updatedParams = {...currentTool.parameters};
                                  updatedParams[newName] = updatedParams[name];
                                  delete updatedParams[name];
                                  
                                  setCurrentTool({
                                    ...currentTool,
                                    parameters: updatedParams
                                  });
                                }
                              }}
                              placeholder="e.g., query"
                            />
                          </FormControl>
                          
                          <FormControl>
                            <FormLabel>Type</FormLabel>
                            <Select
                              value={param.type || 'string'}
                              onChange={(e) => handleParameterChange(name, 'type', e.target.value)}
                            >
                              <option value="string">String</option>
                              <option value="integer">Integer</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                              <option value="array">Array</option>
                              <option value="object">Object</option>
                            </Select>
                          </FormControl>
                        </SimpleGrid>
                        
                        <FormControl mb={4}>
                          <FormLabel>Description</FormLabel>
                          <Input
                            value={param.description || ''}
                            onChange={(e) => handleParameterChange(name, 'description', e.target.value)}
                            placeholder="Describe this parameter"
                          />
                        </FormControl>
                        
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                          <FormControl display="flex" alignItems="center">
                            <FormLabel htmlFor={`required-${name}`} mb="0">
                              Required
                            </FormLabel>
                            <Switch
                              id={`required-${name}`}
                              isChecked={param.required !== false}
                              onChange={(e) => handleParameterChange(name, 'required', e.target.checked)}
                              colorScheme="blue"
                            />
                          </FormControl>
                          
                          <FormControl>
                            <FormLabel>Default Value</FormLabel>
                            <Input
                              value={param.default !== undefined ? param.default : ''}
                              onChange={(e) => {
                                let value = e.target.value;
                                
                                // Convert to appropriate type
                                if (param.type === 'integer') {
                                  value = value === '' ? undefined : parseInt(value);
                                } else if (param.type === 'number') {
                                  value = value === '' ? undefined : parseFloat(value);
                                } else if (param.type === 'boolean') {
                                  value = value === 'true';
                                }
                                
                                handleParameterChange(name, 'default', value);
                              }}
                              placeholder="Default value"
                            />
                          </FormControl>
                          
                          <FormControl>
                            <FormLabel>Enum Values</FormLabel>
                            <Input
                              value={param.enum ? param.enum.join(', ') : ''}
                              onChange={(e) => {
                                const enumStr = e.target.value;
                                if (!enumStr.trim()) {
                                  handleParameterChange(name, 'enum', undefined);
                                  return;
                                }
                                
                                const enumValues = enumStr.split(',').map(v => v.trim());
                                handleParameterChange(name, 'enum', enumValues);
                              }}
                              placeholder="comma,separated,values"
                            />
                          </FormControl>
                        </SimpleGrid>
                      </CardBody>
                    </Card>
                  ))}
                  
                  {Object.keys(currentTool.parameters).length === 0 && (
                    <Flex 
                      direction="column" 
                      align="center" 
                      justify="center" 
                      py={6}
                      borderWidth="1px"
                      borderStyle="dashed"
                      borderRadius="md"
                    >
                      <Text color="gray.500" mb={2}>No parameters defined yet</Text>
                      <Button
                        leftIcon={<FiPlus />}
                        size="sm"
                        onClick={handleAddParameter}
                      >
                        Add Parameter
                      </Button>
                    </Flex>
                  )}
                </Box>
                
                <Divider />
                
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="requires-confirmation" mb="0">
                      Requires Confirmation
                    </FormLabel>
                    <Switch
                      id="requires-confirmation"
                      isChecked={currentTool.requires_confirmation}
                      onChange={(e) => handleToolInputChange('requires_confirmation', e.target.checked)}
                      colorScheme="blue"
                    />
                  </FormControl>
                  
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="always-available" mb="0">
                      Always Available
                    </FormLabel>
                    <Switch
                      id="always-available"
                      isChecked={currentTool.always_available !== false}
                      onChange={(e) => handleToolInputChange('always_available', e.target.checked)}
                      colorScheme="blue"
                    />
                  </FormControl>
                </SimpleGrid>
              </VStack>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleSaveTool}
            >
              Save Tool
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Tool Test Drawer */}
      <Drawer
        isOpen={isTestDrawerOpen}
        placement="right"
        onClose={onCloseTestDrawer}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            Test Tool: {selectedTool?.name}
          </DrawerHeader>
          
          <DrawerBody>
            {selectedTool && (
              <VStack align="stretch" spacing={4}>
                <Text>{selectedTool.description}</Text>
                
                <Divider />
                
                <Heading size="sm" mb={2}>Parameters</Heading>
                
                {Object.entries(selectedTool.parameters).map(([name, param]) => (
                  <FormControl key={name} mb={4}>
                    <FormLabel>
                      {name}
                      <Badge ml={2} colorScheme={getParamTypeBadgeColor(param.type)}>
                        {param.type}
                      </Badge>
                      {param.required === false && (
                        <Badge ml={2}>Optional</Badge>
                      )}
                    </FormLabel>
                    
                    {param.type === 'boolean' ? (
                      <Switch
                        isChecked={testParameters[name] === true}
                        onChange={(e) => handleTestParamChange(name, e.target.checked)}
                        colorScheme="blue"
                      />
                    ) : param.type === 'integer' || param.type === 'number' ? (
                      <Input
                        type="number"
                        value={testParameters[name] || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' 
                            ? '' 
                            : param.type === 'integer' 
                              ? parseInt(e.target.value) 
                              : parseFloat(e.target.value);
                          handleTestParamChange(name, value);
                        }}
                        placeholder={param.description}
                      />
                    ) : param.enum ? (
                      <Select
                        value={testParameters[name] || ''}
                        onChange={(e) => handleTestParamChange(name, e.target.value)}
                      >
                        <option value="">Select a value...</option>
                        {param.enum.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </Select>
                    ) : param.type === 'array' || param.type === 'object' ? (
                      <Textarea
                        value={typeof testParameters[name] === 'object' 
                          ? JSON.stringify(testParameters[name], null, 2) 
                          : testParameters[name] || ''}
                        onChange={(e) => {
                          try {
                            const value = JSON.parse(e.target.value);
                            handleTestParamChange(name, value);
                          } catch (error) {
                            // Allow invalid JSON during editing
                            handleTestParamChange(name, e.target.value);
                          }
                        }}
                        placeholder={`Enter ${param.type} as JSON`}
                        rows={4}
                      />
                    ) : (
                      <Input
                        value={testParameters[name] || ''}
                        onChange={(e) => handleTestParamChange(name, e.target.value)}
                        placeholder={param.description}
                      />
                    )}
                    
                    <FormHelperText>
                      {param.description}
                    </FormHelperText>
                  </FormControl>
                ))}
                
                <Button
                  leftIcon={<FiPlay />}
                  colorScheme="green"
                  onClick={handleRunToolTest}
                  isLoading={testLoading}
                  loadingText="Testing..."
                  mb={6}
                  size="lg"
                  width="full"
                >
                  Run Test
                </Button>
                
                {testResult && (
                  <Card variant={testResult.success ? 'outline' : 'filled'} mb={4}>
                    <CardHeader bg={testResult.success ? 'green.50' : 'red.50'}>
                      <HStack>
                        <Icon 
                          as={testResult.success ? FiCheck : FiX} 
                          color={testResult.success ? 'green.500' : 'red.500'} 
                        />
                        <Heading size="sm">
                          {testResult.success ? 'Success' : 'Error'}
                        </Heading>
                      </HStack>
                    </CardHeader>
                    <CardBody>
                      {testResult.success ? (
                        <Box>
                          <Text fontWeight="bold" mb={2}>Result:</Text>
                          <Code p={3} borderRadius="md" display="block" whiteSpace="pre-wrap">
                            {typeof testResult.result === 'object' 
                              ? JSON.stringify(testResult.result, null, 2) 
                              : testResult.result}
                          </Code>
                          
                          {testResult.execution_time && (
                            <Text fontSize="sm" mt={2} color="gray.500">
                              Execution time: {testResult.execution_time.toFixed(2)}s
                            </Text>
                          )}
                        </Box>
                      ) : (
                        <Box>
                          <Text fontWeight="bold" mb={2}>Error:</Text>
                          <Text color="red.500">{testResult.error}</Text>
                        </Box>
                      )}
                    </CardBody>
                  </Card>
                )}
              </VStack>
            )}
          </DrawerBody>
          
          <DrawerFooter>
            <Button variant="outline" mr={3} onClick={onCloseTestDrawer}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onCloseDeleteAlert}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Tool
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete the tool "{selectedTool?.name}"? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onCloseDeleteAlert}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteTool} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default AgenticToolsManager;
