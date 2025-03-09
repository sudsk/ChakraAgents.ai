// src/components/Header.jsx
import React from 'react';
import { 
  Flex, IconButton, InputGroup, Input, 
  InputLeftElement, Spacer, Menu,
  MenuButton, MenuList, MenuItem, Avatar,
  Text, HStack, useColorMode, useBreakpointValue
} from '@chakra-ui/react';
import { 
  FiBell, FiSearch, FiChevronDown, 
  FiUser, FiLogOut, FiSettings, FiMoon, FiSun, FiMenu
} from 'react-icons/fi';
import authService from '../services/auth';

const Header = ({ onOpenSidebar }) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const showMobileMenu = useBreakpointValue({ base: true, md: false });
  const currentUser = authService.getCurrentUser() || { name: 'User' };
  
  const handleLogout = () => {
    authService.logout();
  };
  
  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      w="100%"
      px={5}
      py={4}
      borderBottomWidth="1px"
      borderColor="gray.200"
      bg="white"
    >
      {showMobileMenu && (
        <IconButton
          variant="ghost"
          icon={<FiMenu />}
          onClick={onOpenSidebar}
          aria-label="Open Menu"
          mr={2}
        />
      )}
      
      <InputGroup w={{ base: "auto", md: "400px" }} size="md">
        <InputLeftElement pointerEvents="none">
          <FiSearch color="#A0AEC0" />
        </InputLeftElement>
        <Input
          placeholder="Search workflows, templates..."
          borderRadius="md"
          _placeholder={{ color: 'gray.400' }}
        />
      </InputGroup>
      
      <Spacer />
      
      <HStack spacing={4}>
        <IconButton
          aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
          icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
          variant="ghost"
          onClick={toggleColorMode}
          size="md"
        />
        
        <IconButton
          aria-label="Notifications"
          icon={<FiBell />}
          variant="ghost"
          size="md"
        />
        
        <Menu>
          <MenuButton>
            <HStack>
              <Avatar size="sm" name={currentUser.name} src={currentUser.avatar || ""} />
              <Text fontSize="sm" fontWeight="medium" display={{ base: 'none', md: 'block' }}>
                {currentUser.name}
              </Text>
              <FiChevronDown size="16px" />
            </HStack>
          </MenuButton>
          <MenuList>
            <MenuItem icon={<FiUser />}>Profile</MenuItem>
            <MenuItem icon={<FiSettings />}>Account Settings</MenuItem>
            <MenuItem icon={<FiLogOut />} onClick={handleLogout}>Logout</MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
};

export default Header;
