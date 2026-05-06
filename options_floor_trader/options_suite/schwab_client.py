from __future__ import annotations

import datetime as dt
import logging
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from .api_config import DEFAULT_API_CONFIG, SchwabApiConfig


logger = logging.getLogger("options_suite.schwab")


class SchwabUnavailable(RuntimeError):
    pass


@dataclass
class SchwabCredentials:
    app_key: str
    app_secret: str
    callback_url: str
    token_path: str


def _response_json(response: Any) -> Any:
    if hasattr(response, "raise_for_status"):
        response.raise_for_status()
    if hasattr(response, "json"):
        return response.json()
    return response


def create_client(credentials: SchwabCredentials, force_login: bool = False) -> Any:
    try:
        from schwab import auth
    except Exception as exc:  # pragma: no cover - depends on local env
        raise SchwabUnavailable("Install schwab-py to enable Schwab authentication.") from exc

    token_path = Path(credentials.token_path).expanduser()
    token_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        if token_path.exists() and not force_login:
            logger.info("Loading Schwab token from %s", token_path)
            return auth.client_from_token_file(
                str(token_path),
                credentials.app_key,
                credentials.app_secret,
                enforce_enums=False,
            )

        logger.info("Starting Schwab OAuth login flow; token path=%s", token_path)
        return auth.client_from_login_flow(
            credentials.app_key,
            credentials.app_secret,
            credentials.callback_url,
            str(token_path),
            enforce_enums=False,
        )
    except Exception:
        logger.exception("Schwab OAuth client creation failed")
        raise


def safe_api_call(label: str, func: Any, *args: Any, **kwargs: Any) -> Any:
    try:
        return _response_json(func(*args, **kwargs))
    except Exception as exc:
        text = str(exc).lower()
        if "429" in text or "rate" in text or "too many" in text:
            logger.warning("Schwab API rate limit while calling %s: %s", label, exc)
        else:
            logger.exception("Schwab API error while calling %s", label)
        return None


def _client_method(client: Any, method_name: str) -> Any:
    method = getattr(client, method_name, None)
    if method is None:
        raise AttributeError(f"Schwab client does not expose method '{method_name}'. Update API configuration.")
    return method


def get_quotes(client: Any, symbols: Iterable[str], api_config: SchwabApiConfig = DEFAULT_API_CONFIG) -> dict[str, Any]:
    symbols = [s.strip().upper() for s in symbols if s.strip()]
    if not symbols:
        return {}
    data = safe_api_call(api_config.quotes_method, _client_method(client, api_config.quotes_method), symbols)
    return data or {}


def get_option_chain(
    client: Any,
    symbol: str,
    *,
    strike_count: int = 12,
    from_date: dt.date | None = None,
    to_date: dt.date | None = None,
    strategy: str | None = None,
    include_underlying_quote: bool | None = None,
    api_config: SchwabApiConfig = DEFAULT_API_CONFIG,
) -> dict[str, Any]:
    kwargs = {
        "strike_count": strike_count,
        "strategy": strategy or api_config.option_chain_strategy,
        "include_underlying_quote": (
            api_config.include_underlying_quote if include_underlying_quote is None else include_underlying_quote
        ),
    }
    if from_date:
        kwargs["from_date"] = from_date
    if to_date:
        kwargs["to_date"] = to_date
    method = _client_method(client, api_config.option_chain_method)
    data = safe_api_call(api_config.option_chain_method, method, symbol.upper(), **kwargs)
    return data or {}


def get_linked_accounts(client: Any, api_config: SchwabApiConfig = DEFAULT_API_CONFIG) -> list[dict[str, Any]]:
    method = _client_method(client, api_config.account_numbers_method)
    data = safe_api_call(api_config.account_numbers_method, method)
    return data or []


def get_account(
    client: Any,
    account_hash: str,
    fields: str | None = None,
    api_config: SchwabApiConfig = DEFAULT_API_CONFIG,
) -> dict[str, Any]:
    method = _client_method(client, api_config.account_method)
    data = safe_api_call(api_config.account_method, method, account_hash, fields=fields or api_config.account_fields)
    return data or {}


def get_accounts(
    client: Any,
    fields: str | None = None,
    api_config: SchwabApiConfig = DEFAULT_API_CONFIG,
) -> list[dict[str, Any]]:
    method = _client_method(client, api_config.accounts_method)
    data = safe_api_call(api_config.accounts_method, method, fields=fields or api_config.account_fields)
    return data or []


def parse_human_option(text: str) -> tuple[str, dt.date, str, float]:
    pattern = re.compile(
        r"^\s*(?P<symbol>[A-Za-z.\-]+)\s+"
        r"(?P<strike>\d+(?:\.\d+)?)\s+"
        r"(?P<right>call|put|c|p)\s+"
        r"(?P<date>\d{1,2}/\d{1,2}/\d{2,4})\s*$",
        re.IGNORECASE,
    )
    match = pattern.match(text)
    if not match:
        raise ValueError('Use format like "SPY 450 Call 05/15/26".')

    symbol = match.group("symbol").upper()
    strike = float(match.group("strike"))
    right = "C" if match.group("right").lower().startswith("c") else "P"
    month, day, year = [int(x) for x in match.group("date").split("/")]
    if year < 100:
        year += 2000
    return symbol, dt.date(year, month, day), right, strike


def to_osi_symbol(
    underlying: str,
    expiration: dt.date,
    option_type: str,
    strike: float | str,
) -> str:
    root = underlying.upper().replace(".", "").replace("-", "")
    if len(root) > 6:
        raise ValueError("OSI root supports up to six characters.")
    right = option_type.upper()[0]
    if right not in {"C", "P"}:
        raise ValueError("Option type must be call/put or C/P.")
    strike_int = int(round(float(strike) * 1000))
    return f"{root:<6}{expiration:%y%m%d}{right}{strike_int:08d}"


def human_to_osi_symbol(text: str) -> str:
    underlying, expiration, right, strike = parse_human_option(text)
    return to_osi_symbol(underlying, expiration, right, strike)


def build_option_symbol(
    underlying: str,
    expiration: dt.date,
    option_type: str,
    strike: float | str,
) -> str:
    try:
        from schwab.orders.options import OptionSymbol

        return OptionSymbol(underlying.upper(), expiration, option_type.upper()[0], str(strike)).build()
    except Exception:
        return to_osi_symbol(underlying, expiration, option_type, strike)


def _finite_price(price: float | int | None) -> str | None:
    if price is None or not math.isfinite(float(price)):
        return None
    return f"{float(price):.2f}"


def build_spread_order_json(
    trade: dict[str, Any],
    *,
    quantity: int = 1,
    limit_price: float | None = None,
    api_config: SchwabApiConfig = DEFAULT_API_CONFIG,
) -> dict[str, Any]:
    legs = trade.get("legs") or []
    if not legs:
        raise ValueError("Trade must include option legs.")

    price = _finite_price(limit_price if limit_price is not None else abs(float(trade.get("net_price", 0) or 0)))
    order_type = "NET_CREDIT" if float(trade.get("net_credit", 0) or 0) > 0 else "NET_DEBIT"

    try:
        from schwab.orders.common import Duration, OrderStrategyType, OrderType, Session
        from schwab.orders.generic import OrderBuilder

        builder = OrderBuilder()
        builder.set_session(Session.NORMAL)
        builder.set_duration(Duration.DAY)
        builder.set_order_type(OrderType.NET_CREDIT if order_type == "NET_CREDIT" else OrderType.NET_DEBIT)
        builder.set_order_strategy_type(OrderStrategyType.SINGLE)
        if price:
            builder.set_price(price)
        for leg in legs:
            builder.add_option_leg(leg["instruction"], leg["symbol"], quantity)
        return builder.build()
    except Exception as exc:
        logger.info("Falling back to manual staged order JSON: %s", exc)

    order = {
        "session": api_config.default_order_session,
        "duration": api_config.default_order_duration,
        "orderType": order_type,
        "orderStrategyType": api_config.default_order_strategy_type,
        "complexOrderStrategyType": trade.get("complex_order_type", api_config.default_complex_order_type),
        "orderLegCollection": [],
    }
    if price:
        order["price"] = price
    for leg in legs:
        order["orderLegCollection"].append(
            {
                "instruction": leg["instruction"],
                "quantity": quantity,
                "instrument": {"assetType": "OPTION", "symbol": leg["symbol"]},
            }
        )
    return order


def place_order(
    client: Any,
    account_hash: str,
    order_json: dict[str, Any],
    api_config: SchwabApiConfig = DEFAULT_API_CONFIG,
) -> Any:
    method = _client_method(client, api_config.place_order_method)
    return safe_api_call(api_config.place_order_method, method, account_hash, order_json)
