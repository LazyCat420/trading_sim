from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
from typing import Optional, List
import uvicorn

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/stock/{symbol}")
async def get_stock_data(symbol: str):
    try:
        stock = yf.Ticker(symbol)
        info = stock.info
        
        if not info:
            raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
            
        history = stock.history(period="1d")
        recommendations = stock.recommendations
        
        # Get latest analyst rating if available
        latest_rating = None
        if recommendations is not None and not recommendations.empty:
            latest = recommendations.iloc[-1]
            latest_rating = {
                "firm": latest.get("Firm", "N/A"),
                "grade": latest.get("To Grade", "N/A"),
                "action": latest.get("Action", "N/A")
            }

        # Get current price from either source
        current_price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
        
        # Get price change
        change = info.get("regularMarketChange") or 0
        change_percent = info.get("regularMarketChangePercent") or 0
        
        return {
            "symbol": symbol,
            "currentPrice": current_price,
            "change": change,
            "changePercent": change_percent,
            "volume": info.get("regularMarketVolume") or 0,
            "marketCap": info.get("marketCap") or "N/A",
            "peRatio": info.get("forwardPE"),
            "dividendYield": info.get("dividendYield"),
            "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow"),
            "analystRating": latest_rating,
            "shortName": info.get("shortName"),
            "longName": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/news/{symbol}")
async def get_stock_news(symbol: str):
    try:
        stock = yf.Ticker(symbol)
        news = stock.news
        
        if not news:
            return {"feed": []}
            
        feed = [{
            "title": item.get("title"),
            "url": item.get("link"),
            "time_published": item.get("providerPublishTime"),
            "summary": item.get("summary", ""),
            "source": item.get("publisher")
        } for item in news]
        
        return {"feed": feed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000) 