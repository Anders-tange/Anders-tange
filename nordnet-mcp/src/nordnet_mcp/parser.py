"""Parse Nordnet transaction exports (CSV) into normalized records.

Nordnet's "Transaktioner og notaer" export is usually UTF-16 LE, tab-separated,
with localized column headers (DK/SE/NO/FI/EN), comma decimals and several
columns all called "Valuta"/"Currency". The parser is deliberately tolerant:
it sniffs encoding and delimiter, maps headers through an alias table, and
binds each "Valuta" column to the numeric column directly before it.
"""

from __future__ import annotations

import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Optional


def _norm(text: str) -> str:
    """Lower-case, strip accents-insensitive-ish key for header matching."""
    text = unicodedata.normalize("NFKC", text).strip().lower()
    return re.sub(r"\s+", " ", text)


# canonical name -> header aliases (normalized with _norm)
HEADER_ALIASES: dict[str, list[str]] = {
    "id": ["id"],
    "booking_date": ["bogføringsdag", "bokföringsdag", "bokføringsdag", "kirjauspäivä", "booking day", "booking date"],
    "trade_date": ["handelsdag", "affärsdag", "kauppapäivä", "trade day", "trade date"],
    "settlement_date": ["valørdag", "likviddag", "oppgjørsdag", "maksupäivä", "settlement day", "settlement date"],
    "account": ["depot", "depå", "portefølje", "salkku", "portfolio", "account"],
    "type": ["transaktionstype", "transaktionstyp", "transaksjonstype", "tapahtumatyyppi", "transaction type"],
    "security": ["værdipapirer", "værdipapir", "värdepapper", "verdipapir", "arvopaperi", "security", "instrument"],
    "isin": ["isin"],
    "quantity": ["antal", "antall", "määrä", "quantity", "amount of shares"],
    "price": ["kurs", "kurssi", "price"],
    "interest": ["rente", "ränta", "korko", "interest rate"],
    "fees": ["samlede afgifter", "total avgift", "totale avgifter", "totalt honorar", "kokonaiskulut", "total fees"],
    "amount": ["beløb", "belopp", "beløp", "summa", "amount"],
    "purchase_value": ["indkøbsværdi", "inköpsvärde", "kjøpsverdi", "hankinta-arvo", "acquisition value", "purchase value"],
    "result": ["resultat", "tulos", "result"],
    "total_quantity": ["totalt antal", "totalt antall", "kokonaismäärä", "total quantity", "total amount"],
    "balance": ["saldo", "balance"],
    "fx_rate": ["vekslingskurs", "växlingskurs", "vaihtokurssi", "exchange rate"],
    "text": ["transaktionstekst", "transaktionstext", "transaksjonstekst", "tapahtumateksti", "transaction text"],
    "cancel_date": ["makuleringsdato", "makuleringsdatum", "mitätöintipäivä", "cancellation date"],
    "note_number": ["notanummer", "nota nummer", "notakurs", "note number", "contract note number"],
    "verification_number": ["verifikationsnummer", "verifikasjonsnummer", "tositenumero", "verification number"],
    "brokerage": ["kurtage", "courtage", "kurtasje", "välityspalkkio", "brokerage"],
}
CURRENCY_HEADERS = {"valuta", "valuutta", "currency"}

_ALIAS_LOOKUP = {alias: canon for canon, aliases in HEADER_ALIASES.items() for alias in aliases}

# Numeric columns whose following "Valuta" column holds their currency.
_CURRENCY_BOUND = {"fees", "amount", "purchase_value", "result", "brokerage", "price"}

NUMERIC_FIELDS = {
    "quantity", "price", "interest", "fees", "amount", "purchase_value",
    "result", "total_quantity", "balance", "fx_rate", "brokerage",
}
DATE_FIELDS = {"booking_date", "trade_date", "settlement_date", "cancel_date"}


# --- transaction type classification -------------------------------------
# Order matters: more specific keywords first (e.g. "udbytteskat" before "udbytte").
_TYPE_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("dividend_tax", ("udbytteskat", "kuponskat", "kupongskatt", "kupskatt", "kupongskat", "lähdevero", "withholding", "utl kupskatt")),
    ("dividend_reinvest", ("udb. geninvest", "återinvest", "reinvest")),
    ("dividend", ("udbytte", "utdelning", "utbytte", "osinko", "dividend")),
    ("buy", ("købt", "køb", "köpt", "köp", "kjøpt", "kjøp", "osto", "buy", "bought")),
    ("sell", ("solgt", "sålt", "salg", "sälj", "myynti", "sell", "sold")),
    ("deposit", ("indbetaling", "insättning", "innskudd", "innbetaling", "talletus", "deposit")),
    ("withdrawal", ("hævning", "udbetaling", "uttag", "uttak", "utbetaling", "nosto", "withdrawal")),
    ("security_in", ("indlevering", "indlev.", "inleverans", "innlevering", "luovutus sisään", "transfer in", "emission")),
    ("security_out", ("udlevering", "udlev.", "utleverans", "utlevering", "transfer out")),
    ("interest", ("debetrente", "kreditrente", "rente", "ränta", "renter", "korko", "interest")),
    ("tax", ("skat", "skatt", "vero", "tax")),
    ("fee", ("gebyr", "avgift", "afgift", "kulu", "fee")),
    ("fx", ("valutaveksling", "valutaväxling", "valuutanvaihto", "currency exchange")),
]


def classify_type(raw_type: str) -> str:
    t = _norm(raw_type)
    for category, keywords in _TYPE_RULES:
        if any(k in t for k in keywords):
            return category
    return "other"


@dataclass
class Transaction:
    id: str
    booking_date: Optional[date]
    trade_date: Optional[date]
    settlement_date: Optional[date]
    account: str
    raw_type: str
    category: str
    security: str
    isin: str
    quantity: Optional[float]
    price: Optional[float]
    price_currency: str
    fees: Optional[float]
    amount: Optional[float]
    amount_currency: str
    purchase_value: Optional[float]
    result: Optional[float]
    total_quantity: Optional[float]
    balance: Optional[float]
    fx_rate: Optional[float]
    text: str
    cancel_date: Optional[date]
    source_file: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def date(self) -> Optional[date]:
        return self.trade_date or self.booking_date or self.settlement_date

    def to_dict(self) -> dict:
        out = {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "booking_date": self.booking_date.isoformat() if self.booking_date else None,
            "account": self.account,
            "type": self.raw_type,
            "category": self.category,
            "security": self.security or None,
            "isin": self.isin or None,
            "quantity": self.quantity,
            "price": self.price,
            "price_currency": self.price_currency or None,
            "fees": self.fees,
            "amount": self.amount,
            "currency": self.amount_currency or None,
            "result": self.result,
            "total_quantity": self.total_quantity,
            "balance": self.balance,
            "fx_rate": self.fx_rate,
            "text": self.text or None,
        }
        return {k: v for k, v in out.items() if v not in (None, "")}


# --- value parsing --------------------------------------------------------

def parse_number(value: str) -> Optional[float]:
    """Parse Nordic-formatted numbers: '1 234,56', '-1.234,56', '1234.56', '−3,2'."""
    if value is None:
        return None
    s = value.strip().replace(" ", "").replace(" ", "").replace(" ", "")
    s = s.replace("−", "-")  # unicode minus
    if s in ("", "-", "--"):
        return None
    if "," in s and "." in s:
        # whichever comes last is the decimal separator
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


_DATE_FORMATS = ("%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%Y", "%Y/%m/%d", "%Y.%m.%d")


def parse_date(value: str) -> Optional[date]:
    if not value:
        return None
    s = value.strip()[:10]
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


# --- file decoding --------------------------------------------------------

def decode_bytes(raw: bytes) -> str:
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        return raw.decode("utf-16")
    if raw.startswith(b"\xef\xbb\xbf"):
        return raw.decode("utf-8-sig")
    # UTF-16 without BOM: lots of NUL bytes
    if raw[:200].count(b"\x00") > 20:
        return raw.decode("utf-16-le")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252")


def _detect_delimiter(header_line: str) -> str:
    counts = {d: header_line.count(d) for d in ("\t", ";", ",")}
    return max(counts, key=counts.get)


class ParseError(ValueError):
    pass


def map_headers(headers: list[str]) -> dict[int, str]:
    """Return column index -> canonical field name (currency columns become '<field>_currency')."""
    mapping: dict[int, str] = {}
    last_numeric: Optional[str] = None
    for idx, header in enumerate(headers):
        key = _norm(header)
        if key in CURRENCY_HEADERS:
            if last_numeric in _CURRENCY_BOUND and f"{last_numeric}_currency" not in mapping.values():
                mapping[idx] = f"{last_numeric}_currency"
            continue
        canon = _ALIAS_LOOKUP.get(key)
        if canon and canon not in mapping.values():
            mapping[idx] = canon
            last_numeric = canon
        else:
            last_numeric = None
    return mapping


def parse_text(text: str, source_file: str = "") -> list[Transaction]:
    lines = text.splitlines()
    if not lines:
        return []
    delimiter = _detect_delimiter(lines[0])
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)
    headers = rows[0]
    mapping = map_headers(headers)
    required = {"type", "amount"}
    found = set(mapping.values())
    if not required <= found:
        raise ParseError(
            f"{source_file or 'file'}: does not look like a Nordnet transaction export "
            f"(missing columns: {', '.join(sorted(required - found))}). "
            f"Headers seen: {headers[:12]}"
        )

    out: list[Transaction] = []
    for n, row in enumerate(rows[1:], start=2):
        if not any(cell.strip() for cell in row):
            continue
        rec: dict[str, str] = {}
        for idx, canon in mapping.items():
            if idx < len(row):
                rec[canon] = row[idx].strip()

        def num(name: str) -> Optional[float]:
            return parse_number(rec.get(name, ""))

        raw_type = rec.get("type", "")
        tx = Transaction(
            id=rec.get("id") or f"{Path(source_file).name}:{n}",
            booking_date=parse_date(rec.get("booking_date", "")),
            trade_date=parse_date(rec.get("trade_date", "")),
            settlement_date=parse_date(rec.get("settlement_date", "")),
            account=rec.get("account", "") or "default",
            raw_type=raw_type,
            category=classify_type(raw_type),
            security=rec.get("security", ""),
            isin=rec.get("isin", "").upper(),
            quantity=num("quantity"),
            price=num("price"),
            price_currency=rec.get("price_currency", ""),
            fees=num("fees"),
            amount=num("amount"),
            amount_currency=rec.get("amount_currency", ""),
            purchase_value=num("purchase_value"),
            result=num("result"),
            total_quantity=num("total_quantity"),
            balance=num("balance"),
            fx_rate=num("fx_rate"),
            text=rec.get("text", ""),
            cancel_date=parse_date(rec.get("cancel_date", "")),
            source_file=source_file,
        )
        out.append(tx)
    return out


def parse_file(path: Path) -> list[Transaction]:
    return parse_text(decode_bytes(path.read_bytes()), source_file=str(path))


def load_directory(directory: Path) -> tuple[list[Transaction], list[dict]]:
    """Load every *.csv / *.txt export in a folder, de-duplicated on Nordnet's Id.

    Returns (transactions sorted by date, per-file report).
    """
    seen: dict[tuple[str, str], Transaction] = {}
    report: list[dict] = []
    files = sorted(p for p in directory.glob("*") if p.suffix.lower() in (".csv", ".txt") and p.is_file())
    for path in files:
        try:
            txs = parse_file(path)
        except ParseError as exc:
            report.append({"file": path.name, "status": "skipped", "reason": str(exc)})
            continue
        except Exception as exc:  # noqa: BLE001 - report and continue with other files
            report.append({"file": path.name, "status": "error", "reason": f"{type(exc).__name__}: {exc}"})
            continue
        new = 0
        for tx in txs:
            key = (tx.account, tx.id)
            if key not in seen:
                seen[key] = tx
                new += 1
        report.append({"file": path.name, "status": "ok", "rows": len(txs), "new_rows": new})
    txs = sorted(seen.values(), key=lambda t: (t.date or date.min, _id_sort_key(t.id)))
    return txs, report


def _id_sort_key(tx_id: str) -> tuple[int, str]:
    return (int(tx_id), "") if tx_id.isdigit() else (0, tx_id)
