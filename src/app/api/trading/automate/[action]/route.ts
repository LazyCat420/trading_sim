import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'

export async function GET(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    console.log('GET automation status request:', params.action)
    
    if (params.action !== 'status') {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }

    const response = await fetch(`${BACKEND_URL}/api/trading/automate/status`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('Automation status response:', data)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in automation status endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to get automation status', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    console.log('POST automation request:', params.action)
    
    if (!['start', 'stop'].includes(params.action)) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }

    const response = await fetch(`${BACKEND_URL}/api/trading/automate/${params.action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to ${params.action} automation:`, errorText)
      throw new Error(errorText || `Failed to ${params.action} automation`)
    }
    
    const data = await response.json()
    console.log(`Automation ${params.action} response:`, data)
    return NextResponse.json(data)
  } catch (error) {
    console.error(`Error in automation ${params.action} endpoint:`, error)
    return NextResponse.json(
      { error: `Failed to ${params.action} automation`, details: error.message },
      { status: 500 }
    )
  }
} 