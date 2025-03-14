/* eslint-disable no-unused-vars */
import apiClient from '../services/api';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  SimpleGrid,
  Card,
  CardBody,
  Text,
  Flex,
  HStack,
  Badge,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { FiPlus, FiSearch, FiEdit, FiPlay, FiMoreVertical, FiTrash2, FiCopy, FiDownload, FiCpu, FiGrid, FiDatabase } from 'react-icons/fi';

const Templates = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef();
  
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [templateToDelete, setTemplateToDelete] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const templatesData = await apiClient.get('/api/templates');
      if (templatesData) {
        setTemplates(templatesData);
        setFilteredTemplates(templatesData);      
      }      
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch templates',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]); // Empty dependency array here is fine if it doesn't use any state/props
    
  // Fetch templates on component mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]); // Include fetchTemplates in dependencies
  
  // Apply filters when search or type filter changes
  useEffect(() => {
    if (templates.length > 0) {
      let filtered = [...templates];
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          template => 
            template.name.toLowerCase().includes(query) ||
            (template.description && template.description.toLowerCase().includes(query))
        );
      }
      
      // Apply type filter
      if (typeFilter) {
        if (typeFilter === 'rag_enabled') {
          filtered = filtered.filter(template => 
            template.workflow_type === 'rag' || template.config?.rag_enabled === true
          );
        } else {
          filtered = filtered.filter(template => template.workflow_type === typeFilter);
        }
      }
      
      setFilteredTemplates(filtered);
    }
  }, [templates, searchQuery, typeFilter]);
  
  const handleCreateTemplate = () => {
    navigate('/agentic/templates/new');
  };
  
  const handleEditTemplate = (templateId) => {
    navigate(`/agentic/templates/${templateId}`);
  };

  const confirmDeleteTemplate = (template) => {
    setTemplateToDelete(template);
    onOpen();
  };
  
  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    
    try {
      await apiClient.delete(`/api/templates/${templateToDelete.id}`);      
      
      // Remove from state
      setTemplates(templates.filter(t => t.id !== templateToDelete.id));
      
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setTemplateToDelete(null);
      onClose();
    }
  };
  
  const handleDuplicateTemplate = async (template) => {
    try {
      // Create a copy of the template with a new name
      const duplicatedTemplate = {
        ...template,
        name: `${template.name} (Copy)`,
        id: undefined // Remove ID so a new one is generated
      };
      
      await apiClient.post('/api/templates', duplicatedTemplate);
          
      // Refresh templates list
      fetchTemplates();
      
      toast({
        title: 'Success',
        description: 'Template duplicated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const exportTemplate = (template) => {
    const fileName = `${template.name.toLowerCase().replace(/\s+/g, '_')}-template.json`;
    const jsonStr = JSON.stringify(template, null, 2);
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
        <Heading>Templates</Heading>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="brand"
          onClick={handleCreateTemplate}
        >
          Create New Template
        </Button>
      </Flex>
      
      {/* Filters */}
      <Flex mb={6} gap={4}>
        <InputGroup maxW="400px">
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="gray.300" />
          </InputLeftElement>
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        
        <Select
          placeholder="All types"
          maxW="200px"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="supervisor">Supervisor</option>
          <option value="swarm">Swarm</option>
          <option value="rag">RAG</option>
          <option value="rag_enabled">RAG-Enabled</option>
        </Select>
      </Flex>
      
      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {filteredTemplates.map((template) => (
            <Card key={template.id} boxShadow="md" _hover={{ boxShadow: 'lg' }}>
              <CardBody>
                <Flex direction="column" height="100%">
                  <Flex justify="space-between" align="flex-start" mb={2}>
                    <HStack>
                      <Badge 
                        colorScheme={
                          template.workflow_type === 'supervisor' ? 'blue' : 
                          template.workflow_type === 'swarm' ? 'purple' : 
                          template.workflow_type === 'rag' ? 'green' : 'gray'
                        }
                        mb={2}
                      >
                        {template.workflow_type}
                      </Badge>
                      {/* Display RAG badge if enabled */}
                      {(template.workflow_type === 'rag' || template.config?.rag_enabled) && (
                        <Badge colorScheme="teal" variant="outline" mb={2}>
                          <HStack spacing={1}>
                            <Icon as={FiDatabase} fontSize="xs" />
                            <Text>RAG</Text>
                          </HStack>
                        </Badge>
                      )}
                    </HStack>
                    <Menu>
                      <MenuButton
                        as={IconButton}
                        icon={<FiMoreVertical />}
                        variant="ghost"
                        size="sm"
                        aria-label="Template options"
                      />
                      <MenuList>
                        <MenuItem 
                          icon={<FiEdit />} 
                          onClick={() => handleEditTemplate(template.id)}
                        >
                          Edit
                        </MenuItem>
                        <MenuItem 
                          icon={<FiCopy />} 
                          onClick={() => handleDuplicateTemplate(template)}
                        >
                          Duplicate
                        </MenuItem>
                        <MenuItem 
                          icon={<FiDownload />} 
                          onClick={() => exportTemplate(template)}
                        >
                          Export
                        </MenuItem>
                        <MenuItem 
                          icon={<FiTrash2 />} 
                          color="red.500"
                          onClick={() => confirmDeleteTemplate(template)}
                        >
                          Delete
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </Flex>
                  
                  <Heading size="md" mb={2}>{template.name}</Heading>
                  
                  <Text fontSize="sm" color="gray.600" mb={4} flex="1">
                    {template.description || 'No description provided'}
                  </Text>
                  
                  <Flex justify="space-between" align="center" mt="auto">
                    <HStack>
                      <Icon 
                        as={
                          template.workflow_type === 'supervisor' ? FiCpu : 
                          template.workflow_type === 'rag' ? FiDatabase : 
                          FiGrid
                        } 
                        color="gray.500" 
                      />
                      <Text fontSize="sm" color="gray.500">
                        {template.workflow_type === 'supervisor' 
                          ? `${1 + (template.config.workers?.length || 0)} agents`
                          : template.workflow_type === 'swarm'
                            ? `${template.config.agents?.length || 0} agents`
                            : 'RAG-enabled'
                        }
                      </Text>
                    </HStack>
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
            {templates.length === 0 
              ? 'No templates available. Create your first template to get started.' 
              : 'No templates match your filters.'}
          </Text>
          {templates.length === 0 && (
            <Button 
              colorScheme="brand" 
              leftIcon={<FiPlus />}
              onClick={handleCreateTemplate}
            >
              Create New Template
            </Button>
          )}
        </Flex>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Template
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteTemplate} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default Templates;
