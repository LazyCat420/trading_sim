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
        info = stock.info
        
        if not info:
            logger.error(f"No data found for symbol {formatted_symbol}")
            raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
            
        history = stock.history(period="1d")
        if history.empty:
            logger.warning(f"No historical data found for {formatted_symbol}")
        
        # Get current price from either source
        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        if not current_price:
            logger.error(f"Unable to fetch current price for {formatted_symbol}")
            raise HTTPException(status_code=500, detail=f"Unable to fetch current price for {symbol}")
        
        # Get price change
        change = info.get("regularMarketChange") or 0
        change_percent = info.get("regularMarketChangePercent") or 0
        
        # Get recommendations with error handling
        try:
            recommendations = stock.recommendations
            latest_rating = None
            if recommendations is not None and not recommendations.empty:
                latest = recommendations.iloc[-1]
                latest_rating = {
                    "firm": latest.get("Firm", "N/A"),
                    "grade": latest.get("To Grade", "N/A"),
                    "action": latest.get("Action", "N/A")
                }
        except Exception as e:
            logger.warning(f"Failed to fetch recommendations: {str(e)}")
            latest_rating = None
        
        return {
            "symbol": symbol,
            "currentPrice": current_price,
            "change": change,
            "changePercent": change_percent,
            "volume": info.get("regularMarketVolume") or 0,
            "marketCap": info.get("marketCap") or "N/A",
            "peRatio": info.get("forwardPE"),
            "dividendYield": info.get("dividendYield"),
            "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow"),
            "analystRating": latest_rating,
            "shortName": info.get("shortName"),
            "longName": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "exchange": info.get("exchange"),
            "currency": info.get("currency")
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error fetching data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching data for {symbol}: {str(e)}")

@app.get("/news/{symbol}")
@retry_on_failure(max_retries=3, delay=1)
async def get_stock_news(symbol: str):
    try:
        stock = yf.Ticker(symbol)
        news = stock.news
        
        if not news:
            return {"feed": []}
            
        feed = [{
            "title": item.get("title"),
            "url": item.get("link"),
            "time_published": item.get("providerPublishTime"),
            "summary": item.get("summary", ""),
            "source": item.get("publisher")
        } for item in news]
        
        return {"feed": feed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching news for {symbol}: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000) 