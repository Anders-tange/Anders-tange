# Dyredex

En Pokédex for rigtige dyr. Tag et billede af et dyr, smid det ind, og AI'en (Claude) bestemmer arten. Første gang du fanger en art, bliver den registreret med sit nummer, og silhuetten i Dyredex'en bliver til dit eget billede.

**Live version:** https://claude.ai/artifact/5Ezc6rr2SdyGsGF4NBZ2AC

## Sådan virker det

- **Katalog med silhuetter:** 198 dyr fordelt på 8 regioner (Danmark, Europa, Afrika, Asien, Nordamerika, Sydamerika, Australien, Hav & is). Dyr, du ikke har fanget, vises som sorte silhuetter med `???`. Du kan afsløre et enkelt navn eller slå "Vis navne" til.
- **Regionale dexer:** Hver region har sin egen fremgang (fx `Afrika 1/27`), og Nationaldex'en viser det samlede tal.
- **Bonusdyr:** Fanger du en art, der ikke står i kataloget, får den et nummer efter kataloget (mærket B) og lægges i den region, hvor arten naturligt lever.
- **Præcis art:** AI'en skal altid bestemme arten (og race eller underart, hvis det kan ses), ikke bare "skorpion" eller "bille". Den forklarer, hvilke kendetegn der peger på arten, og foreslår lignende arter. "Bestem præcis art" kører en grundigere analyse af et gemt billede og kan flytte det til den rigtige art.
- **Achievements:** 32 badges i fanen "Achievements": Big 5, Big 7, Little 5, Ugly 5 og Danmarks Big 5, dyregrupper (kattedyr, menneskeaber, bjørne, skorpioner …), medaljer i bronze, sølv og guld for hver region, rejser og tid (Globetrotter, Natugle, Alle årstider, Safaridag …), samling og nogle sjove. De beregnes ud fra dine fund, og nye badges fejres med en pop-up.
- **Album-import:** "Importér fotoalbum" tager mange billeder på én gang (træk-og-slip af mere end 5 billeder gør det samme). Billeder af arter, du allerede har, springes over, ligesom billeder uden dyr og billeder, der allerede er importeret (genkendt på filnavn, størrelse og dato). Nye arter, som AI'en er mindst 75 % sikker på at have bestemt til art, registreres automatisk. Resten lægges til gennemsyn. To billeder scannes ad gangen, og importen sættes på pause, hvis grænsen for AI-kald rammes.
- **Kun ægte dyr:** AI'en tjekker først, om det er et ægte dyr. Statuer, figurer, legetøj, tegninger, udstoppede dyr og dyr på skærme eller skilte kan ikke registreres (album-importen springer dem over). Tager AI'en fejl, kan du trykke "Det er et ægte dyr".
- **Sted og tid:** GPS-position og optagelsestidspunkt læses fra billedets EXIF-data (JPEG og WebP), før billedet gøres mindre. De sendes med til AI'en som hjælp til at bestemme arten, og stedet får et navn. Mangler billedet GPS, kan du skrive stedet selv.
- **Betjening:** SCAN-knappen vælger billeder (flere ad gangen). Du kan også trække dem ind eller sætte ind med Ctrl+V. D-pad'en og piletasterne bladrer i dex'en.

## Teknik

`index.html` er én fil med HTML, CSS og JavaScript uden byggetrin. Den kører som Claude-artifact og bruger tre funktioner fra artifact-runtime:

| Funktion | Bruges til |
| --- | --- |
| `sample` (med billeder) | AI-genkendelse og den grundige artsbestemmelse |
| `assets` | Gemmer billederne |
| `db` | Gemmer fundene (`sightings`-samlingen) |

Kataloget ligger i `RAW` øverst i scriptet som linjer på formen `Navn|Latinsk navn|gruppekode|emoji`. Emojien vises som silhuet, indtil dyret er fanget. Fund matches til kataloget på det latinske navn.

Åbner du filen direkte i en browser uden for Claude, virker den stadig, men uden AI og uden at gemme.
