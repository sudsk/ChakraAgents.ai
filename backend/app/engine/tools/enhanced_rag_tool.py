# backend/app/engine/tools/enhanced_rag_tool.py
from typing import Dict, List, Any, Optional, Union
import logging
import asyncio
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class RetrievalParameters(BaseModel):
    """Parameters for the retrieve_information tool"""
    query: str = Field(..., description="The search query to retrieve relevant information")
    num_results: int = Field(5, description="Number of results to retrieve")
    collection_name: Optional[str] = Field(None, description="Optional vector store collection to search")
    min_score: Optional[float] = Field(None, description="Minimum similarity score threshold (0.0-1.0)")
    include_metadata: bool = Field(True, description="Whether to include document metadata in results")
    
class EnhancedRAGTool:
    """
    Enhanced RAG tool with advanced retrieval capabilities for agentic workflows.
    This tool provides a more sophisticated approach to information retrieval 
    than basic RAG implementations.
    """
    
    def __init__(self, vector_store_manager=None):
        self.vector_store = vector_store_manager
        
    def get_tool_definition(self) -> Dict[str, Any]:
        """
        Get the tool definition for use in templates and agent configurations.
        
        Returns:
            Dictionary containing the tool definition
        """
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
                },
                "collection_name": {
                    "type": "string",
                    "description": "Optional vector store collection to search"
                },
                "min_score": {
                    "type": "number",
                    "description": "Minimum similarity score threshold (0.0-1.0)"
                },
                "include_metadata": {
                    "type": "boolean",
                    "description": "Whether to include document metadata in results"
                }
            }
        }
    
    async def retrieve_information(
        self, 
        query: str, 
        num_results: int = 5,
        collection_name: Optional[str] = None,
        min_score: Optional[float] = None,
        include_metadata: bool = True
    ) -> str:
        """
        Retrieve relevant information from the vector store based on the query.
        
        Args:
            query: The search query
            num_results: Number of results to retrieve
            collection_name: Optional vector store collection to search
            min_score: Minimum similarity score threshold
            include_metadata: Whether to include document metadata in results
            
        Returns:
            String containing the retrieved information
        """
        logger.info(f"Retrieving information for query: {query}")
        
        try:
            if not self.vector_store:
                logger.warning("Vector store manager not initialized")
                return "Error: Vector store not available."
            
            # Perform similarity search
            docs = self.vector_store.similarity_search(
                query, 
                k=num_results,
                collection_name=collection_name,
                score_threshold=min_score
            )
            
            # Format results
            results = []
            for i, doc in enumerate(docs):
                # Extract score if available
                score = getattr(doc, "score", None)
                score_text = f" (Relevance: {score:.2f})" if score is not None else ""
                
                # Format metadata if requested and available
                metadata_text = ""
                if include_metadata and hasattr(doc, "metadata") and doc.metadata:
                    metadata_text = "\nMetadata:\n"
                    for key, value in doc.metadata.items():
                        metadata_text += f"  {key}: {value}\n"
                
                # Format result
                results.append(
                    f"Document {i+1}{score_text}:\n{doc.page_content}\n{metadata_text}"
                )
            
            if not results:
                return "No relevant information found in the knowledge base."
            
            return "\n\n".join(results)
            
        except Exception as e:
            logger.error(f"Error retrieving information: {str(e)}")
            return f"Error retrieving information: {str(e)}"
    
    async def retrieve_with_queries(self, queries: List[str], num_results: int = 3) -> str:
        """
        Retrieve information using multiple queries and combine the results.
        Useful for complex information needs that can be broken down into multiple questions.
        
        Args:
            queries: List of search queries
            num_results: Number of results to retrieve per query
            
        Returns:
            Combined retrieval results
        """
        if not queries:
            return "No queries provided."
        
        results = []
        for query in queries:
            result = await self.retrieve_information(query, num_results)
            results.append(f"Results for query '{query}':\n{result}")
        
        return "\n\n".join(results)
    
    async def retrieve_and_summarize(
        self, 
        query: str, 
        num_results: int = 5,
        llm_provider=None
    ) -> Dict[str, Any]:
        """
        Retrieve information and generate a summary using an LLM.
        
        Args:
            query: The search query
            num_results: Number of results to retrieve
            llm_provider: LLM provider to use for summarization
            
        Returns:
            Dictionary with context and summary
        """
        # Retrieve information
        context = await self.retrieve_information(query, num_results)
        
        # If no LLM provider, just return the context
        if not llm_provider:
            return {
                "context": context,
                "summary": "No summary available (LLM provider not provided)."
            }
        
        # Generate summary
        prompt = f"""Please summarize the following information retrieved from a knowledge base:

{context}

Provide a concise summary that captures the key points relevant to the query: "{query}"
"""
        
        try:
            summary_result = await llm_provider.generate_response(
                provider_name="vertex_ai",  # Default provider
                model_name="gemini-1.5-flash",  # Fast model for summarization
                prompt=prompt,
                temperature=0.3
            )
            
            return {
                "context": context,
                "summary": summary_result.get("content", "Error generating summary.")
            }
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            return {
                "context": context,
                "summary": f"Error generating summary: {str(e)}"
            }
            
    async def hyperparameter_search(
        self, 
        query: str,
        min_results: int = 3,
        max_results: int = 10,
        score_thresholds: List[float] = [0.0, 0.5, 0.7, 0.8]
    ) -> Dict[str, Any]:
        """
        Perform a hyperparameter search to find optimal retrieval settings.
        
        Args:
            query: The search query
            min_results: Minimum number of results to try
            max_results: Maximum number of results to try
            score_thresholds: List of score thresholds to try
            
        Returns:
            Dictionary with search results and recommended settings
        """
        # Generate parameter combinations to try
        runs = []
        
        for k in range(min_results, max_results + 1, 2):  # Step by 2 for efficiency
            for threshold in score_thresholds:
                runs.append({
                    "num_results": k,
                    "min_score": threshold
                })
        
        # Run searches in parallel
        results = []
        for run in runs:
            docs = self.vector_store.similarity_search(
                query, 
                k=run["num_results"],
                score_threshold=run["min_score"]
            )
            
            # Record results
            num_docs = len(docs)
            avg_score = sum(getattr(doc, "score", 0) for doc in docs) / max(1, num_docs)
            
            results.append({
                "params": run,
                "num_docs": num_docs,
                "avg_score": avg_score
            })
        
        # Find best parameters
        # This is a simplified heuristic - in practice you'd use a more sophisticated approach
        best_run = max(results, key=lambda x: x["avg_score"] * min(5, x["num_docs"]))
        
        return {
            "results": results,
            "recommended_params": best_run["params"],
            "stats": {
                "num_docs": best_run["num_docs"],
                "avg_score": best_run["avg_score"]
            }
        }
