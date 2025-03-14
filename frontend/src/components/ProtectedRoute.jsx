// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Flex, Spinner } from '@chakra-ui/react';
import authService from '../services/auth';

const ProtectedRoute = ({ children }) => {
  // When authService.bypassAuth is true, this component will immediately
  // render children without checking authentication
  
  const [isChecking, setIsChecking] = useState(!authService.bypassAuth);
  const [isAuthenticated, setIsAuthenticated] = useState(authService.bypassAuth);
  const location = useLocation();

  useEffect(() => {
    // Skip checking if we're bypassing auth
    if (authService.bypassAuth) {
      return;
    }
    
    const checkAuth = async () => {
      try {
        const authStatus = await authService.checkAuthStatus();
        setIsAuthenticated(authStatus);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, []);

  if (isChecking) {
    return (
      <Flex justify="center" align="center" minH="100vh">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
