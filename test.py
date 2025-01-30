import yfinance as yf
import json
from pprint import pprint

def test_stock_data(symbol):
    print(f"\n=== Testing data fetch for {symbol} ===")
    
    try:
        # 1. Basic Quote Data
        print("\n1. Fetching basic quote data...")
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        # Debug PE related fields
        print("\nP/E Related Fields in info:")
        pe_fields = {k: v for k, v in info.items() if 'pe' in k.lower() or 'price' in k.lower()}
        pprint(pe_fields)
        
        print("\nBasic quote data received:")
        pprint({
            'symbol': info.get('symbol'),
            'currentPrice': info.get('currentPrice'),
            'marketCap': info.get('marketCap'),
            'volume': info.get('volume'),
            'trailingPE': info.get('trailingPE'),
            'forwardPE': info.get('forwardPE'),
        })

        # 2. Financial Data with column validation
        print("\n2. Fetching financial statements...")
        income_stmt = ticker.income_stmt
        balance_sheet = ticker.balance_sheet
        cash_flow = ticker.cash_flow
        
        # Print available columns for debugging
        print("\nIncome Statement Columns:")
        print(income_stmt.columns.tolist() if not income_stmt.empty else "No income statement data")
        
        # Use alternative column names
        revenue_col = 'Total Revenue' if 'Total Revenue' in income_stmt.columns else 'Revenue'
        net_income_col = 'Net Income' if 'Net Income' in income_stmt.columns else 'Net Income Common Stockholders'
        
        print("\nFinancial Highlights:")
        if not income_stmt.empty:
            print(f"Revenue (TTM): {income_stmt.iloc[0].get(revenue_col, 'N/A')}")
            print(f"Net Income (TTM): {income_stmt.iloc[0].get(net_income_col, 'N/A')}")

        # 3. Historical Data with validation
        print("\n3. Fetching historical data...")
        hist = ticker.history(period="1mo", interval="1d")
        print(f"Historical data points: {len(hist)}")
        if not hist.empty:
            print("\nLast 5 days of data:")
            print(hist[['Open', 'High', 'Low', 'Close', 'Volume']].tail())

        # 4. Additional Metrics with fallbacks
        print("\n4. Key Ratios:")
        ratios = {
            'PE Ratio': info.get('trailingPE') or info.get('forwardPE'),
            'PEG Ratio': info.get('pegRatio'),
            'Price to Book': info.get('priceToBook'),
            'Dividend Yield': info.get('dividendYield') or info.get('trailingAnnualDividendYield'),
            '52 Week High': info.get('fiftyTwoWeekHigh') or info.get('regularMarketDayHigh'),
            '52 Week Low': info.get('fiftyTwoWeekLow') or info.get('regularMarketDayLow')
        }
        pprint(ratios)

        return True

    except Exception as e:
        print(f"\nError fetching data: {str(e)}")
        return False

def main():
    # Test with a few different symbols
    symbols = ['AAPL', 'MSFT', 'T']
    
    results = {}
    for symbol in symbols:
        results[symbol] = test_stock_data(symbol)
    
    print("\n=== Summary ===")
    for symbol, success in results.items():
        print(f"{symbol}: {'Success' if success else 'Failed'}")

if __name__ == "__main__":
    main() 