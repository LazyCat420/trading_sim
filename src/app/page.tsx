import StockDashboard from '@/components/StockDashboard'
import TradingBotDashboard from '@/components/TradingBotDashboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-8">Trading Simulator</h1>
      
      <Tabs defaultValue="market" className="space-y-4">
        <TabsList>
          <TabsTrigger value="market">Market Data</TabsTrigger>
          <TabsTrigger value="bot">Trading Bot</TabsTrigger>
        </TabsList>
        
        <TabsContent value="market" className="space-y-4">
          <StockDashboard />
        </TabsContent>
        
        <TabsContent value="bot" className="space-y-4">
          <TradingBotDashboard />
        </TabsContent>
      </Tabs>
    </main>
  )
} 