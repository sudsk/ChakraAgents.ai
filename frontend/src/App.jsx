// frontend/src/App.jsx with agentic routes integrated
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

// New Agentic Pages
import AgenticDashboard from './pages/AgenticDashboard';
import RunAgenticWorkflow from './pages/RunAgenticWorkflow';
import AgenticWorkflowCreator from './pages/AgenticWorkflowCreator';
import AgenticWorkflowExecution from './pages/AgenticWorkflowExecution';
import AgenticToolsManager from './pages/AgenticToolsManager';

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
    purple: {
      50: '#f3e8ff',
      100: '#e4ccff',
      200: '#d3afff',
      300: '#c392ff',
      400: '#b375ff',
      500: '#9f58ff',
      600: '#8c3dff',
      700: '#7922ff',
      800: '#6600ff',
      900: '#5200cc',
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
            {/* Original Routes */}
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
            
            {/* New Agentic Routes */}
            <Route path="/agentic" element={
              <ProtectedRoute>
                <AgenticDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/agentic/tools" element={
              <ProtectedRoute>
                <AgenticToolsManager />
              </ProtectedRoute>
            } />
            
            <Route path="/agentic/workflows/new" element={
              <ProtectedRoute>
                <AgenticWorkflowCreator />
              </ProtectedRoute>
            } />
            
            <Route path="/agentic/workflows/:id/edit" element={
              <ProtectedRoute>
                <AgenticWorkflowCreator />
              </ProtectedRoute>
            } />
            
            <Route path="/workflows/:workflowId/run" element={
              <ProtectedRoute>
                <RunAgenticWorkflow />
              </ProtectedRoute>
            } />
            
            <Route path="/workflows/:workflowId/execution/:executionId" element={
              <ProtectedRoute>
                <AgenticWorkflowExecution />
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
