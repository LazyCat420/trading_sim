import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol;

  try {
    // Fetch stock data from your backend
    const response = await fetch(`http://localhost:8000/stock/${symbol}`);
    const stockData = await response.json();
    
    // Validate data before sending
    if (!stockData || !stockData.currentPrice) {
      throw new Error('Invalid stock data');
    }

    return NextResponse.json({
      symbol: symbol,
      currentPrice: stockData.currentPrice,
      change: stockData.change,
      changePercent: stockData.changePercent,
      volume: stockData.volume,
      marketCap: stockData.marketCap,
      peRatio: stockData.peRatio,
      dividendYield: stockData.dividendYield,
      fiftyTwoWeekHigh: stockData.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: stockData.fiftyTwoWeekLow,
      shortName: stockData.shortName,
      longName: stockData.longName,
      sector: stockData.sector,
      industry: stockData.industry
    });
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch stock data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
} 