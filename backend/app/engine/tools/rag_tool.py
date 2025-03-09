# backend/app/engine/tools/rag_tool.py
from typing import Dict, List, Any
from langchain_core.tools import Tool
from app.db.vector_store import VectorStoreManager

class RAGTool:
    def __init__(self, vector_store_manager):
        self.vector_store = vector_store_manager
    
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
        docs = self.vector_store.similarity_search(query, k=num_results)
        
        results = []
        for i, doc in enumerate(docs):
            results.append(f"Document {i+1}:\n{doc.page_content}\nSource: {doc.metadata.get('source', 'Unknown')}\n")
        
        return "\n".join(results)
