import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string; symbol: string } }
) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/stock/watchlist/${params.userId}/remove/${params.symbol}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      console.error('Backend error:', error)
      return NextResponse.json(
        { error: 'Failed to remove stock from watchlist' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error removing stock from watchlist:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 