import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_URL = 'http://10.0.0.29:11434'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🔍 DEBUG: Chat request body:', body)

    // Create a simple prompt for testing
    const prompt = body.message || ''
    console.log('🔍 DEBUG: Using prompt:', prompt)

    // Test Ollama connection
    try {
      const testResponse = await fetch(`${OLLAMA_URL}/api/tags`)
      console.log('🔍 DEBUG: Ollama connection test:', await testResponse.json())
    } catch (error) {
      console.error('❌ DEBUG: Ollama connection test failed:', error)
      throw new Error('Failed to connect to Ollama')
    }

    // Make the actual request
    console.log('📡 DEBUG: Sending request to Ollama')
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama2',
        prompt: prompt,
        system: `You are an expert trading assistant. Current portfolio: $10,000 initial capital.
                Keep responses under 150 words.`,
        stream: false // Disable streaming for debugging
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ DEBUG: Ollama request failed:', {
        status: response.status,
        error: errorText,
        url: OLLAMA_URL
      })
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('✅ DEBUG: Ollama response:', data)

    return NextResponse.json({
      choices: [{
        message: {
          content: data.response || 'No response from Ollama',
          role: 'assistant'
        }
      }]
    })

  } catch (error: any) {
    console.error('❌ DEBUG: API Route Error:', {
      error: error.message,
      stack: error.stack,
      url: OLLAMA_URL
    })
    return NextResponse.json(
      { 
        error: 'Failed to process chat message', 
        details: error.message,
        stack: error.stack 
      },
      { status: 500 }
    )
  }
} 