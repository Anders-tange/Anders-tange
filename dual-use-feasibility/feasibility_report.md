# Feasibility-rapport: kortlægning af dansk dual-use-kapacitet

Opdateret 20. november 2026 med rigtige CVR-data. Anders Tange og Gustav Manthorpe, Cand.merc.(it.), CBS.

## Anbefaling

**Go – med to justeringer.** Begræns populationen til virksomheder med
**10+ ansatte**, og byg et trin, der **finder hjemmesider ud fra
virksomhedsnavnet**, ind i pipelinen. Brug **årsrapporter (plan B)** som
hoveddesign for regressionen, og betragt DST-kobling som en mulig udvidelse,
ikke en forudsætning.

| Kriterium | Status | Grundlag |
|---|---|---|
| CVR-adgang inden for 3 uger | **Opfyldt** | Login modtaget, alle felter verificeret, fuldt udtræk på under 2 minutter |
| ≥ 60 % af virksomheder med 10+ ansatte har fungerende hjemmeside med brugbar tekst | **Opfyldt, men kun med navnebaseret søgning** | Skøn 68–71 %. Med CVR's egne oplysninger alene: 54 % |
| Realistisk vej til DST-kobling eller årsrapport-proxyer | **Opfyldt via årsrapporter** | XBRL for 99 % af virksomhederne med 10+ ansatte. Udviklingsomkostninger aktiveret hos 30 %. DST-kobling stadig usandsynlig |

Det vigtigste at vide:

1. **CVR's hjemmesidefelt rækker ikke.** Kun 45 % af virksomhederne med 10+
   ansatte i kernekoderne har en hjemmeside registreret i CVR. Uden et ekstra
   trin, der finder sites ud fra navnet, falder dækningen under kriteriet.
2. **Små virksomheder bør ud.** Blandt virksomheder med 1–9 ansatte har kun
   halvdelen af dem, der *har* et site, brugbar tekst. De er desuden 10 gange så
   mange, og mange er enkeltpersoner med et ApS.
3. **Halvdelen af sitene er på engelsk.** Klassifikationen skal kunne begge sprog.
4. **Omsætning mangler i 86 % af årsrapporterne.** Brug bruttofortjeneste,
   antal ansatte og personaleomkostninger.

## Tjek 1: CVR-adgang

Login modtaget den 20. november 2026. `python -m src.cvr_client probe` bekræftede
alle feltnavne mod rigtige data. Tekniske noter:

| Punkt | Værdi |
|---|---|
| Endpoint | `https://distribution.virk.dk:8443` (HTTPS, oplyst i adgangsmailen) eller `http://distribution.virk.dk` (vejledningen) |
| Indeks | `cvr-permanent/virksomhed`, Elasticsearch 6.8 |
| Hastighed | 48.957 dokumenter på 1 min. 40 sek. med scroll og `size=200` |
| Aggregeringer | Virker på numeriske felter (fx `virksomhedsformkode`), ikke på tekstfelter |

**Fundet under verifikationen:** felterne `nyesteAarsbeskaeftigelse`,
`nyesteKvartalsbeskaeftigelse` og `nyesteMaanedsbeskaeftigelse` er ikke
opdateret siden 2018/2019. Det aktuelle antal ansatte står i
`nyesteErstMaanedsbeskaeftigelse` (august 2026 for de fleste). Forskellen er
stor: én testvirksomhed har 87 ansatte i det gamle felt og 22 i det nye.
Koden bruger nu det nye felt, når det er nyest. 51 % af virksomhederne har et
tal fra 2026 i feltet; 32 % har ingen beskæftigelsesoplysninger overhovedet
(typisk virksomheder uden ansatte).

Koderne for virksomhedsform er bekræftet: 10 = ENK, 15 = PMV, 30 = I/S.

**Sikkerhed:** dette miljøs proxy kan ikke nå port 8443, så udtrækket er kørt
over `http://`, dvs. med login i klartekst. Brug HTTPS-adressen, når I kører
lokalt, og skift evt. password.

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

### Population
Udtræk 20. november 2026, aktive virksomheder pr. hovedbranche:

- **48.957 aktive** i alle udvalgte koder.
- **22.950 personligt ejede** (ENK, PMV, I/S) er kun talt, ikke gemt. Kun 12 af
  dem har 10+ ansatte, så de betyder intet for en 10+-population.
- **663 under konkurs, likvidation eller tvangsopløsning** er udeladt; de står
  som aktive i CVR, men er ikke i drift.
- Tilbage: **25.344 virksomheder i drift**, heraf **2.146 med 10+ ansatte i
  kernekoderne** (2.427 inkl. 58.2, 61 og de militære koder).
- 74 % er reklamebeskyttede. Det hindrer ikke analyse, men de må ikke kontaktes
  i markedsføringsøjemed.

### Dækningstabel
Virksomheder i drift, ekskl. personligt ejede. "Eget domæne" er e-mail med
virksomhedens eget domæne, dvs. uden gmail o.l. og uden domæner, som 5 eller
flere virksomheder deler. Sidstnævnte er typisk revisorer og
registreringsagenter (fx `handelskammer.dk`, 37 virksomheder).

**Alle størrelser**

| Gruppe | I drift | Hjemmeside i CVR | E-mail i CVR | Eget domæne | Hjemmeside eller domæne |
|---|---|---|---|---|---|
| 26 Elektronik/optik | 718 | 28,6 % | 50,3 % | 45,7 % | 48,5 % |
| 30.3 Luft- og rumfart | 58 | 27,6 % | 39,7 % | 36,2 % | 44,8 % |
| 62 It-programmering/-konsulent | 13.768 | 26,8 % | 49,9 % | 41,5 % | 45,1 % |
| 63 It-infrastruktur/info | 1.466 | 28,0 % | 47,1 % | 40,0 % | 44,6 % |
| 71.12 Ingeniørrådgivning | 5.527 | 19,5 % | 47,1 % | 37,6 % | 39,4 % |
| 72.1 FoU natur/teknik | 1.327 | 23,8 % | 44,2 % | 36,8 % | 41,0 % |
| *58.2 Software* | 2.121 | 29,4 % | 42,9 % | 38,0 % | 42,5 % |
| *61 Tele/satellit* | 320 | 24,1 % | 49,7 % | 45,0 % | 49,4 % |
| *Militære koder* | 39 | 28,2 % | 41,0 % | 35,9 % | 35,9 % |

**Kun 10+ ansatte**

| Gruppe | I drift | Hjemmeside i CVR | Hjemmeside eller domæne |
|---|---|---|---|
| 26 | 182 | 30,2 % | 50,5 % |
| 30.3 | 16 | 31,2 % | 43,8 % |
| 62 | 1.154 | 50,4 % | 65,8 % |
| 63 | 130 | 43,1 % | 58,5 % |
| 71.12 | 467 | 41,8 % | 63,6 % |
| 72.1 | 197 | 39,6 % | 53,3 % |
| *58.2* | 209 | 56,9 % | 67,0 % |
| *61* | 66 | 30,3 % | 47,0 % |
| *Militære koder* | 6 | 50,0 % | 66,7 % |

**Fordeling på ansatte** (alle i drift, ekskl. personligt ejede)

| Gruppe | Ukendt | 0 | 1–9 | 10–49 | 50+ |
|---|---|---|---|---|---|
| 26 | 200 | 16 | 333 | 124 | 60 |
| 30.3 | 30 | 1 | 11 | 11 | 6 |
| 62 | 4.431 | 456 | 8.027 | 933 | 236 |
| 63 | 699 | 54 | 634 | 93 | 37 |
| 71.12 | 1.535 | 144 | 3.533 | 388 | 95 |
| 72.1 | 509 | 37 | 623 | 153 | 48 |
| *58.2* | 1.107 | 48 | 813 | 175 | 36 |
| *61* | 103 | 8 | 152 | 49 | 19 |

Fordelingen er opgjort før udeladelsen af virksomheder under opløsning, så
tallene er lidt højere end "I drift" ovenfor. "Ukendt" er virksomheder uden
beskæftigelsesoplysninger i CVR, som regel uden ansatte.

Bemærk, at virksomheder med 50+ ansatte i branche 26 og 30.3 *sjældnere* har
en registreret hjemmeside end mellemstore. Mange er datterselskaber i
koncerner, hvor sitet står på moderselskabet eller et andet domæne.

### Stikprøver af hjemmesider
Forside og robots.txt hentet med 1 sekunds pause, identificerende User-Agent
og robots.txt respekteret. Kun nøgletal er gemt. "Brugbar" betyder mindst 150
ord på dansk eller engelsk på forsiden.

| | Alle størrelser (n=200) | 10+ ansatte (n=200) |
|---|---|---|
| Svarer (HTTP < 400) | 84 % | 92 % |
| Afvist af robots.txt | 2 % | 4 % |
| Brugbar forside-tekst | 56 % | **86 %** |
| Median antal ord på forsiden | 392 | 855 |
| Sprog | 71 da / 69 en | 89 da / 91 en |

For 10+ ansatte afhænger brugbarheden af, hvor domænet kommer fra:

| Kilde | n | Svarer | Brugbar |
|---|---|---|---|
| Hjemmeside registreret i CVR | 147 | 97 % | 92 % |
| Kun e-maildomæne | 53 | 81 % | 72 % |

Blandt de 27 sites med 10+ ansatte, der ikke var brugbare: 7 blev afvist af
robots.txt, 9 havde lidt tekst og meget JavaScript (kan reddes med
browser-rendering), og resten fejlede eller havde for lidt tekst.

### Kan manglende hjemmesider findes?
38 % af virksomhederne med 10+ ansatte i kernekoderne har hverken hjemmeside
eller eget domæne i CVR. `src/site_discovery.py` tog 100 af dem og gættede på
`<navn>.dk` og `<navn>.com`. Et fund tæller kun, hvis forsiden viser
virksomhedens CVR-nummer (25) eller navn (28).

**53 af 100 blev fundet.** Det er en nedre grænse – en søgemaskine-API eller
opslag i fx Google Places ville finde flere. Valideringen på navn er svagere
end på CVR-nummer, så en lille andel kan være forkerte fund.

### Skøn for kriteriet
For de 2.146 virksomheder med 10+ ansatte i kernekoderne:

| Del | Andel | Brugbar | Bidrag |
|---|---|---|---|
| Hjemmeside i CVR | 45,2 % | 92 % | 41,6 % |
| Kun eget e-maildomæne | 16,9 % | 72 % | 12,2 % |
| Intet i CVR, fundet via navn | 37,9 % × 53 % | 72–86 % (antaget) | 14,5–17,3 % |
| **I alt** | | | **68–71 %** |

Kun med CVR's egne oplysninger: 54 %. Brugbarheden for navnefundne sites er
ikke målt; intervallet går fra e-maildomænernes 72 % til gennemsnittets 86 %.
Skønnet hviler på stikprøver på 100–200, så usikkerheden er nogle få
procentpoint.

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
er åbent uden login. Hvert hit linker til årsrapporten som XBRL, som
`src/financials.py` henter og parser.

| Variabel | Tilfældige regnskaber, alle brancher (n=200) | Egne virksomheder med 10+ ansatte (n=200) |
|---|---|---|
| Regnskab fundet | – | 99 % (169 for 2025, 28 for 2026) |
| Antal ansatte, resultat, egenkapital, aktiver | 78–100 % | 96 % |
| Personaleomkostninger | 40 % | 92 % |
| Bruttofortjeneste | 78 % | 87 % |
| Immaterielle aktiver | 10 % | 50 % |
| Aktiverede udviklingsomkostninger > 0 | 1 % | **30 %** |
| Omsætning | 14 % | 14 % (35 % blandt 50+) |
| FoU-omkostninger i resultatopgørelsen | 0 % | 0 % |

Andelen med aktiverede udviklingsomkostninger varierer på tværs af brancher:

| Gruppe | n | Aktiverede udviklingsomk. > 0 |
|---|---|---|
| 26 Elektronik/optik | 20 | 55 % |
| 58.2 Software | 19 | 53 % |
| 63 It-infrastruktur | 13 | 38 % |
| 62 It-programmering/-konsulent | 82 | 28 % |
| 72.1 FoU | 16 | 19 % |
| 71.12 Ingeniørrådgivning | 46 | 17 % |

Konsekvens for designet: brug **bruttofortjeneste, antal ansatte og
personaleomkostninger pr. ansat** som udfald og kontrolvariable, og brug
**aktiverede udviklingsomkostninger som ja/nej-indikator** for
udviklingsaktivitet. Det er et regnskabsvalg, så et nej betyder ikke, at
virksomheden ikke udvikler. Omsætning kan ikke bruges som hovedvariabel.

## GDPR og etik
- Personligt ejede virksomheder (ENK, PMV, I/S) skrives ikke til datasættet;
  kun antal gemmes.
- Navne, adresser og deltagere gemmes ikke. Navnebaseret søgning holder kun
  navnet i hukommelsen under kørslen. E-mail reduceres til domæne.
- Fra hjemmesider gemmes kun nøgletal. Den fulde scraping vil indsamle tekst
  med personnavne (medarbejder- og kontaktsider); det kræver en særskilt
  beslutning om filtrering og opbevaring.
- Sæt `CONTACT_EMAIL` i `.env` før fuld scraping. Stikprøverne her er kørt
  uden kontaktadresse i User-Agent.
- Afklar med CBS, om behandlingen skal registreres (spørgsmål 10 til Hedman).

## Næste skridt

| Hvem | Hvad |
|---|---|
| Jer | Skift CVR-password og kør lokalt over HTTPS (`:8443`) |
| Jer | Send spørgsmålene til Jonas Hedman. Tag populationstallene og afgrænsningen til 10+ ansatte med |
| Jer | Send DST-mailen, helst med Hedman cc – nu som udvidelse, ikke forudsætning |
| Jer + Hedman | Beslut, om 58.2 (software), 61 og de militære koder skal med |
| Næste fase | Byg hjemmesidesøgning (navnegæt + evt. søge-API), browser-rendering til JavaScript-sites og en flersproget klassifikationsmodel |

## Kilder
- Erhvervsstyrelsen: [Kom godt igang med Elasticsearch](https://erhvervsstyrelsen.dk/kom-godt-igang-med-elasticSearch)
- Erhvervsstyrelsen: [System-til-system adgang til CVR-data (datahub)](http://datahub.virk.dk/dataset/system-til-system-adgang-til-cvr-data/resource/5038fd33-bb8d-4e43-a0eb-2d75cc0fa936)
- Erhvervsstyrelsen: [System-til-system-adgang til CVR-data (datacvr, ikke læst – spærret for automatisk adgang)](https://datacvr.virk.dk/artikel/system-til-system-adgang-til-cvr-data)
- Danmarks Statistik: [Dansk Branchekode er gældende (DB25)](https://www.dst.dk/da/Statistik/dokumentation/dansk-branchekode-er-gaeldende) og nøglen `DB07_DB25_nøgle_brancher.xlsx` derfra
- Danmarks Statistik: [Specialeordningen til uddannelsesinstitutioner](https://www.dst.dk/da/TilSalg/data-til-forskning/mikrodataordninger/specialeordningen-til-uddannelsesinstitutioner)
- Danmarks Statistik: [Regler for adgang til pseudonymiserede mikrodata under specialeordningen (pdf, 18/2-2026)](https://rss.dst.dk/ext/3391210222463/0/forskning/Regler-for-adgang-til-pseudonymiserede-mikrodata-under-Danmarks-Statistiks-specialeordning-(pdf)--pdf)
- Danmarks Statistik: [Specialeordningen er nu åben (1/9-2025)](https://www.dst.dk/da/TilSalg/data-til-forskning/nyt-og-meddelelser/2025/aaben-for-adgang-til-specialeordning)
