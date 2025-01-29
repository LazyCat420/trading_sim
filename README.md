# 🚧 UNDER CONSTRUCTION 🚧

# Trading Simulator

A web application for simulating stock trading with real-time data using yfinance.

## Features

- Real-time stock price data
- Historical price charts (daily, weekly, monthly, yearly, 5-year, and 10-year views)
- Dividend history tracking
- Similar stocks suggestions
- 52-week high and low tracking

## Prerequisites

- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd trading_sim
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

## Running the Application

1. Start the backend server:
```bash
cd backend
uvicorn stock_api:app --reload --port 8000
```

2. In a new terminal, start the frontend development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API Endpoints

- `GET /stock/{symbol}` - Get current stock information
- `GET /stock/history/{symbol}` - Get historical price data
- `GET /stock/dividends/{symbol}` - Get dividend history
- `GET /stock/similar/{symbol}` - Get similar stocks

## Technologies Used

- Frontend:
  - Next.js
  - React
  - Chart.js
  - Tailwind CSS
  - shadcn/ui

- Backend:
  - FastAPI
  - yfinance
  - pandas

## License

MIT
