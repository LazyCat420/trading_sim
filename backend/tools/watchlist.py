from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import logging
import traceback
from typing import Optional, List
import aiosqlite
import os
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "stocks.db")

class WatchlistItem(BaseModel):
    symbol: str = Field(..., description="Stock symbol")
    name: Optional[str] = Field(None, description="Stock name")
    last_price: Optional[float] = Field(None, description="Last known price")
    last_updated: Optional[str] = Field(None, description="Last update timestamp")

class WatchlistResponse(BaseModel):
    items: List[WatchlistItem]
    total: int
    message: Optional[str] = None

async def init_watchlist_db():
    """Initialize the watchlist database tables"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            # Drop existing table if it exists
            await db.execute("DROP TABLE IF EXISTS watchlist")
            await db.commit()
            
            # Create new table with correct schema
            await db.execute("""
                CREATE TABLE IF NOT EXISTS watchlist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    symbol TEXT NOT NULL,
                    name TEXT,
                    last_price REAL,
                    last_updated TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, symbol)
                )
            """)
            await db.commit()
            logger.info("Watchlist table initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize watchlist table: {str(e)}")
        logger.error(traceback.format_exc())
        raise

@router.post("/{user_id}/add", response_model=WatchlistResponse)
async def add_to_watchlist(user_id: int, item: WatchlistItem):
    """Add a stock to user's watchlist"""
    try:
        logger.info(f"Adding {item.symbol} to watchlist for user {user_id}")
        
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            
            # Check if symbol already exists
            cursor = await db.execute(
                "SELECT * FROM watchlist WHERE user_id = ? AND symbol = ?",
                (user_id, item.symbol)
            )
            existing = await cursor.fetchone()
            
            if existing:
                # Update existing entry
                await db.execute("""
                    UPDATE watchlist 
                    SET name = ?, last_price = ?, last_updated = ?
                    WHERE user_id = ? AND symbol = ?
                """, (
                    item.name,
                    item.last_price,
                    datetime.now().isoformat(),
                    user_id,
                    item.symbol
                ))
            else:
                # Add new entry
                await db.execute("""
                    INSERT INTO watchlist (user_id, symbol, name, last_price, last_updated)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    user_id,
                    item.symbol,
                    item.name,
                    item.last_price,
                    datetime.now().isoformat()
                ))
            
            await db.commit()
            
            # Get updated watchlist
            cursor = await db.execute(
                "SELECT * FROM watchlist WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,)
            )
            rows = await cursor.fetchall()
            
            items = [
                WatchlistItem(
                    symbol=row['symbol'],
                    name=row['name'],
                    last_price=row['last_price'],
                    last_updated=row['last_updated']
                ) for row in rows
            ]
            
            return WatchlistResponse(
                items=items,
                total=len(items),
                message=f"Successfully {'updated' if existing else 'added'} {item.symbol}"
            )
            
    except Exception as e:
        logger.error(f"Error adding to watchlist: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to update watchlist", "message": str(e)}
        )

@router.delete("/{user_id}/remove/{symbol}", response_model=WatchlistResponse)
async def remove_from_watchlist(user_id: int, symbol: str):
    """Remove a stock from user's watchlist"""
    try:
        logger.info(f"Removing {symbol} from watchlist for user {user_id}")
        
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            
            # Remove the symbol
            await db.execute(
                "DELETE FROM watchlist WHERE user_id = ? AND symbol = ?",
                (user_id, symbol)
            )
            await db.commit()
            
            # Get updated watchlist
            cursor = await db.execute(
                "SELECT * FROM watchlist WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,)
            )
            rows = await cursor.fetchall()
            
            items = [
                WatchlistItem(
                    symbol=row['symbol'],
                    name=row['name'],
                    last_price=row['last_price'],
                    last_updated=row['last_updated']
                ) for row in rows
            ]
            
            return WatchlistResponse(
                items=items,
                total=len(items),
                message=f"Successfully removed {symbol}"
            )
            
    except Exception as e:
        logger.error(f"Error removing from watchlist: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to remove from watchlist", "message": str(e)}
        )

@router.get("/{user_id}", response_model=WatchlistResponse)
async def get_watchlist(user_id: int):
    """Get user's watchlist"""
    try:
        logger.info(f"Fetching watchlist for user {user_id}")
        
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            
            cursor = await db.execute(
                "SELECT * FROM watchlist WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,)
            )
            rows = await cursor.fetchall()
            
            items = [
                WatchlistItem(
                    symbol=row['symbol'],
                    name=row['name'],
                    last_price=row['last_price'],
                    last_updated=row['last_updated']
                ) for row in rows
            ]
            
            return WatchlistResponse(
                items=items,
                total=len(items),
                message=None
            )
            
    except Exception as e:
        logger.error(f"Error fetching watchlist: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to fetch watchlist", "message": str(e)}
        )

# Initialize database when module is imported
import asyncio
try:
    asyncio.run(init_watchlist_db())
except Exception as e:
    logger.error(f"Failed to initialize database: {str(e)}")
    logger.error(traceback.format_exc())
