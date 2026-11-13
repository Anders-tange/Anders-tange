"""Dækningstabel pr. branchegruppe ud fra data/companies.csv.

    python -m src.coverage            # skriver data/coverage.csv + coverage.md

Kolonner: aktive virksomheder, andel med hjemmeside i CVR, andel med e-mail,
andel hvor e-maildomænet kan bruges som hjemmeside-proxy (eget domæne, ikke
gmail o.l.), samlet "kan findes på nettet", samt fordeling på ansatte.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from . import config

DATA = Path(__file__).resolve().parent.parent / "data"


def add_flags(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["har_hjemmeside"] = df["hjemmeside"].notna()
    df["har_email"] = df["har_email"].fillna(False).astype(bool)
    df["har_email_proxy"] = df["email_domaene"].notna()
    df["har_site_eller_proxy"] = df["har_hjemmeside"] | df["har_email_proxy"]
    df["site_kandidat"] = df["hjemmeside"].fillna(df["email_domaene"])
    return df


def coverage_table(df: pd.DataFrame, by: list[str]) -> pd.DataFrame:
    df = add_flags(df)
    g = df.groupby(by, dropna=False)
    t = g.agg(aktive=("cvr", "size"),
              med_hjemmeside=("har_hjemmeside", "sum"),
              med_email=("har_email", "sum"),
              med_email_proxy=("har_email_proxy", "sum"),
              site_eller_proxy=("har_site_eller_proxy", "sum")).astype(int)
    for c in ("med_hjemmeside", "med_email", "med_email_proxy", "site_eller_proxy"):
        t[c + "_pct"] = (100 * t[c] / t["aktive"]).round(1)
    return t.reset_index()


def employee_table(df: pd.DataFrame) -> pd.DataFrame:
    t = pd.crosstab(df["gruppe"], df["ansatte_bucket"])
    t = t.reindex(columns=[b for b in config.BUCKET_ORDER], fill_value=0)
    t["10+"] = t["10-49"] + t["50+"]
    return t.reset_index()


def to_md(df: pd.DataFrame) -> str:
    cols = [str(c) for c in df.columns]
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    lines += ["| " + " | ".join(str(v) for v in row) + " |" for row in df.itertuples(index=False)]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--in", dest="inp", type=Path, default=DATA / "companies.csv")
    a = p.parse_args(argv)
    if not a.inp.exists():
        print(f"FEJL: {a.inp} findes ikke - kør først `python -m src.extract`.", file=sys.stderr)
        return 2
    df = pd.read_csv(a.inp, dtype={"cvr": str, "branchekode": str})
    by_group = coverage_table(df, ["gruppe"])
    by_size = coverage_table(df, ["gruppe", "ansatte_bucket"])
    big = coverage_table(df[df["ansatte_bucket"].isin(["10-49", "50+"])], ["gruppe"])
    emp = employee_table(df)
    by_group.to_csv(a.inp.with_name("coverage.csv"), index=False)
    by_size.to_csv(a.inp.with_name("coverage_by_size.csv"), index=False)
    md = "\n\n".join([
        "## Dækning pr. branchegruppe (alle størrelser)", to_md(by_group),
        "## Dækning pr. branchegruppe, kun 10+ ansatte", to_md(big),
        "## Fordeling på ansatte", to_md(emp),
        "## Dækning pr. gruppe og størrelse", to_md(by_size),
    ])
    a.inp.with_name("coverage.md").write_text(md + "\n", encoding="utf-8")
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
