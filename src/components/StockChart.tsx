"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Filler,
  ChartOptions,
  ScaleOptions
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { CollapsibleCard } from './ui/collapsible-card'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface StockHistoryData {
  date: string
  price: number
  volume: number
  high: number
  low: number
  open: number
  close: number
}

interface DividendData {
  date: string
  dividend: number
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

interface StockChartProps {
  symbol: string;
  data: {
    data: StockHistoryData[];
  };
}

export default function StockChart({ symbol, data }: StockChartProps) {
  const [timeframe, setTimeframe] = useState<string>("1d")
  const [stockData, setStockData] = useState<StockHistoryData[]>(data.data)
  const [dividendHistory, setDividendHistory] = useState<DividendData[]>([])
  const [similarStocks, setSimilarStocks] = useState<SimilarStock[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedDateNews, setSelectedDateNews] = useState<NewsItem[]>([])
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false)
  const [isLoadingNews, setIsLoadingNews] = useState(false)

  const fetchStockData = async (period: string) => {
    setIsLoading(true)
    setError(null)
    try {
      console.log(`Fetching stock data for ${symbol} with period ${period}`)
      
      const response = await fetch(`/stock/history/${symbol}?period=${period}`)
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }
      
      const rawText = await response.text()
      console.log('Raw response:', rawText)
      
      let historyData
      try {
        historyData = JSON.parse(rawText)
        console.log('Parsed history data:', historyData)
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError)
        throw new Error('Invalid JSON response from server')
      }

      if (!Array.isArray(historyData)) {
        console.error('Invalid data format:', historyData)
        throw new Error('Invalid data format received')
      }

      // Update the chart data
      setStockData(historyData)
      
      // Fetch dividend history
      const dividendResponse = await fetch(`/stock/dividends/${symbol}`)
      if (!dividendResponse.ok) {
        console.error('Failed to fetch dividend data:', await dividendResponse.text())
      } else {
        const dividendData = await dividendResponse.json()
        setDividendHistory(dividendData)
      }
      
      // Fetch similar stocks
      const similarResponse = await fetch(`/stock/similar/${symbol}`)
      if (!similarResponse.ok) {
        console.error('Failed to fetch similar stocks:', await similarResponse.text())
      } else {
        const similarData = await similarResponse.json()
        setSimilarStocks(similarData)
      }
      
      return historyData
    } catch (error) {
      console.error('Error in fetchStockData:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch data')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const handleTimeframeChange = async (newTimeframe: string) => {
    try {
      setTimeframe(newTimeframe)
      await fetchStockData(newTimeframe)
    } catch (error) {
      console.error('Error in handleTimeframeChange:', error)
    }
  }

  const fetchNewsForDate = async (date: string) => {
    setIsLoadingNews(true)
    try {
      console.log(`Fetching news for ${symbol} on ${date}`)
      const response = await fetch(`/news/${symbol}?date=${date}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch news: ${response.statusText}`)
      }
      
      const data = await response.json()
      setSelectedDateNews(data.feed || [])
    } catch (error) {
      console.error('Error fetching news:', error)
      setSelectedDateNews([])
    } finally {
      setIsLoadingNews(false)
    }
  }

  const handleChartClick = async (event: any, elements: any[]) => {
    if (elements.length > 0) {
      const dataIndex = elements[0].index
      const clickedDate = stockData[dataIndex].date
      setSelectedDate(clickedDate)
      await fetchNewsForDate(clickedDate)
      setIsNewsModalOpen(true)
    }
  }

  if (!data?.data || data.data.length === 0) {
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

  const chartData = data.data;

  // Calculate 52-week high and low
  const fiftyTwoWeekHigh = Math.max(...chartData.map((d: StockHistoryData) => d.high))
  const fiftyTwoWeekLow = Math.min(...chartData.map((d: StockHistoryData) => d.low))

  const chartConfig = {
    labels: stockData.map(d => d.date),
    datasets: [
      {
        label: 'Price',
        data: stockData.map(d => d.close),
        fill: true,
        borderColor: '#8884d8',
        backgroundColor: 'rgba(136, 132, 216, 0.3)',
        tension: 0.4
      }
    ]
  }

  const chartOptions: ChartOptions<'line'> = {
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
    },
    onClick: handleChartClick
  }

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
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>{symbol} - Price History</span>
            <div className="flex gap-2">
              <Button
                variant={timeframe === "1d" ? "default" : "outline"}
                onClick={() => handleTimeframeChange("1d")}
                disabled={isLoading}
              >
                1D
              </Button>
              <Button
                variant={timeframe === "5d" ? "default" : "outline"}
                onClick={() => handleTimeframeChange("5d")}
                disabled={isLoading}
              >
                5D
              </Button>
              <Button
                variant={timeframe === "1mo" ? "default" : "outline"}
                onClick={() => handleTimeframeChange("1mo")}
                disabled={isLoading}
              >
                1M
              </Button>
              <Button
                variant={timeframe === "1y" ? "default" : "outline"}
                onClick={() => handleTimeframeChange("1y")}
                disabled={isLoading}
              >
                1Y
              </Button>
              <Button
                variant={timeframe === "5y" ? "default" : "outline"}
                onClick={() => handleTimeframeChange("5y")}
                disabled={isLoading}
              >
                5Y
              </Button>
              <Button
                variant={timeframe === "10y" ? "default" : "outline"}
                onClick={() => handleTimeframeChange("10y")}
                disabled={isLoading}
              >
                10Y
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <Line data={chartConfig} options={chartOptions} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">52 Week High:</span> ${fiftyTwoWeekHigh.toFixed(2)}
            </div>
            <div>
              <span className="font-semibold">52 Week Low:</span> ${fiftyTwoWeekLow.toFixed(2)}
            </div>
          </div>
        </CardContent>
      </Card>

      <CollapsibleCard title="Dividend History">
        <div className="h-[200px] w-full">
          <Bar data={dividendChartData} options={dividendChartOptions} />
        </div>
      </CollapsibleCard>

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