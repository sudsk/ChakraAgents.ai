import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  Heading, 
  Badge, 
  Button, 
  Icon, 
  IconButton, 
  HStack, 
  VStack, 
  Tooltip, 
  Card, 
  CardBody, 
  Divider, 
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem
} from '@chakra-ui/react';
import { 
  FiMessageCircle, 
  FiCpu, 
  FiArrowRight, 
  FiUser, 
  FiTool, 
  FiMoreVertical, 
  FiDownload, 
  FiZoomIn, 
  FiZoomOut, 
  FiRefreshCw, 
  FiMaximize2, 
  FiPlay,
  FiLayers
} from 'react-icons/fi';

// Agent message component
const AgentMessage = ({ 
  message, 
  expanded = false, 
  onToggleExpand, 
  highlighted = false,
  showToolCalls = true
}) => {
  const { agent, role, content, timestamp, toolCalls, toolResults } = message;
  const MAX_COLLAPSED_HEIGHT = 100;
  
  const cardBg = useColorModeValue('white', 'gray.800');
  const highlightColor = useColorModeValue('blue.50', 'blue.900');
  
  // Get role-based colors
  const getRoleColor = (role, agent) => {
    if (role === 'user') return 'gray';
    if (role === 'final') return 'purple';
    if (agent === 'supervisor' || role === 'supervisor') return 'blue';
    if (agent.includes('worker') || role === 'worker') return 'green';
    if (role === 'rag') return 'teal';
    
    // Default colors based on agent name
    const colors = ['blue', 'green', 'orange', 'purple', 'pink', 'cyan', 'teal'];
    const hash = agent.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  const color = getRoleColor(role, agent);
  const contentRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  
  // Check if content is overflowing when component mounts
  useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > MAX_COLLAPSED_HEIGHT);
    }
  }, [content]);
  
  return (
    <Card
      width="100%"
      bg={highlighted ? highlightColor : cardBg}
      boxShadow="sm"
      borderWidth="1px"
      borderColor={highlighted ? `${color}.300` : "gray.200"}
      borderRadius="md"
      transition="all 0.2s"
      _hover={{ boxShadow: "md" }}
    >
      <CardBody>
        <VStack align="stretch" spacing={2}>
          <HStack>
            <Badge colorScheme={color} fontSize="sm" px={2} py={1}>
              {agent}
            </Badge>
            
            {role === 'final' && (
              <Badge colorScheme="purple" variant="solid">Final Output</Badge>
            )}
            
            {toolCalls && toolCalls.length > 0 && (
              <Badge colorScheme="orange" variant="outline">
                <HStack spacing={1}>
                  <Icon as={FiTool} fontSize="xs" />
                  <Text>{toolCalls.length} tool call{toolCalls.length > 1 ? 's' : ''}</Text>
                </HStack>
              </Badge>
            )}
            
            {timestamp && (
              <Text fontSize="xs" color="gray.500" ml="auto">
                {new Date(timestamp).toLocaleTimeString()}
              </Text>
            )}
          </HStack>
          
          <Box
            ref={contentRef}
            maxH={expanded || !isOverflowing ? "none" : `${MAX_COLLAPSED_HEIGHT}px`}
            overflow="hidden"
            position="relative"
            whiteSpace="pre-wrap"
          >
            <Text fontSize="sm">{content}</Text>
            
            {!expanded && isOverflowing && (
              <Box
                position="absolute"
                bottom="0"
                left="0"
                right="0"
                height="60px"
                bgGradient={useColorModeValue(
                  'linear(to-t, white, transparent)',
                  'linear(to-t, gray.800, transparent)'
                )}
              />
            )}
          </Box>
          
          {isOverflowing && (
            <Button 
              size="xs" 
              onClick={onToggleExpand} 
              variant="outline"
              alignSelf="center"
              mt={1}
            >
              {expanded ? 'Show Less' : 'Show More'}
            </Button>
          )}
          
          {showToolCalls && toolCalls && toolCalls.length > 0 && (
            <Box mt={2}>
              <Divider mb={2} />
              <Heading size="xs" mb={2}>Tool Calls</Heading>
              <VStack align="stretch" spacing={2}>
                {toolCalls.map((tool, index) => (
                  <ToolCallDisplay 
                    key={index} 
                    toolCall={tool} 
                    result={toolResults?.[index]} 
                  />
                ))}
              </VStack>
            </Box>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};

// Tool call display component
const ToolCallDisplay = ({ toolCall, result }) => {
  const [showResult, setShowResult] = useState(false);
  
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const bg = useColorModeValue('gray.50', 'gray.700');
  
  return (
    <Box
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="md"
      bg={bg}
      p={2}
    >
      <HStack justify="space-between" mb={1}>
        <HStack>
          <Icon as={FiTool} color="orange.500" />
          <Text fontWeight="bold" fontSize="sm">{toolCall.name}</Text>
        </HStack>
        <Button
          size="xs"
          rightIcon={showResult ? <FiLayers /> : <FiPlay />}
          onClick={() => setShowResult(!showResult)}
        >
          {showResult ? 'Hide Result' : 'Show Result'}
        </Button>
      </HStack>
      
      <Text fontSize="xs" mb={1}>
        {JSON.stringify(toolCall.parameters)}
      </Text>
      
      {showResult && result && (
        <>
          <Divider my={2} />
          <Text fontSize="xs" fontWeight="bold" mb={1}>Result:</Text>
          <Box
            fontSize="xs"
            bg={useColorModeValue('white', 'gray.800')}
            p={2}
            borderRadius="md"
            fontFamily="monospace"
            whiteSpace="pre-wrap"
            overflowX="auto"
          >
            {typeof result === 'object' ? JSON.stringify(result, null, 2) : result}
          </Box>
        </>
      )}
    </Box>
  );
};

// Decision path component
const DecisionPath = ({ decisions, onSelectDecision }) => {
  return (
    <Box overflowX="auto" pb={2} mb={4}>
      <Flex align="center" minWidth="max-content">
        {decisions.map((decision, index) => (
          <React.Fragment key={index}>
            <Box
              p={2}
              borderWidth="1px"
              borderRadius="md"
              cursor="pointer"
              bg={decision.highlighted ? "blue.50" : "white"}
              borderColor={decision.highlighted ? "blue.300" : "gray.200"}
              onClick={() => onSelectDecision(index)}
              _hover={{ bg: "blue.50" }}
            >
              <Text fontSize="sm" fontWeight={decision.highlighted ? "bold" : "normal"}>
                {decision.agent}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {decision.action_type}
              </Text>
            </Box>
            
            {index < decisions.length - 1 && (
              <Icon as={FiArrowRight} mx={2} color="gray.400" />
            )}
          </React.Fragment>
        ))}
      </Flex>
    </Box>
  );
};

// Main visualization component
const AgentInteractionVisualizer = ({ executionData, height = "600px" }) => {
  const [expandedMessages, setExpandedMessages] = useState({});
  const [selectedDecisionIndex, setSelectedDecisionIndex] = useState(null);
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const messagesEndRef = useRef(null);
  
  // Process execution data when it changes
  useEffect(() => {
    if (!executionData) return;
    
    // Extract agent messages
    const messages = [];
    
    // Add user input as first message if available
    if (executionData.input_data && executionData.input_data.query) {
      messages.push({
        agent: 'user',
        role: 'user',
        content: executionData.input_data.query,
        timestamp: executionData.started_at
      });
    }
    
    // Add agent outputs if available
    if (executionData.result && executionData.result.outputs) {
      Object.entries(executionData.result.outputs).forEach(([agent, output]) => {
        // Skip empty outputs
        if (!output || (typeof output === 'string' && !output.trim())) return;
        
        // For complex outputs with tool calls
        const message = {
          agent,
          role: 'agent',
          timestamp: new Date().toISOString()
        };
        
        if (typeof output === 'object') {
          if (output.content) {
            message.content = output.content;
          } else {
            message.content = JSON.stringify(output, null, 2);
          }
          
          if (output.tool_calls) {
            message.toolCalls = output.tool_calls;
          }
          
          if (output.tool_results) {
            message.toolResults = output.tool_results;
          }
        } else {
          message.content = output;
        }
        
        messages.push(message);
      });
    }
    
    // Add final output if available
    if (executionData.result && executionData.result.final_output) {
      messages.push({
        agent: 'final',
        role: 'final',
        content: executionData.result.final_output,
        timestamp: executionData.completed_at || new Date().toISOString()
      });
    }
    
    // Process decisions if available
    if (executionData.result && executionData.result.decisions) {
      const decisions = executionData.result.decisions.map((decision, index) => ({
        ...decision,
        highlighted: false
      }));
      
      setDecisions(decisions);
    }
    
    setVisibleMessages(messages);
  }, [executionData]);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleMessages]);
  
  // Handle decision selection
  const handleSelectDecision = (index) => {
    // Highlight the selected decision
    const updatedDecisions = decisions.map((decision, i) => ({
      ...decision,
      highlighted: i === index
    }));
    
    setDecisions(updatedDecisions);
    setSelectedDecisionIndex(index);
  };
  
  // Toggle message expansion
  const toggleMessageExpand = (index) => {
    setExpandedMessages(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  
  // Download conversation as JSON
  const downloadConversation = () => {
    // Create downloadable JSON
    const data = {
      messages: visibleMessages,
      decisions: decisions,
      metadata: {
        executionId: executionData?.id,
        startedAt: executionData?.started_at,
        completedAt: executionData?.completed_at,
        status: executionData?.status
      }
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-conversation-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Find which message corresponds to selected decision
  const getMessageForDecision = (decisionIndex) => {
    if (decisionIndex === null || !decisions[decisionIndex]) return null;
    
    const decision = decisions[decisionIndex];
    return visibleMessages.findIndex(
      msg => msg.agent === decision.agent_name && 
             (msg.content || "").includes(decision.content || "")
    );
  };
  
  // Expand all messages
  const expandAllMessages = () => {
    const expandAll = {};
    visibleMessages.forEach((_, index) => {
      expandAll[index] = true;
    });
    setExpandedMessages(expandAll);
  };
  
  // Collapse all messages
  const collapseAllMessages = () => {
    setExpandedMessages({});
  };
  
  const highlightedMessageIndex = getMessageForDecision(selectedDecisionIndex);
  
  return (
    <Card height={height} width="100%" overflow="hidden">
      <CardBody p={0} display="flex" flexDirection="column">
        {/* Header with controls */}
        <Flex 
          justifyContent="space-between" 
          alignItems="center" 
          p={4} 
          borderBottomWidth="1px" 
          borderColor="gray.200"
        >
          <Heading size="md">
            <HStack>
              <Icon as={FiMessageCircle} color="blue.500" />
              <Text>Agent Interactions</Text>
            </HStack>
          </Heading>
          
          <HStack>
            <Tooltip label="Expand All">
              <IconButton 
                icon={<FiMaximize2 />} 
                size="sm" 
                onClick={expandAllMessages}
                aria-label="Expand All"
              />
            </Tooltip>
            
            <Tooltip label="Collapse All">
              <IconButton 
                icon={<FiZoomOut />} 
                size="sm" 
                onClick={collapseAllMessages}
                aria-label="Collapse All"
              />
            </Tooltip>
            
            <Menu>
              <MenuButton 
                as={IconButton} 
                icon={<FiMoreVertical />} 
                size="sm"
                aria-label="More options"
              />
              <MenuList>
                <MenuItem 
                  icon={<FiDownload />} 
                  onClick={downloadConversation}
                >
                  Download Conversation
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>
        
        {/* Decision Path */}
        {decisions.length > 0 && (
          <Box px={4} pt={4}>
            <Heading size="sm" mb={2}>Decision Path</Heading>
            <DecisionPath 
              decisions={decisions} 
              onSelectDecision={handleSelectDecision}
            />
          </Box>
        )}
        
        {/* Message List */}
        <Box 
          flex="1" 
          overflowY="auto" 
          px={4} 
          py={2}
          className="message-container"
        >
          {visibleMessages.length > 0 ? (
            <VStack spacing={4} align="stretch">
              {visibleMessages.map((message, index) => (
                <AgentMessage
                  key={index}
                  message={message}
                  expanded={!!expandedMessages[index]}
                  onToggleExpand={() => toggleMessageExpand(index)}
                  highlighted={index === highlightedMessageIndex}
                />
              ))}
              <div ref={messagesEndRef} />
            </VStack>
          ) : (
            <Flex 
              height="100%" 
              align="center" 
              justify="center" 
              direction="column"
              color="gray.500"
            >
              <Icon as={FiMessageCircle} fontSize="3xl" mb={2} />
              <Text>No agent interactions available</Text>
            </Flex>
          )}
        </Box>
        
        {/* Status footer */}
        <Box p={2} borderTopWidth="1px" borderColor="gray.200" bg="gray.50">
          <HStack spacing={2}>
            <Icon as={FiCpu} color="blue.500" />
            <Text fontSize="sm" fontWeight="medium">
              {visibleMessages.length} messages
            </Text>
            
            {executionData?.status && (
              <Badge 
                colorScheme={
                  executionData.status === 'completed' ? 'green' : 
                  executionData.status === 'running' ? 'blue' : 
                  executionData.status === 'failed' ? 'red' : 'gray'
                }
                ml={2}
              >
                {executionData.status}
              </Badge>
            )}
          </HStack>
        </Box>
      </CardBody>
    </Card>
  );
};

export default AgentInteractionVisualizer;
