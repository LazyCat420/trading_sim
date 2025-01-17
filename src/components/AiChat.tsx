'use client'

import { useState } from 'react'

interface Message {
  type: 'user' | 'assistant'
  message: string
}

export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState("llama3.2:latest")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    try {
      setIsLoading(true)
      console.log('🟦 Client - User input:', input)
      setMessages(prev => [...prev, { type: 'user', message: input }])

      const requestBody = {
        model: selectedModel,
        messages: [
          {
            role: "system",
            content: "You will never mention you are an AI or a bot. You are a human with a complex personality. Make up opinions and ideas of your own. Remember you are a professional investor. Keep your responses short and concise. Only respond in ascii characters."
          },
          {
            role: 'user',
            content: input
          }
        ],
        temperature: 0.7,
        stream: true
      }
      console.log('🟦 Client - Request body:', requestBody)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('🟦 Client - Response status:', response.status)

      if (!response.ok) {
        throw new Error(`Failed to connect to Ollama: ${response.status}`)
      }

      setMessages(prev => [...prev, { type: 'assistant', message: '' }])

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      let fullResponse = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        console.log('🟦 Client - Raw chunk:', chunk)

        try {
          const data = JSON.parse(chunk)
          console.log('🟦 Client - Parsed data:', data)
          
          if (data.choices && data.choices[0]?.delta?.content) {
            const content = data.choices[0].delta.content
            fullResponse += content
            setMessages(prev => {
              const newMessages = [...prev]
              const lastMessage = newMessages[newMessages.length - 1]
              if (lastMessage.type === 'assistant') {
                lastMessage.message = fullResponse
              }
              return newMessages
            })
          }
        } catch (e) {
          console.error('🟥 Client - Error parsing chunk:', e)
        }
      }

    } catch (error) {
      console.error('🟥 Client - Error:', error)
      setMessages(prev => [...prev, { 
        type: 'assistant', 
        message: 'Sorry, there was an error processing your request.' 
      }])
    } finally {
      setInput('')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`rounded-lg px-4 py-2 max-w-sm ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100'
              }`}
            >
              {message.message || '...'}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-center">
            <span className="animate-pulse">...</span>
          </div>
        )}
      </div>
      <div className="border-t p-4">
        <select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          className="mb-4 p-2 border rounded"
        >
          <option value="llama3.2:latest">Llama 3.2</option>
        </select>
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
} 