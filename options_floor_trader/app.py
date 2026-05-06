from __future__ import annotations

import datetime as dt
import json
from typing import Any

import pandas as pd
import streamlit as st

from options_suite.discovery import run_discovery
from options_suite.help_docs import HELP_MARKDOWN
from options_suite.logging_config import configure_logging
from options_suite.portfolio import expiring_risk_alerts, fetch_portfolio
from options_suite.schwab_client import (
    SchwabCredentials,
    build_spread_order_json,
    create_client,
    get_option_chain,
    get_quotes,
    human_to_osi_symbol,
    place_order,
)
from options_suite.screener import (
    STANDARD_STRATEGIES,
    SWING_STRATEGIES,
    generate_trades_from_chain,
    trades_dataframe,
)
from options_suite.trade_log import backtest_paper_trades, insert_trade, list_trades, update_exit
from options_suite.universe import DEFAULT_TICKERS, TOP_LIQUID_UNIVERSE


logger = configure_logging()


st.set_page_config(page_title="Options Trading Suite", page_icon="OPT", layout="wide")


def apply_theme() -> None:
    st.markdown(
        """
        <style>
        :root {
            --oft-bg: #06142f;
            --oft-bg-2: #0a2050;
            --oft-panel: rgba(12, 38, 86, 0.82);
            --oft-panel-2: rgba(8, 27, 63, 0.92);
            --oft-cyan: #61e6f2;
            --oft-cyan-soft: #44bed0;
            --oft-blue: #264a9b;
            --oft-text: #7dbac1;
            --oft-muted: #8ec9d8;
            --oft-border: rgba(97, 230, 242, 0.28);
        }

        .stApp {
            color: var(--oft-text);
            background:
                radial-gradient(circle at 43% 20%, rgba(97, 230, 242, 0.24), transparent 19rem),
                radial-gradient(circle at 70% 36%, rgba(52, 98, 196, 0.34), transparent 22rem),
                linear-gradient(180deg, #122a53 0%, #0a1e49 48%, #06142f 100%);
        }

        .stApp::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background-image:
                linear-gradient(rgba(97, 230, 242, 0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(97, 230, 242, 0.055) 1px, transparent 1px);
            background-size: 72px 72px;
            mask-image: linear-gradient(to bottom, rgba(0,0,0,0.65), transparent 80%);
        }

        .block-container {
            padding-top: 2rem;
            padding-bottom: 4rem;
        }

        [data-testid="stSidebar"] {
            background:
                linear-gradient(180deg, rgba(6, 20, 47, 0.98), rgba(9, 30, 71, 0.96)),
                repeating-linear-gradient(90deg, rgba(97, 230, 242, 0.08) 0 1px, transparent 1px 28px);
            border-right: 1px solid var(--oft-border);
            box-shadow: 0 0 32px rgba(67, 209, 229, 0.12);
        }

        [data-testid="stSidebar"],
        [data-testid="stSidebar"] label,
        [data-testid="stSidebar"] p,
        [data-testid="stSidebar"] span {
            color: #c1c8ca !important;
        }

        [data-testid="stSidebar"] [data-testid="stWidgetLabel"] p {
            color: var(--oft-text) !important;
            font-size: 1.31rem !important;
            line-height: 1.2 !important;
            font-weight: 700 !important;
            text-shadow: 0 0 18px rgba(97, 230, 242, 0.28);
        }

        h1, h2, h3, .stMarkdown h1, .stMarkdown h2, .stMarkdown h3 {
            color: var(--oft-text);
            letter-spacing: 0;
            text-shadow: 0 0 18px rgba(97, 230, 242, 0.28);
        }

        [data-testid="stCaptionContainer"], .stMarkdown p, label, .stRadio label {
            color: var(--oft-muted);
        }

        div[data-testid="stVerticalBlockBorderWrapper"],
        div[data-testid="stExpander"],
        div[data-testid="stDataFrame"],
        div[data-testid="stForm"] {
            border-color: var(--oft-border) !important;
            background: var(--oft-panel);
            box-shadow: 0 10px 36px rgba(0, 8, 28, 0.24), inset 0 1px 0 rgba(97, 230, 242, 0.12);
        }

        .stButton > button,
        .stFormSubmitButton > button,
        [data-testid="stBaseButton-primary"],
        [data-testid="stBaseButton-secondary"] {
            border: 1px solid rgba(97, 230, 242, 0.55);
            background: linear-gradient(135deg, rgba(24, 73, 154, 0.96), rgba(27, 171, 192, 0.82));
            color: #effeff;
            box-shadow: 0 0 18px rgba(97, 230, 242, 0.22);
        }

        .stButton > button:hover,
        .stFormSubmitButton > button:hover {
            border-color: rgba(175, 250, 255, 0.95);
            box-shadow: 0 0 28px rgba(97, 230, 242, 0.36);
            color: #ffffff;
        }

        input, textarea, [data-baseweb="select"] > div {
            background-color: rgba(5, 18, 43, 0.78) !important;
            border-color: rgba(97, 230, 242, 0.32) !important;
            color: var(--oft-text) !important;
        }

        [data-testid="stDataFrame"] {
            border-radius: 8px;
            overflow: hidden;
        }

        [data-testid="stMetricValue"], code {
            color: var(--oft-cyan);
        }

        div[data-testid="stAlert"] {
            border-radius: 8px;
            border: 1px solid rgba(97, 230, 242, 0.3);
            background-color: rgba(6, 20, 47, 0.9);
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def ensure_state() -> None:
    st.session_state.setdefault("schwab_client", None)
    st.session_state.setdefault("discovery_results", None)
    st.session_state.setdefault("manual_tickers", ", ".join(DEFAULT_TICKERS))
    st.session_state.setdefault("last_screener_trades", [])


def client_ready() -> bool:
    return st.session_state.get("schwab_client") is not None


def parse_tickers(text: str) -> list[str]:
    return [part.strip().upper() for part in text.replace("\n", ",").split(",") if part.strip()]


def page_config() -> None:
    st.header("Configuration")
    st.caption("Credentials are kept in Streamlit session state. Token refreshes are managed by schwab-py at the token path.")

    with st.form("auth_form"):
        app_key = st.text_input("App Key", value=st.session_state.get("app_key", ""))
        app_secret = st.text_input("App Secret", value=st.session_state.get("app_secret", ""), type="password")
        callback_url = st.text_input("Callback URL", value=st.session_state.get("callback_url", "https://127.0.0.1:8182"))
        token_path = st.text_input("Token Path", value=st.session_state.get("token_path", "tokens/schwab_token.json"))
        force_login = st.checkbox("Force new login flow", value=False)
        submitted = st.form_submit_button("Authenticate")

    if submitted:
        st.session_state["app_key"] = app_key
        st.session_state["app_secret"] = app_secret
        st.session_state["callback_url"] = callback_url
        st.session_state["token_path"] = token_path
        try:
            st.session_state["schwab_client"] = create_client(
                SchwabCredentials(app_key, app_secret, callback_url, token_path),
                force_login=force_login,
            )
            st.success("Schwab client is authenticated and cached in session state.")
        except Exception as exc:
            st.error(f"Authentication failed: {exc}")

    with st.expander("OSI Formatter"):
        human = st.text_input("Human-readable option", value="SPY 450 Call 05/15/26")
        if st.button("Convert to OSI"):
            try:
                st.code(human_to_osi_symbol(human))
            except Exception as exc:
                st.warning(str(exc))


def discovery_controls(account_segment: str) -> None:
    st.header("Automated Strategy Discovery")
    if not client_ready():
        st.info("Authenticate in Configuration before running a live discovery scan.")
        return

    with st.expander("Advanced Discovery Settings"):
        universe_text = st.text_area("Universe", value=", ".join(TOP_LIQUID_UNIVERSE), height=140)
        top_symbols = st.slider("Symbols to fetch option chains for", 5, 20, 20)
        strike_count = st.slider("Strike count around ATM", 4, 30, 10)
        min_dte = st.number_input("Minimum DTE", min_value=1, max_value=120, value=7)
        max_dte = st.number_input("Maximum DTE", min_value=2, max_value=180, value=60)

    if st.button("Run Discovery Scan", type="primary"):
        with st.spinner("Scanning quotes, ranking IV Rank, and fetching option chains..."):
            st.session_state["discovery_results"] = run_discovery(
                st.session_state["schwab_client"],
                account_segment=account_segment,
                universe=parse_tickers(universe_text),
                top_symbols=top_symbols,
                strike_count=strike_count,
                min_dte=int(min_dte),
                max_dte=int(max_dte),
            )
        st.success("Discovery scan completed.")

    results = st.session_state.get("discovery_results")
    if not results:
        return

    top_count = st.selectbox("Top List", [5, 10, 15, 20], index=0)
    st.subheader("Highest IV Rank Symbols")
    st.dataframe(pd.DataFrame(results["ranked_symbols"]).head(20), use_container_width=True, hide_index=True)
    st.subheader(f"Top {top_count} Trades")
    st.dataframe(trades_dataframe(results["trades"][:top_count]), use_container_width=True, hide_index=True)


def _trade_action_panel(trades: list[dict[str, Any]]) -> None:
    if not trades:
        return
    st.subheader("Stage Order")
    labels = [f"{idx}: {t['ticker']} {t['strategy']} {t['strikes']} {t['expiration']} {t['success']}" for idx, t in enumerate(trades)]
    selected_label = st.selectbox("Candidate", labels)
    selected = trades[int(selected_label.split(":")[0])]
    quantity = st.number_input("Contracts", min_value=1, max_value=100, value=1)
    paper_trade = st.checkbox("Paper Trade", value=True)
    live_ack = st.checkbox("I understand live submission sends an order to Schwab", value=False, disabled=paper_trade)

    try:
        order_json = build_spread_order_json(selected, quantity=int(quantity))
        st.json(order_json, expanded=False)
    except Exception as exc:
        st.error(f"Could not build order JSON: {exc}")
        return

    c1, c2 = st.columns(2)
    with c1:
        if st.button("Stage / Save Trade"):
            status = "PAPER" if paper_trade else "Open"
            trade_type = "Paper" if paper_trade else "Live"
            trade_id = insert_trade(selected, trade_type=trade_type, status=status, order_json=order_json)
            st.success(f"Trade saved to SQLite with id {trade_id}.")
    with c2:
        account_hash = st.text_input("Account Hash for live submit")
        if st.button("Submit Live Order", disabled=paper_trade or not live_ack or not client_ready()):
            if not account_hash:
                st.warning("Enter an account hash before submitting.")
            else:
                response = place_order(st.session_state["schwab_client"], account_hash, order_json)
                insert_trade(selected, trade_type="Live", status="Open", order_json=order_json)
                st.write(response or "Order request sent; no response body returned.")


def page_screener(account_segment: str) -> None:
    st.header("Strategic Options Screener")
    source = st.radio("Ticker Source", ["Manual Entry", "Discovery Results"], horizontal=True)
    if source == "Discovery Results" and st.session_state.get("discovery_results"):
        tickers = st.session_state["discovery_results"]["selected_symbols"]
        if st.button("Replace Manual List With Discovery Symbols"):
            st.session_state["manual_tickers"] = ", ".join(tickers)
        st.write(", ".join(tickers))
    else:
        tickers = parse_tickers(st.text_area("Tickers", key="manual_tickers", height=90))

    strategy_options = SWING_STRATEGIES if account_segment == "Swing" else STANDARD_STRATEGIES
    selected_strategies = st.pills("Strategies", strategy_options, default=strategy_options, selection_mode="multi")
    if not selected_strategies:
        st.warning("Select at least one strategy chip to run the screener.")
    with st.expander("Advanced Screener Settings"):
        strike_count = st.slider("Strike count", 4, 30, 12)
        min_dte = st.number_input("Min DTE", min_value=1, max_value=120, value=7 if account_segment == "Swing" else 14)
        max_dte = st.number_input("Max DTE", min_value=2, max_value=180, value=45 if account_segment == "Swing" else 60)

    if st.button("Run Screener", type="primary"):
        if not selected_strategies:
            st.error("Select at least one strategy before running the screener.")
            return
        if not client_ready():
            st.error("Authenticate in Configuration first.")
            return
        all_trades: list[dict[str, Any]] = []
        from_date = dt.date.today() + dt.timedelta(days=max(0, int(min_dte) - 2))
        to_date = dt.date.today() + dt.timedelta(days=int(max_dte) + 5)
        with st.spinner("Fetching option chains and ranking candidates..."):
            for ticker in tickers:
                chain = get_option_chain(
                    st.session_state["schwab_client"],
                    ticker,
                    strike_count=int(strike_count),
                    from_date=from_date,
                    to_date=to_date,
                    strategy="SINGLE",
                )
                all_trades.extend(
                    generate_trades_from_chain(
                        ticker,
                        chain,
                        account_segment=account_segment,
                        min_dte=int(min_dte),
                        max_dte=int(max_dte),
                        include_strategies=selected_strategies,
                    )
                )
        st.session_state["last_screener_trades"] = sorted(all_trades, key=lambda item: item.get("score", 0), reverse=True)

    trades = st.session_state.get("last_screener_trades", [])
    st.dataframe(trades_dataframe(trades), use_container_width=True, hide_index=True)
    _trade_action_panel(trades)


def page_trade_log() -> None:
    st.header("Trade Log")
    df = list_trades()
    st.dataframe(df, use_container_width=True, hide_index=True)

    with st.expander("Update Exit / Closing Greeks"):
        trade_id = st.number_input("Trade ID", min_value=1, step=1)
        exit_price = st.number_input("Exit Price", min_value=0.0, step=0.01)
        exit_delta = st.number_input("Exit Delta", value=0.0, step=0.01)
        exit_theta = st.number_input("Exit Theta", value=0.0, step=0.01)
        exit_gamma = st.number_input("Exit Gamma", value=0.0, step=0.01)
        if st.button("Close Trade"):
            update_exit(int(trade_id), exit_price=exit_price, exit_delta=exit_delta, exit_theta=exit_theta, exit_gamma=exit_gamma)
            st.success("Trade updated.")

    with st.expander("Paper Backtest Utility"):
        price_text = st.text_area("Current theoretical prices by ticker, one per line: TICKER=PRICE", height=90)
        prices: dict[str, float] = {}
        for line in price_text.splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                try:
                    prices[key.strip().upper()] = float(value.strip())
                except ValueError:
                    pass
        if st.button("Calculate Theoretical P/L"):
            st.dataframe(backtest_paper_trades(prices), use_container_width=True, hide_index=True)


def page_portfolio() -> None:
    st.header("Portfolio Dashboard")
    if not client_ready():
        st.info("Authenticate in Configuration first.")
        return
    if st.button("Refresh Portfolio", type="primary"):
        balances, positions = fetch_portfolio(st.session_state["schwab_client"])
        st.session_state["portfolio_balances"] = balances
        st.session_state["portfolio_positions"] = positions
    balances = st.session_state.get("portfolio_balances", pd.DataFrame())
    positions = st.session_state.get("portfolio_positions", pd.DataFrame())
    st.subheader("Balances")
    st.dataframe(balances, use_container_width=True, hide_index=True)
    st.subheader("Positions")
    st.dataframe(positions, use_container_width=True, hide_index=True)
    for message in expiring_risk_alerts(positions):
        st.error(message)
        st.toast(message, icon="!")


def main() -> None:
    ensure_state()
    apply_theme()
    st.title("Professional Options Trading Suite")
    st.caption("Defined-risk discovery, Schwab staging, paper logging, and portfolio risk monitoring.")
    account_choice = st.sidebar.radio("Account Segment", ["Standard (+$25k)", "Swing (<$25k)"])
    account_segment = "Standard" if account_choice.startswith("Standard") else "Swing"
    page = st.sidebar.radio("Page", ["Configuration", "Discovery", "Screener", "Trade Log", "Portfolio", "Help/Docs"])

    if st.sidebar.button("Clear cached scan"):
        st.session_state["discovery_results"] = None
        st.session_state["last_screener_trades"] = []

    if page == "Configuration":
        page_config()
    elif page == "Discovery":
        discovery_controls(account_segment)
    elif page == "Screener":
        page_screener(account_segment)
    elif page == "Trade Log":
        page_trade_log()
    elif page == "Portfolio":
        page_portfolio()
    else:
        st.markdown(HELP_MARKDOWN)


if __name__ == "__main__":
    main()
