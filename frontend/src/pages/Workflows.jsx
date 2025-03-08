/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  Text,
  Flex,
  Stack,
  HStack,
  VStack,
  Badge,
  Icon,
  SimpleGrid,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  useDisclosure,
  useToast,
  IconButton,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tooltip
} from '@chakra-ui/react';
import { 
  FiPlus, FiSearch, FiPlay, FiCpu, FiList, FiMoreVertical, 
  FiTrash2, FiEdit, FiEye, FiClock, FiActivity, FiCheckCircle, 
  FiAlertCircle, FiFilter, FiRefreshCw
} from 'react-icons/fi';

// Status badge component
const StatusBadge = ({ status }) => {
  const statusColors = {
    running: 'blue',
    completed: 'green',
    failed: 'red',
    pending: 'yellow',
    created: 'gray'
  };
  
  return (
    <Badge colorScheme={statusColors[status] || 'gray'} borderRadius="full" px={2}>
      {status}
    </Badge>
  );
};

const Workflows = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isAlertOpen,
    onOpen: onAlertOpen,
    onClose: onAlertClose
  } = useDisclosure();
  
  // State
  const [workflows, setWorkflows] = useState([]);
  const [filteredWorkflows, setFilteredWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteWorkflowId, setDeleteWorkflowId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    template_id: '',
    config: {}
  });
  const [runWorkflowData, setRunWorkflowData] = useState({
    workflow_id: '',
    input_data: {
      query: ''
    }
  });
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const cancelRef = React.useRef();
  
  // Check if we should open the create modal with a specific template
  useEffect(() => {
    // Move this inside
    const queryParams = new URLSearchParams(location.search);
    
    const templateId = queryParams.get('templateId');
    if (templateId) {
      setNewWorkflow(prev => ({
        ...prev,
        template_id: templateId
      }));
      onOpen();
      // Clear the query parameter
      navigate('/workflows', { replace: true });
    }
  }, [location, navigate, onOpen]);
  
  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Apply search and status filters
  useEffect(() => {
    if (workflows.length > 0) {
      let filtered = [...workflows];
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          workflow => 
            workflow.name.toLowerCase().includes(query) ||
            (workflow.description && workflow.description.toLowerCase().includes(query))
        );
      }
      
      // Apply status filter
      if (statusFilter) {
        filtered = filtered.filter(workflow => workflow.status === statusFilter);
      }
      
      setFilteredWorkflows(filtered);
    }
  }, [workflows, searchQuery, statusFilter]);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch templates
      const templatesResponse = await fetch('/api/templates');
      if (!templatesResponse.ok) {
        throw new Error('Failed to fetch templates');
      }
      const templatesData = await templatesResponse.json();
      setTemplates(templatesData);
      
      // Fetch workflows
      const workflowsResponse = await fetch('/api/workflows');
      if (!workflowsResponse.ok) {
        throw new Error('Failed to fetch workflows');
      }
      const workflowsData = await workflowsResponse.json();
      setWorkflows(workflowsData);
      setFilteredWorkflows(workflowsData);
      
      // Fetch recent executions
      const executionsResponse = await fetch('/api/workflow-executions/recent?limit=10');
      if (!executionsResponse.ok) {
        throw new Error('Failed to fetch executions');
      }
      const executionsData = await executionsResponse.json();
      setExecutions(executionsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, []); // Include any dependencies it needs
  
  const handleCreateWorkflow = async () => {
    // Validate fields
    if (!newWorkflow.name || !newWorkflow.template_id) {
      toast({
        title: 'Validation Error',
        description: 'Workflow name and template are required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newWorkflow),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create workflow');
      }
      
      const createdWorkflow = await response.json();
      
      // Reset form
      setNewWorkflow({
        name: '',
        description: '',
        template_id: '',
        config: {}
      });
      
      // Close modal
      onClose();
      
      // Refresh workflows
      fetchData();
      
      toast({
        title: 'Success',
        description: 'Workflow created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const handleDeleteWorkflow = async () => {
    if (!deleteWorkflowId) return;
    
    try {
      const response = await fetch(`/api/workflows/${deleteWorkflowId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }
      
      // Remove from state
      setWorkflows(workflows.filter(w => w.id !== deleteWorkflowId));
      
      toast({
        title: 'Success',
        description: 'Workflow deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setDeleteWorkflowId(null);
      onAlertClose();
    }
  };
  
  const openRunWorkflowModal = (workflow) => {
    setRunWorkflowData({
      workflow_id: workflow.id,
      input_data: {
        query: ''
      }
    });
    setIsRunModalOpen(true);
  };
  
  const handleRunWorkflow = async () => {
    try {
      const response = await fetch('/api/workflow-executions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(runWorkflowData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to run workflow');
      }
      
      const executionData = await response.json();
      
      // Close modal
      setIsRunModalOpen(false);
      
      toast({
        title: 'Success',
        description: 'Workflow execution started',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Navigate to execution view
      navigate(`/workflows/${runWorkflowData.workflow_id}/execution/${executionData.id}`);
    } catch (error) {
      console.error('Error running workflow:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const confirmDeleteWorkflow = (id) => {
    setDeleteWorkflowId(id);
    onAlertOpen();
  };
  
  const getTemplateNameById = (id) => {
    const template = templates.find(t => t.id === id);
    return template ? template.name : 'Unknown Template';
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
        <Heading>Workflows</Heading>
        <HStack>
          <Button
            leftIcon={<FiRefreshCw />}
            variant="outline"
            onClick={fetchData}
          >
            Refresh
          </Button>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="brand"
            onClick={onOpen}
          >
            Create Workflow
          </Button>
        </HStack>
      </Flex>
      
      {/* Filters */}
      <Flex mb={6} gap={4}>
        <InputGroup maxW="400px">
          <InputLeftElement pointerEvents="none">
            <FiSearch color="gray.300" />
          </InputLeftElement>
          <Input
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        
        <Select
          placeholder="All statuses"
          maxW="200px"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="created">Created</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </Select>
      </Flex>
      
      {/* Workflows List */}
      {filteredWorkflows.length > 0 ? (
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={8}>
          {filteredWorkflows.map((workflow) => (
            <Card key={workflow.id} boxShadow="md" _hover={{ boxShadow: 'lg' }}>
              <CardBody>
                <Flex direction="column" height="100%">
                  <Flex justify="space-between" align="flex-start" mb={2}>
                    <StatusBadge status={workflow.status} />
                    
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
                          onClick={() => openRunWorkflowModal(workflow)}
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
                          icon={<FiTrash2 />} 
                          color="red.500"
                          onClick={() => confirmDeleteWorkflow(workflow.id)}
                        >
                          Delete
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
                      <Icon as={FiCpu} color="gray.500" />
                      <Text fontSize="sm" color="gray.500">
                        {getTemplateNameById(workflow.template_id)}
                      </Text>
                    </HStack>
                    
                    <Button
                      rightIcon={<FiPlay />}
                      size="sm"
                      colorScheme="brand"
                      onClick={() => openRunWorkflowModal(workflow)}
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
          <Icon as={FiList} fontSize="4xl" color="gray.400" mb={4} />
          <Text color="gray.500" mb={4}>
            {workflows.length === 0 
              ? 'No workflows available. Create your first workflow to get started.' 
              : 'No workflows match your filters.'}
          </Text>
          {workflows.length === 0 && (
            <Button 
              colorScheme="brand" 
              leftIcon={<FiPlus />}
              onClick={onOpen}
            >
              Create New Workflow
            </Button>
          )}
        </Flex>
      )}
      
      {/* Recent Executions */}
      <Box mt={8}>
        <Heading size="md" mb={4}>Recent Executions</Heading>
        
        {executions.length > 0 ? (
          <Card>
            <CardBody>
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Workflow</Th>
                    <Th>Status</Th>
                    <Th>Started</Th>
                    <Th>Duration</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {executions.map((execution) => (
                    <Tr key={execution.id}>
                      <Td>
                        {workflows.find(w => w.id === execution.workflow_id)?.name || 'Unknown'}
                      </Td>
                      <Td><StatusBadge status={execution.status} /></Td>
                      <Td>{new Date(execution.started_at).toLocaleString()}</Td>
                      <Td>
                        {execution.completed_at 
                          ? Math.round((new Date(execution.completed_at) - new Date(execution.started_at)) / 1000) + 's'
                          : 'In progress'}
                      </Td>
                      <Td>
                        <Tooltip label="View Execution">
                          <IconButton
                            icon={<FiEye />}
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/workflows/${execution.workflow_id}/execution/${execution.id}`)}
                            aria-label="View execution"
                          />
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
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
            <Icon as={FiClock} fontSize="4xl" color="gray.400" mb={4} />
            <Text color="gray.500">No recent executions found</Text>
          </Flex>
        )}
      </Box>
      
      {/* Create Workflow Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Workflow</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={4} isRequired>
              <FormLabel>Workflow Name</FormLabel>
              <Input
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow({...newWorkflow, name: e.target.value})}
                placeholder="e.g. Research Assistant"
              />
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={newWorkflow.description}
                onChange={(e) => setNewWorkflow({...newWorkflow, description: e.target.value})}
                placeholder="Describe what this workflow does"
                rows={3}
              />
            </FormControl>
            
            <FormControl mb={4} isRequired>
              <FormLabel>Template</FormLabel>
              <Select
                value={newWorkflow.template_id}
                onChange={(e) => setNewWorkflow({...newWorkflow, template_id: e.target.value})}
                placeholder="Select template"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.workflow_type})
                  </option>
                ))}
              </Select>
            </FormControl>
          </ModalBody>
          
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="brand" onClick={handleCreateWorkflow}>
              Create Workflow
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Run Workflow Modal */}
      <Modal isOpen={isRunModalOpen} onClose={() => setIsRunModalOpen(false)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Run Workflow</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel>Input Query</FormLabel>
              <Textarea
                value={runWorkflowData.input_data.query}
                onChange={(e) => setRunWorkflowData({
                  ...runWorkflowData, 
                  input_data: {...runWorkflowData.input_data, query: e.target.value}
                })}
                placeholder="Enter the input query for the workflow"
                rows={5}
              />
              <Text fontSize="sm" color="gray.500" mt={1}>
                This will be passed to the workflow as the input query.
              </Text>
            </FormControl>
          </ModalBody>
          
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setIsRunModalOpen(false)}>
              Cancel
            </Button>
            <Button colorScheme="brand" onClick={handleRunWorkflow}>
              Run Workflow
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onAlertClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Workflow
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this workflow? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onAlertClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteWorkflow} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default Workflows;
