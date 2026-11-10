# Dyredex

En Pokédex for rigtige dyr. Tag et billede af et dyr, smid det ind, og AI'en (Claude) bestemmer arten. Første gang du fanger en art, bliver den registreret med sit nummer, og silhuetten i Dyredex'en bliver til dit eget billede.

**Live version:** https://claude.ai/artifact/5Ezc6rr2SdyGsGF4NBZ2AC

## Sådan virker det

- **Katalog med silhuetter:** 196 dyr fordelt på 8 regioner (Danmark, Europa, Afrika, Asien, Nordamerika, Sydamerika, Australien, Hav & is). Dyr, du ikke har fanget, vises som sorte silhuetter med `???`. Du kan afsløre et enkelt navn eller slå "Vis navne" til.
- **Regionale dexer:** Hver region har sin egen fremgang (fx `Afrika 1/27`), og Nationaldex'en viser det samlede tal.
- **Bonusdyr:** Fanger du en art, der ikke står i kataloget, får den et nummer efter kataloget (mærket B) og lægges i den region, hvor arten naturligt lever.
- **Præcis art:** AI'en skal altid bestemme arten (og race eller underart, hvis det kan ses), ikke bare "skorpion" eller "bille". Den forklarer, hvilke kendetegn der peger på arten, og foreslår lignende arter. "Bestem præcis art" kører en grundigere analyse af et gemt billede og kan flytte det til den rigtige art.
- **Achievements:** 32 badges i fanen "Achievements": Big 5, Big 7, Little 5, Ugly 5 og Danmarks Big 5, dyregrupper (kattedyr, menneskeaber, bjørne, skorpioner …), medaljer i bronze, sølv og guld for hver region, rejser og tid (Globetrotter, Natugle, Alle årstider, Safaridag …), samling og nogle sjove. De beregnes ud fra dine fund, og nye badges fejres med en pop-up.
- **Album-import:** "Importér fotoalbum" tager mange billeder på én gang (træk-og-slip af mere end 5 billeder gør det samme). Billeder af arter, du allerede har, springes over, ligesom billeder uden dyr og billeder, der allerede er importeret (genkendt på filnavn, størrelse og dato). Nye arter, som AI'en er mindst 75 % sikker på at have bestemt til art, registreres automatisk. Resten lægges til gennemsyn. To billeder scannes ad gangen, og importen sættes på pause, hvis grænsen for AI-kald rammes.
- **Sjældenhed:** Fem niveauer med hver sin farve (almindelig, usædvanlig, sjælden, episk, legendarisk) ud fra hvor sjælden arten er i naturen, med en kort forklaring og rødlistestatus (IUCN). Brikkerne får farvet kant, episke dyr gløder, legendariske glimter, og fejringen bliver større (konfetti) jo sjældnere fundet er.
- **Shiny-varianter:** Fotograferer du et individ med en usædvanlig farvevariant (albino, bleg/leucistisk, sort/melanistisk), markeres billedet med ✨, holo-kortet glimter ekstra, og det giver bonus-XP og badges.
- **Stats, level og kampkraft:** Hvert dyr har et radar-diagram over fart, styrke, snilde og nuttethed med karakterer fra S til D. Billeder, sejre, sjældenhed og shiny giver XP og level, og Kampkraft (KK) samler det i ét tal. Gitteret kan sorteres efter nummer, kampkraft, sjældenhed, level eller nyeste.
- **Dagens missioner:** Tre nye missioner hver dag (fx "Fang en fugl", "Tag 3 dyrebilleder", "Vind 2 kampe"), de samme for alle trænere. Klarer du alle tre, tæller det med i din streak og i badges.
- **Kun ægte dyr:** AI'en tjekker først, om det er et ægte dyr. Statuer, figurer, legetøj, tegninger, udstoppede dyr og dyr på skærme eller skilte kan ikke registreres (album-importen springer dem over). Tager AI'en fejl, kan du trykke "Det er et ægte dyr".
- **Holo-kort:** Tryk "HOLO-KORT" på et fanget dyr for at se dit foto som et samlekort med navn, nummer, typer, stats og regnbue-glimmer. Glimmeret er stærkere jo sjældnere dyret er. Kortet vipper, når du trækker over det, og ellers svajer det lidt af sig selv. AI'en tegner dyrets omrids (det kommer med ved nye scanninger, og ældre billeder får det med "Lad dyret poppe ud"), så dyret ligger på et lag foran baggrunden og popper ud, når kortet vipper. Hvis siden får lov til at læse telefonens bevægelsessensor, kan du også vippe telefonen.
- **Flere trænere:** Hver person har sin egen Dyredex under `players/<id>/`. Fanen "Trænere" viser en rangliste med arter, billeder, badges og sejre, og du kan kigge i de andres samlinger (kun læse). Venner inviteres ved at dele siden med deres e-mail som Editor; de skal kunne uploade billeder. Ejerens gamle samling flyttes automatisk ind under ejerens egen trænerprofil første gang den nye version åbnes.
- **Battle:** Vælg 2-6 dyr fra din egen og dine venners samlinger og en arena (savanne, jungle, hav, is …). Alle kæmper mod alle, og AI'en fortæller kampen dramatisk runde for runde, mens teksten skrives ud og taberne markeres "UDE". Udfaldet bygger på dyrenes rigtige evner, arenaen, deres stats, level og kampkraft samt en tilfældig "dagsform", så en omkamp kan ende anderledes. Du udpeger en af dine egne som din kæmper (★): vinder den, tæller det som en sejr, giver 60 XP og tæller med i badges og missioner. Historien kan kopieres og læses op. Uden AI simuleres kampen lokalt ud fra kampkraft.
- **Oplæsning:** Hvor Claude kan læse op, kan dyrets tekst og kampens forløb læses højt.
- **Hurtigere:** Gitteret viser små miniaturer (360 px), som laves ved upload. Ældre billeder får dem i baggrunden. På telefonen åbner det valgte dyr som et ark, og SCAN og Fotoalbum ligger altid i bunden.
- **Sted og tid:** GPS-position og optagelsestidspunkt læses fra billedets EXIF-data (JPEG og WebP), før billedet gøres mindre. De sendes med til AI'en som hjælp til at bestemme arten, og stedet får et navn. Mangler billedet GPS, kan du skrive stedet selv.
- **Betjening:** SCAN-knappen vælger billeder (flere ad gangen). Du kan også trække dem ind eller sætte ind med Ctrl+V. D-pad'en og piletasterne bladrer i dex'en.

## Teknik

`index.html` er én fil med HTML, CSS og JavaScript uden byggetrin. Den kører som Claude-artifact og bruger tre funktioner fra artifact-runtime:

| Funktion | Bruges til |
| --- | --- |
| `sample` (med billeder) | AI-genkendelse, den grundige artsbestemmelse og kampfortællingen |
| `assets` | Gemmer billederne |
| `db` | Trænere (`players`) og hver træners fund (`players/<id>/sightings`) |
| `user` | Hvem der kigger, så hver træner får sin egen samling og sit navn på ranglisten |
| `tts` | Oplæsning af dyretekster og kampe |

Kataloget ligger i `RAW` øverst i scriptet som linjer på formen `Navn|Latinsk navn|gruppekode|emoji`. Emojien vises som silhuet, indtil dyret er fanget. Fund matches til kataloget på det latinske navn.

Åbner du filen direkte i en browser uden for Claude, virker den stadig, men uden AI og uden at gemme.
