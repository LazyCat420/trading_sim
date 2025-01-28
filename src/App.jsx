import Layout from './components/Layout'
import AiChat from './components/AiChat'

function App() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">AI Chat</h1>
        <AiChat />
      </div>
    </Layout>
  )
}

export default App 