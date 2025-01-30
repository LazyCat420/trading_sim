"use client"

import { useRef, useState, useEffect } from 'react'
import { useChat } from '@/contexts/ChatContext'
import { FiSend, FiMinimize2, FiMaximize2 } from 'react-icons/fi'

interface Message {
  id: string
  type: 'system' | 'bot' | 'user'
  content: string
  timestamp: Date
  metadata?: any
}

export default function GlobalChat() {
  const { messages, addMessage, updateMessage, isProcessing, setIsProcessing } = useChat()
  const [input, setInput] = useState('')
  const [currentResponse, setCurrentResponse] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    try {
      console.log('🔍 DEBUG: Sending message:', input)
      
      // Add user message
      const userMessageId = Date.now().toString()
      addMessage('user', input, { id: userMessageId })
      
      // Add initial bot message
      const botMessageId = (Date.now() + 1).toString()
      addMessage('bot', '', { id: botMessageId })
      
      setInput('')
      setIsProcessing(true)
      setCurrentResponse('')

      // Send to backend for processing
      const response = await fetch('/api/trading/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input
        })
      })

      console.log('🔍 DEBUG: Response status:', response.status)

      if (!response.ok) {
        const error = await response.text()
        console.error('❌ DEBUG: Chat error:', error)
        throw new Error('Failed to get response')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Decode and process chunks
        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            console.log('✅ DEBUG: Received chunk:', data)

            if (data.choices?.[0]?.delta?.content) {
              const content = data.choices[0].delta.content
              fullResponse += content
              setCurrentResponse(fullResponse)

              // Update the existing bot message
              updateMessage(botMessageId, fullResponse)
              scrollToBottom()
            }
          } catch (error) {
            console.error('❌ DEBUG: Error parsing chunk:', error)
          }
        }
      }

      scrollToBottom()

    } catch (error) {
      console.error('❌ DEBUG: Chat error:', error)
      addMessage('system', 'Sorry, I encountered an error processing your request.', { id: Date.now().toString() })
    } finally {
      setIsProcessing(false)
      setCurrentResponse('')
      scrollToBottom()
    }
  }

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className={`fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg 
      ${isCollapsed ? 'w-16 h-16' : 'w-[600px] h-[600px]'} 
      transition-all duration-300 ease-in-out z-50`}>
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
        {!isCollapsed && <h2 className="text-lg font-semibold">Trading Assistant</h2>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
        >
          {isCollapsed ? <FiMaximize2 /> : <FiMinimize2 />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 h-[480px] scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.type === 'system'
                      ? 'bg-yellow-100 dark:bg-yellow-900'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  <div className="prose dark:prose-invert max-w-none">
                    {message.content.split('\n').map((line, i) => {
                      // Check if the line is a source link
                      if (line.trim().startsWith('[') && line.includes(']')) {
                        const matches = line.match(/\[(\d+)\]\s+(.+)/)
                        if (matches) {
                          const [_, number, url] = matches
                          return (
                            <p key={i} className="mb-1 last:mb-0">
                              <a 
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 dark:text-blue-400 hover:underline"
                              >
                                [{number}] Source
                              </a>
                            </p>
                          )
                        }
                      }
                      return (
                        <p key={i} className="mb-1 last:mb-0">
                          {line}
                        </p>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about market trends, trading strategies..."
                className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                disabled={isProcessing}
              />
              <button
                type="submit"
                disabled={isProcessing}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                <FiSend className="w-5 h-5" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
} 