"""Nordnet MCP server: portfolio insight from Nordnet CSV exports + delayed prices.

Configuration (environment variables):
  NORDNET_DATA_DIR        folder with Nordnet transaction exports (*.csv). Default: ~/nordnet-data
  NORDNET_PRICE_PROVIDER  "yahoo" (default) or "none" (only prices.csv)
  NORDNET_BASE_CURRENCY   currency for portfolio totals. Default: DKK
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
from datetime import date
from pathlib import Path
from typing import Annotated, Literal, Optional

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from . import portfolio as pf
from .parser import Transaction, load_directory
from .prices import PriceService, build_price_service

logging.basicConfig(level=os.environ.get("NORDNET_LOG_LEVEL", "WARNING"))

READ_ONLY = {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False}
READ_ONLY_WEB = {**READ_ONLY, "openWorldHint": True}

mcp = FastMCP(
    "nordnet_mcp",
    instructions=(
        "Read-only access to the user's Nordnet portfolio, built from transaction exports the user "
        "downloads from Nordnet (Konto > Transaktioner > Eksporter). Amounts are in the account "
        "currency (usually DKK). Prices are delayed. If data looks stale or empty, call "
        "nordnet_status and ask the user to export a fresh file into the data folder."
    ),
)


class State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.data_dir = Path(os.environ.get("NORDNET_DATA_DIR", "~/nordnet-data")).expanduser()
        self.base_currency = os.environ.get("NORDNET_BASE_CURRENCY", "DKK").upper()
        self.provider_setting = os.environ.get("NORDNET_PRICE_PROVIDER", "yahoo")
        self.txs: list[Transaction] = []
        self.file_report: list[dict] = []
        self.prices: Optional[PriceService] = None
        self.warnings: list[str] = []
        self.loaded = False

    def load(self) -> None:
        with self.lock:
            self.warnings = []
            if self.data_dir.is_dir():
                self.txs, self.file_report = load_directory(self.data_dir)
            else:
                self.txs, self.file_report = [], []
                self.warnings.append(f"Data folder {self.data_dir} does not exist. Create it and put Nordnet exports there.")
            self.prices, warn = build_price_service(self.data_dir, self.provider_setting)
            self.warnings += warn
            self.loaded = True

    def ensure(self) -> "State":
        if not self.loaded:
            self.load()
        return self


STATE = State()


def _no_data_error() -> dict:
    return {
        "error": "No Nordnet transactions loaded.",
        "how_to_fix": (
            f"Export transactions from Nordnet (Konto -> Transaktioner og notaer -> Eksporter, choose the full "
            f"period) and save the file in {STATE.data_dir}. Then call nordnet_reload."
        ),
        "files": STATE.file_report,
    }


def _date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError as exc:
        raise ValueError(f"Invalid date '{s}', use YYYY-MM-DD") from exc


def _txs(account: Optional[str] = None, **kw) -> list[Transaction]:
    st = STATE.ensure()
    txs = pf.filter_txs(st.txs, account=account, **kw)
    return txs


def _accounts_hint() -> list[str]:
    return sorted({t.account for t in STATE.ensure().txs})


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool(name="nordnet_status", annotations={"title": "Data status", **READ_ONLY})
def nordnet_status() -> dict:
    """Show where data is read from, which export files were loaded (or skipped and why),
    number of transactions, accounts, date range and which price sources are active.
    Call this first if other tools return no data."""
    st = STATE.ensure()
    dates = [t.date for t in st.txs if t.date]
    return {
        "data_dir": str(st.data_dir),
        "files": st.file_report,
        "transactions": len(st.txs),
        "accounts": _accounts_hint(),
        "first_date": min(dates).isoformat() if dates else None,
        "last_date": max(dates).isoformat() if dates else None,
        "price_sources": st.prices.names if st.prices else [],
        "base_currency": st.base_currency,
        "warnings": st.warnings,
    }


@mcp.tool(name="nordnet_reload", annotations={"title": "Reload exports", **READ_ONLY})
def nordnet_reload() -> dict:
    """Re-read all export files, prices.csv and symbols.json from the data folder.
    Use after the user has saved a new Nordnet export."""
    STATE.load()
    return nordnet_status()


@mcp.tool(name="nordnet_list_accounts", annotations={"title": "List accounts", **READ_ONLY})
def nordnet_list_accounts() -> dict:
    """List Nordnet accounts/depots found in the exports with currency, latest cash balance
    (Saldo), number of transactions and first/last transaction date."""
    st = STATE.ensure()
    if not st.txs:
        return _no_data_error()
    ccy = pf.account_currency(st.txs)
    cash = pf.cash_balances(st.txs)
    out = []
    for acc in _accounts_hint():
        txs = [t for t in st.txs if t.account == acc]
        dates = [t.date for t in txs if t.date]
        out.append({
            "account": acc,
            "currency": ccy.get(acc),
            "cash_balance": cash.get(acc),
            "transactions": len(txs),
            "first_date": min(dates).isoformat() if dates else None,
            "last_date": max(dates).isoformat() if dates else None,
        })
    return {"accounts": out}


def _value_holdings(positions: list[pf.Position], with_prices: bool) -> dict:
    st = STATE.ensure()
    rows = []
    totals: dict[str, dict[str, float]] = {}
    missing = []
    for p in positions:
        row = p.to_dict()
        if with_prices and st.prices:
            q = st.prices.quote(isin=p.isin)
            if q:
                fx = st.prices.fx_rate(q.currency, p.currency) if q.currency and p.currency else 1.0
                row["quote"] = q.to_dict()
                if fx is not None:
                    mv = p.quantity * q.price * fx
                    row["market_value"] = round(mv, 2)
                    row["unrealized_gain"] = round(mv - p.cost_basis, 2)
                    row["unrealized_pct"] = round((mv / p.cost_basis - 1) * 100, 2) if p.cost_basis > 0 else None
                    if fx != 1.0:
                        row["fx_rate"] = round(fx, 6)
                else:
                    row["warning"] = f"No FX rate {q.currency}->{p.currency}"
            else:
                missing.append(p.isin)
        t = totals.setdefault(p.currency or "?", {"cost_basis": 0.0, "market_value": 0.0, "priced_cost_basis": 0.0})
        t["cost_basis"] += p.cost_basis
        if "market_value" in row:
            t["market_value"] += row["market_value"]
            t["priced_cost_basis"] += p.cost_basis
        rows.append(row)

    total_mv = sum(r.get("market_value", 0.0) for r in rows)
    if total_mv > 0:
        for r in rows:
            if "market_value" in r:
                r["weight_pct"] = round(r["market_value"] / total_mv * 100, 2)

    summary = {
        ccy: {
            "cost_basis": round(v["cost_basis"], 2),
            **({"market_value": round(v["market_value"], 2),
                "unrealized_gain": round(v["market_value"] - v["priced_cost_basis"], 2)} if v["market_value"] else {}),
        }
        for ccy, v in totals.items()
    }
    result = {"positions": rows, "totals_by_currency": summary}
    if missing:
        result["unpriced_isins"] = missing
        result["hint"] = ("Add a ticker for these ISINs in symbols.json (e.g. {\"DK0062498333\": \"NOVO-B.CO\"}) "
                          "or a price in prices.csv, then call nordnet_reload.")
    return result


@mcp.tool(name="nordnet_get_holdings", annotations={"title": "Current holdings", **READ_ONLY_WEB})
async def nordnet_get_holdings(
    account: Annotated[Optional[str], Field(description="Account/depot number to filter on. Omit for all accounts.")] = None,
    with_prices: Annotated[bool, Field(description="Look up delayed market prices to compute market value and unrealized gain.")] = True,
) -> dict:
    """Current holdings per account: quantity, average cost, cost basis (incl. fees),
    and — with prices — market value, unrealized gain and portfolio weight."""
    txs = _txs(account)
    if not txs:
        return _no_data_error() if not STATE.txs else {"error": f"No transactions for account '{account}'", "accounts": _accounts_hint()}
    positions = pf.current_holdings(txs)
    return await asyncio.to_thread(_value_holdings, positions, with_prices)


@mcp.tool(name="nordnet_portfolio_summary", annotations={"title": "Portfolio summary", **READ_ONLY_WEB})
async def nordnet_portfolio_summary(
    account: Annotated[Optional[str], Field(description="Account/depot number. Omit for all accounts.")] = None,
) -> dict:
    """One-glance overview: total market value of holdings + cash, net deposited,
    total dividends, realized gains, unrealized gain and a simple total return
    (value - net deposited). Totals are in the base currency (default DKK)."""
    st = STATE.ensure()
    txs = _txs(account)
    if not txs:
        return _no_data_error() if not st.txs else {"error": f"No transactions for account '{account}'", "accounts": _accounts_hint()}

    def compute() -> dict:
        valued = _value_holdings(pf.current_holdings(txs), True)
        base = st.base_currency
        warnings = []

        def to_base(amount: float, ccy: str) -> float:
            if not ccy or ccy == base:
                return amount
            fx = st.prices.fx_rate(ccy, base) if st.prices else None
            if fx is None:
                warnings.append(f"No FX rate {ccy}->{base}; {ccy} amounts left unconverted")
                return amount
            return amount * fx

        acc_ccy = pf.account_currency(txs)
        holdings_value = 0.0
        cost_basis = 0.0
        for r in valued["positions"]:
            cost_basis += to_base(r["cost_basis"], r["currency"])
            if "market_value" in r:
                holdings_value += to_base(r["market_value"], r["currency"])
            else:
                holdings_value += to_base(r["cost_basis"], r["currency"])  # fall back to cost when unpriced
        cash = sum(to_base(v or 0.0, acc_ccy.get(a, base)) for a, v in pf.cash_balances(txs).items())
        flows = pf.cashflows(txs)["totals"]
        divs = pf.dividends(txs)
        realized = sum(e["gain"] for e in pf.realized_gains(txs))
        total_value = holdings_value + cash
        net_dep = flows["net_deposited"]
        return {
            "base_currency": base,
            "holdings_value": round(holdings_value, 2),
            "cash": round(cash, 2),
            "total_value": round(total_value, 2),
            "holdings_cost_basis": round(cost_basis, 2),
            "unrealized_gain": round(holdings_value - cost_basis, 2),
            "realized_gain": round(realized, 2),
            "dividends_net": divs["total_net"],
            "net_deposited": net_dep,
            "total_return": round(total_value - net_dep, 2),
            "total_return_pct": round((total_value / net_dep - 1) * 100, 2) if net_dep > 0 else None,
            "positions": len(valued["positions"]),
            "unpriced_isins": valued.get("unpriced_isins", []),
            "notes": [
                "total_return = total_value - net_deposited (simple, not time-weighted).",
                "Unpriced holdings are counted at cost basis.",
                "Securities transferred in from other brokers are not counted as deposits.",
            ],
            "warnings": sorted(set(warnings)),
        }

    return await asyncio.to_thread(compute)


@mcp.tool(name="nordnet_get_transactions", annotations={"title": "Search transactions", **READ_ONLY})
def nordnet_get_transactions(
    account: Annotated[Optional[str], Field(description="Account/depot number filter.")] = None,
    query: Annotated[Optional[str], Field(description="Free text matched against security name, ISIN, type and transaction text, e.g. 'novo' or 'DK0062498333'.")] = None,
    category: Annotated[Optional[Literal["buy", "sell", "dividend", "dividend_tax", "dividend_reinvest", "deposit", "withdrawal",
                                         "interest", "fee", "tax", "fx", "security_in", "security_out", "other"]],
                        Field(description="Normalized transaction category.")] = None,
    from_date: Annotated[Optional[str], Field(description="Earliest date, YYYY-MM-DD.")] = None,
    to_date: Annotated[Optional[str], Field(description="Latest date, YYYY-MM-DD.")] = None,
    limit: Annotated[int, Field(ge=1, le=500, description="Max rows to return.")] = 50,
    offset: Annotated[int, Field(ge=0, description="Rows to skip (pagination).")] = 0,
) -> dict:
    """List transactions newest first with filters and pagination. Cancelled
    (makulerede) transactions are excluded."""
    st = STATE.ensure()
    if not st.txs:
        return _no_data_error()
    txs = pf.active(_txs(account, from_date=_date(from_date), to_date=_date(to_date)))
    if category:
        txs = [t for t in txs if t.category == category]
    if query:
        q = query.lower()
        txs = [t for t in txs if q in " ".join((t.security, t.isin, t.raw_type, t.text)).lower()]
    txs = list(reversed(txs))
    page = txs[offset: offset + limit]
    return {
        "total": len(txs),
        "offset": offset,
        "count": len(page),
        "has_more": offset + len(page) < len(txs),
        "next_offset": offset + len(page) if offset + len(page) < len(txs) else None,
        "transactions": [t.to_dict() for t in page],
    }


@mcp.tool(name="nordnet_get_dividends", annotations={"title": "Dividends", **READ_ONLY})
def nordnet_get_dividends(
    year: Annotated[Optional[int], Field(ge=1990, le=2100, description="Only this calendar year.")] = None,
    account: Annotated[Optional[str], Field(description="Account/depot number filter.")] = None,
    group_by: Annotated[Literal["instrument", "month", "year"], Field(description="How to group the dividends.")] = "instrument",
) -> dict:
    """Dividends received: gross, withholding tax (udbytteskat) and net, grouped by
    instrument, month or year."""
    if not STATE.ensure().txs:
        return _no_data_error()
    return pf.dividends(_txs(account, year=year), group_by=group_by)


@mcp.tool(name="nordnet_get_realized_gains", annotations={"title": "Realized gains", **READ_ONLY})
def nordnet_get_realized_gains(
    year: Annotated[Optional[int], Field(ge=1990, le=2100, description="Only sales in this calendar year.")] = None,
    account: Annotated[Optional[str], Field(description="Account/depot number filter.")] = None,
) -> dict:
    """Realized gains/losses per sale using the average-cost method (gennemsnitsmetoden).
    Includes Nordnet's own 'Resultat' figure for comparison. Indicative only — not tax advice."""
    if not STATE.ensure().txs:
        return _no_data_error()
    # replay full history for correct cost basis, then filter on year
    events = pf.realized_gains(_txs(account), year=year)
    return {
        "year": year,
        "sales": events,
        "total_gain": round(sum(e["gain"] for e in events), 2),
        "total_proceeds": round(sum(e["proceeds"] for e in events), 2),
        "note": "Requires the export to cover the full history of each sold instrument for a correct cost basis.",
    }


@mcp.tool(name="nordnet_get_cashflows", annotations={"title": "Deposits and withdrawals", **READ_ONLY})
def nordnet_get_cashflows(
    year: Annotated[Optional[int], Field(ge=1990, le=2100, description="Only this calendar year.")] = None,
    account: Annotated[Optional[str], Field(description="Account/depot number filter.")] = None,
    group_by: Annotated[Literal["year", "month"], Field(description="Period grouping.")] = "year",
) -> dict:
    """Deposits, withdrawals, interest, fees and taxes per period, plus net deposited."""
    if not STATE.ensure().txs:
        return _no_data_error()
    return pf.cashflows(_txs(account, year=year), group_by=group_by)


@mcp.tool(name="nordnet_get_quote", annotations={"title": "Get quote", **READ_ONLY_WEB})
async def nordnet_get_quote(
    query: Annotated[str, Field(min_length=2, description="ISIN (e.g. 'DK0062498333') or Yahoo ticker (e.g. 'NOVO-B.CO', 'AAPL').")],
) -> dict:
    """Delayed price for an instrument by ISIN or ticker (from prices.csv or Yahoo Finance)."""
    st = STATE.ensure()
    q = query.strip()
    is_isin = len(q) == 12 and q[:2].isalpha() and q[2:].isalnum()

    def run():
        return st.prices.quote(isin=q if is_isin else None, symbol=None if is_isin else q) if st.prices else None

    quote = await asyncio.to_thread(run)
    if not quote:
        return {"error": f"No price found for '{q}'.", "price_sources": st.prices.names if st.prices else [],
                "hint": "Try a Yahoo ticker with exchange suffix (.CO Copenhagen, .ST Stockholm, .OL Oslo, .HE Helsinki)."}
    return {"query": q, **quote.to_dict()}


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
