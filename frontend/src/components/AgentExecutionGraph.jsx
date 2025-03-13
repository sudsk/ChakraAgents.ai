import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  Heading, 
  Badge, 
  IconButton, 
  HStack, 
  VStack, 
  Tooltip, 
  Card, 
  CardBody, 
  CardHeader,
  Divider,
  Select,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  useColorModeValue,
  Button
} from '@chakra-ui/react';
import { 
  FiZoomIn, 
  FiZoomOut, 
  FiRefreshCw, 
  FiMaximize2, 
  FiDownload,
  FiShare2,
  FiInfo
} from 'react-icons/fi';

// Graph rendering utility functions
const createNodePositions = (nodes, width, height, radius = null) => {
  const nodePositions = {};
  const nodeCount = nodes.length;
  const calculatedRadius = radius || Math.min(width, height) * 0.35;
  
  nodes.forEach((node, index) => {
    const angleStep = (2 * Math.PI) / nodeCount;
    const angle = index * angleStep;
    
    nodePositions[node] = {
      x: width / 2 + calculatedRadius * Math.cos(angle),
      y: height / 2 + calculatedRadius * Math.sin(angle),
      node
    };
  });
  
  return nodePositions;
};

const drawEdges = (
  ctx, 
  nodePositions, 
  edges, 
  color = '#aaa', 
  width = 2,
  arrowSize = 10,
  selectedEdge = null
) => {
  Object.entries(edges).forEach(([source, targets]) => {
    const sourcePos = nodePositions[source];
    
    if (!sourcePos) return;
    
    targets.forEach(target => {
      const targetPos = nodePositions[target];
      
      if (!targetPos) return;
      
      // Check if this edge is selected
      const isSelected = selectedEdge && 
        selectedEdge.source === source && 
        selectedEdge.target === target;
      
      // Set line style based on selection
      ctx.strokeStyle = isSelected ? '#e53e3e' : color;
      ctx.lineWidth = isSelected ? width + 2 : width;
      
      // Draw line
      ctx.beginPath();
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.stroke();
      
      // Calculate arrow angle and position
      const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
      const distance = Math.sqrt(
        Math.pow(targetPos.x - sourcePos.x, 2) + 
        Math.pow(targetPos.y - sourcePos.y, 2)
      );
      
      // Make sure arrow isn't drawn on top of node
      const arrowDistance = distance - 20; // 20px away from target
      
      if (arrowDistance <= 0) return; // Skip arrow if nodes are too close
      
      const arrowX = sourcePos.x + arrowDistance * Math.cos(angle);
      const arrowY = sourcePos.y + arrowDistance * Math.sin(angle);
      
      // Draw arrow
      ctx.fillStyle = isSelected ? '#e53e3e' : color;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle - Math.PI/6),
        arrowY - arrowSize * Math.sin(angle - Math.PI/6)
      );
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle + Math.PI/6),
        arrowY - arrowSize * Math.sin(angle + Math.PI/6)
      );
      ctx.closePath();
      ctx.fill();
    });
  });
};

const drawNodes = (
  ctx, 
  nodePositions, 
  nodeData = {}, 
  selectedNode = null,
  nodeSize = 15,
  labelOffset = 25
) => {
  Object.values(nodePositions).forEach(pos => {
    const node = pos.node;
    const nodeInfo = nodeData[node] || {};
    
    // Determine node color based on role
    let color = '#3182CE'; // default blue
    
    if (nodeInfo.role) {
      if (nodeInfo.role === 'supervisor') color = '#8884d8'; // purple
      else if (nodeInfo.role === 'worker') color = '#82ca9d'; // green
      else if (nodeInfo.role === 'hub') color = '#ff7c43'; // orange
      else if (nodeInfo.role === 'rag') color = '#ffa600'; // amber
    }
    
    // Check if node is selected
    const isSelected = selectedNode === node;
    
    // Draw highlight for selected node
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeSize + 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(229, 62, 62, 0.3)';
      ctx.fill();
    }
    
    // Draw node
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Add border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw label
    ctx.font = '12px Arial';
    ctx.fillStyle = isSelected ? '#e53e3e' : '#333';
    ctx.textAlign = 'center';
    ctx.fillText(
      node.length > 15 ? node.slice(0, 13) + '...' : node, 
      pos.x, 
      pos.y + labelOffset
    );
  });
};

const downloadCanvasAsImage = (canvas, filename = 'agent-graph.png') => {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

// Main component
const AgentExecutionGraph = ({ 
  executionGraph = {}, 
  agentData = [], 
  height = "500px",
  onNodeSelect = null,
  onEdgeSelect = null
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [layoutType, setLayoutType] = useState('circle');
  const [nodePositions, setNodePositions] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  
  // Convert agentData array to a map for easy lookup
  const agentDataMap = {};
  agentData.forEach(agent => {
    agentDataMap[agent.agent] = agent;
  });
  
  // Get all unique nodes from the graph
  const getUniqueNodes = () => {
    const nodes = new Set();
    
    Object.entries(executionGraph).forEach(([source, targets]) => {
      nodes.add(source);
      
      if (Array.isArray(targets)) {
        targets.forEach(target => nodes.add(target));
      }
    });
    
    return Array.from(nodes);
  };
  
  // Update dimensions when container size changes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);
  
  // Initialize node positions when graph or dimensions change
  useEffect(() => {
    if (!executionGraph || Object.keys(executionGraph).length === 0) return;
    
    const nodes = getUniqueNodes();
    
    // Create node positions based on layout type
    if (layoutType === 'circle') {
      setNodePositions(createNodePositions(nodes, dimensions.width, dimensions.height));
    } else if (layoutType === 'hierarchical') {
      // A simple hierarchical layout
      const supervisors = nodes.filter(node => 
        agentDataMap[node]?.role === 'supervisor' || 
        node.includes('supervisor')
      );
      
      const workers = nodes.filter(node => 
        !supervisors.includes(node)
      );
      
      const positions = {};
      
      // Position supervisors at the top
      supervisors.forEach((node, index) => {
        const x = dimensions.width / 2;
        const y = dimensions.height * 0.25;
        positions[node] = { x, y, node };
      });
      
      // Position workers in a row below
      const workerStep = dimensions.width / (workers.length + 1);
      workers.forEach((node, index) => {
        const x = workerStep * (index + 1);
        const y = dimensions.height * 0.75;
        positions[node] = { x, y, node };
      });
      
      setNodePositions(positions);
    }
  }, [executionGraph, dimensions, layoutType, agentDataMap]);
  
  // Draw the graph when node positions or zoom changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || Object.keys(nodePositions).length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Apply zoom
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);
    
    // Draw edges
    drawEdges(ctx, nodePositions, executionGraph, '#aaa', 2, 10, selectedEdge);
    
    // Draw nodes
    drawNodes(ctx, nodePositions, agentDataMap, selectedNode);
    
    ctx.restore();
  }, [nodePositions, zoom, dimensions, executionGraph, agentDataMap, selectedNode, selectedEdge]);
  
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
  
  // Handle layout change
  const handleLayoutChange = (e) => {
    setLayoutType(e.target.value);
  };
  
  // Handle node click
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    // Find if a node was clicked
    let clickedNode = null;
    Object.entries(nodePositions).forEach(([node, pos]) => {
      const distance = Math.sqrt(
        Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2)
      );
      
      if (distance <= 15) { // 15 is the node radius
        clickedNode = node;
      }
    });
    
    // If a node was clicked, select it
    if (clickedNode) {
      setSelectedNode(clickedNode);
      setSelectedEdge(null);
      
      // Call external handler if provided
      if (onNodeSelect) {
        onNodeSelect(clickedNode, agentDataMap[clickedNode]);
      }
      return;
    }
    
    // If no node was clicked, check if an edge was clicked
    let clickedEdge = null;
    Object.entries(executionGraph).forEach(([source, targets]) => {
      const sourcePos = nodePositions[source];
      
      if (!sourcePos) return;
      
      targets.forEach(target => {
        const targetPos = nodePositions[target];
        
        if (!targetPos) return;
        
        // Check if click is near this edge
        const isNearEdge = isPointNearLine(
          x, y, sourcePos.x, sourcePos.y, targetPos.x, targetPos.y
        );
        
        if (isNearEdge) {
          clickedEdge = { source, target };
        }
      });
    });
    
    // If an edge was clicked, select it
    if (clickedEdge) {
      setSelectedEdge(clickedEdge);
      setSelectedNode(null);
      
      // Call external handler if provided
      if (onEdgeSelect) {
        onEdgeSelect(clickedEdge);
      }
      return;
    }
    
    // If nothing was clicked, clear selection
    setSelectedNode(null);
    setSelectedEdge(null);
  };
  
  // Check if a point is near a line (for edge selection)
  const isPointNearLine = (px, py, x1, y1, x2, y2, threshold = 10) => {
    // Calculate distance from point to line
    const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    
    if (lineLength === 0) return false;
    
    const distance = Math.abs(
      (y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1
    ) / lineLength;
    
    // Check if distance is within threshold
    if (distance > threshold) return false;
    
    // Check if point is within the bounding box of the line
    const minX = Math.min(x1, x2) - threshold;
    const maxX = Math.max(x1, x2) + threshold;
    const minY = Math.min(y1, y2) - threshold;
    const maxY = Math.max(y1, y2) + threshold;
    
    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  };
  
  // Handle mouse down for node dragging
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    // Find if a node was clicked
    let clickedNode = null;
    Object.entries(nodePositions).forEach(([node, pos]) => {
      const distance = Math.sqrt(
        Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2)
      );
      
      if (distance <= 15) { // 15 is the node radius
        clickedNode = node;
      }
    });
    
    if (clickedNode) {
      setIsDragging(true);
      setDragNode(clickedNode);
      setSelectedNode(clickedNode);
    }
  };
  
  // Handle mouse move for node dragging
  const handleMouseMove = (e) => {
    if (!isDragging || !dragNode) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    // Update node position
    setNodePositions(prev => ({
      ...prev,
      [dragNode]: {
        ...prev[dragNode],
        x,
        y
      }
    }));
  };
  
  // Handle mouse up for node dragging
  const handleMouseUp = () => {
    setIsDragging(false);
    setDragNode(null);
  };
  
  // Export graph as PNG
  const handleExportGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    downloadCanvasAsImage(canvas, 'agent-execution-graph.png');
  };
  
  return (
    <Card height={height} width="100%" bg={bgColor}>
      <CardHeader pb={2}>
        <HStack justifyContent="space-between">
          <HStack>
            <Heading size="md">Execution Graph</Heading>
            <Badge colorScheme="purple">Dynamic Agent Routing</Badge>
          </HStack>
          
          <HStack>
            <Select 
              size="sm" 
              width="150px" 
              value={layoutType}
              onChange={handleLayoutChange}
            >
              <option value="circle">Circle Layout</option>
              <option value="hierarchical">Hierarchical</option>
            </Select>
            
            <Tooltip label="Zoom In">
              <IconButton
                icon={<FiZoomIn />}
                aria-label="Zoom in"
                size="sm"
                onClick={handleZoomIn}
              />
            </Tooltip>
            
            <Tooltip label="Zoom Out">
              <IconButton
                icon={<FiZoomOut />}
                aria-label="Zoom out"
                size="sm"
                onClick={handleZoomOut}
              />
            </Tooltip>
            
            <Tooltip label="Reset View">
              <IconButton
                icon={<FiRefreshCw />}
                aria-label="Reset view"
                size="sm"
                onClick={handleResetZoom}
              />
            </Tooltip>
            
            <Tooltip label="Export as PNG">
              <IconButton
                icon={<FiDownload />}
                aria-label="Export as PNG"
                size="sm"
                onClick={handleExportGraph}
              />
            </Tooltip>
          </HStack>
        </HStack>
      </CardHeader>
      <CardBody position="relative" ref={containerRef}>
        {Object.keys(executionGraph).length > 0 ? (
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ 
              width: '100%', 
              height: '100%',
              cursor: isDragging ? 'grabbing' : 'default'
            }}
          />
        ) : (
          <Flex
            direction="column"
            align="center"
            justify="center"
            height="100%"
          >
            <Box fontSize="4xl" color="gray.400" mb={4}>
              <FiShare2 />
            </Box>
            <Text color="gray.500">No execution graph available</Text>
          </Flex>
        )}
        
        {/* Selected node info */}
        {selectedNode && (
          <Box
            position="absolute"
            bottom={4}
            left={4}
            bg="white"
            boxShadow="md"
            borderRadius="md"
            p={3}
            borderWidth="1px"
            width="250px"
          >
            <Heading size="sm" mb={2}>{selectedNode}</Heading>
            
            {agentDataMap[selectedNode] ? (
              <VStack align="start" spacing={1}>
                <HStack>
                  <Text fontWeight="bold" fontSize="xs">Role:</Text>
                  <Badge colorScheme={
                    agentDataMap[selectedNode].role === 'supervisor' ? 'purple' :
                    agentDataMap[selectedNode].role === 'worker' ? 'green' : 'blue'
                  }>
                    {agentDataMap[selectedNode].role || 'unknown'}
                  </Badge>
                </HStack>
                
                {agentDataMap[selectedNode].model && (
                  <HStack>
                    <Text fontWeight="bold" fontSize="xs">Model:</Text>
                    <Text fontSize="xs">{agentDataMap[selectedNode].model}</Text>
                  </HStack>
                )}
                
                {agentDataMap[selectedNode].messages_processed && (
                  <HStack>
                    <Text fontWeight="bold" fontSize="xs">Messages:</Text>
                    <Text fontSize="xs">{agentDataMap[selectedNode].messages_processed}</Text>
                  </HStack>
                )}
              </VStack>
            ) : (
              <Text fontSize="xs" color="gray.500">No additional information available</Text>
            )}
          </Box>
        )}
        
        {/* Selected edge info */}
        {selectedEdge && (
          <Box
            position="absolute"
            bottom={4}
            left={4}
            bg="white"
            boxShadow="md"
            borderRadius="md"
            p={3}
            borderWidth="1px"
            width="250px"
          >
            <Heading size="sm" mb={2}>Agent Delegation</Heading>
            <Text fontSize="sm" mb={1}>
              <Badge colorScheme="purple" mr={1}>{selectedEdge.source}</Badge>
              delegates to
              <Badge colorScheme="green" ml={1}>{selectedEdge.target}</Badge>
            </Text>
          </Box>
        )}
      </CardBody>
    </Card>
  );
};

export default AgentExecutionGraph;
