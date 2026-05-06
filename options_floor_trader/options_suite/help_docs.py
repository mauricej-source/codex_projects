HELP_MARKDOWN = """
## App Overview

This suite is a Schwab-connected options screener for swing-oriented options trades. It is designed to help a trader identify defined-risk option structures, compare premium, volatility context, probability, and capital efficiency, then stage or paper-log trades without forcing a day-trading workflow.

For smaller accounts, the Swing segment emphasizes 7-45 DTE structures and paper logging so users can avoid pattern day trading pressure. It does not remove PDT rules or margin requirements; it gives the trader a slower decision loop and a local audit trail.

## Component Guide

**Configuration** stores Schwab app credentials in session state and creates a `schwab-py` client with OAuth2 token-file reuse and automatic refresh.

**Discovery** scans a liquid universe, ranks symbols by IV Rank, fetches option chains for the top 20, and produces Top 5, 10, 15, or 20 candidate trades.

**Screener** accepts manual tickers or discovery-selected symbols. It applies Standard or Swing account filters and ranks each candidate with POP, EV, IV Rank, and capital efficiency.

**Trade Log** writes staged and paper trades to SQLite with prices, Greeks, IV context, status, and staged order JSON. Exit fields let you compare actual or theoretical outcomes against the screener signal.

**Portfolio** reads live Schwab balances and positions. Any option position at 2 DTE or less triggers a visible alert and writes a warning to the application log.

## Definitions

**Delta** measures directional exposure. For short options, lower absolute delta generally means the strike is further out of the money.

**Theta** estimates daily time decay. Positive collected theta benefits short-premium positions, while debit spreads typically pay theta.

**IV Rank** compares current implied volatility against its 52-week range: `(Current IV - 52 Week Low IV) / (52 Week High IV - 52 Week Low IV) * 100`. Higher IV Rank means option premium is expensive relative to its recent history.

**POP** means Probability of Profit. This app uses conservative approximations: credit spreads use `1 - (Short Delta * 1.1)`, while debit spreads use `Long Delta - Short Delta`.

**EV** means Expected Value: `(POP * Max Profit) - ((1 - POP) * Max Loss)`. A HIGH rating requires positive EV.

**Capital Efficiency** is `(EV / Buying Power Required) * 100`, useful when comparing trades for accounts under $25k.

## User Guide

1. Open Configuration, enter App Key, App Secret, Callback URL, and Token Path, then authenticate.
2. Choose Standard or Swing account mode.
3. Run Discovery to fill the session with ranked candidates, or type tickers manually in the Screener.
4. Adjust DTE and strike-count settings inside Advanced Settings.
5. Interpret Success as a rule-based classification, not a guarantee. HIGH means the trade satisfies the app's EV, POP, delta, volatility, and account-segment rules.
6. Use Paper Trade when validating the model. This saves to SQLite without submitting to Schwab.
7. Review Portfolio before live order submission, especially for open option positions nearing expiration.
"""
