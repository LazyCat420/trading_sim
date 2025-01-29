import { NextRequest, NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const startTime = Date.now();
  console.log('GET /api/stock/info/[symbol] - Starting request processing');
  console.log('Symbol from params:', params.symbol);
  
  const symbol = params.symbol;
  
  if (!symbol) {
    console.error('No symbol provided in request');
    return NextResponse.json(
      { error: 'Symbol is required' },
      { status: 400 }
    );
  }
  
  try {
    console.log('Fetching data from Yahoo Finance for symbol:', symbol);
    
    // Fetch quote data
    const quote = await yahooFinance.quote(symbol);
    // Fetch detailed stats
    const quoteSummary = await yahooFinance.quoteSummary(symbol, {
      modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData']
    });
    
    const { price, summaryDetail, defaultKeyStatistics, financialData } = quoteSummary;
    
    // Format the data according to our MarketData interface
    const formattedData = {
      // Market Data
      marketCap: formatLargeNumber(price.marketCap),
      income: formatLargeNumber(financialData.totalRevenue),
      revenue: formatLargeNumber(financialData.totalRevenue),
      bookSh: defaultKeyStatistics.bookValue?.fmt || 'N/A',
      cashSh: defaultKeyStatistics.totalCashPerShare?.fmt || 'N/A',
      dividend: summaryDetail.dividendRate?.fmt || '0',
      dividendYield: summaryDetail.dividendYield?.fmt || '0%',
      employees: defaultKeyStatistics.fullTimeEmployees || 0,

      // Trading Data
      price: quote.regularMarketPrice,
      volume: formatLargeNumber(quote.regularMarketVolume),
      prevClose: quote.regularMarketPreviousClose,
      change: quote.regularMarketChangePercent,

      // Valuation
      pe: summaryDetail.trailingPE?.raw || 0,
      forwardPE: summaryDetail.forwardPE?.raw || 0,
      peg: defaultKeyStatistics.pegRatio?.raw || 0,
      ps: defaultKeyStatistics.priceToSalesTrailing12Months?.raw || 0,
      pb: defaultKeyStatistics.priceToBook?.raw || 0,
      pc: price.regularMarketPrice / (financialData.operatingCashflow?.raw || 1),
      pfcf: defaultKeyStatistics.priceToOperatingCashflows?.raw || 0,
      quickRatio: financialData.quickRatio?.raw || 0,
      currentRatio: financialData.currentRatio?.raw || 0,
      debtEq: financialData.debtToEquity?.raw || 0,

      // Growth & Performance
      eps: {
        ttm: defaultKeyStatistics.trailingEps?.raw || 0,
        nextY: defaultKeyStatistics.forwardEps?.raw || 0,
        nextQ: 0, // Not available in basic Yahoo Finance data
        thisY: financialData.revenueGrowth?.raw || 0,
        next5Y: defaultKeyStatistics.enterpriseToEbitda?.raw || 0,
        past5Y: defaultKeyStatistics.enterpriseToRevenue?.raw || 0,
        qoq: financialData.earningsGrowth?.raw || 0
      },
      salesGrowth: {
        past5Y: financialData.revenueGrowth?.raw || 0,
        qoq: financialData.revenueGrowth?.raw || 0
      },

      // Technical Indicators
      rsi: 0, // Need to calculate this separately
      relVolume: quote.regularMarketVolume / (summaryDetail.averageVolume?.raw || 1),
      shortFloat: defaultKeyStatistics.shortPercentOfFloat?.raw || 0,
      beta: defaultKeyStatistics.beta?.raw || 0,
      sma20: 0, // Need to calculate this separately
      sma50: 0, // Need to calculate this separately
      sma200: 0, // Need to calculate this separately
      targetPrice: financialData.targetHighPrice?.raw || 0
    };

    const processingTime = Date.now() - startTime;
    console.log(`Request completed in ${processingTime}ms`);
    console.log('Formatted data:', formattedData);
    
    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function formatLargeNumber(num: number | undefined): string {
  if (!num) return 'N/A';
  
  if (num >= 1e12) {
    return `${(num / 1e12).toFixed(2)}T`;
  }
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  }
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  }
  return num.toFixed(2);
} 