from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
from typing import Optional, List
import uvicorn
import time
from functools import wraps
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def retry_on_failure(max_retries=3, delay=1):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    logger.warning(f"Attempt {attempt + 1} failed: {str(e)}")
                    if attempt < max_retries - 1:  # Don't sleep on the last attempt
                        time.sleep(delay)
            raise last_error  # Re-raise the last error if all retries failed
        return wrapper
    return decorator

def format_symbol(symbol: str) -> str:
    """Format symbol to handle different exchanges."""
    # Convert to uppercase
    symbol = symbol.upper()
    
    # Handle common international exchanges
    exchange_mappings = {
        'TSE:': '.T',    # Tokyo Stock Exchange
        'TSEC:': '.TW',  # Taiwan Stock Exchange
        'LSE:': '.L',    # London Stock Exchange
        'FRA:': '.F',    # Frankfurt Stock Exchange
        'HKG:': '.HK',   # Hong Kong Stock Exchange
    }
    
    # Apply exchange suffix if needed
    for prefix, suffix in exchange_mappings.items():
        if symbol.startswith(prefix):
            return symbol.replace(prefix, '') + suffix
            
    return symbol

@app.get("/stock/{symbol}")
@retry_on_failure(max_retries=3, delay=1)
async def get_stock_data(symbol: str):
    try:
        formatted_symbol = format_symbol(symbol)
        logger.info(f"Fetching data for symbol: {formatted_symbol}")
        
        stock = yf.Ticker(formatted_symbol)
        
        # Try to get history first to validate the symbol
        try:
            hist = stock.history(period="1d")
            if hist.empty:
                logger.error(f"No history data found for {formatted_symbol}")
                raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
        except Exception as e:
            logger.error(f"Error fetching history for {formatted_symbol}: {str(e)}")
            raise HTTPException(status_code=404, detail=f"Invalid symbol or no data available for {symbol}")

        # Get info after validating symbol
        info = stock.info
        if not info:
            logger.error(f"No info data found for {formatted_symbol}")
            raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")

        # Get current price from history if available, otherwise from info
        try:
            if not hist.empty:
                current_price = float(hist['Close'].iloc[-1])
            else:
                current_price = float(info.get("regularMarketPrice", 0) or info.get("currentPrice", 0) or 0)
        except (ValueError, TypeError, IndexError) as e:
            logger.warning(f"Error getting current price: {str(e)}")
            current_price = 0

        if current_price == 0:
            logger.error(f"Unable to fetch current price for {formatted_symbol}")
            raise HTTPException(status_code=500, detail=f"Unable to fetch current price for {symbol}")

        # Get price changes safely
        try:
            if not hist.empty and len(hist) > 1:
                prev_close = float(hist['Close'].iloc[-2])
                change = current_price - prev_close
                change_percent = (change / prev_close) * 100 if prev_close != 0 else 0
            else:
                change = float(info.get("regularMarketChange", 0) or 0)
                change_percent = float(info.get("regularMarketChangePercent", 0) or 0)
        except (ValueError, TypeError, IndexError) as e:
            logger.warning(f"Error getting price changes: {str(e)}")
            change = 0
            change_percent = 0
        
        # Get recommendations
        try:
            recommendations = stock.recommendations
            latest_rating = None
            if recommendations is not None and not recommendations.empty:
                latest = recommendations.iloc[-1]
                latest_rating = {
                    "firm": str(latest.get("Firm", "N/A")),
                    "grade": str(latest.get("To Grade", "N/A")),
                    "action": str(latest.get("Action", "N/A"))
                }
        except Exception as e:
            logger.warning(f"Failed to fetch recommendations: {str(e)}")
            latest_rating = None

        # Get other numeric values with proper error handling
        try:
            market_cap = float(info.get("marketCap", 0) or 0)
            volume = int(info.get("regularMarketVolume", 0) or 0)
            pe_ratio = float(info.get("forwardPE", 0) or 0)
            dividend_yield = float(info.get("dividendYield", 0) or 0) if info.get("dividendYield") else None
            
            # Try to get 52-week data from history first
            if not hist.empty:
                yearly_hist = stock.history(period="1y")
                if not yearly_hist.empty:
                    fifty_two_week_high = float(yearly_hist["High"].max())
                    fifty_two_week_low = float(yearly_hist["Low"].min())
                else:
                    fifty_two_week_high = float(info.get("fiftyTwoWeekHigh", 0) or 0)
                    fifty_two_week_low = float(info.get("fiftyTwoWeekLow", 0) or 0)
            else:
                fifty_two_week_high = float(info.get("fiftyTwoWeekHigh", 0) or 0)
                fifty_two_week_low = float(info.get("fiftyTwoWeekLow", 0) or 0)
        except (ValueError, TypeError) as e:
            logger.warning(f"Error converting numeric values: {str(e)}")
            market_cap = 0
            volume = 0
            pe_ratio = 0
            dividend_yield = None
            fifty_two_week_high = 0
            fifty_two_week_low = 0
        
        # Get string values safely
        try:
            short_name = str(info.get("shortName", "")) if info.get("shortName") else ""
            long_name = str(info.get("longName", "")) if info.get("longName") else ""
            sector = str(info.get("sector", "")) if info.get("sector") else ""
            industry = str(info.get("industry", "")) if info.get("industry") else ""
            exchange = str(info.get("exchange", "")) if info.get("exchange") else ""
            currency = str(info.get("currency", "")) if info.get("currency") else ""
        except Exception as e:
            logger.warning(f"Error getting string values: {str(e)}")
            short_name = long_name = sector = industry = exchange = currency = ""
        
        return {
            "symbol": symbol,
            "currentPrice": current_price,
            "change": change,
            "changePercent": change_percent,
            "volume": volume,
            "marketCap": market_cap,
            "peRatio": pe_ratio if pe_ratio > 0 else None,
            "dividendYield": dividend_yield,
            "fiftyTwoWeekHigh": fifty_two_week_high,
            "fiftyTwoWeekLow": fifty_two_week_low,
            "analystRating": latest_rating,
            "shortName": short_name,
            "longName": long_name,
            "sector": sector,
            "industry": industry,
            "exchange": exchange,
            "currency": currency
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error fetching data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching data for {symbol}: {str(e)}")

@app.get("/news/{symbol}")
@retry_on_failure(max_retries=3, delay=1)
async def get_stock_news(symbol: str):
    """Get news for a specific stock symbol."""
    try:
        formatted_symbol = format_symbol(symbol)
        
        # Use Search to get stock news
        search_results = yf.Search(formatted_symbol, news_count=10)
        news_items = search_results.news
        logger.info(f"Fetched {len(news_items) if news_items else 0} news items for {formatted_symbol}")
        
        if not news_items:
            logger.warning(f"No news found for {formatted_symbol}")
            return {"feed": []}
            
        # Process and validate each news item
        feed = []
        for item in news_items:
            if not item:
                continue
                
            # Validate and format timestamp
            timestamp = item.get("providerPublishTime")
            if timestamp:
                try:
                    # Convert Unix timestamp to ISO format
                    from datetime import datetime
                    publish_time = datetime.fromtimestamp(timestamp).isoformat()
                except (ValueError, TypeError) as e:
                    logger.warning(f"Error formatting timestamp for {formatted_symbol}: {e}")
                    continue  # Skip items with invalid timestamps
            else:
                continue  # Skip items without timestamps
            
            title = item.get("title")
            if not title:
                continue  # Skip items without titles
                
            feed.append({
                "title": title,
                "url": item.get("link", ""),
                "time_published": publish_time,
                "summary": item.get("summary", ""),
                "source": item.get("publisher", "Unknown")
            })
            logger.debug(f"Added news item for {formatted_symbol}: {title[:50]}...")
        
        # Sort by publish time, most recent first
        feed.sort(key=lambda x: x["time_published"], reverse=True)
        
        logger.info(f"Returning {len(feed)} processed news items for {formatted_symbol}")
        return {"feed": feed}
    except Exception as e:
        logger.error(f"Error fetching news for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching news for {symbol}: {str(e)}")

@app.get("/market-news")
@retry_on_failure(max_retries=3, delay=1)
async def get_market_news():
    """Get general market news using market search."""
    try:
        # Use Search to get market news
        search_results = yf.Search("market", news_count=20)
        news_items = search_results.news
        logger.info(f"Fetched {len(news_items) if news_items else 0} market news items")
        
        if not news_items:
            logger.warning("No market news found")
            return {"feed": []}
            
        # Process and validate each news item
        feed = []
        for item in news_items:
            if not item:
                continue
                
            # Validate and format timestamp
            timestamp = item.get("providerPublishTime")
            if timestamp:
                try:
                    # Convert Unix timestamp to ISO format
                    from datetime import datetime
                    publish_time = datetime.fromtimestamp(timestamp).isoformat()
                except (ValueError, TypeError) as e:
                    logger.warning(f"Error formatting timestamp: {e}")
                    continue  # Skip items with invalid timestamps
            else:
                continue  # Skip items without timestamps
            
            title = item.get("title")
            if not title:
                continue  # Skip items without titles
                
            feed.append({
                "title": title,
                "url": item.get("link", ""),
                "time_published": publish_time,
                "summary": item.get("summary", ""),
                "source": item.get("publisher", "Unknown")
            })
            logger.debug(f"Added news item: {title[:50]}...")
        
        # Sort by publish time, most recent first
        feed.sort(key=lambda x: x["time_published"], reverse=True)
        
        logger.info(f"Returning {len(feed)} processed news items")
        return {"feed": feed}
    except Exception as e:
        logger.error(f"Error fetching market news: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching market news: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000) 