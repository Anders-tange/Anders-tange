"""Udtræk af aktive virksomheder pr. branchekode -> data/companies.csv.

    python -m src.extract                 # kerne- + ekstra-koder
    python -m src.extract --sets core     # kun kandidatlisten
    python -m src.extract --max-docs 500  # hurtig prøvekørsel

GDPR / dataminimering
* Der hentes ikke virksomhedsnavn, adresse eller deltagere.
* E-mailadresser reduceres straks til domænet; lokal-delen gemmes aldrig.
* Personligt ejede virksomheder (ENK, PMV, I/S) skrives IKKE til
  companies.csv. De tælles kun aggregeret i data/excluded_counts.csv.
* Kontaktoplysninger markeret 'hemmelig' bruges ikke.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd

from . import config
from .cvr_client import CvrAuthError, CvrClient, branch_query, get_path

DATA = Path(__file__).resolve().parent.parent / "data"
_EMAIL = re.compile(r"^[^@\s]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})$")
_DOMAIN = re.compile(r"^(?:[a-z0-9-]+\.)+[a-z]{2,}$")


def normalize_site(raw: str | None) -> str | None:
    """'WWW.Firma.dk/om' -> 'firma.dk'. None hvis det ikke ligner et domæne."""
    if not raw:
        return None
    s = str(raw).strip().lower()
    if "@" in s or " " in s:
        return None
    if not re.match(r"^[a-z]+://", s):
        s = "http://" + s
    host = (urlparse(s).hostname or "").strip(".")
    if host.startswith("www."):
        host = host[4:]
    return host if _DOMAIN.match(host) else None


def email_domain(raw: str | None) -> str | None:
    m = _EMAIL.match(str(raw).strip()) if raw else None
    return m.group(1).lower() if m else None


def _current(entries) -> list[str]:
    """Gældende (gyldigTil tom), ikke-hemmelige værdier fra en CVR-periodeliste."""
    out = []
    for e in entries or []:
        if not isinstance(e, dict) or e.get("hemmelig"):
            continue
        if (e.get("periode") or {}).get("gyldigTil"):
            continue
        if e.get("kontaktoplysning"):
            out.append(str(e["kontaktoplysning"]))
    return out


def _employment(meta: dict) -> tuple[str | None, int | None, str | None, int | None]:
    """Nyeste beskæftigelsesoplysning: (intervalkode, antal, kilde)."""
    cands = []
    for key, kilde in (("nyesteErstMaanedsbeskaeftigelse", "erst_maaned"),
                       ("nyesteMaanedsbeskaeftigelse", "maaned"),
                       ("nyesteKvartalsbeskaeftigelse", "kvartal"),
                       ("nyesteAarsbeskaeftigelse", "aar")):
        b = meta.get(key)
        if not isinstance(b, dict):
            continue
        aar = b.get("aar") or 0
        sub = b.get("maaned") or (b.get("kvartal") or 0) * 3 or 12
        cands.append(((aar, sub), b.get("intervalKodeAntalAnsatte"),
                      b.get("antalAnsatte"), kilde))
    if not cands:
        return None, None, None, None
    (aar, _), kode, antal, kilde = max(cands, key=lambda c: c[0])
    return kode, antal, kilde, aar


def flatten(doc: dict) -> dict:
    """Ét ES-dokument -> én flad, minimeret række."""
    v = doc.get("Vrvirksomhed", {})
    meta = v.get("virksomhedMetadata") or {}
    form = meta.get("nyesteVirksomhedsform") or {}
    formkode = str(form.get("virksomhedsformkode") or "")
    formkort = str(form.get("kortBeskrivelse") or "")
    kode = get_path(doc, config.F_BRANCHEKODE)
    kode = str(kode).zfill(6) if kode is not None else None

    sites = [normalize_site(s) for s in _current(v.get("hjemmeside"))]
    mails = [email_domain(s) for s in _current(v.get("elektroniskPost"))]
    for k in meta.get("nyesteKontaktoplysninger") or []:  # blandet liste af strenge
        if "@" in str(k):
            mails.append(email_domain(k))
        else:
            sites.append(normalize_site(k))
    sites = [s for s in sites if s]
    mails = [m for m in mails if m]
    own_mail = [m for m in mails if m not in config.FREEMAIL_DOMAINS]

    ikode, antal, kilde, aar = _employment(meta)
    return {
        "cvr": v.get("cvrNummer"),
        "branchekode": kode,
        "gruppe": config.group_for_code(kode),
        "virksomhedsform": formkort or formkode,
        "personligt_ejet": formkode in config.PERSONAL_FORM_CODES
        or formkort.upper() in config.PERSONAL_FORM_SHORT,
        "status": meta.get("sammensatStatus"),
        "reklamebeskyttet": bool(v.get("reklamebeskyttet")),
        "hjemmeside": sites[0] if sites else None,
        "har_email": bool(mails),
        "email_domaene": own_mail[0] if own_mail else None,  # kun egne domæner
        "ansatte_interval": ikode,
        "ansatte_bucket": config.employee_bucket(ikode, antal),
        "ansatte_kilde": kilde,
        "ansatte_aar": aar,
    }


def run(sets: tuple[str, ...], size: int, max_docs: int | None, out: Path) -> pd.DataFrame:
    client = CvrClient()
    query = branch_query(config.all_codes(sets))
    print(f"Forventet antal aktive virksomheder: {client.count(query)}")
    rows = []
    for i, doc in enumerate(client.scroll(query, config.SOURCE_FIELDS, size, max_docs), 1):
        rows.append(flatten(doc))
        if i % 5000 == 0:
            print(f"  {i} hentet ...")
    df = pd.DataFrame(rows)
    if df.empty:
        print("Ingen rækker - kør `python -m src.cvr_client probe`.")
        return df
    out.parent.mkdir(exist_ok=True)
    personal = df["personligt_ejet"]
    # Personligt ejede: kun aggregerede tal gemmes.
    (df[personal].groupby(["gruppe", "ansatte_bucket"]).size()
        .rename("antal").reset_index()
        .to_csv(out.with_name("excluded_counts.csv"), index=False))
    keep = df[~personal].drop(columns=["personligt_ejet"])
    keep.to_csv(out, index=False)
    print(f"{len(keep)} virksomheder skrevet til {out} "
          f"({int(personal.sum())} personligt ejede udeladt, kun talt).")
    return keep


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--sets", nargs="+", default=["core", "extra"], choices=["core", "extra"])
    p.add_argument("--size", type=int, default=200, help="dokumenter pr. scroll-kald")
    p.add_argument("--max-docs", type=int, default=None)
    p.add_argument("--out", type=Path, default=DATA / "companies.csv")
    a = p.parse_args(argv)
    try:
        run(tuple(a.sets), a.size, a.max_docs, a.out)
    except CvrAuthError as e:
        print(f"FEJL: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
