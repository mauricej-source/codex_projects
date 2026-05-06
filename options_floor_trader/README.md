# Options Floor Trader

Options Floor Trader is a Streamlit-based options trading suite for Schwab users. It combines options strategy discovery, mathematical trade ranking, staged order construction, paper trade logging, portfolio visibility, and expiration risk alerts in one local application.

The application is designed for defined-risk options workflows, with separate logic paths for Standard accounts over $25k and Swing accounts under $25k.

## Project Description

Options Floor Trader helps a trader scan liquid symbols, evaluate option strategies, rank candidate trades, and log decisions before placing live orders. The app uses `schwab-py` for Schwab authentication and market/account data, then applies a local math engine to calculate:

- Probability of Profit
- Expected Value
- IV Rank
- Capital Efficiency
- Success rating: HIGH, MEDIUM, or LOW

The project is intentionally modular. API access, mathematical scoring, strategy generation, portfolio monitoring, trade logging, and UI behavior are separated into dedicated modules under `options_suite/`.

## Application Behavior

The app provides six primary pages:

- **Configuration**: Accepts Schwab App Key, App Secret, Callback URL, and Token Path. It creates and stores an authenticated `schwab-py` client in `st.session_state`.
- **Discovery**: Scans a preset universe of liquid ETFs and equities, ranks symbols by IV Rank, fetches option chains for the highest-ranked symbols, and displays Top 5, 10, 15, or 20 trade candidates.
- **Screener**: Supports manual ticker entry or discovery-generated tickers. It screens option chains using Standard or Swing account logic.
- **Trade Log**: Saves staged, paper, and live trade records to SQLite with entry prices, Greeks, volatility context, status, exit fields, and staged order JSON.
- **Portfolio**: Fetches Schwab account balances and positions, displays open P/L and DTE, and raises high-visibility alerts for option positions at 2 DTE or less.
- **Help/Docs**: Explains app usage, core definitions, component behavior, and how to interpret success ratings.

Paper trading is supported through a checkbox in the screener. When enabled, staged trades are saved locally with `status='PAPER'` and no live order is submitted.

## Application Help

The built-in Help/Docs page describes:

- The purpose of the app as a swing-oriented options screener
- How Configuration, Discovery, Screener, Trade Log, and Portfolio pages work
- Definitions for Delta, Theta, IV Rank, POP, EV, and Capital Efficiency
- How to adjust filters and interpret HIGH, MEDIUM, and LOW success ratings
- Why paper logging is useful before live Schwab order submission

The app also includes an OSI formatter in the Configuration page. For example:

```text
SPY 450 Call 05/15/26 -> SPY   260515C00450000
```

## Project Stack of Technology

- **Python 3.10+**
- **Streamlit** for the web application UI
- **schwab-py** for Schwab OAuth, quotes, option chains, account data, and order staging support
- **Pandas** for tabular display and data manipulation
- **SQLite3** for local trade logging
- **Python logging** with rotating log files for API errors and portfolio risk alerts

## How to Build & Run the Project

From the project root:

```powershell
cd C:\ws_openai_ws\options_floor_trader
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

Then open:

```text
http://localhost:8501
```

To authenticate with Schwab:

1. Create or use an approved Schwab developer application.
2. Enter the App Key, App Secret, Callback URL, and Token Path in the Configuration page.
3. Click **Authenticate**.
4. Complete the OAuth browser flow.
5. The token file will be reused and refreshed by `schwab-py` when possible.

The local SQLite trade log is created automatically as:

```text
trade_log.sqlite3
```

Application logs are written to:

```text
logs/options_suite.log
```

## Reference Materials Required to Understand the Project

Useful references:

- `schwab-py` Authentication and Client Creation: https://schwab-py.readthedocs.io/en/latest/auth.html
- `schwab-py` HTTP Client reference: https://schwab-py.readthedocs.io/en/stable/client.html
- `schwab-py` OrderBuilder reference: https://schwab-py.readthedocs.io/en/latest/order-builder.html
- `schwab-py` Option Order Templates and `OptionSymbol`: https://schwab-py.readthedocs.io/en/stable/order-templates.html
- Schwab Trader API developer portal: https://developer.schwab.com/
- Streamlit documentation: https://docs.streamlit.io/
- OCC options education: https://www.optionseducation.org/

Core project files:

- `app.py`: Streamlit application entry point
- `options_suite/schwab_client.py`: Schwab auth, API calls, OSI formatting, and order staging
- `options_suite/engine.py`: POP, EV, IV Rank, Capital Efficiency, and success rating helpers
- `options_suite/discovery.py`: Automated liquid-universe discovery scan
- `options_suite/screener.py`: Strategy generation and ranking
- `options_suite/trade_log.py`: SQLite persistence and paper trade backtest utility
- `options_suite/portfolio.py`: Account/position summaries and DTE risk alerts
- `options_suite/help_docs.py`: In-app help content

## Important Notes

This application is a decision-support and logging tool. It does not guarantee trade outcomes, bypass Schwab account permissions, or remove regulatory constraints such as pattern day trading rules. Live order submission requires valid Schwab credentials, an authorized account, and appropriate options trading approval.
