# Feasibility-rapport: kortlægning af dansk dual-use-kapacitet

Status pr. 13. november 2026. Anders Tange og Gustav Manthorpe, Cand.merc.(it.), CBS.

## Anbefaling

**Betinget go.** Intet af det, der kunne undersøges uden CVR-login, taler imod
projektet, men de to tal, go/no-go-kriterierne hviler på – hjemmesidedækning
og CVR-adgang – findes endnu ikke. Planlæg efter **plan B (årsrapporter)** som
hoveddesign og betragt DST-kobling som en mulig udvidelse, ikke en forudsætning.

| Kriterium | Status | Grundlag |
|---|---|---|
| CVR-adgang inden for 3 uger | **Åben** – ansøgning ikke sendt | Udkast klar. En tredjepartskilde nævner "et par ugers" ventetid, så mailen bør sendes straks |
| ≥ 60 % af virksomheder med 10+ ansatte har fungerende hjemmeside med brugbar tekst | **Ikke målt** – kræver CVR-udtræk | Kode klar og testet offline. Røgtest på 5 kendte forsvarsteknologi-sites: 5/5 brugbare |
| Realistisk vej til DST-kobling eller årsrapport-proxyer | **Delvist opfyldt** | Årsrapporter: åben adgang verificeret, men svage FoU-proxyer. DST-kobling: usandsynlig under specialeordningen |

Tre ting bør I vide, før I lægger jer fast:

1. **Omsætning mangler i de fleste årsrapporter.** I en tilfældig stikprøve
   på 200 nye regnskaber havde 14 % omsætning og 1 % aktiverede
   udviklingsomkostninger. Bruttofortjeneste (78 %) og antal ansatte (78 %) er
   de variable, der kan bære en regression.
2. **DST's specialeordning er bygget til forudvalgte data**, ikke til at koble
   egne data på. Reglerne nævner ikke upload af egne data, og de stiller krav
   til vejleders registererfaring, som skal afklares med Jonas Hedman først.
3. **CVR bruger DB25, ikke DB07.** Fem af seks kandidatkoder har ændret numre
   eller indhold på 6-cifret niveau.

## Tjek 1: CVR-adgang

### Procedure
- Adgang søges pr. mail til **cvrselvbetjening@erst.dk**. Adressen fremgår af
  Erhvervsstyrelsens datahub-side for "System-til-system adgang til CVR-data"
  og går igen i flere tredjepartskilder.
- **Ikke verificeret:** den aktuelle artikel på datacvr.virk.dk
  (`/artikel/system-til-system-adgang-til-cvr-data`) ligger bag en
  Cloudflare-spærring og kunne ikke læses herfra. Om erklæringen skal
  vedhæftes første mail, eller sendes til jer bagefter, skal I selv læse i en
  browser, før I sender.
- Mailudkast: [`drafts/01_mail_erhvervsstyrelsen_cvr.md`](drafts/01_mail_erhvervsstyrelsen_cvr.md). Intet er sendt.

### Teknisk grundlag
Verificeret mod Erhvervsstyrelsens vejledning "Kom godt igang med
Elasticsearch" (version 3/11-2025):

| Punkt | Værdi |
|---|---|
| Endpoint | `POST http://distribution.virk.dk/cvr-permanent/virksomhed/_search` |
| Autentificering | HTTP Basic (bruger-id og password) |
| Elasticsearch-version | 6.8.23, kun læseadgang via REST |
| Store udtræk | scroll: `?scroll=1m`, derefter `/_search/scroll`, til sidst `DELETE /_search/scroll` |
| Aktive virksomheder | nested query på `Vrvirksomhed.livsforloeb` uden `periode.gyldigTil` |
| Andre typer | `produktionsenhed` (`VrproduktionsEnhed.pNummer`), `deltager` (`Vrdeltager.enhedsNummer`) |
| Driftskrav | Ineffektive løsninger kan få adgangen spærret midlertidigt; sænk `size` frem for at forlænge scroll |

Herfra svarer endpointet med HTTP 401 uden login, så netværket er ikke en
hindring. To forbehold:

- **Vejledningen bruger `http://`.** HTTPS mod `distribution.virk.dk` blev
  afbrudt herfra; det kan skyldes dette miljøs proxy. Test
  `CVR_BASE_URL=https://distribution.virk.dk` lokalt. Virker det ikke, sendes
  login ukrypteret – brug da et password, I ikke bruger andre steder.
- **Feltnavne uden for vejledningen er ikke verificeret.** Vejledningen
  dokumenterer kun `cvrNummer`, `virksomhedMetadata.nyesteNavn`,
  `nyesteBeliggenhedsadresse`, `sammensatStatus`, `livsforloeb` og
  `sidstIndlaest`. Felterne til branche, virksomhedsform, kontaktoplysninger,
  beskæftigelse og reklamebeskyttelse følger den almindeligt kendte
  datamodel og er markeret `UVERIFICERET` i `src/config.py`.
  `python -m src.cvr_client probe` tjekker dem alle mod et rigtigt dokument.

## Tjek 2: virksomheder og hjemmesider pr. branchekode

### DB07 eller DB25
CVR har brugt **DB25** (NACE Rev. 2.1) siden 1. januar 2025; alle virksomheder
har fået en DB25-kode. Danmarks Statistik udgav 2025-statistik på DB07 via
intern dobbeltkodning og skifter de fleste statistikker til DB25 i 2026;
nationalregnskabet følger sidst. Konsekvenser:

- Udtrækket skal defineres i DB25. Koden gør det med eksplicitte 6-cifrede koder.
- Sammenligning med ældre DST-tal kræver DST's nøgle (`DB07_DB25_nøgle_brancher.xlsx`).
  Relationerne er mange-til-mange, og DST advarer selv mod den simple 1-1-matrice.
- Virksomheder kunne rette deres kode i 2025, så der er et databrud ved årsskiftet 2024/25.

### Kandidatkoderne i DB25

| Kandidat | DB25 | Ændring fra DB07 |
|---|---|---|
| 26 Computere, elektronik, optik | 26.11–26.70 (10 koder) | 26.80 lagt ind i 26.70. Dele af 26.20 og 26.30 flyttet til 26.40/26.51; kontormaskiner (28.23) og noget medicoudstyr (32.50) flyttet ind |
| 30.3 Luft- og rumfartøjer | **30.31 civil, 30.32 militær** | 30.30 er delt i to – nyttigt for jer |
| 62 It-programmering og -konsulenter | **62.10, 62.20, 62.90** | 62.01→62.10; 62.02 og 62.03→62.20; 62.09→62.90 |
| 63 Informationstjenester | **63.10, 63.91, 63.92** | Nu "It-infrastruktur, databehandling, hosting". Pressebureauer flyttet ud (60.31); webportaler delvist til 60.39 |
| 71.12 Ingeniørvirksomhed | 71.12.10–71.12.90 | Uændrede koder |
| 72.1 FoU natur/teknik | **72.10** | 72.11 (biotek) og 72.19 lagt sammen – biotek kan ikke længere skilles fra |

### Validering af listen
Listen er et rimeligt udgangspunkt, men den har tre svagheder:

- **Støj.** 71.12.10 (byggerådgivning) og 71.12.40 (landinspektører) er næppe
  relevante. 72.10 rummer nu al biotek. 62 er meget stor og domineret af små
  konsulentfirmaer.
- **Huller.** Softwareproduktvirksomheder ligger i **58.2**, og tele/satellit
  i **61**. DB25 har desuden eksplicit militære koder: **25.30** våben og
  ammunition (hed 25.40 i DB07), **30.13** militærfartøjer og **30.40**
  kampkøretøjer. Koden henter dem som et "extra"-sæt, så I kan se størrelsen
  og vælge fra. Droneproducenter kan også ligge i 28.99 eller 27.90; det er
  ikke medtaget.
- **Hovedbranche er selvvalgt** og siger lidt om dual-use. Branchekoden bør
  bruges til at afgrænse populationen, ikke som forklarende variabel alene.

### Dækningstabel
**Kan ikke udfyldes uden CVR-login.** Tabellen dannes af `src/extract.py` og
`src/coverage.py`:

| Gruppe | Aktive | Med hjemmeside | Med e-mail | E-mail med eget domæne | Hjemmeside eller domæne | 0 ans. | 1–9 | 10–49 | 50+ |
|---|---|---|---|---|---|---|---|---|---|
| 26 | – | – | – | – | – | – | – | – | – |
| 30.3 | – | – | – | – | – | – | – | – | – |
| 62 | – | – | – | – | – | – | – | – | – |
| 63 | – | – | – | – | – | – | – | – | – |
| 71.12 | – | – | – | – | – | – | – | – | – |
| 72.1 | – | – | – | – | – | – | – | – | – |

"E-mail med eget domæne" udelader gmail, hotmail, live.dk og lignende, da de
ikke peger på en hjemmeside. Personligt ejede virksomheder tælles kun samlet.

### Stikprøvetjek af hjemmesider
`src/site_sample.py` trækker 200 tilfældige virksomheder, henter robots.txt og
forsiden, og gemmer statuskode, antal ord og sprog – ingen tekst. "Brugbar"
betyder mindst 150 ord på dansk eller engelsk på forsiden.

Kun en røgtest er kørt (terma.com, systematic.com, weibel.dk, mydefence.com,
quadsat.com): 5/5 svarede, ingen blev afvist af robots.txt, 307–1.076 ord, alle
på engelsk. Det viser, at koden virker, ikke hvordan dækningen er – de fem er
håndplukkede og velkendte. To ting at holde øje med i den rigtige stikprøve:
andelen af rent engelsksprogede sites (klassifikationsmodellen skal kunne begge
sprog) og sites med lidt tekst og meget JavaScript, som koden markerer særskilt.

## Tjek 3: registerdata fra Danmarks Statistik

### Hvad reglerne siger
Fra DST's regler for specialeordningen (18/2-2026) og ordningens hjemmeside:

- CBS er et af de otte universiteter, der kan autoriseres. Autorisationen
  gives til et **fakultet, institut eller center** og bygger på en eksisterende
  autorisation under mikrodataordningerne. Mindst tre personer i miljøet skal
  have registererfaring.
- Instituttet opretter **højst fem brede projekter** med forudvalgte data, som
  skal kunne bruges af specialestuderende i flere år. Studerende tilknyttes et
  af dem.
- Data er pseudonymiserede: CVR-nummer, navn og adresse er fjernet.
- Vejleder underskriver en **forskningshøjdeformular**. Det "fordrer
  implicit, at vejleders forskning bl.a. er baseret på mikrodata", og
  vejledere skal have mindst et halvt års erfaring med DST's mikrodataordninger.
- Studerende har **ikke hjemtagelsesret**; vejleder hjemtager resultater.
- Data til de brede projekter leveres gratis; der er brugerbetaling pr. studerende.

### Vurdering
Reglerne nævner ikke upload eller kobling af egne data. Ordningens
konstruktion – få, brede, flerårige projekter med faste data – peger på, at
det ikke er tiltænkt. Det er min læsning, ikke et svar fra DST. Den
realistiske vej til kobling er forskerordningen via et eksisterende
CBS-forskningsprojekt, hvilket koster penge og typisk tager måneder. Om CBS
eller DIGI har en uddannelsesautorisation, har jeg ikke kunnet finde oplyst.

Et yderligere forbehold: FoU-statistikken er en stikprøve, så selv med kobling
vil kun en del af jeres virksomheder kunne genfindes.

- Spørgsmål til Jonas Hedman: [`drafts/02_spoergsmaal_hedman.md`](drafts/02_spoergsmaal_hedman.md)
- Mailudkast til DST: [`drafts/03_mail_dst.md`](drafts/03_mail_dst.md) (til `danmarksdatavindue@dst.dk`, som DST selv angiver). Ikke sendt.

### Plan B: årsrapporter
Regnskabsindekset `http://distribution.virk.dk/offentliggoerelser/_search`
er **åbent uden login** og kan nås herfra. Hvert hit linker til årsrapporten
som XBRL. `src/financials.py` henter og parser dem.

Pilot: 200 tilfældige regnskaber offentliggjort siden 1/1-2026, alle brancher:

| Variabel | Andel med værdi |
|---|---|
| Årets resultat, egenkapital, aktiver | 100 % |
| Bruttofortjeneste | 78 % |
| Gennemsnitligt antal ansatte | 78 % |
| Personaleomkostninger | 40 % |
| Omsætning | 14 % |
| Immaterielle aktiver | 10 % |
| Aktiverede udviklingsprojekter > 0 | 1 % |
| FoU-omkostninger (resultatopgørelse) | 0 % |

Alle 200 havde XBRL. Stikprøven er domineret af små selskaber (kun 7 havde
10+ ansatte) og dækker alle brancher, så tallene er en nedre grænse for
tech-virksomheder med 10+ ansatte – ikke et estimat for jeres population.
Mønsteret er dog strukturelt: små og mellemstore selskaber må udelade
omsætning og vise bruttofortjeneste, og også Nine A/S med 141 ansatte gør det.
Aktivering af udviklingsomkostninger er et regnskabsvalg, så fravær betyder
ikke fravær af udvikling.

Konsekvens for designet: brug bruttofortjeneste, ansatte og
personaleomkostninger pr. ansat som udfald og kontrolvariable, og behandl
aktiverede udviklingsomkostninger som en indikator (ja/nej), ikke som et mål
for FoU-intensitet. Mål dækningen igen på jeres egen population (trin 6 i
README), før regressionsdesignet låses.

## GDPR og etik
- Personligt ejede virksomheder (ENK, PMV, I/S) skrives ikke til datasættet;
  kun antal gemmes.
- Navne, adresser og deltagere hentes ikke. E-mail reduceres til domæne.
- Fra hjemmesider gemmes kun nøgletal. I den senere fulde scraping kommer der
  tekst med personnavne (medarbejdersider, kontaktsider); det kræver en
  særskilt beslutning om filtrering og opbevaring.
- Reklamebeskyttelse hentes med som felt. Den forbyder ikke analyse, men
  virksomhederne må ikke kontaktes i markedsføringsøjemed.
- Afklar med CBS, om behandlingen skal registreres (spørgsmål 10 til Hedman).

## Næste skridt

| Hvem | Hvad | Hvornår |
|---|---|---|
| Jer | Læs datacvr-artiklen i en browser og send CVR-ansøgningen | I dag – 3-ugersfristen løber fra afsendelse |
| Jer | Send spørgsmålene til Jonas Hedman; aftal møde | Denne uge |
| Jer | Send DST-mailen, helst med Hedman cc | Efter mødet |
| Jer | Kør trin 1–6 i README, når login er modtaget | Ca. en halv dag |
| Jer | Udfyld dækningstabellen og afgør go/no-go | Senest 3 uger efter ansøgning |

Hvis CVR-adgangen trækker ud, er der ingen god erstatning: regnskabsindekset
er åbent, men indeholder hverken branchekode eller hjemmeside.
System-til-system-adgangen er derfor projektets reelle flaskehals.

## Kilder
- Erhvervsstyrelsen: [Kom godt igang med Elasticsearch](https://erhvervsstyrelsen.dk/kom-godt-igang-med-elasticSearch)
- Erhvervsstyrelsen: [System-til-system adgang til CVR-data (datahub)](http://datahub.virk.dk/dataset/system-til-system-adgang-til-cvr-data/resource/5038fd33-bb8d-4e43-a0eb-2d75cc0fa936)
- Erhvervsstyrelsen: [System-til-system-adgang til CVR-data (datacvr, ikke læst – spærret for automatisk adgang)](https://datacvr.virk.dk/artikel/system-til-system-adgang-til-cvr-data)
- Danmarks Statistik: [Dansk Branchekode er gældende (DB25)](https://www.dst.dk/da/Statistik/dokumentation/dansk-branchekode-er-gaeldende) og nøglen `DB07_DB25_nøgle_brancher.xlsx` derfra
- Danmarks Statistik: [Specialeordningen til uddannelsesinstitutioner](https://www.dst.dk/da/TilSalg/data-til-forskning/mikrodataordninger/specialeordningen-til-uddannelsesinstitutioner)
- Danmarks Statistik: [Regler for adgang til pseudonymiserede mikrodata under specialeordningen (pdf, 18/2-2026)](https://rss.dst.dk/ext/3391210222463/0/forskning/Regler-for-adgang-til-pseudonymiserede-mikrodata-under-Danmarks-Statistiks-specialeordning-(pdf)--pdf)
- Danmarks Statistik: [Specialeordningen er nu åben (1/9-2025)](https://www.dst.dk/da/TilSalg/data-til-forskning/nyt-og-meddelelser/2025/aaben-for-adgang-til-specialeordning)
