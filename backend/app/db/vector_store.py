# backend/app/db/vector_store.py
from langchain_community.vectorstores import Chroma, FAISS
# Comment out the Vertex AI import to avoid loading it
# from langchain_google_vertexai import VertexAIEmbeddings
from langchain_openai import OpenAIEmbeddings

# Add this for fallback embeddings
from langchain_core.embeddings import Embeddings
import numpy as np

# Create a mock embeddings class that doesn't need external services
class MockEmbeddings(Embeddings):
    """Mock embeddings for development that don't call external APIs."""
    def __init__(self, dim=768):
        self.dim = dim
    
    def embed_documents(self, texts):
        """Return consistent mock embeddings based on text hash."""
        return [self._get_mock_embedding(text) for text in texts]
    
    def embed_query(self, text):
        """Return consistent mock embedding based on text hash."""
        return self._get_mock_embedding(text)
    
    def _get_mock_embedding(self, text):
        """Generate a deterministic mock embedding based on the text."""
        # Use hash of text as a seed for pseudo-random but consistent vectors
        np.random.seed(hash(text) % 2**32)
        return np.random.rand(self.dim).tolist()

class VectorStoreManager:
    def __init__(self, embedding_model="mock"):
        # Replace the Vertex AI initialization with a conditional
        if embedding_model == "vertex_ai":
            # Commented out to avoid the error
            # self.embeddings = VertexAIEmbeddings()
            print("VertexAI embeddings disabled, using mock embeddings instead")
            self.embeddings = MockEmbeddings()
        elif embedding_model == "openai":
            # This still requires an API key, so default to mock if not available
            try:
                self.embeddings = OpenAIEmbeddings()
            except Exception as e:
                print(f"Failed to initialize OpenAI embeddings: {e}")
                print("Falling back to mock embeddings")
                self.embeddings = MockEmbeddings()
        else:
            # Use mock embeddings as the fallback
            self.embeddings = MockEmbeddings()
        
        # Initialize vector store
        self.vector_store = FAISS.from_documents([], self.embeddings)
    
    def add_documents(self, documents):
        """Add documents to the vector store"""
        self.vector_store.add_documents(documents)
    
    def similarity_search(self, query, k=5):
        """Retrieve relevant documents based on query"""
        return self.vector_store.similarity_search(query, k=k)
    
    # If you have an async version, also update it
    async def async_similarity_search(self, query, k=5, **kwargs):
        """Async version of similarity search (actually just synchronous for now)"""
        return self.vector_store.similarity_search(query, k=k, **kwargs)


'''
from app.core.config import settings
from langchain_community.vectorstores import Chroma, FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_google_vertexai import VertexAIEmbeddings

class VectorStoreManager:
    def __init__(self, embedding_model="vertex_ai"):
        if embedding_model == "vertex_ai":
            self.embeddings = VertexAIEmbeddings(
                model_name="textembedding-gecko@latest",  # Use appropriate model name
                project=settings.VERTEX_AI_PROJECT_ID,    # Make sure this is defined
                location="us-central1"                    # Specify region
            )
        else:
            self.embeddings = OpenAIEmbeddings()
        
        # Initialize vector store
        self.vector_store = FAISS.from_documents([], self.embeddings)
    
    def add_documents(self, documents):
        """Add documents to the vector store"""
        self.vector_store.add_documents(documents)
    
    def similarity_search(self, query, k=5):
        """Retrieve relevant documents based on query"""
        return self.vector_store.similarity_search(query, k=k)
'''        
