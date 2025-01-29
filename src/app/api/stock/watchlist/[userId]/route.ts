import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  console.log('GET /api/stock/watchlist/[userId] - Received request for userId:', params.userId);
  console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
  
  try {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/stock/watchlist/${params.userId}`;
    console.log('Fetching from backend URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Backend response status:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Backend error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch watchlist' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Backend response data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/stock/watchlist/[userId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 