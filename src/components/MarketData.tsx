import React from 'react';
import { Card } from "@/components/ui/card";

interface MarketDataProps {
  data: {
    // Market Data
    marketCap: string;
    income: string;
    revenue: string;
    bookSh: string;
    cashSh: string;
    dividend: string;
    dividendYield: string;
    employees: number;

    // Trading Data
    price: number;
    volume: string;
    prevClose: number;
    change: number;

    // Valuation
    pe: number;
    forwardPE: number;
    peg: number;
    ps: number;
    pb: number;
    pc: number;
    pfcf: number;
    quickRatio: number;
    currentRatio: number;
    debtEq: number;

    // Growth & Performance
    eps: {
      ttm: number;
      nextY: number;
      nextQ: number;
      thisY: number;
      next5Y: number;
      past5Y: number;
      qoq: number;
    };
    salesGrowth: {
      past5Y: number;
      qoq: number;
    };

    // Technical Indicators
    rsi: number;
    relVolume: number;
    shortFloat: number;
    beta: number;
    sma20: number;
    sma50: number;
    sma200: number;
    targetPrice: number;
  };
}

const formatPercent = (value: number) => {
  const color = value >= 0 ? 'text-green-500' : 'text-red-500';
  return <span className={color}>{value.toFixed(2)}%</span>;
};

const formatNumber = (value: number | string, prefix: string = '') => {
  if (typeof value === 'string') return value;
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const DataRow = ({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className={`flex justify-between items-center p-2 border-b border-gray-700 ${className}`}>
    <span className="text-gray-400">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const MarketData: React.FC<MarketDataProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 text-sm">
      {/* Market Data */}
      <Card className="bg-gray-900 text-white p-4">
        <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Market Data</h3>
        <DataRow label="Market Cap" value={data.marketCap} />
        <DataRow label="Income" value={data.income} />
        <DataRow label="Revenue" value={data.revenue} />
        <DataRow label="Book/sh" value={formatNumber(data.bookSh)} />
        <DataRow label="Cash/sh" value={formatNumber(data.cashSh)} />
        <DataRow label="Dividend" value={`${data.dividend} (${data.dividendYield})`} />
        <DataRow label="Employees" value={data.employees.toLocaleString()} />
      </Card>

      {/* Valuation */}
      <Card className="bg-gray-900 text-white p-4">
        <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Valuation</h3>
        <DataRow label="P/E" value={formatNumber(data.pe)} />
        <DataRow label="Forward P/E" value={formatNumber(data.forwardPE)} />
        <DataRow label="PEG" value={formatNumber(data.peg)} />
        <DataRow label="P/S" value={formatNumber(data.ps)} />
        <DataRow label="P/B" value={formatNumber(data.pb)} />
        <DataRow label="P/C" value={formatNumber(data.pc)} />
        <DataRow label="P/FCF" value={formatNumber(data.pfcf)} />
      </Card>

      {/* Growth */}
      <Card className="bg-gray-900 text-white p-4">
        <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Growth</h3>
        <DataRow label="EPS (ttm)" value={formatNumber(data.eps.ttm, '$')} />
        <DataRow label="EPS next Y" value={formatPercent(data.eps.nextY)} />
        <DataRow label="EPS next Q" value={formatPercent(data.eps.nextQ)} />
        <DataRow label="EPS this Y" value={formatPercent(data.eps.thisY)} />
        <DataRow label="EPS next 5Y" value={formatPercent(data.eps.next5Y)} />
        <DataRow label="EPS past 5Y" value={formatPercent(data.eps.past5Y)} />
        <DataRow label="Sales Q/Q" value={formatPercent(data.salesGrowth.qoq)} />
      </Card>

      {/* Technical */}
      <Card className="bg-gray-900 text-white p-4">
        <h3 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Technical</h3>
        <DataRow label="RSI (14)" value={formatNumber(data.rsi)} />
        <DataRow label="Rel Volume" value={formatNumber(data.relVolume)} />
        <DataRow label="Short Float" value={formatPercent(data.shortFloat)} />
        <DataRow label="Beta" value={formatNumber(data.beta)} />
        <DataRow label="SMA20" value={formatPercent(data.sma20)} />
        <DataRow label="SMA50" value={formatPercent(data.sma50)} />
        <DataRow label="SMA200" value={formatPercent(data.sma200)} />
        <DataRow label="Target Price" value={formatNumber(data.targetPrice, '$')} />
      </Card>
    </div>
  );
};

export default MarketData; 
