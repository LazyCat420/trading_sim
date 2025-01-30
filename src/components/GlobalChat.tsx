"use client"

import React, { useRef, useState, useCallback } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useChat } from '@/contexts/ChatContext'
import { cn } from "@/lib/utils"

interface Message {
  id: string
  type: 'system' | 'bot' | 'user'
  content: string
  timestamp: Date
  metadata?: any
}

export function GlobalChat() {
  const { messages, addMessage, updateMessage, isProcessing, setIsProcessing } = useChat()
  const [input, setInput] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [currentResponse, setCurrentResponse] = useState('')

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
    if (scrollAreaRef.current) {
      setTimeout(() => {
        scrollAreaRef.current?.scrollTo({
          top: scrollAreaRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[600px] shadow-lg">
      <Tabs defaultValue="chat">
        <div className="flex justify-between items-center p-2 border-b">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="updates">Bot Updates</TabsTrigger>
          </TabsList>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={() => inputRef.current?.focus()}
          >
            <span className="sr-only">Focus input</span>
            📝
          </Button>
        </div>

        <TabsContent value="chat" className="mt-0">
          <CardContent className="p-0 flex flex-col h-[540px]">
            <ScrollArea 
              className="flex-1 p-4 border-b" 
              ref={scrollAreaRef}
            >
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.metadata?.id || `${message.type}-${message.timestamp.getTime()}`}
                    className={cn(
                      "flex flex-col space-y-1",
                      message.type === 'user' && "items-end",
                      message.type === 'bot' && "items-start",
                      message.type === 'system' && "items-center"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 max-w-[80%] break-words",
                        message.type === 'user' && "bg-primary text-primary-foreground",
                        message.type === 'bot' && "bg-muted",
                        message.type === 'system' && "bg-secondary text-secondary-foreground text-sm"
                      )}
                    >
                      {message.type === 'bot' && '🤖 '}
                      {message.type === 'system' && '🔧 '}
                      {message.content}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
                {isProcessing && !currentResponse && (
                  <div className="flex justify-center">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                )}
              </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="p-4 flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Ask me about trading strategies..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isProcessing}
              />
              <Button type="submit" disabled={isProcessing}>
                Send
              </Button>
            </form>
          </CardContent>
        </TabsContent>

        <TabsContent value="updates" className="mt-0">
          <CardContent className="p-4 h-[540px]">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {messages
                  .filter(m => m.type === 'system' || (m.type === 'bot' && m.metadata?.isUpdate))
                  .map((message) => (
                    <div 
                      key={message.metadata?.id || `${message.type}-${message.timestamp.getTime()}`} 
                      className="space-y-1"
                    >
                      <div className={cn(
                        "rounded-lg px-3 py-2",
                        message.type === 'system' ? "bg-secondary" : "bg-muted"
                      )}>
                        {message.content}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  )
} 