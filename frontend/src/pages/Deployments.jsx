// frontend/src/pages/Deployments.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  Text,
  HStack,
  VStack,
  SimpleGrid,
  Badge,
  Spinner,
  Input,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Select,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useDisclosure,
  useToast,
  Code,
  Icon,
  Tooltip,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Textarea,
  InputGroup,
  InputRightElement,
  Divider
} from '@chakra-ui/react';
import {
  FiPlus,
  FiPlay,
  FiGrid,
  FiCopy,
  FiLayers,
  FiTrash2,
  FiCode,
  FiLink,
  FiGlobe,
  FiKey,
  FiActivity,
  FiPackage,
  FiEye,
  FiEyeOff,
  FiRefreshCw
} from 'react-icons/fi';
import apiClient from '../services/api';

const Deployments = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [deployments, setDeployments] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [showApiKey, setShowApiKey] = useState({});
  const [newDeployment, setNewDeployment] = useState({
    workflow_id: '',
    version: 'v1',
    description: ''
  });
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    events: ['completed', 'failed']
  });
  const [newApiKey, setNewApiKey] = useState({
    name: ''
  });
  const [stats, setStats] = useState(null);
  
  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch deployments
      const deploymentsData = await apiClient.get('/api/deployments');
      setDeployments(deploymentsData);
      
      // Fetch workflows for selection
      const workflowsData = await apiClient.get('/api/workflows');
      setWorkflows(workflowsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load deployments',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch deployment details
  const fetchDeploymentDetails = async (deploymentId) => {
    try {
      // Fetch webhooks and API keys
      // In a real implementation, these would be separate API calls
      // For now, simulate with mock data
      setWebhooks([
        {
          id: '1',
          url: 'https://example.com/webhook',
          events: ['completed', 'failed'],
          created_at: new Date().toISOString()
        }
      ]);
      
      setApiKeys([
        {
          id: '1',
          name: 'Production API Key',
          created_at: new Date().toISOString()
        }
      ]);
      
      // Fetch stats
      const statsData = await apiClient.get(`/api/deployments/${deploymentId}/stats`);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching deployment details:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load deployment details',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, []);
  
  // Fetch details when deployment is selected
  useEffect(() => {
    if (selectedDeployment) {
      fetchDeploymentDetails(selectedDeployment.id);
    }
  }, [selectedDeployment]);
  
  // Create new deployment
  const handleCreateDeployment = async () => {
    try {
      const result = await apiClient.post('/api/deployments', newDeployment);
      
      // Add to state
      setDeployments([...deployments, result]);
      
      // Reset form
      setNewDeployment({
        workflow_id: '',
        version: 'v1',
        description: ''
      });
      
      // Close modal
      onClose();
      
      toast({
        title: 'Success',
        description: 'Deployment created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Select the new deployment
      setSelectedDeployment(result);
    } catch (error) {
      console.error('Error creating deployment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create deployment',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Create new webhook
  const handleCreateWebhook = async () => {
    if (!selectedDeployment) return;
    
    try {
      const result = await apiClient.post(`/api/deployments/${selectedDeployment.id}/webhooks`, newWebhook);
      
      // Add to state
      setWebhooks([...webhooks, result]);
      
      // Reset form
      setNewWebhook({
        url: '',
        events: ['completed', 'failed']
      });
      
      toast({
        title: 'Success',
        description: 'Webhook created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create webhook',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Create new API key
  const handleCreateApiKey = async () => {
    if (!selectedDeployment) return;
    
    try {
      const result = await apiClient.post(`/api/deployments/${selectedDeployment.id}/apikeys`, newApiKey);
      
      // Add to state
      setApiKeys([...apiKeys, result]);
      
      // Show the new API key
      setShowApiKey({
        ...showApiKey,
        [result.id]: true
      });
      
      // Reset form
      setNewApiKey({
        name: ''
      });
      
      toast({
        title: 'Success',
        description: 'API key created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create API key',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Delete deployment
  const handleDeleteDeployment = async (deploymentId) => {
    try {
      await apiClient.delete(`/api/deployments/${deploymentId}`);
      
      // Remove from state
      setDeployments(deployments.filter(d => d.id !== deploymentId));
      
      // Unselect if this was the selected deployment
      if (selectedDeployment && selectedDeployment.id === deploymentId) {
        setSelectedDeployment(null);
      }
      
      toast({
        title: 'Success',
        description: 'Deployment deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting deployment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete deployment',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Copy to clipboard
  const copyToClipboard = (text, message = 'Copied to clipboard') => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: message,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };
  
  // Toggle API key visibility
  const toggleApiKeyVisibility = (keyId) => {
    setShowApiKey({
      ...showApiKey,
      [keyId]: !showApiKey[keyId]
    });
  };
  
  // Generate a code sample
  const generateCodeSample = (language) => {
    if (!selectedDeployment) return '';
    
    if (language === 'javascript') {
      return `// JavaScript example
const executeWorkflow = async (query) => {
  const response = await fetch('${selectedDeployment.endpoint_url}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${selectedDeployment.api_key}'
    },
    body: JSON.stringify({
      input_data: {
        query: query
      }
    })
  });
  
  return await response.json();
};

// Example usage
const result = await executeWorkflow('How can I improve customer retention?');
console.log(result);`;
    } else if (language === 'python') {
      return `# Python example
import requests
import json

def execute_workflow(query):
    url = '${selectedDeployment.endpoint_url}'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer ${selectedDeployment.api_key}'
    }
    payload = {
        'input_data': {
            'query': query
        }
    }
    
    response = requests.post(url, headers=headers, json=payload)
    return response.json()

# Example usage
result = execute_workflow('How can I improve customer retention?')
print(result)`;
    } else if (language === 'curl') {
      return `# curl example
curl -X POST '${selectedDeployment.endpoint_url}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${selectedDeployment.api_key}' \\
  -d '{
    "input_data": {
      "query": "How can I improve customer retention?"
    }
  }'`;
    }
    
    return '';
  };
  
  if (loading && deployments.length === 0) {
    return (
      <Flex justify="center" align="center" height="500px" width="100%">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading>API Deployments</Heading>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="brand"
          onClick={onOpen}
        >
          Deploy Workflow
        </Button>
      </Flex>
      
      {deployments.length > 0 ? (
        <Simple
