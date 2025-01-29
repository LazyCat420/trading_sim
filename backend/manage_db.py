import database as db
import argparse

def main():
    parser = argparse.ArgumentParser(description='Database management tool')
    parser.add_argument('action', choices=['reset', 'show', 'clear_watchlist'],
                       help='Action to perform on the database')
    
    args = parser.parse_args()
    
    if args.action == 'reset':
        db.reset_database()
        print("Database has been reset")
    
    elif args.action == 'show':
        with db.get_db() as conn:
            cursor = conn.cursor()
            
            print("\nStocks table:")
            cursor.execute('SELECT * FROM stocks')
            stocks = cursor.fetchall()
            for stock in stocks:
                print(dict(stock))
            
            print("\nWatchlist table:")
            cursor.execute('SELECT * FROM watchlist')
            watchlist = cursor.fetchall()
            for item in watchlist:
                print(dict(item))
            
            print("\nUsers table:")
            cursor.execute('SELECT * FROM users')
            users = cursor.fetchall()
            for user in users:
                print(dict(user))
    
    elif args.action == 'clear_watchlist':
        with db.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM watchlist')
            cursor.execute('UPDATE stocks SET is_active = 0')
            conn.commit()
            print("Watchlist has been cleared")

if __name__ == '__main__':
    main() 