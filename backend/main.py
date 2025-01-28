from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import stock_api
import tools
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS with more specific configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the stock API routes
app.include_router(stock_api.app, prefix="/stock")

# Include the chat/search routes
app.include_router(tools.app, prefix="/chat")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 