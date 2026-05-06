from __future__ import annotations

import datetime as dt
import json
import sqlite3
from pathlib import Path
from typing import Any

import pandas as pd


DB_PATH = Path("trade_log.sqlite3")


SCHEMA = """
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    ticker TEXT NOT NULL,
    strategy TEXT NOT NULL,
    strikes TEXT NOT NULL,
    account_segment TEXT NOT NULL,
    trade_type TEXT NOT NULL,
    net_credit REAL DEFAULT 0,
    net_debit REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    status TEXT NOT NULL,
    entry_price REAL DEFAULT 0,
    exit_price REAL,
    entry_delta REAL DEFAULT 0,
    entry_theta REAL DEFAULT 0,
    entry_gamma REAL DEFAULT 0,
    exit_delta REAL,
    exit_theta REAL,
    exit_gamma REAL,
    iv_rank REAL DEFAULT 0,
    implied_volatility REAL DEFAULT 0,
    theoretical_pl REAL,
    order_json TEXT,
    legs_json TEXT,
    notes TEXT
);
"""


def connect(db_path: Path = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute(SCHEMA)
    conn.commit()
    return conn


def insert_trade(trade: dict[str, Any], *, trade_type: str, status: str, order_json: dict[str, Any] | None = None) -> int:
    conn = connect()
    entry_price = float(trade.get("net_credit") or trade.get("net_debit") or 0)
    values = {
        "created_at": dt.datetime.now().isoformat(timespec="seconds"),
        "ticker": trade.get("ticker"),
        "strategy": trade.get("strategy"),
        "strikes": trade.get("strikes"),
        "account_segment": trade.get("account_segment"),
        "trade_type": trade_type,
        "net_credit": trade.get("net_credit", 0),
        "net_debit": trade.get("net_debit", 0),
        "commission": trade.get("commission", 0),
        "status": status,
        "entry_price": entry_price,
        "entry_delta": trade.get("short_delta", 0),
        "entry_theta": trade.get("theta", 0),
        "entry_gamma": trade.get("gamma", 0),
        "iv_rank": trade.get("iv_rank", 0),
        "implied_volatility": trade.get("iv", 0),
        "order_json": json.dumps(order_json or {}),
        "legs_json": json.dumps(trade.get("legs") or []),
        "notes": trade.get("notes", ""),
    }
    columns = ", ".join(values.keys())
    placeholders = ", ".join([f":{key}" for key in values])
    cur = conn.execute(f"INSERT INTO trades ({columns}) VALUES ({placeholders})", values)
    conn.commit()
    trade_id = int(cur.lastrowid)
    conn.close()
    return trade_id


def list_trades(status: str | None = None) -> pd.DataFrame:
    conn = connect()
    if status:
        df = pd.read_sql_query("SELECT * FROM trades WHERE status = ? ORDER BY created_at DESC", conn, params=(status,))
    else:
        df = pd.read_sql_query("SELECT * FROM trades ORDER BY created_at DESC", conn)
    conn.close()
    return df


def update_exit(
    trade_id: int,
    *,
    exit_price: float,
    exit_delta: float | None = None,
    exit_theta: float | None = None,
    exit_gamma: float | None = None,
    status: str = "Closed",
) -> None:
    conn = connect()
    row = conn.execute("SELECT entry_price, net_credit, net_debit FROM trades WHERE id = ?", (trade_id,)).fetchone()
    theoretical_pl = None
    if row:
        entry_price, net_credit, net_debit = row
        theoretical_pl = (entry_price - exit_price) if net_credit else (exit_price - entry_price)
    conn.execute(
        """
        UPDATE trades
        SET exit_price = ?, exit_delta = ?, exit_theta = ?, exit_gamma = ?,
            status = ?, theoretical_pl = ?
        WHERE id = ?
        """,
        (exit_price, exit_delta, exit_theta, exit_gamma, status, theoretical_pl, trade_id),
    )
    conn.commit()
    conn.close()


def backtest_paper_trades(current_prices: dict[str, float]) -> pd.DataFrame:
    df = list_trades(status="PAPER")
    if df.empty:
        return df
    results = []
    for _, row in df.iterrows():
        current = current_prices.get(row["ticker"])
        theoretical_pl = None
        if current is not None:
            theoretical_pl = float(row["entry_price"]) - current if float(row["net_credit"] or 0) else current - float(row["entry_price"])
        results.append({**row.to_dict(), "current_price": current, "theoretical_pl": theoretical_pl})
    return pd.DataFrame(results)
