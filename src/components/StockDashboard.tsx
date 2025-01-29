"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CollapsibleCard } from "@/components/ui/collapsible-card"
import StockChart from './StockChart'
import TradingBot from './TradingBot'

interface StockData {
  symbol: string
  currentPrice: number
  change: number
  changePercent: number
  volume: number
  marketCap: number | string
  peRatio?: number
  dividendYield?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  analystRating?: {
    firm: string
    grade: string
    action: string
  }
  shortName?: string
  longName?: string
  sector?: string
  industry?: string
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
  date: string
  price: number
  volume: number
  high: number
  low: number
  open: number
  close: number
}

interface StockHistoryResponse {
  data: StockHistoryData[];
}

export default function StockDashboard() {
  const [searchSymbol, setSearchSymbol] = useState('')
  const [stocks, setStocks] = useState<StockData[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [stockHistory, setStockHistory] = useState<StockHistoryResponse>({ data: [] })
  const [stockData, setStockData] = useState<StockData | null>(null)

  const fetchNews = async (symbols: string[]) => {
    if (symbols.length === 0) {
      console.log('No symbols provided, fetching market news');
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/stock/market-news');
        console.log('Market News API response status:', response.status);
        
        const data = await response.json();
        console.log('Market News API response data:', data);
        
        if (response.ok && data.feed) {
          setNews(data.feed);
        } else {
          console.error('Market News API error:', data.error || 'Unknown error');
          setError(data.error || 'Failed to fetch news');
          setNews([]);
        }
      } catch (error) {
        console.error('Error fetching market news:', error);
        setError('Failed to fetch market news');
        setNews([]);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    try {
      console.log('Fetching news for symbols:', symbols);
      setIsLoading(true);
      setError(null);
      
      const symbol = symbols[0]; // For now, just get news for the first symbol
      console.log('Fetching news for symbol:', symbol);
      
      const response = await fetch(`/stock/news/${symbol}`);
      console.log('News API response status:', response.status);
      
      const data = await response.json();
      console.log('News API response data:', data);
      
      if (response.ok && data.feed) {
        setNews(data.feed);
      } else {
        console.error('News API error:', data.error || 'Unknown error');
        setError(data.error || 'Failed to fetch news');
        setNews([]);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setError('Failed to fetch news');
      setNews([]);
    } finally {
      setIsLoading(false);
    }
  }

  const fetchStockData = async (symbol: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/stock/${symbol}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stock data');
      }
      
      const data = await response.json();
      
      // Validate the data before setting it
      if (!data || typeof data.currentPrice !== 'number') {
        throw new Error('Invalid stock data received');
      }
      
      setStockData({
        symbol: data.symbol,
        currentPrice: data.currentPrice,
        change: data.change || 0,
        // ... other properties
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStockData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStockHistory = async (symbol: string) => {
    try {
      const response = await fetch(`/stock/history/${symbol}`)
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
        return
      }
      
      setStockHistory(data)
    } catch (error) {
      setError('Failed to fetch stock history')
    }
  }

  const handleStockSelect = async (symbol: string) => {
    setSelectedStock(symbol)
    await fetchStockHistory(symbol)
    await fetchNews([symbol]) // Fetch news for selected stock only
  }

  const handleAddStock = async () => {
    if (!searchSymbol) return
    
    // Check if stock is already in the list
    if (stocks.some(stock => stock.symbol === searchSymbol.toUpperCase())) {
      setError('Stock is already in your list')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const data = await fetchStockData(searchSymbol.toUpperCase())
      if (data) {
        setStocks(prev => [...prev, data])
        // Select the newly added stock
        await handleStockSelect(searchSymbol.toUpperCase())
        setSearchSymbol('')
      }
    } catch (error) {
      setError('Failed to add stock')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshAll = async () => {
    if (stocks.length === 0) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const updatedStocks = await Promise.all(
        stocks.map(stock => fetchStockData(stock.symbol))
      )
      
      setStocks(updatedStocks.filter((stock): stock is StockData => stock !== null))
      await fetchNews(stocks.map(s => s.symbol))
    } catch (error) {
      setError('Failed to refresh stocks')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveStock = (symbol: string) => {
    setStocks(prev => {
      const newStocks = prev.filter(stock => stock.symbol !== symbol)
      // If removing selected stock, select first available stock or clear selection
      if (symbol === selectedStock) {
        const nextStock = newStocks[0]
        if (nextStock) {
          handleStockSelect(nextStock.symbol)
        } else {
          setSelectedStock(null)
          setNews([])
        }
      }
      return newStocks
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddStock()
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Trading Bot Section */}
      <div className="mb-8">
        <TradingBot />
      </div>

      {/* Existing Stock Search Section */}
      <div className="flex gap-2">
        <Input
          placeholder="Enter stock symbol..."
          value={searchSymbol}
          onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <Button 
          onClick={handleAddStock} 
          disabled={isLoading}
        >
          {isLoading ? 'Adding...' : 'Add Stock'}
        </Button>
        <Button
          onClick={handleRefreshAll}
          disabled={isLoading || stocks.length === 0}
          variant="outline"
        >
          Refresh All
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Stock List and Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Watchlist */}
        <CollapsibleCard title="Watchlist">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocks.map((stock) => (
                <TableRow 
                  key={stock.symbol}
                  className={selectedStock === stock.symbol ? 'bg-secondary' : ''}
                >
                  <TableCell>
                    <button
                      onClick={() => handleStockSelect(stock.symbol)}
                      className="text-left font-medium hover:underline"
                    >
                      {stock.symbol}
                    </button>
                  </TableCell>
                  <TableCell>
                    ${stock?.currentPrice ? stock.currentPrice.toFixed(2) : 'N/A'}
                  </TableCell>
                  <TableCell 
                    className={stock?.change >= 0 ? 'text-green-500' : 'text-red-500'}
                  >
                    {stock?.change != null ? (
                      `${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%`
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => handleRemoveStock(stock.symbol)}
                      variant="ghost"
                      size="sm"
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleCard>

        {/* Stock Details */}
        {selectedStock && (
          <CollapsibleCard title={`${selectedStock} Details`}>
            <div className="space-y-4">
              {/* Stock Chart */}
              <div className="h-64">
                <StockChart symbol={selectedStock} data={stockHistory} />
              </div>

              {/* Stock Info */}
              {stocks.find(s => s.symbol === selectedStock) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Market Cap</Label>
                    <div>{stocks.find(s => s.symbol === selectedStock)?.marketCap}</div>
                  </div>
                  <div>
                    <Label>Volume</Label>
                    <div>{stocks.find(s => s.symbol === selectedStock)?.volume.toLocaleString()}</div>
                  </div>
                  <div>
                    <Label>P/E Ratio</Label>
                    <div>{stocks.find(s => s.symbol === selectedStock)?.peRatio?.toFixed(2) || 'N/A'}</div>
                  </div>
                  <div>
                    <Label>Dividend Yield</Label>
                    <div>{stocks.find(s => s.symbol === selectedStock)?.dividendYield?.toFixed(2)}%</div>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleCard>
        )}
      </div>

      {/* News Section */}
      <CollapsibleCard title="Market News">
        <div className="space-y-4">
          {news.map((item, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {item.title}
                </a>
              </h3>
              <p className="text-sm text-gray-600 mb-2">{item.summary}</p>
              <div className="text-xs text-gray-500">
                {new Date(item.time_published).toLocaleString()} - {item.source}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleCard>
    </div>
  )
} 