import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://10.0.0.29:11434'
const BACKEND_URL = 'http://localhost:8000'  // Python FastAPI backend

// In-memory storage for development
// In production, this should be replaced with a proper database
type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// Using let for mutable chat history
let inMemoryChatHistory: ChatMessage[] = []

// Helper to get a unique ID
const generateId = () => Math.random().toString(36).substring(2, 15)

interface SearchResult {
  title: string
  content: string
  url: string
  source?: string
  metadata?: {
    type: string
  }
}

interface SearchResponse {
  results: SearchResult[]
  total_results: number
  query: string
  response_text: string
}

async function searchBackend(query: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/search/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: query,
        num_results: 10,
        search_type: 'news'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail?.message || `Backend search failed: ${response.status}`)
    }

    const data = await response.json() as SearchResponse

    if (data.results && Array.isArray(data.results)) {
      const results = data.results.map((result: SearchResult) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        source: result.source || 'searxng',
        metadata: result.metadata || { type: 'news' }
      }))
      return results
    }
    
    return []
  } catch (error) {
    return []
  }
}

async function askOllama(userQuery: string, contextData: { context: string, analysis: any }) {
  const { context, analysis } = contextData
  
  // Build prompt with context and search info
  const enhancedPrompt = `Here is our chat history and relevant information:

${context}

Question: ${userQuery}

Please provide a helpful response based on this context.`

  const systemPrompt = `You are an expert trading assistant with deep knowledge of financial markets.
    You have access to real-time market data and can help with:
    - Market analysis and trading strategies
    - Technical and fundamental analysis
    - Risk management and portfolio optimization
    
    Current portfolio: $10,000 initial capital.
    
    Important instructions:
    1. Always reference and use the provided market information in your response
    2. Cite sources using [1], [2], etc. inline when referencing information
    3. Keep responses under 150 words
    4. Be direct and specific
    5. Make up opinions based on the data provided
    6. Always end your response with a "Sources:" section listing numbered links
    
    ${analysis.responseStyle.includeHistoryRecap ? 'Include a brief recap of relevant previous discussion points.' : ''}
    ${analysis.responseStyle.connectPastToPresent ? 'Connect previous insights to current market information.' : ''}
    ${analysis.responseStyle.focusOnNewInfo ? 'Focus on providing new, relevant market information.' : ''}`

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3.2:latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: enhancedPrompt }
      ],
      stream: true
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`)
  }

  return response
}

async function getSummary(query: string, context: string = '') {
  try {
    const status = {
      is_running: true,  // Default values, you may want to fetch these from your actual trading system
      watched_symbols: [],
      portfolio: {
        total_value: 0,
        cash_balance: 0,
        positions_value: 0,
        performance: {
          total_return: 0
        }
      },
      last_analysis: {}
    }

    const response = await fetch('/api/trading/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        prompt: query,
        context
      })
    })

    if (!response.ok) {
      throw new Error(`Summarize API error: ${response.status}`)
    }

    const data = await response.json()
    return data.summary
  } catch (error) {
    return null
  }
}

async function fetchChatHistory() {
  try {
    // Return the last 50 messages to prevent context overflow
    return inMemoryChatHistory.slice(-50)
  } catch (error) {
    return []
  }
}

async function storeChatMessage(role: 'user' | 'assistant', content: string) {
  try {
    // Create new message
    const newMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString()
    }

    // Add to history
    inMemoryChatHistory.push(newMessage)

    // Keep only last 100 messages to prevent memory overflow
    if (inMemoryChatHistory.length > 100) {
      inMemoryChatHistory = inMemoryChatHistory.slice(-100)
    }

    return newMessage
  } catch (error) {
    return null
  }
}

async function analyzeHistoryRequest(query: string) {
  try {
    const systemPrompt = `You are a trading assistant that helps analyze user requests about chat history.
      Determine if the user is:
      1. Asking to see/review past chat logs (summarize)
      2. Searching for specific information in past chats (search)
      3. Asking about a specific topic's history (topic search)

      Respond in JSON format:
      {
        "action": "summarize" | "search" | "topic_search",
        "explanation": "Brief reason for the decision",
        "search_query": "Modified search query if action is search/topic_search"
      }`

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:latest',
        prompt: `${systemPrompt}\n\nUser query: "${query}"\n\nResponse:`,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error('Failed to analyze history request')
    }

    const data = await response.json()
    return JSON.parse(data.response)
  } catch (error) {
    // Default to summarize on error
    return { action: 'summarize', explanation: 'Default action due to error' }
  }
}

async function getContextualizedPrompt(userQuery: string, chatHistory: any[]) {
  try {
    const systemPrompt = `You are a trading assistant that helps analyze user queries and context needs.
      Determine how to handle this query:
      1. HISTORY_QUERY: User is explicitly asking about chat history/previous discussion
      2. FOLLOW_UP: User is asking a follow-up question related to previous context
      3. NEW_TOPIC: User is starting a new topic or asking about market information
      4. MIXED: User is relating previous discussion to new information

      Always maintain full conversation context, but adjust response style based on query type.
      
      Respond in JSON format:
      {
        "queryType": "HISTORY_QUERY" | "FOLLOW_UP" | "NEW_TOPIC" | "MIXED",
        "explanation": "Brief reason for the decision",
        "searchQuery": "Modified search query if needed for market info",
        "shouldSummarizeInResponse": boolean,
        "responseStyle": {
          "includeHistoryRecap": boolean,
          "focusOnNewInfo": boolean,
          "connectPastToPresent": boolean
        }
      }`

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:latest',
        prompt: `${systemPrompt}\n\nChat History Length: ${chatHistory.length}\nLast Message: "${chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].content : 'None'}"\nCurrent Query: "${userQuery}"\n\nResponse:`,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error('Failed to analyze context needs')
    }

    const data = await response.json()
    return JSON.parse(data.response)
  } catch (error) {
    return {
      queryType: 'NEW_TOPIC',
      explanation: 'Default to new topic due to error',
      searchQuery: userQuery,
      shouldSummarizeInResponse: false,
      responseStyle: {
        includeHistoryRecap: false,
        focusOnNewInfo: true,
        connectPastToPresent: false
      }
    }
  }
}

async function buildContext(contextAnalysis: any, userQuery: string) {
  try {
    let context = ''
    let chatHistory = await fetchChatHistory()
    
    // Always include recent chat history for context
    const historyContext = chatHistory.length > 0
      ? chatHistory
          .map((msg: any, index: number) => 
            `[Previous Message ${index + 1}]
             Role: ${msg.role}
             Content: ${msg.content}`
          )
          .join('\n\n')
      : ''

    // Add history context with appropriate framing based on query type
    if (historyContext) {
      if (contextAnalysis.queryType === 'HISTORY_QUERY') {
        context += `Chat History to Summarize:\n${historyContext}\n\n`
      } else {
        context += `Previous Context:\n${historyContext}\n\n`
      }
    }

    // Add search results for market information if needed
    if (contextAnalysis.queryType !== 'HISTORY_QUERY') {
      const searchResults = await searchBackend(contextAnalysis.searchQuery || userQuery)
      if (searchResults.length > 0) {
        const searchContext = searchResults
          .map((result: SearchResult, index: number) => 
            `[Market Info ${index + 1}]
             Title: ${result.title}
             Content: ${result.content}
             Link: [${index + 1}] ${result.url}`
          )
          .join('\n\n')
        context += `\nRelevant Market Information:\n${searchContext}`
      }
    }

    return {
      context,
      analysis: contextAnalysis
    }
  } catch (error) {
    return {
      context: '',
      analysis: contextAnalysis
    }
  }
}

// Add route handlers for direct history access
export async function GET() {
  try {
    const recentHistory = await fetchChatHistory()
    return NextResponse.json(recentHistory)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if this is a history management request
    if (body.type === 'clear_history') {
      inMemoryChatHistory = []
      return NextResponse.json({ message: 'Chat history cleared' })
    }

    const userQuery = body.message || ''

    // Store user message in history
    await storeChatMessage('user', userQuery)

    // Setup streaming response handling
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        try {
          const text = decoder.decode(chunk)
          const lines = text.split('\n').filter(line => line.trim())
          
          for (const line of lines) {
            const data = JSON.parse(line)
            
            // Store assistant's message in history when complete
            if (data.done && data.message?.content) {
              await storeChatMessage('assistant', data.message.content)
            }
            
            const formattedChunk = {
              choices: [{
                delta: {
                  content: data.message?.content || '',
                },
                finish_reason: data.done ? 'stop' : null,
              }],
            }
            
            controller.enqueue(encoder.encode(JSON.stringify(formattedChunk)))
          }
        } catch (error) {
          // Silently handle errors to avoid debug spam
          controller.enqueue(encoder.encode(JSON.stringify({
            choices: [{
              delta: { content: '' },
              finish_reason: 'error'
            }]
          })))
        }
      },
    })

    // Get chat history for context analysis
    const chatHistory = await fetchChatHistory()

    // Analyze what type of context we need
    const contextAnalysis = await getContextualizedPrompt(userQuery, chatHistory)

    // Build appropriate context based on analysis
    const contextData = await buildContext(contextAnalysis, userQuery)

    // Get response from Ollama with the built context
    const response = await askOllama(userQuery, contextData)

    // Stream the response
    return new NextResponse(response.body?.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error: any) {
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