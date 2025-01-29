"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format } from "d3-format"
import { timeFormat } from "d3-time-format"
import {
  ChartCanvas,
  Chart,
  XAxis,
  YAxis,
  CandlestickSeries,
  LineSeries,
  BarSeries,
  discontinuousTimeScaleProviderBuilder,
  OHLCTooltip,
  lastVisibleItemBasedZoomAnchor,
  CrossHairCursor,
  EdgeIndicator,
  MouseCoordinateX,
  MouseCoordinateY,
  MovingAverageTooltip,
  RSISeries,
  RSITooltip,
  MACDSeries,
  MACDTooltip,
  VolumeProfileSeries,
  withDeviceRatio,
  withSize,
} from "react-financial-charts"
import { CollapsibleCard } from './ui/collapsible-card'
import { createChart, ColorType, IChartApi, ISeriesApi, LineStyle, Time } from 'lightweight-charts'
import { format as dateFormat } from "date-fns"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

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

interface DividendData {
  date: string
  dividend: number
}

interface EarningsData {
  date: string
  actualEPS: number
  estimatedEPS: number
}

interface SimilarStock {
  symbol: string
  name: string
  price: number
  marketCap: number
}

interface NewsItem {
  title: string
  url: string
  time_published: string
  summary: string
  source: string
}

interface Series {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
  dataKey: string;
  yAxisId?: string;
}

interface ChartProps {
  symbol: string;
  data: StockHistoryData[];
  dividendData?: DividendData[];
  earningsData?: EarningsData[];
}

interface ChartContext {
  dataset: {
    label?: string;
    yAxisID?: string;
  };
  parsed: {
    y: number;
  };
}

const StockChart = ({ symbol, data, dividendData = [], earningsData = [] }: ChartProps) => {
  const [timeframe, setTimeframe] = useState<string>("1d")
  const [stockData, setStockData] = useState<StockHistoryData[]>(() => {
    try {
      if (!Array.isArray(data)) {
        console.warn('Invalid data format received:', data);
        return [];
      }
      return data;
    } catch (error) {
      console.error('Error initializing stock data:', error);
      return [];
    }
  })
  const [dividendHistory, setDividendHistory] = useState<DividendData[]>([])
  const [similarStocks, setSimilarStocks] = useState<SimilarStock[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedDateNews, setSelectedDateNews] = useState<NewsItem[]>([])
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false)
  const [isLoadingNews, setIsLoadingNews] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<{ [key: string]: ISeriesApi<'Candlestick'> | ISeriesApi<'Histogram'> | ISeriesApi<'Line'> }>({})

  // Define available chart series
  const [availableSeries, setAvailableSeries] = useState<Series[]>([
    { id: 'price', label: 'Price', color: '#2962FF', enabled: true, dataKey: 'close', yAxisId: 'price' },
    { id: 'volume', label: 'Volume', color: '#E91E63', enabled: true, dataKey: 'volume', yAxisId: 'volume' },
    { id: 'sma50', label: '50 MA', color: '#00E676', enabled: false, dataKey: 'sma50', yAxisId: 'price' },
    { id: 'sma200', label: '200 MA', color: '#FF9800', enabled: false, dataKey: 'sma200', yAxisId: 'price' },
    { id: 'rsi', label: 'RSI', color: '#7C4DFF', enabled: false, dataKey: 'rsi', yAxisId: 'indicators' },
    { id: 'macd', label: 'MACD', color: '#FF4081', enabled: false, dataKey: 'macd', yAxisId: 'indicators' },
    { id: 'vwap', label: 'VWAP', color: '#18FFFF', enabled: false, dataKey: 'vwap', yAxisId: 'price' },
  ]);

  // Add timeframe options
  const timeframeOptions = [
    { value: "1d", label: "1 Day" },
    { value: "5d", label: "5 Days" },
    { value: "1mo", label: "1 Month" },
    { value: "3mo", label: "3 Months" },
    { value: "6mo", label: "6 Months" },
    { value: "1y", label: "1 Year" },
    { value: "5y", label: "5 Years" }
  ]

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 500
        });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f3fa' },
        horzLines: { color: '#f0f3fa' },
      },
      rightPriceScale: {
        borderColor: '#f0f3fa',
      },
      timeScale: {
        borderColor: '#f0f3fa',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#758696',
          style: LineStyle.Solid,
        },
        horzLine: {
          width: 1,
          color: '#758696',
          style: LineStyle.Solid,
        },
      },
    });

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Create volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#E91E63',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Store references
    chartRef.current = chart;
    seriesRef.current = {
      candlestick: candlestickSeries,
      volume: volumeSeries,
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!Array.isArray(data)) {
      console.warn('Invalid data format received:', data);
      return;
    }
    setStockData(data);
  }, [data]);

  const toggleSeries = (seriesId: string) => {
    setAvailableSeries(prev => prev.map(series => {
      if (series.id === seriesId) {
        // Remove or add the series from the chart
        if (series.enabled && seriesRef.current[seriesId]) {
          chartRef.current?.removeSeries(seriesRef.current[seriesId]);
          delete seriesRef.current[seriesId];
        }
        return { ...series, enabled: !series.enabled };
      }
      return series;
    }));
  };

  // Calculate technical indicators
  useEffect(() => {
    if (stockData.length === 0) return;

    const calculateIndicators = () => {
      // Calculate EMA helper function
      const calculateEMA = (data: number[], period: number) => {
        const k = 2 / (period + 1);
        let ema = [data[0]];
        
        for (let i = 1; i < data.length; i++) {
          ema.push(data[i] * k + ema[i - 1] * (1 - k));
        }
        
        return ema;
      };

      // Calculate 50-day and 200-day moving averages
      const calculateMA = (period: number) => {
        return stockData.map((item, index) => {
          if (index < period - 1) return null;
          const slice = stockData.slice(index - period + 1, index + 1);
          return slice.reduce((sum, item) => sum + item.close, 0) / period;
        });
      };

      const sma50 = calculateMA(50);
      const sma200 = calculateMA(200);

      // Calculate RSI (14-period)
      const calculateRSI = () => {
        const period = 14;
        const rsi = stockData.map((item, index) => {
          if (index < period) return null;
          const gains = [];
          const losses = [];
          for (let i = index - period + 1; i <= index; i++) {
            const change = stockData[i].close - stockData[i - 1].close;
            if (change >= 0) {
              gains.push(change);
              losses.push(0);
            } else {
              gains.push(0);
              losses.push(-change);
            }
          }
          const avgGain = gains.reduce((sum, val) => sum + val, 0) / period;
          const avgLoss = losses.reduce((sum, val) => sum + val, 0) / period;
          return 100 - (100 / (1 + avgGain / avgLoss));
        });
        return rsi;
      };

      // Calculate MACD
      const calculateMACD = () => {
        const closePrices = stockData.map(d => d.close);
        const ema12 = calculateEMA(closePrices, 12);
        const ema26 = calculateEMA(closePrices, 26);
        const macd = ema12.map((value, index) => value - ema26[index]);
        const signal = calculateEMA(macd, 9);
        return macd.map((value, index) => value - signal[index]); // Return MACD histogram
      };

      // Calculate VWAP
      const calculateVWAP = () => {
        let cumulativeTPV = 0;
        let cumulativeVolume = 0;
        const vwap = stockData.map((item) => {
          const typicalPrice = (item.high + item.low + item.close) / 3;
          cumulativeTPV += typicalPrice * item.volume;
          cumulativeVolume += item.volume;
          return cumulativeTPV / cumulativeVolume;
        });
        return vwap;
      };

      const rsi = calculateRSI();
      const vwap = calculateVWAP();
      const macd = calculateMACD();

      // Update stock data with indicators
      const updatedData = stockData.map((item, index) => ({
        ...item,
        sma50: sma50[index],
        sma200: sma200[index],
        rsi: rsi[index],
        vwap: vwap[index],
        macd: macd[index]
      }));

      setStockData(updatedData);
    };

    calculateIndicators();
  }, [data.data]);

  // Update dimensions on mount and window resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: 600 // Fixed height or calculate based on container
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Format data for financial charts
  const chartData = Array.isArray(stockData) ? stockData.map(item => ({
    date: new Date(item.date),
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume,
    sma50: item.sma50,
    sma200: item.sma200,
    rsi: item.rsi,
    macd: item.macd,
    vwap: item.vwap
  })) : [];

  const xScaleProvider = discontinuousTimeScaleProviderBuilder()
    .inputDateAccessor((d: any) => d.date);
  
  const { data: scaleData, xScale, xAccessor, displayXAccessor } = xScaleProvider(chartData);

  const max = xAccessor(scaleData[scaleData.length - 1]);
  const min = xAccessor(scaleData[Math.max(0, scaleData.length - 100)]);
  const xExtents = [min, max + 5];

  const gridHeight = dimensions.height;
  const chartHeight = gridHeight * 0.7;
  const volumeHeight = gridHeight * 0.15;
  const indicatorHeight = gridHeight * 0.15;

  const margin = { left: 70, right: 70, top: 20, bottom: 30 };
  const timeDisplayFormat = timeFormat("%Y-%m-%d %H:%M");
  const numberFormat = format(".2f");

  const fetchStockData = async (period: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/stock/history/${symbol}?period=${period}&interval=${period === "1d" ? "5m" : "1d"}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }
      
      const historyData = await response.json();

      if (!historyData || !Array.isArray(historyData)) {
        console.error('Invalid data format received:', historyData);
        throw new Error('Invalid data format received');
      }

      setStockData(historyData);
      return historyData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
      console.error('Error fetching stock data:', errorMessage);
      setError(errorMessage);
      setStockData([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeframeChange = async (newTimeframe: string) => {
    try {
      setTimeframe(newTimeframe);
      const newData = await fetchStockData(newTimeframe);
      
      // Store the current enabled state of indicators
      const enabledStates = availableSeries.reduce((acc, series) => {
        acc[series.id] = series.enabled;
        return acc;
      }, {} as Record<string, boolean>);

      // Update stock data (this will trigger the useEffect for recalculating indicators)
      setStockData(newData);

      // Restore the enabled state of indicators
      setAvailableSeries(prev => prev.map(series => ({
        ...series,
        enabled: enabledStates[series.id]
      })));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to change timeframe');
    }
  };

  const fetchNewsForDate = async (date: string) => {
    setIsLoadingNews(true);
    try {
      const response = await fetch(`/news/${symbol}?date=${date}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch news: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSelectedDateNews(data.feed || []);
    } catch (error) {
      setSelectedDateNews([]);
    } finally {
      setIsLoadingNews(false);
    }
  };

  // Update chart data when stockData changes
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !Array.isArray(stockData) || stockData.length === 0) return;

    try {
      // Format data for chart
      const candlestickData = stockData.map(d => ({
        time: d.date.split(' ')[0] as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      const volumeData = stockData.map(d => ({
        time: d.date.split(' ')[0] as Time,
        value: d.volume,
        color: d.close >= d.open ? '#26a69a80' : '#ef535080',
      }));

      // Update series data
      if (seriesRef.current.candlestick) {
        seriesRef.current.candlestick.setData(candlestickData);
      }
      if (seriesRef.current.volume) {
        seriesRef.current.volume.setData(volumeData);
      }

      // Add technical indicators if enabled
      availableSeries.forEach(series => {
        if (series.enabled && series.id !== 'price' && series.id !== 'volume') {
          const indicatorData = stockData.map(d => ({
            time: d.date.split(' ')[0] as Time,
            value: d[series.dataKey as keyof StockHistoryData] as number || 0,
          }));

          if (!seriesRef.current[series.id]) {
            const lineSeries = chartRef.current!.addLineSeries({
              color: series.color,
              lineWidth: 2,
              priceScaleId: series.yAxisId === 'indicators' ? 'indicators' : 'right',
            });

            if (series.yAxisId === 'indicators') {
              chartRef.current!.priceScale('indicators').applyOptions({
                scaleMargins: {
                  top: 0.1,
                  bottom: 0.8,
                },
              });
            }

            seriesRef.current[series.id] = lineSeries;
          }

          seriesRef.current[series.id].setData(indicatorData);
        }
      });

      // Fit content
      chartRef.current.timeScale().fitContent();
    } catch (error) {
      console.error('Error updating chart data:', error);
    }
  }, [stockData, availableSeries]);

  if (!Array.isArray(stockData) || stockData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{symbol} - Price History</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p>No price history data available</p>
        </CardContent>
      </Card>
    )
  }

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context: ChartContext) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (typeof value !== 'number') return label;
            if (context.dataset.yAxisID === 'volume') {
              return `${label}: ${formatVolume(value)}`;
            }
            if (context.dataset.yAxisID === 'indicators' && label === 'RSI') {
              return `${label}: ${value.toFixed(2)}`;
            }
            return `${label}: $${value.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: timeframe === "1d" ? 6 : 10
        },
        grid: {
          display: false
        }
      },
      price: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Price ($)'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          callback: function(value: number) {
            return `$${value.toFixed(2)}`;
          }
        }
      },
      volume: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Volume'
        },
        grid: {
          display: false
        },
        ticks: {
          callback: function(value: number) {
            return formatVolume(value);
          }
        }
      },
      indicators: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Indicators'
        },
        grid: {
          display: false
        },
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };

  const formatPrice = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatVolume = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Calculate 52-week high and low
  const fiftyTwoWeekHigh = Math.max(...stockData.map(d => d.high));
  const fiftyTwoWeekLow = Math.min(...stockData.map(d => d.low));

  const dividendChartData = {
    labels: dividendHistory.map(d => d.date),
    datasets: [
      {
        label: 'Dividend',
        data: dividendHistory.map(d => d.dividend),
        backgroundColor: '#82ca9d'
      }
    ]
  }

  const dividendChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `$${context.parsed.y.toFixed(2)}`
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        ticks: {
          callback: function(value) {
            if (typeof value === 'number') {
              return `$${value.toFixed(2)}`
            }
            return value
          }
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{symbol} Stock Chart</CardTitle>
            <div className="flex gap-2">
              {timeframeOptions.map((option) => (
                <Button
                  key={option.value}
                  onClick={() => handleTimeframeChange(option.value)}
                  variant={timeframe === option.value ? "default" : "outline"}
                  size="sm"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {availableSeries.map(series => (
                <Button
                  key={series.id}
                  onClick={() => toggleSeries(series.id)}
                  variant={series.enabled ? "default" : "outline"}
                  className="flex items-center gap-2"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: series.color }}
                  />
                  {series.label}
                </Button>
              ))}
            </div>
            <div ref={chartContainerRef} className="w-full h-[600px]" />
            
            {/* Add important data display */}
            {stockData.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-medium">Current Price</div>
                    <div className="text-2xl font-bold">
                      ${stockData[stockData.length - 1].close.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-medium">Volume</div>
                    <div className="text-2xl font-bold">
                      {formatVolume(stockData[stockData.length - 1].volume)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-medium">Day Range</div>
                    <div className="text-lg">
                      ${stockData[stockData.length - 1].low.toFixed(2)} - ${stockData[stockData.length - 1].high.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-medium">Date</div>
                    <div className="text-lg">
                      {dateFormat(new Date(stockData[stockData.length - 1].date), "MMM d, yyyy")}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {dividendData.length > 0 && (
        <CollapsibleCard title="Dividend History">
          <div className="h-[200px] w-full">
            <ChartJS
              type="bar"
              data={{
                labels: dividendData.map(d => d.date),
                datasets: [{
                  label: 'Dividend',
                  data: dividendData.map(d => d.dividend),
                  backgroundColor: '#82ca9d'
                }]
              }}
              options={chartOptions}
            />
          </div>
        </CollapsibleCard>
      )}

      {earningsData.length > 0 && (
        <CollapsibleCard title="Earnings History">
          <div className="h-[200px] w-full">
            <ChartJS
              type="line"
              data={{
                labels: earningsData.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [
                  {
                    label: 'Actual EPS',
                    data: earningsData.map(d => d.actualEPS),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    pointRadius: 4
                  },
                  {
                    label: 'Estimated EPS',
                    data: earningsData.map(d => d.estimatedEPS),
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    pointRadius: 4,
                    borderDash: [5, 5]
                  }
                ]
              }}
              options={chartOptions}
            />
          </div>
        </CollapsibleCard>
      )}

      <CollapsibleCard title="Similar Stocks">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {similarStocks.map((stock) => (
            <Card key={stock.symbol}>
              <CardContent className="p-4">
                <h3 className="font-semibold">{stock.name} ({stock.symbol})</h3>
                <p>Price: ${stock.price.toFixed(2)}</p>
                <p>Market Cap: ${(stock.marketCap / 1e9).toFixed(2)}B</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CollapsibleCard>

      <Dialog open={isNewsModalOpen} onOpenChange={setIsNewsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {symbol} News - {selectedDate ? new Date(selectedDate).toLocaleDateString() : ''}
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingNews ? (
            <div className="flex items-center justify-center p-4">
              Loading news...
            </div>
          ) : selectedDateNews.length > 0 ? (
            <div className="space-y-4">
              {selectedDateNews.map((news, index) => (
                <div key={index} className="border-b pb-4">
                  <a 
                    href={news.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-lg font-semibold hover:text-blue-600"
                  >
                    {news.title}
                  </a>
                  <p className="text-sm text-gray-500 mt-1">
                    {news.source} - {new Date(news.time_published).toLocaleString()}
                  </p>
                  <p className="mt-2">{news.summary}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-4">
              No news available for this date
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Remove the HOCs and export the component directly
export default StockChart; 