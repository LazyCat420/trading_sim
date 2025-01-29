import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: Request) {
  console.log('News API: Starting request handling');
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const date = searchParams.get('date')

  console.log('News API: Request params:', { symbol, date });
  console.log('News API: Using backend URL:', BACKEND_URL);

  if (!symbol) {
    console.error('News API: Symbol is required')
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
  }

  try {
    let url = `${BACKEND_URL}/stock/news/${symbol}`  // Updated path to match backend
    if (date) {
      url += `?date=${date}`
    }
    
    console.log('News API: Fetching from URL:', url)
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    console.log('News API: Response status:', response.status)
    
    const responseText = await response.text()
    console.log('News API: Raw response text:', responseText)
    
    let data
    try {
      data = JSON.parse(responseText)
      console.log('News API: Parsed response data:', data)
    } catch (parseError) {
      console.error('News API: Failed to parse response as JSON:', parseError)
      throw new Error('Invalid JSON response from backend')
    }

    if (!response.ok) {
      console.error('News API: Error response:', data)
      throw new Error(data.detail || 'Failed to fetch news')
    }

    // Ensure the response has the expected structure
    if (!data.feed) {
      console.warn('News API: No feed in response')
      return NextResponse.json({ feed: [] })
    }

    console.log('News API: Returning feed with', data.feed.length, 'items')
    return NextResponse.json(data)
  } catch (error) {
    console.error('News API: Error fetching news:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news', feed: [] },
      { status: 500 }
    )
  }
} 