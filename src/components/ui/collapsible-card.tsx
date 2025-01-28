import React, { useState } from 'react'
import { Card, CardHeader, CardContent } from './card'
import { Button } from './button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleCardProps {
  title: React.ReactNode
  children: React.ReactNode
  className?: string
  defaultExpanded?: boolean
}

export function CollapsibleCard({ 
  title, 
  children, 
  className,
  defaultExpanded = true 
}: CollapsibleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        {title}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 w-8"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent
        className={cn(
          "grid transition-all",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </CardContent>
    </Card>
  )
} 