"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

interface Message {
  id: string
  type: 'system' | 'bot' | 'user'
  content: string
  timestamp: Date
  metadata?: any
}

interface ChatContextType {
  messages: Message[]
  addMessage: (type: Message['type'], content: string, metadata?: any) => void
  updateMessage: (id: string, content: string) => void
  clearMessages: () => void
  isProcessing: boolean
  setIsProcessing: (value: boolean) => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    // Add initial system message
    addMessage('system', 'Trading Assistant initialized. Ready to help!')
  }, [])

  const addMessage = (type: Message['type'], content: string, metadata?: any) => {
    const newMessage: Message = {
      id: metadata?.id || Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      metadata
    }
    setMessages(prev => [...prev, newMessage])
  }

  const updateMessage = (id: string, content: string) => {
    setMessages(prev => prev.map(message => 
      message.metadata?.id === id ? { ...message, content } : message
    ))
  }

  const clearMessages = () => {
    setMessages([])
    addMessage('system', 'Chat history cleared.')
  }

  return (
    <ChatContext.Provider 
      value={{ 
        messages, 
        addMessage,
        updateMessage,
        clearMessages,
        isProcessing,
        setIsProcessing
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
} 