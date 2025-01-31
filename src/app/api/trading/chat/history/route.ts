import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for development
// In production, this should be replaced with a proper database
let chatHistory: {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}[] = []

// Helper to get a unique ID
const generateId = () => Math.random().toString(36).substring(2, 15)

export async function GET() {
  try {
    // Return the last 50 messages to prevent context overflow
    const recentHistory = chatHistory.slice(-50)
    return NextResponse.json(recentHistory)
  } catch (error) {
    console.error('❌ DEBUG: Error fetching chat history:', error)
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { role, content } = body

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create new message
    const newMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString()
    }

    // Add to history
    chatHistory.push(newMessage)

    // Keep only last 100 messages to prevent memory overflow
    if (chatHistory.length > 100) {
      chatHistory = chatHistory.slice(-100)
    }

    return NextResponse.json(newMessage)
  } catch (error) {
    console.error('❌ DEBUG: Error adding chat message:', error)
    return NextResponse.json(
      { error: 'Failed to add chat message' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    chatHistory = []
    return NextResponse.json({ message: 'Chat history cleared' })
  } catch (error) {
    console.error('❌ DEBUG: Error clearing chat history:', error)
    return NextResponse.json(
      { error: 'Failed to clear chat history' },
      { status: 500 }
    )
  }
} 