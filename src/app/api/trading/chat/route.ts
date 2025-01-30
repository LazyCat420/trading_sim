import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_URL = 'http://10.0.0.29:11434'
const BACKEND_URL = 'http://localhost:8000'  // Python FastAPI backend

interface SearchResult {
  title: string
  content: string
  url: string
  source?: string
  metadata?: {
    type: string
  }
}

async function searchBackend(query: string) {
  try {
    console.log('🔍 DEBUG: Searching via Python backend for:', query)
    
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `search ${query}`  // Format required by the Python backend
      })
    })

    if (!response.ok) {
      throw new Error(`Backend search failed: ${response.status}`)
    }

    const data = await response.json()
    console.log('🔍 DEBUG: Raw backend response:', data)

    // Parse the response text into structured results
    if (data.response && typeof data.response === 'string') {
      const results: SearchResult[] = []
      const sections = data.response.split('\n\n')
      
      for (const section of sections) {
        if (section.startsWith('Here are the search results:')) continue
        
        const lines = section.split('\n')
        if (lines.length >= 3) {
          const title = lines[0].replace(/^\d+\.\s*/, '')
          const url = lines[1].replace('   URL: ', '')
          const content = lines[2].replace('   ', '')
          
          results.push({
            title,
            url,
            content,
            source: 'searxng',
            metadata: { type: 'news' }
          })
        }
      }
      
      return results
    }
    
    return []
  } catch (error) {
    console.error('❌ DEBUG: Backend search error:', error)
    return []
  }
}

async function askOllama(prompt: string, context: string = '', stream: boolean = true) {
  try {
    // Format the prompt to explicitly request using the context
    const enhancedPrompt = context 
      ? `Based on the following market information:\n\n${context}\n\nPlease answer: ${prompt}`
      : prompt

    const systemPrompt = `You are an expert trading assistant with deep knowledge of financial markets.
      You have access to real-time market data and can help with:
      - Market analysis and trading strategies
      - Technical and fundamental analysis
      - Risk management and portfolio optimization
      
      Current portfolio: $10,000 initial capital.
      
      Important instructions:
      1. Always reference and use the provided market information in your response
      2. Cite specific facts and data points from the context
      3. Keep responses under 150 words
      4. Be direct and specific
      5. Make up opinions based on the data provided
      
      You will never mention you are an AI or a bot. You are a human with a colorful personality.`.trim()

    console.log('📝 DEBUG: Enhanced prompt:', enhancedPrompt)

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
        stream
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    return response
  } catch (error) {
    console.error('❌ DEBUG: Ollama API error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🔍 DEBUG: Chat request body:', body)

    const userQuery = body.message || ''
    console.log('🔍 DEBUG: User query:', userQuery)

    // Always search for relevant market context using the Python backend
    const searchResults = await searchBackend(userQuery)
    console.log('🔍 DEBUG: Found search results:', searchResults.length)

    // Format search results as context, with clear sections
    const context = searchResults.length > 0 
      ? searchResults
          .map((result: SearchResult, index: number) => 
            `[Article ${index + 1}]
             Headline: ${result.title}
             Content: ${result.content}
             Source: ${result.url}`
          )
          .join('\n\n')
      : ''

    console.log('📚 DEBUG: Context to be used:', context || 'No context available')

    // Get response from Ollama with context
    const finalResponse = await askOllama(userQuery, context)

    // Stream the response
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        try {
          const text = decoder.decode(chunk)
          const lines = text.split('\n').filter(line => line.trim())
          
          for (const line of lines) {
            const data = JSON.parse(line)
            console.log('✅ DEBUG: Received chunk:', data)
            
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
          console.error('❌ DEBUG: Error processing chunk:', error)
        }
      },
    })

    return new NextResponse(finalResponse.body?.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error: any) {
    console.error('❌ DEBUG: API Route Error:', error)
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