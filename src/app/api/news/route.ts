import { NextResponse } from 'next/server'

const BACKEND_URL = 'http://localhost:8000'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const date = searchParams.get('date')

  if (!symbol) {
    console.error('News API: Symbol is required')
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
  }

  try {
    let url = `${BACKEND_URL}/news/${symbol}`
    if (date) {
      url += `?date=${date}`
    }
    
    console.log('News API: Fetching from URL:', url)
    const response = await fetch(url)
    console.log('News API: Response status:', response.status)
    
    const data = await response.json()
    console.log('News API: Raw response data:', data)

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