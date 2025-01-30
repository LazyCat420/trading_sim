import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'

export async function POST(request: NextRequest) {
  try {
    const { status, prompt } = await request.json()

    // Create a detailed prompt for the LLM
    const detailedPrompt = `
      As a trading bot analyst, analyze and summarize the following trading bot status:
      
      Bot Status: ${status.is_running ? 'Running' : 'Stopped'}
      Watched Symbols: ${status.watched_symbols?.join(', ') || 'None'}
      
      Portfolio Summary:
      - Total Value: $${status.portfolio?.total_value || 0}
      - Cash Balance: $${status.portfolio?.cash_balance || 0}
      - Positions Value: $${status.portfolio?.positions_value || 0}
      - Total Return: ${status.portfolio?.performance?.total_return || 0}%
      
      Recent Analysis:
      ${Object.entries(status.last_analysis || {})
        .map(([symbol, analysis]) => 
          `${symbol}: Last analyzed at ${new Date(analysis.timestamp).toLocaleString()}`
        )
        .join('\n')}
      
      ${prompt}
      
      Provide a concise summary of the current status, any notable changes, and potential actions or recommendations.
      Focus on key metrics and significant changes. Keep the response under 200 words.
    `

    // Call Ollama API
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral',
        prompt: detailedPrompt,
        stream: false
      }),
    })

    if (!ollamaResponse.ok) {
      throw new Error('Failed to get response from Ollama')
    }

    const data = await ollamaResponse.json()
    return NextResponse.json({ summary: data.response })
  } catch (error) {
    console.error('Error in summarize endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary', details: error.message },
      { status: 500 }
    )
  }
} 