"""Price providers for valuing holdings.

Priority order (first hit wins):
  1. prices.csv in the data folder — manual prices you maintain yourself
  2. Yahoo Finance via `yfinance` (optional dependency), with ISIN -> ticker
     resolved from symbols.json or Yahoo's search

Each provider is synchronous; the server runs them in a worker thread.
"""

from __future__ import annotations

import csv
import json
import logging
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional, Protocol

from .parser import decode_bytes, parse_date, parse_number

log = logging.getLogger(__name__)


@dataclass
class Quote:
    price: float
    currency: str
    source: str
    symbol: Optional[str] = None
    name: Optional[str] = None
    as_of: Optional[str] = None
    change_pct_1d: Optional[float] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


class PriceProvider(Protocol):
    name: str

    def quote(self, isin: Optional[str] = None, symbol: Optional[str] = None) -> Optional[Quote]: ...

    def fx_rate(self, from_ccy: str, to_ccy: str) -> Optional[float]: ...


class ManualPrices:
    """prices.csv with columns: isin;price;currency[;date]  (delimiter ; , or tab)."""

    name = "manual"

    def __init__(self, path: Path):
        self.path = path
        self._prices: dict[str, Quote] = {}
        self._fx: dict[tuple[str, str], float] = {}
        self.reload()

    def reload(self) -> None:
        self._prices.clear()
        self._fx.clear()
        if not self.path.exists():
            return
        text = decode_bytes(self.path.read_bytes())
        first = text.splitlines()[0] if text else ""
        delim = max(("\t", ";", ","), key=first.count)
        for row in csv.DictReader(text.splitlines(), delimiter=delim):
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
            key = (row.get("isin") or row.get("symbol") or "").upper()
            price = parse_number(row.get("price") or row.get("kurs") or "")
            if not key or price is None:
                continue
            ccy = (row.get("currency") or row.get("valuta") or "").upper()
            d = parse_date(row.get("date") or row.get("dato") or "")
            # FX rows: isin like "USDDKK"
            if len(key) == 6 and key.isalpha():
                self._fx[(key[:3], key[3:])] = price
                continue
            self._prices[key] = Quote(price=price, currency=ccy, source="manual (prices.csv)",
                                      as_of=d.isoformat() if d else None)

    def quote(self, isin: Optional[str] = None, symbol: Optional[str] = None) -> Optional[Quote]:
        for key in (isin, symbol):
            if key and key.upper() in self._prices:
                return self._prices[key.upper()]
        return None

    def fx_rate(self, from_ccy: str, to_ccy: str) -> Optional[float]:
        if (from_ccy, to_ccy) in self._fx:
            return self._fx[(from_ccy, to_ccy)]
        if (to_ccy, from_ccy) in self._fx:
            return 1.0 / self._fx[(to_ccy, from_ccy)]
        return None


class YahooPrices:
    """Delayed quotes from Yahoo Finance via the optional `yfinance` package."""

    name = "yahoo"
    TTL = 300  # seconds

    def __init__(self, symbols_path: Path):
        import yfinance  # noqa: F401  - fail fast if not installed

        self.symbols_path = symbols_path
        self._symbols: dict[str, str] = {}
        self._cache: dict[str, tuple[float, Optional[Quote]]] = {}
        self.reload()

    def reload(self) -> None:
        self._symbols = {}
        if self.symbols_path.exists():
            data = json.loads(self.symbols_path.read_text(encoding="utf-8"))
            self._symbols = {k.upper(): v for k, v in data.items() if not k.startswith("_")}
        self._cache.clear()

    def resolve_symbol(self, isin: Optional[str], symbol: Optional[str]) -> Optional[str]:
        if isin and isin.upper() in self._symbols:
            return self._symbols[isin.upper()]
        if symbol:
            return symbol
        if not isin:
            return None
        import yfinance as yf

        try:
            res = yf.Search(isin, max_results=5, news_count=0)
            quotes = getattr(res, "quotes", None) or []
        except Exception as exc:  # noqa: BLE001
            log.warning("Yahoo search failed for %s: %s", isin, exc)
            return None
        if not quotes:
            return None
        # Prefer Nordic listings when Yahoo returns several
        preferred = (".CO", ".ST", ".OL", ".HE")
        quotes.sort(key=lambda q: 0 if str(q.get("symbol", "")).endswith(preferred) else 1)
        found = quotes[0].get("symbol")
        if found:
            self._symbols[isin.upper()] = found
        return found

    def _fetch(self, ticker: str) -> Optional[Quote]:
        now = time.time()
        hit = self._cache.get(ticker)
        if hit and now - hit[0] < self.TTL:
            return hit[1]
        import yfinance as yf

        quote: Optional[Quote] = None
        try:
            t = yf.Ticker(ticker)
            fi = t.fast_info
            price = fi.get("lastPrice") if hasattr(fi, "get") else fi.last_price
            prev = fi.get("previousClose") if hasattr(fi, "get") else fi.previous_close
            ccy = fi.get("currency") if hasattr(fi, "get") else fi.currency
            if price:
                quote = Quote(
                    price=round(float(price), 4),
                    currency=(ccy or "").upper(),
                    source="yahoo (delayed)",
                    symbol=ticker,
                    as_of=time.strftime("%Y-%m-%dT%H:%M:%S"),
                    change_pct_1d=round((price / prev - 1) * 100, 2) if prev else None,
                )
                # Yahoo quotes London listings in pence
                if quote.currency in ("GBP", "GBX") and ccy == "GBp":
                    quote.price /= 100
                    quote.currency = "GBP"
        except Exception as exc:  # noqa: BLE001
            log.warning("Yahoo quote failed for %s: %s", ticker, exc)
        self._cache[ticker] = (now, quote)
        return quote

    def quote(self, isin: Optional[str] = None, symbol: Optional[str] = None) -> Optional[Quote]:
        ticker = self.resolve_symbol(isin, symbol)
        return self._fetch(ticker) if ticker else None

    def fx_rate(self, from_ccy: str, to_ccy: str) -> Optional[float]:
        q = self._fetch(f"{from_ccy}{to_ccy}=X")
        return q.price if q else None


class PriceService:
    def __init__(self, providers: list):
        self.providers = providers

    @property
    def names(self) -> list[str]:
        return [p.name for p in self.providers]

    def reload(self) -> None:
        for p in self.providers:
            if hasattr(p, "reload"):
                p.reload()

    def quote(self, isin: Optional[str] = None, symbol: Optional[str] = None) -> Optional[Quote]:
        for p in self.providers:
            q = p.quote(isin=isin, symbol=symbol)
            if q:
                return q
        return None

    def fx_rate(self, from_ccy: str, to_ccy: str) -> Optional[float]:
        if not from_ccy or not to_ccy or from_ccy == to_ccy:
            return 1.0
        for p in self.providers:
            r = p.fx_rate(from_ccy, to_ccy)
            if r:
                return r
        return None


def build_price_service(data_dir: Path, provider_setting: str = "yahoo") -> tuple[PriceService, list[str]]:
    """Returns (service, warnings)."""
    warnings: list[str] = []
    providers: list = [ManualPrices(data_dir / "prices.csv")]
    if provider_setting.lower() == "yahoo":
        try:
            providers.append(YahooPrices(data_dir / "symbols.json"))
        except ImportError:
            warnings.append("yfinance is not installed — live prices disabled. Install with: pip install 'nordnet-mcp[yahoo]'")
    return PriceService(providers), warnings
