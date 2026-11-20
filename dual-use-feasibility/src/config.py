"""Fælles konfiguration: branchekoder (DB25), ansatte-intervaller, feltnavne.

Kilder
------
* Endpoint, indeks, type og felterne markeret VERIFICERET er taget fra
  Erhvervsstyrelsens vejledning "Kom godt igang med Elasticsearch"
  (erhvervsstyrelsen.dk/kom-godt-igang-med-elasticSearch, version 3/11-2025).
* Felter markeret "VERIFICERET 20/11-2026" står ikke i vejledningen, men er
  bekræftet mod rigtige data med `python -m src.cvr_client probe`.
* Branchekoderne er DB25-koder slået op i Danmarks Statistiks nøgle
  "DB07_DB25_nøgle_brancher.xlsx" (ark "3. DB25 Alle koder").
"""
from __future__ import annotations

INDEX_PATH = "/cvr-permanent/virksomhed/_search"  # VERIFICERET
SCROLL_PATH = "/_search/scroll"  # VERIFICERET
SCROLL_KEEPALIVE = "1m"  # vejledningens anbefalede værdi

M = "Vrvirksomhed.virksomhedMetadata"
F_CVR = "Vrvirksomhed.cvrNummer"  # VERIFICERET
F_NAVN = f"{M}.nyesteNavn.navn"  # VERIFICERET
F_STATUS = f"{M}.sammensatStatus"  # VERIFICERET
F_LIVSFORLOEB = "Vrvirksomhed.livsforloeb"  # VERIFICERET (nested)
F_BRANCHEKODE = f"{M}.nyesteHovedbranche.branchekode"  # VERIFICERET 20/11-2026
F_BRANCHETEKST = f"{M}.nyesteHovedbranche.branchetekst"  # VERIFICERET 20/11-2026
F_FORMKODE = f"{M}.nyesteVirksomhedsform.virksomhedsformkode"  # VERIFICERET 20/11-2026
F_FORM = f"{M}.nyesteVirksomhedsform.kortBeskrivelse"  # VERIFICERET 20/11-2026
F_KONTAKT = f"{M}.nyesteKontaktoplysninger"  # VERIFICERET 20/11-2026 (liste af strenge)
F_AAR = f"{M}.nyesteAarsbeskaeftigelse"  # VERIFICERET 20/11-2026
F_KVARTAL = f"{M}.nyesteKvartalsbeskaeftigelse"  # VERIFICERET 20/11-2026
F_MAANED = f"{M}.nyesteMaanedsbeskaeftigelse"  # VERIFICERET 20/11-2026
# De tre felter ovenfor er frosset i 2018/2019. Det aktuelle tal (månedligt,
# fra eIndkomst) ligger her - fundet ved probe 20/11-2026:
F_ERST = f"{M}.nyesteErstMaanedsbeskaeftigelse"  # VERIFICERET 20/11-2026
F_HJEMMESIDE = "Vrvirksomhed.hjemmeside"  # VERIFICERET 20/11-2026 (liste m. periode)
F_EMAIL = "Vrvirksomhed.elektroniskPost"  # VERIFICERET 20/11-2026 (liste m. periode)
F_REKLAME = "Vrvirksomhed.reklamebeskyttet"  # VERIFICERET 20/11-2026

SOURCE_FIELDS = [
    F_CVR, F_STATUS, F_BRANCHEKODE, F_BRANCHETEKST, F_FORMKODE, F_FORM,
    F_KONTAKT, F_ERST, F_AAR, F_KVARTAL, F_MAANED, F_HJEMMESIDE, F_EMAIL, F_REKLAME,
]
# Virksomhedsnavn hentes bevidst IKKE i feasibility-fasen (dataminimering).

# Personligt ejede virksomhedsformer (personhenførbare) - udelades på rækkeniveau.
# VERIFICERET 20/11-2026: 10 = ENK, 15 = PMV, 30 = I/S.
PERSONAL_FORM_CODES = {"10", "15", "30"}
PERSONAL_FORM_SHORT = {"ENK", "PMV", "I/S"}

# --- Branchegrupper (DB25, 6-cifrede koder uden punktum, som i CVR) ---------
# "core" = kandidatlisten fra projektbeskrivelsen, oversat til DB25.
# "extra" = oplagte tilføjelser, som DB25 har gjort synlige (se rapporten).
BRANCH_GROUPS: dict[str, dict] = {
    "26": {
        "titel": "Fremstilling af computere, elektroniske og optiske produkter",
        "sæt": "core",
        "koder": ["261100", "261200", "262000", "263000", "264000", "265100",
                  "265200", "266010", "266090", "267000"],
    },
    "30.3": {
        "titel": "Fremstilling af luft- og rumfartøjer (30.31 civil, 30.32 militær)",
        "sæt": "core",
        "koder": ["303100", "303200"],
    },
    "62": {
        "titel": "Computerprogrammering og -konsulentbistand mv.",
        "sæt": "core",
        "koder": ["621000", "622000", "629000"],
    },
    "63": {
        "titel": "It-infrastruktur, databehandling, hosting og andre informationsaktiviteter",
        "sæt": "core",
        "koder": ["631000", "639100", "639200"],
    },
    "71.12": {
        "titel": "Rådgivende ingeniøraktiviteter og anden teknisk rådgivning",
        "sæt": "core",
        "koder": ["711210", "711220", "711230", "711240", "711290"],
    },
    "72.1": {
        "titel": "Forskning og eksperimentel udvikling inden for naturvidenskab og teknik",
        "sæt": "core",
        "koder": ["721000"],
    },
    "58.2": {
        "titel": "Udgivelse af software",
        "sæt": "extra",
        "koder": ["582100", "582900"],
    },
    "61": {
        "titel": "Telekommunikation (inkl. satellit)",
        "sæt": "extra",
        "koder": ["611000", "612000", "619000"],
    },
    "forsvar": {
        "titel": "Eksplicit militære koder: våben (25.30), militærfartøjer (30.13), "
                 "kampkøretøjer (30.40)",
        "sæt": "extra",
        "koder": ["253000", "301300", "304000"],
    },
}


def group_for_code(code: str | int | None) -> str | None:
    if code is None:
        return None
    c = str(code).replace(".", "").strip().zfill(6)
    for name, g in BRANCH_GROUPS.items():
        if c in g["koder"]:
            return name
    return None


def all_codes(sets: tuple[str, ...] = ("core", "extra")) -> list[str]:
    return [c for g in BRANCH_GROUPS.values() if g["sæt"] in sets for c in g["koder"]]


# --- Ansatte ----------------------------------------------------------------
def employee_bucket(interval_code: str | None, antal: int | None = None) -> str:
    """Map CVR's intervalKodeAntalAnsatte (fx 'ANTAL_10_19') til 0 / 1-9 / 10-49 / 50+."""
    low = None
    if interval_code:
        parts = str(interval_code).split("_")
        if len(parts) >= 2 and parts[1].isdigit():
            low = int(parts[1])
    if low is None and antal is not None:
        low = int(antal)
    if low is None:
        return "ukendt"
    if low == 0:
        return "0"
    if low < 10:
        return "1-9"
    if low < 50:
        return "10-49"
    return "50+"


BUCKET_ORDER = ["ukendt", "0", "1-9", "10-49", "50+"]

FREEMAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "hotmail.com", "hotmail.dk", "live.dk",
    "live.com", "outlook.com", "outlook.dk", "yahoo.com", "yahoo.dk",
    "icloud.com", "me.com", "mac.com", "msn.com", "mail.dk", "mail.com",
    "mail.tele.dk", "tdcadsl.dk", "post.tele.dk", "tele.dk", "youmail.dk",
    "stofanet.dk", "webspeed.dk", "os.dk", "privat.dk", "jubii.dk", "sol.dk",
    "ofir.dk", "pc.dk", "email.dk", "c.dk", "city.dk", "tdc.dk", "yousee.dk",
    "get2net.dk", "worldonline.dk", "proton.me", "protonmail.com", "gmx.com",
    "gmx.de", "aol.com", "e-box.dk", "live.se", "hotmail.se",
    "waoomail.dk", "fibermail.dk", "energimail.dk", "bbsyd.dk", "nypost.dk",
    "dlgmail.dk", "dbmail.dk", "firma.tele.dk", "vip.cybercity.dk", "cybercity.dk",
    "pm.me",
}

# Status, der tæller som "i drift". Øvrige (UNDERKONKURS, UNDERFRIVILLIGLIKVIDATION,
# UNDERTVANGSOPLØSNING ...) er formelt aktive i CVR, men udelades af populationen.
OPERATING_STATUS = {"NORMAL", "Aktiv"}
# Et e-maildomæne, som mindst så mange virksomheder deler, tilhører typisk en
# revisor eller registreringsagent (fx handelskammer.dk) og er ikke en proxy.
SHARED_DOMAIN_MIN = 5
