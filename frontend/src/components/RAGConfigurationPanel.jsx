// frontend/src/components/RAGConfigurationPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Switch,
  Select,
  Stack,
  Text,
  Heading,
  Divider,
  Button,
  HStack,
  Icon,
  useToast,
  Badge
} from '@chakra-ui/react';
import { FiDatabase, FiSearch, FiSettings, FiList, FiInfo } from 'react-icons/fi';

const RAGConfigurationPanel = ({ config, onChange, isEditing = true }) => {
  const [ragConfig, setRagConfig] = useState({
    enabled: false,
    retrievalSettings: {
      numResults: 5,
      similarityThreshold: 0.7,
      includeMetadata: true,
      maxTokensPerDocument: 1000
    },
    vectorStoreSettings: {
      storeName: 'default',
      embeddingModel: 'vertex_ai',
      dimensions: 768
    },
    promptSettings: {
      systemMessage: "You are a helpful assistant with access to a knowledge base. Answer questions based on the retrieved information when available.",
      retrievalPrompt: "Retrieve information related to this query: {query}"
    },
    ...config
  });

  const toast = useToast();

  // Update parent component when configuration changes
  useEffect(() => {
    if (onChange) {
      onChange(ragConfig);
    }
  }, [ragConfig, onChange]);

  // Handle changes to the RAG configuration
  const handleChange = (section, field, value) => {
    setRagConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  // Handle toggling RAG capabilities
  const handleToggleRAG = (enabled) => {
    setRagConfig(prev => ({
      ...prev,
      enabled
    }));
  };

  // Test RAG configuration
  const handleTestRAG = async () => {
    try {
      toast({
        title: "Testing RAG Configuration",
        description: "This would test the RAG configuration against the vector store.",
        status: "info",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "RAG Test Failed",
        description: error.message || "Failed to test RAG configuration",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Card>
      <CardBody>
        <HStack mb={4} justifyContent="space-between">
          <HStack>
            <Icon as={FiDatabase} color="purple.500" boxSize={5} />
            <Heading size="md">Retrieval-Augmented Generation</Heading>
          </HStack>
          {!isEditing && ragConfig.enabled && (
            <Badge colorScheme="purple">RAG Enabled</Badge>
          )}
        </HStack>

        {isEditing && (
          <FormControl display="flex" alignItems="center" mb={6}>
            <FormLabel htmlFor="enable-rag" mb="0">
              Enable RAG Capabilities
            </FormLabel>
            <Switch
              id="enable-rag"
              isChecked={ragConfig.enabled}
              onChange={(e) => handleToggleRAG(e.target.checked)}
              colorScheme="purple"
            />
          </FormControl>
        )}

        {(!isEditing && ragConfig.enabled) || (isEditing && ragConfig.enabled) ? (
          <>
            <Divider my={4} />

            {/* Retrieval Settings */}
            <Box mb={6}>
              <HStack mb={2}>
                <Icon as={FiSearch} />
                <Heading size="sm">Retrieval Settings</Heading>
              </HStack>

              <Stack spacing={4} mt={4}>
                <FormControl>
                  <FormLabel>Number of Results</FormLabel>
                  <NumberInput
                    min={1}
                    max={20}
                    value={ragConfig.retrievalSettings.numResults}
                    onChange={(valueAsString, valueAsNumber) => 
                      handleChange('retrievalSettings', 'numResults', valueAsNumber)
                    }
                    isDisabled={!isEditing}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <FormHelperText>
                    Number of documents to retrieve from the knowledge base
                  </FormHelperText>
                </FormControl>

                <FormControl>
                  <FormLabel>Similarity Threshold</FormLabel>
                  <NumberInput
                    step={0.1}
                    min={0.1}
                    max={1.0}
                    value={ragConfig.retrievalSettings.similarityThreshold}
                    onChange={(valueAsString, valueAsNumber) => 
                      handleChange('retrievalSettings', 'similarityThreshold', valueAsNumber)
                    }
                    isDisabled={!isEditing}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <FormHelperText>
                    Minimum similarity score for retrieved documents (0.1-1.0)
                  </FormHelperText>
                </FormControl>

                <FormControl>
                  <FormLabel>Max Tokens Per Document</FormLabel>
                  <NumberInput
                    step={100}
                    min={100}
                    max={5000}
                    value={ragConfig.retrievalSettings.maxTokensPerDocument}
                    onChange={(valueAsString, valueAsNumber) => 
                      handleChange('retrievalSettings', 'maxTokensPerDocument', valueAsNumber)
                    }
                    isDisabled={!isEditing}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <FormHelperText>
                    Maximum tokens to include from each retrieved document
                  </FormHelperText>
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="include-metadata" mb="0">
                    Include Metadata
                  </FormLabel>
                  <Switch
                    id="include-metadata"
                    isChecked={ragConfig.retrievalSettings.includeMetadata}
                    onChange={(e) => 
                      handleChange('retrievalSettings', 'includeMetadata', e.target.checked)
                    }
                    colorScheme="purple"
                    isDisabled={!isEditing}
                  />
                </FormControl>
              </Stack>
            </Box>

            <Divider my={4} />

            {/* Vector Store Settings */}
            <Box mb={6}>
              <HStack mb={2}>
                <Icon as={FiDatabase} />
                <Heading size="sm">Vector Store Settings</Heading>
              </HStack>

              <Stack spacing={4} mt={4}>
                <FormControl>
                  <FormLabel>Vector Store</FormLabel>
                  <Select
                    value={ragConfig.vectorStoreSettings.storeName}
                    onChange={(e) => 
                      handleChange('vectorStoreSettings', 'storeName', e.target.value)
                    }
                    isDisabled={!isEditing}
                  >
                    <option value="default">Default Knowledge Base</option>
                    <option value="custom">Custom Knowledge Base</option>
                    <option value="project">Project-Specific Knowledge Base</option>
                  </Select>
                  <FormHelperText>
                    The knowledge base to retrieve information from
                  </FormHelperText>
                </FormControl>

                <FormControl>
                  <FormLabel>Embedding Model</FormLabel>
                  <Select
                    value={ragConfig.vectorStoreSettings.embeddingModel}
                    onChange={(e) => 
                      handleChange('vectorStoreSettings', 'embeddingModel', e.target.value)
                    }
                    isDisabled={!isEditing}
                  >
                    <option value="vertex_ai">Vertex AI Embeddings</option>
                    <option value="openai">OpenAI Embeddings</option>
                  </Select>
                  <FormHelperText>
                    Model used for generating embeddings
                  </FormHelperText>
                </FormControl>
              </Stack>
            </Box>

            <Divider my={4} />

            {/* Prompt Settings */}
            <Box mb={6}>
              <HStack mb={2}>
                <Icon as={FiList} />
                <Heading size="sm">Prompt Settings</Heading>
              </HStack>

              <Stack spacing={4} mt={4}>
                <FormControl>
                  <FormLabel>System Message</FormLabel>
                  <Input
                    value={ragConfig.promptSettings.systemMessage}
                    onChange={(e) => 
                      handleChange('promptSettings', 'systemMessage', e.target.value)
                    }
                    isDisabled={!isEditing}
                  />
                  <FormHelperText>
                    System message for the LLM when using retrieved information
                  </FormHelperText>
                </FormControl>

                <FormControl>
                  <FormLabel>Retrieval Prompt</FormLabel>
                  <Input
                    value={ragConfig.promptSettings.retrievalPrompt}
                    onChange={(e) => 
                      handleChange('promptSettings', 'retrievalPrompt', e.target.value)
                    }
                    isDisabled={!isEditing}
                  />
                  <FormHelperText>
                    Prompt template for retrieval (use {'{query}'} as placeholder)
                  </FormHelperText>
                </FormControl>
              </Stack>
            </Box>

            {isEditing && (
              <HStack justifyContent="flex-end">
                <Button 
                  leftIcon={<FiInfo />} 
                  onClick={handleTestRAG}
                  size="sm"
                >
                  Test Configuration
                </Button>
              </HStack>
            )}
          </>
        ) : (
          <Text color="gray.500" fontStyle="italic">
            RAG capabilities are disabled. Enable them to augment your agents with knowledge base retrieval.
          </Text>
        )}
      </CardBody>
    </Card>
  );
};

export default RAGConfigurationPanel;
