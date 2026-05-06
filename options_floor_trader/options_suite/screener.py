from __future__ import annotations

import datetime as dt
from itertools import combinations
from typing import Any

import pandas as pd

from .chains import chain_average_iv, flatten_chain
from .engine import (
    capital_efficiency,
    classify_standard,
    classify_swing,
    expected_value,
    iv_rank,
    probability_of_profit,
    reward_to_risk,
    score_trade,
)
from .schwab_client import build_option_symbol


STANDARD_STRATEGIES = ["Bull Put Spread", "Bear Call Spread", "Iron Condor", "Wheel Cash-Secured Put"]
SWING_STRATEGIES = ["30-45 Day Credit Spread", "Swing Debit Spread", "Poor Man's Covered Call"]


def _find_iv_rank(chain_rows: list[dict[str, Any]], current_iv: float | None = None) -> float:
    values = [r["iv"] for r in chain_rows if r.get("iv") is not None and r["iv"] > 0]
    if not values:
        return 0.0
    current = current_iv or chain_average_iv(chain_rows) or values[-1]
    return iv_rank(current, min(values), max(values)) or 0.0


def _leg(row: dict[str, Any], instruction: str) -> dict[str, Any]:
    symbol = row.get("symbol") or build_option_symbol(row["underlying"], row["expiration"], row["type"][0], row["strike"])
    return {
        "symbol": symbol,
        "instruction": instruction,
        "strike": row["strike"],
        "expiration": row["expiration"].isoformat(),
        "type": row["type"],
    }


def _base_trade(
    *,
    ticker: str,
    strategy: str,
    account_segment: str,
    short: dict[str, Any],
    long: dict[str, Any],
    width: float,
    net_credit: float = 0,
    net_debit: float = 0,
    iv_rank_value: float,
    legs: list[dict[str, Any]],
) -> dict[str, Any]:
    max_profit = round((net_credit or max(0, width - net_debit)) * 100, 2)
    max_loss = round((max(0, width - net_credit) if net_credit else net_debit) * 100, 2)
    pop = probability_of_profit(strategy, short.get("delta"), long.get("delta"))
    ev = expected_value(pop, max_profit, max_loss)
    bp = max_loss
    theta_daily = round((float(short.get("theta") or 0) + float(long.get("theta") or 0)) * 100, 2)
    gamma = round((float(short.get("gamma") or 0) + float(long.get("gamma") or 0)) * 100, 4)
    dte = int(short["dte"])
    success = (
        classify_standard(pop=pop, short_delta=short.get("delta") or 0, iv_rank_value=iv_rank_value, ev=ev)
        if account_segment == "Standard"
        else classify_swing(
            pop=pop,
            short_delta=short.get("delta") or 0,
            iv_rank_value=iv_rank_value,
            theta_daily=theta_daily,
            trade_cost=(net_debit or max_loss or 1),
            max_profit=max_profit,
            max_loss=max_loss,
            days_to_expiration=dte,
            strategy=strategy,
            ev=ev,
        )
    )

    trade = {
        "ticker": ticker,
        "strategy": strategy,
        "account_segment": account_segment,
        "expiration": short["expiration"].isoformat(),
        "dte": dte,
        "strikes": f"{short['strike']} / {long['strike']}",
        "short_delta": round(abs(float(short.get("delta") or 0)), 3),
        "long_delta": round(abs(float(long.get("delta") or 0)), 3),
        "theta": theta_daily,
        "gamma": gamma,
        "iv": round(float(short.get("iv") or 0) * 100, 2),
        "iv_rank": round(iv_rank_value, 2),
        "net_credit": round(net_credit * 100, 2),
        "net_debit": round(net_debit * 100, 2),
        "net_price": round((net_credit or net_debit), 2),
        "max_profit": max_profit,
        "max_loss": max_loss,
        "buying_power_required": bp,
        "pop": round(pop * 100, 2),
        "ev": round(ev, 2),
        "capital_efficiency": round(capital_efficiency(ev, bp), 2),
        "reward_to_risk": round(reward_to_risk(max_profit, max_loss), 2),
        "success": success,
        "legs": legs,
        "complex_order_type": "VERTICAL",
    }
    trade["score"] = round(score_trade({**trade, "pop": pop}), 2)
    return trade


def generate_credit_spreads(
    ticker: str,
    rows: list[dict[str, Any]],
    account_segment: str,
    iv_rank_value: float,
    min_dte: int,
    max_dte: int,
) -> list[dict[str, Any]]:
    trades: list[dict[str, Any]] = []
    eligible = [r for r in rows if min_dte <= r["dte"] <= max_dte and r["bid"] > 0]
    for exp in sorted({r["expiration"] for r in eligible}):
        for opt_type, strategy in (("PUT", "Bull Put Spread"), ("CALL", "Bear Call Spread")):
            side = sorted(
                [r for r in eligible if r["expiration"] == exp and r["type"] == opt_type],
                key=lambda x: x["strike"],
            )
            for short, long in combinations(side, 2):
                if opt_type == "PUT":
                    short_leg, long_leg = long, short
                else:
                    short_leg, long_leg = short, long
                width = abs(short_leg["strike"] - long_leg["strike"])
                if width <= 0 or width > 15:
                    continue
                credit = short_leg["bid"] - long_leg["ask"]
                if credit <= 0:
                    continue
                trades.append(
                    _base_trade(
                        ticker=ticker,
                        strategy="30-45 Day Credit Spread" if account_segment == "Swing" else strategy,
                        account_segment=account_segment,
                        short=short_leg,
                        long=long_leg,
                        width=width,
                        net_credit=credit,
                        iv_rank_value=iv_rank_value,
                        legs=[_leg(short_leg, "SELL_TO_OPEN"), _leg(long_leg, "BUY_TO_OPEN")],
                    )
                )
    return trades


def generate_debit_spreads(
    ticker: str,
    rows: list[dict[str, Any]],
    account_segment: str,
    iv_rank_value: float,
    min_dte: int,
    max_dte: int,
) -> list[dict[str, Any]]:
    trades: list[dict[str, Any]] = []
    eligible = [r for r in rows if min_dte <= r["dte"] <= max_dte and r["ask"] > 0]
    for exp in sorted({r["expiration"] for r in eligible}):
        for opt_type in ("CALL", "PUT"):
            side = sorted([r for r in eligible if r["expiration"] == exp and r["type"] == opt_type], key=lambda x: x["strike"])
            for long_leg, short_leg in combinations(side, 2):
                if opt_type == "PUT":
                    long_leg, short_leg = short_leg, long_leg
                width = abs(short_leg["strike"] - long_leg["strike"])
                if width <= 0 or width > 20:
                    continue
                debit = long_leg["ask"] - short_leg["bid"]
                if debit <= 0 or debit >= width:
                    continue
                trades.append(
                    _base_trade(
                        ticker=ticker,
                        strategy="Swing Debit Spread",
                        account_segment=account_segment,
                        short=short_leg,
                        long=long_leg,
                        width=width,
                        net_debit=debit,
                        iv_rank_value=iv_rank_value,
                        legs=[_leg(long_leg, "BUY_TO_OPEN"), _leg(short_leg, "SELL_TO_OPEN")],
                    )
                )
    return trades


def generate_cash_secured_puts(
    ticker: str,
    rows: list[dict[str, Any]],
    account_segment: str,
    iv_rank_value: float,
    min_dte: int,
    max_dte: int,
) -> list[dict[str, Any]]:
    trades: list[dict[str, Any]] = []
    for put in [r for r in rows if r["type"] == "PUT" and min_dte <= r["dte"] <= max_dte and r["bid"] > 0]:
        pop = probability_of_profit("Wheel Cash-Secured Put", put.get("delta"), None)
        max_profit = put["bid"] * 100
        max_loss = max(put["strike"] * 100 - max_profit, 1)
        ev = expected_value(pop, max_profit, max_loss)
        success = classify_standard(pop=pop, short_delta=put.get("delta") or 0, iv_rank_value=iv_rank_value, ev=ev)
        trade = {
            "ticker": ticker,
            "strategy": "Wheel Cash-Secured Put",
            "account_segment": account_segment,
            "expiration": put["expiration"].isoformat(),
            "dte": put["dte"],
            "strikes": str(put["strike"]),
            "short_delta": round(abs(float(put.get("delta") or 0)), 3),
            "long_delta": 0.0,
            "theta": round(float(put.get("theta") or 0) * 100, 2),
            "gamma": round(float(put.get("gamma") or 0) * 100, 4),
            "iv": round(float(put.get("iv") or 0) * 100, 2),
            "iv_rank": round(iv_rank_value, 2),
            "net_credit": round(max_profit, 2),
            "net_debit": 0.0,
            "net_price": put["bid"],
            "max_profit": round(max_profit, 2),
            "max_loss": round(max_loss, 2),
            "buying_power_required": round(max_loss, 2),
            "pop": round(pop * 100, 2),
            "ev": round(ev, 2),
            "capital_efficiency": round(capital_efficiency(ev, max_loss), 2),
            "reward_to_risk": round(reward_to_risk(max_profit, max_loss), 2),
            "success": success,
            "legs": [_leg(put, "SELL_TO_OPEN")],
            "complex_order_type": "NONE",
        }
        trade["score"] = round(score_trade({**trade, "pop": pop}), 2)
        trades.append(trade)
    return trades


def generate_trades_from_chain(
    ticker: str,
    chain: dict[str, Any],
    *,
    account_segment: str,
    current_iv: float | None = None,
    min_dte: int | None = None,
    max_dte: int | None = None,
    include_strategies: list[str] | None = None,
) -> list[dict[str, Any]]:
    rows = flatten_chain(chain)
    if not rows:
        return []
    ivr = _find_iv_rank(rows, current_iv)
    if account_segment == "Swing":
        min_dte = 7 if min_dte is None else min_dte
        max_dte = 45 if max_dte is None else max_dte
    else:
        min_dte = 14 if min_dte is None else min_dte
        max_dte = 60 if max_dte is None else max_dte

    strategies = include_strategies or (SWING_STRATEGIES if account_segment == "Swing" else STANDARD_STRATEGIES)
    trades: list[dict[str, Any]] = []
    if any("Spread" in s or "Credit" in s for s in strategies):
        trades.extend(generate_credit_spreads(ticker, rows, account_segment, ivr, min_dte, max_dte))
    if account_segment == "Swing" and any("Debit" in s for s in strategies):
        trades.extend(generate_debit_spreads(ticker, rows, account_segment, ivr, min_dte, max_dte))
    if account_segment == "Standard" and any("Wheel" in s or "Cash-Secured" in s for s in strategies):
        trades.extend(generate_cash_secured_puts(ticker, rows, account_segment, ivr, min_dte, max_dte))

    return sorted(trades, key=lambda item: item.get("score", 0), reverse=True)


def trades_dataframe(trades: list[dict[str, Any]]) -> pd.DataFrame:
    columns = [
        "ticker", "strategy", "success", "score", "expiration", "dte", "strikes",
        "pop", "ev", "capital_efficiency", "max_profit", "max_loss",
        "net_credit", "net_debit", "short_delta", "theta", "gamma", "iv_rank", "iv",
    ]
    return pd.DataFrame([{k: t.get(k) for k in columns} for t in trades], columns=columns)
