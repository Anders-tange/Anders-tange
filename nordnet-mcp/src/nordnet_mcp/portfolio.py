"""Portfolio calculations on top of parsed Nordnet transactions.

Cost basis uses the average-cost method (gennemsnitsmetoden), which is also
what Danish tax rules use for shares. All money figures are in the account's
own currency (the "Beløb" currency of the export, typically DKK).
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import Iterable, Optional

from .parser import Transaction

QTY_IN = {"buy", "security_in", "dividend_reinvest"}
QTY_OUT = {"sell", "security_out"}
EPS = 1e-9


def active(txs: Iterable[Transaction]) -> list[Transaction]:
    """Drop cancelled (makulerede) transactions."""
    return [t for t in txs if t.cancel_date is None]


def filter_txs(
    txs: Iterable[Transaction],
    account: Optional[str] = None,
    year: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> list[Transaction]:
    out = []
    acc = account.strip().lower() if account else None
    for t in txs:
        if acc and t.account.lower() != acc:
            continue
        d = t.date
        if year and (d is None or d.year != year):
            continue
        if from_date and (d is None or d < from_date):
            continue
        if to_date and (d is None or d > to_date):
            continue
        out.append(t)
    return out


def account_currency(txs: list[Transaction]) -> dict[str, str]:
    counts: dict[str, Counter] = defaultdict(Counter)
    for t in txs:
        if t.amount_currency:
            counts[t.account][t.amount_currency] += 1
    return {acc: c.most_common(1)[0][0] for acc, c in counts.items()}


@dataclass
class Position:
    account: str
    isin: str
    name: str
    quantity: float = 0.0
    cost_basis: float = 0.0  # in account currency
    currency: str = ""  # account currency
    instrument_currency: str = ""
    last_trade_price: Optional[float] = None
    last_trade_date: Optional[date] = None
    realized: list[dict] = field(default_factory=list)
    cost_unknown: bool = False

    @property
    def avg_cost(self) -> Optional[float]:
        return self.cost_basis / self.quantity if self.quantity > EPS else None

    def to_dict(self) -> dict:
        return {
            "account": self.account,
            "name": self.name,
            "isin": self.isin,
            "quantity": round(self.quantity, 6),
            "avg_cost": round(self.avg_cost, 4) if self.avg_cost is not None else None,
            "cost_basis": round(self.cost_basis, 2),
            "currency": self.currency,
            "instrument_currency": self.instrument_currency or None,
            "last_trade_price": self.last_trade_price,
            "last_trade_date": self.last_trade_date.isoformat() if self.last_trade_date else None,
            **({"warning": "Cost basis incomplete (securities transferred in without purchase value)"} if self.cost_unknown else {}),
        }


def build_positions(txs: list[Transaction]) -> dict[tuple[str, str], Position]:
    """Replay transactions chronologically to get positions and realized gains."""
    currencies = account_currency(txs)
    positions: dict[tuple[str, str], Position] = {}
    for t in active(txs):
        if not t.isin:
            continue
        key = (t.account, t.isin)
        pos = positions.get(key)
        if pos is None:
            pos = positions[key] = Position(account=t.account, isin=t.isin, name=t.security, currency=currencies.get(t.account, ""))
        if t.security:
            pos.name = t.security
        if t.price_currency:
            pos.instrument_currency = t.price_currency

        q = abs(t.quantity) if t.quantity is not None else 0.0
        before = pos.quantity

        if t.category in QTY_IN:
            if t.category == "buy":
                if t.amount is not None:
                    cost = abs(t.amount)
                elif t.price is not None:
                    cost = q * t.price * (t.fx_rate or 1.0) + abs(t.fees or 0.0)
                else:
                    cost = 0.0
                    pos.cost_unknown = True
            elif t.purchase_value is not None:
                cost = abs(t.purchase_value)
            elif t.category == "dividend_reinvest" and t.amount is not None:
                cost = abs(t.amount)
            else:
                cost = 0.0
                pos.cost_unknown = True
            pos.cost_basis += cost
            pos.quantity = before + q
            if t.price is not None:
                pos.last_trade_price, pos.last_trade_date = t.price, t.date
        elif t.category in QTY_OUT:
            avg = pos.cost_basis / before if before > EPS else 0.0
            sold_cost = avg * min(q, before) if before > EPS else 0.0
            pos.cost_basis -= sold_cost
            pos.quantity = max(before - q, 0.0)
            if t.category == "sell":
                proceeds = abs(t.amount) if t.amount is not None else q * (t.price or 0.0) * (t.fx_rate or 1.0)
                pos.realized.append({
                    "date": t.date.isoformat() if t.date else None,
                    "account": t.account,
                    "name": pos.name,
                    "isin": t.isin,
                    "quantity": q,
                    "price": t.price,
                    "proceeds": round(proceeds, 2),
                    "cost_basis": round(sold_cost, 2),
                    "gain": round(proceeds - sold_cost, 2),
                    "nordnet_result": t.result,
                    "currency": pos.currency,
                    **({"warning": "Sold more than known holding — export may be missing older transactions"} if q > before + EPS else {}),
                })
            if t.price is not None:
                pos.last_trade_price, pos.last_trade_date = t.price, t.date

        # Nordnet's own running quantity is authoritative when present. This also
        # covers splits and other corporate actions: quantity changes, cost basis is kept.
        if t.total_quantity is not None and t.category not in ("dividend", "dividend_tax"):
            pos.quantity = abs(t.total_quantity)

        if pos.quantity <= EPS:
            pos.quantity = 0.0
            pos.cost_basis = 0.0
    return positions


def current_holdings(txs: list[Transaction]) -> list[Position]:
    return sorted(
        (p for p in build_positions(txs).values() if p.quantity > EPS),
        key=lambda p: (p.account, p.name.lower()),
    )


def realized_gains(txs: list[Transaction], year: Optional[int] = None) -> list[dict]:
    events = [e for p in build_positions(txs).values() for e in p.realized]
    if year:
        events = [e for e in events if e["date"] and e["date"].startswith(str(year))]
    return sorted(events, key=lambda e: e["date"] or "")


def cash_balances(txs: list[Transaction]) -> dict[str, Optional[float]]:
    """Latest 'Saldo' per account (cash balance after the most recent transaction)."""
    latest: dict[str, Transaction] = {}
    for t in active(txs):
        if t.balance is None:
            continue
        latest[t.account] = t  # txs are pre-sorted chronologically
    return {acc: t.balance for acc, t in latest.items()}


def _period_key(d: Optional[date], group_by: str) -> str:
    if d is None:
        return "unknown"
    return str(d.year) if group_by == "year" else f"{d.year}-{d.month:02d}"


def dividends(txs: list[Transaction], group_by: str = "instrument") -> dict:
    gross: dict[str, float] = defaultdict(float)
    tax: dict[str, float] = defaultdict(float)
    names: dict[str, str] = {}
    count: Counter = Counter()
    currencies = set()
    for t in active(txs):
        if t.category not in ("dividend", "dividend_tax") or t.amount is None:
            continue
        if group_by == "instrument":
            key = t.isin or t.security or "unknown"
            names[key] = t.security
        else:
            key = _period_key(t.date, group_by)
        if t.category == "dividend":
            gross[key] += t.amount
            count[key] += 1
        else:
            tax[key] += t.amount
        if t.amount_currency:
            currencies.add(t.amount_currency)

    rows = []
    for key in sorted(set(gross) | set(tax)):
        row = {
            "gross": round(gross[key], 2),
            "withholding_tax": round(tax[key], 2),
            "net": round(gross[key] + tax[key], 2),
            "payments": count[key],
        }
        if group_by == "instrument":
            row = {"name": names.get(key), "isin": key, **row}
        else:
            row = {"period": key, **row}
        rows.append(row)
    if group_by == "instrument":
        rows.sort(key=lambda r: -r["net"])
    total_gross = sum(gross.values())
    total_tax = sum(tax.values())
    return {
        "group_by": group_by,
        "currency": ", ".join(sorted(currencies)) or None,
        "total_gross": round(total_gross, 2),
        "total_withholding_tax": round(total_tax, 2),
        "total_net": round(total_gross + total_tax, 2),
        "rows": rows,
    }


CASHFLOW_CATEGORIES = ("deposit", "withdrawal", "interest", "fee", "tax")


def cashflows(txs: list[Transaction], group_by: str = "year") -> dict:
    table: dict[str, dict[str, float]] = defaultdict(lambda: {c: 0.0 for c in CASHFLOW_CATEGORIES})
    for t in active(txs):
        if t.category in CASHFLOW_CATEGORIES and t.amount is not None:
            table[_period_key(t.date, group_by)][t.category] += t.amount
    rows = []
    totals = {c: 0.0 for c in CASHFLOW_CATEGORIES}
    for period in sorted(table):
        vals = table[period]
        for c in CASHFLOW_CATEGORIES:
            totals[c] += vals[c]
        rows.append({
            "period": period,
            **{c: round(vals[c], 2) for c in CASHFLOW_CATEGORIES},
            "net_deposited": round(vals["deposit"] + vals["withdrawal"], 2),
        })
    return {
        "group_by": group_by,
        "totals": {**{c: round(v, 2) for c, v in totals.items()}, "net_deposited": round(totals["deposit"] + totals["withdrawal"], 2)},
        "rows": rows,
    }
