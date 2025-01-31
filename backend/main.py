from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import stock_api
from trading.api import router as trading_router
import tools
import logging
from database import init_db

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(stock_api.router, prefix="/stock", tags=["stock"])
app.include_router(trading_router, prefix="/trading", tags=["trading"])

# Include the chat/search routes
app.include_router(tools.app, prefix="/chat")

# Initialize the database
init_db()

@app.get("/")
async def root():
    return {"message": "Trading Sim API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 