from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from datetime import datetime
import asyncio
import aiohttp
import base64
from io import BytesIO
from typing import List, Optional
from pydantic import BaseModel
import logging
from models import Trade, Position, Portfolio, MarketAnalysis, TradeType, TradeStatus
from trading_bot import TradingBot
from stock_api import router as stock_router
import sys

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Windows specific event loop policy
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

app = FastAPI()

# Enable CORS with more specific configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the stock router
app.include_router(stock_router, prefix="/stock")

# Database
engine = create_engine('sqlite:///trading_bot.db')

# Initialize trading bot
trading_bot = TradingBot()
bot_task = None

class TradeCreate(BaseModel):
    symbol: str
    type: str
    quantity: int
    price_target: Optional[float] = None
    scheduled_for: Optional[datetime] = None

class PortfolioResponse(BaseModel):
    cash: float
    total_value: float
    positions: List[dict]

class VisionAnalysisRequest(BaseModel):
    image_data: str
    query: str

@app.post("/api/vision/analyze")
async def analyze_image(request: VisionAnalysisRequest):
    """Analyze an image using the llama vision model"""
    try:
        # Convert base64 image to bytes
        image_bytes = base64.b64decode(request.image_data)
        
        # Prepare the request for Ollama
        async with aiohttp.ClientSession() as session:
            payload = {
                "model": "llama2:13b",  # Using llama2 13b model
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "data": request.image_data
                            },
                            {
                                "type": "text",
                                "data": request.query
                            }
                        ]
                    }
                ],
                "stream": False
            }
            
            async with session.post(f"{trading_bot.ollama_url}/generate", json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    return {"analysis": result['response']}
                else:
                    raise HTTPException(status_code=500, detail="Failed to analyze image")
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trades")
async def create_trade(trade: TradeCreate):
    with Session(engine) as session:
        db_trade = Trade(
            symbol=trade.symbol,
            type=TradeType[trade.type],
            quantity=trade.quantity,
            price_target=trade.price_target,
            scheduled_for=trade.scheduled_for,
            status=TradeStatus.PENDING
        )
        session.add(db_trade)
        session.commit()
        return {"id": db_trade.id}

@app.get("/api/trades")
async def get_trades():
    with Session(engine) as session:
        trades = session.query(Trade).all()
        return [{
            "id": t.id,
            "symbol": t.symbol,
            "type": t.type.value,
            "quantity": t.quantity,
            "price": t.price,
            "status": t.status.value,
            "scheduled_for": t.scheduled_for.isoformat() if t.scheduled_for else None,
            "price_target": t.price_target,
            "timestamp": t.timestamp.isoformat()
        } for t in trades]

@app.get("/api/portfolio")
async def get_portfolio():
    with Session(engine) as session:
        portfolio = session.query(Portfolio).first()
        if not portfolio:
            portfolio = Portfolio(cash=1000.0, total_value=1000.0)
            session.add(portfolio)
            session.commit()

        positions = session.query(Position).all()
        return {
            "cash": portfolio.cash,
            "total_value": portfolio.total_value,
            "positions": [{
                "symbol": p.symbol,
                "quantity": p.quantity,
                "average_price": p.average_price,
                "current_price": trading_bot.get_current_price(p.symbol),
                "market_value": p.quantity * trading_bot.get_current_price(p.symbol),
                "profit_loss": (trading_bot.get_current_price(p.symbol) - p.average_price) * p.quantity
            } for p in positions]
        }

@app.post("/api/bot/analyze")
async def trigger_analysis(background_tasks: BackgroundTasks):
    """Trigger a new market analysis"""
    try:
        with Session(engine) as session:
            analysis = await trading_bot.analyze_market(session)
            return {
                "id": analysis.id,
                "timestamp": analysis.timestamp.isoformat(),
                "summary": analysis.summary
            }
    except Exception as e:
        logger.error(f"Error triggering analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bot/status")
async def get_bot_status():
    """Get the current status of the trading bot"""
    return {
        "is_running": bot_task and not bot_task.done(),
        "market_open": trading_bot.is_market_open()
    }

@app.on_event("startup")
async def startup_event():
    global bot_task
    bot_task = asyncio.create_task(trading_bot.run())

@app.on_event("shutdown")
async def shutdown_event():
    if bot_task:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 