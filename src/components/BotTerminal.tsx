import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Message {
  type: 'system' | 'bot'
  content: string
  timestamp: Date
}

interface BotTerminalProps {
  isAutomated: boolean
  automatedStatus: any
}

export function BotTerminal({ isAutomated, automatedStatus }: BotTerminalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Add initial system message
    setMessages([
      {
        type: 'system',
        content: 'Trading Bot Terminal initialized. Ready for operation.',
        timestamp: new Date()
      }
    ])
  }, [])

  useEffect(() => {
    if (isAutomated) {
      addMessage('system', 'Bot started. Analyzing market conditions...')
      summarizeStatus()
    } else {
      addMessage('system', 'Bot stopped. All automated operations ceased.')
    }
  }, [isAutomated])

  useEffect(() => {
    if (automatedStatus && isAutomated) {
      summarizeStatus()
    }
  }, [automatedStatus])

  const addMessage = async (type: 'system' | 'bot', content: string) => {
    const newMessage = {
      type,
      content,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, newMessage])
    
    // Scroll to bottom
    if (scrollAreaRef.current) {
      setTimeout(() => {
        scrollAreaRef.current?.scrollTo({
          top: scrollAreaRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
    }
  }

  const summarizeStatus = async () => {
    if (!automatedStatus) return

    try {
      const response = await fetch('/api/trading/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: automatedStatus,
          prompt: "Summarize the current trading bot status and provide insights"
        })
      })

      if (!response.ok) throw new Error('Failed to get summary')
      
      const data = await response.json()
      addMessage('bot', data.summary)
    } catch (error) {
      console.error('Error getting summary:', error)
      addMessage('system', 'Failed to generate status summary')
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Bot Terminal</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] w-full rounded-md border p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex flex-col space-y-1 ${
                  message.type === 'bot' ? 'text-blue-500' : 'text-green-500'
                }`}
              >
                <div className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString()}
                </div>
                <div className="font-mono text-sm">
                  {message.type === 'bot' ? '🤖 ' : '🔧 '}
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
} 