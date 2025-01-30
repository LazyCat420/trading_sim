"use client"

import { ThemeProvider } from '@/components/theme-provider'
import { ChatProvider } from '@/contexts/ChatContext'
import { GlobalChat } from '@/components/GlobalChat'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ChatProvider>
        {children}
        <GlobalChat />
      </ChatProvider>
    </ThemeProvider>
  )
} 