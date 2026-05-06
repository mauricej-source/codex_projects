from __future__ import annotations

import datetime as dt
from typing import Any

from .engine import normalize_iv


def _parse_expiration_key(key: str) -> dt.date | None:
    date_part = key.split(":")[0]
    try:
        return dt.date.fromisoformat(date_part)
    except ValueError:
        return None


def _mid(contract: dict[str, Any]) -> float:
    bid = float(contract.get("bid") or 0)
    ask = float(contract.get("ask") or 0)
    last = float(contract.get("last") or contract.get("mark") or 0)
    if bid > 0 and ask > 0:
        return round((bid + ask) / 2, 2)
    return round(last, 2)


def flatten_chain(chain: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for side_key, option_type in (("callExpDateMap", "CALL"), ("putExpDateMap", "PUT")):
        exp_map = chain.get(side_key) or {}
        for exp_key, strikes in exp_map.items():
            expiration = _parse_expiration_key(exp_key)
            if not expiration:
                continue
            for strike_text, contracts in (strikes or {}).items():
                for contract in contracts or []:
                    rows.append(
                        {
                            "symbol": contract.get("symbol"),
                            "underlying": chain.get("symbol") or contract.get("underlyingSymbol"),
                            "expiration": expiration,
                            "dte": max(0, (expiration - dt.date.today()).days),
                            "strike": float(strike_text),
                            "type": option_type,
                            "bid": float(contract.get("bid") or 0),
                            "ask": float(contract.get("ask") or 0),
                            "mid": _mid(contract),
                            "delta": float(contract.get("delta") or 0),
                            "theta": float(contract.get("theta") or 0),
                            "gamma": float(contract.get("gamma") or 0),
                            "iv": normalize_iv(contract.get("volatility") or contract.get("theoreticalVolatility")),
                            "volume": int(contract.get("totalVolume") or 0),
                            "open_interest": int(contract.get("openInterest") or 0),
                            "description": contract.get("description", ""),
                        }
                    )
    return rows


def quote_iv_context(quote: dict[str, Any]) -> tuple[float | None, float | None, float | None]:
    containers = [quote, quote.get("quote") or {}, quote.get("fundamental") or {}, quote.get("reference") or {}]

    def pick(names: tuple[str, ...]) -> float | None:
        for container in containers:
            for name in names:
                if name in container and container[name] is not None:
                    val = normalize_iv(container[name])
                    if val is not None:
                        return val
        return None

    current = pick(("volatility", "impliedVolatility", "impliedVolatilityPercent", "iv"))
    low = pick(("iv52WeekLow", "impliedVolatility52WeekLow", "52WeekLowIV", "ivLow"))
    high = pick(("iv52WeekHigh", "impliedVolatility52WeekHigh", "52WeekHighIV", "ivHigh"))
    return current, low, high


def chain_average_iv(rows: list[dict[str, Any]]) -> float | None:
    values = [r["iv"] for r in rows if r.get("iv") is not None and r["iv"] > 0]
    if not values:
        return None
    return sum(values) / len(values)
