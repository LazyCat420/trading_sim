import asyncio
from datetime import datetime, time
import json
from typing import List, Dict, Optional
import pytz
from playwright.sync_api import sync_playwright
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from models import Trade, Position, Portfolio, MarketAnalysis, TradeType, TradeStatus
import logging

# Import chromadb directly
import chromadb
from chromadb.config import Settings
import aiohttp
import yfinance as yf
import pandas as pd
import os
from dotenv import load_dotenv

load_dotenv()

# Set up logging
logger = logging.getLogger(__name__)

# Initialize database
engine = create_engine('sqlite:///trading_bot.db')

def initialize_chroma_client():
    """Initialize the Chroma client with the correct configuration"""
    try:
        client = chromadb.PersistentClient(
            path="./chroma_db",
            settings=Settings(
                anonymized_telemetry=False,  # Disable telemetry if desired
                is_persistent=True
            )
        )
        return client
    except Exception as e:
        logger.error(f"Error initializing Chroma client: {e}")
        raise

class TradingBot:
    def __init__(self):
        self.ollama_url = os.getenv('OLLAMA_API_URL')  # Get Ollama API URL from environment
        if not self.ollama_url:
            logger.error("OLLAMA_API_URL not found in environment variables")
            raise ValueError("OLLAMA_API_URL not found")
        logger.info(f"Using Ollama API URL: {self.ollama_url}")
        
        self.model = "llama3.3:latest"  # Using llama3.3:latest model
        self.news_sources = [
            "https://finance.yahoo.com",
            "https://www.marketwatch.com",
            "https://www.reuters.com/markets",
            # Add more sources as needed
        ]
        try:
            self.chroma_client = initialize_chroma_client()
            # Get existing collection or create new one
            self.collection = self.chroma_client.get_or_create_collection(
                name="market_data",
                metadata={"description": "Market data and analysis"}
            )
        except Exception as e:
            logger.error(f"Error initializing ChromaDB: {e}")
            raise

    async def query_ollama(self, prompt: str) -> str:
        """Send a query to the Ollama server"""
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "You are a sophisticated AI trading analyst."},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": False
                }
                
                async with session.post(self.ollama_url, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        return result['message']['content']
                    else:
                        error_text = await response.text()
                        raise Exception(f"Ollama API error: {error_text}")
        except Exception as e:
            logger.error(f"Error querying Ollama: {e}")
            return "Error analyzing market data. Please try again later."

    async def scrape_news(self) -> List[Dict]:
        """Get financial news using yfinance"""
        news_data = []
        indices = ["^GSPC", "^DJI", "^IXIC"]  # S&P 500, Dow Jones, NASDAQ
        
        try:
            for symbol in indices:
                try:
                    logger.info(f"Getting news for {symbol}")
                    ticker = yf.Ticker(symbol)
                    news_items = ticker.news or []
                    
                    for item in news_items[:5]:  # Get top 5 news items per index
                        news_data.append({
                            "title": item.get("title", ""),
                            "url": item.get("link", ""),
                            "source": item.get("publisher", ""),
                            "timestamp": datetime.fromtimestamp(item.get("providerPublishTime", 0)).isoformat()
                        })
                    logger.info(f"Got {len(news_items)} news items for {symbol}")
                except Exception as e:
                    logger.error(f"Error getting news for {symbol}: {str(e)}", exc_info=True)
                    continue
            
            logger.info(f"Successfully got {len(news_data)} total news items")
            return news_data
            
        except Exception as e:
            logger.error(f"Error in scrape_news: {str(e)}", exc_info=True)
            return []

    async def analyze_market(self, session: Session) -> MarketAnalysis:
        """Analyze market conditions using scraped data and LLM"""
        try:
            # Scrape latest news
            logger.info("Starting market analysis")
            news_data = await self.scrape_news()
            logger.info(f"Got {len(news_data)} news articles")
            
            # Prepare context for LLM
            news_context = "\n".join([
                f"Title: {article['title']}\nSource: {article['source']}\nURL: {article['url']}\n"
                for article in news_data
            ])
            
            # Get market data for major indices
            indices = ["^GSPC", "^DJI", "^IXIC"]  # S&P 500, Dow Jones, NASDAQ
            market_data = {}
            for index in indices:
                try:
                    logger.info(f"Getting data for index {index}")
                    ticker = yf.Ticker(index)
                    info = ticker.info
                    market_data[index] = {
                        "price": info.get("regularMarketPrice"),
                        "change": info.get("regularMarketChangePercent")
                    }
                    logger.info(f"Successfully got data for {index}")
                except Exception as e:
                    logger.error(f"Error getting data for index {index}: {e}")
                    continue
            
            if not market_data:
                raise Exception("Failed to get market data for all indices")
            
            # Analyze with Ollama
            logger.info("Sending analysis request to Ollama")
            prompt = f"""
            Based on the following market news and data, analyze the current market conditions and suggest potential trades.
            Consider market sentiment, trends, and potential opportunities.

            Current Market Data:
            {json.dumps(market_data, indent=2)}

            Recent News:
            {news_context}

            Please provide:
            1. Overall market sentiment analysis
            2. Specific trading opportunities
            3. Risk assessment
            4. Recommended trades with entry points and stop losses
            """

            analysis = await self.query_ollama(prompt)
            logger.info("Received analysis from Ollama")
            
            # Create market analysis record
            market_analysis = MarketAnalysis(
                summary=analysis,
                sentiment_score=0.0,  # TODO: Implement sentiment scoring
                data_sources=json.dumps({
                    "news_sources": self.news_sources,
                    "market_indices": indices
                })
            )
            
            session.add(market_analysis)
            session.commit()
            logger.info("Saved market analysis to database")
            
            # Store in vector database
            try:
                self.collection.add(
                    documents=[analysis],
                    metadatas=[{"timestamp": datetime.utcnow().isoformat()}],
                    ids=[str(market_analysis.id)]
                )
                logger.info("Stored analysis in vector database")
            except Exception as e:
                logger.error(f"Error storing analysis in vector database: {e}")
                # Continue even if vector storage fails
            
            return market_analysis
            
        except Exception as e:
            logger.error(f"Error in analyze_market: {e}")
            raise

    def get_current_price(self, symbol: str) -> float:
        """Get current price for a symbol"""
        try:
            ticker = yf.Ticker(symbol)
            return ticker.info.get("regularMarketPrice", 0.0)
        except Exception as e:
            print(f"Error getting price for {symbol}: {str(e)}")
            return 0.0

    def is_market_open(self) -> bool:
        """Check if the US stock market is currently open"""
        ny_tz = pytz.timezone('America/New_York')
        now = datetime.now(ny_tz)
        
        # Check if it's a weekday
        if now.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return False
        
        # Regular market hours (9:30 AM - 4:00 PM ET)
        market_open = now.replace(hour=9, minute=30, second=0)
        market_close = now.replace(hour=16, minute=0, second=0)
        
        return market_open <= now <= market_close

    async def execute_trades(self, session: Session):
        """Execute pending trades if conditions are met"""
        pending_trades = session.query(Trade).filter_by(status=TradeStatus.PENDING).all()
        
        for trade in pending_trades:
            # Skip if scheduled for future
            if trade.scheduled_for and trade.scheduled_for > datetime.utcnow():
                continue
                
            # Check if market is open for stock trades
            if not self.is_market_open():
                continue
                
            try:
                current_price = self.get_current_price(trade.symbol)
                
                # Check if price target is met
                if trade.price_target:
                    if trade.type == TradeType.BUY and current_price > trade.price_target:
                        continue
                    if trade.type == TradeType.SELL and current_price < trade.price_target:
                        continue
                
                # Execute trade
                position = session.query(Position).filter_by(symbol=trade.symbol).first()
                portfolio = session.query(Portfolio).first()
                
                if trade.type == TradeType.BUY:
                    cost = trade.quantity * current_price
                    if cost > portfolio.cash:
                        continue
                        
                    portfolio.cash -= cost
                    if position:
                        # Update existing position
                        total_value = (position.quantity * position.average_price) + cost
                        position.quantity += trade.quantity
                        position.average_price = total_value / position.quantity
                    else:
                        # Create new position
                        position = Position(
                            symbol=trade.symbol,
                            quantity=trade.quantity,
                            average_price=current_price
                        )
                        session.add(position)
                        
                else:  # SELL
                    if not position or position.quantity < trade.quantity:
                        continue
                        
                    proceeds = trade.quantity * current_price
                    portfolio.cash += proceeds
                    position.quantity -= trade.quantity
                    
                    if position.quantity == 0:
                        session.delete(position)
                
                trade.status = TradeStatus.EXECUTED
                trade.price = current_price
                portfolio.last_updated = datetime.utcnow()
                
                # Update total portfolio value
                positions = session.query(Position).all()
                portfolio.total_value = portfolio.cash + sum(
                    pos.quantity * self.get_current_price(pos.symbol)
                    for pos in positions
                )
                
                session.commit()
                
            except Exception as e:
                print(f"Error executing trade {trade.id}: {str(e)}")
                continue

    async def run(self):
        """Main bot loop"""
        logger.info("Starting trading bot")
        while True:
            try:
                with Session(engine) as session:
                    # Perform market analysis
                    logger.info("Starting market analysis cycle")
                    await self.analyze_market(session)
                    logger.info("Completed market analysis")
                    
                    # Execute pending trades
                    logger.info("Starting trade execution cycle")
                    await self.execute_trades(session)
                    logger.info("Completed trade execution")
                    
                # Sleep for 5 minutes before next iteration
                logger.info("Sleeping for 5 minutes")
                await asyncio.sleep(300)
                    
            except Exception as e:
                logger.error(f"Error in bot loop: {e}")
                # Sleep for 1 minute on error before retrying
                logger.info("Sleeping for 1 minute after error")
                await asyncio.sleep(60)
                continue

if __name__ == "__main__":
    bot = TradingBot()
    asyncio.run(bot.run()) 