import sqlite3
from datetime import datetime
from contextlib import contextmanager

# Create database connection
def create_connection():
    conn = sqlite3.connect('stocks.db')
    conn.row_factory = sqlite3.Row  # This allows accessing columns by name
    return conn

# Initialize database
def init_db():
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
    
    conn.commit()
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
            # Get stock_id (create if doesn't exist)
            cursor.execute('SELECT id FROM stocks WHERE symbol = ?', (stock_symbol,))
            stock = cursor.fetchone()
            if not stock:
                cursor.execute(
                    'INSERT INTO stocks (symbol) VALUES (?)',
                    (stock_symbol,)
                )
                stock_id = cursor.lastrowid
            else:
                stock_id = stock['id']
            
            # Add to watchlist
            cursor.execute(
                'INSERT INTO watchlist (user_id, stock_id) VALUES (?, ?)',
                (user_id, stock_id)
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

def remove_from_watchlist(user_id: int, stock_symbol: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            DELETE FROM watchlist 
            WHERE user_id = ? AND stock_id IN (
                SELECT id FROM stocks WHERE symbol = ?
            )
        ''', (user_id, stock_symbol))
        conn.commit()
        return cursor.rowcount > 0

def get_user_watchlist(user_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT s.symbol, s.name, s.last_price, s.last_updated
            FROM watchlist w
            JOIN stocks s ON w.stock_id = s.id
            WHERE w.user_id = ?
            ORDER BY w.added_at DESC
        ''', (user_id,))
        return cursor.fetchall() 
