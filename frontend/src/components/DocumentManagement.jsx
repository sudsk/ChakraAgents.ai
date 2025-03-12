// frontend/src/components/DocumentManagement.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  FormControl,
  FormLabel,
  FormHelperText,
  Switch,
  Select,
  Stack,
  Text,
  IconButton,
  HStack,
  VStack,
  Badge,
  Progress,
  useToast,
  Flex,
  Divider,
  Icon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure
} from '@chakra-ui/react';
import { 
  FiUpload, 
  FiFile, 
  FiTrash2, 
  FiDatabase, 
  FiSearch, 
  FiRefreshCw,
  FiInfo,
  FiEdit,
  FiPlus
} from 'react-icons/fi';
import apiClient from '../services/api';

const DocumentManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState([
    { id: 'default', name: 'Default Knowledge Base' },
    { id: 'custom', name: 'Custom Knowledge Base' },
    { id: 'project', name: 'Project-Specific Knowledge Base' }
  ]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [processingOptions, setProcessingOptions] = useState({
    chunkSize: 1000,
    chunkOverlap: 200,
    includeMetadata: true,
    autoIndex: true
  });
  
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Load documents
  useEffect(() => {
    fetchDocuments();
  }, [selectedKnowledgeBase]);

  const fetchDocuments = async () => {
    try {
      // This would be a real API call
      // const response = await apiClient.get(`/api/documents?knowledgeBase=${selectedKnowledgeBase}`);
      // setDocuments(response);
      
      // Mock data for demonstration
      setDocuments([
        { 
          id: '1', 
          filename: 'product_manual.pdf', 
          size: '2.4 MB', 
          chunks: 45, 
          uploadDate: '2025-03-01', 
          type: 'pdf', 
          status: 'indexed'
        },
        { 
          id: '2', 
          filename: 'customer_feedback.csv', 
          size: '1.1 MB', 
          chunks: 87, 
          uploadDate: '2025-03-05', 
          type: 'csv', 
          status: 'indexed'
        },
        { 
          id: '3', 
          filename: 'research_paper.pdf', 
          size: '3.7 MB', 
          chunks: 62, 
          uploadDate: '2025-03-08', 
          type: 'pdf', 
          status: 'indexed'
        },
        { 
          id: '4', 
          filename: 'technical_specs.docx', 
          size: '0.8 MB', 
          chunks: 28, 
          uploadDate: '2025-03-10', 
          type: 'docx', 
          status: 'processing'
        }
      ]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          return 100;
        }
        return newProgress;
      });
    }, 300);

    try {
      // This would be a real API call
      // const formData = new FormData();
      // formData.append('file', selectedFile);
      // formData.append('knowledgeBase', selectedKnowledgeBase);
      // formData.append('options', JSON.stringify(processingOptions));
      // await apiClient.post('/api/documents/upload', formData);
      
      // Mock upload delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate successful upload
      setDocuments(prev => [
        {
          id: Date.now().toString(),
          filename: selectedFile.name,
          size: `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`,
          chunks: Math.floor(Math.random() * 50) + 10,
          uploadDate: new Date().toISOString().split('T')[0],
          type: selectedFile.name.split('.').pop(),
          status: 'indexed'
        },
        ...prev
      ]);

      setSelectedFile(null);
      clearInterval(interval);
      setUploadProgress(100);

      toast({
        title: 'Upload successful',
        description: `${selectedFile.name} has been uploaded and indexed`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload document',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      // This would be a real API call
      // await apiClient.delete(`/api/documents/${documentId}`);
      
      // Remove from state
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      toast({
        title: 'Document deleted',
        description: 'The document has been removed from the knowledge base',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete document',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleProcessingOptionsChange = (field, value) => {
    setProcessingOptions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleReindexDocument = async (documentId) => {
    try {
      // This would be a real API call
      // await apiClient.post(`/api/documents/${documentId}/reindex`);
      
      // Update status in UI
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId ? { ...doc, status: 'processing' } : doc
      ));
      
      // Mock processing delay
      setTimeout(() => {
        setDocuments(prev => prev.map(doc => 
          doc.id === documentId ? { ...doc, status: 'indexed' } : doc
        ));
      }, 2000);
      
      toast({
        title: 'Reindexing started',
        description: 'The document is being reindexed',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error reindexing document:', error);
      toast({
        title: 'Reindexing failed',
        description: error.message || 'Failed to reindex document',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box>
      <HStack mb={6} justifyContent="space-between">
        <HStack>
          <Icon as={FiDatabase} boxSize={6} color="blue.500" />
          <Heading size="lg">Document Management</Heading>
        </HStack>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="blue"
          onClick={onOpen}
        >
          Add Document
        </Button>
      </HStack>

      <Card mb={6}>
        <CardBody>
          <HStack mb={4}>
            <FormControl w="300px">
              <FormLabel>Knowledge Base</FormLabel>
              <Select
                value={selectedKnowledgeBase}
                onChange={(e) => setSelectedKnowledgeBase(e.target.value)}
              >
                {knowledgeBases.map(kb => (
                  <option key={kb.id} value={kb.id}>{kb.name}</option>
                ))}
              </Select>
            </FormControl>
            
            <FormControl flex={1}>
              <FormLabel>Search Documents</FormLabel>
              <Input
                placeholder="Search by filename or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftElement={<Icon as={FiSearch} color="gray.500" ml={2} />}
              />
            </FormControl>
            
            <IconButton
              icon={<FiRefreshCw />}
              aria-label="Refresh documents"
              onClick={fetchDocuments}
              alignSelf="flex-end"
            />
          </HStack>
          
          {documents.length > 0 ? (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Filename</Th>
                  <Th>Type</Th>
                  <Th>Size</Th>
                  <Th>Chunks</Th>
                  <Th>Uploaded</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {documents.map(doc => (
                  <Tr key={doc.id}>
                    <Td>
                      <HStack>
                        <Icon as={FiFile} />
                        <Text>{doc.filename}</Text>
                      </HStack>
                    </Td>
                    <Td>
                      <Badge>{doc.type}</Badge>
                    </Td>
                    <Td>{doc.size}</Td>
                    <Td>{doc.chunks}</Td>
                    <Td>{doc.uploadDate}</Td>
                    <Td>
                      <Badge
                        colorScheme={doc.status === 'indexed' ? 'green' : doc.status === 'processing' ? 'blue' : 'yellow'}
                      >
                        {doc.status}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <IconButton
                          icon={<FiRefreshCw />}
                          aria-label="Reindex document"
                          size="sm"
                          onClick={() => handleReindexDocument(doc.id)}
                          isDisabled={doc.status === 'processing'}
                        />
                        <IconButton
                          icon={<FiTrash2 />}
                          aria-label="Delete document"
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => handleDeleteDocument(doc.id)}
                        />
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
              border="1px" 
              borderStyle="dashed"
              borderColor="gray.200" 
              borderRadius="md"
            >
              <Icon as={FiDatabase} fontSize="4xl" color="gray.400" mb={4} />
              <Text color="gray.500" mb={4}>No documents in this knowledge base yet.</Text>
              <Button leftIcon={<FiUpload />} onClick={onOpen}>
                Upload Document
              </Button>
            </Flex>
          )}
        </CardBody>
      </Card>

      {/* Document Upload Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload Document</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Select File</FormLabel>
                <Input
                  type="file"
                  p={1}
                  onChange={handleFileChange}
                  accept=".pdf,.txt,.csv,.docx,.md,.json"
                />
                <FormHelperText>
                  Supported formats: PDF, TXT, CSV, DOCX, MD, JSON
                </FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel>Knowledge Base</FormLabel>
                <Select
                  value={selectedKnowledgeBase}
                  onChange={(e) => setSelectedKnowledgeBase(e.target.value)}
                >
                  {knowledgeBases.map(kb => (
                    <option key={kb.id} value={kb.id}>{kb.name}</option>
                  ))}
                </Select>
              </FormControl>

              <Divider />
              <Heading size="sm">Processing Options</Heading>

              <HStack spacing={4}>
                <FormControl>
                  <FormLabel>Chunk Size</FormLabel>
                  <Input
                    type="number"
                    value={processingOptions.chunkSize}
                    onChange={(e) => handleProcessingOptionsChange('chunkSize', parseInt(e.target.value))}
                    min={100}
                    max={5000}
                  />
                  <FormHelperText>
                    Characters per chunk
                  </FormHelperText>
                </FormControl>

                <FormControl>
                  <FormLabel>Chunk Overlap</FormLabel>
                  <Input
                    type="number"
                    value={processingOptions.chunkOverlap}
                    onChange={(e) => handleProcessingOptionsChange('chunkOverlap', parseInt(e.target.value))}
                    min={0}
                    max={500}
                  />
                  <FormHelperText>
                    Overlap between chunks
                  </FormHelperText>
                </FormControl>
              </HStack>

              <HStack spacing={4}>
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="include-metadata" mb="0">
                    Include Metadata
                  </FormLabel>
                  <Switch
                    id="include-metadata"
                    isChecked={processingOptions.includeMetadata}
                    onChange={(e) => handleProcessingOptionsChange('includeMetadata', e.target.checked)}
                    colorScheme="blue"
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="auto-index" mb="0">
                    Auto-Index
                  </FormLabel>
                  <Switch
                    id="auto-index"
                    isChecked={processingOptions.autoIndex}
                    onChange={(e) => handleProcessingOptionsChange('autoIndex', e.target.checked)}
                    colorScheme="blue"
                  />
                </FormControl>
              </HStack>

              {isUploading && (
                <Box>
                  <Text mb={2}>Uploading {selectedFile?.name}...</Text>
                  <Progress value={uploadProgress} size="sm" colorScheme="blue" />
                </Box>
              )}
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isUploading}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              leftIcon={<FiUpload />} 
              onClick={handleUpload} 
              isLoading={isUploading}
              loadingText="Uploading"
              isDisabled={!selectedFile || isUploading}
            >
              Upload
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default DocumentManagement;
