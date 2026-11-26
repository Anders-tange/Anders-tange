import pytest

from nordnet_mcp import portfolio as pf
from nordnet_mcp.parser import load_directory


@pytest.fixture
def txs(data_dir):
    return load_directory(data_dir)[0]


def test_holdings_average_cost_and_cancelled_excluded(txs):
    holdings = {p.isin: p for p in pf.current_holdings(txs)}
    assert set(holdings) == {"DK0062498333", "US0378331005", "IE00B4L5Y983"}
    novo = holdings["DK0062498333"]
    assert novo.quantity == 90  # cancelled buy of 10 is ignored
    assert novo.cost_basis == pytest.approx(50058 - 50058 / 150 * 60)
    assert novo.avg_cost == pytest.approx(50058 / 150)
    assert holdings["US0378331005"].cost_basis == 13832.25
    assert holdings["IE00B4L5Y983"].account == "87654321"


def test_realized_gain_matches_nordnet_result(txs):
    [sale] = pf.realized_gains(txs, year=2024)
    assert sale["gain"] == pytest.approx(9947.8, abs=0.01)
    assert sale["nordnet_result"] == pytest.approx(9947.8)
    assert pf.realized_gains(txs, year=2023) == []


def test_cash_balances_ignore_cancelled(txs):
    assert pf.cash_balances(txs) == {"12345678": 32163.25, "87654321": 850}


def test_dividends(txs):
    d = pf.dividends(txs)
    assert d["total_gross"] == 1500 and d["total_withholding_tax"] == -405 and d["total_net"] == 1095
    assert d["rows"][0]["isin"] == "DK0062498333"
    by_month = pf.dividends(txs, group_by="month")
    assert by_month["rows"][0]["period"] == "2024-03"


def test_cashflows(txs):
    c = pf.cashflows(txs)["totals"]
    assert c["deposit"] == 80000 and c["withdrawal"] == -5000 and c["interest"] == -12.5 and c["tax"] == -150
    assert c["net_deposited"] == 75000


def test_filter_by_account(txs):
    only_b = pf.filter_txs(txs, account="87654321")
    assert {t.account for t in only_b} == {"87654321"}


SE_HEADER = (
    "Id;Bokföringsdag;Affärsdag;Likviddag;Depå;Transaktionstyp;Värdepapper;ISIN;Antal;Kurs;Ränta;"
    "Total Avgift;Valuta;Belopp;Valuta;Inköpsvärde;Valuta;Resultat;Valuta;Totalt antal;Saldo;Växlingskurs;"
    "Transaktionstext;Makuleringsdatum\n"
)


def _se(rows: str):
    from nordnet_mcp.parser import parse_text

    txs = parse_text(SE_HEADER + rows)
    return sorted(txs, key=lambda t: (t.date, int(t.id)))


def test_split_into_new_isin_keeps_cost_basis():
    txs = _se(
        "1;2024-01-10;2024-01-10;2024-01-12;111;KÖPT;Acme;SE0000000001;10;100;;0;SEK;-1 000;SEK;;;;;10;0;1;;\n"
        "2;2024-05-01;2024-05-01;2024-05-01;111;SPLIT UTTAG VP;Acme;SE0000000001;10;;;;;;;;;;;0;0;;;\n"
        "3;2024-05-01;2024-05-01;2024-05-01;111;SPLIT INLÄGG VP;Acme;SE0000000002;40;;;;;;;;;;;40;0;;;\n"
    )
    holdings = {p.isin: p for p in pf.current_holdings(txs)}
    assert list(holdings) == ["SE0000000002"]
    assert holdings["SE0000000002"].quantity == 40
    assert holdings["SE0000000002"].cost_basis == 1000
    assert holdings["SE0000000002"].avg_cost == 25


def test_split_same_isin_keeps_cost_basis():
    txs = _se(
        "1;2024-01-10;2024-01-10;2024-01-12;111;KÖPT;Acme;SE0000000001;10;100;;0;SEK;-1 000;SEK;;;;;10;0;1;;\n"
        "2;2024-05-01;2024-05-01;2024-05-01;111;SPLIT INLÄGG VP;Acme;SE0000000001;30;;;;;;;;;;;40;0;;;\n"
    )
    [p] = pf.current_holdings(txs)
    assert p.quantity == 40 and p.cost_basis == 1000


def test_transfer_between_own_accounts_moves_cost_basis():
    txs = _se(
        "1;2024-01-10;2024-01-10;2024-01-12;111;KÖPT;Acme;SE0000000001;10;100;;0;SEK;-1 000;SEK;;;;;10;0;1;;\n"
        "2;2024-03-01;2024-03-01;2024-03-01;111;UTTAG VP;Acme;SE0000000001;10;;;;;;;;;;;0;0;;;\n"
        "3;2024-03-02;2024-03-02;2024-03-02;222;INLÄGG VP;Acme;SE0000000001;10;;;;;;;;;;;10;0;;;\n"
    )
    [p] = pf.current_holdings(txs)
    assert p.account == "222" and p.cost_basis == 1000 and not p.cost_unknown
    assert pf.realized_gains(txs) == []


def test_redemption_is_realized():
    txs = _se(
        "1;2024-01-10;2024-01-10;2024-01-12;111;KÖPT;Bond;SE0000000003;10;100;;0;SEK;-1 000;SEK;;;;;10;0;1;;\n"
        "2;2024-06-01;2024-06-01;2024-06-01;111;INLÖSEN UTTAG VP;Bond;SE0000000003;10;;;;;1 050;SEK;;;;;0;0;;;\n"
    )
    assert pf.current_holdings(txs) == []
    [sale] = pf.realized_gains(txs)
    assert sale["gain"] == 50 and sale["type"] == "INLÖSEN UTTAG VP"
