from __future__ import annotations

import datetime as dt
import logging
import re
from typing import Any

import pandas as pd

from .api_config import DEFAULT_API_CONFIG, SchwabApiConfig
from .schwab_client import get_accounts


logger = logging.getLogger("options_suite.portfolio")


def _parse_option_expiration(symbol: str) -> dt.date | None:
    match = re.search(r"(\d{6})([CP])(\d{8})$", symbol.replace(" ", ""))
    if not match:
        return None
    try:
        return dt.datetime.strptime(match.group(1), "%y%m%d").date()
    except ValueError:
        return None


def account_summary(accounts: list[dict[str, Any]]) -> tuple[pd.DataFrame, pd.DataFrame]:
    balance_rows: list[dict[str, Any]] = []
    position_rows: list[dict[str, Any]] = []

    for account_wrapper in accounts:
        account = account_wrapper.get("securitiesAccount") or account_wrapper.get("account") or account_wrapper
        balances = account.get("currentBalances") or account.get("initialBalances") or {}
        account_id = account.get("accountNumber") or account.get("accountId") or "Account"
        balance_rows.append(
            {
                "account": account_id,
                "cash": balances.get("cashBalance"),
                "liquidation_value": balances.get("liquidationValue"),
                "buying_power": balances.get("buyingPower") or balances.get("availableFunds"),
            }
        )

        for pos in account.get("positions") or []:
            instrument = pos.get("instrument") or {}
            symbol = instrument.get("symbol", "")
            expiration = _parse_option_expiration(symbol)
            dte = (expiration - dt.date.today()).days if expiration else None
            row = {
                "account": account_id,
                "symbol": symbol,
                "asset_type": instrument.get("assetType"),
                "quantity": pos.get("longQuantity", 0) or -float(pos.get("shortQuantity", 0) or 0),
                "market_value": pos.get("marketValue"),
                "average_price": pos.get("averagePrice"),
                "p_l_open": pos.get("currentDayProfitLoss") or pos.get("longOpenProfitLoss") or pos.get("shortOpenProfitLoss"),
                "expiration": expiration.isoformat() if expiration else None,
                "dte": dte,
            }
            position_rows.append(row)

    return pd.DataFrame(balance_rows), pd.DataFrame(position_rows)


def fetch_portfolio(
    client: Any,
    api_config: SchwabApiConfig = DEFAULT_API_CONFIG,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    accounts = get_accounts(client, fields=api_config.account_fields, api_config=api_config)
    return account_summary(accounts)


def expiring_risk_alerts(positions: pd.DataFrame) -> list[str]:
    if positions.empty or "dte" not in positions:
        return []
    alerts: list[str] = []
    risky = positions[(positions["dte"].notna()) & (positions["dte"] <= 2)]
    for _, row in risky.iterrows():
        message = f"Gamma/gap risk: {row['symbol']} reaches {int(row['dte'])} DTE."
        logger.warning(message)
        alerts.append(message)
    return alerts
