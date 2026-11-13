"""Plan B: nøgletal fra årsrapporter (XBRL) via det åbne regnskabsindeks.

    python -m src.financials --cvr 30714024 12345678
    python -m src.financials --from-companies --n 100     # stikprøve fra companies.csv
    python -m src.financials --random 200                 # tilfældige nye regnskaber

Indekset http://distribution.virk.dk/offentliggoerelser/_search kræver ikke
login (testet 13/11-2026). Hvert hit peger på årsrapporten som XBRL
(dokumentMimeType application/xml) på regnskaber.virk.dk.

Der gemmes kun regnskabstal pr. CVR-nummer - ingen navne på ledelse/revisor.
Bemærk: små virksomheder (regnskabsklasse B) må undlade at oplyse omsætning
og viser ofte kun bruttofortjeneste, så `Revenue` mangler for mange.
"""
from __future__ import annotations

import argparse
import gzip
import sys
import time
from pathlib import Path

import pandas as pd
import requests
from lxml import etree

DATA = Path(__file__).resolve().parent.parent / "data"
BASE = "http://distribution.virk.dk/offentliggoerelser/_search"
XBRLI = "{http://www.xbrl.org/2003/instance}"

# lokale elementnavne i Erhvervsstyrelsens ÅRL-taksonomi (fsa) -> kolonne
TAGS = {
    "Revenue": "omsaetning",
    "GrossProfitLoss": "bruttofortjeneste",
    "ProfitLoss": "aarets_resultat",
    "Equity": "egenkapital",
    "Assets": "aktiver",
    "AverageNumberOfEmployees": "ansatte_gns",
    "EmployeeBenefitsExpense": "personaleomkostninger",
    "CompletedDevelopmentProjects": "udv_projekter_faerdige",
    "DevelopmentProjectsInProgress": "udv_projekter_igang",
    "IntangibleAssets": "immaterielle_aktiver",
    "ResearchAndDevelopmentExpense": "fou_omkostninger",
}
DEV_COLS = ["udv_projekter_faerdige", "udv_projekter_igang"]


def latest_report(session: requests.Session, cvr: str | int) -> dict | None:
    body = {"size": 1, "sort": [{"offentliggoerelsesTidspunkt": "desc"}],
            "query": {"bool": {"filter": [
                {"term": {"cvrNummer": int(cvr)}},
                {"term": {"offentliggoerelsestype": "regnskab"}}]}}}
    r = session.post(BASE, json=body, timeout=60)
    r.raise_for_status()
    hits = r.json()["hits"]["hits"]
    return hits[0]["_source"] if hits else None


def random_reports(session: requests.Session, n: int, since: str, seed: int) -> list[dict]:
    body = {"size": n, "query": {"function_score": {
        "query": {"bool": {"filter": [
            {"range": {"offentliggoerelsesTidspunkt": {"gte": since}}},
            {"term": {"offentliggoerelsestype": "regnskab"}}]}},
        "random_score": {"seed": seed, "field": "_seq_no"}}}}
    r = session.post(BASE, json=body, timeout=60)
    r.raise_for_status()
    return [h["_source"] for h in r.json()["hits"]["hits"]]


def xbrl_url(report: dict) -> str | None:
    for d in report.get("dokumenter") or []:
        if d.get("dokumentMimeType") == "application/xml" and d.get("dokumentType") == "AARSRAPPORT":
            return d.get("dokumentUrl")
    return None


def parse_xbrl(raw: bytes) -> dict:
    """Træk TAGS ud for seneste periode, kun kontekster uden dimensioner."""
    if raw[:2] == b"\x1f\x8b":  # serveren leverer gzip uden Content-Encoding
        raw = gzip.decompress(raw)
    root = etree.fromstring(raw, parser=etree.XMLParser(recover=True, huge_tree=True))
    ctx_end: dict[str, str] = {}
    for c in root.iter(XBRLI + "context"):
        if c.find(f".//{XBRLI}scenario") is not None or c.find(f".//{XBRLI}segment") is not None:
            continue
        end = c.findtext(f".//{XBRLI}endDate") or c.findtext(f".//{XBRLI}instant")
        if end:
            ctx_end[c.get("id")] = end.strip()
    best: dict[str, tuple[str, float]] = {}
    for el in root:
        if not isinstance(el.tag, str):
            continue
        col = TAGS.get(etree.QName(el).localname)
        end = ctx_end.get(el.get("contextRef"))
        if not col or not end or not (el.text or "").strip():
            continue
        try:
            val = float(el.text)
        except ValueError:
            continue
        if col not in best or end > best[col][0]:
            best[col] = (end, val)
    return {k: v for k, (_, v) in best.items()}


def fetch(session: requests.Session, report: dict) -> dict:
    per = (report.get("regnskab") or {}).get("regnskabsperiode") or {}
    row = {"cvr": report.get("cvrNummer"), "periode_slut": per.get("slutDato"),
           "har_xbrl": False}
    url = xbrl_url(report)
    if url:
        r = session.get(url, timeout=60)
        if r.ok:
            row["har_xbrl"] = True
            row.update(parse_xbrl(r.content))
    return row


def summarize(df: pd.DataFrame) -> str:
    n = len(df)
    lines = [f"Regnskaber: {n}, heraf med XBRL: {int(df['har_xbrl'].sum())}"]
    for col in TAGS.values():
        k = int(df[col].notna().sum()) if col in df else 0
        lines.append(f"  {col:<26} {k:>5}  ({100 * k / n:.0f} %)")
    dev = [c for c in DEV_COLS if c in df]
    k = int((df[dev].fillna(0).sum(axis=1) > 0).sum()) if dev else 0
    lines.append(f"  aktiverede udviklingsomk. > 0: {k} ({100 * k / n:.0f} %)")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--cvr", nargs="+")
    g.add_argument("--from-companies", action="store_true")
    g.add_argument("--random", type=int, metavar="N")
    p.add_argument("--n", type=int, default=100)
    p.add_argument("--min-bucket", choices=["alle", "10+"], default="alle")
    p.add_argument("--since", default="2026-01-01")
    p.add_argument("--seed", type=int, default=2027)
    p.add_argument("--delay", type=float, default=0.3)
    p.add_argument("--out", type=Path, default=DATA / "financials.csv")
    a = p.parse_args(argv)

    s = requests.Session()
    s.headers.update({"User-Agent": "DualUseFeasibility/0.1 (CBS kandidatspeciale)"})
    extra = None
    if a.random:
        reports = random_reports(s, a.random, a.since, a.seed)
    else:
        if a.cvr:
            cvrs = a.cvr
        else:
            comp = pd.read_csv(DATA / "companies.csv", dtype={"cvr": str})
            if a.min_bucket == "10+":
                comp = comp[comp["ansatte_bucket"].isin(["10-49", "50+"])]
            comp = comp.sample(n=min(a.n, len(comp)), random_state=a.seed)
            cvrs, extra = comp["cvr"].tolist(), comp[["cvr", "gruppe", "ansatte_bucket"]]
        reports = []
        for c in cvrs:
            reports.append(latest_report(s, c) or {"cvrNummer": int(c)})
            time.sleep(a.delay)
    rows = []
    for i, rep in enumerate(reports, 1):
        try:
            rows.append(fetch(s, rep))
        except Exception as e:  # ét dårligt dokument må ikke vælte kørslen
            rows.append({"cvr": rep.get("cvrNummer"), "har_xbrl": False, "fejl": type(e).__name__})
        if i % 25 == 0:
            print(f"  {i}/{len(reports)}")
        time.sleep(a.delay)
    df = pd.DataFrame(rows)
    if extra is not None:
        df = df.astype({"cvr": str}).merge(extra, on="cvr", how="left")
    a.out.parent.mkdir(exist_ok=True)
    df.to_csv(a.out, index=False)
    print(summarize(df))
    return 0


if __name__ == "__main__":
    sys.exit(main())
