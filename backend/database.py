import sqlite3
from datetime import datetime
from contextlib import contextmanager
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the absolute path to the database file
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stocks.db')

# Create database connection
def create_connection():
    logger.info(f"Connecting to database at: {DB_PATH}")
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # This allows accessing columns by name
    return conn

# Context manager for database connections
@contextmanager
def get_db():
    conn = create_connection()
    try:
        yield conn
    finally:
        conn.close()

# Initialize the database when module is imported
def init_db():
    """Initialize the database with required tables"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create stocks table with UNIQUE constraint on symbol
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT UNIQUE NOT NULL,
                name TEXT,
                last_price REAL,
                last_updated TIMESTAMP,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create watchlist table with composite UNIQUE constraint
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_id INTEGER NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, stock_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (stock_id) REFERENCES stocks(id)
            )
        ''')
        
        # Create default user if it doesn't exist
        cursor.execute('SELECT id FROM users WHERE id = 1')
        if not cursor.fetchone():
            cursor.execute('''
                INSERT INTO users (id, email, password_hash)
                VALUES (1, 'default@example.com', 'default_hash')
            ''')
        
        conn.commit()
        logger.info("Database initialized successfully")

# Function to reset the database (for testing/debugging)
def reset_database():
    logger.info("Resetting database...")
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        logger.info("Deleted existing database file")
    init_db()
    logger.info("Database reset complete")

# User related functions
def create_user(email: str, password_hash: str) -> int:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            (email, password_hash)
        )
        conn.commit()
        return cursor.lastrowid

def get_user_by_email(email: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
        return cursor.fetchone()

# Watchlist related functions
def add_to_watchlist(user_id: int, stock_symbol: str, stock_name: str = None, last_price: float = None, last_updated: str = None):
    with get_db() as conn:
        try:
            cursor = conn.cursor()
            logger.info(f"[ADD_TO_WATCHLIST] Adding {stock_symbol} for user {user_id}")
            
            # First, insert or update the stock in stocks table
            cursor.execute('''
                INSERT INTO stocks (symbol, name, last_price, last_updated)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(symbol) DO UPDATE SET
                    name = COALESCE(?, stocks.name),
                    last_price = ?,
                    last_updated = ?
            ''', (stock_symbol, stock_name, last_price, last_updated, stock_name, last_price, last_updated))
            
            # Get the stock ID
            cursor.execute('SELECT id FROM stocks WHERE symbol = ?', (stock_symbol,))
            stock = cursor.fetchone()
            if not stock:
                logger.error(f"[ADD_TO_WATCHLIST] Failed to get stock ID for {stock_symbol}")
                return False
            
            stock_id = stock['id']
            
            # Add to watchlist
            cursor.execute('''
                INSERT INTO watchlist (user_id, stock_id)
                VALUES (?, ?)
                ON CONFLICT(user_id, stock_id) DO NOTHING
            ''', (user_id, stock_id))
            
            conn.commit()
            logger.info(f"[ADD_TO_WATCHLIST] Successfully added {stock_symbol}")
            return True
            
        except Exception as e:
            logger.error(f"[ADD_TO_WATCHLIST] Error: {str(e)}", exc_info=True)
            conn.rollback()
            return False

def clear_watchlist(user_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM watchlist WHERE user_id = ?', (user_id,))
        conn.commit()
        logger.info(f"Cleared watchlist for user {user_id}")

def remove_from_watchlist(user_id: int, stock_symbol: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            # First, get the stock_id
            cursor.execute('SELECT id FROM stocks WHERE symbol = ?', (stock_symbol,))
            stock = cursor.fetchone()
            
            if not stock:
                logger.error(f"Stock {stock_symbol} not found in stocks table")
                return False
                
            stock_id = stock['id']
            
            # Remove from watchlist
            cursor.execute('''
                DELETE FROM watchlist 
                WHERE user_id = ? AND stock_id = ?
            ''', (user_id, stock_id))
            
            conn.commit()
            rows_affected = cursor.rowcount
            logger.info(f"Removed stock {stock_symbol} from watchlist. Rows affected: {rows_affected}")
            return rows_affected > 0
        except Exception as e:
            logger.error(f"Error removing stock {stock_symbol} from watchlist: {str(e)}")
            return False

def get_user_watchlist(user_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get watchlist with stock details - removed is_active condition since we use the watchlist table to track active stocks
        cursor.execute('''
            SELECT s.symbol, s.name, s.last_price, s.last_updated
            FROM watchlist w
            JOIN stocks s ON w.stock_id = s.id
            WHERE w.user_id = ?
            ORDER BY w.added_at DESC
        ''', (user_id,))
        
        watchlist = cursor.fetchall()
        logger.info(f"[GET_WATCHLIST] Found {len(watchlist)} stocks for user {user_id}")
        
        result = []
        for item in watchlist:
            result.append({
                'symbol': item['symbol'],
                'name': item['name'] or item['symbol'],
                'last_price': item['last_price'] or 0.0,
                'last_updated': item['last_updated'] or datetime.utcnow().isoformat()
            })
        
        return result

# Add after get_user_watchlist function
def diagnose_watchlist(user_id: int):
    """Diagnostic function to check watchlist state"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        logger.info("=== WATCHLIST DIAGNOSTIC START ===")
        
        # Check stocks table
        cursor.execute('SELECT * FROM stocks')
        stocks = cursor.fetchall()
        logger.info("All stocks in database:")
        for stock in stocks:
            logger.info(f"Stock: {dict(stock)}")
            
        # Check watchlist entries
        cursor.execute('''
            SELECT w.*, s.symbol, s.name, s.is_active 
            FROM watchlist w
            LEFT JOIN stocks s ON w.stock_id = s.id
            WHERE w.user_id = ?
        ''', (user_id,))
        entries = cursor.fetchall()
        logger.info(f"Watchlist entries for user {user_id}:")
        for entry in entries:
            logger.info(f"Entry: {dict(entry)}")
            
        # Check for orphaned entries
        cursor.execute('''
            SELECT w.* 
            FROM watchlist w 
            LEFT JOIN stocks s ON w.stock_id = s.id 
            WHERE s.id IS NULL AND w.user_id = ?
        ''', (user_id,))
        orphans = cursor.fetchall()
        if orphans:
            logger.warning(f"Found orphaned watchlist entries: {[dict(o) for o in orphans]}")
            
        logger.info("=== WATCHLIST DIAGNOSTIC END ===")
        
        return {
            'stocks': [dict(s) for s in stocks],
            'watchlist': [dict(e) for e in entries],
            'orphans': [dict(o) for o in orphans] if orphans else []
        }

def log_database_contents():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Log stocks table
        cursor.execute('SELECT * FROM stocks')
        stocks = cursor.fetchall()
        logger.info("Stocks table contents:")
        for stock in stocks:
            logger.info(dict(stock))
        
        # Log watchlist table
        cursor.execute('SELECT * FROM watchlist')
        watchlist = cursor.fetchall()
        logger.info("Watchlist table contents:")
        for entry in watchlist:
            logger.info(dict(entry)) 

# Initialize the database when module is imported
init_db() 
