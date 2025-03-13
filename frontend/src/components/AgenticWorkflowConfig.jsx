// frontend/src/components/AgenticWorkflowConfig.jsx
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
  Select,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Textarea,
  Flex,
  HStack,
  VStack,
  Divider,
  Tooltip,
  IconButton,
  Badge,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Code,
  SimpleGrid,
  useToast,
  useColorModeValue
} from '@chakra-ui/react';
import { 
  FiInfo, 
  FiSave, 
  FiSettings, 
  FiCpu, 
  FiRefreshCw, 
  FiEdit,
  FiPlus,
  FiSliders,
  FiArrowRight,
  FiMessageCircle,
  FiAlertCircle
} from 'react-icons/fi';

/**
 * AgenticWorkflowConfig component for configuring agentic workflow settings
 * @param {Object} props - Component props
 * @param {Object} props.config - Current configuration object
 * @param {Function} props.onChange - Callback function when configuration changes
 * @param {boolean} props.isEditing - Whether component is in editing mode
 * @param {boolean} props.isLoading - Whether component is in loading state
 */
const AgenticWorkflowConfig = ({ 
  config, 
  onChange, 
  isEditing = true,
  isLoading = false
}) => {
  const toast = useToast();
  const [workflowConfig, setWorkflowConfig] = useState({
    max_iterations: 5,
    checkpoint_dir: './checkpoints',
    decision_format: 'hybrid',
    max_decision_time_seconds: 60,
    enable_logging: true,
    override_agent_decisions: false,
    ...config
  });
  
  const [agentControlSettings, setAgentControlSettings] = useState({
    auto_fallback: true,
    prevent_loops: true,
    agent_coordination_style: 'autonomous',
    timeout_behavior: 'return_current_state',
    ...config?.agent_control
  });
  
  const cardBg = useColorModeValue('white', 'gray.800');
  
  // Update parent when configuration changes
  useEffect(() => {
    if (onChange) {
      onChange({
        ...workflowConfig,
        agent_control: agentControlSettings
      });
    }
  }, [workflowConfig, agentControlSettings, onChange]);
  
  // Handle workflow configuration changes
  const handleConfigChange = (field, value) => {
    setWorkflowConfig({
      ...workflowConfig,
      [field]: value
    });
  };
  
  // Handle agent control settings changes
  const handleAgentControlChange = (field, value) => {
    setAgentControlSettings({
      ...agentControlSettings,
      [field]: value
    });
  };
  
  // Validate current configuration
  const validateConfig = () => {
    // Check for potential issues in the configuration
    const issues = [];
    
    if (workflowConfig.max_iterations < 1) {
      issues.push('Max iterations should be at least 1');
    }
    
    if (workflowConfig.max_decision_time_seconds < 5) {
      issues.push('Max decision time should be at least 5 seconds');
    }
    
    if (!workflowConfig.checkpoint_dir) {
      issues.push('Checkpoint directory should be specified');
    }
    
    // Display validation results
    if (issues.length > 0) {
      toast({
        title: 'Configuration Issues',
        description: issues.join('. '),
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return false;
    }
    
    toast({
      title: 'Configuration Valid',
      description: 'Your agentic workflow configuration is valid',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    return true;
  };
  
  return (
    <Card bg={cardBg}>
      <CardHeader>
        <Flex justify="space-between" align="center">
          <HStack>
            <FiSettings />
            <Heading size="md">Agentic Workflow Configuration</Heading>
          </HStack>
          
          {isEditing && (
            <Button
              leftIcon={<FiInfo />}
              variant="outline"
              size="sm"
              onClick={validateConfig}
            >
              Validate Config
            </Button>
          )}
        </Flex>
      </CardHeader>
      <CardBody>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
          <Card variant="outline">
            <CardHeader py={3}>
              <Heading size="sm">General Settings</Heading>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Max Iterations</FormLabel>
                  <NumberInput
                    value={workflowConfig.max_iterations}
                    onChange={(_, valueAsNumber) => 
                      handleConfigChange('max_iterations', valueAsNumber)
                    }
                    min={1}
                    max={20}
                    isDisabled={!isEditing}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <FormHelperText>
                    Maximum number of decision cycles before forcing completion
                  </FormHelperText>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Decision Format</FormLabel>
                  <Select
                    value={workflowConfig.decision_format}
                    onChange={(e) => handleConfigChange('decision_format', e.target.value)}
                    isDisabled={!isEditing}
                  >
                    <option value="hybrid">Hybrid (Natural Language + Structured)</option>
                    <option value="structured">Structured Only (JSON)</option>
                    <option value="natural">Natural Language Only</option>
                  </Select>
                  <FormHelperText>
                    How agents should format their decisions
                  </FormHelperText>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Max Decision Time (Seconds)</FormLabel>
                  <NumberInput
                    value={workflowConfig.max_decision_time_seconds}
                    onChange={(_, valueAsNumber) => 
                      handleConfigChange('max_decision_time_seconds', valueAsNumber)
                    }
                    min={5}
                    max={300}
                    isDisabled={!isEditing}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <FormHelperText>
                    Maximum time allowed for agent decisions before timing out
                  </FormHelperText>
                </FormControl>
              </VStack>
            </CardBody>
          </Card>
          
          <Card variant="outline">
            <CardHeader py={3}>
              <Heading size="sm">Storage & Logging</Heading>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Checkpoint Directory</FormLabel>
                  <Input
                    value={workflowConfig.checkpoint_dir}
                    onChange={(e) => handleConfigChange('checkpoint_dir', e.target.value)}
                    placeholder="./checkpoints"
                    isDisabled={!isEditing}
                  />
                  <FormHelperText>
                    Directory to store workflow state checkpoints
                  </FormHelperText>
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="enable-logging" mb="0">
                    Enable Detailed Logging
                  </FormLabel>
                  <Switch
                    id="enable-logging"
                    isChecked={workflowConfig.enable_logging}
                    onChange={(e) => handleConfigChange('enable_logging', e.target.checked)}
                    colorScheme="blue"
                    isDisabled={!isEditing}
                  />
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="override-decisions" mb="0">
                    Override Agent Decisions
                  </FormLabel>
                  <Switch
                    id="override-decisions"
                    isChecked={workflowConfig.override_agent_decisions}
                    onChange={(e) => handleConfigChange('override_agent_decisions', e.target.checked)}
                    colorScheme="blue"
                    isDisabled={!isEditing}
                  />
                  <Tooltip label="When enabled, the execution graph will override agent decisions about delegation">
                    <Box ml={2} cursor="help">
                      <FiInfo />
                    </Box>
                  </Tooltip>
                </FormControl>
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>
        
        <Accordion allowToggle defaultIndex={-1}>
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <HStack>
                    <FiCpu />
                    <Text fontWeight="medium">Agent Control Settings</Text>
                  </HStack>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                <VStack align="stretch" spacing={4}>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="auto-fallback" mb="0">
                      Auto Fallback
                    </FormLabel>
                    <Switch
                      id="auto-fallback"
                      isChecked={agentControlSettings.auto_fallback}
                      onChange={(e) => handleAgentControlChange('auto_fallback', e.target.checked)}
                      colorScheme="blue"
                      isDisabled={!isEditing}
                    />
                    <Tooltip label="Automatically fallback to previous agent if delegation fails">
                      <Box ml={2} cursor="help">
                        <FiInfo />
                      </Box>
                    </Tooltip>
                  </FormControl>
                  
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="prevent-loops" mb="0">
                      Prevent Decision Loops
                    </FormLabel>
                    <Switch
                      id="prevent-loops"
                      isChecked={agentControlSettings.prevent_loops}
                      onChange={(e) => handleAgentControlChange('prevent_loops', e.target.checked)}
                      colorScheme="blue"
                      isDisabled={!isEditing}
                    />
                    <Tooltip label="Prevent agents from getting stuck in delegation loops">
                      <Box ml={2} cursor="help">
                        <FiInfo />
                      </Box>
                    </Tooltip>
                  </FormControl>
                </VStack>
                
                <VStack align="stretch" spacing={4}>
                  <FormControl>
                    <FormLabel>Agent Coordination Style</FormLabel>
                    <Select
                      value={agentControlSettings.agent_coordination_style}
                      onChange={(e) => handleAgentControlChange('agent_coordination_style', e.target.value)}
                      isDisabled={!isEditing}
                    >
                      <option value="autonomous">Autonomous</option>
                      <option value="supervised">Supervised</option>
                      <option value="forced_execution_graph">Forced Execution Graph</option>
                    </Select>
                    <FormHelperText>
                      How agents coordinate with each other
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Timeout Behavior</FormLabel>
                    <Select
                      value={agentControlSettings.timeout_behavior}
                      onChange={(e) => handleAgentControlChange('timeout_behavior', e.target.value)}
                      isDisabled={!isEditing}
                    >
                      <option value="return_current_state">Return Current State</option>
                      <option value="retry_once">Retry Once</option>
                      <option value="fallback_to_supervisor">Fallback to Supervisor</option>
                    </Select>
                    <FormHelperText>
                      What to do when an agent decision times out
                    </FormHelperText>
                  </FormControl>
                </VStack>
              </SimpleGrid>
            </AccordionPanel>
          </AccordionItem>
          
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <HStack>
                    <FiMessageCircle />
                    <Text fontWeight="medium">Agentic Decision Instructions</Text>
                  </HStack>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <VStack align="stretch" spacing={4}>
                <Text>
                  Agents can make decisions about task delegation, tool usage, and providing final responses. 
                  These settings control how these instructions are presented to the agents.
                </Text>
                
                <Card variant="outline" bg="blue.50">
                  <CardBody>
                    <Heading size="sm" mb={2}>Decision Format Example</Heading>
                    <Code p={3} display="block" whiteSpace="pre-wrap" borderRadius="md">
{`MAKE DECISION:
1. DELEGATE TO ANOTHER AGENT: If you need another agent's expertise, delegate by specifying:
   - Target Agent: [agent_name]
   - Reason: [brief explanation why]
   - Task: [specific task description]

2. USE TOOL: If you need to use a tool, specify:
   - Tool Name: [tool_name]
   - Parameters: [parameters in JSON format]
   - Reason: [why you need this tool]

3. FINAL RESPONSE: If you have a complete answer, provide:
   - Final answer: [your detailed response]`}
                    </Code>
                  </CardBody>
                </Card>
                
                <Card variant="outline" colorScheme="red">
                  <CardHeader py={3} bg="red.50">
                    <HStack>
                      <FiAlertCircle color="red" />
                      <Heading size="sm">Advanced Configuration</Heading>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    <Text mb={4} color="gray.600">
                      Modifying these settings can significantly impact agent behavior. The default settings are optimized for most use cases.
                    </Text>
                    
                    {isEditing && (
                      <FormControl>
                        <FormLabel>Custom Decision Instructions</FormLabel>
                        <Textarea
                          value={workflowConfig.custom_decision_instructions || ''}
                          onChange={(e) => handleConfigChange('custom_decision_instructions', e.target.value)}
                          placeholder="Leave empty to use the default decision instructions"
                          rows={6}
                        />
                        <FormHelperText>
                          Override the default decision instructions with custom instructions
                        </FormHelperText>
                      </FormControl>
                    )}
                  </CardBody>
                </Card>
              </VStack>
            </AccordionPanel>
          </AccordionItem>
          
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <HStack>
                    <FiSliders />
                    <Text fontWeight="medium">Advanced Options</Text>
                  </HStack>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <VStack align="stretch" spacing={4}>
                <FormControl>
                  <FormLabel>Memory Type</FormLabel>
                  <Select
                    value={workflowConfig.memory_type || 'buffer'}
                    onChange={(e) => handleConfigChange('memory_type', e.target.value)}
                    isDisabled={!isEditing}
                  >
                    <option value="buffer">Buffer Memory</option>
                    <option value="summary">Summary Memory</option>
                    <option value="vector">Vector Memory</option>
                    <option value="none">No Memory</option>
                  </Select>
                  <FormHelperText>
                    How agents remember past interactions
                  </FormHelperText>
                </FormControl>
                
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Agent Decision Mode</FormLabel>
                    <Select
                      value={workflowConfig.agent_decision_mode || 'standard'}
                      onChange={(e) => handleConfigChange('agent_decision_mode', e.target.value)}
                      isDisabled={!isEditing}
                    >
                      <option value="standard">Standard Decision</option>
                      <option value="cot">Chain-of-Thought (CoT)</option>
                      <option value="react">ReAct</option>
                    </Select>
                    <FormHelperText>
                      Method used for agent decision-making
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Parallel Execution</FormLabel>
                    <Select
                      value={workflowConfig.parallel_execution || 'disabled'}
                      onChange={(e) => handleConfigChange('parallel_execution', e.target.value)}
                      isDisabled={!isEditing}
                    >
                      <option value="disabled">Disabled</option>
                      <option value="enabled">Enabled</option>
                      <option value="conditional">Conditional</option>
                    </Select>
                    <FormHelperText>
                      Whether to allow parallel execution of agent tasks
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
                
                <FormControl>
                  <FormLabel>Raw Configuration JSON</FormLabel>
                  <Code p={3} borderRadius="md" display="block" fontSize="sm" maxH="200px" overflowY="auto" whiteSpace="pre-wrap">
                    {JSON.stringify({...workflowConfig, agent_control: agentControlSettings}, null, 2)}
                  </Code>
                </FormControl>
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
};

export default AgenticWorkflowConfig;
