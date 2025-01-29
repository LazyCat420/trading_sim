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

# Initialize database
def init_db():
    logger.info("Initializing database...")
    conn = create_connection()
    c = conn.cursor()
    
    # Create stocks table
    c.execute('''
        CREATE TABLE IF NOT EXISTS stocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT UNIQUE NOT NULL,
            name TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_price REAL,
            last_updated TIMESTAMP,
            is_active INTEGER DEFAULT 1
        )
    ''')
    
    # Create users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create watchlist table
    c.execute('''
        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_id INTEGER NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (stock_id) REFERENCES stocks (id),
            UNIQUE(user_id, stock_id)
        )
    ''')
    
    # Create default user if it doesn't exist
    c.execute('SELECT id FROM users WHERE id = 1')
    if not c.fetchone():
        logger.info("Creating default user...")
        c.execute('''
            INSERT INTO users (id, email, password_hash)
            VALUES (1, 'default@example.com', 'default')
        ''')
    
    conn.commit()
    logger.info("Database initialized successfully")
    conn.close()

# Context manager for database connections
@contextmanager
def get_db():
    conn = create_connection()
    try:
        yield conn
    finally:
        conn.close()

# Initialize the database when module is imported
init_db()

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
def add_to_watchlist(user_id: int, stock_symbol: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            print(f"Adding stock {stock_symbol} to watchlist for user {user_id}")
            # Get stock_id (create if doesn't exist)
            cursor.execute('SELECT id, is_active FROM stocks WHERE symbol = ?', (stock_symbol,))
            stock = cursor.fetchone()
            if not stock:
                print(f"Stock {stock_symbol} not found, creating new entry")
                cursor.execute(
                    'INSERT INTO stocks (symbol, is_active) VALUES (?, 1)',
                    (stock_symbol,)
                )
                stock_id = cursor.lastrowid
            else:
                stock_id = stock['id']
                # Reactivate the stock if it was inactive
                if not stock['is_active']:
                    print(f"Reactivating stock {stock_symbol}")
                    cursor.execute(
                        'UPDATE stocks SET is_active = 1 WHERE id = ?',
                        (stock_id,)
                    )
            
            # Check if stock is already in watchlist
            cursor.execute(
                'SELECT 1 FROM watchlist WHERE user_id = ? AND stock_id = ?',
                (user_id, stock_id)
            )
            if cursor.fetchone():
                print(f"Stock {stock_symbol} already in watchlist for user {user_id}")
                return False
            
            # Add to watchlist
            print(f"Adding stock {stock_symbol} (id: {stock_id}) to watchlist")
            cursor.execute(
                'INSERT INTO watchlist (user_id, stock_id) VALUES (?, ?)',
                (user_id, stock_id)
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError as e:
            print(f"IntegrityError adding stock {stock_symbol}: {str(e)}")
            return False
        except Exception as e:
            print(f"Error adding stock {stock_symbol}: {str(e)}")
            raise

def remove_from_watchlist(user_id: int, stock_symbol: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        print(f"Removing stock {stock_symbol} from watchlist for user {user_id}")
        cursor.execute('''
            DELETE FROM watchlist 
            WHERE user_id = ? AND stock_id IN (
                SELECT id FROM stocks WHERE symbol = ?
            )
        ''', (user_id, stock_symbol))
        conn.commit()
        rows_affected = cursor.rowcount
        print(f"Removed {rows_affected} watchlist entries")
        return rows_affected > 0

def get_user_watchlist(user_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # First, let's log all stocks in the database
        cursor.execute('SELECT * FROM stocks')
        all_stocks = cursor.fetchall()
        print("All stocks in database:", [dict(s) for s in all_stocks])
        
        # Now, let's log all watchlist entries
        cursor.execute('SELECT * FROM watchlist WHERE user_id = ?', (user_id,))
        all_watchlist = cursor.fetchall()
        print("All watchlist entries for user:", [dict(w) for w in all_watchlist])
        
        # Get the watchlist with stock details
        cursor.execute('''
            SELECT DISTINCT s.symbol, s.name, s.last_price, s.last_updated
            FROM watchlist w
            JOIN stocks s ON w.stock_id = s.id
            WHERE w.user_id = ?
            ORDER BY w.added_at DESC
        ''', (user_id,))
        
        watchlist = cursor.fetchall()
        print("Final watchlist result:", [dict(w) for w in watchlist])
        return watchlist 
