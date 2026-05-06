from __future__ import annotations

import datetime as dt
import logging
from typing import Any

from .api_config import DEFAULT_API_CONFIG, SchwabApiConfig
from .chains import quote_iv_context
from .engine import iv_rank
from .schwab_client import get_option_chain, get_quotes
from .screener import generate_trades_from_chain
from .universe import TOP_LIQUID_UNIVERSE


logger = logging.getLogger("options_suite.discovery")


def _estimated_iv_rank_from_quote(quote: dict[str, Any]) -> tuple[float, float | None]:
    current, low, high = quote_iv_context(quote)
    rank = iv_rank(current, low, high)
    if rank is not None:
        return rank, current
    if current:
        estimated_low = current * 0.55
        estimated_high = current * 1.65
        return iv_rank(current, estimated_low, estimated_high) or 0.0, current
    return 0.0, None


def rank_universe_by_iv(
    client: Any,
    universe: list[str] | None = None,
    api_config: SchwabApiConfig = DEFAULT_API_CONFIG,
) -> list[dict[str, Any]]:
    universe = universe or TOP_LIQUID_UNIVERSE
    quotes = get_quotes(client, universe, api_config=api_config)
    ranked: list[dict[str, Any]] = []
    for symbol in universe:
        quote = quotes.get(symbol) or quotes.get(symbol.upper()) or {}
        rank, current_iv = _estimated_iv_rank_from_quote(quote)
        ranked.append({"ticker": symbol, "iv_rank": round(rank, 2), "current_iv": current_iv})
    return sorted(ranked, key=lambda row: row["iv_rank"], reverse=True)


def run_discovery(
    client: Any,
    *,
    account_segment: str,
    universe: list[str] | None = None,
    top_symbols: int = 20,
    strike_count: int = 10,
    min_dte: int = 7,
    max_dte: int = 60,
    api_config: SchwabApiConfig = DEFAULT_API_CONFIG,
) -> dict[str, Any]:
    ranked_symbols = rank_universe_by_iv(client, universe, api_config=api_config)
    selected = ranked_symbols[:top_symbols]
    trades: list[dict[str, Any]] = []
    from_date = dt.date.today() + dt.timedelta(days=max(0, min_dte - 2))
    to_date = dt.date.today() + dt.timedelta(days=max_dte + 5)

    for row in selected:
        ticker = row["ticker"]
        chain = get_option_chain(
            client,
            ticker,
            strike_count=strike_count,
            from_date=from_date,
            to_date=to_date,
            strategy=api_config.option_chain_strategy,
            api_config=api_config,
        )
        if not chain:
            logger.info("No option chain returned for %s", ticker)
            continue
        trades.extend(
            generate_trades_from_chain(
                ticker,
                chain,
                account_segment=account_segment,
                current_iv=row.get("current_iv"),
                min_dte=min_dte,
                max_dte=max_dte,
            )
        )

    return {
        "ranked_symbols": ranked_symbols,
        "selected_symbols": [row["ticker"] for row in selected],
        "trades": sorted(trades, key=lambda item: item.get("score", 0), reverse=True),
    }
