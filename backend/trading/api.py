from fastapi import APIRouter, HTTPException
from typing import Dict, List, Optional
from datetime import datetime
from .bot_manager import TradingBot
from .automated_trader import AutomatedTrader
import logging

router = APIRouter()
trading_bot = TradingBot()
automated_trader = AutomatedTrader(trading_bot)
logger = logging.getLogger(__name__)

@router.get("/analyze/{symbol}")
async def analyze_stock(symbol: str, strategy: Optional[str] = None):
    """Analyze a stock using trading strategies"""
    try:
        analysis = trading_bot.analyze_position(symbol)
        if not analysis:
            raise HTTPException(status_code=404, detail=f"Could not analyze {symbol}")
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trade")
async def place_trade(
    symbol: str,
    order_type: str,
    quantity: float,
    price: float
):
    """Place a new trade"""
    try:
        order = trading_bot.place_order(symbol, order_type, quantity, price)
        if 'error' in order:
            raise HTTPException(status_code=400, detail=order['error'])
        return order
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/portfolio")
async def get_portfolio():
    """Get current portfolio summary"""
    try:
        return trading_bot.get_portfolio_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/positions")
async def get_positions():
    """Get active positions"""
    try:
        return trading_bot.get_active_positions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_trade_history():
    """Get trade history"""
    try:
        history = trading_bot.get_trade_history()
        # Ensure we return an array even if get_trade_history returns None or a non-array
        if not isinstance(history, list):
            return []
        return history
    except Exception as e:
        logger.error(f"Error getting trade history: {e}")
        return []  # Return empty array instead of raising an error

@router.get("/active-orders")
async def get_active_orders():
    """Get active orders"""
    try:
        return trading_bot.active_orders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/automate/start")
async def start_automated_trading():
    """Start automated trading"""
    try:
        await automated_trader.start_trading()
        return {"status": "success", "message": "Automated trading started"}
    except Exception as e:
        logger.error(f"Error starting automated trading: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/automate/stop")
async def stop_automated_trading():
    """Stop automated trading"""
    try:
        await automated_trader.stop_trading()
        return {"status": "success", "message": "Automated trading stopped"}
    except Exception as e:
        logger.error(f"Error stopping automated trading: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/automate/status")
async def get_automated_status():
    """Get automated trading status"""
    try:
        return automated_trader.get_status()
    except Exception as e:
        logger.error(f"Error getting automated status: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 