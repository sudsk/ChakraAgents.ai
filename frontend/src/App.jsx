// frontend/src/App.jsx - Updated to focus only on agentic routes
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';

// Agentic Pages
import AgenticDashboard from './pages/AgenticDashboard';
import RunAgenticWorkflow from './pages/RunAgenticWorkflow';
import AgenticWorkflowCreator from './pages/AgenticWorkflowCreator';
import AgenticWorkflowExecution from './pages/AgenticWorkflowExecution';
import AgenticToolsManager from './pages/AgenticToolsManager';
import Login from './pages/Login';
import Settings from './pages/Settings';

// Template Pages
import Templates from './pages/Templates';
import TemplateEditor from './pages/TemplateEditor';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

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
            {/* Redirect root to agentic dashboard */}
            <Route path="/" element={<Navigate to="/agentic" replace />} />
            
            {/* Agentic Dashboard */}
            <Route path="/agentic" element={
              <ProtectedRoute>
                <AgenticDashboard />
              </ProtectedRoute>
            } />
            
            {/* Agentic Tool Management */}
            <Route path="/agentic/tools" element={
              <ProtectedRoute>
                <AgenticToolsManager />
              </ProtectedRoute>
            } />
            
            {/* Knowledge Base Page (placeholder for the future) */}
            <Route path="/agentic/knowledge" element={
              <ProtectedRoute>
                <AgenticDashboard />
              </ProtectedRoute>
            } />
            
            {/* Workflow Creation and Editing */}
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
            
            {/* Running Workflows */}
            <Route path="/workflows/:workflowId/run" element={
              <ProtectedRoute>
                <RunAgenticWorkflow />
              </ProtectedRoute>
            } />
            
            {/* Viewing Workflow Executions */}
            <Route path="/workflows/:workflowId/execution/:executionId" element={
              <ProtectedRoute>
                <AgenticWorkflowExecution />
              </ProtectedRoute>
            } />
            
            {/* Settings */}
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            
            {/* System Logs (placeholder for the future) */}
            <Route path="/logs" element={
              <ProtectedRoute>
                <AgenticDashboard />
              </ProtectedRoute>
            } />
          </Route>
          
          {/* Redirect all other routes to the agentic dashboard */}
          <Route path="*" element={<Navigate to="/agentic" replace />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
