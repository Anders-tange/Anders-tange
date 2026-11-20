"""Forsøg: kan hjemmesider, der IKKE står i CVR, findes ud fra virksomhedsnavnet?

    python -m src.site_discovery --n 100 --min-bucket 10+

For en stikprøve af virksomheder uden hjemmeside og uden eget e-maildomæne i
CVR hentes navnet (kun i hukommelsen, gemmes ikke), og der gættes på
<navn>.dk og <navn>.com. Et gæt tæller kun som fund, hvis forsiden eller
/kontakt nævner virksomhedens CVR-nummer, eller navnet står på forsiden.
Kun forsider og evt. én kontaktside hentes; robots.txt respekteres.
Gemmer: cvr, gruppe, størrelse, fundet domæne, valideringsmetode.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import unicodedata
from pathlib import Path

import pandas as pd
import requests

from . import config
from .coverage import add_flags
from .cvr_client import CvrClient
from .site_sample import robots_allows, user_agent, visible_text

DATA = Path(__file__).resolve().parent.parent / "data"
SUFFIX = re.compile(r"\b(a/s|aps|ivs|i/s|k/s|p/s|smba|amba|fmba|holding|danmark|denmark|"
                    r"scandinavia|nordic|international|group|gruppen|af \d{4}|v/.*)$", re.I)


def slugs(name: str) -> list[str]:
    n = name.lower().replace("&", " og ")
    for _ in range(3):
        n = SUFFIX.sub("", n.strip(" .,-")).strip(" .,-")
    n = n.replace("æ", "ae").replace("ø", "oe").replace("å", "aa")
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode()
    words = re.findall(r"[a-z0-9]+", n)
    if not words:
        return []
    out = ["".join(words), "-".join(words)]
    if len(words) > 1 and len(words[0]) >= 4:
        out.append(words[0])
    return list(dict.fromkeys(s for s in out if 3 <= len(s) <= 40))


def page_text(s: requests.Session, url: str) -> str | None:
    try:
        r = s.get(url, timeout=10, stream=True)
        body = r.raw.read(1_000_000, decode_content=True)
        r.close()
    except requests.RequestException:
        return None
    if r.status_code >= 400:
        return None
    return visible_text(body.decode(r.encoding or "utf-8", errors="replace"))


def try_domain(s: requests.Session, domain: str, cvr: str, name: str) -> str | None:
    base = f"https://{domain}"
    allowed, _ = robots_allows(s, base, 10)
    if not allowed:
        return None
    text = page_text(s, base + "/")
    if text is None:
        return None
    digits = re.sub(r"\D", "", text)
    if cvr in digits:
        return "cvr_paa_forside"
    core = re.sub(r"\s+(a/s|aps|ivs)$", "", name.lower()).strip()
    if len(core) >= 5 and core in text.lower():
        return "navn_paa_forside"
    for path in ("/kontakt", "/contact", "/om-os", "/about"):
        t = page_text(s, base + path)
        if t and cvr in re.sub(r"\D", "", t):
            return "cvr_paa_" + path.strip("/")
        time.sleep(0.5)
    return None


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--n", type=int, default=100)
    p.add_argument("--seed", type=int, default=11)
    p.add_argument("--min-bucket", choices=["alle", "10+"], default="10+")
    p.add_argument("--groups", nargs="+", default=["26", "30.3", "62", "63", "71.12", "72.1"])
    p.add_argument("--out", type=Path, default=DATA / "site_discovery.csv")
    a = p.parse_args(argv)
    df = add_flags(pd.read_csv(DATA / "companies.csv", dtype={"cvr": str, "branchekode": str}))
    df = df[df["gruppe"].isin(a.groups) & ~df["har_site_eller_proxy"]
            & df["status"].isin(["NORMAL", "Aktiv"])]
    if a.min_bucket == "10+":
        df = df[df["ansatte_bucket"].isin(["10-49", "50+"])]
    smp = df.sample(n=min(a.n, len(df)), random_state=a.seed)
    names = {}
    c = CvrClient()
    for chunk in [smp["cvr"].tolist()[i:i + 50] for i in range(0, len(smp), 50)]:
        r = c.search({"size": 50, "_source": [config.F_CVR, config.F_NAVN],
                      "query": {"terms": {config.F_CVR: [int(x) for x in chunk]}}})
        for h in r["hits"]["hits"]:
            v = h["_source"]["Vrvirksomhed"]
            names[str(v["cvrNummer"])] = v["virksomhedMetadata"]["nyesteNavn"]["navn"]
    s = requests.Session()
    s.headers.update({"User-Agent": user_agent(), "Accept-Language": "da,en;q=0.8"})
    rows = []
    for i, row in enumerate(smp.itertuples(), 1):
        name, found, how = names.get(row.cvr, ""), None, None
        for slug in slugs(name):
            for tld in ("dk", "com"):
                how = try_domain(s, f"{slug}.{tld}", row.cvr, name)
                time.sleep(0.5)
                if how:
                    found = f"{slug}.{tld}"
                    break
            if found:
                break
        rows.append({"cvr": row.cvr, "gruppe": row.gruppe, "ansatte_bucket": row.ansatte_bucket,
                     "fundet_domaene": found, "validering": how})
        print(f"[{i}/{len(smp)}] {'FUNDET ' + found + ' (' + how + ')' if found else '-'}")
    del names  # navne gemmes ikke
    res = pd.DataFrame(rows)
    res.to_csv(a.out, index=False)
    k = res["fundet_domaene"].notna()
    print(f"\nFundet og valideret: {int(k.sum())}/{len(res)} ({100 * k.mean():.0f} %)")
    print(res.groupby("ansatte_bucket")["fundet_domaene"].apply(lambda x: f"{x.notna().sum()}/{len(x)}").to_string())
    return 0


if __name__ == "__main__":
    sys.exit(main())
