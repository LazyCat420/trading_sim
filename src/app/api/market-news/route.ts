import { NextResponse } from 'next/server'

const BACKEND_URL = 'http://localhost:8000'  // Updated to match Python backend port

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tickers = searchParams.get('tickers')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = searchParams.get('limit')

    // Build query parameters for backend
    const params = new URLSearchParams()
    if (tickers) params.append('tickers', tickers)
    if (from) params.append('from', from)
    if (to) params.append('to', to)
    if (limit) params.append('limit', limit)

    const response = await fetch(`${BACKEND_URL}/market-news?${params.toString()}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || `Failed to fetch market news: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (!data.feed) {
      console.warn('No news feed in response')
      return NextResponse.json({ feed: [] })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching market news:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market news', feed: [] },
      { status: 500 }
    )
  }
} 