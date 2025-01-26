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

export default function StockDashboard() {
  const [searchSymbol, setSearchSymbol] = useState('')
  const [stocks, setStocks] = useState<StockData[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [stockHistory, setStockHistory] = useState<StockHistoryData[]>([])

  const fetchNews = async (symbols: string[]) => {
    if (symbols.length === 0) return
    
    try {
      const response = await fetch(`/news/${symbols.join(',')}`)
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
        return
      }
      
      setNews(data.feed)
    } catch (error) {
      setError('Failed to fetch news')
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
    await fetchNews([symbol]) // Update news for selected stock only
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
      const data = await fetchStockPrice(searchSymbol.toUpperCase())
      if (data) {
        setStocks(prev => [...prev, data])
        // Fetch news for all stocks including the new one
        await fetchNews([...stocks.map(s => s.symbol), searchSymbol.toUpperCase()])
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

  const handleRemoveStock = (symbol: string) => {
    setStocks(prev => {
      const newStocks = prev.filter(stock => stock.symbol !== symbol)
      // Update news when removing a stock
      fetchNews(newStocks.map(s => s.symbol))
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
            <TableHead>Symbol</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>Volume</TableHead>
            <TableHead>Market Cap</TableHead>
            <TableHead>P/E Ratio</TableHead>
            <TableHead>52W High/Low</TableHead>
            <TableHead>Analyst Rating</TableHead>
            <TableHead>Actions</TableHead>
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
          {news.map((item, index) => (
            <div key={index} className="border-b pb-4">
              <h3 className="font-semibold">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500">
                  {item.title}
                </a>
              </h3>
              <p className="text-sm text-gray-600">
                {typeof item.time_published === 'number' 
                  ? new Date(item.time_published * 1000).toLocaleString()
                  : new Date(item.time_published).toLocaleString()} - {item.source}
              </p>
              <p className="mt-2">{item.summary}</p>
            </div>
          ))}
        </div>
      </CollapsibleCard>
    </div>
  )
} 