import React, { useState, useEffect, useRef } from 'react';
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
  IconButton,
  Tooltip,
  Select,
  useColorModeValue,
  Divider,
  Spinner
} from '@chakra-ui/react';
import { 
  FiZoomIn, 
  FiZoomOut, 
  FiMaximize2, 
  FiDownload,
  FiRefreshCw 
} from 'react-icons/fi';

// Simulate D3.js-like functionality for network visualization
// In a real implementation, you'd likely use D3.js or a similar library
const WorkflowGraphVisualization = ({ executionGraph, agentData = [] }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const nodeColor = useColorModeValue('#3182CE', '#63B3ED');
  const linkColor = useColorModeValue('#CBD5E0', '#4A5568');
  const selectedColor = useColorModeValue('#E53E3E', '#FC8181');
  
  // Process the graph data
  useEffect(() => {
    if (!executionGraph || Object.keys(executionGraph).length === 0) {
      setNodes([]);
      setLinks([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Create nodes array
      const nodeSet = new Set();
      
      // Add all sources and targets
      Object.entries(executionGraph).forEach(([source, targets]) => {
        nodeSet.add(source);
        
        if (Array.isArray(targets)) {
          targets.forEach(target => nodeSet.add(target));
        }
      });
      
      // Create nodes with positions
      const nodeArray = Array.from(nodeSet).map((id, index) => {
        // Get info about this agent from agentData if available
        const agentInfo = agentData.find(agent => agent.agent === id);
        const role = agentInfo?.role || 'unknown';
        
        // Create positions in a circle layout
        const nodeCount = nodeSet.size;
        const angleStep = (2 * Math.PI) / nodeCount;
        const angle = index * angleStep;
        const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
        
        return {
          id,
          x: dimensions.width / 2 + radius * Math.cos(angle),
          y: dimensions.height / 2 + radius * Math.sin(angle),
          role,
          model: agentInfo?.model || 'unknown',
          outputLength: agentInfo?.output_length || 0
        };
      });
      
      // Create links
      const linkArray = [];
      
      Object.entries(executionGraph).forEach(([source, targets]) => {
        if (Array.isArray(targets)) {
          targets.forEach(target => {
            linkArray.push({
              source,
              target,
              value: 1 // Could be weighted in a real implementation
            });
          });
        }
      });
      
      setNodes(nodeArray);
      setLinks(linkArray);
      setLoading(false);
      
      // Draw the graph when data is ready
      setTimeout(() => {
        drawGraph();
      }, 100);
      
    } catch (error) {
      console.error('Error processing graph data:', error);
      setLoading(false);
    }
  }, [executionGraph, agentData, dimensions]);
  
  // Update dimensions when container resizes
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      };
      
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      
      return () => {
        window.removeEventListener('resize', updateDimensions);
      };
    }
  }, []);
  
  // Draw the graph on canvas
  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Apply zoom
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);
    
    // Draw links
    ctx.strokeStyle = linkColor;
    ctx.lineWidth = 2;
    
    links.forEach(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);
      
      if (sourceNode && targetNode) {
        // Draw link
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.stroke();
        
        // Draw arrow
        const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x);
        const arrowLength = 10;
        const arrowX = targetNode.x - 15 * Math.cos(angle);
        const arrowY = targetNode.y - 15 * Math.sin(angle);
        
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
          arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
          arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = linkColor;
        ctx.fill();
      }
    });
    
    // Draw nodes
    nodes.forEach(node => {
      // Node color based on role
      let color = nodeColor;
      if (node.role === 'supervisor') {
        color = '#8884d8'; // Purple
      } else if (node.role === 'worker') {
        color = '#82ca9d'; // Green
      } else if (node.role === 'peer') {
        color = '#ffc658'; // Yellow
      }
      
      // Highlight selected node
      if (selectedNode && node.id === selectedNode.id) {
        ctx.shadowColor = selectedColor;
        ctx.shadowBlur = 10;
      }
      
      // Draw circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Draw label
      ctx.font = '12px Arial';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.fillText(node.id.length > 15 ? node.id.slice(0, 13) + '...' : node.id, node.x, node.y + 25);
    });
    
    ctx.restore();
  };
  
  // Handle zoom operations
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };
  
  const handleResetZoom = () => {
    setZoom(1);
  };
  
  // Handle node click
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    // Find if a node was clicked
    const clickedNode = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= 12; // 12 is the node radius
    });
    
    setSelectedNode(clickedNode || null);
  };
  
  // Effect to redraw when zoom changes
  useEffect(() => {
    drawGraph();
  }, [zoom, selectedNode]);
  
  return (
    <Box ref={containerRef} position="relative" height="500px" bg={bgColor} borderRadius="md" borderWidth="1px">
      {loading ? (
        <Flex justify="center" align="center" height="100%">
          <Spinner size="xl" color="blue.500" />
        </Flex>
      ) : nodes.length === 0 ? (
        <Flex justify="center" align="center" height="100%">
          <Text color="gray.500">No graph data available</Text>
        </Flex>
      ) : (
        <>
          <HStack position="absolute" top={4} right={4} zIndex={10}>
            <IconButton
              icon={<FiZoomIn />}
              aria-label="Zoom in"
              size="sm"
              onClick={handleZoomIn}
            />
            <IconButton
              icon={<FiZoomOut />}
              aria-label="Zoom out"
              size="sm"
              onClick={handleZoomOut}
            />
            <IconButton
              icon={<FiRefreshCw />}
              aria-label="Reset zoom"
              size="sm"
              onClick={handleResetZoom}
            />
          </HStack>
          
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            onClick={handleCanvasClick}
            style={{ width: '100%', height: '100%' }}
          />
          
          {selectedNode && (
            <Card
              position="absolute"
              bottom={4}
              left={4}
              width="250px"
              size="sm"
              boxShadow="lg"
            >
              <CardBody py={3}>
                <Text fontWeight="bold">{selectedNode.id}</Text>
                <HStack mt={1}>
                  <Badge colorScheme={
                    selectedNode.role === 'supervisor' ? 'purple' :
                    selectedNode.role === 'worker' ? 'green' : 'blue'
                  }>
                    {selectedNode.role}
                  </Badge>
                  <Text fontSize="xs" color="gray.500">{selectedNode.model}</Text>
                </HStack>
                {selectedNode.outputLength > 0 && (
                  <Text fontSize="xs" mt={1}>
                    Output: {selectedNode.outputLength.toLocaleString()} chars
                  </Text>
                )}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};

// Main component that uses the visualization
const WorkflowGraphComponent = ({ executionData }) => {
  const [executionGraph, setExecutionGraph] = useState({});
  const [agentUsage, setAgentUsage] = useState([]);
  
  useEffect(() => {
    if (executionData?.result) {
      // Extract graph data
      setExecutionGraph(executionData.result.execution_graph || {});
      
      // Extract agent usage data
      setAgentUsage(executionData.result.agent_usage || []);
    }
  }, [executionData]);
  
  // Function to export graph as PNG
  const exportGraphImage = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'workflow-graph.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };
  
  return (
    <Card w="100%">
      <CardHeader pb={0}>
        <HStack justify="space-between">
          <Heading size="md">Workflow Execution Graph</Heading>
          <IconButton
            icon={<FiDownload />}
            aria-label="Download graph"
            size="sm"
            onClick={exportGraphImage}
          />
        </HStack>
      </CardHeader>
      <CardBody>
        <WorkflowGraphVisualization 
          executionGraph={executionGraph} 
          agentData={agentUsage}
        />
        
        <Divider my={4} />
        
        <Box mt={4}>
          <Text fontWeight="bold" mb={2}>Graph Statistics</Text>
          <SimpleStatistics executionGraph={executionGraph} agentUsage={agentUsage} />
        </Box>
      </CardBody>
    </Card>
  );
};

// Component to show simple graph statistics
const SimpleStatistics = ({ executionGraph, agentUsage }) => {
  const nodeCount = Object.keys(getUniqueNodes(executionGraph)).length;
  const linkCount = Object.entries(executionGraph).reduce(
    (count, [_, targets]) => count + (Array.isArray(targets) ? targets.length : 0),
    0
  );
  
  const supervisorCount = agentUsage.filter(a => a.role === 'supervisor').length;
  const workerCount = agentUsage.filter(a => a.role === 'worker').length;
  const peerCount = agentUsage.filter(a => a.role === 'peer').length;
  
  return (
    <HStack spacing={8}>
      <VStack align="start">
        <Text>Total Nodes: {nodeCount}</Text>
        <Text>Total Connections: {linkCount}</Text>
      </VStack>
      
      <VStack align="start">
        <Text>Supervisors: {supervisorCount}</Text>
        <Text>Workers: {workerCount}</Text>
        <Text>Peer Agents: {peerCount}</Text>
      </VStack>
      
      <VStack align="start">
        <Text>Avg. Connections: {nodeCount > 0 ? (linkCount / nodeCount).toFixed(1) : 0}</Text>
      </VStack>
    </HStack>
  );
};

// Helper function to get unique nodes from graph
function getUniqueNodes(executionGraph) {
  const nodes = {};
  
  Object.entries(executionGraph).forEach(([source, targets]) => {
    nodes[source] = true;
    
    if (Array.isArray(targets)) {
      targets.forEach(target => {
        nodes[target] = true;
      });
    }
  });
  
  return nodes;
}

export default WorkflowGraphComponent;
