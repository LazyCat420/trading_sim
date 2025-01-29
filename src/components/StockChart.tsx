"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import MarketData from './MarketData'

let tvScriptLoadingPromise: Promise<void> | null = null;

interface StockChartProps {
  symbol: string;
}

const StockChart: React.FC<StockChartProps> = ({ symbol }) => {
  const onLoadScriptRef = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    onLoadScriptRef.current = createWidget;

    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = 'tradingview-widget-loading-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.type = 'text/javascript';
        script.onload = resolve as () => void;
        document.head.appendChild(script);
      });
    }

    tvScriptLoadingPromise.then(() => onLoadScriptRef.current && onLoadScriptRef.current());

    return () => {
      onLoadScriptRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol]);

  useEffect(() => {
    const fetchMarketData = async () => {
      console.log('Fetching market data for symbol:', symbol);
      try {
        const response = await fetch(`/api/stock/info/${symbol}`);
        console.log('Market data response status:', response.status);
        
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch market data: ${response.statusText}`);
        }
        
        try {
          const data = JSON.parse(responseText);
          console.log('Parsed market data:', data);
          setMarketData(data);
          setError(null);
        } catch (parseError) {
          console.error('Failed to parse market data:', parseError);
          setError('Invalid data format received');
        }
      } catch (error) {
        console.error('Error fetching market data:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch market data');
      }
    };

    if (symbol) {
      console.log('Starting market data fetch for symbol:', symbol);
      fetchMarketData();
    }
  }, [symbol]);

  function createWidget() {
    if (!containerRef.current || !document.getElementById('tradingview-widget-loading-script')) return;

    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.innerHTML = `
      new TradingView.widget({
        "width": "100%",
        "height": 600,
        "symbol": "${symbol}",
        "interval": "D",
        "timezone": "exchange",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "studies": [
          "MASimple@tv-basicstudies",
          "RSI@tv-basicstudies",
          "MACD@tv-basicstudies",
          "VWAP@tv-basicstudies"
        ],
        "container_id": "tradingview_chart"
      });
    `;

    containerRef.current.appendChild(script);
  }

  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardContent className="p-0">
          <div 
            id="tradingview_chart" 
            ref={containerRef} 
            className="w-full"
            style={{ minHeight: '600px' }}
          />
        </CardContent>
      </Card>
      {error && (
        <div className="text-red-500 p-4 bg-red-100 rounded">
          Error loading market data: {error}
        </div>
      )}
      {marketData ? (
        <MarketData data={marketData} />
      ) : !error && (
        <div className="text-center p-4">
          Loading market data...
        </div>
      )}
    </div>
  );
};

export default StockChart; 