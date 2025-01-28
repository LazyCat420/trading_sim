'use client'

import { useState } from 'react'

interface Message {
  type: 'user' | 'assistant'
  message: string
  links?: {
    url: string
    title?: string
    image?: string
  }[]
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

      const isSearchRequest = input.trim().toLowerCase().startsWith('search')
      let requestBody

      if (isSearchRequest) {
        requestBody = {
          messages: [{ role: 'user', content: input }]
        }
      } else {
        const chatHistory = messages.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.message
        }))

        requestBody = {
          model: selectedModel,
          messages: [
            {
              role: "system",
              content: "You will never mention you are an AI or a bot. You are a human with a colorful personality. Make up opinions and ideas of your own. You are a helpful assistant who will respond in 150 words or less."
            },
            ...chatHistory,
            {
              role: 'user',
              content: input
            }
          ],
          temperature: 0.7,
          stream: true
        }
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
        throw new Error(`Request failed with status: ${response.status}`)
      }

      setMessages(prev => [...prev, { type: 'assistant', message: '' }])

      if (isSearchRequest) {
        const result = await response.json()
        setMessages(prev => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage.type === 'assistant') {
            lastMessage.message = result.choices[0].message.content
          }
          return newMessages
        })
        return
      }

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

      const { processedMessage, links } = processMessageContent(fullResponse)
      setMessages(prev => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage.type === 'assistant') {
          lastMessage.message = processedMessage
          lastMessage.links = links
        }
        return newMessages
      })

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
    <div className="chatbox flex flex-col h-[600px]">
      <div className="chatbox-body">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`message ${
                message.type === 'user'
                  ? 'message-user'
                  : 'message-assistant'
              }`}
            >
              <MessageContent content={message.message || '...'} />
              {message.links && message.links.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-gray-200 pt-2">
                  {message.links.map((link, linkIndex) => (
                    <div key={linkIndex} className="flex flex-col space-y-2">
                      <div 
                        className={`
                          text-sm p-2 rounded-md transition-all cursor-pointer
                          ${message.type === 'user' 
                            ? 'text-white hover:bg-blue-600 active:bg-blue-700' 
                            : 'text-blue-600 hover:bg-blue-50 active:bg-blue-100'
                          }
                          hover:scale-[1.02] active:scale-[0.98]
                          flex items-center gap-2
                        `}
                        onClick={() => {
                          if (link.url) {
                            window.open(link.url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <span className="inline-flex items-center justify-center bg-opacity-20 rounded-full h-5 w-5 text-xs font-medium bg-current">
                          {linkIndex + 1}
                        </span>
                        <span className="flex-1 break-all">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="link">
                            {link.title || link.url}
                          </a>
                        </span>
                        <svg className="w-4 h-4 flex-shrink-0 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                      {link.image && (
                        <div 
                          className="mt-1 rounded-md overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                          onClick={() => {
                            if (link.url) {
                              window.open(link.url, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        >
                          <img
                            src={link.image}
                            alt="Link preview"
                            className="w-full max-w-[200px] h-auto object-cover hover:opacity-90 transition-opacity"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-center">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <span className="inline-block animate-bounce">•</span>
              <span className="inline-block animate-bounce delay-100">•</span>
              <span className="inline-block animate-bounce delay-200">•</span>
            </div>
          </div>
        )}
      </div>
      <div className="chatbox-footer">
        <select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          className="mb-4 p-2 border rounded-lg w-full md:w-auto text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="llama3.2:latest">Llama 3.2</option>
        </select>
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-blue-500 px-6 py-2 text-white font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

const MessageContent = ({ content }: { content: string }) => {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const parts = content.split(urlRegex);
  
  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          const cleanUrl = part.trim().replace(/[.,;]$/, '');
          return (
            <a
              key={i}
              href={cleanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 underline"
              onClick={(e) => {
                e.preventDefault();
                window.open(cleanUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              {cleanUrl}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

const processMessageContent = (message: string) => {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const urls = message.match(urlRegex) || [];
  
  return { 
    processedMessage: message,
    links: urls.map(url => ({ 
      url: url.trim().replace(/[.,;]$/, ''),
      title: url.trim().replace(/[.,;]$/, '') 
    }))
  };
}; 