import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'

// Type definitions
interface Analysis {
  timestamp: string | number
}

interface Portfolio {
  total_value: number
  cash_balance: number
  positions_value: number
  performance: {
    total_return: number
  }
}

interface TradingStatus {
  is_running: boolean
  watched_symbols: string[]
  portfolio: Portfolio
  last_analysis: Record<string, Analysis>
}

interface ChatMessage {
  content: string
  timestamp: string
  role: 'user' | 'assistant'
}

interface ToolCall {
  name: string
  arguments: Record<string, any>
}

// Helper function to detect request type and determine tool calls
async function analyzeRequest(prompt: string): Promise<{ type: string; toolCalls: ToolCall[] }> {
  const systemPrompt = `
    You are a trading assistant that helps decide how to handle user queries.
    Based on the user's input, determine what type of information they're looking for
    and what tools should be called. Respond in JSON format with:
    {
      "type": "chat_history" | "history" | "news" | "search",
      "toolCalls": [
        {
          "name": "string (one of: fetchChatHistory, searchNews, performSearch)",
          "arguments": {}
        }
      ]
    }
  `

  const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral',
      prompt: `${systemPrompt}\n\nUser query: "${prompt}"\n\nResponse:`,
      stream: false,
      options: { temperature: 0.3, silent: true }
    })
  })

  if (!ollamaResponse.ok) {
    throw new Error('Failed to analyze request')
  }

  const data = await ollamaResponse.json()
  try {
    return JSON.parse(data.response)
  } catch {
    // Default to search if parsing fails
    return {
      type: 'search',
      toolCalls: [{ name: 'performSearch', arguments: { query: prompt } }]
    }
  }
}

async function fetchChatHistory(): Promise<ChatMessage[]> {
  try {
    const response = await fetch('/api/trading/chat/history', {
      method: 'GET',
    })
    if (!response.ok) throw new Error('Failed to fetch chat history')
    return await response.json()
  } catch (error) {
    console.error('Error fetching chat history:', error)
    return []
  }
}

async function searchNews(query: string): Promise<any[]> {
  try {
    const response = await fetch('/api/trading/news/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
    if (!response.ok) throw new Error('Failed to fetch news')
    return await response.json()
  } catch (error) {
    console.error('Error searching news:', error)
    return []
  }
}

async function performSearch(query: string): Promise<any[]> {
  try {
    const response = await fetch('/api/trading/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
    if (!response.ok) throw new Error('Failed to perform search')
    return await response.json()
  } catch (error) {
    console.error('Error performing search:', error)
    return []
  }
}

// Helper function to create appropriate prompt based on request type and data
function createPrompt(type: string, status: TradingStatus, prompt: string, data?: any) {
  switch (type) {
    case 'chat_history':
      return `
        As a trading bot analyst, analyze the chat history and provide a summary:
        
        Chat History:
        ${data ? data.map((msg: ChatMessage) => 
          `[${msg.role}] ${new Date(msg.timestamp).toLocaleString()}: ${msg.content}`
        ).join('\n') : 'No chat history available'}
        
        ${prompt}
        
        Provide a concise summary of the chat history, focusing on key discussions,
        decisions made, and important insights shared.
      `

    case 'news':
      return `
        As a trading bot analyst, analyze the latest news and current trading status:
        
        Current Bot Status: ${status.is_running ? 'Running' : 'Stopped'}
        Watched Symbols: ${status.watched_symbols?.join(', ') || 'None'}
        
        Recent News:
        ${data ? data.map((item: any) => 
          `- ${item.title} (${new Date(item.timestamp).toLocaleString()})`
        ).join('\n') : 'No news available'}
        
        ${prompt}
        
        Analyze the news impact on current positions and provide recommendations.
      `

    default:
      return `
        As a trading bot analyst, analyze the following information:
        
        Bot Status: ${status.is_running ? 'Running' : 'Stopped'}
        Watched Symbols: ${status.watched_symbols?.join(', ') || 'None'}
        
        Search Results:
        ${data ? JSON.stringify(data, null, 2) : 'No results available'}
        
        ${prompt}
        
        Provide a concise analysis and any relevant recommendations.
      `
  }
}

export async function POST(request: NextRequest) {
  try {
    const { status, prompt } = await request.json()
    
    // Analyze the request to determine type and required tool calls
    const analysis = await analyzeRequest(prompt)
    let responseData: any

    // Execute the appropriate tool calls
    for (const tool of analysis.toolCalls) {
      switch (tool.name) {
        case 'fetchChatHistory':
          responseData = await fetchChatHistory()
          break
        case 'searchNews':
          responseData = await searchNews(prompt)
          break
        case 'performSearch':
          responseData = await performSearch(prompt)
          break
      }
    }

    // Create the appropriate prompt based on request type and data
    const detailedPrompt = createPrompt(analysis.type, status as TradingStatus, prompt, responseData)

    // Get the final summary from Ollama
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        prompt: detailedPrompt,
        stream: false,
        options: {
          num_predict: 1024,
          temperature: 0.7,
          silent: true
        }
      })
    })

    if (!ollamaResponse.ok) {
      throw new Error('Failed to get response from Ollama')
    }

    const data = await ollamaResponse.json()
    
    return NextResponse.json({ 
      summary: data.response,
      type: analysis.type,
      data: responseData
    })
  } catch (error) {
    console.error('Error in summarize endpoint:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { 
        error: 'Failed to generate summary', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 