"""Base archetype interface — all trading strategies implement this."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd


@dataclass
class Position:
    """Current position state for one asset."""
    ticker: str
    quantity: float = 0.0          # units held
    avg_entry_price: float = 0.0   # running avg cost basis

    @property
    def market_value(self, current_price: float) -> float:
        return self.quantity * current_price

    def unrealized_pnl(self, current_price: float) -> float:
        if self.quantity == 0:
            return 0.0
        return (current_price - self.avg_entry_price) * self.quantity


@dataclass
class Portfolio:
    """Cash + positions for one archetype."""
    cash: float
    positions: dict[str, Position] = field(default_factory=dict)

    def total_value(self, prices: dict[str, float]) -> float:
        pos_val = sum(
            p.quantity * prices.get(ticker, 0.0)
            for ticker, p in self.positions.items()
        )
        return self.cash + pos_val

    def apply_trade(
        self,
        ticker: str,
        quantity: float,
        price: float,
        max_position_pct: float = 0.20,
    ) -> bool:
        """
        Execute a trade. Returns True if filled.
        Guards against >max_position_pct of portfolio in single asset.
        """
        cost = quantity * price
        if quantity > 0:
            # Buy — check cash
            if cost > self.cash * 0.99:
                return False
            # Check position limit — new position as % of portfolio BEFORE this trade
            current_total = self.total_value({t: price for t in self.positions})
            current_pos_val = self.positions.get(ticker, Position(ticker)).quantity * price
            new_pos_val = current_pos_val + cost
            if new_pos_val / current_total > max_position_pct:
                return False
        else:
            # Sell — check holdings
            current_qty = self.positions.get(ticker, Position(ticker)).quantity
            if current_qty + quantity < 0:
                return False

        # Execute
        self.cash -= cost
        if ticker not in self.positions:
            self.positions[ticker] = Position(ticker)
        pos = self.positions[ticker]
        old_qty = pos.quantity
        pos.quantity += quantity
        if quantity > 0 and old_qty + quantity > 0:
            # Update avg entry price
            total_cost = pos.avg_entry_price * old_qty + cost
            pos.avg_entry_price = total_cost / pos.quantity
        return True


@dataclass
class MarketState:
    """Snapshot of market at a given timestep — passed to archetypes."""
    timestamp: pd.Timestamp
    ticker: str
    Open: float
    High: float
    Low: float
    Close: float
    Volume: float
    # Enriched fields from statistics pipeline
    log_return: Optional[float] = None
    vol_20d: Optional[float] = None
    volatility_regime: Optional[str] = None  # 'low' | 'high'
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    price_vs_sma_20: Optional[float] = None
    price_vs_sma_50: Optional[float] = None
    z_score: Optional[float] = None
    is_jump: Optional[bool] = None

    @classmethod
    def from_row(cls, ticker: str, row: pd.Series) -> MarketState:
        return cls(
            timestamp=row.name,
            ticker=ticker,
            Open=float(row["Open"]),
            High=float(row["High"]),
            Low=float(row["Low"]),
            Close=float(row["Close"]),
            Volume=float(row["Volume"]),
            log_return=float(row["log_return"]) if "log_return" in row else None,
            vol_20d=float(row["vol_20d"]) if "vol_20d" in row else None,
            volatility_regime=str(row["volatility_regime"]) if "volatility_regime" in row else None,
            sma_20=float(row["sma_20"]) if "sma_20" in row else None,
            sma_50=float(row["sma_50"]) if "sma_50" in row else None,
            price_vs_sma_20=float(row["price_vs_sma_20"]) if "price_vs_sma_20" in row else None,
            price_vs_sma_50=float(row["price_vs_sma_50"]) if "price_vs_sma_50" in row else None,
            z_score=float(row["z_score"]) if "z_score" in row else None,
            is_jump=bool(row["is_jump"]) if "is_jump" in row else None,
        )


@dataclass
class Trade:
    """A single executed trade."""
    timestamp: pd.Timestamp
    ticker: str
    archetype: str
    direction: str  # 'buy' | 'sell'
    quantity: float
    price: float
    portfolio_value: float


class BaseArchetype(ABC):
    """
    Interface for rule-based trading archetypes.

    Subclasses implement `get_signal()` which maps a market state
    to a trade decision. The simulation engine calls this each step.
    """

    name: str  # e.g. "trend_follower"

    def __init__(
        self,
        initial_cash: float = 1_000_000.0,
        max_position_pct: float = 0.20,
    ):
        self.initial_cash = initial_cash
        self.max_position_pct = max_position_pct
        self._portfolio: Optional[Portfolio] = None
        self._trade_log: list[Trade] = []

    @property
    def portfolio(self) -> Portfolio:
        if self._portfolio is None:
            self._portfolio = Portfolio(
                cash=self.initial_cash,
                positions={},
            )
        return self._portfolio

    def reset(self) -> None:
        """Reset portfolio and trade log for a new simulation run."""
        self._portfolio = Portfolio(cash=self.initial_cash, positions={})
        self._trade_log = []

    @abstractmethod
    def get_signal(
        self,
        state: MarketState,
        all_states: dict[str, MarketState],
    ) -> Optional[dict]:
        """
        Return a trade decision for the current market state.

        Args:
            state: Current market state for this archetype's focus ticker.
            all_states: Current market state for ALL tickers (for cross-asset signals).

        Returns:
            None = hold
            dict = {'action': 'buy'|'sell', 'quantity': float (positive number)}
        """
        ...

    def execute(
        self,
        decision: Optional[dict],
        ticker: str,
        timestamp: pd.Timestamp,
        current_price: float,
        portfolio_value: float,
    ) -> None:
        """Apply a trade decision to the portfolio."""
        if decision is None:
            return
        action = decision.get("action", "hold")
        if action == "hold":
            return
        quantity = decision.get("quantity", 0.0)
        if action == "sell":
            quantity = -abs(quantity)
        filled = self.portfolio.apply_trade(
            ticker=ticker,
            quantity=quantity,
            price=current_price,
            max_position_pct=self.max_position_pct,
        )
        if filled:
            self._trade_log.append(Trade(
                timestamp=timestamp,
                ticker=ticker,
                archetype=self.name,
                direction="buy" if quantity > 0 else "sell",
                quantity=abs(quantity),
                price=current_price,
                portfolio_value=portfolio_value,
            ))

    def get_trade_log(self) -> list[Trade]:
        return self._trade_log

    def summary(self, final_prices: dict[str, float]) -> dict:
        """Final portfolio summary."""
        total = self.portfolio.total_value(final_prices)
        pnl = total - self.initial_cash
        return {
            "archetype": self.name,
            "initial_cash": self.initial_cash,
            "final_value": total,
            "pnl": pnl,
            "pnl_pct": pnl / self.initial_cash,
            "num_trades": len(self._trade_log),
            "positions": {
                ticker: pos.quantity
                for ticker, pos in self.portfolio.positions.items()
            },
        }
