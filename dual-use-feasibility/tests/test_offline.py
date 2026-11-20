"""Offline-tests med et syntetisk CVR-dokument og en falsk HTTP-session."""
import json

import pandas as pd

from src import config, coverage, extract, financials, site_sample
from src.cvr_client import CvrClient, active_query, branch_query, has_path


def doc(cvr=1, kode="621000", form=("80", "APS"), site="www.Firma.dk/om", mail="info@firma.dk",
        interval="ANTAL_10_19", erst=None):
    return {"Vrvirksomhed": {
        "cvrNummer": cvr, "reklamebeskyttet": False,
        "hjemmeside": [
            {"kontaktoplysning": "gammel.dk", "hemmelig": False,
             "periode": {"gyldigFra": "2010-01-01", "gyldigTil": "2015-01-01"}},
            {"kontaktoplysning": site, "hemmelig": False,
             "periode": {"gyldigFra": "2015-01-02", "gyldigTil": None}}] if site else [],
        "elektroniskPost": [{"kontaktoplysning": mail, "hemmelig": False,
                             "periode": {"gyldigFra": "2015-01-02", "gyldigTil": None}}] if mail else [],
        "virksomhedMetadata": {
            "sammensatStatus": "NORMAL",
            "nyesteHovedbranche": {"branchekode": kode, "branchetekst": "x"},
            "nyesteVirksomhedsform": {"virksomhedsformkode": int(form[0]), "kortBeskrivelse": form[1]},
            "nyesteKontaktoplysninger": [],
            "nyesteAarsbeskaeftigelse": {"aar": 2025, "intervalKodeAntalAnsatte": "ANTAL_2_4"},
            "nyesteKvartalsbeskaeftigelse": {"aar": 2026, "kvartal": 2,
                                             "intervalKodeAntalAnsatte": interval},
            "nyesteMaanedsbeskaeftigelse": None,
            "nyesteErstMaanedsbeskaeftigelse": erst}}}


def test_flatten_minimises_and_normalises():
    r = extract.flatten(doc())
    assert r["hjemmeside"] == "firma.dk" and r["email_domaene"] == "firma.dk"
    assert r["gruppe"] == "62" and r["ansatte_bucket"] == "10-49" and r["ansatte_kilde"] == "kvartal"
    assert "info@" not in json.dumps(r)  # lokal-del af e-mail gemmes aldrig
    assert not r["personligt_ejet"]


def test_freemail_is_not_a_proxy_and_enk_is_flagged():
    r = extract.flatten(doc(form=("10", "ENK"), site=None, mail="jens.hansen@gmail.com"))
    assert r["personligt_ejet"] and r["har_email"] and r["email_domaene"] is None
    assert r["hjemmeside"] is None


def test_helpers():
    assert extract.normalize_site("https://WWW.a-b.dk/x?y") == "a-b.dk"
    assert extract.normalize_site("ikke et site") is None
    assert config.employee_bucket("ANTAL_0_0") == "0"
    assert config.employee_bucket("ANTAL_5_9") == "1-9"
    assert config.employee_bucket("ANTAL_1000_999999") == "50+"
    assert config.employee_bucket(None) == "ukendt"
    assert config.group_for_code(303200) == "30.3" and config.group_for_code("999999") is None
    assert all(has_path(doc(), f) for f in config.SOURCE_FIELDS)
    codes = config.all_codes()
    assert len(codes) == len(set(codes)) and all(len(c) == 6 for c in codes)


def test_coverage_table():
    rows = [extract.flatten(d) for d in (
        doc(1), doc(2, site=None), doc(3, site=None, mail="a@gmail.com"),
        doc(4, kode="265100", site=None, mail=None, interval="ANTAL_50_99"))]
    t = coverage.coverage_table(pd.DataFrame(rows), ["gruppe"]).set_index("gruppe")
    assert t.loc["62", ["aktive", "med_hjemmeside", "med_email", "med_email_proxy",
                        "site_eller_proxy"]].tolist() == [3, 1, 3, 2, 2]
    assert t.loc["26", "site_eller_proxy"] == 0
    e = coverage.employee_table(pd.DataFrame(rows)).set_index("gruppe")
    assert e.loc["26", "50+"] == 1 and e.loc["62", "10+"] == 3


class FakeResp:
    def __init__(self, payload, status=200):
        self._p, self.status_code, self.ok, self.text = payload, status, status < 400, ""

    def json(self):
        return self._p


class FakeSession:
    """Tre scroll-sider: 2 hits, 1 hit, tom. Registrerer alle kald."""
    def __init__(self):
        self.calls, self.headers, self.auth = [], {}, None
        self.pages = [[doc(1), doc(2)], [doc(3)], []]

    def request(self, method, url, params=None, timeout=None, data=None):
        self.calls.append((method, url, params, json.loads(data) if data else None))
        if method == "DELETE":
            return FakeResp({})
        hits = [{"_source": d} for d in self.pages.pop(0)]
        return FakeResp({"_scroll_id": "sid", "hits": {"total": 3, "hits": hits}})


def test_scroll_follows_guide_and_clears():
    fs = FakeSession()
    c = CvrClient("u", "p", base_url="http://x", pause=0, session=fs)
    docs = list(c.scroll(branch_query(["621000"]), ["a"], size=2))
    assert len(docs) == 3 and fs.auth == ("u", "p")
    first, second, last = fs.calls[0], fs.calls[1], fs.calls[-1]
    assert first[1] == "http://x/cvr-permanent/virksomhed/_search" and first[2] == {"scroll": "1m"}
    assert second[1] == "http://x/_search/scroll" and second[3] == {"scroll": "1m", "scroll_id": "sid"}
    assert last[0] == "DELETE"
    q = first[3]["query"]["bool"]["filter"]
    assert q[0] == {"terms": {config.F_BRANCHEKODE: ["621000"]}} and q[1] == active_query()


def test_language_and_text():
    da = "Vi udvikler software og sensorer til det danske forsvar, og vores løsninger er " * 5
    en = "We develop software and sensors for the defence sector and our solutions are " * 5
    assert site_sample.detect_lang(da) == "da" and site_sample.detect_lang(en) == "en"
    assert site_sample.visible_text("<html><script>x()</script><p>Hej  verden</p></html>") == "Hej verden"


def test_parse_xbrl_picks_latest_undimensioned_context():
    x = b"""<xbrl xmlns="http://www.xbrl.org/2003/instance" xmlns:d="http://xbrl.dcca.dk/fsa">
    <context id="c1"><period><startDate>2025-01-01</startDate><endDate>2025-12-31</endDate></period></context>
    <context id="c0"><period><startDate>2024-01-01</startDate><endDate>2024-12-31</endDate></period></context>
    <context id="dim"><entity><segment/></entity><period><instant>2025-12-31</instant></period></context>
    <d:Revenue contextRef="c0">100</d:Revenue><d:Revenue contextRef="c1">250</d:Revenue>
    <d:Equity contextRef="dim">999</d:Equity>
    <d:CompletedDevelopmentProjects contextRef="c1">40</d:CompletedDevelopmentProjects></xbrl>"""
    assert financials.parse_xbrl(x) == {"omsaetning": 250.0, "udv_projekter_faerdige": 40.0}


def test_erst_employment_wins_when_newer():
    r = extract.flatten(doc(interval="ANTAL_50_99", erst={
        "aar": 2026, "maaned": 8, "antalAnsatte": 22, "intervalKodeAntalAnsatte": "ANTAL_20_49"}))
    assert r["ansatte_kilde"] == "erst_maaned" and r["ansatte_bucket"] == "10-49" and r["ansatte_aar"] == 2026
