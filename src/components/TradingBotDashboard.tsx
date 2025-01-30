"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CollapsibleCard } from "@/components/ui/collapsible-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { BotTerminal } from './BotTerminal'

interface Position {
  quantity: number
  avg_price: number
  market_value: number
  unrealized_pl: number
  unrealized_pl_percent: number
}

interface Trade {
  id: number
  symbol: string
  type: string
  quantity: number
  price: number
  status: string
  timestamp: string
  executed_at?: string
}

interface PortfolioSummary {
  total_value: number
  cash_balance: number
  positions_value: number
  positions: Record<string, Position>
  performance: {
    total_return: number
    position_count: number
  }
}

interface Analysis {
  symbol: string
  analysis: {
    [key: string]: {
      strategy: string
      signals: Record<string, boolean>
      confidence: number
      recommendation: string
    }
  }
  overall_confidence: number
  position: Position
}

interface AutomatedStatus {
  is_running: boolean
  watched_symbols: string[]
  last_analysis: {
    [symbol: string]: {
      timestamp: string
      data: any
    }
  }
  portfolio: PortfolioSummary
}

const formatCurrency = (value: number | undefined | null): string => {
  if (typeof value !== 'number') return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

export default function TradingBotDashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null)
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([])
  const [activeOrders, setActiveOrders] = useState<Trade[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [quantity, setQuantity] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isAutomated, setIsAutomated] = useState(false)
  const [automatedStatus, setAutomatedStatus] = useState<AutomatedStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    console.log('Initial load - fetching data...')
    fetchPortfolioData()
    fetchTradeHistory()
    fetchActiveOrders()
    fetchAutomatedStatus()
    
    const interval = setInterval(() => {
      console.log('Interval update - fetching new data...')
      fetchPortfolioData()
      if (isAutomated) {
        fetchAutomatedStatus()
      }
    }, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [isAutomated])

  const fetchPortfolioData = async () => {
    try {
      const response = await fetch('/api/trading/portfolio')
      const data = await response.json()
      setPortfolio(data)
    } catch (error) {
      console.error('Error fetching portfolio:', error)
      setError('Failed to fetch portfolio data')
    }
  }

  const fetchTradeHistory = async () => {
    try {
      const response = await fetch('/api/trading/history')
      const data = await response.json()
      // Ensure we have an array of trades
      setTradeHistory(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching trade history:', error)
      setTradeHistory([])
    }
  }

  const fetchActiveOrders = async () => {
    try {
      const response = await fetch('/api/trading/active-orders')
      const data = await response.json()
      setActiveOrders(data)
    } catch (error) {
      console.error('Error fetching active orders:', error)
    }
  }

  const fetchAutomatedStatus = async () => {
    try {
      console.log('Fetching automated status...')
      setIsLoading(true)
      const response = await fetch('/api/trading/automate/status')
      const data = await response.json()
      console.log('Received automated status:', data)
      setAutomatedStatus(data)
      setIsAutomated(data?.is_running || false)
    } catch (error) {
      console.error('Error fetching automated status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const analyzeStock = async (symbol: string) => {
    try {
      const response = await fetch(`/api/trading/analyze/${symbol}`)
      const data = await response.json()
      setAnalysis(data)
      setSelectedSymbol(symbol)
    } catch (error) {
      console.error('Error analyzing stock:', error)
      setError('Failed to analyze stock')
    }
  }

  const placeTrade = async () => {
    if (!selectedSymbol || !quantity) {
      setError('Please fill in all fields')
      return
    }

    try {
      const response = await fetch('/api/trading/trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: selectedSymbol,
          order_type: orderType,
          quantity: parseFloat(quantity),
          price: analysis?.position?.market_value || 0,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      // Refresh data
      fetchPortfolioData()
      fetchTradeHistory()
      fetchActiveOrders()
      
      // Clear form
      setQuantity('')
      setError(null)
    } catch (error) {
      console.error('Error placing trade:', error)
      setError('Failed to place trade')
    }
  }

  const toggleAutomation = async () => {
    try {
      const endpoint = isAutomated ? 'stop' : 'start'
      const response = await fetch(`/api/trading/automate/${endpoint}`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Failed to toggle automation')
      }
      
      setIsAutomated(!isAutomated)
      await fetchAutomatedStatus()
    } catch (error) {
      console.error('Error toggling automation:', error)
      setError('Failed to toggle automated trading')
    }
  }

  return (
    <div className="space-y-4">
      {/* Automation Control */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Trading Bot Control</CardTitle>
            <Button
              onClick={toggleAutomation}
              variant={isAutomated ? "destructive" : "default"}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : isAutomated ? 'Stop Bot' : 'Start Bot'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading automation status...</div>
          ) : automatedStatus ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  isAutomated ? "bg-green-500" : "bg-red-500"
                )} />
                <span>Status: {isAutomated ? 'Running' : 'Stopped'}</span>
              </div>
              
              <div>
                <Label>Watched Symbols</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {automatedStatus.watched_symbols?.length > 0 ? (
                    automatedStatus.watched_symbols.map(symbol => (
                      <div
                        key={symbol}
                        className="px-2 py-1 bg-secondary rounded-md text-sm"
                      >
                        {symbol}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No symbols being watched</div>
                  )}
                </div>
              </div>
              
              <div>
                <Label>Last Analysis</Label>
                <div className="space-y-2 mt-2">
                  {automatedStatus.last_analysis && Object.entries(automatedStatus.last_analysis).length > 0 ? (
                    Object.entries(automatedStatus.last_analysis).map(([symbol, analysis]) => (
                      <div key={symbol} className="text-sm">
                        {symbol}: {new Date(analysis.timestamp).toLocaleString()}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No analysis data available</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>Failed to load automation status</div>
          )}
        </CardContent>
      </Card>

      {/* Bot Terminal */}
      <BotTerminal
        isAutomated={isAutomated}
        automatedStatus={automatedStatus}
      />

      {/* Portfolio Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolio ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Total Value</Label>
                <div className="text-2xl font-bold">
                  {formatCurrency(portfolio.total_value)}
                </div>
              </div>
              <div>
                <Label>Cash Balance</Label>
                <div className="text-2xl font-bold">
                  {formatCurrency(portfolio.cash_balance)}
                </div>
              </div>
              <div>
                <Label>Positions Value</Label>
                <div className="text-2xl font-bold">
                  {formatCurrency(portfolio.positions_value)}
                </div>
              </div>
              <div>
                <Label>Total Return</Label>
                <div className={cn(
                  "text-2xl font-bold",
                  (portfolio.performance?.total_return || 0) >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {(portfolio.performance?.total_return || 0).toFixed(2)}%
                </div>
              </div>
            </div>
          ) : (
            <div>Loading portfolio data...</div>
          )}
        </CardContent>
      </Card>

      {/* Trading Interface */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Analysis Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter stock symbol..."
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
                />
                <Button onClick={() => analyzeStock(selectedSymbol)}>
                  Analyze
                </Button>
              </div>

              {analysis && (
                <div className="space-y-4">
                  {Object.entries(analysis.analysis).map(([strategy, data]) => (
                    <CollapsibleCard
                      key={strategy}
                      title={
                        <div className="flex justify-between items-center">
                          <span className="capitalize">{strategy.replace('_', ' ')}</span>
                          <span className={cn(
                            "font-semibold",
                            data.confidence >= 0.7 ? "text-green-500" : "text-yellow-500"
                          )}>
                            {(data.confidence * 100).toFixed(1)}% Confidence
                          </span>
                        </div>
                      }
                    >
                      <div className="space-y-2 pt-2">
                        {Object.entries(data.signals).map(([signal, value]) => (
                          <div key={signal} className="flex justify-between">
                            <span className="capitalize">{signal.replace('_', ' ')}</span>
                            <span className={value ? "text-green-500" : "text-red-500"}>
                              {value ? '✓' : '✗'}
                            </span>
                          </div>
                        ))}
                        <div className="pt-2 border-t">
                          <span className="font-semibold">Recommendation: </span>
                          <span className={cn(
                            "capitalize",
                            data.recommendation === 'buy' ? "text-green-500" : "text-yellow-500"
                          )}>
                            {data.recommendation}
                          </span>
                        </div>
                      </div>
                    </CollapsibleCard>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trading Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Place Trade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Order Type</Label>
                <Select
                  value={orderType}
                  onValueChange={(value: 'buy' | 'sell') => setOrderType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0"
                  step="1"
                />
              </div>

              {error && (
                <div className="text-red-500">
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                onClick={placeTrade}
                disabled={!selectedSymbol || !quantity}
              >
                Place Order
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Avg Price</TableHead>
                <TableHead>Market Value</TableHead>
                <TableHead>Unrealized P/L</TableHead>
                <TableHead>P/L %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolio?.positions ? (
                Object.entries(portfolio.positions).map(([symbol, position]) => (
                  <TableRow key={symbol}>
                    <TableCell>{symbol}</TableCell>
                    <TableCell>{position.quantity}</TableCell>
                    <TableCell>${position.avg_price.toFixed(2)}</TableCell>
                    <TableCell>${position.market_value.toFixed(2)}</TableCell>
                    <TableCell className={cn(
                      position.unrealized_pl >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      ${position.unrealized_pl.toFixed(2)}
                    </TableCell>
                    <TableCell className={cn(
                      position.unrealized_pl_percent >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {position.unrealized_pl_percent.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No active positions
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Trade History */}
      <CollapsibleCard title="Trade History">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.isArray(tradeHistory) && tradeHistory.length > 0 ? (
              tradeHistory.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell>{new Date(trade.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{trade.symbol}</TableCell>
                  <TableCell className={cn(
                    trade.type === 'buy' ? "text-green-500" : "text-red-500"
                  )}>
                    {trade.type.toUpperCase()}
                  </TableCell>
                  <TableCell>{trade.quantity}</TableCell>
                  <TableCell>{formatCurrency(trade.price)}</TableCell>
                  <TableCell>{trade.status}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No trade history available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CollapsibleCard>
    </div>
  )
} 