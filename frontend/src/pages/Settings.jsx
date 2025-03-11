/* eslint-disable no-unused-vars */
import apiClient from '../services/api';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Select,
  Switch,
  VStack,
  HStack,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Divider,
  useToast,
  SimpleGrid,
  Spinner,
  Flex,
  Textarea,
  Icon,
  InputGroup,
  InputRightElement,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Code
} from '@chakra-ui/react';
import { FiSave, FiEye, FiEyeOff, FiPlus, FiTrash2, FiInfo, FiX, FiCheck } from 'react-icons/fi';

const Settings = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState({
    apiKeys: {
      vertexAI: {
        enabled: true,
        projectId: '',
        location: 'us-central1',
        apiEndpoint: ''
      },
      openAI: {
        enabled: false,
        apiKey: ''
      },
      anthropic: {
        enabled: false,
        apiKey: ''
      }
    },
    tools: {
      webSearch: {
        enabled: true,
        provider: 'google',
        apiKey: ''
      },
      codeExecution: {
        enabled: true,
        timeoutSeconds: 30,
        maxMemoryMB: 512
      },
      dataAnalysis: {
        enabled: true
      }
    },
    system: {
      logLevel: 'info',
      maxConcurrentExecutions: 5,
      defaultCheckpointDir: './checkpoints',
      maxExecutionTimeMinutes: 30,
      cleanupOldExecutions: true,
      cleanupThresholdDays: 7
    }
  });
  
  // State for showing/hiding API keys
  const [showKeys, setShowKeys] = useState({
    openAI: false,
    anthropic: false,
    webSearch: false
  });
  
  // Custom tools state
  const [customTools, setCustomTools] = useState([
    {
      name: 'pdf_extractor',
      description: 'Extract text from PDF files',
      function_name: 'extract_pdf_text',
      parameters: {
        file_path: {
          type: 'string',
          description: 'Path to the PDF file'
        },
        page_numbers: {
          type: 'array',
          items: {
            type: 'integer'
          },
          description: 'Optional page numbers to extract (all pages if empty)'
        }
      }
    }
  ]);
  
  // Fetch settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // This would use the API client instead
        const settingsData = await apiClient.get('/api/settings');
        setSettings(settingsData);
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load settings',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [toast]);
  
  const handleSettingsChange = (category, key, value) => {
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value
      }
    });
  };
  
  const handleNestedSettingsChange = (category, subcategory, key, value) => {
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [subcategory]: {
          ...settings[category][subcategory],
          [key]: value
        }
      }
    });
  };
  
  const addCustomTool = () => {
    setCustomTools([
      ...customTools,
      {
        name: '',
        description: '',
        function_name: '',
        parameters: {}
      }
    ]);
  };
  
  const updateCustomTool = (index, field, value) => {
    const updatedTools = [...customTools];
    updatedTools[index][field] = value;
    setCustomTools(updatedTools);
  };
  
  const deleteCustomTool = (index) => {
    setCustomTools(customTools.filter((_, i) => i !== index));
  };
  
  const saveSettings = async () => {
    setSaving(true);
    
    try {
      // This would be replaced with an actual API call
      await apiClient.put('/api/settings', settings);
      
      toast({
        title: 'Settings saved',
        description: 'Your settings have been updated successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };
  
  const toggleShowKey = (provider) => {
    setShowKeys({
      ...showKeys,
      [provider]: !showKeys[provider]
    });
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
        <Heading>Settings</Heading>
        <Button
          leftIcon={<FiSave />}
          colorScheme="brand"
          onClick={saveSettings}
          isLoading={saving}
        >
          Save Settings
        </Button>
      </Flex>
      
      <Tabs colorScheme="brand">
        <TabList>
          <Tab>Model Providers</Tab>
          <Tab>Tools</Tab>
          <Tab>System</Tab>
          <Tab>Advanced</Tab>
        </TabList>
        
        <TabPanels>
          {/* Model Providers Tab */}
          <TabPanel p={0} pt={4}>
            <Card mb={6}>
              <CardHeader>
                <Heading size="md">Vertex AI</Heading>
              </CardHeader>
              <CardBody>
                <FormControl mb={4} display="flex" alignItems="center">
                  <FormLabel mb={0}>Enable Vertex AI</FormLabel>
                  <Switch
                    isChecked={settings.apiKeys.vertexAI.enabled}
                    onChange={(e) => handleNestedSettingsChange('apiKeys', 'vertexAI', 'enabled', e.target.checked)}
                  />
                </FormControl>
                
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isDisabled={!settings.apiKeys.vertexAI.enabled}>
                    <FormLabel>Project ID</FormLabel>
                    <Input
                      value={settings.apiKeys.vertexAI.projectId}
                      onChange={(e) => handleNestedSettingsChange('apiKeys', 'vertexAI', 'projectId', e.target.value)}
                    />
                  </FormControl>
                  
                  <FormControl isDisabled={!settings.apiKeys.vertexAI.enabled}>
                    <FormLabel>Location</FormLabel>
                    <Select
                      value={settings.apiKeys.vertexAI.location}
                      onChange={(e) => handleNestedSettingsChange('apiKeys', 'vertexAI', 'location', e.target.value)}
                    >
                      <option value="us-central1">us-central1</option>
                      <option value="us-east1">us-east1</option>
                      <option value="us-west1">us-west1</option>
                      <option value="europe-west4">europe-west4</option>
                      <option value="asia-east1">asia-east1</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
                
                <FormControl mt={4} isDisabled={!settings.apiKeys.vertexAI.enabled}>
                  <FormLabel>API Endpoint (Optional)</FormLabel>
                  <Input
                    value={settings.apiKeys.vertexAI.apiEndpoint}
                    onChange={(e) => handleNestedSettingsChange('apiKeys', 'vertexAI', 'apiEndpoint', e.target.value)}
                    placeholder="Leave empty to use the default endpoint"
                  />
                  <FormHelperText>
                    Custom endpoint for Vertex AI API (e.g., for private endpoints)
                  </FormHelperText>
                </FormControl>
              </CardBody>
            </Card>
            
            <Card mb={6}>
              <CardHeader>
                <Heading size="md">OpenAI</Heading>
              </CardHeader>
              <CardBody>
                <FormControl mb={4} display="flex" alignItems="center">
                  <FormLabel mb={0}>Enable OpenAI</FormLabel>
                  <Switch
                    isChecked={settings.apiKeys.openAI.enabled}
                    onChange={(e) => handleNestedSettingsChange('apiKeys', 'openAI', 'enabled', e.target.checked)}
                  />
                </FormControl>
                
                <FormControl isDisabled={!settings.apiKeys.openAI.enabled}>
                  <FormLabel>API Key</FormLabel>
                  <InputGroup>
                    <Input
                      type={showKeys.openAI ? 'text' : 'password'}
                      value={settings.apiKeys.openAI.apiKey}
                      onChange={(e) => handleNestedSettingsChange('apiKeys', 'openAI', 'apiKey', e.target.value)}
                      placeholder="Enter your OpenAI API key"
                    />
                    <InputRightElement>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleShowKey('openAI')}
                      >
                        <Icon as={showKeys.openAI ? FiEyeOff : FiEye} />
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                  <FormHelperText>
                    Your OpenAI API key is stored securely
                  </FormHelperText>
                </FormControl>
              </CardBody>
            </Card>
            
            <Card>
              <CardHeader>
                <Heading size="md">Anthropic</Heading>
              </CardHeader>
              <CardBody>
                <FormControl mb={4} display="flex" alignItems="center">
                  <FormLabel mb={0}>Enable Anthropic</FormLabel>
                  <Switch
                    isChecked={settings.apiKeys.anthropic.enabled}
                    onChange={(e) => handleNestedSettingsChange('apiKeys', 'anthropic', 'enabled', e.target.checked)}
                  />
                </FormControl>
                
                <FormControl isDisabled={!settings.apiKeys.anthropic.enabled}>
                  <FormLabel>API Key</FormLabel>
                  <InputGroup>
                    <Input
                      type={showKeys.anthropic ? 'text' : 'password'}
                      value={settings.apiKeys.anthropic.apiKey}
                      onChange={(e) => handleNestedSettingsChange('apiKeys', 'anthropic', 'apiKey', e.target.value)}
                      placeholder="Enter your Anthropic API key"
                    />
                    <InputRightElement>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleShowKey('anthropic')}
                      >
                        <Icon as={showKeys.anthropic ? FiEyeOff : FiEye} />
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                  <FormHelperText>
                    Your Anthropic API key is stored securely
                  </FormHelperText>
                </FormControl>
              </CardBody>
            </Card>
          </TabPanel>
          
          {/* Tools Tab */}
          <TabPanel p={0} pt={4}>
            <Card mb={6}>
              <CardHeader>
                <Heading size="md">Web Search Tool</Heading>
              </CardHeader>
              <CardBody>
                <FormControl mb={4} display="flex" alignItems="center">
                  <FormLabel mb={0}>Enable Web Search</FormLabel>
                  <Switch
                    isChecked={settings.tools.webSearch.enabled}
                    onChange={(e) => handleNestedSettingsChange('tools', 'webSearch', 'enabled', e.target.checked)}
                  />
                </FormControl>
                
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isDisabled={!settings.tools.webSearch.enabled}>
                    <FormLabel>Provider</FormLabel>
                    <Select
                      value={settings.tools.webSearch.provider}
                      onChange={(e) => handleNestedSettingsChange('tools', 'webSearch', 'provider', e.target.value)}
                    >
                      <option value="google">Google Search</option>
                      <option value="bing">Bing Search</option>
                      <option value="serpapi">SerpAPI</option>
                    </Select>
                  </FormControl>
                  
                  <FormControl isDisabled={!settings.tools.webSearch.enabled}>
                    <FormLabel>API Key</FormLabel>
                    <InputGroup>
                      <Input
                        type={showKeys.webSearch ? 'text' : 'password'}
                        value={settings.tools.webSearch.apiKey}
                        onChange={(e) => handleNestedSettingsChange('tools', 'webSearch', 'apiKey', e.target.value)}
                        placeholder="Enter your Search API key"
                      />
                      <InputRightElement>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleShowKey('webSearch')}
                        >
                          <Icon as={showKeys.webSearch ? FiEyeOff : FiEye} />
                        </Button>
                      </InputRightElement>
                    </InputGroup>
                  </FormControl>
                </SimpleGrid>
              </CardBody>
            </Card>
            
            <Card mb={6}>
              <CardHeader>
                <Heading size="md">Code Execution Tool</Heading>
              </CardHeader>
              <CardBody>
                <FormControl mb={4} display="flex" alignItems="center">
                  <FormLabel mb={0}>Enable Code Execution</FormLabel>
                  <Switch
                    isChecked={settings.tools.codeExecution.enabled}
                    onChange={(e) => handleNestedSettingsChange('tools', 'codeExecution', 'enabled', e.target.checked)}
                  />
                </FormControl>
                
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isDisabled={!settings.tools.codeExecution.enabled}>
                    <FormLabel>Timeout (Seconds)</FormLabel>
                    <Input
                      type="number"
                      value={settings.tools.codeExecution.timeoutSeconds}
                      onChange={(e) => handleNestedSettingsChange('tools', 'codeExecution', 'timeoutSeconds', parseInt(e.target.value))}
                      min={1}
                      max={300}
                    />
                    <FormHelperText>
                      Maximum execution time for code (1-300 seconds)
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl isDisabled={!settings.tools.codeExecution.enabled}>
                    <FormLabel>Memory Limit (MB)</FormLabel>
                    <Input
                      type="number"
                      value={settings.tools.codeExecution.maxMemoryMB}
                      onChange={(e) => handleNestedSettingsChange('tools', 'codeExecution', 'maxMemoryMB', parseInt(e.target.value))}
                      min={128}
                      max={2048}
                    />
                    <FormHelperText>
                      Maximum memory usage for code execution (128-2048 MB)
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
              </CardBody>
            </Card>
            
            <Card mb={6}>
              <CardHeader>
                <Heading size="md">Data Analysis Tool</Heading>
              </CardHeader>
              <CardBody>
                <FormControl mb={4} display="flex" alignItems="center">
                  <FormLabel mb={0}>Enable Data Analysis</FormLabel>
                  <Switch
                    isChecked={settings.tools.dataAnalysis.enabled}
                    onChange={(e) => handleNestedSettingsChange('tools', 'dataAnalysis', 'enabled', e.target.checked)}
                  />
                </FormControl>
                
                <Text color="gray.600" fontSize="sm">
                  The data analysis tool allows agents to analyze CSV, JSON, and Excel files using pandas.
                </Text>
              </CardBody>
            </Card>
            
            <Card>
              <CardHeader>
                <Flex justify="space-between" align="center">
                  <Heading size="md">Custom Tools</Heading>
                  <Button
                    leftIcon={<FiPlus />}
                    size="sm"
                    onClick={addCustomTool}
                  >
                    Add Tool
                  </Button>
                </Flex>
              </CardHeader>
              <CardBody>
                {customTools.length > 0 ? (
                  <VStack spacing={4} align="stretch">
                    {customTools.map((tool, index) => (
                      <Accordion key={index} allowToggle>
                        <AccordionItem border="1px" borderColor="gray.200" borderRadius="md">
                          <h2>
                            <AccordionButton>
                              <Flex flex="1" justifyContent="space-between" alignItems="center">
                                <Text fontWeight="medium">
                                  {tool.name || `New Tool ${index + 1}`}
                                </Text>
                                <Button
                                  size="sm"
                                  colorScheme="red"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCustomTool(index);
                                  }}
                                >
                                  <FiTrash2 />
                                </Button>
                              </Flex>
                              <AccordionIcon />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4}>
                            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                              <FormControl isRequired>
                                <FormLabel>Tool Name</FormLabel>
                                <Input
                                  value={tool.name}
                                  onChange={(e) => updateCustomTool(index, 'name', e.target.value)}
                                  placeholder="e.g. web_search"
                                />
                                <FormHelperText>
                                  Unique identifier for the tool
                                </FormHelperText>
                              </FormControl>
                              
                              <FormControl isRequired>
                                <FormLabel>Function Name</FormLabel>
                                <Input
                                  value={tool.function_name}
                                  onChange={(e) => updateCustomTool(index, 'function_name', e.target.value)}
                                  placeholder="e.g. search_web"
                                />
                                <FormHelperText>
                                  Name of the function that implements this tool
                                </FormHelperText>
                              </FormControl>
                            </SimpleGrid>
                            
                            <FormControl mb={4} isRequired>
                              <FormLabel>Description</FormLabel>
                              <Textarea
                                value={tool.description}
                                onChange={(e) => updateCustomTool(index, 'description', e.target.value)}
                                placeholder="Describe what this tool does and when to use it"
                                rows={2}
                              />
                            </FormControl>
                            
                            <FormControl>
                              <FormLabel>Parameters</FormLabel>
                              <Code p={3} borderRadius="md" w="100%" display="block" whiteSpace="pre" mb={2}>
                                {JSON.stringify(tool.parameters, null, 2)}
                              </Code>
                              <FormHelperText>
                                Edit JSON directly for parameters
                              </FormHelperText>
                            </FormControl>
                          </AccordionPanel>
                        </AccordionItem>
                      </Accordion>
                    ))}
                  </VStack>
                ) : (
                  <Flex 
                    direction="column" 
                    align="center" 
                    justify="center" 
                    py={6}
                    borderWidth="1px"
                    borderStyle="dashed"
                    borderColor="gray.200"
                    borderRadius="md"
                  >
                    <Text color="gray.500" mb={4}>No custom tools defined yet</Text>
                    <Button
                      leftIcon={<FiPlus />}
                      onClick={addCustomTool}
                      size="sm"
                    >
                      Add Custom Tool
                    </Button>
                  </Flex>
                )}
              </CardBody>
            </Card>
          </TabPanel>
          
          {/* System Tab */}
          <TabPanel p={0} pt={4}>
            <Card mb={6}>
              <CardHeader>
                <Heading size="md">System Settings</Heading>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <FormControl>
                    <FormLabel>Log Level</FormLabel>
                    <Select
                      value={settings.system.logLevel}
                      onChange={(e) => handleNestedSettingsChange('system', '', 'logLevel', e.target.value)}
                    >
                      <option value="debug">Debug</option>
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </Select>
                    <FormHelperText>
                      Controls the verbosity of application logs
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Max Concurrent Executions</FormLabel>
                    <Input
                      type="number"
                      value={settings.system.maxConcurrentExecutions}
                      onChange={(e) => handleNestedSettingsChange('system', '', 'maxConcurrentExecutions', parseInt(e.target.value))}
                      min={1}
                      max={20}
                    />
                    <FormHelperText>
                      Maximum number of workflows that can run simultaneously
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Default Checkpoint Directory</FormLabel>
                    <Input
                      value={settings.system.defaultCheckpointDir}
                      onChange={(e) => handleNestedSettingsChange('system', '', 'defaultCheckpointDir', e.target.value)}
                    />
                    <FormHelperText>
                      Directory to store workflow execution checkpoints
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Max Execution Time (Minutes)</FormLabel>
                    <Input
                      type="number"
                      value={settings.system.maxExecutionTimeMinutes}
                      onChange={(e) => handleNestedSettingsChange('system', '', 'maxExecutionTimeMinutes', parseInt(e.target.value))}
                      min={1}
                      max={120}
                    />
                    <FormHelperText>
                      Maximum allowed runtime for any workflow execution
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
                
                <Divider my={6} />
                
                <FormControl mb={4} display="flex" alignItems="center">
                  <FormLabel mb={0}>Cleanup Old Executions</FormLabel>
                  <Switch
                    isChecked={settings.system.cleanupOldExecutions}
                    onChange={(e) => handleNestedSettingsChange('system', '', 'cleanupOldExecutions', e.target.checked)}
                  />
                </FormControl>
                
                <FormControl isDisabled={!settings.system.cleanupOldExecutions}>
                  <FormLabel>Cleanup Threshold (Days)</FormLabel>
                  <Input
                    type="number"
                    value={settings.system.cleanupThresholdDays}
                    onChange={(e) => handleNestedSettingsChange('system', '', 'cleanupThresholdDays', parseInt(e.target.value))}
                    min={1}
                    max={365}
                  />
                  <FormHelperText>
                    Delete execution records older than this many days
                  </FormHelperText>
                </FormControl>
              </CardBody>
            </Card>
          </TabPanel>
          
          {/* Advanced Tab */}
          <TabPanel p={0} pt={4}>
            <Card mb={6}>
              <CardHeader>
                <Heading size="md">Advanced Settings</Heading>
              </CardHeader>
              <CardBody>
                <Text mb={4} color="orange.500">
                  <Icon as={FiInfo} mr={2} />
                  These settings are for advanced users. Incorrect values may cause system instability.
                </Text>
                
                <Accordion allowToggle>
                  <AccordionItem>
                    <h2>
                      <AccordionButton>
                        <Box flex="1" textAlign="left" fontWeight="medium">
                          LangChain Configuration
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      <Text mb={2} fontWeight="medium">Environment Variables</Text>
                      <Table variant="simple" size="sm" mb={4}>
                        <Thead>
                          <Tr>
                            <Th>Key</Th>
                            <Th>Value</Th>
                            <Th>Active</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          <Tr>
                            <Td>LANGCHAIN_TRACING</Td>
                            <Td>true</Td>
                            <Td><Icon as={FiCheck} color="green.500" /></Td>
                          </Tr>
                          <Tr>
                            <Td>LANGCHAIN_PROJECT</Td>
                            <Td>agentic-ai-service</Td>
                            <Td><Icon as={FiCheck} color="green.500" /></Td>
                          </Tr>
                          <Tr>
                            <Td>LANGCHAIN_ENDPOINT</Td>
                            <Td>http://localhost:8000</Td>
                            <Td><Icon as={FiX} color="red.500" /></Td>
                          </Tr>
                        </Tbody>
                      </Table>
                      
                      <FormControl mb={4}>
                        <FormLabel>Custom LangChain Handler</FormLabel>
                        <Select>
                          <option value="default">Default Handler</option>
                          <option value="console">Console Handler</option>
                          <option value="wandb">Weights & Biases</option>
                          <option value="mlflow">MLflow</option>
                          <option value="custom">Custom Handler</option>
                        </Select>
                      </FormControl>
                    </AccordionPanel>
                  </AccordionItem>
                  
                  <AccordionItem>
                    <h2>
                      <AccordionButton>
                        <Box flex="1" textAlign="left" fontWeight="medium">
                          LangGraph Configuration
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      <FormControl mb={4}>
                        <FormLabel>Default State Type</FormLabel>
                        <Select>
                          <option value="dict">Dictionary</option>
                          <option value="pydantic">Pydantic Model</option>
                        </Select>
                        <FormHelperText>
                          Default state type for new workflows
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl mb={4}>
                        <FormLabel>Persistence Strategy</FormLabel>
                        <Select>
                          <option value="json">JSON Checkpoint</option>
                          <option value="sqlite">SQLite</option>
                          <option value="redis">Redis</option>
                        </Select>
                        <FormHelperText>
                          How to persist workflow state between steps
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb={0}>Enable Thread Worker Pool</FormLabel>
                        <Switch />
                      </FormControl>
                    </AccordionPanel>
                  </AccordionItem>
                  
                  <AccordionItem>
                    <h2>
                      <AccordionButton>
                        <Box flex="1" textAlign="left" fontWeight="medium">
                          API & Database Settings
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      <FormControl mb={4}>
                        <FormLabel>Database URL</FormLabel>
                        <Input
                          placeholder="sqlite:///./agentic_ai_service.db"
                        />
                        <FormHelperText>
                          SQLAlchemy connection string for database
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl mb={4}>
                        <FormLabel>API Host</FormLabel>
                        <Input
                          placeholder="0.0.0.0"
                        />
                      </FormControl>
                      
                      <FormControl mb={4}>
                        <FormLabel>API Port</FormLabel>
                        <Input
                          type="number"
                          placeholder="8000"
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb={0}>Enable CORS</FormLabel>
                        <Switch defaultChecked />
                      </FormControl>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
                
                <Divider my={6} />
                
                <Box>
                  <Heading size="sm" mb={4}>Export / Import Settings</Heading>
                  <HStack spacing={4}>
                    <Button variant="outline">Export Settings</Button>
                    <Button variant="outline">Import Settings</Button>
                  </HStack>
                </Box>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Settings;
