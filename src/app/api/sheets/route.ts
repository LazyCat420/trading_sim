import { google } from 'googleapis'
import { NextResponse } from 'next/server'

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
  }

  try {
    // Your Google Sheet ID
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    // Read data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'StockData!A:F', // Adjust range based on your sheet structure
    })

    const rows = response.data.values

    if (!rows) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    // Find the row with matching symbol
    const stockData = rows.find(row => row[0] === symbol)

    if (!stockData) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }

    // Format the response
    const data = {
      symbol: stockData[0],
      currentPrice: parseFloat(stockData[1]),
      change: parseFloat(stockData[2]),
      changePercent: parseFloat(stockData[3]),
      volume: parseInt(stockData[4]),
      marketCap: stockData[5]
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching stock data:', error)
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
  }
} 