// frontend/src/components/RAGTestConsole.jsx
import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  Textarea,
  VStack,
  HStack,
  Badge,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
  Alert,
  AlertIcon,
  useToast,
  Icon,
  Divider
} from '@chakra-ui/react';
import { FiSend, FiSearch, FiDatabase, FiCode, FiInfo } from 'react-icons/fi';
import apiClient from '../services/api';

const RAGTestConsole = ({ config }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();
  const responseRef = useRef(null);

  const handleSubmit = async () => {
    if (!query.trim()) {
      toast({
        title: 'Empty query',
        description: 'Please enter a query to test',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      // This would be a real API call in production
      // const response = await apiClient.post('/api/rag/test', {
      //   query,
      //   config
      // });
      
      // Mock API response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a mock response
      const mockResponse = {
        answer: `Based on the information retrieved from the knowledge base, quantum computers work by utilizing quantum bits or qubits, which unlike classical bits, can exist in multiple states simultaneously due to a property called superposition. This allows quantum computers to process a vast number of possibilities all at once.

Additionally, qubits can be entangled with each other, meaning the state of one qubit is directly related to the state of another, regardless of the distance between them. This property enables quantum computers to perform certain calculations exponentially faster than classical computers.

Quantum computers operate using quantum gates to manipulate qubits, similar to how classical computers use logic gates. However, quantum gates perform transformations according to the laws of quantum mechanics.

Current quantum computers face challenges with maintaining quantum coherence (keeping qubits in their quantum state), as interaction with the environment causes decoherence. This is why many quantum computers operate at extremely low temperatures, close to absolute zero.`,
        context: `Document 1:
Quantum computers leverage the principles of quantum mechanics to process information. Instead of using classical bits, quantum computers use quantum bits or "qubits." Unlike classical bits, which can be either 0 or 1, qubits can exist in multiple states simultaneously due to a quantum property called superposition.
Source: quantum_computing_basics.pdf

Document 2:
One of the key properties that make quantum computers powerful is entanglement. When qubits become entangled, the state of one qubit becomes directly related to the state of another. This allows quantum computers to process a vast number of possibilities simultaneously.
Source: advanced_quantum_mechanics.pdf

Document 3:
Quantum computers face a significant challenge called decoherence. This occurs when qubits interact with their environment and lose their quantum state. To minimize decoherence, quantum computers often operate at temperatures close to absolute zero (-273.15°C).
Source: quantum_computing_challenges.pdf`,
        model: 'vertex_ai/gemini-1.5-pro',
        processing_time: 1.24,
        vector_search_results: 3
      };
      
      setResults(mockResponse);
    } catch (err) {
      console.error('Error testing RAG:', err);
      setError(err.message || 'An error occurred while testing');
    } finally {
      setIsLoading(false);
      
      // Scroll to response section when results are available
      setTimeout(() => {
        if (responseRef.current) {
          responseRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  return (
    <Card>
      <CardHeader>
        <HStack>
          <Icon as={FiDatabase} color="purple.500" mr={2} />
          <Heading size="md">RAG Test Console</Heading>
        </HStack>
      </CardHeader>
      <CardBody>
        <Text mb={4}>
          Test your RAG configuration by submitting a query to retrieve information from the knowledge base and generate a response.
        </Text>
        
        <Box mb={4}>
          <Textarea
            placeholder="Enter a query to test RAG capabilities..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            resize="vertical"
          />
        </Box>
        
        <Box mb={6} textAlign="right">
          <Button
            leftIcon={<FiSend />}
            colorScheme="purple"
            onClick={handleSubmit}
            isLoading={isLoading}
            loadingText="Processing"
          >
            Test Query
          </Button>
        </Box>
        
        {isLoading && (
          <Box textAlign="center" my={8}>
            <Spinner size="xl" color="purple.500" mb={4} />
            <Text>Processing your query...</Text>
            <Text fontSize="sm" color="gray.500">This may take a few moments</Text>
          </Box>
        )}
        
        {error && (
          <Alert status="error" mb={6}>
            <AlertIcon />
            {error}
          </Alert>
        )}
        
        {results && (
          <Box ref={responseRef}>
            <Divider mb={4} />
            
            <Box mb={6}>
              <HStack mb={2}>
                <Heading size="sm">Generated Response</Heading>
                <Badge colorScheme="green">{results.model}</Badge>
              </HStack>
              <Card variant="outline">
                <CardBody>
                  <Text whiteSpace="pre-wrap">{results.answer}</Text>
                </CardBody>
              </Card>
            </Box>
            
            <Accordion allowToggle>
              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <HStack flex="1" textAlign="left">
                      <Icon as={FiSearch} color="blue.500" />
                      <Text fontWeight="medium">
                        Retrieved Context ({results.vector_search_results} results)
                      </Text>
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  <Card variant="outline">
                    <CardBody>
                      <Text as="pre" fontSize="sm" whiteSpace="pre-wrap" fontFamily="monospace">
                        {results.context}
                      </Text>
                    </CardBody>
                  </Card>
                </AccordionPanel>
              </AccordionItem>
              
              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <HStack flex="1" textAlign="left">
                      <Icon as={FiInfo} color="blue.500" />
                      <Text fontWeight="medium">Performance Metrics</Text>
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  <VStack align="stretch" spacing={2}>
                    <HStack>
                      <Text fontWeight="bold" minWidth="180px">Processing Time:</Text>
                      <Text>{results.processing_time.toFixed(2)} seconds</Text>
                    </HStack>
                    <HStack>
                      <Text fontWeight="bold" minWidth="180px">Vector Search Results:</Text>
                      <Text>{results.vector_search_results} documents</Text>
                    </HStack>
                    <HStack>
                      <Text fontWeight="bold" minWidth="180px">Model:</Text>
                      <Text>{results.model}</Text>
                    </HStack>
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
              
              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <HStack flex="1" textAlign="left">
                      <Icon as={FiCode} color="blue.500" />
                      <Text fontWeight="medium">Configuration Used</Text>
                    </HStack>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  <Box
                    as="pre"
                    p={3}
                    bg="gray.50"
                    borderRadius="md"
                    fontSize="sm"
                    overflow="auto"
                    maxHeight="300px"
                  >
                    {JSON.stringify(config, null, 2)}
                  </Box>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </Box>
        )}
      </CardBody>
    </Card>
  );
};

export default RAGTestConsole;
