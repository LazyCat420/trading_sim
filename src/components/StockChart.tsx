"use client"

import React, { useEffect, useRef } from 'react'
import { Card, CardContent } from "@/components/ui/card"

let tvScriptLoadingPromise: Promise<void> | null = null;

interface StockChartProps {
  symbol: string;
}

const StockChart: React.FC<StockChartProps> = ({ symbol }) => {
  const onLoadScriptRef = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  );
};

export default StockChart; 