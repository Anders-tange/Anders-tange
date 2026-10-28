# Dyredex

En Pokédex for rigtige dyr. Tag et billede af et dyr, smid det ind, og AI'en (Claude) fortæller hvilket dyr det er. Første gang du fanger en art, bliver den "låst op" med sit eget nummer i samlingen.

**Live version:** https://claude.ai/artifact/5Ezc6rr2SdyGsGF4NBZ2AC

## Sådan virker det

- **Scan:** Vælg et eller flere billeder, træk dem ind, eller sæt ind med Ctrl+V. Billederne bliver gjort mindre (max 1600 px) i browseren, før de sendes videre.
- **Genkendelse:** Billedet sendes til Claude, som svarer med dansk navn, latinsk navn, dyregruppe, sjældenhed, en kort Pokédex-tekst, en sjov fakta og "stats". Hvis AI'en er i tvivl, viser den op til tre andre bud, og du kan altid rette navnet selv.
- **Sted og tid:** GPS-position og optagelsestidspunkt læses fra billedets EXIF-data (JPEG og WebP), før billedet bliver gjort mindre. De sendes med til AI'en, så den kan vurdere hvilke arter der lever dér på den årstid, og AI'en giver stedet et navn ud fra koordinaterne. Mangler billedet GPS, kan du skrive stedet selv (et standard-sted huskes i browseren). Hvert fund gemmer `place`, `geo` og `takenAt`, og fra dyrets side kan du åbne stedet på OpenStreetMap.
- **Samling:** Hvert billede gemmes som et fund. Fund af samme art (samme latinske navn) samles under ét nummer, så du kan have flere billeder af fx en rødræv.
- **Filtrering:** Søg, filtrér på dyregruppe og sortér efter nummer, navn, nyeste eller sjældenhed.

## Teknik

`index.html` er én fil med HTML, CSS og JavaScript uden byggetrin. Den kører som Claude-artifact og bruger tre funktioner fra artifact-runtime:

| Funktion | Bruges til |
| --- | --- |
| `sample` (med billeder) | AI-genkendelse af dyret |
| `assets` | Gemmer billederne |
| `db` | Gemmer fundene (`sightings`-samlingen) |

Åbner du filen direkte i en browser uden for Claude, virker den stadig, men uden AI og uden at gemme: du skriver selv navnet, og samlingen forsvinder, når siden lukkes.
