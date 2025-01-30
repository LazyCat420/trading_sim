import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

export async function GET(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    if (params.action !== 'status') {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }

    const response = await fetch(`${BACKEND_URL}/automate/status`)
    const data = await response.json()
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in automation status endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to get automation status' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    if (!['start', 'stop'].includes(params.action)) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }

    const response = await fetch(`${BACKEND_URL}/automate/${params.action}`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      throw new Error(`Failed to ${params.action} automation`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error(`Error in automation ${params.action} endpoint:`, error)
    return NextResponse.json(
      { error: `Failed to ${params.action} automation` },
      { status: 500 }
    )
  }
} 