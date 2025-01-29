"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CollapsibleCard } from "@/components/ui/collapsible-card"
import StockChart from './StockChart'
import { LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts'
import { ResponsiveContainer } from 'recharts'
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  shortName?: string;
  longName?: string;
  peRatio?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  analystRating?: {
    firm: string;
    grade: string;
    action: string;
  };
}

interface NewsItem {
  title: string
  url: string
  time_published: string
  summary: string
  source: string
  symbol: string
  image_url?: string
}

interface StockHistoryData {
  date: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  sma50: number | null;
  sma200: number | null;
  rsi: number | null;
  macd: number | null;
  vwap: number | null;
}

interface StockHistoryResponse {
  data: StockHistoryData[];
}

interface RawDividendData {
  date: string;
  amount: number;
}

interface DividendData {
  date: string;
  dividend: number;
}

interface EarningsData {
  date: string;
  actualEPS: number;
  estimatedEPS: number;
  surprise: number;
}

interface StockDetailData extends StockData {
  dividendData?: DividendData[];
  earningsData?: EarningsData[];
}

const formatNumber = (num: number): string => {
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  }
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  }
  return num.toLocaleString();
};

const formatMarketCap = (marketCap: number): string => {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  }
  if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  }
  if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  }
  return `$${marketCap.toLocaleString()}`;
};

export default function StockDashboard() {
  const [searchSymbol, setSearchSymbol] = useState('')
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [stockPrices, setStockPrices] = useState<StockData[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [stockHistory, setStockHistory] = useState<StockHistoryData[]>([])
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [dividendData, setDividendData] = useState<DividendData[]>([])
  const [earningsData, setEarningsData] = useState<EarningsData[]>([])

  // Load watchlist on component mount
  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        console.log('Loading watchlist...');
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/stock/watchlist/1');
        console.log('Watchlist response status:', response.status);
        const data = await response.json();
        console.log('Watchlist response data:', data);
        
        if (response.ok) {
          // Convert watchlist data to StockData format
          console.log('Fetching individual stock data...');
          const stocksData = await Promise.all(
            data.map(async (item: any) => {
              console.log('Fetching data for stock:', item.symbol);
              const stockResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/stock/${item.symbol}`);
              const stockData = await stockResponse.json();
              console.log('Stock data for', item.symbol, ':', stockData);
              return stockData;
            })
          );
          const filteredStocks = stocksData.filter((stock: StockData | null) => stock !== null);
          console.log('Setting stocks:', filteredStocks);
          setStockPrices(filteredStocks);
          setWatchlist(filteredStocks.map(stock => stock.symbol));
        } else {
          console.error('Failed to load watchlist:', data.error);
          setError(data.error || 'Failed to load watchlist');
        }
      } catch (error) {
        console.error('Error in loadWatchlist:', error);
        setError('Failed to load watchlist');
      } finally {
        setIsLoading(false);
      }
    };

    loadWatchlist()
  }, [])

  const fetchNews = async (symbols: string[]) => {
    if (symbols.length === 0) {
      console.log('fetchNews - No symbols provided, fetching market news');
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/market-news');
        console.log('fetchNews - Market News API response status:', response.status);
        
        const data = await response.json();
        console.log('fetchNews - Market News API response data:', data);
        
        if (response.ok && data.feed) {
          setNews(data.feed);
        } else {
          console.error('fetchNews - Market News API error:', data.error || 'Unknown error');
          setError(data.error || 'Failed to fetch news');
          setNews([]);
        }
      } catch (error) {
        console.error('fetchNews - Error fetching market news:', error);
        setError('Failed to fetch market news');
        setNews([]);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    try {
      console.log('fetchNews - Fetching news for symbols:', symbols);
      setIsLoading(true);
      setError(null);
      
      const symbol = symbols[0]; // For now, just get news for the first symbol
      console.log('fetchNews - Fetching news for symbol:', symbol);
      
      const response = await fetch(`/api/news?symbol=${symbol}`);
      console.log('fetchNews - News API response status:', response.status);
      
      const data = await response.json();
      console.log('fetchNews - News API response data:', data);
      
      if (response.ok && data.feed) {
        setNews(data.feed);
      } else {
        console.error('fetchNews - News API error:', data.error || 'Unknown error');
        setError(data.error || 'Failed to fetch news');
        setNews([]);
      }
    } catch (error) {
      console.error('fetchNews - Error fetching news:', error);
      setError('Failed to fetch news');
      setNews([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStockPrice = async (symbol: string): Promise<StockData> => {
    try {
      console.log('fetchStockPrice - Starting fetch for symbol:', symbol);
      const response = await fetch(`/api/stock?symbol=${symbol}`);
      console.log('fetchStockPrice - Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.text();
        console.error('fetchStockPrice - Error response:', error);
        throw new Error('Failed to fetch stock price');
      }

      const data = await response.json();
      console.log('fetchStockPrice - Raw response data:', data);
      
      if (!data) {
        console.error('fetchStockPrice - No data received');
        throw new Error('No stock data received');
      }

      // Ensure price is a number
      const price = typeof data.price === 'number' ? data.price : parseFloat(data.price);
      if (isNaN(price)) {
        console.error('fetchStockPrice - Invalid price value:', data.price);
        throw new Error('Invalid price data received');
      }
      
      const stockData = {
        symbol: symbol.toUpperCase(),
        price: price,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume,
        marketCap: data.marketCap,
        shortName: data.shortName,
        longName: data.longName
      };
      
      console.log('fetchStockPrice - Processed stock data:', stockData);
      return stockData;
    } catch (error) {
      console.error('fetchStockPrice - Error:', error);
      throw error;
    }
  };

  const fetchStockHistory = async (symbol: string) => {
    try {
      console.log('Fetching history for symbol:', symbol);
      const response = await fetch(`/api/stock/history?symbol=${symbol}`);
      console.log('History response status:', response.status);
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Error fetching history:', error);
        throw new Error('Failed to fetch stock history');
      }

      const data = await response.json();
      console.log('History data:', data);
      return data;
    } catch (error) {
      console.error('Error in fetchStockHistory:', error);
      throw error;
    }
  };

  const fetchStockDetails = async (symbol: string) => {
    try {
      console.log('fetchStockDetails - Starting fetch for symbol:', symbol);
      
      console.log('fetchStockDetails - Fetching history data...');
      const historyResponse = await fetch(`/api/stock/history?symbol=${symbol}`);
      console.log('fetchStockDetails - History response status:', historyResponse.status);
      const historyData = await historyResponse.json();
      console.log('fetchStockDetails - Raw history data:', historyData);

      console.log('fetchStockDetails - Fetching dividend data...');
      const dividendResponse = await fetch(`/api/stock/dividends?symbol=${symbol}`);
      console.log('fetchStockDetails - Dividend response status:', dividendResponse.status);
      const dividendData = await dividendResponse.json();
      console.log('fetchStockDetails - Raw dividend data:', dividendData);

      console.log('fetchStockDetails - Fetching earnings data...');
      const earningsResponse = await fetch(`/api/stock/earnings?symbol=${symbol}`);
      console.log('fetchStockDetails - Earnings response status:', earningsResponse.status);
      const earningsData = await earningsResponse.json();
      console.log('fetchStockDetails - Raw earnings data:', earningsData);

      // Format history data for the chart
      const validHistoryData = historyData?.data?.map((item: any) => ({
        date: item.date,
        price: item.price,
        volume: item.volume,
        high: item.high,
        low: item.low,
        open: item.open,
        close: item.close,
        sma50: null,
        sma200: null,
        rsi: null,
        macd: null,
        vwap: null
      })) || [];
      console.log('fetchStockDetails - Processed history data:', validHistoryData);
      
      const validDividendData = dividendData?.dividends?.map((d: RawDividendData) => ({
        date: d.date,
        dividend: d.amount
      })) || [];
      console.log('fetchStockDetails - Processed dividend data:', validDividendData);
      
      const validEarningsData = earningsData?.earnings || [];
      console.log('fetchStockDetails - Processed earnings data:', validEarningsData);

      console.log('fetchStockDetails - Setting state with:', {
        historyLength: validHistoryData.length,
        dividendLength: validDividendData.length,
        earningsLength: validEarningsData.length
      });

      setStockHistory(validHistoryData);
      setDividendData(validDividendData);
      setEarningsData(validEarningsData);
    } catch (error) {
      console.error('fetchStockDetails - Error:', error);
      setError('Failed to fetch stock details');
      setStockHistory([]);
      setDividendData([]);
      setEarningsData([]);
    }
  };

  const handleStockSelect = async (symbol: string) => {
    console.log('handleStockSelect - Starting for symbol:', symbol);
    setError(null);
    setSelectedStock(symbol);
    
    try {
      console.log('handleStockSelect - Fetching price data...');
      const priceData = await fetchStockPrice(symbol);
      console.log('handleStockSelect - Price data received:', priceData);
      setStockData(priceData);

      console.log('handleStockSelect - Fetching stock details...');
      await fetchStockDetails(symbol);
      
      console.log('handleStockSelect - Fetching news...');
      await fetchNews([symbol]);
      
      console.log('handleStockSelect - All data fetched successfully');
    } catch (error) {
      console.error('handleStockSelect - Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      setStockData(null);
      setStockHistory([]);
      setDividendData([]);
      setEarningsData([]);
    }
  };

  const handleAddStock = async () => {
    if (!searchSymbol) return;
    
    console.log('handleAddStock - Starting add for symbol:', searchSymbol);
    
    // Check if stock is already in the list
    if (watchlist.some(stock => stock === searchSymbol.toUpperCase())) {
      console.log('handleAddStock - Stock already in watchlist:', searchSymbol);
      setError('Stock is already in your list');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('handleAddStock - Fetching stock data...');
      const stockData = await fetchStockPrice(searchSymbol.toUpperCase());
      console.log('handleAddStock - Received stock data:', stockData);
      
      if (stockData) {
        console.log('handleAddStock - Adding to watchlist...');
        // Add to watchlist using new endpoint
        const response = await fetch('/api/stock/watchlist/1/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: searchSymbol.toUpperCase()
          }),
        });
        
        console.log('handleAddStock - Watchlist add response status:', response.status);
        console.log('handleAddStock - Watchlist add response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('handleAddStock - Failed to add to watchlist:', errorText);
          throw new Error('Failed to add stock to watchlist');
        }

        const responseData = await response.json();
        console.log('handleAddStock - Watchlist add response data:', responseData);

        // Update state with new stock data
        console.log('handleAddStock - Current stockPrices:', stockPrices);
        setStockPrices(prev => {
          const newStockPrices = [...prev, stockData];
          console.log('handleAddStock - Updated stockPrices:', newStockPrices);
          return newStockPrices;
        });
        
        setWatchlist(prev => {
          const newWatchlist = [...prev, searchSymbol.toUpperCase()];
          console.log('handleAddStock - Updated watchlist:', newWatchlist);
          return newWatchlist;
        });

        await handleStockSelect(searchSymbol.toUpperCase());
        setSearchSymbol('');
        console.log('handleAddStock - Successfully added stock');
      }
    } catch (error) {
      console.error('handleAddStock - Error:', error);
      setError('Failed to add stock');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    if (watchlist.length === 0) return;
    
    setError(null);
    setIsLoading(true);
    
    try {
      await updateStockPrices();
    } catch (error) {
      console.error('Error refreshing stocks:', error);
      setError('Failed to refresh stocks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveStock = async (symbol: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('handleRemoveStock - Removing stock:', symbol);
      
      // Remove from watchlist using new endpoint
      const response = await fetch(`/api/stock/watchlist/1/remove/${symbol}`, {
        method: 'DELETE'
      });

      console.log('handleRemoveStock - Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('handleRemoveStock - Error response:', errorText);
        throw new Error('Failed to remove stock from watchlist');
      }

      console.log('handleRemoveStock - Successfully removed from watchlist');
      
      // Update local state
      setStockPrices(prev => {
        const newStockPrices = prev.filter(stock => stock.symbol !== symbol);
        console.log('handleRemoveStock - Updated stockPrices:', newStockPrices);
        return newStockPrices;
      });
      
      setWatchlist(prev => {
        const newWatchlist = prev.filter(s => s !== symbol);
        console.log('handleRemoveStock - Updated watchlist:', newWatchlist);
        return newWatchlist;
      });

      if (selectedStock === symbol) {
        setSelectedStock(null);
        setStockHistory([]);
      }
    } catch (error) {
      console.error('handleRemoveStock - Error:', error);
      setError('Failed to remove stock');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearWatchlist = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('handleClearWatchlist - Clearing watchlist');
      
      const response = await fetch('/api/stock/watchlist/1/clear', {
        method: 'DELETE'
      });

      console.log('handleClearWatchlist - Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('handleClearWatchlist - Error response:', errorText);
        throw new Error('Failed to clear watchlist');
      }

      console.log('handleClearWatchlist - Successfully cleared watchlist');
      
      // Clear local state
      setStockPrices([]);
      setWatchlist([]);
      setSelectedStock(null);
      setStockHistory([]);
    } catch (error) {
      console.error('handleClearWatchlist - Error:', error);
      setError('Failed to clear watchlist');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddStock()
    }
  }

  useEffect(() => {
    const fetchInitialData = async () => {
      if (watchlist.length > 0) {
        await updateStockPrices();
      }
    };

    fetchInitialData();

    // Set up periodic updates
    const intervalId = setInterval(updateStockPrices, 60000); // Update every minute
    return () => clearInterval(intervalId);
  }, [watchlist]);

  useEffect(() => {
    if (selectedStock) {
      handleStockSelect(selectedStock);
    }
  }, [selectedStock]);

  const updateStockPrices = async () => {
    setError(null);
    console.log('updateStockPrices - Starting update for watchlist:', watchlist);
    
    try {
      const updatedStocks = await Promise.all(
        watchlist.map(async (symbol) => {
          try {
            console.log(`updateStockPrices - Fetching data for ${symbol}`);
            const data = await fetchStockPrice(symbol);
            console.log(`updateStockPrices - Received data for ${symbol}:`, data);
            return data;
          } catch (error) {
            console.error(`updateStockPrices - Error updating ${symbol}:`, error);
            return null;
          }
        })
      );
      
      console.log('updateStockPrices - All updated stocks:', updatedStocks);
      
      // Filter out failed updates and update the state
      const validStocks = updatedStocks.filter((stock): stock is StockData => {
        if (!stock) {
          console.log('updateStockPrices - Filtering out null stock');
          return false;
        }
        if (typeof stock.price !== 'number') {
          console.log('updateStockPrices - Filtering out stock with invalid price:', stock);
          return false;
        }
        return true;
      });
      
      console.log('updateStockPrices - Valid stocks after filtering:', validStocks);
      setStockPrices(validStocks);
    } catch (error) {
      console.error('Error in updateStockPrices:', error);
      setError(error instanceof Error ? error.message : 'Failed to update stock prices');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Enter stock symbol..."
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddStock();
              }
            }}
          />
        </div>
        <Button onClick={handleAddStock} disabled={isLoading}>
          Add Stock
        </Button>
        <Button onClick={handleRefreshAll} disabled={isLoading} variant="outline">
          Refresh All
        </Button>
      </div>

      {error && (
        <div className="text-red-500 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {stockPrices.map((stock) => {
          console.log('Rendering stock card:', stock);
          return (
            <CollapsibleCard
              key={stock.symbol}
              defaultExpanded={selectedStock === stock.symbol}
              title={
                <div className="flex justify-between items-center w-full">
                  <div>
                    <span className="font-bold">{stock.symbol}</span>
                    {stock.shortName && (
                      <span className="text-gray-500 ml-2">({stock.shortName})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold">
                      ${typeof stock.price === 'number' ? stock.price.toFixed(2) : 'N/A'}
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        stock.changePercent > 0 ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {stock.changePercent > 0 ? "+" : ""}
                      {typeof stock.changePercent === 'number' ? stock.changePercent.toFixed(2) : '0.00'}%
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStock(stock.symbol);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              }
              onExpand={() => {
                if (selectedStock !== stock.symbol) {
                  handleStockSelect(stock.symbol);
                }
              }}
            >
              {selectedStock === stock.symbol && stockHistory.length > 0 && (
                <StockChart
                  symbol={stock.symbol}
                  data={stockHistory}
                  dividendData={dividendData}
                  earningsData={earningsData}
                />
              )}
            </CollapsibleCard>
          );
        })}
      </div>

      <CollapsibleCard title="Market News">
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-gray-500">Loading news...</p>
          ) : news && news.length > 0 ? (
            news.map((item, index) => (
              <div key={index} className="border-b pb-4 flex gap-4">
                {item.image_url && (
                  <div className="flex-shrink-0">
                    <img 
                      src={item.image_url} 
                      alt={item.title} 
                      className="w-32 h-24 object-cover rounded"
                    />
                  </div>
                )}
                <div className="flex-grow">
                  <h3 className="font-semibold">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500">
                      {item.title}
                    </a>
                  </h3>
                  <p className="text-sm text-gray-600">
                    {item.symbol && <span className="font-medium">{item.symbol} - </span>}
                    {new Date(item.time_published).toLocaleString()} - {item.source}
                  </p>
                  <p className="mt-2">{item.summary}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No market news available</p>
          )}
        </div>
      </CollapsibleCard>
    </div>
  )
} 