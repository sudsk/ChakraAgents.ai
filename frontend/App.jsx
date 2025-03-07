// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';

// Pages
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import TemplateEditor from './pages/TemplateEditor';
import Workflows from './pages/Workflows';
import WorkflowExecution from './pages/WorkflowExecution';
import Settings from './pages/Settings';
import Login from './pages/Login';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Services
import authService from './services/auth';

// Theme configuration
const theme = extendTheme({
  colors: {
    brand: {
      50: '#e6f6ff',
      100: '#b3e0ff',
      200: '#80cbff',
      300: '#4db5ff',
      400: '#1a9fff',
      500: '#0088e6',
      600: '#006bb3',
      700: '#004d80',
      800: '#00304d',
      900: '#00131a',
    },
  },
  fonts: {
    heading: "'Inter', sans-serif",
    body: "'Inter', sans-serif",
  },
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
});

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/templates" element={
              <ProtectedRoute>
                <Templates />
              </ProtectedRoute>
            } />
            
            <Route path="/templates/new" element={
              <ProtectedRoute>
                <TemplateEditor />
              </ProtectedRoute>
            } />
            
            <Route path="/templates/:id" element={
              <ProtectedRoute>
                <TemplateEditor />
              </ProtectedRoute>
            } />
            
            <Route path="/workflows" element={
              <ProtectedRoute>
                <Workflows />
              </ProtectedRoute>
            } />
            
            <Route path="/workflows/:id/execution/:executionId" element={
              <ProtectedRoute>
                <WorkflowExecution />
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
