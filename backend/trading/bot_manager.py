from typing import Dict, List, Optional
from datetime import datetime
import logging
from .strategy_manager import StrategyManager

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TradingBot:
    def __init__(self, initial_balance: float = 100000):
        self.strategy_manager = StrategyManager()
        self.initial_balance = initial_balance
        self.cash_balance = initial_balance
        self.positions = {}  # symbol -> {quantity, avg_price}
        self.trade_history = []
        self.active_orders = []
        
    def get_portfolio_value(self) -> float:
        """Calculate total portfolio value including cash and positions"""
        total_value = self.cash_balance
        for symbol, position in self.positions.items():
            try:
                current_price = self.strategy_manager.get_current_price(symbol)
                position_value = position['quantity'] * current_price
                total_value += position_value
            except Exception as e:
                logger.error(f"Error calculating position value for {symbol}: {e}")
        return total_value
        
    def analyze_position(self, symbol: str) -> Dict:
        """Analyze a stock using all strategies"""
        try:
            analysis = self.strategy_manager.analyze_stock(symbol)
            
            # Combine strategy signals
            overall_confidence = sum(
                strat['confidence'] for strat in analysis.values()
            ) / len(analysis)
            
            # Get position details if we hold the stock
            position = self.positions.get(symbol, {})
            quantity = position.get('quantity', 0)
            avg_price = position.get('avg_price', 0)
            
            return {
                'symbol': symbol,
                'analysis': analysis,
                'overall_confidence': overall_confidence,
                'position': {
                    'quantity': quantity,
                    'avg_price': avg_price,
                    'market_value': quantity * self.strategy_manager.get_current_price(symbol)
                }
            }
        except Exception as e:
            logger.error(f"Error analyzing position {symbol}: {e}")
            return {}
            
    def place_order(self, symbol: str, order_type: str, quantity: float, price: float) -> Dict:
        """Place a new trade order"""
        try:
            order = {
                'symbol': symbol,
                'type': order_type,
                'quantity': quantity,
                'price': price,
                'status': 'pending',
                'timestamp': datetime.now(),
                'id': len(self.trade_history) + 1
            }
            
            # Check if we can afford the trade
            if order_type == 'buy':
                cost = quantity * price
                if cost > self.cash_balance:
                    return {'error': 'Insufficient funds'}
                    
            # Check if we have enough shares to sell
            elif order_type == 'sell':
                position = self.positions.get(symbol, {'quantity': 0})
                if quantity > position['quantity']:
                    return {'error': 'Insufficient shares'}
                    
            # Add to active orders
            self.active_orders.append(order)
            
            # Execute order immediately (in real system would be async)
            self.execute_order(order)
            
            return order
            
        except Exception as e:
            logger.error(f"Error placing order: {e}")
            return {'error': str(e)}
            
    def execute_order(self, order: Dict) -> None:
        """Execute a trade order"""
        try:
            symbol = order['symbol']
            quantity = order['quantity']
            price = order['price']
            
            if order['type'] == 'buy':
                # Update cash balance
                self.cash_balance -= quantity * price
                
                # Update position
                if symbol in self.positions:
                    # Average down/up
                    current_quantity = self.positions[symbol]['quantity']
                    current_avg_price = self.positions[symbol]['avg_price']
                    new_quantity = current_quantity + quantity
                    new_avg_price = (
                        (current_quantity * current_avg_price + quantity * price)
                        / new_quantity
                    )
                    self.positions[symbol] = {
                        'quantity': new_quantity,
                        'avg_price': new_avg_price
                    }
                else:
                    # New position
                    self.positions[symbol] = {
                        'quantity': quantity,
                        'avg_price': price
                    }
                    
            elif order['type'] == 'sell':
                # Update cash balance
                self.cash_balance += quantity * price
                
                # Update position
                current_quantity = self.positions[symbol]['quantity']
                if current_quantity == quantity:
                    # Full position sold
                    del self.positions[symbol]
                else:
                    # Partial sale
                    self.positions[symbol]['quantity'] = current_quantity - quantity
                    
            # Update order status
            order['status'] = 'executed'
            order['executed_at'] = datetime.now()
            
            # Add to trade history
            self.trade_history.append(order)
            
            # Remove from active orders
            self.active_orders = [o for o in self.active_orders if o['id'] != order['id']]
            
        except Exception as e:
            logger.error(f"Error executing order: {e}")
            order['status'] = 'failed'
            order['error'] = str(e)
            
    def get_trade_history(self) -> List[Dict]:
        """Get all historical trades"""
        return self.trade_history
        
    def get_active_positions(self) -> Dict:
        """Get current positions with market values"""
        active_positions = {}
        for symbol, position in self.positions.items():
            try:
                current_price = self.strategy_manager.get_current_price(symbol)
                market_value = position['quantity'] * current_price
                unrealized_pl = market_value - (position['quantity'] * position['avg_price'])
                
                active_positions[symbol] = {
                    **position,
                    'market_value': market_value,
                    'unrealized_pl': unrealized_pl,
                    'unrealized_pl_percent': (unrealized_pl / (position['quantity'] * position['avg_price'])) * 100
                }
            except Exception as e:
                logger.error(f"Error calculating position details for {symbol}: {e}")
                
        return active_positions
        
    def get_portfolio_summary(self) -> Dict:
        """Get overall portfolio summary"""
        try:
            portfolio_value = self.get_portfolio_value()
            positions = self.get_active_positions()
            
            return {
                'total_value': portfolio_value,
                'cash_balance': self.cash_balance,
                'positions_value': portfolio_value - self.cash_balance,
                'positions': positions,
                'performance': {
                    'total_return': ((portfolio_value - self.initial_balance) / self.initial_balance) * 100,
                    'position_count': len(positions)
                }
            }
        except Exception as e:
            logger.error(f"Error getting portfolio summary: {e}")
            return {} 