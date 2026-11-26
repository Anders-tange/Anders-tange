from nordnet_mcp.parser import classify_type, decode_bytes, load_directory, parse_number, parse_text


def test_parse_number_nordic_formats():
    assert parse_number("1 234,56") == 1234.56
    assert parse_number("-1.234,56") == -1234.56
    assert parse_number("1234.56") == 1234.56
    assert parse_number("−3,2") == -3.2
    assert parse_number("") is None
    assert parse_number("abc") is None
    # Nordnet DK uses "." for thousands: with the file's decimal separator known, 2.500 is 2500
    assert parse_number("2.500", ",") == 2500
    assert parse_number("-2.482,35", ",") == -2482.35
    assert parse_number("1.877.030", None) == 1877030
    assert parse_number("1,234.5", None) == 1234.5


def test_classify_type_languages():
    assert classify_type("KØBT") == "buy"
    assert classify_type("KÖPT") == "buy"
    assert classify_type("SOLGT") == "sell"
    assert classify_type("SÅLT") == "sell"
    assert classify_type("UDBYTTE") == "dividend"
    assert classify_type("UTDELNING") == "dividend"
    assert classify_type("UDBYTTESKAT") == "dividend_tax"
    assert classify_type("UTL KUPSKATT") == "dividend_tax"
    assert classify_type("INDBETALING") == "deposit"
    assert classify_type("HÆVNING") == "withdrawal"
    assert classify_type("DEBETRENTE") == "interest"
    assert classify_type("SPLIT") == "corporate_action"
    assert classify_type("NOSTO") == "withdrawal"  # not "osto" (buy)
    assert classify_type("SKATTEINDBETALING ASK") == "tax"
    assert classify_type("INLÄGG VP") == "security_in"
    assert classify_type("INLÖSEN UTTAG VP") == "redemption"
    assert classify_type("TECKNING LIKVID") == "other"


def test_load_utf16_export(data_dir):
    txs, report = load_directory(data_dir)
    assert report[0]["status"] == "ok"
    assert len(txs) == 14
    first = txs[0]
    assert first.id == "1001"
    assert first.amount == 50000
    assert first.amount_currency == "DKK"
    assert first.category == "deposit"
    buy = next(t for t in txs if t.id == "1008")
    assert buy.fx_rate == 6.9 and buy.isin == "US0378331005"
    assert buy.amount == -13832.25 and buy.price == 200.25 and buy.balance == 37175.75
    assert next(t for t in txs if t.id == "1010").cancel_date is not None


def test_duplicate_files_are_deduplicated(data_dir):
    (data_dir / "copy.csv").write_bytes((data_dir / "transaktioner.csv").read_bytes())
    txs, report = load_directory(data_dir)
    assert len(txs) == 14
    assert sorted(r["new_rows"] for r in report) == [0, 14]


def test_swedish_semicolon_utf8():
    text = (
        "Id;Bokföringsdag;Affärsdag;Likviddag;Depå;Transaktionstyp;Värdepapper;ISIN;Antal;Kurs;Ränta;"
        "Total Avgift;Valuta;Belopp;Valuta;Inköpsvärde;Valuta;Resultat;Valuta;Totalt antal;Saldo;Växlingskurs;"
        "Transaktionstext;Makuleringsdatum\n"
        "1;2024-05-02;2024-05-02;2024-05-06;999;KÖPT;Volvo B;SE0000115446;10;250,5;;39;SEK;-2 544;SEK;;;;;10;7 456;1;;\n"
    )
    [tx] = parse_text(decode_bytes(text.encode("utf-8-sig")))
    assert tx.category == "buy"
    assert tx.amount == -2544 and tx.amount_currency == "SEK"
    assert tx.price == 250.5 and tx.total_quantity == 10 and tx.balance == 7456


def test_non_nordnet_file_is_skipped(tmp_path):
    (tmp_path / "other.csv").write_text("a,b,c\n1,2,3\n")
    txs, report = load_directory(tmp_path)
    assert txs == [] and report[0]["status"] == "skipped"
