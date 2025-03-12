# backend/app/engine/tools/rag_tool.py
from typing import Dict, List, Any, Optional
import logging
from app.db.vector_store import VectorStoreManager
from app.services.document_service import DocumentProcessor

logger = logging.getLogger(__name__)

class RAGTool:
    """Tool for Retrieval-Augmented Generation within workflows"""
    
    def __init__(self, vector_store_manager=None, document_processor=None):
        self.vector_store = vector_store_manager or VectorStoreManager()
        self.document_processor = document_processor or DocumentProcessor()
    
    def get_tool_definition(self):
        """Get tool definition for template engine"""
        return {
            "name": "retrieve_information",
            "description": "Retrieve relevant information from the knowledge base for the given query",
            "function_name": "retrieve_information",
            "parameters": {
                "query": {
                    "type": "string",
                    "description": "The search query"
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of results to retrieve (default: 5)"
                }
            }
        }
    
    def retrieve_information(self, query: str, num_results: int = 5) -> str:
        """Retrieve relevant information from the vector store"""
        logger.info(f"Retrieving information for query: {query}")
        try:
            docs = self.vector_store.similarity_search(query, k=num_results)
            
            results = []
            for i, doc in enumerate(docs):
                results.append(f"Document {i+1}:\n{doc.page_content}\nSource: {doc.metadata.get('source', 'Unknown')}\n")
            
            if not results:
                return "No relevant information found in the knowledge base."
            
            return "\n".join(results)
        except Exception as e:
            logger.error(f"Error retrieving information: {str(e)}")
            return f"Error retrieving information: {str(e)}"
    
    async def process_with_rag(self, query: str, llm_provider, model_provider: str = "vertex_ai", 
                        model_name: str = "gemini-1.5-pro", temperature: float = 0.3, 
                        num_results: int = 5, system_message: Optional[str] = None):
        """Retrieve information and generate a response using an LLM"""
        # Retrieve relevant information
        context = self.retrieve_information(query, num_results)
        
        # Create prompt with context
        prompt = f"""Please answer the following question based on the provided context.
If the context doesn't contain relevant information, say so and answer based on your general knowledge.

Question: {query}

Context:
{context}
"""
        
        # Generate response
        response = await llm_provider.generate_response(
            provider_name=model_provider,
            model_name=model_name,
            prompt=prompt,
            system_message=system_message,
            temperature=temperature
        )
        
        return {
            "answer": response.get("content", ""),
            "context": context,
            "model": f"{model_provider}/{model_name}"
        }
