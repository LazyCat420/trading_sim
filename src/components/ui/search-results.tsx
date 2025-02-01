import { Card } from "./card"
import { ScrollArea } from "./scroll-area"

interface SearchResult {
  title: string
  content: string
  url: string
  source?: string
  metadata?: {
    type: string
  }
}

interface SearchResultsProps {
  results: SearchResult[]
  isLoading?: boolean
  error?: string
}

export function SearchResults({ results, isLoading, error }: SearchResultsProps) {
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center">
          <span className="animate-pulse">Loading search results...</span>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4">
        <div className="text-red-500">
          Error: {error}
        </div>
      </Card>
    )
  }

  if (!results.length) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">
          No results found
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-4">
          {results.map((result, index) => (
            <div key={index} className="border-b border-gray-200 pb-4 last:border-0">
              <h3 className="font-medium mb-1">
                <a 
                  href={result.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {result.title}
                </a>
              </h3>
              <p className="text-sm text-gray-600 mb-1">{result.content}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{result.source || 'searxng'}</span>
                {result.metadata?.type && (
                  <>
                    <span>•</span>
                    <span>{result.metadata.type}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
} 