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

## Installation (5 minutter)

**1. Installér `uv`**, som også henter den rigtige Python-version. macOS' indbyggede Python er for gammel.

macOS (Terminal):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```
Windows (PowerShell):
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**2. Installér serveren.** Luk og genåbn terminalen først, så `uv` kan findes.
```bash
uv tool install --python 3.12 "nordnet-mcp[yahoo] @ git+https://github.com/Anders-tange/Anders-tange@claude/friendly-fermi-cmahdq#subdirectory=nordnet-mcp"
```
Når koden er merget til `main`, kan `@claude/friendly-fermi-cmahdq` fjernes fra linjen.

**3. Kør opsætningen.** Den opretter `~/nordnet-data/` og tilføjer serveren i Claude Desktop. Din
eksisterende config bevares, og der tages en backup først.
```bash
~/.local/bin/nordnet-mcp-setup                 # Claude Desktop
~/.local/bin/nordnet-mcp-setup --claude-code   # også Claude Code
```
På Windows: `%USERPROFILE%\.local\bin\nordnet-mcp-setup.exe`

**4. Hent dine data** (se næste afsnit), og tjek dem uden Claude:
```bash
~/.local/bin/nordnet-mcp-setup --check
```
Kommandoen viser beholdning, kostpris og kontanter. Sammenlign med Nordnet. Den viser også
transaktionstyper, serveren ikke genkender.

**5. Genstart Claude Desktop helt** (Cmd+Q på Mac), og spørg *"Hvad er mit Nordnet-depot værd?"*

Opdatering til nyeste version: `uv tool upgrade nordnet-mcp`

## Hent dine data fra Nordnet

1. Log ind på nordnet.dk, og gå til **Konto → Transaktioner og notaer**.
2. Vælg **alle depoter** og den **fulde periode** (fra du oprettede kontoen). Gennemsnitlig
   købskurs og realiseret gevinst er kun korrekte, hvis hele historikken er med. Kan du kun eksportere
   ét depot ad gangen, så gem én fil pr. depot.
3. Klik **Eksporter** (CSV), og gem filen i `~/nordnet-data/`.

Du kan lægge flere filer i mappen, fx én pr. år eller en ny eksport hver måned.
Dubletter fjernes automatisk ud fra Nordnets transaktions-id. Efter en ny eksport kan du bare bede
Claude om at "genindlæse Nordnet-data".

Danske, svenske, norske, finske og engelske eksporter understøttes, i både UTF-16/tab og
UTF-8/semikolon. Makulerede transaktioner springes over.

## Manuel opsætning

Hvis du hellere vil skrive configen selv, gør du sådan.

Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` på Mac,
`%APPDATA%\Claude\claude_desktop_config.json` på Windows):

```json
{
  "mcpServers": {
    "nordnet": {
      "command": "/Users/DIG/.local/share/uv/tools/nordnet-mcp/bin/nordnet-mcp",
      "env": { "NORDNET_DATA_DIR": "/Users/DIG/nordnet-data" }
    }
  }
}
```

Claude Code:

```bash
claude mcp add nordnet --scope user -e NORDNET_DATA_DIR=$HOME/nordnet-data -- ~/.local/bin/nordnet-mcp
```

## Brug sammen med bank-skill'en (nettoformue)

Erstat linjen om Nordnet under "Budgets, goals, debt and assets" i bank-skill'en med:

```markdown
- **Nordnet (live from exports):** If the `nordnet_*` tools are available, call `nordnet_portfolio_summary`
  and use `total_value` (holdings at delayed prices + cash, DKK) as the Nordnet figure. Check `last_date`
  from `nordnet_status`: if the newest transaction is over a month old, say so and ask the user to export
  a fresh file into ~/nordnet-data. Only if the tools are unavailable, fall back to the manual Nordnet
  figure entered in this skill.
```

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
python3 -m venv .venv
.venv/bin/pip install -e ".[yahoo,dev]"
.venv/bin/pytest
npx @modelcontextprotocol/inspector .venv/bin/nordnet-mcp   # prøv værktøjerne i browseren
```

Testdata i `tests/fixtures/` er opdigtede.
