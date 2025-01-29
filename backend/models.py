from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Enum, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

Base = declarative_base()

class TradeType(enum.Enum):
    BUY = "BUY"
    SELL = "SELL"

class TradeStatus(enum.Enum):
    PENDING = "PENDING"
    EXECUTED = "EXECUTED"
    CANCELLED = "CANCELLED"

class Trade(Base):
    __tablename__ = 'trades'

    id = Column(Integer, primary_key=True)
    symbol = Column(String, nullable=False)
    type = Column(Enum(TradeType), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(TradeStatus), default=TradeStatus.PENDING)
    scheduled_for = Column(DateTime, nullable=True)
    price_target = Column(Float, nullable=True)
    analysis_id = Column(Integer, ForeignKey('market_analyses.id'))

    analysis = relationship("MarketAnalysis", back_populates="trades")

class Position(Base):
    __tablename__ = 'positions'

    id = Column(Integer, primary_key=True)
    symbol = Column(String, nullable=False, unique=True)
    quantity = Column(Integer, nullable=False, default=0)
    average_price = Column(Float, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow)

class Portfolio(Base):
    __tablename__ = 'portfolio'

    id = Column(Integer, primary_key=True)
    cash = Column(Float, nullable=False)
    total_value = Column(Float, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow)

class MarketAnalysis(Base):
    __tablename__ = 'market_analyses'

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    summary = Column(String)
    sentiment_score = Column(Float)
    data_sources = Column(String)  # JSON string of data sources used
    trades = relationship("Trade", back_populates="analysis")

# Create SQLite database
engine = create_engine('sqlite:///trading_bot.db')
Base.metadata.create_all(engine) 