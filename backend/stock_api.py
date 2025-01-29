from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import time
from functools import wraps
import logging
import aiohttp
import os
from dotenv import load_dotenv
import yfinance as yf
import pandas as pd
from database import get_db
import database as db

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

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
                    if attempt < max_retries - 1:
                        time.sleep(delay)
            raise last_error
        return wrapper
    return decorator

def format_symbol(symbol: str) -> str:
    """Format symbol to handle different exchanges."""
    symbol = symbol.upper()
    
    exchange_mappings = {
        'TSE:': '.T',    # Tokyo Stock Exchange
        'TSEC:': '.TW',  # Taiwan Stock Exchange
        'LSE:': '.L',    # London Stock Exchange
        'FRA:': '.F',    # Frankfurt Stock Exchange
        'HKG:': '.HK',   # Hong Kong Stock Exchange
    }
    
    for prefix, suffix in exchange_mappings.items():
        if symbol.startswith(prefix):
            return symbol.replace(prefix, '') + suffix
            
    return symbol

class StockHistory(BaseModel):
    date: str
    price: float
    volume: int
    high: float
    low: float
    open: float
    close: float

class StockInfo(BaseModel):
    symbol: str
    currentPrice: float
    change: float
    changePercent: float
    volume: int
    marketCap: float
    peRatio: Optional[float] = None
    dividendYield: Optional[float] = None
    fiftyTwoWeekHigh: Optional[float] = None
    fiftyTwoWeekLow: Optional[float] = None
    shortName: Optional[str] = None
    longName: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    exchange: Optional[str] = None
    currency: Optional[str] = None
    analystRating: Optional[dict] = None

class StockCreate(BaseModel):
    symbol: str
    name: Optional[str] = None

class StockResponse(BaseModel):
    id: int
    symbol: str
    name: Optional[str]
    added_at: datetime
    last_price: Optional[float]
    last_updated: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True

# Watchlist models
class WatchlistItem(BaseModel):
    symbol: str

class WatchlistResponse(BaseModel):
    symbol: str
    name: str | None
    last_price: float | None
    last_updated: str | None

@router.get("/{symbol}")
@retry_on_failure(max_retries=3, delay=1)
async def get_stock_info(symbol: str):
    try:
        formatted_symbol = format_symbol(symbol)
        logger.info(f"Fetching data for symbol: {formatted_symbol}")
        
        stock = yf.Ticker(formatted_symbol)
        info = stock.info
        
        if not info:
            logger.error(f"No info data found for {formatted_symbol}")
            raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")

        # Get current price and market data
        current_price = info.get("currentPrice", info.get("regularMarketPrice", 0))
        previous_close = info.get("previousClose", info.get("regularMarketPreviousClose", 0))
        
        # Calculate change and change percent
        change = current_price - previous_close if previous_close else 0
        change_percent = (change / previous_close * 100) if previous_close else 0

        # Get analyst rating
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
        
        stock_info = StockInfo(
            symbol=symbol,
            currentPrice=float(current_price),
            change=float(change),
            changePercent=float(change_percent),
            volume=info.get("volume", info.get("regularMarketVolume", 0)),
            marketCap=info.get("marketCap", 0),
            peRatio=info.get("forwardPE", info.get("trailingPE")),
            dividendYield=info.get("dividendYield"),
            fiftyTwoWeekHigh=info.get("fiftyTwoWeekHigh"),
            fiftyTwoWeekLow=info.get("fiftyTwoWeekLow"),
            shortName=info.get("shortName"),
            longName=info.get("longName"),
            sector=info.get("sector"),
            industry=info.get("industry"),
            exchange=info.get("exchange"),
            currency=info.get("currency"),
            analystRating=latest_rating
        )
        
        return stock_info
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error fetching data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{symbol}")
@retry_on_failure(max_retries=3, delay=1)
async def get_stock_history(
    symbol: str,
    period: str = "1d",  # 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    interval: str = "1d"  # 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
):
    try:
        logger.info(f"=== Starting get_stock_history ===")
        logger.info(f"Parameters: symbol={symbol}, period={period}, interval={interval}")
        
        formatted_symbol = format_symbol(symbol)
        logger.info(f"Formatted symbol: {formatted_symbol}")
        
        stock = yf.Ticker(formatted_symbol)
        logger.info(f"Created Ticker object")
        
        # Try different periods if the first one fails
        periods_to_try = [period, "5d", "1mo", "3mo"]
        history = None
        
        for try_period in periods_to_try:
            try:
                # Get history data
                logger.info(f"Fetching history with period={try_period}, interval={interval}")
                history = stock.history(period=try_period, interval=interval)
                if not history.empty:
                    logger.info(f"Successfully got data with period={try_period}")
                    break
            except Exception as e:
                logger.warning(f"Failed to get data with period={try_period}: {str(e)}")
                continue
        
        if history is None or history.empty:
            # Try getting quote data as fallback
            logger.info("Attempting to get current quote data as fallback")
            info = stock.info
            if info and (info.get("regularMarketPrice") or info.get("currentPrice")):
                current_price = info.get("regularMarketPrice") or info.get("currentPrice")
                current_time = datetime.now()
                
                # Create a single data point with current price
                history = pd.DataFrame({
                    "Open": [current_price],
                    "High": [current_price],
                    "Low": [current_price],
                    "Close": [current_price],
                    "Volume": [info.get("volume", 0) or info.get("regularMarketVolume", 0)],
                }, index=[current_time])
            else:
                logger.error("No history data or current price found")
                raise HTTPException(status_code=404, detail=f"No historical data found for {symbol}")
            
        logger.info(f"Got {len(history)} data points")
        logger.info(f"Date range: {history.index.min()} to {history.index.max()}")
        
        # Format the response data
        formatted_data = []
        for index, row in history.iterrows():
            try:
                data_point = StockHistory(
                    date=index.strftime("%Y-%m-%d %H:%M:%S"),
                    price=float(row["Close"]),
                    volume=int(row["Volume"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    open=float(row["Open"]),
                    close=float(row["Close"])
                )
                formatted_data.append(data_point.dict())
            except Exception as e:
                logger.error(f"Error formatting row: {e}")
                logger.error(f"Problematic row: {row}")
                continue
                
        logger.info(f"Formatted {len(formatted_data)} data points")
        if formatted_data:
            logger.info(f"First data point: {formatted_data[0]}")
            logger.info(f"Last data point: {formatted_data[-1]}")
            
        return {"data": formatted_data}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in get_stock_history: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/similar/{symbol}")
@retry_on_failure(max_retries=3, delay=1)
async def get_similar_stocks(symbol: str):
    try:
        formatted_symbol = format_symbol(symbol)
        stock = yf.Ticker(formatted_symbol)
        info = stock.info
        
        sector = info.get("sector")
        industry = info.get("industry")
        
        if not sector or not industry:
            raise HTTPException(status_code=404, detail="No sector/industry information available")
            
        similar_stocks = []
        for similar_symbol in yf.Tickers(f"^{sector}").tickers:
            if similar_symbol != formatted_symbol:
                try:
                    similar_info = similar_symbol.info
                    if similar_info.get("industry") == industry:
                        similar_stocks.append({
                            "symbol": similar_symbol.ticker,
                            "name": similar_info.get("shortName"),
                            "price": similar_info.get("currentPrice"),
                            "marketCap": similar_info.get("marketCap")
                        })
                    if len(similar_stocks) >= 5:
                        break
                except:
                    continue
                    
        return similar_stocks
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error finding similar stocks for {symbol}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/dividends/{symbol}")
@retry_on_failure(max_retries=3, delay=1)
async def get_dividend_history(symbol: str):
    try:
        formatted_symbol = format_symbol(symbol)
        stock = yf.Ticker(formatted_symbol)
        dividends = stock.dividends
        
        return [
            {
                "date": date.strftime("%Y-%m-%d"),
                "dividend": amount
            }
            for date, amount in dividends.items()
        ]
    except Exception as e:
        logger.error(f"Error fetching dividends for {symbol}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/news/{symbol}")
@retry_on_failure(max_retries=3, delay=1)
async def get_stock_news(symbol: str, date: str = None):
    try:
        logger.info(f"Fetching news for {symbol}, date={date}")
        formatted_symbol = format_symbol(symbol)
        
        # Use yfinance to get news
        stock = yf.Ticker(formatted_symbol)
        news_items = stock.news or []  # Ensure we have a list even if news is None
        
        logger.info(f"Retrieved {len(news_items)} news items from yfinance")
        
        # Format the response
        formatted_feed = []
        for item in news_items:
            try:
                # Get the first thumbnail URL if available
                thumbnail_url = ""
                if item.get("thumbnail") and item["thumbnail"].get("resolutions"):
                    thumbnail_url = item["thumbnail"]["resolutions"][0].get("url", "")
                
                formatted_feed.append({
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "time_published": datetime.fromtimestamp(item.get("providerPublishTime", 0)).strftime("%Y-%m-%d %H:%M:%S"),
                    "summary": item.get("publisher", "") + ": " + item.get("title", ""),
                    "source": item.get("publisher", ""),
                    "symbol": formatted_symbol,
                    "image_url": thumbnail_url
                })
            except Exception as e:
                logger.error(f"Error formatting news item: {e}")
                continue
        
        logger.info(f"Returning {len(formatted_feed)} formatted news items")
        return {"feed": formatted_feed}
                
    except Exception as e:
        logger.error(f"Error in news endpoint: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

async def get_market_summary(symbol: str, target_date: datetime.date = None):
    """Helper function to get market summary when no news is found"""
    try:
        if not target_date:
            return {"feed": []}
            
        stock = yf.Ticker(symbol)
        hist_data = stock.history(start=target_date - timedelta(days=1), 
                                end=target_date + timedelta(days=1))
        
        if not hist_data.empty:
            target_data = hist_data.loc[hist_data.index.date == target_date]
            if not target_data.empty:
                row = target_data.iloc[0]
                price_change = ((row['Close'] - row['Open']) / row['Open']) * 100
                direction = "increased" if price_change > 0 else "decreased"
                
                return {"feed": [{
                    "title": f"{symbol} Market Summary for {target_date}",
                    "url": f"https://finance.yahoo.com/quote/{symbol}/history",
                    "time_published": target_date.strftime("%Y-%m-%d %H:%M:%S"),
                    "summary": f"On {target_date}, {symbol} stock {direction} by {abs(price_change):.1f}%. "
                             f"Opening at ${row['Open']:.2f} and closing at ${row['Close']:.2f} "
                             f"with a trading volume of {int(row['Volume']):,}.",
                    "source": "Market Data",
                    "sentiment": "Positive" if price_change > 0 else "Negative",
                    "sentiment_score": price_change / 100
                }]}
        
        return {"feed": []}
    except Exception as e:
        logger.error(f"Error creating market summary: {e}")
        return {"feed": []}

@router.get("/market-news")
@retry_on_failure(max_retries=3, delay=1)
async def get_market_news(
    from_date: str = None,
    to_date: str = None,
    tickers: str = None,
    limit: int = 50
):
    try:
        logger.info(f"Starting market news fetch with params: from={from_date}, to={to_date}, tickers={tickers}")
        
        # Use yfinance to get news for major indices
        indices = ["^GSPC", "^DJI", "^IXIC"]  # S&P 500, Dow Jones, NASDAQ
        if tickers:
            indices.extend(tickers.split(','))
        
        all_news = []
        for symbol in indices:
            try:
                stock = yf.Ticker(symbol)
                news_items = stock.news or []  # Ensure we have a list even if news is None
                if news_items:
                    # Add symbol to each news item
                    for item in news_items:
                        item["symbol"] = symbol
                    all_news.extend(news_items)
            except Exception as e:
                logger.warning(f"Error fetching news for {symbol}: {e}")
                continue
        
        # Sort by publish time and limit
        all_news.sort(key=lambda x: x.get("providerPublishTime", 0), reverse=True)
        all_news = all_news[:limit]
        
        # Format the response
        formatted_news = []
        for item in all_news:
            try:
                # Get the first thumbnail URL if available
                thumbnail_url = ""
                if item.get("thumbnail") and item["thumbnail"].get("resolutions"):
                    thumbnail_url = item["thumbnail"]["resolutions"][0].get("url", "")
                
                formatted_news.append({
                    "symbol": item.get("symbol", ""),
                    "title": item.get("title", ""),
                    "summary": item.get("publisher", "") + ": " + item.get("title", ""),
                    "url": item.get("link", ""),
                    "time_published": datetime.fromtimestamp(item.get("providerPublishTime", 0)).strftime("%Y-%m-%d %H:%M:%S"),
                    "source": item.get("publisher", ""),
                    "image_url": thumbnail_url
                })
            except Exception as e:
                logger.error(f"Error formatting news item: {e}")
                continue
        
        logger.info(f"Successfully fetched {len(formatted_news)} news items")
        return {"feed": formatted_news}
                
    except Exception as e:
        logger.error(f"Error in market news endpoint: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/watchlist/")
async def add_to_watchlist(stock: StockCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            # Check if stock exists and is active
            cursor.execute(
                "SELECT * FROM stocks WHERE symbol = ? AND is_active = 1", 
                (stock.symbol,)
            )
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Stock already in watchlist")

            # Check if stock exists but is inactive
            cursor.execute(
                "SELECT * FROM stocks WHERE symbol = ? AND is_active = 0", 
                (stock.symbol,)
            )
            inactive_stock = cursor.fetchone()
            
            if inactive_stock:
                # Reactivate the stock
                cursor.execute(
                    "UPDATE stocks SET is_active = 1, last_updated = ? WHERE symbol = ?",
                    (datetime.utcnow(), stock.symbol)
                )
            else:
                # Add new stock
                cursor.execute("""
                    INSERT INTO stocks (symbol, name, last_updated)
                    VALUES (?, ?, ?)
                """, (stock.symbol, stock.name, datetime.utcnow()))
            
            conn.commit()
            
            # Get the inserted/updated stock
            cursor.execute("SELECT * FROM stocks WHERE symbol = ?", (stock.symbol,))
            db_stock = cursor.fetchone()
            
            return {
                "id": db_stock["id"],
                "symbol": db_stock["symbol"],
                "name": db_stock["name"],
                "added_at": db_stock["added_at"],
                "last_price": db_stock["last_price"],
                "last_updated": db_stock["last_updated"],
                "is_active": bool(db_stock["is_active"])
            }
            
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/watchlist/")
async def get_watchlist():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM stocks WHERE is_active = 1")
        stocks = cursor.fetchall()
        
        return [{
            "id": stock["id"],
            "symbol": stock["symbol"],
            "name": stock["name"],
            "added_at": stock["added_at"],
            "last_price": stock["last_price"],
            "last_updated": stock["last_updated"],
            "is_active": bool(stock["is_active"])
        } for stock in stocks]

@router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(symbol: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM stocks WHERE symbol = ?", (symbol,))
        stock = cursor.fetchone()
        
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")
        
        cursor.execute(
            "UPDATE stocks SET is_active = 0 WHERE symbol = ?",
            (symbol,)
        )
        conn.commit()
        
        return {"message": "Stock removed from watchlist"}

@router.get("/{symbol}")
async def get_stock_data(symbol: str):
    try:
        # Get stock data from yfinance
        stock = yf.Ticker(symbol)
        info = stock.info
        
        # Update database if stock is in watchlist
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM stocks WHERE symbol = ? AND is_active = 1", 
                (symbol,)
            )
            db_stock = cursor.fetchone()
            
            if db_stock:
                cursor.execute("""
                    UPDATE stocks 
                    SET last_price = ?, last_updated = ?, name = COALESCE(name, ?)
                    WHERE symbol = ?
                """, (
                    info.get('regularMarketPrice'),
                    datetime.utcnow(),
                    info.get('shortName') or info.get('longName'),
                    symbol
                ))
                conn.commit()
        
        return {
            "symbol": symbol,
            "currentPrice": info.get('regularMarketPrice'),
            "change": info.get('regularMarketChange'),
            "changePercent": info.get('regularMarketChangePercent'),
            "volume": info.get('regularMarketVolume'),
            "marketCap": info.get('marketCap'),
            "peRatio": info.get('forwardPE'),
            "dividendYield": info.get('dividendYield'),
            "fiftyTwoWeekHigh": info.get('fiftyTwoWeekHigh'),
            "fiftyTwoWeekLow": info.get('fiftyTwoWeekLow'),
            "shortName": info.get('shortName'),
            "longName": info.get('longName'),
            "sector": info.get('sector'),
            "industry": info.get('industry')
        }
    except Exception as e:
        logger.error(f"Error fetching stock data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock data: {str(e)}")

# Watchlist endpoints
@router.post("/watchlist/{user_id}/add")
async def add_to_watchlist(user_id: int, item: WatchlistItem):
    try:
        logger.info(f"Adding stock {item.symbol} to watchlist for user {user_id}")
        # First get the stock info to ensure it exists and get current price
        stock_info = await get_stock_info(item.symbol)
        
        # Add to watchlist
        success = db.add_to_watchlist(user_id, item.symbol)
        if not success:
            logger.warning(f"Stock {item.symbol} already in watchlist for user {user_id}")
            return {"message": "Stock already in watchlist"}
            
        return {"message": f"Stock {item.symbol} added to watchlist"}
    except Exception as e:
        logger.error(f"Error adding stock to watchlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/watchlist/{user_id}/remove/{symbol}")
async def remove_from_watchlist(user_id: int, symbol: str):
    try:
        logger.info(f"Removing stock {symbol} from watchlist for user {user_id}")
        success = db.remove_from_watchlist(user_id, symbol)
        if not success:
            logger.error(f"Stock {symbol} not found in watchlist for user {user_id}")
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found in watchlist")
        return {"message": f"Stock {symbol} removed from watchlist"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error removing stock from watchlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/watchlist/{user_id}")
async def get_user_watchlist(user_id: int) -> List[WatchlistResponse]:
    try:
        logger.info(f"Getting watchlist for user {user_id}")
        watchlist = db.get_user_watchlist(user_id)
        logger.info(f"Found {len(watchlist)} items in watchlist")
        
        result = []
        for item in watchlist:
            logger.debug(f"Processing watchlist item: {item}")
            logger.debug(f"last_updated type: {type(item['last_updated'])}, value: {item['last_updated']}")
            
            response = WatchlistResponse(
                symbol=item["symbol"],
                name=item["name"],
                last_price=item["last_price"],
                last_updated=item["last_updated"]  # SQLite datetime string is already in ISO format
            )
            result.append(response)
            
        return result
    except Exception as e:
        logger.error(f"Error getting watchlist: {str(e)}")
        logger.exception("Full traceback:")  # This will log the full stack trace
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/watchlist/{user_id}/clear")
async def clear_user_watchlist(user_id: int):
    try:
        db.clear_watchlist(user_id)
        return {"message": "Watchlist cleared successfully"}
    except Exception as e:
        logger.error(f"Error clearing watchlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Export the router instead of app
app = router

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 