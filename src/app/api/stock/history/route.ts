import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('GET /api/stock/history - Received request');
  
  // Get the symbol from the search params
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol is required' },
      { status: 400 }
    );
  }
  
  console.log('Fetching stock history for symbol:', symbol);
  
  try {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/stock/history/${symbol}`;
    console.log('Fetching from backend URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Backend response status:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Backend error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stock history' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Backend response data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/stock/history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 