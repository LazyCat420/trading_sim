import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  console.log('[API_ADD_STOCK] Starting request handling', {
    userId: params.userId,
    timestamp: new Date().toISOString()
  });
  
  if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
    console.error('[API_ADD_STOCK] NEXT_PUBLIC_BACKEND_URL is not configured');
    return NextResponse.json(
      { error: 'Backend URL not configured', success: false },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    console.log('[API_ADD_STOCK] Request body:', body);
    
    if (!body.symbol) {
      console.error('[API_ADD_STOCK] Missing stock symbol in request');
      return NextResponse.json(
        { error: 'Stock symbol is required', success: false },
        { status: 400 }
      );
    }

    console.log('[API_ADD_STOCK] Preparing backend request', {
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/stock/watchlist/${params.userId}/add`,
      payload: {
        symbol: body.symbol,
        name: body.name,
        last_price: body.price,
        last_updated: body.lastUpdated
      }
    });
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/stock/watchlist/${params.userId}/add`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: body.symbol,
          name: body.name,
          last_price: body.price,
          last_updated: body.lastUpdated
        }),
      }
    );
    
    console.log('[API_ADD_STOCK] Backend response status:', response.status);
    
    const data = await response.json();
    console.log('[API_ADD_STOCK] Backend response data:', data);
    
    if (!response.ok) {
      console.error('[API_ADD_STOCK] Backend request failed', {
        status: response.status,
        error: data.detail || 'Unknown error'
      });
      return NextResponse.json(
        { error: data.detail || 'Failed to add stock to watchlist', success: false },
        { status: response.status }
      );
    }

    console.log('[API_ADD_STOCK] Successfully added stock to watchlist');
    return NextResponse.json({ ...data, success: true });
  } catch (error) {
    console.error('[API_ADD_STOCK] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error', success: false },
      { status: 500 }
    );
  }
} 