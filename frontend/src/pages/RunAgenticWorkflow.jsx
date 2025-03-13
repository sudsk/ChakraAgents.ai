// frontend/src/pages/RunAgenticWorkflow.jsx
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
  HStack,
  VStack,
  Badge,
  Input,
  Textarea,
  FormControl,
  FormLabel,
  FormHelperText,
  SimpleGrid,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Select,
  IconButton,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Switch,
  Spinner,
  useToast,
  useColorModeValue
} from '@chakra-ui/react';
import { 
  FiPlay, 
  FiArrowLeft, 
  FiInfo, 
  FiCpu, 
  FiTool, 
  FiSliders, 
  FiUpload,
  FiFile,
  FiTrash2,
  FiSettings,
  FiDatabase
} from 'react-icons/fi';
import apiClient from '../services/api';

const RunAgenticWorkflow = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [executionId, setExecutionId] = useState(null);
  
  const [workflow, setWorkflow] = useState(null);
  const [template, setTemplate] = useState(null);
  const [executionOptions, setExecutionOptions] = useState({
    input_data: {
      query: ""
    },
    options: {
      max_iterations: null,
      override_agent_decisions: false,
      verbose_logging: true,
      checkpoint: true
    }
  });
  
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  const cardBg = useColorModeValue('white', 'gray.800');
  
  // Fetch workflow data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch workflow
        const workflowData = await apiClient.get(`/api/workflows/${workflowId}`);
        setWorkflow(workflowData);
        
        // Fetch template
        if (workflowData?.template_id) {
          const templateData = await apiClient.get(`/api/templates/${workflowData.template_id}`);
          setTemplate(templateData);
          
          // Pre-populate execution options based on template settings
          if (templateData?.config?.workflow_config) {
            setExecutionOptions(prev => ({
              ...prev,
              options: {
                ...prev.options,
                max_iterations: templateData.config.workflow_config.max_iterations || prev.options.max_iterations
              }
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching workflow data:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load workflow',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        navigate('/workflows');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workflowId, navigate, toast]);
  
  // Check execution progress
  useEffect(() => {
    let timer;
    
    if (executing && executionId) {
      timer = setInterval(async () => {
        try {
          const executionData = await apiClient.get(`/api/agentic-workflows/executions/${executionId}`);
          
          if (executionData?.status === 'completed' || 
              executionData?.status === 'failed' || 
              executionData?.status === 'canceled') {
            
            setExecuting(false);
            clearInterval(timer);
            
            // Navigate to execution results page
            navigate(`/workflows/${workflowId}/execution/${executionId}`);
            
            toast({
              title: `Execution ${executionData.status}`,
              description: executionData.status === 'completed' 
                ? 'Workflow execution completed successfully' 
                : 'Workflow execution ended',
              status: executionData.status === 'completed' ? 'success' : 'info',
              duration: 5000,
              isClosable: true,
            });
          } else {
            // Update progress based on execution data
            // This is a simplified approach - in a real app, you'd calculate this
            // based on completion percentage or steps completed
            setProgress(prev => Math.min(prev + 5, 90));
          }
        } catch (error) {
          console.error('Error checking execution status:', error);
        }
      }, 2000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [executing, executionId, workflowId, navigate, toast]);
  
  const handleInputChange = (e) => {
    const { value } = e.target;
    setExecutionOptions(prev => ({
      ...prev,
      input_data: {
        ...prev.input_data,
        query: value
      }
    }));
  };
  
  const handleOptionChange = (key, value) => {
    setExecutionOptions(prev => ({
      ...prev,
      options: {
        ...prev.options,
        [key]: value
      }
    }));
  };
  
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };
  
  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const runWorkflow = async () => {
    if (!executionOptions.input_data.query.trim()) {
      toast({
        title: 'Input Required',
        description: 'Please enter a query or task for the agents',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setExecuting(true);
    setProgress(10);
    
    try {
      // Upload files if necessary
      let fileReferences = [];
      if (uploadedFiles.length > 0) {
        fileReferences = await uploadFilesToKnowledgeBase();
      }
      
      // Add file references to input data if available
      const inputData = {
        ...executionOptions.input_data,
        ...(fileReferences.length > 0 && { files: fileReferences })
      };
      
      // Create execution
      const executionData = await apiClient.post('/api/agentic-workflows/executions', {
        workflow_id: workflowId,
        input_data: inputData,
        options: executionOptions.options
      });
      
      setExecutionId(executionData.id);
      setProgress(20);
      
      toast({
        title: 'Execution Started',
        description: 'Your agentic workflow is now running',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      
    } catch (error) {
      console.error('Error starting workflow execution:', error);
      setExecuting(false);
      
      toast({
        title: 'Execution Failed',
        description: error.message || 'Failed to start workflow execution',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const uploadFilesToKnowledgeBase = async () => {
    const fileReferences = [];
    
    try {
      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Upload to knowledge base
        const response = await fetch(`${apiClient.baseUrl}/api/documents/upload`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload file: ${file.name}`);
        }
        
        const data = await response.json();
        fileReferences.push({
          filename: file.name,
          reference_id: data.reference_id,
          mime_type: file.type
        });
      }
      
      return fileReferences;
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Upload Error',
        description: error.message || 'Failed to upload files',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      return [];
    }
  };
  
  const hasRagCapabilities = () => {
    if (!template) return false;
    
    // Direct RAG template
    if (template.workflow_type === 'rag') return true;
    
    // RAG enabled in config
    if (template.config?.rag_enabled === true) return true;
    
    // Check for RAG tools in agents
    if (template.workflow_type === 'supervisor') {
      const workers = template.config?.workers || [];
      return workers.some(worker => 
        worker.tools && worker.tools.includes('retrieve_information')
      );
    }
    
    return false;
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
          <Heading>Run Agentic Workflow</Heading>
        </HStack>
        
        {workflow && (
          <Badge colorScheme="purple" p={2} borderRadius="md">
            <HStack>
              <FiCpu />
              <Text>{workflow.name}</Text>
            </HStack>
          </Badge>
        )}
      </Flex>
      
      {executing ? (
        <Card bg={cardBg} mb={6}>
          <CardBody>
            <VStack spacing={6} align="stretch">
              <Heading size="md" mb={2}>Workflow Execution in Progress</Heading>
              
              <Progress value={progress} size="lg" colorScheme="blue" borderRadius="md" />
              
              <Text>
                Your agentic workflow is currently running. You will be redirected to the results page when execution completes.
              </Text>
              
              <Text fontSize="sm" color="gray.500">
                Execution ID: {executionId}
              </Text>
              
              <Button 
                leftIcon={<FiArrowLeft />} 
                onClick={() => navigate('/workflows')}
                alignSelf="flex-start"
              >
                Back to Workflows
              </Button>
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={6}>
            {/* Input Query Section */}
            <Card bg={cardBg}>
              <CardHeader>
                <Heading size="md">Input Query</Heading>
              </CardHeader>
              <CardBody>
                <FormControl mb={4}>
                  <FormLabel>Query or Task</FormLabel>
                  <Textarea
                    value={executionOptions.input_data.query}
                    onChange={handleInputChange}
                    placeholder="Enter your query or task for the agentic workflow"
                    rows={8}
                  />
                  <FormHelperText>
                    Provide clear instructions to guide the agent's behavior
                  </FormHelperText>
                </FormControl>
                
                <Button
                  leftIcon={<FiPlay />}
                  colorScheme="brand"
                  size="lg"
                  width="full"
                  onClick={runWorkflow}
                  isDisabled={!executionOptions.input_data.query.trim()}
                >
                  Run Workflow
                </Button>
              </CardBody>
            </Card>
            
            {/* Workflow Details */}
            <Card bg={cardBg}>
              <CardHeader>
                <Heading size="md">Workflow Details</Heading>
              </CardHeader>
              <CardBody>
                {workflow && template ? (
                  <VStack align="stretch" spacing={4}>
                    <Box>
                      <Text fontWeight="bold" mb={1}>Description</Text>
                      <Text>{workflow.description || 'No description provided'}</Text>
                    </Box>
                    
                    <Divider />
                    
                    <Box>
                      <Text fontWeight="bold" mb={1}>Agents</Text>
                      <SimpleGrid columns={2} spacing={2}>
                        {template.workflow_type === 'supervisor' && (
                          <>
                            <Box>
                              <Badge colorScheme="blue" mb={1}>Supervisor</Badge>
                              <Text fontSize="sm">{template.config.supervisor?.name || 'Supervisor'}</Text>
                            </Box>
                            
                            {template.config.workers?.map((worker, idx) => (
                              <Box key={idx}>
                                <Badge colorScheme="green" mb={1}>{worker.role || 'Worker'}</Badge>
                                <Text fontSize="sm">{worker.name}</Text>
                              </Box>
                            ))}
                          </>
                        )}
                        
                        {template.workflow_type === 'swarm' && 
                          template.config.agents?.map((agent, idx) => (
                            <Box key={idx}>
                              <Badge colorScheme="purple" mb={1}>{agent.role || 'Agent'}</Badge>
                              <Text fontSize="sm">{agent.name}</Text>
                            </Box>
                          ))
                        }
                        
                        {template.workflow_type === 'rag' && (
                          <Box>
                            <Badge colorScheme="teal" mb={1}>RAG Assistant</Badge>
                            <Text fontSize="sm">Knowledge-Enhanced AI</Text>
                          </Box>
                        )}
                      </SimpleGrid>
                    </Box>
                    
                    <Divider />
                    
                    <Box>
                      <Text fontWeight="bold" mb={1}>Available Tools</Text>
                      <Flex wrap="wrap" gap={2}>
                        {template.config.tools?.map((tool, idx) => (
                          <Badge key={idx} colorScheme="orange">
                            {tool.name}
                          </Badge>
                        ))}
                        
                        {(!template.config.tools || template.config.tools.length === 0) && (
                          <Text fontSize="sm" color="gray.500">No tools configured</Text>
                        )}
                      </Flex>
                    </Box>
                  </VStack>
                ) : (
                  <Text>No workflow details available</Text>
                )}
              </CardBody>
            </Card>
          </SimpleGrid>
          
          {/* Advanced Options & File Upload */}
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
            {/* File Upload Section */}
            {hasRagCapabilities() && (
              <Card bg={cardBg}>
                <CardHeader>
                  <Heading size="md">
                    <HStack>
                      <FiDatabase />
                      <Text>Knowledge Files</Text>
                    </HStack>
                  </Heading>
                </CardHeader>
                <CardBody>
                  <Text mb={4}>
                    Upload files to provide additional context to the agents. These files will be processed and made available through the knowledge retrieval system.
                  </Text>
                  
                  <FormControl mb={4}>
                    <FormLabel>Upload Files</FormLabel>
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      p={1}
                      accept=".pdf,.txt,.csv,.docx,.md"
                    />
                    <FormHelperText>
                      Supported formats: PDF, TXT, CSV, DOCX, Markdown
                    </FormHelperText>
                  </FormControl>
                  
                  {uploadedFiles.length > 0 && (
                    <Box mt={4}>
                      <Text fontWeight="bold" mb={2}>Uploaded Files ({uploadedFiles.length})</Text>
                      <VStack align="stretch" spacing={2} maxH="200px" overflowY="auto">
                        {uploadedFiles.map((file, idx) => (
                          <Flex key={idx} justify="space-between" align="center" p={2} borderWidth="1px" borderRadius="md">
                            <HStack>
                              <FiFile />
                              <Text fontSize="sm">{file.name}</Text>
                              <Badge>{(file.size / 1024).toFixed(1)} KB</Badge>
                            </HStack>
                            <IconButton
                              icon={<FiTrash2 />}
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => removeFile(idx)}
                              aria-label="Remove file"
                            />
                          </Flex>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </CardBody>
              </Card>
            )}
            
            {/* Advanced Options */}
            <Card bg={cardBg}>
              <CardHeader>
                <HStack justify="space-between">
                  <Heading size="md">
                    <HStack>
                      <FiSettings />
                      <Text>Execution Options</Text>
                    </HStack>
                  </Heading>
                  <Switch
                    isChecked={showAdvancedOptions}
                    onChange={(e) => setShowAdvancedOptions(e.target.checked)}
                    colorScheme="brand"
                  />
                </HStack>
              </CardHeader>
              <CardBody>
                {showAdvancedOptions ? (
                  <Accordion allowToggle defaultIndex={0}>
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left" fontWeight="medium">
                          Iteration Settings
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <FormControl mb={4}>
                          <FormLabel>Max Iterations</FormLabel>
                          <Input
                            type="number"
                            value={executionOptions.options.max_iterations || ''}
                            onChange={(e) => handleOptionChange('max_iterations', parseInt(e.target.value))}
                            placeholder="Default from template"
                          />
                          <FormHelperText>
                            Maximum number of decision cycles (leave empty for template default)
                          </FormHelperText>
                        </FormControl>
                      </AccordionPanel>
                    </AccordionItem>
                    
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left" fontWeight="medium">
                          Agent Decision Control
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <FormControl display="flex" alignItems="center" mb={4}>
                          <FormLabel htmlFor="override-decisions" mb="0">
                            Override Agent Decisions
                          </FormLabel>
                          <Switch
                            id="override-decisions"
                            isChecked={executionOptions.options.override_agent_decisions}
                            onChange={(e) => handleOptionChange('override_agent_decisions', e.target.checked)}
                            colorScheme="brand"
                          />
                        </FormControl>
                        <FormHelperText>
                          When enabled, the execution graph will override agent decisions about delegation
                        </FormHelperText>
                      </AccordionPanel>
                    </AccordionItem>
                    
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left" fontWeight="medium">
                          Logging & Debugging
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <FormControl display="flex" alignItems="center" mb={4}>
                          <FormLabel htmlFor="verbose-logging" mb="0">
                            Verbose Logging
                          </FormLabel>
                          <Switch
                            id="verbose-logging"
                            isChecked={executionOptions.options.verbose_logging}
                            onChange={(e) => handleOptionChange('verbose_logging', e.target.checked)}
                            colorScheme="brand"
                          />
                        </FormControl>
                        
                        <FormControl display="flex" alignItems="center">
                          <FormLabel htmlFor="enable-checkpoint" mb="0">
                            Create Checkpoints
                          </FormLabel>
                          <Switch
                            id="enable-checkpoint"
                            isChecked={executionOptions.options.checkpoint}
                            onChange={(e) => handleOptionChange('checkpoint', e.target.checked)}
                            colorScheme="brand"
                          />
                        </FormControl>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                ) : (
                  <Alert status="info" borderRadius="md">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Using Default Settings</AlertTitle>
                      <AlertDescription>
                        Enable advanced options to customize execution parameters
                      </AlertDescription>
                    </Box>
                  </Alert>
                )}
              </CardBody>
            </Card>
          </SimpleGrid>
        </>
      )}
    </Box>
  );
};

export default RunAgenticWorkflow;
