from fastapi import APIRouter
from .searxng_search import router as search_router
from .watchlist import router as watchlist_router

# Create a main router for all tools
router = APIRouter()

# Include the search router
router.include_router(search_router, prefix="/search", tags=["search"])

# Include the watchlist router
router.include_router(watchlist_router, prefix="/watchlist", tags=["watchlist"]) 