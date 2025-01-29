import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('GET /api/stock - Received request');
  console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
  
  // Get the symbol from the search params
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol is required' },
      { status: 400 }
    );
  }
  
  console.log('Fetching stock data for symbol:', symbol);
  
  try {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/stock/${symbol}`;
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
        { error: 'Failed to fetch stock data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Backend response data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/stock:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const response = await fetch('http://localhost:8000/stock/watchlist/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to add stock to watchlist')
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error adding stock to watchlist:', error)
    return NextResponse.json({ error: 'Failed to add stock to watchlist' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
  }

  try {
    const response = await fetch(`http://localhost:8000/stock/watchlist/${symbol}`, {
      method: 'DELETE',
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to remove stock from watchlist')
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error removing stock from watchlist:', error)
    return NextResponse.json({ error: 'Failed to remove stock from watchlist' }, { status: 500 })
  }
} 