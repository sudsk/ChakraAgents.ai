# Samkhya.ai

A platform for creating, deploying, and managing multi-agent AI workflows using LangChain and LangGraph.

## Overview

Agentic AI as a Service is a platform that allows users to create and manage complex AI agent systems using templates. It supports both "supervisor" (hierarchical) and "swarm" (collaborative) architectures for multi-agent systems.

Key features:
- Template-based agent creation
- Support for multiple LLM providers (Vertex AI, OpenAI, Anthropic)
- Customizable agent workflows
- Real-time execution monitoring
- Tool integration for enhanced agent capabilities

## Architecture

The platform consists of:

- **Frontend**: React application with Chakra UI components
- **Backend**: FastAPI service with LangChain/LangGraph integration
- **Database**: SQL database for storing templates, workflows, and executions
- **Model Integration**: Support for Vertex AI, OpenAI, Anthropic, and other LLM providers

## Requirements

### Backend
- Python 3.10+
- FastAPI
- LangChain
- LangGraph
- SQL Database (PostgreSQL recommended for production)

### Frontend
- Node.js 16+
- React 18
- Chakra UI
- Recharts for visualizations

### Infrastructure
- Google Cloud Platform for deployment
- Cloud Run for containerized services
- Cloud SQL for database (optional)
- Docker for containerization

## Setup

### Backend Setup

1. Clone the repository
   ```bash
   git clone https://github.com/sudsk/samkhya.ai.git
   cd samkhya.ai/backend
   ```

2. Create and activate a virtual environment
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies
   ```bash
   pip install -r requirements.txt
   ```

4. Copy environment variables example and configure
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Run the application
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. Navigate to the frontend directory
   ```bash
   cd ../frontend
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Copy environment variables example and configure
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the development server
   ```bash
   npm start
   ```

## Deployment on Google Cloud Platform

### Setup Google Cloud Project

1. Create a new GCP project or select an existing one
   ```bash
   gcloud projects create agentic-ai-project --name="Agentic AI Service"
   gcloud config set project agentic-ai-project
   ```

2. Enable required APIs
   ```bash
   gcloud services enable cloudrun.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable artifactregistry.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   gcloud services enable aiplatform.googleapis.com
   ```

3. Create a service account for deployment
   ```bash
   gcloud iam service-accounts create agentic-ai-service
   gcloud projects add-iam-policy-binding agentic-ai-project \
     --member="serviceAccount:agentic-ai-service@agentic-ai-project.iam.gserviceaccount.com" \
     --role="roles/run.admin"
   ```

### Deployment Script

Update the `deployment/deploy.sh` script with your GCP project ID and run:

```bash
cd deployment
chmod +x deploy.sh
./deploy.sh
```

This will:
1. Build and deploy the backend service to Cloud Run
2. Configure environment variables for the backend
3. Build and deploy the frontend service to Cloud Run
4. Set up networking between the services

## API Documentation

The API documentation is available at `/docs` or `/redoc` endpoints when the backend server is running. It is automatically generated from the FastAPI code.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
