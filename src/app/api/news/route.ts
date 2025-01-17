import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  try {
    let url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT`
    if (symbol) {
      url += `&tickers=${symbol}`
    }
    url += `&apikey=${process.env.ALPHAVANTAGE_API_KEY}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching news:', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
} 