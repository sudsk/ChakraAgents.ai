# backend/app/engine/llm_providers.py
import os
import logging
from typing import Dict, Any, List, Optional, Union

# Import provider-specific libraries
try:
    from langchain_openai import ChatOpenAI
    from langchain_google_vertexai import ChatVertexAI
    from langchain_anthropic import ChatAnthropic
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    logging.warning("LangChain libraries not available. Using fallback implementations.")

from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMProviderManager:
    """Manages connections to different LLM providers"""
    
    def __init__(self):
        self.providers = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize connections to available LLM providers"""
        # Initialize Vertex AI if configured
        if settings.VERTEX_AI_PROJECT_ID:
            self.providers["vertex_ai"] = self._create_vertex_ai_provider()
        
        # Initialize OpenAI if configured
        if settings.OPENAI_API_KEY:
            self.providers["openai"] = self._create_openai_provider()
        
        # Initialize Anthropic if configured
        if settings.ANTHROPIC_API_KEY:
            self.providers["anthropic"] = self._create_anthropic_provider()
            
        if not self.providers:
            logger.warning("No LLM providers configured. Using mock provider.")
            self.providers["mock"] = self._create_mock_provider()
    
    def _create_vertex_ai_provider(self):
        """Create a Vertex AI provider instance"""
        if LANGCHAIN_AVAILABLE:
            return {
                "models": {
                    "gemini-1.5-pro": ChatVertexAI(model_name="gemini-1.5-pro", project=settings.VERTEX_AI_PROJECT_ID),
                    "gemini-1.5-flash": ChatVertexAI(model_name="gemini-1.5-flash", project=settings.VERTEX_AI_PROJECT_ID),
                }
            }
        else:
            return {"mock": True, "name": "vertex_ai"}
    
    def _create_openai_provider(self):
        """Create an OpenAI provider instance"""
        if LANGCHAIN_AVAILABLE:
            return {
                "models": {
                    "gpt-4o": ChatOpenAI(model="gpt-4o"),
                    "gpt-4-turbo": ChatOpenAI(model="gpt-4-turbo"),
                    "gpt-3.5-turbo": ChatOpenAI(model="gpt-3.5-turbo"),
                }
            }
        else:
            return {"mock": True, "name": "openai"}
    
    def _create_anthropic_provider(self):
        """Create an Anthropic provider instance"""
        if LANGCHAIN_AVAILABLE:
            return {
                "models": {
                    "claude-3-opus": ChatAnthropic(model="claude-3-opus"),
                    "claude-3-sonnet": ChatAnthropic(model="claude-3-sonnet"),
                    "claude-3-haiku": ChatAnthropic(model="claude-3-haiku"),
                }
            }
        else:
            return {"mock": True, "name": "anthropic"}
    
    def _create_mock_provider(self):
        """Create a mock provider for testing"""
        return {
            "mock": True,
            "models": {
                "mock-model": lambda **kwargs: {"content": "This is a mock response for testing purposes"}
            }
        }
    
    def get_model(self, provider_name: str, model_name: str):
        """Get a specific model from a provider"""
        if provider_name not in self.providers:
            logger.warning(f"Provider {provider_name} not found. Using mock provider.")
            return self.providers["mock"]["models"]["mock-model"]
        
        provider = self.providers[provider_name]
        if provider.get("mock", False):
            logger.warning(f"Using mock implementation for {provider_name}")
            return provider["models"]["mock-model"] if "models" in provider else None
        
        if model_name not in provider["models"]:
            logger.warning(f"Model {model_name} not found in provider {provider_name}. Using mock.")
            return self.providers["mock"]["models"]["mock-model"]
        
        return provider["models"][model_name]
    
    async def generate_response(self, provider_name: str, model_name: str, prompt: str, 
                               system_message: Optional[str] = None, temperature: float = 0.7,
                               max_tokens: Optional[int] = None, **kwargs):
        """Generate a response from a specific model"""
        try:
            model = self.get_model(provider_name, model_name)
            
            if provider_name == "mock" or "mock" in model.__dict__.get("__dict__", {}):
                # If using mock model, return mock response
                return {
                    "content": f"Mock response to: {prompt[:50]}...",
                    "model": f"{provider_name}/{model_name}"
                }
            
            # Prepare messages
            messages = []
            if system_message:
                messages.append({"role": "system", "content": system_message})
            
            messages.append({"role": "user", "content": prompt})
            
            # Set parameters
            params = {
                "temperature": temperature,
            }
            
            if max_tokens:
                params["max_tokens"] = max_tokens
            
            # Call the model
            response = await model.agenerate(messages=[messages], **params)
            
            # Extract the response content
            if hasattr(response, "generations") and len(response.generations) > 0:
                # LangChain response format
                message = response.generations[0][0].message
                return {
                    "content": message.content,
                    "model": f"{provider_name}/{model_name}"
                }
            else:
                # Fallback for other response formats
                return {
                    "content": str(response),
                    "model": f"{provider_name}/{model_name}"
                }
                
        except Exception as e:
            logger.error(f"Error generating response from {provider_name}/{model_name}: {str(e)}")
            return {
                "content": f"Error generating response: {str(e)}",
                "model": f"{provider_name}/{model_name}",
                "error": str(e)
            }

# Create a global instance
llm_provider_manager = LLMProviderManager()
