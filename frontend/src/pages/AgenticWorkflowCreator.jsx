// frontend/src/pages/AgenticWorkflowCreator.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Select,
  Switch,
  VStack,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  IconButton,
  Flex,
  Divider,
  Badge,
  useToast,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverHeader,
  PopoverBody,
  Alert,
  AlertIcon,
  Spinner
} from '@chakra-ui/react';
import { 
  FiSave, FiPlus, FiTrash2, FiArrowLeft, FiPlay, FiCpu, FiList, 
  FiTool, FiSettings, FiDatabase, FiMessageCircle, FiInfo, FiShare2
} from 'react-icons/fi';
import apiClient from '../services/api';

// Agent configuration form with agentic capabilities
const AgentConfigForm = ({ agent, onChange, onDelete, isNew, providers, modelOptions }) => {
  const handleChange = (field, value) => {
    onChange({ ...agent, [field]: value });
  };

  return (
    <Card mb={4} borderWidth="1px" borderColor="gray.200">
      <CardBody>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="md">
            {agent.role === 'supervisor' ? 'Supervisor Agent' : `Agent: ${agent.name}`}
          </Heading>
          {!isNew && onDelete && agent.role !== 'supervisor' && (
            <IconButton
              icon={<FiTrash2 />}
              variant="ghost"
              colorScheme="red"
              aria-label="Delete agent"
              onClick={onDelete}
            />
          )}
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
          <FormControl isRequired>
            <FormLabel>Agent Name</FormLabel>
            <Input
              value={agent.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. researcher_agent"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Role</FormLabel>
            <Select
              value={agent.role || ''}
              onChange={(e) => handleChange('role', e.target.value)}
              placeholder="Select role"
              isDisabled={agent.role === 'supervisor'}
            >
              <option value="worker">Worker</option>
              <option value="critic">Critic</option>
              <option value="executor">Executor</option>
              <option value="planner">Planner</option>
              <option value="researcher">Researcher</option>
              <option value="hub">Hub</option>
              <option value="spoke">Spoke</option>
              <option value="custom">Custom</option>
            </Select>
          </FormControl>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
          <FormControl isRequired>
            <FormLabel>Model Provider</FormLabel>
            <Select
              value={agent.model_provider || ''}
              onChange={(e) => handleChange('model_provider', e.target.value)}
              placeholder="Select provider"
            >
              {providers.map(provider => (
                <option key={provider.value} value={provider.value}>{provider.label}</option>
              ))}
            </Select>
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Model Name</FormLabel>
            <Select
              value={agent.model_name || ''}
              onChange={(e) => handleChange('model_name', e.target.value)}
              placeholder="Select model"
              isDisabled={!agent.model_provider}
            >
              {modelOptions
                .filter(model => model.provider === agent.model_provider)
                .map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))
              }
            </Select>
          </FormControl>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
          <FormControl>
            <FormLabel>Temperature</FormLabel>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={agent.temperature || 0.7}
              onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            />
            <FormHelperText>0 = deterministic, 1 = creative</FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel>Max Tokens</FormLabel>
            <Input
              type="number"
              value={agent.max_tokens || ''}
              onChange={(e) => handleChange('max_tokens', parseInt(e.target.value))}
              placeholder="Leave empty for default"
            />
          </FormControl>
        </SimpleGrid>

        <FormControl mb={4}>
          <FormLabel>System Message</FormLabel>
          <HStack mb={2}>
            <Text fontSize="sm">Include agentic capabilities</Text>
            <Switch 
              isChecked={agent.agentic_system_message !== false}
              onChange={(e) => handleChange('agentic_system_message', e.target.checked)}
              colorScheme="purple"
            />
            <Popover>
              <PopoverTrigger>
                <IconButton
                  icon={<FiInfo />}
                  aria-label="Agentic system message info"
                  size="xs"
                  variant="ghost"
                />
              </PopoverTrigger>
              <PopoverContent>
                <PopoverArrow />
                <PopoverCloseButton />
                <PopoverHeader>Agentic System Message</PopoverHeader>
                <PopoverBody>
                  <Text fontSize="sm">
                    When enabled, the system message will include instructions on how to make agentic decisions, 
                    delegate tasks, use tools, and determine when to provide a final response.
                  </Text>
                </PopoverBody>
              </PopoverContent>
            </Popover>
          </HStack>
          <Textarea
            value={agent.system_message || ''}
            onChange={(e) => handleChange('system_message', e.target.value)}
            placeholder="System message to guide the agent's behavior"
            rows={3}
          />
          <FormHelperText>
            {agent.agentic_system_message !== false ? 
              "Agentic decision-making instructions will be added to this system message." :
              "Agentic capabilities are disabled for this agent."}
          </FormHelperText>
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Prompt Template</FormLabel>
          <HStack mb={2}>
            <Text fontSize="sm">Show placeholder helper</Text>
            <Switch id="show-placeholders" colorScheme="blue" />
          </HStack>
          <Textarea
            value={agent.prompt_template || ''}
            onChange={(e) => handleChange('prompt_template', e.target.value)}
            placeholder="Enter the prompt template with placeholders like {input}"
            rows={6}
          />
          <FormHelperText>
            Use placeholders: {'{input}'} (user query), {'{previous_outputs}'} (outputs from other agents),  
            {'{worker_outputs}'} (for supervisors), {'{hub_output}'} (for spoke agents)
          </FormHelperText>
        </FormControl>
        
        <FormControl mt={4}>
          <FormLabel>Available Tools</FormLabel>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4}>
            <Box>
              <Switch 
                id="tool-retrieve" 
                isChecked={agent.tools && agent.tools.includes('retrieve_information')}
                onChange={(e) => {
                  const tools = agent.tools || [];
                  if (e.target.checked) {
                    if (!tools.includes('retrieve_information')) {
                      handleChange('tools', [...tools, 'retrieve_information']);
                    }
                  } else {
                    handleChange('tools', tools.filter(t => t !== 'retrieve_information'));
                  }
                }}
                colorScheme="teal"
              />
              <FormLabel htmlFor="tool-retrieve" fontSize="sm" ml={2}>
                Knowledge Retrieval
              </FormLabel>
            </Box>
            
            <Box>
              <Switch 
                id="tool-web" 
                isChecked={
