"""Høfligt stikprøvetjek af virksomhedshjemmesider (INGEN fuld scraping).

    python -m src.site_sample --n 200
    python -m src.site_sample --urls terma.com systematic.com   # røgtest

Pr. site hentes højst robots.txt + forsiden (én GET, maks. 1 MB). Der gemmes
KUN nøgletal (statuskode, antal ord, sprog) - ingen sidetekst og dermed ingen
personnavne. robots.txt respekteres, der holdes pause mellem sites, og
User-Agent identificerer projektet med kontaktadresse (CONTACT_EMAIL i .env).
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path
from urllib import robotparser
from urllib.parse import urlparse

import pandas as pd
import requests
from bs4 import BeautifulSoup

from .coverage import add_flags

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass

DATA = Path(__file__).resolve().parent.parent / "data"
BOT = "DualUseFeasibilityBot"
MAX_BYTES = 1_000_000
MIN_WORDS = 150  # tærskel for "nok tekst til klassifikation" på forsiden alene

DA = set("og i at det er en til på af for den med de ikke der vi har som et kan "
         "vores om fra du eller også din jeres hos så blev bliver mere alle".split())
EN = set("the and of to in is for with that on we our are as you your from by "
         "this be at an it or has have more all can will".split())
PARKED = re.compile(r"domain (is )?for sale|domænet er (til salg|parkeret)|parked|"
                    r"buy this domain|under construction|coming soon|"
                    r"siden er under opbygning", re.I)


def user_agent() -> str:
    contact = os.getenv("CONTACT_EMAIL", "").strip()
    return (f"{BOT}/0.1 (CBS kandidatspeciale, stikproevetjek; "
            f"kontakt: {contact or 'ikke angivet'})")


def visible_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for t in soup(["script", "style", "noscript", "template", "svg", "iframe"]):
        t.decompose()
    return re.sub(r"\s+", " ", soup.get_text(" ")).strip()


def detect_lang(text: str) -> str:
    """Grov da/en-detektion via stopord (nok til feasibility; ingen ekstra pakker)."""
    words = re.findall(r"[a-zæøå]+", text.lower())
    if len(words) < 20:
        return "for_lidt_tekst"
    da = sum(w in DA for w in words) + 3 * sum(any(c in w for c in "æøå") for w in words)
    en = sum(w in EN for w in words)
    if max(da, en) < 0.03 * len(words):
        return "andet"
    if da and en and 0.5 < da / en < 2:
        return "da+en"
    return "da" if da > en else "en"


def robots_allows(session: requests.Session, base: str, timeout: int) -> tuple[bool, str]:
    try:
        r = session.get(base + "/robots.txt", timeout=timeout)
    except requests.RequestException:
        return True, "robots_utilgængelig"
    if r.status_code in (401, 403):
        return False, f"robots_{r.status_code}"
    if r.status_code >= 400 or "<html" in r.text[:500].lower():
        return True, "ingen_robots"
    rp = robotparser.RobotFileParser()
    rp.parse(r.text.splitlines())
    return rp.can_fetch(BOT, base + "/"), "robots_ok"


def check_site(domain: str, session: requests.Session, timeout: int = 15) -> dict:
    out = {"domaene": domain, "svarer": False, "status": None, "robots": None,
           "slut_domaene": None, "ord": 0, "sprog": None, "brugbar": False, "note": ""}
    for scheme in ("https", "http"):
        base = f"{scheme}://{domain}"
        allowed, out["robots"] = robots_allows(session, base, timeout)
        if not allowed:
            out["note"] = "robots.txt afviser - ikke hentet"
            return out
        try:
            r = session.get(base + "/", timeout=timeout, stream=True)
            body = r.raw.read(MAX_BYTES, decode_content=True)
            r.close()
        except requests.RequestException as e:
            out["note"] = type(e).__name__
            continue  # prøv http, hvis https fejler
        out.update(status=r.status_code, svarer=r.status_code < 400,
                   slut_domaene=(urlparse(r.url).hostname or "").removeprefix("www."))
        if r.status_code >= 400:
            out["note"] = f"HTTP {r.status_code}"
            return out
        html = body.decode(r.encoding or "utf-8", errors="replace")
        text = visible_text(html)
        out["ord"] = len(text.split())
        out["sprog"] = detect_lang(text)
        if PARKED.search(text) and out["ord"] < 300:
            out["note"] = "parkeret/under opbygning?"
        elif out["ord"] < MIN_WORDS and html.count("<script") >= 5:
            out["note"] = "lidt tekst, meget JavaScript (kræver evt. browser-rendering)"
        else:
            out["note"] = ""
        out["brugbar"] = (out["ord"] >= MIN_WORDS and out["sprog"] in ("da", "en", "da+en")
                          and "parkeret" not in out["note"])
        return out
    return out


def summarize(res: pd.DataFrame) -> str:
    n = len(res)
    pct = lambda s: f"{int(s.sum())}/{n} ({100 * s.mean():.0f} %)"
    lines = [f"Stikprøve: {n} sites",
             f"  svarer (HTTP < 400):       {pct(res['svarer'])}",
             f"  afvist af robots.txt:      {pct(res['note'].str.startswith('robots.txt'))}",
             f"  brugbar forside-tekst:     {pct(res['brugbar'])}  (>= {MIN_WORDS} ord, da/en)",
             f"  median antal ord (svarer): {res.loc[res['svarer'], 'ord'].median():.0f}",
             "  sprog: " + ", ".join(f"{k}={v}" for k, v in
                                     res['sprog'].fillna('-').value_counts().items())]
    if "ansatte_bucket" in res:
        g = res.groupby("ansatte_bucket")["brugbar"].agg(["size", "mean"])
        lines += ["  brugbar pr. størrelse: " + ", ".join(
            f"{k}: {100 * r['mean']:.0f} % (n={int(r['size'])})" for k, r in g.iterrows())]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--in", dest="inp", type=Path, default=DATA / "companies.csv")
    p.add_argument("--n", type=int, default=200)
    p.add_argument("--seed", type=int, default=2027)
    p.add_argument("--delay", type=float, default=1.0, help="sekunder mellem sites")
    p.add_argument("--min-bucket", choices=["alle", "10+"], default="alle")
    p.add_argument("--urls", nargs="*", help="tjek disse domæner i stedet for en stikprøve")
    p.add_argument("--out", type=Path, default=DATA / "site_sample.csv")
    a = p.parse_args(argv)

    if a.urls:
        sample = pd.DataFrame({"site_kandidat": a.urls})
    else:
        if not a.inp.exists():
            print(f"FEJL: {a.inp} findes ikke - kør først `python -m src.extract`.",
                  file=sys.stderr)
            return 2
        df = add_flags(pd.read_csv(a.inp, dtype={"cvr": str, "branchekode": str}))
        df = df[df["site_kandidat"].notna()]
        if a.min_bucket == "10+":
            df = df[df["ansatte_bucket"].isin(["10-49", "50+"])]
        sample = df.sample(n=min(a.n, len(df)), random_state=a.seed)

    s = requests.Session()
    s.headers.update({"User-Agent": user_agent(), "Accept-Language": "da,en;q=0.8"})
    rows = []
    for i, (_, row) in enumerate(sample.iterrows(), 1):
        res = check_site(row["site_kandidat"], s)
        for c in ("cvr", "gruppe", "ansatte_bucket", "har_hjemmeside"):
            if c in row:
                res[c] = row[c]
        rows.append(res)
        print(f"[{i}/{len(sample)}] {res['domaene']}: status={res['status']} "
              f"ord={res['ord']} sprog={res['sprog']} {res['note']}")
        time.sleep(a.delay)
    res = pd.DataFrame(rows)
    a.out.parent.mkdir(exist_ok=True)
    res.to_csv(a.out, index=False)
    print("\n" + summarize(res))
    return 0


if __name__ == "__main__":
    sys.exit(main())
