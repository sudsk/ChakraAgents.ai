import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Textarea,
  Switch,
  VStack,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
  IconButton,
  Divider,
  Alert,
  AlertIcon,
  useToast,
  Code,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Select,
  Spinner,
  SimpleGrid,
  Checkbox,
  useColorModeValue
} from '@chakra-ui/react';
import { 
  FiPlus, 
  FiTrash2, 
  FiTool, 
  FiSave, 
  FiPlay, 
  FiAward, 
  FiCode, 
  FiInfo, 
  FiSettings,
  FiEdit,
  FiCheckSquare,
  FiSearch,
  FiDatabase,
  FiRefreshCw
} from 'react-icons/fi';

// Tool parameter form component
const ToolParameterForm = ({ 
  parameter = {}, 
  paramName = '', 
  onChange, 
  onDelete 
}) => {
  const [name, setName] = useState(paramName);
  const [type, setType] = useState(parameter.type || 'string');
  const [description, setDescription] = useState(parameter.description || '');
  const [required, setRequired] = useState(parameter.required !== false);
  const [defaultValue, setDefaultValue] = useState(parameter.default || '');
  const [enumValues, setEnumValues] = useState(parameter.enum ? parameter.enum.join(', ') : '');
  
  // Update parent when values change
  useEffect(() => {
    if (!onChange) return;
    
    const parameterData = {
      type,
      description,
      required
    };
    
    // Add default value if provided
    if (defaultValue !== '') {
      // Convert default value to appropriate type
      if (type === 'integer' || type === 'number') {
        parameterData.default = Number(defaultValue);
      } else if (type === 'boolean') {
        parameterData.default = defaultValue === 'true';
      } else {
        parameterData.default = defaultValue;
      }
    }
    
    // Add enum values if provided
    if (enumValues.trim()) {
      try {
        const enumArray = enumValues.split(',').map(val => {
          const trimmed = val.trim();
          if (type === 'integer' || type === 'number') {
            return Number(trimmed);
          } else if (type === 'boolean') {
            return trimmed === 'true';
          }
          return trimmed;
        });
        
        parameterData.enum = enumArray;
      } catch (error) {
        console.error('Error parsing enum values:', error);
      }
    }
    
    onChange(name, parameterData);
  }, [name, type, description, required, defaultValue, enumValues, onChange]);
  
  return (
    <Card mb={4} borderWidth="1px" borderColor="gray.200">
      <CardBody>
        <HStack justify="space-between" mb={4}>
          <Heading size="sm">Parameter: {name}</Heading>
          {onDelete && (
            <IconButton
              icon={<FiTrash2 />}
              variant="ghost"
              colorScheme="red"
              aria-label="Delete parameter"
              onClick={onDelete}
            />
          )}
        </HStack>
        
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
          <FormControl isRequired>
            <FormLabel>Parameter Name</FormLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. query"
            />
          </FormControl>
          
          <FormControl isRequired>
            <FormLabel>Type</FormLabel>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
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
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this parameter does"
            rows={2}
          />
        </FormControl>
        
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <FormControl display="flex" alignItems="center">
            <FormLabel htmlFor="required" mb="0">
              Required
            </FormLabel>
            <Switch
              id="required"
              isChecked={required}
              onChange={(e) => setRequired(e.target.checked)}
              colorScheme="blue"
            />
          </FormControl>
          
          <FormControl>
            <FormLabel>Default Value</FormLabel>
            <Input
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder={type === 'boolean' ? 'true or false' : 'Default value'}
            />
          </FormControl>
          
          <FormControl>
            <FormLabel>Enum Values</FormLabel>
            <Input
              value={enumValues}
              onChange={(e) => setEnumValues(e.target.value)}
              placeholder="Comma-separated values"
            />
            <FormHelperText>
              Comma-separated list of allowed values
            </FormHelperText>
          </FormControl>
        </SimpleGrid>
      </CardBody>
    </Card>
  );
};

// Tool test console component
const ToolTestConsole = ({ tool, onTest }) => {
  const [parameters, setParameters] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();
  
  // Initialize parameters based on tool definition
  useEffect(() => {
    if (!tool || !tool.parameters) return;
    
    const initialParams = {};
    
    Object.entries(tool.parameters).forEach(([name, param]) => {
      // Use default value if available
      if (param.default !== undefined) {
        initialParams[name] = param.default;
      } else if (param.type === 'boolean') {
        initialParams[name] = false;
      } else if (param.type === 'integer' || param.type === 'number') {
        initialParams[name] = 0;
      } else if (param.type === 'array') {
        initialParams[name] = [];
      } else if (param.type === 'object') {
        initialParams[name] = {};
      } else {
        initialParams[name] = '';
      }
    });
    
    setParameters(initialParams);
  }, [tool]);
  
  // Handle parameter change
  const handleParameterChange = (name, value) => {
    setParameters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Test the tool
  const handleTest = async () => {
    if (!onTest) return;
    
    setLoading(true);
    setResult(null);
    setError(null);
    
    try {
      const result = await onTest(tool.name, parameters);
      setResult(result);
    } catch (error) {
      console.error('Error testing tool:', error);
      setError(error.message || 'An error occurred while testing the tool');
      
      toast({
        title: 'Test Failed',
        description: error.message || 'An error occurred while testing the tool',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (!tool) return null;
  
  return (
    <Box mb={4}>
      <Heading size="md" mb={4}>Test Tool: {tool.name}</Heading>
      
      <VStack align="stretch" spacing={4} mb={6}>
        {tool.parameters && Object.entries(tool.parameters).map(([name, param]) => (
          <FormControl key={name}>
            <FormLabel>{name}{param.required !== false && ' *'}</FormLabel>
            
            {param.type === 'boolean' ? (
              <Switch
                isChecked={!!parameters[name]}
                onChange={(e) => handleParameterChange(name, e.target.checked)}
                colorScheme="blue"
              />
            ) : param.enum ? (
              <Select
                value={parameters[name] || ''}
                onChange={(e) => handleParameterChange(name, e.target.value)}
              >
                {param.enum.map((value, index) => (
                  <option key={index} value={value}>{value}</option>
                ))}
              </Select>
            ) : param.type === 'object' || param.type === 'array' ? (
              <Textarea
                value={JSON.stringify(parameters[name] || (param.type === 'array' ? [] : {}), null, 2)}
                onChange={(e) => {
                  try {
                    handleParameterChange(name, JSON.parse(e.target.value));
                  } catch (error) {
                    // Keep the string value even if it's invalid JSON
                    // This allows users to fix JSON errors while typing
                  }
                }}
                placeholder={`Enter ${param.type === 'object' ? 'JSON object' : 'JSON array'}`}
                rows={4}
                fontFamily="monospace"
              />
            ) : (
              <Input
                value={parameters[name] || ''}
                onChange={(e) => {
                  // Convert to appropriate type
                  let value = e.target.value;
                  if (param.type === 'integer') {
                    value = value === '' ? '' : parseInt(value);
                  } else if (param.type === 'number') {
                    value = value === '' ? '' : parseFloat(value);
                  }
                  handleParameterChange(name, value);
                }}
                type={param.type === 'integer' || param.type === 'number' ? 'number' : 'text'}
                placeholder={param.description}
              />
            )}
            
            {param.description && (
              <FormHelperText>
                {param.description}
              </FormHelperText>
            )}
          </FormControl>
        ))}
      </VStack>
      
      <Button
        colorScheme="blue"
        leftIcon={<FiPlay />}
        onClick={handleTest}
        isLoading={loading}
        loadingText="Running"
      >
        Run Tool
      </Button>
      
      {result && (
        <Box mt={6}>
          <Heading size="sm" mb={2}>Result:</Heading>
          <Box
            p={3}
            borderWidth="1px"
            borderRadius="md"
            bg="gray.50"
            fontFamily="monospace"
            whiteSpace="pre-wrap"
            overflowX="auto"
          >
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </Box>
        </Box>
      )}
      
      {error && (
        <Alert status="error" mt={6}>
          <AlertIcon />
          {error}
        </Alert>
      )}
    </Box>
  );
};

// Main tool configuration component
const ToolConfigurationInterface = ({ 
  tools = [], 
  onSave, 
  onTest,
  loading = false,
  systemTools = []
}) => {
  const [selectedTool, setSelectedTool] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedTool, setEditedTool] = useState(null);
  const [filter, setFilter] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  const cardBg = useColorModeValue('white', 'gray.800');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  
  // Create a new tool
  const createNewTool = () => {
    const newTool = {
      name: `tool_${Date.now()}`,
      description: 'New tool description',
      function_name: 'new_tool_function',
      parameters: {
        param1: {
          type: 'string',
          description: 'Parameter description',
          required: true
        }
      },
      requires_confirmation: false,
      always_available: true
    };
    
    setEditedTool(newTool);
    setEditMode(true);
    onOpen();
  };
  
  // Edit an existing tool
  const editTool = (tool) => {
    setEditedTool({ ...tool });
    setEditMode(true);
    onOpen();
  };
  
  // Update parameter
  const handleParameterChange = (paramName, paramData) => {
    if (!editedTool) return;
    
    setEditedTool(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [paramName]: paramData
      }
    }));
  };
  
  // Add new parameter
  const addParameter = () => {
    if (!editedTool) return;
    
    // Find a unique parameter name
    let i = 1;
    let paramName = `param${i}`;
    while (editedTool.parameters && editedTool.parameters[paramName]) {
      i++;
      paramName = `param${i}`;
    }
    
    setEditedTool(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [paramName]: {
          type: 'string',
          description: '',
          required: true
        }
      }
    }));
  };
  
  // Delete parameter
  const deleteParameter = (paramName) => {
    if (!editedTool || !editedTool.parameters) return;
    
    const newParameters = { ...editedTool.parameters };
    delete newParameters[paramName];
    
    setEditedTool(prev => ({
      ...prev,
      parameters: newParameters
    }));
  };
  
  // Save tool changes
  const saveToolChanges = () => {
    if (!editedTool || !onSave) return;
    
    // Validate tool data
    if (!editedTool.name || !editedTool.function_name) {
      toast({
        title: 'Validation Error',
        description: 'Tool name and function name are required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    // Make sure there's at least one parameter
    if (!editedTool.parameters || Object.keys(editedTool.parameters).length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Tool must have at least one parameter',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    onSave(editedTool);
    setEditMode(false);
    onClose();
  };
  
  // Filter tools based on search
  const filteredTools = [...tools, ...systemTools].filter(tool => 
    filter === '' || 
    tool.name.toLowerCase().includes(filter.toLowerCase()) ||
    tool.description.toLowerCase().includes(filter.toLowerCase())
  );
  
  return (
    <Box>
      <HStack mb={6} justify="space-between">
        <Heading size="lg">Tools Configuration</Heading>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="blue"
          onClick={createNewTool}
        >
          Create Tool
        </Button>
      </HStack>
      
      <FormControl mb={6}>
        <Input
          placeholder="Search tools..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          leftElement={<Box pl={2}><FiSearch color="gray.300" /></Box>}
        />
      </FormControl>
      
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        <Box>
          <Heading size="md" mb={4}>Available Tools</Heading>
          
          {loading ? (
            <Flex justify="center" py={10}>
              <Spinner size="xl" color="blue.500" />
            </Flex>
          ) : filteredTools.length > 0 ? (
            <VStack align="stretch" spacing={4}>
              {filteredTools.map((tool, index) => (
                <Card 
                  key={index} 
                  cursor="pointer" 
                  onClick={() => setSelectedTool(tool)}
                  bg={selectedTool === tool ? 'blue.50' : cardBg}
                  borderWidth="1px"
                  borderColor={selectedTool === tool ? 'blue.300' : 'gray.200'}
                  _hover={{ shadow: 'md' }}
                >
                  <CardBody>
                    <HStack justify="space-between" mb={2}>
                      <HStack>
                        <FiTool color="blue.500" />
                        <Heading size="sm">{tool.name}</Heading>
                      </HStack>
                      
                      {systemTools.includes(tool) ? (
                        <Badge colorScheme="purple">System Tool</Badge>
                      ) : (
                        <IconButton
                          icon={<FiEdit />}
                          aria-label="Edit tool"
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            editTool(tool);
                          }}
                        />
                      )}
                    </HStack>
                    
                    <Text fontSize="sm" noOfLines={2}>{tool.description}</Text>
                    
                    {tool.parameters && (
                      <HStack mt={2}>
                        <Text fontSize="xs" color="gray.500">Parameters:</Text>
                        <Text fontSize="xs" color="gray.500">
                          {Object.keys(tool.parameters).join(', ')}
                        </Text>
                      </HStack>
                    )}
                  </CardBody>
                </Card>
              ))}
            </VStack>
          ) : (
            <Card p={6} textAlign="center">
              <VStack spacing={4}>
                <Box fontSize="xl" color="gray.400">
                  <FiTool />
                </Box>
                <Text color="gray.500">No tools found</Text>
                <Button size="sm" leftIcon={<FiPlus />} onClick={createNewTool}>
                  Create Tool
                </Button>
              </VStack>
            </Card>
          )}
        </Box>
        
        <Box>
          {selectedTool ? (
            <Card>
              <CardHeader bg={headerBg}>
                <HStack justify="space-between">
                  <Heading size="md">Tool Details</Heading>
                  
                  {!systemTools.includes(selectedTool) && (
                    <IconButton
                      icon={<FiEdit />}
                      aria-label="Edit tool"
                      variant="ghost"
                      onClick={() => editTool(selectedTool)}
                    />
                  )}
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={6}>
                  <Box>
                    <Heading size="sm" mb={2}>Description</Heading>
                    <Text>{selectedTool.description}</Text>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Heading size="sm" mb={2}>Function Details</Heading>
                    <HStack mb={2}>
                      <Text fontWeight="bold" minWidth="120px">Function Name:</Text>
                      <Text>{selectedTool.function_name}</Text>
                    </HStack>
                    
                    <HStack mb={2}>
                      <Text fontWeight="bold" minWidth="120px">Requires Confirmation:</Text>
                      <Badge colorScheme={selectedTool.requires_confirmation ? "orange" : "green"}>
                        {selectedTool.requires_confirmation ? "Yes" : "No"}
                      </Badge>
                    </HStack>
                    
                    <HStack>
                      <Text fontWeight="bold" minWidth="120px">Always Available:</Text>
                      <Badge colorScheme={selectedTool.always_available !== false ? "green" : "orange"}>
                        {selectedTool.always_available !== false ? "Yes" : "No"}
                      </Badge>
                    </HStack>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Heading size="sm" mb={2}>Parameters</Heading>
                    {selectedTool.parameters && Object.entries(selectedTool.parameters).length > 0 ? (
                      <VStack align="stretch" spacing={2}>
                        {Object.entries(selectedTool.parameters).map(([name, param]) => (
                          <Card key={name} size="sm" variant="outline">
                            <CardBody>
                              <HStack mb={1}>
                                <Text fontWeight="bold">{name}</Text>
                                <Badge>{param.type}</Badge>
                                {param.required === false && (
                                  <Badge colorScheme="yellow">Optional</Badge>
                                )}
                              </HStack>
                              
                              {param.description && (
                                <Text fontSize="sm" color="gray.600">{param.description}</Text>
                              )}
                              
                              {param.enum && (
                                <HStack mt={1} fontSize="sm">
                                  <Text fontWeight="bold">Allowed values:</Text>
                                  <Text>{param.enum.join(', ')}</Text>
                                </HStack>
                              )}
                              
                              {param.default !== undefined && (
                                <HStack mt={1} fontSize="sm">
                                  <Text fontWeight="bold">Default:</Text>
                                  <Text>{JSON.stringify(param.default)}</Text>
                                </HStack>
                              )}
                            </CardBody>
                          </Card>
                        ))}
                      </VStack>
                    ) : (
                      <Text color="gray.500">No parameters defined</Text>
                    )}
                  </Box>
                  
                  <Divider />
                  
                  <ToolTestConsole tool={selectedTool} onTest={onTest} />
                </VStack>
              </CardBody>
            </Card>
          ) : (
            <Card p={6} height="100%" display="flex" alignItems="center" justifyContent="center">
              <VStack spacing={4}>
                <Box fontSize="xl" color="gray.400">
                  <FiInfo />
                </Box>
                <Text color="gray.500">Select a tool to view details</Text>
              </VStack>
            </Card>
          )}
        </Box>
      </SimpleGrid>
      
      {/* Tool Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editMode ? 'Edit Tool' : 'Tool Details'}
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody>
            {editedTool && (
              <VStack align="stretch" spacing={4}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Tool Name</FormLabel>
                    <Input
                      value={editedTool.name}
                      onChange={(e) => setEditedTool({ ...editedTool, name: e.target.value })}
                      placeholder="e.g. web_search"
                    />
                  </FormControl>
                  
                  <FormControl isRequired>
                    <FormLabel>Function Name</FormLabel>
                    <Input
                      value={editedTool.function_name}
                      onChange={(e) => setEditedTool({ ...editedTool, function_name: e.target.value })}
                      placeholder="e.g. search_web"
                    />
                  </FormControl>
                </SimpleGrid>
                
                <FormControl isRequired>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={editedTool.description}
                    onChange={(e) => setEditedTool({ ...editedTool, description: e.target.value })}
                    placeholder="Describe what this tool does"
                    rows={3}
                  />
                </FormControl>
                
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="requires-confirmation" mb="0">
                      Requires Confirmation
                    </FormLabel>
                    <Switch
                      id="requires-confirmation"
                      isChecked={editedTool.requires_confirmation}
                      onChange={(e) => setEditedTool({ ...editedTool, requires_confirmation: e.target.checked })}
                      colorScheme="blue"
                    />
                  </FormControl>
                  
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="always-available" mb="0">
                      Always Available
                    </FormLabel>
                    <Switch
                      id="always-available"
                      isChecked={editedTool.always_available !== false}
                      onChange={(e) => setEditedTool({ ...editedTool, always_available: e.target.checked })}
                      colorScheme="blue"
                    />
                  </FormControl>
                </SimpleGrid>
                
                <Divider my={2} />
                
                <HStack justify="space-between">
                  <Heading size="md">Parameters</Heading>
                  <Button
                    leftIcon={<FiPlus />}
                    size="sm"
                    onClick={addParameter}
                  >
                    Add Parameter
                  </Button>
                </HStack>
                
                {editedTool.parameters && Object.entries(editedTool.parameters).map(([name, param]) => (
                  <ToolParameterForm
                    key={name}
                    paramName={name}
                    parameter={param}
                    onChange={handleParameterChange}
                    onDelete={() => deleteParameter(name)}
                  />
                ))}
                
                {(!editedTool.parameters || Object.keys(editedTool.parameters).length === 0) && (
                  <Alert status="info">
                    <AlertIcon />
                    No parameters defined yet. Click "Add Parameter" to add one.
                  </Alert>
                )}
              </VStack>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={saveToolChanges}
              leftIcon={<FiSave />}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ToolConfigurationInterface;
