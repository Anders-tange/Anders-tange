# nordnet-mcp

En MCP-server, der giver Claude **læseadgang til din Nordnet-portefølje**. Den bygger på
transaktionseksporten fra Nordnet (CSV) og henter forsinkede kurser fra Yahoo Finance.

- Kræver hverken Nordnets API, login eller adgangskoder. Serveren læser kun de filer, du selv eksporterer.
- Den kan kun læse og kan ikke handle eller flytte penge.
- Alt kører lokalt på din egen maskine, og dine data forlader den ikke. Undtagelsen er kursopslag,
  som sender ISIN/ticker til Yahoo.

## Værktøjer

| Værktøj | Hvad det giver |
| --- | --- |
| `nordnet_portfolio_summary` | Samlet værdi (beholdning + kontanter), nettoindskud, afkast, udbytter, realiseret og urealiseret gevinst |
| `nordnet_get_holdings` | Beholdning pr. depot: antal, gns. købskurs, kostpris, markedsværdi, urealiseret gevinst, vægt |
| `nordnet_get_transactions` | Søg i transaktioner (fritekst, kategori, periode, depot) med paginering |
| `nordnet_get_dividends` | Udbytter brutto, udbytteskat og netto, grupperet pr. papir, måned eller år |
| `nordnet_get_realized_gains` | Realiserede gevinster/tab pr. salg efter gennemsnitsmetoden, med Nordnets "Resultat" til sammenligning |
| `nordnet_get_cashflows` | Indbetalinger, hævninger, renter, gebyrer og skat pr. år eller måned |
| `nordnet_get_quote` | Forsinket kurs på et ISIN eller en ticker |
| `nordnet_list_accounts` | Depoter med valuta, kontantsaldo og periode |
| `nordnet_status` / `nordnet_reload` | Hvilke filer der er indlæst, og genindlæsning efter ny eksport |

## Installation

Kræver Python 3.10 eller nyere.

```bash
git clone https://github.com/anders-tange/anders-tange.git
cd anders-tange/nordnet-mcp
python3 -m venv .venv
.venv/bin/pip install -e ".[yahoo]"
```

## Hent dine data fra Nordnet

1. Log ind på nordnet.dk, og gå til **Konto → Transaktioner og notaer**.
2. Vælg **alle depoter** og den **fulde periode** (fra du oprettede kontoen). Gennemsnitlig
   købskurs og realiseret gevinst er kun korrekte, hvis hele historikken er med.
3. Klik **Eksporter** (CSV), og gem filen i din datamappe, fx `~/nordnet-data/`.

Du kan lægge flere filer i mappen, fx én pr. år eller en ny eksport hver måned.
Dubletter fjernes automatisk ud fra Nordnets transaktions-id. Efter en ny eksport kan du bare bede
Claude om at "genindlæse Nordnet-data".

Danske, svenske, norske, finske og engelske eksporter understøttes, i både UTF-16/tab og
UTF-8/semikolon. Makulerede transaktioner springes over.

## Opsætning i Claude

**Claude Desktop**: Tilføj serveren i `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "nordnet": {
      "command": "/STI/TIL/anders-tange/nordnet-mcp/.venv/bin/nordnet-mcp",
      "env": {
        "NORDNET_DATA_DIR": "/Users/DIG/nordnet-data"
      }
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add nordnet --scope user \
  -e NORDNET_DATA_DIR=$HOME/nordnet-data \
  -- /STI/TIL/anders-tange/nordnet-mcp/.venv/bin/nordnet-mcp
```

Genstart Claude, og spørg fx *"Hvad er min Nordnet-portefølje værd nu?"* eller
*"Hvor meget udbytte fik jeg i 2025, fordelt på aktier?"*

## Konfiguration

| Miljøvariabel | Standard | Formål |
| --- | --- | --- |
| `NORDNET_DATA_DIR` | `~/nordnet-data` | Mappen med dine Nordnet-eksporter |
| `NORDNET_PRICE_PROVIDER` | `yahoo` | `yahoo` eller `none` (så bruges kun `prices.csv`) |
| `NORDNET_BASE_CURRENCY` | `DKK` | Valuta for totaler i `nordnet_portfolio_summary` |

Du kan lægge to valgfrie filer i datamappen (se [`examples/`](examples)):

- **`symbols.json`** fastlåser, hvilken Yahoo-ticker et ISIN skal slås op som. Uden filen finder
  serveren selv en ticker og foretrækker nordiske børser (.CO/.ST/.OL/.HE). Brug den, hvis den
  automatiske ticker er forkert, eller hvis et papir ikke findes.
- **`prices.csv`** indeholder manuelle kurser, som altid går forud for Yahoo. Den er nyttig til fonde,
  som Yahoo ikke kender. Linjer som `USDDKK;6,85` sætter en valutakurs.

## Beregninger og begrænsninger

- **Kostpris** beregnes efter gennemsnitsmetoden inkl. kurtage og i depotets valuta.
  Udenlandske aktier tæller med i kroner til den vekselkurs, Nordnet brugte ved handlen.
- **Antal** følger Nordnets egen kolonne "Totalt antal", så splits og lignende kommer med.
- **Kurser** er forsinkede (ca. 15 min.). Papirer uden kurs tæller med til kostpris i oversigten og
  vises under `unpriced_isins`.
- **Afkast** er simpelt: værdi minus nettoindskud. Det er ikke tidsvægtet. Værdipapirer, der er
  flyttet ind fra en anden bank, tæller ikke som indskud.
- **Ikke skatterådgivning.** Realiserede gevinster er vejledende. Tjek altid årsopgørelsen.
- Nordnets kolonnenavne kan ændre sig. Hvis en fil springes over, viser `nordnet_status` hvorfor.

## Hvorfor ikke Nordnets API?

Nordnets officielle External API tager i øjeblikket ikke imod nye kunder, og det koster 1.290 SEK om
måneden. Serveren er bygget, så kursudbyderen kan skiftes ud (`prices.py`). Hvis der kommer
API-adgang, kan transaktionerne også hentes derfra i stedet for fra CSV.

## Udvikling

```bash
.venv/bin/pip install -e ".[yahoo,dev]"
.venv/bin/pytest
npx @modelcontextprotocol/inspector .venv/bin/nordnet-mcp   # prøv værktøjerne i browseren
```

Testdata i `tests/fixtures/` er opdigtede.
