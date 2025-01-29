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
  onExpand?: () => void
}

export function CollapsibleCard({ 
  title, 
  children, 
  className,
  defaultExpanded = false,
  onExpand 
}: CollapsibleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const handleExpand = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (newExpanded && onExpand) {
      onExpand();
    }
  };

  return (
    <Card className={className}>
      <CardHeader 
        className="flex flex-row items-center justify-between space-y-0 p-4 cursor-pointer"
        onClick={handleExpand}
      >
        {title}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleExpand();
          }}
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
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 p-0"
        )}
      >
        {children}
      </CardContent>
    </Card>
  )
} 