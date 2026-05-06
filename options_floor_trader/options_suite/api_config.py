from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class SchwabApiConfig:
    quotes_method: str = "get_quotes"
    option_chain_method: str = "get_option_chain"
    accounts_method: str = "get_accounts"
    account_method: str = "get_account"
    account_numbers_method: str = "get_account_numbers"
    place_order_method: str = "place_order"
    account_fields: str = "positions"
    option_chain_strategy: str = "SINGLE"
    include_underlying_quote: bool = True
    default_order_session: str = "NORMAL"
    default_order_duration: str = "DAY"
    default_order_strategy_type: str = "SINGLE"
    default_complex_order_type: str = "VERTICAL"


DEFAULT_API_CONFIG = SchwabApiConfig()


def api_config_to_dict(config: SchwabApiConfig | dict[str, Any] | None = None) -> dict[str, Any]:
    if config is None:
        return asdict(DEFAULT_API_CONFIG)
    if isinstance(config, SchwabApiConfig):
        return asdict(config)
    return {**asdict(DEFAULT_API_CONFIG), **config}


def api_config_from_dict(values: dict[str, Any] | None = None) -> SchwabApiConfig:
    merged = api_config_to_dict(values)
    return SchwabApiConfig(**{key: merged[key] for key in asdict(DEFAULT_API_CONFIG)})
