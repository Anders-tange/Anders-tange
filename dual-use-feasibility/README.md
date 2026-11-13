# Dual-use feasibility

Forundersøgelse til kandidatspeciale (CBS, forår 2027) om danske it- og
teknologivirksomheders dual-use-kompetencer. Resultater og anbefaling står i
[`feasibility_report.md`](feasibility_report.md); mailudkast ligger i [`drafts/`](drafts/).

## Kom i gang

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # udfyld CVR_USER, CVR_PASSWORD, CONTACT_EMAIL
python -m pytest -q           # offline-tests, kræver ikke login
```

## Kørselsrækkefølge når CVR-login er modtaget

| Trin | Kommando | Output |
|---|---|---|
| 1. Tjek login og feltnavne | `python -m src.cvr_client probe` | rapport på skærmen |
| 2. Udtræk pr. branchekode | `python -m src.extract` | `data/companies.csv` |
| 3. Dækningstabeller | `python -m src.coverage` | `data/coverage.md` + csv |
| 4. Stikprøve af hjemmesider | `python -m src.site_sample --n 200` | `data/site_sample.csv` |
| 5. Samme, kun 10+ ansatte | `python -m src.site_sample --n 200 --min-bucket 10+ --out data/site_sample_10plus.csv` | |
| 6. Plan B: årsrapporter | `python -m src.financials --from-companies --n 200 --min-bucket 10+` | `data/financials.csv` |

Trin 1 er vigtigt: flere feltnavne i `src/config.py` står ikke i
Erhvervsstyrelsens vejledning og er markeret `UVERIFICERET`. `probe` viser,
hvilke der mangler, og udskriver de faktiske nøgler, så de kan rettes ét sted.

Trin 6 kræver ikke login og kan også køres nu:
`python -m src.financials --random 200` eller `--cvr 30714024`.

## Regler koden følger

- Credentials kun i `.env` (i `.gitignore`). `data/` er heller ikke i git.
- Virksomhedsnavne, adresser og deltagere hentes ikke. E-mail reduceres til
  domæne. Personligt ejede virksomheder (ENK, PMV, I/S) tælles kun aggregeret.
- Hjemmesider: robots.txt respekteres, én forside pr. site, pause mellem
  sites, identificerende User-Agent, og der gemmes kun nøgletal – ingen tekst.
- CVR: scroll med `1m`, moderat `size`, begrænset `_source`, scroll ryddes op.

> Repoet er jeres offentlige GitHub-profilrepo. Overvej at flytte projektet
> til et privat repo, før der kommer mere end kode og udkast i det.
