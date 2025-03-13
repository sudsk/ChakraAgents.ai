# backend/app/engine/tools/rag_tool.py
import logging
import asyncio
import json
from typing import Dict, List, Any, Optional, Union

from pydantic import BaseModel, Field

from app.db.vector_store import VectorStoreManager
from app.engine.tools.tool_registry import tool_registry

logger = logging.getLogger(__name__)

class RAGToolParams(BaseModel):
    """Parameters for the RAG tool"""
    query: str = Field(..., description="The search query to retrieve relevant information")
    num_results: int = Field(5, description="Number of results to retrieve")
    collection_name: Optional[str] = Field(None, description="Optional vector store collection to search")
    min_score: Optional[float] = Field(None, description="Minimum similarity score threshold (0.0-1.0)")
    include_metadata: bool = Field(True, description="Whether to include document metadata in results")

class RAGTool:
    """
    Enhanced RAG tool for retrieving information from the knowledge base
    """
    
    def __init__(self, vector_store_manager: Optional[VectorStoreManager] = None):
        """
        Initialize the RAG tool
        
        Args:
            vector_store_manager: Optional VectorStoreManager instance,
                                 creates a new one if not provided
        """
        self.vector_store = vector_store_manager or VectorStoreManager()
        self._register_tool()
    
    def _register_tool(self):
        """Register this tool with the tool registry"""
        tool_registry.register_tool(
            name="retrieve_information",
            description="Retrieve relevant information from the knowledge base for the given query",
            function_name="retrieve_information",
            parameters={
                "query": {
                    "type": "string",
                    "description": "The search query"
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of results to retrieve (default: 5)",
                    "required": False,
                    "default": 5
                },
                "collection_name": {
                    "type": "string",
                    "description": "Optional vector store collection to search",
                    "required": False
                },
                "min_score": {
                    "type": "number",
                    "description": "Minimum similarity score threshold (0.0-1.0)",
                    "required": False
                },
                "include_metadata": {
                    "type": "boolean",
                    "description": "Whether to include document metadata in results",
                    "required": False,
                    "default": True
                }
            },
            handler=self.retrieve_information,
            always_available=True
        )
    
    async def retrieve_information(
        self, 
        query: str, 
        num_results: int = 5,
        collection_name: Optional[str] = None,
        min_score: Optional[float] = None,
        include_metadata: bool = True
    ) -> Dict[str, Any]:
        """
        Retrieve relevant information from the vector store based on the query
        
        Args:
            query: The search query
            num_results: Number of results to retrieve
            collection_name: Optional vector store collection to search
            min_score: Minimum similarity score threshold
            include_metadata: Whether to include document metadata in results
            
        Returns:
            Dictionary containing the retrieved information and metadata
        """
        logger.info(f"Retrieving information for query: {query}")
        
        try:
            # Perform similarity search
            docs = await self.vector_store.async_similarity_search(
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
                metadata = {}
                if include_metadata and hasattr(doc, "metadata") and doc.metadata:
                    metadata = doc.metadata
                
                # Format result
                results.append({
                    "content": doc.page_content,
                    "metadata": metadata,
                    "score": score,
                    "index": i
                })
            
            if not results:
                return {
                    "results": [],
                    "query": query,
                    "message": "No relevant information found in the knowledge base.",
                    "success": True
                }
            
            return {
                "results": results,
                "query": query,
                "count": len(results),
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error retrieving information: {str(e)}")
            return {
                "error": f"Error retrieving information: {str(e)}",
                "success": False
            }
    
    async def retrieve_with_reranking(
        self,
        query: str,
        num_initial_results: int = 10,
        num_final_results: int = 5,
        collection_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Perform two-stage retrieval with reranking for better results
        
        Args:
            query: The search query
            num_initial_results: Number of initial results to retrieve
            num_final_results: Number of final results after reranking
            collection_name: Optional vector store collection to search
            
        Returns:
            Dictionary containing the reranked results
        """
        try:
            # First stage: semantic search to get initial results
            initial_results = await self.retrieve_information(
                query=query,
                num_results=num_initial_results,
                collection_name=collection_name,
                include_metadata=True
            )
            
            if not initial_results.get("success", False) or not initial_results.get("results"):
                return initial_results
            
            # Second stage: rerank results
            # In a real implementation, this would use a reranking model
            # For now, we'll simulate reranking by boosting results that contain exact query terms
            
            docs = initial_results["results"]
            
            # Simple reranking logic: boost documents containing exact query terms
            query_terms = set(query.lower().split())
            
            for doc in docs:
                content = doc["content"].lower()
                # Count exact matches of query terms
                term_matches = sum(1 for term in query_terms if term in content)
                # Adjust score based on term matches
                base_score = doc.get("score", 0.5)
                doc["rerank_score"] = base_score + (term_matches / len(query_terms) * 0.5)
            
            # Sort by rerank score
            docs.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
            
            # Take top results
            top_results = docs[:num_final_results]
            
            return {
                "results": top_results,
                "query": query,
                "count": len(top_results),
                "reranked": True,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error in reranking retrieval: {str(e)}")
            return {
                "error": f"Error in reranking retrieval: {str(e)}",
                "success": False
            }
    
    async def hybrid_search(
        self,
        query: str,
        num_results: int = 5,
        collection_name: Optional[str] = None,
        semantic_weight: float = 0.7
    ) -> Dict[str, Any]:
        """
        Perform hybrid search combining semantic and keyword-based search
        
        Args:
            query: The search query
            num_results: Number of results to retrieve
            collection_name: Optional vector store collection to search
            semantic_weight: Weight for semantic search vs keyword search (0.0-1.0)
            
        Returns:
            Dictionary containing hybrid search results
        """
        try:
            # Get semantic search results
            semantic_results = await self.retrieve_information(
                query=query,
                num_results=num_results,
                collection_name=collection_name,
                include_metadata=True
            )
            
            if not semantic_results.get("success", False):
                return semantic_results
            
            # Get keyword search results (in a real implementation, this would use BM25 or similar)
            # For simplicity, we'll simulate keyword search here
            keyword_results = await self._simulate_keyword_search(
                query=query,
                num_results=num_results,
                collection_name=collection_name
            )
            
            # Combine results with weighted fusion
            combined_results = self._hybrid_fusion(
                semantic_results.get("results", []),
                keyword_results.get("results", []),
                semantic_weight
            )
            
            return {
                "results": combined_results[:num_results],
                "query": query,
                "count": len(combined_results[:num_results]),
                "hybrid": True,
                "semantic_weight": semantic_weight,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error in hybrid search: {str(e)}")
            return {
                "error": f"Error in hybrid search: {str(e)}",
                "success": False
            }
    
    async def _simulate_keyword_search(
        self,
        query: str,
        num_results: int = 5,
        collection_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Simulate keyword-based search for hybrid search
        
        In a real implementation, this would use BM25 or similar
        """
        # This is a simplified simulation
        # In practice, you would implement a real keyword search
        
        # Get semantic search results as a base
        results = await self.retrieve_information(
            query=query,
            num_results=num_results * 2,  # Get more results to simulate different ordering
            collection_name=collection_name,
            include_metadata=True
        )
        
        if not results.get("success", False) or not results.get("results"):
            return results
        
        docs = results["results"]
        
        # Simulate keyword scoring
        query_terms = set(query.lower().split())
        
        for doc in docs:
            content = doc["content"].lower()
            # Count term frequency
            term_counts = {term: content.count(term) for term in query_terms}
            # Simple TF score
            doc["keyword_score"] = sum(term_counts.values()) / (len(content.split()) + 1)
        
        # Sort by keyword score
        docs.sort(key=lambda x: x.get("keyword_score", 0), reverse=True)
        
        return {
            "results": docs[:num_results],
            "query": query,
            "count": len(docs[:num_results]),
            "success": True
        }
    
    def _hybrid_fusion(
        self,
        semantic_results: List[Dict[str, Any]],
        keyword_results: List[Dict[str, Any]],
        semantic_weight: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Combine semantic and keyword search results with weighted fusion
        
        Args:
            semantic_results: Results from semantic search
            keyword_results: Results from keyword search
            semantic_weight: Weight for semantic search (0.0-1.0)
            
        Returns:
            Combined and ranked results
        """
        # Create a map of document ID to result
        all_docs = {}
        
        # Process semantic results
        for i, doc in enumerate(semantic_results):
            # Use content as a simple ID
            doc_id = hash(doc["content"])
            score = doc.get("score", 0.5)
            
            all_docs[doc_id] = {
                **doc,
                "semantic_rank": i,
                "semantic_score": score,
                "combined_score": score * semantic_weight
            }
        
        # Process keyword results
        keyword_weight = 1.0 - semantic_weight
        for i, doc in enumerate(keyword_results):
            doc_id = hash(doc["content"])
            score = doc.get("keyword_score", 0.5)
            
            if doc_id in all_docs:
                # Document exists in both results, update scores
                all_docs[doc_id]["keyword_rank"] = i
                all_docs[doc_id]["keyword_score"] = score
                all_docs[doc_id]["combined_score"] += score * keyword_weight
            else:
                # New document from keyword search
                all_docs[doc_id] = {
                    **doc,
                    "keyword_rank": i,
                    "keyword_score": score,
                    "combined_score": score * keyword_weight
                }
        
        # Convert back to list and sort by combined score
        combined_results = list(all_docs.values())
        combined_results.sort(key=lambda x: x.get("combined_score", 0), reverse=True)
        
        return combined_results

# Initialize the RAG tool
rag_tool = RAGTool()
