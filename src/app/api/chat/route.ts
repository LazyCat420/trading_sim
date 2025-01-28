import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const message = body.messages[body.messages.length - 1].content.toLowerCase()
    
    // Check if this is a search request
    if (message.startsWith('search')) {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: message }),
      })

      if (!response.ok) {
        throw new Error(`Search API error: ${response.status}`)
      }

      const searchResult = await response.json()
      
      // Return the search results in the chat format
      return NextResponse.json({
        choices: [{
          message: {
            content: searchResult.response || searchResult.error,
          },
        }],
      })
    }
    
    // If not a search request, proceed with Ollama chat
    const response = await fetch('http://10.0.0.29:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    // Create a TransformStream to process the response
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        try {
          const text = decoder.decode(chunk)
          const lines = text.split('\n').filter(line => line.trim())
          
          for (const line of lines) {
            const data = JSON.parse(line)
            
            // Format the response to match OpenAI's streaming format
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
          console.error('Error processing chunk:', error)
        }
      },
    })

    return new NextResponse(response.body?.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('API Route Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 