-- deployment/db-init.sql
-- Initial database setup script for PostgreSQL

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create agentic_ai database if not exists
-- Note: This must be run as a database administrator
-- CREATE DATABASE agentic_ai;

-- Create initial admin user
-- Password is 'admin' - change this in production!
INSERT INTO users (id, username, email, full_name, hashed_password, is_active, is_admin)
VALUES 
  (uuid_generate_v4(), 'admin', 'admin@example.com', 'Admin User', 
   '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 
   true, true)
ON CONFLICT (username) DO NOTHING;

-- Create some default templates
INSERT INTO templates (id, name, description, workflow_type, created_by_id, config)
SELECT 
  uuid_generate_v4(), 
  'Research Assistant', 
  'A template for research tasks with information retrieval, analysis, and fact-checking capabilities',
  'supervisor',
  (SELECT id FROM users WHERE username = 'admin'),
  '{
    "supervisor": {
      "name": "research_supervisor",
      "role": "supervisor",
      "model_provider": "vertex_ai",
      "model_name": "gemini-1.5-pro",
      "prompt_template": "You are a research supervisor coordinating a team of specialized agents.\nYour job is to break down the user query and delegate to appropriate workers.\n\nUser query: {input}",
      "temperature": 0.3,
      "max_tokens": 1024
    },
    "workers": [
      {
        "name": "information_retriever",
        "role": "worker",
        "model_provider": "vertex_ai",
        "model_name": "gemini-1.5-flash",
        "prompt_template": "You are an information retrieval specialist.\nSearch for accurate information related to: {input}",
        "temperature": 0.3,
        "tools": ["web_search"]
      },
      {
        "name": "analyst",
        "role": "worker",
        "model_provider": "vertex_ai",
        "model_name": "gemini-1.5-pro",
        "prompt_template": "You are a data analyst.\nAnalyze this information and provide insights: {input}",
        "temperature": 0.4,
        "tools": ["analyze_data"]
      },
      {
        "name": "fact_checker",
        "role": "worker",
        "model_provider": "vertex_ai",
        "model_name": "gemini-1.5-flash",
        "prompt_template": "You are a fact-checking specialist.\nVerify these claims: {input}",
        "temperature": 0.2,
        "tools": ["web_search"]
      }
    ],
    "tools": [
      {
        "name": "web_search",
        "description": "Search the web for information",
        "function_name": "search_web",
        "parameters": {
          "query": {
            "type": "string",
            "description": "The search query"
          }
        }
      },
      {
        "name": "analyze_data",
        "description": "Analyze structured data",
        "function_name": "analyze_data",
        "parameters": {
          "data": {
            "type": "string",
            "description": "The data to analyze"
          },
          "analysis_type": {
            "type": "string",
            "description": "Type of analysis to perform"
          }
        }
      }
    ],
    "workflow_config": {
      "max_iterations": 5,
      "checkpoint_dir": "./checkpoints/research_assistant"
    }
  }'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE name = 'Research Assistant'
);

INSERT INTO templates (id, name, description, workflow_type, created_by_id, config)
SELECT 
  uuid_generate_v4(), 
  'Writing Assistant', 
  'A collaborative writing assistant with planning, writing, editing, and research capabilities',
  'swarm',
  (SELECT id FROM users WHERE username = 'admin'),
  '{
    "agents": [
      {
        "name": "content_planner",
        "role": "planner",
        "model_provider": "vertex_ai",
        "model_name": "gemini-1.5-pro",
        "prompt_template": "You are a content planner.\nCreate an outline for: {input}\nPrevious outputs: {previous_outputs}",
        "temperature": 0.4
      },
      {
        "name": "writer",
        "role": "executor",
        "model_provider": "vertex_ai",
        "model_name": "gemini-1.5-pro",
        "prompt_template": "You are a creative writer.\nWrite content based on: {input}\nOutline: {previous_outputs}",
        "temperature": 0.7
      },
      {
        "name": "editor",
        "role": "critic",
        "model_provider": "vertex_ai",
        "model_name": "gemini-1.5-pro",
        "prompt_template": "You are an editor.\nReview and improve: {previous_outputs}\nOriginal request: {input}",
        "temperature": 0.3
      },
      {
        "name": "fact_researcher",
        "role": "researcher",
        "model_provider": "vertex_ai",
        "model_name": "gemini-1.5-flash",
        "prompt_template": "You are a fact researcher.\nFind relevant information for: {input}\nContext: {previous_outputs}",
        "temperature": 0.3,
        "tools": ["web_search"]
      }
    ],
    "tools": [
      {
        "name": "web_search",
        "description": "Search the web for information",
        "function_name": "search_web",
        "parameters": {
          "query": {
            "type": "string",
            "description": "The search query"
          }
        }
      }
    ],
    "workflow_config": {
      "interaction_type": "sequential",
      "checkpoint_dir": "./checkpoints/writing_assistant"
    }
  }'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE name = 'Writing Assistant'
);
