import asyncio
import json

import pytest


@pytest.fixture
def server(data_dir, monkeypatch):
    monkeypatch.setenv("NORDNET_DATA_DIR", str(data_dir))
    monkeypatch.setenv("NORDNET_PRICE_PROVIDER", "none")
    # Manual prices: Novo in DKK, Apple in USD + an FX row, ETF left unpriced
    (data_dir / "prices.csv").write_text(
        "isin;price;currency;date\nDK0062498333;700;DKK;2024-12-31\nUS0378331005;250;USD;2024-12-31\nUSDDKK;7;;2024-12-31\n"
    )
    from nordnet_mcp import server as srv

    srv.STATE.__init__()
    return srv


def call(srv, name, **args):
    result = asyncio.run(srv.mcp.call_tool(name, args))
    # FastMCP returns (content, structured) in recent versions
    structured = result[1] if isinstance(result, tuple) else None
    if structured is not None:
        return structured.get("result", structured)
    return json.loads(result[0].text)


def test_tools_are_registered(server):
    tools = {t.name for t in asyncio.run(server.mcp.list_tools())}
    assert {"nordnet_status", "nordnet_get_holdings", "nordnet_portfolio_summary", "nordnet_get_transactions",
            "nordnet_get_dividends", "nordnet_get_realized_gains", "nordnet_get_cashflows", "nordnet_get_quote",
            "nordnet_list_accounts", "nordnet_reload"} <= tools


def test_status(server):
    s = call(server, "nordnet_status")
    assert s["transactions"] == 13 and s["accounts"] == ["12345678", "87654321"]
    assert s["price_sources"] == ["manual"]


def test_holdings_with_manual_prices(server):
    h = call(server, "nordnet_get_holdings")
    rows = {r["isin"]: r for r in h["positions"]}
    assert rows["DK0062498333"]["market_value"] == 63000
    assert rows["US0378331005"]["market_value"] == 17500  # 10 * 250 USD * 7
    assert "market_value" not in rows["IE00B4L5Y983"]
    assert h["unpriced_isins"] == ["IE00B4L5Y983"]


def test_summary(server):
    s = call(server, "nordnet_portfolio_summary")
    assert s["cash"] == 33181
    assert s["holdings_value"] == pytest.approx(63000 + 17500 + 9000)
    assert s["net_deposited"] == 75000
    assert s["total_return"] == pytest.approx(63000 + 17500 + 9000 + 33181 - 75000)


def test_transactions_pagination_and_filters(server):
    t = call(server, "nordnet_get_transactions", limit=5)
    assert t["total"] == 12 and t["count"] == 5 and t["has_more"] and t["next_offset"] == 5
    assert t["transactions"][0]["id"] == "1011"  # newest first
    novo = call(server, "nordnet_get_transactions", query="novo", category="buy")
    assert novo["total"] == 2


def test_quote_manual(server):
    q = call(server, "nordnet_get_quote", query="DK0062498333")
    assert q["price"] == 700 and q["currency"] == "DKK"


def test_missing_data_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("NORDNET_DATA_DIR", str(tmp_path / "nope"))
    monkeypatch.setenv("NORDNET_PRICE_PROVIDER", "none")
    from nordnet_mcp import server as srv

    srv.STATE.__init__()
    out = call(srv, "nordnet_get_holdings")
    assert "error" in out and "how_to_fix" in out
