import StockDashboard from '@/components/StockDashboard'
import AiChat from '@/components/AiChat'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <StockDashboard />
      <AiChat />
    </main>
  )
} 