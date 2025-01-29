import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Trade {
  id: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  timestamp: string;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  scheduledFor?: string;
  priceTarget?: number;
}

interface Portfolio {
  cash: number;
  totalValue: number;
  positions: {
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    marketValue: number;
    profitLoss: number;
  }[];
}

export default function TradingBot() {
  const [portfolio, setPortfolio] = useState<Portfolio>({
    cash: 1000, // Initial portfolio value as per rules
    totalValue: 1000,
    positions: []
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio');
      const data = await response.json();
      setPortfolio(data);
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
    }
  };

  const fetchTrades = async () => {
    try {
      const response = await fetch('/api/trades');
      const data = await response.json();
      setTrades(data);
    } catch (error) {
      console.error('Failed to fetch trades:', error);
    }
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/bot/analyze', { method: 'POST' });
      const data = await response.json();
      setLastAnalysis(new Date().toLocaleString());
      await fetchTrades(); // Refresh trades after analysis
      await fetchPortfolio(); // Refresh portfolio after analysis
    } catch (error) {
      console.error('Failed to start analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    fetchTrades();
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI Trading Bot</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Portfolio Summary */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-secondary rounded-lg">
              <h3 className="text-sm font-medium">Cash Available</h3>
              <p className="text-2xl font-bold">${portfolio.cash.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-secondary rounded-lg">
              <h3 className="text-sm font-medium">Total Portfolio Value</h3>
              <p className="text-2xl font-bold">${portfolio.totalValue.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-secondary rounded-lg">
              <h3 className="text-sm font-medium">Last Analysis</h3>
              <p className="text-sm">{lastAnalysis || 'Never'}</p>
            </div>
          </div>

          {/* Control Panel */}
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={startAnalysis} 
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Start Market Analysis'}
            </Button>
          </div>

          {/* Positions Table */}
          <div>
            <h3 className="text-lg font-medium mb-2">Current Positions</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Avg Price</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Market Value</TableHead>
                  <TableHead>P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolio.positions.map((position) => (
                  <TableRow key={position.symbol}>
                    <TableCell>{position.symbol}</TableCell>
                    <TableCell>{position.quantity}</TableCell>
                    <TableCell>${position.averagePrice.toFixed(2)}</TableCell>
                    <TableCell>${position.currentPrice.toFixed(2)}</TableCell>
                    <TableCell>${position.marketValue.toFixed(2)}</TableCell>
                    <TableCell className={position.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}>
                      ${position.profitLoss.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Scheduled Trades */}
          <div>
            <h3 className="text-lg font-medium mb-2">Scheduled Trades</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price Target</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>{trade.symbol}</TableCell>
                    <TableCell>{trade.type}</TableCell>
                    <TableCell>{trade.quantity}</TableCell>
                    <TableCell>${trade.priceTarget?.toFixed(2) || trade.price.toFixed(2)}</TableCell>
                    <TableCell>{trade.scheduledFor || 'Immediate'}</TableCell>
                    <TableCell>{trade.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 