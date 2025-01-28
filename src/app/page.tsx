import StockDashboard from '@/components/StockDashboard'
import AiChat from '@/components/AiChat'

export default function Home() {
  return (
    <main className="min-h-screen p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <AiChat />
        <StockDashboard />
      </div>
    </main>
  )
} 