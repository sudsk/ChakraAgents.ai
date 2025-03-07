// src/components/Layout.jsx
import React from 'react';
import { Box, Flex, useDisclosure, Outlet } from '@chakra-ui/react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = () => {
  // For mobile sidebar control
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Flex h="100vh">
      <Sidebar isOpen={isOpen} onClose={onClose} display={{ base: 'none', md: 'block' }} />
      <Box flex="1" overflow="auto">
        <Header onOpenSidebar={onOpen} />
        <Box as="main" p={5}>
          <Outlet /> {/* This is where the route content will be rendered */}
        </Box>
      </Box>
    </Flex>
  );
};

export default Layout;
