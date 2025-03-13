// frontend/src/components/Sidebar.jsx
import React from 'react';
import { Box, VStack, Heading, Icon, Flex, Text, Divider, Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerBody, useBreakpointValue, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon, Badge } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FiHome, FiLayout, FiCpu, FiSettings, 
  FiActivity, FiGrid, FiTool, FiBox,
  FiList, FiShare2, FiMessageCircle, FiDatabase,
  FiCheckSquare, FiHardDrive, FiPlus
} from 'react-icons/fi';

// Navigation item component with active state
const SidebarItem = ({ icon, children, to, badge }) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
  
  return (
    <Link to={to} style={{ width: '100%' }}>
      <Flex
        align="center"
        p={3}
        mx={3}
        borderRadius="md"
        role="group"
        cursor="pointer"
        bg={isActive ? 'brand.50' : 'transparent'}
        color={isActive ? 'brand.500' : 'gray.600'}
        _hover={{ bg: 'brand.50', color: 'brand.500' }}
      >
        <Icon mr={4} fontSize="16" as={icon} />
        <Text fontSize="sm" fontWeight={isActive ? 'bold' : 'medium'}>
          {children}
        </Text>
        {badge && (
          <Badge ml="auto" colorScheme={badge.color || 'purple'} fontSize="xs">
            {badge.text}
          </Badge>
        )}
      </Flex>
    </Link>
  );
};

// Submenu item component
const SubMenuItem = ({ children, to, icon }) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
  
  return (
    <Link to={to} style={{ width: '100%' }}>
      <Flex
        align="center"
        p={2}
        pl={10}
        borderRadius="md"
        role="group"
        cursor="pointer"
        bg={isActive ? 'brand.50' : 'transparent'}
        color={isActive ? 'brand.500' : 'gray.600'}
        _hover={{ bg: 'brand.50', color: 'brand.500' }}
      >
        {icon && <Icon mr={2} fontSize="14" as={icon} />}
        <Text fontSize="sm" fontWeight={isActive ? 'bold' : 'normal'}>
          {children}
        </Text>
      </Flex>
    </Link>
  );
};

// Main sidebar content component
const SidebarContent = () => {
  const location = useLocation();
  // Check if we're in agentic section
  const isAgenticSection = location.pathname.includes('/agentic');
  
  return (
    <Box
      w="250px"
      h="100vh"
      bg="white"
      borderRight="1px"
      borderColor="gray.200"
      pt={5}
      pb={10}
      overflowY="auto"
    >
      <Flex mb={6} px={5} align="center">
        <Box mr={2} color="brand.500">
          <FiGrid size="24px" />
        </Box>
        <Heading size="md" fontWeight="bold">
          ChakraAgents.ai
        </Heading>
      </Flex>
      
      <VStack spacing={1} align="stretch">
        <SidebarItem icon={FiHome} to="/">
          Dashboard
        </SidebarItem>
        
        <SidebarItem icon={FiLayout} to="/templates">
          Templates
        </SidebarItem>
        
        <SidebarItem icon={FiList} to="/workflows">
          Workflows
        </SidebarItem>
        
        {/* Agentic Workflows Section */}
        <Divider my={2} />
        
        <Box px={4} py={1}>
          <Text fontSize="xs" fontWeight="bold" color="gray.500">
            AGENTIC AI
          </Text>
        </Box>
        
        <SidebarItem 
          icon={FiCpu} 
          to="/agentic" 
          badge={{ text: 'New', color: 'purple' }}
        >
          Agentic Dashboard
        </SidebarItem>
        
        <Accordion allowToggle defaultIndex={isAgenticSection ? 0 : -1}>
          <AccordionItem border="none">
            <AccordionButton px={3} py={1}>
              <Flex 
                align="center" 
                width="100%" 
                color="gray.600"
                _hover={{ color: 'brand.500' }}
              >
                <Icon as={FiMessageCircle} mr={4} fontSize="16" />
                <Text fontSize="sm" fontWeight="medium">Agentic Workflows</Text>
              </Flex>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel p={0} pb={1}>
              <SubMenuItem to="/agentic/workflows/new" icon={FiPlus}>
                Create Workflow
              </SubMenuItem>
              <SubMenuItem to="/agentic" icon={FiActivity}>
                Active Executions
              </SubMenuItem>
              <SubMenuItem to="/agentic" icon={FiCheckSquare}>
                Completed Tasks
              </SubMenuItem>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
        
        <SidebarItem icon={FiTool} to="/agentic/tools">
          Agentic Tools
        </SidebarItem>
        
        <SidebarItem icon={FiDatabase} to="/agentic/knowledge">
          Knowledge Base
        </SidebarItem>
        
        <Divider my={2} />
        
        <Box px={4} py={1}>
          <Text fontSize="xs" fontWeight="bold" color="gray.500">
            SYSTEM
          </Text>
        </Box>
        
        <SidebarItem icon={FiSettings} to="/settings">
          Settings
        </SidebarItem>
        
        <SidebarItem icon={FiHardDrive} to="/logs">
          System Logs
        </SidebarItem>
      </VStack>
    </Box>
  );
};

// Sidebar component with responsive behavior
const Sidebar = ({ isOpen, onClose, ...rest }) => {
  const isMobile = useBreakpointValue({ base: true, md: false });

  // For mobile screens, show a drawer
  if (isMobile) {
    return (
      <Drawer
        autoFocus={false}
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerBody p={0}>
            <SidebarContent />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  // For desktop screens, show the sidebar directly
  return <SidebarContent {...rest} />;
};

export default Sidebar;
