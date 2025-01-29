import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const startTime = Date.now();
  console.log('GET /api/stock/history/[symbol] - Starting request processing');
  console.log('Request URL:', request.url);
  console.log('Symbol from params:', params.symbol);
  
  const { searchParams } = new URL(request.url);
  const queryParams = Object.fromEntries(searchParams.entries());
  console.log('Search params:', queryParams);
  
  const symbol = params.symbol;
  const period = searchParams.get('period') || '1d';
  const interval = searchParams.get('interval') || '5m';
  
  if (!symbol) {
    console.error('No symbol provided in request');
    return NextResponse.json(
      { error: 'Symbol is required' },
      { status: 400 }
    );
  }
  
  console.log(`Fetching stock history - Symbol: ${symbol}, Period: ${period}, Interval: ${interval}`);
  
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    console.log('Backend URL:', backendUrl);
    
    if (!backendUrl) {
      console.error('NEXT_PUBLIC_BACKEND_URL environment variable is not set');
      throw new Error('Backend URL not configured');
    }
    
    const url = `${backendUrl}/stock/history/${symbol}?period=${period}&interval=${interval}`;
    console.log('Making request to backend URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Backend response received');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Backend error:', error);
      return NextResponse.json(
        { error: `Failed to fetch stock history: ${error}` },
        { status: response.status }
      );
    }

    const text = await response.text();
    console.log('Response size:', text.length, 'bytes');
    console.log('First 200 characters of response:', text.substring(0, 200));
    
    try {
      const data = JSON.parse(text);
      console.log('Data points received:', Array.isArray(data) ? data.length : 'Not an array');
      console.log('Sample data point:', Array.isArray(data) && data.length > 0 ? data[0] : 'No data');
      
      const processingTime = Date.now() - startTime;
      console.log(`Request completed in ${processingTime}ms`);
      
      return NextResponse.json(data);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON response from backend', details: parseError instanceof Error ? parseError.message : 'Unknown parse error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 