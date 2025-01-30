"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import MarketData from './MarketData'
import { StockHistoryData, DividendData, EarningsData } from './StockDashboard'

let tvScriptLoadingPromise: Promise<void> | null = null;

interface StockChartProps {
  symbol: string;
  data?: StockHistoryData[];
  dividendData?: DividendData[];
  earningsData?: EarningsData[];
}

const StockChart: React.FC<StockChartProps> = ({ symbol, data, dividendData, earningsData }) => {
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
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/stock/detailed/${symbol}`);
        console.log('Market data response status:', response.status);
        
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch market data: ${response.statusText}`);
        }
        
        try {
          const rawData = JSON.parse(responseText);
          console.log('Parsed market data:', rawData);
          
          // Helper function to parse percentage string
          const parsePercentage = (value: string | number): number => {
            if (typeof value === 'string') {
              return parseFloat(value.replace('%', '')) || 0;
            }
            return value || 0;
          };

          // Helper function to parse currency string
          const parseCurrency = (value: string | number): number => {
            if (typeof value === 'string') {
              return parseFloat(value.replace('$', '')) || 0;
            }
            return value || 0;
          };

          // Transform the data to match the MarketData interface
          const transformedData = {
            // Market Data
            marketCap: rawData.marketData.marketCap || '0',
            income: rawData.marketData.income || '0',
            revenue: rawData.marketData.revenue || '0',
            bookSh: rawData.marketData.bookSh || '0',
            cashSh: rawData.marketData.cashSh || '0',
            dividend: rawData.marketData.dividend || '0%',
            dividendYield: rawData.marketData.dividend || '0%',
            employees: parseInt(rawData.marketData.employees) || 0,

            // Trading Data
            price: rawData.valuation.pc || 0,
            volume: rawData.technical.relVolume?.toString() || '0',
            prevClose: rawData.valuation.pc || 0,
            change: rawData.technical.relVolume || 0,

            // Valuation
            pe: rawData.valuation.pe || 0,
            forwardPE: rawData.valuation.forwardPE || 0,
            peg: rawData.valuation.peg || 0,
            ps: rawData.valuation.ps || 0,
            pb: rawData.valuation.pb || 0,
            pc: rawData.valuation.pc || 0,
            pfcf: rawData.valuation.pfcf || 0,
            quickRatio: rawData.valuation.quickRatio || 0,
            currentRatio: rawData.valuation.currentRatio || 0,
            debtEq: rawData.valuation.debtEq || 0,

            // Growth & Performance
            eps: {
              ttm: parseCurrency(rawData.growth.eps.ttm),
              nextY: parsePercentage(rawData.growth.eps.nextY),
              nextQ: parsePercentage(rawData.growth.eps.nextQ),
              thisY: parsePercentage(rawData.growth.eps.thisY),
              next5Y: parsePercentage(rawData.growth.eps.next5Y),
              past5Y: parsePercentage(rawData.growth.eps.past5Y),
              qoq: 0 // This field seems to be missing in the response
            },
            salesGrowth: {
              past5Y: 0, // This field seems to be missing in the response
              qoq: parsePercentage(rawData.growth.salesQQ)
            },

            // Technical Indicators
            rsi: rawData.technical.rsi || 0,
            relVolume: rawData.technical.relVolume || 0,
            shortFloat: parsePercentage(rawData.technical.shortFloat),
            beta: rawData.technical.beta || 0,
            sma20: parsePercentage(rawData.technical.sma20),
            sma50: parsePercentage(rawData.technical.sma50),
            sma200: parsePercentage(rawData.technical.sma200),
            targetPrice: parseCurrency(rawData.technical.targetPrice)
          };

          console.log('Transformed market data:', transformedData);
          setMarketData(transformedData);
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
      {marketData && (
        <MarketData data={marketData} />
      )}
    </div>
  );
};

export default StockChart; 