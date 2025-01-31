from langchain_community.utilities import SearxSearchWrapper
from fastapi import APIRouter, HTTPException
import logging
import traceback
from typing import Optional
import os
import json
from pydantic import BaseModel
from database import get_db, add_to_watchlist, remove_from_watchlist, get_user_watchlist

# Create router without prefix - we'll mount it with prefix in main app
router = APIRouter()
logger = logging.getLogger(__name__)

class ChatMessage(BaseModel):
    content: str

class WatchlistItem(BaseModel):
    symbol: str
    name: Optional[str] = None
    last_price: Optional[float] = None
    last_updated: Optional[str] = None

async def search_searxng(query: str, instance_url: str = "http://localhost:70") -> dict:
    """
    Perform a basic search using LangChain's SearxNG wrapper
    """
    try:
        logger.info(f"Attempting search with query: {query} on instance: {instance_url}")
        searx = SearxSearchWrapper(searx_host=instance_url)
        
        try:
            raw_results = searx.results(query, num_results=10)
            logger.info(f"Raw search results received. Type: {type(raw_results)}")
        except Exception as search_error:
            logger.error(f"Error during searx.results call: {str(search_error)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Search execution error: {str(search_error)}")
        
        if not raw_results:
            logger.warning("No results found for query")
            return []
            
        # Ensure results are properly formatted
        formatted_results = []
        for result in raw_results:
            try:
                if isinstance(result, dict):
                    formatted_result = {
                        "title": str(result.get("title", "No Title")),
                        "url": str(result.get("link", "") if "link" in result else result.get("url", "No URL")),
                        "content": str(result.get("snippet", "") if "snippet" in result else result.get("content", "No Content")),
                        "source": str(result.get("source", "unknown")),
                        "metadata": {
                            "type": "general"
                        }
                    }
                    formatted_results.append(formatted_result)
                    logger.debug(f"Formatted result: {formatted_result}")
            except Exception as format_error:
                logger.error(f"Error formatting result {result}: {str(format_error)}")
                continue
        
        logger.info(f"Successfully formatted {len(formatted_results)} results")
        return formatted_results
                
    except Exception as e:
        logger.error(f"Unexpected error in search_searxng: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")

@router.post("")
async def chat_endpoint(message: ChatMessage):
    """
    Handle chat messages and detect search commands
    """
    try:
        content = message.content.strip().lower()
        logger.info(f"Received chat message: {content}")
        
        # Check if message starts with "search"
        if content.startswith("search"):
            # Extract the search query (everything after "search")
            query = content[6:].strip()
            if not query:
                logger.warning("Empty search query received")
                return {"response": "Please provide a search query after 'search'"}
                
            # Perform the search
            logger.info(f"Processing search query: {query}")
            search_results = await search_searxng(query)
            
            if not search_results:
                return {"response": "No results found for your search query."}
            
            # Format the response in a chat-friendly way
            response_text = "Here are the search results:\n\n"
            for idx, result in enumerate(search_results, 1):
                response_text += f"{idx}. {result['title']}\n"
                response_text += f"   URL: {result['url']}\n"
                response_text += f"   {result['content']}\n\n"
            
            logger.info("Successfully formatted search results")
            return {"response": response_text}
            
        logger.info("Message was not a search command")
        return {"response": "Message must start with 'search' to perform a search"}
        
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@router.post("/watchlist/{user_id}/add")
async def add_stock_to_watchlist(user_id: int, item: WatchlistItem):
    logger.info(f"Adding stock to watchlist - User: {user_id}, Symbol: {item.symbol}")
    try:
        success = add_to_watchlist(user_id, item.symbol, item.name, item.last_price, item.last_updated)
        if not success:
            logger.error(f"Failed to add stock {item.symbol} to watchlist for user {user_id}")
            raise HTTPException(status_code=500, detail="Failed to add stock to watchlist")
        logger.info(f"Successfully added {item.symbol} to watchlist for user {user_id}")
        return {"message": "Stock added to watchlist", "success": True}
    except Exception as e:
        logger.error(f"Error adding stock to watchlist: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/watchlist/{user_id}/remove/{symbol}")
async def remove_stock_from_watchlist(user_id: int, symbol: str):
    logger.info(f"Removing stock from watchlist - User: {user_id}, Symbol: {symbol}")
    try:
        success = remove_from_watchlist(user_id, symbol)
        if not success:
            logger.error(f"Stock {symbol} not found in watchlist for user {user_id}")
            raise HTTPException(status_code=404, detail="Stock not found in watchlist")
        logger.info(f"Successfully removed {symbol} from watchlist for user {user_id}")
        return {"message": "Stock removed from watchlist", "success": True}
    except Exception as e:
        logger.error(f"Error removing stock from watchlist: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/watchlist/{user_id}")
async def get_stocks_in_watchlist(user_id: int):
    logger.info(f"Fetching watchlist for user: {user_id}")
    try:
        watchlist = get_user_watchlist(user_id)
        logger.info(f"Retrieved {len(watchlist)} stocks for user {user_id}")
        return {"watchlist": watchlist, "success": True}
    except Exception as e:
        logger.error(f"Error fetching watchlist: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# Export the router instead of app
__all__ = ['router']

def check_database_contents():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Query stocks table
        cursor.execute('SELECT * FROM stocks')
        stocks = cursor.fetchall()
        print("Stocks table contents:")
        for stock in stocks:
            print(dict(stock))
        
        # Query watchlist table
        cursor.execute('SELECT * FROM watchlist')
        watchlist = cursor.fetchall()
        print("Watchlist table contents:")
        for entry in watchlist:
            print(dict(entry))

if __name__ == "__main__":
    check_database_contents() 