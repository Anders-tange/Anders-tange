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
    assert holdings["US0378331005"].cost_basis == 13815
    assert holdings["IE00B4L5Y983"].account == "87654321"


def test_realized_gain_matches_nordnet_result(txs):
    [sale] = pf.realized_gains(txs, year=2024)
    assert sale["gain"] == pytest.approx(9947.8, abs=0.01)
    assert sale["nordnet_result"] == pytest.approx(9947.8)
    assert pf.realized_gains(txs, year=2023) == []


def test_cash_balances_ignore_cancelled(txs):
    assert pf.cash_balances(txs) == {"12345678": 32181, "87654321": 1000}


def test_dividends(txs):
    d = pf.dividends(txs)
    assert d["total_gross"] == 1500 and d["total_withholding_tax"] == -405 and d["total_net"] == 1095
    assert d["rows"][0]["isin"] == "DK0062498333"
    by_month = pf.dividends(txs, group_by="month")
    assert by_month["rows"][0]["period"] == "2024-03"


def test_cashflows(txs):
    c = pf.cashflows(txs)["totals"]
    assert c["deposit"] == 80000 and c["withdrawal"] == -5000 and c["interest"] == -12
    assert c["net_deposited"] == 75000


def test_filter_by_account(txs):
    only_b = pf.filter_txs(txs, account="87654321")
    assert {t.account for t in only_b} == {"87654321"}
