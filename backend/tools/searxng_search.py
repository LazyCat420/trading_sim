from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from langchain_community.utilities import SearxSearchWrapper
import logging
import traceback
import json
import os
from typing import List, Dict, Optional

router = APIRouter()
logger = logging.getLogger(__name__)

class SearchResult(BaseModel):
    title: str = Field(..., description="Title of the search result")
    url: str = Field(..., description="URL of the search result")
    content: str = Field(..., description="Content/snippet of the search result")
    source: str = Field(default="searxng", description="Source of the search result")
    metadata: Dict[str, str] = Field(default={"type": "news"}, description="Additional metadata")

class SearchRequest(BaseModel):
    content: str = Field(..., description="Search query")
    num_results: Optional[int] = Field(default=10, description="Number of results to return")
    search_type: Optional[str] = Field(default="news", description="Type of search to perform")

class SearchResponse(BaseModel):
    results: List[SearchResult]
    total_results: int
    query: str
    response_text: str

@router.post("/search", response_model=SearchResponse)
async def search_endpoint(request: SearchRequest):
    """
    Endpoint to handle search requests using SearxNG
    """
    try:
        query = request.content.strip()
        logger.info(f"Received search query: {query}")
        
        # Initialize SearxNG wrapper
        instance_url = os.getenv("SEARXNG_URL", "http://localhost:70")
        logger.info(f"Using SearxNG instance: {instance_url}")
        
        # Configure search parameters
        search_params = {
            "engines": "google news,yahoo news,bing news" if request.search_type == "news" else "google,bing,brave",
            "language": "en",
            "format": "json"
        }
        
        searx = SearxSearchWrapper(
            searx_host=instance_url,
            params=search_params
        )
        
        try:
            logger.info(f"Executing search with query: {query}")
            raw_results = searx.results(query, num_results=request.num_results)
            logger.debug(f"Raw search results received: {json.dumps(raw_results, indent=2)}")
        except Exception as search_error:
            logger.error(f"SearxNG search error: {str(search_error)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=500, 
                detail={"error": "Search execution error", "message": str(search_error)}
            )
        
        if not raw_results:
            return SearchResponse(
                results=[],
                total_results=0,
                query=query,
                response_text="No results found for your search query."
            )
            
        # Format results
        formatted_results = []
        for result in raw_results:
            try:
                formatted_result = SearchResult(
                    title=str(result.get("title", "No Title")),
                    url=str(result.get("link", "") if "link" in result else result.get("url", "No URL")),
                    content=str(result.get("snippet", "") if "snippet" in result else result.get("content", "No Content")),
                    source="searxng",
                    metadata={"type": request.search_type}
                )
                formatted_results.append(formatted_result)
                logger.debug(f"Formatted result: {formatted_result.model_dump_json(indent=2)}")
            except Exception as format_error:
                logger.error(f"Error formatting result: {str(format_error)}")
                continue
        
        # Create response text
        response_text = "Here are the search results:\n\n"
        for idx, result in enumerate(formatted_results, 1):
            response_text += f"{idx}. {result.title}\n"
            response_text += f"   URL: {result.url}\n"
            response_text += f"   {result.content}\n\n"
        
        logger.info(f"Successfully formatted {len(formatted_results)} results")
        
        return SearchResponse(
            results=formatted_results,
            total_results=len(formatted_results),
            query=query,
            response_text=response_text
        )
        
    except Exception as e:
        logger.error(f"Search endpoint error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Search processing error", "message": str(e)}
        ) 