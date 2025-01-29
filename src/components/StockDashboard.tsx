"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CollapsibleCard } from "@/components/ui/collapsible-card"
import StockChart from './StockChart'

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

  // Load watchlist on component mount
  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await fetch('/api/stock')
        const data = await response.json()
        
        if (response.ok) {
          // Convert watchlist data to StockData format
          const stocksData = await Promise.all(
            data.map(async (item: any) => {
              const stockResponse = await fetch(`/api/stock?symbol=${item.symbol}`)
              const stockData = await stockResponse.json()
              return stockData
            })
          )
          setStocks(stocksData.filter((stock: StockData | null) => stock !== null))
        } else {
          setError(data.error || 'Failed to load watchlist')
        }
      } catch (error) {
        console.error('Error loading watchlist:', error)
        setError('Failed to load watchlist')
      } finally {
        setIsLoading(false)
      }
    }

    loadWatchlist()
  }, [])

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

  const fetchStockPrice = async (symbol: string): Promise<StockData | null> => {
    try {
      const response = await fetch(`/stock/${symbol}`)
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
        return null
      }
      
      return data
    } catch (error) {
      setError('Failed to fetch stock price')
      return null
    }
  }

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
      const stockData = await fetchStockPrice(searchSymbol.toUpperCase())
      if (stockData) {
        // Add to watchlist in database
        const response = await fetch('/api/stock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: searchSymbol.toUpperCase(),
            name: stockData.shortName || stockData.longName,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to add stock to watchlist')
        }

        setStocks(prev => [...prev, stockData])
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
        stocks.map(stock => fetchStockPrice(stock.symbol))
      )
      
      setStocks(updatedStocks.filter((stock): stock is StockData => stock !== null))
      await fetchNews(stocks.map(s => s.symbol))
    } catch (error) {
      setError('Failed to refresh stocks')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveStock = async (symbol: string) => {
    try {
      const response = await fetch(`/api/stock?symbol=${symbol}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove stock from watchlist')
      }

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
    } catch (error) {
      console.error('Error removing stock:', error)
      setError('Failed to remove stock from watchlist')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddStock()
    }
  }

  return (
    <div className="p-4 space-y-4">
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
          variant="outline"
          onClick={handleRefreshAll}
          disabled={isLoading || stocks.length === 0}
        >
          Refresh All
        </Button>
      </div>

      {error && (
        <div className="text-red-500 bg-red-50 p-2 rounded">{error}</div>
      )}

      {selectedStock && (
        <StockChart symbol={selectedStock} data={stockHistory} />
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead key="symbol">Symbol</TableHead>
            <TableHead key="name">Name</TableHead>
            <TableHead key="price">Price</TableHead>
            <TableHead key="change">Change</TableHead>
            <TableHead key="volume">Volume</TableHead>
            <TableHead key="marketCap">Market Cap</TableHead>
            <TableHead key="peRatio">P/E Ratio</TableHead>
            <TableHead key="52w">52W High/Low</TableHead>
            <TableHead key="rating">Analyst Rating</TableHead>
            <TableHead key="actions">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.map((stock) => (
            <TableRow 
              key={stock.symbol}
              className={`cursor-pointer hover:bg-gray-50 ${selectedStock === stock.symbol ? 'bg-blue-50' : ''}`}
              onClick={() => handleStockSelect(stock.symbol)}
            >
              <TableCell>{stock.symbol}</TableCell>
              <TableCell>{stock.shortName || stock.longName || 'N/A'}</TableCell>
              <TableCell>${(stock.currentPrice || 0).toFixed(2)}</TableCell>
              <TableCell className={stock.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                {(stock.change || 0).toFixed(2)} ({(stock.changePercent || 0).toFixed(2)}%)
              </TableCell>
              <TableCell>{(stock.volume || 0).toLocaleString()}</TableCell>
              <TableCell>
                {typeof stock.marketCap === 'number' ? 
                  `$${(stock.marketCap / 1e9).toFixed(2)}B` : 
                  'N/A'}
              </TableCell>
              <TableCell>{stock.peRatio?.toFixed(2) || 'N/A'}</TableCell>
              <TableCell>
                ${stock.fiftyTwoWeekHigh?.toFixed(2) || 'N/A'} / 
                ${stock.fiftyTwoWeekLow?.toFixed(2) || 'N/A'}
              </TableCell>
              <TableCell>
                {stock.analystRating ? 
                  `${stock.analystRating.firm}: ${stock.analystRating.grade}` : 
                  'N/A'}
              </TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveStock(stock.symbol)
                  }}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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