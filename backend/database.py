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
