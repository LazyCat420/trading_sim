import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
  }

  try {
    const response = await fetch(`http://localhost:8000/stock/${symbol}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to fetch stock data')
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching stock data:', error)
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
  }
} 