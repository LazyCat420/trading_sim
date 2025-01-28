import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
  }

  try {
    // For now, return mock data. In a real app, you would fetch from a financial API
    const mockData = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      return {
        date: date.toISOString().split('T')[0],
        price: 100 + Math.random() * 20 - 10 // Random price between 90 and 110
      }
    })

    return NextResponse.json(mockData)
  } catch (error) {
    console.error('Error fetching stock history:', error)
    return NextResponse.json({ error: 'Failed to fetch stock history' }, { status: 500 })
  }
} 