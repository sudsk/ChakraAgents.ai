# backend/app/engine/optimizations.py
import logging
import time
import asyncio
from typing import Dict, List, Any, Optional, Callable, Union, TypeVar, Generic
from datetime import datetime, timedelta
import functools
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
import threading
import traceback

logger = logging.getLogger(__name__)

# Type variable for generic caching
T = TypeVar('T')

class LRUCache(Generic[T]):
    """
    Simple LRU (Least Recently Used) cache implementation.
    
    This cache is used to store results of expensive computations
    like LLM API calls to avoid redundant requests.
    """
    
    def __init__(self, max_size: int = 100, ttl: int = 3600):
        """
        Initialize the LRU cache
        
        Args:
            max_size: Maximum number of items to store in the cache
            ttl: Time-to-live in seconds for cached items
        """
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.max_size = max_size
        self.ttl = ttl
        self.access_times: Dict[str, float] = {}
        self._lock = threading.RLock()
    
    def get(self, key: str) -> Optional[T]:
        """
        Get an item from the cache
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found or expired
        """
        with self._lock:
            if key not in self.cache:
                return None
            
            # Check if item has expired
            item = self.cache[key]
            if time.time() > item["expiry"]:
                # Remove expired item
                del self.cache[key]
                del self.access_times[key]
                return None
            
            # Update access time
            self.access_times[key] = time.time()
            
            return item["value"]
    
    def put(self, key: str, value: T) -> None:
        """
        Add an item to the cache
        
        Args:
            key: Cache key
            value: Value to cache
        """
        with self._lock:
            # If cache is full, remove least recently used item
            if len(self.cache) >= self.max_size and key not in self.cache:
                self._evict_lru()
            
            # Add new item
            self.cache[key] = {
                "value": value,
                "expiry": time.time() + self.ttl
            }
            self.access_times[key] = time.time()
    
    def _evict_lru(self) -> None:
        """Evict the least recently used item from the cache"""
        if not self.access_times:
            return
        
        oldest_key = min(self.access_times.items(), key=lambda x: x[1])[0]
        del self.cache[oldest_key]
        del self.access_times[oldest_key]
    
    def clear(self) -> None:
        """Clear the cache"""
        with self._lock:
            self.cache.clear()
            self.access_times.clear()
    
    def update_ttl(self, key: str, ttl: int) -> bool:
        """
        Update the TTL for a specific item
        
        Args:
            key: Cache key
            ttl: New TTL in seconds
            
        Returns:
            True if item was found and updated, False otherwise
        """
        with self._lock:
            if key not in self.cache:
                return False
            
            self.cache[key]["expiry"] = time.time() + ttl
            return True
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            return {
                "size": len(self.cache),
                "max_size": self.max_size,
                "ttl": self.ttl,
                "oldest_access": min(self.access_times.values()) if self.access_times else None,
                "newest_access": max(self.access_times.values()) if self.access_times else None
            }

# Global LLM response cache
_llm_response_cache = LRUCache[Dict[str, Any]](max_size=1000, ttl=3600)

def cached_llm_call(ttl: int = 3600):
    """
    Decorator for caching LLM API calls
    
    Args:
        ttl: Time-to-live in seconds for cached items
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Create a cache key from the function name and arguments
            cache_key = _create_cache_key(func.__name__, args, kwargs)
            
            # Try to get from cache
            cached_result = _llm_response_cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for LLM call: {func.__name__}")
                return cached_result
            
            # Execute the function
            result = await func(*args, **kwargs)
            
            # Cache the result
            _llm_response_cache.put(cache_key, result)
            
            return result
        return wrapper
    
    return decorator

def _create_cache_key(func_name: str, args: tuple, kwargs: dict) -> str:
    """
    Create a cache key from function name and arguments
    
    Args:
        func_name: Name of the function
        args: Positional arguments
        kwargs: Keyword arguments
        
    Returns:
        Cache key string
    """
    # Convert arguments to a stable representation
    args_repr = json.dumps(args, sort_keys=True)
    kwargs_repr = json.dumps(kwargs, sort_keys=True)
    
    # Create a hash of the function name and arguments
    key_string = f"{func_name}:{args_repr}:{kwargs_repr}"
    return hashlib.md5(key_string.encode()).hexdigest()

# Concurrency limiting for API calls
class RequestThrottler:
    """
    Throttle requests to external APIs to avoid rate limits
    
    This class implements a token bucket algorithm for rate limiting.
    """
    
    def __init__(self, max_tokens: int, tokens_per_second: float):
        """
        Initialize the throttler
        
        Args:
            max_tokens: Maximum number of tokens in the bucket
            tokens_per_second: Rate at which tokens are added to the bucket
        """
        self.max_tokens = max_tokens
        self.tokens_per_second = tokens_per_second
        self.tokens = max_tokens
        self.last_update = time.time()
        self._lock = asyncio.Lock()
    
    async def acquire(self, tokens: int = 1) -> None:
        """
        Acquire tokens from the bucket
        
        Args:
            tokens: Number of tokens to acquire
        """
        async with self._lock:
            # Update tokens based on time passed
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(self.max_tokens, self.tokens + elapsed * self.tokens_per_second)
            self.last_update = now
            
            # If not enough tokens, wait until we have enough
            if self.tokens < tokens:
                wait_time = (tokens - self.tokens) / self.tokens_per_second
                logger.debug(f"Throttling request for {wait_time:.2f} seconds")
                await asyncio.sleep(wait_time)
                
                # Update tokens again after waiting
                now = time.time()
                elapsed = now - self.last_update
                self.tokens = min(self.max_tokens, self.tokens + elapsed * self.tokens_per_second)
                self.last_update = now
            
            # Consume tokens
            self.tokens -= tokens

# Throttlers for different providers
_openai_throttler = RequestThrottler(max_tokens=60, tokens_per_second=1)  # 60 requests per minute
_anthropic_throttler = RequestThrottler(max_tokens=40, tokens_per_second=0.67)  # 40 requests per minute
_vertex_throttler = RequestThrottler(max_tokens=600, tokens_per_second=10)  # 600 requests per minute

async def throttled_api_call(provider: str, func, *args, **kwargs):
    """
    Execute an API call with appropriate throttling
    
    Args:
        provider: Provider name ('openai', 'anthropic', 'vertex')
        func: Async function to call
        args: Positional arguments for the function
        kwargs: Keyword arguments for the function
        
    Returns:
        Function result
    """
    # Select the appropriate throttler
    if provider.lower() == 'openai':
        throttler = _openai_throttler
    elif provider.lower() == 'anthropic':
        throttler = _anthropic_throttler
    elif provider.lower() in ('vertex', 'vertex_ai'):
        throttler = _vertex_throttler
    else:
        # No throttling for unknown providers
        return await func(*args, **kwargs)
    
    # Acquire token from throttler
    await throttler.acquire()
    
    # Execute the function
    return await func(*args, **kwargs)

# Parallel processing for agent workflows
async def parallel_agent_execution(agent_funcs: List[Callable], max_workers: int = 5) -> List[Any]:
    """
    Execute multiple agent functions in parallel
    
    Args:
        agent_funcs: List of agent functions to execute
        max_workers: Maximum number of parallel workers
        
    Returns:
        List of results
    """
    # Use a semaphore to limit concurrency
    semaphore = asyncio.Semaphore(max_workers)
    
    async def bounded_execution(func):
        async with semaphore:
            try:
                return await func()
            except Exception as e:
                logger.error(f"Error in parallel agent execution: {e}")
                return {"error": str(e), "traceback": traceback.format_exc()}
    
    # Execute all functions in parallel with bounded concurrency
    tasks = [bounded_execution(func) for func in agent_funcs]
    return await asyncio.gather(*tasks)

# Progressive response handling
class ProgressiveResponse:
    """
    Handle progressive responses for long-running workflows
    
    This allows sending partial results back to the client
    while the workflow is still running.
    """
    
    def __init__(self, callback: Optional[Callable[[Dict[str, Any]], None]] = None):
        """
        Initialize progressive response handler
        
        Args:
            callback: Optional callback function for handling updates
        """
        self.updates = []
        self.callback = callback
        self._lock = asyncio.Lock()
    
    async def add_update(self, update: Dict[str, Any]) -> None:
        """
        Add an update to the progressive response
        
        Args:
            update: Update data
        """
        async with self._lock:
            # Add timestamp if not present
            if "timestamp" not in update:
                update["timestamp"] = datetime.now().isoformat()
            
            self.updates.append(update)
            
            # Call callback if provided
            if self.callback:
                await self.callback(update)
    
    def get_updates(self) -> List[Dict[str, Any]]:
        """Get all updates so far"""
        return self.updates
    
    def get_latest_update(self) -> Optional[Dict[str, Any]]:
        """Get the latest update"""
        if not self.updates:
            return None
        return self.updates[-1]
    
    async def clear(self) -> None:
        """Clear all updates"""
        async with self._lock:
            self.updates.clear()

# Request timeout handling
async def with_timeout(coro, timeout: float):
    """
    Execute a coroutine with a timeout
    
    Args:
        coro: Coroutine to execute
        timeout: Timeout in seconds
        
    Returns:
        Coroutine result
        
    Raises:
        asyncio.TimeoutError: If the coroutine times out
    """
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning(f"Operation timed out after {timeout} seconds")
        raise

# Enhanced error handling for agent workflows
class WorkflowExecutionError(Exception):
    """Exception raised for errors in workflow execution"""
    
    def __init__(self, message: str, agent_name: Optional[str] = None, 
                 step: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.agent_name = agent_name
        self.step = step
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "error": self.message,
            "agent_name": self.agent_name,
            "step": self.step,
            "details": self.details,
            "timestamp": datetime.now().isoformat()
        }

# Automatic retries for flaky API calls
async def with_retries(func, max_retries: int = 3, base_delay: float = 1.0, 
                      max_delay: float = 10.0, backoff_factor: float = 2.0):
    """
    Execute a function with exponential backoff retries
    
    Args:
        func: Async function to call
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        backoff_factor: Factor to increase delay on each retry
        
    Returns:
        Function result
        
    Raises:
        Exception: If all retries fail
    """
    retries = 0
    last_error = None
    
    while retries <= max_retries:
        try:
            if retries > 0:
                logger.info(f"Retry attempt {retries} of {max_retries}")
                
            return await func()
        except Exception as e:
            last_error = e
            retries += 1
            
            if retries > max_retries:
                break
            
            # Calculate delay with exponential backoff
            delay = min(max_delay, base_delay * (backoff_factor ** (retries - 1)))
            
            # Add jitter to avoid thundering herd
            jitter = 0.2 * delay * (2 * random.random() - 1)
            delay += jitter
            
            logger.warning(f"Function call failed with error: {e}. Retrying in {delay:.2f} seconds...")
            await asyncio.sleep(delay)
    
    # If we get here, all retries failed
    raise last_error

# Memory usage optimization
def optimize_memory_usage(max_history_length: int = 10):
    """
    Decorator for optimizing memory usage in agent conversations
    
    This truncates conversation history to avoid memory issues with long conversations.
    
    Args:
        max_history_length: Maximum number of messages to keep in history
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Check if kwargs contains messages
            if "messages" in kwargs and isinstance(kwargs["messages"], list):
                # Truncate messages if longer than max_history_length
                if len(kwargs["messages"]) > max_history_length:
                    # Keep system message if present
                    system_message = None
                    if kwargs["messages"] and kwargs["messages"][0].get("role") == "system":
                        system_message = kwargs["messages"][0]
                    
                    # Keep the most recent messages
                    messages = kwargs["messages"][-max_history_length:]
                    
                    # Add system message back if it was present
                    if system_message:
                        messages = [system_message] + messages
                    
                    kwargs["messages"] = messages
            
            return await func(*args, **kwargs)
        return wrapper
    
    return decorator

# Execution checkpointing for long-running workflows
class WorkflowCheckpointer:
    """
    Save and restore workflow state for long-running workflows
    
    This allows resuming a workflow from the last saved state
    in case of interruptions or failures.
    """
    
    def __init__(self, checkpoint_dir: str = "./checkpoints"):
        """
        Initialize the checkpointer
        
        Args:
            checkpoint_dir: Directory to store checkpoints
        """
        self.checkpoint_dir = checkpoint_dir
        os.makedirs(checkpoint_dir, exist_ok=True)
    
    async def save_checkpoint(self, execution_id: str, state: Dict[str, Any]) -> str:
        """
        Save a workflow checkpoint
        
        Args:
            execution_id: Unique ID for the execution
            state: Workflow state to save
            
        Returns:
            Path to the saved checkpoint file
        """
        # Generate checkpoint filename
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{execution_id}_{timestamp}.json"
        filepath = os.path.join(self.checkpoint_dir, filename)
        
        # Save state to file
        with open(filepath, "w") as f:
            json.dump(state, f, indent=2)
        
        logger.info(f"Saved checkpoint for execution {execution_id}: {filepath}")
        return filepath
    
    async def load_checkpoint(self, checkpoint_path: str) -> Dict[str, Any]:
        """
        Load a workflow checkpoint
        
        Args:
            checkpoint_path: Path to the checkpoint file
            
        Returns:
            Workflow state
        """
        try:
            with open(checkpoint_path, "r") as f:
                state = json.load(f)
            
            logger.info(f"Loaded checkpoint: {checkpoint_path}")
            return state
        except Exception as e:
            logger.error(f"Error loading checkpoint {checkpoint_path}: {e}")
            raise
    
    async def list_checkpoints(self, execution_id: Optional[str] = None) -> List[str]:
        """
        List available checkpoints
        
        Args:
            execution_id: Optional ID to filter checkpoints
            
        Returns:
            List of checkpoint file paths
        """
        checkpoints = []
        
        for filename in os.listdir(self.checkpoint_dir):
            if not filename.endswith(".json"):
                continue
            
            if execution_id and not filename.startswith(f"{execution_id}_"):
                continue
            
            checkpoints.append(os.path.join(self.checkpoint_dir, filename))
        
        # Sort by modification time (newest first)
        checkpoints.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        
        return checkpoints
    
    async def get_latest_checkpoint(self, execution_id: str) -> Optional[str]:
        """
        Get the latest checkpoint for an execution
        
        Args:
            execution_id: Execution ID
            
        Returns:
            Path to the latest checkpoint file or None if no checkpoint exists
        """
        checkpoints = await self.list_checkpoints(execution_id)
        
        if not checkpoints:
            return None
        
        return checkpoints[0]

# Initialize required modules
import os
import random
import asyncio
import logging

# Make the optimizations available for import
__all__ = [
    "LRUCache", "cached_llm_call", "RequestThrottler", "throttled_api_call",
    "parallel_agent_execution", "ProgressiveResponse", "with_timeout",
    "WorkflowExecutionError", "with_retries", "optimize_memory_usage",
    "WorkflowCheckpointer"
]
