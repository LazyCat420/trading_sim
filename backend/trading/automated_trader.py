from typing import Dict, List, Optional
import asyncio
import logging
from datetime import datetime, timedelta
import yfinance as yf
from .bot_manager import TradingBot
from .strategy_manager import StrategyManager

logger = logging.getLogger(__name__)

class AutomatedTrader:
    def __init__(self, bot: TradingBot, initial_symbols: List[str] = None):
        self.bot = bot
        self.strategy_manager = StrategyManager()
        self.is_running = False
        self.watched_symbols = initial_symbols or []
        self.last_analysis = {}
        self.trading_task = None
        
    async def start_trading(self):
        """Start the automated trading loop"""
        if self.is_running:
            return
            
        self.is_running = True
        self.trading_task = asyncio.create_task(self._trading_loop())
        logger.info("Automated trading started")
        
    async def stop_trading(self):
        """Stop the automated trading loop"""
        self.is_running = False
        if self.trading_task:
            self.trading_task.cancel()
            try:
                await self.trading_task
            except asyncio.CancelledError:
                pass
        logger.info("Automated trading stopped")
        
    async def _trading_loop(self):
        """Main trading loop that runs strategies and executes trades"""
        while self.is_running:
            try:
                # Update watchlist based on market conditions
                await self._update_watchlist()
                
                # Analyze each symbol and execute trades
                for symbol in self.watched_symbols:
                    await self._analyze_and_trade(symbol)
                    
                # Sleep for the interval (5 minutes)
                await asyncio.sleep(300)  # 5 minutes
                
            except Exception as e:
                logger.error(f"Error in trading loop: {e}")
                await asyncio.sleep(60)  # Wait a minute before retrying
                
    async def _update_watchlist(self):
        """Update the watchlist based on market conditions"""
        try:
            # Get market indices for overall market sentiment
            indices = ['^GSPC', '^DJI', '^IXIC']  # S&P 500, Dow, NASDAQ
            market_data = {}
            
            for index in indices:
                ticker = yf.Ticker(index)
                info = ticker.info
                market_data[index] = {
                    'price': info.get('regularMarketPrice', 0),
                    'change': info.get('regularMarketChangePercent', 0)
                }
                
            # Adjust watchlist based on market conditions
            if all(data['change'] > 0 for data in market_data.values()):
                # Bullish market - focus on growth stocks
                await self._scan_growth_stocks()
            elif all(data['change'] < -1 for data in market_data.values()):
                # Bearish market - focus on value stocks
                await self._scan_value_stocks()
            else:
                # Mixed market - use quantitative approach
                await self._scan_technical_setups()
                
        except Exception as e:
            logger.error(f"Error updating watchlist: {e}")
            
    async def _scan_growth_stocks(self):
        """Scan for growth stocks meeting criteria"""
        try:
            # Implement growth scanning logic based on rules
            growth_candidates = []
            # Add scanning logic here
            self.watched_symbols = growth_candidates[:10]  # Keep top 10
        except Exception as e:
            logger.error(f"Error scanning growth stocks: {e}")
            
    async def _scan_value_stocks(self):
        """Scan for value stocks meeting criteria"""
        try:
            # Implement value scanning logic based on rules
            value_candidates = []
            # Add scanning logic here
            self.watched_symbols = value_candidates[:10]  # Keep top 10
        except Exception as e:
            logger.error(f"Error scanning value stocks: {e}")
            
    async def _scan_technical_setups(self):
        """Scan for stocks with strong technical setups"""
        try:
            # Implement technical scanning logic based on rules
            technical_candidates = []
            # Add scanning logic here
            self.watched_symbols = technical_candidates[:10]  # Keep top 10
        except Exception as e:
            logger.error(f"Error scanning technical setups: {e}")
            
    async def _analyze_and_trade(self, symbol: str):
        """Analyze a symbol and execute trades based on strategies"""
        try:
            # Get current position if any
            positions = self.bot.get_active_positions()
            current_position = positions.get(symbol)
            
            # Run analysis
            analysis = self.strategy_manager.analyze_stock(symbol)
            self.last_analysis[symbol] = {
                'timestamp': datetime.now(),
                'data': analysis
            }
            
            # Calculate overall confidence
            total_confidence = sum(
                strat['confidence'] for strat in analysis.values()
            ) / len(analysis)
            
            # Get current price
            current_price = self.strategy_manager.get_current_price(symbol)
            
            # Execute trades based on analysis
            if not current_position and total_confidence >= 0.7:
                # Calculate position size based on Kelly Criterion
                portfolio_value = self.bot.get_portfolio_value()
                position_size = self._calculate_position_size(
                    portfolio_value,
                    total_confidence,
                    current_price
                )
                
                if position_size > 0:
                    self.bot.place_order(
                        symbol=symbol,
                        order_type='buy',
                        quantity=position_size,
                        price=current_price
                    )
                    
            elif current_position and total_confidence < 0.3:
                # Exit position
                self.bot.place_order(
                    symbol=symbol,
                    order_type='sell',
                    quantity=current_position['quantity'],
                    price=current_price
                )
                
        except Exception as e:
            logger.error(f"Error analyzing and trading {symbol}: {e}")
            
    def _calculate_position_size(
        self,
        portfolio_value: float,
        confidence: float,
        price: float
    ) -> float:
        """Calculate position size using Kelly Criterion"""
        try:
            # Implement Kelly Criterion with safety factor
            kelly_fraction = confidence * 0.5  # Using 50% of Kelly for safety
            max_position = portfolio_value * kelly_fraction
            
            # Calculate number of shares
            shares = int(max_position / price)
            
            # Ensure position size is reasonable
            max_shares = int(portfolio_value * 0.2 / price)  # Max 20% of portfolio
            return min(shares, max_shares)
            
        except Exception as e:
            logger.error(f"Error calculating position size: {e}")
            return 0
            
    def get_status(self) -> Dict:
        """Get current status of the automated trader"""
        return {
            'is_running': self.is_running,
            'watched_symbols': self.watched_symbols,
            'last_analysis': self.last_analysis,
            'portfolio': self.bot.get_portfolio_summary()
        } 