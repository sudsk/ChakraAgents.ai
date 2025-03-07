# Backend Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set up environment variables (these would be set in Cloud Run)
ENV PORT=8080
ENV DATABASE_URL="sqlite:///./agentic_ai_service.db"
ENV GOOGLE_APPLICATION_CREDENTIALS="/app/service-account.json"

# Create the database directory
RUN mkdir -p ./checkpoints

# Expose port
EXPOSE 8080

# Run the application with Uvicorn
CMD uvicorn backend_fastapi:app --host 0.0.0.0 --port $PORT
