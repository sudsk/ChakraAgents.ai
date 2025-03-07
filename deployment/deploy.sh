#!/bin/bash
# deploy.sh - Deploy to Google Cloud Run

# Set variables
PROJECT_ID="YOUR_GCP_PROJECT_ID"
REGION="us-central1"
BACKEND_SERVICE_NAME="agentic-ai-backend"
FRONTEND_SERVICE_NAME="agentic-ai-frontend"

# Ensure we're in the correct project
gcloud config set project $PROJECT_ID

echo "Building and deploying backend..."

# Navigate to backend directory
cd backend

# Build and push backend container
gcloud builds submit --tag gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME

# Deploy backend to Cloud Run
gcloud run deploy $BACKEND_SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 3600 \
  --set-env-vars="DATABASE_URL=YOUR_DATABASE_CONNECTION_STRING"

# Get the backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
echo "Backend deployed at: $BACKEND_URL"

echo "Building and deploying frontend..."

# Navigate to frontend directory
cd ../frontend

# Build and push frontend container
gcloud builds submit --tag gcr.io/$PROJECT_ID/$FRONTEND_SERVICE_NAME \
  --build-arg REACT_APP_API_URL=$BACKEND_URL

# Deploy frontend to Cloud Run
gcloud run deploy $FRONTEND_SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$FRONTEND_SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

# Get the frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
echo "Frontend deployed at: $FRONTEND_URL"

echo "Deployment complete!"
echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
