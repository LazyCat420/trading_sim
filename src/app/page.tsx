import AiChat from '@/components/AiChat'

export default function Home() {
  return (
    <main className="min-h-screen p-6 bg-gray-100">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">AI Chat</h1>
        <AiChat />
      </div>
    </main>
  )
} 