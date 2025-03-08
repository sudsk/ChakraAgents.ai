/* eslint-disable no-unused-vars */
// src/components/Sidebar.jsx
import React from 'react';
import { Box, VStack, Heading, Icon, Flex, Text, Divider, Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerBody, useBreakpointValue } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FiHome, FiLayout, FiCpu, FiSettings, 
  FiActivity, FiGrid, FiTool, FiBox 
} from 'react-icons/fi';

const SidebarItem = ({ icon, children, to }) => {
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
      </Flex>
    </Link>
  );
};

const SidebarContent = () => (
  <Box
    w="250px"
    h="100vh"
    bg="white"
    borderRight="1px"
    borderColor="gray.200"
    py={5}
  >
    <Flex mb={6} px={5} align="center">
      <Box mr={2} color="brand.500">
        <FiGrid size="24px" />
      </Box>
      <Heading size="md" fontWeight="bold">
        Agentic AI
      </Heading>
    </Flex>
    
    <VStack spacing={1} align="stretch">
      <SidebarItem icon={FiHome} to="/">
        Dashboard
      </SidebarItem>
      <SidebarItem icon={FiLayout} to="/templates">
        Templates
      </SidebarItem>
      <SidebarItem icon={FiCpu} to="/workflows">
        Workflows
      </SidebarItem>
    </VStack>
    
    <Divider my={6} />
    
    <VStack spacing={1} align="stretch">
      <Text px={8} fontSize="xs" fontWeight="bold" color="gray.500" mb={2}>
        ADMIN
      </Text>
      <SidebarItem icon={FiSettings} to="/settings">
        Settings
      </SidebarItem>
    </VStack>
  </Box>
);

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
