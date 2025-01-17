import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHAVANTAGE_API_KEY}`
    )

    const data = await response.json()

    if (!data["Global Quote"] || Object.keys(data["Global Quote"]).length === 0) {
      return NextResponse.json({ error: 'Invalid symbol or API limit reached' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching stock data:', error)
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
  }
} 