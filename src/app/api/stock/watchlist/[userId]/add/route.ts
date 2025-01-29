import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  console.log('POST /api/stock/watchlist/[userId]/add - Received request for userId:', params.userId);
  console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
  
  try {
    const body = await request.json();
    console.log('Request body:', body);
    
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/stock/watchlist/${params.userId}/add`;
    console.log('Fetching from backend URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log('Backend response status:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Backend error:', error);
      return NextResponse.json(
        { error: 'Failed to add stock to watchlist' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Backend response data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/stock/watchlist/[userId]/add:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 