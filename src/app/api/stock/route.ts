import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    // If no symbol is provided, return the watchlist
    try {
      const response = await fetch('http://localhost:8000/stock/watchlist/')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch watchlist')
      }

      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching watchlist:', error)
      return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 })
    }
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