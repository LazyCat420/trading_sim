from typing import Dict, List, Optional
from datetime import datetime
import logging
import numpy as np
import pandas as pd
import yfinance as yf

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StrategyManager:
    def __init__(self):
        self.strategies = {
            'value_investing': self.value_strategy,
            'growth_hunting': self.growth_strategy,
            'quantitative_edge': self.quant_strategy
        }
        
    def get_current_price(self, symbol: str) -> float:
        """Get the current price of a stock"""
        try:
            stock = yf.Ticker(symbol)
            info = stock.info
            return info.get('currentPrice', info.get('regularMarketPrice', 0))
        except Exception as e:
            logger.error(f"Error getting current price for {symbol}: {e}")
            return 0
        
    def value_strategy(self, stock_data: Dict) -> Dict:
        """
        Value Investing Strategy (Graham/Buffett):
        - P/E < 15
        - P/B < 1.5
        - D/E < 0.3
        """
        try:
            signals = {
                'pe_ratio': stock_data['valuation']['pe'] < 15,
                'pb_ratio': stock_data['valuation']['pb'] < 1.5,
                'de_ratio': stock_data['valuation']['debtEq'] < 0.3
            }
            
            confidence = sum(signals.values()) / len(signals)
            
            return {
                'strategy': 'value_investing',
                'signals': signals,
                'confidence': confidence,
                'recommendation': 'buy' if confidence >= 0.7 else 'hold'
            }
            
        except Exception as e:
            logger.error(f"Error in value strategy: {e}")
            return {
                'strategy': 'value_investing',
                'signals': {},
                'confidence': 0,
                'recommendation': 'hold'
            }
    
    def growth_strategy(self, stock_data: Dict) -> Dict:
        """
        Growth Hunting Strategy (Lynch):
        - EPS Growth > 25%
        - ROE > 15%
        - Focus on Consumer/Tech sectors
        """
        try:
            growth_sectors = ['Technology', 'Consumer Cyclical', 'Consumer Defensive']
            
            signals = {
                'eps_growth': stock_data['growth']['eps']['next5Y'] > 25,
                'sector_match': stock_data['marketData'].get('sector', '') in growth_sectors,
                'high_growth': stock_data['growth']['eps']['nextY'] > stock_data['growth']['eps']['past5Y']
            }
            
            confidence = sum(signals.values()) / len(signals)
            
            return {
                'strategy': 'growth_hunting',
                'signals': signals,
                'confidence': confidence,
                'recommendation': 'buy' if confidence >= 0.7 else 'hold'
            }
            
        except Exception as e:
            logger.error(f"Error in growth strategy: {e}")
            return {
                'strategy': 'growth_hunting',
                'signals': {},
                'confidence': 0,
                'recommendation': 'hold'
            }
    
    def quant_strategy(self, stock_data: Dict) -> Dict:
        """
        Quantitative Edge Strategy:
        - Statistical arbitrage
        - Technical indicators
        - Volume analysis
        """
        try:
            signals = {
                'rsi_oversold': stock_data['technical']['rsi'] < 30,
                'volume_surge': stock_data['technical']['relVolume'] > 2,
                'trend_following': all([
                    stock_data['technical']['sma20'] > 0,
                    stock_data['technical']['sma50'] > 0,
                    stock_data['technical']['sma200'] > 0
                ])
            }
            
            confidence = sum(signals.values()) / len(signals)
            
            return {
                'strategy': 'quantitative_edge',
                'signals': signals,
                'confidence': confidence,
                'recommendation': 'buy' if confidence >= 0.7 else 'hold'
            }
            
        except Exception as e:
            logger.error(f"Error in quant strategy: {e}")
            return {
                'strategy': 'quantitative_edge',
                'signals': {},
                'confidence': 0,
                'recommendation': 'hold'
            }
    
    def analyze_stock(self, symbol: str, strategy_name: str = None) -> Dict:
        """
        Analyze a stock using one or all strategies
        """
        try:
            # Fetch stock data
            stock = yf.Ticker(symbol)
            stock_data = stock.info
            
            if strategy_name and strategy_name in self.strategies:
                return self.strategies[strategy_name](stock_data)
            
            # Run all strategies
            results = {}
            for name, strategy in self.strategies.items():
                results[name] = strategy(stock_data)
                
            return results
            
        except Exception as e:
            logger.error(f"Error analyzing stock {symbol}: {e}")
            return {} 