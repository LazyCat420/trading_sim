"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Stock {
  id: number
  symbol: string
  buyPrice: number
  quantity: number
  currentPrice: number
  lastUpdated: string
}

interface NewsItem {
  title: string
  url: string
  time_published: string
  summary: string
  source: string
}

export default function StockDashboard() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [newStock, setNewStock] = useState({ symbol: '', buyPrice: '', quantity: '' })
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchStockPrice = async (symbol: string) => {
    try {
      const response = await fetch(`/api/stock?symbol=${symbol}`)
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      return Number(data["Global Quote"]["05. price"])
    } catch (error) {
      console.error('Error fetching stock price:', error)
      throw error
    }
  }

  const fetchNews = async (symbol?: string) => {
    try {
      const response = await fetch(`/api/news${symbol ? `?symbol=${symbol}` : ''}`)
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setNewsItems(data.feed || [])
    } catch (error) {
      console.error('Error fetching news:', error)
      setError('Failed to fetch news')
    }
  }

  useEffect(() => {
    fetchNews()
    const newsInterval = setInterval(() => {
      fetchNews()
    }, 300000) // Refresh news every 5 minutes

    return () => clearInterval(newsInterval)
  }, [])

  useEffect(() => {
    if (stocks.length === 0) return

    const updateStockPrices = async () => {
      try {
        const updatedStocks = await Promise.all(
          stocks.map(async (stock) => {
            try {
              const currentPrice = await fetchStockPrice(stock.symbol)
              return {
                ...stock,
                currentPrice,
                lastUpdated: new Date().toLocaleTimeString()
              }
            } catch (error) {
              return stock
            }
          })
        )
        setStocks(updatedStocks)
      } catch (error) {
        console.error('Error updating stock prices:', error)
      }
    }

    updateStockPrices()
    const priceInterval = setInterval(updateStockPrices, 60000) // Update prices every minute

    return () => clearInterval(priceInterval)
  }, [stocks])

  const handleAddStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (newStock.symbol && newStock.buyPrice && newStock.quantity) {
      setLoading(true)
      setError('')
      
      try {
        const currentPrice = await fetchStockPrice(newStock.symbol)
        
        setStocks([...stocks, {
          id: Date.now(),
          symbol: newStock.symbol.toUpperCase(),
          buyPrice: Number(newStock.buyPrice),
          quantity: Number(newStock.quantity),
          currentPrice,
          lastUpdated: new Date().toLocaleTimeString()
        }])
        
        setNewStock({ symbol: '', buyPrice: '', quantity: '' })
        fetchNews(newStock.symbol) // Fetch news for the newly added stock
      } catch (error) {
        setError('Failed to add stock. Please check the symbol and try again.')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (e.target.value) {
      fetchNews(e.target.value)
    } else {
      fetchNews()
    }
  }

  const calculateProfit = (stock: Stock) => {
    const profit = (stock.currentPrice - stock.buyPrice) * stock.quantity
    return profit.toFixed(2)
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stock Market Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Label htmlFor="search">Search News</Label>
            <Input
              id="search"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search for stock news..."
              className="mb-4"
            />
          </div>

          <form onSubmit={handleAddStock} className="mb-6 grid grid-cols-4 gap-4">
            <div>
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={newStock.symbol}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStock({...newStock, symbol: e.target.value})}
                placeholder="e.g., AAPL"
              />
            </div>
            <div>
              <Label htmlFor="buyPrice">Buy Price</Label>
              <Input
                id="buyPrice"
                type="number"
                value={newStock.buyPrice}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStock({...newStock, buyPrice: e.target.value})}
                placeholder="e.g., 150.00"
                step="0.01"
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={newStock.quantity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStock({...newStock, quantity: e.target.value})}
                placeholder="e.g., 10"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Adding...' : 'Add Stock'}
              </Button>
            </div>
          </form>

          {error && <p className="text-red-500 mb-4">{error}</p>}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Buy Price</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Profit/Loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocks.map((stock) => (
                <TableRow key={stock.id}>
                  <TableCell>{stock.symbol}</TableCell>
                  <TableCell>${stock.buyPrice.toFixed(2)}</TableCell>
                  <TableCell>{stock.quantity}</TableCell>
                  <TableCell>${stock.currentPrice.toFixed(2)}</TableCell>
                  <TableCell>{stock.lastUpdated}</TableCell>
                  <TableCell className={Number(calculateProfit(stock)) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ${calculateProfit(stock)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Market News</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {newsItems.map((news, index) => (
              <div key={index} className="border-b pb-4 last:border-b-0">
                <h3 className="font-semibold mb-2">
                  <a href={news.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                    {news.title}
                  </a>
                </h3>
                <p className="text-sm text-muted-foreground mb-2">{news.summary}</p>
                <div className="text-xs text-muted-foreground">
                  <span>{news.source}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(news.time_published).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 