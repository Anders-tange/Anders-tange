"""Tynd klient til Erhvervsstyrelsens CVR Elasticsearch (system-til-system).

Følger vejledningen "Kom godt igang med Elasticsearch":
* POST {base}/cvr-permanent/virksomhed/_search med Query DSL i body, Basic auth
* store udtræk via scroll (?scroll=1m), efterfølgende GET/POST /_search/scroll
* scroll ryddes op med DELETE /_search/scroll, når man er færdig
* hellere lavere `size` end længere scroll-periode

Credentials læses fra miljøet / .env (CVR_USER, CVR_PASSWORD) - aldrig fra kode.

Kør `python -m src.cvr_client probe` som det første efter I har fået login:
den tjekker login og at alle feltnavne i config.py findes i rigtige data.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Iterator

import requests

from . import config

try:  # .env er valgfri (miljøvariabler virker også)
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass


class CvrAuthError(RuntimeError):
    pass


class CvrClient:
    def __init__(self, user: str | None = None, password: str | None = None,
                 base_url: str | None = None, timeout: int = 60,
                 pause: float = 0.2, session: requests.Session | None = None):
        self.user = user or os.getenv("CVR_USER")
        self.password = password or os.getenv("CVR_PASSWORD")
        self.base_url = (base_url or os.getenv("CVR_BASE_URL")
                         or "http://distribution.virk.dk").rstrip("/")
        if not self.user or not self.password:
            raise CvrAuthError(
                "CVR_USER/CVR_PASSWORD mangler. Kopiér .env.example til .env og udfyld.")
        self.timeout = timeout
        self.pause = pause  # høflig pause mellem kald
        self.s = session or requests.Session()
        self.s.auth = (self.user, self.password)
        self.s.headers.update({"Content-Type": "application/json"})

    # -- lavniveau -----------------------------------------------------------
    def _request(self, method: str, path: str, body: dict | None = None,
                 params: dict | None = None, retries: int = 4) -> dict:
        url = self.base_url + path
        for attempt in range(retries + 1):
            try:
                r = self.s.request(method, url, params=params, timeout=self.timeout,
                                   data=json.dumps(body) if body is not None else None)
            except requests.RequestException:
                if attempt == retries:
                    raise
                time.sleep(2 ** attempt)
                continue
            if r.status_code in (401, 403):
                raise CvrAuthError(
                    f"HTTP {r.status_code} fra {url}: forkert login, eller adgangen "
                    "er ikke aktiveret/spærret.")
            if r.status_code in (429, 502, 503, 504) and attempt < retries:
                time.sleep(2 ** attempt)
                continue
            if not r.ok:
                raise RuntimeError(f"HTTP {r.status_code} fra {url}: {r.text[:500]}")
            return r.json()
        raise RuntimeError("uopnåeligt")  # pragma: no cover

    def search(self, body: dict) -> dict:
        return self._request("POST", config.INDEX_PATH, body)

    def count(self, query: dict) -> int:
        """Antal hits for en query (size=0)."""
        return _total(self.search({"size": 0, "query": query}))

    def scroll(self, query: dict, source: list[str] | None = None,
               size: int = 200, max_docs: int | None = None) -> Iterator[dict]:
        """Yield _source for alle hits. Rydder altid scroll op bagefter."""
        body: dict[str, Any] = {"query": query, "size": size}
        if source is not None:
            body["_source"] = source
        resp = self._request("POST", config.INDEX_PATH, body,
                             params={"scroll": config.SCROLL_KEEPALIVE})
        scroll_id = resp.get("_scroll_id")
        n = 0
        try:
            while True:
                hits = resp.get("hits", {}).get("hits", [])
                if not hits:
                    return
                for h in hits:
                    yield h.get("_source", {})
                    n += 1
                    if max_docs is not None and n >= max_docs:
                        return
                time.sleep(self.pause)
                resp = self._request("POST", config.SCROLL_PATH, {
                    "scroll": config.SCROLL_KEEPALIVE, "scroll_id": scroll_id})
                scroll_id = resp.get("_scroll_id", scroll_id)
        finally:
            if scroll_id:
                try:
                    self._request("DELETE", config.SCROLL_PATH,
                                  {"scroll_id": scroll_id}, retries=0)
                except Exception:  # oprydning må ikke skjule den egentlige fejl
                    pass


def _total(resp: dict) -> int:
    t = resp.get("hits", {}).get("total", 0)
    return t["value"] if isinstance(t, dict) else int(t)  # ES 6 hhv. 7+


# -- queries -----------------------------------------------------------------
def active_query() -> dict:
    """Aktive virksomheder = et livsforløb uden gyldigTil (vejledningens kap. 4.1)."""
    return {"nested": {"path": config.F_LIVSFORLOEB, "query": {"bool": {"must_not": [
        {"exists": {"field": config.F_LIVSFORLOEB + ".periode.gyldigTil"}}]}}}}


def branch_query(codes: list[str], active_only: bool = True) -> dict:
    """Virksomheder hvis nyeste hovedbranche er en af `codes` (6 cifre).

    `terms` på eksplicitte koder virker uanset om feltet er keyword, text
    eller tal i mappingen - derfor ikke prefix/wildcard.
    """
    filters: list[dict] = [{"terms": {config.F_BRANCHEKODE: list(codes)}}]
    if active_only:
        filters.append(active_query())
    return {"bool": {"filter": filters}}


def get_path(doc: dict, dotted: str) -> Any:
    cur: Any = doc
    for part in dotted.split("."):
        if isinstance(cur, list):
            cur = cur[0] if cur else None
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def has_path(doc: dict, dotted: str) -> bool:
    cur: Any = doc
    for part in dotted.split("."):
        if isinstance(cur, list):
            cur = next((x for x in cur if isinstance(x, dict) and part in x), None)
        if not isinstance(cur, dict) or part not in cur:
            return False
        cur = cur[part]
    return True


# -- probe -------------------------------------------------------------------
def probe(client: CvrClient, cvr: str = "30714024") -> int:
    """Tjek login + at feltnavnene i config.py findes. Returnerer antal problemer."""
    problems = 0
    resp = client.search({"query": {"term": {config.F_CVR: cvr}}, "size": 1})
    hits = resp["hits"]["hits"]
    print(f"Login OK. Opslag på CVR {cvr}: {_total(resp)} hit (indeks {hits[0]['_index'] if hits else '-'}).")
    if not hits:
        print("  ! Ingen hit på test-CVR - prøv et andet nummer med --cvr.")
        return 1
    doc = hits[0]["_source"]
    meta = get_path(doc, config.M) or {}
    print("Nøgler i virksomhedMetadata:", ", ".join(sorted(meta)))
    for f in config.SOURCE_FIELDS:
        ok = has_path(doc, f)
        problems += not ok
        print(f"  {'OK ' if ok else 'MANGLER'}  {f}")
    kode = get_path(doc, config.F_BRANCHEKODE)
    print(f"Branchekode i testdokument: {kode!r} (type {type(kode).__name__}) - "
          f"{get_path(doc, config.F_BRANCHETEKST)!r}")
    for b in ("nyesteAarsbeskaeftigelse", "nyesteKvartalsbeskaeftigelse",
              "nyesteMaanedsbeskaeftigelse"):
        print(f"  {b}: {json.dumps(meta.get(b), ensure_ascii=False)}")
    # Virker terms-filteret på branchekoden?
    if kode is not None:
        n = client.count(branch_query([str(kode)]))
        print(f"Aktive virksomheder med branchekode {kode}: {n}")
        if n == 0:
            problems += 1
            print("  ! terms-filter på branchekode gav 0 - tjek felttype/format.")
    n_core = client.count(branch_query(config.all_codes(("core",))))
    print(f"Aktive virksomheder i kerne-branchekoderne i alt: {n_core}")
    if problems:
        print(f"\n{problems} problem(er): ret feltnavne i src/config.py ud fra nøglerne ovenfor.")
    else:
        print("\nAlle felter fundet. Klar til: python -m src.extract")
    return problems


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("probe", help="tjek login og feltnavne")
    pr.add_argument("--cvr", default="30714024", help="test-CVR (vejledningens eksempel)")
    ra = sub.add_parser("raw", help="print ét helt dokument (til at se datamodellen)")
    ra.add_argument("cvr")
    a = p.parse_args(argv)
    try:
        c = CvrClient()
        if a.cmd == "probe":
            return 1 if probe(c, a.cvr) else 0
        resp = c.search({"query": {"term": {config.F_CVR: a.cvr}}, "size": 1})
        print(json.dumps(resp, indent=1, ensure_ascii=False))
        return 0
    except CvrAuthError as e:
        print(f"FEJL: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
