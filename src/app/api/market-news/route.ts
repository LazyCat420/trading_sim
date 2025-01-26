import { NextResponse } from 'next/server'

const BACKEND_URL = 'http://localhost:8000'  // Updated to match Python backend port

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/market-news`)
    
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