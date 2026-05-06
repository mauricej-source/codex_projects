from __future__ import annotations

import datetime as dt
import math
from typing import Any


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def probability_of_profit(strategy: str, short_delta: float | None = None, long_delta: float | None = None) -> float:
    strategy_key = strategy.lower()
    short_delta = abs(float(short_delta or 0))
    long_delta = abs(float(long_delta or 0))

    if "credit" in strategy_key or "put spread" in strategy_key or "call spread" in strategy_key:
        return clamp(1 - (short_delta * 1.1))
    if "debit" in strategy_key:
        return clamp(long_delta - short_delta)
    if "cash-secured" in strategy_key or "wheel" in strategy_key:
        return clamp(1 - (short_delta * 1.1))
    if "diagonal" in strategy_key or "poor man's" in strategy_key:
        return clamp(long_delta - short_delta)
    return clamp(0.5)


def expected_value(pop: float, max_profit: float, max_loss: float) -> float:
    return (pop * max_profit) - ((1 - pop) * max_loss)


def iv_rank(current_iv: float | None, low_iv: float | None, high_iv: float | None) -> float | None:
    if current_iv is None or low_iv is None or high_iv is None:
        return None
    denominator = high_iv - low_iv
    if denominator <= 0:
        return None
    return max(0.0, min(100.0, ((current_iv - low_iv) / denominator) * 100))


def capital_efficiency(ev: float, buying_power_required: float) -> float:
    if buying_power_required <= 0:
        return 0.0
    return (ev / buying_power_required) * 100


def reward_to_risk(max_profit: float, max_loss: float) -> float:
    if max_loss <= 0:
        return 0.0
    return max_profit / max_loss


def dte(expiration: dt.date) -> int:
    return max(0, (expiration - dt.date.today()).days)


def classify_standard(
    *,
    pop: float,
    short_delta: float,
    iv_rank_value: float | None,
    ev: float,
) -> str:
    ivr = iv_rank_value or 0
    delta = abs(short_delta)
    if ev > 0 and pop > 0.70 and delta < 0.20 and ivr > 50:
        return "HIGH"
    if 0.50 <= pop <= 0.70 and 0.20 <= delta <= 0.40 and 30 <= ivr <= 50:
        return "MEDIUM"
    return "LOW"


def classify_swing(
    *,
    pop: float,
    short_delta: float,
    iv_rank_value: float | None,
    theta_daily: float,
    trade_cost: float,
    max_profit: float,
    max_loss: float,
    days_to_expiration: int,
    strategy: str,
    ev: float,
) -> str:
    ivr = iv_rank_value or 0
    decay_pct = abs(theta_daily) / max(abs(trade_cost), 0.01)
    rr = reward_to_risk(max_profit, max_loss)
    is_debit = "debit" in strategy.lower()

    if days_to_expiration < 3:
        return "LOW"
    if is_debit and pop < 0.40:
        return "LOW"
    if ev > 0 and decay_pct > 0.01 and abs(short_delta) < 0.25 and rr > (1 / 3):
        return "HIGH"
    if 0.50 <= pop <= 0.65 and 7 <= days_to_expiration <= 14 and 20 <= ivr <= 40:
        return "MEDIUM"
    return "LOW"


def score_trade(trade: dict[str, Any]) -> float:
    success_weight = {"HIGH": 300.0, "MEDIUM": 150.0, "LOW": 0.0}.get(trade.get("success"), 0.0)
    return (
        success_weight
        + float(trade.get("capital_efficiency", 0) or 0) * 5
        + float(trade.get("ev", 0) or 0)
        + float(trade.get("pop", 0) or 0) * 50
        + float(trade.get("iv_rank", 0) or 0)
    )


def normalize_iv(raw_iv: Any) -> float | None:
    try:
        value = float(raw_iv)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value):
        return None
    return value / 100 if value > 3 else value
