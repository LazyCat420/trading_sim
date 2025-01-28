from langchain_community.utilities import SearxSearchWrapper
from fastapi import APIRouter, HTTPException
import logging
from typing import Optional
import os
import json
from pydantic import BaseModel

router = APIRouter()

logger = logging.getLogger(__name__)

class ChatMessage(BaseModel):
    content: str

async def search_searxng(query: str, instance_url: str = "http://localhost:70") -> dict:
    """
    Perform a basic search using LangChain's SearxNG wrapper
    """
    try:
        searx = SearxSearchWrapper(searx_host=instance_url)
        raw_results = searx.results(query, num_results=10)
        
        logger.info(f"Raw search results type: {type(raw_results)}")
        
        # Ensure results are properly formatted
        formatted_results = []
        for result in raw_results:
            if isinstance(result, dict):
                formatted_results.append({
                    "title": str(result.get("title", "")),
                    "url": str(result.get("link", "") if "link" in result else result.get("url", "")),
                    "content": str(result.get("snippet", "") if "snippet" in result else result.get("content", "")),
                    "source": str(result.get("source", "unknown")),
                    "metadata": {
                        "type": "general"
                    }
                })
        
        response_data = {
            "query": query,
            "results": formatted_results
        }
        
        # Validate JSON serialization
        json.dumps(response_data)  # This will raise an error if the data isn't JSON-serializable
        
        return response_data
                
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")

@router.post("")
async def chat_endpoint(message: ChatMessage):
    """
    Handle chat messages and detect search commands
    """
    try:
        content = message.content.strip().lower()
        
        # Check if message starts with "search"
        if content.startswith("search"):
            # Extract the search query (everything after "search")
            query = content[6:].strip()
            if not query:
                return {"error": "Please provide a search query after 'search'"}
                
            # Perform the search
            search_results = await search_searxng(query)
            
            # Format the response in a chat-friendly way
            response_text = "Here are the search results:\n\n"
            for idx, result in enumerate(search_results["results"], 1):
                response_text += f"{idx}. {result['title']}\n"
                response_text += f"   URL: {result['url']}\n"
                response_text += f"   {result['content']}\n\n"
            
            return {"response": response_text}
            
        return {"error": "Message must start with 'search' to perform a search"}
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

# Export the router instead of app
app = router 